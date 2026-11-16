# Jurassic Domination creature pipeline

The supplied brief and its original 102-entry catalogs are preserved in
`assets/reference-pack/`. The live game has 108 IDs: those 102 plus six wild aquatic
species. The audit reconciles the catalogs with `SPECIES`; none are removed.

## Sources and exports

- Authoring: `scripts/blender/reference_creatures.py`, `reference_forms.py`, and
  `reference_materials.py`. These extend the existing original procedural authoring
  tools with genus-specific profiles, continuous limb loops, planar stegosaur
  plates, pointed pterosaur beaks, separate feather vanes, and solid marine paddles.
- Native sources: `assets/art-v5/creatures/<id>/<id>.blend`.
- Embedded PBR exports: `public/assets/models-v5/<id>.glb`.
- Per-asset numerical checks: `assets/art-v5/creatures/<id>/report.json`.
- Runtime manifest: `src/reference-assets.json`. Only enabled exact local paths
  are accepted by `src/creature-asset-paths.js`.
- Historical v4 assets remain available for loading failures and comparisons.

Blender 5.3 was executed through its Python CLI. The MCP status check and a real
Python operation both failed to connect; no live Blender session was modified.

## Rig, orientation and animation

Blender authoring uses +X forward, +Z up, metric units. glTF converts Z-up to
Three.js Y-up; the `forwardAxis: X` and `sourceVersion: 5` extras preserve the
runtime convention. The renderer normalizes the length once, then applies game
size, genetics, growth, skins and cosmetics through the existing actor root.

Each source has a deform armature with root, spine, neck, head, hinged jaw, five
tail segments, and anatomy-specific limb/wing/flipper chains. Weights are limited
to four influences. Bloodlines use their base animal's anatomical profile and rig
conventions with differentiated baked pigments. Multiple heads retain independent
head and jaw bones. They are game meshes, not hand-retopologized film sculpts.

The eight real exported NLA clips are `Idle`, `Walk`, `Run`, `Attack`, `Graze`,
`Rest`, `Hit`, and `Death`. Death is deliberately non-looping. The Three.js bridge
crossfades locomotion and plays hit/death once with clamping. The existing game
removes killed wildlife; this update does not add persistent corpses. Winged and
aquatic rigs use their own appendage chains rather than land legs.

## Materials and budgets

One shared atlas material and two skinned LOD meshes per creature. The material
uses baked 1024-square albedo and tangent-space normal maps plus 512-square
roughness; albedo is sRGB, data maps are Non-Color. Texture images are packed in
the native source and embedded in the GLB. Surface relief and pigment are
procedurally authored; reference images are never used as textures.

The audit caps exports at 90,000 LOD0 triangles and 12 MB, with LOD1 below 70% of
LOD0. Most models are substantially below these ceilings; multiheaded and feathered
creatures cost more. The existing distance/quality LOD selection and cache target
of 24 unreferenced source assets remain active. Active instances keep their
resources until disposed. Geometry/textures are shared; skeletons and customized
materials belong to each actor. No claim is made that texture compression or a
hand-authored retopology/IK pass has been completed.

## Reproduce

From the repository root in PowerShell, with Blender 5.3 installed:

```powershell
node scripts/build-reference-creatures.mjs tyrannosaurus
node scripts/build-reference-creatures.mjs
node scripts/audit-reference-creatures.mjs --enable
npm test
npm run build
```

Set `BLENDER_EXE` if Blender is installed elsewhere. The batch runner uses two
hidden subprocesses with six Blender threads each, writes a log per ID and
`artifacts/reference-overhaul/build/progress.json`, and reports geometry failures.
The final audit, rather than process exit alone, decides whether a model can be
enabled. `--enable` refuses a roster with a failed export.

Run the development server before browser checks:

```powershell
node scripts/capture-reference-art.mjs
node scripts/qa-reference-loading.mjs
node scripts/qa-reference-world.mjs before
node scripts/qa-reference-world.mjs after
```

The pose audit renders all 108 creatures in eight poses, checks decoded maps,
finite bone matrices, camera bounds, a single visible LOD, LOD switching, and
cache disposal. The world comparison uses the actual game renderer with the same
seed, camera and time; its before mode deliberately fails v5 requests to exercise
the v4 fallback. Additional integration screenshots and metrics are stored under
`artifacts/reference-overhaul/`. These files are generated evidence and are ignored
by Git. Blender review views can be reproduced with:

```powershell
& $env:BLENDER_EXE -b assets/art-v5/creatures/tyrannosaurus/tyrannosaurus.blend --python-exit-code 1 -P scripts/blender/review_reference_asset.py -- artifacts/reference-overhaul/studio/tyrannosaurus
```

## References, licensing and uncertainty

The catalog's links are anatomical/design references, not redistribution licenses.
Downloaded illustrations stay in ignored `artifacts/reference-overhaul/references/`;
they are never copied to `public/` or packed into exports. Original generated meshes
and textures remain under this repository's existing license. Source attribution,
the selected image URL, fallback attempts and separate review status are recorded
in the coverage audit. A successful HTTP request alone is not image approval:
historical, unrelated or unsuitable results must be rejected during review.

T. rex proportions were compared with the supplied life restoration and the AMNH
specimen page: https://www.amnh.org/exhibitions/permanent/saurischian-dinosaurs/tyrannosaurus-rex
The supplied reference catalog distinguishes dinosaurs, other prehistoric animals,
fantasy animals and bloodlines. Dimetrodon stays a synapsid, pterosaurs have membrane
wings, and marine reptiles have four paddles. Microraptor retains hindwing feathers.

Spinosaurus uses the long-snouted, short-hindlimbed, deep-tailed reconstruction;
its swimming ecology and soft-tissue reconstruction remain disputed. Stygimoloch
retains a recognizable domed/spiked game identity with its possible juvenile
Pachycephalosaurus interpretation documented by the catalog. Troodon is represented
using a feathered troodontid plan. Fantasy creatures are original designs combining
identified real anatomy; cultural depictions establish motif, not scientific anatomy.

Mesh correctness and a complete manifest do not establish commercial art quality.
The review report separates export, reference, rendered-pose and artistic findings.
Fine face/skin detail, animation contact polish, and any remaining source uncertainty
must be judged from the actual images, not a green export log.
