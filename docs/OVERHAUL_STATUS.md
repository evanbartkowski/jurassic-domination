# Jurassic Domination overhaul milestones

The full expansion request is being implemented in dependency order. The first
pass stabilizes the existing game and adds usable foundations. Content counts
are intentionally unchanged: 100 playable forms, eight tiers, fourteen regions,
and a 1,600-unit world radius. Increasing those constants alone would not meet
the requested quality, ecology, performance or endgame goals.

## Audit of the existing repository

The audit covered simulation, rules, content, persistence, collections, sanctuary,
input/UI, procedural creatures and art, terrain/streaming, renderer/viewers,
audio, Electron, packaging, documentation, and the test/QA scripts. The starting
v0.6 state passed 88 automated tests. Existing visual improvements and saves were
preserved; no project reset or dependency replacement was needed.

Confirmed issues and boundaries:

- Active lives were abandoned when the application closed. Profile and settings
  were written independently, with no transaction or verified recovery slot.
- Run records lacked stable identity and idempotent completion.
- Keyboard input called variable-delta rule updates directly, without a reusable
  validated command, snapshot or replay boundary.
- Magnets changed food coordinates without moving existing rendered food models.
- Nine full-detail terrain chunks could be generated in one frame. Quality
  presets primarily changed pixel ratio and shadows, retaining expensive foliage.
- Straight attacks and fast movement could ignore solid obstacles. Projectile
  collision used endpoint proximity and could miss a crossing target.
- Controls could not be remapped and active saves had no export/restore UI.

## Milestone A: durable offline simulation foundation

Implementation files: `src/run-state.js`, `src/simulation.js`, `src/state-store.js`,
`src/profile.js`, `src/collections.js`, `src/game.js`, `src/main.js`, `src/ui.js`,
`tests/simulation.test.js`, `tests/state-store.test.js` and `scripts/simulate.mjs`.

Features: versioned full-run snapshots, fixed-tick validated offline commands,
stable run identity, same-runtime replay, interest-filtered state, two-slot atomic
checkpoints, corruption recovery, active-life resume, permadeath receipts,
idempotent run records, legacy profile migration, and reviewed backup restore.

See [the architecture document](ARCHITECTURE.md) for contracts and trust boundaries.

## Milestone B: playable controls, collisions and rendering budgets

Implementation files: `src/controls.js`, `src/foundation.css`, `src/combat.js`,
`src/game.js`, `src/ecosystem.js`, `src/terrain.js`, and `src/renderer.js`.
Validation lives in `tests/controls.test.js`, `tests/combat-collision.test.js`,
`tests/rendering.test.js`, `scripts/qa-foundation.mjs` and
`scripts/benchmark-render.mjs`. Production integration also updates `vite.config.js`,
`package.json`/lockfile, the launcher, desktop/portable QA scripts and the Windows
workflow's reproducible simulation check.

Features: gameplay key remapping with conflict swapping, standard-controller
gameplay input, adjustable interface scale and reduced motion, model updates for
magnet movement, swept obstacle/projectile checks, attack visibility checks,
center-first incremental terrain, quality/distance detail, and renderer cleanup.

These are foundation and early gameplay improvements. The existing difficulty
curve is preserved while new performance and simulation tools establish evidence
for future balancing. A final-tier success rate has not been established from
experienced human playtesting.

## Measurements

Before changes, 48,000 fixed-size stress updates across forty seeds took 5,934 ms
of simulation CPU time on this machine: mean 0.123 ms, p95 0.199 ms and p99 0.336 ms
per update. This artificial stress kept health/hunger safe; it measures simulation
cost, not fair-play progression or final-tier success.

The renderer benchmark uses seed 4411, 1440×900 Chrome and SwiftShader. Initial
before/after geometry measurements were:

| Preset | Previous triangles | After detail scaling |
| --- | ---: | ---: |
| High | 1,617,732 | 1,617,732 |
| Medium | 1,617,732 | 869,064 |
| Low | 1,091,572 | 222,928 |

High preserves detail; medium and low reduce geometry by approximately 46% and
80% respectively. These measurements do not establish 60 FPS on gaming hardware.
An individual chunk and shader/resource preparation can still cause a frame spike.
The reproducible rendering script records draw calls, triangles, submission
duration, actual frame intervals, streaming work and resource counts separately.

