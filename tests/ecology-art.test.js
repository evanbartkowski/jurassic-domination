import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Game } from "../src/game.js";
import { createEcologyArt } from "../src/ecology-art.js";
import { initializeWorldState, worldStatus } from "../src/world-events.js";
import { createWildFeature } from "../src/wilderness-art.js";

test("ecosystem visuals reuse bounded pools while reading real tracks, nests, and weather", () => {
  const scene = new THREE.Scene(), art = createEcologyArt(scene), g = new Game({ seed: 48 });
  assert.equal(art.root.visible, false);
  initializeWorldState(g); g.player.x = 250; g.player.y = 0;
  g.senses.trails = Array.from({ length: 96 }, (_, i) => ({ kind: i % 2 ? "blood" : "footprint", x: 250 + i % 8, y: i % 10,
    angle: i * 0.1, createdAt: 0, expiresAt: 20, strength: 1, sourceId: "player" }));
  g.nests = Array.from({ length: 9 }, (_, i) => ({ id: `nest:${i}`, x: 250 + i, y: i }));
  const before = JSON.stringify({ random: g._randomState, entities: g.entities, player: g.player, senses: g.senses, nests: g.nests, worldState: g.worldState });
  art.update(g, 0.05);
  assert.equal(art.root.userData.counts.footprints, 48); assert.equal(art.root.userData.counts.blood, 48);
  assert.equal(art.root.userData.counts.nests, 9);
  assert.equal(JSON.stringify({ random: g._randomState, entities: g.entities, player: g.player, senses: g.senses, nests: g.nests, worldState: g.worldState }), before);
  const objectCount = art.root.children.length;
  for (let i = 0; i < 100; i++) art.update(g, 0.05, i % 2 ? "low" : "high");
  assert.equal(art.root.children.length, objectCount);
  art.update(g, 0.05, "low"); assert(art.root.userData.counts.footprints + art.root.userData.counts.blood <= 40);
  let rainFound = false;
  for (let time = 120; time < 9000; time += 15) {
    g.worldState.clock = time; const status = worldStatus(g);
    if (status.phase === "active" && ["rain", "flood"].includes(status.event)) { rainFound = true; break; }
  }
  assert(rainFound); art.update(g, 0.05, "high"); assert.equal(art.root.userData.counts.weather, 240);
  art.update(g, 0.05, "low"); assert.equal(art.root.userData.counts.weather, 48);
  assert.equal(scene.children.length, 1); art.dispose();
});

test("returning to a menu hides every pooled world visual and resuming restores the same resources", () => {
  const scene = new THREE.Scene(), art = createEcologyArt(scene), g = new Game({ seed: 48 });
  art.update(g, 0.05); assert(art.root.visible);
  const children = [...art.root.children];
  art.update(null, 0.05); assert.equal(art.root.visible, false);
  art.update(g, 0.05); assert(art.root.visible); assert.deepEqual(art.root.children, children);
  art.dispose();
});

test("all three marine anatomical models remain finite with independently animated tails", () => {
  const feature = { id: "test-pool", type: "water", x: 100, y: 100, radius: 16, tier: 2, phase: 0.4 },
    model = createWildFeature(feature), swimmers = model.userData.swimmers;
  assert.equal(new Set(swimmers.map((swimmer) => swimmer.userData.kind)).size, 3);
  const marineState = new Map([[feature.id, { swimmers: swimmers.map((_, i) => ({ x: 100 + i, y: 100 - i, angle: i, hunting: true })) }]]);
  for (let time = 0; time < 100; time += 0.7) {
    model.userData.animate(time, { x: 100, y: 100 }, marineState); model.updateMatrixWorld(true);
    model.traverse((object) => {
      assert(object.matrixWorld.elements.every(Number.isFinite));
      if (object.geometry) assert([...object.geometry.attributes.position.array].every(Number.isFinite));
    });
  }
  assert(swimmers.every((swimmer) => swimmer.userData.tail && swimmer.children.length <= 4));
  model.userData.dispose();
});

test("disposing ecology graphics releases unique geometry/materials once and removes all scene objects", () => {
  const scene = new THREE.Scene(), art = createEcologyArt(scene), geometries = new Set(), materials = new Set(), counts = new Map();
  art.root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
  });
  for (const resource of [...geometries, ...materials]) {
    counts.set(resource, 0); resource.addEventListener("dispose", () => counts.set(resource, counts.get(resource) + 1));
  }
  art.dispose(); art.dispose(); art.update(new Game({ seed: 1 }), 0.05);
  assert.equal(scene.children.length, 0); assert.equal(art.root.children.length, 0);
  assert([...counts.values()].every((count) => count === 1));
});
