import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const FLAGSHIP_SPECIES_IDS = new Set([
  "velociraptor",
  "tyrannosaurus",
  "triceratops",
  "spinosaurus",
  "ankylosaurus",
  "stegosaurus",
  "brachiosaurus",
  "compsognathus",
  "carnotaurus",
  "dilophosaurus",
]);

// Normalization multipliers for each model so they match gameplay hitboxes & scales
const MODEL_LENGTHS = {
  compsognathus: 3.5,
  velociraptor: 4.0,
  dilophosaurus: 4.5,
  carnotaurus: 5.5,
  ankylosaurus: 4.4,
  stegosaurus: 5.6,
  triceratops: 5.8,
  spinosaurus: 6.8,
  tyrannosaurus: 6.2,
  brachiosaurus: 6.0,
};

const gltfCache = new Map();
const pendingLoads = new Map();
let gltfLoaderInstance = null;

function getGLTFLoader() {
  if (!gltfLoaderInstance) {
    gltfLoaderInstance = new GLTFLoader();
  }
  return gltfLoaderInstance;
}

/**
 * Preload or retrieve a flagship GLTF asset.
 */
export function getFlagshipGLTF(speciesId, onLoaded) {
  if (typeof window === "undefined" || typeof fetch === "undefined") return;
  if (!FLAGSHIP_SPECIES_IDS.has(speciesId)) return;

  const url = `/assets/models/${speciesId}/${speciesId}.glb`;
  if (gltfCache.has(url)) {
    if (onLoaded) onLoaded(gltfCache.get(url));
    return;
  }

  if (pendingLoads.has(url)) {
    if (onLoaded) pendingLoads.get(url).push(onLoaded);
    return;
  }

  pendingLoads.set(url, onLoaded ? [onLoaded] : []);
  try {
    getGLTFLoader().load(
      url,
      (gltf) => {
        gltfCache.set(url, gltf);
        const callbacks = pendingLoads.get(url) || [];
        pendingLoads.delete(url);
        callbacks.forEach((cb) => {
          try {
            cb(gltf);
          } catch {}
        });
      },
      undefined,
      () => {
        pendingLoads.delete(url);
      },
    );
  } catch {
    pendingLoads.delete(url);
  }
}

/**
 * Attach high-detail Blender 3D model to a creature group if available,
 * seamlessly overriding the procedural placeholder body.
 */
export function tryAttachFlagshipGLB(model, speciesId) {
  if (!model || !FLAGSHIP_SPECIES_IDS.has(speciesId)) return;
  if (typeof window === "undefined" || typeof fetch === "undefined") return;

  const targetSpecies = speciesId;
  getFlagshipGLTF(targetSpecies, (gltf) => {
    // If the model was reused or changed species during download, cancel
    if (!model.userData || model.userData.species?.id !== targetSpecies) return;

    // Clone the glTF scene
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

    // Orientation: Rotate around Y by -90 deg so -Z forward aligns with +X forward
    root.rotation.y = -Math.PI / 2;

    // Compute bounding scale normalization
    const originalLen = MODEL_LENGTHS[targetSpecies] || 5.0;
    const targetLen = (model.userData.species?.size || 1.0) * 2.2;
    const scaleFactor = targetLen / originalLen;
    root.scale.setScalar(scaleFactor);

    // Create wrapper container for procedural animation
    const container = new THREE.Group();
    container.name = `GLB_${targetSpecies}`;
    container.add(root);

    // Clean up any old GLB attachment
    if (model.userData.glbContainer) {
      model.remove(model.userData.glbContainer);
    }

    model.userData.glbContainer = container;
    model.userData.glbRoot = root;
    model.userData.isGLB = true;

    // Hide procedural body meshes
    if (model.userData.body) {
      model.userData.body.visible = false;
    }

    model.add(container);
  });
}

/**
 * Procedural animation for flagship 3D GLB creatures:
 * organically handles spine flex, stride bouncing, breath expansion, and attack strikes.
 */
export function animateFlagshipGLB(model, dt, time, speed, attacking, turn) {
  const d = model.userData;
  const container = d?.glbContainer;
  if (!container) return;

  d.speed = THREE.MathUtils.damp(d.speed || 0, Math.min(1.6, speed), 8, dt);
  const size = d.species?.size || 1.0;
  const strideRate = 2.4 + d.speed * 8.2;
  d.phase = (d.phase || 0) + (dt * strideRate) / Math.sqrt(Math.max(0.7, size));
  d.attackBlend = THREE.MathUtils.damp(
    d.attackBlend || 0,
    attacking ? 1 : 0,
    attacking ? 22 : 9,
    dt,
  );

  const phase = d.phase;
  const stride = d.speed;
  const strike = d.attackBlend;
  const breath = Math.sin(time * 2.2 + (model.id || 0)) * 0.022;

  // Stride bobs, yaw roll, and breathing
  const pelvicBounce = Math.abs(Math.sin(phase)) * 0.042 * stride;
  const lateralRoll = Math.sin(phase) * 0.038 * stride;
  const tailYaw = Math.cos(phase) * 0.032 * stride;

  container.position.x = strike * 0.38 * Math.min(2.2, size);
  container.position.y = -pelvicBounce + breath * 0.4 - strike * 0.12;
  container.position.z = Math.sin(phase) * 0.035 * stride;

  container.rotation.x = THREE.MathUtils.damp(container.rotation.x, -turn * 0.12, 7, dt);
  container.rotation.y = tailYaw;
  container.rotation.z = lateralRoll - strike * 0.24;

  // Gentle breathing expansion
  const breathScale = 1 + breath * 0.4;
  container.scale.set(breathScale, 1 + breath * 0.6, breathScale);
}
