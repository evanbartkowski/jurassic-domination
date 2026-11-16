import test from 'node:test';import assert from 'node:assert/strict';
const music=await import('../src/music-director.js').catch(()=>({}));
import {AudioEngine}from'../src/audio.js';
class Clip{constructor(src){this.src=src;this.volume=0;this.currentTime=0;this.paused=true;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}}
test('actual nearby aggression starts combat music and holds it through a brief lull',()=>{
 const a=new AudioEngine();a.recordedMusic=new music.MusicDirector({makeClip:src=>new Clip(src)});a.unlocked=true;a.setMode('playing');
 const g={state:'playing',player:{x:0,y:0},entities:[{hp:20,x:12,y:0,aggro:5}]};a.update(.016,g);assert.equal(a.recordedMusic.scene,'danger');
 g.entities=[];a.update(2,g);assert.equal(a.recordedMusic.scene,'danger');a.update(7,g);assert.equal(a.recordedMusic.scene,'playing');a.dispose();
});
test('supplied background music crossfades quietly and death chooses a lament',()=>{
 assert.equal(typeof music.MusicDirector,'function');const d=new music.MusicDirector({makeClip:src=>new Clip(src)});d.setScene('menu');d.update(.5,1);assert.ok(d.current);assert.ok(d.current.volume>0&&d.current.volume<=.28);
 const menu=d.current;d.setScene('dead');for(let i=0;i<60;i++)d.update(1/60,1);assert.notEqual(d.current,menu);assert.match(d.current.src,/bittersweet/);assert.ok(menu.volume<.20);
 d.dispose();assert.equal(d.current,null);
});
test('muting affects an already-playing music track immediately and never creates extra voices',()=>{
 assert.equal(typeof music.MusicDirector,'function');const d=new music.MusicDirector({makeClip:src=>new Clip(src)});d.setScene('playing');d.update(.3,1);const clip=d.current;
 d.update(.01,0);assert.equal(clip.volume,0);for(let i=0;i<100;i++)d.setScene('playing');assert.equal(d.voices.length,1);d.dispose();
});
