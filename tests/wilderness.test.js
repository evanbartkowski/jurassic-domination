import test from "node:test";
import assert from "node:assert/strict";
import {
  worldFeatures,
  resolveObstacles,
  updateWildlife,
  marinePose,
  marineSpeed,
} from "../src/wilderness.js";
import { createWildFeature } from "../src/wilderness-art.js";
import { attackProfile } from "../src/combat.js";
import { SPECIES, SPECIES_BY_ID } from "../src/data.js";
import { newProfile, normalizeProfile } from "../src/profile.js";
import {
  careForPet,
  sanctuaryProgress,
  ISLAND_TRIALS,
  COMPANION_SYNERGIES,
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
function marineGame() {
  return {
    time: 0,
    player: { x: 140, y: 100, vx: 0, vy: 0, poisoned: 0 },
    species: { size: 1 },
    effectiveSize: 1,
    rules: { enemyDamage: 1 },
    worldFeatures: [{ id: "pool", type: "water", x: 100, y: 100, radius: 16, tier: 2, phase: 0.4 }],
    bites: 0,
    damagePlayer() { this.bites++; },
    emit() {},
  };
}
test("marine predators swim continuously into range rather than teleporting on entry or retarget", () => {
  const g = marineGame(), f = g.worldFeatures[0];
  updateWildlife(g, 0);
  let previous = g.marineState.get(f.id).swimmers.map((s) => ({ ...s }));
  g.player.x = 100;
  for (let tick = 0; tick < 100; tick++) {
    g.time += 0.1;
    if (tick === 15) g.player.y = 106;
    if (tick === 20) g.player.y = 100;
    updateWildlife(g, 0.1);
    const swimmers = g.marineState.get(f.id).swimmers;
    swimmers.forEach((s, i) => {
      assert.ok(Math.hypot(s.x - previous[i].x, s.y - previous[i].y) <= marineSpeed(f, i, true) * 0.1 + 1e-8);
      assert.ok(Math.abs(s.angle - previous[i].angle) <= 0.28 + 1e-8);
      assert.ok(Math.hypot(s.x - f.x, s.y - f.y) <= f.radius - 2.3 + 1e-8);
    });
    previous = swimmers.map((s) => ({ ...s }));
    if (tick === 0) assert.equal(g.bites, 0, "entering deep water cannot pull distant predators onto the player");
  }
  assert.ok(g.bites > 0, "predators eventually swim into physical bite range");
});
test("marine rendering reads simulation positions without moving swimmers, including while paused", () => {
  const g = marineGame(), f = g.worldFeatures[0];
  updateWildlife(g, 0.1);
  const state = g.marineState.get(f.id), snapshot = structuredClone(state),
    art = createWildFeature({ ...f });
  art.userData.animate(g.time, g.player, g.marineState);
  state.swimmers.forEach((s, i) => {
    assert.equal(marinePose({ ...f }, 900, i, g.player, g.marineState), s);
    const model = art.userData.swimmers[i];
    assert.equal(model.position.x + f.x, s.x);
    assert.equal(model.position.z + f.y, s.y);
    assert.equal(model.rotation.y, -s.angle);
  });
  art.userData.animate(g.time, { x: 100, y: 100 }, g.marineState);
  assert.deepEqual(state, snapshot, "renderer and player proximity cannot advance the simulation");
  g.worldFeatures = [{ ...f }];
  updateWildlife(g, 0);
  assert.equal(g.marineState.get(f.id), state, "streaming feature objects preserves active pool positions");
  g.worldFeatures = [];
  updateWildlife(g, 0.1);
  assert.equal(g.marineState.size, 0, "unloaded pools release simulation state");
  art.userData.dispose();
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

test("18 companion pet synergies grant active roles and sanctuary features expanded trials", () => {
  assert.equal(ISLAND_TRIALS.length, 4);
  assert.ok(ISLAND_TRIALS.some((t) => t.id === "botanical-garden"));
  assert.ok(ISLAND_TRIALS.some((t) => t.id === "apex-sanctuary"));

  assert.equal(Object.keys(COMPANION_SYNERGIES).length, 18);
  assert.equal(COMPANION_SYNERGIES["rex"].role, "apex");
  assert.equal(COMPANION_SYNERGIES["titan"].role, "titan");
  assert.equal(COMPANION_SYNERGIES["club"].role, "bulwark");
  assert.equal(COMPANION_SYNERGIES["raptor"].role, "prowler");

  // In Game, equipping a bulwark pet boosts armor
  const gBulwark = new Game({ seed: 77, petId: "club" });
  gBulwark.hatch();
  const gBase = new Game({ seed: 77, petId: null });
  gBase.hatch();
  assert.ok(gBulwark.player.armor > gBase.player.armor);

  // In Game, equipping a titan pet boosts max HP
  const gTitan = new Game({ seed: 77, petId: "titan" });
  gTitan.hatch();
  assert.ok(gTitan.player.maxHp > gBase.player.maxHp);
});
