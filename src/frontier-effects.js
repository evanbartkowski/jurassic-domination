import * as T from 'three';
import {groundHeight} from './frontier-map.js';
import {moltenCracks} from './flagship-models.js';
const dispose=root=>root.traverse(o=>{o.geometry?.dispose();for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])m.dispose();});
function groundRing(x,y,inner,outer,color,opacity=.8){
 const g=new T.RingGeometry(inner,outer,80);g.rotateX(-Math.PI/2);const p=g.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,groundHeight(x+p.getX(i),y+p.getZ(i))+.14);g.computeVertexNormals();
 const m=new T.Mesh(g,new T.MeshBasicMaterial({color,transparent:true,opacity,side:T.DoubleSide,depthWrite:false}));m.position.set(x,0,y);return m;
}
export class IncidentPresentation{
 constructor(scene){this.scene=scene;this.nodes=new Map();}
 clear(){for(const o of this.nodes.values()){this.scene.remove(o);dispose(o);}this.nodes.clear();}
 update(game,settings={}){
  const keys=new Set(),state=game?.frontierState,now=game?.time||0;
  const keep=(id,make)=>{keys.add(id);if(!this.nodes.has(id)){const node=make();this.nodes.set(id,node);this.scene.add(node);}return this.nodes.get(id);};
  if(state){
   for(const c of state.craters){if(Math.hypot(c.x-game.player.x,c.y-game.player.y)>200)continue;
    const root=keep(c.id,()=>{const root=new T.Group();root.add(groundRing(c.x,c.y,c.radius*.75,c.radius,0x28201b,1),groundRing(c.x,c.y,.1,c.radius*.75,0xd43108,.87));root.children[1].material.dispose();root.children[1].material=new T.MeshStandardMaterial({color:0x271b14,emissive:0xff5a0b,emissiveMap:moltenCracks(),emissiveIntensity:2.6,roughness:.8,side:T.DoubleSide});
     for(let i=0;i<28;i++){const a=i*Math.PI*2/28,r=i<16?c.radius*.94:c.radius*(.25+(i%3)*.19);const rock=new T.Mesh(new T.DodecahedronGeometry(1,0),new T.MeshStandardMaterial({color:0x201d20,emissive:0x5a1306,roughness:.95}));rock.position.set(c.x+Math.cos(a)*r,groundHeight(c.x+Math.cos(a)*r,c.y+Math.sin(a)*r)+.3,c.y+Math.sin(a)*r);rock.scale.set(2+i%3,1+i%2,1.8);root.add(rock);}return root;});root.children[1].material.emissiveIntensity=2.2+Math.sin(now*1.7)*.25;
   }
   const a=state.active;
   if(a?.kind==='meteor'&&!a.processed){const remaining=a.dueAt-now;
    const root=keep(a.id+':warning',()=>{const root=new T.Group();root.add(groundRing(a.x,a.y,a.radius-1,a.radius+.5,0xff6b26),groundRing(a.x,a.y,.1,a.radius,0xba2614,.16));const meteor=new T.Mesh(new T.IcosahedronGeometry(2.4,1),new T.MeshStandardMaterial({color:0x331b18,emissive:0xff5309,emissiveIntensity:2}));meteor.name='Falling_meteor';root.add(meteor);const trail=new T.Mesh(new T.ConeGeometry(1.8,18,10),new T.MeshBasicMaterial({color:0xffaa39,transparent:true,opacity:.65,depthWrite:false}));root.add(trail);return root;});
    root.children[0].material.opacity=.65+Math.sin(now*5)*.2;root.children[2].visible=root.children[3].visible=remaining<6;
    const meteor=root.children[2];meteor.position.set(a.x-remaining*6,groundHeight(a.x,a.y)+Math.max(0,remaining)*15,a.y-remaining*3);meteor.rotation.set(now,now*.7,0);root.children[3].position.copy(meteor.position).add(new T.Vector3(-3,9,-1.5));root.children[3].rotation.z=.38;
   }
   if(a?.kind==='lightning')for(const b of a.strikes){const delta=b.dueAt-now;if(delta<-.5)continue;
    const root=keep(b.id,()=>{const root=new T.Group();root.add(groundRing(b.x,b.y,3.5,4.3,0xcce5ff),groundRing(b.x,b.y,.1,3.5,0xa1cfff,.13));
     const points=Array.from({length:10},(_,i)=>new T.Vector3(b.x+(i===9?0:Math.sin(i*71)*2.2),groundHeight(b.x,b.y)+(9-i)*5+.2,b.y+(i===9?0:Math.cos(i*37)*1.5)));
     root.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),28,.16,5,false),new T.MeshBasicMaterial({color:0xd3edff})));return root;});
    root.children[0].material.opacity=.7+Math.sin(now*8)*.15;root.children[2].visible=delta<=0;root.children[0].visible=root.children[1].visible=delta>0;
   }
  }
  for(const [id,node]of this.nodes)if(!keys.has(id)){this.scene.remove(node);dispose(node);this.nodes.delete(id);}
 }
 dispose(){this.clear();}
}
/** Opaque, elevated strokes remain readable with decorative particles disabled. */
export function createAttackStroke(event){
 const group=new T.Group(),radius=Math.max(2,event.radius||3),enemy=event.type==='enemy-strike',color=enemy?0xf94328:event.ability==='venom'?0xa2e552:event.ability==='flame'?0xff671b:0xffdfad;
 group.position.set(event.x||0,groundHeight(event.x||0,event.y||0)+.3,event.y||0);group.rotation.y=-(event.angle||0);
 const strokes=event.type==='attack'?3:2;
 for(let k=0;k<strokes;k++){
  const p=[],idx=[],r=radius*(.68+k*.12),width=.12+radius*.035;
  for(let i=0;i<=24;i++){const a=-.9+i/24*1.8,fade=Math.sin(i/24*Math.PI),x=Math.cos(a)*r,z=Math.sin(a)*r; p.push(x,.5+k*.25+fade*.9,z,x,.5+k*.25+fade*.9+width*fade,z);if(i<24){const j=i*2;idx.push(j,j+1,j+2,j+1,j+3,j+2);}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();const mesh=new T.Mesh(g,new T.MeshBasicMaterial({color,side:T.DoubleSide,transparent:true,opacity:.95,depthWrite:false}));mesh.name='Attack_claw_stroke';group.add(mesh);
 }
 return{group,life:.46,max:.46,update(dt,progress){group.rotation.y=-(event.angle||0)+(progress-.3)*.5;for(const m of group.children)m.material.opacity=Math.max(0,(1-progress)*1.15);}};
}
