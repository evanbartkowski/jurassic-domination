import * as THREE from 'three';
import { SPECIES } from './data.js';

const lookup = id => SPECIES.find(s => s.id === id) || SPECIES[0];
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
function random(seed=7281) { return () => { seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296; }; }
const sphere = new THREE.IcosahedronGeometry(1,1);
const smoothSphere = new THREE.SphereGeometry(1,12,8);
const cone = new THREE.ConeGeometry(1,1,7);
const cylinder = new THREE.CylinderGeometry(1,1,1,7);
const box = new THREE.BoxGeometry(1,1,1);
const materialCache = new Map();
let surfaceTexture;
function mottledTexture(){
  if(surfaceTexture)return surfaceTexture;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),rand=random(510);
  ctx.fillStyle='#dad8cc';ctx.fillRect(0,0,128,128);
  for(let i=0;i<1700;i++){const v=Math.floor(165+rand()*80);ctx.fillStyle=`rgba(${v},${v},${v},${.12+rand()*.2})`;ctx.beginPath();ctx.ellipse(rand()*128,rand()*128,1+rand()*3,1+rand()*2,0,0,6.28);ctx.fill();}
  surfaceTexture=new THREE.CanvasTexture(canvas);surfaceTexture.colorSpace=THREE.SRGBColorSpace;surfaceTexture.wrapS=surfaceTexture.wrapT=THREE.RepeatWrapping;surfaceTexture.repeat.set(2,1);return surfaceTexture;
}
function groundTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1024;const ctx=canvas.getContext('2d'),rand=random(34);
  ctx.fillStyle='#c0c1a2';ctx.fillRect(0,0,1024,1024);
  for(let i=0;i<25000;i++){
    const x=rand()*1024,y=rand()*1024,v=100+Math.floor(rand()*100),r=.5+rand()*3;
    ctx.fillStyle=`rgba(${v},${v+7},${v-6},${.1+rand()*.2})`;ctx.fillRect(x,y,r,r*.5);
  }
  for(let i=0;i<1800;i++){
    const x=rand()*1024,y=rand()*1024;ctx.strokeStyle=rand()>.5?'#75916655':'#e1d2a533';ctx.lineWidth=.7+rand();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*6,y-2-rand()*6);ctx.stroke();
  }
  for(let i=0;i<45;i++){
    const x=rand()*1024,y=rand()*1024,r=15+rand()*70,gradient=ctx.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,'#5c70564d');gradient.addColorStop(1,'#5c705600');ctx.fillStyle=gradient;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(25,25);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function fernGeometry(){
  const vertices=[];
  for(let frond=0;frond<7;frond++){
    const a=frond/7*Math.PI*2,l=.7+(frond%3)*.12,dir=new THREE.Vector3(Math.cos(a),0,Math.sin(a)),side=new THREE.Vector3(-dir.z,0,dir.x);
    for(let leaf=1;leaf<7;leaf++){
      const t=leaf/7,width=Math.sin(t*Math.PI)*.22,center=dir.clone().multiplyScalar(t*l);center.y=Math.sin(t*Math.PI*.8)*.65;
      for(const sign of [-1,1]){
        const tip=center.clone().addScaledVector(side,width*sign).addScaledVector(dir,-.1),next=center.clone().addScaledVector(dir,.14);tip.y-=.08;
        vertices.push(...center.toArray(),...tip.toArray(),...next.toArray());
      }
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();return geo;
}
function material(color,emissive=0) {
  const key=`${color}-${emissive}`;
  if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,map:mottledTexture(),roughness:.83,flatShading:true,emissive,emissiveIntensity:emissive ? .6:0}));
  return materialCache.get(key);
}
function piece(parent,geo,color,pos,scale,rotation,emissive=0) {
  const mesh = new THREE.Mesh(geo,material(color,emissive));
  mesh.position.set(...pos);mesh.scale.set(...scale);
  if(rotation)mesh.rotation.set(...rotation);
  mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function segment(parent,a,b,r1,r2,color) {
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);
  const geo=new THREE.CylinderGeometry(r2,r1,d.length(),7);
  const mesh=piece(parent,geo,color,[...av.add(bv).multiplyScalar(.5)],[1,1,1]);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return mesh;
}

