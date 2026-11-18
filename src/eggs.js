import {SPECIES} from './data.js';
export const EGG_RARITIES={common:{name:'Common',color:0xb6ac84,xp:1,power:1},rare:{name:'Rare',color:0x59b9ee,xp:5,power:1.5},epic:{name:'Epic',color:0xb47bef,xp:16,power:2.3},legendary:{name:'Legendary',color:0xffce59,xp:50,power:4}};
export function rollEggRarity(roll){return roll<.005?'legendary':roll<.035?'epic':roll<.16?'rare':'common';}
export function prepareEgg(food,random){
 const rarity=food.eggRarity||(Math.hypot(food.x,food.y)<65?'common':rollEggRarity(random()));food.eggRarity=Object.hasOwn(EGG_RARITIES,rarity)?rarity:'common';
 const rank=Object.keys(EGG_RARITIES).indexOf(food.eggRarity);
 if(rank>0&&!food.nestId&&!food.isPlayerEgg){
  const tier=Math.min(7,(food.tier||0)+rank),pool=SPECIES.filter(s=>s.tier===tier&&s.body!=='marine');
  if(pool.length)food.speciesId=pool[Math.floor(random()*pool.length)].id;
 }
 food.name=EGG_RARITIES[food.eggRarity].name+' egg';
 food.hatchAfter??=45+rank*15;
 return food;
}
