import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, DEFAULT_SETTINGS } from '../src/profile.js';
import { gamepadIntent } from '../src/controls.js';
import { WorldRenderer } from '../src/renderer.js';

test('player comfort and real graphics settings survive bounded normalization',()=>{
 const s=normalizeSettings({fpsLimit:30,renderScale:.7,particles:.4,cameraSmoothing:false,showFPS:true,ambient:.2,uiVolume:.3,muted:true,muteUnfocused:false,autoPause:false,highContrast:true,flashes:false,captions:true,tutorialHints:false,interactionPrompts:false,deadzone:.3,autosaveInterval:30});
 for(const [key,value] of Object.entries({fpsLimit:30,renderScale:.7,particles:.4,cameraSmoothing:false,showFPS:true,ambient:.2,uiVolume:.3,muted:true,muteUnfocused:false,autoPause:false,highContrast:true,flashes:false,captions:true,tutorialHints:false,interactionPrompts:false,deadzone:.3,autosaveInterval:30}))assert.equal(s[key],value,key);
 const bad=normalizeSettings({fpsLimit:17,renderScale:9,particles:-2,deadzone:Infinity,autosaveInterval:0});
 assert.equal(bad.fpsLimit,DEFAULT_SETTINGS.fpsLimit);assert.equal(bad.renderScale,1.25);assert.equal(bad.particles,0);assert.equal(bad.deadzone,DEFAULT_SETTINGS.deadzone);assert.equal(bad.autosaveInterval,DEFAULT_SETTINGS.autosaveInterval);
});

test('adjustable controller deadzone filters drift and preserves full input range',()=>{
 const pad={connected:true,mapping:'standard',axes:[.25,0,0,0],buttons:[]};
 assert.equal(gamepadIntent(pad,.3).x,0);
 pad.axes[0]=1;assert.equal(gamepadIntent(pad,.3).x,1);
 assert.equal(gamepadIntent(pad,.3).connected,true);
});

test('zero particle density suppresses decorative emission without changing simulation',()=>{
 const world=Object.assign(Object.create(WorldRenderer.prototype),{settings:{quality:'high',particles:0}});
 assert.equal(world.emitCount(100, .1),0);
});
