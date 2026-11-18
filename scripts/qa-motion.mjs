import {chromium} from '@playwright/test';
import {enterTitle} from './enter-title.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const dir='artifacts/motion-polish/qa';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.stack));page.setDefaultTimeout(60000);
try{
 await page.goto('http://127.0.0.1:5173');await enterTitle(page);
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__JD.game?.state==='egg');
 await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__JD.game?.state==='playing');
 await page.evaluate(()=>{window.__JD.game.player.invulnerable=9999;});
 await page.waitForFunction(()=>window.__JD.world.models.get('player')?.userData.flagshipAsset);
 await page.waitForTimeout(2500);
 await page.evaluate(()=>{const w=window.__JD.world;w.terrain.metrics.peakBuildMs=0;w.terrain.metrics.peakBuildSliceMs=0;const render=w.render;window.motionFrames=[];window.restoreMotionRender=()=>w.render=render;w.render=function(...args){const begin=performance.now(),result=render.apply(this,args);window.motionFrames.push({at:begin,cpu:performance.now()-begin});return result;};});
 assert.equal(await page.locator('#hud-ability').evaluate(e=>e.closest('.ability-key').hidden),true);
 checks.push('hatchling HUD hides locked innate attacks');
 const before=await page.evaluate(()=>({x:window.__JD.game.player.x,z:window.__JD.game.player.y,zoom:window.__JD.world.cameraDist}));
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
 await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
 await page.waitForTimeout(4000);await page.keyboard.up('ShiftLeft');await page.waitForTimeout(1500);await page.keyboard.up('KeyW');
 const {profile}=await cdp.send('Profiler.stop');await writeFile(`${dir}/cpu-profile.json`,JSON.stringify(profile));
 const counts=new Map();for(const id of profile.samples||[])counts.set(id,(counts.get(id)||0)+1);
 const hotspots=profile.nodes.map(n=>({fn:n.callFrame.functionName,url:n.callFrame.url.split('/').at(-1),samples:counts.get(n.id)||0})).sort((a,b)=>b.samples-a.samples).slice(0,18);
 const moved=await page.evaluate(()=>{window.restoreMotionRender();const samples=window.motionFrames;const percentile=(values,p)=>values.sort((a,b)=>a-b)[Math.floor(values.length*p)];return{x:window.__JD.game.player.x,z:window.__JD.game.player.y,zoom:window.__JD.world.cameraDist,terrain:window.__JD.world.terrain.metrics,renderCpuP95:percentile(samples.map(s=>s.cpu),.95),frameP95:percentile(samples.slice(1).map((s,i)=>s.at-samples[i].at),.95),frameMax:Math.max(...samples.slice(1).map((s,i)=>s.at-samples[i].at))};});
 await writeFile(`${dir}/profile-summary.json`,JSON.stringify({before,moved,hotspots},null,2));
 assert.ok(Math.hypot(moved.x-before.x,moved.z-before.z)>5);assert.ok(Math.abs(moved.zoom-before.zoom)<.1);
 checks.push('real Shift sprint movement keeps stable camera framing');
 await page.goto('http://127.0.0.1:5173/assets/boot.css');
 const animations=await page.evaluate(async()=>{
  const {Game}=await import('/src/game.js'),{animateFlagshipGLB}=await import('/src/flagship-models.js'),{WorldRenderer}=await import('/src/renderer.js'),{DEFAULT_SETTINGS}=await import('/src/profile.js');
  document.body.innerHTML='<canvas></canvas>';document.body.style.margin='0';
  const world=new WorldRenderer(document.querySelector('canvas'),DEFAULT_SETTINGS),game=new Game({seed:4411});game.hatch();game.entities=[];game.foods=[];game.state='paused';
  for(let i=0;i<10;i++)world.render(game,1/60,false);
  const results=[];
  for(const [i,id] of ['velociraptor','tyrannosaurus','triceratops','brachiosaurus','pteranodon','mosasaurus'].entries()){
   const model=world.syncModel('qa-'+id,id,game.player.x+i*3,game.player.y-4,0,1/60,game.time,false,false);
   await new Promise((resolve,reject)=>{const end=performance.now()+20000;const wait=()=>model.userData.flagshipAsset?resolve():performance.now()>end?reject(new Error('asset timeout '+id)):setTimeout(wait,50);wait();});
   const asset=model.userData.flagshipAsset;
   const head=asset.surface.getObjectByName('head'),leg=[];asset.surface.traverse(n=>{if(n.isBone&&n.name.startsWith('hind'))leg.push(n.name);});
   const clip=asset.actions.Walk.getClip(),names=clip.tracks.filter(t=>t.name.endsWith('.quaternion')&&t.name.startsWith('hind')).map(t=>t.name);
   const initial=head?.quaternion.toArray();for(let k=0;k<90;k++)animateFlagshipGLB(model,1/60,k/60,0,false,0);
   const idle=head?.quaternion.toArray();model.userData.worldSpeed=4;
   for(let k=0;k<60;k++)animateFlagshipGLB(model,1/60,k/60,1.1,false,.08);
   const gait=asset.gaitRate;for(let k=0;k<12;k++)animateFlagshipGLB(model,1/60,k/60,0,true,0);
   results.push({id,joints:asset.secondary.joints.length,initial,idle,gait,legs:leg,tracks:names,attackWeight:asset.actions.Attack.getEffectiveWeight()});
  }
  world.camera.position.set(10,18,21);world.camera.lookAt(8,1,-4);world.renderer.render(world.scene,world.camera);return results;
 });
 for(const a of animations){assert.ok(a.joints>3,a.id);assert.notDeepEqual(a.initial,a.idle,a.id);assert.ok(a.gait<=3.6,a.id);assert.ok(a.attackWeight>.8,a.id);}
 checks.push('six body families animate idle, gait and attack on actual imported skeletons');
 await page.screenshot({path:`${dir}/motion-and-attacks.png`});
 assert.deepEqual(errors,[]);await writeFile(`${dir}/report.json`,JSON.stringify({checks,errors,hotspots,before,moved,animations},null,2));console.log(JSON.stringify({checks,hotspots,moved},null,2));
}finally{await browser.close();}
