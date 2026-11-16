# Player experience polish — 0.9.0

The November 15 audit starts from the completed presentation pass: Three.js
r187, DOM interfaces, a fixed-step simulation, atomic alternating local saves,
original synthesis plus locally bundled audio, and isolated Electron QA.
Existing models, progression rules, single living-run saves, and the Lost
Continent presentation remain the foundation.

Rollback: `refs/codex/checkpoints/pre-player-polish-20261115` preserves tracked
work; `artifacts/player-polish/before/source-checkpoint.zip` also preserves the
untracked source from the preceding art and presentation work.

## Audit and prioritized work

- [x] Startup: visible preparation state, recovery when the application bundle
  cannot start, and no artificial unskippable splash delay.
- [x] Navigation: nested Back/Escape returns to the actual previous screen,
  restores focus, and supports controller menu traversal and accept/back.
- [x] Settings: real frame cap, render scale, camera smoothing, particle density,
  FPS display, validated controller deadzone, contrast/flash comfort, independent
  ambient/UI volume, mute, focus mute, interaction/hint and autosave preferences.
  Reset preferences must preserve keybinds unless explicitly resetting controls.
- [x] Audio: immediate mute for both Web Audio and existing HTML audio samples,
  independent channels, short UI cues, ambient fades, and cleanup on restart.
- [x] Onboarding: short contextual tasks completed through real actions; remember
  completion, support skip/revisit, honor rebindings, avoid combat-blocking modals.
- [x] Help and information: ability/status explanations, captions for important
  cues, credits/version/what's new, factual license/privacy information.
- [x] Reliability: clear all held and queued input on interruptions, protect
  controller disconnects, avoid click-through from HUD controls, and exercise
  repeated navigation/restart and save-failure recovery.
- [x] Verification: screenshots, requested desktop resolution sweep, new and
  returning-player journeys, settings persistence, malformed preferences,
  frame pacing and resource bounds, unit/browser/Electron/portable checks.

## Existing systems to retain

Continue and corrupted-checkpoint recovery already work. Backups validate before
restoring. Death invalidates the living run and rewards use receipt ledgers.
Evolution readiness stays voluntary: crossing a threshold does not interrupt
play. Keyboard rebinding already swaps conflicts. Quality presets, reduced
motion, UI scaling and native fullscreen already have real effects. This pass
will extend those systems instead of replacing them or adding unsupported
graphics options, multiple save slots, or an invented victory condition.

## Implemented player behavior

The startup layer loads independently of the application bundle. It reports real
preparation stages without invented percentages or a minimum splash duration.
A failed bundle or a twenty-second startup timeout presents Retry without
clearing data. Existing preferences and valid living expeditions are restored
before play. Browser menus omit Quit; Windows builds retain the native action.

Back/Escape now follows bounded screen history, retaining focus, panel scroll,
compendium tab and relevant category. Keyboard arrows and Tab traverse menus;
standard-controller A/B accept and return, with repeat-limited navigation and
left/right adjustment of preferences. Controller disconnects pause play and
explain that keyboard and mouse remain available. Releasing buttons is required
before gameplay accepts the controller after a menu transition.

Settings apply immediately and save automatically. There is no separate Apply
transaction to lose. Reset Preferences confirms the reset and preserves progress
and keybindings; Reset Controls remains a separate action.

| Section | Working controls |
| --- | --- |
| Audio | Master, music, effects, ambience and interface volume; mute all; mute unfocused |
| Graphics and camera | Low/medium/high presets; 30/60/120/144/unlimited render cap; 50–125% render scale; particle density; measured FPS; camera damping; shake; supported fullscreen |
| Accessibility | 85/100/115/125% interface scale; high contrast; reduced motion; flash suppression; meaningful audio captions |
| Gameplay and help | Focus-loss pause; contextual guidance; interaction prompts; damage values; guided learning and survival guide |
| Input | Standard controller enable; live connection status; adjustable deadzone; conflict-swapping persistent keyboard remapping |
| Saving | 5/10/30/60-second autosave; manual pause-menu checkpoint; backup export/validation/restore |

