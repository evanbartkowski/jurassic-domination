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

test('face framing isolates the skull and jaw and follows their skeletal pose',()=>{
 assert.equal(typeof api.specimenHeadBounds,'function');
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([-12,0,0,0,0,0,3,2,-.5,5,3,.5,4,1,0],3));
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0],4));
 geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
 const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());
 const root=new THREE.Bone(),head=new THREE.Bone(),jaw=new THREE.Bone();head.name='head';jaw.name='jaw';root.add(head);head.add(jaw);mesh.add(root);
 mesh.bind(new THREE.Skeleton([root,head,jaw]));
 const model=new THREE.Group();model.add(mesh);
 assert.deepEqual(api.specimenHeadBounds(model).min.toArray(),[3,1,-.5]);
 assert.deepEqual(api.specimenHeadBounds(model).max.toArray(),[5,3,.5]);
 head.position.x=2;
 assert.deepEqual(api.specimenHeadBounds(model).min.toArray(),[5,1,-.5]);
 assert.deepEqual(api.specimenHeadBounds(model).max.toArray(),[7,3,.5]);
 geometry.dispose();mesh.material.dispose();mesh.skeleton.dispose();
});
