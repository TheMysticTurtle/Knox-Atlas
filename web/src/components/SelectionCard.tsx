import { categoryColors } from "../engine/colors";
import type { MapPoi, RoomLoot } from "../engine/types";
import { CATEGORY_LABELS } from "../store";

/** Details for a clicked POI: its categories + the game's expected loot for that room type. */
export function SelectionCard({
  poi,
  loot,
  onClose,
}: {
  poi: MapPoi;
  loot: RoomLoot;
  onClose: () => void;
}) {
  const items = loot[poi.rawName.toLowerCase()] ?? [];

  return (
    <div className="selection-card">
      <button className="selection-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <span className="selection-eyebrow">
        {poi.floor > 0 ? `FLOOR ${poi.floor}` : "GROUND FLOOR"}
      </span>
      <strong className="selection-title">{poi.name}</strong>

      <div className="selection-cats">
        {poi.categories.map((category) => (
          <span key={category} className="selection-cat" style={{ background: categoryColors[category] }}>
            {CATEGORY_LABELS[category]}
          </span>
        ))}
      </div>

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
        <p className="selection-empty">No specific loot table for this room type.</p>
      )}

      <p className="selection-note">
        {Math.round(poi.x)}, {Math.round(poi.y)} · from the game's own distribution tables — actual
        contents vary by save &amp; sandbox.
      </p>
    </div>
  );
}

/** `Base.CannedBeans` → `Canned Beans`. */
function prettyItem(id: string): string {
  const bare = id.includes(".") ? id.slice(id.indexOf(".") + 1) : id;
  return bare
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}
