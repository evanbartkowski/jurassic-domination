import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { SPECIES_BY_ID } from "../src/data.js";
import { updateWildlife, marinePose } from "../src/wilderness.js";

function isolated(speciesId = "velociraptor") {
  const g = new Game({ seed: 42 });
  g.hatch();
  g.entities = [];
  g.foods = [];
  g.lairs = [];
  g.worldFeatures = [];
  g._streamWorld = () => {};
  g._replenish = () => {};
  g.player.speciesId = speciesId;
  g.tier = SPECIES_BY_ID[speciesId].tier;
  g.refreshStats(true);
  g.player.invulnerable = 0;
  return g;
}

test("marine dinosaurs have visible health, take damage from player attacks, and spawn rewards on kill", () => {
  const g = isolated("velociraptor");
  const waterFeature = {
    id: "pool-test-1",
    type: "water",
    x: 0,
    y: 0,
    radius: 20,
    tier: 1,
    phase: 0,
  };
  g.worldFeatures = [waterFeature];

  // Tick once to initialize swimmers
  updateWildlife(g, 0.05);

  const poolState = g.marineState.get("pool-test-1");
  assert.ok(poolState, "Marine pool state is initialized");
  assert.equal(poolState.swimmers.length, 3, "Pool contains 3 marine swimmers");

  const fish = poolState.swimmers[0];
  assert.ok(fish.maxHp > 0, "Fish has defined maxHp");
  assert.equal(fish.hp, fish.maxHp, "Fish starts at full health");
  assert.ok(fish.id, "Fish has unique identifier");
  assert.ok(fish.name, "Fish has species display name");

  // Position player directly adjacent to the fish and face it
  g.player.x = fish.x - 2.0;
  g.player.y = fish.y;
  g.player.angle = 0; // facing towards positive X (towards fish)

  const initialHp = fish.hp;

  // Bite the fish
  g.attack();
  const hitEvent = g.consumeEvents().find((e) => e.type === "hit" && e.target === "marine");
  assert.ok(hitEvent, "Hit event was emitted on marine target");
  assert.ok(hitEvent.amount > 0, "Hit event contains positive damage amount");
  assert.ok(fish.hp < initialHp, "Fish health was reduced by player attack");

  // Kill the fish using lethal strike
  g._hitMarine(fish, fish.maxHp + 50, false, waterFeature);
  const killEvent = g.consumeEvents().find((e) => e.type === "kill" && e.water);
  assert.equal(fish.dead, true, "Fish is marked dead upon lethal damage");
  assert.ok(killEvent, "Kill event emitted on lethal marine strike");
  assert.ok(g.foods.some((f) => f.type === "meat"), "Meat was spawned upon marine kill");
});

test("marine dinosaurs strictly do not hunt or attack players outside deep water", () => {
  const g = isolated("velociraptor");
  const waterFeature = {
    id: "pool-test-2",
    type: "water",
    x: 0,
    y: 0,
    radius: 20,
    tier: 1,
    phase: 0,
  };
  g.worldFeatures = [waterFeature];

  // Position player on dry land outside the pool boundary
  g.player.x = 25;
  g.player.y = 0;
  const initialPlayerHp = g.player.hp;

  updateWildlife(g, 0.1);
  const poolState = g.marineState.get("pool-test-2");
  for (const fish of poolState.swimmers) {
    assert.equal(fish.hunting, false, "Fish does not hunt player when player is on land");
    // Swimmers must stay strictly inside pool limit
    const distToCenter = Math.hypot(fish.x - waterFeature.x, fish.y - waterFeature.y);
    assert.ok(distToCenter <= waterFeature.radius - 2.5, "Fish strictly remains in deep water");
  }
  assert.equal(g.player.hp, initialPlayerHp, "Player on land takes zero water bites");

  // Position player barely touching the shoreline bank (d = 19.5, radius = 20)
  g.player.x = 19.5;
  g.player.y = 0;
  updateWildlife(g, 0.1);
  assert.equal(g.player.hp, initialPlayerHp, "Player on dry shore takes zero water bites");
});

test("skillful dodging and evasion rewards stamina refund, speed surge, and counter-attack critical bonus", () => {
  const g = isolated("velociraptor");
  g.player.stamina = 30;
  g.player.speedBoost = 0;
  g.player.counterReady = 0;

  // Trigger precision dodge
  const success = g.triggerPerfectDodge({ cause: "Apex Strike" });
  assert.equal(success, true);
  const dodgeEvent = g.consumeEvents().find((e) => e.type === "perfect-dodge");
  assert.ok(dodgeEvent, "perfect-dodge event was fired");
  assert.ok(g.player.stamina > 30, "Stamina was refunded upon perfect dodge");
  assert.ok(g.player.speedBoost > 0, "Speed boost was granted");
  assert.ok(g.player.counterReady > 0, "Counter-attack readiness was activated");
  assert.ok(g.player.invulnerable > 0, "i-frames granted upon perfect dodge");

  // Attack while counter is ready
  const enemy = g.spawnEntity("triceratops", g.player.x + 2, g.player.y);
  const enemyInitialHp = enemy.hp;

  g.attack();
  const counterEvent = g.consumeEvents().find((e) => e.type === "counter-strike");
  assert.ok(counterEvent, "Counter strike event emitted on attack");
  assert.equal(g.player.counterReady, 0, "Counter ready consumed on attack");
  assert.ok(enemy.hp < enemyInitialHp, "Enemy took massive counter attack damage");
});
