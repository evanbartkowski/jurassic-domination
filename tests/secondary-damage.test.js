import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { snapshotGame, restoreGame } from '../src/run-state.js';
const setup=()=>{const g=new Game({seed:601,runId:'secondary-regression'});g.hatch();g.entities=[];g.foods=[];g.consumeEvents();g.player.invulnerable=0;return g;};
const victim=(g,x=2,y=0)=>{const e=g.spawnEntity('compsognathus',x,y);e.hp=1;return e;};
function verify(g,ids){
  assert.ok(g.entities.every(e=>e.hp>0),'lethal secondary hits must remove the actor');
  const kills=g.consumeEvents().filter(e=>e.type==='kill');
  for(const id of ids)assert.equal(kills.filter(e=>e.entityId===id).length,1,`one kill receipt for ${id}`);
  const saved=snapshotGame(g);assert.deepEqual(snapshotGame(restoreGame(saved)),saved);
}
test('chain, tail and hemorrhage secondary kills settle once and remain saveable',()=>{
  for(const effect of ['chainLightning','spikedTail','hemorrhage']){
    const g=setup(),primary=victim(g),secondary=victim(g,3,0);
    if(effect==='hemorrhage'){g.build.activeSynergies=['hemorrhage'];primary.bleeding=1;}
    else g.build.offensive[effect]=1;
    g._hitEntity(primary,10000,1);
    verify(g,[primary.id,secondary.id]);
    assert.equal(g.player.kills,2);
    g._hitEntity(primary,10000,1);assert.equal(g.player.kills,2);
  }
});
test('defensive retaliation removes lethal victims without leaving invalid health in a checkpoint',()=>{
  for(const effect of ['reflectiveArmor','thorns','toxicBlood','volcanicScales','volcanicCore']){
    const g=setup(),e=victim(g);
    if(effect==='volcanicScales')g.build.transformations[effect]=1;
    else if(effect==='volcanicCore')g.mutations.push(effect);
    else g.build.defensive[effect]=1;
    assert.equal(g.damagePlayer(20,'Retaliation regression'),true);
    verify(g,[e.id]);assert.equal(g.player.kills,1);
  }
});
test('persistent flame and poison zones settle their kills before streaming or saving',()=>{
  for(const effect of ['flameTrails','poisonClouds']){
    const g=setup(),e=victim(g);
    g.build[effect]=[{x:2,y:0,radius:5,life:3,damage:1000}];
    g.update(1/60,{});verify(g,[e.id]);assert.equal(g.player.kills,1);
    g.update(1/60,{});assert.equal(g.player.kills,1);
  }
});
