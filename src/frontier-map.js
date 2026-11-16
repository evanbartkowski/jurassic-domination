import {CHUNK_SIZE,WORLD_RADIUS,biomeAt,seeded} from './world-data.js';
const TAU=Math.PI*2,quarter=Math.PI/2,angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export const RIDGES=[145,330,535,750,980,1210,1430].map((radius,i)=>({id:'spine-'+i,radius,phase:.18+i*.34,passWidth:64}));
export const LOCATIONS=[
 {id:'emerald-forest',name:'The Emerald Wilds',kind:'emerald',x:300,y:-300,radius:68,color:0x36b97d,residents:['iguanodon','therizinosaurus','dryosaurus'],description:'Jade canopies and glowing roots shelter great grazing herds.'},
 {id:'crystal-forest',name:'The Shardwood',kind:'crystal',x:-500,y:420,radius:72,color:0x8dcfee,residents:['yutyrannus','pachyrhinosaurus','frost-dragon'],description:'Luminous crystal trunks ring beneath the feet of frost hunters.'},
 {id:'titan-cavern',name:'The World-Eater\'s Hollow',kind:'cavern',x:600,y:600,radius:98,color:0xc5b391,residents:['giganotosaurus','spinosaurus','argentinosaurus'],description:'A colossal skull and ribcage form a cavern. Enter through its jaws or tail passage.'},
 {id:'stormhorn',name:'Stormhorn Ascent',kind:'mountain',x:-690,y:-490,radius:78,color:0x9da4bd,residents:['hatzegopteryx','quetzalcoatlus','utahraptor'],description:'A winding exposed ascent leads to the nesting grounds of giant flying reptiles.'},
 {id:'tideglass-lagoon',name:'Tideglass Lagoon',kind:'lagoon',x:190,y:200,radius:52,color:0x4fb7b7,residents:['archelon','ichthyosaurus','mosasaurus'],description:'Sheltered shoals drop into a deep predator-filled lagoon.'},
];
export function locationAt(x,y){return LOCATIONS.find(s=>Math.hypot(x-s.x,y-s.y)<s.radius)||null;}
function phaseAt(radius){let last={radius:0,phase:RIDGES[0].phase};for(const ridge of RIDGES){if(radius<=ridge.radius){const t=(radius-last.radius)/(ridge.radius-last.radius);return last.phase+(ridge.phase-last.phase)*t;}last=ridge;}return last.phase;}
export function pathDistance(x,y){const r=Math.hypot(x,y),phase=phaseAt(r),a=Math.atan2(y,x);let distance=Math.abs(Math.atan2(Math.sin((a-phase)*4),Math.cos((a-phase)*4)))/4*r;
 const mountain=LOCATIONS[3],trail=[[-100,-8],[-60,0],[-35,14],[-17,9],[0,0]];if(Math.hypot(x-mountain.x,y-mountain.y)<110)for(let i=1;i<trail.length;i++){const [ax,ay]=trail[i-1],[bx,by]=trail[i],dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-mountain.x-ax)*dx+(y-mountain.y-ay)*dy)/(dx*dx+dy*dy)));distance=Math.min(distance,Math.hypot(x-mountain.x-ax-dx*t,y-mountain.y-ay-dy*t));}return distance;
}
export function frontierElevation(x,y){
 const r=Math.hypot(x,y);let height=0;
 for(const ridge of RIDGES){const d=Math.abs(r-ridge.radius);if(d>25)continue;const pass=Math.abs(Math.atan2(Math.sin((Math.atan2(y,x)-ridge.phase)*4),Math.cos((Math.atan2(y,x)-ridge.phase)*4)))/4*ridge.radius;if(pass<ridge.passWidth/2)continue;height=Math.max(height,Math.exp(-d*d/130)*9);}
 const mountain=LOCATIONS[3],d=Math.hypot(x-mountain.x,y-mountain.y);if(d<mountain.radius)height+=26*(1-(d/mountain.radius)**2)**2;
 return height;
}
export function groundHeight(x,z){const d=Math.hypot(x,z),basin=Math.min(1,Math.max(0,(d-40)/35));return -.14+(Math.sin(x*.016+.5)*Math.cos(z*.014)*.85+Math.sin(x*.038-z*.032)*.45)*basin+Math.sin(x*.11)*Math.cos(z*.12)*.065+frontierElevation(x,z);}
const worlds=new Map();
function allFeatures(seed){
 if(worlds.has(seed))return worlds.get(seed);const random=seeded(seed^0x7818e1),features=[];
 const add=(type,id,x,y,radius,extra={})=>{if(Math.hypot(x,y)>=WORLD_RADIUS-20)return;features.push({type,id,x,y,radius,tier:biomeAt(x,y).tier,phase:random()*TAU,solid:type==='frontier-rock',...extra});};
 for(const ridge of RIDGES){const count=Math.ceil(TAU*ridge.radius/16.5);for(let i=0;i<count;i++){const a=i/count*TAU,pass=Math.abs(Math.atan2(Math.sin((a-ridge.phase)*4),Math.cos((a-ridge.phase)*4)))/4*ridge.radius;if(pass<ridge.passWidth/2)continue;add('frontier-rock',`${ridge.id}:${i}`,Math.cos(a)*ridge.radius,Math.sin(a)*ridge.radius,10.2,{ridge:ridge.id,style:'ridge',height:15+random()*18,protected:true});}}
 for(const s of LOCATIONS){add(s.kind==='lagoon'?'water':'frontier-site',s.id,s.x,s.y,s.kind==='lagoon'?43:s.radius,{site:s.id,style:s.kind,solid:false,capacity:s.kind==='cavern'?16:0});
  if(s.kind==='cavern')for(const side of [-1,1])for(let i=0;i<20;i++)add('frontier-rock',`${s.id}:wall:${side}:${i}`,s.x-92+i*9.7,s.y+side*38,7,{style:'cavern-wall',height:38+random()*15,protected:true});
  if(s.kind==='mountain')for(let i=0;i<16;i++){const a=i*TAU/16;if(Math.abs(a-Math.PI)<.4)continue;add('frontier-rock',`${s.id}:crag:${i}`,s.x+Math.cos(a)*52,s.y+Math.sin(a)*52,8,{style:'mountain-crag',height:16+random()*10,protected:true});}
 }
 if(worlds.size>=4)worlds.delete(worlds.keys().next().value);worlds.set(seed,features);return features;
}
export function frontierFeatures(seed,cx,cy){
 const features=allFeatures(seed).filter(f=>Math.floor(f.x/CHUNK_SIZE)===cx&&Math.floor(f.y/CHUNK_SIZE)===cy).map(f=>({...f}));
 const x=cx*CHUNK_SIZE+83,y=cy*CHUNK_SIZE+77;if(Math.hypot(x,y)>65&&Math.hypot(x,y)<WORLD_RADIUS-20&&!blockedFrontierPoint(seed,x,y,9))features.push({id:`shelter:${cx},${cy}`,type:'shelter',x,y,radius:5.8,capacity:2,tier:biomeAt(x,y).tier,phase:0,solid:false});return features;
}
export function blockedFrontierPoint(seed,x,y,padding=2){return allFeatures(seed).some(f=>f.solid&&Math.abs(f.x-x)<f.radius+padding&&Math.abs(f.y-y)<f.radius+padding&&Math.hypot(f.x-x,f.y-y)<f.radius+padding);}
export function shelterAt(point,size,features=[]){return features.find(f=>!f.destroyed&&((f.type==='shelter'&&size<=(f.capacity||2)&&Math.abs(point.x-f.x)<2.1&&Math.abs(point.y-f.y)<3.8)||(f.type==='frontier-site'&&f.style==='cavern'&&size<=16&&Math.abs(point.x-f.x)<76&&Math.abs(point.y-f.y)<13)))||null;}
export function routeWaypoint(from,to){
 const mountain=LOCATIONS[3],inside=p=>Math.hypot(p.x-mountain.x,p.y-mountain.y)<45;
 if(inside(from)!==inside(to)){
  if(inside(from))return{x:mountain.x-68,y:mountain.y};
  if(from.x>mountain.x-44||Math.abs(from.y-mountain.y)>16){const a=Math.atan2(from.y-mountain.y,from.x-mountain.x),delta=angleDiff(Math.PI,a),next=a+Math.max(-.6,Math.min(.6,delta));return{x:mountain.x+Math.cos(next)*76,y:mountain.y+Math.sin(next)*76};}
 }
 const r1=Math.hypot(from.x,from.y),r2=Math.hypot(to.x,to.y),ridge=RIDGES.filter(r=>Math.min(r1,r2)<r.radius&&r.radius<Math.max(r1,r2)).sort((a,b)=>Math.abs(a.radius-r1)-Math.abs(b.radius-r1))[0];if(!ridge)return to;
 const points=Array.from({length:4},(_,i)=>{const a=ridge.phase+i*quarter;return{x:Math.cos(a)*(ridge.radius+Math.sign(r2-r1)*18),y:Math.sin(a)*(ridge.radius+Math.sign(r2-r1)*18)};});
 return points.sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)+Math.hypot(a.x-to.x,a.y-to.y)*.5-Math.hypot(b.x-from.x,b.y-from.y)-Math.hypot(b.x-to.x,b.y-to.y)*.5)[0];
}
