import test from "node:test";
import assert from "node:assert/strict";
import { createBalanceRecorder, summarizeBalance } from "../src/balance-metrics.js";

const game = () => ({ seed: 77, time: 0, tier: 0, state: "playing", cause: "", entities: [],
  player: { speciesId: "compsognathus", x: 0, y: 0 }, evolutionChoices: [],
  exploration: { discoveries: [] } });

test("bounded recorder observes actual choices, species transitions, bosses, discoveries and CPU populations", () => {
  const g = game(), recorder = createBalanceRecorder(g);
  g.time = 10; g.evolutionChoices = ["velociraptor", "dryosaurus"]; recorder.sample(g, [], .2);
  g.time = 12; g.tier = 1; g.player.speciesId = "velociraptor"; g.evolutionChoices = [];
  g.entities = Array.from({ length: 40 }, (_, id) => ({ id, boss: id === 1 })); recorder.sample(g, [], .4);
  g.time = 15; g.entities = []; g.exploration.discoveries = [{ id: "tidal-archive", at: 14 }];
  recorder.sample(g, [{ type: "kill", boss: true, entityId: 1 }]);
  recorder.sample(g, [{ type: "kill", boss: true, entityId: 1 }]);
  g.state = "dead"; g.cause = "test";
  const row = recorder.finish(g);
  assert.equal(row.starterId, "compsognathus"); assert.equal(row.speciesId, "velociraptor");
  assert.deepEqual(row.tierSeconds.slice(0, 2), [12, 3]);
  assert.equal(row.evolutions.length, 1); assert.equal(row.offers.length, 1);
  assert.deepEqual(row.bosses, { encountered: 1, killed: 1 });
  assert.deepEqual(row.discoveries, ["tidal-archive"]);
  assert.equal(row.population[0].totalMs, .2); assert.equal(row.population[1].totalMs, .4);
  assert.equal(row.regionId, "fernwood"); assert.equal(row.ended, true);
});

test("survival summaries distinguish time-limit censoring, observed deaths and unknown historical metrics", () => {
  const summary = summarizeBalance([
    { survivedSeconds: 60, tier: 3, cause: "time limit" },
    { survivedSeconds: 30, tier: 2, cause: "raptor" },
  ], { branchIds: ["hidden-form"] });
  assert.equal(summary.averageObservedDurationSeconds, 45);
  assert.equal(summary.averageCompletedSurvivalSeconds, 30);
  assert.equal(summary.censoredRuns, 1); assert.equal(summary.deaths, 1);
  assert.equal(summary.deathsBySpecies.unknown, 1); assert.equal(summary.deathsByRegion.unknown, 1);
  assert.equal(summary.bosses.killed, null); assert.equal(summary.evolution.completed, null);
  assert.equal(summary.tiers[2].reached, 1); assert.equal(summary.tiers[2].rate, .5);
  assert.deepEqual(summary.unobservedBranches, ["hidden-form"]);
  assert.match(summary.branchReachabilityNote, /not proof/);
});

test("canonical aggregation computes actual pick, discovery, boss and population statistics", () => {
  const g = game(), recorder = createBalanceRecorder(g);
  g.time = 5; g.evolutionChoices = ["velociraptor"]; recorder.sample(g, [], .3);
  g.time = 10; g.tier = 1; g.player.speciesId = "velociraptor"; g.evolutionChoices = [];
  g.exploration.discoveries = [{ id: "first-nest", at: 2 }]; recorder.sample(g, [], .1);
  const summary = summarizeBalance([{ balance: recorder.finish(g) }], { branchIds: ["velociraptor", "secret"] });
  assert.equal(summary.starterPicks.counts.compsognathus, 1);
  assert.equal(summary.evolutionPicks.counts.velociraptor, 1);
  assert.equal(summary.evolution.conversionRate, 1);
  assert.equal(summary.discoveries.counts["first-nest"], 1);
  assert.equal(summary.performanceByPopulation[0].meanTickMs, .2);
  assert.deepEqual(summary.unobservedBranches, ["secret"]);
  assert.equal(summary.bosses.killed, 0); assert.equal(summary.bosses.completionRate, null);
});

test("empty analysis reports unknown averages and rates instead of false zero success", () => {
  const summary = summarizeBalance([]);
  assert.equal(summary.runs, 0); assert.equal(summary.averageObservedDurationSeconds, null);
  assert.equal(summary.averageCompletedSurvivalSeconds, null);
  assert.equal(summary.tiers[0].rate, null); assert.equal(summary.performanceByPopulation[0].meanTickMs, null);
});

test("boss encounters require nearby contact or an actual kill, not a seeded lair ID", () => {
  const g = game(), recorder = createBalanceRecorder(g);
  g.entities = [{ id: 1, boss: true, x: 300, y: 0 }, { id: 2, boss: true, x: 65, y: 0 }];
  recorder.sample(g); recorder.sample(g);
  assert.deepEqual(recorder.finish(g).bosses, { encountered: 1, killed: 0 });
  g.player.x = 240; recorder.sample(g);
  assert.deepEqual(recorder.finish(g).bosses, { encountered: 2, killed: 0 });
  recorder.sample(g, [{ type: "kill", boss: true, entityId: 3 }]);
  assert.deepEqual(recorder.finish(g).bosses, { encountered: 3, killed: 1 });
});