The same 48,000-update stress workload after collision improvements measured
mean 0.176 ms and p95 0.294 ms per update. That is more CPU work than v0.6's
0.123/0.199 ms, because physical cover and swept collision now execute real checks.
A conservative broad phase lowered the initial new mean from 0.192 to 0.176 ms.
This is a measured tradeoff, not a claim that every subsystem became faster.

One hundred genuine intent-driven attempts, each limited to sixty simulation
seconds, completed with zero invariant/checkpoint failures. They reached tier 3
at most, with one death, peaks of 79 creatures and 201 foods, and a largest
checkpoint of 259,112 bytes. These short deterministic bots do not establish
human difficulty, long-run success rates or the requested final-tier 1–2% target.
Their sampled tick mean/p95 were 0.206/0.351 ms on this machine.

Fifty in-memory journal commits measured median 4.90 ms and p95 5.55 ms for a
106,963-byte snapshot; browser/disk latency is excluded. Larger worlds will need
regional deltas and a different persistence budget before expansion.

## Verified checks in this pass

- 135 automated tests passed, including snapshot replay, corruption/interruption,
  permadeath, duplicate receipts, authority validation, collisions, streaming,
  rendering cleanup, existing gameplay and collection ownership.
- Fourteen new browser checks passed, with no runtime/console errors. They cover
  actual save/continue/reload, exact state, pending evolution, real storage-failure
  navigation/backoff, backup download/file import, remapping, controller intents,
  125% interfaces and title-menu layout.
- The existing twenty-two general browser integration checks passed.
- The production build passes with separate 289 KB gameplay and 562 KB Three.js
  chunks; unchanged renderer dependencies can be cached separately from game updates.
- Rendering workload/resource assertions and the one-hundred-seed simulation
  passed. Reports/screenshots are generated under the ignored `artifacts/` folder.
- Fourteen offline Electron checks and six actual portable-executable checks
  passed, including native close/relaunch and a second portable extraction that
  restores the same life from its isolated disk profile. v0.7.0 is packaged and
  the launcher selects that executable. Bundled CSS/JavaScript hashes match `dist`.

Reproduce with `npm test`, `npm run qa:foundation`, `npm run qa`,
`npm run benchmark:render`, and `npm run simulate -- --runs 100 --seconds 60`.
Browser checks require `npm run dev` and installed Chrome. Windows production
checks use isolated save directories and are recorded separately in
[VALIDATION.md](VALIDATION.md).

## Living generations increment (0.8.0)

The next connected increment adds individual genetics, bounded permanent ancestry,
real nested families and species-dependent maturation, sensory hunting, social roles,
recoverable survival pressure, reproducible regional weather and persistent scars,
fog exploration and ten guaranteed landmarks. Two accomplishment-driven marine
branches raise the roster to 102. L opens the field journal; H stalks or dives.
Saved lives migrate to snapshot v2 with neutral traits and no rerolls. Local balance
recordings now separate observed deaths from time-limit censoring and distinguish
missing metrics from zero results.

See [IMMERSION_SYSTEMS.md](IMMERSION_SYSTEMS.md) for exact behavior and bounds,
secret-path attainability and a concrete authoritative private co-op plan. This is
still offline single player; navigation remains a ground plane, with aquatic
handling and existing wing-assisted moves. Deep ocean layers, free vertical flight,
burrowing, environmental puzzles, ecosystem-wide migrations, world-ending events,
leadership combat and player social systems remain further milestones.

## Remaining work and order

1. Broader recovery/fault testing and actual gaming-hardware frame-time profiling.
2. Typed evolution prerequisites/graph validation, build-changing mutation
   tradeoffs, richer animal needs and regional population models.
3. New anatomies and animations, meaningful branching paths and biomes; expand
   tiers and geography only after their encounters and streaming budgets work.
4. Multi-phase biome guardians, the First Sovereign arc and intentionally hard
   final-tier access, tuned with reproducible simulations and human playtesting.
5. Species mastery, fossils/trophies, expanded sanctuary exhibits and onboarding.
6. An authenticated dedicated server and actual network replication after the
   local command/snapshot and server-storage contracts withstand adversarial tests.

The 24–30 tiers, 300–500 distinct forms, 12,000–20,000-unit continent, large new
boss arc, persistent online worlds and multiplayer sanctuaries remain future
milestones. This build does not present them as implemented.
