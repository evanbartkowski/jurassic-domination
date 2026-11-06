import './style.css';
import './world-ui.css';
import { Game } from './game.js';
import { SPECIES } from './data.js';
import { WorldRenderer } from './renderer.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import {loadData,saveData,purchaseUpgrade,recordRun} from './profile.js';

let storage;try{storage=localStorage;}catch{storage={getItem(){throw Error();},setItem(){throw Error();}};}
let {profile,settings,failed:storageFailed}=loadData(storage);
let game=null,paused=false,recorded=false,difficulty='survival',world,graphicsFailed=false,mapExpanded=false;
const audio=new AudioEngine(settings),keys=new Set(),pending=new Set();
const pointer={x:innerWidth*.6,y:innerHeight*.5,down:false,moved:false};
let ui;
function persist(){if(!saveData(storage,profile,settings)&&!storageFailed){storageFailed=true;ui?.toast('Local storage is unavailable. Progress will last for this session.');}}
function unlock(){audio.unlock().catch(()=>ui?.toast('Audio could not start. Check your audio device.'));}
function start(mode='survival'){
  if(graphicsFailed)return;unlock();difficulty=mode;game=new Game({seed:Date.now()>>>0,difficulty:mode,upgrades:profile.upgrades});paused=false;recorded=false;keys.clear();pending.clear();pointer.down=false;ui.showHUD();audio.setMode('playing');
  ui.toast('An egg. A new beginning. Press E to hatch.');
}
function pause(){if(game&&['egg','playing'].includes(game.state)&&ui.view==='hud'){paused=true;keys.clear();pending.clear();pointer.down=false;ui.showPause();audio.setMode('paused');}}
function resume(){if(!game)return;paused=false;keys.clear();pending.clear();ui.showHUD();audio.setMode('playing');}
function menu(){paused=false;game=null;keys.clear();pointer.down=false;ui.showMenu(profile);audio.setMode('menu');}
async function fullscreen(){
  try{if(window.desktop)settings.fullscreen=await window.desktop.fullscreen();else if(document.fullscreenElement){await document.exitFullscreen();settings.fullscreen=false;}else{await document.documentElement.requestFullscreen();settings.fullscreen=true;}}catch{ui.toast('Fullscreen is unavailable on this display.');}
}
ui=new UI({
  start,resume,pause,restart:()=>start(difficulty),menu,
  hatch:()=>{unlock();game?.hatch();},
  evolve:(speciesId,mutationId)=>{game?.evolve(speciesId,mutationId);if(game?.state==='playing'){ui.showHUD();audio.setMode('playing');if(!profile.unlocked.includes(speciesId)){profile.unlocked.push(speciesId);persist();ui.updateProfile(profile);}}},
  settings:next=>{settings={...settings,...next};audio.configure(settings);world?.configure(settings);persist();},
  upgrade:id=>{if(purchaseUpgrade(profile,id)){persist();ui.updateProfile(profile);ui.showLegacy();audio.play('evolve');}else ui.toast('Earn more DNA by surviving the food chain.');},
  quit:()=>{if(window.desktop)window.desktop.quit();else ui.toast('Close this tab to exit. Your legacy is saved.');},fullscreen
},profile,settings);

