import { create } from "zustand";

import { allSubIds, subBucketsFor } from "./engine/subcategories";
import type { Category } from "./engine/types";

/** Likely-loot categories, in display order. Homes last (the noisy residential layer). */
export const LOOT_CATEGORIES: Category[] = [
  "weapons",
  "medical",
  "food",
  "alcohol",
  "tools",
  "knowledge",
  "fishing",
  "electronics",
  "clothing",
  "fuel",
  "homes",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  weapons: "Weapons & ammo",
  medical: "Medical",
  food: "Food",
  alcohol: "Alcohol",
  tools: "Tools & materials",
  knowledge: "Skills & knowledge",
  fishing: "Fishing & outdoors",
  electronics: "Electronics",
  clothing: "Clothing",
  fuel: "Fuel & gas",
  homes: "Homes",
};

// Sub-buckets that would flood the map, off by default.
const OFF_BY_DEFAULT = new Set(["food:homeKitchens", "homes:homes", "homes:other"]);

function defaultEnabled(): Set<string> {
  return new Set(allSubIds().filter((id) => !OFF_BY_DEFAULT.has(id)));
}

type FilterState = {
  /** Enabled `<category>:<sub>` ids. */
  enabled: Set<string>;
  toggleSub: (id: string) => void;
  toggleCategory: (category: Category) => void;
  setAll: (value: boolean) => void;
};

export const useFilters = create<FilterState>((set) => ({
  enabled: defaultEnabled(),
  toggleSub: (id) =>
    set((state) => {
      const next = new Set(state.enabled);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { enabled: next };
    }),
  toggleCategory: (category) =>
    set((state) => {
      const subs = subBucketsFor(category).map((sub) => sub.id);
      const allOn = subs.every((id) => state.enabled.has(id));
      const next = new Set(state.enabled);
      for (const id of subs) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return { enabled: next };
    }),
  setAll: (value) => set(() => ({ enabled: value ? new Set(allSubIds()) : new Set() })),
}));
