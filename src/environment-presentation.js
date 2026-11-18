import{locationAt,pathDistance}from'./frontier-map.js';
import * as THREE from 'three';
import { biomeAt } from './world-data.js';

export const BIOME_LOOKS={
 fernwood:{ground:0x60964e,fog:0x518e82,water:0x238e9b},
 savannah:{ground:0xc7aa59,fog:0xa5a17b,water:0x319c91},
 fen:{ground:0x4f8968,fog:0x4d8d98,water:0x257f99},
 redwood:{ground:0x768b45,fog:0x548d78,water:0x2b9388},
 marsh:{ground:0x54876a,fog:0x548b9e,water:0x328da3},
 desert:{ground:0xd6aa68,fog:0xc0a681,water:0x36a59a},
 frost:{ground:0xb9d5db,fog:0x92c2dd,water:0x479fc1},
 volcano:{ground:0x79615e,fog:0x945b55,water:0x368b94},
 grove:{ground:0x7eaa52,fog:0x6b9d84,water:0x369d92},
 sky:{ground:0xabc5d0,fog:0x94bcd6,water:0x55acba},
 graveyard:{ground:0x9a9177,fog:0x809b94,water:0x398d91},
 highlands:{ground:0x759a99,fog:0x7eaac0,water:0x348eaf},
 peaks:{ground:0x778e9b,fog:0x719fba,water:0x2983aa},
 origin:{ground:0xa6a166,fog:0x7eaa92,water:0x2f9d91},
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
      vec3 shallow=mix(uWaterColor,vec3(.09,.42,.39),.32),deep=uWaterColor*.4;
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
      color=mix(color,vec3(.67,.86,.84),foam*.55);
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
