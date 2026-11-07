import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { SPECIES_BY_ID } from "../src/data.js";
import { makeGenome, phenotype } from "../src/genetics.js";
import { conditionsAt, worldStatus } from "../src/world-events.js";
import { lifeProfile, createNest, initializeLifeEntity, matureEntity, hatchEgg, updateLifeCycle } from "../src/life-cycle.js";
import { MAX_TRAILS, initializeSenses, recordNoise, recordBlood, perceivePlayer, terrainCover, updateSenses } from "../src/senses.js";

function isolated() {
  const game = new Game({ seed: 617 }); game.hatch();
  game.entities = []; game.foods = []; game.nests = []; game.lairs = []; game.worldFeatures = [];
  game._streamWorld = () => {}; game._replenish = () => {}; game._nextBoss = 1e9;
  game.player.invulnerable = 0; game.player.camouflage = 0; game._nextSocialAt = 0;
  initializeSenses(game); game.consumeEvents();
  return game;
}

test("species mature at different playable rates while preserving genetic body size", () => {
  const g = isolated(), fast = SPECIES_BY_ID.velociraptor, slow = SPECIES_BY_ID.brachiosaurus;
  assert(lifeProfile(fast).maturitySeconds < lifeProfile(slow).maturitySeconds);
  const baby = g.spawnEntity(fast.id, 30, 0, { juvenile: true, nutrients: 0 });
  initializeLifeEntity(g, baby);
  baby.genome = makeGenome("test-offspring", fast);
  matureEntity(baby, fast, baby.maturitySeconds / 2);
  assert(baby.juvenile); assert(baby.scaleFactor > 0.65 && baby.scaleFactor < 0.8);
  matureEntity(baby, fast, baby.maturitySeconds / 2);
  assert.equal(baby.juvenile, false);
  assert.equal(baby.scaleFactor, phenotype(baby.genome).size);
  assert.equal(baby.maxHp, baby.adultMaxHp);
});

test("nests produce real inherited offspring and stop replacing young without living parents", () => {
  const g = isolated(), species = SPECIES_BY_ID.protoceratops,
    parent = g.spawnEntity(species.id, 110, 2, { homeChunk: "0,0", passive: true });
  parent.genome = makeGenome("test-parent", species);
  const nest = createNest(g, "0,0", species, 110, 0, () => 0.25);
  assert.deepEqual(nest.parentIds, [parent.id]); assert.equal(nest.eggIds.length, 2);
  const egg = g.foods.find((food) => food.id === nest.eggIds[0]);
  assert.equal(egg.genome.parentSeed, parent.genome.seed);
  egg.age = egg.hatchAfter;
  g.foods = g.foods.filter((food) => food !== egg);
  const baby = hatchEgg(g, egg);
  assert(baby.juvenile); assert.equal(baby.nestId, nest.id);
  assert.deepEqual(baby.parentIds, [parent.id]); assert.equal(nest.born, 1);
  g._updateEntity(baby, 0.05); assert.equal(baby.intent, "follow");
  g.entities = g.entities.filter((entity) => entity !== parent);
  g.foods = []; nest.nextLayAt = 0; g.time = 200;
  updateLifeCycle(g); assert.equal(g.foods.length, 0);
});

test("natural replacement is bounded to three surviving offspring and uses actual eggs", () => {
  const g = isolated(), species = SPECIES_BY_ID.protoceratops;
  g.spawnEntity(species.id, 110, 2, { homeChunk: "0,0", passive: true });
  const nest = createNest(g, "0,0", species, 110, 0, () => 0.25);
  for (const egg of [...g.foods]) { g.foods = g.foods.filter((food) => food !== egg); hatchEgg(g, { ...egg, age: egg.hatchAfter }); }
  g.time = 200; nest.nextLayAt = 0; updateLifeCycle(g);
  assert.equal(g.foods.length, 1);
  const egg = g.foods[0]; g.foods = []; hatchEgg(g, { ...egg, age: egg.hatchAfter });
  g.time = 400; nest.nextLayAt = 0; updateLifeCycle(g);
  assert.equal(g.foods.length, 0); assert.equal(nest.born, 3);
});

