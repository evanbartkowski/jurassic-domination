# Living Legacy — v0.13.0

The living ecosystem, permanent account progression, story and visual updates now ship together in the browser and Windows editions.

## Playing

- Hatch, learn the controls through play, eat to grow, then press **T** when you choose to evolve. Readiness keeps the world running.
- Wildlife hunts and consumes other wildlife, grows individually and can evolve. Eggs have distinct rarities, rewards and hatch risks. Aquatic deaths resolve into finite remains; nearby plants expose their health.
- **The Last Chorus** follows twelve chapters through lost refuges, conflicting ancestral witnesses and a final choice at the Origin Vault. Four survival quests repeat after claiming their rewards.
- Playing, exploring, feeding, hunting and quest rewards build permanent account XP. DNA arrives with account levels; the shop opens at level 2 and the growing island at level 3. Locked destinations show their required level.
- Rare treasures and four crate rarities appear in the wild. Crates offer an animated reveal, published odds, duplicate compensation and persistent rewards. The skin collection contains 44 choices including Natural; daily shop stock rotates deterministically.
- All 108 creatures use reviewed detailed models with anatomical features, PBR surfaces, individual feathers/scales where appropriate, animations and a distant mesh. Vivid skins and semantic health, stamina, hunger and XP colors remain legible in daylight and at night.

## Audio and focus fixes

- Active recordings finish instead of rewinding on the next hit or step. First-use effects no longer wait through an artificial initial cooldown.
- Walking uses short anatomical impacts. Earlier recordings lasted up to 22 seconds and continued after movement stopped.
- Music keeps a two-voice crossfade budget. Intentional source cancellation no longer blacklists valid music; autoplay denial waits for a fresh gesture. Resuming a combat lull preserves its current phrase.
- A rare pickup plays one reward phrase, even when it emits multiple receipts. Pointer movement across artwork inside one button creates one hover cue.
- Recorded music suspends unnecessary synthesized score scheduling. Independent channels, immediate mute and focus mute still apply.
- One HUD card prioritizes immediate incidents, critical survival, learning and the main story. Repeated READY labels and redundant status rows are removed; journals retain the full systems.
- Wildlife label selection and text refresh at 10 Hz, with positions following every frame. At most eight relevant land creatures are labelled; nearby plant health and aquatic threats remain available. The account widget changes its markup only when progress changes.
- Encyclopedia skill and movement hints use the player's current bindings. Default controls are **Shift** sprint, **R** dash and **Ctrl** technique.

## Validation

Verified locally on Windows with isolated test profiles, without overwriting existing player saves:

- 394 Node tests pass, including regressions for recording restarts, aborted music, denied autoplay, combat resumption, reward cue duplication and HUD priority.
- 19 Electron desktop integration checks pass, including offline PBR decoding, purchases, island saves, actual controls, native fullscreen, clean exit and continuation after application restart.
- 19 player journey checks pass, including remaps, controller navigation, voluntary evolution and exactly-once recovery of an unclaimed mutation reward.
- 10 stability checks cover seven restarts, five desktop sizes at 125% UI scale, focus loss, graphics recovery, corrupt data and unavailable storage.
- Six focused audio/HUD browser checks pass with actual decoded MP3 playback; five production smoke checks pass under `/jurassic-domination/`, with current GLBs and music downloaded successfully.
- 20 seeded, renderer-free 180-second bot attempts report no simulation failures. These measure deterministic system behavior, not human difficulty or enjoyment.
- Three fixed 21-creature rendering trials on an AMD Radeon RX 9070 XT measured 16.9–17.0 ms 95th-percentile frame intervals, with 2.4–3.5 ms 95th-percentile renderer submission time. This is a local Chrome result, not a guarantee for other hardware or the portable executable.
- Browser and desktop production builds pass. The browser edition is approximately 754 MiB on disk and loads creature assets on demand. It omits redundant previous-generation GLBs while retaining procedural loading fallback; the desktop edition keeps the previous GLB fallback too.
- `npm audit --omit=dev` reports no production dependency advisories. The build tool tree reports the upstream Picomatch ReDoS advisory (no patched release at verification); player input is never used as build glob patterns. No forced toolchain downgrade was applied.

Reproduce with `npm test`, `npm run qa:quality`, `npm run qa:desktop`, `npm run qa:player`, `npm run build:web`, `node scripts/qa-release.mjs`, and `node scripts/profile-motion.mjs quality-after`. Reports and screenshots are written into the ignored `artifacts/` directory.

## Publishing

Pushes to `main` run unit tests, build the browser edition and publish through GitHub Pages. A separate Windows workflow validates and produces the portable executable. The source `.blend` files, textures and reviewed current GLBs remain in the repository; obsolete runtime copies are pruned only from build outputs.

Browser play: https://evanbartkowski.github.io/jurassic-domination/

Windows downloads: https://github.com/evanbartkowski/jurassic-domination/releases/latest

Progress is local to each browser or desktop installation. Export a backup from Settings to transfer a lineage between them.
