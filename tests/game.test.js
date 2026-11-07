import test from "node:test";
import assert from "node:assert/strict";
import { Game, WORLD_RADIUS } from "../src/game.js";
import { SPECIES, SPECIES_BY_ID, MUTATIONS } from "../src/data.js";
import { ABILITIES } from "../src/content.js";

function emptyGame(options = {}) {
  const game = new Game({ seed: 42, ...options });
  game.hatch();
  game.entities = [];
  game.foods = [];
  game.player.invulnerable = 0;
  game.consumeEvents();
  game.lairs = [];
  game._streamWorld = () => {};
  game._replenish = () => {};
  return game;
}

function advance(game, seconds, input = {}) {
  for (let t = 0; t < seconds; t += 0.05) game.update(0.05, input);
}

test("content has a complete branching food chain with valid distinct species", () => {
  assert.ok(SPECIES.length >= 32);
  assert.equal(new Set(SPECIES.map((s) => s.id)).size, SPECIES.length);
  assert.ok(SPECIES.filter((s) => s.tier < 6).length >= 24);
  for (let tier = 0; tier <= 7; tier++)
    assert.ok(SPECIES.filter((s) => s.tier === tier).length >= 3);
  for (const s of SPECIES) {
    assert.ok(s.hp > 0 && s.damage > 0 && s.speed > 0 && s.size > 0);
    assert.ok(s.ability && s.abilityType && s.description);
  }
});

test("seed controls the hatchling, food placement, and creature placement", () => {
  const first = new Game({ seed: 12345 }),
    second = new Game({ seed: 12345 });
  assert.deepEqual(first.player, second.player);
  assert.deepEqual(first.entities, second.entities);
  assert.deepEqual(first.foods, second.foods);
  assert.notDeepEqual(first.entities, new Game({ seed: 12346 }).entities);
});

test("egg cannot move or take damage, hatches after three seconds or input", () => {
  const game = new Game({ seed: 4 });
  game.damagePlayer(9999, "test");
  advance(game, 1, { x: 1 });
  assert.equal(game.state, "egg");
  assert.equal(game.player.x, 0);
  advance(game, 2.1);
  assert.equal(game.state, "playing");
  assert.ok(game.consumeEvents().some((e) => e.type === "hatch"));
  const manual = new Game({ seed: 4 });
  manual.update(0.01, { eat: true });
  assert.equal(manual.state, "playing");
});

test("movement normalizes diagonals, respects aim, and clamps to the world", () => {
  const straight = emptyGame(),
    diagonal = emptyGame();
  advance(straight, 0.5, { x: 1, y: 0, aim: 1 });
  advance(diagonal, 0.5, { x: 1, y: 1, aim: 1 });
  assert.ok(
    Math.abs(
      Math.hypot(straight.player.x, straight.player.y) -
        Math.hypot(diagonal.player.x, diagonal.player.y),
    ) < 0.001,
  );
  assert.equal(straight.player.angle, 1);
  straight.player.x = 158;
  straight.update(0.1, { x: 1, dash: true });
  assert.ok(Math.hypot(straight.player.x, straight.player.y) < WORLD_RADIUS);
});

test("attack hits the facing arc once per cooldown and leaves edible remains", () => {
  const game = emptyGame();
  const front = game.spawnEntity("compsognathus", 2, 0, { passive: true });
  const back = game.spawnEntity("compsognathus", -2, 0, { passive: true });
  const before = front.hp;
  assert.equal(game.attack(), true);
  assert.ok(front.hp < before);
  assert.equal(back.hp, back.maxHp);
  const after = front.hp;
  assert.equal(game.attack(), false);
  assert.equal(front.hp, after);
  front.hp = 1;
  game.player.attackCooldown = 0;
  front.x = 2;
  game.attack();
  assert.ok(!game.entities.includes(front));
  assert.equal(game.player.kills, 1);
  assert.ok(game.foods.some((f) => f.type === "meat"));
  assert.equal(
    game.player.xp,
    0,
    "a kill requires eating the remains to earn evolution energy",
  );
});

