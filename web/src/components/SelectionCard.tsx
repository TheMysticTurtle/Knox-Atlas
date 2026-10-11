import { useState } from "react";

import { categoryColors } from "../engine/colors";
import { coordinateText } from "../engine/coordinates";
import type { MapPoi, Point, RoomLoot } from "../engine/types";
import { CATEGORY_LABELS } from "../store";
import { CoordinateReadout } from "./CoordinateReadout";

/**
 * Details for the selection: a clicked POI (its categories + the game's expected loot for that room
 * type), or a jumped-to coordinate (`poi: null`). Both show copyable coordinates.
 */
export function SelectionCard({
  poi,
  point,
  cellSize,
  chunkSize,
  loot,
  onClose,
}: {
  poi: MapPoi | null;
  point: Point;
  cellSize: number;
  chunkSize: number;
  loot: RoomLoot;
  onClose: () => void;
}) {
  const items = poi ? (loot[poi.rawName.toLowerCase()] ?? []) : [];
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyCoordinates() {
    try {
      await navigator.clipboard.writeText(coordinateText(point));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <div className="selection-card">
      <button className="selection-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <span className="selection-eyebrow">{poi ? floorLabel(poi.floor) : "SELECTED LOCATION"}</span>
      <strong className="selection-title">{poi?.name ?? "Map coordinates"}</strong>

      <CoordinateReadout point={point} cellSize={cellSize} chunkSize={chunkSize} />
      <button
        className="copy-coordinates"
        onClick={() => void copyCoordinates()}
        title="Copy the selected location, not the moving pointer"
      >
        {copyStatus === "copied" ? "Copied ✓" : "Copy X/Y"}
      </button>
      <span className="copy-status" role="status">
        {copyStatus === "failed" && "Could not copy automatically. Select the X/Y numbers to copy them."}
      </span>

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

      <p className="selection-note">
        {poi
          ? "From the game's distribution tables — actual contents vary by save and sandbox."
          : "This is a selected map location, not your live player position."}
      </p>
    </div>
  );
}

/** RoomDef floor (Z) → card eyebrow. Negative Z is a basement level. */
function floorLabel(floor: number): string {
  if (floor < 0) return `BASEMENT ${Math.abs(floor)}`;
  if (floor > 0) return `FLOOR ${floor}`;
  return "GROUND FLOOR";
}

/** `Base.CannedBeans` → `Canned Beans`. */
function prettyItem(id: string): string {
  const bare = id.includes(".") ? id.slice(id.indexOf(".") + 1) : id;
  return bare
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}
