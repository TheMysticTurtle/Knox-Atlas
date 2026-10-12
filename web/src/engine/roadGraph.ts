// Road network + route finding over the game's named street centerlines (`streets.xml`).
//
// Why centerlines: `worldmap.xml` roads are filled areas chopped at cell borders — useless as a graph.
// `streets.xml` gives named polylines. They rarely share exact vertices: streets cross mid-segment,
// and side streets stop near (not on) the road they meet. So the graph is built by
//   1. splitting segments where two different streets cross, and
//   2. snapping each street's end onto the nearest other street within SNAP_DISTANCE tiles
//      (measured 2026-10-11: at 12 tiles, 99.5% of streets form one network).
// Routes use A* (straight-line heuristic, admissible because edges are straight segments).
// Known limits: dirt trails are not in `streets.xml`; a crossing is always treated as a junction
// (a rare overpass would be wrong).
//
// Pure and self-contained (type-only imports) so it runs under the Node test runner.

import type { Point, Street } from "./types";

/** Street ends within this many tiles of another street are joined to it. */
export const SNAP_DISTANCE = 12;
/** Spatial-index cell size, in tiles. */
const GRID_SIZE = 64;

type GraphEdge = { a: number; b: number; length: number; street: string | null };
type Link = { to: number; length: number; street: string | null };

export type RoadGraph = {
  nodes: Point[];
  edges: GraphEdge[];
  /** Per node: neighbouring nodes. */
  links: Link[][];
  /** Spatial index: grid cell → indices of edges whose bounds touch it. */
  edgeGrid: Map<string, number[]>;
};

export type Route = {
  /** The on-road part, from the street nearest the start to the street nearest the end. */
  road: Point[];
  /** Straight off-road legs: start → road, and road → end (may be zero-length). */
  startLeg: [Point, Point];
  endLeg: [Point, Point];
  roadLength: number;
  offRoadLength: number;
  /** Street names in travel order, consecutive repeats collapsed. */
  streets: string[];
};

export type RouteResult =
  | { ok: true; route: Route }
  | { ok: false; reason: "no-roads" | "unreachable" };

/** A route through several stops in order: one `Route` per leg. */
export type Trip = {
  legs: Route[];
  roadLength: number;
  offRoadLength: number;
  streets: string[];
};

export type TripResult =
  | { ok: true; trip: Trip }
  | { ok: false; reason: "no-roads" | "unreachable"; leg: number };

/** Route through `stops` in order (at least two). Fails on the first leg that can't be routed. */
export function planTrip(graph: RoadGraph, stops: Point[]): TripResult {
  const legs: Route[] = [];
  for (let index = 1; index < stops.length; index += 1) {
    const result = findRoute(graph, stops[index - 1], stops[index]);
    if (!result.ok) return { ok: false, reason: result.reason, leg: index - 1 };
    legs.push(result.route);
  }
  const names = legs.flatMap((leg) => leg.streets);
  return {
    ok: true,
    trip: {
      legs,
      roadLength: legs.reduce((total, leg) => total + leg.roadLength, 0),
      offRoadLength: legs.reduce((total, leg) => total + leg.offRoadLength, 0),
      streets: names.filter((name, index) => index === 0 || names[index - 1] !== name),
    },
  };
}

/** One polyline for the whole trip (off-road legs included), e.g. to save it as a path. */
export function tripPolyline(trip: Trip): Point[] {
  const points: Point[] = [];
  for (const leg of trip.legs) {
    for (const point of [leg.startLeg[0], ...leg.road, leg.endLeg[1]]) {
      const last = points[points.length - 1];
      if (!last || last.x !== point.x || last.y !== point.y) points.push(point);
    }
  }
  return points;
}

/** Stop label: "Start" for the first, "End" for the last (once there are two), 1, 2… in between. */
export function stopTag(index: number, count: number): string {
  if (index === 0) return "Start";
  if (index === count - 1) return "End";
  return String(index);
}

/** The road network is built once per street list (cheap, ~30 ms, but no need to repeat it). */
const graphCache = new WeakMap<Street[], RoadGraph>();
export function roadGraphFor(streets: Street[]): RoadGraph {
  let graph = graphCache.get(streets);
  if (!graph) {
    graph = buildRoadGraph(streets);
    graphCache.set(streets, graph);
  }
  return graph;
}

