import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const phase=process.argv[2] || 'after', dir=`artifacts/presentation/${phase}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}}), errors=[], checks=[];
page.setDefaultTimeout(45_000);page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`);});
async function shot(name){await page.waitForTimeout(400);await page.screenshot({path:`${dir}/${name}.png`,timeout:60_000});checks.push(name);console.log('CAPTURE',name);}
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__JD?.world);
 await page.locator('[data-action="start"]').waitFor();
 await page.waitForTimeout(600);await shot('title');
 for(const [name,method] of [['settings','showSettings'],['controls','showControls'],['guide','showGuide'],['tutorial','showTutorial'],['legacy','showLegacy'],['wardrobe','showWardrobe'],['shop','showShop'],['island','showIsland']]){
  await page.evaluate(method=>window.__JD.ui[method](),method);await page.waitForTimeout(120);await shot(name);
 }
 await page.evaluate(()=>window.__JD.ui.showMenu());
 await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__JD.game?.state==='egg');
 await shot('egg');await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__JD.game.state==='playing');
 await page.evaluate(()=>{const g=window.__JD.game;g.player.invulnerable=9999;g.player.hunger=100;});
 await shot('hud');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__JD.ui.view==='pause');await shot('pause');
 for(const [name,tab] of [['journal','journal'],['bloodlines','bloodlines'],['ancestry','lineage'],['mutation-builds','build']]){
  await page.evaluate(tab=>window.__JD.ui.showCompendium(tab,window.__JD.game),tab);await shot(name);
 }
 await page.evaluate(()=>{const g=window.__JD.game;g.state='playing';g.gainXP(g.nextThreshold);g.openEvolution();window.__JD.ui.showEvolution(g);});
 await shot('evolution');
 await page.evaluate(async()=>{const {MUTATIONS}=await import('/src/data.js');const g=window.__JD.game;g.closeEvolution();g.state='paused';window.__JD.ui.showMutationChoice(g,{choices:MUTATIONS.slice(0,3),rarity:'rare'});});await shot('mutation');
 await page.evaluate(()=>{const g=window.__JD.game;window.__JD.ui.showBuildSheet(g);});await shot('upgrades');
 // Render actual supported regions, independent of the random player spawn.
 await page.evaluate(()=>{window.__JD.game.time=90;window.__JD.game.state='paused';window.__JD.ui.screen('presentation-audit','');});
 const regions=await page.evaluate(async()=>{const {REGIONS,biomeAt}=await import('/src/world-data.js');return REGIONS.map(r=>{const y=r.id==='fernwood'?0:(r.minRadius+r.maxRadius)/2*(r.side==='north'?-1:1);if(biomeAt(0,y).id!==r.id)throw Error('Biome capture mismatch '+r.id);return [r.id,0,y];});});
 for(const [name,x,y] of regions){
  await page.evaluate(({x,y})=>{const d=window.__JD,g=d.game;g.player.x=x;g.player.y=y;d.world.cameraTarget.set(x,0,y);for(let i=0;i<10;i++)d.world.render(g,.1,false);},{x,y});await shot('world-'+name);
 }
 const water=await page.evaluate(async()=>{const {worldFeatures}=await import('/src/wilderness.js');const d=window.__JD,g=d.game;const f=worldFeatures(g.seed,0,0).find(f=>f.type==='water');if(!f)throw Error('Missing deterministic QA water');g.player.x=f.x;g.player.y=f.y;d.world.cameraTarget.set(f.x,0,f.y);for(let i=0;i<12;i++)d.world.render(g,1/60,false);return f;});
 await shot('water');
 for(const [name,debug] of [['water-normals',1],['water-depth',2]]){
  await page.evaluate(debug=>window.__JD.world.scene.traverse(o=>{if(o.material?.name==='Lost Continent bounded water')o.material.uniforms.uDebug.value=debug;}),debug);await shot(name);
 }
 await page.evaluate(()=>window.__JD.world.scene.traverse(o=>{if(o.material?.name==='Lost Continent bounded water')o.material.uniforms.uDebug.value=0;}));
 await page.evaluate(()=>{const d=window.__JD,g=d.game;d.world.event({type:'evolve',x:g.player.x,y:g.player.y});});await shot('evolution-effects');
 await page.evaluate(()=>{const g=window.__JD.game;g.state='playing';g.player.invulnerable=0;g.damagePlayer(99999,'Presentation QA',true);});
 await page.waitForFunction(()=>window.__JD.ui.view==='death');await shot('death');
 // Responsive screen contract across all requested display sizes.
 const dimensions=[],layout=[];
 for(const [width,height] of [[800,600],[1280,720],[1600,900],[1920,1080],[2560,1440]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>{window.__JD.game.state='paused';window.__JD.ui.showMenu();});await shot(`title-${width}`);
  const m=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,buttons:[...document.querySelectorAll('#overlay button')].filter(e=>e.offsetWidth&&e.offsetHeight).map(e=>({label:e.textContent.trim(),...Object.fromEntries(['x','y','width','height'].map(k=>[k,e.getBoundingClientRect()[k]]))}))}));
  dimensions.push({width,height,...m});
  assert.equal(m.overflow,false,`Title horizontal overflow at ${width}`);
  for(const b of m.buttons)assert.ok(b.x>=-1&&b.x+b.width<=width+1,`Title control outside width: ${b.label}`);
  if(phase==='before')continue;
  await page.evaluate(()=>{const d=window.__JD,g=d.game;g.state='paused';g.player.hp=g.player.maxHp;g.player.x=0;g.player.y=0;d.world.cameraTarget.set(0,0,0);d.ui.showHUD();d.ui.updateHUD(g);for(let i=0;i<10;i++)d.world.render(g,.1,false);});await shot(`hud-${width}`);
  const boxes=await page.evaluate(()=>['.hud-top-left-cluster','.minimap-wrap','.abilities','#hud-roar-dock'].map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {selector:s,x:r.x,y:r.y,width:r.width,height:r.height,visible:!!(e.offsetWidth&&e.offsetHeight)};}));
  for(const b of boxes.filter(b=>b.visible))assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=height+1,`HUD outside viewport ${width}: ${JSON.stringify(b)}`);
  layout.push({width,height,boxes});
  await page.evaluate(()=>window.__JD.ui.showSettings());await shot(`settings-${width}`);
  await page.evaluate(()=>{const ui=window.__JD.ui;const controls=[...ui.overlay.querySelectorAll('button,input,select')].filter(e=>!e.disabled&&e.getClientRects().length);controls.at(-1).focus();});
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement===window.__JD.ui.overlay.querySelector('button')),true,'Settings focus wraps to its first control');
  await page.evaluate(()=>{const d=window.__JD,g=d.game;g.state='playing';g.gainXP(g.nextThreshold);g.openEvolution();d.ui.showEvolution(g);});await shot(`evolution-${width}`);
  await page.evaluate(()=>{window.__JD.game.state='paused';});
 }
 await page.setViewportSize({width:1280,height:720});
 await page.evaluate(()=>{document.documentElement.style.setProperty('--ui-scale','1.25');window.__JD.ui.showSettings();});await shot('settings-scale-125');
 await page.evaluate(()=>{const d=window.__JD;d.game.state='paused';d.ui.showHUD();d.ui.updateHUD(d.game);});await shot('hud-scale-125');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{document.documentElement.style.setProperty('--ui-scale','1');window.__JD.ui.showMenu();});await shot('reduced-motion');
 assert.equal(await page.locator('.menu-grain').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.deepEqual(errors,[]);
 await writeFile(`${dir}/report.json`,JSON.stringify({checks,errors,dimensions,layout,water},null,2));
 console.log(`${checks.length} screens captured; no browser errors.`);
}finally{await browser.close();}
