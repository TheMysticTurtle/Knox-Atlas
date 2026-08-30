import type { ViewOptions } from "../engine/mapEngine";
import { useView } from "../viewStore";

const ITEMS: { key: keyof ViewOptions; label: string }[] = [
  { key: "buildings", label: "Buildings" },
  { key: "towns", label: "Town & area names" },
  { key: "streets", label: "Street names" },
  { key: "businesses", label: "Business names" },
];

/** The View section: base-map + label layers (satellite arrives with the detailed-map decoder). */
export function ViewSection() {
  const view = useView();
  return (
    <section className="view-section">
      <p className="panel-eyebrow">VIEW</p>
      <div className="filter-list">
        {ITEMS.map(({ key, label }) => (
          <label key={key} className={`filter-item view-item${view[key] ? " is-on" : ""}`}>
            <span className="filter-label">{label}</span>
            <input
              type="checkbox"
              checked={view[key]}
              onChange={() => view.toggle(key)}
              aria-label={label}
            />
          </label>
        ))}
        <label
          className="filter-item view-item is-disabled"
          title="Arrives with the detailed-map (.lotpack) decoder"
        >
          <span className="filter-label">Satellite</span>
          <input type="checkbox" disabled />
        </label>
      </div>
    </section>
  );
}
