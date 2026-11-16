# Lost Continent presentation overhaul

Scope: interfaces, terrain/water presentation, lighting, camera, effects and
environmental integration. Dinosaur/vegetation meshes, gameplay, progression,
controls and persistent save formats are outside the redesign.

## Baseline and checkpoint

The audit identified the Vite / Three.js r187 / Electron pipeline, 102 forms,
fourteen regions, instanced terrain, a pooled particle renderer and DOM UI with
ten cascading stylesheets. The last presentation stylesheet alone contained
1,735 lines. Broad game and desktop workflows remain available as regression
checks. Baseline captures cover 27 views/sizes under
`artifacts/presentation/before`; the runtime report contains no browser errors.

Tracked pre-existing work is preserved at Git ref
`refs/codex/checkpoints/pre-presentation-20261115`. The working-tree patch and
source archive, including untracked code from the model pass, are in
`artifacts/presentation/before`. Existing model directories will remain intact.

## Art contract

The Lost Continent field kit uses six roles: charcoal #111c1d, slate #263335,
mineral white #eee8d8, muted lichen #abb8a7, weathered brass #c8a367 and rust
#bd6054. Pale jade #96bfad identifies stamina; rarity retains both color and a
written name. Brass marks decisions, not every outline. Typography uses local
Bahnschrift/Segoe UI with a condensed display treatment, avoiding network fonts.

Main-menu composition reserves the right two thirds for the actual living
world, with a grounded foreground specimen and distant ridges. The left action
rail keeps play/continue strongest. Gameplay uses a compact species/vitals group
at upper left, expedition/map at upper right and a horizontal ability dock.
Progression cards have large creature portraits and clearly separated stats,
rarity and choices. Secondary menus share one panel and control system.

Animation communicates state: short input feedback, a single restrained screen
entrance, eased meter changes and deliberate selection/reveal effects. Reduced
motion suppresses decorative movement. No new postprocessing dependency or
unbounded particle system is planned.

## Prioritized implementation checklist

- [x] Central tokens, typography, shared panels/buttons/inputs/focus and motion.
- [x] Modal/HUD layering, actual survival meters, compact responsive HUD.
- [x] Atmospheric title composition and complete menu navigation.
- [x] Evolution/mutation cards, encyclopedia, journal, builds and achievements.
- [x] Pause/settings/keybinding/backup/shop/island/death consistency.
- [x] Ground palette blending, shoreline depth/ripples/foam and wet edges.
- [x] Biome lighting, distant layers and restrained atmospheric presentation.
- [x] Combat/evolution/collection effects, notifications and camera polish.
- [x] Resolution sweep, real interactions, reduced motion and accessibility.
- [x] Build, game/desktop regression checks and before/after performance.

This document will be updated from verification results, not from intended work.

## Final local validation and playable build

Verified on November 15, 2026:

- **266 / 266 unit tests**; no failed or skipped tests.
- **22 browser integration checks**, **9 collection checks**, **16 Electron
  desktop checks** and **6 extracted-portable checks**; no runtime errors in the
  successful runs. Older collection capitalization and portable compendium
  selectors were updated to use the current navigation contract. Evolution QA
  also avoids clicking an already-selected default form before its explicit
  confirmation, since the existing second-click behavior confirms immediately.
- Production build and Windows portable packaging succeeded. The archive's HTML,
  CSS, application and Three.js bundles match the current `dist` files byte for
  byte (`artifacts/presentation/package-verification.json`).
- Native fullscreen toggled and restored; source desktop restart and a second
  portable extraction both continued the same life from disk. Native QA used
  disposable profiles, verified their isolation and observed zero external
  resource requests.
- `git diff --check` passed. Renderer benchmark disposal, resident chunk bounds,
  real moving-food geometry and three effective quality settings passed.

Launch the updated standalone game at:

`release/presentation-overhaul/Jurassic Domination-0.8.0-portable.exe`

The unpacked counterpart is in `release/presentation-overhaul/win-unpacked`.
Existing release files outside that directory were preserved. The original
`Play Jurassic Domination.cmd` also builds and runs the updated source.

Portable SHA-256:

`fd8e63acfafe89b29bf8ae121e44cb586cdc79ff40fdd3e571c752af682f4728`

Fresh suite reports and logs are archived under `artifacts/presentation/`.

## Implemented systems

`src/presentation.css` replaces the old final polish stylesheet. It centralizes
color roles, local typography, spacing, panel surfaces, focus, input states and
motion timing. `presentation.js` supplies one authored SVG icon vocabulary and
converts known display glyphs without modifying markup attributes. The shared
screen entry point sets an accessible heading, contains keyboard focus and hides
the gameplay HUD while a menu is open. Settings, confirmations and save backups
use the same controls as progression and collections.

The HUD groups species, health, stamina, **actual nourishment**, evolution,
objectives and environmental state at left. Timers and the map stay at right;
region information flows beneath the map instead of using a fixed position.
The action dock displays the current kit and includes a keyboard accessible roar
button. Unsupported skills remain hidden. Bar widths are clamped and survival
meters expose current values to accessibility APIs. Interface scaling constrains
menus against the scaled viewport; small windows keep prompts between the side
panels. Large panels intentionally scroll, with a persistent action footer.

