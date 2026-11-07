import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createDinosaur, animateCreature } from "./creatures.js";
import { SPECIES_BY_ID } from "./data.js";
import { COSMETICS, DECORATIONS, PETS } from "./collection-data.js";
import { SpecimenViewer } from "./specimen.js";
const ball = new THREE.SphereGeometry(1, 14, 10),
  box = new THREE.BoxGeometry(1, 1, 1),
  cone = new THREE.ConeGeometry(1, 1, 9),
  cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const shared = new Set([ball, box, cone, cylinder]),
  materials = new Map();
function mat(color, glow = false) {
  const key = `${color}:${glow}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.77,
        metalness: glow ? 0.16 : 0.02,
        emissive: glow ? color : 0,
        emissiveIntensity: glow ? 0.4 : 0,
      }),
    );
  return materials.get(key);
}
function piece(parent, geo, color, p, s, r, glow = false) {
  const m = new THREE.Mesh(geo, mat(color, glow));
  m.position.set(...p);
  m.scale.set(...s);
  if (r) m.rotation.set(...r);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function finalize(root) {
  const owned = new Set(),
    buckets = new Map();
  root.updateMatrixWorld(true);
  root.traverse((m) => {
    if (!m.isMesh) return;
    if (!shared.has(m.geometry)) owned.add(m.geometry);
    let g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    if (g.index) {
      const old = g;
      g = g.toNonIndexed();
      old.dispose();
    }
    const list = buckets.get(m.material) || [];
    list.push(g);
    buckets.set(m.material, list);
  });
  root.clear();
  for (const [material, list] of buckets) {
    const geometry = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!geometry) continue;
    owned.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  root.userData.dispose = () => owned.forEach((g) => g.dispose());
  return root;
}
export function createCosmetic(id) {
  const item = COSMETICS.find((c) => c.id === id),
    root = new THREE.Group();
  if (!item) {
    root.userData.dispose = () => {};
    return root;
  }
  const c = item.color;
  if (item.style === "crown") {
    piece(
      root,
      new THREE.TorusGeometry(0.33, 0.045, 6, 24),
      c,
      [0, 0.12, 0],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      piece(
        root,
        cone,
        c,
        [Math.cos(a) * 0.29, 0.25, Math.sin(a) * 0.29],
        [0.065, i % 2 ? 0.25 : 0.35, 0.065],
      );
      if (i % 2 === 0)
        piece(
          root,
          ball,
          item.id === "royal-crown" ? 0xa55e64 : 0xe9dfac,
          [Math.cos(a) * 0.3, 0.18, Math.sin(a) * 0.3],
          [0.05, 0.06, 0.05],
          null,
          true,
        );
    }
  } else if (item.style === "halo")
    piece(
      root,
      new THREE.TorusGeometry(0.47, 0.035, 8, 32),
      c,
      [0, 0.6, 0],
      [1, 1, 1],
      [Math.PI / 2, 0.1, 0.1],
      true,
    );
  else if (item.style === "hat") {
    piece(root, cylinder, c, [0, 0.1, 0], [0.49, 0.065, 0.43]);
    piece(root, cylinder, c, [0, 0.27, 0], [0.28, 0.3, 0.27]);
    piece(root, cylinder, 0x746048, [0, 0.21, 0], [0.29, 0.07, 0.28]);
  } else
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283;
      piece(
        root,
        ball,
        c,
        [Math.cos(a) * 0.34, 0.09, Math.sin(a) * 0.3],
        [0.15, 0.045, 0.075],
        [0, -a, 0.25],
      );
    }
  root.position.y = 0.44;
  root.position.x = -0.04;
  // Merge in local coordinates before the attachment offset is applied.
  const pos = root.position.clone();
  root.position.set(0, 0, 0);
  finalize(root);
  root.position.copy(pos);
  return root;
}
export function applyCosmetic(model, id = "none") {
  const d = model.userData;
  if (d.cosmeticId === id) return;
  if (d.cosmetic) {
    d.head.remove(d.cosmetic);
    d.cosmetic.userData.dispose();
  }
  d.baseDispose ||= d.dispose;
  d.cosmeticId = id;
  d.cosmetic = null;
  if (id !== "none") {
    d.cosmetic = createCosmetic(id);
    d.head.add(d.cosmetic);
  }
  d.dispose = () => {
    d.cosmetic?.userData.dispose();
    d.baseDispose();
  };
}
export function createPet(id) {
  const pet = PETS.find((p) => p.id === id) || PETS[0],
    s = SPECIES_BY_ID[pet.speciesId];
  const root = createDinosaur({ ...s, color: pet.color }, true);
  const dimensions = new THREE.Box3()
      .setFromObject(root)
      .getSize(new THREE.Vector3()),
    scale =
      (pet.rarity === "legendary" ? 4.2 : 3.5) /
      Math.max(dimensions.x, dimensions.y, dimensions.z);
  root.scale.multiplyScalar(scale);
  root.userData.baseScale = root.scale.x;
  root.userData.petId = pet.id;
  return root;
}
export function createDecoration(id) {
  const item = DECORATIONS.find((d) => d.id === id) || DECORATIONS[0],
    root = new THREE.Group(),
    c = item.color;
  const ring = (radius, tube, y, color = c) =>
    piece(
      root,
      new THREE.TorusGeometry(radius, tube, 6, 32),
      color,
      [0, y, 0],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );
  if (item.style === "fern" || item.style === "flowers") {
    for (let j = 0; j < 5; j++) {
      const cx = Math.cos(j * 2.4) * 0.45,
        cz = Math.sin(j * 2.4) * 0.45;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * 6.28;
        piece(
          root,
          ball,
          0x65925d,
          [cx + Math.cos(a) * 0.22, 0.23, cz + Math.sin(a) * 0.22],
          [0.3, 0.06, 0.1],
          [0, -a, 0.2],
        );
      }
      if (item.style === "flowers") {
        piece(root, cylinder, 0x6f955e, [cx, 0.35, cz], [0.02, 0.6, 0.02]);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * 6.28;
          piece(
            root,
            ball,
            c,
            [cx + Math.cos(a) * 0.11, 0.64, cz + Math.sin(a) * 0.11],
            [0.14, 0.05, 0.1],
            [0, -a, 0],
          );
        }
        piece(root, ball, 0xe7d084, [cx, 0.67, cz], [0.07, 0.045, 0.07]);
      }
    }
  } else if (item.style === "palm" || item.style === "tree") {
    piece(root, cylinder, 0x8d7453, [0, 2, 0], [0.19, 4, 0.24], [0, 0, -0.08]);
    if (item.style === "palm")
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * 6.28;
        piece(
          root,
          ball,
          c,
          [Math.cos(a) * 1.03, 4.1, Math.sin(a) * 1.03],
          [1.45, 0.11, 0.27],
          [0, -a, 0.13],
        );
      }
    else
      for (let i = 0; i < 8; i++) {
        const a = i * 2.4;
        piece(
          root,
          ball,
          c,
          [Math.cos(a) * 1.15, 3.9 + (i % 3) * 0.3, Math.sin(a) * 1.15],
          [1.4, 0.75, 1.3],
        );
        for (let j = 0; j < 3; j++)
          piece(
            root,
            ball,
            0xf0e0e6,
            [Math.cos(a) * (1.5 + j * 0.1), 4 + j * 0.18, Math.sin(a) * 1.4],
            [0.12, 0.1, 0.12],
          );
      }
  } else if (item.style === "rocks") {
    for (let i = 0; i < 5; i++)
      piece(
        root,
        new THREE.DodecahedronGeometry(1, 0),
        c,
        [Math.cos(i * 2.4) * 0.6, 0.3, Math.sin(i * 2.4) * 0.6],
        [0.65 + (i % 2) * 0.25, 0.45, 0.6],
        [0.2, i, 0],
      );
  } else if (item.style === "nest") {
    ring(0.85, 0.14, 0.12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.28;
      piece(
        root,
        box,
        0xa4865f,
        [Math.cos(a) * 0.72, 0.17, Math.sin(a) * 0.72],
        [0.6, 0.06, 0.08],
        [0, -a + 0.5, 0],
      );
    }
    for (let i = 0; i < 3; i++)
      piece(
        root,
        ball,
        0xe3d5ae,
        [(i - 1) * 0.3, 0.37, 0.04],
        [0.19, 0.28, 0.19],
      );
  } else if (item.style === "lantern") {
    piece(root, cylinder, 0x817259, [0, 1.1, 0], [0.07, 2.2, 0.07]);
    piece(root, box, 0x736550, [0.3, 2.12, 0], [0.65, 0.06, 0.06]);
    piece(root, ball, c, [0.57, 1.77, 0], [0.23, 0.3, 0.23], null, true);
    piece(root, cone, 0x8e7759, [0.57, 2.05, 0], [0.33, 0.24, 0.33]);
  } else if (item.style === "pond") {
    piece(root, cylinder, 0x8a9b84, [0, 0.06, 0], [2.1, 0.12, 1.6]);
    piece(root, cylinder, 0x6fa7a9, [0, 0.15, 0], [1.9, 0.06, 1.43]);
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4;
      piece(
        root,
        ball,
        0x84ac77,
        [Math.cos(a) * 1.3, 0.21, Math.sin(a)],
        [0.3, 0.03, 0.24],
      );
      piece(
        root,
        ball,
        0xe6c9d2,
        [Math.cos(a) * 1.3, 0.28, Math.sin(a)],
        [0.1, 0.1, 0.1],
      );
    }
  } else if (item.style === "flag") {
    piece(root, cylinder, 0xbfa878, [0, 1.7, 0], [0.055, 3.4, 0.055]);
    piece(root, cone, 0xe7c67e, [0, 3.53, 0], [0.12, 0.3, 0.12]);
    piece(root, box, c, [0.55, 2.7, 0], [1, 0.8, 0.045], [0, 0.05, -0.08]);
    piece(root, ball, 0xe6d9b0, [0.55, 2.7, 0.035], [0.12, 0.2, 0.015]);
  } else if (item.style === "crystal" || item.style === "obelisk") {
    const count = item.style === "obelisk" ? 1 : 5;
    for (let i = 0; i < count; i++) {
      const h = item.style === "obelisk" ? 5 : 1.5 + (i % 3) * 0.7;
      piece(
        root,
        new THREE.OctahedronGeometry(1),
        c,
        [(i - 2) * 0.28 * (count > 1 ? 1 : 0), h / 2, Math.sin(i) * 0.3],
        [0.35, h / 2, 0.35],
        [0.06 * i, 0, 0.08 * i],
        true,
      );
    }
    if (count === 1) {
      ring(1, 0.08, 0.2);
      ring(0.9, 0.035, 2.7, 0xead8a1);
    }
  } else if (item.style === "arch") {
    for (const z of [-0.45, 0.45])
      piece(
        root,
        new THREE.TorusGeometry(2.05, 0.15, 7, 32, Math.PI),
        c,
        [0, 0.2, z],
        [1, 1, 1],
      );
    for (const x of [-2.05, 2.05])
      piece(root, ball, c, [x, 0.17, 0], [0.4, 0.25, 0.65]);
  } else if (item.style === "fountain") {
    piece(root, cylinder, 0x9caa9c, [0, 0.2, 0], [1.6, 0.4, 1.6]);
    ring(1.6, 0.12, 0.43);
    piece(root, cylinder, 0x74b7bf, [0, 0.43, 0], [1.4, 0.05, 1.4]);
    piece(root, cylinder, c, [0, 1.15, 0], [0.23, 1.4, 0.23]);
    ring(0.65, 0.15, 1.8);
    piece(root, ball, 0x9fe0e3, [0, 2.2, 0], [0.09, 0.4, 0.09], null, true);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.28;
      piece(
        root,
        ball,
        0x99d4d8,
        [Math.cos(a) * 0.43, 1.5, Math.sin(a) * 0.43],
        [0.05, 0.5, 0.05],
        [Math.sin(a) * 0.2, 0, Math.cos(a) * 0.2],
      );
    }
  } else if (item.style === "ruins") {
    for (const x of [-1.4, 1.4]) {
      piece(root, cylinder, c, [x, 1.7, 0], [0.35, 3.4, 0.35]);
      piece(root, box, c, [x, 3.45, 0], [0.9, 0.25, 0.9]);
      piece(root, box, c, [x, 0.12, 0], [0.9, 0.25, 0.9]);
    }
    piece(root, box, c, [0, 3.7, 0], [3.7, 0.35, 0.85]);
  } else if (item.style === "volcano") {
    piece(root, cone, 0x6e655f, [0, 1.5, 0], [2.6, 3, 2.6]);
    ring(0.57, 0.16, 2.75, 0xe39a70);
    piece(root, ball, 0xffb66d, [0, 2.76, 0], [0.4, 0.12, 0.4], null, true);
  } else if (item.style === "pavilion") {
    for (const x of [-1.7, 1.7])
      for (const z of [-1.7, 1.7])
        piece(root, cylinder, c, [x, 1.6, z], [0.13, 3.2, 0.13]);
    piece(root, box, 0xb1a18c, [0, 0.12, 0], [4.1, 0.24, 4.1]);
    piece(
      root,
      new THREE.ConeGeometry(1, 1, 4),
      0x8c91a7,
      [0, 3.6, 0],
      [3.3, 1.3, 3.3],
      [0, Math.PI / 4, 0],
    );
    piece(
      root,
      new THREE.OctahedronGeometry(0.35),
      0xe5cfff,
      [0, 4.7, 0],
      [1, 1.7, 1],
      null,
      true,
    );
  } else if (item.style === "statue") {
    piece(root, box, c, [0, 0.35, 0], [3.2, 0.7, 2.2]);
    const d = createDinosaur(SPECIES_BY_ID.tyrannosaurus, true);
    d.scale.setScalar(0.72);
    d.position.y = 0.7;
    d.traverse((m) => {
      if (m.isMesh) m.material = mat(c);
    });
    root.add(d);
    finalize(root);
    d.userData.dispose();
    return root;
  }
  return finalize(root);
}
export function createShopObject(item, profile) {
  if (item.kind === "decoration") return createDecoration(item.id);
  if (item.kind === "pet") return createPet(item.id);
  const root = createDinosaur(
    SPECIES_BY_ID.tyrannosaurus,
    true,
    item.kind === "skin" ? item.id : profile.equippedSkin,
  );
  applyCosmetic(
    root,
    item.kind === "cosmetic" ? item.id : profile.equippedCosmetic,
  );
  return root;
}
export class CollectionViewer extends SpecimenViewer {
  constructor(canvas, item, profile) {
    super(canvas, SPECIES_BY_ID.compsognathus);
    this.setProduct(item, profile);
  }
  setProduct(item, profile) {
    this.scene.remove(this.model);
    this.model.userData.dispose();
    this.model = createShopObject(item, profile);
    this.model.rotation.y = -0.5;
    this.scene.add(this.model);
    this.sku = item.sku;
    this.resize();
  }
  render(dt) {
    this.time += dt;
    if (!this.dragging) this.model.rotation.y += dt * 0.18;
    if (this.model.userData.species)
      animateCreature(this.model, dt, this.time, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
