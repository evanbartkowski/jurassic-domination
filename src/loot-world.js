import {WORLD_RADIUS,CHUNK_SIZE,chunkKey,biomeAt} from './world-data.js';
import {LANDMARKS} from './discoveries.js';
import {blockedFrontierPoint} from './frontier-map.js';
import {worldFeatures} from './wilderness.js';
import {lootHash,lootRandom,crateForRegion,treasureForRegion,CRATE_TYPES,TREASURES} from './loot-data.js';
// A separate random stream preserves the existing ecology and combat rolls.
export function spawnMapLoot(game,key){
 const [cx,cy]=key.split(',').map(Number),random=lootRandom(lootHash(`${game.seed}:treasure:${key}`)),features=worldFeatures(game.seed,cx,cy);
 const valid=p=>Math.hypot(p.x,p.y)<WORLD_RADIUS-40&&!blockedFrontierPoint(game.seed,p.x,p.y,3)&&!features.some(f=>f.type==='water'&&Math.hypot(f.x-p.x,f.y-p.y)<(f.radius||10)+4);
 const point=()=>{for(let i=0;i<16;i++){const p={x:(cx+random())*CHUNK_SIZE,y:(cy+random())*CHUNK_SIZE};if(valid(p))return p;}return null;};
 const spawn=(type,p,options)=>game.spawnFood(type,p.x,p.y,0,{homeChunk:key,tier:biomeAt(p.x,p.y).tier,...options});
 if(random()<.055){const p=point();if(p){const crateType=crateForRegion(biomeAt(p.x,p.y).tier,random);spawn('supply-crate',p,{crateType,rarity:CRATE_TYPES[crateType].rarity});}}
 if(random()<.12){const p=point();if(p){const findId=treasureForRegion(biomeAt(p.x,p.y).tier,random);spawn('treasure',p,{findId,rarity:TREASURES[findId].rarity});}}
 for(const site of LANDMARKS){
  const p={x:site.x+9,y:site.y+6};
  if(chunkKey(p.x,p.y)!==key||(site.kind!=='ruin'&&site.id!=='first-nest')||!valid(p))continue;
  const crateType=site.id==='first-nest'?'field':site.tier>=6?'primeval':site.tier>=3?'elder':'hunter';
  spawn('supply-crate',p,{crateType,rarity:CRATE_TYPES[crateType].rarity,lootSite:site.id});
 }
}
export function dropHuntLoot(game,enemy,tier){
 const random=lootRandom(lootHash(`${game.seed}:hunt-loot:${enemy.id}`)),homeChunk=enemy.homeChunk||chunkKey(enemy.x,enemy.y);
 const boss=!!enemy.boss||!!enemy.lairId,alpha=!!enemy.isAlpha||!!enemy.isRegionalAlpha;
 if(boss||random()<(alpha?.45:.008)){
  const crateType=boss?(random()<.12?'primeval':'elder'):alpha?(random()<.2?'elder':'hunter'):crateForRegion(tier,random);
  game.spawnFood('supply-crate',enemy.x+2,enemy.y-2,0,{tier,homeChunk,crateType,rarity:CRATE_TYPES[crateType].rarity});
 }
 if((boss||alpha)&&random()<.65){const findId=treasureForRegion(Math.max(3,tier),random);game.spawnFood('treasure',enemy.x-2,enemy.y+2,0,{tier,homeChunk,findId,rarity:TREASURES[findId].rarity});}
}