test("nest defense protects offspring while unrelated grazers remain neutral", () => {
  const g = isolated(), species = SPECIES_BY_ID.protoceratops,
    parent = g.spawnEntity(species.id, 110, 2, { homeChunk: "0,0", passive: true }),
    other = g.spawnEntity(species.id, 115, 4, { passive: true });
  createNest(g, "0,0", species, 110, 0, () => 0.25);
  g.player.x = 117; g.player.y = 0;
  g._updateEntity(parent, 0.05); g._updateEntity(other, 0.05);
  assert(["hunt", "attack", "casting"].includes(parent.intent));
  assert.equal(other.aggro, 0); assert(["graze", "forage"].includes(other.intent));
});

test("stealing a real egg alerts its nearby parent and empty terrain never creates phantom eggs", () => {
  const g = isolated(), species = SPECIES_BY_ID.protoceratops,
    parent = g.spawnEntity(species.id, 110, 2, { homeChunk: "0,0", passive: true }),
    nest = createNest(g, "0,0", species, 110, 0, () => 0.25);
  g.player.x = 111;
  const stolen = g.foods.find((food) => food.id === nest.eggIds[0]);
  g.onFoodConsumed(stolen); g.foods = g.foods.filter((food) => food !== stolen);
  updateLifeCycle(g);
  assert(parent.aggro > 0); assert.equal(parent.sensory.channel, "nest-theft");
  assert.equal(g.foods.length, 1); assert.equal(nest.eggIds.length, 1);
});

test("an NPC egg raid alerts parents without assigning player aggression", () => {
  const g = isolated(), species = SPECIES_BY_ID.protoceratops,
    parent = g.spawnEntity(species.id, 110, 2, { homeChunk: "0,0", passive: true }),
    nest = createNest(g, "0,0", species, 110, 0, () => 0.25),
    raider = g.spawnEntity("compsognathus", 111, 0);
  g.player.x = 112;
  g.onFoodConsumed(g.foods.find((food) => food.id === nest.eggIds[0]), raider);
  assert.equal(parent.aggro, 0); assert.equal(parent.rivalId, raider.id);
  assert(raider.territoryRetreat.until > g.time);
});

test("territory guards drive weaker competitors away and pack leadership follows adult strength", () => {
  const g = isolated(), species = SPECIES_BY_ID.protoceratops,
    parent = g.spawnEntity(species.id, 110, 2, { homeChunk: "0,0", passive: true }),
    weaker = g.spawnEntity("compsognathus", 112, 2, { passive: true });
  createNest(g, "0,0", species, 110, 0, () => 0.25);
  const scout = g.spawnEntity("velociraptor", 35, 35, { packId: "test-pack" }),
    leader = g.spawnEntity("tyrannosaurus", 36, 35, { packId: "test-pack" });
  updateLifeCycle(g); assert.equal(parent.rivalId, weaker.id);
  g._updateEntity(weaker, 0.05); assert.equal(weaker.intent, "yield");
  assert.equal(leader.groupRole, "leader"); assert.equal(scout.groupRole, "flanker");
});

test("a hidden noisy target is investigated at its last known position without a through-cover attack", () => {
  const g = isolated(); g.player.x = 20;
  g.worldFeatures = [{ type: "boulder", x: 10, y: 0, radius: 3, solid: true }];
  const hunter = g.spawnEntity("velociraptor", 0, 0, { behavior: "hunter" }); hunter.angle = 0;
  g._updateEntity(hunter, 0.05); assert.equal(hunter.sensory.detected, false);
  recordNoise(g, 20, 0, 2); g.time = 0.3;
  const hp = g.player.hp; g._updateEntity(hunter, 0.05);
  assert.equal(hunter.sensory.channel, "sound"); assert.equal(hunter.intent, "track");
  assert.equal(hunter.sensory.x, 20); assert.equal(g.player.hp, hp);
  g.player.x = 90; g.time = 0.6; g._updateEntity(hunter, 0.05);
  assert.equal(hunter.sensory.x, 20);
});

