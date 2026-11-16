import test from 'node:test';import assert from 'node:assert/strict';import{Game}from'../src/game.js';import{snapshotGame,restoreGame}from'../src/run-state.js';
const api=await import('../src/world-incidents.js').catch(()=>({}));
const game=()=>{const g=new Game({seed:719});g.hatch();g.entities=[];g.foods=[];g.worldFeatures=[];g.player.x=95;g.player.y=15;g.player.invulnerable=0;g.time=120;return g;};
test('meteor warnings resolve once into a crater and rare molten predators',()=>{
 assert.equal(typeof api.beginIncident,'function');const g=game();api.beginIncident(g,'meteor');const impact=g.frontierState.active;assert.ok(impact.dueAt-g.time>=12);g.time=impact.dueAt+.01;api.updateIncidents(g,.01);assert.equal(g.frontierState.craters.length,1);assert.ok(g.entities.filter(e=>e.lavaBorn).length>=2);const n=g.entities.length;api.updateIncidents(g,.01);assert.equal(g.entities.length,n);
 const s=snapshotGame(g),loaded=restoreGame(s);assert.deepEqual(snapshotGame(loaded),s);api.updateIncidents(loaded,0);assert.equal(loaded.entities.length,n);
});
test('stone shelter prevents meteor blast damage while exposed creatures must escape',()=>{
 assert.equal(typeof api.beginIncident,'function');for(const shelter of [false,true]){const g=game();api.beginIncident(g,'meteor');const e=g.frontierState.active;g.player.x=e.x;g.player.y=e.y;const hp=g.player.hp;if(shelter)g.worldFeatures=[{id:'roof',type:'shelter',x:e.x,y:e.y,radius:6,capacity:2,tier:0,phase:0,solid:false}];g.time=e.dueAt+.01;api.updateIncidents(g,.01);assert.equal(g.player.hp<hp,!shelter);}
});
test('lightning locks a telegraphed location and shelter prevents targeted strikes',()=>{
 assert.equal(typeof api.beginIncident,'function');const g=game();api.beginIncident(g,'lightning');let e=g.frontierState.active;g.time=e.dueAt+.01;api.updateIncidents(g,.01);const bolt=e.strikes[0];assert.ok(bolt&&bolt.dueAt>g.time+1.8);const x=bolt.x;g.player.x+=18;g.time=bolt.dueAt+.01;const hp=g.player.hp;api.updateIncidents(g,.01);assert.equal(bolt.x,x);assert.equal(g.player.hp,hp);
 const safe=game();safe.worldFeatures=[{type:'shelter',x:95,y:15,radius:6,capacity:2}];api.beginIncident(safe,'lightning');safe.time=safe.frontierState.active.dueAt+.01;api.updateIncidents(safe,.01);assert.ok(safe.frontierState.active.strikes.every(b=>Math.hypot(b.x-safe.player.x,b.y-safe.player.y)>6));
});
test('the nursery is protected and encounters never spawn directly on the player',()=>{
 assert.equal(typeof api.updateIncidents,'function');const g=game();g.player.x=0;g.player.y=0;g.time=1000;api.updateIncidents(g,.1);assert.equal(g.frontierState.active,null);assert.equal(g.entities.length,0);
});
test('impacts and their creatures remain inside the circular continent near its edge',()=>{for(const angle of [0,.7,2,4,5]){const g=game();g.player.x=Math.cos(angle)*1590;g.player.y=Math.sin(angle)*1590;const a=api.beginIncident(g,'meteor');assert.ok(Math.hypot(a.x,a.y)<=1530.001);g.time=a.dueAt+.1;api.updateIncidents(g,.1);assert.ok(g.entities.filter(e=>e.lavaBorn).every(e=>Math.hypot(e.x,e.y)<1585));}});
test('invalid incident payloads are rejected and older saves can omit the new state',()=>{
 assert.equal(api.validIncidents(undefined),true);for(const bad of [false,0,[],{}, {version:1}])assert.equal(api.validIncidents(bad),false);const g=game();api.beginIncident(g,'meteor');assert.equal(api.validIncidents(g.frontierState),true);g.frontierState.active.radius=999;assert.equal(api.validIncidents(g.frontierState),false);
});
test('a paused storm keeps its timer and a saved strike retains its locked location',()=>{const g=game();api.beginIncident(g,'lightning');g.time=g.frontierState.active.dueAt+.1;api.updateIncidents(g,.1);const saved=snapshotGame(g),copy=restoreGame(saved);assert.deepEqual(snapshotGame(copy),saved);copy.state='paused';const time=copy.time,active=structuredClone(copy.frontierState);copy.update(.1,{});assert.equal(copy.time,time);assert.deepEqual(copy.frontierState,active);});
test('water amplifies a locked lightning strike while moving out of its circle avoids it',()=>{const hits=[];for(const wet of [false,true]){const g=game();api.beginIncident(g,'lightning');g.time=g.frontierState.active.dueAt+.1;api.updateIncidents(g,.1);const bolt=g.frontierState.active.strikes[0];if(wet)g.worldFeatures=[{type:'water',x:g.player.x,y:g.player.y,radius:20}];g.damagePlayer=(n)=>hits.push(n);g.time=bolt.dueAt+.1;api.updateIncidents(g,.1);}assert.equal(hits.length,2);assert.ok(hits[1]>hits[0]*1.5);});
test('fresh regional meteor scars create lava encounters once and survive restoration',()=>{
 const g=game();g.worldState.clock=300;g.worldState.scars=[{id:'old-region:meteor',event:'meteor',regionId:'highlands',color:0xffcc88,x:100,y:20,radius:18,at:290,expires:830}];api.updateIncidents(g,.1);assert.equal(g.frontierState.craters.length,1);const n=g.entities.filter(e=>e.lavaBorn).length;assert.ok(n>=2);const copy=restoreGame(snapshotGame(g));api.updateIncidents(copy,.1);assert.equal(copy.entities.filter(e=>e.lavaBorn).length,n);
});
