import * as THREE from 'three';
export function visibleSpecimenBounds(model){
 model.updateMatrixWorld(true);const box=new THREE.Box3();
 model.traverseVisible(o=>{if(!o.isMesh)return;if(o.isSkinnedMesh)o.computeBoundingBox();else if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const local=o.isSkinnedMesh?o.boundingBox:o.geometry.boundingBox;if(local)box.union(local.clone().applyMatrix4(o.matrixWorld));});
 return box;
}
/** Head-weighted vertices keep face inspection independent of tails and wings. */
export function specimenHeadBounds(model){
 model.updateMatrixWorld(true);
 const box=new THREE.Box3(),point=new THREE.Vector3();
 model.traverseVisible(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const {position,skinIndex,skinWeight}=mesh.geometry.attributes;
  if(!skinIndex||!skinWeight)return;
  mesh.skeleton.update();
  const headBones=new Set(mesh.skeleton.bones.map((bone,index)=>['head','jaw'].includes(bone.name)?index:-1).filter(index=>index>=0));
  for(let i=0;i<position.count;i++){
   let weight=0;
   for(let j=0;j<4;j++)if(headBones.has(skinIndex.getComponent(i,j)))weight+=skinWeight.getComponent(i,j);
   if(weight<.65)continue;
   mesh.getVertexPosition(i,point);mesh.localToWorld(point);box.expandByPoint(point);
  }
 });
 return box;
}
/** Perspective-correct fit includes depth, oblique view and the camera far plane. */
export function fitSpecimenCamera(camera,model,{padding=1.22,direction=new THREE.Vector3(.25,.18,1),orbit=false}={}){
 const box=model.isBox3?model.clone():visibleSpecimenBounds(model);if(box.isEmpty())return box;
 const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 if(orbit){const radius=Math.hypot(size.x,size.z)/2;box.min.x=center.x-radius;box.max.x=center.x+radius;box.min.z=center.z-radius;box.max.z=center.z+radius;}
 const dir=direction.clone().normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right),tanY=Math.tan(THREE.MathUtils.degToRad(camera.fov)/2),tanX=tanY*camera.aspect;
 let distance=.1;
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const p=new THREE.Vector3(x,y,z).sub(center),depth=p.dot(dir);distance=Math.max(distance,Math.abs(p.dot(right))/tanX+depth,Math.abs(p.dot(up))/tanY+depth);
 }
 distance*=padding;camera.position.copy(center).addScaledVector(dir,distance);camera.lookAt(center);camera.near=Math.max(.01,distance/10000);camera.far=Math.max(150,distance+box.getSize(new THREE.Vector3()).length()*3);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return box;
}
