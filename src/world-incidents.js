import {seeded,WORLD_RADIUS} from './world-data.js';
import {shelterAt} from './frontier-map.js';
import {spawnMeteorCreatures,spawnMigration,spawnWanderer} from './frontier-ecology.js';
export function initializeIncidents(game){return game.frontierState||=( {version:1,sequence:0,nextAt:105,nextEncounterAt:48,encounters:0,active:null,craters:[],history:[],nextHeatAt:0} );}
export function beginIncident(game,kind){
 const state=initializeIncidents(game),sequence=state.sequence++,random=seeded(game.seed^Math.imul(sequence+9,371891)),a=random()*Math.PI*2,p=game.player;
 let x=p.x+Math.cos(a)*30,y=p.y+Math.sin(a)*30;const distance=Math.hypot(x,y);if(distance>WORLD_RADIUS-70){x*= (WORLD_RADIUS-70)/distance;y*= (WORLD_RADIUS-70)/distance;}
 state.active={id:`incident:${sequence}`,sequence,kind,x,y,radius:kind==='meteor'?24:110,startedAt:game.time,dueAt:game.time+(kind==='meteor'?14:8),endsAt:game.time+(kind==='meteor'?19:52),nextStrikeAt:game.time+8,strikes:[],processed:false};
 state.nextAt=game.time+210+random()*100;
 if(kind==='migration'){spawnMigration(game,random);state.active.endsAt=game.time+12;}
 game.emit('incident-warning',{kind,x,y,radius:state.active.radius,text:kind==='meteor'?'FALLING STAR — LEAVE THE IMPACT ZONE OR GET UNDER STONE':kind==='lightning'?'LIGHTNING FRONT — LEAVE WATER. FIND STONE SHELTER.':'A GREAT MIGRATION CROSSES YOUR PATH'});return state.active;
}
export function updateIncidents(game,dt){
 const state=initializeIncidents(game),p=game.player,now=game.time,shelter=shelterAt(p,game.effectiveSize||1,game.worldFeatures||[]);
 state.craters=state.craters.filter(c=>c.expires>now);
 // Regional meteor scars and nearby encounters share a persistent ledger.
 for(const scar of game.worldState?.scars||[]){
  const age=game.worldState.clock-scar.at;
  if(scar.event!=='meteor'||age<0||age>35||Math.hypot(p.x-scar.x,p.y-scar.y)>220||state.history.includes(scar.id))continue;
  const crater={id:scar.id,sequence:state.sequence++,x:scar.x,y:scar.y,radius:scar.radius,at:now-age,expires:now+540-age};
  state.history.push(scar.id);state.history=state.history.slice(-24);state.craters.push(crater);state.craters=state.craters.slice(-6);spawnMeteorCreatures(game,crater);game.emit('meteor-impact',crater);
 }
 if(Math.hypot(p.x,p.y)>65&&game.state==='playing'){
  if(now>=state.nextEncounterAt){spawnWanderer(game,state.encounters++);state.nextEncounterAt=now+45;}
  if(!state.active&&now>=state.nextAt)beginIncident(game,['meteor','lightning','migration'][state.sequence%3]);
 }
 const active=state.active;
 if(active){
  if(active.kind==='meteor'&&!active.processed&&now>=active.dueAt){
   active.processed=true;const crater={id:active.id,sequence:active.sequence,x:active.x,y:active.y,radius:active.radius,at:now,expires:now+540};state.craters.push(crater);state.craters=state.craters.slice(-6);state.history.push(active.id);state.history=state.history.slice(-24);
   if(Math.hypot(p.x-active.x,p.y-active.y)<active.radius&&!shelter)game.damagePlayer(50+(p.maxHp||100)*.5,'Meteor impact');
   spawnMeteorCreatures(game,crater);game.emit('meteor-impact',{x:active.x,y:active.y,radius:active.radius});
  }
  if(active.kind==='lightning'&&now>=active.dueAt){
   if(now>=active.nextStrikeAt&&active.strikes.length<10){
    const random=seeded(game.seed^Math.imul(active.sequence+1,7789)^active.strikes.length*7717),targeted=!shelter&&Math.hypot(p.x-active.x,p.y-active.y)<active.radius,a=random()*Math.PI*2;
    active.strikes.push({id:`${active.id}:${active.strikes.length}`,x:targeted?p.x:active.x+Math.cos(a)*80,y:targeted?p.y:active.y+Math.sin(a)*80,dueAt:now+2.35,resolved:false});active.nextStrikeAt=now+4.5;
   }
   for(const bolt of active.strikes)if(!bolt.resolved&&now>=bolt.dueAt){bolt.resolved=true;const wet=(game.worldFeatures||[]).some(f=>f.type==='water'&&Math.hypot(p.x-f.x,p.y-f.y)<f.radius);if(!shelter&&Math.hypot(p.x-bolt.x,p.y-bolt.y)<4+Math.min(2,game.effectiveSize*.2))game.damagePlayer((wet?48:26)*game.rules.enemyDamage,'Lightning strike');game.emit('lightning-strike',{x:bolt.x,y:bolt.y,radius:4});}
  }
  if(now>=active.endsAt)state.active=null;
 }
 if(now>=state.nextHeatAt&&!shelter&&state.craters.some(c=>Math.hypot(p.x-c.x,p.y-c.y)<c.radius*.76)){game.damagePlayer(7,'Molten impact ground');state.nextHeatAt=now+1;}
}
export function incidentStatus(game){
 const state=game.frontierState,a=state?.active,p=game.player,safe=shelterAt(p,game.effectiveSize||1,game.worldFeatures||[]);
 if(a){const warning=game.time<a.dueAt;return{kind:a.kind,label:a.kind==='meteor'?(warning?'METEOR INCOMING':'METEOR IMPACT'):a.kind==='lightning'?'LIGHTNING STORM':'GREAT MIGRATION',seconds:Math.ceil((warning?a.dueAt:a.endsAt)-game.time),safe:!!safe,detail:safe?'STONE SHELTER — PROTECTED':a.kind==='meteor'?'Leave the marked impact zone or shelter under stone.':a.kind==='lightning'?'Leave water. Dodge strike circles or get under a stone roof.':'Keep clear of the moving herd. Use the trail gaps.'};}
 const crater=state?.craters.find(c=>Math.hypot(p.x-c.x,p.y-c.y)<c.radius+40);return crater?{kind:'crater',label:'METEOR-BORN HUNT',seconds:Math.ceil(crater.expires-game.time),safe:!!safe,detail:'Hot ground and rare lava predators. Approach along the cool outer rim.'}:null;
}
export function validIncidents(s){
 const n=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12,point=o=>o&&Number.isFinite(o.x)&&Number.isFinite(o.y)&&Math.abs(o.x)<=WORLD_RADIUS+200&&Math.abs(o.y)<=WORLD_RADIUS+200;
 const id=v=>typeof v==='string'&&v.length>0&&v.length<80,integer=v=>n(v)&&Number.isInteger(v);
 return s==null||(typeof s==='object'&&!Array.isArray(s)&&s.version===1&&integer(s.sequence)&&n(s.nextAt)&&n(s.nextEncounterAt)&&integer(s.encounters)&&n(s.nextHeatAt)&&Array.isArray(s.history)&&s.history.length<=24&&s.history.every(id)&&Array.isArray(s.craters)&&s.craters.length<=6&&s.craters.every(c=>point(c)&&id(c.id)&&integer(c.sequence)&&n(c.radius)&&c.radius>0&&c.radius<=40&&n(c.at)&&n(c.expires)&&c.expires>=c.at)&&(s.active===null||(point(s.active)&&id(s.active.id)&&integer(s.active.sequence)&&n(s.active.radius)&&s.active.radius>0&&s.active.radius<=120&&['meteor','lightning','migration'].includes(s.active.kind)&&n(s.active.startedAt)&&n(s.active.dueAt)&&s.active.dueAt>=s.active.startedAt&&n(s.active.endsAt)&&s.active.endsAt>=s.active.dueAt&&n(s.active.nextStrikeAt)&&typeof s.active.processed==='boolean'&&Array.isArray(s.active.strikes)&&s.active.strikes.length<=10&&s.active.strikes.every(b=>point(b)&&id(b.id)&&n(b.dueAt)&&typeof b.resolved==='boolean'))));
}
