import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const dir='artifacts/presentation/after',errors=[],checks=[],layouts=[];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function shot(name){await page.waitForTimeout(300);await page.screenshot({path:`${dir}/${name}.png`});checks.push(name);console.log('PASS',name);}
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__JD?.world);
 await page.evaluate(()=>window.__JD.ui.callbacks.backups());await shot('backups');
 const download=page.waitForEvent('download');await page.locator('[data-action="export-backup"]').click();const file=await download;assert.match(file.suggestedFilename(),/backup.*json/);
 await page.evaluate(()=>{window.__JD.ui.savedRun={name:'QA creature',tier:0,time:0,difficulty:'survival'};window.__JD.ui.showNewLifePrompt();});await shot('new-life-confirmation');
 await page.locator('[data-action="keep"]').click();await page.evaluate(()=>{window.__JD.ui.savedRun=null;window.__JD.ui.showMenu();});await page.locator('[data-action="start"]').click();await page.waitForFunction(()=>window.__JD.game?.state==='egg');await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__JD.game.state==='playing');
 // The roar is a real button within the shared action dock.
 await page.locator('.roar-corner-btn').click();await page.waitForFunction(()=>window.__JD.game.player.roarCooldown>0);checks.push('roar button triggers real cooldown');
 await page.evaluate(()=>{const d=window.__JD;d.game.state='paused';d.game.player.invulnerable=999;d.ui.updateHUD(d.game);});
 await shot('hud');
 for(const [width,height] of [[800,600],[1280,720],[1600,900],[1920,1080],[2560,1440]])for(const scale of [1,1.25]){
  await page.setViewportSize({width,height});await page.evaluate(scale=>document.documentElement.style.setProperty('--ui-scale',String(scale)),scale);
  const suffix=scale===1?'': '-scale-125';await shot(`hud-${width}${suffix}`);
  const boxes=await page.evaluate(()=>['.hud-top-left-cluster','.minimap-wrap','.abilities','.hud-quick-buttons','#pickup-prompt'].map(selector=>{const e=document.querySelector(selector),r=e.getBoundingClientRect();return {selector,x:r.x,y:r.y,width:r.width,height:r.height};}).filter(r=>r.width&&r.height));
  for(const b of boxes)assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=width+1&&b.y+b.height<=height+1,`Outside ${width} ${scale}: ${JSON.stringify(b)}`);
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(!(a.x<b.x+b.width-1&&a.x+a.width>b.x+1&&a.y<b.y+b.height-1&&a.y+a.height>b.y+1),`HUD overlap ${width} ${scale}: ${a.selector} / ${b.selector}`);}
  layouts.push({width,height,scale,boxes});
 }
 await page.setViewportSize({width:1280,height:720});await page.evaluate(()=>{document.documentElement.style.setProperty('--ui-scale','1');window.__JD.ui.showHUD();});
 // Expanded map hit testing uses its actual onscreen dimensions.
 await page.keyboard.press('KeyM');await page.waitForFunction(()=>document.getElementById('minimap').classList.contains('expanded'));await shot('expanded-map');
 await page.keyboard.press('KeyM');
 await page.evaluate(()=>{const d=window.__JD;d.ui.toast('Ancient site discovered · journal updated');});await shot('notification');
 await page.evaluate(()=>{const d=window.__JD;d.ui.screen('effects-audit','');d.world.event({type:'evolve',x:0,y:0});for(let i=0;i<5;i++)d.world.render(d.game,1/60,false);});await shot('evolution-effects');
 await page.setViewportSize({width:1440,height:900});await page.evaluate(()=>{window.__JD.game.state='paused';window.__JD.ui.showGuide();});await shot('guide');
 const labels=await page.evaluate(()=>[...document.querySelectorAll('.species-entry')].map(e=>{const r=e.getBoundingClientRect(),h=e.querySelector('h2').getBoundingClientRect();return {name:e.querySelector('h2').textContent,contained:h.top>=r.top&&h.bottom<=r.bottom};}));
 assert.ok(labels.length>=100&&labels.every(e=>e.contained),'Every species name fits inside its own card');checks.push('all species card names remain contained');
 for(const [name,tab] of [['journal','journal'],['bloodlines','bloodlines']]){await page.evaluate(tab=>window.__JD.ui.showCompendium(tab,window.__JD.game),tab);await shot(name);}
 await page.evaluate(()=>window.__JD.ui.showShop());await shot('shop');
 await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.__JD.ui.showMenu());await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>window.__JD.world.camera.position.x),0,'OS reduced-motion preference stops decorative camera drift');checks.push('OS reduced motion stops camera drift');
 assert.deepEqual(errors,[]);await writeFile(`${dir}/details-report.json`,JSON.stringify({checks,errors,layouts},null,2));console.log(`${checks.length} presentation detail checks passed.`);
}finally{await browser.close();}
