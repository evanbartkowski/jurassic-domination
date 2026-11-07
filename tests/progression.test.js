import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { SPECIES, SPECIES_BY_ID } from "../src/data.js";
import {
  eligibleBloodlines,
  chooseEvolutions,
  creatureKit,
  feedEntity,
} from "../src/progression.js";
function isolated(id = "velociraptor") {
  const g = new Game({ seed: 170 });
  g.hatch();
  g.entities = [];
  g.foods = [];
  g.lairs = [];
  g._streamWorld = () => {};
  g._replenish = () => {};
  g.worldFeatures = [];
  g.player.speciesId = id;
  g.tier = g.species.tier;
  g.refreshStats(true);
  g.player.invulnerable = 0;
  return g;
}
test("energy readiness never pauses or forces the evolution page, and T input opens it", () => {
  const g = isolated();
  g.gainXP(g.nextThreshold);
  assert.equal(g.state, "playing");
  assert.ok(g.evolutionReady);
  const time = g.time;
  g.update(0.1, { x: 1 });
  assert.ok(g.time > time);
  assert.ok(g.player.x > 0);
  g.update(0.05, { evolve: true });
  assert.equal(g.state, "evolution");
});
test("postponing evolution preserves offers, mutations, energy and condition rewards", () => {
  const g = isolated();
  g.gainXP(g.nextThreshold);
  g.openEvolution();
  const choices = [...g.evolutionChoices],
    mutations = [...g.mutationChoices],
    xp = g.player.xp;
  g.closeEvolution();
  g.update(0.05);
  assert.equal(g.state, "playing");
  g.openEvolution();
  assert.deepEqual(g.evolutionChoices, choices);
  assert.deepEqual(g.mutationChoices, mutations);
  assert.equal(g.player.xp, xp);
});
test("heavy creatures cannot dash; mobile forms can, with independent special cooldowns", () => {
  const g = isolated("ankylosaurus");
  const x = g.player.x;
  assert.equal(g.dash(), false);
  assert.equal(g.player.x, x);
  g.player.stamina = 100;
  assert.ok(g.special());
  assert.ok(g.player.guard > 0);
  assert.equal(g.special(), false);
  const h = isolated("brachiosaurus");
  h.player.hp = h.player.maxHp * 0.3;
  h.player.poisoned = 8;
  const before = h.player.hp;
  assert.ok(h.special());
  assert.ok(h.player.hp > before);
  assert.equal(h.player.poisoned, 0);
  assert.ok(isolated().dash());
});
test("meals increase player size, health and damage in the same form without forced evolution", () => {
  const g = isolated(),
    id = g.species.id,
    damage = g.player.damage,
    hp = g.player.maxHp;
  g.spawnFood("meat", 0, 0, 500, { tier: g.tier });
  g.eat();
  assert.equal(g.species.id, id);
  assert.ok(g.player.growth > 0.9);
  assert.ok(g.effectiveSize > g.species.size);
  assert.ok(g.player.damage > damage);
  assert.ok(g.player.maxHp > hp);
  assert.equal(g.state, "playing");
  g.openEvolution();
  g.evolve(g.evolutionChoices[0], g.mutationChoices[0]);
  assert.equal(g.player.growth, 0);
});
test("wild peers vary by prior food and actually forage, consume meals and grow", () => {
  const g = isolated(),
    young = g.spawnEntity("triceratops", 20, 0, {
      nutrients: 0,
      passive: true,
    }),
    old = g.spawnEntity("triceratops", 35, 0, {
      nutrients: 10000,
      passive: true,
    });
  assert.ok(old.maxHp > young.maxHp);
  assert.ok(old.damage > young.damage);
  assert.ok(old.scaleFactor > young.scaleFactor);
  young.hunger = 20;
  const food = g.spawnFood("plant", 20, 0, 300, { tier: 4 });
  g._updateEntity(young, 0.1);
  assert.ok(!g.foods.includes(food));
  assert.ok(young.growth > 0);
  assert.ok(young.scaleFactor > 1);
});
test("three real fruit finds unlock the first bloodline exactly once; new life resets progress", () => {
  const g = isolated();
  g.tier = 0;
  g.player.speciesId = "compsognathus";
  g.refreshStats(true);
  for (let i = 0; i < 3; i++) {
    g._eatCooldown = 0;
    g.spawnFood("lineage-fruit", 0, 0, 1, { tier: 0, fruit: "sunheart" });
    g.eat();
  }
  assert.ok(eligibleBloodlines(g).some((b) => b.id === "verdant-seed"));
  g.gainXP(g.nextThreshold);
  g.openEvolution();
  assert.ok(g.evolutionChoices.includes("verdant-psittacosaurus"));
  assert.ok(g.evolve("verdant-psittacosaurus", g.mutationChoices[0]));
  assert.equal(g.lineage.fruits.sunheart, 0);
  assert.ok(g.lineage.used.includes("verdant-seed"));
  assert.deepEqual(isolated().lineage.fruits, { sunheart: 0, moondrop: 0 });
});
test("chain forms require their parent and lava bloodlines require ten caldera kills", () => {
  const g = isolated("carnotaurus");
  g.lineage.lavaKills = 9;
  assert.ok(!eligibleBloodlines(g).some((b) => b.id === "cinderfang"));
  g.lineage.lavaKills = 10;
  assert.ok(eligibleBloodlines(g).some((b) => b.id === "cinderfang"));
  g.player.speciesId = "verdant-psittacosaurus";
  g.tier = 1;
  g.lineage.fruits.sunheart = 2;
  assert.ok(eligibleBloodlines(g).some((b) => b.id === "verdant-guard"));
  g.player.speciesId = "velociraptor";
  assert.ok(!eligibleBloodlines(g).some((b) => b.id === "verdant-guard"));
});
test("ordinary offerings overwhelmingly remain Regular and never bypass bloodline conditions", () => {
  const g = isolated("tyrannosaurus");
  g.tier = 5;
  let regular = 0,
    total = 0;
  for (let i = 0; i < 1000; i++)
    for (const id of chooseEvolutions(g)) {
      assert.ok(!SPECIES_BY_ID[id].bloodline);
      regular += Number(SPECIES_BY_ID[id].rarity === "regular");
      total++;
    }
  assert.ok(regular / total > 0.85);
  assert.ok(
    SPECIES.filter((s) => s.rarity === "regular").length >
      SPECIES.length * 0.65,
  );
});
test("player astral bolts travel, hit enemies and cannot hurt the caster", () => {
  const g = isolated("wyvern");
  const hp = g.player.hp,
    e = g.spawnEntity("primordial-titan", 12, 0, {
      nutrients: 0,
      passive: true,
    }),
    before = e.hp;
  g.player.angle = 0;
  assert.ok(g.special());
  assert.equal(g.projectiles[0].owner, "player");
  for (let i = 0; i < 40; i++) g.updateEcosystem(0.025, {});
  assert.ok(e.hp < before);
  assert.equal(g.player.hp, hp);
});
