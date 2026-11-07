import * as THREE from "three";
import { SPECIES } from "./data.js";
import { createDinosaur, animateCreature } from "./creatures.js";
import { Terrain } from "./terrain.js";
import { biomeAt, REGIONS, LAIRS, WORLD_RADIUS } from "./world-data.js";
import { POWERUPS, SKINS } from "./content.js";
export { createDinosaur };

const lookup = (id) => SPECIES.find((s) => s.id === id) || SPECIES[0];
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
const materialCache = new Map();
let surfaceTexture;
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
  return materialCache.get(key);
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
    this.renderer.toneMappingExposure = 1.12;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x163d37);
    this.scene.fog = new THREE.FogExp2(0x163d37, 0.012);
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.2, 350);
    this.scene.add(new THREE.HemisphereLight(0xb1e0d1, 0x273529, 1.65));
    this.sun = new THREE.DirectionalLight(0xffd7a0, 3.6);
    this.sun.position.set(-30, 60, -20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
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
    const rim = new THREE.DirectionalLight(0x66c6c5, 0.85);
    rim.position.set(20, 15, 35);
    this.scene.add(rim);
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
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      onFailure?.(
        "The graphics device was interrupted. Your profile is safe. Restart the game to restore rendering.",
      );
    });
    this.configure(settings);
    this.resize();
  }
  configure(settings) {
    this.settings = settings;
    const quality = settings.quality || "high";
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        quality === "low" ? 1 : quality === "medium" ? 1.35 : 1.8,
      ),
    );
    this.renderer.shadowMap.enabled = quality !== "low";
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
  setMenuSkin(id) {
    if (this.menuDino?.userData.skinId === id) return;
    if (this.menuDino) this.removeModel(this.menuDino);
    this.menuDino = createDinosaur(
      SPECIES.find((s) => s.id === "tyrannosaurus"),
      true,
      id,
    );
    this.menuDino.position.set(6.6, 0, -1);
    this.menuDino.scale.setScalar(2.4);
    this.scene.add(this.menuDino);
  }
  generateWorld() {
    this.terrain = new Terrain(this.scene);
    this.terrain.update(0, 0);
    this.water = [];
    this.nest = new THREE.Group();
    this.scene.add(this.nest);
    piece(
      this.nest,
      new THREE.TorusGeometry(2.3, 0.22, 8, 32),
      0x7c6844,
      [0, 0.06, 0],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * 6.28;
      piece(
        this.nest,
        box,
        0x8b7750,
        [Math.cos(a) * 2, 0.1, Math.sin(a) * 2],
        [1.3, 0.1, 0.1],
        [0, -a + 0.5, 0],
      );
    }
  }
  createEgg() {
    this.egg = new THREE.Group();
    this.scene.add(this.egg);
    const shell = piece(
      this.egg,
      smoothSphere,
      0xe5d7ad,
      [0, 1.2, 0],
      [0.86, 1.16, 0.86],
    );
    for (let i = 0; i < 19; i++) {
      const a = i * 2.4,
        h = 0.3 + (i % 5) * 0.32,
        r = 0.8 * Math.sqrt(Math.max(0, 1 - ((h - 1.2) / 1.2) ** 2));
      piece(
        this.egg,
        sphere,
        0x9a946e,
        [Math.cos(a) * r, h, Math.sin(a) * r],
        [0.1, 0.14, 0.03],
        [0, -a, 0],
      );
    }
    this.eggGlow = new THREE.PointLight(0xffd28b, 7, 10);
    this.eggGlow.position.y = 2;
    this.egg.add(this.eggGlow);
    this.menuDino = createDinosaur(
      SPECIES.find((s) => s.id === "tyrannosaurus"),
      true,
    );
    this.menuDino.position.set(6.6, 0, -1);
    this.menuDino.scale.setScalar(2.4);
    this.menuDino.rotation.y = -0.65;
    this.scene.add(this.menuDino);
  }
  createParticles() {
    this.particleMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 0),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
      }),
      220,
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
  burst(x, z, color = 0xe5bc6d, count = 16) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= 220) this.particles.shift();
      this.particles.push({
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
      });
    }
  }
  event(event) {
    if (
      ["hit", "kill", "eat", "hatch", "evolve", "ability", "dash"].includes(
        event.type,
      )
    )
      this.burst(
        event.x || 0,
        event.y || 0,
        event.type === "hit"
          ? 0xe98866
          : event.type === "eat"
            ? 0x9ce3a5
            : 0xf4d48a,
        event.type === "evolve" ? 65 : 12,
      );
    if (event.type === "hit" || event.type === "ability")
      this.shake = Math.max(this.shake, event.type === "ability" ? 0.4 : 0.2);
    if (["attack", "ability", "enemy-ability", "evolve"].includes(event.type)) {
      const directional =
        event.type === "attack" ||
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
      const color =
        {
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
      this.burst(event.x || 0, event.y || 0, color, 18);
      const radius = event.radius || 3,
        arc = directional ? 1.4 : Math.PI * 2;
      const geo = new THREE.RingGeometry(
        radius * 0.7,
        radius,
        48,
        1,
        -arc / 2,
        arc,
      );
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat),
        group = new THREE.Group();
      mesh.rotation.x = -Math.PI / 2;
      group.add(mesh);
      group.position.set(event.x || 0, 0.12, event.y || 0);
      group.rotation.y = -(event.angle || 0);
      this.scene.add(group);
      this.effects.push({
        group,
        mesh,
        life: event.type === "attack" ? 0.2 : 0.65,
        max: event.type === "attack" ? 0.2 : 0.65,
      });
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
    const points = [],
      dx = target.x - origin.x,
      dz = target.y - origin.y;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8,
        jitter = i === 0 || i === 8 ? 0 : (Math.random() - 0.5) * 1.5;
      points.push(
        new THREE.Vector3(
          dx * t + jitter,
          1.5 + Math.sin(t * Math.PI),
          dz * t - jitter,
        ),
      );
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points),
      line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }),
      ),
      group = new THREE.Group();
    group.position.set(origin.x, 0, origin.y);
    group.add(line);
    this.scene.add(group);
    this.effects.push({ group, mesh: line, life: 0.35, max: 0.35 });
  }
  aim(clientX, clientY, player) {
    this.raycaster.setFromCamera(
      new THREE.Vector2(
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
  ) {
    let model = this.models.get(key);
    if (
      !model ||
      model.userData.species.id !== id ||
      model.userData.skinId !== skinId
    ) {
      if (model) this.removeModel(model);
      model = createDinosaur(lookup(id), false, skinId);
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
    model.rotation.y += diff * Math.min(1, dt * 16);
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
    model.visible =
      Math.hypot(x - this.cameraTarget.x, z - this.cameraTarget.z) < 68;
    model.userData.body.visible = true;
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
        ![sphere, smoothSphere, cone, cylinder, box].includes(obj.geometry)
      )
        obj.geometry.dispose();
      if (
        obj.material &&
        !Array.from(materialCache.values()).includes(obj.material)
      )
        obj.material.dispose();
    });
  }
  render(game, dt, menu = false) {
    this.currentGame = game;
    this.elapsed += dt;
    const t = this.elapsed,
      p = game?.player;
    this.menuDino.visible = menu;
    this.egg.visible = game?.state === "egg";
    if (menu) {
      this.animateDino(this.menuDino, t, 0, false, dt);
      this.menuDino.rotation.y = -0.65 + Math.sin(t * 0.16) * 0.22;
      this.cameraTarget.lerp(new THREE.Vector3(0, 0, 0), Math.min(1, dt * 3));
    } else if (p)
      this.cameraTarget.lerp(
        new THREE.Vector3(p.x, 0, p.y),
        Math.min(1, dt * 6),
      );
    this.terrain.update(
      menu ? 0 : p?.x || 0,
      menu ? 0 : p?.y || 0,
      menu ? 7281 : game.seed,
    );
    this.terrain.animate(t);
    this.terrain.focus(p?.x || 0, p?.y || 0, menu);
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
        );
        keys.add("player");
        this.ring.position.set(p.x, 0.065, p.y);
        this.ring.scale.setScalar(
          Math.max(1.15, player.userData.baseScale * 1.4),
        );
        this.ring.visible = true;
        this.ring.material.opacity = p.invulnerable > 0 ? 0.85 : 0.55;
      } else this.ring.visible = false;
      for (const e of game.entities) {
        if (Math.hypot(e.x - p.x, e.y - p.y) > 49) {
          const old = this.models.get(e.id);
          if (old) {
            old.visible = false;
            keys.add(e.id);
          }
          continue;
        }
        this.syncModel(
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
        );
        keys.add(e.id);
      }
      for (const [key, model] of this.models)
        if (!keys.has(key)) {
          this.removeModel(model);
          this.models.delete(key);
        }
      this.syncFood(game.foods, t);
      this.dangerRing.visible = false;
      this.syncWarnings(game, t);
      this.dust.position.set(p.x, 0, p.y);
    } else {
      this.ring.visible = false;
      this.dangerRing.material.opacity = 0;
      for (const m of this.models.values()) m.visible = false;
      for (const m of this.foodModels.values()) m.visible = false;
      for (const m of this.warnings.values()) m.visible = false;
    }
    this.shake = Math.max(0, this.shake - dt * 1.5);
    const shake = this.settings.shake ? this.shake : 0;
    const zoom =
      p && !menu ? clamp((lookup(p.speciesId)?.size || 1) - 1, 0, 7) * 1.65 : 0;
    if (menu) {
      this.camera.position.set(Math.sin(t * 0.08) * 0.45, 8.5, 23);
      this.camera.lookAt(0, 2, 0);
    } else {
      this.camera.position.set(
        this.cameraTarget.x + Math.sin(t * 84) * shake,
        this.cameraTarget.y + 25 + zoom,
        this.cameraTarget.z + 25 + zoom,
      );
      this.camera.lookAt(this.cameraTarget.x, 0, this.cameraTarget.z - 1);
    }
    this.sun.position.set(
      this.cameraTarget.x - 30,
      60,
      this.cameraTarget.z - 20,
    );
    this.sun.target.position.copy(this.cameraTarget);
    const night =
      game && !menu ? (0.5 - 0.5 * Math.cos(game.time / 110)) * 0.42 : 0;
    this.sun.intensity = 3.6 - night * 3;
    this.scene.fog.density = 0.012 + night * 0.005;
    const region = game && !menu ? biomeAt(p.x, p.y) : REGIONS[0],
      fogColor = new THREE.Color(region.color).multiplyScalar(0.52);
    this.scene.fog.color.lerp(fogColor, Math.min(1, dt * 1.5));
    this.scene.background.copy(this.scene.fog.color);
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
        55
      )
        continue;
      keys.add(food.id);
      let mesh = this.foodModels.get(food.id);
      if (!mesh) {
        mesh = new THREE.Group();
        const power = POWERUPS.find((b) => b.id === food.powerup),
          rare = ["rareplant", "relic", "fossil"].includes(food.type),
          color =
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
        const geo = ["relic", "essence"].includes(food.type)
          ? new THREE.OctahedronGeometry(1)
          : smoothSphere;
        piece(
          mesh,
          geo,
          color,
          [0, food.type === "egg" ? 0.65 : 0.45, 0],
          food.type === "egg"
            ? [0.43, 0.6, 0.43]
            : food.type === "meat"
              ? [0.65, 0.25, 0.32]
              : [0.3, 0.35, 0.3],
          null,
          rare || food.type === "essence" ? color : 0,
        );
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
        if (food.type === "meat")
          for (let i = 0; i < 3; i++)
            piece(
              mesh,
              smoothSphere,
              0xddd5ba,
              [(i - 1) * 0.28, 0.56, 0],
              [0.05, 0.17, 0.3],
            );
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
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.5, 0.55, 16),
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.04;
        mesh.add(ring);
        mesh.position.set(food.x, 0, food.y);
        this.scene.add(mesh);
        this.foodModels.set(food.id, mesh);
      }
      mesh.visible =
        Math.hypot(food.x - this.cameraTarget.x, food.y - this.cameraTarget.z) <
        60;
      if (food.type !== "egg" && food.type !== "meat")
        mesh.children[0].position.y = 0.45 + Math.sin(t * 2 + mesh.id) * 0.07;
      if (food.type === "relic" || food.type === "essence")
        mesh.children[0].rotation.y = t * 0.6;
    }
    for (const [key, mesh] of this.foodModels)
      if (!keys.has(key)) {
        this.removeModel(mesh);
        this.foodModels.delete(key);
      }
  }
  syncWarnings(game, t) {
    const seen = new Set();
    for (const e of game.entities) {
      if (Math.hypot(e.x - game.player.x, e.y - game.player.y) > 60) continue;
      const s = lookup(e.speciesId),
        zone =
          e.cast ||
          (e.telegraph > 0
            ? {
                x: e.x,
                y: e.y,
                radius: 2.8 + (s.size + game.species.size) * 0.55,
                shape: "circle",
                angle: 0,
                remaining: e.telegraph,
                total: 0.65,
              }
            : null);
      if (!zone) continue;
      seen.add(e.id);
      let group = this.warnings.get(e.id);
      if (group && group.userData.shape !== zone.shape) {
        this.scene.remove(group);
        group.traverse((m) => {
          m.geometry?.dispose();
          m.material?.dispose();
        });
        this.warnings.delete(e.id);
        group = null;
      }
      if (!group) {
        group = new THREE.Group();
        group.userData.shape = zone.shape;
        const arc = zone.shape === "cone" ? 1.5 : Math.PI * 2;
        for (const [inner, outer, opacity] of [
          [0.01, 1, 0.12],
          [0.95, 1, 0.82],
        ]) {
          const mesh = new THREE.Mesh(
            new THREE.RingGeometry(inner, outer, 48, 1, -arc / 2, arc),
            new THREE.MeshBasicMaterial({
              color: 0xff594e,
              transparent: true,
              opacity,
              side: THREE.DoubleSide,
              depthWrite: false,
            }),
          );
          mesh.rotation.x = -Math.PI / 2;
          group.add(mesh);
        }
        this.scene.add(group);
        this.warnings.set(e.id, group);
      }
      group.visible = game.state === "playing";
      group.position.set(zone.x, 0.11, zone.y);
      group.scale.setScalar(zone.radius);
      group.rotation.y = -(zone.angle || 0);
      const progress = 1 - zone.remaining / zone.total;
      group.children[0].material.opacity = 0.12 + Math.max(0, progress) * 0.22;
      group.children[1].material.opacity = 0.75 + Math.sin(t * 8) * 0.12;
    }
    for (const [id, group] of this.warnings)
      if (!seen.has(id)) {
        this.scene.remove(group);
        group.traverse((m) => {
          m.geometry?.dispose();
          m.material?.dispose();
        });
        this.warnings.delete(id);
      }
  }
  drawParticles(dt) {
    this.particles = this.particles.filter((p) => p.life > 0);
    const dummy = this.particleDummy;
    for (let i = 0; i < 220; i++) {
      const p = this.particles[i];
      if (p) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 8 * dt;
        dummy.position.set(p.x, Math.max(0.04, p.y), p.z);
        dummy.scale.setScalar(p.size * clamp(p.life * 3, 0, 1));
        this.particleMesh.setColorAt(i, new THREE.Color(p.color));
      } else dummy.scale.setScalar(0);
      dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, dummy.matrix);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor)
      this.particleMesh.instanceColor.needsUpdate = true;
  }
  project(x, y, height = 2) {
    const v = new THREE.Vector3(x, height, y).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * innerWidth,
      y: (-v.y * 0.5 + 0.5) * innerHeight,
      visible: v.z < 1,
    };
  }
  minimap(canvas, game, expanded = false) {
    if (!canvas || !game) return;
    const ctx = canvas.getContext("2d"),
      w = (canvas.width = expanded ? 480 : 180),
      h = (canvas.height = w),
      c = w / 2,
      r = w * 0.46,
      p = game.player;
    const range = expanded ? WORLD_RADIUS : 245,
      cx = expanded ? 0 : Math.round(p.x / 200) * 200,
      cy = expanded ? 0 : Math.round(p.y / 200) * 200,
      scale = r / range;
    canvas.mapView = { cx, cy, range, r, w };
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, 6.28);
    ctx.clip();
    ctx.fillStyle = "#15251f";
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8)
      for (let y = 0; y < h; y += 8) {
        const wx = cx + (x - c) / scale,
          wy = cy + (y - c) / scale;
        if (Math.hypot(wx, wy) > WORLD_RADIUS) continue;
        const biome = biomeAt(wx, wy);
        ctx.fillStyle = `#${biome.color.toString(16).padStart(6, "0")}`;
        ctx.globalAlpha = 0.65;
        ctx.fillRect(x, y, 8, 8);
      }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#87a38c22";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 4, 0);
      ctx.lineTo((i * w) / 4, h);
      ctx.moveTo(0, (i * h) / 4);
      ctx.lineTo(w, (i * h) / 4);
      ctx.stroke();
    }
    for (const e of game.entities) {
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
        ctx.fillStyle = "#e5e4cf";
        ctx.fillText(
          `${region.name} · ${region.tier + 1}`,
          c + x * scale,
          c + y * scale,
        );
      }
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
