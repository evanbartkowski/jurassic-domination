import { LANDMARKS, hasDiscovery } from './discoveries.js';

// All objectives and rewards are owned by the simulation. Views never advance a quest.
export const MAIN_QUESTS = [
  {id:'small-hunger',title:'A Hunger Older Than You',goal:'Eat three meals.',metric:'meals',target:3,xp:20,
    story:'You hatch with a memory that cannot be yours: a thousand feet running beneath a red sky. Between the thunder comes a quieter sound, three notes repeated like a call home. First, survive long enough to listen.',
    revelation:'The third meal steadies your heartbeat. The three notes return. Something beneath the nesting stones is answering you.'},
  {id:'first-voice',title:'The Nest That Remembered',site:'first-nest',xp:30,
    story:'Follow the call to the First Nest. Its oldest footprints circle an empty space, as though a whole herd once protected something too small to leave a track.',
    revelation:'A memory blooms in the stone: a small feathered scout named Silt returning a stolen egg. A great horned animal lowers its head and lets her pass. Enemies once shared this refuge. Why did they stop?'},
  {id:'new-shape',title:'Borrowed Bones',goal:'Reach evolution tier 2.',tier:1,xp:40,
    story:'Silt crossed a continent by changing with it. Your inherited body is a beginning, not a promise. Grow into a second form and learn what your ancestors could not carry alone.',
    revelation:'In your new bones, Silt’s memory sharpens. She was carrying a warning toward the inland sea. The water swallowed her route, but not her message.'},
  {id:'shell-archive',title:'The Sea Inside the Stone',site:'tidal-archive',xp:55,
    story:'Seek the Tidal Archive. Its shell-lined pillars predate the flood. Silt hid her warning where a drought could never burn it.',
    revelation:'The pillars sing in currents. An ancient sea hunter, Brine, guarded the archive without eating its messengers. The warning names a place: the Origin Vault. Beside it is a symbol of one enormous tooth.'},
  {id:'drowned-warning',title:'What Brine Refused',site:'drowned-archive',xp:65,
    story:'The Drowned Steps lead toward Brine’s final refuge. Their flood marks rise higher than any natural tide. Read what remained after the water receded.',
    revelation:'Brine refused the One-Tooth King’s command to surrender the eggs of weaker bloodlines. The king dammed the valley. Brine broke the dam to save the nests, flooding his own archive. This was no ordinary extinction.'},
  {id:'winter-witness',title:'The Witness Beneath the Ice',site:'frost-observatory',tier:2,xp:75,
    story:'A second witness sleeps in the Frost Observatory. Reach tier 3 and follow the ice rings. Cold preserved a truth the king tried to bury.',
    revelation:'A sleeping herd remembers the sky turning red before the king’s reign. An impact was coming. The Origin Vault offered many bloodlines a way to survive, but the king wanted a world made only of his descendants.'},
  {id:'stolen-fire',title:'The Fire He Stole',site:'ember-forge',tier:3,xp:90,
    story:'Reach tier 4 and find the Ember Forge. Silt’s tracks end at its threshold. Somewhere in the ash lies the cost of the king’s perfect world.',
    revelation:'The forge was built to shelter eggs through the long dark. The king burned its stores to feed his army. Silt stole the last living seed and fled. The three notes were her signal: one for tooth, one for feather, one for shell.'},
  {id:'elder-covenant',title:'No Single Footprint',site:'elder-circle',xp:100,
    story:'Take Silt’s memory to Elderroot Circle. Its stones bear the feet of hunters and prey together. Discover the pact that once kept the refuges alive.',
    revelation:'The elders did not promise an end to hunger. They promised that no lineage would be erased to feed another’s ambition. The last seed was a living archive: many kinds of life, carried in one ancestral song. You carry it now.'},
  {id:'last-titan',title:'The Titan Who Turned Back',site:'titan-fossil',tier:4,xp:110,
    story:'Reach tier 5 and find the Titan’s Last Step. Its trail points away from safety. Learn why the largest survivor walked back into the falling ash.',
    revelation:'The titan returned for Silt. It sheltered her beneath its body while fragments of the sky struck the earth. She lived long enough to pass on the song. The king reached the Vault alone and found it would not open to one voice.'},
  {id:'glass-sky',title:'When the Sky Fell',site:'storm-spire',tier:5,xp:125,
    story:'Reach tier 6 and ascend to Stormglass Spire. The impact fused its stones into glass. The final echo waits within the fracture.',
    revelation:'The king broke the Vault rather than share it. Its pulse scattered unfinished memories through every surviving bloodline. That is why creatures now change so quickly, and why impossible forms walk the wild. Your power is a wound trying to heal.'},
  {id:'open-vault',title:'The Door With No King',site:'origin-vault',tier:6,xp:150,
    story:'Reach tier 7 and enter the Origin Vault. You have gathered the witnesses. Now bring the living song to the broken spiral at the continent’s edge.',
    revelation:'The Vault opens. There is no sleeping army inside, only the preserved heartbeats of vanished nests. It can scatter their inheritance among all survivors, or bind their strength to your bloodline. The king’s mistake was not wanting to live. It was believing only his life mattered.'},
  {id:'last-chorus',title:'The Last Chorus',site:'origin-vault',tier:6,choice:true,xp:180,
    story:'Return to the Vault if you have left it. The broken spiral awaits a living decision. Let the old voices join the wild, or carry them beneath a single crown. Neither choice ends hunger. One decides who gets to inherit tomorrow.',
    revelation:'The ancient silence ends.'},
];

