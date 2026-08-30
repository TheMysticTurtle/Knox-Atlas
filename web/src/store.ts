import { create } from "zustand";

import type { Category } from "./engine/types";

/** Likely-loot categories, in display order. Homes last (it's the noisy residential layer). */
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

/** Human labels for each category (the filter rows). */
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

type FilterState = {
  /** Which categories are shown on the map. */
  enabled: Record<Category, boolean>;
  toggle: (category: Category) => void;
  setAll: (value: boolean) => void;
};

function everyCategory(value: boolean): Record<Category, boolean> {
  return Object.fromEntries(LOOT_CATEGORIES.map((c) => [c, value])) as Record<Category, boolean>;
}

// Homes starts off — it's every house kitchen/bedroom and would flood the map.
const initialEnabled: Record<Category, boolean> = { ...everyCategory(true), homes: false };

export const useFilters = create<FilterState>((set) => ({
  enabled: initialEnabled,
  toggle: (category) =>
    set((state) => ({ enabled: { ...state.enabled, [category]: !state.enabled[category] } })),
  setAll: (value) => set(() => ({ enabled: everyCategory(value) })),
}));