let canvas=document.getElementById('world');
if(!canvas){canvas=document.createElement('canvas');canvas.id='world';document.body.prepend(canvas);}
function failGraphics(message){
  graphicsFailed=true;pause();
  let el=document.getElementById('graphics-error');if(!el){el=document.createElement('section');el.id='graphics-error';el.style.cssText='position:fixed;inset:0;z-index:999;background:#091611;display:grid;place-content:center;padding:40px;color:#f0e9d5;font:18px system-ui;max-width:none';el.innerHTML='<h1>Graphics device unavailable</h1><p id="graphics-message"></p><p>Try updating your graphics driver, enabling hardware acceleration, or restarting the desktop game.</p><button id="graphics-retry">Restart game</button>';document.body.append(el);el.querySelector('button').onclick=()=>location.reload();}el.querySelector('#graphics-message').textContent=message;
}
try{world=new WorldRenderer(canvas,settings,failGraphics);}catch(error){console.error(error);failGraphics('Jurassic Domination requires a graphics device with WebGL 2 support.');}
ui.showMenu(profile);
if(storageFailed)ui.toast('Progress storage could not be read. A fresh session has started.');
document.addEventListener('pointerdown',()=>unlock(),{once:true});
window.addEventListener('resize',()=>world?.resize());
window.addEventListener('contextmenu',event=>{if(ui.view==='hud')event.preventDefault();});
window.addEventListener('pointermove',event=>{pointer.x=event.clientX;pointer.y=event.clientY;pointer.moved=true;});
window.addEventListener('pointerdown',event=>{if(ui.view==='hud'&&event.button===0&&!event.target.closest('button,input,select')){pointer.down=true;pending.add('Mouse0');}});
window.addEventListener('pointerup',()=>pointer.down=false);
window.addEventListener('blur',()=>{keys.clear();pointer.down=false;pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pointer.down=false;pause();}});
window.addEventListener('keydown',event=>{
  const key=event.code;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(key)&&ui.view==='hud')event.preventDefault();
  if(key==='Escape'){
    if(ui.view==='hud')pause();else if(ui.view==='pause')resume();else if(!['evolution','death','menu'].includes(ui.view))ui.back();return;
  }
  if(key==='F11'&&!window.desktop){event.preventDefault();fullscreen();return;}
  if(event.target.matches('input,select,textarea'))return;
  if(key==='KeyM'&&ui.view==='hud'&&!event.repeat){mapExpanded=!mapExpanded;const map=document.getElementById('minimap');if(map){map.classList.toggle('expanded',mapExpanded);map.style.width=mapExpanded?'320px':'';map.style.height=mapExpanded?'320px':'';}return;}
  if(key==='Tab'&&ui.view==='hud'&&!event.repeat){pause();ui.showGuide();return;}
  if(key==='Enter'&&ui.view==='death'&&!event.repeat){start(difficulty);return;}
  if(ui.view==='hud'){keys.add(key);pending.add(key);}
});
window.addEventListener('keyup',event=>keys.delete(event.code));

