import * as T from 'three';

/** Dedicated key-art shot: two triangles, bounded mist, no game-world mutation. */
export function createStartVista({texture:providedTexture}={}){
 const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=1;camera.aspect=1;
 let ready=!!providedTexture;
 const reducedMedia=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 const uniforms={art:{value:providedTexture||null},imageAspect:{value:1664/936},screenAspect:{value:1},time:{value:0},loaded:{value:providedTexture?1:0},diagnostic:{value:0}};
 const texture=providedTexture||new T.TextureLoader().load('assets/ui/start-keyart.webp',map=>{
  map.colorSpace=T.SRGBColorSpace;uniforms.imageAspect.value=map.image.width/map.image.height;uniforms.loaded.value=1;ready=true;
 });
 uniforms.art.value=texture;texture.colorSpace=T.SRGBColorSpace;
 const material=new T.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,toneMapped:false,
  vertexShader:'varying vec2 artUV;void main(){artUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`
   uniform sampler2D art;uniform float imageAspect,screenAspect,time,loaded,diagnostic;varying vec2 artUV;
   float mistNoise(vec2 p){return sin(p.x*2.1+sin(p.y*1.3))*sin(p.y*.7+sin(p.x*.9))*.5+.5;}
   void main(){
    vec2 uv=artUV;float focus=mix(.765,.5,smoothstep(.7,1.4,screenAspect));
    if(screenAspect<imageAspect)uv.x=(uv.x-.5)*screenAspect/imageAspect+focus;
    else {float scale=imageAspect/screenAspect;uv.y=(uv.y-.5)*scale+.5+(1.-scale)*.35;}
    uv+=vec2(sin(time*.07),cos(time*.055)-1.)*.002;
    vec3 color=texture2D(art,clamp(uv,.001,.999)).rgb;
    float fog=(1.-smoothstep(.0,.65,artUV.y))*.035*mistNoise(vec2(artUV.x*8.-time*.035,artUV.y*3.));
    color=mix(color,vec3(.14,.27,.24),fog);
    if(diagnostic>.5&&diagnostic<1.5)color=vec3(uv,0.);
    else if(diagnostic>1.5)color=texture2D(art,clamp(uv,.001,.999)).rgb;
    gl_FragColor=vec4(mix(vec3(.015,.04,.035),color,loaded),1.);
    #include <colorspace_fragment>
   }`});
 const geometry=new T.PlaneGeometry(2,2),plane=new T.Mesh(geometry,material);plane.frustumCulled=false;scene.add(plane);
 return {scene,camera,uniforms,get ready(){return ready;},update(dt,t,reduced){uniforms.screenAspect.value=camera.aspect;uniforms.time.value=reduced||reducedMedia?.matches?0:t;},dispose(){geometry.dispose();material.dispose();if(!providedTexture)texture.dispose();scene.clear();}};
}