Title framing now shows the entire specimen, restrained camera drift, layered
distant ridges and a presentation-only foreground foliage cutaway. The existing
follow camera, zoom, reduced motion and fullscreen controls remain functional.
Lighting uses a quieter daylight palette, distinct fog for all fourteen actual
regions, and the existing day/night and weather cycles. Ground pigment is sampled
in world coordinates across region and chunk boundaries. Rocks use biome-aware
mineral tints; fine soil/litter maps use subtler bump and color contrast.

Bounded pools use analytically differentiated directional wave normals, filtered
highlights, Fresnel sky reflection, estimated depth absorption, shoreline foam and
movement-sensitive contact ripples. The rendered ground is depressed beneath
pools, including neighbor-chunk pools, to prevent hills cutting through water.
This deformation leaves the simulation terrain/collision data intact. Shore
materials read as wet; three separate ripple ring draws and the extra inner water
disc were replaced by the shader. The sanctuary has its own independent animated
ocean clock, shoreline foam, calmer lighting and matching interface surfaces.

The existing combat, collection, evolution and weather events now feed a shared
bounded soft-sprite batch; leaf fragments retain geometry in a second batch.
Weather points use a round shader falloff instead of square flecks. Emission
adapts to quality and reduced motion. Damage text, toast feedback and progression
selection states follow the shared palette. No fullscreen postprocessing or
reflection render pass was added.

Blender MCP was available and its live Blender 5.3 scene was inspected. This pass
required no modeling/export work; dinosaur and vegetation assets from the earlier
pass remain unchanged. No paid asset service or new external font dependency was
used. No save format or gameplay/progression rebalance was introduced.

## Visual verification

Open `artifacts/presentation/comparison.html` for eighteen before/after screen
pairs and the new environment/detail captures. `after/report.json` records 61
broad captures with no browser errors. `after/details-report.json` records targeted
interaction and geometry checks, including real backup download and roar
cooldown. All **23** detail checks pass, including containment of all 102 species
card names and an OS reduced-motion preference stopping the title camera. The
final HUD and secondary-menu captures from this suite supersede earlier
iterations. Captures include all fourteen biomes, water normal/depth diagnostics,
the sanctuary, expanded map, evolution effects, backup and confirmation panels.

The requested 1280x720, 1600x900, 1920x1080 and 2560x1440 sizes were tested, plus
800x600. HUD bounds and panel separation were also checked at **125% interface
scale at every size**. Settings focus wraps within the dialog; reduced-motion CSS
and the readable paused/modal composition were checked. Terrain clipping,
foreground specimen obstruction, hidden ability tiles, narrow-map overlap and
enlarged prompt overlap were found through captures and corrected.

Reproduce with Vite running locally:

```powershell
node scripts/qa-presentation.mjs after
node scripts/qa-presentation-details.mjs
node scripts/build-presentation-gallery.mjs
npm test
npm run build
npm run qa
npm run qa:collections
npm run qa:desktop
```

## Measured rendering cost

The same Chrome/SwiftShader, 1440x900, seed 4411 renderer benchmark was recorded
before and after. Values below are steady terrain-scene measurements; no other
browser QA ran during the final benchmark.

| Quality | Draw calls before / after | Triangles before / after | CPU submission median ms before / after | Browser interval median ms before / after |
|---|---:|---:|---:|---:|
| High | 232 / 231 | 1,508,312 / 1,472,830 | 2.9 / 3.1 | 200.2 / 200.2 |
| Medium | 230 / 229 | 889,940 / 864,694 | 2.4 / 2.4 | 150.1 / 150.1 |
| Low | 106 / 105 | 253,060 / 245,986 | 1.9 / 1.7 | 100.2 / 100.1 |

This is approximately unchanged software-renderer timing with a small reduction
in geometry. It is **not a gaming-hardware FPS result**. The crowded scenario
(40 entities) retained a 567.2 ms median software-renderer interval; cold model /
streaming work still produced a roughly 1.7 second tail. Synchronous chunk builds
remain about 20-51 ms in this run. Resident geometry settled at 161 initially and
163 after returning, nine resident terrain chunks remained bounded, and disposal
and moving-food checks passed. Full raw reports are `before/render.json` and
`after/render.json`; timing varies with machine load.

## Limits and remaining work

- Water depth is an authored radial basin/coastal estimate. Reflections use
  analytic sky; there is no screen-depth refraction, planar reflection or SSR.
- This pass improves materials and integration of existing rocks, caves, ruins
  and scenery. Individually sculpted landmark replacements and new creature or
  vegetation models/animation clips are separate art work.
- Crowded-scene draw-call reduction, asynchronous chunk construction and native
  GPU profiling remain worthwhile performance work. This pass establishes no
  60 FPS promise or Steam release certification.
- Desktop layouts were tested down to the application's 800x600 minimum. Touch
  and mobile play are not newly supported by this overhaul.
- Production build retains Vite's large application-chunk advisory. Builds are
  functional; a deeper module/data split is outside this presentation pass.
