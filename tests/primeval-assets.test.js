import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPECIES} from '../src/data.js';
import roster from '../src/primeval-assets.json' with {type:'json'};
import botany from '../src/botany-meshes-v4.json' with {type:'json'};

test('every selectable and wild creature ships two validated, UV textured, animated LODs',()=>{
 assert.deepEqual([...roster].sort(),SPECIES.map(s=>s.id).sort());let total=0;
 for(const {id} of SPECIES){
  const file=readFileSync(`public/assets/models-v4/${id}.glb`),g=JSON.parse(file.subarray(20,20+file.readUInt32LE(12))),r=JSON.parse(readFileSync(`assets/art-v4/creatures/${id}/report.json`));total+=file.length;
  assert.equal(file.readUInt32LE(0),0x46546c67,id);assert.equal(file.readUInt32LE(8),file.length,id);
  assert.ok(g.nodes.some(n=>n.extras?.sourceVersion===4&&n.extras?.forwardAxis==='X'),id);
  assert.equal(r.qa.pass,true,id);assert.equal(r.lodQA.pass,true,id);assert.deepEqual(r.qa.errors,[],id);assert.deepEqual(r.lodQA.errors,[],id);
  assert.ok(r.triangles<45000&&r.lodTriangles<r.triangles*.7,id);assert.ok(file.length<6000000,id);
  assert.equal(g.meshes.length,2,id);assert.equal(g.materials.length,1,id);assert.equal(g.materials[0].pbrMetallicRoughness.metallicFactor,0,id);
  const m=g.materials[0];assert.ok(m.pbrMetallicRoughness.baseColorTexture&&m.normalTexture&&m.pbrMetallicRoughness.metallicRoughnessTexture,id);
  assert.deepEqual(g.animations.map(a=>a.name).sort(),['Attack','Graze','Idle','Rest','Run','Walk']);
  for(const mesh of g.meshes)for(const p of mesh.primitives){
   for(const k of ['POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'])assert.ok(p.attributes[k]!==undefined,`${id}: ${k}`);
   assert.equal(g.accessors[p.attributes.WEIGHTS_0].type,'VEC4',id);assert.ok(g.accessors[p.attributes.POSITION].min.every(Number.isFinite),id);
  }
  for(const animation of g.animations){assert.ok(animation.channels.some(c=>c.target.path==='rotation'),id);assert.ok(animation.channels.some(c=>c.target.path==='scale'),id);}
 }
 assert.ok(total<420000000,'bounded complete streamed roster');
});

test('multiheaded jaws and accessories have independent hinges and animation tracks',()=>{
 for(const id of ['cerberus','hydra']){
  const file=readFileSync(`public/assets/models-v4/${id}.glb`),g=JSON.parse(file.subarray(20,20+file.readUInt32LE(12))),nodes=g.nodes;
  const heads=nodes.filter(n=>n.name?.startsWith('head_branch')),jaws=nodes.filter(n=>n.name?.startsWith('jaw_branch'));assert.ok(heads.length>=2,id);assert.equal(jaws.length,heads.length,id);
  for(const jaw of jaws){const parent=heads.find(h=>h.children?.includes(nodes.indexOf(jaw)));assert.ok(parent,id);assert.ok(g.animations.find(a=>a.name==='Attack').channels.some(c=>c.target.node===nodes.indexOf(jaw)&&c.target.path==='rotation'),id);}
 }
});

test('exported animation loops return to matching transforms without a visible seam',()=>{
 for(const id of roster){
  const file=readFileSync(`public/assets/models-v4/${id}.glb`),jsonLength=file.readUInt32LE(12),g=JSON.parse(file.subarray(20,20+jsonLength)),binary=28+jsonLength;
  for(const animation of g.animations)for(const channel of animation.channels){
   const sampler=animation.samplers[channel.sampler],a=g.accessors[sampler.output],v=g.bufferViews[a.bufferView],n=a.type==='VEC4'?4:3,stride=v.byteStride||n*4,start=binary+(v.byteOffset||0)+(a.byteOffset||0),last=start+(a.count-1)*stride;
   const first=Array.from({length:n},(_,i)=>file.readFloatLE(start+i*4)),end=Array.from({length:n},(_,i)=>file.readFloatLE(last+i*4));assert.ok([...first,...end].every(Number.isFinite),id);
   if(channel.target.path==='rotation')assert.ok(Math.abs(first.reduce((sum,x,i)=>sum+x*end[i],0))>.9999,`${id} ${animation.name} rotation seam`);
   else assert.ok(first.every((x,i)=>Math.abs(x-end[i])<.0001),`${id} ${animation.name} ${channel.target.path} seam`);
  }
 }
});

test('all botanical LODs have valid UVs, normals and bounded closed source geometry',()=>{
 const reports=JSON.parse(readFileSync('assets/art-v4/botany/report.json'));assert.equal(reports.length,40);
 for(const [kind,levels]of Object.entries(botany)){
  assert.equal(levels.length,4,kind);
  for(const [lod,data]of levels.entries()){
   const r=reports.find(r=>r.kind===kind&&r.lod===lod);assert.equal(r.qa.pass,true,kind);assert.deepEqual(r.qa.errors,[],kind);assert.ok(r.triangles<10000,kind);
   const pos=Buffer.from(data.position,'base64'),norm=Buffer.from(data.normal,'base64'),uv=Buffer.from(data.uv,'base64');assert.equal(pos.length/6,norm.length/3,kind);assert.equal(uv.length/8,pos.length/6,kind);
   let min=Infinity,max=-Infinity;for(let i=0;i<uv.length;i+=4){const f=uv.readFloatLE(i);assert.ok(Number.isFinite(f),kind);min=Math.min(min,f);max=Math.max(max,f);}assert.ok(max-min>.1,kind);
   for(const ob of Object.values(r.qa.objects)){assert.equal(ob.boundary_edges,0,kind);assert.equal(ob.nonmanifold_edges,0,kind);assert.equal(ob.degenerate_faces,0,kind);assert.equal(ob.inconsistent_normals_edges,0,kind);}
  }
 }
});