export const ENDINGS = {
  chorus:{title:'A Thousand Tomorrows',text:'You release the song. Across the continent, sleeping eggs stir with memories their parents never knew. Silt’s three notes become a thousand different calls. You leave the Vault without a crown, carrying something harder to keep: a world that belongs to more than you.',reward:'The Chorus blessing: restore vitality and gain a lasting 5% stamina recovery bonus for this life.'},
  crown:{title:'The Crown That Remembers',text:'You bind the song to your descendants. The vanished nests fall quiet, but they are not forgotten. Their strength lives under your skin. At the threshold, Silt’s memory watches without judgment. You have chosen a single guardian for tomorrow. Now you must become better than the king who came before.',reward:'The Remembering Crown: gain a lasting 5% bite damage bonus for this life.'},
};
export const REPEATABLE_QUESTS = [
  {id:'forage',title:'The Living Pantry',description:'Eat five plants or fruits. Safe forage counts in every diet.',metric:'plants',target:5,xp:25},
  {id:'hunt',title:'Keep Your Teeth Sharp',description:'Defeat three creatures yourself. Wildlife fights do not count.',metric:'kills',target:3,xp:45},
  {id:'trail',title:'Beyond Familiar Ground',description:'Travel 250 metres through the world. Teleports do not count.',metric:'travel',target:250,xp:35},
  {id:'endure',title:'Another Dawn Will Come',description:'Survive for two more minutes of active play.',metric:'time',target:120,xp:30},
];
export function newQuestState(game={}) {
  return {version:1,chapter:0,ending:null,meals:0,plants:0,kills:0,
    repeat:Object.fromEntries(REPEATABLE_QUESTS.map(q=>[q.id,{cycle:0,start:q.metric==='travel'?(game.exploration?.travel||0):q.metric==='time'?(game.time||0):0}]))};
}
export function initializeQuests(game){return game.quests ||= newQuestState(game);}
export function recordQuestEvent(game,event){
  const q=initializeQuests(game),inc=id=>q[id]=Math.min(1e9,q[id]+1);
  if(event.type==='eat'){inc('meals');if(['plant','rareplant','lineage-fruit'].includes(event.food))inc('plants');}
  if(event.type==='kill'&&!event.wild&&event.target!=='plant')inc('kills');
}
function metric(game,id){return id==='travel'?(game.exploration?.travel||0):id==='time'?(game.time||0):initializeQuests(game)[id]||0;}
export function questStatus(game){
  if(!game)return null;
  const state=initializeQuests(game),definition=MAIN_QUESTS[state.chapter];
  let main=null;
  if(definition){
    const site=LANDMARKS.find(s=>s.id===definition.site),found=!site||hasDiscovery(game,site.id),tierMet=(game.tier||0)>=(definition.tier||0),
      progress=definition.metric?Math.min(definition.target,metric(game,definition.metric)):(site?Number(found):0)+(definition.tier?Number(tierMet):0),
      target=definition.target||((site?1:0)+(definition.tier?1:0)||1),atVault=!definition.choice||Math.hypot(game.player.x-site.x,game.player.y-site.y)<=site.radius;
    const goal=definition.goal||`Discover ${site.name}${definition.tier?` and reach tier ${definition.tier+1}`:''}.`;
    main={...definition,site,goal,progress,target,ready:progress>=target&&atVault,atVault,found,tierMet};
  }
  const repeatable=REPEATABLE_QUESTS.map(q=>{const progress=Math.max(0,Math.min(q.target,metric(game,q.metric)-state.repeat[q.id].start));return {...q,progress,ready:progress>=q.target,cycle:state.repeat[q.id].cycle};});
  return {main,repeatable,chapter:state.chapter,total:MAIN_QUESTS.length,ending:ENDINGS[state.ending]||null};
}
export function claimQuest(game,id){
  if(game.state!=='playing')return false;
  const status=questStatus(game),q=id==='main'?status.main:status.repeatable.find(q=>q.id===id);
  if(!q?.ready||q.choice)return false;
  if(id==='main')game.quests.chapter++;
  else {const r=game.quests.repeat[id];if(r.cycle>=1e6)return false;r.cycle++;r.start=metric(game,q.metric);}
  game.gainXP(q.xp);
  game.emit('quest-complete',{text:`${q.title} · +${q.xp} XP`,questId:q.id,story:id==='main'?q.revelation:null});
  return true;
}
export function chooseStoryEnding(game,ending){
  if(game.state!=='playing'||!Object.hasOwn(ENDINGS,ending))return false;
  const q=questStatus(game).main;if(!q?.choice||!q.ready)return false;
  game.quests.ending=ending;game.quests.chapter=MAIN_QUESTS.length;
  game.player.hp=game.player.maxHp;game.gainXP(q.xp);game.refreshStats();
  game.emit('quest-complete',{text:ENDINGS[ending].title,questId:q.id,story:ENDINGS[ending].text});
  return true;
}
export function validQuestState(q){
  const bounded=n=>Number.isFinite(n)&&n>=0&&n<=1e9;
  return !!q&&q.version===1&&Number.isInteger(q.chapter)&&q.chapter>=0&&q.chapter<=MAIN_QUESTS.length&&
    (q.ending===null||(typeof q.ending==='string'&&Object.hasOwn(ENDINGS,q.ending)))&&(q.chapter===MAIN_QUESTS.length)===(q.ending!==null)&&
    ['meals','plants','kills'].every(id=>Number.isInteger(q[id])&&bounded(q[id]))&&q.plants<=q.meals&&
    !!q.repeat&&REPEATABLE_QUESTS.every(({id,metric})=>{const r=q.repeat[id];return r&&Number.isInteger(r.cycle)&&r.cycle>=0&&r.cycle<=1e6&&bounded(r.start)&&(!['plants','kills'].includes(metric)||r.start<=q[metric]);});
}
