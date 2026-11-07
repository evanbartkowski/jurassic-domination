import test from "node:test";
import assert from "node:assert/strict";
import { REGIONS } from "../src/world-data.js";
import {
  initializeWorldState, updateWorldEvents, conditionsAt, worldStatus,
  isWorldStateValid, WORLD_SCAR_LIMIT,
} from "../src/world-events.js";
import {
  LANDMARKS, initializeDiscoveryState, recordExploration, discoveryStatus,
  isExplored, hasDiscovery, landmarkPosition, isExplorationStateValid,
  EXPLORATION_CELL_LIMIT, EXPLORATION_GRID_SIZE, EXPLORATION_CELL_SIZE,
} from "../src/discoveries.js";

function world(seed = 123) {
  return { seed, time: 0, player: { x: 0, y: 0 }, events: [], _randomState: 47,
    emit(type, data) { this.events.push({ type, ...data }); } };
}
function point(region) {
  const r = (region.minRadius + region.maxRadius) / 2;
  return { x: r * .8, y: r * (region.side === "north" ? -.6 : .6) };
}
function weatherSample(event, phase = "active") {
  for (let seed = 1; seed < 50; seed++) {
    const g = world(seed); initializeWorldState(g);
    for (let time = 192; time < 1800; time += 12) {
      g.worldState.clock = time;
      for (const region of REGIONS) {
        g.player = point(region);
        const status = worldStatus(g);
        if (status.event === event && status.phase === phase) return { g, status };
      }
    }
  }
  throw new Error(`No deterministic sample for ${event}/${phase}`);
}

test("environment resumes from plain state without consuming creature randomness", () => {
  const g = world(661); initializeWorldState(g); g.player = { x: 850, y: -240 };
  for (let i = 0; i < 870; i++) updateWorldEvents(g, 1);
  const saved = JSON.parse(JSON.stringify(g.worldState));
  assert.ok(isWorldStateValid(saved));
  const peer = world(661); peer.player = { ...g.player }; peer.worldState = saved;
  for (let i = 0; i < 400; i++) {
    updateWorldEvents(g, .05); updateWorldEvents(peer, .05);
    assert.deepEqual(conditionsAt(peer, -510, 430), conditionsAt(g, -510, 430));
  }
  assert.deepEqual(peer.worldState, g.worldState);
  assert.equal(g._randomState, 47); assert.equal(peer._randomState, 47);
});

test("seeded event aftermath is independent of update chunking and bounded", () => {
  const a = world(948), b = world(948);
  for (let i = 0; i < 720; i++) updateWorldEvents(a, 1);
  updateWorldEvents(b, 720);
  assert.deepEqual(a.worldState, b.worldState);
  for (let time = 3600; time < 18000; time += 3600) {
    updateWorldEvents(a, 3600);
    assert.ok(isWorldStateValid(a.worldState));
    assert.ok(a.worldState.scars.length <= WORLD_SCAR_LIMIT);
    assert.ok(a.worldState.scars.every((s) => s.at <= a.worldState.clock && s.expires > Math.floor(a.worldState.clock / 30) * 30));
  }
});

test("rain, drought and frost produce real resource, scent, travel and temperature differences", () => {
  const rain = weatherSample("rain").status, drought = weatherSample("drought").status,
    frost = weatherSample("frost").status, flood = weatherSample("flood").status;
  assert.ok(rain.scentMultiplier < .5 && rain.foodGrowthMultiplier > 1);
  assert.ok(drought.foodGrowthMultiplier < .6);
  assert.ok(frost.movementMultiplier < 1);
  assert.ok(flood.movementMultiplier < .9 && flood.scentMultiplier < rain.scentMultiplier);
  assert.ok(Math.hypot(rain.wind.x, rain.wind.y) > 0);
  assert.ok(Number.isFinite(rain.wind.angle));
});

test("dangerous regional events telegraph fixed avoidable circles before damage and persist aftermath", () => {
  for (const event of ["fire", "eruption", "meteor"]) {
    const { g, status } = weatherSample(event, "warning");
    assert.ok(status.hazard && !status.hazard.active);
    assert.ok(Math.hypot(status.hazard.x, status.hazard.y) > 180);
    g.player = { x: status.hazard.x, y: status.hazard.y };
    assert.equal(conditionsAt(g, g.player.x, g.player.y).hazardDamagePerSecond, 0);
    updateWorldEvents(g, status.remaining + .1);
    const active = worldStatus(g);
    assert.ok(active.hazard.active);
    assert.ok(active.hazardDamagePerSecond > 0 && active.hazardDamagePerSecond <= 4);
    assert.equal(active.hazard.x, status.hazard.x); assert.equal(active.hazard.y, status.hazard.y);
    assert.equal(conditionsAt(g, g.player.x + status.hazard.radius + 2, g.player.y).hazardDamagePerSecond, 0);
    updateWorldEvents(g, active.remaining + 1);
    const aftermath = conditionsAt(g, g.player.x, g.player.y);
    assert.ok(aftermath.scorched && aftermath.foodGrowthMultiplier < .5);
    assert.equal(aftermath.hazardDamagePerSecond, 0);
  }
});

