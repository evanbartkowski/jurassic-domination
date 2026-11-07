import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Game } from "../src/game.js";
import { SPECIES_BY_ID } from "../src/data.js";
import { canEatFood } from "../src/forage.js";
import { foodEfficiency } from "../src/world-data.js";
import { LocalAuthority, TICK_RATE } from "../src/simulation.js";
import { snapshotGame, restoreGame } from "../src/run-state.js";
import { createBalanceRecorder, summarizeBalance } from '../src/balance-metrics.js';
import { BLOODLINES } from '../src/progression.js';

const args = process.argv.slice(2), options = { runs: 100, seconds: 120, seed: 1, difficulty: "survival", report: "artifacts/simulation-report.json" };
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--help") {
    console.log("node scripts/simulate.mjs [--runs 100] [--seconds 120] [--seed 1] [--difficulty survival] [--report artifacts/simulation-report.json]");
    process.exit(0);
  }
  const key = args[i].slice(2);
  if (!args[i].startsWith("--") || !Object.hasOwn(options, key) || args[i + 1] === undefined) throw Error(`Unknown or missing option: ${args[i]}`);
  options[key] = ["runs", "seconds", "seed"].includes(key) ? Number(args[++i]) : args[++i];
}
if (!Number.isInteger(options.runs) || options.runs < 1 || options.runs > 10000 || !Number.isFinite(options.seconds) || options.seconds < 1 || options.seconds > 7200 || !Number.isInteger(options.seed) || !["explorer", "survival", "extinction"].includes(options.difficulty)) throw Error("Invalid simulation options");
const report = { version: 1, generatedAt: new Date().toISOString(), options, policy: "forage-hunt-v1", notes: [
  "These are deterministic intent-driven bots, not a measurement of experienced human success rates.",
  "No health, invulnerability, experience, currency, world population or evolution requirements are modified.",
  "Elapsed CPU and frame statistics describe the renderer-free simulation on this machine, not GPU FPS.",
], attempts: [], failures: [], summary: {} };
const globalStart = performance.now(), ticks = [];
const sq = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
function intent(g, brain) {
  const p = g.player;
  let meal = null, mealScore = Infinity, prey = null, preyScore = Infinity, threat = null, threatDistance = Infinity;
  for (const e of g.entities) {
    const distance = sq(e, p), species = SPECIES_BY_ID[e.speciesId];
    if ((species.tier > g.tier || e.boss) && distance < threatDistance && distance < 22 ** 2) { threat = e; threatDistance = distance; }
    if (!e.boss && species.tier <= g.tier && distance < preyScore && distance < 60 ** 2) { prey = e; preyScore = distance; }
  }
  for (const f of g.foods) {
    if (!canEatFood(g.species, f)) continue;
    const score = sq(f, p) / Math.max(.1, foodEfficiency(g.tier, f.tier || 0));
    if (score < mealScore) { meal = f; mealScore = score; }
  }
  let target = meal && (p.hunger < 75 || p.hp < p.maxHp * .7 || !prey) ? meal : prey || meal;
  const fleeing = threat && (threatDistance < 10 ** 2 || p.hp < p.maxHp * .45);
  let angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : g.time * .07 + brain.heading;
  if (fleeing) angle = Math.atan2(p.y - threat.y, p.x - threat.x);
  if (g.time >= brain.checkAt) {
    if (Math.hypot(p.x - brain.x, p.y - brain.y) < .6) brain.avoidUntil = g.time + 2;
    brain.x = p.x; brain.y = p.y; brain.checkAt = g.time + 3;
  }
  if (g.time < brain.avoidUntil) angle += Math.PI * .65;
  const close = prey && preyScore < (4 + g.effectiveSize) ** 2;
  return { x: Math.cos(angle), y: Math.sin(angle), aim: close && !fleeing ? Math.atan2(prey.y - p.y, prey.x - p.x) : angle,
    eat: true, attack: !!close, ability: !!close, technique: !!close || p.hp < p.maxHp * .5,
    special: !!close || p.hp < p.maxHp * .5, skill: close && g.runSkills.length ? 0 : -1,
    sprint: !!fleeing && p.stamina > 25, dash: !!fleeing && threatDistance < 7 ** 2 && p.stamina > 40 };
}
for (let attempt = 0; attempt < options.runs; attempt++) {
  const seed = (options.seed + attempt) >>> 0, g = new Game({ seed, difficulty: options.difficulty, runId: `sim-${seed}-${options.difficulty}` }), authority = new LocalAuthority(g, { maxReplayEntries: 0 });
  const brain = { x: 0, y: 0, checkAt: 3, avoidUntil: 0, heading: seed * 2.399963 };
  const row = { seed, tier: 1, kills: 0, survivedSeconds: 0, cause: "time limit", maxEntities: 0, maxFoods: 0, maxActiveChunks: 0, storedChunks: 0, snapshotBytes: 0, restoreParity: false };
  try {
    authority.dispatch({ type: "hatch" });
    const recorder = createBalanceRecorder(g);
    const limit = Math.round(options.seconds * TICK_RATE);
    for (let tick = 0; tick < limit && g.state !== "dead"; tick++) {
      if (g.evolutionReady && authority.dispatch({ type: "open-evolution" }).ok) {
        recorder.sample(g);
        const speciesId = [...g.evolutionChoices].sort((a, b) => {
          const x = SPECIES_BY_ID[a], y = SPECIES_BY_ID[b];
          return y.hp * y.damage * y.speed - x.hp * x.damage * x.speed;
        })[0];
        const preferred = ["vitality", "ironhide", "swift", "razor", "metabolism"];
        const mutationId = preferred.find((id) => g.mutationChoices.includes(id)) || g.mutationChoices[0];
        if (!authority.dispatch({ type: "evolve", speciesId, mutationId }).ok) throw Error("Valid offered evolution rejected");
      }
      const input = intent(g, brain), start = performance.now(), result = authority.step(input), elapsed = performance.now() - start;
      if (!result.ok) throw Error(result.error);
      if (tick % 30 === 0) ticks.push(elapsed);
      if (!Number.isFinite(g.player.x + g.player.y + g.player.hp + g.player.score) || g.entities.length > 512 || g.foods.length > 4096 || g.activeChunks.size > 9 || g.projectiles.length > 512) throw Error("State or population budget exceeded");
      row.maxEntities = Math.max(row.maxEntities, g.entities.length); row.maxFoods = Math.max(row.maxFoods, g.foods.length); row.maxActiveChunks = Math.max(row.maxActiveChunks, g.activeChunks.size);
      recorder.sample(g, g.consumeEvents(), tick % 30 === 0 ? elapsed : undefined);
    }
    const checkpoint = snapshotGame(g), restored = restoreGame(checkpoint);
    row.snapshotBytes = Buffer.byteLength(JSON.stringify(checkpoint));
    row.restoreParity = JSON.stringify(snapshotGame(restored)) === JSON.stringify(checkpoint);
    if (!row.restoreParity) throw Error("Checkpoint roundtrip differs");
    Object.assign(row, { tier: g.tier + 1, kills: g.player.kills, survivedSeconds: g.time, cause: g.state === "dead" ? g.cause : "time limit", storedChunks: g.chunks.size });
    row.balance = recorder.finish(g);
  } catch (error) { report.failures.push({ seed, error: error.message }); row.error = error.message; }
  report.attempts.push(row);
  if ((attempt + 1) % Math.max(1, Math.floor(options.runs / 10)) === 0) console.log(`${attempt + 1}/${options.runs} seeded attempts complete`);
}
ticks.sort((a, b) => a - b);
const quantile = (fraction) => ticks[Math.min(ticks.length - 1, Math.floor(ticks.length * fraction))] || 0;
report.summary = { runs: report.attempts.length, failedChecks: report.failures.length, finalTierReached: report.attempts.filter((r) => r.tier === 8).length,
  highestTier: Math.max(...report.attempts.map((r) => r.tier)), deaths: report.attempts.filter((r) => r.cause !== "time limit").length,
  cpuMilliseconds: performance.now() - globalStart, sampledTicks: ticks.length,
  tickMilliseconds: { mean: ticks.reduce((a, b) => a + b, 0) / Math.max(1, ticks.length), p95: quantile(.95), p99: quantile(.99) },
  peakEntities: Math.max(...report.attempts.map((r) => r.maxEntities)), peakFoods: Math.max(...report.attempts.map((r) => r.maxFoods)),
  largestSnapshotBytes: Math.max(...report.attempts.map((r) => r.snapshotBytes)) };
report.summary.balance = summarizeBalance(report.attempts.map(r => r.balance).filter(Boolean), { branchIds: BLOODLINES.map(b => b.speciesId) });
await fs.mkdir(path.dirname(path.resolve(options.report)), { recursive: true });
await fs.writeFile(options.report, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
if (report.failures.length) process.exitCode = 1;
