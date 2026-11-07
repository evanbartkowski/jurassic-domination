import * as THREE from "three";
import { createDecoration, createPet } from "./collection-art.js";
import { animateCreature } from "./creatures.js";
import { CATALOG, PETS } from "./collection-data.js";
import { seeded } from "./world-data.js";
import { placementValid } from "./collections.js";

export class IslandScene {
  constructor(canvas, profile, callbacks, settings) {
    this.canvas = canvas;
    this.profile = profile;
    this.callbacks = callbacks;
    this.settings = settings;
    this.models = new Map();
    this.buildMode = false;
    this.selected = null;
    this.tool = null;
    this.time = 0;
    this.drag = null;
    this.ghost = null;
    this.ghostMaterials = [];
    this.azimuth = 0.7;
    this.polar = 0.77;
    this.distance = 91;
    this.target = new THREE.Vector3();
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.32);
    this.hit = new THREE.Vector3();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, settings.quality === "low" ? 1 : 1.6),
    );
    this.renderer.setClearColor(0x547e87);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.enabled = settings.quality !== "low";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x769aa0, 135, 290);
    this.scene.add(new THREE.HemisphereLight(0xe1efdd, 0x466573, 2.2));
    this.sun = new THREE.DirectionalLight(0xffdbab, 3.5);
    this.sun.position.set(-30, 70, 25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -50,
      right: 50,
      top: 50,
      bottom: -50,
      near: 1,
      far: 140,
    });
    this.sun.shadow.normalBias = 0.1;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    this.makeIsland();
    this.sync(profile);
    this.resize();
    this.bind();
    this.stateChanged();
  }
  makeIsland() {
    this.staticOwned = [];
    const add = (geometry, material, position, rotation) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      if (rotation) mesh.rotation.set(...rotation);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.staticOwned.push(mesh);
      return mesh;
    };
    const sand = new THREE.MeshStandardMaterial({
      color: 0xc6bd93,
      roughness: 1,
    });
    const earth = new THREE.MeshStandardMaterial({
      color: 0x536b45,
      roughness: 1,
    });
    add(new THREE.CylinderGeometry(40, 36, 2.6, 100), sand, [0, -1.05, 0]);
    add(new THREE.CylinderGeometry(34, 38, 0.45, 100), earth, [0, 0.08, 0]);
    const groundGeo = new THREE.CircleGeometry(34, 144);
    const colors = [];
    const v = groundGeo.attributes.position;
    for (let i = 0; i < v.count; i++) {
      const x = v.getX(i),
        z = v.getY(i);
      const c = new THREE.Color(0x64824f).lerp(
        new THREE.Color(0x9fba70),
        0.35 + 0.25 * Math.sin(x * 0.17) * Math.cos(z * 0.22),
      );
      colors.push(c.r, c.g, c.b);
    }
    groundGeo.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3),
    );
    this.ground = add(
      groundGeo,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 1,
      }),
      [0, 0.32, 0],
      [-Math.PI / 2, 0, 0],
    );
    const texture = document.createElement("canvas");
    texture.width = texture.height = 256;
    const c = texture.getContext("2d"),
      random = seeded(7459);
    c.fillStyle = "#c6cbb9";
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 7000; i++) {
      const x = random() * 256,
        y = random() * 256;
      c.fillStyle = i % 3 ? "#667b4d15" : "#d7cf9d22";
      c.fillRect(x, y, 1, 2);
    }
    const map = new THREE.CanvasTexture(texture);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(5, 5);
    map.anisotropy = 8;
    map.colorSpace = THREE.SRGBColorSpace;
    this.ground.material.map = map;
    this.ground.material.needsUpdate = true;
    this.groundMap = map;
    this.ocean = add(
      new THREE.PlaneGeometry(600, 600, 48, 48),
      new THREE.MeshStandardMaterial({
        color: 0x4b9da8,
        metalness: 0.23,
        roughness: 0.28,
      }),
      [0, -0.3, 0],
      [-Math.PI / 2, 0, 0],
    );
    this.grid = new THREE.GridHelper(64, 64, 0xc5d1ab, 0x9eaf8d);
    this.grid.position.y = 0.34;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.22;
    this.grid.material.depthWrite = false;
    this.scene.add(this.grid);
    this.selection = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.4, 48),
      new THREE.MeshBasicMaterial({
        color: 0xf1d18f,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.selection.rotation.x = -Math.PI / 2;
    this.selection.visible = false;
    this.scene.add(this.selection);
    this.fixed = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2,
        r = 35 + (i % 3) * 0.7;
      const obj = createDecoration(i % 3 ? "rocks" : "palm");
      obj.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r);
      obj.rotation.y = a;
      obj.scale.setScalar(i % 3 ? 0.85 : 1.2);
      this.scene.add(obj);
      this.fixed.push(obj);
    }
    // Lush, uneven coastal planting frames a clear usable lawn.
    for (let i = 0; i < 75; i++) {
      const a = i * 2.39996,
        r = 32.5 + (i % 5) * 0.7;
      const obj = createDecoration(
        i % 11 === 0
          ? "tree"
          : i % 5 === 0
            ? "palm"
            : i % 3 === 0
              ? "flowers"
              : "fern",
      );
      obj.position.set(Math.cos(a) * r, 0.32, Math.sin(a) * r);
      obj.rotation.y = a;
      obj.scale.setScalar(0.65 + (i % 4) * 0.18);
      this.scene.add(obj);
      this.fixed.push(obj);
    }
    for (let i = 0; i < 7; i++) {
      const a = i * 1.3;
      const hill = add(
        new THREE.SphereGeometry(1, 32, 20),
        new THREE.MeshStandardMaterial({ color: 0x4c7066, roughness: 1 }),
        [Math.cos(a) * 170, -2, Math.sin(a) * 170],
      );
      hill.scale.set(24 + i * 2, 9 + i * 2, 18 + i);
    }
    this.ripples = [];
    for (let i = 0; i < 3; i++) {
      const ripple = add(
        new THREE.RingGeometry(40 + i * 1.5, 40.16 + i * 1.5, 100),
        new THREE.MeshBasicMaterial({
          color: 0xc6e4df,
          transparent: true,
          opacity: 0.23,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
        [0, -0.27 + i * 0.005, 0],
        [-Math.PI / 2, 0, 0],
      );
      this.ripples.push(ripple);
    }
  }
  bind() {
    this.canvas.oncontextmenu = (e) => e.preventDefault();
    this.canvas.onpointerdown = (e) => {
      this.drag = {
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        button: e.button,
        moved: false,
      };
      this.canvas.setPointerCapture(e.pointerId);
    };
    this.canvas.onpointermove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      if (this.drag) {
        const dx = e.clientX - this.drag.lastX,
          dy = e.clientY - this.drag.lastY;
        if (Math.hypot(e.clientX - this.drag.x, e.clientY - this.drag.y) > 5)
          this.drag.moved = true;
        if (this.drag.moved) {
          if (this.drag.button === 2) {
            this.target.x -= dx * this.distance * 0.001;
            this.target.z -= dy * this.distance * 0.001;
          } else {
            this.azimuth -= dx * 0.006;
            this.polar = Math.max(
              0.35,
              Math.min(1.35, this.polar + dy * 0.006),
            );
          }
        }
        this.drag.lastX = e.clientX;
        this.drag.lastY = e.clientY;
      }
      this.updateGhost();
    };
    this.canvas.onpointerup = (e) => {
      const clicked = this.drag && !this.drag.moved && this.drag.button === 0;
      this.drag = null;
      if (clicked) this.click();
    };
    this.canvas.onpointercancel = () => (this.drag = null);
    this.canvas.onwheel = (e) => {
      e.preventDefault();
      this.distance = Math.max(
        32,
        Math.min(155, this.distance + e.deltaY * 0.055),
      );
    };
  }
  resize() {
    const w = Math.max(1, this.canvas.clientWidth),
      h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.updateCamera();
  }
  updateCamera() {
    this.target.x = Math.max(-20, Math.min(20, this.target.x));
    this.target.z = Math.max(-20, Math.min(20, this.target.z));
    this.camera.position.set(
      this.target.x +
        Math.sin(this.azimuth) * Math.sin(this.polar) * this.distance,
      Math.cos(this.polar) * this.distance,
      this.target.z +
        Math.cos(this.azimuth) * Math.sin(this.polar) * this.distance,
    );
    this.camera.lookAt(this.target);
  }
  stateChanged() {
    this.callbacks.state?.({
      buildMode: this.buildMode,
      selected: this.selected,
      tool: this.tool ? { ...this.tool } : null,
    });
  }
  sync(profile) {
    this.profile = profile;
    const seen = new Set();
    this.grid.visible = this.buildMode && profile.island.grid;
    for (const p of profile.island.placements) {
      seen.add(p.id);
      let model = this.models.get(p.id);
      if (!model) {
        model =
          p.kind === "pet" ? createPet(p.itemId) : createDecoration(p.itemId);
        model.userData.placementId = p.id;
        model.userData.home = { x: p.x, y: p.y };
        model.userData.wander = { x: p.x, y: p.y, timer: 0 };
        this.models.set(p.id, model);
        this.scene.add(model);
      }
      const old = model.userData.home;
      if (old.x !== p.x || old.y !== p.y) model.position.set(p.x, 0.34, p.y);
      model.userData.home = { x: p.x, y: p.y };
      if (p.kind === "decoration" || model.position.lengthSq() === 0) {
        model.position.set(p.x, 0.34, p.y);
        model.rotation.y = p.rotation;
      }
    }
    for (const [id, model] of this.models)
      if (!seen.has(id)) {
        this.scene.remove(model);
        model.userData.dispose();
        this.models.delete(id);
      }
    if (this.selected && !seen.has(this.selected)) this.selected = null;
    this.stateChanged();
  }
  clearGhost() {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.ghost.userData.dispose();
      this.ghost = null;
    }
    this.ghostMaterials.forEach((m) => m.dispose());
    this.ghostMaterials = [];
  }
  setBuildMode(enabled) {
    this.buildMode = enabled;
    this.cancelTool();
    this.grid.visible = enabled && this.profile.island.grid;
    this.canvas
      .closest(".sanctuary-shell")
      ?.classList.toggle("building", enabled);
    this.stateChanged();
  }
  showAffection() {
    const model = this.models.get(this.selected);
    if (model) model.userData.affection = 3;
  }
  setTool(kind, id, movingId = null) {
    if (!this.buildMode) return;
    this.cancelTool();
    const item = CATALOG[`${kind}:${id}`];
    if (!item) return;
    const current = this.profile.island.placements.find(
      (a) => a.id === movingId,
    );
    this.tool = {
      kind,
      id,
      movingId,
      x: current?.x || 0,
      y: current?.y || 0,
      rotation: current?.rotation || 0,
    };
    this.ghost = kind === "pet" ? createPet(id) : createDecoration(id);
    this.ghost.traverse((m) => {
      if (m.isMesh) {
        m.material = m.material.clone();
        m.material.transparent = true;
        m.material.opacity = 0.5;
        m.material.depthWrite = false;
        this.ghostMaterials.push(m.material);
      }
    });
    this.scene.add(this.ghost);
    if (movingId && this.models.has(movingId))
      this.models.get(movingId).visible = false;
    this.updateGhost(false);
    this.stateChanged();
  }
  updateGhost(fromPointer = true) {
    if (!this.tool || !this.ghost) return;
    if (fromPointer) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      if (this.raycaster.ray.intersectPlane(this.plane, this.hit)) {
        const snap = this.profile.island.grid ? 0.5 : 0.1;
        this.tool.x = Math.round(this.hit.x / snap) * snap;
        this.tool.y = Math.round(this.hit.z / snap) * snap;
      }
    }
    this.ghost.position.set(this.tool.x, 0.34, this.tool.y);
    this.ghost.rotation.y = this.tool.rotation;
    const valid = placementValid(
      this.profile,
      this.tool.kind,
      this.tool.id,
      this.tool.x,
      this.tool.y,
      this.tool.movingId,
    );
    this.selection.visible = true;
    this.selection.position.set(this.tool.x, 0.38, this.tool.y);
    this.selection.scale.setScalar(
      CATALOG[`${this.tool.kind}:${this.tool.id}`]?.footprint || 1,
    );
    this.selection.material.color.set(valid.ok ? 0xcbe6aa : 0xee8c78);
    this.callbacks.hint?.(
      valid.ok
        ? "Click the island or press Enter to place. R rotates. Escape cancels."
        : valid.reason,
    );
  }
  commit() {
    if (!this.tool) return;
    const t = this.tool;
    const result = this.callbacks.change?.(t.movingId ? "move" : "place", {
      id: t.movingId,
      kind: t.kind,
      itemId: t.id,
      x: t.x,
      y: t.y,
      rotation: t.rotation,
    });
    if (result?.ok) {
      this.cancelTool();
      this.selected = result.placement.id;
      this.sync(this.profile);
    } else
      this.callbacks.hint?.(
        result?.reason || "This placement is not available.",
      );
  }
  click() {
    if (this.tool) {
      this.updateGhost();
      this.commit();
      return;
    }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      [...this.models.values()],
      true,
    );
    this.selected = null;
    if (hits[0]) {
      let obj = hits[0].object;
      while (obj && !obj.userData.placementId) obj = obj.parent;
      this.selected = obj?.userData.placementId || null;
    }
    this.stateChanged();
  }
  cancelTool() {
    const active = !!this.tool;
    if (this.tool?.movingId && this.models.has(this.tool.movingId))
      this.models.get(this.tool.movingId).visible = true;
    this.tool = null;
    this.clearGhost();
    this.selection.visible = false;
    this.callbacks.hint?.("A safe home for your permanent companions.");
    this.stateChanged();
    return active;
  }
  moveSelected() {
    const p = this.profile.island.placements.find(
      (a) => a.id === this.selected,
    );
    if (p) this.setTool(p.kind, p.itemId, p.id);
  }
  rotate(direction = 1) {
    if (!this.buildMode) return;
    if (this.tool) {
      this.tool.rotation += (direction * Math.PI) / 4;
      this.updateGhost(false);
    } else {
      const p = this.profile.island.placements.find(
        (a) => a.id === this.selected,
      );
      if (p)
        this.callbacks.change?.("move", {
          id: p.id,
          x: p.x,
          y: p.y,
          rotation: p.rotation + (direction * Math.PI) / 4,
        });
    }
  }
  storeSelected() {
    if (!this.buildMode) return;
    if (this.selected) this.callbacks.change?.("store", { id: this.selected });
  }
  handleKey(event) {
    const key = event.code;
    if (key === "Escape") return this.cancelTool();
    if (key === "KeyR") {
      this.rotate();
      event.preventDefault();
      return true;
    }
    if (key === "Delete" || key === "Backspace") {
      this.storeSelected();
      event.preventDefault();
      return true;
    }
    if (key === "Enter" && this.tool) {
      this.commit();
      event.preventDefault();
      return true;
    }
    const x = ["KeyD", "ArrowRight"].includes(key)
        ? 1
        : ["KeyA", "ArrowLeft"].includes(key)
          ? -1
          : 0,
      y = ["KeyS", "ArrowDown"].includes(key)
        ? 1
        : ["KeyW", "ArrowUp"].includes(key)
          ? -1
          : 0;
    if (x || y) {
      event.preventDefault();
      if (this.tool) {
        this.tool.x += x * 0.5;
        this.tool.y += y * 0.5;
        this.updateGhost(false);
      } else {
        this.target.x += x * 2;
        this.target.z += y * 2;
      }
      return true;
    }
    return false;
  }
  render(dt) {
    this.time += dt;
    this.updateCamera();
    for (const p of this.profile.island.placements) {
      const model = this.models.get(p.id);
      if (!model || !model.visible) continue;
      if (p.kind === "pet") {
        const w = model.userData.wander;
        w.timer -= dt;
        if (w.timer <= 0) {
          const n = Number(p.id.slice(1)),
            a = this.time * 0.37 + n * 2.4;
          w.state = ["wander", "graze", "rest", "look"][
            Math.floor(this.time / 5 + n) % 4
          ];
          const radius = 3 + (n % 4);
          w.x = p.x + Math.cos(a) * radius;
          w.y = p.y + Math.sin(a) * radius;
          const r = Math.hypot(w.x, w.y);
          if (r > 30) {
            w.x *= 30 / r;
            w.y *= 30 / r;
          }
          w.timer = 3 + (n % 4);
        }
        const dx = w.x - model.position.x,
          dz = w.y - model.position.z,
          d = Math.hypot(dx, dz),
          speed = d > 0.12 && w.state === "wander" ? 0.5 : 0;
        if (speed > 0) {
          let avoidanceX = 0,
            avoidanceZ = 0;
          for (const [id, other] of this.models) {
            if (id === p.id) continue;
            const dx = model.position.x - other.position.x,
              dz = model.position.z - other.position.z,
              near = Math.hypot(dx, dz);
            if (near < 2.8 && near > 0.01) {
              avoidanceX += (dx / near) * (2.8 - near);
              avoidanceZ += (dz / near) * (2.8 - near);
            }
          }
          model.position.x += avoidanceX * dt * 0.7;
          model.position.z += avoidanceZ * dt * 0.7;
          const step = Math.min(d, dt * 1.1);
          model.position.x += (dx / d) * step;
          model.position.z += (dz / d) * step;
          const target = -Math.atan2(dz, dx),
            diff = Math.atan2(
              Math.sin(target - model.rotation.y),
              Math.cos(target - model.rotation.y),
            );
          model.rotation.y += diff * (1 - Math.exp(-dt * 4));
        }
        animateCreature(model, dt, this.time, speed);
        const head = model.userData.head;
        if (head) {
          if (w.state === "graze")
            head.rotation.z += 0.18 + Math.sin(this.time * 2) * 0.06;
          if (w.state === "look")
            head.rotation.y = Math.sin(this.time * 0.8) * 0.25;
        }
        if (w.state === "rest") {
          model.userData.head.rotation.z += 0.1;
          model.userData.body.rotation.z += 0.035;
        }
        if ((model.userData.affection || 0) > 0) {
          model.userData.affection -= dt;
          model.position.y = 0.34 + Math.abs(Math.sin(this.time * 7)) * 0.18;
        } else model.position.y = 0.34;
      }
    }
    if (!this.tool && this.selected) {
      const model = this.models.get(this.selected),
        p = this.profile.island.placements.find((a) => a.id === this.selected);
      this.selection.visible = !!model;
      if (model) {
        this.selection.position.set(model.position.x, 0.38, model.position.z);
        this.selection.scale.setScalar(
          CATALOG[`${p.kind}:${p.itemId}`]?.footprint || 1,
        );
        this.selection.material.color.setHex(0xf1d18f);
      }
    } else if (!this.tool) this.selection.visible = false;
    this.ripples.forEach((m, i) => {
      m.material.opacity = 0.16 + Math.sin(this.time * 0.8 + i) * 0.08;
      m.scale.setScalar(1 + Math.sin(this.time * 0.35 + i) * 0.014);
    });
    const sea = this.ocean.geometry.attributes.position;
    for (let i = 0; i < sea.count; i++)
      sea.setZ(
        i,
        Math.sin(sea.getX(i) * 0.045 + this.time * 0.5) * 0.12 +
          Math.cos(sea.getY(i) * 0.07 + this.time * 0.35) * 0.09,
      );
    sea.needsUpdate = true;
    this.ocean.material.roughness = 0.28 + Math.sin(this.time * 0.4) * 0.035;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.clearGhost();
    for (const m of this.models.values()) m.userData.dispose();
    for (const m of this.fixed) m.userData.dispose();
    for (const m of this.staticOwned) {
      m.geometry.dispose();
      m.material.dispose();
    }
    this.grid.geometry.dispose();
    this.grid.material.dispose();
    this.selection.geometry.dispose();
    this.selection.material.dispose();
    this.groundMap.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.onpointerdown =
      this.canvas.onpointermove =
      this.canvas.onpointerup =
      this.canvas.onpointercancel =
      this.canvas.onwheel =
      this.canvas.oncontextmenu =
        null;
  }
}
