import * as T from 'three';
import {createDinosaur,animateCreature} from './creatures.js';
import {SPECIES_BY_ID} from './data.js';
import {naturalMaterial} from './natural-materials.js';
/** A close, cold fossil chamber, separate from the expedition's living forest. */
export function createStartVista(){
 const scene=new T.Scene();scene.background=new T.Color(0x050608);scene.fog=new T.FogExp2(0x07080b,.025);
 scene.add(new T.HemisphereLight(0x9ba9c7,0x16070a,2.2));const key=new T.DirectionalLight(0xa7c6ec,5);key.position.set(3,8,6);scene.add(key);const blood=new T.PointLight(0xff173a,180,35);blood.position.set(-4,3,-2);scene.add(blood);
 const fossil=createDinosaur({...SPECIES_BY_ID.tyrannosaurus,color:0x8c8983},true);fossil.position.set(-1,-.7,-5);fossil.rotation.y=-.6;scene.add(fossil);
 const altar=new T.Mesh(new T.CylinderGeometry(4,5.5,2,32),naturalMaterial('stone',0x343337));altar.position.set(0,-1.2,1);scene.add(altar);
 const eggGeometry=new T.SphereGeometry(1.6,36,24),ep=eggGeometry.attributes.position;for(let i=0;i<ep.count;i++){const y=ep.getY(i)/1.6,taper=1-y*.13;ep.setXYZ(i,ep.getX(i)*taper,ep.getY(i),ep.getZ(i)*taper);}eggGeometry.computeVertexNormals();
 const egg=new T.Mesh(eggGeometry,naturalMaterial('bone',0x817568));egg.scale.set(1,1.35,1);egg.position.set(0,1.4,1);scene.add(egg);
 const edges=new T.LineSegments(new T.EdgesGeometry(egg.geometry,14),new T.LineBasicMaterial({color:0x8d1725,transparent:true,opacity:.5}));edges.scale.copy(egg.scale).multiplyScalar(1.002);edges.position.copy(egg.position);scene.add(edges);
 const ashes=new T.BufferGeometry(),p=[];for(let i=0;i<110;i++)p.push(Math.sin(i*71)*13,Math.abs(Math.sin(i*43))*10,Math.cos(i*37)*12);ashes.setAttribute('position',new T.Float32BufferAttribute(p,3));const dust=new T.Points(ashes,new T.PointsMaterial({color:0xa2a8b8,size:.035,transparent:true,opacity:.35}));scene.add(dust);
 const ringMat=new T.MeshStandardMaterial({color:0x311c20,emissive:0xb21a2e,emissiveIntensity:2.5,roughness:.5});
 const rings=[];for(let i=0;i<3;i++){const ring=new T.Mesh(new T.TorusGeometry(3.6+i*.55,.025,8,96),ringMat);ring.rotation.x=-Math.PI/2;ring.position.set(0,.02+i*.08,1);scene.add(ring);rings.push(ring);}
 const pillars=[];for(let i=0;i<10;i++){const a=i/10*Math.PI*2;const rock=new T.Mesh(new T.CylinderGeometry(.35,.65,6+(i%3),5),naturalMaterial('stone',0x292832));rock.position.set((i-4.5)*2.8,1,-10-Math.abs(Math.sin(a))*4);rock.rotation.z=Math.sin(i*7)*.08;scene.add(rock);pillars.push(rock);}
 const glow=new T.PointLight(0xff7750,65,14);glow.position.set(0,3.5,2);scene.add(glow);
 const camera=new T.PerspectiveCamera(40,1,.1,150);camera.position.set(8,5.1,14);camera.lookAt(-.8,2,-1.2);
 return{scene,camera,update(dt,t,reduced){animateCreature(fossil,dt,t,0,false,0);if(!reduced){ringMat.emissiveIntensity=2.1+Math.sin(t*1.4)*.4;egg.rotation.y=Math.sin(t*.2)*.08;dust.rotation.y=t*.025;camera.position.x=8+Math.sin(t*.1)*.4;camera.lookAt(-.8,2,-1.2);}},dispose(){fossil.userData.dispose();scene.traverse(o=>{if(o===fossil||fossil.getObjectById(o.id))return;o.geometry?.dispose();o.material?.dispose();});scene.clear();}};
}