test("hatching basin is damage free while first weather notices are not duplicated on restore", () => {
  const g = world(717);
  for (let i = 0; i < 600; i++) {
    updateWorldEvents(g, .1);
    assert.equal(conditionsAt(g, 0, 0).hazardDamagePerSecond, 0);
  }
  const { g: rainy } = weatherSample("rain");
  updateWorldEvents(rainy, 0);
  const count = rainy.events.length;
  const state = JSON.parse(JSON.stringify(rainy.worldState));
  rainy.worldState = state;
  updateWorldEvents(rainy, 0);
  assert.equal(rainy.events.length, count);
});

test("environment validators reject malformed, unbounded or forged records", () => {
  const g = world(); initializeWorldState(g);
  for (const mutation of [
    (s) => { s.clock = NaN; }, (s) => { s.seed = -1; },
    (s) => { s.scars = new Array(25).fill({}); }, (s) => { s.noticeKey = "a".repeat(129); },
    (s) => { s.scars = [{ id: "bad", event: "flood", regionId: "fernwood" }]; },
  ]) {
    const copy = structuredClone(g.worldState); mutation(copy); assert.equal(isWorldStateValid(copy), false);
  }
});

test("guaranteed lore sites have actionable coordinates, correct regions and unique once-per-life discoveries", () => {
  const g = world(); initializeDiscoveryState(g);
  assert.ok(discoveryStatus(g).next.hint);
  for (const landmark of LANDMARKS) {
    assert.ok(Math.hypot(landmark.x, landmark.y) < 1600);
    g.player = landmarkPosition(landmark.id); g.time += 10;
    assert.deepEqual(recordExploration(g).map((l) => l.id), [landmark.id]);
    assert.ok(hasDiscovery(g, landmark.id));
    assert.ok(isExplored(g, landmark.x, landmark.y));
    assert.equal(recordExploration(g).length, 0);
  }
  assert.equal(g.events.filter((e) => e.type === "discovery").length, LANDMARKS.length);
  assert.equal(discoveryStatus(g).next, null);
  assert.equal(discoveryStatus(g).found, LANDMARKS.length);
  assert.equal(LANDMARKS.find((l) => l.id === "tidal-archive").regionId, "fen");
  assert.equal(LANDMARKS.find((l) => l.id === "abyssal-tooth").regionId, "fen");
  assert.ok(isExplorationStateValid(g.exploration));
});

test("exploration grid is bounded, reveals neighborhoods, and resumes exact journal/travel state", () => {
  const g = world(); recordExploration(g);
  assert.equal(g.exploration.visited.length, 9);
  const peer = world(); peer.exploration = structuredClone(g.exploration);
  for (let i = 0; i < 30; i++) {
    g.player = { x: i * 4, y: i * 2 }; peer.player = { ...g.player };
    recordExploration(g); recordExploration(peer);
  }
  assert.deepEqual(peer.exploration, g.exploration);
  assert.ok(g.exploration.travel > 120 && g.exploration.travel < 140);
  for (let x = 0; x < EXPLORATION_GRID_SIZE; x++) for (let y = 0; y < EXPLORATION_GRID_SIZE; y++) {
    g.player = { x: -1600 + x * EXPLORATION_CELL_SIZE + 40, y: -1600 + y * EXPLORATION_CELL_SIZE + 40 };
    recordExploration(g);
  }
  assert.equal(g.exploration.visited.length, EXPLORATION_CELL_LIMIT);
  assert.ok(isExplorationStateValid(g.exploration));
  assert.equal(isExplored(g, 4000, 0), false);
  const before = g.exploration.travel; g.player = { x: 0, y: 0 }; recordExploration(g);
  assert.equal(g.exploration.travel, before, "teleports do not earn travel");
});

test("exploration validators reject duplicate discoveries, unknown sites and invalid cells", () => {
  const g = world(); recordExploration(g);
  for (const mutation of [
    (s) => { s.visited.push(s.visited[0]); }, (s) => { s.visited = ["40,0"]; },
    (s) => { s.visited = ["01,1"]; }, (s) => { s.discoveries = [{ id: "fictional", at: 0 }]; },
    (s) => { s.discoveries = [{ id: "first-nest", at: 0 }, { id: "first-nest", at: 1 }]; },
    (s) => { s.travel = Infinity; },
  ]) {
    const copy = structuredClone(g.exploration); mutation(copy); assert.equal(isExplorationStateValid(copy), false);
  }
});
