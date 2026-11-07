# Jurassic Domination

A single-player prehistoric survival roguelite. Crack your egg, hatch into a fragile starter species, hunt and forage across a living, weather-swept continent, and evolve into apex predators and mythological titans. Death ends the run; rare DNA and discovered bloodlines fund your permanent collection and next generation.

This is a polished, offline, playable desktop game built with Three.js and Electron. It features original procedural 3D creatures and environments, an authentic 66-sound audio landscape, dynamic weather and diurnal cycles, sensory perception ecology, deep combat with status effects, persistent multi-generational ancestry, and complete controller and keyboard/mouse support.

![Jurassic Domination Title Screen](docs/screenshots/title.png)

![Actual 3D Gameplay with Survival HUD and Atmospheric Lighting](docs/screenshots/gameplay.png)

![Searchable Live 3D Dinosaur Encyclopedia](docs/screenshots/encyclopedia.png)

---

## Quick Start (Windows)

### Double-Click Launch
In this workspace or downloaded release folder, simply double-click:
```text
Play Jurassic Domination.cmd
```
This automatically verifies dependencies and launches the full game in desktop mode.

### Packaged & Portable Releases
- **Standalone Unpacked**: Launch `release/win-unpacked/Jurassic Domination.exe`. Keep that entire folder intact.
- **Single-File Portable**: Run `release/Jurassic Domination-0.8.0-portable.exe` directly without installation.

### Run from Source
Requires Node.js 24 LTS or newer:
```powershell
npm ci
npm run build
npm run desktop
```

For browser development with hot module reloading:
```powershell
npm run dev
```
Open the local address printed by Vite (typically `http://localhost:5173`). Launching `index.html` directly from file paths is not supported because WebGL 2, audio context, and shaders require an HTTP origin.

---

## Controls

| Action | Keyboard / Mouse | Gamepad |
| :--- | :--- | :--- |
| **Move** | `W`, `A`, `S`, `D` or Arrow Keys | Left Analog Stick |
| **Aim** | Mouse Cursor | Right Analog Stick |
| **Bite / Primary Attack** | Left Mouse Button or `Space` | Right Trigger (`RT`) |
| **Primal Roar** | `C` or Middle Mouse Click | Right Stick Click |
| **Species Ability** | `Q` | Right Bumper (`RB`) |
| **Species Technique** | `R` | Left Bumper (`LB`) |
| **Anatomy Skill** (when available) | `X` | `Y` Button |
| **Stalk / Sneak / Dive** | Hold `H` | Left Trigger (`LT`) |
| **Dodge / Dash** (agile forms) | `Shift` | `A` Button |
| **Eat / Forage / Collect** | `E` | `X` Button |
| **Evolution Menu / Postpone** | `T` / `Escape` | `B` Button |
| **Field Journal & Ancestry** | `L` | D-Pad Down |
| **Bloodline Conditions** | `J` | D-Pad Up |
| **Continental World Map** | `M` | View / Select Button |
| **3D Dinosaur Encyclopedia** | `Tab` | D-Pad Right |
| **Sprint** | Hold `Ctrl` | Left Stick Click |
| **Pause / Back** | `Escape` | Menu / Start Button |
| **Toggle Fullscreen** | `F11` (or in Settings) | — |
| **Ancient Relic Skills** | `F`, `G`, `C`, `V`, `B`, `N` | — |

> [!TIP]
> **Fully Remappable:** Customize all gameplay keybindings in **Settings → Customize Controls**. Conflicting keys swap automatically. Standard Xbox and PlayStation controllers are supported natively with deadzone filtering.

---

## Survive, Evolve, Ascend

- **Begin as an Egg**: Hatch into a randomly selected starter species. Hunt vulnerable prey, scavenge carrion, forage edible flora, and avoid deadly predators.
- **Dynamic Growth**: Consuming food matures your body in real time—increasing your scale by up to 28%, maximum health by 40%, and bite damage by 32%.
- **Branching Evolution**: Reaching XP thresholds unlocks the evolution choice. Choose from over **102 distinct species** across 8 evolutionary tiers—from agile raptors and armored sauropods to titanic apex carnivores and mythical beasts (Wyrms, Phoenixes, and Dragons).
- **Conditional Bloodlines**: Complete rare secret challenges during a single life (e.g., consuming sacred Sunheart/Moondrop fruits or felling territorial guardians) to unlock hidden legendary bloodlines like the *Verdant Iguanodon*, *Cinderfang Carnotaurus*, and *Stormcrown Dragon*.
- **Permadeath with Permanent Lineage**: Death ends the current run, but rare genetic traits, discovered species, and banked DNA pass into your permanent profile to fund sanctuary island upgrades, companion pets, and cosmetic appearances.

---

## Major Game Systems & Enhancements

