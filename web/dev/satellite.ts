// Local Vite-only tile provider for browser development. Not a public map server or a production
// filesystem API: it reads the install recorded in the generated snapshot, never a path supplied by
// an HTTP request. (The desktop app reads tiles through Rust: `crates/core/src/satellite.rs`.)
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import yauzl from "yauzl";
import type { Plugin } from "vite";
import type { SatelliteInfo } from "../src/engine/types";

type Source = { zip: yauzl.ZipFile; entries: Map<string, yauzl.Entry>; info: SatelliteInfo };

const MAX_TILE_BYTES = 1_048_576;
const MAX_METADATA_BYTES = 4096;
const TILE_NAME = /^\d+\/tile\d+x\d+\.png$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Parse `pyramid.txt` (VERSION=1). Mirrors `parse_info` in the Rust reader. */
export function parsePyramidInfo(text: string, levels: number[]): SatelliteInfo {
  const values = new Map<string, string>(
    text.split(/\r?\n/).map((line) => {
      const [key, value = ""] = line.trim().split("=");
      return [key, value];
    }),
  );
  const numbers = (key: string) =>
    (values.get(key) ?? "").trim().split(/\s+/).map(Number);
  const bounds = numbers("bounds");
  const size = numbers("imageSize");

  const valid =
    values.get("VERSION") === "1" &&
    bounds.length === 4 &&
    size.length === 2 &&
    [...bounds, ...size].every((n) => Number.isFinite(n)) &&
    bounds[2] > bounds[0] &&
    bounds[3] > bounds[1] &&
    size.every((n) => Number.isInteger(n) && n > 0 && n <= 131072) &&
    levels.length > 0 &&
    levels.every((level, index) => level === index && level <= 16);
  if (!valid) throw new Error("Unsupported satellite metadata or zoom levels");

  return {
    bounds: { minX: bounds[0], minY: bounds[1], maxX: bounds[2], maxY: bounds[3] },
    imageWidth: size[0],
    imageHeight: size[1],
    tileSize: 256,
    levels,
  };
}

/** Read one archive entry, refusing anything over `limit` bytes (declared or actual). */
async function readEntry(
  source: Pick<Source, "zip" | "entries">,
  name: string,
  limit: number,
): Promise<Buffer> {
  const entry = source.entries.get(name);
  if (!entry || entry.uncompressedSize > limit) {
    throw new Error(`Missing or oversized satellite entry: ${name}`);
  }
  const stream = await new Promise<Readable>((resolve, reject) => {
    source.zip.openReadStream(entry, (error, stream) => (error ? reject(error) : resolve(stream)));
  });
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > limit) {
      stream.destroy();
      throw new Error("Satellite entry exceeds supported size");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

/** Only 256×256 PNG tiles are supported (checked from the PNG header). */
function validateTile(bytes: Buffer): void {
  const valid =
    bytes.length >= 24 &&
    bytes.subarray(0, 8).equals(PNG_SIGNATURE) &&
    bytes.toString("ascii", 12, 16) === "IHDR" &&
    bytes.readUInt32BE(16) === 256 &&
    bytes.readUInt32BE(20) === 256;
  if (!valid) throw new Error("Unsupported satellite PNG tile");
}

/** Open `pyramid.zip`, index its tile entries, and validate metadata + a real tile up front. */
export async function openSatellite(archivePath: string): Promise<Source> {
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, autoClose: false }, (error, file) =>
      error ? reject(error) : resolve(file),
    );
  });
  try {
    const entries = new Map<string, yauzl.Entry>();
    await new Promise<void>((resolve, reject) => {
      zip.on("error", reject);
      zip.on("entry", (entry: yauzl.Entry) => {
        if (entry.fileName === "pyramid.txt" || TILE_NAME.test(entry.fileName)) {
          entries.set(entry.fileName, entry);
        }
        zip.readEntry();
      });
      zip.once("end", resolve);
      zip.readEntry();
    });

    const source = { zip, entries };
    const text = (await readEntry(source, "pyramid.txt", MAX_METADATA_BYTES)).toString("utf8");
    const tileLevels = [...entries.keys()]
      .filter((name) => name !== "pyramid.txt")
      .map((name) => Number(name.split("/")[0]));
    const levels = [...new Set(tileLevels)].sort((a, b) => a - b);
    const info = parsePyramidInfo(text, levels);
    validateTile(await readEntry(source, "0/tile0x0.png", MAX_TILE_BYTES));
    return { ...source, info };
  } catch (error) {
    zip.close();
    throw error;
  }
}

/** Vite dev-server plugin serving `/__atlas_satellite/info` and `/__atlas_satellite/<level>/<x>/<y>`. */
export function satellitePreview(): Plugin {
  let pending: Promise<Source> | undefined;
  let root = "";

  // Open the archive lazily on first request; a failure clears the cache so a retry can succeed.
  const getSource = () =>
    (pending ??= (async () => {
      const snapshotPath = path.join(root, "public/snapshot.json");
      const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
      if (typeof snapshot.installPath !== "string") {
        throw new Error("Regenerate the local map snapshot first");
      }
      return openSatellite(path.join(snapshot.installPath, "media/maps/Muldraugh, KY/pyramid.zip"));
    })().catch((error) => {
      pending = undefined;
      throw error;
    }));

  return {
    name: "knox-atlas-local-satellite",
    apply: "serve",
    configResolved(config) {
      root = config.root;
    },
    configureServer(server) {
      server.httpServer?.once("close", () => {
        void pending?.then((source) => source.zip.close()).catch(() => {});
      });

      server.middlewares.use("/__atlas_satellite", (req, res) => {
        // Reject LAN/public hosts and cross-origin reads, even if someone starts Vite with --host.
        const host = req.headers.host ?? "";
        const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
        const sameOrigin = !req.headers.origin || req.headers.origin === `http://${host}`;
        if (!localHost || !sameOrigin || req.method !== "GET") {
          res.writeHead(403).end();
          return;
        }

        void (async () => {
          const url = req.url ?? "";
          const match = /^\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})$/.exec(url);
          if (url !== "/info" && !match) {
            res.writeHead(404).end();
            return;
          }
          const source = await getSource();
          if (url === "/info") {
            res
              .writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
              .end(JSON.stringify(source.info));
            return;
          }

          const [level, x, y] = match!.slice(1).map(Number);
          const span = 256 * 2 ** level;
          const inImage =
            source.info.levels.includes(level) &&
            x < Math.ceil(source.info.imageWidth / span) &&
            y < Math.ceil(source.info.imageHeight / span);
          if (!inImage) {
            res.writeHead(404).end();
            return;
          }
          const bytes = await readEntry(source, `${level}/tile${x}x${y}.png`, MAX_TILE_BYTES);
          validateTile(bytes);
          res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" }).end(bytes);
        })().catch((error) => {
          if (!res.headersSent) {
            res
              .writeHead(503, { "Content-Type": "application/json" })
              .end(JSON.stringify({ error: String(error) }));
          } else {
            res.end();
          }
        });
      });
    },
  };
}
