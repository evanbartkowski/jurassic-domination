import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {SPECIES} from '../src/data.js';
const dir='artifacts/reference-overhaul';await fs.mkdir(dir,{recursive:true});
let referenceText;try{referenceText=await fs.readFile(`${dir}/references/index.json`,'utf8');}catch{referenceText=await fs.readFile('assets/reference-pack/reviewed-references.json','utf8');}
const refs=JSON.parse(referenceText);
const ids=JSON.parse(await fs.readFile('assets/reference-pack/references/dinosaur_reference_catalog.json','utf8')).map(e=>e.id);
assert.equal(new Set(ids).size,102);assert.ok(ids.every(id=>SPECIES.some(s=>s.id===id)));
const entries=[],manifest={};
for(const s of SPECIES){const id=s.id,entry={id,name:s.name,catalogued:ids.includes(id),reference:refs.find(e=>e.id===id)||{status:'added-roster-species',category:'other prehistoric animal',design_notes:'Additional wild aquatic fauna; four flippers for marine reptiles, paired fins for fish, no land legs.'},source:`assets/art-v5/creatures/${id}/${id}.blend`,file:`public/assets/models-v5/${id}.glb`,screenshots:[`after/${id}-idle.png`,`after/${id}-attack.png`],technicalPass:false};try{
 const report=JSON.parse(await fs.readFile(`assets/art-v5/creatures/${id}/report.json`,'utf8')),file=await fs.readFile(entry.file),gltf=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)));
 assert.equal(file.readUInt32LE(0),0x46546c67);assert.equal(file.readUInt32LE(8),file.length);assert.ok((await fs.stat(entry.source)).size>10000);
 assert.ok(report.qa.pass&&report.lodQA.pass,JSON.stringify([...report.qa.errors,...report.lodQA.errors]));
 for(const qa of [report.qa,report.lodQA])for(const mesh of Object.values(qa.objects)){for(const key of ['boundary_edges','nonmanifold_edges','degenerate_faces','unweighted_verts','verts_over_4_influences','inconsistent_normals_edges','uv_zero_area_faces'])assert.equal(mesh[key],0,key);assert.ok(mesh.uv_maps>=1);}
 assert.equal(gltf.meshes.length,2);assert.ok(gltf.skins.length>=1);assert.ok(gltf.nodes.some(n=>n.extras?.sourceVersion===5));
 assert.deepEqual(gltf.animations.map(a=>a.name).sort(),['Attack','Death','Graze','Hit','Idle','Rest','Run','Walk']);
 for(const mesh of gltf.meshes)for(const p of mesh.primitives)for(const key of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])assert.ok(Number.isInteger(p.attributes[key]),key);
 const mat=gltf.materials[0];assert.ok(mat.pbrMetallicRoughness.baseColorTexture&&mat.pbrMetallicRoughness.metallicRoughnessTexture&&mat.normalTexture);
 assert.ok(report.triangles<90000&&report.lodTriangles<report.triangles*.70);assert.ok(file.length<12000000);assert.ok(report.dimensions.every(v=>Number.isFinite(v)&&v>.01));
 Object.assign(entry,{technicalPass:true,family:report.family,triangles:report.triangles,lodTriangles:report.lodTriangles,bones:report.bones,dimensions:report.dimensions,bytes:file.length,animations:gltf.animations.map(a=>a.name),warnings:[...report.qa.warnings,...report.lodQA.warnings],uv:Object.values(report.qa.objects).map(o=>({maps:o.uv_maps,outOfBoundsPct:o.uv_oob_pct,overlapPct:o.uv_overlap_pct,coveragePct:o.uv_coverage_pct}))});
 manifest[id]={file:`models-v5/${id}.glb`,enabled:true,sourceVersion:5,family:report.family};
 }catch(error){entry.failure=error.message;}entries.push(entry);}
const result={catalogueCount:102,currentRosterCount:SPECIES.length,technicalPass:entries.every(e=>e.technicalPass),passCount:entries.filter(e=>e.technicalPass).length,unresolvedReferences:entries.filter(e=>e.reference.status==='unresolved').map(e=>e.id),note:'Mesh and export checks do not certify artistic quality. Reference and visual review states are independent.',entries};
await fs.writeFile(`${dir}/coverage.json`,JSON.stringify(result,null,2));
if(process.argv.includes('--enable')){assert.equal(result.technicalPass,true,'Repair failed models before enabling the roster');await fs.writeFile('src/reference-assets.json',JSON.stringify(manifest,null,2)+'\n');}
console.log(JSON.stringify({catalogue:102,roster:SPECIES.length,technicalPass:result.passCount,failed:entries.filter(e=>!e.technicalPass).map(e=>({id:e.id,error:e.failure})),unresolvedReferences:result.unresolvedReferences.length},null,2));
if(!result.technicalPass)process.exitCode=1;
