import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { SPECIES_BY_ID } from "../src/data.js";
import { neutralGenome, acquiredAdaptations, phenotype } from "../src/genetics.js";
import { eligibleBloodlines } from "../src/progression.js";
import { recordExploration, landmarkPosition } from "../src/discoveries.js";
import { conditionsAt } from "../src/world-events.js";
import { updateSurvival, survivalStatus, movementMode } from "../src/survival.js";
import { snapshotGame, restoreGame } from "../src/run-state.js";
import { perceivePlayer } from "../src/senses.js";

function isolated(speciesId = "velociraptor", seed = 1920) {
  const game = new Game({ seed, runId: `immersion-${seed}` }); game.hatch();
  game.entities = []; game.foods = []; game.lairs = []; game.nests = []; game.worldFeatures = [];
  game.chunks.clear(); game.marineState = new Map();
  game._streamWorld = () => {}; game._replenish = () => {}; game._nextBoss = 1e9;
  game.player.speciesId = speciesId; game.tier = game.species.tier;
  game.player.genome = neutralGenome(); game.formHistory = [speciesId];
  game.refreshStats(true); game.player.invulnerable = 10000; game.events = [];
  return game;
}
function feature(type, x = 0, y = 0, radius = 100) {
  return { id: `test-${type}`, type, x, y, radius, tier: 1, phase: 0, solid: type === "boulder" };
}
function advance(game, seconds, input = {}) {
  for (let i = 0; i < Math.round(seconds * 10); i++) game.update(.1, typeof input === "function" ? input(i) : input);
}
function discover(game, id) {
  Object.assign(game.player, landmarkPosition(id));
  recordExploration(game);
}
const ready = (game) => { game.gainXP(game.nextThreshold); assert.equal(game.openEvolution(), true); };
const hasPath = (game, id) => eligibleBloodlines(game).some((path) => path.id === id);

test("aquatic anatomy swims faster than it crosses land and crouch dives only compatible forms", () => {
  const wet = isolated("tideweaver"), land = isolated("tideweaver"), terrestrial = isolated("velociraptor");
  wet.worldFeatures = [feature("water")]; terrestrial.worldFeatures = [feature("water")];
  advance(wet, 1.5, { x: 1 }); advance(land, 1.5, { x: 1 });
  assert.ok(wet.player.x > land.player.x * 1.6);
  assert.equal(movementMode(wet.species), "aquatic");
  wet.update(.1, { x: 1, crouch: true }); terrestrial.update(.1, { x: 1, crouch: true });
  assert.equal(wet.player.submerged, true); assert.equal(survivalStatus(wet).label, "DIVING");
  assert.equal(terrestrial.player.submerged, false); assert.equal(terrestrial.player.crouching, true);
  wet.update(.1, { x: 1, crouch: true, sprint: true });
  assert.equal(wet.player.crouching, false); assert.equal(wet.player.submerged, false);
  assert.equal(wet.player.hp, wet.player.maxHp, "movement and diving do not harm the swimmer");
});

test("real crouch input slows walking while sprint overrides posture without requiring an extra toggle", () => {
  const walking = isolated(), crouching = isolated();
  advance(walking, 1, { x: 1 }); advance(crouching, 1, { x: 1, crouch: true });
  assert.ok(crouching.player.x < walking.player.x * .7);
  assert.ok(crouching.player.x > 0); assert.equal(crouching.player.crouching, true);
  crouching.update(.1, { x: 1, sprint: true, crouch: true });
  assert.equal(crouching.player.crouching, false);
  assert.ok(crouching.survival.fatigue > 0);
});

test("a substantial predator wound causes temporary strain that recovers faster at rest and with a real meal", () => {
  const resting = isolated(), moving = isolated();
  for (const game of [resting, moving]) {
    game.player.invulnerable = 0;
    assert.ok(game.damagePlayer(game.player.maxHp * .3, "Rival bite"));
    assert.equal(game.survival.strain, 12);
    assert.ok(game.player.hp < game.player.maxHp);
    game.player.invulnerable = 10000;
  }
  advance(resting, 1); advance(moving, 1, { x: 1 });
  assert.ok(resting.survival.strain < moving.survival.strain);
  const before = resting.survival.strain;
  resting.spawnFood("meat", resting.player.x, resting.player.y, 10, { tier: resting.tier });
  assert.ok(resting.eat()); assert.equal(resting.survival.strain, Math.max(0, before - 3));
  advance(resting, 5);
  assert.equal(resting.survival.strain, 0);
});

