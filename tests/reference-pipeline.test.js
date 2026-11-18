import test from 'node:test';
import assert from 'node:assert/strict';
import {creatureAssetCandidates} from '../src/creature-asset-paths.js';
import * as T from 'three';
import {updateFlagshipAnimation} from '../src/flagship-models.js';
test('reviewed replacement loads first, followed by the working previous asset',()=>{
 assert.deepEqual(creatureAssetCandidates('tyrannosaurus','/game/',{tyrannosaurus:{file:'models-v5/tyrannosaurus.glb',enabled:true}}),['/game/assets/models-v5/tyrannosaurus.glb','/game/assets/models-v4/tyrannosaurus.glb']);
});
test('the web edition only requests its reviewed current asset without redundant legacy downloads',()=>{
 assert.deepEqual(creatureAssetCandidates('tyrannosaurus','/game/',{tyrannosaurus:{file:'models-v5/tyrannosaurus.glb',enabled:true}},{legacy:false}),['/game/assets/models-v5/tyrannosaurus.glb']);
 assert.deepEqual(creatureAssetCandidates('tyrannosaurus','./',{}, {legacy:false}),[]);
});
test('hit reaction plays out after the damage pulse, and death remains clamped',()=>{
 const root=new T.Group(),mixer=new T.AnimationMixer(root),actions={};
 for(const name of ['Idle','Walk','Run','Attack','Graze','Rest','Hit','Death']){
  actions[name]=mixer.clipAction(new T.AnimationClip(name,.5,[new T.NumberKeyframeTrack('.position[x]',[0,.5],[0,name==='Death'?1:0])])).setEffectiveWeight(0).play();
 }
 const asset={mixer,actions,version:5};updateFlagshipAnimation(asset,.05,0,false,false,false,{hit:true});
 updateFlagshipAnimation(asset,.05,0,false,false,false,{});assert.ok(actions.Hit.getEffectiveWeight()>.4,'reaction does not vanish when hitFlash ends');
 updateFlagshipAnimation(asset,.05,0,false,false,false,{dead:true});for(let i=0;i<30;i++)updateFlagshipAnimation(asset,.05,0,false,false,false,{dead:true});
 assert.equal(actions.Death.loop,T.LoopOnce);assert.equal(actions.Death.clampWhenFinished,true);assert.ok(actions.Death.getEffectiveWeight()>.95);assert.equal(actions.Death.paused,true);
});
test('unapproved, malformed and unknown replacements cannot hide the working model',()=>{
 for(const entry of [{enabled:false,file:'models-v5/tyrannosaurus.glb'},{enabled:true,file:'../../anything.glb'},null])assert.deepEqual(creatureAssetCandidates('tyrannosaurus','./',{tyrannosaurus:entry}),['./assets/models-v4/tyrannosaurus.glb']);
 assert.deepEqual(creatureAssetCandidates('not-a-species','./',{}),[]);
});
