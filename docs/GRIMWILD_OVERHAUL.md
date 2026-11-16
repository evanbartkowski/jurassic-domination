# Grimwild anatomy and combat pass

Requested direction: recognizable, connected dinosaur anatomy across the full
roster; larger frightening predators; dark centered title/expedition menus;
top-center survival bars; an actual death presentation; a small gold evolution
cue; distinct builds and deliberate enemy attack patterns; quiet supplied music.

Rollback: `refs/codex/checkpoints/pre-grimwild-20261115` and
`artifacts/grimwild/before/source-checkpoint.zip`. Earlier creature assets remain
in `assets/models/`, `assets/art-v2/` and `public/assets/models-v2/`.

- [x] Capture baseline creature and interface review.
- [x] Replace disconnected anatomy and incorrect genus silhouettes throughout
  the roster; review rest, stride and bite poses, including inherited skins.
- [x] Give large dangerous species a heavier, threatening silhouette and scale.
- [x] Add a Start front page and centered, dark expedition menu; rotate living
  menu creatures when returning to the page.
- [x] Rebuild pause, top-center health/stamina, death fade/blood presentation and
  a nonblocking gold evolution-ready prompt and sound.
- [x] Route the supplied music into quiet menu, exploration, combat and death
  playlists, with fades, independent volume and reliable focus/mute handling.
- [x] Apply distinct glass cannon, bulwark, runner, venom and burst identities
  through actual stats, skills and readable comparisons.
- [x] Add readable enemy commitment, recovery and combat tactics with perception,
  windups and escape opportunities.
- [x] Verify all species, portraits, input, progression, saves and Windows builds.

Reference images guide original anatomy and silhouette authoring; third-party
game models/textures are not bundled. References and actual validation results
will be recorded alongside the final asset review.

## Original anatomical assets

All 102 species use `public/assets/models-v3/<species>.glb`. Each asset includes
one independently cloned skeleton, vertex pigment, UVs, normalized skin weights
and Idle/Walk/Run/Attack/Graze/Rest clips. The axial skin and limbs form one
connected surface; articulated jaws and rooted teeth, armor, horns, feathers,
hooves and wing membranes retain their appropriate bone influences. The head
turns around its neck; the mandible opens around a hinge. The procedural loading
fallback also keeps its head attached and avoids double-scaling juvenile jaws.

The Blender source and individual QA reports live in `assets/art-v3/creatures/`.
The full generation pass has zero reported errors and zero warnings across 102
assets. Runtime geometry totals 134,520,520 bytes. The nine-headed Hydra uses
41,160 triangles; other assets stay below that budget. Material and wire views
were inspected in Blender, with the complete roster reviewed in browser rest,
stride and bite captures. All 306 captured poses fit their camera frusta.

Tyrannosaurs have deeper skulls and small two-fingered arms; spinosaurs have long
narrow jaws; ceratopsians carry rooted frills, genus-appropriate horns and beaks;
ankylosaurs have armor and tail clubs; stegosaurs have plates and a thagomizer;
raptors have narrow feathered bodies and sickle claws. Sauropods, hadrosaurs,
pachycephalosaurs, pterosaurs, crocodilians and marine forms use separate family
profiles. Psittacosaurus, Iguanodon, Mononykus and Heterodontosaurus retain their
distinctive bristles, thumb spikes, single digits and tusks. Fantasy forms keep
their intended wings, horns and multiple heads.

Reference direction used the Natural History Museum's
[Tyrannosaurus](https://www.nhm.ac.uk/discover/dino-directory/tyrannosaurus.html),
[Spinosaurus](https://www.nhm.ac.uk/discover/dino-directory/spinosaurus.html),
[Triceratops](https://www.nhm.ac.uk/discover/dino-directory/triceratops.html) and
[Velociraptor](https://www.nhm.ac.uk/discover/velociraptor-facts.html) material,
alongside Jurassic World Evolution silhouette references. These are original
stylized models. Third-party game meshes, textures and reference images are not
redistributed. The result does not claim photorealism or scientific certainty
about extinct animals' colors.

## Presentation, music and combat

The Start page precedes the expedition menu. Each return picks a different
living menu creature, with movement disabled by the reduced-motion preference.
The title and pause menus use ash, bone, dried blood and muted gold. Health and
stamina are separate horizontal bars at the top center. The survival column
reserves space for the action dock even at 800x600 with 125% UI scaling.

Fatal damage still records the terminal life immediately. The world then fades
under blood-darkened edges and YOU DIED before the record and restart actions
appear. Reduced motion removes the animations. Evolution readiness emits one
sound and a small central gold sigil; the simulation keeps running until the
player opens choices.

Nine supplied recordings are copied unchanged into `public/sounds/music/`.
Decoded sample peaks and whole-track RMS are recorded in
`artifacts/grimwild/music-analysis.json`; these measurements are not LUFS or a
headphone listening review. Gain trims reduce large level differences, scene
music remains capped at 0.28 before speaker output, and master/music/focus mute
take effect immediately. Two voices crossfade; nearby aggression selects combat
music with an eight-second hold, and death selects the supplied Siren lament.
The synthesized score remains a local fallback.

Build identities now change real health, damage, armor, speed, stamina recovery,
venom, hunger or ability power/recharge. Their benefits and costs appear beside
base-form comparisons. Enemies lock aim during readable windups, use recovery
windows, alternate strikes, yield pack attack slots and retreat when appropriate.
Ground arcs show committed bites and tail sweeps. Existing perception, cover,
projectiles, charges, flight and boss systems remain connected to the simulation.

## Verification

Fresh results and package hashes are recorded in
`artifacts/grimwild/verification-summary.json`. The interactive before/after
review is `artifacts/grimwild/review.html`. The source checkpoint and earlier
assets remain available. Automated simulation and software-rendered browser
checks do not replace human balance playtesting or testing across physical GPUs
and audio devices.

Final verification: **300 unit tests**, **109 integration checks** (including 17
on the actual unpacked Windows executable and seven on the portable executable),
102 clean mesh QA reports, 306 framed creature poses, 151 refreshed portraits and
nine successfully decoded music recordings. Eight seeded 600-second simulation
attempts completed with exact checkpoint restore parity and zero validation
failures; their actual observed durations average 580 simulation seconds because
hit-stop and choices consume some requested ticks.

The final ASAR matches all 365 files in the built distribution byte for byte.
The portable executable is `release/grimwild/Jurassic Domination-0.10.0-portable.exe`
(255,111,618 bytes). SHA-256:
`2ad825f4d2e3eab90b6db5cb3c287beb4c31d7db5cabee1ea54f8427957312c4`.
`Play Jurassic Domination.cmd` now prefers this standalone release when Node is
unavailable. Existing saves and earlier releases were preserved; automation used
isolated profiles.