test("food must be nearby; eating heals, restores hunger, and grants evolution energy", () => {
  const game = emptyGame();
  game.spawnFood("meat", 80, 80, 18);
  assert.equal(game.eat(), false);
  game.player.hunger = 40;
  game.player.hp -= 10;
  const hp = game.player.hp;
  game.spawnFood("meat", 1, 0, 18);
  assert.equal(game.eat(), true);
  assert.equal(game.player.xp, 18);
  assert.ok(game.player.hp > hp);
  assert.equal(game.player.hunger, 65);
  assert.equal(game.foods.length, 1);
});

test("dash spends stamina, grants invulnerability, and obeys cooldown", () => {
  const game = emptyGame();
  const hp = game.player.hp;
  assert.equal(game.dash(1, 0), true);
  assert.ok(game.player.x > 5 && game.player.stamina < 100);
  assert.equal(game.damagePlayer(20, "test"), false);
  assert.equal(game.player.hp, hp);
  assert.equal(game.dash(1, 0), false);
  advance(game, 2);
  assert.equal(game.dash(1, 0), true);
});

test("abilities deal damage, spend stamina, and cannot bypass their cooldown", () => {
  const game = emptyGame();
  game.player.speciesId = "elder-dragon";
  game.refreshStats(true);
  const front = game.spawnEntity("tyrannosaurus", 7, 0, { passive: true });
  const back = game.spawnEntity("tyrannosaurus", -7, 0, { passive: true });
  const hp = front.hp;
  assert.equal(game.ability(), true);
  assert.ok(front.hp < hp);
  assert.equal(back.hp, back.maxHp);
  assert.ok(
    game.player.abilityCooldown > 0 &&
      game.player.stamina === 100 - ABILITIES[game.species.abilityType].stamina,
  );
  assert.equal(game.ability(), false);
});

test("venom deals damage over time with bounded, readable hit feedback", () => {
  const game = emptyGame();
  game.player.speciesId = "basilisk";
  game.refreshStats(true);
  const target = game.spawnEntity("dreadnoughtus", 5, 0, { passive: true });
  game.ability();
  assert.ok(target.poison > 0);
  const hp = target.hp;
  target.stunned = 10;
  game.consumeEvents();
  advance(game, 1);
  assert.ok(target.hp < hp);
  const hits = game
    .consumeEvents()
    .filter((e) => e.type === "hit" && e.target === target.id);
  assert.ok(hits.length >= 2 && hits.length <= 3);
  assert.ok(hits.every((e) => e.amount >= 1));
});

test("evolution requires real offered choices, freezes the simulation, and applies a mutation", () => {
  const game = emptyGame();
  assert.equal(game.evolve("tyrannosaurus", "vitality"), false);
  game.gainXP(60);
  assert.equal(game.state, "evolution");
  assert.equal(game.evolutionChoices.length, 3);
  assert.equal(game.mutationChoices.length, 3);
  assert.ok(game.evolutionChoices.every((id) => SPECIES_BY_ID[id].tier === 1));
  assert.ok(
    game.mutationChoices.every((id) => MUTATIONS.some((m) => m.id === id)),
  );
  const time = game.time;
  game.update(0.1, { x: 1 });
  assert.equal(game.time, time);
  assert.equal(game.player.x, 0);
  assert.equal(game.evolve("not-a-species", game.mutationChoices[0]), false);
  const selected = game.evolutionChoices[0],
    mutation = game.mutationChoices[0];
  assert.equal(game.evolve(selected, mutation), true);
  assert.equal(game.player.speciesId, selected);
  assert.equal(game.tier, 1);
  assert.equal(game.state, "playing");
  assert.equal(game.player.hp, game.player.maxHp);
  assert.ok(game.mutations.includes(mutation));
});

