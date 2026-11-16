import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const phase='sample',dir='artifacts/primeval/sample';
await fs.mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(60000);
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__JD?.ui);
 await page.screenshot({path:`${dir}/start.png`});
 if(await page.locator('[data-action="enter"]').count())await page.locator('[data-action="enter"]').click();
 await page.waitForFunction(()=>!!window.__JD.world.menuDino.userData.flagshipAsset);await page.waitForTimeout(800);await page.screenshot({path:`${dir}/home.png`});
 await page.locator('[data-action="start"]').click();await page.keyboard.press('KeyE');await page.waitForTimeout(600);
 await page.screenshot({path:`${dir}/hud.png`});await page.keyboard.press('Escape');await page.screenshot({path:`${dir}/pause.png`});
 await page.evaluate(()=>{const d=window.__JD;d.ui.callbacks.resume();d.game.player.invulnerable=0;d.game.damagePlayer(1e9,'The jaws of a tyrant',true);});
 await page.waitForFunction(()=>window.__JD.ui.view==='death');await page.waitForTimeout(2000);await page.screenshot({path:`${dir}/death.png`});
 const entries=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const {fitSpecimenCamera,visibleSpecimenBounds}=await import('/src/specimen-framing.js');const {SPECIES}=await import('/src/data.js');const {createDinosaur,animateCreature}=await import('/src/creatures.js');
  const canvas=document.createElement('canvas'),r=new THREE.WebGLRenderer({canvas,alpha:false,antialias:true,preserveDrawingBuffer:true});r.setSize(360,250);r.setPixelRatio(1);r.setClearColor(0x162027);r.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xe1edf3,0x444035,2.1));const sun=new THREE.DirectionalLight(0xffe2bd,3.2);sun.position.set(5,8,6);scene.add(sun);const rim=new THREE.DirectionalLight(0xa8d7e9,2);rim.position.set(-4,3,-4);scene.add(rim);
  const camera=new THREE.PerspectiveCamera(32,360/250,.01,1000),out=[];
  for(const s of SPECIES.filter(s=>["tyrannosaurus","velociraptor","triceratops","brachiosaurus","ankylosaurus","spinosaurus","archelon","elder-dragon"].includes(s.id))){const model=createDinosaur(s,true);scene.add(model);await new Promise((resolve,reject)=>{const end=performance.now()+15000;const poll=()=>model.userData.flagshipAsset?resolve():performance.now()>end?reject(Error('Missing asset '+s.id)):setTimeout(poll,20);poll();});model.rotation.y=-.6;model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});const b=new THREE.Box3().setFromObject(model),center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3()),distance=Math.max(size.y,size.x/camera.aspect,size.z*.8)/(2*Math.tan(32*Math.PI/360))*1.44;
   camera.position.copy(center).add(new THREE.Vector3(distance*.16,distance*.18,distance));camera.lookAt(center);
   for(const pose of ['rest','walk','bite']){
    const asset=model.userData.flagshipAsset;for(const [name,a]of Object.entries(asset.actions)){a.setEffectiveWeight(name===(pose==='rest'?'Idle':pose==='walk'?'Walk':'Attack')?1:0);a.time=pose==='walk'?.25:.5;}asset.mixer.update(0);model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.computeBoundingBox();});fitSpecimenCamera(camera,model,{padding:1.20});r.render(scene,camera);
    const bounds=visibleSpecimenBounds(model),corners=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])corners.push(new THREE.Vector3(x,y,z).project(camera));
    const edge=Math.max(...corners.flatMap(p=>[Math.abs(p.x),Math.abs(p.y)]));out.push({id:s.id,name:s.name,pose,edge,triangles:r.info.render.triangles,png:canvas.toDataURL().split(',')[1]});
   }
   scene.remove(model);model.userData.dispose();
  }r.dispose();return out;
 });
 for(const e of entries)await fs.writeFile(`${dir}/${e.id}-${e.pose}.png`,Buffer.from(e.png,'base64'));
 await fs.writeFile(`${dir}/pose-metrics.json`,JSON.stringify(entries.map(({png,...rest})=>rest),null,2));
 if(entries.some(e=>e.edge>1))throw Error('Clipped specimens: '+entries.filter(e=>e.edge>1).map(e=>e.id+' '+e.pose).join(', '));
 const contact=pose=>`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#0b1216;color:#e2dfd3;font:12px system-ui}.grid{display:grid;grid-template-columns:repeat(6,240px)}figure{margin:0;border:1px solid #384443}img{width:238px;display:block}figcaption{padding:7px 10px}</style><div class="grid">${entries.filter(e=>e.pose===pose).map(e=>`<figure><img src="${e.id}-${e.pose}.png"><figcaption>${e.name}</figcaption></figure>`).join('')}</div>`;
 for(const pose of ['rest','walk','bite'])await fs.writeFile(`${dir}/roster-${pose}.html`,contact(pose));
 console.log(`Captured ${entries.length} creature poses and four interface screens.`);
}finally{await browser.close();}
