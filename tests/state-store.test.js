import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { snapshotGame, restoreGame } from "../src/run-state.js";
import { SaveStore, SAVE_KEYS, MAX_ACTIVE_CLAIMS, saveChecksum } from "../src/state-store.js";
import { newProfile, normalizeSettings, PROFILE_KEY, SETTINGS_KEY, recordRun } from "../src/profile.js";
import { awardRareDNA } from "../src/collections.js";

function memoryStorage() {
  const values = new Map();
  return { values, fail: null,
    getItem(key) { if (this.fail?.("get", key)) throw Error("Test storage read failure"); return values.get(key) ?? null; },
    setItem(key, value) { if (this.fail?.("set", key)) throw Error("Test storage write failure"); values.set(key, String(value)); },
  };
}
function checkpoint(id = "test-life-1") {
  const game = new Game({ seed: 761 });
  game.runId = id;
  game.hatch();
  game.events = [];
  return snapshotGame(game);
}
const fresh = () => ({ profile: newProfile(), settings: normalizeSettings(), run: null });

test("legacy progress migrates to a verified journal without losing currency, ownership or controls", () => {
  const storage = memoryStorage(), p = newProfile();
  p.dna = 37; p.pets = ["compy"]; p.claimedFinds = ["already-awarded"];
  storage.setItem(PROFILE_KEY, JSON.stringify(p));
  storage.setItem(SETTINGS_KEY, JSON.stringify({ music: .2, controls: { ability: "KeyZ" }, uiScale: 1.2, reducedMotion: true }));
  const store = new SaveStore(storage), loaded = store.load();
  assert.equal(loaded.profile.dna, 37);
  assert.deepEqual(loaded.profile.pets, ["compy"]);
  assert.equal(loaded.settings.controls.ability, "KeyZ");
  assert.equal(loaded.settings.uiScale, 1.2);
  assert.ok(store.commit({ ...loaded, run: checkpoint() }).ok);
  const restored = new SaveStore(storage).load();
  assert.equal(restored.profile.dna, 37);
  assert.deepEqual(restored.profile.claimedFinds, ["already-awarded"]);
  assert.equal(restoreGame(restored.run).seed, 761);
  assert.equal(JSON.parse(storage.getItem(PROFILE_KEY)).dna, 37);
});

test("an interrupted ordinary commit keeps the previous complete profile and run together", () => {
  const storage = memoryStorage(), store = new SaveStore(storage), initial = fresh();
  initial.profile.dna = 9; initial.run = checkpoint();
  assert.ok(store.commit(initial).ok);
  const next = structuredClone(initial); next.profile.dna = 25;
  storage.fail = (op, key) => op === "set" && key === SAVE_KEYS.head;
  assert.equal(store.commit(next).ok, false);
  storage.fail = null;
  const recovered = new SaveStore(storage).load();
  assert.equal(recovered.profile.dna, 9);
  assert.deepEqual(recovered.run, initial.run);
});

test("a damaged current slot recovers the previous verified transaction", () => {
  const storage = memoryStorage(), store = new SaveStore(storage), data = fresh();
  data.profile.dna = 8; assert.ok(store.commit(data).ok);
  data.profile.dna = 19; assert.ok(store.commit(data).ok);
  const head = JSON.parse(storage.getItem(SAVE_KEYS.head));
  storage.setItem(SAVE_KEYS.slots[head.slot], "{truncated");
  const loaded = new SaveStore(storage).load();
  assert.equal(loaded.profile.dna, 8);
  assert.equal(loaded.recovered, true);
  assert.equal(loaded.failed, false);
});

test("a stale game window cannot overwrite a newer committed profile", () => {
  const storage = memoryStorage(), first = new SaveStore(storage), data = fresh();
  assert.ok(first.commit(data).ok);
  const second = new SaveStore(storage), secondData = second.load();
  data.profile.dna = 25; assert.ok(first.commit(data).ok);
  secondData.profile.dna = 2;
  assert.equal(second.commit(secondData).ok, false);
  assert.equal(new SaveStore(storage).load().profile.dna, 25);
});

