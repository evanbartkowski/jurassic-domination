import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {createStartVista} from '../src/start-vista.js';
test('the boot shot owns only its lightweight scene and freezes ambient motion when requested',()=>{
 const texture=new THREE.DataTexture(new Uint8Array([80,100,80,255]),1,1);let externalDisposed=false;texture.addEventListener('dispose',()=>externalDisposed=true);
 const vista=createStartVista({texture});assert.ok(vista.ready);assert.equal(vista.scene.children.length,1);
 const mesh=vista.scene.children[0];assert.equal(mesh.geometry.index.count/3,2);
 vista.camera.aspect=2.4;vista.update(.016,50,false);assert.equal(vista.uniforms.screenAspect.value,2.4);assert.equal(vista.uniforms.time.value,50);
 vista.update(.016,60,true);assert.equal(vista.uniforms.time.value,0);
 let geometryDisposed=false;mesh.geometry.addEventListener('dispose',()=>geometryDisposed=true);vista.dispose();assert.ok(geometryDisposed);assert.equal(vista.scene.children.length,0);assert.equal(externalDisposed,false);texture.dispose();
});
