import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES_BY_ID } from '../src/data.js';
import {Game} from '../src/game.js';
import {snapshotGame,restoreGame,validateSnapshot} from '../src/run-state.js';
const ai=await import('../src/enemy-combat.js').catch(()=>({}));
test('enemy windups commit their aim so a late sidestep cannot be homed into',()=>{
 assert.equal(typeof ai.beginEnemyAttack,'function');const e={x:0,y:0,hp:100,maxHp:100},p={x:4,y:0};const plan=ai.beginEnemyAttack(e,p,SPECIES_BY_ID.tyrannosaurus,10);
 p.x=0;p.y=4;assert.equal(plan.angle,0);assert.ok(plan.windup>=.45);
});
test('heavy recovery prevents instant bites and caster chaining',()=>{
 assert.equal(typeof ai.finishEnemyAttack,'function');const e={x:0,y:0,hp:100,maxHp:100,attackCooldown:0};ai.beginEnemyAttack(e,{x:2,y:0},SPECIES_BY_ID.ankylosaurus,0);ai.finishEnemyAttack(e,SPECIES_BY_ID.ankylosaurus,1);
 const t=ai.enemyTactics(e,{x:2,y:0},SPECIES_BY_ID.ankylosaurus,1.2,[]);assert.equal(t.canStrike,false);assert.equal(t.canSkill,false);assert.equal(t.intent,'recover');
});
test('packs yield attack slots and orbit instead of all biting simultaneously',()=>{
 assert.equal(typeof ai.enemyTactics,'function');const s=SPECIES_BY_ID.velociraptor,e={id:3,x:3,y:0,hp:100,maxHp:100};const peers=[{id:1,telegraph:.4,x:2,y:0},{id:2,telegraph:.4,x:0,y:2}];
 const t=ai.enemyTactics(e,{x:0,y:0},s,2,peers);assert.equal(t.canStrike,false);assert.equal(t.intent,'circle');
});
test('a live committed attack misses a sidestep and survives a checkpoint with identical recovery',()=>{
 const g=new Game({seed:472});g.hatch();g.entities=[];g.worldFeatures=[];g.player.x=0;g.player.y=0;g.player.invulnerable=0;
 const e=g.spawnEntity('velociraptor',3,0,{behavior:'hunter'});e.aggro=20;e.skillCooldown=999;e.chargeCooldown=999;e.attackCooldown=0;
 g._updateEntity(e,.016);assert.ok(e.telegraph>0);assert.equal(e.combatPlan.phase,'windup');
 const save=snapshotGame(g),peer=restoreGame(save);assert.deepEqual(snapshotGame(peer),save);
 const corrupt=structuredClone(save);corrupt.game.entities[0].combatPlan.recoverUntil=-999;assert.equal(validateSnapshot(corrupt),false);
 const hp=g.player.hp;g.player.x=e.x;g.player.y=e.y+3;g.time+=.8;g._updateEntity(e,.8);assert.equal(g.player.hp,hp);assert.equal(e.combatPlan.phase,'recovery');
});
