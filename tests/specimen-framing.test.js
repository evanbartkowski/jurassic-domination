import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
const api=await import('../src/specimen-framing.js').catch(()=>({}));
test('tall long-necked and wide winged creatures fit portrait and landscape camera frusta',()=>{
 assert.equal(typeof api.fitSpecimenCamera,'function');
 for(const dimensions of [[90,65,22],[30,12,85],[6,2,1]])for(const aspect of [.6,1,1.44,2.4]){
  const model=new THREE.Mesh(new THREE.BoxGeometry(...dimensions));model.position.set(7,dimensions[1]/2,-3);model.rotation.y=-.6;
  const camera=new THREE.PerspectiveCamera(35,aspect,.05,150);const box=api.fitSpecimenCamera(camera,model);
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);assert.ok(Math.abs(p.x)<.96&&Math.abs(p.y)<.96&&p.z<1);}
 }
});
