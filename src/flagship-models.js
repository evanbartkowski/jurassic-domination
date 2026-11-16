import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { SPECIES, SPECIES_BY_ID } from './data.js';
import { SKINS } from './content.js';
import { anatomyForSpecies } from './anatomy.js';
import primevalAssets from './primeval-assets.json' with {type:'json'};
const primevalIds=new Set(primevalAssets);

export const FLAGSHIP_SPECIES_IDS = new Set(['velociraptor','tyrannosaurus','triceratops','spinosaurus','ankylosaurus','stegosaurus','brachiosaurus','compsognathus','carnotaurus','dilophosaurus']);
const cache = new Map(), pending = new Map();
const references=new WeakMap(),CACHE_TARGET=24;
function trimCache(){
 for(const [url,gltf]of cache){if(cache.size<=CACHE_TARGET)break;if((references.get(gltf)||0)>0)continue;
  cache.delete(url);const geometries=new Set(),materials=new Set(),textures=new Set();gltf.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures){t.dispose();t.image?.close?.();}
 }
}
export function flagshipCacheStats(){return{entries:cache.size,referenced:[...cache.values()].filter(g=>(references.get(g)||0)>0).length,target:CACHE_TARGET,pending:pending.size};}
export const ANATOMY_SPECIES_IDS = new Set(SPECIES.map(s=>s.id));
let loader;
let hideBump;
let magmaMap;
export function moltenCracks(){
 if(magmaMap)return magmaMap;const n=256,data=new Uint8Array(n*n*4);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n*8,v=y/n*8;let nearest=9,second=9;
  for(let j=Math.floor(v)-1;j<=Math.floor(v)+1;j++)for(let i=Math.floor(u)-1;i<=Math.floor(u)+1;i++){
   const px=i+.5+Math.sin(i*71+j*43)*.34,py=j+.5+Math.sin(i*29-j*61)*.34,d=Math.hypot(u-px,v-py);if(d<nearest){second=nearest;nearest=d;}else if(d<second)second=d;
  }
  const heat=1-THREE.MathUtils.smoothstep(second-nearest,.025,.12),k=(y*n+x)*4;data[k]=255*heat;data[k+1]=170*heat;data[k+2]=30*heat;data[k+3]=255;
 }
 magmaMap=new THREE.DataTexture(data,n,n);magmaMap.wrapS=magmaMap.wrapT=THREE.RepeatWrapping;magmaMap.repeat.set(3,2);magmaMap.magFilter=THREE.LinearFilter;magmaMap.minFilter=THREE.LinearFilter;magmaMap.needsUpdate=true;return magmaMap;
}
const patterns=new Map();
function inheritedPattern(kind){
 if(!['striped','banded','speckled','mottled'].includes(kind)||typeof document==='undefined')return null;
 if(patterns.has(kind))return patterns.get(kind);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,128,128);ctx.fillStyle='#9b9387';
 for(let i=0;i<24;i++){const x=(i*47)%128,y=(i*71)%128,band=kind==='striped'||kind==='banded';ctx.beginPath();ctx.ellipse(x,y,band?5:3+(i%4),band?38:3+(i%3),-.45,0,Math.PI*2);ctx.fill();}
 const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(3,3);texture.colorSpace=THREE.SRGBColorSpace;patterns.set(kind,texture);return texture;
}
function anatomicalBump(){
 if(hideBump)return hideBump;const n=256,data=new Uint8Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const row=Math.floor(y/16),u=((x+(row%2)*8)%16-8)/8,v=(y%16-8)/8;
  const radius=Math.sqrt(u*u+v*v),grain=Math.sin(x*17.1+y*31.7)*Math.sin(x*8.7-y*13.3);
  data[y*n+x]=Math.round(90+100*(1-THREE.MathUtils.smoothstep(radius,.68,1.04))+grain*11);
 }
 hideBump=new THREE.DataTexture(data,n,n,THREE.RedFormat);hideBump.wrapS=hideBump.wrapT=THREE.RepeatWrapping;hideBump.repeat.set(5,5);hideBump.needsUpdate=true;return hideBump;
}

