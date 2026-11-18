import * as THREE from "three";
import {naturalMaterial} from './natural-materials.js';
import {frontierElevation,pathDistance,groundHeight} from './frontier-map.js';
import { BOTANY } from './botany.js';
import { groundPigment } from './environment-presentation.js';
import { worldFeatures } from "./wilderness.js";
import { createWildFeature } from "./wilderness-art.js";
import {
  CHUNK_SIZE,
  WORLD_RADIUS,
  biomeAt,
  chunkSeed,
  seeded,
  LAIRS,
} from "./world-data.js";
const materials = new Map();
const foliageFocus = new THREE.Vector3(1e6, 0, 1e6);
const foliageWind = { value: 0 };
const foliageMenu = { value: 0 };
let foliageMaterial;
const foliageMaterials=new Map();
function foliageTexture() {
  if (canopyTextureMap) return canopyTextureMap;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d"),
    rand = seeded(311);
  c.fillStyle = "#95ab88";
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const x = rand() * 256,
      y = rand() * 256,
      v = 110 + Math.floor(rand() * 80);
    c.fillStyle = `rgba(${v - 35},${v + 25},${v - 40},0.38)`;
    c.fillRect(x, y, 1.5 + rand() * 3, 1.5 + rand() * 3);
  }
  canopyTextureMap = new THREE.CanvasTexture(canvas);
  canopyTextureMap.wrapS = canopyTextureMap.wrapT = THREE.RepeatWrapping;
  canopyTextureMap.repeat.set(3, 3);
  return canopyTextureMap;
}

