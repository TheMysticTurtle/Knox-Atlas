// Remembered settings: the View toggles and the Likely-loot filter choices, so the map opens the
// way the user left it. Newer keys (not in the released 0.1.x app).
//
// Self-contained on purpose (no runtime imports): the parse functions run under the Node test runner.

export const SETTINGS_KEYS = {
  view: "knox-atlas.view-options.v1",
  filters: "knox-atlas.loot-filters.v1",
} as const;

/** Read saved View toggles over `defaults`; unknown or invalid entries keep their default. */
export function parseViewOptions<T extends Record<string, boolean>>(raw: string | null, defaults: T): T {
  const saved = parseObject(raw);
  const result = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const value = saved?.[key as string];
    if (typeof value === "boolean") result[key] = value as T[keyof T];
  }
  return result;
}

/**
 * Saved filter choices: the sub-group ids the user turned on and off. Ids in neither list (e.g. a
 * filter added by a later update) fall back to `defaultOn`; ids no longer known are dropped.
 */
export function parseFilterChoices(
  raw: string | null,
  knownIds: string[],
  defaultOn: (id: string) => boolean,
): Set<string> {
  const saved = parseObject(raw);
  const on = new Set(stringArray(saved?.on));
  const off = new Set(stringArray(saved?.off));
  return new Set(knownIds.filter((id) => (on.has(id) ? true : off.has(id) ? false : defaultOn(id))));
}

/** The record saved for filter choices: every known id, as on or off. */
export function filterChoicesRecord(enabled: Set<string>, knownIds: string[]): { on: string[]; off: string[] } {
  return {
    on: knownIds.filter((id) => enabled.has(id)),
    off: knownIds.filter((id) => !enabled.has(id)),
  };
}

export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSetting(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the setting just isn't remembered this time.
  }
}

function parseObject(raw: string | null): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
