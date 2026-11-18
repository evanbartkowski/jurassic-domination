# Creature detail pass

The 108 production models in `public/assets/models-v5` now share a fine-detail
pipeline while retaining their species profiles, skeletons and eight clips.
Editable Blender sources and per-model mesh reports remain in
`assets/art-v5/creatures`.

## What changed

- Secondary skull planes: recessed orbits, temporal hollows, maxillary shelves,
  nasal depressions, eyelid rims, ear openings and small cheek scales.
- Neck and shoulder skin folds follow the local neck direction. Body scales and
  feather coverts attach to the actual sculpted surface through BVH projection.
- Feathered forms have individual closed, cambered vanes with raised shafts,
  varied tips, overlapping scapular layers and nape coverts.
- Large terrestrial predators have distinct skull profiles, heavier brow
  shelves, healed facial scars, varied tooth lengths and slightly open resting
  mandibles. Teeth anchor to their own jaw before articulation.
- Baked albedo, normal and roughness maps carry scale beds, pores, creases,
  countershading and pigment variation. Large predators and horned species use
  2048-pixel albedo/normal maps; the remaining roster uses 1024-pixel maps.
- Production materials use the authored normal maps without an extra generic
  bump overlay. Actors still share cached geometry and textures, with two LODs
  and one atlas material per creature.
- The encyclopedia supports wheel/button zoom and a Face Detail view fitted to
  the animated skull and mandible. Drag to rotate, use +/- to zoom, F for the
  face and 0 to reset; controls wrap on narrow screens.

## Rebuild and inspect

Use Blender 5.3 to run `scripts/blender/reference_creatures.py`, optionally
passing species IDs after `--`. Fine geometry is authored in
`reference_detail.py`, profile proportions in `reference_forms.py`, and baked
surfaces in `reference_materials.py`.

`scripts/blender/review_fine_roster.py` runs the installed asset QA skill's
material and wireframe review for the native sources. Its diagnostic wire width
is reduced so fine organic geometry remains readable.

`node scripts/qa-creature-detail.mjs after --all` loads the actual production
assets, creates full-roster contact sheets, and checks selected creatures in the
game's WorldRenderer. `node scripts/render-portraits.mjs` refreshes the game's
collection and HUD portraits after a rebuild.

`node scripts/audit-creature-detail.mjs` records mesh counts, atlas metadata,
animation counts and accepted warnings in
`artifacts/creature-detail/asset-audit.json`.

## Accepted mesh warnings

Small numbers of buried back-to-back attachment faces and coincident positions
at separately closed eyelid/feather seams are retained. These preserve closed
accessory volumes and independent UV/deformation boundaries. Exposed z-fighting,
detached parts, non-manifold edges, open boundaries and invalid weights fail the
gate. The audit lists each retained warning and its reason.

Browser QA uses software WebGL. Its render counters and successful loading are
not measurements of frame rate on a physical gaming GPU.
