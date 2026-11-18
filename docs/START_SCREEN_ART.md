# Opening screen art and implementation

The opening uses original cinematic dinosaur key art, created with the built-in
image generation tool. It replaces the overlapping low-detail egg/pedestal shot.

Source: `assets/key-art/start-keyart.png`.
Runtime asset: `public/assets/ui/start-keyart.webp` (quality 92, about 374 KB).
The original generated file remains in the Codex generated-images folder.

The runtime is a dedicated two-triangle art scene with a small bounded mist
overlay and slow drift. It preserves the painted appearance without tone
mapping it a second time. Portrait cropping favors the dinosaur; ultrawide
cropping preserves the skull's upper silhouette. The title and controls remain
real HTML. Keyboard entry, visible focus, reduced motion, local file loading,
and resize behavior are retained. The independent startup recovery screen uses
the same art while modules load.

`startVista.uniforms.diagnostic` supports 0 (final), 1 (UV crop), and 2 (art
without the mist overlay). Time 0 and reduced motion provide fixed captures.
The shot has no game simulation, skinned mesh, shadow pass or offscreen render
target. The illustration is title art, separate from the playable 3D assets.

Validation captures live in `artifacts/start-screen/after` for 1440×900,
2560×1080 and 390×844. `scripts/qa-start.mjs` checks all three layouts, keyboard
entry and reduced motion. Native Electron QA also captures the opening from
local packaged-build files using an isolated temporary profile.

## Exact generation prompt

Create original premium dinosaur survival game key art for Jurassic Domination's initial boot screen. A very wide 16:9 cinematic composition, high resolution, high production quality, sophisticated naturalistic digital painting with realistic fine detail, no text, no logo, no border, no user interface. A terrifying adult Tyrannosaurus rex occupies the RIGHT HALF of the frame, head in the upper right third, jaws slightly open showing uneven sharp teeth, a focused amber eye, anatomically defined powerful neck, heavy orbital brows, fine pebbled scales, subtle healed facial scars, wet skin catching warm amber rim light. It stands partly concealed in a prehistoric rainforest; convincing dinosaur anatomy and substantial weight. The LEFT 40 PERCENT is quieter deep shadow forest and atmospheric dark teal negative space, reserved for a separately rendered title; do not put a dinosaur or a bright distracting object there. Layered giant fern leaves and roots in the foreground, enormous ancient conifer trunks, cool blue-green mist in the middle distance, a faint warm sunrise behind the animal through the canopy, a remote volcanic ridge. Strong depth, rich restrained forest greens, charcoal teal shadows, pale warm shafts of dawn light, restrained golden accents. Unsettling and majestic, immersive and tactile, like high quality painted cover art for a serious survival game. Crisp individual facial features on the main dinosaur, soft atmospheric background, balanced highlights, dark readable left side. Keep the entire head and teeth within the right side safe area with generous space above the skull. No people, no buildings, no glowing fantasy runes, no egg pedestal, no exaggerated cartoon toy proportions, no plastic surfaces, no watermark.
