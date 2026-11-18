import {CATALOG} from './collection-data.js';
import {claimFindReceipt,ownedCount} from './collections.js';
import {awardAccountBonus} from './account-progression.js';
import {CRATE_TYPES,TREASURES,RARITY_ORDER,lootHash,lootRandom} from './loot-data.js';
export {CRATE_TYPES,TREASURES,RARITY_ORDER};
const int=(n,max=1e9)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=160;
export function normalizeLoot(raw={}){
 const ids=new Set(),crates=[];
 for(const c of (Array.isArray(raw?.crates)?raw.crates:[]).slice(0,2048)){
  if(!c||!validId(c.id)||ids.has(c.id)||!Object.hasOwn(CRATE_TYPES,c.type)||!Number.isInteger(c.seed)||c.seed<0||c.seed>4294967295)continue;
  ids.add(c.id);crates.push({id:c.id,type:c.type,seed:c.seed});
 }
 const history=(Array.isArray(raw?.history)?raw.history:[]).filter(r=>r&&validId(r.id)&&Object.hasOwn(CRATE_TYPES,r.type)&&Object.hasOwn(CATALOG,r.sku)&&RARITY_ORDER.includes(r.rarity)&&CATALOG[r.sku].rarity===r.rarity).slice(-80).map(r=>({id:r.id,type:r.type,sku:r.sku,rarity:r.rarity,dna:int(r.dna,200),xp:int(r.xp,500),duplicate:!!r.duplicate,duplicateDNA:int(r.duplicateDNA,100),pity:!!r.pity}));
 const openedIds=[...new Set((Array.isArray(raw?.openedIds)?raw.openedIds:history.map(r=>r.id)).filter(validId))].slice(-65536);
 return {version:1,crates:crates.filter(c=>!openedIds.includes(c.id)),history,openedIds,opened:int(raw?.opened),sinceEpic:int(raw?.sinceEpic,9),sinceLegendary:int(raw?.sinceLegendary,39),finds:int(raw?.finds)};
}
export function mergeLootProgress(a,b){
 a=normalizeLoot(a);b=normalizeLoot(b);const latest=a.opened>=b.opened?a:b,openedIds=[...new Set([...a.openedIds,...b.openedIds])],opened=new Set(openedIds),crates=new Map([...a.crates,...b.crates].map(c=>[c.id,c]));
 return normalizeLoot({...latest,openedIds,crates:[...crates.values()].filter(c=>!opened.has(c.id)),history:[...new Map([...a.history,...b.history].map(r=>[r.id,r])).values()],opened:Math.max(a.opened,b.opened),finds:Math.max(a.finds,b.finds)});
}
export function grantCrate(profile,type,receipt){
 if(!Object.hasOwn(CRATE_TYPES,type)||!claimFindReceipt(profile,receipt))return {ok:false,reason:'This crate was already recovered.'};
 profile.loot ||= normalizeLoot();
 if(profile.loot.crates.length>=2048){profile.dna+=25;return{ok:true,converted:true,dna:25};}
 const crate={id:`crate:${lootHash(receipt).toString(36)}:${lootHash(receipt+':seal').toString(36)}`,type,seed:lootHash(receipt+':contents')};
 profile.loot.crates.push(crate);return {ok:true,crate};
}
export function grantTreasure(profile,findId,receipt){
 if(!Object.hasOwn(TREASURES,findId)||!claimFindReceipt(profile,receipt))return {ok:false};
 const find=TREASURES[findId],random=lootRandom(lootHash(receipt)),dna=find.dna[0]+Math.floor(random()*(find.dna[1]-find.dna[0]+1));
 profile.loot ||= normalizeLoot();profile.loot.finds++;profile.dna+=dna;profile.dnaFinds++;
 const account=awardAccountBonus(profile,receipt,find.xp);return{ok:true,find,dna,xp:find.xp,account};
}
export function crateRewardPool(type){const c=CRATE_TYPES[type];return c?Object.values(CATALOG).filter(i=>['skin','pet','cosmetic'].includes(i.kind)&&c.odds[i.rarity]>0):[];}
export function openCrate(profile,id){
 const state=profile.loot,index=state?.crates.findIndex(c=>c.id===id)??-1;
 if(index<0)return{ok:false,reason:'This crate has already been opened.'};
 const crate=state.crates[index],type=CRATE_TYPES[crate.type],random=lootRandom(crate.seed);
 let roll=random()*100,rarity='legendary',pity=false;
 for(const rank of RARITY_ORDER){roll-=type.odds[rank];if(roll<0){rarity=rank;break;}}
 if(state.sinceLegendary>=39&&rarity!=='legendary'){rarity='legendary';pity=true;}
 else if(state.sinceEpic>=9&&RARITY_ORDER.indexOf(rarity)<3){rarity='epic';pity=true;}
 const pool=crateRewardPool(crate.type).filter(i=>i.rarity===rarity),unowned=pool.filter(i=>!ownedCount(profile,i.sku)),choices=unowned.length?unowned:pool;
 const kindWeights={skin:80,pet:12,cosmetic:8},counts=Object.fromEntries(Object.keys(kindWeights).map(kind=>[kind,choices.filter(i=>i.kind===kind).length]));
 const weight=i=>kindWeights[i.kind]/counts[i.kind];let pick=random()*choices.reduce((sum,i)=>sum+weight(i),0),item=choices.at(-1);
 for(const candidate of choices){pick-=weight(candidate);if(pick<0){item=candidate;break;}}
 if(!item)return {ok:false,reason:'No reward is available for this crate.'};
 const duplicate=!!ownedCount(profile,item.sku),duplicateDNA=duplicate?{common:3,uncommon:5,rare:8,epic:12,legendary:25}[rarity]:0;
 if(!duplicate)profile[{skin:'skins',pet:'pets',cosmetic:'cosmetics'}[item.kind]].push(item.id);
 const reward={id:crate.id,type:crate.type,sku:item.sku,rarity,dna:type.dna+duplicateDNA,xp:type.xp,duplicate,duplicateDNA,pity};
 state.crates.splice(index,1);state.openedIds.push(crate.id);state.openedIds=state.openedIds.slice(-65536);state.opened++;state.sinceEpic=RARITY_ORDER.indexOf(rarity)>=3?0:state.sinceEpic+1;state.sinceLegendary=rarity==='legendary'?0:state.sinceLegendary+1;
 state.history.push(reward);state.history=state.history.slice(-80);profile.dna+=reward.dna;
 const account=awardAccountBonus(profile,crate.id,reward.xp);return {ok:true,reward,account};
}
