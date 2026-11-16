import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='artifacts/visual-overhaul'; await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.setDefaultTimeout(60_000);
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
try {
 await page.goto(process.env.JD_QA_URL || 'http://127.0.0.1:5173');
 await page.waitForFunction(()=>window.__JD?.world);
 const report=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');
  const {SPECIES}=await import('/src/data.js');
  const {createDinosaur,animateCreature}=await import('/src/creatures.js');
  const {FLAGSHIP_SPECIES_IDS,prepareFlagshipAsset,updateFlagshipAnimation}=await import('/src/flagship-models.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {BOTANY}=await import('/src/botany.js');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x202c2b);
  scene.add(new THREE.HemisphereLight(0xdfeadd,0x413625,3));
  const key=new THREE.DirectionalLight(0xffdfac,3);key.position.set(4,7,5);scene.add(key);
  const rim=new THREE.DirectionalLight(0x8cbfd2,2);rim.position.set(-4,3,-3);scene.add(rim);
  const canvas=document.createElement('canvas');canvas.id='art-review';
  Object.assign(canvas.style,{position:'fixed',inset:0,zIndex:2147483647,width:'1440px',height:'900px'});document.body.append(canvas);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,900);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x202c2b);renderer.clear();
  const camera=new THREE.PerspectiveCamera(35,1.5,.01,200);
  const loader=new GLTFLoader(),creatures=[];
  const paint=(model,index,cols=4,rows=3)=>{
   scene.add(model);model.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
   const distance=Math.max(size.x,size.y*1.4,size.z)*2.1;
   camera.position.copy(center).add(new THREE.Vector3(distance*.35,distance*.24,distance));camera.lookAt(center);
   const w=1440/cols,h=900/rows,x=index%cols*w,y=900-h-Math.floor(index/cols)*h;
   renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.setScissorTest(true);renderer.render(scene,camera);
   scene.remove(model);
  };
  const assets=[];
  for(const id of FLAGSHIP_SPECIES_IDS){
   const gltf=await loader.loadAsync(`/assets/models-v2/${id}/${id}.glb`),asset=prepareFlagshipAsset(gltf,5);
   if(gltf.animations.length!==6)throw Error(id+' missing clips');
   const skinned=[];asset.root.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o);});
   if(!skinned.length)throw Error(id+' has no deforming skin');
   updateFlagshipAnimation(asset,.1,1,false);const before=skinned[0].skeleton.bones.map(b=>b.quaternion.toArray().join());
   updateFlagshipAnimation(asset,.1,1,false);const after=skinned[0].skeleton.bones.map(b=>b.quaternion.toArray().join());
   if(!before.some((v,i)=>v!==after[i]))throw Error(id+' frozen skeleton');
   paint(asset.root,assets.length);assets.push(asset);
   creatures.push({id,clips:gltf.animations.map(a=>a.name),meshes:skinned.length});
  }
  window.__artReview={paint,scene,renderer,camera,assets,creatures,SPECIES,createDinosaur,animateCreature,BOTANY};
  return {creatures,forms:SPECIES.length,botany:Object.keys(BOTANY)};
 });
 await page.locator('#art-review').screenshot({path:`${dir}/creature-contact-sheet.png`});
 // Render every procedural species in contact sheets, keeping its existing anatomy.
 for(let start=0;start<report.forms;start+=12){
  await page.evaluate(start=>{const a=window.__artReview;a.renderer.setScissorTest(false);a.renderer.clear();for(let i=start;i<Math.min(start+12,a.SPECIES.length);i++){const m=a.createDinosaur(a.SPECIES[i],true);a.animateCreature(m,1/60,1,0);a.paint(m,i-start);m.userData.dispose();}},start);
  await page.locator('#art-review').screenshot({path:`${dir}/roster-${start}.png`});
 }
 await page.evaluate(async()=>{const a=window.__artReview,THREE=await import('/node_modules/three/build/three.module.js');a.renderer.setScissorTest(false);a.renderer.clear();Object.entries(a.BOTANY).forEach(([name,levels],i)=>a.paint(new THREE.Mesh(levels[0],new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86})),i));});
 await page.locator('#art-review').screenshot({path:`${dir}/botany-contact-sheet.png`});
 await page.evaluate(()=>{document.querySelector('#art-review').remove();window.__artReview.renderer.dispose();});
 // Actual world integration, separate from the neutral model stage.
 await page.evaluate(async()=>{const {Game}=await import('/src/game.js');const g=new Game({seed:4411});g.hatch();g.player.invulnerable=9999;window.__reviewGame=g;window.__JD.ui.screen('art-review','');window.__JD.world.cameraTarget.set(0,0,0);for(let i=0;i<10;i++)window.__JD.world.render(g,1/60,false);});
 await page.screenshot({path:`${dir}/gameplay-1440.png`});
 await page.setViewportSize({width:800,height:600});
 await page.evaluate(()=>window.__JD.world.render(window.__reviewGame,1/60,false));
 await page.screenshot({path:`${dir}/gameplay-800.png`});
 report.errors=errors;assert.deepEqual(errors,[]);
 await writeFile(`${dir}/runtime-qa.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
