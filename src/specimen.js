import * as THREE from "three";
import { createDinosaur, animateCreature } from "./creatures.js";
import { tryAttachFlagshipGLB, animateFlagshipGLB } from './flagship-models.js';
import {fitSpecimenCamera} from './specimen-framing.js';

export class SpecimenViewer {
  constructor(canvas, species, skin = "natural",settings={}) {
    this.canvas = canvas;
    this.settings=settings;this.quietMotion=settings.reducedMotion||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio((settings.renderScale??1)*Math.min(devicePixelRatio,settings.quality==='low'?1:1.5));
    this.renderer.setClearColor(0, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xc8dce0, 0x493d36, 1.7));
    const sun = new THREE.DirectionalLight(0xffe0ad, 3.4);
    sun.position.set(4, 8, 6);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8cc8e1, 1.3);
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
    this.model.userData.onAssetReady=()=>{if(this.loadToken===token)this.resize();};
    this.model.rotation.y = -0.55;
    this.scene.add(this.model);
    this.speciesId = species.id;
    this.skin = skin;
    this.isGLB = false;
    this.resize();

    tryAttachFlagshipGLB(this.model, species.id);
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth),
      h = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.model) return;
    fitSpecimenCamera(this.camera,this.model,{orbit:true,padding:1.15});
  }
  render(dt) {
    this.time += dt;
    if (this.model) {
        if (!this.dragging&&!this.quietMotion) this.model.rotation.y += dt * 0.13;
      if (this.model.userData?.isGLB) {
        animateFlagshipGLB(this.model, dt, this.time, 0, false, 0);
      } else if (this.model.userData?.body) {
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

  configure(settings){
    this.settings=settings;this.quietMotion=!!settings.reducedMotion;
    const ratio=(settings.renderScale??1)*Math.min(devicePixelRatio,settings.quality==='low'?1:1.5);
    if(this.renderer.getPixelRatio()!==ratio){this.renderer.setPixelRatio(ratio);this.resize();}
  }
}
