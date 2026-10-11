import type { ViewOptions } from "../engine/mapEngine";
import { useView } from "../viewStore";

const ITEMS: { key: keyof ViewOptions; label: string; hint?: string }[] = [
  { key: "buildings", label: "Buildings", hint: "Building colors in the map view" },
  { key: "towns", label: "Town & area names" },
  { key: "streets", label: "Street names" },
  { key: "businesses", label: "Business names" },
  {
    key: "satellite",
    label: "Satellite",
    hint: "The game's own terrain imagery, with the same labels and POIs on top",
  },
];

/** Base-map and label layers. Satellite uses only the game's supplied terrain imagery. */
export function ViewSection() {
  const view = useView();
  return (
    <section className="view-section">
      <p className="panel-eyebrow">VIEW</p>
      <div className="filter-list">
        {ITEMS.map(({ key, label, hint }) => (
          <label key={key} className={`filter-item view-item${view[key] ? " is-on" : ""}`} title={hint}>
            <span className="filter-label">{label}</span>
            <input
              type="checkbox"
              checked={view[key]}
              onChange={() => view.toggle(key)}
              aria-label={label}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
