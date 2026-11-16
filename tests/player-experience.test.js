import test from 'node:test';
import assert from 'node:assert/strict';
const feature=await import('../src/player-experience.js').catch(()=>({}));
import { UI } from '../src/ui.js';
test('frame cap keeps a 144 Hz callback stream near 30 frames and switches limits safely',()=>{
 assert.ok(feature.FramePacer,'frame pacing must be implemented');const p=new feature.FramePacer();let frames=0;
 for(let i=0;i<144;i++)if(p.ready(i*1000/144,30))frames++;
 assert.ok(frames>=29&&frames<=31,`${frames} frames`);assert.ok(p.ready(1000,0));assert.ok(p.ready(1001,144));
});
test('nested navigation pops one screen and retains the previous focus and scroll',()=>{
 assert.ok(feature.ScreenHistory,'nested screen history must be implemented');const h=new feature.ScreenHistory();
 h.open('menu');h.open('settings',{focus:'settings',scroll:42});h.open('controls',{focus:'controls',scroll:100});
 assert.deepEqual(h.back(),{view:'settings',state:{focus:'controls',scroll:100}});assert.equal(h.back().view,'menu');assert.equal(h.back(),null);
});
test('learning remembers real actions out of order and strips unknown imported task ids',()=>{
 assert.ok(feature.advanceLearning,'contextual learning must be implemented');const start=feature.normalizeLearning({completed:['move','fake','move'],skipped:false});
 assert.deepEqual(start.completed,['move']);const next=feature.advanceLearning(start,{hatch:true,feed:true,evolve:false});
 assert.ok(next.completed.includes('move')&&next.completed.includes('feed')&&next.completed.includes('hatch'));assert.ok(!next.completed.includes('evolve'));
 assert.deepEqual(feature.advanceLearning(next,{feed:true}),next);
});
test('a postponed and reopened choice cannot be confirmed by an older transition timer',()=>{
 const original=globalThis.setTimeout;let finish,confirmed=0;
 globalThis.setTimeout=fn=>{finish=fn;return 1;};
 try{
  const ui={_view:'evolution',screenRevision:1,chosenSpecies:'compsognathus',chosenMutation:'ironhide',overlay:{querySelectorAll:()=>[],querySelector:()=>null},callbacks:{evolve:()=>confirmed++}};
  UI.prototype.confirmChosenEvolution.call(ui);ui.screenRevision=2;finish();assert.equal(confirmed,0);
 }finally{globalThis.setTimeout=original;}
});
