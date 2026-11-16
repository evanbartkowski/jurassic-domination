import {SPECIES,SPECIES_BY_ID} from './data.js';
import {LOCATIONS,blockedFrontierPoint,routeWaypoint} from './frontier-map.js';
import {chunkKey,seeded,biomeAt,WORLD_RADIUS} from './world-data.js';
export function encounterTier(regional,roll){return roll<.16?Math.max(0,Math.floor(regional*.35)):roll>.94?Math.min(7,regional+3):regional;}
function clearPoint(game,x,y,padding=3){for(let i=0;i<16;i++){const a=i*2.4,r=i*2,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;if(Math.hypot(px,py)<WORLD_RADIUS-15&&!blockedFrontierPoint(game.seed,px,py,padding))return{x:px,y:py};}return null;}
export function spawnMeteorCreatures(game,crater){
 const random=seeded(game.seed^Math.imul(crater.sequence+11,678983)),ids=['cinderfang-carnotaurus','cinderfang-carnotaurus','ashborn-tyrannosaurus'],created=[];
 for(let i=0;i<3&&game.entities.length<280;i++){const a=i*Math.PI*2/3+random(),p=clearPoint(game,crater.x+Math.cos(a)*(crater.radius+6),crater.y+Math.sin(a)*(crater.radius+6));if(!p)continue;const e=game.spawnEntity(ids[i],p.x,p.y,{homeChunk:chunkKey(p.x,p.y),passive:false,sleeping:false,injured:false,behavior:'hunter',name:i===2?'Meteor-born Ash Tyrant':'Meteor-born Cinderfang'});Object.assign(e,{lavaBorn:true,wanderer:true,rarity:i===2?'legendary':'epic',skillCooldown:3+i,meteorId:crater.id});created.push(e);}
 return created;
}
export function spawnMigration(game,random=seeded(game.seed^Math.floor(game.time/60)^0x7191)){
 const s=SPECIES_BY_ID[random()<.5?'iguanodon':'gallimimus'],a=random()*Math.PI*2,start={x:game.player.x+Math.cos(a)*58,y:game.player.y+Math.sin(a)*58},goal={x:game.player.x-Math.cos(a)*130,y:game.player.y-Math.sin(a)*130},packId=`migration:${Math.floor(game.time)}:${game._nextId}`,out=[];
 for(let i=0;i<18&&game.entities.length<280;i++){const lateral=(i%5-2)*4.2,back=Math.floor(i/5)*4.5,p=clearPoint(game,start.x-Math.cos(a)*back-Math.sin(a)*lateral,start.y-Math.sin(a)*back+Math.cos(a)*lateral,2);if(!p||Math.hypot(p.x,p.y)>WORLD_RADIUS-15)continue;const e=game.spawnEntity(s.id,p.x,p.y,{homeChunk:chunkKey(p.x,p.y),passive:true,sleeping:false,injured:false,packId,groupRole:i?'follower':'leader'});e.migration={x:goal.x,y:goal.y,until:game.time+100};out.push(e);}
 game.emit('migration',{x:start.x,y:start.y,count:out.length,text:'The ground trembles. A great herd is crossing the trail.'});return out;
}
export function spawnWanderer(game,sequence){
 if(game.entities.length>=240||Math.hypot(game.player.x,game.player.y)<65)return null;
 const random=seeded(game.seed^Math.imul(sequence+13,871931)),tier=game.tier<3?Math.min(5,game.tier+2+Math.floor(random()*2)):Math.floor(random()*Math.min(4,game.tier));
 const candidates=SPECIES.filter(s=>s.tier===tier&&!s.bloodline&&s.body!=='marine'),s=candidates[Math.floor(random()*candidates.length)];if(!s)return null;
 const a=random()*Math.PI*2,p=clearPoint(game,game.player.x+Math.cos(a)*48,game.player.y+Math.sin(a)*48);if(!p||Math.hypot(p.x,p.y)<60||Math.hypot(p.x,p.y)>WORLD_RADIUS-20)return null;
 const e=game.spawnEntity(s.id,p.x,p.y,{homeChunk:chunkKey(p.x,p.y),passive:s.diet==='herbivore',sleeping:false,roaming:true});e.wanderer=true;return e;
}
export function populateFrontierSite(game,key){
 for(const site of LOCATIONS.filter(s=>chunkKey(s.x,s.y)===key&&s.kind!=='lagoon')){const random=seeded(game.seed^site.x*17^site.y*31),count=site.kind==='emerald'?12:site.kind==='mountain'?6:4;
  for(let i=0;i<count&&game.entities.length<280;i++){const id=site.residents[i%site.residents.length],a=i*2.4,p=clearPoint(game,site.x+Math.cos(a)*(12+i*2),site.y+Math.sin(a)*(12+i*2),4);if(!p)continue;const e=game.spawnEntity(id,p.x,p.y,{homeChunk:key,passive:site.kind==='emerald',sleeping:false,injured:false,packId:site.kind==='emerald'?site.id:null});if(e)e.nativeSite=site.id;}
 }
}
