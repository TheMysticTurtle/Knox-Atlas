import { useEffect, useMemo, useRef, useState } from "react";

import { categoryColors, mapColors } from "../engine/colors";
import {
  hitCategory,
  searchIndex,
  type SearchHit,
  type SearchIndex,
  type SearchKind,
} from "../engine/search";
import { useMapUi } from "../mapUiStore";
import { LIMITS } from "../savedStorage";
import { useSaved } from "../savedStore";
import { Eye } from "./Eye";

const KIND_LABELS: Record<SearchKind, string> = {
  town: "Towns & areas",
  street: "Streets",
  store: "Places",
  category: "Loot categories",
  group: "Loot groups",
  item: "Loot",
};

/** Places a search highlights, per tier (null: the search no longer exists on this map). */
type TierCount = { likely: number; possible: number } | null;

type SearchBarProps = {
  index: SearchIndex | null;
  /** Fly to a town or street (they don't highlight anything). */
  onFly: (hit: SearchHit) => void;
  /** Places the current search highlights. */
  currentCount: TierCount;
  /** Places each saved filter highlights, by filter id. */
  filterCounts: Record<string, TierCount>;
};

/** Towns and streets fly the map; everything else highlights places. */
const flies = (hit: SearchHit) => hit.kind === "town" || hit.kind === "street";

const plural = (count: number) => `${count.toLocaleString()} ${count === 1 ? "place" : "places"}`;

/**
 * How many places a search shows: "12 places"; for loot "likely in 30 places", and with "All" on
 * "30 likely + 85 possible" (or "30 likely · possible anywhere" for generic-container loot). Loot
 * that spawns nowhere else reads "only in 118 places".
 */
function countText(hit: SearchHit | undefined, counts: TierCount, all: boolean): string {
  if (!hit || !counts) return "not on this map";
  if (hit.kind !== "item") return counts.likely > 0 ? plural(counts.likely) : "no places on the map";
  if (hit.possibleCount === 0) return `only in ${plural(counts.likely)}`;
  if (!all) return counts.likely > 0 ? `likely in ${plural(counts.likely)}` : "no likely places";
  const possible = hit.anywhere ? "possible anywhere" : `${counts.possible.toLocaleString()} possible`;
  return `${counts.likely.toLocaleString()} likely ${hit.anywhere ? "·" : "+"} ${possible}`;
}

/**
 * "All" for a loot search: include its "possible" places (plain dots) as well as "likely" ones.
 * Only offered when there are more places to show.
 */
function AllToggle({ hit, all, onToggle }: { hit: SearchHit; all: boolean; onToggle: () => void }) {
  if (hit.kind !== "item" || hit.possibleCount === 0) return null;
  return (
    <label className="search-all" title="Also show places where it can turn up, but rarely (plain dots)">
      <input type="checkbox" checked={all} onChange={onToggle} />
      All
    </label>
  );
}

/**
 * 🔍 Search — a toolbar button (highlighted while open) that opens a search box to its right. The
 * box stays open (🔍 or Esc closes it) and shows the current search: results appear as you type;
 * picking one highlights its places and shows its count, with "All" for loot (include "possible"
 * places). **+ Save** moves it into the saved filters, clearing it from the box so its eye takes
 * over; **Saved ▾** lists them with show/hide eyes and All on / All off. The map highlights the
 * current search plus every shown saved filter. Towns and streets just fly the map there.
 */
