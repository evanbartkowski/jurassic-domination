import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page = await browser.newPage({viewport:{width:1440,height:900}}), errors=[];
page.on('pageerror',error=>errors.push(error.message));
await fs.mkdir('artifacts',{recursive:true});
let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(()=>window.__JD?.ui);
  await check('title opens permanent ancestry journal before any life exists',async()=>{
    await page.locator('[data-action="field-journal"]').click();
    await page.waitForFunction(()=>window.__JD.ui.view==='field-journal');
    assert.match(await page.locator('.wide-panel.field-journal').innerText(),/ancestr|generation/i);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>window.__JD.ui.view==='menu');
  });
  await page.locator('[data-action="start"]').click();
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>window.__JD.game?.state==='playing');
  await check('real H control stalks and L opens a paused field journal',async()=>{
    await page.keyboard.down('KeyH'); await page.keyboard.down('KeyD');
    await page.waitForFunction(()=>window.__JD.game.player.crouching&&window.__JD.game.player.x>1);
    await page.keyboard.up('KeyD'); await page.keyboard.up('KeyH');
    await page.waitForFunction(()=>!window.__JD.game.player.crouching);
    await page.screenshot({path:'artifacts/immersion-gameplay.png'});
    await page.keyboard.press('KeyL');
    await page.waitForFunction(()=>window.__JD.ui.view==='field-journal');
    const before=await page.evaluate(()=>window.__JD.game.time);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>window.__JD.game.time),before);
    assert.equal(await page.locator('.field-journal img').first().evaluate(i=>i.complete&&i.naturalWidth>0),true);
  });
  await check('integrated journal fits desktop and narrow screens with working back navigation',async()=>{
    for(const width of [1440,600,360]) {
      await page.setViewportSize({width,height:900});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);
      assert.equal(await page.locator('#overlay').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'overlay overflow at '+width);
    }
    await page.setViewportSize({width:1440,height:900});
    await page.screenshot({path:'artifacts/immersion-journal.png'});
    await page.locator('.field-journal [data-action="back"]').last().click();
    await page.waitForFunction(()=>window.__JD.ui.view==='pause');
  });
  await check('checkpoint carries genetics, senses, weather, nests and exploration and resumes identically',async()=>{
    const before=await page.evaluate(async()=>{
      const {snapshotGame}=await import('/src/run-state.js');return snapshotGame(window.__JD.game);
    });
    assert.equal(before.version,2);
    for(const key of ['survival','exploration','worldState','senses','nests','formHistory']) assert.ok(before.game[key]!==undefined,key);
    await page.reload(); await page.waitForFunction(()=>window.__JD?.ui?.view==='menu');
    await page.locator('[data-action="continue"]').click();
    await page.waitForFunction(()=>window.__JD.game&&window.__JD.ui.view==='pause');
    const after=await page.evaluate(async()=>{const {snapshotGame}=await import('/src/run-state.js');return snapshotGame(window.__JD.game);});
    assert.deepEqual(after,before);
    await page.locator('[data-action="resume"]').click();
    await page.waitForFunction(()=>window.__JD.game.time>0&&window.__JD.ui.view==='hud');
  });
  await check('real renderer uses bounded ecological meshes and the map begins mostly unexplored',async()=>{
    await page.keyboard.press('KeyM');
    await page.waitForFunction(()=>document.getElementById('minimap').width===480);
    const result=await page.evaluate(()=>{
      const w=window.__JD.world,canvas=document.getElementById('minimap'),data=canvas.getContext('2d').getImageData(0,0,480,480).data;
      let dark=0;for(let i=0;i<data.length;i+=4) if(data[i]<25&&data[i+1]<35&&data[i+2]<35) dark++;
      return {dark:dark/(480*480),art:w.ecologyArt.root.visible,counts:w.ecologyArt.root.userData.counts,models:[...w.models.values()].filter(m=>m.visible).map(m=>m.userData.genomeKey)};
    });
    assert.ok(result.dark>.7);assert.equal(result.art,true);assert.ok(result.models.every(k=>typeof k==='string'));assert.ok(result.counts);
  });
  assert.deepEqual(errors,[]);
  console.log(`${passed} integrated immersion checks passed`);
} finally {await browser.close();}
