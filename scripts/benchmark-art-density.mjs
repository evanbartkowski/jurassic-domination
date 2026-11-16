import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__JD?.world);
 const report=await page.evaluate(async()=>{
  const {Game}=await import('/src/game.js');
  const {FLAGSHIP_SPECIES_IDS}=await import('/src/flagship-models.js');
  const world=window.__JD.world,g=new Game({seed:4411});g.hatch();g.entities=[];
  window.__JD.ui.screen('art-benchmark','');
  const ids=[...FLAGSHIP_SPECIES_IDS,'microraptor','sarcosuchus','deinonychus','iguanodon','quetzalcoatlus','allosaurus'];
  for(let i=0;i<32;i++){
   const a=i*Math.PI*2/32,r=12+(i%3)*9;
   const e=g.spawnEntity(ids[i%ids.length],Math.cos(a)*r,Math.sin(a)*r);
   if(!e)throw Error('Unknown benchmark species '+ids[i%ids.length]);
   e.genome=null;
  }
  const frame=()=>new Promise(r=>requestAnimationFrame(r));
  const draw=()=>world.render(g,1/60,false);
  for(let i=0;i<15;i++){draw();await frame();}
  const results=[];
  for(const quality of ['high','low']){
   world.configure({...world.settings,quality});
   for(let i=0;i<5;i++){draw();await frame();}
   const intervals=[];let previous=await frame();
   for(let i=0;i<20;i++){draw();const now=await frame();intervals.push(now-previous);previous=now;}
   intervals.sort((a,b)=>a-b);
   results.push({quality,actors:g.entities.length+1,models:world.models.size,imported:[...world.models.values()].filter(m=>m.userData.isGLB).length,
    calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,
    geometries:world.renderer.info.memory.geometries,textures:world.renderer.info.memory.textures,
    frameIntervalMs:{p50:intervals[10],p95:intervals[19]}});
  }
  return {renderer:'Chrome SwiftShader; portability stress measurement, not native GPU FPS',seed:4411,results};
 });
 assert.deepEqual(errors,[]);assert.ok(report.results.every(r=>r.imported>=10));
 report.errors=errors;await writeFile('artifacts/visual-overhaul/density-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
