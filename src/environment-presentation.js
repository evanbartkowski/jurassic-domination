import{locationAt,pathDistance}from'./frontier-map.js';
import * as THREE from 'three';
import { biomeAt } from './world-data.js';

export const BIOME_LOOKS={
 fernwood:{ground:0x748163,fog:0x607e79,water:0x315c58},
 savannah:{ground:0xb3a16e,fog:0x99987c,water:0x58716a},
 fen:{ground:0x60746b,fog:0x607d83,water:0x315e63},
 redwood:{ground:0x79765d,fog:0x637e76,water:0x3d6260},
 marsh:{ground:0x6d7872,fog:0x6b7f89,water:0x3c6370},
 desert:{ground:0xc1a57e,fog:0xb3a58a,water:0x668c87},
 frost:{ground:0xb7c4be,fog:0xa0b4c1,water:0x759aab},
 volcano:{ground:0x69615c,fog:0x78605a,water:0x405b5d},
 grove:{ground:0x8e9470,fog:0x819786,water:0x5b7c74},
 sky:{ground:0xa4aaa2,fog:0x9daebd,water:0x72969c},
 graveyard:{ground:0x968e7a,fog:0x8b968b,water:0x567474},
 highlands:{ground:0x879293,fog:0x899ea9,water:0x5a8292},
 peaks:{ground:0x7f888a,fog:0x7a96a3,water:0x476f7f},
 origin:{ground:0x9a967e,fog:0x88988d,water:0x557e78},
};
const colors=new Map(Object.entries(BIOME_LOOKS).map(([id,v])=>[id,new THREE.Color(v.ground)]));
export const biomeLook=id=>BIOME_LOOKS[id]||BIOME_LOOKS.fernwood;
/** World-space pigment is continuous across chunk edges and biome borders. */
export function groundPigment(x,z){
 const samples=[[0,0],[12,0],[-12,0],[0,12],[0,-12]];
 const color=new THREE.Color(0);
 // Accumulate cached linear colors without allocating a Color per sample.
 let r=0,g=0,b=0;
 for(const [dx,dz] of samples){const c=colors.get(biomeAt(x+dx,z+dz).id)||colors.get('fernwood');r+=c.r*.2;g+=c.g*.2;b+=c.b*.2;}
 const variation=.95+Math.sin(x*.027+Math.sin(z*.019)*1.8)*.04+Math.cos(z*.047+x*.018)*.025;
 color.setRGB(r*variation,g*variation,b*variation);
 const site=locationAt(x,z);if(site){const tint=new THREE.Color(site.kind==='emerald'?0x2c6446:site.kind==='crystal'?0x435c6d:site.kind==='cavern'?0x343032:0x65636a);color.lerp(tint,.35);}
 const trail=pathDistance(x,z);if(Math.hypot(x,z)>55&&trail<9)color.lerp(new THREE.Color(0x8e7b5c),(1-THREE.MathUtils.smoothstep(trail,4,9))*.60);
 return color;
}

const clock={value:0},sky={value:new THREE.Color(0x9cb8b8)},sun={value:new THREE.Color(0xe5d3a6)};
export function updateEnvironmentTime(time,skyColor,sunColor){clock.value=time;if(skyColor)sky.value.copy(skyColor);if(sunColor)sun.value.copy(sunColor);}

/** Flat, normal-only bounded water. Depth is a radial basin estimate, not a
 * screen-depth reconstruction. Reflection is analytic sky; no offscreen pass. */