Render scale also applies to island and specimen views. Particle reduction keeps
hazard and projectile bodies visible. Flash suppression disables lightning and
pulsing low-health effects. Reduced motion quiets transitions, preview rotation,
decorative drift and shake. No unsupported VSync, resolution, ray tracing, bloom
or texture-quality switches were added.

The eight guided tasks cover hatch, movement, feeding, bite, roar, pause,
voluntary evolution and map use. Real actions complete tasks, including tasks
done out of order. Completion and skip state survive reload. Revisit the
checklist from help/settings; returning profiles are not forced through it.
The HUD highlights the relevant control and displays the player's current
binding. Immediate survival warnings take priority over lessons.

Abilities, dash, roar, relics and active effects expose concise descriptions.
Optional captions describe actual nearby warnings, weather and creature events.
Credits use package metadata, show the bundled Three.js license and explain
local data. No support address or additional creator attribution was invented.

Screen changes share the existing short presentation transitions, with a
central screen revision that cancels stale delayed confirmations. Input is
cleared on pause, blur, visibility changes and navigation; world pointer input
is briefly blocked after a transition. HUD clicks cannot bite through buttons.
Nested settings stay paused and focus restoration never automatically resumes.

Restart reuses the world while clearing old actors, floating damage text,
captions, pending input and one-shot audio. Menu/death ambience fades down;
master and focus mute silence synthesized voices and already-created audio
elements. UI cues are synthesized and rate limited. No new recorded audio was
downloaded or purchased.

## Save defects repaired during verification

- Log/boulder demolition previously bypassed `spawnFood`, creating string IDs,
  missing ages and unsupported food types. Those drops became nonfinite on the
  next update and prevented checkpoints later in a life. Bite and charge paths
  now share normal meat/essence creation, preserve their reward values, and use
  source labels for grubs/amber. Regression tests advance and restore both paths.
- Catalyst offers, rarity and offered egg starters now survive checkpoints.
  Continue recognizes the catalyst-choice state. The fixed-step loop stops as
  soon as a reward modal opens, including at a 30 FPS render cap.
- Recognized older catalyst saves that omitted offers recover recorded event
  choices when available; otherwise they offer a fixed valid replacement and
  explain this recovery in the UI. The original unrecorded offer cannot be
  reconstructed. Recovery does not advance the PRNG or remove the reward.
- Choosing an offered higher-tier starter now records its actual species tier,
  allowing the resulting life to checkpoint. The existing starter pool remains.
- Extended final-tier play exposed secondary attacks that subtracted health
  without settling defeat. Chain lightning, tail sweeps, retaliation, flame
  trails, poison clouds and hemorrhage now share normal defeat settlement while
  preserving their authored damage and avoiding recursive on-hit procs. Each
  defeated actor leaves the active world once, grants its usual kill/loot and
  cannot poison a later streamed checkpoint with negative health.
- Builds has its own remappable B action. The conflicting fifth relic moves to
  U when migrating old defaults. Rebound sprint/roar controls disable their old
  convenience aliases, and the HUD displays current keys.

Snapshot version 2 and the existing alternating save journal remain compatible;
new optional fields validate before restore. No player profile was cleared.
All automated disk tests use isolated disposable profiles.

## Verification and review

The [before/after gallery](../artifacts/player-polish/review.html) links actual
captures and machine-readable reports. New regression tests were observed
failing before their fixes; red/green logs are retained in
`artifacts/player-polish/`.

- `npm test`: **283 passed**, zero failed or skipped.
- `npm run build`: passed; the existing large-bundle advisory remains.
- Player journey: **19 checks**, including persistent remaps/settings, actual
  lesson actions, voluntary evolution, controller menus/disconnect, manual save,
  a 30 FPS catalyst pickup and exact offer restoration after reload.
