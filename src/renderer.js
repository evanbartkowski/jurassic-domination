import * as THREE from "three";
import { SPECIES, SPECIES_BY_ID } from "./data.js";
import { createForageModel } from "./forage-art.js";
import { createDinosaur, animateCreature, genomeAppearanceKey } from "./creatures.js";
import { LANDMARKS, isExplored, hasDiscovery } from './discoveries.js';
import { getTimeOfDay, conditionsAt } from './world-events.js';
import { createEcologyArt } from './ecology-art.js';
import { Terrain, elevationAt } from "./terrain.js";
import { inWater } from "./survival.js";
import { biomeAt, REGIONS, LAIRS, WORLD_RADIUS } from "./world-data.js";
import { POWERUPS, SKINS } from "./content.js";
import { applyCosmetic, createPet } from "./collection-art.js";
import { CATALOG, RARITIES } from "./collection-data.js";
export { createDinosaur };

const lookup = (id) => SPECIES_BY_ID[id] || SPECIES[0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function random(seed = 7281) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const sphere = new THREE.IcosahedronGeometry(1, 1);
const smoothSphere = new THREE.SphereGeometry(1, 12, 8);
const cone = new THREE.ConeGeometry(1, 1, 7);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 7);
const box = new THREE.BoxGeometry(1, 1, 1);
const sharedGeometry = new Set([sphere, smoothSphere, cone, cylinder, box]);
const materialCache = new Map();
const sharedMaterials = new Set();
let surfaceTexture;
function skyDomeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  const c = canvas.getContext("2d");
  const grad = c.createLinearGradient ? c.createLinearGradient(0, 0, 0, 256) : null;
  if (grad && typeof grad.addColorStop === "function") {
    grad.addColorStop(0, "#091a1b");
    grad.addColorStop(0.38, "#13312e");
    grad.addColorStop(0.70, "#2c3e2e");
    grad.addColorStop(0.88, "#54492f");
    grad.addColorStop(1, "#17231a");
    c.fillStyle = grad;
  } else {
    c.fillStyle = "#13312e";
  }
  c.fillRect(0, 0, 16, 256);
  const map = new THREE.CanvasTexture(canvas);
  return map;
}

function mistTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  const grad = c.createRadialGradient ? c.createRadialGradient(128, 128, 0, 128, 128, 128) : null;
  if (grad && typeof grad.addColorStop === "function") {
    grad.addColorStop(0, "rgba(190, 225, 215, 0.22)");
    grad.addColorStop(0.35, "rgba(165, 210, 198, 0.14)");
    grad.addColorStop(0.7, "rgba(135, 185, 175, 0.05)");
    grad.addColorStop(1, "rgba(120, 165, 155, 0)");
    c.fillStyle = grad;
  } else {
    c.fillStyle = "rgba(165, 210, 198, 0.12)";
  }
  c.beginPath();
  c.arc(128, 128, 128, 0, Math.PI * 2);
  c.fill();
  const map = new THREE.CanvasTexture(canvas);
  return map;
}

