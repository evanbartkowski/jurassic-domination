import test from "node:test";
import assert from "node:assert/strict";
import { Game, WORLD_RADIUS } from "../src/game.js";
import { SPECIES, SPECIES_BY_ID } from "../src/data.js";
import {
  ABILITIES,
  TECHNIQUES,
  RUN_SKILLS,
  POWERUPS,
  SKINS,
} from "../src/content.js";
import {
  REGIONS,
  biomeAt,
  foodEfficiency,
  LAIRS,
  chunkKey,
} from "../src/world-data.js";
import { inAttackZone } from "../src/ecosystem.js";
import { phenotype } from "../src/genetics.js";
import {
  newProfile,
  normalizeProfile,
  unlockDiscovery,
  equipSkin,
  loadData,
  PROFILE_KEY,
  SETTINGS_KEY,
} from "../src/profile.js";

function isolated(options = {}) {
  const g = new Game({ seed: 123, ...options });
  g.hatch();
  g.entities = [];
  g.foods = [];
  g.lairs = [];
  g.boss = null;
  g._streamWorld = () => {};
  g._replenish = () => {};
  g._nextBoss = Infinity;
  g.player.invulnerable = 0;
  g.consumeEvents();
  return g;
}
function step(g, seconds, input = {}) {
  for (let t = 0; t < seconds && g.state === "playing"; t += 0.05)
    g.update(0.05, input);
}
function form(g, id) {
  g.player.speciesId = id;
  g.tier = SPECIES_BY_ID[id].tier;
  g.refreshStats(true);
}

