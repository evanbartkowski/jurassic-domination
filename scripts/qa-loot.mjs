import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {enterTitle} from './enter-title.mjs';
const skinsOnly=process.argv.includes('--skins-only'),uiOnly=process.argv.includes('--ui-only'),dir='artifacts/loot';await mkdir(dir+'/skins',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}),errors=[],checks=[];
const page=await browser.newPage({viewport:{width:1440,height:980}});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__JD?.ui);
 if(!uiOnly){
  await page.evaluate(async()=>{
   const d=window.__JD;d.ui.screen('art-review','<canvas id="skin-review"></canvas>');
   const T=await import('/node_modules/three/build/three.module.js'),{createNaturalEnvironment}=await import('/src/natural-materials.js');
   const r=new T.WebGLRenderer({canvas:document.getElementById('skin-review'),antialias:true,preserveDrawingBuffer:true});r.setSize(800,600);r.setPixelRatio(1);r.setClearColor(0x14201d);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.1;
   const scene=new T.Scene(),env=createNaturalEnvironment(r);scene.environment=env.texture;scene.environmentIntensity=.35;scene.add(new T.HemisphereLight(0xdbe7e1,0x39302b,1.5));
   for(const [pos,color,intensity]of [[[4,6,5],0xffead2,3.2],[[-4,2,-4],0x91cbdc,1.4]]){const l=new T.DirectionalLight(color,intensity);l.position.set(...pos);scene.add(l);}
   window.skinReview={T,r,scene,env,camera:new T.PerspectiveCamera(32,4/3,.01,200)};
  });
  const ids=await page.evaluate(async()=>(await import('/src/content.js')).SKINS.map(s=>s.id));
  for(const id of ids){
   const data=await page.evaluate(async id=>{
    const {r,scene,camera}=window.skinReview,{createDinosaur}=await import('/src/creatures.js'),{SPECIES_BY_ID}=await import('/src/data.js'),{fitSpecimenCamera}=await import('/src/specimen-framing.js');
    const model=createDinosaur(SPECIES_BY_ID.tyrannosaurus,true,id);scene.add(model);
    for(let i=0;i<1000&&!model.userData.isGLB;i++)await new Promise(requestAnimationFrame);
    if(!model.userData.isGLB)throw Error('Skin model failed: '+id);
    model.rotation.y=-.45;model.updateMatrixWorld(true);fitSpecimenCamera(camera,model,{padding:1.08});r.render(scene,camera);
    const material=model.userData.flagshipAsset.detailMeshes[0][0].material;if(id!=='natural'&&!material.userData.skinPattern)throw Error('Pattern missing: '+id);
    const result=r.domElement.toDataURL('image/png').split(',')[1];scene.remove(model);model.userData.dispose();return result;
   },id);await sharp(Buffer.from(data,'base64')).png().toFile(`${dir}/skins/${id}.png`);
  }
  for(let i=0;i<ids.length;i+=9){const tiles=[];for(const [j,id]of ids.slice(i,i+9).entries()){
   tiles.push({input:await sharp(`${dir}/skins/${id}.png`).resize(360,270).toBuffer(),left:j%3*360,top:Math.floor(j/3)*300});
   tiles.push({input:Buffer.from(`<svg width="360" height="30"><rect width="360" height="30" fill="#14201d"/><text x="12" y="21" fill="#dfd1aa" font-size="15" font-family="sans-serif">${id}</text></svg>`),left:j%3*360,top:Math.floor(j/3)*300+270});
  }await sharp({create:{width:1080,height:Math.ceil(Math.min(9,ids.length-i)/3)*300,channels:3,background:'#14201d'}}).composite(tiles).png().toFile(`${dir}/skin-roster-${Math.floor(i/9)+1}.png`);}
  checks.push(`${ids.length} production skin shaders compiled and rendered`);
  await page.evaluate(()=>{const s=window.skinReview;s.env.dispose();s.r.dispose();s.r.forceContextLoss();});
 }
 if(!skinsOnly){
  await page.reload();await enterTitle(page);await page.waitForFunction(()=>window.__JD?.ui);
  await page.evaluate(async()=>{const {grantCrate}=await import('/src/loot.js');for(const type of ['field','hunter','elder','primeval'])grantCrate(window.__JD.profile,type,'qa:'+type);window.__JD.ui.showMenu();});
  await page.locator('[data-action="loot"]').click();await page.screenshot({animations:'disabled',path:`${dir}/locker-desktop.png`});
  await page.locator('[data-crate-type="primeval"]').click();
  const before=await page.evaluate(()=>window.__JD.profile.loot.crates.length);await page.locator('[data-open-crate]').click();
  assert.equal(await page.evaluate(()=>window.__JD.profile.loot.crates.length),before-1);assert.equal(await page.evaluate(()=>window.__JD.profile.loot.opened),1);
  await page.screenshot({animations:'disabled',path:`${dir}/reel-spinning.png`});await page.locator('[data-skip-reveal]').click();
  await page.waitForFunction(()=>window.__JD.revealReady||window.__JD.ui.revealReady);
  await page.waitForFunction(()=>{const v=window.__JD.productViewer;return v&&(!v.model.userData.species||v.model.userData.isGLB);});
  await page.screenshot({animations:'disabled',path:`${dir}/reveal-desktop.png`});
  const reward=await page.evaluate(()=>window.__JD.profile.loot.history.at(-1));assert.ok(['epic','legendary'].includes(reward.rarity));
  const alignment=await page.locator('.crate-reel').evaluate(track=>{const card=track.children[25].getBoundingClientRect(),window=track.parentElement.getBoundingClientRect();return Math.abs((card.left+card.right-window.left-window.right)/2);});assert.ok(alignment<2,'reel lands on the saved winner');
  await page.locator('[data-reward-equip]').click();await page.locator('[data-loot-return]').click();assert.equal(await page.evaluate(()=>window.__JD.ui.view),'loot');
  await page.reload();await enterTitle(page);await page.waitForFunction(()=>window.__JD?.ui);
  assert.equal(await page.evaluate(()=>window.__JD.profile.loot.opened),1);assert.equal(await page.evaluate(()=>window.__JD.profile.loot.history.at(-1).sku),reward.sku);assert.equal(await page.evaluate(()=>window.__JD.profile.loot.crates.length),3);
  checks.push('opening commits once before animation, skip lands correctly, equipment and rewards survive reload');
  await page.evaluate(()=>window.__JD.ui.showWardrobe());await page.locator('#skin-rarity').selectOption('legendary');await page.locator('[data-skin-preview="voidwalker"]').click();
  await page.waitForFunction(()=>window.__JD.productViewer?.sku==='skin:voidwalker'&&window.__JD.productViewer.model.userData.isGLB);await page.screenshot({animations:'disabled',path:`${dir}/wardrobe-desktop.png`});
  await page.locator('[data-inspect-face]').click();assert.equal(await page.evaluate(()=>window.__JD.productViewer.faceMode),true);await page.screenshot({animations:'disabled',path:`${dir}/skin-face-details.png`});await page.locator('[data-inspect-reset]').click();
  for(const id of ['troodon','triceratops']){
   await page.locator('#skin-preview-species').selectOption(id);await page.waitForFunction(id=>window.__JD.productViewer.model.userData.species?.id===id&&window.__JD.productViewer.model.userData.isGLB,id);
   await page.screenshot({animations:'disabled',path:`${dir}/skin-preview-${id}.png`});
  }
  await page.locator('#skin-preview-species').selectOption('tyrannosaurus');
  await page.setViewportSize({width:390,height:844});await page.screenshot({animations:'disabled',path:`${dir}/wardrobe-mobile.png`});
  await page.evaluate(()=>window.__JD.ui.showLoot());await page.screenshot({animations:'disabled',path:`${dir}/locker-mobile.png`});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('[data-crate-type="elder"]').click();await page.locator('[data-open-crate]').click();await page.locator('[data-skip-reveal]').click();
  await page.locator('.crate-result').scrollIntoViewIfNeeded();await page.screenshot({animations:'disabled',path:`${dir}/reveal-mobile.png`});
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__JD.ui.view),'loot');
  checks.push('collection rarity filters, locked skin previews, narrow layouts and escape navigation');
  await page.setViewportSize({width:1440,height:980});await page.evaluate(()=>window.__JD.ui.callbacks.start('normal'));await page.waitForFunction(()=>window.__JD.game?.state==='egg');
  await page.evaluate(()=>{const d=window.__JD,g=d.game;d.ui.callbacks.hatch();g.entities=[];g.foods=[];g.player.invulnerable=99999;g.spawnFood('supply-crate',g.player.x+1,g.player.y,0,{crateType:'hunter',rarity:'rare',homeChunk:'0,0'});g.spawnFood('treasure',g.player.x-1,g.player.y,0,{findId:'prismatic-core',rarity:'epic',homeChunk:'0,0'});});
  const beforeFinds=await page.evaluate(()=>window.__JD.profile.loot.finds),oldDNA=await page.evaluate(()=>window.__JD.profile.dna);
  for(let attempt=0;attempt<3;attempt++){
   await page.waitForFunction(()=>window.__JD.game._eatCooldown===0);
   await page.keyboard.down('KeyE');await page.waitForTimeout(300);await page.keyboard.up('KeyE');
   await page.waitForFunction(()=>window.__JD.game._eatCooldown===0);
   console.log('Pickup state',await page.evaluate(()=>({view:window.__JD.ui.view,state:window.__JD.game.state,foods:window.__JD.game.foods.map(f=>f.type),crates:window.__JD.profile.loot.crates.map(c=>c.type),finds:window.__JD.profile.loot.finds})));
   if(await page.evaluate(n=>window.__JD.profile.loot.finds>n&&window.__JD.profile.loot.crates.filter(c=>c.type==='hunter').length===2,beforeFinds))break;
  }
  assert.ok(await page.evaluate(n=>window.__JD.profile.loot.finds>n,beforeFinds));assert.ok(await page.evaluate(n=>window.__JD.profile.dna>n,oldDNA));
  assert.equal(await page.evaluate(()=>window.__JD.profile.loot.crates.filter(c=>c.type==='hunter').length),2);
  await page.evaluate(()=>{const d=window.__JD,g=d.game;for(const [i,type]of ['field','hunter','elder','primeval'].entries())g.spawnFood('supply-crate',g.player.x+(i-1.5)*5,g.player.y+8,0,{crateType:type,rarity:{field:'uncommon',hunter:'rare',elder:'epic',primeval:'legendary'}[type],homeChunk:'0,0'});});
  await page.screenshot({animations:'disabled',path:`${dir}/map-loot.png`});checks.push('real map interaction banks treasure DNA, account XP and sealed crates');
 }
 assert.deepEqual(errors,[]);await writeFile(dir+'/qa-report.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await browser.close();}