function mottledTexture() {
  if (surfaceTexture) return surfaceTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d"),
    rand = random(510);
  ctx.fillStyle = "#dad8cc";
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1700; i++) {
    const v = Math.floor(165 + rand() * 80);
    ctx.fillStyle = `rgba(${v},${v},${v},${0.12 + rand() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(
      rand() * 128,
      rand() * 128,
      1 + rand() * 3,
      1 + rand() * 2,
      0,
      0,
      6.28,
    );
    ctx.fill();
  }
  surfaceTexture = new THREE.CanvasTexture(canvas);
  surfaceTexture.colorSpace = THREE.SRGBColorSpace;
  surfaceTexture.wrapS = surfaceTexture.wrapT = THREE.RepeatWrapping;
  surfaceTexture.repeat.set(2, 1);
  return surfaceTexture;
}
function material(color, emissive = 0) {
  const key = `${color}-${emissive}`;
  if (!materialCache.has(key))
    materialCache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        map: mottledTexture(),
        roughness: 0.83,
        flatShading: true,
        emissive,
        emissiveIntensity: emissive ? 0.6 : 0,
      }),
    );
  const result = materialCache.get(key);
  sharedMaterials.add(result);
  return result;
}
function piece(parent, geo, color, pos, scale, rotation, emissive = 0) {
  const mesh = new THREE.Mesh(geo, material(color, emissive));
  mesh.position.set(...pos);
  mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export class WorldRenderer {
  constructor(canvas, settings, onFailure) {
    this.canvas = canvas;
    this.settings = settings;
    this.models = new Map();
    this.foodModels = new Map();
    this.particles = [];
    this.warnings = new Map();
    this.shake = 0;
    this.elapsed = 0;
    this.effects = [];
    this.cameraTarget = new THREE.Vector3();
    this.cameraDesired = new THREE.Vector3();
    this.projectedPosition = new THREE.Vector3();
    this.pointerPosition = new THREE.Vector2();
    this.fogColor = new THREE.Color();
    this.targetFogColor = new THREE.Color();
    this.targetSunColor = new THREE.Color();
    this.targetHemiSky = new THREE.Color();
    this.targetHemiGround = new THREE.Color();
    this.aimPoint = new THREE.Vector3();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x0a1e1c);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x112825);
    this.scene.fog = new THREE.FogExp2(0x112825, 0.010);
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.2, 380);
    this.hemiLight = new THREE.HemisphereLight(0x9fe0d2, 0x243222, 1.75);
    this.scene.add(this.hemiLight);
    this.sun = new THREE.DirectionalLight(0xffe2b5, 3.8);
    this.sun.position.set(-36, 48, -26);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.radius = 2.0;
    Object.assign(this.sun.shadow.camera, {
      left: -42,
      right: 42,
      top: 42,
      bottom: -42,
      near: 1,
      far: 150,
    });
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.08;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.rimLight = new THREE.DirectionalLight(0x7fe3d7, 1.15);
    this.rimLight.position.set(28, 22, 34);
    this.scene.add(this.rimLight);
    this.bounceLight = new THREE.DirectionalLight(0x564929, 0.45);
    this.bounceLight.position.set(0, -15, 20);
    this.scene.add(this.bounceLight);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.generateWorld();
    this.createParticles();
    this.createEgg();
    this.ring = piece(
      this.scene,
      new THREE.RingGeometry(1.05, 1.14, 48),
      0xe5bd69,
      [0, 0.065, 0],
      [1, 1, 1],
      [-Math.PI / 2, 0, 0],
      0x7a5420,
    );
    this.ring.material = new THREE.MeshBasicMaterial({
      color: 0xe9c777,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    this.dangerRing = piece(
      this.scene,
      new THREE.RingGeometry(0.82, 1, 40),
      0xff704c,
      [0, 0.07, 0],
      [1, 1, 1],
      [-Math.PI / 2, 0, 0],
    );
    this.dangerRing.material = new THREE.MeshBasicMaterial({
      color: 0xff674a,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.roarRing = piece(
      this.scene,
      new THREE.RingGeometry(0.88, 1.0, 48),
      0xf6ecd8,
      [0, 0.08, 0],
      [1, 1, 1],
      [-Math.PI / 2, 0, 0],
    );
    this.roarRing.material = new THREE.MeshBasicMaterial({
      color: 0xf6ecd8,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.roarProgress = 0;
    this.roarX = 0;
    this.roarY = 0;
    this.roarRadius = 20;
    this.onContextLost = (e) => {
      e.preventDefault();
      if (this.disposed) return;
      onFailure?.(
        "The graphics device was interrupted. Your profile is safe. Restart the game to restore rendering.",
      );
    };
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.configure(settings);
    this.resize();
  }
  configure(settings) {
    if (this.disposed) return;
    this.settings = settings;
    const quality = settings.quality || "high";
    this.terrain.setQuality(quality);
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        quality === "low" ? 1 : quality === "medium" ? 1.35 : 1.8,
      ),
    );
    this.renderer.shadowMap.enabled = quality !== "low";
    const shadowSize = quality === "medium" ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== shadowSize) {
      this.sun.shadow.mapSize.set(shadowSize, shadowSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.resize();
  }
  resize() {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  resetRun() {
    for (const mesh of this.projectileModels?.values() || []) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.projectileModels?.clear();
    if (this.companion) {
      this.scene.remove(this.companion);
      this.companion.userData.dispose();
      this.companion = null;
    }
    for (const model of this.models.values()) this.removeModel(model);
    this.models.clear();
    for (const model of this.foodModels.values()) this.removeModel(model);
    this.foodModels.clear();
    for (const group of this.warnings.values()) {
      this.scene.remove(group);
      group.traverse((m) => {
        m.geometry?.dispose();
        m.material?.dispose();
      });
    }
    this.warnings.clear();
    for (const effect of this.effects) {
      this.scene.remove(effect.group);
      effect.mesh.geometry.dispose();
      effect.mesh.material.dispose();
    }
    this.effects = [];
    this.particles = [];
    this.cameraTarget.set(0, 0, 0);
  }
  setMenuSkin(id, cosmeticId = "none") {
    if (
      this.menuDino?.userData.skinId === id &&
      this.menuDino.userData.cosmeticId === cosmeticId
    )
      return;
    if (this.menuDino) this.removeModel(this.menuDino);
    this.menuDino = createDinosaur(
      SPECIES.find((s) => s.id === "tyrannosaurus"),
      true,
      id,
    );
    this.menuDino.position.set(6.6, elevationAt(6.6, -1), -1);
    applyCosmetic(this.menuDino, cosmeticId);
    this.menuDino.scale.setScalar(2.4);
    this.scene.add(this.menuDino);
  }
  generateWorld() {
    this.terrain = new Terrain(this.scene);
    this.terrain.update(0, 0);
    this.water = [];

    // Prehistoric atmospheric sky dome
    this.skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(260, 24, 12),
      new THREE.MeshBasicMaterial({
        map: skyDomeTexture(),
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    this.scene.add(this.skyDome);

    // Drifting ground mist layers
    this.groundMist = new THREE.Group();
    this.scene.add(this.groundMist);
    const mistGeo = new THREE.PlaneGeometry(42, 42);
    mistGeo.rotateX(-Math.PI / 2);
    const mistMat = new THREE.MeshBasicMaterial({
      map: mistTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * 6.283;
      const r = 9 + (i % 3) * 12;
      const m = new THREE.Mesh(mistGeo, mistMat);
      m.position.set(Math.cos(a) * r, 0.45 + (i % 3) * 0.22, Math.sin(a) * r);
      m.scale.setScalar(0.85 + (i % 3) * 0.35);
      this.groundMist.add(m);
    }

    // Realistic prehistoric nursery nest
    this.nest = new THREE.Group();
    this.scene.add(this.nest);
    piece(this.nest, cylinder, 0x34291c, [0, 0.04, 0], [2.7, 0.08, 2.7]);
    piece(this.nest, smoothSphere, 0x546237, [0, 0.08, 0], [2.1, 0.12, 2.1]);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * 6.283,
        r = 2.05 + (i % 3) * 0.18,
        col = i % 2 ? 0x5a462f : 0x765c3b;
      piece(
        this.nest,
        cylinder,
        col,
        [Math.cos(a) * r, 0.12 + (i % 4) * 0.035, Math.sin(a) * r],
        [0.12, 1.35 + (i % 3) * 0.3, 0.12],
        [1.37, 0, -a + 0.7 + (i % 2) * 0.35],
      );
    }
    const clutch = [
      [1.1, 0.22, 0.6, 0.32, 0.44, 0.32, 0.3, 0.4],
      [-0.9, 0.20, 0.8, 0.30, 0.42, 0.30, -0.2, -0.3],
      [0.2, 0.21, -1.2, 0.34, 0.46, 0.34, 0.4, -0.2],
    ];
    for (const [cx, cy, cz, sx, sy, sz, rx, rz] of clutch) {
      piece(this.nest, smoothSphere, 0xdcd2b4, [cx, cy, cz], [sx, sy, sz], [rx, 0, rz]);
    }
  }
  createEgg() {
    this.egg = new THREE.Group();
    this.scene.add(this.egg);
    const shell = piece(
      this.egg,
      smoothSphere,
      0xe8ddbe,
      [0, 1.2, 0],
      [0.86, 1.16, 0.86],
    );
    for (let i = 0; i < 24; i++) {
      const a = i * 2.35,
        h = 0.25 + (i % 6) * 0.28,
        r = 0.82 * Math.sqrt(Math.max(0, 1 - ((h - 1.2) / 1.2) ** 2));
      piece(
        this.egg,
        sphere,
        0x9c8e6a,
        [Math.cos(a) * r, h, Math.sin(a) * r],
        [0.11, 0.15, 0.035],
        [0, -a, 0],
      );
    }
    this.eggGlow = new THREE.PointLight(0xffbe58, 8, 12);
    this.eggGlow.position.y = 1.8;
    this.egg.add(this.eggGlow);
    this.menuDino = createDinosaur(
      SPECIES.find((s) => s.id === "tyrannosaurus"),
      true,
    );
    this.menuDino.position.set(6.2, elevationAt(6.2, -0.8), -0.8);
    this.menuDino.scale.setScalar(2.45);
    this.menuDino.rotation.y = -0.65;
    this.scene.add(this.menuDino);

    this.menuRoamers = [
      {
        speciesId: "triceratops",
        scale: 1.55,
        speed: 1.5,
        x: -24,
        baseZ: -5.5,
        z: -5.5,
        angle: 0.08,
        phase: 0,
      },
      {
        speciesId: "parasaurolophus",
        scale: 1.45,
        speed: 1.8,
        x: 22,
        baseZ: 4.8,
        z: 4.8,
        angle: Math.PI - 0.05,
        phase: 1.8,
      },
      {
        speciesId: "compsognathus",
        scale: 1.15,
        speed: 2.8,
        x: -12,
        baseZ: 9.5,
        z: 9.5,
        angle: 0.12,
        phase: 3.2,
      },
    ].map((cfg) => {
      const sp = SPECIES.find((s) => s.id === cfg.speciesId) || SPECIES[0];
      const mesh = createDinosaur(sp, true);
      mesh.scale.setScalar(cfg.scale);
      mesh.visible = false;
      this.scene.add(mesh);
      return { ...cfg, mesh };
    });
  }
  createParticles() {
    this.maxParticles = 750;
    this.particles = [];
    this.particleMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
      }),
      this.maxParticles,
    );
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
    this.particleDummy = new THREE.Object3D();
    const dustGeo = new THREE.BufferGeometry(),
      positions = new Float32Array(220 * 3);
    for (let i = 0; i < 220; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 110;
      positions[i * 3 + 1] = 1 + Math.random() * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 110;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        color: 0xeed7a3,
        size: 0.055,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.scene.add(this.dust);
  }
  addParticle(p, priority = 1) {
    p.priority = priority;
    const maxCapacity = this.maxParticles || 750;
    if (this.particles.length < maxCapacity) {
      this.particles.push(p);
      return true;
    }
    if (priority <= 1) return false;
    // Replace lowest priority particle when budget is reached
    let lowestIdx = -1, lowestPri = priority;
    for (let i = 0; i < this.particles.length; i++) {
      const pri = this.particles[i].priority || 1;
      if (pri < lowestPri) {
        lowestPri = pri;
        lowestIdx = i;
        if (lowestPri === 1) break;
      }
    }
    if (lowestIdx >= 0) {
      this.particles[lowestIdx] = p;
      return true;
    }
    return false;
  }
  emitCount(ratePerSecond, dt) {
    const expected = ratePerSecond * Math.min(0.1, Math.max(0, dt));
    let count = Math.floor(expected);
    if (Math.random() < (expected - count)) count++;
    return count;
  }
  burst(x, z, color = 0xe5bc6d, count = 16) {
    for (let i = 0; i < count; i++) {
      this.addParticle({
        x,
        y: 0.6,
        z,
        vx: (Math.random() - 0.5) * 7,
        vy: 2 + Math.random() * 5,
        vz: (Math.random() - 0.5) * 7,
        life: 0.5 + Math.random() * 0.5,
        max: 1,
        color,
        size: 0.06 + Math.random() * 0.13,
      }, 3);
    }
  }
  event(event) {
    if (
      [
        "hit",
        "kill",
        "eat",
        "hatch",
        "evolve",
        "ability",
        "dash",
        "collect",
        "dna-find",
        "collection-find",
      ].includes(event.type)
    ) {
      let particleColor = 0xf4d48a;
      let particleCount = 14;
      if (event.type === "hit") {
        particleColor = event.target === "player" ? 0xcc2222 : 0xfbbf24;
        particleCount = 20;
      } else if (event.type === "kill") {
        particleColor = 0xff4433;
        particleCount = 30;
      } else if (event.type === "eat") {
        particleColor = 0x84cc16;
        particleCount = 14;
      } else if (event.type === "dash") {
        particleColor = 0x8a927a;
        particleCount = 12;
      } else if (event.type === "evolve") {
        particleColor = 0xf59e0b;
        particleCount = 75;
      }
      this.burst(event.x || 0, event.y || 0, particleColor, particleCount);
    }
    if (event.type === "roar") {
      this.shake = Math.max(this.shake, 0.42);
      this.roarProgress = 1.0;
      this.roarX = event.x;
      this.roarY = event.y;
      this.roarRadius = event.radius || 20;
      this.burst(event.x || 0, event.y || 0, 0xf6ecd8, 32);
    }
    if (event.type === "synergy-burst") {
      this.shake = Math.max(this.shake, 0.45);
      const synColors = {
        hemorrhage: 0xef4444,
        seismicSlam: 0xf59e0b,
        plagueCloud: 0x22c55e,
        alphasCommand: 0xa855f7,
        inferno: 0xf97316,
        glacialFortress: 0x38bdf8,
        juggernaut: 0xeab308,
      };
      const burstColor = synColors[event.synergy] || 0xfbbf24;
      this.burst(event.x || 0, event.y || 0, burstColor, 36);
    }
    if (event.type === "hit" || event.type === "ability")
      this.shake = Math.max(
        this.shake,
        event.type === "ability" ? 0.45 : event.target === "player" ? 0.35 : 0.22,
      );
    if (["attack", "enemy-strike", "ability", "enemy-ability", "evolve"].includes(event.type)) {
      const isPlayerAttack = event.type === "attack";
      const isEnemyStrike = event.type === "enemy-strike";
      const directional =
        isPlayerAttack ||
        isEnemyStrike ||
        [
          "flame",
          "frost",
          "venom",
          "pounce",
          "charge",
          "petrify",
          "web",
          "ambush",
          "cleave",
          "feather",
          "dive",
        ].includes(event.ability);
      const color = isEnemyStrike
        ? 0xff3b20
        : isPlayerAttack
          ? 0xffdd88
          : {
              venom: 0xa3db77,
              flame: 0xffa34a,
              frost: 0xa3e2f5,
              lightning: 0xc7e5ff,
              nova: 0xc5a3ec,
              heal: 0xa8e2b5,
              blood: 0xea8a9b,
              petrify: 0xb7b2c8,
              web: 0xe3ddd2,
              wind: 0xaedacf,
            }[event.ability] || 0xf4dca4;
      this.burst(event.x || 0, event.y || 0, color, isPlayerAttack && (event.size >= 3) ? 36 : 18);
      const radius = event.radius || 3,
        arc = directional ? 1.55 : Math.PI * 2;
      const innerR = Math.max(0.35, radius * (isPlayerAttack || isEnemyStrike ? 0.62 : 0.7));
      const geo = new THREE.RingGeometry(
        innerR,
        radius,
        48,
        1,
        -arc / 2,
        arc,
      );
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isEnemyStrike ? 0.8 : isPlayerAttack ? 0.75 : 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: isPlayerAttack || isEnemyStrike ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const mesh = new THREE.Mesh(geo, mat),
        group = new THREE.Group();
      mesh.rotation.x = -Math.PI / 2 + (isPlayerAttack || isEnemyStrike ? 0.16 : 0);
      mesh.position.y = isPlayerAttack ? 0.35 + Math.min(2.0, (event.size || 1) * 0.18) : 0.35;
      group.add(mesh);
      group.position.set(event.x || 0, 0.12, event.y || 0);
      group.rotation.y = -(event.angle || 0);
      this.scene.add(group);
      this.effects.push({
        group,
        mesh,
        life: (isPlayerAttack || isEnemyStrike) ? 0.22 : 0.65,
        max: (isPlayerAttack || isEnemyStrike) ? 0.22 : 0.65,
      });
      if (isPlayerAttack && (event.size >= 3.0)) {
        this.shake = Math.max(this.shake, 0.38);
        for (let i = -3; i <= 3; i++) {
          const a = (event.angle || 0) + (i / 4) * 0.7;
          this.burst(
            (event.x || 0) + Math.cos(a) * (radius * 0.88),
            (event.y || 0) + Math.sin(a) * (radius * 0.88),
            0xb09e80,
            6,
          );
        }
      }
      if (["flame", "frost", "venom"].includes(event.ability))
        for (let i = 1; i < 7; i++) {
          const distance = (i * radius) / 7;
          this.burst(
            (event.x || 0) + Math.cos(event.angle) * distance,
            (event.y || 0) + Math.sin(event.angle) * distance,
            color,
            8,
          );
        }
      if (event.ability === "lightning") {
        const origin = { x: event.x || 0, y: event.y || 0 },
          game = this.currentGame;
        const targets =
          event.type === "enemy-ability"
            ? [game?.player].filter(Boolean)
            : (game?.entities || [])
                .filter(
                  (e) => Math.hypot(e.x - origin.x, e.y - origin.y) < radius,
                )
                .slice(0, 6);
        for (const target of targets) this.lightning(origin, target, color);
      }
    }
  }
  lightning(origin, target, color) {
    const positions = new Float32Array(27),
      dx = target.x - origin.x,
      dz = target.y - origin.y;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8,
        jitter = i === 0 || i === 8 ? 0 : (Math.random() - 0.5) * 1.5;
      positions[i * 3] = dx * t + jitter;
      positions[i * 3 + 1] = 1.5 + Math.sin(t * Math.PI);
      positions[i * 3 + 2] = dz * t - jitter;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }),
    );
    const group = new THREE.Group();
    group.position.set(origin.x, 0, origin.y);
    group.add(line);
    this.scene.add(group);
    this.effects.push({ group, mesh: line, life: 0.35, max: 0.35 });
  }
  aim(clientX, clientY, player) {
    this.raycaster.setFromCamera(
      this.pointerPosition.set(
        (clientX / innerWidth) * 2 - 1,
        (-clientY / innerHeight) * 2 + 1,
      ),
      this.camera,
    );
    this.raycaster.ray.intersectPlane(this.groundPlane, this.aimPoint);
    return Math.atan2(this.aimPoint.z - player.y, this.aimPoint.x - player.x);
  }
  animateDino(model, t, speed = 0, attacking = false, dt = 1 / 60, turn = 0) {
    animateCreature(model, dt, t, speed, attacking, turn);
  }
  syncModel(
    key,
    id,
    x,
    z,
    angle,
    dt,
    t,
    active = false,
    attacking = false,
    invulnerable = false,
    skinId = "natural",
    scaleFactor = 1,
    cosmeticId = "none",
    genome = null,
  ) {
    let model = this.models.get(key);
    if (
      !model ||
      model.userData.species.id !== id ||
      model.userData.skinId !== skinId ||
      model.userData.cosmeticId !== cosmeticId || model.userData.genomeKey !== genomeAppearanceKey(genome)
    ) {
      if (model) this.removeModel(model);
      model = createDinosaur(lookup(id), false, skinId, genome);
      applyCosmetic(model, cosmeticId);
      model.position.set(x, 0, z);
      model.rotation.y = -angle;
      this.models.set(key, model);
      this.scene.add(model);
    }
    const moved =
      model.userData.motionX === undefined
        ? 0
        : Math.hypot(x - model.userData.motionX, z - model.userData.motionY);
    model.userData.motionX = x;
    model.userData.motionY = z;
    model.position.x = THREE.MathUtils.damp(model.position.x, x, 22, dt);
    model.position.z = THREE.MathUtils.damp(model.position.z, z, 22, dt);
    const target = -angle,
      diff = Math.atan2(
        Math.sin(target - model.rotation.y),
        Math.cos(target - model.rotation.y),
      );
    model.rotation.y += diff * (1 - Math.exp(-dt * 16));
    this.animateDino(
      model,
      t,
      dt > 0
        ? clamp(moved / Math.max(dt, 0.016) / (lookup(id).speed * 0.8), 0, 1.5)
        : model.userData.speed,
      attacking,
      dt,
      diff,
    );
    const isColossal = (model.userData.species.size * scaleFactor >= 2.2) || (model.userData.species.tier >= 4);
    const viewLimit = isColossal ? 145 : 70;
    model.visible =
      Math.hypot(x - this.cameraTarget.x, z - this.cameraTarget.z) < viewLimit;
    model.userData.body.visible = true;
    model.userData.isJuvenile = scaleFactor < 0.68;
    model.userData.isColossal = isColossal;
    model.scale.setScalar(model.userData.baseScale * scaleFactor);
    return model;
  }
  removeModel(model) {
    this.scene.remove(model);
    if (model.userData.dispose) {
      model.userData.dispose();
      return;
    }
    model.traverse((obj) => {
      if (
        obj.geometry &&
        !sharedGeometry.has(obj.geometry)
      )
        obj.geometry.dispose();
      if (
        obj.material &&
        !sharedMaterials.has(obj.material)
      )
        obj.material.dispose();
    });
  }
  render(game, dt, menu = false) {
    if (this.disposed) return;
    this.currentGame = game;
    this.ecologyArt ||= createEcologyArt(this.scene);
    this.ecologyArt.update(menu ? null : game, dt, this.terrain.quality || 'high');
    this.elapsed += dt;
    const t = this.elapsed,
      p = game?.player;
    this.menuDino.visible = menu;
    this.egg.visible = game?.state === "egg";
    if (Array.isArray(this.menuRoamers)) {
      for (const roamer of this.menuRoamers) {
        roamer.mesh.visible = menu;
        if (menu) {
          roamer.x += Math.cos(roamer.angle) * roamer.speed * dt;
          roamer.z += Math.sin(roamer.angle) * roamer.speed * dt;
          if (roamer.x > 32) {
            roamer.x = -32;
            roamer.z = roamer.baseZ + (Math.sin(t * 0.2) * 1.5);
          } else if (roamer.x < -32) {
            roamer.x = 32;
            roamer.z = roamer.baseZ + (Math.cos(t * 0.2) * 1.5);
          }
          const ey = elevationAt(roamer.x, roamer.z);
          roamer.mesh.position.set(roamer.x, ey, roamer.z);
          roamer.mesh.rotation.y = -roamer.angle + Math.PI / 2;
          this.animateDino(roamer.mesh, t * 1.6 + roamer.phase, roamer.speed, false, dt);
        }
      }
    }
    if (menu) {
      this.menuDino.position.y = elevationAt(this.menuDino.position.x, this.menuDino.position.z);
      this.animateDino(this.menuDino, t, 0, false, dt);
      this.menuDino.rotation.y = -0.65 + Math.sin(t * 0.16) * 0.22;
      this.cameraTarget.lerp(this.cameraDesired.set(0, 0, 0), Math.min(1, dt * 3));
    } else if (p)
      this.cameraTarget.lerp(
        this.cameraDesired.set(p.x, 0, p.y),
        1 - Math.exp(-dt * 6),
      );
    this.terrain.update(
      menu ? 0 : p?.x || 0,
      menu ? 0 : p?.y || 0,
      menu ? 7281 : game.seed,
    );
    this.terrain.focus(p?.x || 0, p?.y || 0, menu);
    this.terrain.animate(menu ? t : game.time, menu ? null : game.marineState);
    if (p && !menu) {
      this.egg.position.set(p.x, 0, p.y);
      this.egg.rotation.z = Math.sin(t * 8) * 0.035;
      const keys = new Set();
      if (game.state !== "egg") {
        const player = this.syncModel(
          "player",
          p.speciesId,
          p.x,
          p.y,
          p.angle,
          dt,
          t,
          true,
          p.attacking > 0,
          p.invulnerable > 0,
          game.skinId,
          game.effectiveSize / game.species.size,
          game.cosmeticId || "none",
          p.genome,
        );
        player.position.y = elevationAt(p.x, p.y) + (p.submerged ? -.5 : p.crouching ? -.15 : 0);
        player.userData.isSleeping = p.sleeping > 0;
        player.userData.isWet = inWater(game, p);
        if (p.poisoned > 0) {
          const count = this.emitCount(20, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: p.x + (Math.random() - 0.5) * 1.3,
              y: 0.4 + Math.random() * 1.4,
              z: p.y + (Math.random() - 0.5) * 1.3,
              vx: (Math.random() - 0.5) * 0.5,
              vy: 1.8 + Math.random(),
              vz: (Math.random() - 0.5) * 0.5,
              floating: true,
              buoyancy: 0.8,
              life: 0.6,
              size: 0.2,
              color: 0x33ff44,
            }, 2);
          }
        }
        if (p.bleeding > 0) {
          const count = this.emitCount(25, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: p.x + (Math.random() - 0.5) * 1.1,
              y: 0.7 + Math.random() * 1.0,
              z: p.y + (Math.random() - 0.5) * 1.1,
              vx: (Math.random() - 0.5) * 0.6,
              vy: -2.0,
              vz: (Math.random() - 0.5) * 0.6,
              floating: false,
              life: 0.35,
              size: 0.17,
              color: 0x8b0000,
            }, 2);
          }
        }
        if (p.burning > 0) {
          const count = this.emitCount(30, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: p.x + (Math.random() - 0.5) * 1.2,
              y: 0.5 + Math.random() * 1.5,
              z: p.y + (Math.random() - 0.5) * 1.2,
              vx: (Math.random() - 0.5) * 0.9,
              vy: 2.4 + Math.random() * 1.6,
              vz: (Math.random() - 0.5) * 0.9,
              floating: true,
              buoyancy: 1.1,
              life: 0.5,
              size: 0.22,
              color: Math.random() < 0.6 ? 0xff4500 : 0xffcc00,
            }, 2);
          }
        }
        if (p.sleeping > 0) {
          const count = this.emitCount(12, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: p.x + (Math.random() - 0.5) * 0.7,
              y: 0.9 + Math.random() * 0.9,
              z: p.y + (Math.random() - 0.5) * 0.7,
              vx: 0.28 * Math.sin(t * 3),
              vy: 1.0,
              vz: 0.28 * Math.cos(t * 3),
              floating: true,
              buoyancy: 0.2,
              life: 1.0,
              size: 0.24,
              color: 0x80d8ff,
            }, 2);
          }
        }
        // Build Transformations & Synergies Audiovisual Payoffs
        if (game.build?.activeSynergies?.includes("inferno") || game.build?.transformations?.volcanicScales) {
          const count = this.emitCount(18, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: p.x + (Math.random() - 0.5) * 1.5,
              y: 0.5 + Math.random() * 1.4,
              z: p.y + (Math.random() - 0.5) * 1.5,
              vx: (Math.random() - 0.5) * 0.7,
              vy: 1.6 + Math.random() * 1.2,
              vz: (Math.random() - 0.5) * 0.7,
              floating: true,
              buoyancy: 0.8,
              life: 0.65,
              size: 0.22,
              color: Math.random() < 0.65 ? 0xf97316 : 0xfbbf24,
            }, 2);
          }
        }
        if (game.build?.transformations?.thunderJaws || (game.build?.offensive?.chainLightning || 0) >= 3) {
          const count = this.emitCount(14, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: p.x + Math.cos(p.angle) * 1.1 + (Math.random() - 0.5) * 0.8,
              y: 0.7 + Math.random() * 0.8,
              z: p.y + Math.sin(p.angle) * 1.1 + (Math.random() - 0.5) * 0.8,
              vx: (Math.random() - 0.5) * 2.2,
              vy: (Math.random() - 0.5) * 2.2,
              vz: (Math.random() - 0.5) * 2.2,
              floating: true,
              life: 0.2,
              size: 0.16,
              color: Math.random() < 0.5 ? 0x38bdf8 : 0xfef08a,
            }, 2);
          }
        }
        if (game.build?.transformations?.frostArmor || game.build?.activeSynergies?.includes("glacialFortress")) {
          const count = this.emitCount(16, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: p.x + (Math.random() - 0.5) * 1.5,
              y: 0.3 + Math.random() * 1.4,
              z: p.y + (Math.random() - 0.5) * 1.5,
              vx: (Math.random() - 0.5) * 0.3,
              vy: 0.4 + Math.random() * 0.6,
              vz: (Math.random() - 0.5) * 0.3,
              floating: true,
              buoyancy: 0.1,
              life: 0.8,
              size: 0.18,
              color: Math.random() < 0.7 ? 0x67e8f9 : 0xe0f2fe,
            }, 2);
          }
        }
        if (game.build?.transformations?.berserkerRage || game.build?.activeSynergies?.includes("hemorrhage") || (game.build?.passive?.bloodlust || 0) >= 3) {
          const count = this.emitCount(20, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: p.x + (Math.random() - 0.5) * 1.4,
              y: 0.2 + Math.random() * 1.2,
              z: p.y + (Math.random() - 0.5) * 1.4,
              vx: (Math.random() - 0.5) * 0.4,
              vy: 1.3 + Math.random() * 1.1,
              vz: (Math.random() - 0.5) * 0.4,
              floating: true,
              buoyancy: 0.9,
              life: 0.6,
              size: 0.2,
              color: Math.random() < 0.6 ? 0xef4444 : 0x991b1b,
            }, 2);
          }
        }
        keys.add("player");
        this.ring.visible = false;
      } else this.ring.visible = false;
      for (const e of game.entities) {
        const s = SPECIES_BY_ID[e.speciesId];
        const isHighLevelOrHuge = (s && s.tier >= 4) || e.boss || (s && s.size >= 2.2) || (e.scaleFactor && e.scaleFactor >= 1.4);
        const maxDist = isHighLevelOrHuge ? 140 : 52;
        if (Math.hypot(e.x - p.x, e.y - p.y) > maxDist) {
          const old = this.models.get(e.id);
          if (old) {
            old.visible = false;
            keys.add(e.id);
          }
          continue;
        }
        const creature = this.syncModel(
          e.id,
          e.speciesId,
          e.x,
          e.y,
          e.angle,
          dt,
          t,
          false,
          e.attacking > 0,
          false,
          "natural",
          e.scaleFactor || 1,
          'none',
          e.genome,
        );
        const baseEY = elevationAt(e.x, e.y);
        if (e.isFlying) {
          creature.position.y = baseEY + (e.altitude || 7.5) + Math.sin(t * 2.5 + e.id) * 0.45;
        } else if (e.inTree) {
          creature.position.y = baseEY + (e.treeY || 4.8);
        } else if (e.treeDrop > 0) {
          creature.position.y = baseEY + e.treeDrop * (e.treeY || 4.8);
        } else if (creature.position.y > baseEY + 0.05) {
          creature.position.y = Math.max(baseEY, creature.position.y - dt * 10);
        } else {
          creature.position.y = baseEY;
        }
        if (e.intent === "graze") {
          creature.userData.head.rotation.z +=
            0.16 + Math.sin(t * 1.4 + e.id) * 0.05;
        }
        if (e.intent === "ambush" && !e.inTree) creature.userData.body.position.y -= 0.08;
        creature.userData.isSleeping = (e.sleeping > 0) || !!e.isSleeping;
        creature.userData.isWet = inWater(game, e);
        if (e.poison > 0) {
          const count = this.emitCount(14, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: e.x + (Math.random() - 0.5) * 1.2,
              y: 0.4 + Math.random() * 1.2,
              z: e.y + (Math.random() - 0.5) * 1.2,
              vx: (Math.random() - 0.5) * 0.4,
              vy: 1.6 + Math.random(),
              vz: (Math.random() - 0.5) * 0.4,
              floating: true,
              buoyancy: 0.6,
              life: 0.5,
              size: 0.18,
              color: 0x33ff44,
            }, 2);
          }
        }
        if (e.bleeding > 0) {
          const count = this.emitCount(18, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: e.x + (Math.random() - 0.5) * 1.1,
              y: 0.6 + Math.random() * 1.0,
              z: e.y + (Math.random() - 0.5) * 1.1,
              vx: (Math.random() - 0.5) * 0.5,
              vy: -2.0,
              vz: (Math.random() - 0.5) * 0.5,
              floating: false,
              life: 0.35,
              size: 0.16,
              color: 0x8b0000,
            }, 2);
          }
        }
        if (e.burning > 0) {
          const count = this.emitCount(22, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: e.x + (Math.random() - 0.5) * 1.2,
              y: 0.5 + Math.random() * 1.4,
              z: e.y + (Math.random() - 0.5) * 1.2,
              vx: (Math.random() - 0.5) * 0.8,
              vy: 2.2 + Math.random() * 1.5,
              vz: (Math.random() - 0.5) * 0.8,
              floating: true,
              buoyancy: 1.0,
              life: 0.5,
              size: 0.22,
              color: Math.random() < 0.6 ? 0xff4500 : 0xffcc00,
            }, 2);
          }
        }
        if (e.sleeping > 0) {
          const count = this.emitCount(10, dt);
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: e.x + (Math.random() - 0.5) * 0.6,
              y: 0.7 + Math.random() * 0.8,
              z: e.y + (Math.random() - 0.5) * 0.6,
              vx: 0.25 * Math.sin(t * 3),
              vy: 0.9,
              vz: 0.25 * Math.cos(t * 3),
              floating: true,
              buoyancy: 0.2,
              life: 1.0,
              size: 0.22,
              color: 0x80d8ff,
            }, 2);
          }
        }
        if (e.eliteMutation) {
          const count = this.emitCount(14, dt);
          const eliteColor = e.eliteMutation === "Blazing" ? 0xf97316
            : e.eliteMutation === "Venomous" ? 0x22c55e
            : e.eliteMutation === "Armored" ? 0x38bdf8
            : e.eliteMutation === "Frost" ? 0x06b6d4
            : 0xef4444;
          for (let k = 0; k < count; k++) {
            this.addParticle({
              x: e.x + (Math.random() - 0.5) * 1.2,
              y: 0.4 + Math.random() * 1.2,
              z: e.y + (Math.random() - 0.5) * 1.2,
              vx: (Math.random() - 0.5) * 0.5,
              vy: 1.0 + Math.random() * 0.8,
              vz: (Math.random() - 0.5) * 0.5,
              floating: true,
              buoyancy: 0.6,
              life: 0.5,
              size: 0.18,
              color: eliteColor,
            }, 2);
          }
        }
        keys.add(e.id);
      }
      for (const [key, model] of this.models)
        if (!keys.has(key)) {
          this.removeModel(model);
          this.models.delete(key);
        }
      this.syncFood(game.foods, t);
      this.syncCompanion(game, dt, t);
      this.dangerRing.visible = false;
      this.syncWarnings(game, t);
      if (this.roarProgress > 0) {
        this.roarProgress = Math.max(0, this.roarProgress - dt * 2.0);
        const prog = 1 - this.roarProgress;
        this.roarRing.position.set(this.roarX, 0.08, this.roarY);
        this.roarRing.scale.setScalar(Math.max(1, prog * this.roarRadius));
        this.roarRing.material.opacity = (1 - prog) * 0.75;
        this.roarRing.visible = true;
      } else {
        this.roarRing.visible = false;
      }
      const sporeCount = this.emitCount(14, dt);
      for (let k = 0; k < sporeCount; k++) {
        this.addParticle({
          x: p.x + (Math.random() - 0.5) * 36,
          y: 0.6 + Math.random() * 4.5,
          z: p.y + (Math.random() - 0.5) * 36,
          vx: 0.5 + Math.sin(t * 0.4) * 0.5,
          vy: -0.15,
          vz: Math.cos(t * 0.3) * 0.4,
          floating: true,
          buoyancy: -0.05,
          life: 3.2,
          size: 0.11,
          color: Math.random() < 0.5 ? 0x9be282 : 0xd8c886,
        }, 1);
      }
      this.dust.position.set(p.x, 0, p.y);

      // Huge nearby dinosaurs and titans cause ground tremors, screen shake, and dust puffs
      for (const e of game.entities) {
        const s = SPECIES_BY_ID[e.speciesId];
        if (!s) continue;
        const eSize = s.size * (e.scaleFactor || 1);
        if (eSize >= 2.2 || e.boss || s.tier >= 4) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < 45) {
            const isMoving = e.intent !== "sleeping" && (e.attacking > 0 || (e.charging || 0) > 0 || (e.telegraph || 0) > 0 || (e.motionX !== undefined && Math.hypot(e.x - e.motionX, e.y - e.motionY) > 0.012));
            if (isMoving) {
              const stridePeriod = 0.55 + Math.sqrt(eSize) * 0.18;
              const phase = ((t + (e.id * 1.37)) % stridePeriod) / stridePeriod;
              // Rhythmic foot impact when giant foot strikes ground
              if (phase < 0.14) {
                const proximity = Math.pow(Math.max(0, 1 - d / 45), 1.6);
                const tremor = proximity * Math.min(0.75, (eSize / 3.0) * 0.38);
                this.shake = Math.max(this.shake, tremor);

                // Dust puff kicking up when giant foot hits ground
                if (this.terrain.quality !== "low" && d < 38 && Math.random() < 0.32) {
                  const footSide = ((phase * 100) | 0) % 2 === 0 ? 1 : -1;
                  this.addParticle({
                    x: e.x + Math.cos(e.angle + Math.PI / 2 * footSide) * eSize * 0.35,
                    y: 0.12,
                    z: e.y + Math.sin(e.angle + Math.PI / 2 * footSide) * eSize * 0.35,
                    vx: (Math.random() - 0.5) * 1.8,
                    vy: 0.35 + Math.random() * 0.4,
                    vz: (Math.random() - 0.5) * 1.8,
                    floating: false,
                    life: 0.48,
                    size: 0.22 * Math.min(3.5, eSize),
                    color: 0x988a75,
                  }, 1);
                }
              }
            }
          }
        }
      }

      // If player is a massive dinosaur/titan, their own heavy strides shake the ground and kick dust
      if (game.effectiveSize >= 2.2 && (p.vx * p.vx + p.vy * p.vy > 0.8)) {
        const pSize = game.effectiveSize;
        const stridePeriod = 0.52 + Math.sqrt(pSize) * 0.16;
        const phase = (t % stridePeriod) / stridePeriod;
        if (phase < 0.12) {
          const playerTremor = Math.min(0.35, (pSize / 4.0) * 0.22);
          this.shake = Math.max(this.shake, playerTremor);
          if (this.terrain.quality !== "low" && Math.random() < 0.28) {
            this.addParticle({
              x: p.x + (Math.random() - 0.5) * pSize * 0.55,
              y: 0.12,
              z: p.y + (Math.random() - 0.5) * pSize * 0.55,
              vx: (Math.random() - 0.5) * 1.3,
              vy: 0.3 + Math.random() * 0.35,
              vz: (Math.random() - 0.5) * 1.3,
              floating: false,
              life: 0.42,
              size: 0.2 * Math.min(3.0, pSize),
              color: 0x988a75,
            }, 1);
          }
        }
      }
    } else {
      if (this.companion) this.companion.visible = false;
      this.ring.visible = false;
      this.dangerRing.material.opacity = 0;
      for (const m of this.models.values()) m.visible = false;
      for (const m of this.foodModels.values()) m.visible = false;
      for (const m of this.warnings.values()) m.visible = false;
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const shake = (this.settings.shake && !this.settings.reducedMotion) ? this.shake : 0;
    const effectiveSize = (p && !menu) ? game.effectiveSize : 1.0;
    const targetDist = p && !menu ? 15.0 + Math.pow(effectiveSize, 1.08) * 8.5 : 25;
    this.cameraDist = this.cameraDist ? THREE.MathUtils.damp(this.cameraDist, targetDist, 3.8, dt) : targetDist;

    if (menu) {
      this.camera.position.set(Math.sin(t * 0.08) * 0.45, 8.2, 22.5);
      this.camera.lookAt(1.2, 2.2, 0);
    } else {
      const shakeX = Math.sin(t * 76) * shake;
      const shakeY = Math.cos(t * 62) * shake * 0.72;
      this.camera.position.set(
        this.cameraTarget.x + shakeX,
        this.cameraTarget.y + this.cameraDist + shakeY,
        this.cameraTarget.z + this.cameraDist,
      );
      this.camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z - (this.cameraDist * 0.04));
    }

    const tod = game && !menu ? getTimeOfDay(game.time) : { name: "day", progress: 0.35, ambientIntensity: 1 };
    const weather = game && !menu ? conditionsAt(game, p?.x || 0, p?.y || 0) : null;
    const isRain = weather?.event === "rain" || weather?.event === "flood";
    const isAsh = weather?.event === "ashfall" || weather?.event === "eruption" || weather?.event === "fire";
    const isFrost = weather?.event === "frost";

    let sunOffsetX = -36, sunOffsetY = 48, sunOffsetZ = -24;
    let targetSunIntensity = menu ? 3.8 : 3.6;
    let targetSunColor = 0xfffaee;
    let targetSkyColor = 0x9fe0d2;
    let targetGroundColor = 0x243222;
    let baseFogDensity = 0.010;

    if (tod.name === "dawn") {
      sunOffsetX = -48; sunOffsetY = 28; sunOffsetZ = -18;
      targetSunColor = 0xffad78;
      targetSkyColor = 0xffbe94;
      targetGroundColor = 0x253022;
      targetSunIntensity = 2.7;
      baseFogDensity = 0.012;
    } else if (tod.name === "day") {
      sunOffsetX = -36; sunOffsetY = 50; sunOffsetZ = -26;
      targetSunColor = 0xfffaee;
      targetSkyColor = 0x9fe0d2;
      targetGroundColor = 0x243222;
      targetSunIntensity = 3.8;
      baseFogDensity = 0.010;
    } else if (tod.name === "dusk") {
      sunOffsetX = 44; sunOffsetY = 24; sunOffsetZ = 26;
      targetSunColor = 0xff5c26;
      targetSkyColor = 0xd95a38;
      targetGroundColor = 0x241510;
      targetSunIntensity = 2.6;
      baseFogDensity = 0.012;
    } else {
      sunOffsetX = -24; sunOffsetY = 42; sunOffsetZ = -28;
      targetSunColor = 0x4a78d0;
      targetSkyColor = 0x1e3452;
      targetGroundColor = 0x0c1612;
      targetSunIntensity = 0.88;
      baseFogDensity = 0.015;
    }

    if (isRain) {
      targetSunIntensity *= 0.65;
      baseFogDensity += 0.006;
    } else if (isAsh) {
      targetSunColor = 0xff4818;
      targetSunIntensity *= 0.75;
      baseFogDensity += 0.007;
    } else if (isFrost) {
      targetSunColor = 0xb4e2ff;
      baseFogDensity += 0.005;
    }

    this.sun.position.set(
      this.cameraTarget.x + sunOffsetX,
      sunOffsetY,
      this.cameraTarget.z + sunOffsetZ,
    );
    this.sun.target.position.copy(this.cameraTarget);
    (this.targetSunColor ||= new THREE.Color()).setHex(targetSunColor);
    this.sun.color.lerp(this.targetSunColor, Math.min(1, dt * 2));
    this.sun.intensity = THREE.MathUtils.damp(this.sun.intensity, targetSunIntensity, 3, dt);

    (this.targetHemiSky ||= new THREE.Color()).setHex(targetSkyColor);
    (this.targetHemiGround ||= new THREE.Color()).setHex(targetGroundColor);
    this.hemiLight.color.lerp(this.targetHemiSky, Math.min(1, dt * 2));
    this.hemiLight.groundColor.lerp(this.targetHemiGround, Math.min(1, dt * 2));
    this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, (menu ? 1.75 : tod.ambientIntensity * 1.6), 3, dt);

    if (this.skyDome) this.skyDome.position.copy(this.cameraTarget);
    if (this.groundMist) {
      this.groundMist.position.x = this.cameraTarget.x;
      this.groundMist.position.z = this.cameraTarget.z;
      this.groundMist.rotation.y = t * 0.015;
    }
    if (this.rimLight) {
      this.rimLight.position.set(this.cameraTarget.x + 28, 22, this.cameraTarget.z + 34);
      this.rimLight.intensity = menu ? 1.35 : 1.05;
    }
    if (this.bounceLight) {
      this.bounceLight.position.set(this.cameraTarget.x, -15, this.cameraTarget.z + 20);
    }
    if (this.egg && this.egg.visible && this.eggGlow) {
      this.eggGlow.intensity = 6 + Math.sin(t * 4.5) * 2.5;
    }

    this.scene.fog.density = THREE.MathUtils.damp(this.scene.fog.density, baseFogDensity, 3, dt);
    const region = game && !menu ? biomeAt(p.x, p.y) : REGIONS[0];
    let destFog = (this.targetFogColor ||= new THREE.Color()).set(region.color).multiplyScalar(0.48);
    if (tod.name === "dawn") destFog.lerp(this.fogColor.setHex(0x452818), 0.35);
    else if (tod.name === "dusk") destFog.lerp(this.fogColor.setHex(0x522216), 0.45);
    else if (tod.name === "night") destFog.lerp(this.fogColor.setHex(0x0c1a26), 0.7);
    if (isRain) destFog.lerp(this.fogColor.setHex(0x223540), 0.5);
    else if (isAsh) destFog.lerp(this.fogColor.setHex(0x381812), 0.6);
    else if (isFrost) destFog.lerp(this.fogColor.setHex(0x182c38), 0.5);
    this.scene.fog.color.lerp(destFog, Math.min(1, dt * 1.5));
    this.scene.background.copy(this.scene.fog.color);

    if (menu) {
      const leafCount = this.emitCount(2.4, dt);
      const leafColors = [0x5f8a48, 0x82a657, 0xa37b3e, 0xbf984c, 0x476634];
      for (let k = 0; k < leafCount; k++) {
        this.addParticle({
          kind: "leaf",
          x: -18 + Math.random() * 6,
          y: 3.5 + Math.random() * 6.5,
          z: -5 + Math.random() * 22,
          vx: 4.2 + Math.random() * 2.8,
          vy: -0.15 + (Math.random() - 0.5) * 0.25,
          vz: -0.6 + (Math.random() - 0.5) * 1.2,
          floating: true,
          buoyancy: 0.0,
          life: 5.2 + Math.random() * 2,
          size: 0.24 + Math.random() * 0.12,
          color: leafColors[Math.floor(Math.random() * leafColors.length)],
        }, 1);
      }
      const dustCount = this.emitCount(2.0, dt);
      for (let k = 0; k < dustCount; k++) {
        this.addParticle({
          x: (Math.random() - 0.5) * 24,
          y: 1.8 + Math.random() * 7,
          z: (Math.random() - 0.5) * 24,
          vx: 0.8 + Math.random() * 1.1,
          vy: 0.15 + (Math.random() - 0.5) * 0.2,
          vz: 0.3 + Math.random() * 0.6,
          floating: true,
          buoyancy: 0.05,
          life: 3.5,
          size: 0.08,
          color: 0xffe28a,
        }, 1);
      }
    }

    if (p && !menu) {
      if (isRain) {
        const rainCount = this.emitCount(115, dt);
        for (let k = 0; k < rainCount; k++) {
          this.addParticle({
            x: p.x + (Math.random() - 0.5) * 36,
            y: 14 + Math.random() * 4,
            z: p.y + (Math.random() - 0.5) * 36,
            vx: -3 + Math.random(),
            vy: -32,
            vz: 1.5,
            life: 0.5,
            size: 0.12,
            color: 0x88c4ee,
          }, 1);
        }
      }
      if (isAsh) {
        const ashCount = this.emitCount(60, dt);
        for (let k = 0; k < ashCount; k++) {
          this.addParticle({
            x: p.x + (Math.random() - 0.5) * 32,
            y: Math.random() * 6,
            z: p.y + (Math.random() - 0.5) * 32,
            vx: (Math.random() - 0.5) * 2.5,
            vy: 1.2 + Math.random() * 1.8,
            vz: (Math.random() - 0.5) * 2.5,
            life: 1.4,
            size: 0.16,
            color: Math.random() < 0.6 ? 0xff5511 : 0x5a3e35,
          }, 1);
        }
      }
      if (isFrost) {
        const frostCount = this.emitCount(60, dt);
        for (let k = 0; k < frostCount; k++) {
          this.addParticle({
            x: p.x + (Math.random() - 0.5) * 32,
            y: 8 + Math.random() * 4,
            z: p.y + (Math.random() - 0.5) * 32,
            vx: (Math.random() - 0.5) * 3,
            vy: -3.5,
            vz: (Math.random() - 0.5) * 3,
            life: 1.6,
            size: 0.14,
            color: 0xdff2ff,
          }, 1);
        }
      }
    }
    for (const water of this.water)
      water.material.color.setHSL(0.49, 0.38, 0.29 + Math.sin(t * 0.7) * 0.02);
    this.dust.rotation.y = t * 0.008;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;
      if (effect.life <= 0) {
        this.scene.remove(effect.group);
        effect.mesh.geometry.dispose();
        effect.mesh.material.dispose();
        this.effects.splice(i, 1);
      } else {
        const progress = 1 - effect.life / effect.max;
        effect.group.scale.setScalar(0.6 + progress * 0.5);
        effect.mesh.material.opacity = (1 - progress) * 0.55;
      }
    }
    this.drawParticles(dt);
    this.renderer.render(this.scene, this.camera);
  }
  syncFood(foods, t) {
    const keys = new Set();
    for (const food of foods) {
      if (
        Math.hypot(food.x - this.cameraTarget.x, food.y - this.cameraTarget.z) >
        (this.foodModels.has(food.id) ? 70 : 55)
      )
        continue;
      keys.add(food.id);
      let mesh = this.foodModels.get(food.id);
      if (!mesh) {
        if (food.type === "plant") {
          mesh = createForageModel(food);
          const plantRing = new THREE.Mesh(
            new THREE.RingGeometry(0.52, 0.76, 24),
            new THREE.MeshBasicMaterial({
              color: 0x4ade80,
              transparent: true,
              opacity: 0.65,
              side: THREE.DoubleSide,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          plantRing.rotation.x = -Math.PI / 2;
          plantRing.position.y = 0.04;
          mesh.add(plantRing);
          mesh.userData.auraRing = plantRing;
          mesh.position.set(food.x, elevationAt(food.x, food.y), food.y);
          this.scene.add(mesh);
          this.foodModels.set(food.id, mesh);
          continue;
        }
        mesh = new THREE.Group();
        const power = POWERUPS.find((b) => b.id === food.powerup),
          rare = [
            "rareplant",
            "lineage-fruit",
            "relic",
            "fossil",
            "dna",
            "pet-egg",
            "decoration-cache",
            "cosmetic-cache",
          ].includes(food.type),
          color =
            {
              "lineage-fruit": food.fruit === "sunheart" ? 0xf1b758 : 0xa49dea,
              dna: 0xb5a8f0,
              "pet-egg": CATALOG[food.sku]
                ? RARITIES[CATALOG[food.sku].rarity].color
                : 0xe4cc9b,
              "decoration-cache": 0x9bc7b5,
              "cosmetic-cache": 0xe5c99a,
            }[food.type] ??
            power?.color ??
            (food.type === "meat"
              ? 0xba7763
              : food.type === "essence"
                ? 0xb59ce8
                : food.type === "egg"
                  ? 0xe5d5b6
                  : food.type === "fossil"
                    ? 0xe9c77c
                    : food.type === "relic"
                      ? 0xa89bec
                      : 0xb7cb71);
        const isCarcass = food.type === "meat";
        const geo = ["relic", "essence"].includes(food.type)
          ? new THREE.OctahedronGeometry(1)
          : smoothSphere;
        if (!isCarcass) {
          piece(
            mesh,
            geo,
            color,
            [0, food.type === "egg" ? 0.65 : 0.45, 0],
            food.type === "egg"
              ? [0.43, 0.6, 0.43]
              : [0.3, 0.35, 0.3],
            null,
            rare || food.type === "essence" ? color : 0,
          );
        } else {
          // Prehistoric dinosaur skeletal carcass with glowing bloody aura ring, dark blood pool, spine, skull and exposed ribcage
          const meatAura = new THREE.Mesh(
            new THREE.RingGeometry(0.85, 1.35, 24),
            new THREE.MeshBasicMaterial({
              color: 0xef4444,
              transparent: true,
              opacity: 0.7,
              side: THREE.DoubleSide,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          meatAura.rotation.x = -Math.PI / 2;
          meatAura.position.y = 0.03;
          mesh.add(meatAura);
          mesh.userData.auraRing = meatAura;

          piece(mesh, new THREE.CircleGeometry(0.88, 16), 0x3d0c10, [0, 0.02, 0], [1.35, 0.85, 1], [-Math.PI / 2, 0, 0]);
          piece(mesh, cylinder, 0xe5dfcf, [0, 0.22, 0], [0.07, 1.45, 0.07], [0, 0, Math.PI / 2]);
          piece(mesh, smoothSphere, 0xd8ceb8, [-0.75, 0.24, 0], [0.24, 0.18, 0.18]);
          piece(mesh, smoothSphere, 0xd8ceb8, [0.65, 0.22, 0], [0.2, 0.18, 0.22]);
          piece(mesh, smoothSphere, 0x8a181e, [0.05, 0.18, 0], [0.48, 0.18, 0.28]);
          piece(mesh, smoothSphere, 0x580f14, [-0.15, 0.14, 0.1], [0.35, 0.14, 0.22]);
          for (let i = -2; i <= 2; i++) {
            const rx = i * 0.22;
            piece(mesh, new THREE.TorusGeometry(0.3, 0.038, 6, 12, Math.PI), 0xe2dcce, [rx, 0.18, 0], [1, 1, 1], [0, 0, 0]);
          }
        }
        if (food.type === "dna")
          for (let i = 0; i < 10; i++) {
            const a = i * 0.65;
            for (const sign of [-1, 1])
              piece(
                mesh,
                smoothSphere,
                color,
                [
                  Math.cos(a) * 0.2 * sign,
                  0.2 + i * 0.11,
                  Math.sin(a) * 0.2 * sign,
                ],
                [0.075, 0.075, 0.075],
                null,
                color,
              );
          }
        if (food.type === "lineage-fruit") {
          mesh.children[0].scale.set(0.34, 0.4, 0.34);
          piece(mesh, cylinder, 0x645337, [0, 0.9, 0], [0.035, 0.3, 0.035]);
          piece(
            mesh,
            smoothSphere,
            0x6e9f5f,
            [0.18, 0.94, 0],
            [0.24, 0.04, 0.09],
            [0, 0, 0.4],
          );
        }
        if (food.type === "pet-egg") {
          mesh.children[0].scale.set(0.45, 0.62, 0.45);
          for (let i = 0; i < 3; i++)
            piece(
              mesh,
              new THREE.TorusGeometry(0.42, 0.025, 6, 24),
              0xe7d6ad,
              [0, 0.2 + i * 0.2, 0],
              [1, 1, 1],
              [Math.PI / 2, 0, 0],
            );
        }
        if (food.type === "mutation-catalyst") {
          const catColors = {
            common: 0x4ade80,
            rare: 0x38bdf8,
            epic: 0xc084fc,
            legendary: 0xfbbf24,
          };
          const catColor = catColors[food.rarity] || 0x4ade80;
          mesh.children[0].geometry = new THREE.OctahedronGeometry(0.52, 0);
          mesh.children[0].material = new THREE.MeshStandardMaterial({
            color: catColor,
            emissive: catColor,
            emissiveIntensity: 0.95,
            roughness: 0.12,
            metalness: 0.85,
          });
          const orbit = piece(mesh, new THREE.TorusGeometry(0.72, 0.035, 6, 24), catColor, [0, 0.45, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
          orbit.material = new THREE.MeshBasicMaterial({ color: catColor });
          const lightBeam = piece(mesh, new THREE.CylinderGeometry(0.04, 0.28, 5.5, 8), catColor, [0, 2.8, 0], [1, 1, 1]);
          lightBeam.material = new THREE.MeshBasicMaterial({
            color: catColor,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
        }
        if (
          food.type === "decoration-cache" ||
          food.type === "cosmetic-cache"
        ) {
          mesh.children[0].geometry = box;
          mesh.children[0].scale.set(0.65, 0.45, 0.5);
          piece(mesh, box, 0xc5ab75, [0, 0.7, 0], [0.76, 0.08, 0.6]);
        }
        if (food.type === "plant" || food.type === "rareplant")
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * 6.28;
            piece(
              mesh,
              smoothSphere,
              food.type === "rareplant" ? color : 0x5e8e60,
              [Math.cos(a) * 0.25, 0.28, Math.sin(a) * 0.25],
              [0.3, 0.08, 0.14],
              [0, -a, 0],
            );
          }
        if (food.type === "egg")
          for (let i = 0; i < 7; i++) {
            const a = i * 2.4;
            piece(
              mesh,
              sphere,
              0x8c8565,
              [Math.cos(a) * 0.4, 0.4 + (i % 3) * 0.2, Math.sin(a) * 0.4],
              [0.07, 0.08, 0.035],
              [0, -a, 0],
            );
          }
        if (rare) {
          const beam = piece(
            mesh,
            new THREE.CylinderGeometry(0.06, 0.22, 4.5, 8),
            color,
            [0, 2.4, 0],
            [1, 1, 1],
          );
          beam.material = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: food.type === "fossil" ? 0.25 : 0.12,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          if (food.type === "fossil")
            for (let i = 0; i < 4; i++)
              piece(
                mesh,
                smoothSphere,
                0xdacbaa,
                [(i - 1.5) * 0.2, 0.25, 0],
                [0.07, 0.25, 0.32],
              );
          const halo = piece(
            mesh,
            new THREE.TorusGeometry(0.62, 0.025, 6, 32),
            color,
            [0, 0.9, 0],
            [1, 1, 1],
            [Math.PI / 2, 0, 0],
          );
          halo.material = new THREE.MeshBasicMaterial({ color });
        }
        if (!mesh.userData.auraRing) {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.48, 0.74, 24),
            new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.65,
              side: THREE.DoubleSide,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.04;
          mesh.add(ring);
          mesh.userData.auraRing = ring;
        }
        mesh.position.set(food.x, elevationAt(food.x, food.y), food.y);
        this.scene.add(mesh);
        this.foodModels.set(food.id, mesh);
      }
      // Magnets change the simulation coordinates without changing the food id.
      mesh.position.set(food.x, elevationAt(food.x, food.y), food.y);
      mesh.visible =
        Math.hypot(food.x - this.cameraTarget.x, food.y - this.cameraTarget.z) <
        60;
      if (mesh.userData.auraRing?.material) {
        mesh.userData.auraRing.material.opacity = 0.42 + Math.sin(t * 3.5 + mesh.id * 0.7) * 0.24;
        mesh.userData.auraRing.scale.setScalar(1.0 + Math.sin(t * 2.6 + mesh.id * 0.5) * 0.09);
      }
      if (food.type === "plant")
        mesh.rotation.z = Math.sin(t * 1.5 + mesh.id) * 0.025;
      else if (food.type !== "egg" && food.type !== "meat")
        mesh.children[0].position.y = 0.45 + Math.sin(t * 2 + mesh.id) * 0.07;
      if (food.type === "relic" || food.type === "essence")
        mesh.children[0].rotation.y = t * 0.6;
      if (food.type === "mutation-catalyst") {
        mesh.children[0].rotation.y = t * 2.2;
        mesh.children[0].rotation.x = Math.sin(t * 1.8) * 0.25;
        mesh.children[0].position.y = 0.55 + Math.sin(t * 3.2 + mesh.id) * 0.12;
      }
    }
    for (const [key, mesh] of this.foodModels)
      if (!keys.has(key)) {
        this.removeModel(mesh);
        this.foodModels.delete(key);
      }
  }
  syncWarnings(game, t) {
    this.warnings ||= new Map();
    const activeKeys = new Set();
    const p = game?.player;

    if (p) {
      for (const e of game.entities || []) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > 55) continue;

        if (e.cast) {
          const key = `cast:${e.id}`;
          activeKeys.add(key);
          let group = this.warnings.get(key);
          const castColor = e.cast.kind === "flame" ? 0xff4500 : e.cast.kind === "frost" ? 0x06b6d4 : e.cast.kind === "venom" ? 0x22c55e : e.cast.kind === "blood" ? 0xef4444 : 0xf59e0b;
          if (!group) {
            group = new THREE.Group();
            const shape = e.cast.shape;
            const radius = e.cast.radius || 4.5;
            const geo = shape === "cone"
              ? new THREE.RingGeometry(0.2, radius, 24, 1, -0.65, 1.3)
              : new THREE.RingGeometry(0.2, radius, 32);
            const mat = new THREE.MeshBasicMaterial({
              color: castColor,
              transparent: true,
              opacity: 0.5,
              side: THREE.DoubleSide,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            });
            const outerMesh = new THREE.Mesh(geo, mat);
            outerMesh.rotation.x = -Math.PI / 2;
            group.add(outerMesh);

            // Inner expanding windup indicator
            const fillGeo = shape === "cone"
              ? new THREE.CircleGeometry(radius, 24, -0.65, 1.3)
              : new THREE.CircleGeometry(radius, 32);
            const fillMat = new THREE.MeshBasicMaterial({
              color: castColor,
              transparent: true,
              opacity: 0.35,
              side: THREE.DoubleSide,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            });
            const fillMesh = new THREE.Mesh(fillGeo, fillMat);
            fillMesh.rotation.x = -Math.PI / 2;
            fillMesh.position.y = 0.01;
            group.add(fillMesh);

            this.scene.add(group);
            this.warnings.set(key, group);
          }
          const outerMesh = group.children[0];
          const fillMesh = group.children[1];
          const total = Math.max(0.01, e.cast.total || 0.3);
          const progress = Math.max(0, Math.min(1, 1 - (e.cast.remaining / total)));
          group.position.set(e.x, 0.08, e.y);
          group.rotation.y = -(e.cast.angle || 0);
          if (outerMesh?.material) {
            outerMesh.material.opacity = 0.4 + Math.sin(t * 18) * 0.15 + progress * 0.3;
          }
          if (fillMesh) {
            fillMesh.scale.set(Math.max(0.05, progress), Math.max(0.05, progress), 1);
            fillMesh.material.opacity = 0.2 + progress * 0.5;
          }
        }

        if ((e.chargeWindup || 0) > 0 || (e.charging || 0) > 0) {
          const key = `charge:${e.id}`;
          activeKeys.add(key);
          let group = this.warnings.get(key);
          if (!group) {
            group = new THREE.Group();
            const laneGeo = new THREE.PlaneGeometry(13, 2.5);
            const laneMat = new THREE.MeshBasicMaterial({
              color: 0xff5511,
              transparent: true,
              opacity: 0.5,
              side: THREE.DoubleSide,
              depthWrite: false,
              blending: THREE.AdditiveBlending,
            });
            const mesh = new THREE.Mesh(laneGeo, laneMat);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.x = 6.5;
            group.add(mesh);
            this.scene.add(group);
            this.warnings.set(key, group);
          }
          group.position.set(e.x, 0.07, e.y);
          group.rotation.y = -(e.chargeAngle || e.angle || 0);
          const mesh = group.children[0];
          if (mesh?.material) {
            mesh.material.opacity = 0.4 + Math.sin(t * 22) * 0.2;
          }
        }
      }
    }

    for (const [key, group] of this.warnings) {
      if (!activeKeys.has(key)) {
        this.scene.remove(group);
        group.traverse((m) => {
          m.geometry?.dispose();
          m.material?.dispose();
        });
        this.warnings.delete(key);
      }
    }
    this.projectileModels ||= new Map();
    const seen = new Set();
    for (const shot of game.projectiles || []) {
      seen.add(shot.id);
      let mesh = this.projectileModels.get(shot.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(1, 12, 8),
          new THREE.MeshStandardMaterial({
            color:
              shot.kind === "flame"
                ? 0xff9a36
                : shot.kind === "venom"
                  ? 0x9dce56
                  : 0x9ecfed,
            emissive: shot.kind === "flame" ? 0xff5722 : 0x417e92,
            emissiveIntensity: 1.5,
            roughness: 0.3,
          }),
        );
        this.scene.add(mesh);
        this.projectileModels.set(shot.id, mesh);
      }
      mesh.position.set(shot.x, 1.2, shot.y);
      mesh.scale.set(shot.radius, shot.radius * 0.55, shot.radius * 0.6);
      mesh.rotation.y = -shot.angle;
    }
    for (const [id, mesh] of this.projectileModels)
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
        this.projectileModels.delete(id);
      }
  }
  syncCompanion(game, dt, t) {
    const id = game.petId;
    if (!id) {
      if (this.companion) {
        this.scene.remove(this.companion);
        this.companion.userData.dispose();
        this.companion = null;
      }
      return;
    }
    const p = game.player;
    if (!this.companion || this.companion.userData.petId !== id) {
      if (this.companion) {
        this.scene.remove(this.companion);
        this.companion.userData.dispose();
      }
      this.companion = createPet(id);
      this.companion.position.set(p.x - 3, 0, p.y + 3);
      this.scene.add(this.companion);
    }
    const m = this.companion,
      angle = p.angle + 2.2,
      x = p.x + Math.cos(angle) * (4 + game.species.size * 0.3),
      y = p.y + Math.sin(angle) * (4 + game.species.size * 0.3),
      d = Math.hypot(x - m.position.x, y - m.position.z);
    m.visible = true;
    if (d > 35) m.position.set(x, 0, y);
    else {
      m.position.x = THREE.MathUtils.damp(m.position.x, x, 5, dt);
      m.position.z = THREE.MathUtils.damp(m.position.z, y, 5, dt);
    }
    if (d > 0.15) {
      const a = -Math.atan2(y - m.position.z, x - m.position.x),
        diff = Math.atan2(
          Math.sin(a - m.rotation.y),
          Math.cos(a - m.rotation.y),
        );
      m.rotation.y += diff * Math.min(1, dt * 7);
    }
    animateCreature(m, dt, t, Math.min(1, d * 0.4));
  }
  drawParticles(dt) {
    const dummy = this.particleDummy,
      color = (this.particleColor ||= new THREE.Color()),
      maxCapacity = this.maxParticles || 750;
    let active = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      if (active < maxCapacity) {
        this.particles[active] = p;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (!p.floating) p.vy -= 8 * dt;
        else p.vy += (p.buoyancy || 0.4) * dt;
        if (p.kind === "leaf") {
          p.vy = Math.sin(this.elapsed * 2.8 + p.x * 0.4) * 0.28 - 0.18;
          if (p.y < 0.45) p.life = Math.min(p.life, 0.15);
          dummy.rotation.set(Math.sin(this.elapsed * 1.8 + p.z) * 0.4, this.elapsed * 0.9 + p.x, Math.cos(this.elapsed * 2.2 + p.x) * 0.5);
          dummy.scale.set(p.size * 1.6, p.size * 0.12, p.size * 0.85).multiplyScalar(clamp(p.life * 3, 0, 1));
        } else {
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(p.size * clamp(p.life * 3, 0, 1));
        }
        dummy.position.set(p.x, Math.max(0.04, p.y), p.z);
        this.particleMesh.setColorAt(active, color.set(p.color));
        dummy.updateMatrix();
        this.particleMesh.setMatrixAt(active, dummy.matrix);
        active++;
      }
    }
    this.particles.length = active;
    this.particleMesh.count = active;
    if (active) {
      this.particleMesh.instanceMatrix.clearUpdateRanges();
      this.particleMesh.instanceMatrix.addUpdateRange(0, active * 16);
      this.particleMesh.instanceMatrix.needsUpdate = true;
      if (this.particleMesh.instanceColor) {
        this.particleMesh.instanceColor.clearUpdateRanges();
        this.particleMesh.instanceColor.addUpdateRange(0, active * 3);
        this.particleMesh.instanceColor.needsUpdate = true;
      }
    }
  }
  project(x, y, height = 2) {
    const groundY = elevationAt(x, y);
    const v = this.projectedPosition.set(x, groundY + height, y).project(this.camera);
    const width = typeof innerWidth !== "undefined" ? innerWidth : 1920;
    const heightPx = typeof innerHeight !== "undefined" ? innerHeight : 1080;
    return {
      x: (v.x * 0.5 + 0.5) * width,
      y: (-v.y * 0.5 + 0.5) * heightPx,
      visible: v.z < 1,
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.resetRun();
    this.terrain.dispose();
    this.ecologyArt?.dispose();
    this.removeModel(this.menuDino);
    if (Array.isArray(this.menuRoamers)) {
      for (const roamer of this.menuRoamers) {
        if (roamer?.mesh) this.removeModel(roamer.mesh);
      }
      this.menuRoamers = [];
    }
    const geometries = new Set(), materials = new Set();
    this.scene.traverse((object) => {
      if (object.isInstancedMesh) object.dispose();
      if (object.geometry && !sharedGeometry.has(object.geometry) && !object.geometry.userData.shared)
        geometries.add(object.geometry);
      for (const material of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [])
        if (!sharedMaterials.has(material) && !material.userData.shared) materials.add(material);
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    this.sun.shadow.dispose();
    this.minimapBackdrops?.clear();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
  minimap(canvas, game, expanded = false) {
    if (!canvas || !game) return;
    const ctx = canvas.getContext("2d"),
      w = expanded ? 480 : 180,
      h = w,
      c = w / 2,
      r = w * 0.46,
      p = game.player;
    if (!ctx) return;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const range = expanded ? WORLD_RADIUS : 245,
      cx = expanded ? 0 : Math.round(p.x / 200) * 200,
      cy = expanded ? 0 : Math.round(p.y / 200) * 200,
      scale = r / range;
    canvas.mapView = { cx, cy, range, r, w };
    const cache = (this.minimapBackdrops ||= new Map()),
      key = `${w}:${cx}:${cy}:${scale}`;
    let backdrop = cache.get(key);
    if (!backdrop) {
      backdrop = canvas.ownerDocument.createElement("canvas");
      backdrop.width = w;
      backdrop.height = h;
      const background = backdrop.getContext("2d");
      background.fillStyle = "#15251f";
      background.fillRect(0, 0, w, h);
      background.globalAlpha = 0.65;
      for (let x = 0; x < w; x += 8)
        for (let y = 0; y < h; y += 8) {
          const wx = cx + (x - c) / scale,
            wy = cy + (y - c) / scale;
          if (Math.hypot(wx, wy) > WORLD_RADIUS) continue;
          const biome = biomeAt(wx, wy);
          background.fillStyle = `#${biome.color.toString(16).padStart(6, "0")}`;
          background.fillRect(x, y, 8, 8);
        }
      background.globalAlpha = 1;
      background.strokeStyle = "#87a38c22";
      background.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        background.beginPath();
        background.moveTo((i * w) / 4, 0);
        background.lineTo((i * w) / 4, h);
        background.moveTo(0, (i * h) / 4);
        background.lineTo(w, (i * h) / 4);
        background.stroke();
      }
    }
    cache.delete(key);
    cache.set(key, backdrop);
    if (cache.size > 8) cache.delete(cache.keys().next().value);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, 6.28);
    ctx.clip();
    ctx.globalAlpha = 1;
    ctx.drawImage(backdrop, 0, 0);
    // Fixed grid fog reveals terrain only through actual travel, retained in saves.
    ctx.fillStyle = '#07110ff2';
    for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) {
      if (!isExplored(game, cx + (x - c) / scale, cy + (y - c) / scale)) ctx.fillRect(x, y, 8, 8);
    }
    for (const e of game.entities) {
      if (!isExplored(game, e.x, e.y) || Math.hypot(e.x-p.x,e.y-p.y)>65) continue;
      ctx.fillStyle = e.boss
        ? "#e6a6fc"
        : lookup(e.speciesId).tier > game.tier
          ? "#ee9b83"
          : "#c1d6a1";
      ctx.beginPath();
      ctx.arc(
        c + (e.x - cx) * scale,
        c + (e.y - cy) * scale,
        e.boss ? 3 : 1.6,
        0,
        6.28,
      );
      ctx.fill();
    }
    for (const [lairIndex, lair] of game.lairs.entries()) {
      if (!isExplored(game, lair.x, lair.y)) continue;
      ctx.fillStyle = lair.entityId ? "#e2a7f0" : "#777683";
      const x = c + (lair.x - cx) * scale,
        y = c + (lair.y - cy) * scale;
      ctx.fillRect(x - 3, y - 3, 6, 6);
      if (expanded) {
        ctx.font = "8px system-ui";
        ctx.textAlign = "center";
        ctx.fillStyle = "#e0c8e7";
        ctx.fillText(
          `${lairIndex + 1}${lair.entityId ? "" : ` · ${Math.ceil(Math.max(0, lair.respawnAt - game.time))}s`}`,
          x,
          y - 8,
        );
      }
    }
    for (const food of game.foods)
      if (
        ["rareplant", "egg", "relic", "fossil"].includes(food.type) &&
        Math.hypot(food.x - p.x, food.y - p.y) < 45
      ) {
        ctx.fillStyle =
          food.type === "egg"
            ? "#e4d8b9"
            : food.type === "fossil"
              ? "#ffe19c"
              : "#b8c8fa";
        ctx.fillRect(
          c + (food.x - cx) * scale - 1,
          c + (food.y - cy) * scale - 1,
          2.5,
          2.5,
        );
      }
    if (expanded) {
      ctx.font = "9px system-ui";
      ctx.textAlign = "center";
      for (const region of REGIONS) {
        const radius = (region.minRadius + region.maxRadius) / 2,
          angle =
            region.side === "north"
              ? -Math.PI * 0.62
              : region.side === "south"
                ? Math.PI * 0.43
                : region.tier > 0
                  ? -Math.PI / 2
                  : -0.5;
        const x = Math.cos(angle) * radius,
          y = Math.sin(angle) * radius;
        if (!isExplored(game, x, y)) continue;
        ctx.fillStyle = "#e5e4cf";
        ctx.fillText(
          `${region.name} · ${region.tier + 1}`,
          c + x * scale,
          c + y * scale,
        );
      }
    }
    for (const site of LANDMARKS) if (hasDiscovery(game, site.id)) {
      const x = c + (site.x-cx)*scale, y = c + (site.y-cy)*scale;
      ctx.fillStyle = '#8de0d9'; ctx.fillRect(x-2,y-2,4,4);
      if (expanded) { ctx.font='9px system-ui'; ctx.textAlign='center'; ctx.fillText(site.name,x,y-6); }
    }
    if (game.waypoint) {
      const x = c + (game.waypoint.x - cx) * scale,
        y = c + (game.waypoint.y - cy) * scale;
      ctx.strokeStyle = "#ffe4a4";
      ctx.beginPath();
      ctx.moveTo(x - 4, y);
      ctx.lineTo(x + 4, y);
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x, y + 4);
      ctx.stroke();
    }
    ctx.translate(c + (p.x - cx) * scale, c + (p.y - cy) * scale);
    ctx.rotate(p.angle);
    ctx.fillStyle = "#f2d79c";
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -3);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#b99e6466";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, 6.28);
    ctx.stroke();
  }
}
