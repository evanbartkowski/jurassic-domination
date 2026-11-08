import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { segmentCircleHit, firstSolidHit, hasLineOfSight, attackLineClear, obstaclePadding, sweepMove } from "../src/combat.js";
import { resolveObstacles } from "../src/wilderness.js";

const rock = (x = 0, y = 0, radius = 1) => ({ id: "cover", type: "boulder", x, y, radius, solid: true });
test("collision broad phase preserves the earliest narrow-phase contact across seeded paths", () => {
  let state = 43117;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let sample = 0; sample < 500; sample++) {
    const start = { x: random() * 80 - 40, y: random() * 80 - 40 },
      end = { x: random() * 80 - 40, y: random() * 80 - 40 }, padding = random() * 3,
      features = Array.from({ length: 20 }, (_, id) => ({ ...rock(random() * 100 - 50, random() * 100 - 50, .2 + random() * 5), id }));
    let expected = null;
    for (const feature of features) {
      const t = segmentCircleHit(start, end, feature, feature.radius + padding, sample % 2 === 0);
      if (t !== null && (!expected || t < expected.t)) expected = { t, feature };
    }
    const actual = firstSolidHit(start, end, features, padding, sample % 2 === 0);
    assert.equal(actual?.feature.id, expected?.feature.id);
    assert.equal(actual?.t, expected?.t);
  }
});
function isolated(speciesId = "compsognathus") {
  const game = new Game({ seed: 4411 }); game.hatch();
  game.entities = []; game.foods = []; game.lairs = []; game.worldFeatures = [];
  game._streamWorld = () => {}; game._replenish = () => {};
  game.player.speciesId = speciesId; game.tier = game.species.tier; game.refreshStats(true);
  game.player.invulnerable = 0; game.player.x = 0; game.player.y = 0; game.player.angle = 0;
  return game;
}
function shot(game, options = {}) {
  const projectile = { id: "swept-shot", x: -10, y: 0, angle: 0, speed: 1000, life: 1, radius: .25, kind: "venom", damage: 5, cause: "Test projectile", ...options };
  game.projectiles.push(projectile); return projectile;
}

test("segment contact selects the first solid and ignores nonblocking plants", () => {
  const start = { x: -10, y: 0 }, end = { x: 10, y: 0 };
  assert.equal(segmentCircleHit(start, end, { x: 0, y: 0 }, 1), .45);
  const near = rock(-4), far = rock(4);
  assert.equal(firstSolidHit(start, end, [far, { ...rock(-8), solid: false }, near]).feature, near);
  assert.equal(hasLineOfSight(start, end, [near]), false);
  assert.equal(hasLineOfSight({ x: -5, y: 3 }, { x: 5, y: 3 }, [near]), true);
  assert.equal(attackLineClear(start, end, [near], "flame"), false);
  assert.equal(attackLineClear(start, end, [near], "stomp"), true);
});

test("fast movement stops at the same padded footprint as wilderness collision", () => {
  const actor = { x: -10, y: 0 }, solid = rock(0, 0, 2), size = 2;
  const hit = sweepMove(actor, 30, 0, size, [solid]);
  assert.equal(hit.hit, solid);
  assert.ok(actor.x < -2.7 && actor.x > -2.71);
  const before = { ...actor };
  resolveObstacles(actor, size, [solid]);
  assert.deepEqual(actor, before, "sweep endpoint must already be outside the physical footprint");
  assert.equal(obstaclePadding(size), .7);
});

test("overlapping spawns can escape outward without crossing the center or another solid", () => {
  const cover = rock(0, 0, 2), actor = { x: -.5, y: 0 };
  sweepMove(actor, 10, 0, 1, [cover]);
  assert.equal(actor.x, -.5, "an inward step cannot pass through the far side");
  sweepMove(actor, -4, 0, 1, [cover]);
  assert.equal(actor.x, -4.5);
  const blocked = { x: -.5, y: 0 }, second = rock(-5, 0, 1);
  sweepMove(blocked, -20, 0, 1, [cover, second]);
  assert.ok(blocked.x > -3.65 && blocked.x < -3.64);
});

test("a projectile cannot tunnel through solid cover and apply damage or venom", () => {
  const game = isolated(); game.worldFeatures = [rock(-4)];
  const before = game.player.hp, projectile = shot(game);
  game.updateEcosystem(.04, {});
  assert.equal(game.player.hp, before);
  assert.equal(game.player.poisoned, 0);
  assert.equal(game.projectiles.length, 0);
  assert.ok(Math.abs(projectile.x - -5.25) < 1e-7);
});

test("an unobstructed high-speed projectile hits between sampled endpoints", () => {
  const game = isolated(), before = game.player.hp;
  shot(game); game.updateEcosystem(.04, {});
  assert.ok(game.player.hp < before);
  assert.ok(game.player.poisoned > 0);
  assert.equal(game.projectiles.length, 0);
});

test("a wide projectile cast beside cover can escape its initial overlap when aimed away", () => {
  const game = isolated(); game.player.x = -15; game.worldFeatures = [rock()];
  const before = game.player.hp;
  shot(game, { x: -2, angle: Math.PI, radius: 1.8, kind: "flame" });
  game.updateEcosystem(.02, {});
  assert.ok(game.player.hp < before);
});

test("player bolts hit the nearest intersected creature before a farther array entry", () => {
  const game = isolated(); game.player.x = -20;
  const far = game.spawnEntity("compsognathus", 10, 0, { passive: true }), near = game.spawnEntity("compsognathus", 4, 0, { passive: true });
  const health = [far.hp, near.hp];
  shot(game, { x: 0, owner: "player", kind: "lightning" });
  game.updateEcosystem(.02, {});
  assert.equal(far.hp, health[0]);
  assert.ok(near.hp < health[1]);
  assert.equal(game.projectiles.length, 0);
});

