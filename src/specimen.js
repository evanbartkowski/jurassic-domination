import * as THREE from "three";
import { createDinosaur, animateCreature } from "./creatures.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const FLAGSHIP_MODELS = new Set([
  "velociraptor",
  "tyrannosaurus",
  "triceratops",
  "spinosaurus",
  "ankylosaurus",
  "stegosaurus",
  "brachiosaurus",
]);
const gltfCache = new Map();
let gltfLoaderInstance = null;

function getGLTFLoader() {
  if (!gltfLoaderInstance) gltfLoaderInstance = new GLTFLoader();
  return gltfLoaderInstance;
}

export class SpecimenViewer {
  constructor(canvas, species, skin = "natural") {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setClearColor(0, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xd9ebe3, 0x493d36, 2.6));
    const sun = new THREE.DirectionalLight(0xffe0ad, 3.4);
    sun.position.set(4, 8, 6);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8cc8e1, 2.2);
    rim.position.set(-4, 3, -4);
    this.scene.add(rim);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 150);
    this.dragging = false;
    this.lastX = 0;
    this.time = 0;
    this.loadToken = 0;
    canvas.onpointerdown = (e) => {
      this.dragging = true;
      this.lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointermove = (e) => {
      if (this.dragging && this.model) {
        this.model.rotation.y += (e.clientX - this.lastX) * 0.012;
        this.lastX = e.clientX;
      }
    };
    canvas.onpointerup = () => (this.dragging = false);
    canvas.onpointercancel = () => (this.dragging = false);
    this.setSpecies(species, skin);
    this.resize();
  }
  setSpecies(species, skin = "natural") {
    const token = ++this.loadToken;
    if (this.model) {
      this.scene.remove(this.model);
      this.model.userData?.dispose?.();
    }
    // Immediately display the enhanced procedural creature
    this.model = createDinosaur(species, true, skin);
    this.model.rotation.y = -0.55;
    this.scene.add(this.model);
    this.speciesId = species.id;
    this.skin = skin;
    this.isGLB = false;
    this.resize();

    // If this is one of our flagship 3D Blender models, load the high-detail bespoke asset
    if (
      FLAGSHIP_MODELS.has(species.id) &&
      typeof window !== "undefined" &&
      typeof fetch !== "undefined"
    ) {
      const url = `/assets/models/${species.id}/${species.id}.glb`;
      const onGltfLoaded = (gltf) => {
        if (this.loadToken !== token || this.speciesId !== species.id) return;
        const root = gltf.scene.clone(true);
        root.traverse((obj) => {
          if (
            obj.name?.toLowerCase().includes("pedestal") ||
            obj.name?.toLowerCase().includes("camera") ||
            obj.name?.toLowerCase().includes("light")
          ) {
            obj.visible = false;
          }
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        if (this.model) {
          this.scene.remove(this.model);
          this.model.userData?.dispose?.();
        }
        this.model = root;
        this.isGLB = true;
        this.model.rotation.y = -0.55;
        this.scene.add(this.model);
        this.resize();
      };

      if (gltfCache.has(url)) {
        onGltfLoaded(gltfCache.get(url));
      } else {
        try {
          getGLTFLoader().load(
            url,
            (gltf) => {
              gltfCache.set(url, gltf);
              onGltfLoaded(gltf);
            },
            undefined,
            () => {
              // Graceful fallback to procedural model on load error
            },
          );
        } catch {}
      }
    }
  }
  resize() {
    const w = Math.max(1, this.canvas.clientWidth),
      h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.model) return;
    const box = new THREE.Box3().setFromObject(this.model),
      center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.y, size.x / this.camera.aspect, size.z, 0.5),
      distance = (span / (2 * Math.tan((35 * Math.PI) / 360))) * 1.35;
    this.camera.position
      .copy(center)
      .add(new THREE.Vector3(distance * 0.37, distance * 0.25, distance));
    this.camera.lookAt(center);
  }
  render(dt) {
    this.time += dt;
    if (this.model) {
      if (!this.dragging) this.model.rotation.y += dt * 0.13;
      if (!this.isGLB && this.model.userData?.body) {
        animateCreature(this.model, dt, this.time, 0);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.model?.userData?.dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.onpointerdown =
      this.canvas.onpointermove =
      this.canvas.onpointerup =
      this.canvas.onpointercancel =
        null;
  }
}