test("permadeath rolls its final profile forward even if the head update fails", () => {
  const storage = memoryStorage(), store = new SaveStore(storage), data = fresh();
  data.run = checkpoint("last-life"); assert.ok(store.commit(data).ok);
  const results = { runId: "last-life", speciesId: "compsognathus", score: 99, kills: 3, tier: 0, time: 60 };
  recordRun(data.profile, results);
  storage.fail = (op, key) => op === "set" && key === SAVE_KEYS.head;
  const terminal = store.commit({ ...data, run: null, terminalRunId: "last-life" });
  assert.equal(terminal.ok, true, "the verified death receipt is a durable commit point");
  storage.fail = null;
  const loaded = new SaveStore(storage).load();
  assert.equal(loaded.run, null);
  assert.equal(loaded.profile.runs, 1);
  assert.equal(loaded.profile.bestScore, 99);
  assert.ok(loaded.terminalRuns.includes("last-life"));
  recordRun(loaded.profile, results);
  assert.equal(loaded.profile.runs, 1, "recovery cannot record the same death twice");
});

test("a failed death commit still protects backup import and emergency export in the current window", () => {
  const storage = memoryStorage(), store = new SaveStore(storage), data = fresh();
  data.run = checkpoint("failed-terminal-life"); assert.ok(store.commit(data).ok);
  const livingBackup = store.exportBackup();
  storage.fail = (op) => op === "set";
  assert.equal(store.commit({ ...data, run: null, terminalRunId: "failed-terminal-life" }).ok, false);
  const preview = store.previewBackup(livingBackup);
  assert.ok(preview.ok);
  assert.equal(preview.data.run, null);
  const emergency = JSON.parse(store.exportBackup({ ...data, run: null }));
  assert.ok(emergency.terminalRuns.includes("failed-terminal-life"));
  storage.fail = null;
  assert.ok(store.importBackup(livingBackup).ok);
  assert.equal(new SaveStore(storage).load().run, null);
});

test("a dead run cannot return from the fallback slot or an old exported backup", () => {
  const storage = memoryStorage(), store = new SaveStore(storage), data = fresh();
  data.run = checkpoint("ended-life"); assert.ok(store.commit(data).ok);
  const oldBackup = store.exportBackup();
  assert.ok(store.commit({ ...data, run: null, terminalRunId: "ended-life" }).ok);
  const head = JSON.parse(storage.getItem(SAVE_KEYS.head));
  storage.setItem(SAVE_KEYS.slots[head.slot], "damaged terminal slot");
  const recoveredStore = new SaveStore(storage), loaded = recoveredStore.load();
  assert.equal(loaded.run, null);
  const preview = recoveredStore.previewBackup(oldBackup);
  assert.ok(preview.ok);
  assert.equal(preview.data.run, null);
  assert.equal(preview.warnings.length, 1);
  assert.ok(recoveredStore.importBackup(oldBackup).ok);
  assert.equal(new SaveStore(storage).load().run, null);
  assert.equal(recoveredStore.commit({ ...data, run: checkpoint("ended-life") }).ok, false);
});

test("importing a different living backup retires the replaced life and alternating backups cannot revive it", () => {
  const storage = memoryStorage(), store = new SaveStore(storage);
  assert.ok(store.commit({ ...fresh(), run: checkpoint("life-A") }).ok);
  const backupA = store.exportBackup();
  const other = new SaveStore(memoryStorage());
  assert.ok(other.commit({ ...fresh(), run: checkpoint("life-B") }).ok);
  const backupB = other.exportBackup(), preview = store.previewBackup(backupB);
  assert.ok(preview.ok);
  assert.match(preview.warnings[0], /replaces your current expedition/);
  assert.ok(store.importBackup(backupB).ok);
  assert.equal(new SaveStore(storage).load().run.runId, "life-B");
  const oldA = store.previewBackup(backupA);
  assert.ok(oldA.ok);
  assert.equal(oldA.data.run, null);
  assert.ok(store.importBackup(backupA).ok);
  assert.equal(store.previewBackup(backupB).data.run, null);
  assert.equal(new SaveStore(storage).load().run, null);
});

