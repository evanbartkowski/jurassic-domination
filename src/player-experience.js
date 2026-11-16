import { DEFAULT_BINDINGS, keyLabel } from './controls.js';

/** Rendering is capped; the simulation still receives elapsed wall time. */
export class FramePacer {
 constructor(){this.last=null;this.limit=null;}
 ready(now,limit=60){
  if(!limit){this.last=now;this.limit=limit;return true;}
  if(this.last===null||this.limit!==limit||now<this.last-100){this.last=now;this.limit=limit;return true;}
  const interval=1000/limit,elapsed=now-this.last;
  if(elapsed+.4<interval)return false;
  this.last+=Math.max(1,Math.floor((elapsed+.4)/interval))*interval;return true;
 }
}
export class ScreenHistory {
 constructor(){this.entries=[];}
 reset(view){this.entries=[{view,state:{}}];}
 open(view,previous={}){
  const last=this.entries.at(-1);if(last?.view===view)return;
  if(last)last.state=previous;
  if(view==='menu'||view==='start')this.reset(view);else this.entries.push({view,state:{}});
  if(this.entries.length>24)this.entries.splice(1,1);
 }
 back(){if(this.entries.length<2)return null;this.entries.pop();return this.entries.at(-1);}
}
export const LESSONS=[
 {id:'hatch',title:'Break into the wild',action:'eat',text:'Choose a starter, then press {key} or Crack the shell.',highlight:'#egg-prompt'},
 {id:'move',title:'Find your feet',action:'up',text:'Use {key} / your movement keys to walk around the sheltered nest.',highlight:'.species-card'},
 {id:'feed',title:'Keep nourishment high',action:'eat',text:'Approach edible food and hold {key}. Food restores hunger and grows this form.',highlight:'.nourishment-vital'},
 {id:'attack',title:'Practice your bite',action:'attack',text:'Aim with the mouse. Left-click or press {key} to bite; watch for stronger predators.',highlight:'.abilities'},
 {id:'roar',title:'Let the basin hear you',action:'roar',text:'Press {key} to reveal and intimidate nearby wildlife. Roaring costs stamina.',highlight:'.roar-key'},
 {id:'pause',title:'Your life can wait',text:'Press Esc to pause. Checkpoints save this life; Continue brings it back.',highlight:'#pause-button'},
 {id:'evolve',title:'Choose your next form',action:'evolve',text:'Eat to fill the XP meter. When ready, press {key}; evolution waits for your choice.',highlight:'#hud-evolution-bar-container'},
 {id:'map',title:'Chart your expedition',action:'map',text:'Press {key} for the world map. Click explored or unexplored land to mark a destination.',highlight:'.minimap-wrap'},
];
const ids=new Set(LESSONS.map(x=>x.id));
export function normalizeLearning(raw){return {version:1,skipped:raw?.skipped===true,completed:[...new Set((Array.isArray(raw?.completed)?raw.completed:[]).filter(id=>ids.has(id)))]};}
export function advanceLearning(raw,facts={}){
 const next=normalizeLearning(raw);for(const lesson of LESSONS)if(facts[lesson.id]&&!next.completed.includes(lesson.id))next.completed.push(lesson.id);return next;
}
export function learningPrompt(raw,bindings=DEFAULT_BINDINGS){
 const p=normalizeLearning(raw);if(p.skipped)return null;
 const lesson=LESSONS.find(x=>!p.completed.includes(x.id));
 return lesson?{...lesson,index:p.completed.length+1,total:LESSONS.length,text:lesson.text.replace('{key}',keyLabel(bindings[lesson.action]||DEFAULT_BINDINGS[lesson.action]))}:null;
}
export function controlHelp(text,bindings=DEFAULT_BINDINGS){
 return String(text).replace(/Press C\b/g,'Press '+keyLabel(bindings.roar)).replace(/Press T\b/g,'Press '+keyLabel(bindings.evolve)).replace(/\b(Press|Hold) E\b/g,(_,verb)=>verb+' '+keyLabel(bindings.eat));
}
