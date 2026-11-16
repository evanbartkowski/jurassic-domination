import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { prepareFlagshipAsset, updateFlagshipAnimation } from '../src/flagship-models.js';
import { creatureArtDirection } from '../src/creature-art-direction.js';
import { readFileSync } from 'node:fs';
import { FLAGSHIP_SPECIES_IDS } from '../src/flagship-models.js';
import { BOTANY } from '../src/botany.js';

test('every shipped Blender creature contains a skin, pigment, and all six clips',()=>{
 for(const id of FLAGSHIP_SPECIES_IDS){
  const b=readFileSync(`public/assets/models-v2/${id}/${id}.glb`);
  assert.equal(b.toString('utf8',0,4),'glTF');
  const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)));
  assert.equal(gltf.skins.length,1,id);
  assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['Attack','Graze','Idle','Rest','Run','Walk']);
  assert.ok(gltf.meshes.some(m=>m.primitives.some(p=>p.attributes.COLOR_0!==undefined)),id);
  assert.ok(b.length<2_000_000,id+' exceeds budget');
 }
});

test('Blender botanical buffers have finite matching attributes and decreasing detail',()=>{
 assert.equal(Object.keys(BOTANY).length,10);
 for(const [name,levels] of Object.entries(BOTANY)){
  assert.equal(levels.length,4);
  assert.ok(levels[0].attributes.position.count>levels[3].attributes.position.count,name);
  for(const g of levels){
   for(const key of ['position','normal','color']){
    assert.equal(g.attributes[key].count,g.attributes.position.count,name);
    assert.ok(g.attributes[key].array.every(Number.isFinite),name);
   }
  }
 }
});

test('anatomical silhouettes distinguish river hunters, runners, armor and browsers',()=>{
 const art=id=>creatureArtDirection({id,body:'rex'});
 assert.ok(art('baryonyx').headLength>art('triceratops').headLength);
 assert.ok(art('velociraptor').torsoWidth<art('ankylosaurus').torsoWidth);
 assert.equal(art('parasaurolophus').family,'browser');
 assert.deepEqual(art('microraptor'),art('microraptor'));
});

test('imported creatures fit the procedural envelope, face +X, and stand on the ground', () => {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 6));
  mesh.position.set(0, 2, 1); scene.add(mesh);
  const asset = prepareFlagshipAsset({ scene, animations: [] }, 5);
  const bounds = new THREE.Box3().setFromObject(asset.root);
  assert.ok(Math.abs(bounds.getSize(new THREE.Vector3()).x - 5) < 1e-5);
  assert.ok(Math.abs(bounds.min.y) < 1e-5);
  assert.notEqual(asset.root, scene);
  assert.equal(scene.rotation.y, 0, 'cached source stays unchanged');
});

test('each imported skeleton animates independently and blends movement with attacks', () => {
  const scene = new THREE.Group(), joint = new THREE.Bone(); joint.name = 'hip'; scene.add(joint);
  const clip = new THREE.AnimationClip('Walk', 1, [new THREE.NumberKeyframeTrack('hip.rotation[x]', [0, .5, 1], [0, .5, 0])]);
  const gltf = { scene, animations: [clip, clip.clone()] }; gltf.animations[1].name = 'Idle';
  const a = prepareFlagshipAsset(gltf, 5), b = prepareFlagshipAsset(gltf, 5);
  updateFlagshipAnimation(a, .2, 1, false, false);
  assert.notEqual(a.root.getObjectByName('hip').rotation.x, b.root.getObjectByName('hip').rotation.x);
  assert.ok(a.actions.Walk.getEffectiveWeight() > 0);
  updateFlagshipAnimation(a, .2, 0, false, true);
  assert.ok(Number.isFinite(a.root.position.y));
});
