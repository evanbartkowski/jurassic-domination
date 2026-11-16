import test from 'node:test';import assert from 'node:assert/strict';import{Game}from'../src/game.js';import{SPECIES_BY_ID}from'../src/data.js';
const api=await import('../src/frontier-ecology.js').catch(()=>({}));
test('regional ecology allows very different tiers instead of following the player level',()=>{
 assert.equal(typeof api.encounterTier,'function');assert.ok(api.encounterTier(0,.98)>=3);assert.ok(api.encounterTier(6,.05)<=2);
});
test('a migration produces a substantial bounded herd with shared route intent',()=>{
 assert.equal(typeof api.spawnMigration,'function');const g=new Game({seed:17});g.hatch();g.entities=[];g.player.x=100;g.player.y=10;const herd=api.spawnMigration(g,()=>.3);assert.ok(herd.length>=16&&herd.length<=24);assert.ok(herd.every(e=>e.migration&&e.packId===herd[0].packId));assert.ok(herd.every(e=>Math.hypot(e.x-g.player.x,e.y-g.player.y)>25));
});
