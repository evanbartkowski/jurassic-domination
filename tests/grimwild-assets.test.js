import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SPECIES} from '../src/data.js';
test('all 108 anatomical exports pass mesh QA and ship bounded weighted surfaces and six clips',()=>{
 assert.equal(SPECIES.length,108);let total=0;
 for(const {id} of SPECIES){
  const bytes=readFileSync(`public/assets/models-v3/${id}.glb`),gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12))),report=JSON.parse(readFileSync(`assets/art-v3/creatures/${id}/report.json`));
  assert.deepEqual(report.qa.errors,[],id);assert.equal(report.qa.pass,true,id);assert.ok(report.triangles<45000,id);assert.ok(bytes.length<(id==='hydra'?3000000:2600000),id);total+=bytes.length;
  assert.equal(gltf.skins.length,1,id);assert.ok(gltf.nodes.some(n=>n.extras?.forwardAxis==='X'&&n.extras?.sourceVersion===3),id);
  assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['Attack','Graze','Idle','Rest','Run','Walk']);
  assert.ok(gltf.meshes.some(m=>m.primitives.some(p=>p.attributes.COLOR_0!==undefined)),id);
  for(const mesh of gltf.meshes)for(const p of mesh.primitives){assert.ok(p.attributes.JOINTS_0!==undefined&&p.attributes.WEIGHTS_0!==undefined,id);assert.equal(gltf.accessors[p.attributes.WEIGHTS_0].type,'VEC4');assert.ok(gltf.accessors[p.attributes.POSITION].min.every(Number.isFinite),id);}
 }assert.ok(total<160000000,'streamed roster budget');
});