test("a failed import write leaves the outgoing life available, while a failed final head recovers the incoming life", () => {
  const storage = memoryStorage(), store = new SaveStore(storage);
  assert.ok(store.commit({ ...fresh(), run: checkpoint("outgoing-life") }).ok);
  const other = new SaveStore(memoryStorage());
  assert.ok(other.commit({ ...fresh(), run: checkpoint("incoming-life") }).ok);
  const backup = other.exportBackup();
  storage.fail = (op, key) => op === "set" && SAVE_KEYS.slots.includes(key);
  assert.equal(store.importBackup(backup).ok, false);
  storage.fail = null;
  assert.equal(new SaveStore(storage).load().run.runId, "outgoing-life");
  storage.fail = (op, key) => op === "set" && key === SAVE_KEYS.head;
  assert.ok(store.importBackup(backup).ok);
  storage.fail = null;
  const recovered = new SaveStore(storage).load();
  assert.equal(recovered.run.runId, "incoming-life");
  assert.ok(recovered.terminalRuns.includes("outgoing-life"));
});

test("backup review is read-only and damaged files cannot replace progress", () => {
  const storage = memoryStorage(), store = new SaveStore(storage), data = fresh();
  data.profile.dna = 17; assert.ok(store.commit(data).ok);
  const exported = store.exportBackup(), before = [...storage.values];
  assert.ok(store.previewBackup(exported).ok);
  assert.deepEqual([...storage.values], before);
  const forged = JSON.parse(exported); forged.data.profile.dna = 999;
  assert.equal(store.previewBackup(JSON.stringify(forged)).ok, false);
  assert.equal(store.importBackup(JSON.stringify(forged)).ok, false);
  assert.deepEqual([...storage.values], before);
  assert.equal(new SaveStore(storage).load().profile.dna, 17);
});

test("restoring an earlier living checkpoint cannot re-award local receipt or achievement rewards", () => {
  const storage = memoryStorage(), store = new SaveStore(storage), data = fresh();
  data.run = checkpoint(); assert.ok(store.commit(data).ok);
  const beforeFind = store.exportBackup();
  assert.ok(awardRareDNA(data.profile, "rare-in-this-life", 2));
  data.profile.claimedAchievements.push("first-evolution");
  assert.ok(store.commit(data).ok);
  const imported = store.importBackup(beforeFind);
  assert.ok(imported.ok);
  assert.equal(awardRareDNA(imported.data.profile, "rare-in-this-life", 2), false);
  assert.ok(imported.data.profile.claimedAchievements.includes("first-evolution"));
});

test("one living expedition retains reward receipts after the legacy 2048-entry window rolls over", () => {
  const storage = memoryStorage(), store = new SaveStore(storage), data = fresh();
  data.run = checkpoint(); assert.ok(store.commit(data).ok);
  const early = store.exportBackup();
  for (let i = 0; i < 2300; i++) assert.ok(awardRareDNA(data.profile, "long-life-find-" + i, 1));
  assert.equal(data.profile.claimedFinds.length, 2048);
  assert.equal(data.profile.activeFindClaims.length, 2300);
  assert.ok(store.commit(data).ok);
  const restored = store.importBackup(early);
  assert.ok(restored.ok);
  assert.equal(restored.data.profile.activeFindClaims.length, 2300);
  assert.equal(awardRareDNA(restored.data.profile, "long-life-find-0", 1), false);
  assert.equal(new SaveStore(storage).load().profile.activeFindClaims.length, 2300);
});

test("oversized live reward ledgers fail explicitly instead of silently evicting receipts", () => {
  const store = new SaveStore(memoryStorage()), data = fresh();
  data.profile.activeFindClaims = Array(MAX_ACTIVE_CLAIMS + 1).fill("receipt");
  const result = store.commit(data);
  assert.equal(result.ok, false);
  assert.match(result.error, /reward-history budget/);
  assert.equal(data.profile.activeFindClaims.length, MAX_ACTIVE_CLAIMS + 1);
});

