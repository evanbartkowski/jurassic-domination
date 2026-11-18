import test from 'node:test';import assert from 'node:assert/strict';
import {pickupSound,eventSound} from '../src/audio-presentation.js';
test('a crate with a collect receipt plays one reward cue and keeps combat cues',()=>{
 const events=[{type:'crate-find'},{type:'collect'},{type:'hit'}];
 const cues=events.map(e=>eventSound(e.type,!!pickupSound(events))).filter(Boolean);cues.push(pickupSound(events));
 assert.deepEqual(cues,['hit','collection-find']);assert.equal(eventSound('collect'),'collect');
});
test('ordinary DNA, multiple rare finds and evolution use distinct phrases',()=>{
 assert.equal(pickupSound([{type:'dna-find'}]),'dna-find');assert.equal(pickupSound([{type:'collection-find'},{type:'treasure-find'}]),'collection-find');assert.equal(pickupSound([{type:'hit'}]),null);assert.equal(eventSound('evolve'),'evolve');
});