export function createDinosaur(species, decorative=false) {
  const root=new THREE.Group(), body=new THREE.Group();root.add(body);
  const c=species.color??0x638b55,accent=species.accent??0xd3b775;
  const dark=new THREE.Color(c).multiplyScalar(.56).getHex(),belly=new THREE.Color(c).lerp(new THREE.Color(0xd4c5a0),.48).getHex();
  const legs=[],wings=[],tail=new THREE.Group();body.add(tail);
  const quad=species.body==='quad'||species.body==='longneck';
  const dragon=species.body==='dragon',bird=species.body==='bird';
  const torsoY=quad?.9:1.5;
  piece(body,sphere,c,[0,torsoY,0],[1.38,quad?.78:.83,.62],[0,0,quad?0:.15]);
  piece(body,sphere,belly,[.37,torsoY-.27,0],[.94,.49,.52]);
  segment(tail,[-.95,torsoY+.1,0],[-2.3,torsoY-.12,0],.41,.21,c);
  segment(tail,[-2.3,torsoY-.12,0],[-3.5,torsoY+.05,.12],.21,.015,dark);
  const head=new THREE.Group();head.position.set(1.05,torsoY+.55,0);body.add(head);
  if(species.body==='longneck') {
    segment(body,[.9,1.05,0],[1.75,3.65,0],.48,.27,c);head.position.set(1.8,3.8,0);
  } else segment(body,[.5,torsoY,0],[1.28,torsoY+.66,0],.5,.36,c);
  const snout=quad?.6:species.body==='rex'?.85:.63;
  piece(head,sphere,c,[.25,.1,0],[snout,.42,.42]);
  const jaw=piece(head,box,belly,[.43,-.18,0],[snout*1.32,.2,.62],[0,0,-.04]);
  for(const side of [-1,1]) {
    piece(head,smoothSphere,0xf6cc63,[.16,.25,side*.355],[.105,.105,.047],null,0xc27b18);
    piece(head,smoothSphere,0x10201b,[.19,.26,side*.393],[.033,.078,.02]);
    piece(head,sphere,dark,[.61,.18,side*.29],[.065,.05,.035]);
    if(!quad)for(let i=0;i<4;i++)piece(head,cone,0xe8dbb1,[.19+i*.19,-.13,side*.275],[.045,.14,.045],[0,0,Math.PI]);
    for(const offset of quad?[-.82,.88]:[-.55]) {
      const pivot=new THREE.Group();pivot.position.set(offset,torsoY-.2,side*.46);body.add(pivot);
      piece(pivot,sphere,c,[0,-.25,0],[quad?.26:.39,.48,.25],[0,0,quad?0:.4]);
      segment(pivot,[-.1,-.48,0],[.12,-torsoY+.35,.05*side],.13,.075,dark);
      piece(pivot,box,dark,[.28,-torsoY+.23,side*.03],[.53,.14,.22]);
      for(let claw=0;claw<2;claw++)piece(pivot,cone,0xe2d6a7,[.55,-torsoY+.23,side*.03+(claw-.5)*.11],[.045,.18,.045],[0,0,-Math.PI/2]);
      legs.push(pivot);
    }
    if(!quad){
      segment(body,[.7,torsoY+.15,side*.4],[.94,torsoY-.3,side*.75],.13,.07,c);
      segment(body,[.94,torsoY-.3,side*.75],[1.25,torsoY-.36,side*.8],.07,.025,belly);
    }
  }
  // Anatomical silhouettes distinguish armored, horned, feathered and mythical lines.
  const name=species.name.toLowerCase();
  if(/tricer|styrac|protocer|pachyrhino/.test(name)) {
    piece(head,sphere,accent,[-.23,.34,0],[.17,.83,.79],[0,0,.28]);
    for(const side of [-1,1])piece(head,cone,0xe9d8ac,[.45,.74,side*.27],[.11,.85,.11],[0,0,-.45]);
    piece(head,cone,0xe9d8ac,[.84,.4,0],[.09,.42,.09],[0,0,-.7]);
  }
  if(/stego|kentros/.test(name))for(let i=0;i<8;i++)piece(body,cone,accent,[-1.45+i*.37,torsoY+.72,0],[.27,.66+Math.sin(i*.45)*.4,.12],[0,0,-.2]);
  if(/ankylo|euoplo/.test(name)) {
    piece(body,sphere,dark,[-.1,torsoY+.35,0],[1.4,.6,.77]);
    for(let i=0;i<6;i++)for(const side of [-1,1])piece(body,cone,accent,[-1+i*.4,torsoY+.62,side*.48],[.13,.42,.13],[side*.5,0,0]);
    piece(tail,sphere,accent,[-3.42,torsoY,0],[.42,.34,.48]);
  }
  if(/spino|dimetro|ourano/.test(name))piece(body,sphere,accent,[-.2,torsoY+.8,0],[1.12,1.04,.11]);
  if(/dilopho|parasauro|oviraptor/.test(name))piece(head,cone,accent,[-.03,.67,0],[.35,.62,.13],[0,0,.5]);
  if(bird||/micro|archa|deinonych|veloci/.test(name))for(let i=0;i<7;i++)piece(tail,cone,accent,[-1.6-i*.24,torsoY+.07,.1],[.13,.65,.16],[0,0,Math.PI/2+.3]);
  if(dragon||bird)for(const side of [-1,1]) {
    const wing=new THREE.Group();wing.position.set(-.15,torsoY+.45,side*.4);body.add(wing);
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(-.4,side*3);shape.lineTo(-1.1,side*2.1);shape.lineTo(-1.6,side*2);shape.lineTo(-1.5,side*.2);shape.closePath();
    const geo=new THREE.ShapeGeometry(shape);geo.rotateX(Math.PI/2);
    const mat=new THREE.MeshStandardMaterial({color:accent,side:THREE.DoubleSide,roughness:.8});
    const membrane=new THREE.Mesh(geo,mat);membrane.castShadow=true;wing.add(membrane);
    segment(wing,[0,0,0],[-.4,0,side*3],.1,.02,dark);
    segment(wing,[-.4,0,side*3],[-1.5,0,side*.2],.06,.02,dark);wings.push(wing);
  }
  if(dragon) {
    for(const side of [-1,1])piece(head,cone,accent,[-.3,.7,side*.3],[.13,.85,.13],[side*.3,0,.6]);
    for(let i=0;i<8;i++)piece(body,cone,accent,[-2.2+i*.43,torsoY+.55,0],[.16,.5,.15],[0,0,.35]);
  }
  const size=species.size||1;root.scale.setScalar(size*.62);
  root.userData={body,head,jaw,legs,wings,tail,species,baseScale:size*.62,decorative};return root;
}

