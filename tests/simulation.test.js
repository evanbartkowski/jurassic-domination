import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { snapshotGame, restoreGame, validateSnapshot } from "../src/run-state.js";
import { LocalAuthority, FIXED_DELTA, normalizeInput, replayCommands } from "../src/simulation.js";

const make = (seed = 401) => new Game({ seed, runId: `test-run-${seed}` });
test("checkpoint restores PRNG, inactive chunks, loot, pending rewards and the same next ticks", () => {
  const g = make(), authority = new LocalAuthority(g);
  authority.dispatch({ type: "hatch" });
  g.player.invulnerable = 10000;
  for (const [x, y] of [[390, 30], [-410, 170], [42, 10]]) {
    g.player.x = x; g.player.y = y;
    for (let i = 0; i < 60; i++) authority.step({ x: .2, eat: true });
  }
  assert.ok(g.chunks.size > 0);
  g.emit("dna-find", { receipt: "pending-once", amount: 2 });
  const checkpoint = snapshotGame(g), restored = restoreGame(checkpoint), peer = new LocalAuthority(restored);
  assert.deepEqual(snapshotGame(restored), checkpoint);
  assert.equal(restored.events.at(-1).receipt, "pending-once");
  assert.equal(restored._nextId, g._nextId);
  assert.notEqual(restored.player, g.player);
  assert.equal(typeof restored.hatch, "function");
  for (let i = 0; i < 180; i++) {
    const input = { x: Math.sin(i / 13), y: Math.cos(i / 17), attack: true, eat: true };
    authority.step(input); peer.step(input);
  }
  assert.deepEqual(snapshotGame(restored), snapshotGame(g));
});

test("evolution checkpoint keeps fixed offers, mutation choices and postponement without rerolling", () => {
  const g = make(402), a = new LocalAuthority(g);
  a.dispatch({ type: "hatch" }); g.gainXP(g.nextThreshold);
  assert.ok(a.dispatch({ type: "open-evolution" }).ok);
  const checkpoint = snapshotGame(g), peer = new LocalAuthority(restoreGame(checkpoint));
  assert.equal(peer.game.state, "evolution");
  assert.equal(peer.step({ x: 1 }).ok, false);
  assert.deepEqual(snapshotGame(peer.game), checkpoint);
  assert.ok(peer.dispatch({ type: "close-evolution" }).ok);
  assert.ok(peer.dispatch({ type: "open-evolution" }).ok);
  assert.deepEqual(peer.game.evolutionChoices, g.evolutionChoices);
  assert.deepEqual(peer.game.mutationChoices, g.mutationChoices);
  const command = { type: "evolve", speciesId: g.evolutionChoices[0], mutationId: g.mutationChoices[0] };
  assert.ok(peer.dispatch(command).ok);
  assert.ok(a.dispatch({ type: "close-evolution" }).ok);
  assert.ok(a.dispatch({ type: "open-evolution" }).ok);
  assert.ok(a.dispatch(command).ok);
  assert.deepEqual(snapshotGame(peer.game), snapshotGame(g));
});

test("marine state and collision features resume in the same stationary chunk with no hidden regeneration", () => {
  const g = make(403), a = new LocalAuthority(g);
  a.dispatch({ type: "hatch" }); g.player.invulnerable = 10000;
  const pool = g.worldFeatures.find((f) => f.type === "water");
  g.player.x = pool.x; g.player.y = pool.y;
  for (let i = 0; i < 90; i++) a.step({});
  const peer = new LocalAuthority(restoreGame(snapshotGame(g)));
  assert.ok(peer.game.worldFeatures.length);
  assert.ok(peer.game.marineState.size);
  assert.equal(peer.game._chunkPosition, g._chunkPosition);
  for (let i = 0; i < 90; i++) { a.step({}); peer.step({}); }
  assert.deepEqual(snapshotGame(peer.game), snapshotGame(g));
});

test("streaming a paused life prunes unloaded marine pools before a checkpoint without advancing hazards", () => {
  const g = make(409), a = new LocalAuthority(g);
  a.dispatch({ type: "hatch" }); a.step({});
  assert.ok(g.marineState.size);
  g.player.x = 577; g.player.y = 31;
  const time = g.time, health = g.player.hp;
  g._streamWorld(true);
  const pools = new Set(g.worldFeatures.filter((f) => f.type === "water").map((f) => f.id));
  assert.ok([...g.marineState.keys()].every((id) => pools.has(id)));
  const snapshot = snapshotGame(g);
  assert.equal(g.time, time); assert.equal(g.player.hp, health);
  assert.deepEqual(snapshotGame(restoreGame(snapshot)), snapshot);
});

test("malformed or future snapshots fail closed before runtime mutation", () => {
  const good = snapshotGame(make(404));
  const bad = [
    (s) => { s.version++; },
    (s) => { s.contentVersion++; },
    (s) => { s.game.player.vx = "fast"; },
    (s) => { delete s.game.player.abilityCooldown; },
    (s) => { s.game.player.speciesId = "unknown"; },
    (s) => { s.game.player.x = Infinity; },
    (s) => { s.game.lineage.fruits = null; },
    (s) => { s.game.lineage.formKills = "many"; },
    (s) => { s.game.entities.push({ ...s.game.entities[0] }); },
    (s) => { s.game.projectiles.push({ id: "bad", x: 0 }); },
    (s) => { s.game.lairs[0].respawnAt = null; },
    (s) => { s.game.runSkills.push({ id: "fake", cooldown: 0 }); },
    (s) => { s.game.activeChunks.push(s.game.activeChunks[0]); },
    (s) => { s.game.worldFeatures[0].phase = null; },
    (s) => { Object.defineProperty(s.game.player, "__proto__", { value: { evil: true }, enumerable: true }); },
  ];
  for (const mutate of bad) {
    const snapshot = structuredClone(good); mutate(snapshot);
    assert.equal(validateSnapshot(snapshot), false, mutate.toString());
    assert.throws(() => restoreGame(snapshot), /Invalid or unsupported/);
  }
  assert.equal(validateSnapshot(good), true);
});