export function poolMaterial(radius,waterColor=BIOME_LOOKS.fernwood.water,shoreRadius=0){
 const material=new THREE.ShaderMaterial({
  name:'Lost Continent bounded water',fog:true,transparent:true,depthWrite:false,
  uniforms:{uTime:clock,uSky:sky,uSun:sun,uWaterColor:{value:new THREE.Color(waterColor)},uRadius:{value:radius},uShoreRadius:{value:shoreRadius},uActor:{value:new THREE.Vector2(1e6,1e6)},uMovement:{value:0},uDebug:{value:0},...THREE.UniformsUtils.clone(THREE.UniformsLib.fog)},
  vertexShader:`varying vec3 vWorld;varying vec2 vPool;
    #include <fog_pars_vertex>
    void main(){vPool=position.xy;vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;
    vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader:`uniform float uTime,uRadius,uShoreRadius,uMovement,uDebug;uniform vec3 uSky,uSun,uWaterColor;uniform vec2 uActor;
    varying vec3 vWorld;varying vec2 vPool;
    #include <fog_pars_fragment>
    void main(){
      float radial=length(vPool)/uRadius;
      vec2 p=vWorld.xz;
      float a=dot(p,vec2(.74,.32))-uTime*.85;
      float b=dot(p,vec2(-.29,.91))+uTime*.64;
      float filterA=1.0-smoothstep(.8,2.0,fwidth(a));float filterB=1.0-smoothstep(.8,2.0,fwidth(b));
      vec2 slope=cos(a)*vec2(.74,.32)*.075*filterA+cos(b)*vec2(-.29,.91)*.045*filterB;
      vec2 delta=p-uActor;float dist=length(delta);float ring=dist*5.0-uTime*3.4;
      slope+=normalize(delta+vec2(.001))*cos(ring)*exp(-dist*.5)*uMovement*.12;
      vec3 n=normalize(vec3(-slope.x,1.0,-slope.y));vec3 view=normalize(cameraPosition-vWorld);
      float fresnel=.025+.975*pow(1.0-max(dot(view,n),0.0),5.0);
      float shore=length(p)-uShoreRadius;
      float depth=uShoreRadius>0.0?max(0.0,shore*.32):max(0.0,1.0-pow(radial,1.6))*uRadius*.23;
      vec3 shallow=mix(uWaterColor,vec3(.27,.39,.30),.55),deep=uWaterColor*.4;
      vec3 body=mix(deep,shallow,exp(-depth*.35));
      vec3 reflection=uSky*(.72+.18*n.y);
      vec3 color=mix(body,reflection,fresnel);
      vec3 lightDir=normalize(vec3(-.45,.8,-.3));
      float glint=pow(max(dot(reflect(-lightDir,n),view),0.0),88.0);
      color+=uSun*glint*.28;
      float crest=sin(a)*.65+sin(b)*.35;
      float foam=smoothstep(.89,.985,radial)*(1.0-smoothstep(.985,1.0,radial));
      if(uShoreRadius>0.0)foam=(1.0-smoothstep(.25,1.8,abs(shore)))*.7;
      foam*=smoothstep(-.35,.7,crest+sin(atan(vPool.y,vPool.x)*21.0)*.4);
      color=mix(color,vec3(.66,.76,.65),foam*.55);
      if(uDebug>1.5)color=vec3(depth/uRadius);else if(uDebug>.5)color=n*.5+.5;
      gl_FragColor=vec4(color,mix(.93,.65,smoothstep(.85,1.0,radial)));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
    }`,
 });
 material.userData.update=(time,player,feature)=>{
  if(!player){material.uniforms.uMovement.value*=.9;return;}
  const last=material.userData.lastActor,dt=Math.max(.001,time-(material.userData.lastTime??time));
  const distance=Math.hypot(player.x-feature.x,player.y-feature.y);
  const moving=last&&distance<radius?Math.min(1,Math.hypot(player.x-last.x,player.y-last.y)/dt*.12):0;
  material.uniforms.uActor.value.set(player.x,player.y);
  material.uniforms.uMovement.value=THREE.MathUtils.damp(material.uniforms.uMovement.value,moving,6,Math.min(.1,dt));
  material.userData.lastActor||={x:0,y:0};material.userData.lastActor.x=player.x;material.userData.lastActor.y=player.y;material.userData.lastTime=time;
 };
 return material;
}

export function createDistantLandscape(){
 const group=new THREE.Group();group.name='Distant landforms';
 for(let layer=0;layer<3;layer++){
  const vertices=[],indices=[],segments=96,radius=145+layer*30;
  for(let i=0;i<=segments;i++){
   const a=i/segments*Math.PI*2;
   const height=12+Math.pow(.5+.5*Math.sin(a*7+layer*1.3),2)*14+Math.sin(a*13+layer)*3;
   for(const y of [-12,height])vertices.push(Math.cos(a)*radius,y,Math.sin(a)*radius);
   if(i<segments){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshBasicMaterial({color:[0x506f70,0x71898a,0x8e9e99][layer],side:THREE.DoubleSide,fog:true});
  group.add(new THREE.Mesh(geometry,material));
 }
 group.userData.dispose=()=>group.children.forEach(o=>{o.geometry.dispose();o.material.dispose();});
 return group;
}