test("unavailable storage and damaged terminal ledgers fail safely instead of reviving a checkpoint", () => {
  const unavailable = { getItem() { throw Error("Disabled"); }, setItem() { throw Error("Disabled"); } };
  const store = new SaveStore(unavailable), loaded = store.load();
  assert.equal(loaded.failed, true);
  assert.equal(store.commit(fresh()).ok, false);
  const memory = fresh(); memory.profile.dna = 91;
  const emergency = JSON.parse(store.exportBackup(memory));
  assert.equal(emergency.data.profile.dna, 91, "a denied store can still export current in-memory progress");
  const storage = memoryStorage(), previous = new SaveStore(storage);
  assert.ok(previous.commit({ ...fresh(), run: checkpoint() }).ok);
  const validBackup = previous.exportBackup();
  storage.setItem(SAVE_KEYS.terminal, "broken");
  const safe = new SaveStore(storage), result = safe.load();
  assert.equal(result.run, null);
  assert.equal(result.failed, true);
  assert.equal(safe.commit(fresh()).ok, false);
  const repair = safe.previewBackup(validBackup);
  assert.ok(repair.ok);
  assert.equal(repair.data.run, null);
  assert.match(repair.warnings[0], /permanent progress only/);
  assert.ok(safe.importBackup(validBackup).ok);
  assert.equal(new SaveStore(storage).load().run, null);
});

test("slot checksums detect edited data and future backup versions are rejected", () => {
  const storage = memoryStorage(), store = new SaveStore(storage);
  assert.ok(store.commit(fresh()).ok);
  const future = JSON.parse(store.exportBackup());
  const { checksum: previousChecksum, ...body } = future;
  body.version = 999;
  assert.equal(store.previewBackup(JSON.stringify({ ...body, checksum: saveChecksum(JSON.stringify(body)) })).ok, false);
  const head = JSON.parse(storage.getItem(SAVE_KEYS.head));
  const slot = JSON.parse(storage.getItem(SAVE_KEYS.slots[head.slot]));
  slot.data.profile.dna = 9999;
  storage.setItem(SAVE_KEYS.slots[head.slot], JSON.stringify(slot));
  const loaded = new SaveStore(storage).load();
  assert.equal(loaded.profile.dna, 0);
  assert.equal(loaded.recovered, true);
});

test("settings normalization bounds accessibility values and keeps default control objects independent", () => {
  const a = normalizeSettings(), b = normalizeSettings();
  a.controls.ability = "KeyZ";
  assert.equal(b.controls.ability, "KeyQ");
  const s = normalizeSettings({ uiScale: 500, gamepad: false, reducedMotion: true, controls: { ability: "Escape" } });
  assert.equal(s.uiScale, 1.25);
  assert.equal(s.gamepad, false);
  assert.equal(s.reducedMotion, true);
  assert.equal(s.controls.ability, "KeyQ");
});

test("a save from a newer journal or content version is preserved without downgrade writes", () => {
  const storage = memoryStorage(), store = new SaveStore(storage);
  assert.ok(store.commit(fresh()).ok);
  const head = JSON.parse(storage.getItem(SAVE_KEYS.head));
  const slot = JSON.parse(storage.getItem(SAVE_KEYS.slots[head.slot]));
  const { checksum, ...body } = slot; body.version = 2;
  storage.setItem(SAVE_KEYS.slots[head.slot], JSON.stringify({ ...body, checksum: saveChecksum(JSON.stringify(body)) }));
  const before = [...storage.values], older = new SaveStore(storage);
  assert.equal(older.load().failed, true);
  assert.equal(older.commit(fresh()).ok, false);
  assert.deepEqual([...storage.values], before);
  storage.setItem(SAVE_KEYS.terminal, "damaged ledger");
  const combined = new SaveStore(storage); combined.load();
  assert.equal(combined.previewBackup(store.exportBackup()).ok, false, "ledger repair cannot downgrade a future-version journal");
});
