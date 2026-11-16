# Frontier — v0.11.0

The continent now has routes, rare encounters and places worth seeking out. Start opens in a separate cold chamber; the expedition menu retains its changing living dinosaur and uses clearer type, outlined controls and deep blood red. Save & Return to Title now has a complete border.

## Events and counterplay

- **Meteor:** a fixed impact circle gives 14 seconds to escape or fit beneath stone. The blast leaves nine minutes of scorched, molten ground. Its outer rim is safe from heat; three rare meteor-born predators appear nearby with basalt skin, glowing lava fissures and fire abilities. Fresh nearby regional meteor impacts use the same saved encounter ledger.
- **Lightning front:** eight seconds of warning, then location-locked strike circles give 2.35 seconds to dodge. Leaving water reduces damage. Small stone shelters and the central corridor of the colossal skeleton protect suitable-sized creatures. The storm darkens the world and brings rain and thunder; flash suppression remains supported.
- **Great migration:** up to 18 creatures travel together toward a shared destination, routing through passes. Ordinary packs can contain 6–14 members. Actor caps bound these additions.

Events use simulation time, stop when gameplay is paused, and serialize their countdowns, strike positions, craters and encounter history. The first 65 units around the nursery do not schedule these events. Impact centers and their creatures remain inside the continent.

## Geography and wildlife

Seven mountain belts interrupt direct outward travel, each with four wide passes connected by winding dirt trails. These rocks resist sprinting and demolition. The minimap reveals explored barriers, locations and craters. The camera and combat strokes follow ground elevation, and nearby roofs, canopies and foreground walls fade to keep the player readable.

| Place | Coordinates (east, south) | Features |
|---|---:|---|
| The Emerald Wilds | 300, -300 | Tall jade crowns, luminous ferns and a resident grazing herd |
| The Shardwood | -500, 420 | Blue and violet crystal trunks, frost hunters |
| The World-Eater's Hollow | 600, 600 | Ten giant rib arches, skull entrance, tail entrance and protected central corridor |
| Stormhorn Ascent | -690, -490 | Raised summit, western trail entrance, blocking crags and flying-reptile nesting grounds |
| Tideglass Lagoon | 190, 200 | Large bounded pool with varied marine wildlife |

Regional encounters retain their own level distribution. Sixteen percent of ordinary draws use lower tiers and six percent use up to three tiers above their region. Additional wanderers can challenge a low-level player or leave weaker wildlife near an evolved one; enemies do not uniformly scale to the player.

The roster grows from 102 to **108** with Ichthyosaurus, Archelon, Elasmosaurus, Dunkleosteus, Mosasaurus and Megalodon. Pools choose three different persistent swimmers from eight aquatic species. The new animals have different armor, speed, health, aggression and bite damage. Turtles stay passive until attacked. Bites have a locked windup and recovery. Wild-only aquatic species are identified in the encyclopedia and excluded from ordinary evolution choices.

These are original stylized assets, with distinct anatomy rather than models taken from other games. References consulted include the [Natural History Museum's ichthyosaur guide](https://www.nhm.ac.uk/discover/what-is-an-ichthyosaur.html), [plesiosaur guide](https://www.nhm.ac.uk/discover/what-is-a-plesiosaur.html), [giant turtles](https://www.nhm.ac.uk/discover/giant-prehistoric-turtles.html), the [American Museum of Natural History's Dunkleosteus exhibit](https://www.amnh.org/exhibitions/permanent/vertebrate-origins/dunkleosteus), and [research on mosasaur tail structure](https://www.nature.com/articles/ncomms3423).

## Combat and rarity

Elevated claw strokes, brighter directional arcs and terrain-correct particles make bites and abilities easier to see. The primary stroke remains visible at zero decorative particle density. Attack animation starts when an attack begins instead of joining a continuously running clip at an arbitrary point.

Mutation choices now filter every slot by the catalyst's rarity, closing the legendary filler loophole. Boss catalyst rarity is 3% legendary, 65% epic and 32% rare. High-tier ordinary catalysts are 0.4% legendary. Ordinary evolution mutation rewards require a high enough tier and a 0.1% roll for legendary eligibility. The rare evolution-form weight also falls from 0.6% to 0.1%; explicitly earned bloodline conditions retain their existing rules.

## Validation and local build

See [the before/after and feature gallery](../artifacts/frontier/review.html) and [machine-readable verification](../artifacts/frontier/verification-summary.json).

- 327 automated tests, including event damage/counterplay, restoration without duplicate spawns, malformed-state rejection, mixed-tier ecology, rarity boundaries, marine motion and geometry construction.
- Connected-ground searches reach every named location in three deterministic worlds; separate checks cover both skeleton entrances and Stormhorn's western gap.
- 108 GLBs pass stored Blender mesh QA; the six new sources received material and wireframe review. All 108 species were captured in three poses, producing 324 checked views. There are 157 bundled species/shop portraits.
- Browser checks cover separate Start art, readable desktop/narrow menus, pause borders, all five locations, mountain camera height, saved meteor encounters, lava materials, lightning/shelter cues, attack strokes without particles and large migrations.
- Eight intent-driven bot runs, each with a requested 600-second limit, check finite state, population bounds and checkpoint/replay parity. Deaths end runs early; this is a stability sample rather than a human difficulty study.

The versioned portable is `release/frontier/Jurassic Domination-0.11.0-portable.exe`; the unpacked executable is in `release/frontier/win-unpacked`. Previous release folders remain available. Native checks use isolated temporary profiles. Software-rendered browser screenshots and simulation timings do not establish frame rate on a physical gaming GPU.

Location overview images use a wider inspection camera with reduced fog; HUD images use the gameplay camera. The graphics remain stylized, and long-term balance of the enlarged encounters still benefits from human play.
