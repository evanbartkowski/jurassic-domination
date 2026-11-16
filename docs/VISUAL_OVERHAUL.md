# Prehistoric art pass — 15 November 2026

This is an integrated art-production batch, not a claim that all 102 forms now
have individually sculpted, professionally authored animation sets. The exact
asset checklist is [VISUAL_ASSET_INVENTORY.json](VISUAL_ASSET_INVENTORY.json).

## Pipeline and visual direction

The game is real-time 3D in Three.js r187, built with Vite for browsers and
Electron. The elevated 43-degree perspective camera follows Y-up creatures
facing +X. Species size, individual growth, movement, hitboxes, saves and
simulation remain authoritative. Geometry must fit those contracts.

The art direction uses moss and slate hides, warm ochre/terracotta display
surfaces, lighter undersides, restrained scale relief, matte skin, bright eyes
and dark keratin. Broad markings and anatomical silhouettes carry recognition
at gameplay distance. River hunters have longer shallow muzzles, runners have
narrower torsos, and armored forms retain broad silhouettes. Fantasy creatures
retain their existing identities rather than being presented as real animals.

## Produced and integrated

- Ten existing Blender species have new versioned sources, GLBs, real transparent
  render previews, vertex pigment, UVs, deforming skeletons and six exported
  clips: Idle, Walk, Run, Attack, Graze and Rest. These include the raptor, tyrant,
  horned/armored dinosaurs, sail-backed predator and sauropod. The three earlier
  primitive theropods now have continuous axial and limb surfaces.
- The loader clones skeletons independently, shares cached mesh data, fits the
  original local creature envelope, grounds imports, blends behavior clips and
  releases instance skeletons. Gameplay and the encyclopedia share this path.
  Custom skins and inherited marking variants retain their procedural models.
- All 102 procedural forms receive matte material response, restrained relief,
  species-specific default markings and appropriate herbivore/predator eye
  treatment. Selected taxonomic families also receive silhouette changes.
- A Blender library supplies fern, cycad, conifer, ginkgo-like tree, shrub,
  horsetail, rock, flower, mushroom and fallen log meshes with four LODs.
  Compact packed buffers feed existing terrain instancing without asynchronous
  per-plant downloads. Original botanical GLB and source remain editable.
- Fern patches cluster around deterministic thickets. Foliage has gentle
  instance-phased wind and the existing camera-clearance treatment. Rocks keep
  a static shader. Larger scenery retains authoritative obstacle footprints.
- Visual checks exposed and fixed the title-to-compendium null-game crash,
  the obsolete specimen-view screen name and a projectile delta-time exception.

## Reproduce and inspect

`scripts/blender/overhaul_creatures.py` reads original sources from
`assets/models` and writes `assets/art-v2/creatures` plus
`public/assets/models-v2`. `overhaul_botany.py` produces the botanical library
and `src/botany-meshes.json`. The connected Blender MCP was used for authoring,
inspection and botanical exports; longer creature batches ran in isolated
Blender CLI processes. No external paid services or third-party assets were used.

Run `npm test`, `npm run build`, `npm run qa`,
`node scripts/qa-visual-overhaul.mjs`, and `npm run benchmark:render`.
`scripts/blender/qa_overhaul.py -- --render` runs the installed mesh QA gate and
writes actual Blender previews. Small-feature coplanarity tolerance is 0.2 mm.
QA reports and browser contact sheets live in `artifacts/visual-overhaul`.
`node scripts/art-inventory.mjs` refreshes the checklist from those reports.

## Validation and measurements

The final unit run passed **260 tests**. Browser integration passed **22 checks**
and the built Electron application passed **16 checks**, with no runtime errors
or external network requests. Electron explicitly verifies local GLB fetching;
its content policy permits file requests and continues to block remote network
connections. Disposable test profiles were used for desktop persistence checks.
The visual harness rendered all 102 forms, all ten imported creatures and all
ten botanical/prop types, and captured gameplay at 1440×900 and 800×600.
Both sets of ten Blender assets passed the mesh gate, with the accepted warnings
listed below. All 151 creature/shop portraits were regenerated.

The seed-4411, 1440×900 terrain benchmark produced:

| Preset | Before calls | After calls | Before triangles | After triangles |
| --- | ---: | ---: | ---: | ---: |
| High | 247 | 232 | 1,662,730 | 1,508,452 |
| Medium | 246 | 230 | 918,430 | 890,020 |
| Low | 118 | 106 | 243,830 | 253,200 |

High-detail triangles decreased about 9%; low-detail triangles increased about
4% while draw calls decreased. SwiftShader median frame intervals were
250/183.5/116.7 ms before and 200.2/150.1/100.1 ms after. These are software-GPU
portability measurements, not native GPU FPS claims. Streaming still has spikes;
the work does not establish a stable 60 FPS target. Raw measurements are in
`artifacts/visual-overhaul/before-benchmark.json` and `final-benchmark.json`.
`scripts/benchmark-art-density.mjs` provides an additional 33-actor scene with
the imported skeletons loaded; its report is `density-benchmark.json`.
That scene rendered 33 models, including 20 imported creatures. High used
1,177 calls and 3,804,050 triangles; low used 483 calls and 1,183,022 triangles.
SwiftShader median intervals were 517.1 ms and 366.9 ms respectively. This dense
case remains expensive and is evidence for further batching/native-GPU testing,
not a performance-completion claim. It produced no runtime errors.

Warnings about internally enclosed eyes/accessories, coincident leaf/branch
vertices on intentionally separate closed parts, planar cap n-gons, overlapping
UVs on the vertex-painted botanical library and corrected import ground offsets
are reviewed limitations. The stegosaur retains 16 hidden back-to-back plate
face pairs from its source; they are a small geometry cost, not visible
z-fighting. Export triangulates caps; no texture baking relies on stacked UVs.
Automated mesh checks cannot establish anatomical accuracy or animation appeal.

## Rollback and remaining scope

Original Blender sources and GLBs in `assets/models` and
`public/assets/models` are untouched. Previous procedural code is retained in
Git; the new pipeline uses separate versioned directories. No save migration
or gameplay rebalance is required.

The remaining work is individual sculpt/animation art direction for the 92
procedural forms, dedicated damage/roar/drink/death/transformation clips, and
individual replacements for forage models, aquatic fish, caves, ruins,
sanctuary decorations and ground/atmosphere assets. The inventory distinguishes
these from the integrated batch. This work does not establish the full master
prompt's premium-quality completion target or 60 FPS on gaming hardware.
The model-only pass did not rebuild the portable EXE. The subsequent presentation
pass rebuilt it, including these model assets, at
`release/presentation-overhaul/Jurassic Domination-0.8.0-portable.exe` and passed
six portable checks, including restart persistence. See
[PRESENTATION_OVERHAUL.md](PRESENTATION_OVERHAUL.md) for the complete later result.