### 1. Cinematic Prehistoric Visuals
- **Art Direction**: Natural prehistoric earth tones, warm ambient rim lighting, and atmospheric depth replace flat styling.
- **Crafted UI**: Carved ancient slate modal backgrounds, an aged brass compass bezel with directional markings, and sculpted organic health and stamina frames.
- **Living Nature**: Trees and foliage canopies sway naturally in the wind via custom GPU vertex shaders. Ambient spores drift through ancient redwood forests, and dynamic water foam borders coastal shorelines.
- **Articulated Creature Animations**: Dinosaurs feature breathing chest movement, head-turning idle scans, feeding gestures, scampering gaits, and reactive flinches.

### 2. Dynamic Weather & Diurnal Cycle
- **8 Atmospheric Cycles**: Seamless transitions between **Dawn**, **Sunny Midday**, **Overcast Afternoon**, **Dusk**, **Starry Night**, **Dense Fog**, **Rain**, and **Violent Storm**.
- **Environmental Impact**: Fog reduces visibility for both you and wildlife; rain dampens scent trails and creates puddle ripples; storms unleash screen-illuminating lightning flashes and rumbling thunder.
- **Day & Night Ecology**: Nocturnal predators grow bolder and more aggressive under moonlight, while day grazers rest near protective herds.

### 3. Sensory Perception & Hunting Ecology
- **Vision Cones**: Predators possess focused forward sight cones (~160°), whereas herbivores and grazers feature wide peripheral vision (~270°) to detect flanking threats.
- **Olfactory Senses (Scent Trails)**: Carnivores track prey scent plumes across distances. Stalking (`Hold H`) lowers your body posture, suppresses footstep noise, and hides your scent profile for stealth ambush attacks.
- **Parental Defense & Juvenile Life Cycles**: Eggs in the wild hatch into authentic baby and juvenile dinosaurs (scaled head proportions, curiosity head tilts, and rapid scamper gaits). Parents aggressively defend their nests against egg thieves.

### 4. Primal Roar Ability (`Key C` / Middle Click)
- Unleash a thunderous primal vocalization tuned specifically to your creature's anatomy.
- Triggers camera screen-shake and visual acoustic shockwaves.
- **Ecological Impact**: Smaller and skittish prey panic and flee; equal or apex predators are challenged and provoked into aggressive combat.

### 5. Combat Overhaul & Status Effects
- **Tactical Real-Time Combat**: Swept collision circles prevent attacks or lunges from clipping through solid trees or boulders.
- **Elemental Status Effects**:
  - **Bleed**: Inflicts damage over time that intensifies drastically whenever the victim moves. Rendered with dripping blood particles.
  - **Poison**: Armor-piercing venom that saps vitality continuously. Rendered with buoyant green toxin bubbles.
  - **Burn / Fire**: Rapid blaze damage over time. Accompanied by rising flame embers.
  - **Sleep**: Pacifies the target into a vulnerable sleeping state (drooped posture and floating Zzz particles) until woken by a direct strike.
  - **Freeze**: Imparts severe movement speed and turning penalties, sparkling with frost crystals.
  - **Knockback**: Radial impact force that flings targets backward, leaving dust rings.
- **Killable Marine Predators**: Deep coastal waters now harbor deadly aquatic carnivores (such as *Abyssal Kronosaur* and *Tideweaver*). Swim out to duel them with full swept-hitbox combat to harvest rare ocean sustenance.
- **Colossal Apex Evolutions**: Late-stage evolutionary titans (Tier 6–8) possess colossal scales, immense attack radii, earth-shaking footsteps, and screen-clearing cleaves.

### 6. Authentic 66-Sound Audio Engine
- Rich procedural soundscape featuring authentic dinosaur roars, deep Tyrannosaur rumbles, raptor calls, pterosaur shrieks, and sea beast calls.
- Dynamic environmental audio: rustling foliage, ambient birdsong, ocean waves, cracking thunder, and tactile footsteps on stone, gravel, and mud.

### 7. Dinosaur Sanctuary & Island Builder
- Visit your private off-shore sanctuary island in full 3D.
- Place, rotate, and customize up to 80 decorations and house up to 16 companion pets.
- Feed, bond with, and care for companion animals to earn rare cosmetic crowns, wreaths, and monument recipes.

