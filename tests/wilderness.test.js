import test from "node:test";
import assert from "node:assert/strict";
import {
  worldFeatures,
  resolveObstacles,
  updateWildlife,
} from "../src/wilderness.js";
import { attackProfile } from "../src/combat.js";
import { SPECIES, SPECIES_BY_ID } from "../src/data.js";
import { newProfile, normalizeProfile } from "../src/profile.js";
import {
  careForPet,
  sanctuaryProgress,
  ISLAND_TRIALS,
} from "../src/sanctuary.js";
import { Game } from "../src/game.js";
test("wilderness is deterministic, varied, bounded and protects the first 55 units", () => {
  let count = 0;
  const types = new Set();
  for (let x = -10; x < 10; x++)
    for (let y = -10; y < 10; y++) {
      const a = worldFeatures(123, x, y);
      assert.deepEqual(a, worldFeatures(123, x, y));
      for (const f of a) {
        assert.ok(Math.hypot(f.x, f.y) >= 55);
        assert.ok(Math.hypot(f.x, f.y) < 1580);
        types.add(f.type);
        count++;
      }
    }
  assert.ok(count > 1000);
  assert.equal(types.size, 8);
});
test("solid wilderness objects push players and creatures outside their footprint", () => {
  const a = { x: 0, y: 0 };
  resolveObstacles(a, 2, [{ x: 0, y: 0, radius: 3, solid: true }]);
  assert.ok(Math.hypot(a.x, a.y) >= 3.7);
});
test("toxic fungi poison, snapjaws bite and water slows with marine attacks", () => {
  const g = new Game({ seed: 12 });
  g.hatch();
  g.entities = [];
  g.player.invulnerable = 0;
  g.player.x = 90;
  g.player.y = 0;
  const hazard = (type) => {
    g._hazardCooldown = 0;
    g.worldFeatures = [
      {
        id: "test",
        type,
        x: 90,
        y: 0,
        radius: 12,
        tier: 2,
        phase: Math.PI / 2,
      },
    ];
  };
  hazard("mushrooms");
  updateWildlife(g, 0.1);
  assert.ok(g.player.poisoned > 0);
  hazard("carnivore");
  const hp = g.player.hp;
  updateWildlife(g, 0.1);
  assert.ok(g.player.hp < hp);
  g.player.invulnerable = 0;
  hazard("water");
  g.player.vx = 10;
  updateWildlife(g, 0.1);
  assert.ok(g.player.vx < 10);
  assert.match(g.hazardHint, /MARINE/);
  hazard("volcano");
  g.player.invulnerable = 0;
  const before = g.player.hp;
  updateWildlife(g, 0.1);
  assert.ok(g.player.hp < before);
});
test("attack reach, recovery and ranged reach depend on the actual species", () => {
  const profiles = SPECIES.map(attackProfile);
  assert.ok(new Set(profiles.map((p) => p.reach)).size > 15);
  assert.ok(profiles.every((p) => p.windup <= 0.24 && p.cooldown < 1));
  const fire = attackProfile(SPECIES_BY_ID.carnotaurus);
  assert.ok(fire.ranged && fire.range > 20);
  assert.equal(SPECIES_BY_ID.spinosaurus.abilityType, "lightning");
});
test("ranged enemies fire travelling attacks that damage and expire", () => {
  const g = new Game({ seed: 28 });
  g.hatch();
  g.entities = [];
  g.worldFeatures = [];
  g.player.x = 0;
  g.player.y = 0;
  g.player.invulnerable = 0;
  const e = g.spawnEntity("frost-dragon", 14, 0, { behavior: "hunter" });
  e.skillCooldown = 0;
  e.aggro = 5;
  g._updateEntity(e, 0.016);
  assert.ok(e.cast);
  assert.ok(e.cast.remaining < 0.4);
  g._updateEntity(e, 0.3);
  assert.equal(g.projectiles.length, 1);
  const before = g.player.hp;
  for (let i = 0; i < 60; i++) {
    g.player.invulnerable = 0;
    g.updateEcosystem(1 / 60, {});
  }
  assert.ok(g.player.hp < before);
  assert.equal(g.projectiles.length, 0);
});
test("pet bonds require a real resident and enforce a saved active-time cooldown", () => {
  const p = newProfile();
  p.pets = ["compy"];
  p.island.placements = [
    { id: "i1", kind: "pet", itemId: "compy", x: 0, y: 0, rotation: 0 },
  ];
  assert.equal(careForPet(p, "fake").ok, false);
  assert.ok(careForPet(p, "i1").ok);
  assert.equal(careForPet(p, "i1").ok, false);
  const restored = normalizeProfile(p);
  assert.equal(careForPet(restored, "i1").ok, false);
  restored.island.visitSeconds += 60;
  assert.ok(careForPet(restored, "i1").ok);
  assert.equal(restored.island.care.compy, 2);
});
test("sanctuary trials measure time, care, placed residents, rarity and decoration counts", () => {
  const p = newProfile();
  p.island.visitSeconds = 180;
  p.island.care = { compy: 9 };
  p.island.placements = [
    ...["compy", "rex", "raptor"].map((itemId, i) => ({
      id: "i" + i,
      kind: "pet",
      itemId,
    })),
    ...Array.from({ length: 8 }, (_, i) => ({
      id: "d" + i,
      kind: "decoration",
      itemId: "fern",
    })),
  ];
  const s = sanctuaryProgress(p, ISLAND_TRIALS[0]);
  assert.deepEqual(s, {
    seconds: 180,
    pets: 3,
    decorations: 8,
    care: 9,
    rare: true,
  });
});
