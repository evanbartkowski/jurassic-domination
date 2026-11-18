import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Terrain, createTerrainChunk, createTerrainChunkSteps, terrainPlan } from "../src/terrain.js";
import { WorldRenderer } from "../src/renderer.js";
import { worldFeatures } from '../src/wilderness.js';
import { elevationAt } from '../src/terrain.js';
import { createDinosaur, animateCreature } from '../src/creatures.js';
import { SPECIES_BY_ID } from '../src/data.js';
import {createWildFeature} from '../src/wilderness-art.js';

// Geometry construction needs a canvas texture, not a browser or GPU.
const context = new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}})}, { get: (target, key) => target[key] || (() => {}) });
globalThis.document = { createElement: () => ({ width: 1, height: 1, getContext: () => context }) };
test('dead aquatic actors sink away, stay hidden until respawn and restore their live pose',()=>{
 const feature={id:'death-pool',type:'water',x:200,y:200,radius:15,phase:0};
 const pool=createWildFeature(feature,0),fish={x:201,y:202,angle:.4,dead:true,deadAt:10,hunting:false};
 const state=new Map([[feature.id,{swimmers:[fish,fish,fish]}]]);
 pool.userData.animate(10.5,{x:180,y:180},state);
 const wrapper=pool.userData.swimmers[0];assert.ok(wrapper.position.y<0,'corpse sinks');
 pool.userData.animate(13,{x:180,y:180},state);assert.equal(wrapper.visible,false);
 fish.dead=false;pool.userData.animate(46,{x:180,y:180},state);
 assert.equal(wrapper.visible,true);assert.equal(wrapper.rotation.z,0);
 pool.userData.dispose();
});
test('streaming pools use small loading silhouettes instead of rebuilding complex marine animals',()=>{
 const pool=createWildFeature({id:'pool-qa',type:'water',x:200,y:200,radius:15,phase:0},0);let meshes=0;
 pool.traverse(n=>{if(n.isMesh)meshes++;});assert.ok(meshes<20,`pool built ${meshes} meshes synchronously`);
 assert.equal(pool.userData.swimmers.length,3);
 for(const wrapper of pool.userData.swimmers)assert.equal(wrapper.userData.model.userData.isMarineProxy,true);
 pool.userData.dispose();
 for(const wrapper of pool.userData.swimmers)assert.equal(wrapper.userData.model.userData.artDisposed,true);
});
test('background terrain is built in slices and cancelled staging never enters the scene',()=>{
 const scene=new THREE.Scene(),terrain=new Terrain(scene,{buildBudgetMs:0});
 terrain.update(80,80,4411);assert.equal(terrain.chunks.size,1,'center is immediately available');
 terrain.update(80,80,4411);assert.equal(terrain.chunks.size,1,'unfinished neighbor stays hidden');
 assert.ok(terrain.buildJob,'background work survives between frames');
 const job=terrain.buildJob;terrain.dispose();assert.equal(terrain.buildJob,null);assert.equal(job.steps.next().done,true);
 assert.equal(scene.children.length,0);
});
test('sliced terrain produces the same deterministic terrain as a synchronous build',()=>{
 const sync=createTerrainChunk(0,0,4411),steps=createTerrainChunkSteps(0,0,4411);let result,count=0;
 do{result=steps.next();count++;}while(!result.done);
 assert.ok(count>15);assert.deepEqual([...sync.children[0].geometry.attributes.position.array],[...result.value.children[0].geometry.attributes.position.array]);
 assert.equal(sync.children.length,result.value.children.length);sync.userData.dispose();result.value.userData.dispose();
});
test('fallback bite keeps the skull rooted at its neck and juvenile jaws are not scaled twice',()=>{
 const model=createDinosaur(SPECIES_BY_ID.tyrannosaurus,true),d=model.userData;d.isJuvenile=true;
 for(let i=0;i<60;i++)animateCreature(model,1/60,i/60,1,true,.4);
 assert.ok(Math.abs(d.head.position.x-d.headBaseX)<.03,'head detaches from the fixed neck');
 assert.ok(Math.abs(d.head.position.y-d.headBaseY)<.03,'head detaches vertically');
 assert.equal(d.jaw.scale.x,1,'nested jaw inherits its head scale once');model.userData.dispose();
});

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

test('the visible pool basin stays below its continuous water surface on rolling terrain',()=>{
 const chunk=createTerrainChunk(1,1,4411),pool=worldFeatures(4411,1,1).find(f=>f.type==='water');
 const ground=chunk.children[0],positions=ground.geometry.attributes.position;let samples=0;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i)+ground.position.x,z=positions.getZ(i)+ground.position.z;
  if(Math.hypot(x-pool.x,z-pool.y)<pool.radius-5){samples++;assert.ok(positions.getY(i)<elevationAt(pool.x,pool.y)+.08,'ground cuts through the pool');}
 }
 assert.ok(samples>3);chunk.userData.dispose();
});

test('projectile visual synchronization receives delta time without a frame exception',()=>{
 const world=Object.create(WorldRenderer.prototype);
 world.scene=new THREE.Scene();world.warnings=new Map();world.addParticle=()=>{};
 const game={entities:[],warnings:[],projectiles:[{id:1,kind:'venom',x:0,y:0,radius:.3,angle:0}]};
 assert.doesNotThrow(()=>world.syncWarnings(game,1,1/60));
 assert.equal(world.projectileModels.size,1);
});
test('committed bites and tail sweeps display a ground windup and clear it during recovery',()=>{
 const world=Object.create(WorldRenderer.prototype);world.scene=new THREE.Scene();world.warnings=new Map();world.addParticle=()=>{};
 const e={id:5,speciesId:'ankylosaurus',x:0,y:0,telegraph:.4,combatPlan:{phase:'windup',kind:'tail-sweep',arc:Math.PI,angle:1.2,windup:.78,reach:1.13}};
 const g={player:{x:2,y:0},effectiveSize:1,entities:[e],projectiles:[]};world.syncWarnings(g,1,.016);assert.ok(world.warnings.has('melee:5'));assert.equal(world.warnings.get('melee:5').rotation.y,-1.2);
 e.telegraph=0;world.syncWarnings(g,1.1,.016);assert.equal(world.warnings.has('melee:5'),false);
});

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
