import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {SPECIES} from '../src/data.js';
const records=SPECIES.map(({id})=>{
 const report=JSON.parse(readFileSync(`assets/art-v5/creatures/${id}/report.json`));
 assert.equal(report.detailVersion,2,id);assert.equal(report.qa.pass,true,id);assert.equal(report.lodQA.pass,true,id);
 assert.ok(report.triangles<=80000,id);assert.ok(report.lodTriangles<report.triangles*.7,id);
 const binary=readFileSync(`public/assets/models-v5/${id}.glb`),gltf=JSON.parse(binary.subarray(20,20+binary.readUInt32LE(12)));
 assert.equal(binary.readUInt32LE(8),binary.length,id);assert.equal(gltf.meshes.length,2,id);assert.equal(gltf.animations.length,8,id);
 assert.equal(gltf.materials.length,1,id);assert.equal(gltf.materials[0].extras.detailVersion,2,id);
 const acceptedWarnings=[...report.qa.warnings,...report.lodQA.warnings].map(warning=>{
  const reason=warning.startsWith('hidden back-to-back faces:')?'Buried opposing faces at deliberately intersecting closed attachment roots. They do not produce exposed z-fighting.':warning.includes('duplicate verts=')?'Coincident positions at separately closed eyelid and feather attachment seams. Surfaces remain manifold and preserve their independent UV and deformation boundaries.':null;
  assert.ok(reason,`${id}: unreviewed warning ${warning}`);return{warning,reason};
 });
 return{id,triangles:report.triangles,lodTriangles:report.lodTriangles,bones:report.bones,materials:gltf.materials.length,bytes:binary.length,features:report.detailFeatures,acceptedWarnings,
  nativeMaterialReview:existsSync(`artifacts/creature-detail/native/${id}-material.png`),nativeWireReview:existsSync(`artifacts/creature-detail/native/${id}-wire.png`)};
});
const summary={creatures:records.length,minTriangles:Math.min(...records.map(r=>r.triangles)),maxTriangles:Math.max(...records.map(r=>r.triangles)),totalBytes:records.reduce((sum,r)=>sum+r.bytes,0),materialsPerCreature:1,animationClipsPerCreature:8,acceptedWarnings:records.reduce((sum,r)=>sum+r.acceptedWarnings.length,0)};
writeFileSync('artifacts/creature-detail/asset-audit.json',JSON.stringify({summary,records},null,2));console.log(JSON.stringify(summary,null,2));
