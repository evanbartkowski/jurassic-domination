# Vibrant color pass

The color layer uses coral health, cyan stamina, lime nourishment, violet
evolution XP, blue account XP and warm gold DNA/objectives. Resource names,
numeric values and accessible progressbar labels remain present. Critical
health adds a brighter outline without changing the stamina color. Menus use
cool dark panels, teal actions and brighter rarity accents.

`src/vibrant.css` is the final semantic color layer after the existing themes.
It overrides the old dark blood-red/olive vital fills while preserving layout,
disabled gates and control bindings. Hidden overlays explicitly honor `hidden`.

`src/creature-palettes.js` defines natural colors and contrasting markings for
all 108 creatures. Named species have authored palettes; remaining forms use
stable family palettes. The same data feeds the procedural fallback and the
loaded Blender models. Individual pigment genes and special molten event
appearances retain their own presentation.

Natural pigment uses the existing skin material pipeline with independent
blend strength, marking strength and spatial scale. Authored albedo relief,
normal/roughness maps, teeth, eye detail and pale countershading are retained.
Runtime material clones leave the cached source atlases unchanged. Materials
share shader programs by pattern, with separate color uniforms per actor.
Collectible skins retain their own patterns and finishes.

Biome ground, water and fog palettes are richer. Foliage gets a modest local
chroma increase, and the daylight fill uses a cooler sky color to reduce its
yellow cast. There is no whole-screen saturation filter. Weather, night,
terrain geometry, enemy behavior, growth and combat stats use their existing
rules.

Validation: `npm test`, `node scripts/qa-colors.mjs after`,
`node scripts/qa-creature-detail.mjs colors-after --all --roster-only`,
`node scripts/render-portraits.mjs`, `npm run build`, and
`node scripts/desktop-qa.mjs`. Gameplay comparisons, low-health, narrow-screen,
night and high-contrast captures are in `artifacts/colors`; the full creature
review is in `artifacts/creature-detail/colors-after`. Browser QA uses software
WebGL and does not establish physical GPU frame rates.
