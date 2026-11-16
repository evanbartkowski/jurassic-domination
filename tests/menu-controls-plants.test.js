import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_BINDINGS,actionHeld} from '../src/controls.js';
import {updateWildlife} from '../src/wilderness.js';
test('Shift only sprints and R only dashes by default',()=>{assert.equal(DEFAULT_BINDINGS.sprint,'ShiftLeft');assert.equal(DEFAULT_BINDINGS.dash,'KeyR');assert.equal(DEFAULT_BINDINGS.technique,'ControlLeft');assert.equal(actionHeld('dash',new Set(['ShiftLeft']),null),false);assert.equal(actionHeld('sprint',new Set(['KeyR']),null),false);});
function fixture(){const plant={id:'snap',type:'carnivore',x:0,y:0,radius:2,tier:0,phase:0};let hits=0;const game={time:10,player:{x:4,y:0,vx:0,vy:0},species:{size:1},worldFeatures:[plant],rules:{enemyDamage:1},damagePlayer(){hits++;},emit(){}};return {plant,game,hits:()=>hits};}
test('snapjaw warns before hitting, locks its aim and allows a sidestep',()=>{const f=fixture();updateWildlife(f.game,.01);assert.equal(f.hits(),0);assert.ok(f.plant.attackDueAt>f.game.time);f.game.player.x=0;f.game.player.y=4;f.game.time+=.8;updateWildlife(f.game,.8);assert.equal(f.hits(),0);assert.equal(f.plant.lastStrike,f.game.time);});
test('snapjaw hits after windup if the player stays in its strike',()=>{const f=fixture();updateWildlife(f.game,.01);f.game.time+=.8;updateWildlife(f.game,.8);assert.equal(f.hits(),1);updateWildlife(f.game,.01);assert.equal(f.hits(),1);});
