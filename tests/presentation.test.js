import test from 'node:test';
import assert from 'node:assert/strict';
import { UI } from '../src/ui.js';
import * as THREE from 'three';
import { WorldRenderer } from '../src/renderer.js';
import { themedMarkup } from '../src/presentation.js';
import { BIOME_LOOKS, groundPigment, poolMaterial } from '../src/environment-presentation.js';
import { REGIONS } from '../src/world-data.js';

test('every supported biome has an authored palette and deterministic terrain pigment',()=>{
 assert.deepEqual(Object.keys(BIOME_LOOKS).sort(),REGIONS.map(r=>r.id).sort());
 for(const [x,z] of [[0,0],[160,-160],[800,200],[-1200,-400]]){
  assert.deepEqual(groundPigment(x,z),groundPigment(x,z));
  assert.ok(groundPigment(x,z).toArray().every(v=>Number.isFinite(v)&&v>=0&&v<=1));
 }
});

test('water contact ripples observe movement without modifying the actor',()=>{
 const mat=poolMaterial(8),feature={x:0,y:0},actor={x:0,y:0};
 mat.userData.update(0,actor,feature);assert.deepEqual(actor,{x:0,y:0});
 actor.x=2;mat.userData.update(.1,actor,feature);
 assert.ok(mat.uniforms.uMovement.value>0);assert.deepEqual(actor,{x:2,y:0});
 mat.dispose();
});

test('icon conversion preserves attribute values while replacing authored display glyphs',()=>{
 const html=themedMarkup('<button title="🧬 Adapt">🧬 Adapt</button>');
 assert.ok(html.includes('title="🧬 Adapt"'));
 assert.ok(html.includes('<svg'));
});

test('particles share a bounded sprite batch while leaf fragments retain geometry',()=>{
 const mesh=geometry=>new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial(),8);
 const world=Object.assign(Object.create(WorldRenderer.prototype),{maxParticles:8,elapsed:1,camera:new THREE.PerspectiveCamera(),particleDummy:new THREE.Object3D(),particleMesh:mesh(new THREE.IcosahedronGeometry(1)),softParticleMesh:mesh(new THREE.PlaneGeometry()),
 particles:[{kind:'leaf',life:1,x:0,y:2,z:0,vx:0,vy:0,vz:0,size:1,color:0x667744},{life:1,x:0,y:2,z:0,vx:0,vy:0,vz:0,size:1,color:0xaa8866}]});
 world.drawParticles(1/60);
 assert.equal(world.particles.length,2);
 assert.equal(world.particleMesh.count,1);
 assert.equal(world.softParticleMesh.count,1);
});

test('opening a menu hides gameplay HUD controls behind the modal',()=>{
 const fake={hud:{hidden:false},overlay:{hidden:true,className:'',innerHTML:'',scrollTop:0,querySelector:()=>null,dataset:{}},settings:{}};
 UI.prototype.screen.call(fake,'settings','<section>Settings</section>');
 assert.equal(fake.hud.hidden,true);
});