// --- building ------------------------------------------------------------------

type Cut = { t: number; point: Point };
/** `from`/`to`: distance along its street where the segment starts/ends (for same-street joins). */
type Segment = { street: number; a: Point; b: Point; from: number; to: number; cuts: Cut[] };

/**
 * A street may join ITSELF (a loop whose end stops beside its own start, like Scenic Grove Road),
 * but not to the stretch it is attached to: same-street joins need this much road in between.
 */
const SELF_JOIN_MIN_ALONG = SNAP_DISTANCE * 3;

export function buildRoadGraph(streets: Street[]): RoadGraph {
  const segments: Segment[] = [];
  const streetLengths: number[] = [];
  streets.forEach((street, index) => {
    let along = 0;
    for (let i = 1; i < street.points.length; i += 1) {
      const a = street.points[i - 1];
      const b = street.points[i];
      if (a.x === b.x && a.y === b.y) continue;
      const length = distance(a, b);
      segments.push({
        street: index,
        a,
        b,
        from: along,
        to: along + length,
        cuts: [{ t: 0, point: a }, { t: 1, point: b }],
      });
      along += length;
    }
    streetLengths.push(along);
  });

  const segmentGrid = new Map<string, number[]>();
  segments.forEach((segment, index) => addToGrid(segmentGrid, segmentBounds(segment, SNAP_DISTANCE), index));

  // 1. Streets crossing mid-segment become a shared junction (a street crossing itself counts,
  //    as long as the two stretches are far apart along it).
  const checked = new Set<string>();
  for (const bucket of segmentGrid.values()) {
    for (let i = 0; i < bucket.length; i += 1) {
      for (let j = i + 1; j < bucket.length; j += 1) {
        const [first, second] = bucket[i] < bucket[j] ? [bucket[i], bucket[j]] : [bucket[j], bucket[i]];
        const pair = `${first},${second}`;
        if (checked.has(pair)) continue;
        checked.add(pair);
        const left = segments[first];
        const right = segments[second];
        if (left.street === right.street && alongGap(left, right) < SELF_JOIN_MIN_ALONG) continue;
        const hit = intersection(left.a, left.b, right.a, right.b);
        if (hit) {
          left.cuts.push({ t: hit.t, point: hit.point });
          right.cuts.push({ t: hit.u, point: hit.point });
        }
      }
    }
  }

  // 2. A street end near a street (T-junction / near miss / a loop closing on itself) joins it.
  const connectors: [Point, Point][] = [];
  streets.forEach((street, index) => {
    if (street.points.length < 2) return;
    const ends = [
      { point: street.points[0], along: 0 },
      { point: street.points[street.points.length - 1], along: streetLengths[index] },
    ];
    for (const { point: end, along } of ends) {
      let best: { segment: Segment; t: number; point: Point; distance: number } | null = null;
      for (const candidate of gridCandidates(segmentGrid, end)) {
        const segment = segments[candidate];
        if (segment.street === index && alongDistance(segment, along) < SELF_JOIN_MIN_ALONG) continue;
        const near = closestOnSegment(end, segment.a, segment.b);
        if (near.distance <= SNAP_DISTANCE && (!best || near.distance < best.distance)) {
          best = { segment, ...near };
        }
      }
      if (!best) continue;
      best.segment.cuts.push({ t: best.t, point: best.point });
      if (best.distance > 1e-6) connectors.push([end, best.point]);
    }
  });

  // 3. Nodes (merged by position) and edges between consecutive cuts.
  const nodes: Point[] = [];
  const nodeIds = new Map<string, number>();
  const nodeFor = (point: Point): number => {
    const key = `${Math.round(point.x * 100)},${Math.round(point.y * 100)}`;
    let id = nodeIds.get(key);
    if (id === undefined) {
      id = nodes.length;
      nodes.push({ x: point.x, y: point.y });
      nodeIds.set(key, id);
    }
    return id;
  };

  const edges: GraphEdge[] = [];
  const addEdge = (from: Point, to: Point, street: string | null) => {
    const a = nodeFor(from);
    const b = nodeFor(to);
    if (a === b) return;
    edges.push({ a, b, length: distance(nodes[a], nodes[b]), street });
  };

  for (const segment of segments) {
    const cuts = [...segment.cuts].sort((left, right) => left.t - right.t);
    for (let i = 1; i < cuts.length; i += 1) {
      addEdge(cuts[i - 1].point, cuts[i].point, streets[segment.street].name);
    }
  }
  for (const [from, to] of connectors) addEdge(from, to, null);

  const links: Link[][] = nodes.map(() => []);
  const edgeGrid = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    links[edge.a].push({ to: edge.b, length: edge.length, street: edge.street });
    links[edge.b].push({ to: edge.a, length: edge.length, street: edge.street });
    addToGrid(edgeGrid, boundsOf(nodes[edge.a], nodes[edge.b], 0), index);
  });

  return { nodes, edges, links, edgeGrid };
}

