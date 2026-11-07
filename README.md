# Jurassic Domination

A single-player dinosaur survival roguelite. Crack your egg, hatch into a random
small dinosaur, hunt through a living prehistoric wilderness, and evolve into
larger predators and eventually mythological creatures. Death ends the run;
earned DNA strengthens the next generation.

This is an offline, playable desktop game built with Three.js and Electron. It
includes original procedural 3D creatures and environments, an adaptive musical
score, combat, evolution choices, persistent progression, and a complete menu
flow. It is a foundation for a future commercial release; it has not been
published on Steam or integrated with Steamworks.

![Jurassic Domination title screen](docs/screenshots/title.png)

![Actual 3D gameplay with survival HUD](docs/screenshots/gameplay.png)

![Searchable live 3D dinosaur encyclopedia](docs/screenshots/encyclopedia.png)

## Play on Windows

From a packaged build, launch **Jurassic Domination.exe**. The unpacked version is
at `release/win-unpacked/Jurassic Domination.exe`; keep that entire folder
together. The portable build is `release/Jurassic Domination-0.2.0-portable.exe`.
An unsigned development build may trigger Windows SmartScreen. Obtain builds
from the project owner and sign the final commercial release.

In this workspace, you can also double-click **Play Jurassic Domination.cmd**.
Downloadable Windows builds are provided under this repository's GitHub Releases.

For a source checkout, install Node.js 24 LTS or newer, then run:

```powershell
npm ci
npm run build
npm run desktop
```

For browser development:

```powershell
npm run dev
```

Open the local address printed by Vite. Launching `index.html` directly from the
filesystem is not supported. A browser must support WebGL 2. Audio starts after
the first interaction, according to browser autoplay rules.

## Controls

| Action | Control |
| --- | --- |
| Move | WASD or arrow keys |
| Aim | Mouse position |
| Bite / primary attack | Left mouse button or Space |
| Species ability | Q |
| Species technique | R |
| Sprint | Hold Ctrl |
| Ancient relic skills, in discovery order | F, G, C, V, B, N |
| Dodge / dash | Shift |
| Eat nearby food | E |
| Pause / back | Escape |
| Toggle fullscreen | F11, or the Settings button |
| Expand the map | M |
| Open the dinosaur encyclopedia | Tab |

The tutorial, live 3D encyclopedia, and appearance collection are available from the title screen. Watch the
cooldown indicators before committing to a fight. Dash consumes stamina and
provides a short window of protection. Eat regularly: hunger matters, and food
supports both survival and evolution.

## Survive, evolve, repeat

- Begin each run as an egg, then hatch into a randomly selected beginner species.
- Hunt vulnerable prey, evade stronger predators, and collect food and essence.
- Reach the evolution threshold to select your next species and a mutation for
  the current run. Evolution pauses the action while you choose.
- Travel farther from the starting area to encounter harsher biomes and stronger
  creatures. Attacks are telegraphed; positioning and timing matter.
- Progress across eight evolution tiers, from small dinosaurs through apex
  predators to mythical creatures. Survive at the final tier to keep escalating.
- Death records the run and awards DNA. Spend DNA on permanent upgrades from the
  title screen, then try again with a new hatchling.

Three difficulty settings support learning, the intended survival challenge,
and a harsher extinction run. Species have different statistics, silhouettes,
and abilities; permanent upgrades and current-run mutations serve different
purposes.

## The Living Continent expansion (0.2.0)

The world is now **100 times larger by area**: a 1,600-unit radius, streamed in
160-unit chunks. Fourteen named regions span nesting grounds, savannah, wetlands,
redwoods, frostlands, deserts, titan graveyards, celestial gardens, dragon peaks,
and the primordial frontier. **M** switches between a local map and the whole
continent; click the map to mark a destination.
Hover a boss marker to see its guardian, difficulty and remaining respawn time.

Food and creature spawns belong to the region, rather than scaling to your current
form. Meals from regions far below your evolution tier provide sharply reduced
energy and nourishment. Stronger forms must travel to stronger ecosystems.

There are **93 creatures**, including 11 starter species and 24 mythological
forms. Smooth textured surfaces, articulated limbs, responsive turns, curved
necks, tapered tails, wing motion, and continuous serpent movement replace the
original faceted models. Unicorns, gryphons, crocodilians and wingless serpents
have distinct anatomy. These remain original procedural models, rather than
photogrammetry or externally sourced sculpted assets.

Each form has a primary ability (**Q**), a secondary technique (**R**), and an
innate adaptation. The roster draws on 14 ability types and 12 techniques:
charges, pounces, venom, fire, frost, chain lightning, petrification, tail sweeps,
healing, armored stances, feints, wingstorms, constriction and more.

- **Living eggs:** eat them with E for a meal, or leave them to hatch into juvenile
  creatures that grow and develop their adult behaviour. Hatching ages persist
  when you leave and return to an explored chunk.
