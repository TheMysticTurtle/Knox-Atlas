import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SETTINGS_KEYS,
  filterChoicesRecord,
  parseFilterChoices,
  parseViewOptions,
} from "../src/settingsStorage.ts";

const VIEW_DEFAULTS = { towns: true, streets: true, buildings: true, businesses: true, satellite: false };

test("settings use their own keys (not the released app's)", () => {
  assert.deepEqual(SETTINGS_KEYS, {
    view: "knox-atlas.view-options.v1",
    filters: "knox-atlas.loot-filters.v1",
  });
});

test("view toggles are restored over the defaults", () => {
  const saved = JSON.stringify({ satellite: true, streets: false });
  assert.deepEqual(parseViewOptions(saved, VIEW_DEFAULTS), { ...VIEW_DEFAULTS, satellite: true, streets: false });
});

test("missing, corrupt or odd view settings fall back to defaults", () => {
  assert.deepEqual(parseViewOptions(null, VIEW_DEFAULTS), VIEW_DEFAULTS);
  assert.deepEqual(parseViewOptions("{oops", VIEW_DEFAULTS), VIEW_DEFAULTS);
  assert.deepEqual(parseViewOptions("[true]", VIEW_DEFAULTS), VIEW_DEFAULTS);
  assert.deepEqual(
    parseViewOptions(JSON.stringify({ satellite: "yes", unknown: true }), VIEW_DEFAULTS),
    VIEW_DEFAULTS,
  );
});

test("filter choices round-trip; new filters get their default, removed ones are dropped", () => {
  const known = ["food:groceries", "food:homeKitchens", "weapons:gunstores"];
  const defaultOn = (id: string) => id !== "food:homeKitchens";
  // The user turned home kitchens ON and gun stores OFF.
  const record = filterChoicesRecord(new Set(["food:groceries", "food:homeKitchens"]), known);
  assert.deepEqual(record, { on: ["food:groceries", "food:homeKitchens"], off: ["weapons:gunstores"] });
  const raw = JSON.stringify({ ...record, off: [...record.off, "old:removed"] });

  // A later version adds two filters: one default-on, one default-off.
  const later = [...known, "tools:new", "homes:newNoisy"];
  const restored = parseFilterChoices(raw, later, (id) => defaultOn(id) && id !== "homes:newNoisy");
  assert.deepEqual([...restored].sort(), ["food:groceries", "food:homeKitchens", "tools:new"]);
});

test("no saved filter choices means the defaults", () => {
  const known = ["a:x", "b:y"];
  assert.deepEqual([...parseFilterChoices(null, known, (id) => id === "a:x")], ["a:x"]);
});
