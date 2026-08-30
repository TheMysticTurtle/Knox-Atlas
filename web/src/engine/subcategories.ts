// Sub-buckets within each loot category (the expandable sub-toggles). Grouped by room-def name so a
// category like Food splits into Groceries / Restaurants / Home kitchens — the real de-flood.
// Filter ids are `"<category>:<sub>"`. Unmatched rooms fall into an `other` bucket (shown only when
// it has POIs).

import type { Category, MapPoi } from "./types";

type Sub = { id: string; label: string; match: (name: string) => boolean };

const has =
  (...needles: string[]) =>
  (name: string): boolean =>
    needles.some((needle) => name.includes(needle));

const SUBS: Record<Category, Sub[]> = {
  weapons: [
    { id: "gunstores", label: "Gun stores", match: has("gunstore", "gunstorage") },
    { id: "hunting", label: "Hunting", match: has("hunting") },
    { id: "military", label: "Military & surplus", match: has("army", "oldarmy") },
    { id: "police", label: "Police", match: has("police") },
    { id: "pawn", label: "Pawn & knife", match: has("pawnshop", "knife") },
  ],
  medical: [
    { id: "pharmacy", label: "Pharmacies", match: has("pharmacy") },
    { id: "hospital", label: "Hospitals", match: has("hospital") },
    { id: "clinic", label: "Clinics & offices", match: has("clinic", "medclinic", "medical") },
    { id: "dental", label: "Dental & optical", match: has("dentist", "optometrist") },
    { id: "vet", label: "Veterinary", match: has("vet") },
    { id: "morgue", label: "Morgue", match: has("morgue") },
  ],
  food: [
    {
      id: "groceries",
      label: "Groceries & markets",
      match: has("grocery", "gigamart", "conveniencestore", "cornerstore", "generalstore", "produce"),
    },
    {
      id: "restaurants",
      label: "Restaurants & dining",
      match: has(
        "restaurant", "diner", "cafe", "spiffo", "burger", "pizza", "chinese", "mexican",
        "italian", "sushi", "seafood", "icecream", "donut", "chili", "taco", "hotdog",
        "jayschicken", "crepe", "foodcourt", "candystore",
      ),
    },
    { id: "bakery", label: "Bakeries", match: has("bakery") },
    { id: "butcher", label: "Butchers", match: has("butcher") },
    { id: "homeKitchens", label: "Home kitchens", match: has("kitchen", "dining") },
  ],
  alcohol: [
    { id: "bars", label: "Bars", match: has("bar") },
    { id: "liquor", label: "Liquor stores", match: has("liquor") },
    { id: "brewery", label: "Breweries", match: has("brewery", "distiller", "whisk", "winery") },
  ],
  tools: [
    { id: "hardware", label: "Hardware & tools", match: has("toolstore", "hardware") },
    {
      id: "workshops",
      label: "Workshops",
      match: has("workshop", "metalshop", "welding", "carpentry", "masonry", "paintershop"),
    },
    {
      id: "industry",
      label: "Factories & warehouses",
      match: has("factory", "warehouse", "industry", "logging"),
    },
    { id: "auto", label: "Auto & mechanic", match: has("mechanic", "carsupply") },
    { id: "garages", label: "Garages & sheds", match: has("garage", "shed") },
    { id: "construction", label: "Construction", match: has("construction") },
  ],
  knowledge: [
    { id: "bookstores", label: "Bookstores", match: has("bookstore") },
    { id: "libraries", label: "Libraries", match: has("library") },
    { id: "media", label: "Video & music", match: has("movierental", "musicstore", "comicstore", "cdstore") },
    { id: "schools", label: "Schools", match: has("classroom", "school", "university", "daycare") },
    { id: "galleries", label: "Galleries", match: has("gallery") },
  ],
  fishing: [
    { id: "bait", label: "Bait & fishing", match: has("fishing", "bait") },
    { id: "camping", label: "Camping", match: has("camping") },
    { id: "garden", label: "Garden & greenhouse", match: has("garden", "greenhouse") },
    { id: "boating", label: "Boating", match: has("boathouse") },
  ],
  electronics: [
    { id: "electronics", label: "Electronics", match: has("electronic") },
    { id: "cameras", label: "Cameras", match: has("camerastore") },
  ],
  clothing: [
    { id: "clothing", label: "Clothing", match: has("clothes", "clothing", "leatherclothes") },
    { id: "shoes", label: "Shoes", match: has("shoestore") },
    { id: "accessories", label: "Accessories", match: has("jewelry", "glassesstore", "walletshop") },
    { id: "department", label: "Department & gifts", match: has("department", "giftstore", "toystore") },
  ],
  fuel: [{ id: "gas", label: "Gas stations", match: has("gasstore", "gas2go", "fossoil") }],
  homes: [{ id: "homes", label: "Residential", match: () => true }],
};

/** Sub-buckets for a category (as `<category>:<sub>` ids), plus a catch-all `other`. */
export function subBucketsFor(category: Category): { id: string; label: string }[] {
  const subs = SUBS[category].map((sub) => ({ id: `${category}:${sub.id}`, label: sub.label }));
  subs.push({ id: `${category}:other`, label: "Other" });
  return subs;
}

/** Every `<category>:<sub>` id a POI belongs to (multi-tag rooms produce one per category). */
export function poiSubIds(poi: MapPoi): string[] {
  const name = poi.rawName.toLowerCase();
  return poi.categories.map((category) => {
    const matched = SUBS[category].find((sub) => sub.match(name));
    return `${category}:${matched ? matched.id : "other"}`;
  });
}

/** All sub ids across every category (for default filter state). */
export function allSubIds(): string[] {
  return (Object.keys(SUBS) as Category[]).flatMap((category) =>
    subBucketsFor(category).map((sub) => sub.id),
  );
}
