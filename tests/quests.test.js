import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { MAIN_QUESTS, questStatus, claimQuest, chooseStoryEnding, validQuestState } from '../src/quests.js';
import { LocalAuthority } from '../src/simulation.js';
import { snapshotGame, restoreGame, validateSnapshot } from '../src/run-state.js';
import { SPECIES } from '../src/data.js';
import { LANDMARKS, recordExploration } from '../src/discoveries.js';

test('main chapters require their objectives, claim once and preserve history across checkpoints', () => {
  const g = new Game({seed:77}); g.hatch();
  assert.equal(claimQuest(g,'main'),false);
  for(let i=0;i<3;i++)g.emit('eat',{food:'plant',amount:12});
  assert.equal(questStatus(g).main.ready,true);
  assert.ok(new LocalAuthority(g).dispatch({type:'claim-quest',id:'main'}).ok);
  assert.equal(g.quests.chapter,1);
  assert.equal(claimQuest(g,'main'),false);
  const restored=restoreGame(snapshotGame(g));
  assert.deepEqual(restored.quests,g.quests);
  assert.equal(questStatus(restored).main.id,MAIN_QUESTS[1].id);
  const forged=snapshotGame(g);forged.game.quests.chapter=900;
  assert.equal(validateSnapshot(forged),false);
});
test('repeatable quests renew with fresh progress and exclude wildlife kills', () => {
  const g = new Game({seed:78});g.hatch();
  for(let i=0;i<8;i++)g.emit('kill',{wild:true,speciesId:'troodon'});
  assert.equal(questStatus(g).repeatable.find(q=>q.id==='hunt').progress,0);
  for(let i=0;i<3;i++)g.emit('kill',{speciesId:'troodon'});
  assert.ok(claimQuest(g,'hunt'));
  assert.equal(questStatus(g).repeatable.find(q=>q.id==='hunt').progress,0);
  assert.equal(claimQuest(g,'hunt'),false);
  assert.equal(g.quests.repeat.hunt.cycle,1);
  assert.ok(validQuestState(g.quests));
});
test('the story has a playable complete arc, a guarded final choice and two different conclusions', () => {
  assert.ok(MAIN_QUESTS.length>=10);
  const endings=[];
  for(const ending of ['chorus','crown']){
    const g = new Game({seed:79});g.hatch();
    assert.equal(chooseStoryEnding(g,ending),false);
    g.quests.chapter=MAIN_QUESTS.length-1;
    g.tier=7;g.exploration.discoveries=[{id:'origin-vault',at:0}];
    g.player.x=1020;g.player.y=1110;
    assert.equal(claimQuest(g,'main'),false,'final chapter requires a deliberate decision');
    assert.ok(chooseStoryEnding(g,ending));
    assert.equal(chooseStoryEnding(g,ending),false);
    endings.push(questStatus(g).ending.title);
    assert.equal(g.state,'playing');
  }
  assert.notEqual(...endings);
});
test('every chapter can be finished in order, its rewards resume exactly and the crown changes damage once',()=>{
  let g=new Game({seed:80});g.hatch();
  for(let index=0;index<MAIN_QUESTS.length-1;index++){
    const chapter=MAIN_QUESTS[index];
    if(chapter.metric)for(let n=0;n<chapter.target;n++)g.emit('eat',{food:'plant'});
    if(chapter.tier){g.player.speciesId=SPECIES.find(s=>s.tier===chapter.tier&&!s.bloodline).id;g.tier=chapter.tier;g.refreshStats(true);}
    if(chapter.site){const site=LANDMARKS.find(s=>s.id===chapter.site);g.player.x=site.x;g.player.y=site.y;recordExploration(g);}
    assert.ok(claimQuest(g,'main'),chapter.id);
    g=restoreGame(snapshotGame(g));assert.equal(g.quests.chapter,index+1);
  }
  const damage=g.player.damage;
  assert.ok(chooseStoryEnding(g,'crown'));
  assert.ok(Math.abs(g.player.damage-damage*1.05)<1e-6);
  assert.ok(!chooseStoryEnding(g,'chorus'));
  assert.deepEqual(restoreGame(snapshotGame(g)).quests,g.quests);
});
test('older checkpoints acquire quests without retroactive travel or survival rewards or changing random state',()=>{
  const g=new Game({seed:81});g.hatch();g.time=420;g.exploration.travel=900;
  const checkpoint=snapshotGame(g);delete checkpoint.game.quests;
  const peer=restoreGame(checkpoint),status=questStatus(peer);
  assert.equal(peer._randomState,g._randomState);
  for(const id of ['trail','endure'])assert.equal(status.repeatable.find(q=>q.id===id).progress,0);
  assert.equal(validQuestState({...peer.quests,ending:'constructor'}),false);
});
