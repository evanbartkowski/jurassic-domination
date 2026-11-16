# Primeval visual direction

This pass rebuilds the v0.11 asset presentation around sculpted natural-history stylization. Gameplay, saves, controls, collision and progression remain authoritative.

## Audit findings

| Asset family | Baseline weakness | Replacement direction |
|---|---|---|
| 108 creatures | Soft undifferentiated skulls, tube limbs, overly bright teeth, coarse flat pigment; imported maps overwritten at runtime | Anatomical planes, muscular leg profiles, orbital recesses, defined jaws, species structures and UV-baked albedo/normal/roughness |
| Trees | Thin poles and sparse tiny leaves; distant LODs look skeletal | Structured trunks, layered full crowns and broad leaf clusters, with controlled silhouettes at every LOD |
| Ferns, cycads, reeds, shrubs | Angular sparse fronds, inconsistent scale and density | Curved growth, fuller paired leaves, muted green transitions and readable ground cover |
| Ground | Nearly uniform tint and weak material separation | Soil, rock and living cover with coherent world-space material blending and continuous paths |
| Mountain barriers and props | Repeated polygon balls and isolated spikes | Grounded, weathered outcrops with stratification and connected silhouettes |
| Mythical sites | Bright geometric tree caps and unconvincing fossil walls | Jade-veined living forest, clustered mineral formations and weathered bone within natural stone |
| Collection and sanctuary assets | Mixed material conventions and primitive vegetation | Shared nature assets, stone/wood/keratin material rules and consistent lighting |
| Engine presentation | Material overrides erase source work; heavy diffuse lighting flattens forms | Preserve authored PBR maps, measured lighting, material separation and stable image-based illumination |

## Visual contract

- Recognize each dinosaur by its silhouette at gameplay distance, including genus-defining horns, frills, sails, plates, necks and feathered limbs.
- Read ribcage, pelvis, shoulders, weight-bearing knees, ankles and skull planes as a coherent animal. Do not accept a smooth blob merely because its topology passes.
- Use related olive, slate, umber, ochre and bone colors. Reserve emission for physically meaningful heat and restrained fantasy accents.
- Keep roughness varied and metallic zero for skin, wood, stone and vegetation. Keep data textures linear and color maps sRGB.
- Use UV-painted markings and tangent-space scale relief. Preserve those maps through glTF and runtime cloning.
- Review rest, locomotion, attack, feeding and sleeping; check joint volume, mouth hinge, planted feet and stable loops.
- Evaluate assets at near, normal and far distances under day, dusk and night lighting. Review material, silhouette and wireframe views separately.
- Bound active chunks, material draws, texture resolution and geometry. Prefer fewer materials and meaningful LODs over indiscriminate subdivision.
- Keep no-post views and fixed seed/camera comparisons. Software browser timing is a portability check, not physical GPU performance evidence.

## Working acceptance process

The artist chooses the representative target within the user's delegated scope, then produces related families. A passing mesh checker is necessary but insufficient. Every batch must have source files, UVs, textures, animation/export checks and actual engine captures. Weak batches return to modeling before further detail is added.

Creature geometry, markings and baked maps are original Blender work. Environment geometry is original; five texture families use locally bundled Poly Haven CC0 surfaces and leaf/branch atlases, with exact provenance recorded alongside the source. Reference research establishes anatomy and shape language; it does not supply ripped game assets. Earlier source and release folders remain available.
