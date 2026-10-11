# Room categories and filter semantics

Updated 2026-10-10. This records what the current code does, not a finalized classification of
every room in the game. Implementations: `crates/core/src/category.rs`,
`crates/core/src/poi.rs`, and `web/src/engine/subcategories.ts`.

## Current categories

Classification uses lowercase room-name matching, mostly substrings. A room may carry multiple
tags; there is no Retail/Civic enum and no separate Auto category. Unknown names can have no tags.

| Serialized tag | Representative recognized room names | Notes |
| --- | --- | --- |
| `food` | `grocery`, `gigamart`, `restaurant`, `bakery`, `kitchen` | Exact residential kitchen/diningroom also carry Homes. |
| `alcohol` | `bar`, `liquorstore`, `brewery`, `viplounge` | Explicit exclusions avoid barn/barber false positives. |
| `weapons` | `gunstore`, `policegunstorage`, `hunting`, `armysurplus` | A generic police room is not automatically Weapons. |
| `medical` | `pharmacy`, `hospitalroom`, `medclinic`, `dentist`, exact `vet` | Generic lab/veterinary storage support must be checked, not assumed. |
| `tools` | `toolstore`, `workshop`, `warehouse`, `mechanic`, `garage`, `shed` | Auto is a sub-bucket here; garages/sheds have their own bucket. |
| `knowledge` | `bookstore`, `bookstorage`, `library`, `classroom`, `movierental` | Room-type recognition and UI sub-bucket matching are separate. |
| `fishing` | `fishingstorage`, `bait`, `camping`, `gardenstore`, `boathouse` | Outdoor supply hints, not live resource contents. |
| `electronics` | `electronicsstore`, `camerastore`, `radioshipping`, `serverroom` | Some recognized names fall into UI Other. |
| `clothing` | `clothesstore`, `shoestorage`, `departmentstore`, `sewing` | Accessories/gift rules are heuristics, not a retail directory. |
| `fuel` | `gasstore`, `gasstorage`, `gas2go`, `fossoil` | Expected gas-station-related loot, not pump fuel state. |
| `homes` | `bedroom`, `bathroom`, exact `kitchen`, `diningroom`, `garage` | Homes-only rooms are excluded from the current dot payload. |

`garage`/`garagestorage` are **Tools + Homes**; `shed` is Tools. Keeping a garage out of the
Auto sub-bucket does not mean omitting it from Tools. Turning on Homes currently reveals only
already-delivered multi-tag POIs, not every house/bedroom on the map.

## Current filter behavior

- Filter IDs are `category:sub`; a room gets one sub-bucket per category.
- Within a category, **first matching sub-bucket wins**; otherwise it goes to Other.
- Dots with no enabled matching sub-bucket are **hidden**, not faded.
- Dot color comes from the first enabled matching category.
- Home kitchens and Homes start disabled.
- Counts are matching rooms; multi-tag room counts overlap. They are not counts of distinct shops.
- Floor is currently not part of filtering/counts/clicks. V1 must make all three agree on selected Z.

The earlier highlight/enlarge-matches and dim-background design is still desired but not
implemented. Make that change explicitly; do not describe the existing hiding behavior as
highlighting. View toggles (buildings, town/area labels, streets, landmark/business labels) are
separate from room filters. Satellite is currently disabled.

## Known matching gaps to test

| Input | Current result | Needed review |
| --- | --- | --- |
| `policegunstorage` | Weapons → Gun stores | Gun-storage matcher precedes Police; 15 POIs in the local generated sample are affected. Prefer the more specific institution when defining quick finds. |
| `gunstorestorage` | Weapons → Gun stores | Positive control for storage variants. |
| `bookstorage` | Knowledge → Other | Classifier recognizes it, bookstore sub-bucket does not. |
| `garagestorage` | Tools → Garages & sheds; Homes → Residential | Keep deliberate multi-tag behavior. |
| Unknown/modded name | No category unless a substring matches | Do not claim automatic mod taxonomy support. |

Add synthetic table tests for names, exclusions, tag overlap, and sub-bucket ordering. The
historically enumerated 586-name corpus informs the design but is not evidence that every mapping
or suffixed variant is correct.

## Place names and layers

Current “Business names” visibility controls annotation landmarks, not unique names for each
RoomDef. A card labeled “Gun store” is a room type. Future quick finds such as Police, Schools,
Hotels, or Warehouses should be place-type filters separate from loot inference; not all have
loot tags today.

Zombie-theme zones belong in a separate opt-in layer, not the business list. Vehicle pools
describe possible spawns, not cars present in a save. Building colors describe broad vector-map
classes; keep an understandable legend without pretending they are interior room functions.

## Expected loot — wording and future index

Use **Likely loot** or **Possible items**, not “contains” or percentage probabilities.
Current extraction keeps maximum raw weight per duplicate item, caps at 60 items/room type, and
shows 24 in the card. A weight ordered across mixed containers is not a room-wide chance.

Retain the complete item set with container/source context before item search or item-based
filters. Display truncation is fine; silently dropping source items from the search index is not.
Do not infer perishable status, car condition, keys, survivor homes, or water availability from a
room name alone. Those require additional validated sources.
