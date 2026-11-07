# Living generations - v0.8.0

- Deterministic inherited genes give creatures small individual size, appearance, movement, endurance and resistance tradeoffs. Completed lives leave permanent ancestry records without accumulating unchecked power.
- Nests, eggs, inherited juveniles, protective parents, population replacement and pack roles interact with sight, noise, scent, wind, cover and real tracking trails. Hold H to stalk or dive with aquatic anatomy.
- Regional weather changes movement, forage and hunting. Fires, eruptions and meteors warn before damaging fixed areas; aftermath survives saves. Recoverable fatigue, strain and temperature exposure add survival decisions.
- Ten guaranteed lore sites, saved map fog and a larger field journal (L, title or pause) connect exploration to two earned marine branches: Tideweaver Plesiosaur and Abyssal Kronosaur. Both have native animated anatomy and actual model portraits, bringing the roster to 102.
- Snapshot v2 migrates v1 lives with neutral genes and a fair new weather window; old health, growth, offers and RNG are retained. Ancestry survives older backup imports.
- Local analytics distinguish actual deaths from time-limited simulations, track picks, tiers, discoveries, boss encounters and CPU population bands, and send no telemetry.

Offline single player. Eight evolution tiers, fourteen regions and the existing world size remain. Full vertical ocean/flight/burrowing, general migrations, environmental puzzles and multiplayer are future work; the private authoritative co-op plan is in IMMERSION_SYSTEMS.md.

# Foundations - v0.7.0

- Active lives now save and resume with deterministic random state, streamed world data, marine positions, growth, cooldowns and the same evolution offers. Resume opens paused; death remains permanent.
- Two verified checkpoint slots commit profile/settings/run together. Recovery, terminal-run records, duplicate reward prevention and legacy migration are covered by fault tests. Settings provides downloadable backups, reviewed import and emergency export from memory.
- Gameplay uses fixed 60 Hz validated intents with sequence checks, replay history and interest-filtered snapshots. This is implemented offline architecture, not online multiplayer.
- Added remappable keyboard controls, standard-controller gameplay adapters, adjustable UI size and reduced motion.
- Physical cover blocks bites and directional attacks. Swept projectiles and lunges stop at solids and detect crossed targets. Radial magic keeps explicit area behavior.
- Fixed magnet food models, stale marine pool state after paused streaming, restored evolution remaining paused, failed-save state loss and retry floods.
- Terrain streams center-first with at most one new chunk per frame. Medium/Low shared geometry reduces measured triangles approximately 46%/80%; synchronous construction/shader spikes still exist.
- The current roster/map remain 100 forms, eight tiers and radius 1,600. Large new content, endgame boss arc and actual networking are future milestones; see OVERHAUL_STATUS.md.

Validation: 135 automated tests, 22 general browser checks, 14 foundation browser checks, 14 offline Electron checks, six actual portable checks and 100 seeded 60-second intent-driven runs passed. The Windows build was tested across native restart and a fresh portable extraction using isolated save data.

# Ancestral Paths - v0.5.0

- Evolution no longer opens automatically. A flashing T indicator appears; open or postpone the same choices without rerolling.
- Meals mature player and wild creatures within a species, changing size, health and damage. Wild creatures forage and consume actual meals; newborns start fresh.
- Dash availability follows anatomy. X skills add independent extra attacks, defense, healing, cleansing, buffs and an aimed travelling bolt.
- Seven rare conditional forms bring the roster to 100. Fruit, caldera kills, guardian victories, parent forms and survival milestones unlock one-use bloodline chains during each life.
- Regular offers dominate. Rare, Epic and Legendary choices display explicit rarity labels. J opens a live condition journal; progress resets on death.
- Expanded original adaptive background music and creature/size-dependent calls, footsteps and attack effects. Independent audio settings remain.

# Wild & Alive ? v0.4.0

