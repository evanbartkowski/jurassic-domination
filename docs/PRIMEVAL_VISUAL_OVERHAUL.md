# Primeval - v0.12.0 visual overhaul

The creature roster and nature library now share an earthy natural-history art direction. This pass rebuilds the main animal surfaces and plant geometry, adds UV-based PBR texture sets, and fixes the runtime material overrides that erased imported surface work. It preserves combat, progression, collisions, saves, controls, events, music and the existing menu layout.

## Audit and resulting changes

| Area | Finding | Result |
| --- | --- | --- |
| All 108 creatures, including wild marine animals and mythical forms | Rounded generic anatomy, weak tail profiles, disconnected-looking features and flat pigment | Rebuilt ribcage/pelvis, supported necks, skull planes, orbital recesses, mandibles and muscular limb profiles. Fuller predator tails; monotonic short-tail stations prevent the surface folding through the rump. Raptors, ornithomimids and therizinosaurs use folded forelimbs with distance-based arm weighting. Genus-specific frills, crests, armor, sails, horns, wings and fins remain recognizable. |
| Creature surfaces | Runtime material clones discarded authored detail | One UV-baked material per mesh with 1024px albedo, 512px tangent normal and 512px roughness maps. Natural countershading, dorsal markings, scale relief and muted family palettes. Genetic and shop recoloring retain the maps. |
| Rigs and animation | Stiff motion; secondary jaws shared the central hinge | Six clips per creature: breathing/glancing idle, walk, run, attack, feeding and rest. Locomotion rate follows stride speed; attacks restart on input. Independent head and jaw bones keep multiheaded mouths attached. |
| Trees | Sparse stick-like crowns and poor distant silhouettes | Rebuilt curved trunks and layered crowns using original closed branch cards, packed bark/foliage UVs and locally bundled CC0 leaf textures. Crown silhouettes widen at lower LODs. Alpha testing and front-face rendering limit foliage overdraw. |
| Ground cover, logs and rocks | Angular sparse leaves and repeated polygon balls | Forty Blender meshes across ten families and four LODs. Curved paired fern/cycad leaves, varied branching, weathered logs and asymmetric tapering rock profiles. Shared instanced geometry remains in use. |
| Terrain and mountain barriers | Flat tint; stretched textures; repeated stump silhouettes | Continuous world-coordinate ground UVs with leaf-litter PBR maps. Grounded asymmetric outcrops replace the old barrier spheres; flat ground-mist bands are reduced and night fill retains readable silhouettes; routes and authoritative obstacle radii remain intact. |
| Mythical landmarks | Geometric glowing tree caps and pipe-like fossil ribs | Living jade-veined forest; restrained mineral colors; tapered, flattened ribs, neural spines and angular skull sockets within the giant fossil. Camera clearance is preserved. |
| Sanctuary, forage and collection | Materials and vegetation inconsistent with the world | Shared rebuilt plants and natural surfaces; bevelled crafted props; matte nonmetal materials; sanctuary ground and lighting use the same surface library. |
| Lighting and imports | Strong ambient fill flattened every asset | Preserved source maps, corrected color/data texture spaces, restrained sky irradiance and lower fill lighting in the world and specimen views. Offline assets work through Electron's local file protocol; its connection policy explicitly permits local blob URLs so embedded GLB textures decode correctly. The native check decodes all three embedded PBR images. |
| Streaming and build size | All model generations copied into each build | Two creature LODs, four vegetation LODs, a reference-aware 24-entry cache target for inactive species, and nine active terrain chunks. Fresh builds omit superseded GLBs after verifying all 108 replacements; source files and earlier releases remain on disk. |

## Source and reproducibility

- Creature authoring: `scripts/blender/primeval_forms.py`, `primeval_creatures.py`, `primeval_materials.py`; editable `.blend` files, texture maps and per-LOD QA reports under `assets/art-v4/creatures/`.
- Nature authoring: `scripts/blender/primeval_botany.py`; `assets/art-v4/botany/primeval-botany.blend`, its report and the compact runtime attribute library in `src/botany-meshes-v4.json`.
- Five environment texture families use Poly Haven CC0 sources. Exact download URLs, hashes and processed output sizes are recorded in `assets/art-v4/surface-provenance.json`. No source tree meshes or ripped commercial game assets are used. See [asset provenance](ASSETS.md).
- Before-edit source checkpoint: `artifacts/primeval/before/source-checkpoint.zip`; tracked checkpoint ref `refs/codex/checkpoints/pre-primeval-20261115`.

The builders use Blender's bundled Python and the installed `blender-asset-qa` helper. Adjust the helper path in the authoring scripts when rebuilding on another workstation.

Run Blender 5.3 headlessly with `scripts/blender/primeval_creatures.py` (optional species IDs after `--`) and `scripts/blender/primeval_botany.py`. Run `scripts/source-primeval-surfaces.mjs` to reproduce the local texture processing from the recorded CC0 sources.

## Review and validation

The [before/after gallery](../artifacts/primeval/review.html) contains actual browser-engine captures, all 108 creatures in six animation states, landmark views, and day/dusk/night camera comparisons. Inspection overviews use a wider camera and less fog; normal gameplay views are identified separately. The [verification summary](../artifacts/primeval/verification-summary.json) records current test counts, asset budgets, import checks and packaged executable hash.

Mesh QA checks both creature LODs independently for open edges, winding, degeneracy, floating pieces, z-fighting, UV bounds and skin weights. Botanical source meshes are closed; shared/tiled UVs are intentional, so UV-overlap rejection is disabled for that library while finite UVs and usable spans are checked separately. Small duplicate vertices at leaf attachment roots and 2.7 cm fern rooting offsets are accepted botanical warnings; there are no accepted mesh errors. A small number of buried opposing tooth/attachment faces are retained to keep the intersecting anatomical parts closed; these are recorded optimization warnings, not visible overlapping skin. Rest alternatives are not checked together for z-fighting because only one LOD is rendered at a time. The final inventory preserves every warning rather than discarding it.

Blender material and wireframe views were reviewed alongside actual imported models. The browser pose sweep checks all six clips, finite skeleton matrices, visible framing, loaded PBR maps, a single active LOD and switching to the distant mesh. Additional checks exercise the actual WorldRenderer at three times of day and three distances, cosmetics against the animated skull, menu navigation, gameplay controls, saving, reloading and the packaged portable executable.

## Practical limits

This is original stylized art with systematic anatomy and surface work. It is not a set of photorealistic scans or a commissioned studio character library. Procedural family rigs still share motion patterns; bespoke muscle simulation and individually hand-keyed performances remain outside this pass. Numerical checks do not by themselves certify artistic quality.

Browser captures use SwiftShader to reproduce WebGL behavior consistently. Draw calls, triangles, loaded textures and streaming bounds are recorded; these runs do not establish frame rate on a physical gaming GPU. Dense forests still warrant profiling on the intended minimum hardware. Native tests use isolated temporary profiles; the user's existing saves and previous releases are retained. No public deployment or store release is performed.

## Quality and streaming measurements

The fixed-seed renderer benchmark passed at all three quality settings. In its measured scene, high submitted 2,533,912 triangles in 171 draws, medium 1,613,940 triangles in 171 draws, and low 449,750 triangles in 80 draws. Terrain stayed within nine chunks, all queued chunks settled, and resident geometry returned from 160 to 169 entries after streaming away and back (within the bounded-cache check). These are scene workload counters, not hardware FPS. Exact timings and scenarios are retained in `artifacts/primeval/render-benchmark.json`.
