import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { plantHealth } from '../src/plant-health.js';
import {snapshotGame,restoreGame} from '../src/run-state.js';
test('plant bars use the same maximum health as attacks and disappear with destroyed plants',()=>{
 const g=new Game({seed:93});g.hatch();g.entities=[];g.foods=[];g.worldFeatures=[];
 const plant=g.spawnFood('plant',g.player.x+1,g.player.y,12,{tier:1});
 const before=plantHealth(plant);assert.ok(before.maxHp>0);assert.equal(before.hp,before.maxHp);
 g.player.angle=0;g.player.damage=before.maxHp/3;g.attack();
 assert.ok(plantHealth(plant).ratio<1);assert.ok(plantHealth(plant).ratio>0);
 assert.deepEqual(plantHealth(restoreGame(snapshotGame(g)).foods.find(f=>f.id===plant.id)),plantHealth(plant));
 g.player.attackCooldown=0;g.player.damage=10000;g.attack();
 assert.ok(!g.foods.includes(plant));
 const hostile={type:'carnivore',tier:2,hp:40};
 assert.equal(plantHealth(hostile).maxHp,115);
 assert.equal(plantHealth({...hostile,dead:true}),null);
});