test("crouching beside cover and active camouflage reduce actual visual detection", () => {
  const g = isolated(); g.player.x = 18;
  g.worldFeatures = [{ type: "boulder", x: 19, y: 2, radius: 1.2, solid: true }];
  const hunter = g.spawnEntity("velociraptor", 0, 0, { behavior: "hunter" }); hunter.angle = 0;
  assert(perceivePlayer(g, hunter).visible);
  assert(terrainCover(g, g.player) > 0.4);
  g.player.crouching = true; hunter.sensory = null; assert.equal(perceivePlayer(g, hunter).visible, false);
  g.player.crouching = false; g.player.camouflage = 3; hunter.sensory = null;
  assert.equal(perceivePlayer(g, hunter).visible, false);
});

test("blood is detected farther downwind than upwind and perception is sampled at four Hz", () => {
  const g = isolated(), wind = conditionsAt(g, 0, 0).wind, length = Math.hypot(wind.x, wind.y),
    x = wind.x / length * 28, y = wind.y / length * 28;
  g.player.x = 1000; g.player.y = 1000; recordBlood(g, 0, 0);
  const downwind = g.spawnEntity("velociraptor", x, y, { behavior: "hunter" }),
    upwind = g.spawnEntity("velociraptor", -x, -y, { behavior: "hunter" });
  const sampled = perceivePlayer(g, downwind);
  assert.equal(sampled.channel, "blood"); assert(sampled.detected);
  assert.equal(perceivePlayer(g, upwind).detected, false);
  g.time = 0.2; assert.equal(perceivePlayer(g, downwind), sampled);
  g.time = 0.3; assert.notEqual(perceivePlayer(g, downwind), sampled);
});

test("trails expire and stay bounded and a crouching player does not create sprint noise", () => {
  const g = isolated();
  for (let i = 0; i < 400; i++) recordNoise(g, i, 0);
  assert.equal(g.senses.trails.length, MAX_TRAILS);
  g.time = 20; updateSenses(g, 0.05, {}); assert.equal(g.senses.trails.length, 0);
  g.player.crouching = true; g.player.vx = 5; g.player.x = 5;
  updateSenses(g, 0.05, { sprint: true });
  assert(g.senses.trails.some((trail) => trail.kind === "scent"));
  assert(!g.senses.trails.some((trail) => trail.kind === "sound"));
});

test("procedural nests use living regional residents and protect the initial refuge", () => {
  const g = new Game({ seed: 616 });
  assert(g.nests.length > 0 && g.nests.length <= 9);
  for (const nest of g.nests) {
    assert(Math.hypot(nest.x, nest.y) >= 55 + nest.territoryRadius);
    assert(nest.parentIds.some((id) => g.entities.some((entity) => entity.id === id && entity.nestId === nest.id)));
    assert.equal(g.foods.filter((food) => food.nestId === nest.id).length, 2);
  }
});

test("an actual regional catastrophe can kill wildlife without granting player or guardian credit", () => {
  const g = isolated(); g.player.x = 0; g.player.y = -270;
  conditionsAt(g, g.player.x, g.player.y);
  let hazard;
  for (let time = 180; time < 9000; time += 15) {
    g.worldState.clock = time; const status = worldStatus(g);
    if (status.hazard?.active) { hazard = status.hazard; break; }
  }
  assert(hazard, "fixture must find a seeded, already warned regional catastrophe");
  g.player.x = hazard.x; g.player.y = hazard.y; g.time = 300;
  const creature = g.spawnEntity("compsognathus", hazard.x + 1, hazard.y, { boss: true, lairId: "fixture" });
  g.lairs = [{ id: "fixture", entityId: creature.id, respawn: 40, respawnAt: 0, defeats: 0 }];
  g.boss = { id: creature.id }; creature.hp = 0.01;
  const kills = g.player.kills, score = g.player.score, guardians = g.lineage.guardians;
  g._updateEntity(creature, 0.1);
  assert(!g.entities.includes(creature)); assert(g.foods.some((food) => food.type === "meat"));
  assert.equal(g.player.kills, kills); assert.equal(g.player.score, score); assert.equal(g.lineage.guardians, guardians);
  assert.equal(g.lairs[0].defeats, 0); assert.equal(g.lairs[0].entityId, null); assert.equal(g.lairs[0].respawnAt, 340);
  assert.equal(g.boss, null);
});
