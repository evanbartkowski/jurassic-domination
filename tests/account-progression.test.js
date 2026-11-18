import test from 'node:test';
import assert from 'node:assert/strict';
import {newProfile,normalizeProfile} from '../src/profile.js';
import {Game} from '../src/game.js';
import {SaveStore} from '../src/state-store.js';
import {accountStatus,xpForLevel,syncAccountProgress,syncSanctuaryProgress,featureAccess,islandProgress,claimLevelRewards} from '../src/account-progression.js';
import {purchaseItem,placeIslandItem} from '../src/collections.js';
import {CATALOG} from '../src/collection-data.js';
import {SPECIES} from '../src/data.js';

test('account XP banks activity and quests once, survives death and cannot replay checkpoint rewards',()=>{
 const p=newProfile(),g=new Game({seed:111,runId:'account-test'});g.hatch();
 g.time=120;g.quests.meals=8;g.quests.plants=5;g.quests.kills=3;g.quests.repeat.forage.cycle=1;g.quests.chapter=1;
 const gained=syncAccountProgress(p,g);assert.ok(gained.earned>0);assert.ok(accountStatus(p).level>=2);assert.ok(p.dna>0);
 const xp=p.account.xp,dna=p.dna;assert.equal(syncAccountProgress(p,g).earned,0);assert.equal(p.dna,dna);
 const reloaded=normalizeProfile(JSON.parse(JSON.stringify(p)));g.state='dead';
 assert.equal(syncAccountProgress(reloaded,g).earned,0);assert.equal(reloaded.account.xp,xp);
 g.quests.repeat.forage.cycle++;assert.ok(syncAccountProgress(reloaded,g).earned>0);
 const next=new Game({seed:112,runId:'next-account-life'});next.hatch();next.time=60;
 assert.ok(syncAccountProgress(reloaded,next).earned>0);
});
test('choosing a stronger hatchling does not farm evolution account XP',()=>{
 const p=newProfile(),g=new Game({seed:115,starterId:'stygimoloch',starterChoices:['stygimoloch']});g.hatch('stygimoloch');
 assert.equal(syncAccountProgress(p,g).earned,0);
 g.player.speciesId=SPECIES.find(s=>s.tier===2).id;g.tier=2;g.formHistory.push(g.player.speciesId);
 assert.equal(syncAccountProgress(p,g).earned,50);
 assert.equal(syncAccountProgress(p,g).earned,0);
});
test('shop and island gates enforce account levels and island capacities grow with rewards',()=>{
 const p=newProfile();p.dna=999;p.pets=['compy'];
 assert.equal(featureAccess(p,'shop').unlocked,false);assert.equal(purchaseItem(p,'pet:pebble').ok,false);
 assert.equal(placeIslandItem(p,'pet','compy',0,0).ok,false);
 p.account.xp=xpForLevel(2);assert.ok(featureAccess(p,'shop').unlocked);assert.ok(purchaseItem(p,'pet:pebble').ok);
 const balance=p.dna;assert.equal(purchaseItem(p,'pet:rex').ok,false);assert.equal(p.dna,balance);
 assert.equal(featureAccess(p,'island').unlocked,false);
 p.account.xp=xpForLevel(3);claimLevelRewards(p);
 assert.ok(placeIslandItem(p,'pet','compy',0,0).ok);
 const starter=islandProgress(p);p.account.xp=xpForLevel(15);claimLevelRewards(p);const reserve=islandProgress(p);
 assert.ok(reserve.pets>starter.pets);assert.ok(reserve.decorations>starter.decorations);assert.ok(reserve.radius>starter.radius);
 assert.ok(p.pets.includes('rex'));assert.ok(p.decorations.pond>0);
 const before=JSON.stringify(p);claimLevelRewards(p);assert.equal(JSON.stringify(p),before);
});
test('habitat slots and actual build area open at the next island milestone',()=>{
 const p=newProfile();p.account.xp=xpForLevel(3);claimLevelRewards(p);p.pets=['compy','pebble','feather','sprout'];
 assert.ok(placeIslandItem(p,'pet','compy',-5,0).ok);assert.ok(placeIslandItem(p,'pet','pebble',0,0).ok);assert.ok(placeIslandItem(p,'pet','feather',5,0).ok);
 assert.equal(placeIslandItem(p,'pet','sprout',8,0).ok,false);
 assert.equal(placeIslandItem(p,'decoration','fern',20,0).ok,false);
 p.account.xp=xpForLevel(6);claimLevelRewards(p);
 assert.ok(placeIslandItem(p,'pet','sprout',8,0).ok);
 assert.ok(placeIslandItem(p,'decoration','fern',20,0).ok);
});
test('island care and trials earn account XP but idle island time earns none',()=>{
 const p=newProfile();p.island.visitSeconds=9999;assert.equal(syncSanctuaryProgress(p).earned,0);
 p.island.care.compy=1;assert.equal(syncSanctuaryProgress(p).earned,3);assert.equal(syncSanctuaryProgress(p).earned,0);
 p.island.trials.push('haven');assert.equal(syncSanctuaryProgress(p).earned,60);
 const peer=normalizeProfile(p);assert.equal(syncSanctuaryProgress(peer).earned,0);
});
test('legacy collections retain access and builds without awarding the same migration twice',()=>{
 const raw={version:4,runs:4,totalKills:20,highestTier:2,pets:['compy'],skins:['natural','jade'],island:{placements:[{id:'i1',kind:'pet',itemId:'compy',x:0,y:0,rotation:0}],nextId:2}};
 const p=normalizeProfile(raw);assert.ok(featureAccess(p,'island').unlocked);assert.equal(p.island.placements.length,1);
 const again=normalizeProfile(p);assert.deepEqual(again,p);
});
test('account level math is bounded and backup imports retain earned XP and replay protection',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 const store=new SaveStore(storage),p=store.load().profile;
 assert.equal(accountStatus({account:{xp:NaN}}).level,1);
 assert.equal(accountStatus({account:{xp:Infinity}}).level,1);
 store.commit({profile:p,settings:{},run:null});const old=store.exportBackup();
 const g=new Game({seed:113,runId:'protected-account'});g.hatch();g.time=600;g.quests.chapter=3;
 syncAccountProgress(p,g);const xp=p.account.xp;store.commit({profile:p,settings:{},run:null});
 assert.ok(store.importBackup(old).ok);const imported=store.load().profile;
 assert.equal(imported.account.xp,xp);assert.equal(syncAccountProgress(imported,g).earned,0);
 for(const gift of accountStatus(imported).milestones.flatMap(m=>m.items||[]))assert.ok(CATALOG[gift]);
});
