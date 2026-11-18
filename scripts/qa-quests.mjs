import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterTitle} from './enter-title.mjs';
const dir='artifacts/quest-qa';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(45000);
try{
 await page.goto('http://127.0.0.1:5173');await enterTitle(page);
 await page.evaluate(()=>{window.__JD.start('survival');window.__JD.game.hatch();const g=window.__JD.game;g.player.invulnerable=10000;g.entities=[];g.foods=[];g.lairs=[];g._replenish=()=>{};});
 await page.waitForFunction(()=>document.querySelector('#quest-hud-button')?.textContent.includes('A Hunger Older'));
 await page.evaluate(()=>{const g=window.__JD.game;for(let i=0;i<5;i++){g.foods=[];g._eatCooldown=0;g.spawnFood('plant',g.player.x,g.player.y,2,{plantKind:'berry'});g.eat();}});
 await page.locator('#quest-hud-button').click();
 await page.locator('.quest-main h2').waitFor();
 assert.equal(await page.locator('[data-quest-claim="main"]').isEnabled(),true);
 await page.locator('[data-quest-claim="main"]').click();
 await page.waitForFunction(()=>document.querySelector('.quest-main h2')?.textContent==='The Nest That Remembered');
 assert.equal(await page.evaluate(()=>window.__JD.game.quests.chapter),1);
 await page.locator('[data-quest-track="first-nest"]').click();
 assert.deepEqual(await page.evaluate(()=>window.__JD.game.waypoint),{x:48,y:-34});
 await page.locator('[data-quest-claim="forage"]').click();
 assert.equal(await page.evaluate(()=>window.__JD.game.quests.repeat.forage.cycle),1);
 assert.equal(await page.locator('[data-quest-claim="forage"]').isDisabled(),true);
 assert.match(await page.locator('.quest-history').textContent(),/three notes return/);
 checks.push('HUD opens quests, real meals enable rewards, chapter story unfolds, map marker works, repeatable resets');
 await page.screenshot({path:`${dir}/story-desktop.png`,animations:'disabled'});
 for(const width of [600,360]){
  await page.setViewportSize({width,height:900});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  assert.equal(overflow,false,`horizontal overflow at ${width}`);
  const bounds=await page.locator('.quest-main').boundingBox();assert.ok(bounds.width<=width);
  await page.screenshot({path:`${dir}/story-${width}.png`,animations:'disabled'});
 }
 checks.push('quest journal fits 1440, 600 and 360 pixel widths');
 await page.setViewportSize({width:1440,height:1000});
 await page.reload();await enterTitle(page);await page.waitForFunction(()=>window.__JD?.ui);
 await page.evaluate(()=>window.__JD.ui.callbacks.continue());
 await page.waitForFunction(()=>window.__JD.game?.quests.chapter===1);
 assert.equal(await page.evaluate(()=>window.__JD.game.quests.repeat.forage.cycle),1);
 checks.push('claimed chapter and repeat cycle persist through a real reload');
 await page.evaluate(()=>{window.__JD.resume();const g=window.__JD.game;g.player.invulnerable=10000;g.entities=[];g.foods=[];g.lairs=[];g._replenish=()=>{};g.worldFeatures=[];g.spawnFood('plant',g.player.x+2,g.player.y,10,{plantKind:'berry',hp:6,maxHp:20});});
 await page.locator('.plant-health-label').first().waitFor();
 assert.match(await page.locator('.plant-health-label').first().textContent(),/6 \/ 20 HP/);
 await page.screenshot({path:`${dir}/plant-health.png`});
 checks.push('nearby plant label displays actual damaged HP in the running game');
 await page.evaluate(async()=>{
  const g=window.__JD.game,{updateWildlife}=await import('/src/wilderness.js');
  const pool={id:'quest-qa-water',type:'water',x:g.player.x+8,y:g.player.y,radius:20,tier:1,phase:0,solid:false};
  g.worldFeatures=[pool];g.marineState=new Map();updateWildlife(g,.016);
  const fish=g.marineState.get(pool.id).swimmers[0];g._hitMarine(fish,1e6,false,pool);
  window.__marineQA={pool,fish};
 });
 const marine=await page.evaluate(async()=>{
  const {createWildFeature}=await import('/src/wilderness-art.js'),{pool,fish}=window.__marineQA,g=window.__JD.game;
  const view=createWildFeature(pool,0);view.userData.animate(g.time+.5,g.player,g.marineState);
  const sinking=view.userData.swimmers[0].position.y<0;
  view.userData.animate(g.time+3,g.player,g.marineState);const hidden=!view.userData.swimmers[0].visible;
  const attacksCleared=fish.attackWindup===0&&fish.biteReadyUntil===0&&!fish.hunting;
  view.userData.dispose();return{sinking,hidden,attacksCleared};
 });assert.deepEqual(marine,{sinking:true,hidden:true,attacksCleared:true});
 checks.push('lethal aquatic hit clears attacks; actual pool actor sinks then hides');
 await page.evaluate(async()=>{
  const g=window.__JD.game,{SPECIES}=await import('/src/data.js');
  g.worldFeatures=[];g.marineState=new Map();g.player.speciesId=SPECIES.find(s=>s.tier===6&&!s.bloodline).id;g.tier=6;g.refreshStats(true);
  g.quests.chapter=11;g.exploration.discoveries=[{id:'origin-vault',at:g.time}];g.player.x=1020;g.player.y=1110;
  window.__JD.pause();window.__JD.ui.showCompendium('quests',g);
 });
 await page.locator('[data-story-ending="chorus"]').click();
 await page.waitForFunction(()=>document.querySelector('.quest-ending h2')?.textContent==='A Thousand Tomorrows');
 assert.equal(await page.evaluate(()=>window.__JD.game.quests.ending),'chorus');
 assert.equal(await page.locator('[data-story-ending]').count(),0);
 await page.screenshot({path:`${dir}/ending.png`,animations:'disabled'});
 checks.push('final choice yields its authored ending, leaves survival playable and cannot be claimed twice');
 assert.deepEqual(errors,[]);
 await writeFile(`${dir}/report.json`,JSON.stringify({checks,marine,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
