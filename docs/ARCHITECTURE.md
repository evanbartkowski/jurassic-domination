# Simulation, checkpoints, and future servers

This document describes the implemented offline architecture. There is no online
transport, remote authority, matchmaking, shared sanctuary, or PvP in this build.

## Runtime boundaries

| Layer | Owner | Responsibility |
| --- | --- | --- |
| Keyboard and standard controller adapters | `src/controls.js` | Convert physical input into movement and action intents; never award items or damage |
| Offline authority | `src/simulation.js` | Validate commands and sequence numbers, advance fixed 60 Hz ticks, execute rule-validated discrete decisions, expose interest-filtered state |
| Simulation and rules | `src/game.js`, `src/ecosystem.js`, `src/combat.js`, `src/progression.js` | Movement, attacks, resources, evolution, wildlife, deterministic random state |
| Versioned run state | `src/run-state.js` | Explicit state whitelist, validation, serialization, restoration without constructors replaying spawns or rewards |
| Offline persistence | `src/state-store.js`, `src/profile.js` | Commit permanent profile, settings, and active life together; recovery, migrations, terminal-run receipts, backups |
| Presentation | `src/main.js`, `src/ui.js`, rendering and audio modules | Frame interpolation/animation, views, command adapters, checkpoint scheduling and permanent-reward event handling |
| World streaming | `src/ecosystem.js`, `src/terrain.js` | Simulation chunk activation and separately budgeted visual chunk creation |

The ordinary game uses the command boundary. Node tests can run the same rules,
commands and snapshots without a DOM, renderer, audio device, or Electron host.
Game's direct rule methods remain available to trusted internal code and tests.

## Snapshots and replay

A run snapshot has a format identifier, schema version, content version, opaque
run identity, tick, and explicit game data. Numeric actor IDs remain stable across
save/resume; the run identity provides their session namespace. State includes the
seed and current RNG state, player cooldowns/growth, offered evolution and mutation
choices, conditional bloodline progress, live/inactive chunks, meals, bosses,
projectiles, marine positions, discoveries and pending events.

Restore hydrates the simulation prototype and whitelisted state directly. It
does not construct a fresh world, redraw evolution offers, replay a reward, or
give the player fresh health. A restored life opens paused. Closing the program
does not advance its ecology or count as survival time.

Fixed ticks and serializable intent commands make same-runtime replay testable.
Snapshot schema v2 adds neutral migration of v1 genes, independent world-event
clock, bounded ancestry-related life history, senses/trails, nests, survival and
exploration. See [IMMERSION_SYSTEMS.md](IMMERSION_SYSTEMS.md) for their state
budgets and the private cooperative server sequence. The H crouch/dive intent
passes through the same normalization and fixed authority step as movement.
They are not a promise of bit-perfect floating point results on different CPUs
or browsers. A future server must own outcomes and publish corrections.

## Checkpoint transaction

The save journal stores two checksummed envelopes and a small head record. A
commit writes and reads back the inactive envelope before replacing the head.
A valid head wins over an uncommitted newer slot. If the selected slot is damaged,
the previous verified slot can be recovered. A stale window cannot overwrite a
newer committed head without reloading.

Deaths and abandoned lives have a terminal receipt. Its transaction is prepared
before the death receipt becomes durable, allowing recovery to roll a completed
death forward if the head write was interrupted. Old checkpoint slots and backup
imports consult the terminal ledger before offering a life to continue. Run
recording is idempotent for a valid run identity. Permanent pickup events and the
world's consumed items are committed in the same bundle as the profile.
The active life's claim ledger also survives older checkpoint imports, including
more than the legacy 2,048 recent receipts. Starting another life retires the old
identity; this avoids retaining every pickup receipt forever.

The application checkpoints on a ten-second interval, pausing, leaving play,
important progression/rewards and page exit. A crash can lose changes since the
last checkpoint. Explicit failures stay visible and current in-memory data can be
exported without a successful storage write. Legacy profile/settings keys remain
readable migration inputs and compatibility mirrors; the journal is authoritative.

Checksums detect accidental corruption. They are not signatures, encryption, or
anti-cheat. Someone controlling offline files can alter or erase local history.
Future online characters must use separate server-managed storage and transactions.

## Rendering budgets

Visual terrain builds the center first, then at most one neighboring chunk per
render call, with at most nine resident chunks. Obsolete queued work is canceled.
Quality and distance select shared geometry detail and undergrowth density.
Simulation collision and hazard features keep their authoritative footprints.
Individual chunk construction still runs synchronously; it can cause a frame
spike. Worker preparation remains future work, requiring a measured budget.

The renderer has an idempotent disposal lifecycle. Food follows live simulation
coordinates, including magnet movement. Geometry counters and actual frame
intervals are measured separately from CPU render submission time.

## Next server work

An actual dedicated server must add authenticated player ownership, a server
clock and command scheduling, per-connection rate/size limits, interest/delta
replication, interpolation and reconciliation, disconnect/reconnect policy, durable
server transactions, and adversarial tests. Transport choice should follow those
requirements. Current local command sequence checks are useful boundaries, not a
complete multiplayer security implementation.