test("cold exposure has an opening grace, readable warnings before real harm, and recovery in shelter", () => {
  const game = isolated("velociraptor", 1921);
  Object.assign(game.player, landmarkPosition("frost-observatory"));
  let extremeClock = null;
  for (let clock = 2160; clock < 3600; clock += 5) {
    game.worldState.clock = clock;
    if (conditionsAt(game, game.player.x, game.player.y).temperature <= -25) { extremeClock = clock; break; }
  }
  assert.notEqual(extremeClock, null, "the tested cold profile must be naturally reachable");
  game.worldState.clock = extremeClock;
  // Isolate the exposure response within one real regional weather profile.
  const originalHp = game.player.hp;
  for (let i = 0; i < 50; i++) { game.time = i; updateSurvival(game, 1, {}, false); }
  assert.equal(game.survival.temperature, 0); assert.equal(game.player.hp, originalHp);
  let firstWarning = null, firstDamage = null;
  for (let i = 0; i < 100; i++) {
    game.time = 100 + i; updateSurvival(game, 1, {}, false);
    if (firstWarning === null && game.events.some((event) => event.type === "warning" && event.text.includes("Exposure"))) firstWarning = i;
    if (firstDamage === null && game.player.hp < originalHp) firstDamage = i;
  }
  assert.notEqual(firstWarning, null); assert.notEqual(firstDamage, null);
  assert.ok(firstWarning < firstDamage - 20);
  assert.ok(firstDamage > 60, "exposure must give time to leave");
  const hpAfterCold = game.player.hp;
  game.player.x = 0; game.player.y = 0;
  for (let i = 0; i < 50; i++) { game.time++; updateSurvival(game, 1, {}, false); }
  assert.ok(Math.abs(game.survival.temperature) < .2);
  assert.ok(hpAfterCold - game.player.hp < game.player.maxHp * .01, "only the brief cooling transition can still hurt");
  const recoveredHp = game.player.hp;
  for (let i = 0; i < 10; i++) { game.time++; updateSurvival(game, 1, {}, false); }
  assert.equal(game.player.hp, recoveredHp);
});

test("earned exposure requires healthy actual travel; stationary or blocked input cannot farm adaptations", () => {
  const game = isolated(); game.worldFeatures = [feature("water")];
  advance(game, 2); assert.equal(game.player.adaptations.water, 0);
  game.player.hunger = 0; game.player.hp = game.player.maxHp * .3;
  advance(game, 1, { x: 1 }); assert.equal(game.player.adaptations.water, 0);
  game.player.hp = game.player.maxHp; game.player.hunger = 100;
  advance(game, 1, { x: -1 }); assert.ok(game.player.adaptations.water > .5);
  const wall = isolated(); wall.worldFeatures = [feature("water"), feature("boulder", 8, 0, 3)];
  advance(wall, 5, { x: 1, crouch: true });
  const stoppedX = wall.player.x, water = wall.player.adaptations.water, stealth = wall.player.adaptations.stealth;
  advance(wall, 5, { x: 1, crouch: true });
  assert.ok(Math.abs(wall.player.x - stoppedX) < .001);
  assert.ok(wall.player.adaptations.water - water < .11);
  assert.ok(wall.player.adaptations.stealth - stealth < .11);
  advance(game, 75, (i) => ({ x: Math.cos(i / 15), y: Math.sin(i / 15) }));
  assert.ok(acquiredAdaptations(game.player.adaptations).includes("water"));
  assert.equal(game.events.filter((event) => event.type === "adaptation" && event.id === "water").length, 1);
  const fresh = new Game({ seed: game.seed, ancestorGenome: game.player.genome });
  assert.deepEqual(acquiredAdaptations(fresh.player.adaptations), []);
  assert.equal(fresh.player.adaptations.water, 0);
});

