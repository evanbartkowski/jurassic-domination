import * as THREE from "three";
import { createDinosaur, animateCreature } from "./creatures.js";

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
    this.renderer.toneMappingExposure = 1.2;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xd9ebe3, 0x493d36, 2.6));
    const sun = new THREE.DirectionalLight(0xffe0ad, 3.3);
    sun.position.set(4, 8, 6);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8cc8e1, 2);
    rim.position.set(-4, 3, -4);
    this.scene.add(rim);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 150);
    this.dragging = false;
    this.lastX = 0;
    this.time = 0;
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
    if (this.model) {
      this.scene.remove(this.model);
      this.model.userData.dispose();
    }
    this.model = createDinosaur(species, true, skin);
    this.model.rotation.y = -0.55;
    this.scene.add(this.model);
    this.speciesId = species.id;
    this.skin = skin;
    this.resize();
  }
  resize() {
    const w = Math.max(1, this.canvas.clientWidth),
      h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const box = new THREE.Box3().setFromObject(this.model),
      center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.y, size.x / this.camera.aspect, size.z),
      distance = (span / (2 * Math.tan((35 * Math.PI) / 360))) * 1.3;
    this.camera.position
      .copy(center)
      .add(new THREE.Vector3(distance * 0.37, distance * 0.25, distance));
    this.camera.lookAt(center);
  }
  render(dt) {
    this.time += dt;
    if (!this.dragging) this.model.rotation.y += dt * 0.13;
    animateCreature(this.model, dt, this.time, 0);
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.model?.userData.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.onpointerdown =
      this.canvas.onpointermove =
      this.canvas.onpointerup =
      this.canvas.onpointercancel =
        null;
  }
}