- **Rare plants:** Blood Orchids increase damage, Windroot increases speed,
  Lodestone Blooms attract food, Hungry Mooncaps auto-eat nearby meals, Ironbark
  Fruit reduces damage, and Dawn Lotuses regenerate health. Effects last 30–50
  seconds; the HUD shows their remaining time. Collect these with E.
- **Ancient skill relics:** exceptionally uncommon finds grant Meteor Call, Time
  Fracture, Soulstorm, Riftstep, Heaven’s Judgment or Phoenix Covenant. Use the
  displayed F/G/C/V/B/N keys. These skills and their individual cooldowns last
  until death; they are not permanent profile unlocks.
- **Ancient fossils:** extremely rare discoveries unlock one of seven earned
  skins or four permanent lineage modifiers. Equip owned appearances from
  **Appearance & Ancient Relics**. Unlocks save immediately and survive death;
  no DNA or real-money purchase can substitute for finding them.
- **Enemy ecology:** neutral grazers retaliate when harmed, skittish or outmatched
  creatures flee, ambushers wait, territorial creatures keep to their home range,
  and packs share aggro and flank. Strong enemies use their own abilities.
  Red ground circles and cones mark the actual threatened area before impact.
- **Boss lairs:** eight named guardians occupy fixed locations shown on the map.
  Defeated guardians respawn after 180–320 seconds and drop region-quality meals
  and rare rewards. Timed roaming alpha hunts remain as additional encounters.
- **Live encyclopedia:** search by name, ability or habitat; filter your recorded
  evolved species or preview future forms. Inspect the actual animated 3D model
  and drag it to rotate. Entries include both skills, passives and temperament.

The original title illustration remains archived in the assets; the active title
screen now renders a live animated 3D environment and creature.

## Settings and save data

Master, music, and effect volumes can be adjusted independently. Graphics quality,
screen shake, damage numbers, and fullscreen controls are available in Settings.
The game automatically pauses when focus is lost.

Profile statistics, DNA, permanent upgrades, discoveries, and settings are saved
locally on this device. Browser and desktop profiles use separate storage. Runs
are intentionally completed in one session; closing the game abandons the
active run. There is no account, online leaderboard, telemetry, or cloud save.
Version 0.2 reads the existing v1 storage keys and preserves old DNA, upgrades,
records and discovered species while adding skins, relics and region discoveries.
Back up the Electron user-data directory before reinstalling or moving machines;
it is normally under `%APPDATA%/Jurassic Domination` on Windows. Browser saves
belong to the local development origin and can be lost when browser site data is
cleared.

## Build and verify

```powershell
npm test
npm run build
npm run package
```

For local integration checks, run `npm run dev` in one terminal and `npm run qa`
in another (requires installed Google Chrome). After `npm run build`, run
`npm run qa:desktop` to test the offline Electron application with an isolated
test profile. Screenshots and reports are written to `artifacts/`.
After packaging, `npm run qa:portable` checks the self-extracting portable build
through its actual extracted application, also using a disposable save profile.

Packaging requires Windows for the provided Windows release target. Output goes
to `release/`. Build artifacts and `node_modules/` are deliberately excluded from
Git; source files, locked dependencies, and original game assets are included.
The GitHub workflow validates and builds a Windows artifact for each push to
`main`, pull request, or manual workflow dispatch.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/main.js` | Input, game loop, persistence, and application integration |
| `src/game.js` | Seeded simulation, combat, survival, and evolution rules |
| `src/data.js` | Species and mutation definitions |
| `src/renderer.js` | 3D world and creature rendering |
| `src/creatures.js`, `src/specimen.js` | Detailed articulated models and the live specimen viewer |
| `src/terrain.js`, `src/world-data.js` | Streamed terrain, named regions, lairs and regional food rules |
| `src/ecosystem.js`, `src/content.js` | Creature ecology, loot, powers, techniques and expanded content |
| `src/ui.js`, `src/style.css` | Menus, tutorial, HUD, and accessibility |
| `src/audio.js` | Original adaptive procedural soundtrack and sound effects |
| `electron/` | Sandboxed desktop host and limited window controls |
| `tests/` | Automated gameplay validation |
| `public/assets/` | Bundled artwork and other static assets |

## Before a Steam release

See [the Steam release checklist](docs/STEAM_RELEASE.md) for the remaining work:
external playtesting, hardware coverage, signing, store materials, Steamworks
configuration, and the required content disclosures. See
[asset provenance](docs/ASSETS.md) for original and generated artwork, audio, and
third-party dependency licensing.

The title image is stored at `public/assets/title-art.png`; the built-in imagegen
tool and its exact generation prompt are documented in [ART_PROMPT.md](docs/ART_PROMPT.md).

Copyright © 2026 Evan Bartkowski. All rights reserved for the original game.
Dependency licenses remain applicable; see [LICENSE](LICENSE).