### 8. Enhanced Realism & World Systems
- **Top Center HUD & Bloodthirsty Starvation Vignette**: Vitality and Stamina meters are prominently positioned at the top-center of the screen. The conventional hunger bar is replaced with an immersive, full-screen peripheral red vignette that pulses and deepens as your dinosaur hungers. Low hunger triggers a flashing warning banner (*"STARVING · HUNT FOR FLESH"*); prolonged starvation slows your creature and leads to death.
- **Organic World Presentation**: Geometric circles underneath player and wild dinosaurs have been removed for natural visual immersion.
- **3D Skeletal Remains**: Meat drops appear as authentic prehistoric carcasses complete with an articulated spine, bone skull, exposed ribcage arches, and pooled blood.
- **Killable Carnivorous Flora**: Snapjaw pitcher plants can now be bitten and destroyed in combat, wilting upon defeat and rewarding both meat and plant forage.
- **Aerial Flying Predators**: Winged apex predators (such as *Wyverns*, *Phoenixes*, and *Quetzalcoatls*) soar high overhead. Players must utilize ranged attacks or wait for them to swoop down in talon dives before striking them in melee.
- **Terrain Demolition**: Colossal dinosaurs (Tier 6+ or high-speed dashes) smash through fallen logs and crush boulders into rubble upon impact.
- **Volcanic Calderas**: Active volcanoes feature multi-layered boiling magma pools with emissive pulsation, jagged basalt crags, flowing lava rivers, and rising smoke and ember plumes.
- **Caves & Expansive Water Bodies**: Rocky cavern alcoves with glowing subterranean crystals and sprawling lakes and lagoons with deep-water drag and swimming predators.
- **Sleeping Dinosaurs & Stealth Ambush**: Wild creatures can be discovered resting or asleep in the wild. Sneaking or stalking up behind them rewards massive 2.2× sneak critical damage.
- **Unified 3-Tab Prehistoric Compendium**: Bloodline Paths, the Field Journal, and the 3D Dinosaur Encyclopedia are merged into a single sleek, tabbed compendium accessible instantly with `TAB`, `J`, or `L`. The pause menu is decluttered and streamlined.
- **Dynamic Title Scene**: The home screen features wind-blown foliage and leaves drifting across atmospheric prehistoric lighting.
- **Audio Voice Pooling & Throttling**: Sound effects use strict cooldown intervals and element pooling, eliminating sound overlap, echoing, or looping storms.

---

## Save Architecture & Integrity

- **Atomic Two-Slot Journal**: Checkpoints commit atomically every 10 seconds, during pauses, and upon evolution. Stale or interrupted writes automatically recover from the verified alternate slot.
- **Strict Anti-Corruption & Permadeath**: Permadeath receipts prevent outdated local backups from reviving dead runs, while legitimate character progress, unlocked cosmetics, and banked DNA persist permanently.
- **Zero Network Telemetry**: 100% offline-first. No tracking, accounts, ads, or DRM.

---

## Verification & Testing Suite

Jurassic Domination includes a rigorous testing harness:

```powershell
# Run the 204-test deterministic logic and ecology suite:
npm test

# Run the 22 Playwright visual and browser integration checks:
npm run qa

# Run specialized subsystem QA checks:
npm run qa:immersion    # Senses, weather, stalking, field journal, and nests
npm run qa:foundation   # Save-and-resume, atomic journals, and controller mapping
npm run qa:progression  # Evolution paths, growth rates, and bloodline unlocks

# Run multi-run simulation bot balance checks:
npm run simulate -- --runs 8 --seconds 30 --report artifacts/ci-simulation.json

# Compile production bundle:
npm run build

# Package standalone Windows executable:
npm run package
```

---

## Project Structure

```text
jurassic-domination/
├── electron/              # Sandboxed desktop application shell
├── public/
│   ├── assets/            # UI textures, compass bezel, game emblems, and 149 portraits
│   └── sounds/            # 66 authentic dinosaur, creature, weather, and ambient audio files
├── src/
│   ├── main.js            # Engine entry point, input router, and lifecycle
│   ├── game.js            # Core survival rules, combat, and evolutionary progression
│   ├── simulation.js      # Deterministic 60 Hz simulation authority and swept collisions
│   ├── renderer.js        # Three.js 3D world renderer, weather particles, and status FX
│   ├── creatures.js       # Articulated procedural 3D dinosaurs, juveniles, and animations
│   ├── ecosystem.js       # AI ecology, pack behaviors, sight cones, scent, and nests
│   ├── senses.js          # Vision cone optics and olfactory proximity calculations
│   ├── audio.js           # Audio manager, voice budgets, soundscapes, and roar vocalizations
│   ├── terrain.js         # Streamed chunk terrain, foliage shaders, and biomes
│   ├── combat.js          # Attack profiles, status effects, and damage calculators
│   ├── run-state.js       # Checkpoint snapshots, migration, and state verification
│   ├── state-store.js     # Two-slot verified atomic disk persistence
│   ├── controls.js        # Keybinding remapping and gamepad deadzone adapter
│   └── ui.js              # Polished slate UI panels, HUD, and field journal
└── tests/                 # 202 unit tests verifying determinism, balance, and logic
```

---

## License

Copyright © 2026 Evan Bartkowski. All rights reserved.
Code and procedural algorithms are subject to the project license; third-party dependencies adhere to their respective open-source licenses (Three.js, Electron, Vite).