// --- routing -------------------------------------------------------------------

type Access = { edge: number; point: Point; distance: number };

/** Shortest route by road between two points; each end walks straight to its nearest street. */
export function findRoute(graph: RoadGraph, from: Point, to: Point): RouteResult {
  const start = nearestEdge(graph, from);
  const end = nearestEdge(graph, to);
  if (!start || !end) return { ok: false, reason: "no-roads" };

  // Two temporary nodes where the ends meet the road, linked into their edges' endpoints.
  const startId = graph.nodes.length;
  const endId = startId + 1;
  const position = (id: number): Point =>
    id === startId ? start.point : id === endId ? end.point : graph.nodes[id];
  const extra = new Map<number, Link[]>();
  const link = (a: number, b: number, street: string | null) => {
    const length = distance(position(a), position(b));
    if (!extra.has(a)) extra.set(a, []);
    if (!extra.has(b)) extra.set(b, []);
    extra.get(a)!.push({ to: b, length, street });
    extra.get(b)!.push({ to: a, length, street });
  };
  for (const [id, access] of [
    [startId, start],
    [endId, end],
  ] as const) {
    const edge = graph.edges[access.edge];
    link(id, edge.a, edge.street);
    link(id, edge.b, edge.street);
  }
  if (start.edge === end.edge) link(startId, endId, graph.edges[start.edge].street);

  const neighbours = (id: number): Link[] => [...(graph.links[id] ?? []), ...(extra.get(id) ?? [])];

  // A* from startId to endId.
  const best = new Map<number, number>([[startId, 0]]);
  const came = new Map<number, { from: number; street: string | null }>();
  const open = new MinHeap();
  open.push(startId, distance(start.point, end.point));
  const closed = new Set<number>();
  while (open.size > 0) {
    const current = open.pop()!;
    if (current === endId) break;
    if (closed.has(current)) continue;
    closed.add(current);
    const base = best.get(current)!;
    for (const next of neighbours(current)) {
      const cost = base + next.length;
      if (cost < (best.get(next.to) ?? Infinity)) {
        best.set(next.to, cost);
        came.set(next.to, { from: current, street: next.street });
        open.push(next.to, cost + distance(position(next.to), end.point));
      }
    }
  }
  if (!best.has(endId)) return { ok: false, reason: "unreachable" };

  const road: Point[] = [];
  const names: string[] = [];
  for (let id: number | undefined = endId; id !== undefined; id = came.get(id)?.from) {
    road.push(position(id));
    const step = came.get(id);
    if (step?.street) names.push(step.street);
  }
  road.reverse();
  names.reverse();

  return {
    ok: true,
    route: {
      road,
      startLeg: [from, start.point],
      endLeg: [end.point, to],
      roadLength: best.get(endId)!,
      offRoadLength: start.distance + end.distance,
      streets: names.filter((name, index) => index === 0 || names[index - 1] !== name),
    },
  };
}

