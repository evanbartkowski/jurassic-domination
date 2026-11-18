import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const phase=process.argv[2]||'after',dir=`artifacts/start-screen/${phase}`;await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 for(const [name,width,height]of [['desktop',1440,900],['ultrawide',2560,1080],['mobile',390,844]]){
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__JD?.ui.view==='start');
  if(phase==='after')await page.waitForFunction(()=>window.__JD.world.startVista?.ready);
  await page.screenshot({path:`${dir}/${name}.png`});
  assert.ok(await page.locator('[data-action="enter"]').isVisible());assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('[data-action="enter"]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__JD.ui.view==='menu');
 }
 if(phase==='after'){
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>window.__JD?.world.startVista?.ready);await page.screenshot({path:`${dir}/reduced-motion.png`});
  const elements=await page.locator('.start-heading,[data-action="enter"]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right};}));
  assert.ok(elements.every(r=>r.top>=0&&r.left>=0&&r.right<=page.viewportSize().width));
 }
 assert.deepEqual(errors,[]);await writeFile(dir+'/report.json',JSON.stringify({layouts:3,keyboardStart:true,errors},null,2));console.log(`Start screen ${phase}: 3 layouts and keyboard entry checked`);
}finally{await browser.close();}
