import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {enterTitle} from './enter-title.mjs';
const dir='artifacts/quality';await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[];page.setDefaultTimeout(60000);
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
let durations=[],resources;
try{
 await page.goto(process.env.JD_QA_URL||'http://127.0.0.1:5173');await enterTitle(page);await page.waitForFunction(()=>window.__JD?.ui);
 durations=await page.evaluate(async()=>{
  const paths=['kalsstockmedia-dinosaur-monster-heavy-foot-steps-earth-shattering-246899','freesound_community-dinosteps1-94200','audiopapkin-monster-footsteps-on-gravel-295850','skyscraper_seven-click-buttons-ui-menu-sounds-effects-button-5-203599'];
  return Promise.all(paths.map(file=>new Promise((resolve,reject)=>{const a=new Audio('sounds/'+file+'.mp3');a.preload='metadata';a.onloadedmetadata=()=>resolve({file,seconds:a.duration});a.onerror=()=>reject(Error(file+' unavailable'));})));
 });
 await page.locator('[data-action="start"]').click();await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__JD.game?.state==='playing');
 await page.evaluate(()=>{const g=window.__JD.game;g.player.invulnerable=99999;});
 await page.waitForFunction(()=>window.__JD.world.models.get('player')?.userData.isGLB);await page.waitForTimeout(1000);
 const playback=await page.evaluate(async()=>{
  const a=window.__JD.audio;a.playSample('giantStep',.01);const clip=a.samplePool.get('giantStep');await clip.play();await new Promise(r=>setTimeout(r,700));
  const before=clip.currentTime;a.sampleCooldowns.set('giantStep',-10000);a.playSample('giantStep',.01);const after=clip.currentTime;clip.pause();return{before,after};
 });assert.ok(playback.before>.3&&playback.after>=playback.before,'an actual decoded recording must keep its playhead');checks.push('decoded recording keeps its playhead on repeated triggers');
 const hover=await page.evaluate(()=>{
  const a=window.__JD.audio,original=a.uiCue.bind(a),calls=[];a.uiCue=kind=>{calls.push(kind);};const button=document.getElementById('pause-button'),child=button.querySelector('svg');
  button.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:document.body}));
  for(let i=0;i<15;i++)child.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:button}));a.uiCue=original;return calls;
 });assert.deepEqual(hover,['hover']);checks.push('crossing button artwork produces one hover cue');
 const track=await page.evaluate(()=>{const d=window.__JD;d.audio.combatMusicHold=8;d.audio.setMode('danger');return d.audio.recordedMusic.current.src;});
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>window.__JD.audio.recordedMusic.current.src),track);checks.push('pause and resume preserve the current combat music phrase');
 await page.evaluate(()=>{const d=window.__JD;d.game.player.hp=1;d.ui.updateHUD(d.game);});assert.equal(await page.locator('#hud-obj-title').textContent(),'Retreat and recover');
 await page.evaluate(()=>{const d=window.__JD;d.game.player.hp=d.game.player.maxHp;d.game.player.hunger=100;d.ui.callbacks.settings({...d.settings,tutorialHints:false});d.ui.updateHUD(d.game);});
 assert.equal(await page.locator('#hud-obj-title').textContent(),'A Hunger Older Than You');checks.push('one focus card prioritizes survival and then the main storyline');
 await page.keyboard.down('KeyW');await page.keyboard.down('Shift');await page.waitForTimeout(6000);await page.keyboard.up('Shift');await page.keyboard.up('KeyW');
 await page.screenshot({path:dir+'/gameplay.png'});
 resources=await page.evaluate(()=>{const d=window.__JD;return{voices:d.audio.nodes.size,effects:d.audio.effectVoices,samples:d.audio.samplePool.size,music:d.audio.recordedMusic.voices.length,labels:document.querySelectorAll('.creature-label').length,chunks:d.world.terrain.chunks.size,models:d.world.models.size};});
 assert.ok(resources.voices<=112&&resources.effects<=44&&resources.samples<=40&&resources.music<=2&&resources.chunks<=9);checks.push('live movement keeps audio and terrain within resource budgets');
 await page.keyboard.press('Escape');await page.locator('[data-action="settings"]').click();await page.keyboard.press('Escape');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__JD.ui.view),'hud');checks.push('nested menus return to the hunt through Escape');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,durations,resources,errors},null,2));
}finally{await writeFile(dir+'/report.json',JSON.stringify({checks,durations,resources,errors},null,2));await browser.close();}