test("authority accepts intent only, validates sequences and cannot advance dead or modal worlds", () => {
  const g = make(405), a = new LocalAuthority(g);
  const before = snapshotGame(g);
  for (const input of [{ x: NaN }, { hp: 9999 }, { damage: 99 }, { x: "1" }, { attack: 1 }, { skill: 6 }])
    assert.equal(a.step(input).ok, false);
  for (const command of [{ type: "damage", amount: 99 }, { type: "waypoint", x: 1, y: NaN }, { type: "hatch", hp: 999 }])
    assert.equal(a.dispatch(command).ok, false);
  assert.deepEqual(snapshotGame(g), before);
  assert.equal(a.dispatch({ type: "hatch" }, 2).ok, false);
  assert.ok(a.dispatch({ type: "hatch" }, 1).ok);
  assert.equal(a.step({}, 1).ok, false);
  assert.ok(a.step({ x: 900, y: 900 }, 2).ok);
  assert.equal(g.tick, 1); assert.equal(g.time, FIXED_DELTA);
  assert.ok(Math.hypot(a.commands.at(-1).payload.x, a.commands.at(-1).payload.y) <= 1);
  g.player.invulnerable = 0; g.damagePlayer(1e9, "test", true);
  const dead = snapshotGame(g);
  assert.equal(a.step({ eat: true }).ok, false);
  assert.equal(a.dispatch({ type: "hatch" }).ok, false);
  assert.deepEqual(snapshotGame(g), dead);
});

test("a resumed authority rejects stale commands and recorded intent replays to the exact same snapshot", () => {
  const g = make(406), a = new LocalAuthority(g);
  a.dispatch({ type: "hatch" });
  for (let i = 0; i < 15; i++) a.step({ x: 1 });
  const checkpoint = snapshotGame(g), start = a.commands.length;
  for (let i = 0; i < 120; i++) a.step({ x: Math.sin(i * .1), y: Math.cos(i * .1), eat: true, attack: true });
  const replayed = replayCommands(checkpoint, a.commands.slice(start));
  assert.deepEqual(snapshotGame(replayed), snapshotGame(g));
  assert.equal(new LocalAuthority(restoreGame(checkpoint)).step({}, 1).ok, false);
});

test("evolution rule entry rejects forged offers without XP, wrong tiers or earned bloodline conditions", () => {
  const g = make(408), a = new LocalAuthority(g);
  a.dispatch({ type: "hatch" });
  g.state = "evolution"; g.evolutionChoices = ["verdant-psittacosaurus"]; g.mutationChoices = ["razor"];
  let before = snapshotGame(g);
  assert.equal(a.dispatch({ type: "evolve", speciesId: "verdant-psittacosaurus", mutationId: "razor" }).ok, false);
  assert.deepEqual(snapshotGame(g), before);
  g.player.xp = g.nextThreshold;
  before = snapshotGame(g);
  assert.equal(a.dispatch({ type: "evolve", speciesId: "verdant-psittacosaurus", mutationId: "razor" }).ok, false);
  assert.deepEqual(snapshotGame(g), before);
  g.evolutionChoices = ["elder-dragon"];
  const state = JSON.stringify(g.player);
  assert.equal(a.dispatch({ type: "evolve", speciesId: "elder-dragon", mutationId: "razor" }).ok, false);
  assert.equal(a.dispatch({ type: "evolve", speciesId: "unknown", mutationId: "razor" }).ok, false);
  assert.equal(a.dispatch({ type: "evolve", speciesId: "elder-dragon", mutationId: "unknown" }).ok, false);
  assert.equal(JSON.stringify(g.player), state);
  assert.equal(g.tier, 0);
});

test("interest snapshots expose nearby public identities and history stays bounded with a ring", () => {
  const g = make(407), a = new LocalAuthority(g, { maxReplayEntries: 8 });
  a.dispatch({ type: "hatch" });
  const near = g.spawnEntity("compsognathus", 1, 0), far = g.spawnEntity("compsognathus", 500, 0);
  for (let i = 0; i < 25; i++) a.step({});
  const view = a.interestSnapshot({ radius: 30 });
  assert.ok(view.entities.some((e) => e.id === `${g.runId}:creature:${near.id}`));
  assert.ok(!view.entities.some((e) => e.id === `${g.runId}:creature:${far.id}`));
  assert.equal(view._randomState, undefined); assert.equal(view.chunks, undefined); assert.equal(view.secretSite, undefined);
  assert.equal(a.commands.length, 8);
  assert.deepEqual(a.commands.map((c) => c.sequence), [19,20,21,22,23,24,25,26]);
  a.commands[0].payload.x = 999;
  assert.equal(a.commands[0].payload.x, undefined);
  assert.throws(() => a.interestSnapshot({ radius: 99999 }), /Invalid interest/);
});
