import * as THREE from "three";
import { createDinosaur, animateCreature } from "./creatures.js";
import { tryAttachFlagshipGLB, animateFlagshipGLB } from './flagship-models.js';
import {fitSpecimenCamera,specimenHeadBounds} from './specimen-framing.js';

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
    this.zoom=1;this.faceMode=false;
    this.inspectionControls=document.createElement('div');this.inspectionControls.className='specimen-inspection-controls';
    this.inspectionControls.innerHTML='<button type="button" data-inspect-zoom="out" aria-label="Zoom out">−</button><button type="button" data-inspect-zoom="in" aria-label="Zoom in">+</button><button type="button" data-inspect-face>FACE DETAIL</button><button type="button" data-inspect-reset>FULL BODY</button>';
    canvas.after(this.inspectionControls);
    const zoomBy=amount=>{this.zoom=THREE.MathUtils.clamp(this.zoom*amount,.8,5);this.applyInspection();};
    this.inspectionControls.querySelector('[data-inspect-zoom="out"]').onclick=()=>zoomBy(1/1.3);
    this.inspectionControls.querySelector('[data-inspect-zoom="in"]').onclick=()=>zoomBy(1.3);
    this.inspectionControls.querySelector('[data-inspect-face]').onclick=()=>{this.faceMode=true;this.zoom=3.2;this.applyInspection();};
    this.inspectionControls.querySelector('[data-inspect-reset]').onclick=()=>{this.faceMode=false;this.zoom=1;this.resize();};
    canvas.onwheel=event=>{event.preventDefault();zoomBy(Math.exp(-event.deltaY*.001));};
    canvas.tabIndex=0;
    canvas.setAttribute('aria-label','Dinosaur specimen. Drag to rotate, scroll or use plus and minus to zoom. Press F to inspect the face, zero to reset.');
    canvas.onkeydown=event=>{
      if(['+','=','-','f','F','0'].includes(event.key)){
        event.preventDefault();event.stopPropagation();
        if(event.key==='f'||event.key==='F'){this.faceMode=true;this.zoom=3.2;}
        else if(event.key==='0'){this.faceMode=false;this.zoom=1;}
        else zoomBy(event.key==='-'?1/1.3:1.3);
        this.applyInspection();
      }
    };
    this.setSpecies(species, skin);
    this.resize();
  }
  setSpecies(species, skin = "natural") {
    this.zoom=1;this.faceMode=false;
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
    this.faceAnchor=this.model.userData.flagshipAsset?.surface.getObjectByName('head');
    this.faceCenter=null;
    if(this.faceAnchor){
      const headBox=specimenHeadBounds(this.model);
      if(!headBox.isEmpty()){
        const center=headBox.getCenter(new THREE.Vector3());
        fitSpecimenCamera(this.camera,headBox,{padding:1.08});
        this.faceDistance=this.camera.position.distanceTo(center);
        this.faceCenter=this.faceAnchor.worldToLocal(center);
      }
    }
    const box=fitSpecimenCamera(this.camera,this.model,{orbit:true,padding:1.15});
    this.bodyFocus=box.getCenter(new THREE.Vector3());this.inspectDirection=this.camera.position.clone().sub(this.bodyFocus).normalize();this.inspectDistance=this.camera.position.distanceTo(this.bodyFocus);
    this.applyInspection();
  }
  applyInspection(){
    if(!this.bodyFocus||!this.inspectDirection)return;
    const focus=this.bodyFocus.clone();
    let distance=this.inspectDistance/this.zoom;
    if(this.faceMode&&this.faceAnchor&&this.faceCenter){
      this.model.updateMatrixWorld(true);
      this.faceAnchor.localToWorld(focus.copy(this.faceCenter));
      distance=this.faceDistance*3.2/this.zoom;
    }else if(this.faceMode){
      const head=this.model?.userData.flagshipAsset?.surface.getObjectByName('head')||this.model?.userData.head;
      if(head){this.model.updateMatrixWorld(true);head.getWorldPosition(focus);}
    }
    this.camera.position.copy(focus).addScaledVector(this.inspectDirection,distance);this.camera.lookAt(focus);this.camera.updateMatrixWorld(true);
    this.inspectionControls.querySelector('[data-inspect-face]').setAttribute('aria-pressed',String(this.faceMode));
  }
  render(dt) {
    this.time += dt;
    if (this.model) {
        if (!this.dragging&&!this.quietMotion&&!this.faceMode) this.model.rotation.y += dt * 0.13;
      if (this.model.userData?.isGLB) {
        animateFlagshipGLB(this.model, dt, this.time, 0, false, 0);
      } else if (this.model.userData?.body) {
        animateCreature(this.model, dt, this.time, 0);
      }
    }
    this.applyInspection();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.model?.userData?.dispose?.();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.inspectionControls?.remove();this.canvas.onwheel=null;this.canvas.onkeydown=null;
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