test("final-tier evolution ascends indefinitely and increases the next threshold", () => {
  const game = emptyGame();
  game.tier = 7;
  game.player.speciesId = "elder-dragon";
  game.refreshStats(true);
  const previous = game.nextThreshold;
  game.gainXP(previous);
  assert.equal(game.state, "evolution");
  assert.equal(
    game.evolve(game.evolutionChoices[0], game.mutationChoices[0]),
    true,
  );
  assert.equal(game.tier, 7);
  assert.equal(game.ascensions, 1);
  assert.ok(game.nextThreshold > previous);
});

test("evolution preserves excess energy and offers the next form without losing it", () => {
  const game = emptyGame();
  game.gainXP(250);
  game.evolve(game.evolutionChoices[0], game.mutationChoices[0]);
  assert.equal(game.player.xp, 190);
  game.update(0.05);
  assert.equal(game.state, "evolution");
  assert.ok(game.evolutionChoices.every((id) => SPECIES_BY_ID[id].tier === 2));
});

test("predators telegraph attacks before damage; fleeing the strike avoids it", () => {
  const game = emptyGame();
  const e = game.spawnEntity("velociraptor", 2, 0, { passive: false });
  e.attackCooldown = 0;
  const hp = game.player.hp;
  game.update(0.05);
  assert.ok(e.telegraph > 0);
  assert.equal(game.player.hp, hp);
  game.player.x = -12;
  advance(game, 0.7);
  assert.equal(game.player.hp, hp);
});

test("starvation and volcanic boundary can kill; death is final for that run", () => {
  const game = emptyGame();
  game.player.hunger = 0;
  game.player.hp = 0.01;
  game.update(0.1);
  assert.equal(game.state, "dead");
  assert.equal(game.cause, "Starvation");
  const results = game.getResults();
  assert.ok(results.dna >= 1);
  assert.equal(results.cause, "Starvation");
  const x = game.player.x;
  game.update(0.1, { x: 1 });
  assert.equal(game.player.x, x);
  const volcanic = emptyGame();
  volcanic.player.x = WORLD_RADIUS - 6;
  const hp = volcanic.player.hp;
  volcanic.update(0.1);
  assert.ok(volcanic.player.hp < hp);
  assert.ok(volcanic.consumeEvents().some((e) => e.type === "warning"));
});

test("boss spawns on schedule, reports health, and drops essence when killed", () => {
  const game = emptyGame();
  game.time = 125;
  game.update(0.05);
  assert.ok(game.boss);
  const entity = game.entities.find((e) => e.id === game.boss.id);
  assert.ok(entity.boss && entity.maxHp > SPECIES_BY_ID[entity.speciesId].hp);
  assert.ok(game.consumeEvents().some((e) => e.type === "boss"));
  entity.x = 1;
  entity.y = 0;
  entity.hp = 1;
  game.attack();
  assert.equal(game.boss, null);
  assert.equal(game.foods.filter((f) => f.type === "essence").length, 5);
});

test("difficulty and permanent upgrades change actual survivability", () => {
  const base = emptyGame(),
    upgraded = emptyGame({
      upgrades: { vitality: 5, instinct: 5, metabolism: 5 },
    });
  assert.ok(upgraded.player.maxHp > base.player.maxHp);
  assert.ok(upgraded.player.damage > base.player.damage);
  advance(base, 2);
  advance(upgraded, 2);
  assert.ok(upgraded.player.hunger > base.player.hunger);
  assert.ok(
    new Game({ difficulty: "extinction" }).rules.enemyDamage >
      base.rules.enemyDamage,
  );
  assert.equal(new Game({ difficulty: "invalid" }).difficulty, "survival");
});

