import { categoryColors } from "../engine/colors";
import type { Category } from "../engine/types";
import { CATEGORY_LABELS, LOOT_CATEGORIES, useFilters } from "../store";

/** The Likely-loot filter list (Map-visibility section + sub-toggles come next). */
export function FilterPanel({ counts }: { counts: Record<Category, number> }) {
  const enabled = useFilters((state) => state.enabled);
  const toggle = useFilters((state) => state.toggle);
  const setAll = useFilters((state) => state.setAll);

  return (
    <aside className="filter-panel" aria-label="Map filters">
      <header className="panel-heading">
        <p className="panel-eyebrow">LIKELY LOOT</p>
        <h1>What are you looking for?</h1>
        <div className="panel-actions">
          <button type="button" onClick={() => setAll(true)}>
            All
          </button>
          <button type="button" onClick={() => setAll(false)}>
            None
          </button>
        </div>
      </header>

      <div className="filter-list">
        {LOOT_CATEGORIES.map((category) => (
          <label key={category} className={`filter-item${enabled[category] ? " is-on" : ""}`}>
            <span className="filter-swatch" style={{ background: categoryColors[category] }} />
            <span className="filter-label">{CATEGORY_LABELS[category]}</span>
            <span className="filter-count">{(counts[category] ?? 0).toLocaleString()}</span>
            <input
              type="checkbox"
              checked={enabled[category]}
              onChange={() => toggle(category)}
              aria-label={CATEGORY_LABELS[category]}
            />
          </label>
        ))}
      </div>

      <p className="filter-note">
        Likely-loot hints from the game's own room + distribution data — not a guarantee of contents.
      </p>
    </aside>
  );
}
