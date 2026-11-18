import levels from './music-levels.json' with {type:'json'};
const root=`${import.meta.env?.BASE_URL||'./'}sounds/music/`;
export const MUSIC_PLAYLISTS={
 menu:['echoes_of_lumen-ominous-music-595730.mp3','ehved2-shadow-of-the-blood-thirsty-woodlands-250736.mp3'],
 playing:['geoffharvey-dawn-of-time-369563.mp3','sergepavkinmusic-viking-saga-147998.mp3','sergepavkinmusic-vikings-148012.mp3'],
 danger:['spmusic-fight-151125.mp3','spmusic-decisive-race-154402.mp3','vaitsez-game-gaming-trap-music-570137.mp3'],
 dead:['alesiadavina-bittersweet-eerie-horror-vocals-the-siren-142786.mp3'],
};
/** Two-voice, locally bundled background score. HTML audio streams long tracks. */
export class MusicDirector{
 constructor({makeClip=src=>typeof Audio==='undefined'?null:new Audio(src),random=Math.random}={}){
  Object.assign(this,{makeClip,random,scene:'',voices:[],current:null,failed:new Set(),last:new Map(),gain:0,paused:false});
 }
 setScene(scene){
  this.paused=scene==='paused';if(this.paused)return;
  if(!MUSIC_PLAYLISTS[scene])scene='playing';
  if(this.scene===scene&&this.current&&!this.current.ended){
   const voice=this.voices.find(v=>v.clip===this.current);
   if(voice?.blocked){voice.blocked=false;this.start(voice);}
   return;
  }
  this.scene=scene;
  const available=MUSIC_PLAYLISTS[scene].filter(s=>!this.failed.has(s));
  const choices=available.filter(s=>s!==this.last.get(scene));if(!choices.length)choices.push(...available);if(!choices.length)return;
  const file=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))],clip=this.makeClip(root+file);if(!clip)return;
  for(const v of this.voices)v.target=0;
  while(this.voices.length>=2)this.retire(this.voices.shift());
  clip.volume=0;clip.preload='auto';clip.loop=false;
  const voice={clip,file,level:0,target:1,scene,trim:levels[file]?.gain||1,retired:false,blocked:false,pending:false};
  this.current=clip;this.last.set(scene,file);this.voices.push(voice);this.start(voice);
 }
 start(voice){
  if(voice.retired||voice.pending)return;
  const {clip,file}=voice;voice.pending=true;
  const fail=error=>{
   voice.pending=false;if(voice.retired)return;
   // Source changes abort pending play promises. Autoplay denial needs a new
   // gesture, not a new clip on every animation frame or a permanent blacklist.
   if(['AbortError','NotAllowedError'].includes(error?.name)){voice.blocked=true;return;}
   this.failed.add(file);voice.target=0;if(this.current===clip)this.current=null;clip.pause();
  };
  clip.onerror=fail;
  try{Promise.resolve(clip.play()).then(()=>{voice.pending=false;},fail);}catch(error){fail(error);}
 }
 retire(voice){voice.retired=true;voice.clip.onerror=null;voice.clip.pause();voice.clip.removeAttribute?.('src');if(!voice.clip.removeAttribute)voice.clip.src='';}
 applyGain(gain){this.gain=Math.max(0,Math.min(1,gain||0));for(const v of this.voices)v.clip.volume=this.volume(v);}
 volume(v){return Math.min(.28,({menu:.21,playing:.17,danger:.24,dead:.22}[v.scene]||.17)*this.gain*v.level*v.trim*(this.paused?.28:1));}
 update(dt,gain=this.gain){
  if(!this.paused&&(!this.current||this.current.ended))this.setScene(this.scene||'menu');
  const blend=1-Math.exp(-Math.min(.5,Math.max(0,dt))*2.6);
  for(const v of this.voices)v.level+=(v.target-v.level)*blend;
  this.applyGain(gain);
  this.voices=this.voices.filter(v=>{if(v.target===0&&v.level<.005){this.retire(v);return false;}return true;});
 }
 dispose(){for(const v of this.voices)this.retire(v);this.voices=[];this.current=null;}
}
