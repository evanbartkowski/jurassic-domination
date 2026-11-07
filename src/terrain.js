import * as THREE from "three";
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
let foliageMaterial;
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

function canopyMaterial() {
  if (foliageMaterial) return foliageMaterial;
  foliageMaterial = new THREE.MeshStandardMaterial({
    color: 0x74906b,
    map: foliageTexture(),
    roughness: 0.78,
  });
  foliageMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.foliageFocus = { value: foliageFocus };
    shader.uniforms.foliageTime = foliageWind;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float foliageTime;\nvarying vec3 foliageWorldPosition;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      float foliageH = max(0.0, position.y - 0.2);
      float swayX = sin(foliageTime * 1.6 + position.x * 0.5 + position.z * 0.4) * 0.12 * foliageH;
      float swayZ = cos(foliageTime * 1.3 + position.x * 0.4) * 0.08 * foliageH;
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
        "#include <common>\nvarying vec3 foliageWorldPosition;\nuniform vec3 foliageFocus;",
      )
      .replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
      float foliageDistance=distance(foliageWorldPosition.xz,foliageFocus.xz);
      if(foliageDistance<5.5 && foliageWorldPosition.y>foliageFocus.y+1.5){
        float foliageNoise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
        if(foliageNoise<.87*(1.0-smoothstep(2.0,5.5,foliageDistance)))discard;
      }`,
      );
  };
  foliageMaterial.customProgramCacheKey = () => "jurassic-canopy-v2";
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
      new THREE.MeshStandardMaterial({ color, roughness: 0.94 }),
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
  c.fillStyle = "#262c20";
  c.fillRect(0, 0, 1024, 1024);

  // Large organic moss and fertile silt drifts
  for (let i = 0; i < 48; i++) {
    const cx = rand() * 1024, cy = rand() * 1024, r = 60 + rand() * 140;
    const grad = c.createRadialGradient ? c.createRadialGradient(cx, cy, 10, cx, cy, r) : null;
    const gVal = Math.floor(45 + rand() * 30);
    if (grad && typeof grad.addColorStop === "function") {
      grad.addColorStop(0, `rgba(${gVal - 5},${gVal + 28},${gVal - 8},0.42)`);
      grad.addColorStop(0.65, `rgba(${gVal - 8},${gVal + 12},${gVal - 14},0.22)`);
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
      ? `rgba(${b - 20},${b + 22},${b - 18},.28)`
      : `rgba(${b + 12},${b + 4},${b - 15},.24)`;
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
  const levels = geometry === trunkGeo ? trunkLevels : geometry === crownGeo ? crownLevels : geometry === rockGeo ? rockLevels : geometry === coneGeo ? coneLevels : geometry === fernGeo ? fernLevels : null;
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
export function createTerrainChunk(cx, cy, seed) {
  const group = new THREE.Group(),
    owned = [],
    water = [],
    rand = seeded(chunkSeed(seed, cx, cy) ^ 0x9148),
    ox = cx * CHUNK_SIZE,
    oy = cy * CHUNK_SIZE;
  const featureData = worldFeatures(seed, cx, cy),
    clearFeature = (x, z, margin = 0) =>
      featureData.some((f) => Math.hypot(f.x - x, f.y - z) < f.radius + margin);
  const region = biomeAt(ox + 80, oy + 80),
    geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 32, 32);
  geo.rotateX(-Math.PI / 2);
  owned.push(geo);
  const positions = geo.attributes.position,
    colors = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) + ox + 80,
      z = positions.getZ(i) + oy + 80,
      biome = biomeAt(x, z),
      color = new THREE.Color(biome.color);
    const trail = Math.abs(Math.sin(x * 0.011 + Math.sin(z * 0.008) * 2));
    if (trail < 0.08) color.lerp(new THREE.Color(0xa09371), 0.32);
    color.multiplyScalar(0.85 + rand() * 0.22);
    colors.push(color.r, color.g, color.b);
    positions.setY(i, -0.14 + Math.sin(x * 0.11) * Math.cos(z * 0.12) * 0.065);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: groundTexture(),
      bumpMap: groundBumpTexture(),
      bumpScale: 0.045,
      roughness: 0.86,
    }),
    ground = new THREE.Mesh(geo, terrainMat);
  ground.position.set(ox + 80, 0, oy + 80);
  ground.receiveShadow = true;
  group.add(ground);
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
    const x = ox + rand() * CHUNK_SIZE,
      z = oy + rand() * CHUNK_SIZE;
    if (Math.hypot(x, z) < 17 || clearFeature(x, z, 4)) continue;
    const scale = 0.85 + rand() * 1.35,
      height = (forest ? 5 : 4) * scale;
    trunks.push({
      position: [x, height / 2, z],
      scale: [scale, height, scale],
    });
    if (
      region.id === "desert" ||
      region.id === "savannah" ||
      region.id === "sky"
    ) {
      palmLeaves.push({
        position: [x, height, z],
        scale: [4 * scale, 2 * scale, 4 * scale],
        rotation: [0, rand() * 6.28, 0],
      });
    } else
      for (let j = 0; j < 4; j++) {
        const color = new THREE.Color(
          frost ? 0xa1bab0 : barren ? 0x697064 : 0x52794b,
        ).multiplyScalar(0.75 + rand() * 0.5);
        crowns.push({
          position: [
            x + (j % 2 ? 1 : -1) * scale * 0.75,
            height + j * 0.65 * scale,
            z + Math.sin(j * 2.5) * scale,
          ],
          scale: frost
            ? [2.0 * scale, (3 - j * 0.35) * scale, 2 * scale]
            : [(2.3 - j * 0.17) * scale, 1.4 * scale, (2.2 - j * 0.17) * scale],
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
  instanced(
    group,
    frost ? coneGeo : crownGeo,
    canopyMaterial(),
    crowns.length,
    crowns,
  );
  instanced(group, fernGeo, fernMat, palmLeaves.length, palmLeaves);
  for (let i = 0; i < 28; i++) {
    const x = ox + rand() * CHUNK_SIZE,
      z = oy + rand() * CHUNK_SIZE,
      s = 0.5 + rand() * 2.2;
    if (clearFeature(x, z, 1)) continue;
    rocks.push({
      position: [x, -0.05, z],
      scale: [s, s * 0.65, s * 0.9],
      rotation: [rand(), rand() * 6.28, rand()],
      color: frost ? 0xa4b4b0 : region.id === "volcano" ? 0x454244 : 0x7b7d6d,
    });
  }
  instanced(group, rockGeo, material(0x858c81), rocks.length, rocks);
  const cover = forest ? 700 : barren ? 120 : 400;
  for (let i = 0; i < cover; i++) {
    const x = ox + rand() * CHUNK_SIZE,
      z = oy + rand() * CHUNK_SIZE,
      s = 0.35 + rand() * 0.85;
    if (clearFeature(x, z, 0.3)) continue;
    ferns.push({
      position: [x, 0.03, z],
      scale: [s, s, s],
      rotation: [0, rand() * 6.28, 0],
      color: frost ? 0xa1b8a7 : barren ? 0x8c8560 : 0x7aa068,
    });
  }
  instanced(group, fernGeo, fernMat, ferns.length, ferns, false);
  for (let i = 0; i < 45; i++) {
    const x = ox + rand() * 160,
      z = oy + rand() * 160;
    if (clearFeature(x, z, 0.5)) continue;
    flowers.push({
      position: [x, 0.22, z],
      scale: [0.14, 0.2, 0.14],
      color: region.tier >= 6 ? [0xcfa8d9,0x87d7d5,0xe9c88c][i%3] : frost ? 0xbacbdd : [0xd6c397,0xba83a9,0xd2a764,0x94b4d5][i%4],
    });
  }
  instanced(
    group,
    crownGeo,
    material(0xd8bd9b),
    flowers.length,
    flowers,
    false,
  );
  // Small clustered natural details share geometry and are instanced, keeping
  // the undergrowth varied without one draw call per plant.
  for (let i=0;i<(barren?25:65);i++) {
    const x=ox+rand()*CHUNK_SIZE,z=oy+rand()*CHUNK_SIZE;
    if (Math.hypot(x,z)<9 || clearFeature(x,z,1)) continue;
    const s=.65+rand()*.7;
    if (i%3===0) {
      for (let j=0;j<3;j++) {
        const dx=x+(rand()-.5)*.8,dz=z+(rand()-.5)*.8,h=(.5+rand()*.6)*s;
        mushroomStems.push({position:[dx,h*.5,dz],scale:[.18*s,h,.18*s]});
        mushroomCaps.push({position:[dx,h,dz],scale:[.42*s,.19*s,.42*s],color:frost?0x91bac7:i%2?0xc9a67b:0xb87f5f});
      }
    } else if (i%3===1) {
      for (let j=0;j<4;j++) {
        const h=(1+rand())*s,dx=x+(rand()-.5),dz=z+(rand()-.5);
        reedStems.push({position:[dx,h*.5,dz],scale:[.09,h,.09],rotation:[0,0,(rand()-.5)*.12]});
        reedHeads.push({position:[dx,h,dz],scale:[.12,.3*s,.12],color:frost?0xb5c3bd:0x9b7950});
      }
    } else {
      for (let j=0;j<3;j++) shrubs.push({position:[x+(j-1)*.55*s,.4*s,z],scale:[.66*s,.48*s,.62*s],color:frost?0x9db6a4:barren?0x9c9855:j%2?0x668a56:0x71965d});
    }
  }
  instanced(group,trunkGeo,material(0x68834c),reedStems.length,reedStems,false);
  instanced(group,crownGeo,material(0xb28e65),reedHeads.length,reedHeads,false);
  instanced(group,trunkGeo,material(0xd6c4a4),mushroomStems.length,mushroomStems,false);
  instanced(group,crownGeo,material(0xc89d74),mushroomCaps.length,mushroomCaps,false);
  instanced(group,crownGeo,material(0x729b5d),shrubs.length,shrubs,false);
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
  const features = featureData.map(createWildFeature);
  features.forEach((f) => group.add(f));
  group.userData = {
    ...group.userData,
    features,
    water,
    dispose() {
      features.forEach((f) => f.userData.dispose());
      owned.forEach((g) => g.dispose());
      terrainMat.dispose();
      water.forEach((w) => w.material.dispose());
      group.traverse((m) => {
        if (m.isInstancedMesh) m.dispose();
        if (
          m.isMesh &&
          !m.isInstancedMesh &&
          m.geometry.type === "TorusGeometry"
        )
          m.material.dispose();
      });
    },
  };
  return group;
}

export class Terrain {
  constructor(scene, { quality = "high", createChunk = createTerrainChunk } = {}) {
    this.scene = scene;
    this.chunks = new Map();
    this.seed = null;
    this.positionKey = "";
    this.quality = ["low", "medium", "high"].includes(quality) ? quality : "high";
    this.createChunk = createChunk;
    this.pending = [];
    this.focusPosition = { x: 0, y: 0 };
    this.disposed = false;
    this.metrics = { builds: 0, builtThisFrame: 0, lastBuildMs: 0, peakBuildMs: 0 };
  }
  update(x, y, seed = 7281) {
    if (this.disposed) return;
    const cx = Math.floor(x / CHUNK_SIZE),
      cy = Math.floor(y / CHUNK_SIZE),
      key = `${cx},${cy}`;
    this.metrics.builtThisFrame = 0;
    if (this.seed !== seed) {
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
      this.pending = plan.filter((p) => !this.chunks.has(p.id));
      for (const [id, g] of this.chunks)
        if (!needed.has(id)) {
          this.scene.remove(g);
          g.userData.dispose();
          this.chunks.delete(id);
        }
    }
    // The center is built first. A moving animal already has its surrounding
    // chunks prepared; newly needed neighbors are spread over later frames.
    // One build per call bounds the old nine-chunk main-thread stall.
    const next = this.pending.shift();
    if (next) {
      const start = performance.now(), g = this.createChunk(next.cx, next.cy, seed);
      g.userData.chunkX = next.cx;
      g.userData.chunkY = next.cy;
      this.scene.add(g);
      this.chunks.set(next.id, g);
      const duration = performance.now() - start;
      this.metrics.builds++;
      this.metrics.builtThisFrame = 1;
      this.metrics.lastBuildMs = duration;
      this.metrics.peakBuildMs = Math.max(this.metrics.peakBuildMs, duration);
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
        level = Math.min(3, base + (distance > 210 ? 2 : distance > 105 ? 1 : 0)),
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
  animate(t, marineState) {
    foliageWind.value = t;
    for (const g of this.chunks.values())
      g.userData.features.forEach((f) =>
        f.userData.animate(t, this.focusPosition, marineState),
      );
    for (const g of this.chunks.values())
      for (const water of g.userData.water)
        water.material.roughness = 0.24 + Math.sin(t * 0.6) * 0.04;
  }
  focus(x, y, menu = false) {
    if (menu) this.focusPosition = null;
    else {
      this.focusPosition ||= { x, y };
      this.focusPosition.x = x;
      this.focusPosition.y = y;
    }
    foliageFocus.set(menu ? 1e6 : x, 0.7, menu ? 1e6 : y);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
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
