import * as T from 'three';
import {BOTANY} from './botany.js';
import {LOCATIONS,groundHeight} from './frontier-map.js';
import {seeded} from './world-data.js';
import {naturalMaterial} from './natural-materials.js';
const point=(x,y,z)=>new T.Vector3(x,y,z);
/** Closed profile crystal: six facets, a chiseled shoulder and one solid tip. */
function crystalGeometry(){
 const p=[],index=[],sides=6,rings=[[0,.7],[.12,1],[.78,.88]];
 for(const [y,r]of rings)for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2;p.push(Math.cos(a)*r,y,Math.sin(a)*r);}
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){const a=j*sides+i,b=j*sides+(i+1)%sides;index.push(a,b,a+sides,b,b+sides,a+sides);}
 for(let i=1;i<sides-1;i++)index.push(0,i+1,i);
 const tip=p.length/3;p.push(0,1,0);for(let i=0;i<sides;i++)index.push(12+i,12+(i+1)%sides,tip);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(index);g.computeVertexNormals();return g;
}
function cappedTube(points,radius,flatten=1,taper=.66){
 const curve=new T.CatmullRomCurve3(points.map(p=>point(...p))),g=new T.TubeGeometry(curve,48,radius,8,false),positions=[...g.attributes.position.array],normals=[...g.attributes.normal.array],uv=[...g.attributes.uv.array],indices=[...g.index.array];
 const frames=curve.computeFrenetFrames(48,false),length=curve.getLength();
 for(let i=0;i<=48;i++){const t=i/48,center=curve.getPointAt(t),width=taper+(1-taper)*Math.pow(Math.sin(Math.PI*t),.55);for(let k=0;k<=8;k++){const a=k/8*Math.PI*2,p=center.clone().addScaledVector(frames.normals[i],-Math.cos(a)*radius*width).addScaledVector(frames.binormals[i],Math.sin(a)*radius*width*flatten),j=(i*9+k)*3;positions[j]=p.x;positions[j+1]=p.y;positions[j+2]=p.z;uv[(i*9+k)*2]=t*length/5;uv[(i*9+k)*2+1]=k/8*radius;}}
 for(const end of [0,1]){const center=curve.getPoint(end),normal=curve.getTangent(end).multiplyScalar(end?1:-1),i=positions.length/3;positions.push(center.x,center.y,center.z);normals.push(normal.x,normal.y,normal.z);uv.push(.5,.5);const base=end?48*9:0;for(let k=0;k<8;k++)indices.push(...(end?[i,base+k,base+k+1]:[i,base+k+1,base+k]));}
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createFrontierFeature(f){
 const root=new T.Group(),geos=new Set(),mats=new Set(),random=seeded((f.x*7817^f.y*1877)>>>0),base=groundHeight(f.x,f.y);root.position.set(f.x,base,f.y);root.name=f.id||f.style||f.type;
 const mat=(color,extra={})=>{const m=naturalMaterial(f.style==='cavern'?'bone':f.style==='emerald'?'leaf':'stone',color,{roughness:.88,...extra});mats.add(m);return m;};
 const mesh=(name,g,m,p=[0,0,0],scale=[1,1,1],rot=[0,0,0])=>{geos.add(g);const o=new T.Mesh(g,m);o.name=name;o.position.set(...p);o.scale.set(...scale);o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
 const localY=(x,z)=>groundHeight(f.x+x,f.y+z)-base;
 const stone=()=>mat(f.style==='cavern-wall'?0x55534a:0x65675c);
 if(f.type==='frontier-rock'){
  const g=BOTANY.rock[0].clone();g.computeBoundingBox();const box=g.boundingBox,center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),a=g.attributes.position;for(let i=0;i<a.count;i++){const y=(a.getY(i)-box.min.y)/size.y,foot=1+Math.max(0,.22-y)*1.8;a.setXYZ(i,(a.getX(i)-center.x)/(size.x*.5)*foot,y,(a.getZ(i)-center.z)/(size.z*.5)*foot);}g.computeVertexNormals();mesh('Impassable_stone_spine',g,stone(),[0,-.35,0],[f.radius,(f.height||22),f.radius],[0,f.phase||0,0]);
 }else if(f.type==='shelter'){
  const dark=stone(),rock=new T.SphereGeometry(1,20,12);const rp=rock.attributes.position;for(let i=0;i<rp.count;i++){const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),wear=1+Math.sin(x*13+z*9)*.055;rp.setXYZ(i,x*wear,y,z*wear);}rock.computeVertexNormals();
  mesh('Shelter_left_support',rock,dark,[-4.4,2.9,0],[1.5,3.4,4.2]);mesh('Shelter_right_support',rock,dark,[4.4,2.9,0],[1.5,3.4,4.2]);
  mesh('Shelter_roof',rock,dark,[0,6.2,0],[6.7,1.45,5.5]);
  const mark=mat(0x95c6c9,{emissive:0x43747b,emissiveIntensity:.35});mesh('Shelter_threshold',new T.RingGeometry(3.9,4.1,24),mark,[0,.04,0],[1,1,1],[-Math.PI/2,0,0]);
 }else if(f.style==='cavern'){
  const bone=mat(0xbdb09a),shadowBone=mat(0x887f70),fade=[];
  for(let i=0;i<10;i++){const x=-78+i*16.5,h=48+Math.sin((i+1)/11*Math.PI)*10,width=29+Math.sin((i+1)/11*Math.PI)*8;
   const rib=mesh('Rib_'+i,cappedTube([[x,0,-width],[x-2,15,-width-3],[x,39,-width*.6],[x+1,h,0],[x,39,width*.6],[x-2,15,width+3],[x,0,width]],2.15,.48,.30),bone);fade.push(rib);
   mesh('Vertebra_'+i,new T.CapsuleGeometry(2.8,5,6,12),shadowBone,[x,h-1,0],[1,1,.9],[0,0,Math.PI/2]);
   fade.push(mesh('Neural_spine_'+i,cappedTube([[x,h-2,0],[x-1,h+3,0],[x-3,h+7,0]],1.9,.40,.44),shadowBone));
  }
  const spine=mesh('Dorsal_spine',cappedTube([[-84,47,0],[-30,57,0],[32,55,0],[78,45,0]],2.6),bone);fade.push(spine);
  for(const side of [-1,1]){
   mesh('Skull_cheek_'+side,cappedTube([[67,33,side*19],[82,42,side*18],[101,35,side*17],[112,28,side*16]],2.8),bone);
   mesh('Skull_jaw_'+side,cappedTube([[67,8,side*20],[89,5,side*22],[114,8,side*16]],2.4),shadowBone);
   mesh('Skull_orbit_'+side,cappedTube([[70,33,side*19],[73,41,side*19],[81,43,side*19],[87,38,side*19],[84,29,side*19],[76,27,side*19],[70,33,side*19]],1.6,.72,.85),bone);
   mesh('Skull_antorbital_strut_'+side,cappedTube([[87,38,side*18],[91,26,side*17],[102,24,side*16]],1.8,.65,.64),shadowBone);
   for(let i=0;i<6;i++){const length=8-i*.5,x=86+i*4,roof=39-i*1.68-2.3;mesh('Skull_tooth_'+side+'_'+i,new T.ConeGeometry(1.35,length,6),bone,[x,roof-length/2,side*(19-i*.5)],[1,1,1],[Math.PI,0,0]);mesh('Skull_lower_tooth_'+side+'_'+i,new T.ConeGeometry(1.1,length*.7,6),bone,[x,7+length*.35,side*(21-i*.6)]);}
  }
  for(const side of [-1,1])mesh('Skull_nasal_arch_'+side,cappedTube([[78,44,side*16],[94,41,side*11],[112,28,side*13]],2.6,.75,.70),bone);
  mesh('Skull_open_jaw_threshold',cappedTube([[113,7,-16],[119,3,0],[113,7,16]],2.2),bone);
  const moss=naturalMaterial('leaf',0x72906b,{vertexColors:true});mats.add(moss);for(let i=0;i<12;i++){const x=-68+i*12;mesh('Fossil_moss_'+i,BOTANY.fern[1].clone(),moss,[x,.10,(i%2?1:-1)*25],[2.4,1.6,2.4],[0,i*2.4,0]);}
  root.userData.canopy=fade;
 }else if(f.style==='emerald'){
  const trunk=naturalMaterial('broadleaf',0xc7dfc3),leaf=mat(0x9ec9a4,{vertexColors:true,emissive:0x08241a,emissiveIntensity:.18}),gem=mat(0x57997c,{emissive:0x0c4732,emissiveIntensity:.22,roughness:.38}),crystal=crystalGeometry();mats.add(trunk);
  const treeGeo=BOTANY.ginkgo[0],fernGeo=BOTANY.fern[0];
  for(let i=0;i<34;i++){const a=i*2.4,r=16+random()*48,x=Math.cos(a)*r,z=Math.sin(a)*r,y=localY(x,z),scale=1.1+random();mesh('Jade_tree_'+i,treeGeo.clone(),trunk,[x,y,z],[scale*2.5,scale*4.7,scale*2.5],[0,a,0]);for(let k=0;k<3;k++)mesh('Jade_root_vein_'+i+'_'+k,crystal,gem,[x+Math.cos(k*2.1)*.75,y-.15,z+Math.sin(k*2.1)*.75],[.35,1.3+random(),.35],[.17,a+k,.19]);if(i%2===0)mesh('Luminous_fern_'+i,fernGeo.clone(),leaf,[x+3,y,z],[2,2,2],[0,a,0]);}
  root.userData.motes=[];for(let i=0;i<12;i++){const a=random()*Math.PI*2,r=random()*55;root.userData.motes.push(mesh('Jade_mote',new T.IcosahedronGeometry(.12,0),gem,[Math.cos(a)*r,3+random()*8,Math.sin(a)*r]));}
 }else if(f.style==='crystal'){
  const g=crystalGeometry(),blue=mat(0x7ab3bb,{emissive:0x173849,emissiveIntensity:.16,metalness:0,roughness:.23}),violet=mat(0x8684ac,{emissive:0x29263f,emissiveIntensity:.14,roughness:.29});
  for(let i=0;i<54;i++){const a=i*2.4,r=14+random()*55,x=Math.cos(a)*r,z=Math.sin(a)*r,y=localY(x,z),h=5+random()*16;mesh('Crystal_trunk_'+i,g,i%3?blue:violet,[x,y-.1,z],[1.2+random()*1.2,h,1.2+random()*1.2],[Math.sin(i)*.09,a,Math.cos(i)*.12]);for(let k=0;k<2;k++)mesh('Crystal_root_'+i+'_'+k,g,violet,[x+k*1.4,y,z-1],[.7,h*.30,.7],[.24,a+k,.22]);}
 }else if(f.style==='mountain'){
  const nest=mat(0x66513b);for(let i=0;i<3;i++){const x=-12+i*12,z=8;mesh('Aerie_nest',new T.TorusGeometry(4,.7,6,24),nest,[x,localY(x,z)+.4,z],[1,1,1],[Math.PI/2,0,0]);}
 }
 if(f.style==='emerald')root.userData.canopy=root.children.filter(o=>o.name.startsWith('Jade_tree')||o.name.startsWith('Emerald_crown'));
 if(f.type==='frontier-rock')root.userData.canopy=[...root.children];
 if(f.type==='shelter')root.userData.canopy=[root.getObjectByName('Shelter_roof')];
 root.userData.feature=f;
 root.userData.animate=(t,p)=>{
  for(const m of root.userData.canopy||[]){let fade=false;if(p){if(f.type==='shelter')fade=Math.hypot(p.x-f.x,p.y-f.y)<10;else if(f.type==='frontier-rock')fade=f.y>p.y-2&&f.y<p.y+65&&Math.abs(f.x-p.x)<40;else if(f.style==='emerald')fade=Math.hypot(p.x-f.x-m.position.x,p.y-f.y-m.position.z)<19;else fade=Math.hypot(p.x-f.x,p.y-f.y)<95;}
   if(!m.material.userData.fadeMaterial){m.material=m.material.clone();mats.add(m.material);m.material.userData.fadeMaterial=true;m.material.userData.baseAlphaTest=m.material.alphaTest;}m.material.transparent=fade;m.material.opacity=fade?.28:1;m.material.alphaTest=fade?m.material.userData.baseAlphaTest*.22:m.material.userData.baseAlphaTest;m.material.depthWrite=!fade;
  }
  for(let i=0;i<(root.userData.motes?.length||0);i++)root.userData.motes[i].position.y=4+Math.sin(t*.7+i)*2;
 };
 root.userData.dispose=()=>{for(const g of geos)g.dispose();for(const m of mats)m.dispose();};return root;
}
