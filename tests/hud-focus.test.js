import test from 'node:test';import assert from 'node:assert/strict';import {hudFocus} from '../src/hud-focus.js';
const base={player:{hp:100,maxHp:100,hunger:100},objective:{title:'Explore',step:1,totalSteps:10,progress:0,progressText:'0%',hint:'Walk outward.'},lesson:{title:'Move',index:1,total:8,action:'up',text:'Walk with W.'},quests:{chapter:1,total:12,main:{title:'An ancient voice',progress:0,target:1,goal:'Find the ancient nest.'}}};
test('an active disaster and critical survival override lesson and story guidance',()=>{
 assert.equal(hudFocus({...base,incident:{safe:false,label:'Dodge the impact',seconds:4,detail:'Leave the red circle.'},player:{...base.player,hp:5}}).title,'Dodge the impact');
 assert.equal(hudFocus({...base,player:{...base.player,hp:5}}).step,'CRITICAL HEALTH');assert.equal(hudFocus({...base,player:{...base.player,hunger:3}}).step,'STARVING');
});
test('guidance advances from learning to the actual main quest without extra competing goals',()=>{
 assert.equal(hudFocus(base).learning,true);const focus=hudFocus({...base,lesson:null});assert.equal(focus.title,'An ancient voice');assert.equal(focus.hint,'Find the ancient nest.');
 assert.match(hudFocus({...base,lesson:null,quests:{...base.quests,main:{...base.quests.main,ready:true}}}).hint,/Story & quests/);
});
