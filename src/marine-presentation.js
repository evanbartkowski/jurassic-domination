import * as T from 'three';
import {anatomyForSpecies} from './anatomy.js';
import {tryAttachFlagshipGLB,animateFlagshipGLB} from './flagship-models.js';

// Shared loading silhouettes avoid generating three elaborate procedural animals
// synchronously whenever a background pool streams in.
const bodyGeometry=new T.SphereGeometry(1,16,8),finGeometry=new T.ConeGeometry(1,1,3);
export function createMarineActor(species){
 const root=new T.Group(),body=new T.Group(),profile=anatomyForSpecies(species),material=new T.MeshStandardMaterial({color:species.color,roughness:.65});root.add(body);
 const hull=new T.Mesh(bodyGeometry,material);hull.scale.set(profile.length*.35,profile.depth*.7,profile.width*.65);body.add(hull);
 const head=new T.Group();head.position.x=profile.length*.28;body.add(head);
 const skull=new T.Mesh(bodyGeometry,material);skull.scale.set(profile.skull[0]*.55,profile.skull[2]*.7,profile.skull[1]*.8);head.add(skull);
 const tail=new T.Group();tail.position.x=-profile.length*.3;body.add(tail);
 const blade=new T.Mesh(finGeometry,material);blade.scale.set(profile.depth,profile.length*.27,.07);blade.rotation.z=Math.PI/2;blade.position.x=-profile.length*.08;tail.add(blade);
 root.userData={species,skinId:'natural',body,head,tail,tails:[tail],baseScale:1,phase:[...species.id].reduce((n,c)=>n+c.charCodeAt(0),0)*.17,isMarineProxy:true,dispose:()=>material.dispose()};
 tryAttachFlagshipGLB(root,species.id);
 return root;
}
export function animateMarineActor(model,dt,time,speed,attacking){
 const d=model.userData;d.worldSpeed=speed*d.species.speed;
 if(d.isGLB)animateFlagshipGLB(model,dt,time,speed,attacking,0);
 else d.tail.rotation.y=Math.sin(time*(2+speed*3)+(d.phase||0))*.15;
}