- Actual model portraits replace generic shop symbols. Improved crown detail, smoother prop geometry and matching discovered-species portraits.
- Redesigned title typography and action panel. Island scenery adds coastal foliage, distant islets and animated water.
- Island defaults to visiting; explicit build-mode button enables editing. Pets wander, avoid objects, graze, rest and respond to feeding.
- Persistent pet bonds and two conditional, once-only sanctuary treasure challenges. Build undo preserves bonds and claimed rewards.
- Lower dinosaur density, sharper attacks, different species reach and body animations. Warning circles are removed. Travelling ranged enemy attacks can be avoided.
- Carnotaurus breathes fire; Spinosaurus channels electricity. Existing creature and myth skills remain.
- Seeded blocking rocks/logs, ruins, poison blooms, toxic mushrooms, snapping plants, calderas and dangerous water. Marine predators visibly converge and bite within range.
- Previous saves retain progression, collections and island layouts. Hunted species now count as discovered.

# Sanctuary Collection ? v0.3.0

- Rare DNA replaces automatic death payouts. Selected achievements pay once, map specimens and guardian drops provide small rare rewards, and finds save immediately.
- DNA shop: 49 items, rarity filters and animated 3D previews. Seven skins, seven wearable cosmetics, 18 dinosaur/mythical pets and 17 decorations.
- Permanent companion eggs, decoration caches and cosmetic caches can be discovered in the wilderness. Duplicate unique finds convert to one DNA.
- Equip a crown, wreath, explorer hat or halo. Bring an immortal cosmetic pet companion on expeditions.
- Own a tropical dinosaur sanctuary. Name it, place wandering pets, decorate, move, rotate, store, toggle a grid, undo and redo edits. Owned items survive death.
- Existing profiles retain DNA, upgrades, discoveries, skins and records. Old claimed achievements cannot pay twice.

# Jurassic Domination 0.2.0 — The Living Continent

An expanded offline Windows survival roguelite. Existing DNA, upgrades, records and discovered forms are preserved.

- The map is 100 times larger by area, with 14 named regions, streamed terrain, local/world maps and clickable navigation waypoints.
- Food and enemy spawns remain regional. High-tier forms get very little evolution energy or nourishment from weak starter-region food.
- Start as an egg and hatch into one of 11 randomized beginner species.
- Discover 93 creatures across eight tiers, including 24 mythological forms: unicorns, pegasus, gryphons, hydras, dragons, leviathans, world serpents and more.
- Rebuilt smooth textured models, articulated limbs, continuous tapered tails, serpentine motion, new skull shapes, armor, sails, horns and wings. Movement accelerates, brakes and turns smoothly.
- Choose from three next forms and three mutations at each evolution. Eight stackable mutation types change your build; the final tier continues through increasingly difficult ascensions.
- Each form has a Q signature ability, R technique and innate adaptation, drawing on 14 ability types and 12 techniques. Hold Ctrl to sprint.
- Uneaten world eggs hatch into juvenile creatures and grow into adults.
- Six rare plants grant timed damage, speed, magnet, auto-eat, shield and regeneration effects.
- Rare relics grant six different usable skills for the current life, including meteors, time slowing, blink, soul drain, lightning and rebirth. Use their displayed F/G/C/V/B/N keys.
- Extremely rare fossils unlock seven equipable skins and four permanent modifiers. Unlocks save immediately and persist through death.
- Neutral, fleeing, territorial, ambush and pack behaviours replace uniform aggression. Packs rally and flank; stronger foes cast their own skills.
- Red circles and cones show the actual danger area before enemy strikes resolve.
- Eight named boss lairs have fixed locations, enhanced rewards and respawn timers. Roaming alpha hunts remain additional encounters.
- Earn rare DNA from selected one-time milestones and rare finds; spend it on permanent lineage upgrades or your collection.
- The title screen is a live animated 3D scene. The searchable encyclopedia tracks evolved forms and includes a draggable animated specimen viewer, both abilities, passives, habitats and temperament.
- Original animated procedural 3D creatures, vegetation, skeletal remains, crystals, water, particles, impact arcs and lighting.
- Original adaptive synthesized music, jungle ambience and combat effects, with independent volume controls.
- Three difficulty modes, three graphics quality settings, fullscreen, reduced motion support, optional shake and damage numbers, automatic pause on focus loss.
- Sandboxed Electron Windows build with local assets and local saves. No runtime network connection is required.

The game is a commercial-development foundation. Controller support, control remapping, localization, wider hardware coverage, Steamworks features, signing and external playtesting remain future release work. Runs do not suspend across application exits; persistent DNA, discoveries, skins and permanent relics do. Models and the live title scene are authored procedurally; the earlier AI-generated title illustration remains archived. See the Steam release checklist and asset provenance for details.
