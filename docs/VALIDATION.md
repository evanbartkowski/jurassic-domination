# Local validation - November 7, 2026

## Sanctuary Collection (0.3.0)

| Scope | Result |
| --- | --- |
| Node gameplay, audio, collection transactions and migration | 57 passed |
| Existing Chrome gameplay integration | 22 passed, zero runtime errors |
| New collection browser integration | See artifacts/collections-qa.json |
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
