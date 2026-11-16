# Asset provenance

Jurassic Domination bundles its runtime assets locally. It does not stream music,
download models, or contact a game server while playing.

| Asset | Source and implementation | Notes |
| --- | --- | --- |
| Archived title illustration, `public/assets/title-art.png` | Generated with OpenAI's built-in image generation tool for the original release | Retained for provenance; 0.2's active title uses a live procedural 3D scene. Preserve the original prompt and review applicable tool terms before commercial release. |
| Dinosaurs and mythical creature meshes | Original rebuilt Blender surfaces in `assets/art-v4/creatures/`; builders in `scripts/blender/primeval_*.py`; runtime `public/assets/models-v4/` | 108 skinned creatures, six clips each, two LODs, one UV-baked PBR material per mesh. Earlier v2/v3 source and releases are preserved. No ripped game meshes. |
| Terrain, vegetation, props, particles, and lighting | Original Blender botany and Three.js scene geometry; locally bundled Poly Haven CC0 surface and branch/leaf textures | Forty botanical LOD meshes; soil, rock, bark, fir and broadleaf PBR textures. Named sites and collision remain intact. [Exact sources and hashes](../assets/art-v4/surface-provenance.json). |
| Sanctuary, wearables, decoration models and product previews | Original Three.js geometry and shared Blender nature assets in `src/collection-art.js` and `src/island.js` | Pets reuse the original creature models. No external asset pack. |
| Soundtrack | Nine new user-supplied recordings copied unchanged from `sounds/` to `public/sounds/music/`, plus synthesized fallback and existing ambience | `src/music-director.js` selects menu, exploration, combat and death playlists. `src/music-levels.json` contains measured RMS gain trims; original recordings are unchanged. |
| Combat, movement, creature, and UI effects | Web Audio synthesis plus existing MP3 files in `public/sounds/` | Oscillator/noise design and bundled recordings are both active. New player-polish UI cues use synthesis. |
| UI graphics | Original HTML, CSS, and inline vector marks | No emoji-based game artwork. |

Any locally bundled fonts must retain their upstream font license and attribution
alongside the font files. System fonts remain installed operating-system fonts
and are not redistributed by this project.

The checkout contains 66 existing MP3 files under `public/sounds/`; recording
license/provenance documents were not found alongside them. Filenames are not
proof of authorship or distribution rights. These recordings were retained in
the player-polish pass, and no new downloaded or paid audio was added. Completing
the recording provenance record remains work before public distribution. The nine
additional recordings in v0.10.0 were supplied by the user; their filenames and
decoded metadata are recorded in `artifacts/grimwild/music-analysis.json`. No
third-party authorship or license has been inferred from a filename.

Shop and discovered-creature portraits in `public/assets/portraits/` are offline
WebP renders of the original game meshes. Regenerate them with `npm run art:portraits`
while the local Vite server is running. Wilderness meshes and animations are
original procedural work in `src/wilderness-art.js`.

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

## Primeval texture sources

Poly Haven distributes these textures under [CC0](https://polyhaven.com/license). This build uses forest_floor, rock_face, bark_brown_02, the fir_sapling_medium twig atlas, and the jacaranda_tree leaf atlas. Only locally processed texture maps are shipped; the source tree meshes are not used. Original tree card geometry, trunk layout, UV placement and LODs are authored in Blender. Download URLs, byte counts, hashes and transformations are recorded in `assets/art-v4/surface-provenance.json`. See [the visual overhaul report](PRIMEVAL_VISUAL_OVERHAUL.md) for QA and accepted warnings.
