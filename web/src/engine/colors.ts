// Map palette, mirrored from the game's own map colours (ISMapDefinitions) via the prototype. The
// canvas cannot read CSS variables reliably, so colours live here in TypeScript.

export const mapColors = {
  paper: "#dbd7c0",
  paperGrid: "rgba(75, 72, 64, 0.12)",
  water: "#3b8d95",
  trail: "#b97a57",
  tertiary: "#ab9e8f",
  majorRoad: "#867d71",
  railway: "#c8bfe7",
  terrain: "#c8cfaa",
  outline: "#6e695e",
  residential: "#d29e69",
  community: "#8b75eb",
  hospitality: "#7fcee1",
  industrial: "#383635",
  medical: "#e58097",
  entertainment: "#f5e13c",
  retail: "#b8cd54",
  defaultBuilding: "#baad93",
  ink: "#2d302b",
  mutedInk: "#67685f",
  selected: "#e19952",
} as const;

import type { Category } from "./types";

/** POI dot colours per loot/place category. */
export const categoryColors: Record<Category, string> = {
  food: "#bf8b3d",
  alcohol: "#8a5cc0",
  weapons: "#c0453b",
  medical: "#c75f70",
  tools: "#6b7580",
  knowledge: "#3f7cad",
  fishing: "#2f9e8f",
  electronics: "#c8a13a",
  clothing: "#b06fb0",
  fuel: "#b2663e",
  homes: "#9a8b6f",
};

/** Colour for a building feature, from its game display category. */
export function buildingColor(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("residential")) return mapColors.residential;
  if (normalized.includes("community")) return mapColors.community;
  if (normalized.includes("hospitality")) return mapColors.hospitality;
  if (normalized.includes("industrial")) return mapColors.industrial;
  if (normalized.includes("medical")) return mapColors.medical;
  if (normalized.includes("restaurant") || normalized.includes("entertainment"))
    return mapColors.entertainment;
  if (normalized.includes("retail") || normalized.includes("commercial")) return mapColors.retail;
  return mapColors.defaultBuilding;
}
