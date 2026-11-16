import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {SPECIES} from '../src/data.js';
const dir='artifacts/reference-overhaul/after';await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[],entries=[];page.setDefaultTimeout(60000);
page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
try{
 await page.goto('http://127.0.0.1:5173/assets/boot.css');
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),creatures=await import('/src/creatures.js'),data=await import('/src/data.js'),framing=await import('/src/specimen-framing.js'),{createNaturalEnvironment}=await import('/src/natural-materials.js'),flagship=await import('/src/flagship-models.js');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(480,320);renderer.setPixelRatio(1);renderer.setClearColor(0x172026);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const scene=new T.Scene(),env=createNaturalEnvironment(renderer);scene.environment=env.texture;scene.environmentIntensity=.24;scene.add(new T.HemisphereLight(0xe1edf3,0x444035,1.2));const key=new T.DirectionalLight(0xffe2bd,3.2);key.position.set(5,8,6);scene.add(key);const rim=new T.DirectionalLight(0xa8d7e9,1.3);rim.position.set(-4,3,-4);scene.add(rim);
  window.audit={T,renderer,scene,env,creatures,data,framing,flagship,camera:new T.PerspectiveCamera(32,1.5,.01,1000)};
 });
 for(const s of SPECIES){
  const shots=await page.evaluate(async id=>{
   const a=window.audit,{T,scene,renderer,camera}=a,model=a.creatures.createDinosaur(a.data.SPECIES_BY_ID[id],true);scene.add(model);
   await new Promise((resolve,reject)=>{const end=performance.now()+20000;const poll=()=>model.userData.flagshipAsset?resolve():performance.now()>end?reject(Error('Missing asset '+id)):setTimeout(poll,20);poll();});
   model.rotation.y=-.60;const asset=model.userData.flagshipAsset;model.updateMatrixWorld(true);const center=a.framing.visibleSpecimenBounds(model).getCenter(new T.Vector3());camera.position.copy(center).add(new T.Vector3(1,1,8));camera.lookAt(center);
   const output=[];
   for(const [pose,clip,time]of[['idle','Idle',.6],['walk','Walk',.25],['run','Run',.25],['attack','Attack',1],['graze','Graze',.7],['rest','Rest',.7],['hit','Hit',.25],['death','Death',1.9]]){
    for(const [name,action]of Object.entries(asset.actions)){action.setEffectiveWeight(name===clip?1:0);action.time=time;}asset.mixer.update(0);model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});a.framing.fitSpecimenCamera(camera,model,{padding:1.14});renderer.render(scene,camera);
    const b=a.framing.visibleSpecimenBounds(model),corners=[];for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])corners.push(new T.Vector3(x,y,z).project(camera));
    const meshes=asset.detailMeshes.flat(),maps=meshes.every(m=>m.material.map?.image&&m.material.normalMap?.image&&m.material.roughnessMap?.image),finite=meshes.every(m=>[...m.skeleton.boneMatrices].every(Number.isFinite));
    output.push({id,pose,version:asset.version,edge:Math.max(...corners.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)])),maps,finite,activeLODs:meshes.filter(m=>m.visible).length,triangles:renderer.info.render.triangles,png:renderer.domElement.toDataURL().split(',')[1]});
   }
   a.flagship.setCreatureDetail(model,1);const lod1=asset.detailMeshes[1].every(m=>m.visible)&&asset.detailMeshes[0].every(m=>!m.visible);output[0].lodSwitch=lod1;scene.remove(model);model.userData.dispose();return output;
  },s.id);
  for(const {png,...shot}of shots){await fs.writeFile(`${dir}/${shot.id}-${shot.pose}.png`,Buffer.from(png,'base64'));entries.push(shot);assert.equal(shot.version,5);assert.ok(shot.edge<=1&&shot.finite&&shot.maps,JSON.stringify(shot));assert.equal(shot.activeLODs,1);if(shot.lodSwitch!==undefined)assert.ok(shot.lodSwitch);}
  if(entries.length%72===0)console.log(`Captured ${entries.length} poses`);
 }
 const cache=await page.evaluate(()=>window.audit.creatures.flagshipCacheStats());assert.ok(cache.entries<=cache.target&&cache.entries>0);assert.equal(cache.referenced,0);assert.deepEqual(errors,[]);
 await fs.writeFile(`${dir}/pose-metrics.json`,JSON.stringify({entries,cache,errors},null,2));
 for(const pose of['idle','walk','run','attack','graze','rest','hit','death'])await fs.writeFile(`${dir}/roster-${pose}.html`,`<!doctype html><meta charset="utf-8"><title>Primeval ${pose}</title><style>body{background:#10181c;color:#ded8c8;font:13px system-ui;margin:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}figure{margin:0;border:1px solid #49504b}img{width:100%;display:block}figcaption{padding:8px}</style><h1>${pose} / 108 creatures</h1><div class="grid">${SPECIES.map(s=>`<figure><img loading="lazy" src="${s.id}-${pose}.png"><figcaption>${s.name}</figcaption></figure>`).join('')}</div>`);
 console.log(`${entries.length} poses: no missing maps, nonfinite bones, double LODs or clipped bounds; cache ${cache.entries}/${cache.target}.`);
}finally{await browser.close();}
