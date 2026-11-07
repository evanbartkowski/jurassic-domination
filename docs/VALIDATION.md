# Local validation - November 7, 2026

## Living generations (0.8.0)

| Scope | Result |
| --- | --- |
| Full Node suite, including inherited traits, life cycles, senses, save migrations, ancestry backups, weather, discoveries, survival and both earned marine paths | 202 passed |
| General browser integration | 22 passed, zero runtime errors |
| Save recovery, backups, remapping, controller, 125% UI and permadeath browser checks | 14 passed, zero errors |
| Integrated stalking, field journal, fog and exact immersion checkpoint resume | 5 passed |
| Living-world graphics/portraits and progression browser suites | 18 and 8 passed |
| Collection browser suite | 9 passed |
| Responsive HUD, 100%/125% and reduced motion | Six layouts passed at 1440x900, 800x600 and 390x844; no overlaps or clipped panels |
| Intent-driven simulation, unmodified rules | 50 seeds x 120 seconds and six seeds x 600 seconds, zero state-budget or checkpoint-roundtrip failures |
| Ten-minute simulations | Reached tier 8; peak 98 active creatures, 202 meals; largest final snapshot 926,729 bytes |
| Local analytics | Actual nearby boss encounters, observed kills and discovered sites recorded; all six long attempts were time-limit censored, so mean completed-life survival remains unknown |
| Production build | Approximately 352 kB gameplay, 581 kB Three.js, 93 kB CSS |

The longer simulation's sampled renderer-free tick cost was 0.31 ms mean and
0.65 ms p95 on this machine. These are local CPU observations under concurrent
tools, not GPU FPS, target hardware requirements, human difficulty measurements
or evidence that endgame balance is finished. Use the current long-run report
for encounter analytics; earlier short-run reports preceded the nearby-encounter
counting correction. Reports and screenshots remain in ignored `artifacts/`.

Full vertical exploration and networking are not implemented or certified by
these tests. Physical controllers still require device testing.

## Foundations (0.7.0)

| Scope | Result |
| --- | --- |
| Automated simulation, storage fault/recovery, controls, collision, rendering and existing gameplay tests | 135 passed |
| Existing general gameplay browser integration | 22 passed, zero runtime errors |
| Real save/continue/reload, backups, failed-save protection, pending evolution, remapping, controller adapters, 125% UI and title layouts | 14 passed, zero runtime errors |
| Reproducible, unmodified-rule bot attempts | 100 seeds x 60 seconds, zero invariant/checkpoint failures |
| Rendering budget, moving food, streaming queue, resource return and disposal assertions | Passed |
| Offline production Electron host | 14 passed, including native close/relaunch and the same paused life from disk |
| Actual packaged portable executable | 6 passed, including a second extraction restoring the same saved life |
| Production build / portable package / bundled asset hashes | Passed |

Windows and browser checks used disposable profiles; existing player data was not altered. Controller input was exercised through standard-mapping mocks, not a physical controller certification. Software-rendered Chrome measurements establish workload and functional behavior, not hardware 60 FPS or minimum system requirements.

Reports are generated in artifacts/foundation-qa.json, desktop-qa-report.json, portable-qa-report.json, render-benchmark.json, simulation-100-seeds.json and simulation-performance-comparison.json. See OVERHAUL_STATUS.md for measured CPU costs, geometry savings and remaining limitations. The final portable SHA-256 is recorded in release/SHA256SUMS.txt.

## Ancestral Paths (0.5.0)

| Scope | Result |
| --- | --- |
| Node simulation, progression, audio and portrait tests | 76 passed |
| Gameplay browser integration | 22 passed, zero runtime errors |
| Manual evolution, growth, bloodline and live music checks | 8 passed, zero runtime errors |
| Packaged Windows game, including X skill and J journal | 13 passed, zero runtime errors |
| Self-extracting portable Windows build | 5 passed, zero runtime errors |
| Production build and Windows portable packaging | Passed |

The eight new browser checks exercise a running world while the T indicator
flashes, voluntary opening and postponement without rerolling, real E fruit
pickups that unlock a rare form, consumption/reset of the condition, the live
J journal, heavy-form dash restrictions, defensive/healing X skills, actual
growth in health and rendered size, and an audio analyser connected specifically
to the music bus. The 800 x 600 HUD stays within the viewport.

New unit checks cover food-driven NPC variation and real foraging, independent
skill cooldowns, ranged bolts that cannot hit their caster, once-per-life
bloodline claims, parent-form requirements and a distribution probe showing
ordinary offers overwhelmingly remain Regular. All 149 portrait files validate.
The input-only hunting probe now uses available Q/R/X skills and explicitly
opens evolution; six seeds still reach evolution within 45 seconds and survive
the first minute with at least three kills.

Conditional rewards use controlled fixtures for reproducibility; this does not
establish the natural discovery rate or full-run balance. Audio checks validate
scheduling, routing, throttling and signal generation, not subjective sound
quality on every output device.



## Wild & Alive (0.4.0)

| Scope | Result |
| --- | --- |
| Node simulation, assets, collections and migration | 65 passed |
| Chrome gameplay integration | 22 passed, zero runtime errors |
| Collection browser integration | 9 passed, zero runtime errors |
| Visit/build/care/treasure and wilderness browser checks | 7 passed, zero runtime errors |
| Previously unknown hunt records a portrait discovery | Passed |
| Packaged Windows desktop | 12 passed, zero runtime errors |
| Self-extracting Windows portable | 5 passed, zero runtime errors |
| Production build and Windows portable packaging | Passed |

