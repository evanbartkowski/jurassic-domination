import test from 'node:test';
import assert from 'node:assert/strict';
import {newProfile,normalizeProfile} from '../src/profile.js';
import {SKINS} from '../src/content.js';
import {CATALOG} from '../src/collection-data.js';
import {Game} from '../src/game.js';
import {snapshotGame,restoreGame} from '../src/run-state.js';
import {spawnMapLoot,dropHuntLoot} from '../src/loot-world.js';
const loot=await import('../src/loot.js').catch(()=>({}));
test('loot catalogue has four crate tiers and a broad, patterned skin collection',()=>{
 assert.equal(typeof loot.openCrate,'function');
 assert.equal(Object.keys(loot.CRATE_TYPES).length,4);
 assert.ok(SKINS.length>=40);
 for(const rarity of ['common','uncommon','rare','epic','legendary'])assert.ok(SKINS.filter(s=>s.rarity===rarity&&s.pattern).length>=6,rarity);
 assert.equal(new Set(SKINS.map(s=>s.id)).size,SKINS.length);
 for(const c of Object.values(loot.CRATE_TYPES))assert.equal(Object.values(c.odds).reduce((a,b)=>a+b,0),100);
});
test('collected crates survive reload, cannot be claimed twice, and commit exactly one opening',()=>{
 assert.equal(typeof loot.grantCrate,'function');
 let p=newProfile();assert.ok(loot.grantCrate(p,'hunter','loot:run1:7').ok);
 const id=p.loot.crates[0].id;p=normalizeProfile(JSON.parse(JSON.stringify(p)));
 assert.equal(loot.grantCrate(p,'hunter','loot:run1:7').ok,false);
 const first=loot.openCrate(p,id);assert.ok(first.ok);assert.ok(CATALOG[first.reward.sku]);assert.ok(first.reward.dna>0);assert.ok(first.reward.xp>0);
 assert.equal(p.loot.crates.length,0);assert.equal(p.loot.history.length,1);
 p=normalizeProfile(JSON.parse(JSON.stringify(p)));
 assert.equal(loot.openCrate(p,id).ok,false);assert.equal(p.loot.opened,1);
});
test('crate floors, duplicate protection and guaranteed rarity milestones hold',()=>{
 assert.equal(typeof loot.openCrate,'function');const p=newProfile();
 for(let i=0;i<160;i++){
  const type=['field','hunter','elder','primeval'][i%4];loot.grantCrate(p,type,'sim:'+i);
  const result=loot.openCrate(p,p.loot.crates[0].id),reward=result.reward;
  assert.ok(result.ok);assert.ok(loot.RARITY_ORDER.indexOf(reward.rarity)>=loot.RARITY_ORDER.indexOf(loot.CRATE_TYPES[type].floor));
  assert.ok(p.loot.sinceEpic<10);assert.ok(p.loot.sinceLegendary<40);
 }
 const full=newProfile();full.skins=SKINS.map(s=>s.id);full.pets=Object.values(CATALOG).filter(i=>i.kind==='pet').map(i=>i.id);full.cosmetics=Object.values(CATALOG).filter(i=>i.kind==='cosmetic').map(i=>i.id);
 loot.grantCrate(full,'primeval','full');const result=loot.openCrate(full,full.loot.crates[0].id);assert.ok(result.reward.duplicate);assert.ok(result.reward.duplicateDNA>=12);
});
test('treasure finds bank meaningful DNA and account XP exactly once',()=>{
 assert.equal(typeof loot.grantTreasure,'function');const p=newProfile();
 const result=loot.grantTreasure(p,'prismatic-core','treasure:1');assert.ok(result.ok);assert.ok(p.dna>=18);assert.ok(p.account.xp>=100);
 const balance=p.dna,xp=p.account.xp;assert.equal(loot.grantTreasure(p,'prismatic-core','treasure:1').ok,false);assert.equal(p.dna,balance);assert.equal(p.account.xp,xp);
 assert.equal(loot.grantCrate(p,'__proto__','bad').ok,false);
 const restored=normalizeProfile({...p,loot:{crates:[{id:'fake',type:'__proto__',seed:0}],opened:NaN,sinceEpic:999,history:[{sku:'skin:fake'}]}});
 assert.equal(restored.loot.crates.length,0);assert.equal(restored.loot.history.length,0);
});
test('world crates stream deterministically, survive checkpoints, and use the real interact path',()=>{
 const a=new Game({seed:431}),b=new Game({seed:431});a.hatch();b.hatch();
 const list=g=>g.foods.filter(f=>['supply-crate','treasure'].includes(f.type)).map(f=>[f.type,f.x,f.y,f.crateType,f.findId]);
 assert.deepEqual(list(a),list(b));assert.ok(a.foods.some(f=>f.type==='supply-crate'));
 a.foods=[];const food=a.spawnFood('supply-crate',a.player.x,a.player.y,0,{crateType:'elder',rarity:'epic',homeChunk:'0,0'});
 const restored=restoreGame(snapshotGame(a));assert.equal(restored.foods[0].crateType,'elder');assert.ok(restored.eat());
 const event=restored.consumeEvents().find(e=>e.type==='crate-find');assert.equal(event.crateType,'elder');assert.match(event.receipt,new RegExp('^loot:'+a.runId+':'));assert.equal(restored.foods.length,0);
 a.foods=[];dropHuntLoot(a,{id:902,x:2,y:4,boss:true,homeChunk:'0,0'},4);assert.ok(a.foods.some(f=>f.type==='supply-crate'&&['elder','primeval'].includes(f.crateType)));
});
test('restoring an older collection cannot reseal a crate already opened on this device',()=>{
 const p=newProfile();loot.grantCrate(p,'primeval','restore-proof');const earlier=structuredClone(p.loot),id=p.loot.crates[0].id;
 loot.openCrate(p,id);p.loot=loot.mergeLootProgress(earlier,p.loot);assert.equal(p.loot.crates.length,0);assert.equal(loot.openCrate(p,id).ok,false);
 loot.grantCrate(p,'hunter','still-sealed');const merged=loot.mergeLootProgress(earlier,p.loot);assert.equal(merged.crates.length,1);assert.equal(merged.crates[0].type,'hunter');
});
