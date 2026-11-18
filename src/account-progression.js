import {CATALOG} from './collection-data.js';
import {SPECIES_BY_ID} from './data.js';

export const MAX_ACCOUNT_LEVEL=50;
export const FEATURE_LEVELS={shop:2,island:3};
export const ACCOUNT_MILESTONES=[
  {level:2,title:'The Ancestral Exchange',description:'DNA Shop opens. Spend earned DNA on permanent collectibles.',items:['skin:albino']},
  {level:3,title:'A Home Between Lives',description:'Dinosaur Island opens: a meadow for 3 pets and 12 decorations.',items:['pet:compy','decoration:fern','decoration:nest']},
  {level:4,title:'A Wilder Collection',description:'Uncommon shop stock opens. An amber lantern lights your new home.',items:['decoration:lantern']},
  {level:5,title:'Rare Encounters',description:'Rare shop stock opens. A wreath marks your growing bloodline.',items:['cosmetic:leaf-wreath']},
  {level:6,title:'Waterside Refuge',description:'Expand to 6 pets, 24 decorations and a wider building area.',items:['decoration:pond']},
  {level:8,title:'A Familiar Face',description:'Crest joins your permanent companion collection.',items:['pet:crest']},
  {level:10,title:'The Living Haven',description:'Epic shop stock opens. Expand to 10 pets and 48 decorations.',items:['decoration:pavilion']},
  {level:12,title:'Northern Lights',description:'An Aurora appearance joins your wardrobe.',items:['skin:aurora']},
  {level:15,title:'The Great Reserve',description:'Legendary stock opens. Your island can host 16 pets and 80 decorations.',items:['pet:rex']},
  {level:20,title:'Written in the Stars',description:'A cosmic appearance for a well-travelled bloodline.',items:['skin:cosmic']},
  {level:25,title:'Firekeeper',description:'Bring a miniature volcano home to your island.',items:['decoration:volcano']},
  {level:30,title:'A Second Sunrise',description:'Solstice the Phoenix joins your collection.',items:['pet:phoenix']},
  {level:40,title:'The Golden Age',description:'A solar appearance honors your enduring ancestry.',items:['skin:solar']},
  {level:50,title:'A Legacy Without End',description:'The Solar Halo crowns your completed account journey.',items:['cosmetic:solar-halo']},
];
export const ISLAND_STAGES=[
  {level:3,name:'Hatchling Meadow',radius:16,pets:3,decorations:12},
  {level:6,name:'Waterside Refuge',radius:23,pets:6,decorations:24},
  {level:10,name:'Living Haven',radius:28,pets:10,decorations:48},
  {level:15,name:'Great Reserve',radius:32,pets:16,decorations:80},
];
const integer=(n,max=1e9)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
export const levelCost=level=>120+35*(level-1)+5*(level-1)**2;
export function xpForLevel(level){let total=0;for(let i=1;i<Math.min(MAX_ACCOUNT_LEVEL,Math.max(1,integer(level)));i++)total+=levelCost(i);return total;}
const MAX_XP=xpForLevel(MAX_ACCOUNT_LEVEL);
export function newAccount(){return {version:1,xp:0,rewardedLevel:1,earnedByRun:{}};}
export function accountStatus(profile){
  const xp=integer(profile?.account?.xp,MAX_XP);let level=1;
  while(level<MAX_ACCOUNT_LEVEL&&xp>=xpForLevel(level+1))level++;
  const floor=xpForLevel(level),needed=level===MAX_ACCOUNT_LEVEL?0:levelCost(level);
  return {level,xp,current:xp-floor,needed,ratio:needed?(xp-floor)/needed:1,
    next:ACCOUNT_MILESTONES.find(m=>m.level>level)||null,milestones:ACCOUNT_MILESTONES};
}
export function normalizeAccount(raw,legacy={}){
  const result=newAccount();
  if(raw&&typeof raw==='object'){
    result.xp=integer(raw.xp,MAX_XP);
    result.rewardedLevel=Math.max(1,Math.min(integer(raw.rewardedLevel),accountStatus({account:result}).level));
    result.earnedByRun=Object.fromEntries(Object.entries(raw.earnedByRun||{}).filter(([id,value])=>/^[a-zA-Z0-9:_-]{1,160}$/.test(id)&&Number.isFinite(value)&&value>=0).slice(-8192).map(([id,value])=>[id,integer(value)]));
  }else{
    // Convert established history once; new saves retain an explicit zero-XP account.
    const recorded=integer(legacy.runs)>0||integer(legacy.totalKills)>0||integer(legacy.ancestry?.totalSurvival)>0;
    result.xp=recorded?integer(integer(legacy.runs)*20+integer(legacy.totalKills)*12+Math.floor(integer(legacy.ancestry?.totalSurvival)/30)*6+integer(legacy.highestTier,7)*50,MAX_XP):0;
    const hasIsland=(legacy.island?.placements?.length||0)>0||(legacy.pets?.length||0)>0;
    const hasShop=(legacy.skins?.length||0)>1||Object.keys(legacy.decorations||{}).length>0;
    result.xp=Math.max(result.xp,xpForLevel(hasIsland?3:hasShop?2:1));
  }
  return result;
}
export function featureAccess(profile,id){
  const required=FEATURE_LEVELS[id]||1,level=accountStatus(profile).level;
  return {unlocked:level>=required,required,level};
}
export function requiredItemLevel(item){return Math.max(FEATURE_LEVELS.shop,({common:2,uncommon:4,rare:5,epic:10,legendary:15}[item?.rarity]||2));}
export function islandProgress(profile){
  const level=accountStatus(profile).level,stage=[...ISLAND_STAGES].reverse().find(s=>level>=s.level)||{level:3,name:'Island locked',radius:0,pets:0,decorations:0},
    next=ISLAND_STAGES.find(s=>s.level>level)||null;
  // Existing builds survive migrations and backup imports intact.
  const placed=profile?.island?.placements||[],radius=Math.max(stage.radius,...placed.map(p=>Math.hypot(p.x,p.y)+(CATALOG[`${p.kind}:${p.itemId}`]?.footprint||1)+.1));
  return {...stage,radius:Math.min(32,radius),next,unlocked:level>=3,
    pets:Math.max(stage.pets,placed.filter(p=>p.kind==='pet').length),decorations:Math.max(stage.decorations,placed.filter(p=>p.kind==='decoration').length)};
}
function giveGift(profile,sku){
  const item=CATALOG[sku];if(!item)return;
  const field={skin:'skins',cosmetic:'cosmetics',pet:'pets'}[item.kind];
  if(field){profile[field]||=[];if(!profile[field].includes(item.id))profile[field].push(item.id);}
  else {profile.decorations||={};profile.decorations[item.id]=Math.min(99,(profile.decorations[item.id]||0)+1);}
}
export function claimLevelRewards(profile){
  profile.account ||= newAccount();const level=accountStatus(profile).level,rewards=[];
  for(let rank=profile.account.rewardedLevel+1;rank<=level;rank++){
    const dna=3+Math.floor(rank/5),milestone=ACCOUNT_MILESTONES.find(m=>m.level===rank);
    profile.dna=Math.min(1e9,(profile.dna||0)+dna);
    for(const sku of milestone?.items||[])giveGift(profile,sku);
    rewards.push({level:rank,dna,items:milestone?.items||[],title:milestone?.title||`Account level ${rank}`});
  }
  profile.account.rewardedLevel=level;return rewards;
}
export function runAccountScore(game){
  if(!game||game.state==='egg')return 0;
  const q=game.quests||{},highestTier=Math.max(game.tier||0,...(game.formHistory||[]).map(id=>SPECIES_BY_ID[id]?.tier||0)),
    startingTier=SPECIES_BY_ID[game.formHistory?.[0]]?.tier||0;
  return integer(Math.floor((game.time||0)/30)*6+Math.floor((game.exploration?.travel||0)/100)*5+
    integer(q.meals)*3+integer(q.kills??game.player?.kills)*12+(game.exploration?.discoveries?.length||0)*40+
    Math.max(0,highestTier-startingTier)*50+integer(q.chapter)*60+Object.values(q.repeat||{}).reduce((sum,r)=>sum+integer(r.cycle)*30,0)+
    integer(game.guardianKills)*60+(q.ending?100:0));
}
export function syncAccountProgress(profile,game){
  return bankScore(profile,game?.runId,runAccountScore(game));
}
export function syncSanctuaryProgress(profile){
  const care=Object.values(profile.island?.care||{}).reduce((sum,n)=>sum+integer(n,100),0);
  return bankScore(profile,'sanctuary-care',care*3+(profile.island?.trials?.length||0)*60);
}
export function awardAccountBonus(profile,receipt,xp){
 if(typeof receipt!=='string'||!receipt||receipt.length>160||!Number.isInteger(xp)||xp<1||xp>500)return {earned:0,rewards:[]};
 return bankScore(profile,'loot:'+receipt,xp);
}
function bankScore(profile,id,score){
  profile.account ||= newAccount();
  const fromLevel=accountStatus(profile).level;
  if(!id||!score)return {earned:0,fromLevel,toLevel:fromLevel,rewards:[],dna:0};
  const prior=Object.hasOwn(profile.account.earnedByRun,id)?profile.account.earnedByRun[id]:0;
  if(score<=prior)return {earned:0,fromLevel,toLevel:fromLevel,rewards:[],dna:0};
  Object.defineProperty(profile.account.earnedByRun,id,{value:score,enumerable:true,writable:true,configurable:true});
  const entries=Object.entries(profile.account.earnedByRun);if(entries.length>8192)profile.account.earnedByRun=Object.fromEntries(entries.slice(-8192));
  const earned=Math.min(MAX_XP-profile.account.xp,score-prior);profile.account.xp+=earned;
  const rewards=claimLevelRewards(profile);
  return {earned,fromLevel,toLevel:accountStatus(profile).level,rewards,dna:rewards.reduce((sum,r)=>sum+r.dna,0)};
}
export function mergeAccountProgress(a,b){
  a=normalizeAccount(a);b=normalizeAccount(b);
  const earnedByRun={...a.earnedByRun};
  for(const [id,score] of Object.entries(b.earnedByRun))Object.defineProperty(earnedByRun,id,{value:Math.max(Object.hasOwn(earnedByRun,id)?earnedByRun[id]:0,score),enumerable:true,writable:true,configurable:true});
  return {version:1,xp:Math.max(a.xp,b.xp),rewardedLevel:Math.max(a.rewardedLevel,b.rewardedLevel),earnedByRun:Object.fromEntries(Object.entries(earnedByRun).slice(-8192))};
}