- Stability/recovery: **10 checks**. Seven rendered restarts keep actor,
  geometry, chunk and audio resources bounded. Focus loss releases input;
  800×600, 1280×720, 1600×900, 1920×1080 and 2560×1440 were captured with
  high contrast, learning guidance and 125% UI. Bundle failure, graphics loss,
  corrupt preferences and unavailable storage all provide usable recovery.
- Foundation saves/backups/permadeath: **14 checks**, no failures.
- Collection/shop/island: **10 checks**, including returning to the originating
  shop category and all 49 product previews.
- General browser gameplay: **22 checks**, no runtime errors. Covers all eight
  tiers, abilities, combat, death/retry, progression and 800×600 layout.
- Actual packaged Windows application: **17 checks**; portable extraction:
  **7 checks**. Both use isolated disk profiles and verify offline resources,
  native fullscreen, clean quit and exact continuation after a second launch.
- Total: **99 integration checks**, no unexpected runtime errors; all seven
  suite reports are indexed by
  `artifacts/player-polish/verification-summary.json`. Native/GPU automation uses
  SwiftShader; controller automation emulates a standard mapping.
- Long simulation: **8 seeds**, up to 600 requested seconds each, totaling
  **4,692.6 seconds of actual simulated play**. All eight checkpoint round trips
  matched exactly; no population/state budget failures. Peak 92 active creatures;
  largest checkpoint 1,033,740 bytes. Bot reward decisions use authority commands,
  with no health/XP/population cheats. Hit-stop means requested ticks are not
  identical to elapsed game time. This is renderer-free CPU testing, not GPU FPS.
- Extended trace: **3,515.3 seconds of continuous simulated play** (58.6 minutes
  from a 3,600-second tick budget), final tier, 2,263 kills and 138 stored chunks.
  The 1,502,505-byte checkpoint restored exactly. The initial failing trace is
  what exposed unsettled secondary-damage deaths; the passing rerun uses the
  repaired settlement path. This does not substitute for multi-hour native
  memory/GPU testing.

The fault suite also verifies that a full storage device cannot turn a pending
lesson/reward save into a per-frame retry loop. Automatic retry waits for the
chosen autosave interval, while a manual checkpoint can retry immediately.

## Windows candidate

- Portable: `release/player-polish/Jurassic Domination-0.9.0-portable.exe`
- Unpacked: `release/player-polish/win-unpacked/Jurassic Domination.exe` (retain
  the entire directory).
- All **254 built files** (91,341,608 bytes) match the packaged application byte
  for byte, including boot assets, compiled code, licenses, models and portraits.
  Reproduce with `node scripts/verify-player-package.mjs`.
- Portable size: **182,216,127 bytes**. SHA-256:
  `1a28269e5ea5ba7e8c83ecaf9eec5e67bc7855ddf2ab5e11b03df1e06a310c3f`.
- `release/player-polish/SHA256SUMS.txt` and
  `artifacts/player-polish/package-verification.json` retain the artifact record.
- Packaging succeeded. Windows directory rename retries recovered through the
  builder's copy fallback. This is an unsigned local candidate.

## Remaining release work

1. Verify provenance/distribution rights for the **66 pre-existing MP3s**. This
   checkout does not contain their recording license records; filenames do not
   establish rights. They were retained, and credits do not invent their origin.
2. Profile an actual minimum-spec GPU in crowded biomes and during chunk
   streaming. Software-rendered automation does not establish a 60 FPS target.
3. Conduct multi-hour native play, physical Xbox/PlayStation controller tests,
   audio-device switching/listening and high-DPI/multiple-monitor checks. Existing
   keyboard/mouse and standard mapping remain supported, with no hardware claim.
4. Playtest onboarding and contrast with players, including accessibility needs;
   the 800×600 extra-large HUD uses a scrollable survival column.
5. Public distribution still requires a final clean source snapshot, publisher
   signing and store/platform preparation. This local package does not implement
   Steamworks, cloud saves, localization or Steam Deck certification.
