import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {SPECIES,SPECIES_BY_ID} from '../src/data.js';
import {cloneAnatomyMaterial} from '../src/flagship-models.js';
const api=await import('../src/creature-palettes.js').catch(()=>({}));
test('every natural species has a stable colorful palette with contrasting markings',()=>{
 assert.equal(typeof api.naturalPaletteForSpecies,'function');const colors=new Set();
 for(const s of SPECIES){const a=api.naturalPaletteForSpecies(s),b=api.naturalPaletteForSpecies(s);assert.deepEqual(a,b);assert.notEqual(a.color,a.accent);assert.ok(a.pattern);assert.ok(a.strength>.6&&a.strength<=.9);const hsl={};new THREE.Color(a.color).getHSL(hsl);assert.ok(hsl.s>=.30,s.id);colors.add(a.color);}
 assert.ok(colors.size>=25);assert.notEqual(api.naturalPaletteForSpecies(SPECIES_BY_ID.troodon).color,api.naturalPaletteForSpecies(SPECIES_BY_ID.tyrannosaurus).color);
});
test('natural pigment is per actor, retains detailed PBR maps, and leaves source atlases unchanged',()=>{
 const original=new THREE.MeshStandardMaterial({name:'Hide_PBR',map:new THREE.Texture(),normalMap:new THREE.Texture(),roughnessMap:new THREE.Texture()});
 const material=cloneAnatomyMaterial(original,{version:5,skinId:'natural',species:SPECIES_BY_ID.troodon,genomeKey:'0:plain'},{id:'natural'});
 assert.equal(material.userData.naturalPalette,'troodon');assert.equal(material.map,original.map);assert.equal(material.normalMap,original.normalMap);assert.equal(material.roughnessMap,original.roughnessMap);assert.equal(original.color.getHex(),0xffffff);assert.equal(original.userData.naturalPalette,undefined);
 const source={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>'};material.onBeforeCompile(source);
 assert.ok(source.uniforms.skinBlend.value>.6);assert.ok(source.fragmentShader.includes('skinMask'));assert.equal(material.metalness,0);
});
test('species share a pattern program while keeping separate colors, and molten event looks stay explicit',()=>{
 const source=new THREE.MeshStandardMaterial({name:'Hide_PBR'}),make=id=>cloneAnatomyMaterial(source,{version:5,skinId:'natural',species:SPECIES_BY_ID[id],genomeKey:'0:plain'},{id:'natural'});
 const a=make('tyrannosaurus'),b=make('troodon'),shader=()=>({uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',fragmentShader:'#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>'}),sa=shader(),sb=shader();a.onBeforeCompile(sa);b.onBeforeCompile(sb);
 assert.equal(a.customProgramCacheKey(),b.customProgramCacheKey());assert.notEqual(sa.uniforms.skinBase.value.getHex(),sb.uniforms.skinBase.value.getHex());
 const molten=cloneAnatomyMaterial(source,{version:5,skinId:'natural',species:SPECIES_BY_ID.tyrannosaurus,genomeKey:'0:plain',eventLook:'molten'},{id:'natural'});assert.equal(molten.userData.naturalPalette,undefined);assert.equal(molten.emissive.getHex(),0xff6a16);assert.equal(molten.emissiveIntensity,2.4);
});
