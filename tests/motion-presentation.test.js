import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleLocomotion, cameraDistance} from '../src/motion-presentation.js';
import {creatureKit} from '../src/progression.js';
import {SPECIES} from '../src/data.js';
import * as T from 'three';
import {gaitPose,prepareSecondaryMotion,applySecondaryMotion,naturalGaitClips} from '../src/creature-motion.js';
import {createAttackStroke} from '../src/frontier-effects.js';
import {AssetPreparationQueue} from '../src/asset-preparation-queue.js';
test('herd asset preparation is limited to one animal per frame and the player has priority',()=>{
 const frames=[],done=[],queue=new AssetPreparationQueue(fn=>frames.push(fn));
 for(let i=0;i<20;i++)queue.enqueue(()=>done.push(i));queue.enqueue(()=>done.push('player'),true);
 assert.equal(done.length,0);assert.equal(frames.length,1);frames.shift()();assert.deepEqual(done,['player']);
 for(let i=0;i<20;i++){assert.equal(frames.length,1);frames.shift()();assert.equal(done.length,i+2);}
 assert.equal(frames.length,0);
});
test('bite, ram and stomp have distinct readable attack shapes and fade completely',()=>{
 for(const style of ['bite','ram','stomp']){
  const effect=createAttackStroke({type:'attack',style,x:0,y:0,radius:5});
  assert.ok(effect.group.children.some(c=>c.name.includes(style)),style);
  effect.update(.1,1);assert.ok(effect.group.children.every(c=>c.material.opacity===0));
 }
});
test('gaits close their loops and bend the recovery leg while the planted leg stays extended',()=>{
 for(const run of [false,true]){
  assert.deepEqual(gaitPose(0,run),gaitPose(Math.PI*2,run));
  assert.equal(gaitPose(Math.PI*.25,run).knee,0);
  assert.ok(gaitPose(Math.PI*1.5,run).knee>.5);
 }
});
test('secondary idle motion stays bounded and leaves death/rest poses untouched',()=>{
 const root=new T.Group(),head=new T.Bone();head.name='head';root.add(head);
 const state=prepareSecondaryMotion(root,1);
 for(let i=0;i<10000;i++)applySecondaryMotion(state,1/60,0,0,0,false,false);
 assert.ok(head.quaternion.angleTo(new T.Quaternion())<.25);
 applySecondaryMotion(state,1/60,0,0,0,false,true);
 assert.ok(head.quaternion.angleTo(new T.Quaternion())<.000001);
});
test('gait repair keeps source clips immutable and respects the skeleton bind rotation',()=>{
 const root=new T.Group(),leg=new T.Bone();leg.name='hind.L';leg.rotation.x=.6;root.add(leg);
 const clip=new T.AnimationClip('rex_Walk',2,[new T.QuaternionKeyframeTrack('hind.L.quaternion',[0,1,2],[0,0,0,1,0,0,0,1,0,0,0,1])]);
 const [repaired]=naturalGaitClips(root,[clip]);
 assert.notDeepEqual([...repaired.tracks[0].values],[...clip.tracks[0].values]);
 assert.equal(clip.tracks[0].values[3],1);
 assert.deepEqual([...repaired.tracks[0].values.slice(0,4)],[...repaired.tracks[0].values.slice(-4)]);
});
test('export-sanitized right legs oppose the left legs instead of hopping together',()=>{
 const root=new T.Group();const tracks=[];
 for(const name of ['hindL','hindR']){const bone=new T.Bone();bone.name=name;root.add(bone);tracks.push(new T.QuaternionKeyframeTrack(name+'.quaternion',[0,1,2],[0,0,0,1,0,0,0,1,0,0,0,1]));}
 const [clip]=naturalGaitClips(root,[new T.AnimationClip('Walk',2,tracks)]);
 assert.ok(clip.tracks[0].values[2]*clip.tracks[1].values[2]<0,'left/right contact is offset by half a cycle');
});
test('fixed-step movement keeps a continuous gait between simulation ticks',()=>{
 const state={};let x=0;const speeds=[];
 for(let i=0;i<240;i++){if(i%2===0)x+=.1;sampleLocomotion(state,x,0,1/120);if(i>120)speeds.push(state.worldSpeed);}
 assert.ok(Math.min(...speeds)>5);assert.ok(Math.max(...speeds)<7);
 for(let i=0;i<120;i++)sampleLocomotion(state,x,0,1/120);
 assert.ok(state.worldSpeed<.01,'comes to rest without foot shuffling');
});
test('spawn and teleport do not produce explosive gait speeds',()=>{
 const s={};sampleLocomotion(s,100,100,1/60);assert.equal(s.worldSpeed,0);
 sampleLocomotion(s,1000,1000,1/60);assert.equal(s.worldSpeed,0);
});
test('camera framing is stable when sprinting switches',()=>{
 assert.equal(cameraDistance(2,true),cameraDistance(2,false));
});
test('early species have a small innate kit even with legendary mutations',()=>{
 for(const s of SPECIES.filter(s=>s.tier<=2)){
  const kit=creatureKit(s,{titansWrath:1,astralBehemoth:1});
  assert.ok(kit.abilityCount<=(s.tier===0?0:1),s.id);assert.equal(kit.special,null,s.id);assert.equal(kit.technique,null,s.id);
 }
});