test("stealth acclimation requires cover and absence of a creature that can currently see the player", () => {
  const game = isolated(); game.worldFeatures = [feature("fallen-log", 0, 0, 3)];
  const observer = game.spawnEntity("velociraptor", 12, 0, { passive: true, nutrients: 0 });
  observer.sensory = { nextCheck: 1e6, detected: true, visible: true, x: 0, y: 0, expires: 1e6, channel: "sight" };
  game._updateEntity = () => {};
  game.update(.1, { x: 1, crouch: true }); assert.equal(game.player.adaptations.stealth, 0);
  observer.sensory.visible = false;
  game.update(.1, { x: 1, crouch: true }); assert.ok(game.player.adaptations.stealth > 0);
});

test("Tideweaver is earned through a real discovery and healthy swimming, while water genes only shorten its challenge", () => {
  const game = isolated(); discover(game, "tidal-archive");
  game.worldFeatures = [feature("water", game.player.x, game.player.y)];
  assert.equal(hasPath(game, "tidal-memory"), false);
  game.state = "evolution"; game.player.xp = game.nextThreshold;
  game.evolutionChoices = ["tideweaver"]; game.mutationChoices = ["razor"];
  assert.equal(game.evolve("tideweaver", "razor"), false, "forged offers cannot bypass an earned path");
  game.state = "playing"; game.evolutionChoices = []; game.mutationChoices = [];
  advance(game, 25.2, (i) => ({ x: Math.cos(i / 15), y: Math.sin(i / 15) }));
  assert.ok(game.player.adaptations.water >= 25); assert.equal(hasPath(game, "tidal-memory"), true);
  ready(game); assert.ok(game.evolutionChoices.includes("tideweaver"));
  const genome = structuredClone(game.player.genome), previousSize = game.effectiveSize;
  assert.ok(game.evolve("tideweaver", game.mutationChoices[0]));
  assert.deepEqual(game.player.genome, genome); assert.ok(game.effectiveSize >= previousSize * 1.06 - 1e-9);
  assert.ok(game.formHistory.includes("tideweaver"));
  const affinity = isolated(); discover(affinity, "tidal-archive");
  const waterGenome = neutralGenome(); waterGenome.alleles.aquatic = 70;
  affinity.player.genome = waterGenome; affinity.player.adaptations.water = 14.9;
  assert.ok(phenotype(affinity.player.genome).adaptations.includes("water"));
  assert.equal(hasPath(affinity, "tidal-memory"), false);
  affinity.player.adaptations.water = 15; assert.equal(hasPath(affinity, "tidal-memory"), true);
  affinity.exploration.discoveries = []; assert.equal(hasPath(affinity, "tidal-memory"), false);
});

test("Abyssal dynasty remembers an actual earlier form, actual guardian victory and lore through save/restore", () => {
  const game = isolated(); discover(game, "tidal-archive"); game.player.adaptations.water = 25;
  ready(game); assert.ok(game.evolve("tideweaver", game.mutationChoices[0]));
  ready(game); const middle = game.evolutionChoices.find((id) => !SPECIES_BY_ID[id].bloodline);
  assert.ok(game.evolve(middle, game.mutationChoices[0])); assert.equal(game.tier, 3);
  discover(game, "abyssal-tooth"); assert.equal(hasPath(game, "abyssal-dynasty"), false);
  const guardian = game.spawnEntity("velociraptor", game.player.x + 1, game.player.y, {
    passive: true, nutrients: 0, boss: true, lairId: "marshfang",
  });
  const ownHp = game.player.hp; game._hitEntity(guardian, guardian.maxHp * 2);
  assert.equal(game.guardianKills, 1); assert.ok(game.player.hp >= ownHp, "a player's own hit cannot damage its caster");
  assert.equal(hasPath(game, "abyssal-dynasty"), true);
  ready(game); assert.ok(game.evolutionChoices.includes("abyssal-kronosaur"));
  const checkpoint = snapshotGame(game), restored = restoreGame(checkpoint);
  assert.deepEqual(restored.formHistory, game.formHistory); assert.equal(restored.guardianKills, 1);
  const mutation = game.mutationChoices[0], body = game.effectiveSize;
  assert.ok(game.evolve("abyssal-kronosaur", mutation));
  assert.ok(restored.evolve("abyssal-kronosaur", mutation));
  assert.ok(game.effectiveSize >= body * 1.06 - 1e-9);
  assert.deepEqual(snapshotGame(restored), snapshotGame(game));
  assert.ok(game.lineage.used.includes("abyssal-dynasty"));
});