test("long seeded run stays finite and entity/food collections stay bounded", () => {
  const game = emptyGame();
  for (let i = 0; i < 12000 && game.state !== "dead"; i++) {
    if (game.state === "evolution")
      game.evolve(game.evolutionChoices[0], game.mutationChoices[0]);
    game.player.invulnerable = 1;
    game.player.hunger = 100;
    game.update(0.05, {
      x: Math.cos(i / 100),
      y: Math.sin(i / 100),
      aim: i / 100,
      attack: true,
      eat: true,
      ability: i % 180 === 0,
    });
    assert.ok(
      Number.isFinite(game.player.x) && Number.isFinite(game.player.hp),
    );
  }
  assert.ok(game.entities.length <= 230);
  assert.ok(game.foods.length < 350);
  assert.ok(game.events.length <= 160);
});

// An input-only hunter, without invulnerability or artificial XP, checks that the
// actual introductory food-chain remains playable after balance changes.
function playHunter(seed, seconds = 65) {
  const game = new Game({ seed });
  game.hatch();
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const unit = (x, y) => {
    const length = Math.hypot(x, y);
    return length ? [x / length, y / length] : [0, 0];
  };
  let firstEvolution = null;
  while (game.time < seconds && game.state !== "dead") {
    if (game.state === "evolution") {
      firstEvolution ??= game.time;
      const species = [...game.evolutionChoices].sort(
        (a, b) => SPECIES_BY_ID[b].hp - SPECIES_BY_ID[a].hp,
      )[0];
      const mutation =
        game.mutationChoices.find(
          (id) => id === "vitality" || id === "ironhide",
        ) || game.mutationChoices[0];
      game.evolve(species, mutation);
    }
    const p = game.player;
    const prey = game.entities
      .filter((e) => SPECIES_BY_ID[e.speciesId].tier <= game.tier && !e.boss)
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    const food = game.foods
      .filter((f) => f.type !== "plant" || dist(p, f) < 5)
      .sort((a, b) => dist(p, a) - dist(p, b))[0];
    const target =
      food && (!prey || dist(p, food) < dist(p, prey) + 3) ? food : prey;
    let x = 0,
      y = 0,
      aim = p.angle,
      dash = false,
      attack = false,
      ability = false;
    if (target) {
      [x, y] = unit(target.x - p.x, target.y - p.y);
      aim = Math.atan2(y, x);
    }
    if (target === prey && prey) {
      const distance = dist(p, prey),
        reach = 2.8 + game.species.size * 1.1;
      attack = distance < reach + 1;
      ability = distance < 7;
      const threat = game.entities.find(
        (e) =>
          e.telegraph > 0.1 && dist(p, e) < 4 + SPECIES_BY_ID[e.speciesId].size,
      );
      if (threat) {
        [x, y] = unit(p.x - threat.x, p.y - threat.y);
        dash = true;
      } else if (distance < reach - 1)
        [x, y] = unit(p.x - prey.x, p.y - prey.y);
    }
    game.update(0.05, { x, y, aim, dash, attack, ability, eat: true });
    game.consumeEvents();
  }
  return { game, firstEvolution };
}

test("tactical hunting can evolve within 45 seconds and survive the first minute", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const { game, firstEvolution } = playHunter(seed);
    assert.ok(
      firstEvolution !== null && firstEvolution <= 45,
      `seed ${seed}: first evolution ${firstEvolution}`,
    );
    assert.ok(
      game.time >= 60,
      `seed ${seed}: died at ${game.time} to ${game.cause}`,
    );
    assert.ok(game.player.kills >= 3);
  }
});

test("nearby vegetation supports survival without granting instant evolution", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const game = new Game({ seed });
    game.hatch();
    for (let step = 0; step < 200; step++) {
      const p = game.player;
      const target = game.foods
        .filter((f) => f.type === "plant")
        .sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
        )[0];
      const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : 0;
      game.update(0.05, { x: Math.cos(angle), y: Math.sin(angle), eat: true });
    }
    assert.equal(game.tier, 0);
    assert.notEqual(game.state, "evolution");
    assert.ok(game.player.xp > 0 && game.player.hunger > 85);
  }
});