export class WorldRenderer {
  constructor(canvas,settings,onFailure) {
    this.canvas=canvas;this.settings=settings;this.models=new Map();this.foodModels=new Map();this.particles=[];
    this.shake=0;this.elapsed=0;this.effects=[];this.cameraTarget=new THREE.Vector3();this.aimPoint=new THREE.Vector3();
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setClearColor(0x0a1e1c);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x163d37);this.scene.fog=new THREE.FogExp2(0x163d37,.012);
    this.camera=new THREE.PerspectiveCamera(43,1,.2,350);
    this.scene.add(new THREE.HemisphereLight(0xb1e0d1,0x273529,2.15));
    this.sun=new THREE.DirectionalLight(0xffd7a0,3.6);this.sun.position.set(-30,60,-20);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:1,far:150});
    this.sun.shadow.bias=-.0008;this.sun.shadow.normalBias=.08;this.scene.add(this.sun);this.scene.add(this.sun.target);
    const rim=new THREE.DirectionalLight(0x66c6c5,.85);rim.position.set(20,15,35);this.scene.add(rim);
    this.raycaster=new THREE.Raycaster();this.groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    this.generateWorld();this.createParticles();this.createEgg();
    this.ring=piece(this.scene,new THREE.RingGeometry(1.05,1.14,48),0xe5bd69,[0,.065,0],[1,1,1],[-Math.PI/2,0,0],0x7a5420);
    this.ring.material=new THREE.MeshBasicMaterial({color:0xe9c777,transparent:true,opacity:.6,side:THREE.DoubleSide});
    this.dangerRing=piece(this.scene,new THREE.RingGeometry(.82,1,40),0xff704c,[0,.07,0],[1,1,1],[-Math.PI/2,0,0]);
    this.dangerRing.material=new THREE.MeshBasicMaterial({color:0xff674a,transparent:true,opacity:0,side:THREE.DoubleSide});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure?.('The graphics device was interrupted. Your profile is safe. Restart the game to restore rendering.');});
    this.configure(settings);this.resize();
  }
  configure(settings) {
    this.settings=settings;
    const quality=settings.quality||'high';this.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:quality==='medium'?1.35:1.8));
    this.renderer.shadowMap.enabled=quality!=='low';this.resize();
  }
  resize() { const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix(); }
  generateWorld() {
    const rand=random(),ground=new THREE.PlaneGeometry(360,360,100,100);ground.rotateX(-Math.PI/2);
    const pos=ground.attributes.position,colors=[];
    for(let i=0;i<pos.count;i++) {
      const x=pos.getX(i),z=pos.getZ(i),r=Math.hypot(x,z);
      let c=new THREE.Color(r<44?0x446646:r<86?0x7a7850:r<124?0x665c54:0x40565c);
      c.multiplyScalar(.82+rand()*.3+Math.sin(x*.13)*.03);colors.push(c.r,c.g,c.b);
      pos.setY(i,-.12+Math.sin(x*.16)*Math.cos(z*.13)*.1+(r>164?(r-164)*.25:0));
    }
    ground.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));ground.computeVertexNormals();
    const terrain=new THREE.Mesh(ground,new THREE.MeshStandardMaterial({vertexColors:true,map:groundTexture(),roughness:1,flatShading:true}));terrain.receiveShadow=true;this.scene.add(terrain);
    const trunkGeometry=new THREE.CylinderGeometry(.22,.4,5,6),canopyGeometry=new THREE.IcosahedronGeometry(1,1);
    const count=420,trunks=new THREE.InstancedMesh(trunkGeometry,material(0x514b32),count),crowns=new THREE.InstancedMesh(canopyGeometry,material(0x528653),count*3);
    trunks.castShadow=true;crowns.castShadow=true;crowns.receiveShadow=true;
    const obj=new THREE.Object3D(),color=new THREE.Color();
    for(let i=0;i<count;i++) {
      let x=(rand()-.5)*326,z=(rand()-.5)*326;
      if(Math.hypot(x,z)<18){const a=Math.atan2(z,x);x=Math.cos(a)*25;z=Math.sin(a)*25;}
      const scale=.7+rand()*1.1,h=4.3*scale;obj.position.set(x,h*.5,z);obj.scale.set(scale,scale,scale);obj.rotation.set(0,rand()*6.28,(rand()-.5)*.13);obj.updateMatrix();trunks.setMatrixAt(i,obj.matrix);
      for(let j=0;j<3;j++) {
        obj.position.set(x+(j-1)*1.15*scale,h+j*.6*scale,z+(j%2)*1.05*scale);obj.scale.set((2.2-j*.25)*scale,(1.2+j*.12)*scale,(2.1-j*.25)*scale);obj.updateMatrix();crowns.setMatrixAt(i*3+j,obj.matrix);
        const r=Math.hypot(x,z);color.set(r<44?0x3e8053:r<86?0x818950:r<124?0x6d7468:0x5e8281).multiplyScalar(.72+rand()*.5);crowns.setColorAt(i*3+j,color);
      }
    }
    this.scene.add(trunks,crowns);
    // Ground cover is instanced so a dense prehistoric forest stays inexpensive.
    const fernGeo=fernGeometry(),fernMat=new THREE.MeshStandardMaterial({color:0x7ca65a,roughness:1,side:THREE.DoubleSide});
    const ferns=new THREE.InstancedMesh(fernGeo,fernMat,2500);
    for(let i=0;i<2500;i++) {
      const x=(rand()-.5)*320,z=(rand()-.5)*320,s=.4+rand()*.7;
      obj.position.set(x,.02,z);obj.scale.set(s*1.5,s,s*1.5);obj.rotation.set(0,rand()*6.28,0);obj.updateMatrix();ferns.setMatrixAt(i,obj.matrix);
      color.set(Math.hypot(x,z)>44?0x9c9a51:0x59945a).multiplyScalar(.7+rand()*.5);ferns.setColorAt(i,color);
    }this.scene.add(ferns);
    // Broad cycads and palms provide a second, unmistakably prehistoric canopy.
    const palmCount=85,palmLeaves=new THREE.InstancedMesh(fernGeo,new THREE.MeshStandardMaterial({color:0x679551,side:THREE.DoubleSide,roughness:1}),palmCount),palmTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.2,.38,1,7),material(0x776245),palmCount);
    palmLeaves.castShadow=true;palmTrunks.castShadow=true;
    for(let i=0;i<palmCount;i++){
      const a=rand()*6.28,r=22+rand()*132,x=Math.cos(a)*r,z=Math.sin(a)*r,h=2+rand()*3;
      obj.position.set(x,h,z);obj.scale.set(4+rand()*2,2,4+rand()*2);obj.rotation.set(0,rand()*6.28,0);obj.updateMatrix();palmLeaves.setMatrixAt(i,obj.matrix);
      obj.position.y=h/2;obj.scale.set(1,h,1);obj.updateMatrix();palmTrunks.setMatrixAt(i,obj.matrix);
    }this.scene.add(palmLeaves,palmTrunks);
    // Small grass clumps, fallen leaves and flowers break up the forest floor.
    const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.13,.65,3),new THREE.MeshStandardMaterial({color:0x819d58,roughness:1}),3200);
    for(let i=0;i<3200;i++){const x=(rand()-.5)*312,z=(rand()-.5)*312;obj.position.set(x,.18,z);obj.scale.set(1,.6+rand(),1);obj.rotation.set(0,rand()*6.28,.2);obj.updateMatrix();grass.setMatrixAt(i,obj.matrix);}
    this.scene.add(grass);
    const rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),material(0x65736b),260);rocks.castShadow=true;rocks.receiveShadow=true;
    for(let i=0;i<260;i++){
      const x=(rand()-.5)*326,z=(rand()-.5)*326,s=.4+rand()*1.8;
      obj.position.set(x,-.05,z);obj.scale.set(s,s*.6,s*.8);obj.rotation.set(rand(),rand()*6.28,rand());obj.updateMatrix();rocks.setMatrixAt(i,obj.matrix);
    }this.scene.add(rocks);
    this.water=[];
    for(const [x,z,sx,sz] of [[-57,28,15,24],[24,63,24,13],[-87,-72,18,14]]) {
      const water=piece(this.scene,new THREE.CircleGeometry(1,64),0x328f8e,[x,.015,z],[sx,sz,1],[-Math.PI/2,0,0]);
      water.material=new THREE.MeshStandardMaterial({color:0x347e7d,metalness:.35,roughness:.25,transparent:true,opacity:.83});this.water.push(water);
      for(let i=0;i<7;i++) {const a=rand()*Math.PI*2;piece(this.scene,sphere,0x5c7163,[x+Math.cos(a)*sx,.1,z+Math.sin(a)*sz],[1.2,.5,1]);}
    }
    // Ancient skeletal remains, glowing mythic crystals and a volcanic frontier.
    for(let k=0;k<12;k++) {
      const x=(rand()-.5)*260,z=(rand()-.5)*260;
      for(let i=0;i<5;i++) {
        const rib=new THREE.Mesh(new THREE.TorusGeometry(.8,.09,4,10,Math.PI),material(0xb6b29a));rib.position.set(x+i*.5,.25,z);rib.rotation.y=Math.PI/2;rib.castShadow=true;this.scene.add(rib);
      }
      piece(this.scene,sphere,0xbcb79e,[x+3,.3,z],[.65,.35,.45]);
    }
    for(let i=0;i<28;i++) {
      const a=rand()*6.28,r=90+rand()*60,x=Math.cos(a)*r,z=Math.sin(a)*r;
      for(let j=0;j<3;j++)piece(this.scene,new THREE.OctahedronGeometry(1),0x739d9e,[x+j*.7,.7+j*.24,z],[.4,1.3+j*.3,.4],[.1,rand(),.2],0x244d52);
    }
    for(let i=0;i<28;i++) {
      const a=i/28*6.28,r=171;piece(this.scene,cone,i%3===0?0x435447:0x3a4d43,[Math.cos(a)*r,7,Math.sin(a)*r],[10,16+rand()*12,10]);
    }
    this.nest=new THREE.Group();this.scene.add(this.nest);
    piece(this.nest,new THREE.TorusGeometry(2.3,.3,5,20),0x66543a,[0,.06,0],[1,1,1],[Math.PI/2,0,0]);
    for(let i=0;i<12;i++){let a=i/12*6.28;piece(this.nest,box,0x8b7750,[Math.cos(a)*2,.1,Math.sin(a)*2],[1.3,.1,.14],[0,-a+.5,0]);}
  }
  createEgg() {
    this.egg=new THREE.Group();this.scene.add(this.egg);
    const shell=piece(this.egg,smoothSphere,0xe5d7ad,[0,1.2,0],[.86,1.16,.86]);
    for(let i=0;i<19;i++) {const a=i*2.4,h=.3+(i%5)*.32,r=.8*Math.sqrt(Math.max(0,1-((h-1.2)/1.2)**2));piece(this.egg,sphere,0x9a946e,[Math.cos(a)*r,h,Math.sin(a)*r],[.1,.14,.03],[0,-a,0]);}
    this.eggGlow=new THREE.PointLight(0xffd28b,7,10);this.eggGlow.position.y=2;this.egg.add(this.eggGlow);
    this.menuDino=createDinosaur(SPECIES.find(s=>s.body==='rex')||SPECIES[SPECIES.length-1],true);this.menuDino.position.set(7,0,-3);this.menuDino.scale.setScalar(2.4);this.menuDino.rotation.y=-2;this.scene.add(this.menuDino);
  }
  createParticles() {
    this.particleMesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.85}),220);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.particleMesh.frustumCulled=false;this.scene.add(this.particleMesh);this.particleDummy=new THREE.Object3D();
    const dustGeo=new THREE.BufferGeometry(),positions=new Float32Array(220*3);
    for(let i=0;i<220;i++){positions[i*3]=(Math.random()-.5)*110;positions[i*3+1]=1+Math.random()*12;positions[i*3+2]=(Math.random()-.5)*110;}
    dustGeo.setAttribute('position',new THREE.BufferAttribute(positions,3));this.dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xeed7a3,size:.055,transparent:true,opacity:.5,depthWrite:false}));this.scene.add(this.dust);
  }
  burst(x,z,color=0xe5bc6d,count=16) {
    for(let i=0;i<count;i++){if(this.particles.length>=220)this.particles.shift();this.particles.push({x,y:.6,z,vx:(Math.random()-.5)*7,vy:2+Math.random()*5,vz:(Math.random()-.5)*7,life:.5+Math.random()*.5,max:1,color,size:.06+Math.random()*.13});}
  }
  event(event) {
    if(['hit','kill','eat','hatch','evolve','ability','dash'].includes(event.type))this.burst(event.x||0,event.y||0,event.type==='hit'?0xe98866:event.type==='eat'?0x9ce3a5:0xf4d48a,event.type==='evolve'?65:12);
    if(event.type==='hit'||event.type==='ability')this.shake=Math.max(this.shake,event.type==='ability'?.4:.2);
    if(['attack','ability','evolve'].includes(event.type)){
      const directional=event.type==='attack'||['flame','venom','pounce','charge'].includes(event.ability);
      const color=event.ability==='venom'?0xa3db77:event.ability==='flame'?0xffa34a:0xf4dca4;
      const radius=event.radius||3,arc=directional?1.4:Math.PI*2;
      const geo=new THREE.RingGeometry(radius*.7,radius,48,1,-arc/2,arc);
      const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.6,side:THREE.DoubleSide,depthWrite:false});
      const mesh=new THREE.Mesh(geo,mat),group=new THREE.Group();mesh.rotation.x=-Math.PI/2;group.add(mesh);group.position.set(event.x||0,.12,event.y||0);group.rotation.y=-(event.angle||0);this.scene.add(group);
      this.effects.push({group,mesh,life:event.type==='attack'?.2:.65,max:event.type==='attack'?.2:.65});
      if(event.ability==='flame'||event.ability==='venom')for(let i=1;i<7;i++){const distance=i*radius/7;this.burst((event.x||0)+Math.cos(event.angle)*distance,(event.y||0)+Math.sin(event.angle)*distance,color,8);}
    }
  }
  aim(clientX,clientY,player) {
    this.raycaster.setFromCamera(new THREE.Vector2(clientX/innerWidth*2-1,-clientY/innerHeight*2+1),this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane,this.aimPoint);
    return Math.atan2(this.aimPoint.z-player.y,this.aimPoint.x-player.x);
  }
  animateDino(model,t,speed=0,attacking=false) {
    const {body,legs,wings,tail,jaw}=model.userData;
    const stride=t*9+model.id*.14;body.position.y=Math.sin(stride*2)*.045*speed;
    body.rotation.z=Math.sin(stride)*.025*speed;
    legs.forEach((leg,i)=>{leg.rotation.z=Math.sin(stride+(i%2)*Math.PI)*.6*speed;});
    tail.rotation.y=Math.sin(t*2)*.11;wings.forEach((wing,i)=>wing.rotation.x=Math.sin(t*3)*(i?1:-1)*.3);
    jaw.rotation.z=attacking?-.33:Math.sin(t*1.5)*.03;
  }
  syncModel(key,id,x,z,angle,dt,t,active=false,attacking=false,invulnerable=false) {
    let model=this.models.get(key);
    if(!model||model.userData.species.id!==id) {
      if(model)this.removeModel(model);
      model=createDinosaur(lookup(id));model.position.set(x,0,z);model.rotation.y=-angle;this.models.set(key,model);this.scene.add(model);
    }
    const moved=Math.hypot(x-model.position.x,z-model.position.z);
    model.position.x=THREE.MathUtils.damp(model.position.x,x,22,dt);model.position.z=THREE.MathUtils.damp(model.position.z,z,22,dt);
    const target=-angle,diff=Math.atan2(Math.sin(target-model.rotation.y),Math.cos(target-model.rotation.y));model.rotation.y+=diff*Math.min(1,dt*16);
    this.animateDino(model,t,clamp(moved*5,0,1),attacking);
    model.visible=Math.hypot(x-this.cameraTarget.x,z-this.cameraTarget.z)<68;
    model.userData.body.visible=true;
    model.scale.setScalar(model.userData.baseScale*(invulnerable?1+Math.sin(t*8)*.025:1));
    return model;
  }
  removeModel(model) {
    this.scene.remove(model);
    model.traverse(obj=>{if(obj.geometry&&![sphere,smoothSphere,cone,cylinder,box].includes(obj.geometry))obj.geometry.dispose();if(obj.material&&!Array.from(materialCache.values()).includes(obj.material))obj.material.dispose();});
  }
  render(game,dt,menu=false) {
    this.elapsed+=dt;const t=this.elapsed,p=game?.player;
    this.menuDino.visible=menu;this.egg.visible=menu||game?.state==='egg';
    if(menu){this.animateDino(this.menuDino,t,.15);this.cameraTarget.lerp(new THREE.Vector3(0,0,0),Math.min(1,dt*3));}
    else if(p)this.cameraTarget.lerp(new THREE.Vector3(p.x,0,p.y),Math.min(1,dt*6));
    if(p&&!menu) {
      this.egg.position.set(p.x,0,p.y);this.egg.rotation.z=Math.sin(t*8)*.035;
      const keys=new Set();
      if(game.state!=='egg') {
        const player=this.syncModel('player',p.speciesId,p.x,p.y,p.angle,dt,t,true,p.attackCooldown>.25,p.invulnerable>0);keys.add('player');
        this.ring.position.set(p.x,.065,p.y);this.ring.scale.setScalar(Math.max(1.15,player.userData.baseScale*1.4));this.ring.visible=true;
        this.ring.material.opacity=p.invulnerable>0?.85:.55;
      } else this.ring.visible=false;
      for(const e of game.entities) {
        if(Math.hypot(e.x-p.x,e.y-p.y)>55){const old=this.models.get(e.id);if(old){old.visible=false;keys.add(e.id);}continue;}
        this.syncModel(e.id,e.speciesId,e.x,e.y,e.angle,dt,t,false,e.attacking>0,false);keys.add(e.id);
      }
      for(const [key,model] of this.models)if(!keys.has(key)){this.removeModel(model);this.models.delete(key);}
      this.syncFood(game.foods,t);
      const telegraph=game.entities.find(e=>e.telegraph>0&&Math.hypot(e.x-p.x,e.y-p.y)<12);
      this.dangerRing.material.opacity=telegraph?.42+Math.sin(t*23)*.15:0;
      if(telegraph){this.dangerRing.position.set(telegraph.x,.08,telegraph.y);this.dangerRing.scale.setScalar((lookup(telegraph.speciesId).size||1)*1.7);}
      this.dust.position.set(p.x,0,p.y);
    }else{this.ring.visible=false;this.dangerRing.material.opacity=0;for(const m of this.models.values())m.visible=false;for(const m of this.foodModels.values())m.visible=false;}
    this.shake=Math.max(0,this.shake-dt*1.5);const shake=this.settings.shake?this.shake:0;
    const zoom=p&&!menu?clamp((lookup(p.speciesId)?.size||1)-1,0,7)*1.65:0;
    this.camera.position.set(this.cameraTarget.x+Math.sin(t*84)*shake,this.cameraTarget.y+34+zoom,this.cameraTarget.z+29+zoom);
    this.camera.lookAt(this.cameraTarget.x,0,this.cameraTarget.z-2);
    this.sun.position.set(this.cameraTarget.x-30,60,this.cameraTarget.z-20);this.sun.target.position.copy(this.cameraTarget);
    const night=game&&!menu?(.5-.5*Math.cos(game.time/110))*.42:0;
    this.sun.intensity=3.6-night*3;this.scene.fog.density=.012+night*.005;
    for(const water of this.water)water.material.color.setHSL(.49,.38,.29+Math.sin(t*.7)*.02);
    this.dust.rotation.y=t*.008;
    for(let i=this.effects.length-1;i>=0;i--){const effect=this.effects[i];effect.life-=dt;if(effect.life<=0){this.scene.remove(effect.group);effect.mesh.geometry.dispose();effect.mesh.material.dispose();this.effects.splice(i,1);}else{const progress=1-effect.life/effect.max;effect.group.scale.setScalar(.6+progress*.5);effect.mesh.material.opacity=(1-progress)*.55;}}
    this.drawParticles(dt);this.renderer.render(this.scene,this.camera);
  }
  syncFood(foods,t) {
    const keys=new Set();
    for(const food of foods) {
      keys.add(food.id);let mesh=this.foodModels.get(food.id);
      if(!mesh) {
        mesh=new THREE.Group();const color=food.type==='meat'?0xd99a78:food.type==='essence'?0xb59ce8:0xb7cb71;
        const geo=food.type==='meat'?sphere:food.type==='essence'?new THREE.OctahedronGeometry(1):sphere;
        piece(mesh,geo,color,[0,.5,0],[.4,.4,.4],null,food.type==='essence'?0x4d306c:0);
        if(food.type==='plant')for(let i=0;i<3;i++)piece(mesh,cone,0x6c9e64,[(i-1)*.24,.3,0],[.22,.55,.13],[0,0,(i-1)*.5]);
        const ring=new THREE.Mesh(new THREE.RingGeometry(.5,.55,16),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.4,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.04;mesh.add(ring);
        mesh.position.set(food.x,0,food.y);this.scene.add(mesh);this.foodModels.set(food.id,mesh);
      }
      mesh.visible=Math.hypot(food.x-this.cameraTarget.x,food.y-this.cameraTarget.z)<60;
      mesh.children[0].position.y=.5+Math.sin(t*2+mesh.id)*.1;
    }
    for(const [key,mesh] of this.foodModels)if(!keys.has(key)){this.removeModel(mesh);this.foodModels.delete(key);}
  }
  drawParticles(dt) {
    this.particles=this.particles.filter(p=>p.life>0);
    const dummy=this.particleDummy;
    for(let i=0;i<220;i++) {
      const p=this.particles[i];
      if(p){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=8*dt;dummy.position.set(p.x,Math.max(.04,p.y),p.z);dummy.scale.setScalar(p.size*clamp(p.life*3,0,1));this.particleMesh.setColorAt(i,new THREE.Color(p.color));}
      else dummy.scale.setScalar(0);
      dummy.updateMatrix();this.particleMesh.setMatrixAt(i,dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate=true;if(this.particleMesh.instanceColor)this.particleMesh.instanceColor.needsUpdate=true;
  }
  project(x,y,height=2) { const v=new THREE.Vector3(x,height,y).project(this.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight,visible:v.z<1}; }
  minimap(canvas,game,expanded=false) {
    if(!canvas||!game)return;const ctx=canvas.getContext('2d'),w=canvas.width=expanded?360:160,h=canvas.height=w,c=w/2,r=w*.46;
    ctx.clearRect(0,0,w,h);ctx.save();ctx.beginPath();ctx.arc(c,c,r,0,6.28);ctx.clip();ctx.fillStyle='#213b31';ctx.fillRect(0,0,w,h);
    for(const [radius,color] of [[160,'#314c50'],[124,'#57524b'],[86,'#686242'],[44,'#304d37']]){ctx.fillStyle=color;ctx.beginPath();ctx.arc(c,c,r*radius/160,0,6.28);ctx.fill();}
    ctx.strokeStyle='#87a38c22';ctx.lineWidth=1;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(i*w/4,0);ctx.lineTo(i*w/4,h);ctx.moveTo(0,i*h/4);ctx.lineTo(w,i*h/4);ctx.stroke();}
    const scale=r/game.worldRadius;
    for(const e of game.entities){ctx.fillStyle=e.boss?'#dd9cfa':lookup(e.speciesId).tier>game.tier?'#df886f':'#a5c28a';ctx.beginPath();ctx.arc(c+e.x*scale,c+e.y*scale,e.boss?3:1.5,0,6.28);ctx.fill();}
    const p=game.player;ctx.translate(c+p.x*scale,c+p.y*scale);ctx.rotate(p.angle);ctx.fillStyle='#f2d79c';ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(-3,-3);ctx.lineTo(-2,0);ctx.lineTo(-3,3);ctx.closePath();ctx.fill();ctx.restore();
    ctx.strokeStyle='#b99e6466';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(c,c,r,0,6.28);ctx.stroke();
  }
}
