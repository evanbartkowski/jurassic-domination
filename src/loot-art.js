import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {CRATE_TYPES,TREASURES} from './loot-data.js';
export function createTreasureModel(food){
 const root=new THREE.Group(),isCrate=food.type==='supply-crate',definition=isCrate?CRATE_TYPES[food.crateType]:TREASURES[food.findId],color=definition.color;
 root.name=isCrate?'Expedition_crate_'+food.crateType:'Treasure_'+food.findId;
 const geometries=[],materials=[],mat=(hex,metalness=0,emissive=0)=>{const m=new THREE.MeshStandardMaterial({color:hex,metalness,roughness:metalness?.38:.86,emissive,emissiveIntensity:emissive?.45:0});materials.push(m);return m;};
 const stone=mat(0x353e38),wood=mat(0x66503a),edge=mat(color,.55),dark=mat(0x151e1a,.3),light=mat(color,.45,color);
 const cube=new RoundedBoxGeometry(1,1,1,2,.045),crystal=new THREE.OctahedronGeometry(1,0);geometries.push(cube,crystal);
 const piece=(geo,material,p,s,rotation)=>{const m=new THREE.Mesh(geo,material);m.position.set(...p);m.scale.set(...s);if(rotation)m.rotation.set(...rotation);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;};
 if(isCrate){
  const high=['elder','primeval'].includes(food.crateType),base=high?stone:wood;
  piece(cube,base,[0,.68,0],[2.15,1.28,1.4]);piece(cube,dark,[0,1.23,0],[2.2,.10,1.45]);piece(cube,base,[0,1.39,0],[2.25,.25,1.52]);
  for(const x of [-.79,.79]){piece(cube,edge,[x,.76,0],[.17,1.5,1.58]);for(const z of [-.81,.81])piece(cube,dark,[x,.74,z],[.095,.99,.04]);}
  for(const z of [-.73,.73]){
   piece(cube,edge,[0,.12,z],[2.12,.12,.1]);piece(cube,edge,[0,1.5,z],[2.2,.1,.1]);
   for(const x of [-.79,.79])for(const y of [.22,1.4])piece(crystal,light,[x,y,z*1.12],[.065,.065,.035]);
  }
  piece(cube,dark,[0,1.05,.79],[.45,.56,.15]);piece(cube,edge,[0,1.05,.89],[.36,.46,.08]);piece(crystal,light,[0,1.09,.96],[.13,.18,.04]);
  for(let i=0;i<4;i++)piece(cube,dark,[0,.28+i*.25,-.716],[1.38,.025,.02]);
  const seals={field:1,hunter:2,elder:3,primeval:4}[food.crateType];
  for(let i=0;i<seals;i++)piece(crystal,light,[(i-(seals-1)/2)*.27,1.56,0],[.085,.035,.12]);
  if(high)for(const x of [-1.05,1.05])for(const z of [-.7,.7])piece(cube,edge,[x,.78,z],[.19,1.55,.19]);
 }else{
  piece(crystal,stone,[0,.42,0],[1.05,.62,.94],[.2,.5,.1]);piece(crystal,dark,[.25,.5,.26],[.7,.52,.7],[0,0,.3]);
  for(let i=0;i<7;i++){const a=i*2.4,r=.22+(i%3)*.16;piece(crystal,light,[Math.cos(a)*r,.64+(i%3)*.15,Math.sin(a)*r],[.19,.43+(i%2)*.2,.2],[.25*Math.cos(a),a,.23*Math.sin(a)]);}
 }
 const ringGeo=new THREE.RingGeometry(isCrate?1.45:1.05,isCrate?1.53:1.12,48),ringMat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false});geometries.push(ringGeo);materials.push(ringMat);
 const ring=new THREE.Mesh(ringGeo,ringMat);ring.rotation.x=-Math.PI/2;ring.position.y=.045;root.add(ring);root.userData.auraRing=ring;
 const beamGeo=new THREE.CylinderGeometry(.035,.12,6,8,1,true),beamMat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.2,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});geometries.push(beamGeo);materials.push(beamMat);
 const beam=new THREE.Mesh(beamGeo,beamMat);beam.position.y=3.1;root.add(beam);
 root.userData.dispose=()=>{for(const g of geometries)g.dispose();for(const m of materials)m.dispose();};return root;
}