export function getFlagshipGLTF(id, onLoaded) {
  if (typeof window === 'undefined' || !ANATOMY_SPECIES_IDS.has(id)) return;
  const url = `${import.meta.env?.BASE_URL || './'}assets/models-v${primevalIds.has(id)?4:3}/${id}.glb`;
  if (cache.has(url)) {const gltf=cache.get(url);cache.delete(url);cache.set(url,gltf);onLoaded?.(gltf);trimCache();return; }
  if (pending.has(url)) { if (onLoaded) pending.get(url).push(onLoaded); return; }
  pending.set(url, onLoaded ? [onLoaded] : []);
  (loader ||= new GLTFLoader()).load(url, gltf => {
    cache.set(url, gltf);
    const callbacks = pending.get(url) || []; pending.delete(url);
    for (const callback of callbacks) callback(gltf);
    trimCache();
  }, undefined, () => { pending.delete(url); });
}

/** Independent skeletons; cached geometry/materials remain shared and read-only. */
export function prepareFlagshipAsset(gltf, targetLength) {
  const root = new THREE.Group(), surface = clone(gltf.scene);
  let forwardX=false,version=3;surface.traverse(o=>{if(o.userData?.forwardAxis==='X')forwardX=true;version=Math.max(version,o.userData?.sourceVersion||3);});
  surface.rotation.y = forwardX?0:-Math.PI / 2;
  surface.traverse(o => {
    if (/pedestal|camera|light/i.test(o.name)) o.visible = false;
    if(/Surface_LOD1/.test(o.name))o.visible=false;
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  root.add(surface); root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(surface);
  const length = box.getSize(new THREE.Vector3()).x;
  const factor = targetLength / Math.max(.001, length);
  surface.scale.setScalar(factor);
  surface.position.set(-(box.min.x + box.max.x) * .5 * factor, -box.min.y * factor, -(box.min.z + box.max.z) * .5 * factor);
  const mixer = new THREE.AnimationMixer(surface), actions = {};
  for (const clip of gltf.animations || []) {
    const name = clip.name.split('_').at(-1);
    actions[name] = mixer.clipAction(clip).setEffectiveWeight(0).play();
  }
  actions.Idle?.setEffectiveWeight(1);
  const detailMeshes=[[],[]];surface.traverse(o=>{if(o.isMesh&&/Surface_LOD[01]/.test(o.name))detailMeshes[/LOD1/.test(o.name)?1:0].push(o);});
  return { root, surface, mixer, actions, version, detailMeshes };
}

export function setCreatureDetail(model,level=0){const asset=model.userData?.flagshipAsset;if(!asset?.detailMeshes?.[1].length)return;level=level?1:0;if(asset.detailLevel===level)return;asset.detailLevel=level;for(let i=0;i<2;i++)for(const mesh of asset.detailMeshes[i])mesh.visible=i===level;}

/** Keep exported texture sets read-only; each actor owns only its material clone. */
export function cloneAnatomyMaterial(original,data,skin){
 const material=original.clone();
 if(/^Hide/.test(original.name)){
  if(data.version>=4){
   material.vertexColors=false;material.metalness=0;
   if(data.skinId!=='natural')material.color.lerp(new THREE.Color(skin.color??data.species.color),.72);
   else if(data.species.color!==SPECIES_BY_ID[data.species.id]?.color&&SPECIES_BY_ID[data.species.id])material.color.lerp(new THREE.Color(data.species.color),.58);
   const pigment=Number(data.genomeKey?.split(':')[0])||0;material.color.multiplyScalar(1+pigment*.012);
   const pattern=data.genomeKey?.split(':')[1];
   if(['striped','banded','mottled','speckled'].includes(pattern)){
    material.onBeforeCompile=shader=>{
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 primevalPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nprimevalPosition=position;');
     const field=pattern==='speckled'?'step(.85,sin(primevalPosition.x*51.)*sin(primevalPosition.z*49.))':pattern==='mottled'?'smoothstep(.3,.9,sin(primevalPosition.x*8.+sin(primevalPosition.z*9.)))':'smoothstep(.3,.7,sin(primevalPosition.x*7.+primevalPosition.z*2.))';
     shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 primevalPosition;').replace('#include <color_fragment>',`#include <color_fragment>\ndiffuseColor.rgb*=1.-.12*(${field});`);
    };material.customProgramCacheKey=()=>`primeval-${pattern}`;
   }
  }else{
   material.bumpMap=anatomicalBump();material.bumpScale=.018;material.roughness=.83;
   if(data.skinId!=='natural'){material.vertexColors=false;material.color.setHex(skin.color??data.species.color);}
   else if(data.species.color!==SPECIES_BY_ID[data.species.id]?.color){material.vertexColors=false;material.color.setHex(data.species.color);}
   else {const hue=Number(data.genomeKey?.split(':')[0])*.0225||0;material.color.setHSL(.10+hue,.04,.94);}
   material.map=inheritedPattern(data.genomeKey?.split(':')[1]);
  }
  if(data.eventLook==='molten'){material.vertexColors=false;material.color.setHex(0x171719);material.map=null;material.emissive.setHex(0xff6a16);material.emissiveMap=moltenCracks();material.emissiveIntensity=2.4;material.roughness=.92;}
 }
 if(data.eventLook==='molten'&&/Eye|Horn|Spine/i.test(original.name)){material.emissive?.setHex(0xff5b08);material.emissiveIntensity=1.5;}
 return material;
}

export function updateFlagshipAnimation(asset, dt, speed = 0, attacking = false, sleeping = false, feeding = false) {
  const { mixer, actions } = asset;
  if(attacking&&!asset.wasAttacking&&actions.Attack){actions.Attack.reset().setLoop(THREE.LoopOnce,1).play();actions.Attack.clampWhenFinished=true;}
  asset.wasAttacking=attacking;
  const move = Math.min(1, speed), run = THREE.MathUtils.smoothstep(speed, .65, 1.3);
  const weights = sleeping ? { Rest: 1 } : attacking && actions.Attack ? { Attack: 1 } : feeding && actions.Graze ? { Graze: 1 } : { Idle: 1 - move, Walk: move * (1 - run), Run: move * run };
  for (const [name, action] of Object.entries(actions)) action.setEffectiveWeight(THREE.MathUtils.damp(action.getEffectiveWeight(), weights[name] || 0, 10, dt));
  mixer.timeScale = attacking?(asset.version>=4?4.7:2.1):sleeping ? .7 : asset.gaitRate&&speed>.1?asset.gaitRate:.8 + Math.min(1.6, speed) * .45;
  mixer.update(Math.min(.1, dt));
}

export function tryAttachFlagshipGLB(model, speciesId) {
  // Preserve the established custom skins and inherited marking materials.
  if (!model || !ANATOMY_SPECIES_IDS.has(speciesId)) return;
  const data = model.userData;
  const originalDispose = data.dispose;
  if (!data.flagshipDisposeWrapped) {
    data.flagshipDisposeWrapped = true;
    data.dispose = () => {
      data.artDisposed = true;
      data.flagshipAsset?.mixer.stopAllAction();
      if (data.flagshipAsset) data.flagshipAsset.mixer.uncacheRoot(data.flagshipAsset.surface);
      const skeletons = new Set();
      data.flagshipAsset?.surface.traverse(o => { if (o.isSkinnedMesh) skeletons.add(o.skeleton); });
      for (const skeleton of skeletons) skeleton.dispose();
      for(const material of data.anatomyMaterials||[])material.dispose();
      if(data.flagshipTemplate){references.set(data.flagshipTemplate,Math.max(0,(references.get(data.flagshipTemplate)||1)-1));data.flagshipTemplate=null;trimCache();}
      originalDispose?.();
    };
  }
  getFlagshipGLTF(speciesId, gltf => {
    if (data.artDisposed || model.userData !== data || data.species?.id !== speciesId || data.flagshipAsset) return;
    // Root already carries species size and individual growth; normalize once.
    const profile=anatomyForSpecies(data.species);
    const targetLength = profile.length;
    const asset = prepareFlagshipAsset(gltf, targetLength);
    data.flagshipTemplate=gltf;references.set(gltf,(references.get(gltf)||0)+1);
    const skin=SKINS.find(s=>s.id===data.skinId)||SKINS[0],materials=new Map();
    asset.surface.traverse(o=>{
      if(!o.material)return;
      const shade=original=>{
        if(materials.has(original))return materials.get(original);
        const material=cloneAnatomyMaterial(original,{...data,version:asset.version},skin);
        materials.set(original,material);return material;
      };
      o.material=Array.isArray(o.material)?o.material.map(shade):shade(o.material);
    });
    data.anatomyMaterials=[...materials.values()];data.anatomyProfile=profile;
    data.flagshipAsset = asset; data.glbContainer = asset.root; data.isGLB = true;
    data.body.visible = false; model.add(asset.root);
    const head=asset.surface.getObjectByName('head');
    if(head){
      model.updateMatrixWorld(true);const anchor=new THREE.Group();anchor.name='Cosmetic_attachment';head.add(anchor);
      const orientation=model.getWorldQuaternion(new THREE.Quaternion()),position=head.getWorldPosition(new THREE.Vector3());
      position.add(new THREE.Vector3(profile.skull[0]*.24,profile.skull[2]*.86,0).multiply(model.getWorldScale(new THREE.Vector3())).applyQuaternion(orientation));
      // Seat wearables on the actual scalp, including the export's normalization
      // and species morphology. A fixed offset can visibly float above the head.
      asset.surface.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
      const rayOrigin=position.clone();rayOrigin.y+=profile.skull[2]*4*model.getWorldScale(new THREE.Vector3()).y;
      const hit=new THREE.Raycaster(rayOrigin,new THREE.Vector3(0,-1,0)).intersectObject(asset.surface,true)[0];if(hit)position.y=hit.point.y;
      anchor.position.copy(head.worldToLocal(position));anchor.quaternion.copy(head.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(orientation));
      anchor.scale.setScalar(Math.max(.4,Math.min(1,profile.skull[1]/.3)));data.cosmeticAnchor=anchor;if(data.cosmetic){data.cosmetic.position.y=-.05;anchor.add(data.cosmetic);}
    }
    data.onAssetReady?.();
  });
}

export function animateFlagshipGLB(model, dt, time, speed, attacking, turn) {
  const d = model.userData;
  if (!d?.flagshipAsset) return;
  if(d.flagshipAsset.version>=4){const scale=model.getWorldScale(new THREE.Vector3()).x,stride=(d.anatomyProfile?.hip||1.3)*scale*2.4;d.flagshipAsset.gaitRate=THREE.MathUtils.clamp((d.worldSpeed||0)/Math.max(.1,stride)*2,.8,8);}
  updateFlagshipAnimation(d.flagshipAsset, dt, speed, attacking, d.isSleeping, d.isFeeding);
  const root = d.glbContainer;
  root.rotation.y = THREE.MathUtils.damp(root.rotation.y, attacking&&d.combatKind==='tail-sweep'?Math.sin(d.flagshipAsset.mixer.time*8)*.65:-turn*.07, 8, dt);
  root.rotation.z = THREE.MathUtils.damp(root.rotation.z,d.combatWindup?-.035:0,8,dt);
  root.position.x = THREE.MathUtils.damp(root.position.x, attacking ? .12 : 0, 12, dt);
}
