import { useState } from "react";

import { categoryColors } from "../engine/colors";
import { subBucketsFor } from "../engine/subcategories";
import type { Category } from "../engine/types";
import { CATEGORY_LABELS, LOOT_CATEGORIES, useFilters } from "../store";
import { ViewSection } from "./ViewSection";
import { YourMapSection } from "./YourMapSection";

/** The Likely-loot filter list: categories that expand into room-type sub-toggles. */
export function FilterPanel({ subCounts }: { subCounts: Record<string, number> }) {
  const enabled = useFilters((state) => state.enabled);
  const toggleSub = useFilters((state) => state.toggleSub);
  const toggleCategory = useFilters((state) => state.toggleCategory);
  const setAll = useFilters((state) => state.setAll);
  const [expanded, setExpanded] = useState<Set<Category>>(new Set());

  const toggleExpand = (category: Category) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  return (
    <aside className="filter-panel" aria-label="Map filters">
      <ViewSection />
      <YourMapSection />

      <header className="panel-heading loot-heading">
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
        {LOOT_CATEGORIES.map((category) => {
          const subs = subBucketsFor(category).filter((sub) => (subCounts[sub.id] ?? 0) > 0);
          const total = subs.reduce((sum, sub) => sum + (subCounts[sub.id] ?? 0), 0);
          if (total === 0) return null;

          const onCount = subs.filter((sub) => enabled.has(sub.id)).length;
          const hasSubs = subs.length > 1;
          const isOpen = expanded.has(category);

          return (
            <div key={category} className={`filter-group${onCount > 0 ? " is-on" : ""}`}>
              <div className="filter-item">
                <span className="filter-swatch" style={{ background: categoryColors[category] }} />
                <span className="filter-label">{CATEGORY_LABELS[category]}</span>
                <span className="filter-count">{total.toLocaleString()}</span>
                <input
                  type="checkbox"
                  checked={onCount === subs.length}
                  ref={(element) => {
                    if (element) element.indeterminate = onCount > 0 && onCount < subs.length;
                  }}
                  onChange={() => toggleCategory(category)}
                  aria-label={CATEGORY_LABELS[category]}
                />
                {hasSubs && (
                  <button
                    type="button"
                    className={`filter-expand${isOpen ? " is-open" : ""}`}
                    onClick={() => toggleExpand(category)}
                    aria-label={`Expand ${CATEGORY_LABELS[category]}`}
                  >
                    ›
                  </button>
                )}
              </div>

              {hasSubs && isOpen && (
                <div className="subfilter-list">
                  {subs.map((sub) => (
                    <label
                      key={sub.id}
                      className={`subfilter-item${enabled.has(sub.id) ? " is-on" : ""}`}
                    >
                      <span className="subfilter-label">{sub.label}</span>
                      <span className="filter-count">{(subCounts[sub.id] ?? 0).toLocaleString()}</span>
                      <input
                        type="checkbox"
                        checked={enabled.has(sub.id)}
                        onChange={() => toggleSub(sub.id)}
                        aria-label={sub.label}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="filter-note">
        Likely-loot hints from the game's own room + distribution data — not a guarantee of contents.
      </p>
    </aside>
  );
}