const damageLayer=document.createElement('div');damageLayer.id='damage-layer';damageLayer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:3;overflow:hidden';document.body.append(damageLayer);
const floating=[];
const labelLayer=document.createElement('div');labelLayer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2;overflow:hidden';document.body.append(labelLayer);
const labels=new Map();
const lowHealth=document.createElement('div');lowHealth.id='low-health-screen';document.body.append(lowHealth);
const alphaBar=document.createElement('div');alphaBar.id='alpha-boss';alphaBar.hidden=true;alphaBar.innerHTML='<span>ALPHA HUNT</span><strong></strong><b><i></i></b><small></small>';document.body.append(alphaBar);
function updateWorldUI(){
  const visible=game&&ui.view==='hud'&&game.state==='playing';labelLayer.style.display=visible?'':'none';
  lowHealth.style.opacity=visible?Math.max(0,(.4-game.player.hp/game.player.maxHp)*2.2):0;
  alphaBar.hidden=!visible||!game.boss;
  if(visible&&game.boss){
    const boss=game.entities.find(e=>e.id===game.boss.id),p=game.player;
    alphaBar.querySelector('strong').textContent=game.boss.name;
    alphaBar.querySelector('i').style.width=`${Math.max(0,game.boss.hp/game.boss.maxHp)*100}%`;
    if(boss){const dx=boss.x-p.x,dy=boss.y-p.y;alphaBar.querySelector('small').textContent=`${Math.round(Math.hypot(dx,dy))}m · ${dy<-5?'NORTH':dy>5?'SOUTH':''}${dx<-5?' WEST':dx>5?' EAST':''} · IT IS HUNTING YOU`;}
  }
  if(!visible||!world)return;
  const p=game.player,near=game.entities.filter(e=>Math.hypot(e.x-p.x,e.y-p.y)<27).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).slice(0,18),seen=new Set();
  for(const e of near){
    seen.add(e.id);let element=labels.get(e.id);const species=SPECIES.find(s=>s.id===e.speciesId);if(!species)continue;
    if(!element){element=document.createElement('div');element.className='creature-label';element.innerHTML='<span></span><b><i></i></b>';labels.set(e.id,element);labelLayer.append(element);}
    element.className=`creature-label${species.tier>game.tier?' predator':''}${e.boss?' alpha':''}`;
    element.querySelector('span').textContent=`${e.boss?'ALPHA · ':''}${species.name}`;
    element.querySelector('i').style.transform=`scaleX(${Math.max(0,e.hp/e.maxHp)})`;
    const pos=world.project(e.x,e.y,species.size*2+1);element.style.transform=`translate(${pos.x}px,${pos.y}px)`;element.style.opacity=pos.visible?1:0;
  }
  for(const [id,element]of labels)if(!seen.has(id)){element.remove();labels.delete(id);}
}
function float(event){
  if(!settings.showDamage||!world||!Number.isFinite(event.x)||!Number.isFinite(event.y))return;
  if(!['hit','eat'].includes(event.type))return;
  const amount=event.amount;if(!amount)return;
  const element=document.createElement('span');element.textContent=event.type==='eat'?`+${Math.round(amount)}`:`${Math.round(amount)}`;
  element.style.cssText=`position:absolute;font:700 18px system-ui;color:${event.type==='eat'?'#c0e9a8':'#ffbc94'};text-shadow:0 2px 5px #000;will-change:transform,opacity`;
  damageLayer.append(element);floating.push({element,x:event.x,y:event.y,life:1});
}
function events(){
  for(const event of game.consumeEvents()){
    world?.event(event);audio.play(event.type);float(event);
    if(['warning','boss','evolution-ready','hatch'].includes(event.type)&&event.text)ui.toast(event.text);
    if(event.type==='hatch'&&!profile.unlocked.includes(game.player.speciesId)){profile.unlocked.push(game.player.speciesId);persist();ui.updateProfile(profile);}
  }
}
let last=performance.now(),accumulator=0,miniTimer=0,uiTimer=0,frames=0,fpsTime=0,fps=60;
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
  frames++;fpsTime+=dt;if(fpsTime>=1){fps=Math.round(frames/fpsTime);frames=0;fpsTime=0;}
  try {
    const active=game&&!paused&&ui.view==='hud'&&['egg','playing'].includes(game.state);
    if(active){
      let x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
      let y=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);
      const aim=pointer.moved&&world?world.aim(pointer.x,pointer.y,game.player):x||y?Math.atan2(y,x):game.player.angle;
      accumulator+=dt;
      const held=code=>keys.has(code)||pending.has(code);
      while(accumulator>=1/60){game.update(1/60,{x,y,aim,attack:pointer.down||held('Space')||held('Mouse0'),ability:held('KeyQ'),dash:held('ShiftLeft')||held('ShiftRight'),eat:held('KeyE')});pending.clear();accumulator-=1/60;if(game.state==='dead'||game.state==='evolution')break;}
    }else accumulator=0;
    if(game){
      events();
      if(game.state==='evolution'&&ui.view!=='evolution'){keys.clear();pointer.down=false;ui.showEvolution(game);audio.setMode('paused');}
      if(game.state==='dead'&&!recorded){recorded=true;const result=game.getResults();recordRun(profile,result);persist();ui.updateProfile(profile);ui.showDeath(result,profile);audio.setMode('dead');}
    }
    if(game){uiTimer+=dt;miniTimer+=dt;if(uiTimer>.08){ui.updateHUD(game,dt);uiTimer=0;}if(miniTimer>.15){world?.minimap(document.getElementById('minimap'),game,mapExpanded);miniTimer=0;}}
    const menuView=!game;
    if(!graphicsFailed)world?.render(game,paused?0:dt,menuView);
    updateWorldUI();
    audio.update(dt,game);
    for(let i=floating.length-1;i>=0;i--){const f=floating[i];f.life-=dt;if(f.life<=0){f.element.remove();floating.splice(i,1);continue;}const pos=world.project(f.x,f.y,2+(1-f.life)*2);f.element.style.transform=`translate(${pos.x}px,${pos.y}px)`;f.element.style.opacity=f.life;}
    document.body.classList.toggle('is-playing',ui.view==='hud'&&game?.state==='playing');
  }catch(error){console.error('Game frame error',error);pause();ui.toast('The run encountered an error. Return to the menu to begin a new life.');}
}
requestAnimationFrame(frame);
// Read-only diagnostics are available only on the local development server.
if(import.meta.env.DEV){window.__JD={get game(){return game;},get ui(){return ui;},get profile(){return profile;},get world(){return world;},get settings(){return settings;},get fps(){return fps;},start,pause,resume};}
