import * as T from 'three';
const sets=new Map();
const authored=new Set(['soil','stone','wood','conifer','broadleaf']);let loader;
const fract=x=>x-Math.floor(x),noise=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
function smoothNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y),u=fract(x),v=fract(y),a=u*u*(3-2*u),b=v*v*(3-2*v);return T.MathUtils.lerp(T.MathUtils.lerp(noise(ix,iy),noise(ix+1,iy),a),T.MathUtils.lerp(noise(ix,iy+1),noise(ix+1,iy+1),a),b);}
/** Local CC0 tiling surfaces with original fallbacks. Color is sRGB; data is linear. */
export function naturalTextures(kind){
 if(authored.has(kind)&&typeof document!=='undefined'&&typeof document.createElementNS==='function'){
  if(sets.has(kind))return sets.get(kind);const result={};loader||=new T.TextureLoader();
  for(const [slot,name]of[['map','color'],['normalMap','normal'],['roughnessMap','roughness']]){const texture=loader.load(`${import.meta.env?.BASE_URL||'./'}assets/surfaces-v4/${kind}-${name}.png`);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=name==='color'?T.SRGBColorSpace:T.NoColorSpace;texture.anisotropy=4;texture.userData.shared=true;result[slot]=texture;}
  sets.set(kind,result);return result;
 }
 if(sets.has(kind))return sets.get(kind);const n=256,color=new Uint8Array(n*n*4),rough=new Uint8Array(n*n),height=new Uint8Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n,v=y/n,broad=smoothNoise(u*8,v*8),fine=smoothNoise(u*61,v*61),grain=noise(x,y),wood=kind==='wood',leaf=kind==='leaf',bone=kind==='bone';
  const bands=wood?Math.sin(u*142+Math.sin(v*11)*2.8+broad*4):bone?Math.sin(u*70+broad*3):leaf?Math.cos(v*96+Math.abs(u-.5)*34):Math.sin(v*52+broad*4);
  const detail=wood?.5+bands*.21+fine*.18:leaf?.65+bands*.06+fine*.11:.43+broad*.31+fine*.17;
  const value=Math.round(T.MathUtils.clamp(.73+detail*.25+(grain-.5)*.045,0,1)*255),i=y*n+x;color[i*4]=color[i*4+1]=color[i*4+2]=value;color[i*4+3]=255;
  rough[i]=Math.round((leaf?.70+broad*.15:bone?.78+fine*.15:.75+broad*.18)*255);height[i]=Math.round(T.MathUtils.clamp(detail*.8+grain*.08,0,1)*255);
 }
 const texture=(data,format,space)=>{const map=new T.DataTexture(data,n,n,format);map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.colorSpace=space;map.needsUpdate=true;map.userData.shared=true;return map;};
 const result={map:texture(color,T.RGBAFormat,T.SRGBColorSpace),roughnessMap:texture(rough,T.RedFormat,T.NoColorSpace),bumpMap:texture(height,T.RedFormat,T.NoColorSpace)};sets.set(kind,result);return result;
}
export function naturalMaterial(kind,color,options={}){const texture=naturalTextures(kind),foliage=['conifer','broadleaf'].includes(kind);return new T.MeshStandardMaterial({color,...texture,metalness:0,roughness:kind==='leaf'?.86:.94,bumpScale:kind==='stone'?.065:kind==='wood'?.032:kind==='bone'?.025:.018,normalScale:new T.Vector2(kind==='soil'?.65:.7,kind==='soil'?.65:.7),...(foliage?{alphaTest:.32,alphaToCoverage:true,side:T.FrontSide,vertexColors:false}:{}),...options});}

/** A restrained sky irradiance rig, shared by every imported PBR material. */
export function createNaturalEnvironment(renderer){
 const scene=new T.Scene(),geometry=new T.SphereGeometry(5,24,16),material=new T.ShaderMaterial({side:T.BackSide,vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 direction;void main(){vec3 d=normalize(direction);float h=clamp(d.y*.5+.5,0.,1.);vec3 c=mix(vec3(.045,.054,.035),vec3(.55,.72,.89),h*h);float sun=pow(max(0.,dot(d,normalize(vec3(-.5,.8,-.4)))),90.);gl_FragColor=vec4(c+vec3(2.8,2.4,1.9)*sun,1.);}'});scene.add(new T.Mesh(geometry,material));
 const generator=new T.PMREMGenerator(renderer),target=generator.fromScene(scene,.04,.1,10);geometry.dispose();material.dispose();generator.dispose();return target;
}
