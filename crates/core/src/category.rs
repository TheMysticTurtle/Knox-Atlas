//! Maps raw RoomDef names (from `.lotheader`) into user-facing, multi-tag categories.
//!
//! Multi-tag by design (ADR: filters highlight, they don't partition): a gun store is `Weapons`;
//! a house kitchen is both `Food` and `Homes`. Grounded in the real 586-name room vocabulary
//! enumerated during the RoomDef spike (see `docs/lotheader-format.md` / `docs/taxonomy.md`).
//! Unrecognized names (mods, new content) return no categories rather than a wrong guess.

use serde::Serialize;

/// A user-facing loot/place category. A room may carry several.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Category {
    Food,
    Alcohol,
    Weapons,
    Medical,
    Tools,
    Knowledge,
    Fishing,
    Electronics,
    Clothing,
    Fuel,
    Homes,
}

fn contains_any(name: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| name.contains(needle))
}

fn add(categories: &mut Vec<Category>, category: Category) {
    if !categories.contains(&category) {
        categories.push(category);
    }
}

/// Alcohol venues, excluding false-positives that merely start with `bar` (`barn`, `barber`, …).
fn is_alcohol(name: &str) -> bool {
    if contains_any(
        name,
        &[
            "liquor",
            "brewery",
            "distiller",
            "whiske",
            "whisky",
            "winery",
            "viplounge",
            "stripclub",
        ],
    ) {
        return true;
    }
    // `bar`, `barstorage`, `barkitchen`, `ww_bar` — but not `barn`/`barber`/`barbeque`/`barrack`.
    (name == "bar" || name.starts_with("bar") || name.contains("_bar"))
        && !contains_any(name, &["barn", "barber", "barbeq", "barbec", "barrack"])
}

/// Classify one raw RoomDef name into zero or more categories.
pub fn categorize_room(raw_name: &str) -> Vec<Category> {
    let name = raw_name.trim().to_ascii_lowercase();
    let mut categories = Vec::new();

    if contains_any(
        &name,
        &[
            "gun",
            "hunting",
            "armory",
            "armysurplus",
            "armystorage",
            "armytent",
            "oldarmy",
            "knifestore",
            "knifeshipping",
            "pawnshop",
        ],
    ) {
        add(&mut categories, Category::Weapons);
    }

    if is_alcohol(&name) {
        add(&mut categories, Category::Alcohol);
    }

    if contains_any(
        &name,
        &[
            "grocery",
            "gigamart",
            "conveniencestore",
            "cornerstore",
            "generalstore",
            "produce",
            "restaurant",
            "diner",
            "cafe",
            "cafeteria",
            "bakery",
            "butcher",
            "spiffo",
            "burger",
            "pizza",
            "candystore",
            "icecream",
            "donut",
            "seafood",
            "sushi",
            "chinese",
            "mexican",
            "italian",
            "chili",
            "taco",
            "hotdog",
            "kitchen",
            "dining",
            "foodcourt",
            "jayschicken",
            "crepe",
        ],
    ) {
        add(&mut categories, Category::Food);
    }

    if contains_any(
        &name,
        &[
            "pharmacy",
            "medical",
            "medclinic",
            "clinic",
            "hospital",
            "dentist",
            "optometrist",
            "morgue",
        ],
    ) || name == "vet"
    {
        add(&mut categories, Category::Medical);
    }

    if contains_any(
        &name,
        &[
            "toolstore",
            "toolstorage",
            "workshop",
            "metalshop",
            "welding",
            "carpentry",
            "factory",
            "warehouse",
            "mechanic",
            "carsupply",
            "masonry",
            "paintershop",
            "construction",
            "logging",
            "industry",
            "hardware",
        ],
    ) {
        add(&mut categories, Category::Tools);
    }

    if contains_any(
        &name,
        &[
            "bookstore",
            "bookstorage",
            "library",
            "classroom",
            "school",
            "movierental",
            "musicstore",
            "comicstore",
            "cdstore",
            "daycare",
            "university",
            "gallery",
        ],
    ) {
        add(&mut categories, Category::Knowledge);
    }

    if contains_any(
        &name,
        &[
            "fishing",
            "bait",
            "camping",
            "gardenstore",
            "gardening",
            "greenhouse",
            "boathouse",
        ],
    ) {
        add(&mut categories, Category::Fishing);
    }

    if contains_any(
        &name,
        &["electronic", "camerastore", "radioshipping", "serverroom"],
    ) {
        add(&mut categories, Category::Electronics);
    }

    if contains_any(
        &name,
        &[
            "clothes",
            "clothing",
            "shoestore",
            "shoestorage",
            "department",
            "jewelry",
            "giftstore",
            "toystore",
            "sewing",
            "tobacco",
            "walletshop",
            "glassesstore",
            "leatherclothes",
        ],
    ) {
        add(&mut categories, Category::Clothing);
    }

    if contains_any(&name, &["gasstore", "gas2go", "fossoil", "gasstorage"]) {
        add(&mut categories, Category::Fuel);
    }

    // Residential rooms — the "Homes" layer, and a food source (kitchens) per the taxonomy.
    if contains_any(
        &name,
        &["bedroom", "bathroom", "livingroom", "closet", "laundry"],
    ) || matches!(
        name.as_str(),
        "kitchen"
            | "hall"
            | "hallway"
            | "diningroom"
            | "garage"
            | "garagestorage"
            | "foyer"
            | "attic"
    ) {
        add(&mut categories, Category::Homes);
    }

    categories
}
