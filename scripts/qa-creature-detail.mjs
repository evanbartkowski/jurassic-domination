import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import sharp from 'sharp';
const phase=process.argv[2]||'after',all=process.argv.includes('--all'),gameOnly=process.argv.includes('--game-only'),skipGameplay=process.argv.includes('--roster-only'),dir=`artifacts/creature-detail/${phase}`;
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.__JD?.ui);
 await page.evaluate(async()=>{
  const d=window.__JD;d.ui.screen('art-review','<canvas id="detail-review"></canvas>');
  const T=await import('/node_modules/three/build/three.module.js'),{createNaturalEnvironment}=await import('/src/natural-materials.js');
  const canvas=document.getElementById('detail-review'),r=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});r.setSize(960,720);r.setPixelRatio(1);r.setClearColor(0x17201e);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.1;
  const scene=new T.Scene(),env=createNaturalEnvironment(r);scene.environment=env.texture;scene.environmentIntensity=.3;
  scene.add(new T.HemisphereLight(0xdbe5e2,0x383129,1.3));
  for(const [position,color,intensity] of [[[4,6,5],0xffead2,3.2],[[-4,2,-4],0x9ccbd8,1.5]]){const light=new T.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);}
  window.detailReview={T,r,scene,camera:new T.PerspectiveCamera(32,960/720,.01,200),env};
 });
 const ids=gameOnly?[]:all?await page.evaluate(async()=>(await import('/src/data.js')).SPECIES.map(s=>s.id)):['tyrannosaurus','carnotaurus','spinosaurus','giganotosaurus','velociraptor','troodon','triceratops','brachiosaurus','ankylosaurus'];
 const report=gameOnly?JSON.parse(await readFile(`${dir}/report.json`,'utf8')).report:[];
 for(const id of ids){
  const result=await page.evaluate(async ({id,phase})=>{
   const {T,r,scene,camera}=window.detailReview,{SPECIES_BY_ID}=await import('/src/data.js'),{createDinosaur,animateCreature}=await import('/src/creatures.js'),{fitSpecimenCamera}=await import('/src/specimen-framing.js');
   const model=createDinosaur(SPECIES_BY_ID[id],true);scene.add(model);
   for(let i=0;i<1200&&!model.userData.isGLB;i++){animateCreature(model,.016,i*.016,0,false,0);await new Promise(requestAnimationFrame);}
   if(!model.userData.isGLB)throw Error('Model failed to load: '+id);
   model.rotation.y=-.5;model.updateMatrixWorld(true);fitSpecimenCamera(camera,model,{padding:1.2});r.render(scene,camera);
   const data=window.detailReview.r.domElement.toDataURL('image/png').split(',')[1],asset=model.userData.flagshipAsset;
   const material=asset.detailMeshes[0][0].material;
   const stats={id,version:asset.version,triangles:r.info.render.triangles,calls:r.info.render.calls,detailVersion:material.userData.detailVersion,naturalPalette:material.userData.naturalPalette,maps:!!(material.map?.image&&material.normalMap?.image&&material.roughnessMap?.image)};
   if(phase==='colors-after'&&stats.naturalPalette!==id)throw Error('Natural palette failed: '+id);
   if(phase==='after'&&(!stats.maps||stats.detailVersion!==2))throw Error('Fine detail maps not loaded: '+id);
   scene.remove(model);model.userData.dispose();return{data,stats};
  },{id,phase});
  await sharp(Buffer.from(result.data,'base64')).png().toFile(`${dir}/${id}.png`);report.push(result.stats);
 }
 for(let i=0;i<ids.length;i+=9){
  const chunk=ids.slice(i,i+9),tiles=[];
  for(const [j,id] of chunk.entries()){
   const art=await sharp(`${dir}/${id}.png`).resize(420,315).toBuffer();
   const label=Buffer.from(`<svg width="420" height="36"><rect width="420" height="36" fill="#17201e"/><text x="16" y="24" fill="#e1d5ad" font-family="sans-serif" font-size="17">${id}</text></svg>`);
   tiles.push({input:art,left:(j%3)*420,top:Math.floor(j/3)*351},{input:label,left:(j%3)*420,top:Math.floor(j/3)*351+315});
  }
  await sharp({create:{width:1260,height:Math.ceil(chunk.length/3)*351,channels:3,background:'#17201e'}}).composite(tiles).png().toFile(`${dir}/roster-${Math.floor(i/9)+1}.png`);
 }
 const gameplay=[];
 await writeFile(`${dir}/report.json`,JSON.stringify({report,errors},null,2));
 if(phase==='after'&&!skipGameplay){
  await page.evaluate(async()=>{
   const d=window.__JD,{Game}=await import('/src/game.js');window.detailGame=new Game({seed:4411});window.detailGame.hatch();
   const g=window.detailGame;g.entities=[];g.foods=[];g.time=85;g.player.x=80;g.player.y=80;g.player.invulnerable=99999;
   d.ui.overlay.hidden=true;d.ui.hud.hidden=true;window.detailReview.env.dispose();window.detailReview.r.dispose();window.detailReview.r.forceContextLoss();const original=d.world.render.bind(d.world);d.world.render=(_,dt)=>original(window.detailGame,dt,false);
  });
  for(const id of ['tyrannosaurus','giganotosaurus','triceratops']){
   const data=await page.evaluate(async id=>{
    const d=window.__JD,w=d.world,g=window.detailGame,{SPECIES_BY_ID}=await import('/src/data.js'),{fitSpecimenCamera}=await import('/src/specimen-framing.js');
    w.resetRun();g.player.speciesId=id;g.tier=SPECIES_BY_ID[id].tier;g.player.growth=.55;g.refreshStats(true);g.player.angle=-.5;g._streamWorld(true);g.entities=[];g.foods=[];
    w.cameraTarget.set(g.player.x,0,g.player.y);
    for(let i=0;i<1200;i++){w.render(g,.016,false);if(w.models.get('player')?.userData.isGLB)break;await new Promise(requestAnimationFrame);}
    const model=w.models.get('player');if(!model?.userData.isGLB)throw Error('Gameplay model failed: '+id);
    for(let i=0;i<5;i++){w.render(g,.8,false);await new Promise(requestAnimationFrame);}
    fitSpecimenCamera(w.camera,model,{padding:1.07,direction:new window.detailReview.T.Vector3(.32,.2,1)});w.renderer.render(w.scene,w.camera);
    const material=model.userData.flagshipAsset.detailMeshes[0][0].material;
    return{id,triangles:w.renderer.info.render.triangles,calls:w.renderer.info.render.calls,detailVersion:material.userData.detailVersion,maps:!!(material.map?.image&&material.normalMap?.image&&material.roughnessMap?.image)};
   },id);
   if(!data.maps||data.detailVersion!==2)throw Error('Game did not use reviewed detail maps: '+id);
   await page.screenshot({path:`${dir}/gameplay-${id}.png`,timeout:60000});gameplay.push(data);
  }
  for(const id of ['tyrannosaurus','troodon','triceratops']){
   await page.evaluate(id=>{window.__JD.ui.guideSelection=id;window.__JD.ui.showCompendium('encyclopedia',window.detailGame);},id);
   await page.waitForFunction(id=>window.__JD.specimen?.speciesId===id&&window.__JD.specimen?.model.userData.isGLB,id);
   await page.evaluate(()=>{const s=window.__JD.specimen;s.quietMotion=true;s.model.rotation.y=-.55;s.resize();});
   await page.locator('[data-inspect-face]').click();
   await page.waitForFunction(()=>window.__JD.specimen.faceMode&&window.__JD.specimen.zoom===3.2&&window.__JD.specimen.faceCenter);
   await page.screenshot({path:`${dir}/face-inspection-${id}.png`,animations:'disabled'});
  }
  await page.locator('#specimen-canvas').focus();await page.keyboard.press('0');
  if(!await page.evaluate(()=>window.__JD.specimen.zoom===1&&!window.__JD.specimen.faceMode))throw Error('Keyboard specimen reset failed');
  await page.locator('[data-inspect-zoom="in"]').click();
  if(!await page.evaluate(()=>window.__JD.specimen.zoom>1))throw Error('Specimen zoom control failed');
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-inspect-face]').click();
  await page.locator('.specimen-inspection-controls').scrollIntoViewIfNeeded();
  const fits=await page.locator('.specimen-inspection-controls').evaluate(element=>{
   const bounds=element.getBoundingClientRect();return [...element.children].every(button=>{const rect=button.getBoundingClientRect();return rect.left>=bounds.left&&rect.right<=bounds.right&&rect.bottom<=bounds.bottom;});
  });
  if(!fits)throw Error('Mobile inspection controls overflow');
  await page.screenshot({path:`${dir}/face-inspection-mobile.png`,animations:'disabled'});
 }
 await writeFile(`${dir}/report.json`,JSON.stringify({report,gameplay,errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log(`Reviewed ${report.length} production-loaded creatures: ${dir}`);
}finally{await browser.close();}
