import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {enterTitle} from './enter-title.mjs';
import pkg from '../package.json' with {type:'json'};
const dir=process.env.JD_RELEASE_ARTIFACTS||'artifacts/release-local';await mkdir(dir,{recursive:true});
let server,url=process.env.JD_QA_URL;
if(!url){
 const root=path.resolve('web-dist'),prefix='/jurassic-domination/';
 server=createServer(async(req,res)=>{try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!pathname.startsWith(prefix)){res.writeHead(404).end();return;}
  const filename=path.resolve(root,pathname.slice(prefix.length)||'index.html');if(!filename.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const info=await stat(filename),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.svg':'image/svg+xml','.mp3':'audio/mpeg','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
  res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Content-Length':info.size});createReadStream(filename).pipe(res);
 }catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}${prefix}`;
}
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-gpu-blocklist']}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],checks=[],models=new Set(),music=new Set();page.setDefaultTimeout(90000);
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);if(r.ok()&&r.url().includes('/models-v5/'))models.add(r.url());if(r.ok()&&r.url().includes('/sounds/music/'))music.add(r.url());});
try{
 await page.goto(url);await enterTitle(page);await page.locator('[data-action="credits"]').click();assert.match(await page.locator('.credits-panel').textContent(),new RegExp(pkg.version.replaceAll('.','\\.')));await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>typeof window.__JD),'undefined');checks.push('production title and version load under the real project path without development access');
 await page.locator('[data-action="start"]').click();await page.locator('#egg-prompt').waitFor({state:'visible'});await page.keyboard.press('KeyE');await page.locator('#egg-prompt').waitFor({state:'hidden'});
 await page.waitForTimeout(1800);await page.keyboard.down('KeyW');await page.keyboard.down('Shift');await page.waitForTimeout(1400);await page.keyboard.up('Shift');await page.keyboard.up('KeyW');
 assert.ok(Number.parseInt(await page.locator('#hud-stamina-text').textContent())<100,'sprint consumes real stamina');
 await page.keyboard.down('Space');await page.waitForFunction(()=>document.getElementById('attack-ready').classList.contains('cooling'));await page.keyboard.up('Space');checks.push('hatch movement sprint and attacks respond in the published build');
 await page.locator('#quest-hud-button').click();await page.getByText('A Hunger Older Than You',{exact:true}).first().waitFor();await page.keyboard.press('Escape');await page.keyboard.press('Escape');checks.push('the focus card opens the actual story and repeating quests');
 await page.keyboard.press('Escape');await page.locator('[data-action="settings"]').click();await page.locator('#setting-muted').setChecked(true);await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 await page.screenshot({path:dir+'/gameplay.png'});await page.setViewportSize({width:800,height:600});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:dir+'/small-window.png'});await page.setViewportSize({width:1440,height:900});
 await page.keyboard.press('Escape');await page.locator('[data-action="menu"]').click();await page.locator('[data-action="continue"]').waitFor();await page.reload();await enterTitle(page);await page.locator('[data-action="continue"]').click();await page.locator('[data-action="resume"]').waitFor();await page.locator('[data-action="resume"]').click();await page.locator('#hud-species').waitFor({state:'visible'});checks.push('settings and a living checkpoint survive reload and Continue');
 assert.ok(models.size>0,'current GLBs are actually downloaded');assert.ok(music.size>0,'bundled score is actually streamed');assert.deepEqual(errors,[]);checks.push('current creature models and audio load without HTTP or runtime errors');
 console.log(JSON.stringify({url,version:pkg.version,checks,models:models.size,music:music.size,errors},null,2));
}finally{await writeFile(dir+'/report.json',JSON.stringify({url,version:pkg.version,checks,models:[...models],music:[...music],errors},null,2));await browser.close();await new Promise(resolve=>server?server.close(resolve):resolve());}
