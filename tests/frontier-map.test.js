import test from 'node:test';import assert from 'node:assert/strict';
const map=await import('../src/frontier-map.js').catch(()=>({}));
test('mountain belts block straight travel and retain four wide traversable passes',()=>{
 assert.equal(typeof map.frontierFeatures,'function');assert.ok(map.RIDGES.length>=6);
 for(const ridge of map.RIDGES){const all=[];for(let x=-10;x<=10;x++)for(let y=-10;y<=10;y++)all.push(...map.frontierFeatures(77,x,y).filter(f=>f.ridge===ridge.id));assert.ok(all.length>20);
  for(let i=0;i<4;i++){const angle=ridge.phase+i*Math.PI/2,point={x:Math.cos(angle)*ridge.radius,y:Math.sin(angle)*ridge.radius};assert.ok(all.every(f=>Math.hypot(f.x-point.x,f.y-point.y)>f.radius+10));}
 }
});
test('named forests, mountains and a skeleton cavern have deterministic geography and location populations',()=>{
 assert.equal(typeof map.locationAt,'function');for(const id of ['emerald-forest','crystal-forest','titan-cavern','stormhorn']){const site=map.LOCATIONS.find(s=>s.id===id);assert.ok(site);assert.equal(map.locationAt(site.x,site.y).id,id);assert.ok(site.residents.length>=2);}
 assert.deepEqual(map.frontierFeatures(5,2,-2),map.frontierFeatures(5,2,-2));
});
test('shelters have accessible centers and a distinct size limit',()=>{
 assert.equal(typeof map.shelterAt,'function');const feature={type:'shelter',x:100,y:100,radius:6,capacity:2};assert.ok(map.shelterAt({x:100,y:100},1,[feature]));assert.equal(map.shelterAt({x:100,y:100},5,[feature]),null);
});
test('routes guide agents through a pass when a ridge separates them from a target',()=>{
 assert.equal(typeof map.routeWaypoint,'function');const r=map.RIDGES[1],a=r.phase+.65,from={x:Math.cos(a)*(r.radius-30),y:Math.sin(a)*(r.radius-30)},to={x:Math.cos(a)*(r.radius+30),y:Math.sin(a)*(r.radius+30)};const point=map.routeWaypoint(from,to);assert.ok(point);assert.ok(Math.hypot(point.x-to.x,point.y-to.y)>10);
});
test('the skeleton corridor and both entrances stay free of mountain collisions',()=>{
 const site=map.LOCATIONS.find(s=>s.kind==='cavern');for(let x=-118;x<=125;x+=2)assert.ok(!map.blockedFrontierPoint(77,site.x+x,site.y,3),'blocked at '+x);
});
test('Stormhorn has a clear western entrance and protected blocking crags on its eastern side',()=>{const m=map.LOCATIONS[3];assert.equal(map.blockedFrontierPoint(77,m.x-52,m.y,3),false);assert.equal(map.blockedFrontierPoint(77,m.x+52,m.y,3),true);assert.ok(map.pathDistance(m.x-52,m.y)<7);const goal=map.routeWaypoint({x:m.x+80,y:m.y},{x:m.x,y:m.y});assert.ok(Math.abs(goal.y-m.y)>20);});
test('all named destinations can be reached from the nursery through connected ground',()=>{
 const cell=8,n=401,index=(x,y)=>y*n+x;
 for(const seed of [1,77,1299]){const blocked=new Uint8Array(n*n),visited=new Uint8Array(n*n),queue=new Int32Array(n*n);
  for(let cx=-10;cx<=10;cx++)for(let cy=-10;cy<=10;cy++)for(const f of map.frontierFeatures(seed,cx,cy).filter(f=>f.solid)){
   const radius=f.radius+3;for(let x=Math.max(0,Math.floor((f.x-radius+1600)/cell));x<=Math.min(n-1,Math.ceil((f.x+radius+1600)/cell));x++)for(let y=Math.max(0,Math.floor((f.y-radius+1600)/cell));y<=Math.min(n-1,Math.ceil((f.y+radius+1600)/cell));y++)if(Math.hypot(x*cell-1600-f.x,y*cell-1600-f.y)<radius)blocked[index(x,y)]=1;
  }
  let head=0,tail=1;queue[0]=index(200,200);visited[queue[0]]=1;
  while(head<tail){const v=queue[head++],x=v%n,y=Math.floor(v/n);for(const [a,b]of[[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(a<0||b<0||a>=n||b>=n||Math.hypot(a*cell-1600,b*cell-1600)>1570)continue;const next=index(a,b);if(!blocked[next]&&!visited[next]){visited[next]=1;queue[tail++]=next;}}}
  for(const s of map.LOCATIONS)assert.ok(visited[index(Math.round((s.x+1600)/cell),Math.round((s.y+1600)/cell))],seed+' cannot reach '+s.id);
 }
});
