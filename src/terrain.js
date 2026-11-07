import * as THREE from "three";
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
let foliageMaterial;
function canopyMaterial() {
  if (foliageMaterial) return foliageMaterial;
  foliageMaterial = new THREE.MeshStandardMaterial({
    color: 0x82947a,
    roughness: 0.94,
  });
  foliageMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.foliageFocus = { value: foliageFocus };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 foliageWorldPosition;",
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
  foliageMaterial.customProgramCacheKey = () => "jurassic-canopy-v1";
  return foliageMaterial;
}
const trunkGeo = new THREE.CylinderGeometry(0.18, 0.36, 1, 9);
const crownGeo = new THREE.SphereGeometry(1, 16, 11);
const rockGeo = new THREE.DodecahedronGeometry(1, 1);
const coneGeo = new THREE.ConeGeometry(1, 1, 10);
for (const geo of [crownGeo, rockGeo]) {
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
function fern() {
  const v = [];
  for (let n = 0; n < 7; n++) {
    const a = (n / 7) * 6.283,
      dx = Math.cos(a),
      dz = Math.sin(a);
    for (let i = 1; i < 8; i++) {
      const t = i / 8,
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
const fernGeo = fern(),
  fernMat = new THREE.MeshStandardMaterial({
    color: 0x7b9a5a,
    roughness: 1,
    side: THREE.DoubleSide,
  });
let groundMap;
function groundTexture() {
  if (groundMap) return groundMap;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d"),
    rand = seeded(728);
  c.fillStyle = "#d2cbb0";
  c.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 34000; i++) {
    const x = rand() * 512,
      y = rand() * 512,
      b = 100 + Math.floor(rand() * 100);
    c.fillStyle = `rgba(${b},${b + 9},${b - 8},.2)`;
    c.fillRect(x, y, 1 + rand() * 2, rand() * 2 + 1);
  }
  for (let i = 0; i < 1000; i++) {
    const x = rand() * 512,
      y = rand() * 512;
    c.strokeStyle = rand() > 0.5 ? "#4f61454d" : "#e3d6a433";
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + rand() * 5 - 2, y - 4 - rand() * 5);
    c.stroke();
  }
  groundMap = new THREE.CanvasTexture(canvas);
  groundMap.colorSpace = THREE.SRGBColorSpace;
  groundMap.wrapS = groundMap.wrapT = THREE.RepeatWrapping;
  groundMap.repeat.set(12, 12);
  groundMap.anisotropy = 4;
  return groundMap;
}
function instanced(group, geometry, mat, count, positions, shadow = true) {
  if (count === 0) return null;
  const mesh = new THREE.InstancedMesh(geometry, mat, count),
    o = new THREE.Object3D();
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
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
      roughness: 1,
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
    flowers = [];
  for (let i = 0; i < treeCount; i++) {
    const x = ox + rand() * CHUNK_SIZE,
      z = oy + rand() * CHUNK_SIZE;
    if (Math.hypot(x, z) < 17) continue;
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
    flowers.push({
      position: [x, 0.22, z],
      scale: [0.14, 0.2, 0.14],
      color: region.tier >= 6 ? 0xcfa8d9 : frost ? 0xbacbdd : 0xd6c397,
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
  if (!barren && rand() < 0.65) {
    const x = ox + 30 + rand() * 100,
      z = oy + 30 + rand() * 100,
      sx = 9 + rand() * 14,
      sz = 8 + rand() * 12;
    const waterGeo = new THREE.CircleGeometry(1, 48);
    owned.push(waterGeo);
    const wm = new THREE.MeshStandardMaterial({
      color: frost ? 0x81b3bd : 0x367d78,
      roughness: 0.24,
      metalness: 0.28,
      transparent: true,
      opacity: 0.84,
    });
    const surface = new THREE.Mesh(waterGeo, wm);
    surface.rotation.x = -Math.PI / 2;
    surface.scale.set(sx, sz, 1);
    surface.position.set(x, -0.01, z);
    water.push(surface);
    group.add(surface);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.28,
        o = new THREE.Mesh(rockGeo, material(0x7b8776));
      o.position.set(x + Math.cos(a) * sx, 0.01, z + Math.sin(a) * sz);
      o.scale.set(0.8, 0.3, 0.8);
      group.add(o);
    }
  }
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
  group.userData = {
    water,
    dispose() {
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
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.seed = null;
    this.positionKey = "";
  }
  update(x, y, seed = 7281) {
    const cx = Math.round(x / CHUNK_SIZE),
      cy = Math.round(y / CHUNK_SIZE),
      key = `${cx},${cy}`;
    if (this.seed === seed && this.positionKey === key) return;
    if (this.seed !== seed) {
      for (const g of this.chunks.values()) {
        this.scene.remove(g);
        g.userData.dispose();
      }
      this.chunks.clear();
    }
    this.seed = seed;
    this.positionKey = key;
    const needed = new Set();
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const a = cx + dx,
          b = cy + dy;
        if (Math.hypot((a + 0.5) * 160, (b + 0.5) * 160) > WORLD_RADIUS + 160)
          continue;
        const id = `${a},${b}`;
        needed.add(id);
        if (!this.chunks.has(id)) {
          const g = createTerrainChunk(a, b, seed);
          this.scene.add(g);
          this.chunks.set(id, g);
        }
      }
    for (const [id, g] of this.chunks)
      if (!needed.has(id)) {
        this.scene.remove(g);
        g.userData.dispose();
        this.chunks.delete(id);
      }
  }
  animate(t) {
    for (const g of this.chunks.values())
      for (const water of g.userData.water)
        water.material.roughness = 0.24 + Math.sin(t * 0.6) * 0.04;
  }
  focus(x, y, menu = false) {
    foliageFocus.set(menu ? 1e6 : x, 0.7, menu ? 1e6 : y);
  }
}
