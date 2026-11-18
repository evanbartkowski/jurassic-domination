# Movement, combat and frame pacing

The November 16 motion pass repairs the runtime presentation for the existing
108-creature asset roster. Native Blender sources and gameplay collision positions
remain authoritative and unchanged.

- Locomotion velocity is filtered independently of fixed simulation ticks. Idle,
  walk and run blend without alternating stopped/moving poses between ticks.
- Walk and run use matching contact phases, a longer planted stance and a bent
  recovery knee. Export-sanitized left/right joint names are handled explicitly.
- Breathing, asynchronous head inspection, neck stabilization and delayed tail
  motion supplement the imported clips. Sleeping and death poses bypass these
  offsets. Attacks have faster commitment and a smoother recovery.
- Sprint no longer changes camera distance. Size changes ease the framing over
  time. Near creatures retain full-rate animation; small background animals use
  30 Hz skeleton updates while their transforms remain smooth.
- Tier 0 has no innate attack ability; tiers 1–2 have at most one. Techniques and
  mutation-granted ultimates cannot bypass that early-life limit. Basic attacks,
  sprint, anatomy-dependent dash and utility roar remain available.
- Bite, ram and stomp have separate visual effects. Their geometry and opacity
  expire independently of the optional decorative particle setting.
- Background terrain construction yields between geometry batches and installs
  completed chunks atomically. Cancelled staging releases its owned resources.
- Pool residents load the existing animated marine GLBs through inexpensive
  temporary silhouettes. Model normalization bounds are cached, cosmetic rays
  run only for an actual cosmetic, and a herd's asset preparation is spread
  across frames. Shader preparation precedes the visible land-model swap.

## Verification

`npm test` covers gait contact, alternating imported joint names, idle pose
stability, fixed-step velocity, early kits, attack effect expiry, asset preparation
scheduling, deterministic sliced terrain, cancellation and pool disposal.

`node scripts/qa-motion.mjs` checks real keyboard sprinting, camera framing,
hatchling HUD visibility and six imported body families. It records a CPU profile
and travel measurements under `artifacts/motion-polish/qa`.

`node scripts/profile-motion.mjs before|final` records three repeatable crowded
render runs and screenshots. The recorded Radeon RX 9070 XT baseline reproduced
roughly 0.60 world units of sprint-induced camera pulsing; the corrected fixture
has zero pulsing. Render counters and CPU submission times are not GPU frame
times. Full-game travel still records occasional cold-load frame spikes; these
checks do not establish a locked frame rate on every machine.

Browser, desktop and portable reports are kept under `artifacts/motion-polish`.