test("continental map is 100 times the original area with distinct regional spawns", () => {
  assert.equal((WORLD_RADIUS / 160) ** 2, 100);
  assert.ok(REGIONS.length >= 14);
  const visited = new Set();
  for (let r = 0; r < 1600; r += 20)
    for (const side of [-1, 1]) visited.add(biomeAt(0, r * side).id);
  assert.equal(visited.size, REGIONS.length);
  assert.equal(biomeAt(0, 0).tier, 0);
  assert.equal(biomeAt(1500, 0).tier, 7);
  assert.notEqual(biomeAt(0, -300).id, biomeAt(0, 300).id);
  const g = new Game({ seed: 99 });
  assert.ok(
    g.entities.every(
      (e) => SPECIES_BY_ID[e.speciesId].tier <= biomeAt(e.homeX, e.homeY).tier,
    ),
  );
});
test("all 102 creatures have valid abilities, techniques, habitats and behaviours", () => {
  assert.equal(SPECIES.length, 102);
  assert.equal(new Set(SPECIES.map((s) => s.id)).size, 102);
  for (const s of SPECIES) {
    assert(ABILITIES[s.abilityType]);
    assert(TECHNIQUES[s.technique]);
    assert(s.habitat && s.passive && s.temperament);
  }
  assert.equal(SPECIES_BY_ID.unicorn.body, "equine");
  assert.equal(SPECIES_BY_ID["world-serpent"].body, "serpent");
  assert.ok(SPECIES.filter((s) => s.tier >= 6).length >= 20);
});
test("a high-tier creature gets negligible evolution and hunger from starter food", () => {
  const low = isolated(),
    high = isolated();
  form(high, "elder-dragon");
  low.player.hunger = high.player.hunger = 30;
  for (const g of [low, high]) {
    g.spawnFood("meat", 0, 0, 14, { tier: 0 });
    g.eat();
  }
  assert.equal(low.player.xp, 14);
  assert.ok(high.player.xp < 0.1);
  assert.ok(high.player.hunger < low.player.hunger);
  assert.equal(foodEfficiency(6, 6), 1);
  assert.ok(foodEfficiency(6, 0) < 0.01);
});
test("replenishment stays regional instead of spawning free high-tier meals near a stronger player", () => {
  const g = new Game({ seed: 7 });
  g.hatch();
  form(g, "elder-dragon");
  g.entities = [];
  g.foods = [];
  g._replenish();
  assert(g.entities.length > 0);
  assert(g.entities.every((e) => SPECIES_BY_ID[e.speciesId].tier === 0));
});
test("movement accelerates smoothly and brakes rather than snapping to a halt", () => {
  const g = isolated();
  g.update(0.05, { x: 1 });
  const initial = g.player.vx;
  assert(initial > 0 && initial < g.player.speed);
  g.update(0.05, { x: 1 });
  assert(g.player.vx > initial);
  const moving = g.player.vx;
  g.update(0.05, {});
  assert(g.player.vx > 0 && g.player.vx < moving);
});
test("uneaten eggs hatch as juveniles and mature into their real species", () => {
  const g = isolated();
  g.spawnFood("egg", 20, 0, 10, {
    speciesId: "velociraptor",
    hatchAfter: 0.1,
    tier: 1,
  });
  step(g, 0.25);
  assert.equal(g.foods.length, 0);
  const baby = g.entities.find((e) => e.speciesId === "velociraptor");
  assert(baby?.juvenile);
  assert(baby.scaleFactor < 0.5);
  assert(baby.maxHp < baby.adultMaxHp);
  baby.age = 100;
  g.update(0.05, {});
  assert.equal(baby.juvenile, false);
  assert.equal(baby.scaleFactor, phenotype(baby.genome).size);
  assert.equal(baby.maxHp, baby.adultMaxHp);
});
test("eating an egg prevents its hatching and grants its region-quality meal", () => {
  const g = isolated();
  g.spawnFood("egg", 0, 0, 20, {
    speciesId: "microraptor",
    hatchAfter: 0.1,
    tier: 0,
  });
  assert(g.eat());
  step(g, 0.3);
  assert.equal(g.entities.length, 0);
  assert.equal(g.player.xp, 20);
});
test("timed damage and speed powerups work immediately and expire", () => {
  for (const id of ["damage", "speed"]) {
    const g = isolated(),
      before = id === "damage" ? g.player.damage : g.player.speed;
    g.spawnFood("rareplant", 0, 0, 0, { powerup: id });
    g.eat();
    assert((id === "damage" ? g.player.damage : g.player.speed) > before);
    assert(g.buffs[id] > 0);
    g.buffs[id] = 0.01;
    g.update(0.05, {});
    assert.equal(id === "damage" ? g.player.damage : g.player.speed, before);
  }
});
test("magnet attracts food and auto-eat consumes it without E input", () => {
  const g = isolated();
  g.buffs.magnet = 10;
  g.buffs.autoeat = 10;
  g.player.hunger = 35;
  g.spawnFood("plant", 12, 0, 1, {plantKind:"berry"});
  step(g, 2);
  assert.equal(g.foods.length, 0);
  assert(g.player.hunger > 40);
  assert.equal(g.player.xp, 1);
});
test("rare skill relics add usable cooldown-bound skills that do not survive death/restart", () => {
  const g = isolated();
  g.spawnFood("relic", 0, 0, 0, { skillId: "meteor" });
  g.eat();
  assert.equal(g.runSkills[0].id, "meteor");
  const e = g.spawnEntity("tyrannosaurus", 14, 0, { passive: true }),
    hp = e.hp;
  assert(g.useRunSkill(0));
  assert(e.hp < hp);
  assert.equal(g.useRunSkill(0), false);
  assert(g.runSkills[0].cooldown > 0);
  g.damagePlayer(99999, "Test", true);
  assert.equal(g.state, "dead");
  assert.equal(new Game({ seed: 123 }).runSkills.length, 0);
});
test("all collectible run skills execute and respect their own cooldown", () => {
  for (const skill of RUN_SKILLS) {
    const g = isolated();
    g.runSkills.push({ id: skill.id, cooldown: 0 });
    g.player.hp = g.player.maxHp * 0.4;
    g.spawnEntity("tyrannosaurus", 10, 0, { passive: true });
    assert.equal(g.useRunSkill(0), true, skill.id);
    assert.equal(g.useRunSkill(0), false);
    assert(g.runSkills[0].cooldown > 0);
    assert(Number.isFinite(g.player.hp));
  }
});
test("fossils unlock validated permanent discoveries and refuse duplicate or forged skins", () => {
  const p = newProfile(),
    g = isolated();
  g.spawnFood("fossil", 0, 0, 0, { rewardType: "skin", rewardId: "obsidian" });
  g.eat();
  const event = g.consumeEvents().find((e) => e.type === "unlock");
  assert.equal(event.unlockId, "obsidian");
  assert(unlockDiscovery(p, event.unlockType, event.unlockId));
  assert(equipSkin(p, "obsidian"));
  assert.equal(p.equippedSkin, "obsidian");
  assert.equal(equipSkin(p, "cosmic"), false);
  assert.equal(unlockDiscovery(p, "skin", "forged"), false);
  assert.equal(unlockDiscovery(p, "skin", "obsidian"), false);
});
test("permanent relic modifiers change later lives and old v1 saves migrate intact", () => {
  const p = normalizeProfile({
    version: 1,
    dna: 19,
    runs: 3,
    unlocked: ["tyrannosaurus"],
    upgrades: { vitality: 2 },
  });
  assert.equal(p.dna, 19);
  assert.equal(p.runs, 3);
  assert.deepEqual(p.unlocked, ["tyrannosaurus"]);
  assert.equal(p.upgrades.vitality, 2);
  assert.deepEqual(p.skins, ["natural"]);
  const a = isolated(),
    b = isolated({
      modifiers: ["ancient-heart", "predator-mark", "wanderer", "forager"],
    });
  assert(b.player.maxHp > a.player.maxHp);
  assert(b.player.damage > a.player.damage);
  assert(b.player.speed > a.player.speed);
  a.gainXP(10);
  b.gainXP(10);
  assert(b.player.xp > a.player.xp);
});
test("a corrupt settings record cannot erase an otherwise valid old profile", () => {
  const values = new Map([
    [PROFILE_KEY, JSON.stringify({ dna: 77, unlocked: ["unicorn"] })],
    [SETTINGS_KEY, "{broken"],
  ]);
  const loaded = loadData({ getItem: (k) => values.get(k) });
  assert.equal(loaded.profile.dna, 77);
  assert.deepEqual(loaded.profile.unlocked, ["unicorn"]);
  assert(loaded.failed);
});
test("neutral grazers do not attack until aggroed; stronger forms make weak creatures flee", () => {
  const g = isolated(),
    neutral = g.spawnEntity("protoceratops", 3, 0, { passive: true });
  neutral.attackCooldown = 0;
  step(g, 1);
  assert.equal(neutral.intent, "graze");
  assert.equal(neutral.telegraph, 0);
  g._hitEntity(neutral, 1);
  g.update(0.05);
  assert(["attack", "casting", "hunt"].includes(neutral.intent));
  form(g, "elder-dragon");
  const weak = g.spawnEntity("compsognathus", 8, 0);
  g.update(0.05);
  assert.equal(weak.intent, "flee");
});
test("attacking a pack member rallies its pack but does not aggro unrelated grazers", () => {
  const g = isolated(),
    a = g.spawnEntity("velociraptor", 8, 0, { packId: "test" }),
    b = g.spawnEntity("velociraptor", 10, 1, { packId: "test" }),
    other = g.spawnEntity("protoceratops", 10, 4, { passive: true });
  g._hitEntity(a, 1);
  assert(b.aggro > 0);
  assert.equal(other.aggro, 0);
  g.update(0.05);
  assert(["flank", "attack", "casting"].includes(b.intent));
});
test("enemy skills telegraph their exact zones, hit on completion, and can be dodged", () => {
  for (const avoid of [false, true]) {
    const g = isolated();
    form(g, "tyrannosaurus");
    const e = g.spawnEntity("frost-dragon", 12, 0, { passive: false });
    e.skillCooldown = 0;
    g.update(0.05);
    assert(e.cast);
    const zone = { ...e.cast },
      hp = g.player.hp;
    assert.equal(inAttackZone(g.player, zone), true);
    if (avoid) {
      g.player.x = zone.x + zone.radius + 20;
      g.player.y = zone.y + 20;
    }
    step(g, 1.1);
    assert(avoid ? g.player.hp === hp : g.player.hp < hp);
  }
});
test("species technique cooldowns, guard damage reduction and unicorn healing have real effects", () => {
  const g = isolated();
  form(g, "triceratops");
  assert(g.technique());
  assert.equal(g.technique(), false);
  const hp = g.player.hp;
  g.damagePlayer(20, "test", true);
  assert(hp - g.player.hp < 10);
  form(g, "unicorn");
  g.player.techniqueCooldown = 0;
  g.player.hp = g.player.maxHp / 2;
  const before = g.player.hp;
  assert(g.technique());
  assert(g.player.hp > before);
});
test("lair bosses drop meals and respawn only after their death timer", () => {
  const g = isolated();
  g.lairs = [{ ...LAIRS[0], entityId: null, respawnAt: 0, defeats: 0 }];
  g._updateLairs();
  const lair = g.lairs[0],
    e = g.entities.find((e) => e.id === lair.entityId);
  assert(e?.boss);
  g._hitEntity(e, 999999);
  assert.equal(lair.entityId, null);
  assert.equal(lair.defeats, 1);
  assert.equal(g.foods.filter((f) => f.type === "essence").length, 5);
  g._updateLairs();
  assert.equal(lair.entityId, null);
  g.time = lair.respawnAt + 0.1;
  g._updateLairs();
  assert(lair.entityId);
  assert.notEqual(lair.entityId, e.id);
});
test("streaming preserves consumed loot and hatch ages while exploring distant chunks", () => {
  const g = new Game({ seed: 22 });
  g.hatch();
  const food = g.foods.find((f) => f.homeChunk === "0,0");
  assert(food);
  const id = food.id;
  g.foods = g.foods.filter((f) => f.id !== id);
  g.player.x = 1200;
  g.player.y = 300;
  g._streamWorld();
  assert(g.entities.length < 230);
  assert(g.activeChunks.size <= 9);
  assert(g.chunks.has("0,0"));
  g.time = 90;
  g.player.x = 0;
  g.player.y = 0;
  g._streamWorld();
  assert(!g.foods.some((f) => f.id === id));
  assert(g.foods.some((f) => f.age >= 90));
});
