import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,statSync} from 'node:fs';
import {SPECIES} from '../src/data.js';import manifest from '../src/reference-assets.json' with {type:'json'};
test('reference-led roster includes every catalogued creature and all six added aquatic species',()=>{
 const catalogue=JSON.parse(readFileSync('assets/reference-pack/references/dinosaur_reference_catalog.json'));assert.equal(catalogue.length,102);assert.equal(SPECIES.length,108);
 assert.ok(catalogue.every(s=>SPECIES.some(actual=>actual.id===s.id)));assert.deepEqual(Object.keys(manifest).sort(),SPECIES.map(s=>s.id).sort());
});
test('every enabled replacement contains two weighted textured LODs, native source and eight real animation clips',()=>{
 for(const {id}of SPECIES){const source=`assets/art-v5/creatures/${id}`,r=JSON.parse(readFileSync(`${source}/report.json`)),file=readFileSync(`public/assets/models-v5/${id}.glb`),g=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)));
  assert.ok(statSync(`${source}/${id}.blend`).size>10000,id);assert.equal(r.qa.pass,true,id);assert.equal(r.lodQA.pass,true,id);assert.equal(file.readUInt32LE(8),file.length,id);
  assert.deepEqual(g.animations.map(a=>a.name).sort(),['Attack','Death','Graze','Hit','Idle','Rest','Run','Walk'],id);assert.equal(g.meshes.length,2,id);assert.ok(g.skins[0].joints.length<=64,id);assert.ok(r.lodTriangles<r.triangles*.7,id);
  for(const mesh of g.meshes)for(const p of mesh.primitives)for(const key of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])assert.ok(Number.isInteger(p.attributes[key]),`${id} ${key}`);
  for(const qa of [r.qa,r.lodQA])for(const m of Object.values(qa.objects))for(const key of ['boundary_edges','nonmanifold_edges','inconsistent_normals_edges','unweighted_verts','verts_over_4_influences','uv_zero_area_faces'])assert.equal(m[key],0,`${id} ${key}`);
 }
});