test("marine attacks damage real targets without harming the player, and genetic resistance affects NPC damage", () => {
  const game = isolated("abyssal-kronosaur");
  const vulnerableGenome = neutralGenome(), armoredGenome = neutralGenome();
  vulnerableGenome.alleles.hide = -100; armoredGenome.alleles.hide = 100;
  const a = game.spawnEntity("tyrannosaurus", 5, 0, { passive: true, nutrients: 0, genome: vulnerableGenome }),
    b = game.spawnEntity("tyrannosaurus", 5, 1, { passive: true, nutrients: 0, genome: armoredGenome });
  const aHp = a.hp, bHp = b.hp, ownHp = game.player.hp;
  game._hitEntity(a, 20); game._hitEntity(b, 20);
  assert.ok(aHp - a.hp > bHp - b.hp);
  game.player.angle = 0;
  assert.ok(game.ability());
  assert.ok(a.hp < aHp - 20); assert.ok(b.hp < bHp - 19);
  assert.equal(game.player.hp, ownHp);
});

test("water affinity and earned acclimation improve actual swimming once and give no dry-land speed bonus", () => {
  const groups = ["plain", "earned", "inherited", "both"].map((type) => {
    const wet = isolated(), dry = isolated();
    for (const game of [wet, dry]) {
      if (["inherited", "both"].includes(type)) {
        const genome = neutralGenome(); genome.alleles.aquatic = 70; game.player.genome = genome;
      }
      if (["earned", "both"].includes(type)) game.player.adaptations.water = 75;
      game.refreshStats(true);
    }
    wet.worldFeatures = [feature("water")];
    advance(wet, 1.5, { x: 1 }); advance(dry, 1.5, { x: 1 });
    return { type, wet: wet.player.x, dry: dry.player.x };
  });
  const baseline = groups[0];
  for (const sample of groups.slice(1)) {
    assert.ok(Math.abs(sample.wet / baseline.wet - 1.04) < .001, `${sample.type} swims 4% faster without stacking`);
    assert.ok(Math.abs(sample.dry - baseline.dry) < 1e-9, `${sample.type} does not speed up dry travel`);
  }
  const belowThreshold = isolated(); belowThreshold.worldFeatures = [feature("water")];
  belowThreshold.player.adaptations.water = 74.9;
  advance(belowThreshold, .1, { x: 1 });
  const plain = isolated(); plain.worldFeatures = [feature("water")]; advance(plain, .1, { x: 1 });
  assert.equal(belowThreshold.player.x, plain.player.x, "the bonus begins at the earned threshold");
});

test("silent genes or earned stealth reduce crouched sight range once while preserving standing visibility", () => {
  const game = isolated(), observer = game.spawnEntity("velociraptor", 0, 0, { behavior: "hunter", nutrients: 0 });
  observer.angle = 0; game.player.crouching = true;
  const normalRange = (22 + SPECIES_BY_ID.velociraptor.size * 2) * conditionsAt(game, 0, 0).visibilityMultiplier * .62;
  const visible = (distance) => {
    game.player.x = distance; observer.sensory = null;
    return perceivePlayer(game, observer).visible;
  };
  assert.equal(visible(normalRange * .96), true);
  game.player.adaptations.stealth = 59.9;
  assert.equal(visible(normalRange * .96), true);
  game.player.adaptations.stealth = 60;
  assert.equal(visible(normalRange * .96), false, "earned stealth hides the crouched player near the sight boundary");
  game.player.adaptations.stealth = 0;
  const genome = neutralGenome(); genome.alleles.alertness = 70; game.player.genome = genome;
  assert.equal(visible(normalRange * .96), false, "inherited silent affinity provides the same benefit");
  game.player.adaptations.stealth = 60;
  assert.equal(visible(normalRange * .9), true, "both sources cannot stack into a second sight reduction");
  game.player.crouching = false;
  assert.equal(visible(normalRange / .62 * .96), true, "silent adaptations require a crouched posture");
});
