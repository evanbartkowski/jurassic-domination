# Asset provenance

Jurassic Domination bundles its runtime assets locally. It does not stream music,
download models, or contact a game server while playing.

| Asset | Source and implementation | Notes |
| --- | --- | --- |
| Title illustration, `public/assets/title-art.png` | Generated with OpenAI's built-in image generation tool for this project | AI-generated artwork; preserve the generation prompt with project records and review the applicable tool terms before commercial release. |
| Dinosaurs and mythical creature meshes | Original procedural geometry authored in the renderer | No externally downloaded creature models or animations. |
| Terrain, vegetation, props, particles, and lighting | Procedural Three.js scene generation | No external environment asset pack. |
| Soundtrack | Original Web Audio synthesis in `src/audio.js` | Adaptive D-minor phrases, ambient textures, percussion, and melodic layers generated at runtime. No sampled commercial recording. |
| Combat, movement, creature, and UI effects | Original Web Audio synthesis in `src/audio.js` | Generated oscillator and filtered-noise sound design. |
| UI graphics | Original HTML, CSS, and inline vector marks | No emoji-based game artwork. |

Any locally bundled fonts must retain their upstream font license and attribution
alongside the font files. System fonts remain installed operating-system fonts
and are not redistributed by this project.

## Dependencies

The exact dependency versions are locked in `package-lock.json`. Third-party
licenses apply separately from the game's all-rights-reserved license.

- **Three.js:** MIT license. Preserve its copyright and license notice.
- **Electron:** MIT license for Electron itself; its runtime includes Chromium,
  Node.js, and other components with additional notices.
- **Vite:** MIT license. Used for source development and bundling.
- **electron-builder:** MIT license. Used for desktop packaging.
- **Automated test tooling:** Follow the corresponding package's license; it is
  development tooling unless included in an artifact.

Retain the `LICENSE` and `LICENSES.chromium.html` notices that accompany the
packaged Electron runtime. Review the actual packaged dependency inventory and
any additional assets before commercial distribution. Do not remove notices to
reduce package size.

Generated artwork is not a representation of final gameplay graphics. Store
screenshots and trailers should show the running game accurately.
