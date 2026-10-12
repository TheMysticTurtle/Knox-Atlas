import { useState } from "react";

import { categoryColors } from "../engine/colors";
import { coordinateText } from "../engine/coordinates";
import { prettyItem } from "../engine/search";
import type { RoomLoot, Selection } from "../engine/types";
import { useMapUi } from "../mapUiStore";
import { LIMITS } from "../savedStorage";
import { useSaved } from "../savedStore";
import { CATEGORY_LABELS } from "../store";
import { CoordinateReadout } from "./CoordinateReadout";
import { NameColorForm } from "./NameColorForm";

type SelectionCardProps = {
  selection: Selection;
  loot: RoomLoot;
  cellSize: number;
  chunkSize: number;
  onClose: () => void;
};

/**
 * The click popup. Whatever was clicked — a saved place, a room POI, or bare ground — it offers the
 * same three actions: save (or edit) the place, copy its X/Y, and measure from here. A room POI also
 * shows its categories and the game's expected loot for that room type.
 */
export function SelectionCard({ selection, loot, cellSize, chunkSize, onClose }: SelectionCardProps) {
  const { point, poi, markerId } = selection;
  const marker = useSaved((state) => state.markers.find((item) => item.id === markerId));
  const markerCount = useSaved((state) => state.markers.length);
  const addMarker = useSaved((state) => state.addMarker);
  const updateMarker = useSaved((state) => state.updateMarker);
  const removeMarker = useSaved((state) => state.removeMarker);
  const allGroups = useSaved((state) => state.layout.groups);
  const groups = allGroups.filter((group) => group.section === "places");
  const select = useMapUi((state) => state.select);
  const startMeasure = useMapUi((state) => state.startMeasure);
  const [formOpen, setFormOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const items = poi ? (loot[poi.rawName.toLowerCase()] ?? []) : [];
  const atLimit = !marker && markerCount >= LIMITS.markers;

  async function copyCoordinates() {
    try {
      await navigator.clipboard.writeText(coordinateText(point));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  function savePlace(name: string, color: Parameters<typeof addMarker>[2], group?: string) {
    if (marker) {
      updateMarker(marker.id, name, color, group);
    } else {
      const saved = addMarker(point, name, color, group);
      if (saved) select({ point: { x: saved.x, y: saved.y }, poi, markerId: saved.id });
    }
    setFormOpen(false);
  }

  function deletePlace() {
    if (!marker) return;
    removeMarker(marker.id);
    onClose();
  }

  return (
    <div className="selection-card">
      <button className="selection-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <span className="selection-eyebrow">
        {marker ? "SAVED PLACE" : poi ? floorLabel(poi.floor) : "MAP POINT"}
      </span>
      <strong className="selection-title">{marker?.label ?? poi?.name ?? "Map point"}</strong>

      <CoordinateReadout point={point} cellSize={cellSize} chunkSize={chunkSize} />

      {formOpen ? (
        <NameColorForm
          initialName={marker?.label ?? poi?.name ?? ""}
          initialColor={marker?.color ?? "amber"}
          placeholder="Safehouse, meetup, supplies…"
          submitLabel={marker ? "Save changes" : "Save place"}
          groups={groups}
          initialGroup={marker?.group}
          note={marker ? undefined : `Saved on this computer · ${markerCount}/${LIMITS.markers}`}
          onSubmit={savePlace}
          onCancel={() => setFormOpen(false)}
          extra={
            marker && (
              <button type="button" className="danger-action" onClick={deletePlace}>
                Delete
              </button>
            )
          }
        />
      ) : (
        <div className="card-actions">
          <button
            onClick={() => setFormOpen(true)}
            disabled={atLimit}
            title={atLimit ? `You can save up to ${LIMITS.markers} places` : undefined}
          >
            {marker ? "Edit place" : "Save place"}
          </button>
          <button onClick={() => void copyCoordinates()} title="Copy this point's X/Y">
            {copyStatus === "copied" ? "Copied ✓" : "Copy X/Y"}
          </button>
          <button onClick={() => startMeasure(point)} title="Measure a distance starting here">
            Measure from here
          </button>
        </div>
      )}
      {copyStatus === "failed" && (
        <span className="copy-status" role="status">
          Could not copy automatically. Select the X/Y numbers to copy them.
        </span>
      )}

      {poi && (
        <div className="selection-cats">
          {poi.categories.map((category) => (
            <span key={category} className="selection-cat" style={{ background: categoryColors[category] }}>
              {CATEGORY_LABELS[category]}
            </span>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <>
          <p className="selection-loot-heading">Likely loot · {items.length} item types</p>
          <ul className="selection-loot">
            {items.slice(0, 24).map((entry) => (
              <li key={entry.item}>{prettyItem(entry.item)}</li>
            ))}
          </ul>
        </>
      ) : (
        poi && <p className="selection-empty">No specific loot table for this room type.</p>
      )}

      {poi && (
        <p className="selection-note">
          From the game's distribution tables — actual contents vary by save and sandbox.
        </p>
      )}
    </div>
  );
}

/** RoomDef floor (Z) → card eyebrow. Negative Z is a basement level. */
function floorLabel(floor: number): string {
  if (floor < 0) return `BASEMENT ${Math.abs(floor)}`;
  if (floor > 0) return `FLOOR ${floor}`;
  return "GROUND FLOOR";
}
