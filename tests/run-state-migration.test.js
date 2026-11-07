import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { snapshotGame, restoreGame, migrateSnapshot, validateSnapshot, SNAPSHOT_VERSION } from "../src/run-state.js";
import { phenotype } from "../src/genetics.js";
import { LocalAuthority } from "../src/simulation.js";
import { SaveStore, SAVE_KEYS, saveChecksum } from "../src/state-store.js";
import { newProfile, normalizeSettings, PROFILE_VERSION, recordRun } from "../src/profile.js";

const newFields = ["worldState", "exploration", "survival", "senses", "nests", "_nextSocialAt", "formHistory", "guardianKills"];
const actorFields = ["genome", "geneticSpeed", "maturitySeconds", "nestId", "parentIds", "groupRole", "territoryRadius", "roleSign", "rivalId", "territoryRetreat", "sensory"];
function legacySnapshot() {
  const game = new Game({ seed: 842, runId: "migration-life" });
  game.hatch();
  game.player.x = 392; game.player.y = 18; game._streamWorld(true);
  game.player.x = 14; game.player.y = 12; game._streamWorld(true);
  game.player.hp = Math.min(game.player.maxHp, 19.5);
  game.player.stamina = 58; game.player.growth = .37; game.player.formScale = 1.14;
  game.time = 917.5; game.lineage.guardians = 3;
  const snapshot = snapshotGame(game);
  snapshot.version = 1;
  for (const field of newFields) delete snapshot.game[field];
  for (const field of ["genome", "adaptations", "crouching", "submerged"]) delete snapshot.game.player[field];
  const groups = [snapshot.game, ...snapshot.game.chunks.map((entry) => entry[1])];
  for (const group of groups) {
    delete group.nests;
    for (const actor of group.entities) for (const field of actorFields) delete actor[field];
    for (const food of group.foods) for (const field of ["genome", "nestId", "parentIds"]) delete food[field];
  }
  assert.equal(validateSnapshot(snapshot), true);
  return snapshot;
}
const without = (object, fields) => Object.fromEntries(Object.entries(object).filter(([key]) => !fields.includes(key)));
function storageWithEnvelope(profile, run) {
  const values = new Map(), data = { profile, settings: normalizeSettings(), run },
    body = { version: 1, revision: 1, savedAt: 0, terminalRunId: null, data },
    checksum = saveChecksum(JSON.stringify(body));
  values.set(SAVE_KEYS.slots[0], JSON.stringify({ ...body, checksum }));
  values.set(SAVE_KEYS.head, JSON.stringify({ slot: 0, revision: 1, checksum }));
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

test("v1 migration adds neutral living systems without changing any prior stat, position, timer or PRNG", () => {
  const legacy = legacySnapshot(), untouched = structuredClone(legacy), migrated = migrateSnapshot(legacy),
    game = restoreGame(legacy);
  assert.equal(migrated.version, SNAPSHOT_VERSION);
  assert.deepEqual(legacy, untouched, "migration is read-only");
  assert.equal(game.time, legacy.game.time);
  assert.equal(game._randomState, legacy.game._randomState);
  assert.equal(game._nextId, legacy.game._nextId);
  assert.equal(game.player.hp, legacy.game.player.hp);
  assert.equal(game.effectiveSize, game.species.size * game.player.formScale * (1 + game.player.growth * .28));
  assert.deepEqual(without(migrated.game.player, ["genome", "adaptations", "crouching", "submerged"]), legacy.game.player);
  assert.equal(phenotype(game.player.genome).speed, 1);
  assert.equal(game.player.genome.generation, 1, "an older survivor starts the recorded lineage as its neutral founder");
  assert.equal(phenotype(game.player.genome).resistance, 0);
  assert.deepEqual(game.player.adaptations, { frost: 0, cinder: 0, water: 0, stealth: 0 });
  assert.equal(game.guardianKills, 3);
  assert.deepEqual(game.formHistory, [legacy.game.player.speciesId]);
  assert.equal(game.worldState.clock, 0, "new catastrophes do not arrive overdue in an older life");
  assert.equal(game.worldState.scars.length, 0);
  assert.equal(game.exploration.travel, 0);
  assert.deepEqual(game.nests, []);
  for (const [index, actor] of migrated.game.entities.entries()) {
    assert.deepEqual(without(actor, actorFields), legacy.game.entities[index]);
    assert.equal(actor.geneticSpeed, 1);
    assert.equal(phenotype(actor.genome).size, 1);
    if (actor.juvenile) assert.equal(actor.maturitySeconds, 100);
  }
  for (const [index, [key, chunk]] of migrated.game.chunks.entries()) {
    assert.equal(key, legacy.game.chunks[index][0]);
    assert.deepEqual(chunk.nests, []);
    for (const [actorIndex, actor] of chunk.entities.entries())
      assert.deepEqual(without(actor, actorFields), legacy.game.chunks[index][1].entities[actorIndex]);
  }
  assert.deepEqual(snapshotGame(game), migrated);
});

test("v1 migrations and their continued authoritative ticks reproduce exactly", () => {
  const legacy = legacySnapshot(), a = new LocalAuthority(restoreGame(legacy)), b = new LocalAuthority(restoreGame(legacy));
  assert.deepEqual(migrateSnapshot(legacy), migrateSnapshot(legacy));
  a.game.player.invulnerable = b.game.player.invulnerable = 10000;
  for (let i = 0; i < 180; i++) {
    const input = { x: Math.sin(i / 11), y: Math.cos(i / 14), crouch: i < 90, eat: true, attack: i % 4 === 0 };
    assert.equal(a.step(input).ok, true); assert.equal(b.step(input).ok, true);
  }
  assert.deepEqual(snapshotGame(a.game), snapshotGame(b.game));
  assert.equal(a.game.worldState.clock > 2.9, true);
  assert.ok(a.game.time > legacy.game.time);
});

test("v2 serializes weather scars, discoveries, sensory memory, inherited eggs and juvenile state exactly", () => {
  const game = new Game({ seed: 843, runId: "living-save" }), a = new LocalAuthority(game);
  a.dispatch({ type: "hatch" }); game.player.invulnerable = 10000;
  game.player.x = 220; game.player.y = 190;
  for (let i = 0; i < 150; i++) a.step({ x: .1, crouch: true });
  assert.ok(game.exploration.discoveries.some((entry) => entry.id === "tidal-archive"));
  assert.ok(game.nests.length);
  const checkpoint = snapshotGame(game), peer = new LocalAuthority(restoreGame(checkpoint));
  assert.equal(checkpoint.version, 2);
  assert.deepEqual(snapshotGame(peer.game), checkpoint);
  for (let i = 0; i < 180; i++) {
    const input = { x: -.15, y: .2, crouch: i < 100, sprint: i >= 100 };
    a.step(input); peer.step(input);
  }
  assert.deepEqual(snapshotGame(peer.game), snapshotGame(game));
});

test("v2 rejects malformed living-world data instead of silently regenerating or dropping it", () => {
  const good = snapshotGame(new Game({ seed: 844, runId: "strict-living" }));
  const invalid = [
    (s) => { s.game.player.genome.alleles.mass = 101; },
    (s) => { delete s.game.player.genome; },
    (s) => { s.game.player.adaptations.water = -1; },
    (s) => { s.game.player.submerged = "yes"; },
    (s) => { s.game.entities[0].geneticSpeed = 4; },
    (s) => { s.game.entities[0].parentIds = [2, 2]; },
    (s) => { s.game.entities[0].maturitySeconds = 0; },
    (s) => { s.game.entities[0].groupRole = "overlord"; },
    (s) => { s.game.entities[0].sensory = { nextCheck: 0, detected: true }; },
    (s) => { s.game.senses.trails = Array.from({ length: 97 }, () => ({ kind: "blood" })); },
    (s) => { s.game.survival.fatigue = 101; },
    (s) => { delete s.game.worldState; },
    (s) => { s.game.worldState.scars.push({ id: "fake" }); },
    (s) => { s.game.exploration.visited = ["0,0", "0,0"]; },
    (s) => { s.game.exploration.discoveries = [{ id: "invented", at: 0 }]; },
    (s) => { s.game.formHistory = ["invented"]; },
    (s) => { s.game.nests[0].eggIds = [1, 2, 3]; },
  ];
  for (const mutate of invalid) {
    const copy = structuredClone(good); mutate(copy);
    assert.equal(validateSnapshot(copy), false, mutate.toString());
    assert.throws(() => restoreGame(copy), /Invalid or unsupported/);
  }
});

test("journal verifies original v1 checksum, migrates in memory and writes v2 atomically", () => {
  const legacy = legacySnapshot(), profile = newProfile(); profile.version = 3; profile.dna = 27;
  const storage = storageWithEnvelope(profile, legacy), before = new Map(storage.values), store = new SaveStore(storage), loaded = store.load();
  assert.equal(loaded.failed, false);
  assert.equal(loaded.profile.version, PROFILE_VERSION);
  assert.equal(loaded.profile.dna, 27);
  assert.equal(loaded.run.version, 2);
  assert.deepEqual(storage.values, before, "loading a save never writes");
  assert.equal(loaded.run.game._randomState, legacy.game._randomState);
  assert.ok(store.commit(loaded).ok);
  const after = new SaveStore(storage).load();
  assert.equal(after.failed, false);
  assert.deepEqual(after.run, loaded.run);
});

test("future profile and snapshot versions stay protected and cannot enter backup normalization", () => {
  for (const kind of ["profile", "run"]) {
    const profile = newProfile(), run = snapshotGame(new Game({ seed: 845, runId: "future-life" }));
    if (kind === "profile") profile.version = PROFILE_VERSION + 1;
    else run.version = SNAPSHOT_VERSION + 1;
    const storage = storageWithEnvelope(profile, run), before = new Map(storage.values), store = new SaveStore(storage), loaded = store.load();
    assert.equal(loaded.failed, true); assert.equal(store.lockReason, "future");
    assert.equal(store.commit({ profile: newProfile(), settings: normalizeSettings() }).ok, false);
    assert.deepEqual(storage.values, before);
  }
});

test("restoring an older backup preserves completed ancestry and cannot award its deaths twice", () => {
  const profile = newProfile(), storage = storageWithEnvelope(profile, null), store = new SaveStore(storage);
  store.load();
  const olderBackup = store.exportBackup();
  const game = new Game({ seed: 846, runId: "permanent-ancestor" }); game.hatch();
  game.player.kills = 4; game.guardianKills = 1;
  game.exploration.discoveries.push({ id: "tidal-archive", at: 0 });
  const results = game.getResults();
  recordRun(profile, results, "2026-11-07");
  assert.ok(store.commit({ profile, settings: normalizeSettings(), run: null, terminalRunId: game.runId }).ok);
  assert.ok(store.importBackup(olderBackup).ok);
  const restored = new SaveStore(storage).load();
  assert.equal(restored.profile.ancestry.generations, 1);
  assert.equal(restored.profile.ancestry.guardianVictories, 1);
  assert.equal(restored.profile.ancestry.lastAncestor.runId, game.runId);
  assert.ok(restored.profile.ancestry.discoveries.includes("tidal-archive"));
  const ancestry = structuredClone(restored.profile.ancestry);
  recordRun(restored.profile, results);
  assert.deepEqual(restored.profile.ancestry, ancestry);
});
