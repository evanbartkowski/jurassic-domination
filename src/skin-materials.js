import {Color} from 'three';
const fields={
 striped:'smoothstep(.24,.53,sin(p.x*8.+p.y*4.+sin(p.z*5.)))',
 banded:'smoothstep(.15,.42,sin(p.x*5.+p.y*2.))',
 tiger:'smoothstep(.35,.63,sin(p.x*10.+sin(p.y*9.)*1.1+sin(p.z*7.)*.7))',
 speckled:'1.-smoothstep(.09,.19,cell.x)',
 spots:'1.-smoothstep(.22,.30,cell.x)',
 rosettes:'smoothstep(.19,.24,cell.x)*(1.-smoothstep(.31,.37,cell.x))',
 mottled:'smoothstep(.34,.68,skinNoise(p*2.)*.65+skinNoise(p*7.)*.35)',
 ripples:'smoothstep(.72,.9,sin(p.x*11.+sin(p.y*7.+p.z*4.)*2.))',
 fracture:'1.-smoothstep(.025,.085,cell.y-cell.x)',
 magma:'1.-smoothstep(.025,.11,cell.y-cell.x)',
 marble:'smoothstep(.25,.65,sin(p.x*3.+p.y*4.+skinNoise(p*2.)*9.))',
 gradient:'smoothstep(-.6,.9,sin(p.y*1.4+p.z*.8))',
 petals:'smoothstep(.25,.8,sin(p.x*6.+sin(p.y*5.))*sin(p.z*5.+p.y*3.))',
 skeleton:'max(1.-smoothstep(.06,.15,abs(p.z)),(1.-smoothstep(.12,.25,abs(sin(p.x*8.+p.y*2.))))*smoothstep(.15,.65,abs(p.z)))',
 lightning:'1.-smoothstep(.035,.12,abs(sin(p.x*3.+p.y*6.+floor(p.y*9.)*.4)))',
 nebula:'smoothstep(.3,.8,skinNoise(p*1.4))',
 constellation:'max((1.-smoothstep(.025,.065,cell.x)),.25*(1.-smoothstep(.01,.025,cell.y-cell.x)))',
 solar:'smoothstep(.18,.78,sin(length(p.xy)*5.-p.z*2.+skinNoise(p)*3.))',
 aurora:'smoothstep(.15,.8,sin(p.x*2.+p.z*4.+skinNoise(p*1.5)*5.))',
};
const helpers=`
float skinHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float skinNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(skinHash(i),skinHash(i+vec3(1,0,0)),f.x),mix(skinHash(i+vec3(0,1,0)),skinHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(skinHash(i+vec3(0,0,1)),skinHash(i+vec3(1,0,1)),f.x),mix(skinHash(i+vec3(0,1,1)),skinHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec2 skinCells(vec2 p){vec2 g=floor(p),f=fract(p);float a=10.,b=10.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y));vec2 c=o+vec2(skinHash(vec3(g+o,1.)),skinHash(vec3(g+o,2.)))*.7+.15-f;float d=length(c);if(d<a){b=a;a=d;}else if(d<b)b=d;}return vec2(a,b);}
`;
/** Adds object-space markings while retaining the authored normal/roughness atlas. */
export function applyDinosaurSkin(material,skin){
 if(!skin||skin.id==='natural'||!fields[skin.pattern])return material;
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey.bind(material),key=previousKey();
 material.onBeforeCompile=shader=>{
  previous?.call(material,shader);
  shader.uniforms.skinBase={value:new Color(skin.color)};shader.uniforms.skinAccent={value:new Color(skin.accent)};
  shader.uniforms.skinGlow={value:skin.finish==='luminous'?.32:skin.finish==='pearl'?.05:0};
  shader.uniforms.skinBlend={value:skin.strength??.92};shader.uniforms.skinMarkStrength={value:skin.markStrength??1};shader.uniforms.skinScale={value:skin.patternScale??2.2};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 skinPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nskinPosition=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 skinPosition;uniform vec3 skinBase;uniform vec3 skinAccent;uniform float skinGlow,skinBlend,skinMarkStrength,skinScale;${helpers}`)
   .replace('#include <color_fragment>',`#include <color_fragment>
    vec3 p=skinPosition*skinScale;vec2 cell=skinCells(p.xy*2.1);
    float skinPattern=clamp(${fields[skin.pattern]},0.,1.);
    float pigment=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    float skinMask=smoothstep(.008,.05,pigment)*(1.-smoothstep(.43,.66,pigment));
    vec3 skinCoat=mix(skinBase,skinAccent,skinPattern*skinMarkStrength)*clamp(.55+pigment*1.7,.5,1.3);
    diffuseColor.rgb=mix(diffuseColor.rgb,skinCoat,skinMask*skinBlend);`)
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=skinAccent*skinGlow*skinPattern*skinMask;');
 };
 material.customProgramCacheKey=()=>key+':expedition-skin-v2:'+skin.pattern;
 if(skin.finish==='metal'){material.metalness=.42;material.roughness=Math.min(material.roughness,.4);}
 else if(skin.finish==='pearl'){material.metalness=.22;material.roughness=Math.min(material.roughness,.48);}
 material.userData.skinPattern=skin.pattern;material.needsUpdate=true;return material;
}
