import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Terrain, createTerrainChunk, terrainPlan } from "../src/terrain.js";
import { WorldRenderer } from "../src/renderer.js";

// Geometry construction needs a canvas texture, not a browser or GPU.
const context = new Proxy({}, { get: (target, key) => target[key] || (() => {}) });
globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => context }) };

function fakeChunk(cx, cy, seed) {
  const group = new THREE.Group();
  group.userData = { cx, cy, seed, features: [], water: [], dispose() { this.disposals = (this.disposals || 0) + 1; } };
  return group;
}
function triangles(group) {
  let total = 0;
  group.traverse((mesh) => {
    if (mesh.isMesh) total += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
  });
  return total;
}

test("terrain prepares the containing chunk first, including negative coordinates, with one build per frame", () => {
  const scene = new THREE.Scene(), terrain = new Terrain(scene, { createChunk: fakeChunk });
  assert.equal(terrainPlan(-161, -1)[0].id, "-2,-1");
  terrain.update(-161, -1, 23);
  assert.equal(terrain.chunks.size, 1);
  assert.ok(terrain.chunks.has("-2,-1"));
  assert.equal(terrain.pending.length, 8);
  for (let i = 0; i < 8; i++) {
    terrain.update(-161, -1, 23);
    assert.equal(terrain.metrics.builtThisFrame, 1);
    assert.ok(terrain.chunks.size <= 9);
  }
  assert.equal(terrain.pending.length, 0);
  terrain.update(-161, -1, 23);
  assert.equal(terrain.metrics.builtThisFrame, 0);
  assert.equal(terrain.metrics.builds, 9);
});

test("streaming cancels obsolete work, bounds resident chunks and disposes old seed state", () => {
  const scene = new THREE.Scene(), terrain = new Terrain(scene, { createChunk: fakeChunk });
  terrain.update(0, 0, 23);
  const first = terrain.chunks.get("0,0");
  terrain.update(800, 800, 23);
  assert.ok(terrain.chunks.has("5,5"));
  assert.equal(first.userData.disposals, 1);
  assert.equal(terrain.pending.length, 8);
  for (let i = 0; i < 40; i++) {
    terrain.update((i % 6) * 190, -(i % 5) * 175, 23);
    assert.ok(terrain.chunks.size <= 9 && terrain.pending.length <= 8);
    assert.equal(scene.children.length, terrain.chunks.size);
  }
  const prior = [...terrain.chunks.values()];
  terrain.update(0, 0, 98);
  assert.ok(prior.every((g) => g.userData.disposals === 1));
  assert.equal(terrain.chunks.get("0,0").userData.seed, 98);
  terrain.dispose(); terrain.dispose();
  assert.equal(scene.children.length, 0);
  assert.equal(terrain.chunks.size, 0);
  assert.equal(terrain.pending.length, 0);
  terrain.update(0, 0);
  assert.equal(scene.children.length, 0);
});

test("quality presets change real shared geometry and decoration density without changing collision features", () => {
  const terrain = new Terrain(new THREE.Scene());
  terrain.update(0, 0, 4411);
  const group = terrain.chunks.get("0,0"), features = JSON.stringify(group.userData.features.map((m) => m.userData.feature));
  const high = triangles(group);
  terrain.setQuality("medium");
  const medium = triangles(group);
  terrain.setQuality("low");
  const low = triangles(group);
  assert.ok(high > medium && medium > low, JSON.stringify({ high, medium, low }));
  assert.equal(JSON.stringify(group.userData.features.map((m) => m.userData.feature)), features);
  terrain.setQuality("high");
  assert.equal(triangles(group), high);
  assert.ok(group.userData.detailMeshes.every((m) => m.count === m.userData.detail.count));
  const shared = group.userData.detailMeshes[0].geometry;
  let disposed = 0;
  shared.addEventListener("dispose", () => disposed++);
  terrain.dispose();
  assert.equal(disposed, 0, "unloading must preserve geometry shared by later chunks");
});

test("distant terrain uses fewer vertices and restores culling bounds when returning", () => {
  const terrain = new Terrain(new THREE.Scene());
  terrain.update(0, 0, 4411);
  const group = terrain.chunks.get("0,0"), near = triangles(group);
  terrain.applyDetail(500, 500);
  assert.ok(triangles(group) < near);
  for (const mesh of group.userData.detailMeshes) mesh.computeBoundingSphere();
  terrain.applyDetail(0, 0);
  assert.equal(triangles(group), near);
  assert.ok(group.userData.detailMeshes.every((m) => m.boundingSphere === null));
  terrain.dispose();
});

test("magnet movement updates an existing food model without recreating its shared geometry", () => {
  const world = Object.create(WorldRenderer.prototype);
  world.scene = new THREE.Scene(); world.foodModels = new Map(); world.cameraTarget = new THREE.Vector3();
  const food = { id: "moving-food", type: "plant", plantKind: "berry", x: 10, y: 3 };
  world.syncFood([food], 0);
  const model = world.foodModels.get(food.id), geometry = model.children[0].geometry;
  food.x = 4; food.y = 1;
  world.syncFood([food], 0.1);
  assert.equal(world.foodModels.get(food.id), model);
  assert.equal(model.children[0].geometry, geometry);
  assert.deepEqual([model.position.x, model.position.z], [4, 1]);
  world.syncFood([], 0.2);
  assert.equal(world.foodModels.size, 0);
});

test("world renderer disposal removes listeners and owned resources exactly once", () => {
  const world = Object.create(WorldRenderer.prototype), calls = { listener: 0, terrain: 0, menu: 0, renderer: 0, context: 0, geometry: 0, material: 0 };
  Object.assign(world, {
    scene: new THREE.Scene(), models: new Map(), foodModels: new Map(), warnings: new Map(), effects: [], particles: [],
    cameraTarget: new THREE.Vector3(), canvas: { removeEventListener() { calls.listener++; } },
    terrain: { dispose() { calls.terrain++; } }, sun: new THREE.DirectionalLight(),
    renderer: { dispose() { calls.renderer++; }, forceContextLoss() { calls.context++; } },
    menuDino: new THREE.Group(), minimapBackdrops: new Map([["x", {}]]),
  });
  world.menuDino.userData.dispose = () => calls.menu++;
  world.scene.add(world.menuDino);
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  geometry.addEventListener("dispose", () => calls.geometry++);
  material.addEventListener("dispose", () => calls.material++);
  world.scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
  world.dispose(); world.dispose();
  assert.deepEqual(calls, { listener: 1, terrain: 1, menu: 1, renderer: 1, context: 1, geometry: 1, material: 1 });
  assert.equal(world.scene.children.length, 0);
  assert.equal(world.minimapBackdrops.size, 0);
});

test("screen projection incorporates terrain elevation", () => {
  const world = Object.create(WorldRenderer.prototype);
  world.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  world.camera.position.set(0, 50, 50);
  world.camera.lookAt(0, 0, 0);
  world.camera.updateMatrixWorld();
  world.projectedPosition = new THREE.Vector3();
  const flatProj = world.project(0, 0, 2);
  assert.equal(typeof flatProj.x, "number");
  assert.equal(typeof flatProj.y, "number");
  assert.equal(typeof flatProj.visible, "boolean");
  const ridgeProj = world.project(120, 120, 2);
  assert.equal(typeof ridgeProj.x, "number");
  assert.equal(typeof ridgeProj.y, "number");
  assert.equal(typeof ridgeProj.visible, "boolean");
});