export function SearchBar({ index, onFly, currentCount, filterCounts }: SearchBarProps) {
  const current = useMapUi((state) => state.currentSearch);
  const setCurrent = useMapUi((state) => state.setCurrentSearch);
  const toggleCurrentAll = useMapUi((state) => state.toggleCurrentAll);
  const filters = useSaved((state) => state.filters);
  const addFilter = useSaved((state) => state.addFilter);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [typing, setTyping] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => (index && typing ? searchIndex(index, query) : []), [index, query, typing]);
  const flat = groups.flatMap((group) => group.hits);
  const currentSaved = current ? filters.some((filter) => filter.key === current.hit.key) : false;

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  // The box shows the current search's name (e.g. after picking a result or clearing it).
  useEffect(() => {
    setQuery(current?.hit.label ?? "");
    setTyping(false);
  }, [current]);

  function choose(chosen: SearchHit) {
    if (flies(chosen)) {
      onFly(chosen);
      setQuery(current?.hit.label ?? "");
      setTyping(false);
    } else {
      setCurrent(chosen);
    }
  }

  /** Save the current search as a filter, then clear it: the saved filter (and its eye) takes over. */
  function saveCurrent() {
    if (!current) return;
    addFilter(current.hit.key, current.hit.label, current.all);
    setCurrent(null);
    inputRef.current?.focus();
  }

  function clear() {
    setCurrent(null);
    setQuery("");
    setTyping(false);
    inputRef.current?.focus();
  }

  return (
    <div className="search-anchor">
      <button
        className={`map-tool tool-button${open ? " is-active" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title={open ? "Close search" : "Search towns, streets, places and loot"}
      >
        <span className="tool-icon" aria-hidden="true">
          🔍
        </span>
        <span className="tool-label">Search</span>
      </button>

      {open && (
        <div className="search-panel" role="search">
          <div className="search-row">
            <div className="search-input">
              <input
                ref={inputRef}
                value={query}
                placeholder="Towns, streets, places, loot…"
                aria-label="Search the map"
                aria-autocomplete="list"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setTyping(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    if (typing && query) setTyping(false);
                    else setOpen(false);
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActive((at) => Math.min(at + 1, flat.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActive((at) => Math.max(at - 1, 0));
                  } else if (event.key === "Enter" && flat[active]) {
                    choose(flat[active]);
                  }
                }}
                // Results close when focus leaves (after a click on one has landed).
                onBlur={() => window.setTimeout(() => setTyping(false), 150)}
              />
              {(query || current) && (
                <button className="search-clear" onClick={clear} aria-label="Clear search" title="Clear">
                  ×
                </button>
              )}
            </div>
            <button
              className="search-save"
              onClick={saveCurrent}
              disabled={!current || currentSaved || filters.length >= LIMITS.filters}
              title={
                currentSaved
                  ? "Already saved"
                  : filters.length >= LIMITS.filters
                    ? `Up to ${LIMITS.filters} saved filters`
                    : "Save this search as a filter"
              }
            >
              {currentSaved ? "✓ Saved" : "+ Save"}
            </button>
            <button
              className={`search-saved-toggle${savedOpen ? " is-open" : ""}`}
              onClick={() => setSavedOpen(!savedOpen)}
              aria-expanded={savedOpen}
              title="Saved filters"
            >
              Saved <small>{filters.length}</small> ▾
            </button>
          </div>

          {current && !typing && (
            <div className="search-current">
              <span>
                <strong>{current.hit.label}</strong> · {countText(current.hit, currentCount, current.all)}
              </span>
              <AllToggle hit={current.hit} all={current.all} onToggle={toggleCurrentAll} />
            </div>
          )}

          {typing && query.trim().length >= 2 && (
            <SearchResults
              groups={groups}
              flat={flat}
              active={active}
              onHover={setActive}
              onChoose={choose}
            />
          )}

          {savedOpen && <SavedFilters index={index} counts={filterCounts} />}
        </div>
      )}
    </div>
  );
}

type ResultsProps = {
  groups: { kind: SearchKind; hits: SearchHit[] }[];
  flat: SearchHit[];
  active: number;
  onHover: (position: number) => void;
  onChoose: (hit: SearchHit) => void;
};

/** Results as you type, grouped by kind; arrow keys / hover move the highlight, Enter / click pick. */
function SearchResults({ groups, flat, active, onHover, onChoose }: ResultsProps) {
  return (
    <div className="search-results" role="listbox">
      {groups.length === 0 ? (
        <p className="search-empty">No matches.</p>
      ) : (
        groups.map((group) => (
          <div key={group.kind}>
            <p className="search-group">{KIND_LABELS[group.kind]}</p>
            {group.hits.map((result) => {
              const position = flat.indexOf(result);
              return (
                <button
                  key={result.key}
                  role="option"
                  aria-selected={position === active}
                  className={`search-result${position === active ? " is-active" : ""}`}
                  onMouseEnter={() => onHover(position)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onChoose(result)}
                >
                  <span>{result.label}</span>
                  <small>{result.detail}</small>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

/** The saved filters dropdown: All on / All off, then each filter with its eye, count, All and ×. */
function SavedFilters({
  index,
  counts,
}: {
  index: SearchIndex | null;
  counts: Record<string, TierCount>;
}) {
  const filters = useSaved((state) => state.filters);
  const removeFilter = useSaved((state) => state.removeFilter);
  const setFilterHidden = useSaved((state) => state.setFilterHidden);
  const toggleFilterAll = useSaved((state) => state.toggleFilterAll);
  const hitsByKey = useMemo(() => new Map((index?.entries ?? []).map((hit) => [hit.key, hit])), [index]);

  return (
    <div className="search-saved" aria-label="Saved filters">
      {filters.length === 0 ? (
        <p className="search-empty">No saved filters yet — search for something, then + Save.</p>
      ) : (
        <>
          <div className="search-saved-actions">
            <button onClick={() => setFilterHidden(false)}>All on</button>
            <button onClick={() => setFilterHidden(true)}>All off</button>
          </div>
          <ul>
            {filters.map((filter) => {
              const hit = hitsByKey.get(filter.key);
              const category = hit ? hitCategory(hit) : null;
              const all = Boolean(filter.all);
              return (
                <li key={filter.id} className={`search-saved-row${filter.hidden ? " is-hidden" : ""}`}>
                  <Eye
                    state={filter.hidden ? "hidden" : "shown"}
                    label={filter.label}
                    onToggle={() => setFilterHidden(!filter.hidden, filter.id)}
                  />
                  <i
                    className="search-dot"
                    style={{ background: category ? categoryColors[category] : mapColors.mutedInk }}
                  />
                  <span className="search-saved-label" title={filter.label}>
                    {filter.label}
                  </span>
                  <small className="search-saved-count">
                    {countText(hit, counts[filter.id] ?? null, all)}
                  </small>
                  {hit && <AllToggle hit={hit} all={all} onToggle={() => toggleFilterAll(filter.id)} />}
                  <button
                    className="search-saved-remove"
                    onClick={() => removeFilter(filter.id)}
                    aria-label={`Delete ${filter.label}`}
                    title="Delete filter"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
