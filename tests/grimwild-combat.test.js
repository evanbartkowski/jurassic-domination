import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { SPECIES_BY_ID } from '../src/data.js';
import { archetypeForSpecies } from '../src/progression.js';
const form=id=>{const g=new Game({seed:761,runId:'grimwild-build'});g.hatch();g.player.speciesId=id;g.tier=SPECIES_BY_ID[id].tier;g.player.growth=0;g.refreshStats(true);return g;};
test('glass cannons, runners, tanks and burst hunters keep different high-tier identities',()=>{
 assert.equal(archetypeForSpecies(SPECIES_BY_ID.phoenix).id,'glass');
 assert.equal(archetypeForSpecies(SPECIES_BY_ID.gallimimus).id,'sprinter');
 assert.equal(archetypeForSpecies(SPECIES_BY_ID.ankylosaurus).id,'titan');
 assert.equal(archetypeForSpecies(SPECIES_BY_ID.carnotaurus).id,'burst');
});
test('archetype health, damage and speed tradeoffs change actual player stats',()=>{
 for(const id of ['phoenix','gallimimus','ankylosaurus','carnotaurus']){
  const g=form(id),s=g.species,a=archetypeForSpecies(s);
  assert.equal(g.player.maxHp,Math.round(s.hp*a.hpMultiplier));
  assert.ok(Math.abs(g.player.damage-s.damage*a.damageMultiplier)<.001);
  assert.ok(Math.abs(g.player.speed-s.speed*g.geneticTraits.speed*a.speedBonus)<.001);
 }
});
test('a venom build poisons through a real bite without needing a separate mutation',()=>{
 const g=form('basilisk');g.entities=[];const e=g.spawnEntity('tyrannosaurus',2,0);e.hp=e.maxHp;g.player.angle=0;g.attack();assert.ok(e.poison>0);
});