The new checks verify all 142 bundled portraits, deterministic environmental
features, safe starting radius, solid collisions, poison, carnivorous bites,
water slowdown, volcanic heat, differing attack reach, travelling ranged hits
and expiry, saved pet-care cooldowns and sanctuary conditions. Island checks
cover visit-by-default, explicit build mode, once-only conditional treasures,
800 x 600 controls and live terrain rendering. Rare rewards and late-game
conditions use controlled fixtures, not an unaided full playthrough.

Matching portraits appear after evolving into or killing a species. The source
uses actual model renders, not generic category icons. Local automation uses
software graphics and does not establish performance across gaming hardware
or the balance of the more dangerous ecosystem.



## Sanctuary Collection (0.3.0)

| Scope | Result |
| --- | --- |
| Node gameplay, audio, collection transactions and migration | 57 passed |
| Existing Chrome gameplay integration | 22 passed, zero runtime errors |
| New collection browser integration | 9 passed, zero runtime errors |
| Actual packaged Windows desktop | 12 passed, zero runtime errors |
| Self-extracting v0.3.0 portable build | 5 passed, zero runtime errors |
| Production build and Windows portable packaging | Passed |

New checks cover all 49 purchases and previews, insufficient balance, duplicate
claims, once-only milestones, no ordinary death payouts, v2 migration, owned-copy
placement rules, collisions and shoreline validation. Browser checks exercise
shop purchases, equipment, moving/rotating/storing, undo/redo, rename, reload and
800 x 600 layout. Packaged desktop checks buy a pet, equip it, place it and reopen
the saved island after reload using an isolated disposable profile. Rare pickup
checks inject controlled test finds; they do not establish natural drop balance.

Screenshots: [shop](screenshots/shop.png), [island](screenshots/island.png).

## Previous expansion validation


The Living Continent expansion (0.2.0) passed the following local checks:

| Scope | Result |
| --- | --- |
| Node gameplay, audio and persistence tests | 50 passed |
| Chrome browser integration checks | 22 passed, zero renderer errors |
| Actual packaged Windows executable integration checks | 11 passed, zero renderer errors |
| Self-extracting portable Windows build checks | 5 passed, zero renderer errors |
| Production Vite build and Windows portable packaging | Passed |
| npm dependency audit after updating and locking dependencies | Zero reported vulnerabilities |

Browser integration exercised the live animated title, tutorial, all 93 creature models, the searchable live 3D encyclopedia, settings, egg hatching, real keyboard movement, Q/R/dash cooldowns, pause/settings/resume, evolution choices, combat and edible remains, timed buffs, usable relic skills, permanent skin discoveries, map navigation, every signature ability's visual effects, red enemy telegraphs, distant region streaming, all eight tiers and ascension, boss tracking, death rewards, reload persistence, permanent upgrade purchases, skin equipment and 800 x 600 layout. Controlled development-only simulation access accelerated late-game transitions and supplied rare items; those checks are not claims of an unaided full playthrough or of naturally finding extremely rare loot.

Simulation tests cover the 100-fold map area, all regional tiers, food-quality scaling, natural egg hatching and juvenile maturation, temporary buff expiry, magnet and auto-eat behaviour, every collectible skill's cooldown, skin validation, old-save migration, permanent modifiers, neutral reactions, pack aggro, enemy ability hits and dodges, secondary techniques, boss drops/respawns and chunk cache preservation. A separate controlled traversal probe (seed 915, 160 moves) reached all 14 regions, kept at most nine active chunks, observed peaks of 142 loaded creatures and 190 food objects, and retained about 2.71 MiB of serialized explored-chunk state. These are observations from that probe, not universal memory or population limits.

The desktop checks launched `release/win-unpacked/Jurassic Domination.exe`, verified an isolated temporary save profile, tested the production sandbox and limited desktop bridge, exercised gameplay controls and fullscreen, confirmed clean quit, and observed no external HTTP requests. The tests did not modify an existing player profile.

The portable checks launched `release/Jurassic Domination-0.2.0-portable.exe`, connected directly to its extracted child through an isolated local debugging endpoint, and verified the production sandbox, hatch/Q/R/dodge controls, live encyclopedia, settings, fullscreen bridge, offline resource loading, and clean shutdown of both child and wrapper. Standard Electron inspector capture is unsuitable for this NSIS wrapper because it does not forward the child's diagnostic stdout. Reproduce this packaging smoke check with `npm run qa:portable` after packaging.

Screenshots and machine-readable local reports are in the ignored `artifacts/` folder. Reproduce with `npm test`, `npm run qa` while the development server is running, and `npm run qa:desktop` after building. To test a packaged executable in PowerShell:

```powershell
$env:JD_QA_EXE = (Resolve-Path 'release/win-unpacked/Jurassic Domination.exe').Path
npm run qa:desktop
Remove-Item Env:JD_QA_EXE
```

Browser and desktop automation used software graphics rendering for portable test execution. These checks establish local functionality; they do not establish minimum hardware requirements, broad device compatibility, human difficulty balance or Steam release approval. See `STEAM_RELEASE.md` for the remaining release work.