/** The closest point on any road to `point` (searching outward through the spatial index). */
function nearestEdge(graph: RoadGraph, point: Point): Access | null {
  if (graph.edges.length === 0) return null;
  const cx = Math.floor(point.x / GRID_SIZE);
  const cy = Math.floor(point.y / GRID_SIZE);
  let best: Access | null = null;
  const seen = new Set<number>();
  for (let ring = 0; ; ring += 1) {
    // Anything in this ring or beyond is at least (ring - 1) cells away.
    if (best && (ring - 1) * GRID_SIZE > best.distance) return best;
    if (ring > 4096) return best;
    for (let x = cx - ring; x <= cx + ring; x += 1) {
      for (let y = cy - ring; y <= cy + ring; y += 1) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== ring) continue;
        for (const index of graph.edgeGrid.get(`${x},${y}`) ?? []) {
          if (seen.has(index)) continue;
          seen.add(index);
          const edge = graph.edges[index];
          const near = closestOnSegment(point, graph.nodes[edge.a], graph.nodes[edge.b]);
          if (!best || near.distance < best.distance) {
            best = { edge: index, point: near.point, distance: near.distance };
          }
        }
      }
    }
  }
}

// --- geometry & data-structure helpers -------------------------------------------

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Road distance along their street between two of its segments (0 if they touch). */
function alongGap(left: Segment, right: Segment): number {
  return Math.max(0, Math.max(left.from, right.from) - Math.min(left.to, right.to));
}

/** Road distance along its street from a position on it to the nearest part of `segment`. */
function alongDistance(segment: Segment, along: number): number {
  if (along < segment.from) return segment.from - along;
  if (along > segment.to) return along - segment.to;
  return 0;
}

/** Proper intersection of segments ab and cd (parameters t on ab, u on cd), or null. */
function intersection(a: Point, b: Point, c: Point, d: Point): { t: number; u: number; point: Point } | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-9) return null; // parallel or collinear
  const qx = c.x - a.x;
  const qy = c.y - a.y;
  const t = (qx * sy - qy * sx) / denominator;
  const u = (qx * ry - qy * rx) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u, point: { x: a.x + t * rx, y: a.y + t * ry } };
}

function closestOnSegment(p: Point, a: Point, b: Point): { t: number; point: Point; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
    : 0;
  const point = { x: a.x + t * dx, y: a.y + t * dy };
  return { t, point, distance: distance(p, point) };
}

type Box = { minX: number; minY: number; maxX: number; maxY: number };

function boundsOf(a: Point, b: Point, pad: number): Box {
  return {
    minX: Math.min(a.x, b.x) - pad,
    minY: Math.min(a.y, b.y) - pad,
    maxX: Math.max(a.x, b.x) + pad,
    maxY: Math.max(a.y, b.y) + pad,
  };
}

function segmentBounds(segment: Segment, pad: number): Box {
  return boundsOf(segment.a, segment.b, pad);
}

function addToGrid(grid: Map<string, number[]>, box: Box, index: number): void {
  for (let x = Math.floor(box.minX / GRID_SIZE); x <= Math.floor(box.maxX / GRID_SIZE); x += 1) {
    for (let y = Math.floor(box.minY / GRID_SIZE); y <= Math.floor(box.maxY / GRID_SIZE); y += 1) {
      const key = `${x},${y}`;
      const bucket = grid.get(key);
      if (bucket) bucket.push(index);
      else grid.set(key, [index]);
    }
  }
}

/** Segment indices stored in the grid cell containing `point` (segments are padded by SNAP_DISTANCE). */
function gridCandidates(grid: Map<string, number[]>, point: Point): number[] {
  return grid.get(`${Math.floor(point.x / GRID_SIZE)},${Math.floor(point.y / GRID_SIZE)}`) ?? [];
}

/** Minimal binary min-heap of node ids by priority (duplicates allowed; stale entries skipped). */
class MinHeap {
  private ids: number[] = [];
  private priorities: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, priority: number): void {
    this.ids.push(id);
    this.priorities.push(priority);
    let index = this.ids.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[index]) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  pop(): number | undefined {
    if (this.ids.length === 0) return undefined;
    const top = this.ids[0];
    const lastId = this.ids.pop()!;
    const lastPriority = this.priorities.pop()!;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.priorities[0] = lastPriority;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.ids.length && this.priorities[left] < this.priorities[smallest]) smallest = left;
        if (right < this.ids.length && this.priorities[right] < this.priorities[smallest]) smallest = right;
        if (smallest === index) break;
        this.swap(index, smallest);
        index = smallest;
      }
    }
    return top;
  }

  private swap(i: number, j: number): void {
    [this.ids[i], this.ids[j]] = [this.ids[j], this.ids[i]];
    [this.priorities[i], this.priorities[j]] = [this.priorities[j], this.priorities[i]];
  }
}
