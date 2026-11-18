import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterTitle} from './enter-title.mjs';
const phase=process.argv[2]||'after',dir=`artifacts/colors/${phase}`;await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5173');await enterTitle(page);await page.waitForFunction(()=>window.__JD?.ui);
 await page.evaluate(async()=>{
  const d=window.__JD;d.ui.callbacks.start('normal');d.ui.callbacks.hatch();const g=d.game;
  d.authority.step=()=>({ok:true});g.seed=8187;g._randomState=8187;g.entities=[];g.foods=[];g.chunks.clear();g.activeChunks.clear();g.player.x=0;g.player.y=0;g._streamWorld(true);g.entities=[];g.foods=[];
  g.player.speciesId='troodon';g.tier=1;g.skinId='natural';g.player.genome=(await import('/src/genetics.js')).neutralGenome();g.refreshStats(true);
  g.player.hp=g.player.maxHp*.72;g.player.stamina=62;g.player.hunger=84;g.player.xp=32;g.time=70;g.worldState.clock=70;g.player.invulnerable=99999;g.player.angle=-.5;
  for(const [id,x,y]of [['tyrannosaurus',10,-8],['triceratops',-10,-7]]){const e=g.spawnEntity(id,x,y,{passive:true,behavior:'neutral',homeChunk:'0,0'});e.angle=-.5;}
  d.ui.updateHUD(g,.1);d.world.resetRun();
 });
 await page.waitForFunction(()=>window.__JD.world.models.size>=3&&[...window.__JD.world.models.values()].every(m=>m.userData.isGLB),null,{timeout:60000});
 await page.waitForFunction(()=>!window.__JD.world.terrain.pending.length&&!window.__JD.world.terrain.buildJob,null,{timeout:60000});
 await page.screenshot({animations:'disabled',path:`${dir}/gameplay-desktop.png`});
 const bars=await page.locator('#hud-hp,#hud-stamina,#hud-hunger,#hud-xp,.account-hud .account-meter i').evaluateAll(nodes=>nodes.map(node=>({id:node.id||'account-xp',background:getComputedStyle(node).backgroundImage,color:getComputedStyle(node).backgroundColor,width:node.getBoundingClientRect().width,role:node.parentElement.getAttribute('aria-label')})));
 if(phase==='after'){
  assert.ok(bars.every(b=>b.width>0));assert.ok(new Set(bars.map(b=>b.background+b.color)).size>=5);
  assert.equal(bars[0].role,'Health');assert.equal(bars[1].role,'Stamina');
 }
 await page.evaluate(()=>{const d=window.__JD;d.game.player.hp=d.game.player.maxHp*.18;d.game.player.stamina=14;d.ui.updateHUD(d.game,.1);});
 await page.screenshot({animations:'disabled',path:`${dir}/low-health-desktop.png`});
 await page.setViewportSize({width:700,height:950});await page.screenshot({animations:'disabled',path:`${dir}/gameplay-narrow.png`});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(phase==='after'){
  await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{const d=window.__JD;d.game.time=205;d.game.worldState.clock=205;d.game.player.hp=d.game.player.maxHp*.72;d.game.player.stamina=62;});
  await page.waitForFunction(()=>window.__JD.world.sun.intensity<1.05);await page.screenshot({animations:'disabled',path:`${dir}/gameplay-night.png`});
  await page.evaluate(()=>{const d=window.__JD;d.ui.callbacks.settings({...d.ui.settings,highContrast:true,reducedMotion:true});});
  await page.screenshot({animations:'disabled',path:`${dir}/high-contrast.png`});
  const nightBars=await page.locator('#hud-hp,#hud-stamina').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).backgroundImage));assert.equal(nightBars[0],bars[0].background);assert.equal(nightBars[1],bars[1].background);
 }
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>window.__JD.ui.showMenu());await page.screenshot({animations:'disabled',path:`${dir}/menu.png`});
 assert.deepEqual(errors,[]);await writeFile(dir+'/report.json',JSON.stringify({bars,errors},null,2));console.log(`Color ${phase}: gameplay, low health, narrow HUD and menu checked`);
}finally{await browser.close();}