function canopyMaterial(kind='leaf') {
  if (foliageMaterials.has(kind)) return foliageMaterials.get(kind);
  foliageMaterial = naturalMaterial(kind,0xffffff,{
    vertexColors: kind==='leaf',
    roughness: 0.86,
  });
  foliageMaterial.onBeforeCompile = (shader) => {
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float leafLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=max(vec3(0.),mix(vec3(leafLuma),diffuseColor.rgb,1.32))*vec3(.95,1.07,.98);`);
    shader.uniforms.foliageFocus = { value: foliageFocus };
    shader.uniforms.foliageTime = foliageWind;
    shader.uniforms.foliageMenu = foliageMenu;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float foliageTime;\nvarying vec3 foliageWorldPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      float foliageH = max(0.0, position.y - 0.2);
      float windPhase = 0.0;
      #ifdef USE_INSTANCING
        windPhase = instanceMatrix[3].x * .17 + instanceMatrix[3].z * .11;
      #endif
      float swayX = sin(foliageTime * 1.6 + windPhase + position.x * 0.5) * 0.025 * foliageH;
      float swayZ = cos(foliageTime * 1.3 + windPhase) * 0.018 * foliageH;
      transformed.x += swayX;
      transformed.z += swayZ;`,
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
      vec4 foliagePosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        foliagePosition=instanceMatrix*foliagePosition;
      #endif
      foliageWorldPosition=(modelMatrix*foliagePosition).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 foliageWorldPosition;\nuniform vec3 foliageFocus;\nuniform float foliageMenu;",
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
      if(foliageMenu>.5 && foliageWorldPosition.z>3.0 && foliageWorldPosition.x>0.0) discard;
      vec3 foliageOffset=foliageWorldPosition-foliageFocus;
      float foliageDistance=length(vec2(foliageOffset.x,(foliageOffset.z-foliageOffset.y)*.7071));
      if(foliageDistance<6.5 && foliageOffset.z>-4.0 && foliageOffset.y>.7){
        float foliageNoise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        if(foliageNoise<.98*(1.0-smoothstep(3.0,6.5,foliageDistance)))discard;
      }`,
      );
  };
  foliageMaterial.customProgramCacheKey = () => 'primeval-botany-'+kind;
  foliageMaterials.set(kind,foliageMaterial);
  return foliageMaterial;
}
const trunkLevels = [9, 8, 6, 5].map((segments) => new THREE.CylinderGeometry(0.18, 0.36, 1, segments));
const crownLevels = [[16, 11], [12, 8], [8, 5], [6, 4]].map(([width, height]) => new THREE.SphereGeometry(1, width, height));
const rockLevels = [1, 0, 0, 0].map((detail) => new THREE.DodecahedronGeometry(1, detail));
const coneLevels = [10, 8, 6, 5].map((segments) => new THREE.ConeGeometry(1, 1, segments));
const [trunkGeo, crownGeo, rockGeo, coneGeo] = [trunkLevels[0], crownLevels[0], rockLevels[0], coneLevels[0]];
for (const geo of [...crownLevels, ...rockLevels]) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      s = 1 + Math.sin(x * 13 + y * 9 + z * 7) * 0.075;
    p.setXYZ(i, x * s, y * s, z * s);
  }
  geo.computeVertexNormals();
}
function material(color) {
  if (!materials.has(color))
    materials.set(
      color,
      naturalMaterial('stone',color),
    );
  return materials.get(color);
}
function fern(fronds = 7, leaflets = 7) {
  const v = [];
  for (let n = 0; n < fronds; n++) {
    const a = (n / fronds) * 6.283,
      dx = Math.cos(a),
      dz = Math.sin(a);
    for (let i = 1; i <= leaflets; i++) {
      const t = i / (leaflets + 1),
        l = t * 1.25,
        h = Math.sin(t * 2.4) * 0.9,
        w = Math.sin(t * Math.PI) * 0.26;
      for (const side of [-1, 1])
        v.push(
          dx * l,
          h,
          dz * l,
          dx * (l - 0.13) - dz * w * side,
          h - 0.06,
          dz * (l - 0.13) + dx * w * side,
          dx * (l + 0.18),
          h + 0.01,
          dz * (l + 0.18),
        );
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
const fernLevels = [fern(), fern(6, 6), fern(5, 4), fern(4, 3)],
  fernGeo = fernLevels[0],
  fernMat = new THREE.MeshStandardMaterial({
    color: 0x659450,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
let groundMap, groundBumpMap, canopyTextureMap;

function groundTexture() {
  if (groundMap) return groundMap;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const c = canvas.getContext("2d"),
    rand = seeded(728);
  // Rich prehistoric humus earth base
  c.fillStyle = "#aaa38e";
  c.fillRect(0, 0, 1024, 1024);

  // Large organic moss and fertile silt drifts
  for (let i = 0; i < 48; i++) {
    const cx = rand() * 1024, cy = rand() * 1024, r = 60 + rand() * 140;
    const grad = c.createRadialGradient ? c.createRadialGradient(cx, cy, 10, cx, cy, r) : null;
    const gVal = Math.floor(45 + rand() * 30);
    if (grad && typeof grad.addColorStop === "function") {
      grad.addColorStop(0, `rgba(${gVal - 5},${gVal + 28},${gVal - 8},0.12)`);
      grad.addColorStop(0.65, `rgba(${gVal - 8},${gVal + 12},${gVal - 14},0.06)`);
      grad.addColorStop(1, "rgba(38,44,32,0)");
      c.fillStyle = grad;
    } else {
      c.fillStyle = `rgba(${gVal},${gVal + 20},${gVal},0.25)`;
    }
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
  }

  // Dense multi-layered soil granules and organic forest floor flecks
  for (let i = 0; i < 55000; i++) {
    const x = rand() * 1024,
      y = rand() * 1024,
      b = 80 + Math.floor(rand() * 110),
      isMoss = rand() < 0.45;
    c.fillStyle = isMoss
      ? `rgba(${b - 20},${b + 22},${b - 18},.12)`
      : `rgba(${b + 12},${b + 4},${b - 15},.12)`;
    c.fillRect(x, y, 1 + rand() * 2.5, rand() * 2.5 + 1);
  }

  // Fallen prehistoric needle litter and fibrous rootlets
  for (let i = 0; i < 3500; i++) {
    const x = rand() * 1024,
      y = rand() * 1024,
      len = 4 + rand() * 10,
      ang = rand() * Math.PI * 2;
    c.strokeStyle = rand() > 0.4 ? "#44593848" : "#8c724738";
    c.lineWidth = 0.8 + rand() * 0.7;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    c.stroke();
  }

  // Weathered mineral stones and smooth river pebbles
  for (let i = 0; i < 420; i++) {
    const px = rand() * 1024, py = rand() * 1024, pr = 1.5 + rand() * 3.5;
    c.fillStyle = `rgba(${135 + Math.floor(rand() * 45)},${130 + Math.floor(rand() * 40)},${115 + Math.floor(rand() * 35)},0.55)`;
    c.beginPath();
    c.ellipse(px, py, pr, pr * (0.6 + rand() * 0.5), rand() * 3.14, 0, Math.PI * 2);
    c.fill();
  }

  groundMap = new THREE.CanvasTexture(canvas);
  groundMap.colorSpace = THREE.SRGBColorSpace;
  groundMap.wrapS = groundMap.wrapT = THREE.RepeatWrapping;
  groundMap.repeat.set(12, 12);
  groundMap.anisotropy = 8;
  return groundMap;
}

function groundBumpTexture() {
  if (groundBumpMap) return groundBumpMap;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d"),
    rand = seeded(941);
  c.fillStyle = "#808080";
  c.fillRect(0, 0, 512, 512);

  // Surface bump noise for tactile terrain depth
  for (let i = 0; i < 28000; i++) {
    const x = rand() * 512, y = rand() * 512, val = Math.floor(rand() * 255);
    c.fillStyle = `rgba(${val},${val},${val},0.22)`;
    c.fillRect(x, y, 1.5 + rand() * 2, 1.5 + rand() * 2);
  }
  for (let i = 0; i < 250; i++) {
    const px = rand() * 512, py = rand() * 512, pr = 2 + rand() * 4;
    c.fillStyle = "rgba(230,230,230,0.55)";
    c.beginPath();
    c.arc(px, py, pr, 0, Math.PI * 2);
    c.fill();
  }

  groundBumpMap = new THREE.CanvasTexture(canvas);
  groundBumpMap.wrapS = groundBumpMap.wrapT = THREE.RepeatWrapping;
  groundBumpMap.repeat.set(12, 12);
  groundBumpMap.anisotropy = 4;
  return groundBumpMap;
}
function instanced(group, geometry, mat, count, positions, shadow = true) {
  if (count === 0) return null;
  const mesh = new THREE.InstancedMesh(geometry, mat, count),
    o = new THREE.Object3D();
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  const levels = geometry.userData.levels || (geometry === trunkGeo ? trunkLevels : geometry === crownGeo ? crownLevels : geometry === rockGeo ? rockLevels : geometry === coneGeo ? coneLevels : geometry === fernGeo ? fernLevels : null);
  if (levels) {
    mesh.userData.detail = { levels, count, thin: !shadow };
    (group.userData.detailMeshes ||= []).push(mesh);
  }
  for (let i = 0; i < count; i++) {
    const p = positions[i];
    o.position.set(...p.position);
    o.scale.set(...p.scale);
    o.rotation.set(...(p.rotation || [0, 0, 0]));
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
    if (p.color) mesh.setColorAt(i, new THREE.Color(p.color));
  }
  group.add(mesh);
  return mesh;
}

export function elevationAt(x, z) {
  return groundHeight(x,z);
}

export function createTerrainChunk(cx,cy,seed){
 const steps=createTerrainChunkSteps(cx,cy,seed);let result;
 do{result=steps.next();}while(!result.done);
 return result.value;
}

/** Yield between bounded geometry batches; a chunk becomes visible only when complete. */
export function* createTerrainChunkSteps(cx, cy, seed) {
  const group = new THREE.Group(),
    owned = [],
    water = [],
    rand = seeded(chunkSeed(seed, cx, cy) ^ 0x9148),
    ox = cx * CHUNK_SIZE,
    oy = cy * CHUNK_SIZE;
  const features=[];let terrainMat,completed=false;
  const release=()=>{
    features.forEach(f=>f.userData.dispose());owned.forEach(g=>g.dispose());terrainMat?.dispose();water.forEach(w=>w.material.dispose());
    group.traverse(m=>{if(m.isInstancedMesh)m.dispose();if(m.isMesh&&!m.isInstancedMesh&&m.geometry.type==='TorusGeometry')m.material.dispose();});
  };
  try{
  const featureData = worldFeatures(seed, cx, cy),
    clearFeature = (x, z, margin = 0) =>
      featureData.some((f) => Math.hypot(f.x - x, f.y - z) < f.radius + margin);
  // Neighbor pools participate on both sides of a chunk boundary. This only
  // shapes rendered ground; obstacle and swimming coordinates remain intact.
  const pools=[];
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
    yield 'neighbor-water';
    for(const f of (dx===0&&dz===0?featureData:worldFeatures(seed,cx+dx,cy+dz)))
      if(f.type==='water')pools.push({...f,surface:elevationAt(f.x,f.y)+.1});
  }
  const region = biomeAt(ox + 80, oy + 80),
    geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 32, 32);
  geo.rotateX(-Math.PI / 2);
  owned.push(geo);
  const positions = geo.attributes.position,
    colors = [];
  for (let i = 0; i < positions.count; i++) {
    if(i%64===0)yield 'ground';
    const x = positions.getX(i) + ox + 80,
      z = positions.getZ(i) + oy + 80,
      biome = biomeAt(x, z),
      color = groundPigment(x,z);
    const trail = Math.abs(Math.sin(x * 0.011 + Math.sin(z * 0.008) * 2));
    if (trail < 0.08) color.lerp(new THREE.Color(0xa09371), 0.32);
    // Pigment is world-space deterministic, including shared chunk edges.
    colors.push(color.r, color.g, color.b);
    let height=elevationAt(x,z);
    for(const pool of pools){
      const distance=Math.hypot(x-pool.x,z-pool.y);
      if(distance<pool.radius+8){
        const blend=1-THREE.MathUtils.smoothstep(distance,pool.radius+2,pool.radius+8);
        const depth=Math.max(0,1-distance/pool.radius)*Math.min(3,pool.radius*.18);
        height=THREE.MathUtils.lerp(height,Math.min(height,pool.surface-.12-depth),blend);
      }
    }
    positions.setY(i,height);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const terrainUV=geo.attributes.uv;for(let i=0;i<positions.count;i++)terrainUV.setXY(i,(positions.getX(i)+ox+80)/4,(positions.getZ(i)+oy+80)/4);
  geo.computeVertexNormals();
  terrainMat = naturalMaterial('soil',0xffffff,{
      vertexColors: true,
      bumpScale: 0.022,
      roughness: 0.94,
    });
  const ground = new THREE.Mesh(geo, terrainMat);
  ground.position.set(ox + 80, 0, oy + 80);
  ground.receiveShadow = true;
  group.add(ground);
  yield;
  const forest = ["fernwood", "redwood", "grove", "fen", "marsh"].includes(
      region.id,
    ),
    frost = region.id === "frost",
    barren = ["volcano", "desert", "rift", "abyss", "origin"].includes(
      region.id,
    );
  const treeCount = forest ? 95 : barren ? 16 : 45,
    trunks = [],
    crowns = [],
    palmLeaves = [],
    rocks = [],
    ferns = [],
    flowers = [],
    reedStems = [],
    reedHeads = [],
    mushroomStems = [],
    mushroomCaps = [],
    shrubs = [];
  for (let i = 0; i < treeCount; i++) {
    if(i%24===0)yield;
    const x = ox + rand() * CHUNK_SIZE,
      z = oy + rand() * CHUNK_SIZE;
    if (Math.hypot(x, z) < 17 || clearFeature(x, z, 4)||pathDistance(x,z)<9) continue;
    const ey = elevationAt(x, z);
    const scale = 0.85 + rand() * 1.35,
      height = (forest ? 5 : 4) * scale;
    if (["desert", "savannah", "sky"].includes(region.id)) trunks.push({
      position: [x, ey + height / 2, z],
      scale: [scale, height, scale],
    });
    if (
      region.id === "desert" ||
      region.id === "savannah" ||
      region.id === "sky"
    ) {
      palmLeaves.push({
        position: [x, ey + height, z],
        scale: [4 * scale, 2 * scale, 4 * scale],
        rotation: [0, rand() * 6.28, 0],
      });
    } else
      for (let j = 0; j < 1; j++) {
        const color = new THREE.Color(
          frost ? 0xb7c9c3 : barren ? 0xb1a58b : 0xe5e7cb,
        ).multiplyScalar(0.75 + rand() * 0.5);
        crowns.push({
          position: [
            x,
            ey,
            z,
          ],
          scale: [2.4 * scale, height / 2.6 * 1.6, 2.4 * scale],
          rotation: [0, rand() * 6.28, 0],
          color,
        });
      }
  }
  instanced(
    group,
    trunkGeo,
    material(barren ? 0x6b5c4b : 0x665540),
    trunks.length,
    trunks,
  );
  yield;
  instanced(
    group,
    BOTANY.conifer[0],
    canopyMaterial('conifer'),
    crowns.filter((p,i)=>!['grove','fen','fernwood'].includes(region.id)||(region.id==='fernwood'&&i%3===0)).length,
    crowns.filter((p,i)=>!['grove','fen','fernwood'].includes(region.id)||(region.id==='fernwood'&&i%3===0)),
  );
  const broadCrowns=crowns.filter((p,i)=>['grove','fen'].includes(region.id)||(region.id==='fernwood'&&i%3!==0));instanced(group,BOTANY.ginkgo[0],canopyMaterial('broadleaf'),broadCrowns.length,broadCrowns);
  instanced(group, BOTANY.cycad[0], canopyMaterial(), palmLeaves.length, palmLeaves);
  yield;
  for (let i = 0; i < 28; i++) {
    const x = ox + rand() * CHUNK_SIZE,
      z = oy + rand() * CHUNK_SIZE,
      s = 0.5 + rand() * 2.2;
    if (clearFeature(x, z, 1)) continue;
    const ey = elevationAt(x, z);
    rocks.push({
      position: [x, ey - 0.05, z],
      scale: [s, s * 0.65, s * 0.9],
      rotation: [rand(), rand() * 6.28, rand()],
      color: frost ? 0xa4b4b0 : region.id === "volcano" ? 0x454244 : 0x7b7d6d,
    });
  }
  const rockMaterial = material(0xd7d4bb); rockMaterial.vertexColors = true;
  instanced(group, BOTANY.rock[0], rockMaterial, rocks.length, rocks);
  const cover = forest ? 140 : barren ? 24 : 80;
  const thickets = Array.from({ length: forest ? 9 : 5 }, () => ({
    x: ox + 14 + rand() * (CHUNK_SIZE - 28),
    z: oy + 14 + rand() * (CHUNK_SIZE - 28),
  }));
  for (let i = 0; i < cover; i++) {
    if(i%32===0)yield;
    const patch = thickets[i % thickets.length], angle = rand() * Math.PI * 2,
      radius = Math.sqrt(rand()) * (forest ? 16 : 12),
      x = patch.x + Math.cos(angle) * radius,
      z = patch.z + Math.sin(angle) * radius,
      s = 0.35 + rand() * 0.85;
    if (clearFeature(x, z, 0.3)) continue;
    const ey = elevationAt(x, z);
    ferns.push({
      position: [x, ey + 0.03, z],
      scale: [s, s, s],
      rotation: [0, rand() * 6.28, 0],
      color: frost ? 0xbacabd : barren ? 0xbeb18b : 0xe0e6b6,
    });
  }
  instanced(group, BOTANY.fern[0], canopyMaterial(), ferns.length, ferns, false);
  yield;
  for (let i = 0; i < 45; i++) {
    const x = ox + rand() * 160,
      z = oy + rand() * 160;
    if (clearFeature(x, z, 0.5)) continue;
    const ey = elevationAt(x, z);
    flowers.push({
      position: [x, ey, z],
      scale: [0.7, 0.7, 0.7],
      color: region.tier >= 6 ? [0xcfa8d9,0x87d7d5,0xe9c88c][i%3] : frost ? 0xbacbdd : [0xd6c397,0xba83a9,0xd2a764,0x94b4d5][i%4],
    });
  }
  instanced(
    group,
    BOTANY.flower[0],
    canopyMaterial(),
    flowers.length,
    flowers,
    false,
  );
  // Small clustered natural details share geometry and are instanced, keeping
  // the undergrowth varied without one draw call per plant.
  for (let i=0;i<(barren?25:65);i++) {
    const x=ox+rand()*CHUNK_SIZE,z=oy+rand()*CHUNK_SIZE;
    if (Math.hypot(x,z)<9 || clearFeature(x,z,1)) continue;
    const ey = elevationAt(x, z);
    const s=.65+rand()*.7;
    if (i%3===0) {
      for (let j=0;j<3;j++) {
        const dx=x+(rand()-.5)*.8,dz=z+(rand()-.5)*.8,h=(.5+rand()*.6)*s;
        mushroomCaps.push({position:[dx,ey,dz],scale:[s,s,s],color:frost?0xb8cfce:i%2?0xe7d0aa:0xd9b788});
      }
    } else if (i%3===1) {
      for (let j=0;j<1;j++) {
        const h=(1+rand())*s,dx=x+(rand()-.5),dz=z+(rand()-.5);
        reedStems.push({position:[dx,ey,dz],scale:[s,h,s],rotation:[0,0,(rand()-.5)*.12]});
      }
    } else {
      shrubs.push({position:[x,ey,z],scale:[s,s,s],rotation:[0,rand()*6.28,0],color:frost?0xbdc9c0:barren?0xc5b88a:0xe4e8bb});
    }
  }
  instanced(group,BOTANY.horsetail[0],canopyMaterial(),reedStems.length,reedStems,false);
  instanced(group,crownGeo,material(0xb28e65),reedHeads.length,reedHeads,false);
  instanced(group,trunkGeo,material(0xd6c4a4),mushroomStems.length,mushroomStems,false);
  instanced(group,BOTANY.mushroom[0],canopyMaterial(),mushroomCaps.length,mushroomCaps,false);
  instanced(group,BOTANY.shrub[0],canopyMaterial(),shrubs.length,shrubs,false);
  yield;
  for (const lair of LAIRS)
    if (
      lair.x >= ox &&
      lair.x < ox + 160 &&
      lair.y >= oy &&
      lair.y < oy + 160
    ) {
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * 6.28,
          stone = new THREE.Mesh(rockGeo, material(0x6d6875));
        stone.position.set(
          lair.x + Math.cos(a) * 10,
          1.8,
          lair.y + Math.sin(a) * 10,
        );
        stone.scale.set(1.3, 3, 1.5);
        stone.castShadow = true;
        group.add(stone);
      }
      const ringGeo = new THREE.TorusGeometry(10, 0.12, 6, 64);
      owned.push(ringGeo);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshStandardMaterial({
          color: 0xb8a0df,
          emissive: 0x704991,
          emissiveIntensity: 1.1,
        }),
      );
      ring.position.set(lair.x, 0.16, lair.y);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }
  for(const f of featureData){yield 'feature:'+f.type;features.push(createWildFeature(f,elevationAt(f.x,f.y)));}
  features.forEach((f) => group.add(f));
  group.userData = {
    ...group.userData,
    features,
    water,
    dispose:release,
  };
  completed=true;
  return group;
  }finally{if(!completed)release();}
}

export class Terrain {
  constructor(scene, { quality = "high", createChunk = createTerrainChunk, buildBudgetMs=2 } = {}) {
    this.scene = scene;
    this.chunks = new Map();
    this.seed = null;
    this.positionKey = "";
    this.quality = ["low", "medium", "high"].includes(quality) ? quality : "high";
    this.createChunk = createChunk;
    this.buildBudgetMs=buildBudgetMs;this.buildJob=null;
    this.pending = [];
    this.focusPosition = { x: 0, y: 0 };
    this.disposed = false;
    this.metrics = { builds: 0, builtThisFrame: 0, lastBuildMs: 0, peakBuildMs: 0,lastBuildSliceMs:0,peakBuildSliceMs:0 };
  }
  update(x, y, seed = 7281) {
    if (this.disposed) return;
    const cx = Math.floor(x / CHUNK_SIZE),
      cy = Math.floor(y / CHUNK_SIZE),
      key = `${cx},${cy}`;
    this.metrics.builtThisFrame = 0;
    if (this.seed !== seed) {
      this.buildJob?.steps.return();this.buildJob=null;
      for (const g of this.chunks.values()) {
        this.scene.remove(g);
        g.userData.dispose();
      }
      this.chunks.clear();
      this.pending = [];
    }
    if (this.seed !== seed || this.positionKey !== key) {
      this.seed = seed;
      this.positionKey = key;
      const plan = terrainPlan(x, y), needed = new Set(plan.map((p) => p.id));
      if(this.buildJob&&(!needed.has(this.buildJob.next.id)||(!this.chunks.has(key)&&this.buildJob.next.id!==key))){this.buildJob.steps.return();this.buildJob=null;}
      this.pending = plan.filter((p) => !this.chunks.has(p.id)&&p.id!==this.buildJob?.next.id);
      for (const [id, g] of this.chunks)
        if (!needed.has(id)) {
          this.scene.remove(g);
          g.userData.dispose();
          this.chunks.delete(id);
        }
    }
    // Center ground is immediate. Neighbor geometry is staged in short batches,
    // preventing a whole background chunk from blocking a travel frame.
    const next = this.buildJob?.next||this.pending.shift();
    if (next) {
      const start = performance.now();let g;
      if(this.createChunk!==createTerrainChunk||next.id===key){
        if(this.buildJob){let result;do{result=this.buildJob.steps.next();}while(!result.done);g=result.value;}else g=this.createChunk(next.cx,next.cy,seed);
      }else{
        this.buildJob||={next,steps:createTerrainChunkSteps(next.cx,next.cy,seed),ms:0,stage:'begin'};
        let result;
        do{const stageStart=performance.now();result=this.buildJob.steps.next();const stageMs=performance.now()-stageStart;if(stageMs>(this.metrics.peakStageMs||0)){this.metrics.peakStageMs=stageMs;this.metrics.peakStage=this.buildJob.stage;}this.buildJob.stage=result.value||'decoration';}while(!result.done&&performance.now()-start<this.buildBudgetMs);
        if(result.done)g=result.value;
      }
      const slice=performance.now()-start;
      this.metrics.lastBuildSliceMs=slice;this.metrics.peakBuildSliceMs=Math.max(this.metrics.peakBuildSliceMs,slice);
      if(this.buildJob)this.buildJob.ms+=slice;
      if(g){
      g.userData.chunkX = next.cx;
      g.userData.chunkY = next.cy;
      this.scene.add(g);
      this.chunks.set(next.id, g);
      const duration = this.buildJob?.ms||slice;this.buildJob=null;
      this.metrics.builds++;
      this.metrics.builtThisFrame = 1;
      this.metrics.lastBuildMs = duration;
      this.metrics.peakBuildMs = Math.max(this.metrics.peakBuildMs, duration);
      }
    }
    this.applyDetail(x, y);
  }
  setQuality(quality) {
    this.quality = ["low", "medium", "high"].includes(quality) ? quality : "high";
    this.applyDetail(this.focusPosition?.x || 0, this.focusPosition?.y || 0);
  }
  applyDetail(x, y) {
    const base = this.quality === "low" ? 2 : this.quality === "medium" ? 1 : 0;
    for (const group of this.chunks.values()) {
      const dx = Math.max(group.userData.chunkX * CHUNK_SIZE - x, 0, x - (group.userData.chunkX + 1) * CHUNK_SIZE),
        dy = Math.max(group.userData.chunkY * CHUNK_SIZE - y, 0, y - (group.userData.chunkY + 1) * CHUNK_SIZE),
        distance = Math.hypot(dx, dy),
        level = Math.min(3, base + (distance > 110 ? 2 : distance > 45 ? 1 : 0)),
        density = (this.quality === "low" ? 0.5 : this.quality === "medium" ? 0.78 : 1) * (distance > 210 ? 0.5 : distance > 105 ? 0.8 : 1);
      for (const mesh of group.userData.detailMeshes || []) {
        const detail = mesh.userData.detail;
        if (mesh.geometry !== detail.levels[level]) {
          mesh.geometry = detail.levels[level];
          // The geometry may get wider at higher detail; keep culling bounds valid.
          mesh.boundingSphere = null;
          mesh.boundingBox = null;
        }
        const count = detail.thin ? Math.max(1, Math.floor(detail.count * density)) : detail.count;
        if (mesh.count !== count) {
          mesh.count = count;
          mesh.boundingSphere = null;
          mesh.boundingBox = null;
        }
      }
      group.userData.detailLevel = level;
    }
  }
  animate(t, marineState, worldFeatures = null) {
    const liveFeatures = new Map((worldFeatures || []).map(f => [f.id, f]));
    foliageWind.value = t;
    for (const g of this.chunks.values())
      g.userData.features.forEach((f) => {
        const live = liveFeatures.get(f.userData.feature?.id);
        if (live) Object.assign(f.userData.feature, live);
        f.userData.animate(t, this.focusPosition, marineState);
      });
    for (const g of this.chunks.values())
      for (const water of g.userData.water)
        water.material.roughness = 0.24 + Math.sin(t * 0.6) * 0.04;
  }
  focus(x, y, menu = false) {
    foliageMenu.value = menu ? 1 : 0;
    if (menu) this.focusPosition = null;
    else {
      this.focusPosition ||= { x, y };
      this.focusPosition.x = x;
      this.focusPosition.y = y;
    }
    foliageFocus.set(menu ? 1e6 : x, elevationAt(x,y)+0.7, menu ? 1e6 : y);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.buildJob?.steps.return();this.buildJob=null;
    for (const group of this.chunks.values()) {
      this.scene.remove(group);
      group.userData.dispose();
    }
    this.chunks.clear();
    this.pending.length = 0;
  }
}

/** Rendering interest is bounded independently from persistent simulation data. */
export function terrainPlan(x, y) {
  const centerX = Math.floor(x / CHUNK_SIZE), centerY = Math.floor(y / CHUNK_SIZE), plan = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const cx = centerX + dx, cy = centerY + dy;
      if (Math.hypot((cx + 0.5) * CHUNK_SIZE, (cy + 0.5) * CHUNK_SIZE) > WORLD_RADIUS + CHUNK_SIZE) continue;
      plan.push({ id: `${cx},${cy}`, cx, cy, distance: dx === 0 && dy === 0 ? -1 : (x - (cx + 0.5) * CHUNK_SIZE) ** 2 + (y - (cy + 0.5) * CHUNK_SIZE) ** 2 });
    }
  return plan.sort((a, b) => a.distance - b.distance || a.cx - b.cx || a.cy - b.cy);
}
