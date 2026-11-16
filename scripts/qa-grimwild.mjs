import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import{mkdir,writeFile}from'node:fs/promises';
import levels from '../src/music-levels.json' with {type:'json'};
const dir='artifacts/grimwild/after';await mkdir(dir,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[],errors=[],layouts=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=async(name,fn)=>{await fn();checks.push(name);console.log('PASS '+name);};const shot=async name=>page.screenshot({path:`${dir}/${name}.png`});
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__JD?.world);
 await check('a Start-only front page precedes the expedition menu',async()=>{assert.equal(await page.evaluate(()=>window.__JD.ui.view),'start');assert.equal(await page.locator('#overlay button').count(),1);await shot('start');await page.locator('[data-action="enter"]').click();await page.waitForFunction(()=>window.__JD.ui.view==='menu');});
 await check('quiet supplied menu music plays and responds immediately to mute and focus',async()=>{
  await page.waitForFunction(()=>{const a=window.__JD.audio.recordedMusic.current;return a&&!a.paused&&a.currentTime>.15;});
  const state=await page.evaluate(()=>{const d=window.__JD,a=d.audio,clip=a.recordedMusic.current;const state={src:clip.src,volume:clip.volume};a.configure({...d.settings,muted:true});state.muted=clip.volume;a.configure({...d.settings,muted:false});a.setFocused(false);state.unfocused=clip.volume;a.setFocused(true);return state;});
  assert.match(state.src,/sounds\/music\//);assert.ok(state.volume>0&&state.volume<=.28);assert.ok(levels[state.src.split('/').at(-1)].rmsDbfs+20*Math.log10(state.volume)<-28);assert.equal(state.muted,0);assert.equal(state.unfocused,0);
 });
 await check('home creatures change on each return and move with independently animated skeletons',async()=>{
  const ids=[];for(let i=0;i<5;i++){
   await page.waitForFunction(()=>!!window.__JD.world.menuDino.userData.flagshipAsset&&window.__JD.world.menuVisit===window.__JD.ui.menuVisit);const before=await page.evaluate(()=>{const m=window.__JD.world.menuDino;return{id:m.userData.species.id,x:m.position.x};});if(ids.length)assert.notEqual(before.id,ids.at(-1));ids.push(before.id);
   await page.waitForTimeout(350);assert.notEqual(await page.evaluate(()=>window.__JD.world.menuDino.position.x),before.x);if(i===0)await shot('home');await page.locator('[data-action="settings"]').click();await page.keyboard.press('Escape');
  }await writeFile(`${dir}/menu-species.json`,JSON.stringify(ids));
 });
 await page.locator('[data-action="start"]').click();await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__JD.game?.state==='playing');
 await check('health and stamina remain centered above the world at five desktop sizes and 125 percent UI',async()=>{
  for(const [width,height]of[[800,600],[1280,720],[1440,900],[1920,1080],[2560,1440]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>{const d=window.__JD;d.game.player.invulnerable=999;d.ui.callbacks.settings({...d.settings,uiScale:1.25});});await page.waitForTimeout(250);
   const b=await page.locator('.hud-top-center-cluster').boundingBox();assert.ok(Math.abs(b.x+b.width/2-width/2)<3,JSON.stringify({width,b}));assert.ok(b.y>=0&&b.y+b.height<height*.25);layouts.push({width,height,b});await shot(`vitals-${width}`);
  }await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{const d=window.__JD;d.ui.callbacks.settings({...d.settings,uiScale:1});});
 });
 await check('evolution announces once with a small gold center icon while the simulation continues',async()=>{
  await page.evaluate(()=>{const d=window.__JD;window.evolutionSounds=0;const play=d.audio.play.bind(d.audio);d.audio.play=(type,...rest)=>{if(type==='evolution-ready'||type?.type==='evolution-ready')window.evolutionSounds++;return play(type,...rest);};d.game.gainXP(d.game.nextThreshold);});
  await page.locator('#evolve-ready').waitFor({state:'visible'});const a=await page.evaluate(()=>({time:window.__JD.game.time,sound:window.evolutionSounds,state:window.__JD.game.state}));assert.equal(a.sound,1);assert.equal(a.state,'playing');
  const b=await page.locator('#evolve-ready').boundingBox();assert.ok(b.width<=75&&b.height<=80&&Math.abs(b.x+b.width/2-720)<2);await shot('evolution-ready');await page.waitForTimeout(450);assert.ok(await page.evaluate(t=>window.__JD.game.time>t,a.time));assert.equal(await page.evaluate(()=>window.evolutionSounds),1);
  await page.locator('#evolve-ready').click();await page.waitForFunction(()=>window.__JD.ui.view==='evolution');assert.ok(await page.locator('.build-identity').count()>=3);await shot('build-choices');await page.locator('[data-action="postpone"]').click();
 });
 await check('the pause screen exposes the current build and keeps nested Escape navigation',async()=>{await page.keyboard.press('Escape');assert.ok(await page.locator('.grim-pause').count());assert.ok((await page.locator('.pause-life').textContent()).length>45);await shot('pause');await page.locator('[data-action="settings"]').click();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__JD.ui.view),'pause');await page.keyboard.press('Escape');});
 await check('death darkens the world, reveals a bloody epitaph and crossfades to the supplied lament',async()=>{
  await page.evaluate(()=>{const d=window.__JD;d.game.player.invulnerable=0;d.game.damagePlayer(1e9,'Torn apart by an apex predator',true);});await page.waitForFunction(()=>window.__JD.ui.view==='death');await page.locator('#overlay').evaluate(e=>{const a=e.getAnimations().find(a=>a.animationName==='death-darken');if(!a)throw Error('Missing death fade');a.pause();a.currentTime=0;});
  const early=await page.locator('#overlay').evaluate(e=>getComputedStyle(e).backgroundColor);await shot('death-early');await page.locator('#overlay').evaluate(e=>e.getAnimations().find(a=>a.animationName==='death-darken').finish());await page.waitForTimeout(200);const late=await page.locator('#overlay').evaluate(e=>getComputedStyle(e).backgroundColor);assert.notEqual(early,late);assert.equal(await page.locator('.death-announcement h1').textContent(),'YOU DIED');assert.ok(await page.locator('.death-blood').count());
  assert.equal(await page.evaluate(()=>window.__JD.audio.recordedMusic.scene),'dead');assert.match(await page.evaluate(()=>window.__JD.audio.recordedMusic.current.src),/bittersweet/);await shot('death');await page.locator('[data-action="menu"]').click();
 });
 await check('the centered home menu fits a narrow 360px window',async()=>{await page.setViewportSize({width:360,height:800});await page.waitForTimeout(200);const b=await page.locator('.menu-copy').boundingBox();assert.ok(b.x>=-1&&b.x+b.width<=361);assert.ok(await page.locator('[data-action="start"]').isVisible());await shot('home-360');});
 assert.deepEqual(errors,[]);
}finally{await writeFile(`${dir}/qa-grimwild.json`,JSON.stringify({checks,errors,layouts},null,2));await browser.close();}
