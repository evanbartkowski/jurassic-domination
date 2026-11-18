import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareEgg,rollEggRarity,EGG_RARITIES} from '../src/eggs.js';
import {SPECIES_BY_ID} from '../src/data.js';
test('egg rarity thresholds and rewards distinguish rare finds',()=>{
 assert.deepEqual([0,.01,.1,.8].map(rollEggRarity),['legendary','epic','rare','common']);
 assert.equal(EGG_RARITIES.legendary.xp,50);
 const egg=prepareEgg({x:100,y:0,tier:1,speciesId:'troodon'},()=>0);
 assert.equal(egg.eggRarity,'legendary');assert.equal(SPECIES_BY_ID[egg.speciesId].tier,4);
 assert.ok(EGG_RARITIES.legendary.power>EGG_RARITIES.rare.power);
});
test('starter basin and player family eggs preserve safe species identity',()=>{
 assert.equal(prepareEgg({x:14,y:0,tier:0,speciesId:'coelophysis'},()=>0).eggRarity,'common');
 assert.equal(prepareEgg({x:100,y:0,tier:1,speciesId:'troodon',isPlayerEgg:true},()=>0).speciesId,'troodon');
});
