import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir='artifacts/primeval/after';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],metrics=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__JD?.ui);await page.locator('[data-action="enter"]').click();await page.locator('[data-action="start"]').click();await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__JD.game.state==='playing');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__JD.ui.view==='pause');
 await page.evaluate(async()=>{const d=window.__JD,{Game}=await import('/src/game.js');const g=new Game({seed:4411});g.hatch();d.artGame=g;g.state='paused';g.player.x=50;g.player.y=0;g.player.speciesId='tyrannosaurus';g.player.growth=.8;g.player.angle=-.6;g.player.invulnerable=99999;g._streamWorld(true);d.ui.screen('art-review','');d.ui.hud.hidden=true;d.world.cameraTarget.set(g.player.x,0,g.player.y);const render=d.world.render.bind(d.world);d.world.render=(_,dt)=>render(g,dt,false);for(let i=0;i<10;i++)d.world.render(g,.35,false);});
 await page.waitForFunction(()=>window.__JD.world.models.get('player')?.userData.flagshipAsset?.version===4);
 for(const [label,time]of[['day',85],['dusk',153],['night',205]]){
  for(const [distance,mode]of[[0,'gameplay'],[1,'near'],[2,'far']]){
   const data=await page.evaluate(({time,distance})=>{const d=window.__JD,w=d.world,g=d.artGame;g.time=time;for(let i=0;i<3;i++)w.render(g,.8,false);const model=w.models.get('player');
    if(distance){const p=model.position;w.camera.position.set(p.x+(distance===1?15:25),p.y+(distance===1?9:90),p.z+(distance===1?21:90));w.camera.lookAt(p.x,p.y+2,p.z);w.renderer.render(w.scene,w.camera);}
    const mesh=model.userData.flagshipAsset.detailMeshes[0][0],mat=mesh.material;return{time,distance,chunks:w.terrain.chunks.size,calls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,images:w.renderer.info.memory.textures,maps:!!(mat.map?.image&&mat.normalMap?.image&&mat.roughnessMap?.image),colorSpace:mat.map?.colorSpace,metalness:mat.metalness,playerInView:Math.abs(model.position.clone().project(w.camera).x)<1};},{time,distance});
   assert.ok(data.maps&&data.playerInView&&data.chunks<=9);assert.equal(data.colorSpace,'srgb');assert.equal(data.metalness,0);metrics.push({label,mode,...data});await page.screenshot({path:`${dir}/forest-${label}-${mode}.png`});
  }
 }
 await page.evaluate(()=>{const d=window.__JD,w=d.world,g=d.artGame;g.time=85;for(let i=0;i<3;i++)w.render(g,.8,false);const mesh=w.models.get('player').userData.flagshipAsset.detailMeshes[0][0];window.materialAudit=mesh.material.clone();mesh.material.wireframe=true;w.renderer.render(w.scene,w.camera);});await page.screenshot({path:`${dir}/forest-wireframe.png`});
 await page.evaluate(()=>{const d=window.__JD,w=d.world,mesh=w.models.get('player').userData.flagshipAsset.detailMeshes[0][0];mesh.material.wireframe=false;mesh.material.map=null;mesh.material.normalMap=null;mesh.material.roughnessMap=null;mesh.material.color.setHex(0xb7b7aa);mesh.material.needsUpdate=true;w.renderer.render(w.scene,w.camera);});await page.screenshot({path:`${dir}/forest-clay.png`});
 assert.doesNotMatch(await page.locator('body').textContent(),/Checkpoint failed/);assert.deepEqual(errors,[]);await writeFile(`${dir}/art-qa.json`,JSON.stringify({checks:['day dusk and night at gameplay near and far camera distances','authored PBR maps and color spaces survive actual WorldRenderer lighting','nine chunk streaming bound','wireframe and neutral material diagnostic views'],metrics,errors},null,2));console.log('4 visual integration checks passed across 9 lighting and camera combinations.');
}finally{await browser.close();}
