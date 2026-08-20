# Category taxonomy (multi-tag)

Maps real RoomDef names (from `.lotheader`, see `lotheader-format.md`) into user-facing categories.
**Multi-tag:** a place may appear under several categories; filters highlight/enlarge matches and dim
the rest (never hide). Counts = "places matching this filter," not a partition. Rare room types roll
up into the nearest category; clicking a dot always shows its *specific* room type.

Finalized in P0 against the full 586-name vocabulary. `*storage`/`*storage`-suffixed variants inherit
their parent category. Naming shown to users is friendly ("Gun shop", "Bait & tackle").

## Likely-loot categories (detailed, highlighting)

| Category | Representative RoomDefs |
|---|---|
| **Food & water** | homes (kitchen/diningroom), `grocery`, `gigamart`, `conveniencestore`, `cornerstore`, `generalstore`, `butcher`/`knoxbutcher`, `bakery`, `restaurant`/`diner`/`cafe`/`spiffo*`/`burger*`/`pizza*`/`chinese*`/`mexican*`/`italian*`/`sushi*`/`icecream*`/`donut*`, `foodcourt`, `candystore` |
| **Alcohol** | `bar`, `barstorage`, `ww_bar`, `liquorstore`, `brewery`, `whiskeybottling`/`whiskystorage`, `distillerystorage`, `viplounge` |
| **Weapons & ammo** | `gunstore`, `gunstorestorage`, `gunstorage`, `policegunstorage`, `armysurplus`, `armystorage`/`armytent`/`oldarmy`, `hunting`, `pawnshop`, `knifestore`, `armory` |
| **Medical** | `pharmacy`, `hospitalroom`/`hospitalhallway`, `medclinic`/`clinic`, `medical`/`medicaloffice`, `dentist`, `optometrist`, `vet`, `oldmedical`, `morgue`, `laboratory`/`lab` |
| **Tools & materials** | `toolstore`, `workshop`/`metalshop`/`weldingworkshop`/`carpentryworkshop`, `factory`/`loggingfactory`/`warehouse`/`industry`, `mechanic`/`carsupply`/`racetrackmechanic`, `masonrystore`, `paintershop`, `construction` |
| **Skills & knowledge** | `bookstore`, `library`/`universitylibrary`/`policelibrary`, `movierental`, `musicstore`, `comicstore`, `cdstore`, `classroom`/`elementaryclassroom`/`secondaryclassroom`/`universityclassroom`, `school*`, `daycare`, `musicschool` |
| **Fishing & outdoors** | `fishing`, `fishingstorage`, `camping`/`campingstorage`, `gardenstore`/`gardeningstorage`, `greenhouse`, `boathouse` |
| **Electronics** | `electronicsstore`/`electronicstore`, `camerastore`, `radioshipping`, `serverroom` |
| **Clothing** | `clothesstore`/`clothingstore`/`leatherclothesstore`, `shoestore`, `departmentstore`, `jewelrystore`, `giftstore`, `toystore`, `sewingstore`, `walletshop`, `tobaccostore` |
| **Fuel & gas** | `gasstore`, `gasstorage`, `gas2go`, `fossoil` |

## Map-visibility layers (base/navigation, not highlighting the same way)

Custom markers · Buildings (broad worldmap classes: Residential/Retail/Industrial/Medical/Community/
Hospitality/…) · Town & area names · Street names · Vehicle pools (Cars/Vans/Trucks/Emergency) ·
**Satellite** toggle (P1) · **Player locations** (P3; greyed until pointed at a save).

**Homes** is a first-class place/food source: the large residential room set (`bedroom`, `bathroom`,
`livingroom`, `kitchen`, `closet`, `garage`/`garagestorage`, `hall`, …). Home garages stay under
Homes — *not* Auto.

## Separate opt-in layer

**Zombie theme zones** — the `objects.lua` `ZombiesType` zones (`Swimmer`, `Wedding`, `BaseballFan`,
`Offices`, `Rocker`, …). Real game data, but not businesses; off by default.