test("projectiles expire at their actual remaining range instead of hitting beyond it", () => {
  const game = isolated(), before = game.player.hp, projectile = shot(game, { life: .002 });
  game.updateEcosystem(.1, {});
  assert.equal(game.player.hp, before);
  assert.equal(projectile.x, -8);
  assert.equal(game.projectiles.length, 0);
});

test("enemy bites cannot hit through a rock but connect on the same side", () => {
  const game = isolated(); game.player.x = 3; game.worldFeatures = [rock()];
  const enemy = game.spawnEntity("brachiosaurus", -3, 0, { behavior: "hunter" });
  enemy.skillCooldown = 999; enemy.aggro = 5; enemy.telegraph = .001;
  const before = game.player.hp;
  game._updateEntity(enemy, .02);
  assert.equal(game.player.hp, before);
  game.player.x = -3; game.player.y = 1;
  enemy.attackCooldown = 0; enemy.telegraph = .001;
  game._updateEntity(enemy, .02);
  assert.ok(game.player.hp < before);
});

test("player bites and aimed elemental cones respect cover while explicit shockwaves can wrap around it", () => {
  const game = isolated("brachiosaurus"); game.player.x = -4; game.worldFeatures = [rock()];
  const enemy = game.spawnEntity("compsognathus", 2, 0, { passive: true }); enemy.hp = 9999;
  assert.ok(game.attack());
  assert.equal(enemy.hp, 9999);
  enemy.x = -2; game.player.attackCooldown = 0;
  assert.ok(game.attack()); assert.ok(enemy.hp < 9999);
  const flame = isolated("carnotaurus"); flame.player.x = -6; flame.worldFeatures = [rock()];
  const target = flame.spawnEntity("compsognathus", 6, 0, { passive: true }); target.hp = 9999;
  assert.ok(flame.ability()); assert.equal(target.hp, 9999);
  const stomp = isolated("brachiosaurus"); stomp.player.x = -4; stomp.worldFeatures = [rock()];
  const victim = stomp.spawnEntity("compsognathus", 4, 0, { passive: true }); victim.hp = 9999;
  assert.ok(stomp.ability()); assert.ok(victim.hp < 9999);
});

test("the actual player dash stops before a boulder rather than reaching its far side", () => {
  const game = isolated("velociraptor"); game.player.x = -5; game.worldFeatures = [rock(0, 0, .7)];
  const before = game.player.stamina;
  assert.ok(game.dash(1, 0));
  assert.ok(game.player.x < -.7 - obstaclePadding(game.effectiveSize));
  assert.ok(game.player.stamina < before);
  assert.ok(game.player.dashCooldown > 0);
});

test("directional combat mechanics enforce flank bonus damage, leg wounds, frontal armor deflection, wall-slam collision damage, and telegraph stuns", () => {
  // 1. Frontal deflection vs Flank vulnerability on armored player
  const anky = isolated("ankylosaurus");
  anky.player.angle = Math.PI; // Facing West (-X)
  const fullHp = anky.player.hp;
  // Attack from East (0 angle) strikes anky head-on -> frontalShield = 0.65
  anky.damagePlayer(100, "Apex Predator", false, 0);
  const headOnDamage = fullHp - anky.player.hp;
  assert.ok(anky.survivalBehavior.damageBlocked > 0);

  anky.player.hp = fullHp;
  anky.player.invulnerable = 0;
  // Attack from West (PI angle) strikes anky from behind -> flankVuln = 1.25
  anky.damagePlayer(100, "Apex Predator", false, Math.PI);
  const rearDamage = fullHp - anky.player.hp;
  assert.ok(rearDamage > headOnDamage * 1.5, "rear attack must deal significantly more damage than frontal armored strike");

  // 2. Player flank attack on enemy inflicts bonus damage and leg wound slow
  const rap = isolated("velociraptor");
  rap.player.x = 0; rap.player.y = 0; rap.player.angle = 0;
  // Enemy at x=2, facing East (angle=0) -> player is hitting from behind
  const enemy = rap.spawnEntity("triceratops", 2, 0, { passive: true });
  enemy.angle = 0;
  const initialEnemyHp = enemy.hp;
  assert.ok(rap.attack());
  assert.ok(enemy.hp < initialEnemyHp);
  assert.ok(enemy.slowed > 0, "rear flank hit must inflict leg wound slow");

  // 3. Environmental wall-slam bonus damage & stun
  const brawler = isolated("tyrannosaurus");
  brawler.worldFeatures = [rock(3, 0, 1)]; // solid rock at x=3
  const victim = brawler.spawnEntity("compsognathus", 1.8, 0, { passive: true });
  const startHp = victim.hp;
  // Hit with strong knockback pushing victim into the rock at x=3
  brawler._hitEntity(victim, 20, 1.5, false, 0);
  assert.ok(victim.stunned >= 1.0, "slamming into solid feature must stun target");
  // Total damage must include base damage + 25% wall-slam bonus
  assert.ok(startHp - victim.hp >= 24);

  // 4. Telegraph interruption on heavy impact
  const giant = isolated("tyrannosaurus");
  const charger = giant.spawnEntity("triceratops", 5, 0, { behavior: "hunter" });
  charger.telegraph = 1.5;
  charger.cast = { shape: "circle", remaining: 1.5, radius: 4, angle: 0, x: 5, y: 0 };
  giant._hitEntity(charger, 150, 1.2, true);
  assert.equal(charger.telegraph, 0, "heavy attack must interrupt active telegraph");
  assert.equal(charger.cast, null, "heavy attack must clear active cast shape");
});
