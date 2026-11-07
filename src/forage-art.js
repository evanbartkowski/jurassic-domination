import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { plantDefinition } from "./forage.js";

// Each forage variety uses one shared, vertex-colored mesh. Eating or streaming
// a plant removes only its instance; the twelve small geometry templates survive.
const geometries = new Map();
const materials = new Map();
function material(definition) {
  const kind = definition.id === "crystal-fruit" ? "crystal" : definition.group;
  if (!materials.has(kind)) {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: kind === "fruit" || kind === "crystal" ? 0.56 : 0.86,
      metalness: kind === "crystal" ? 0.22 : 0,
      emissive: kind === "crystal" ? 0x51427b : 0,
      emissiveIntensity: kind === "crystal" ? 0.22 : 0,
    });
    mat.userData.shared = true;
    materials.set(kind, mat);
  }
  return materials.get(kind);
}
function build(definition) {
  const parts = [],
    green = 0x5a8c47,
    stem = 0x6c7547,
    color = definition.color,
    accent = new THREE.Color(color).multiplyScalar(0.7);
  const add = (geometry, tint, position, scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    geometry.scale(...scale);
    geometry.rotateX(rotation[0]);
    geometry.rotateY(rotation[1]);
    geometry.rotateZ(rotation[2]);
    geometry.translate(...position);
    const plain = geometry.index ? geometry.toNonIndexed() : geometry;
    if (plain !== geometry) geometry.dispose();
    const c = new THREE.Color(tint), values = new Float32Array(plain.attributes.position.count * 3);
    for (let i = 0; i < values.length; i += 3) {
      values[i] = c.r;
      values[i + 1] = c.g;
      values[i + 2] = c.b;
    }
    plain.setAttribute("color", new THREE.BufferAttribute(values, 3));
    parts.push(plain);
  };
  const orb = (tint, p, s) => add(new THREE.SphereGeometry(1, 8, 5), tint, p, s),
    stalk = (tint, p, height, radius = 0.035, rotation = [0, 0, 0]) =>
      add(new THREE.CylinderGeometry(radius, radius * 1.25, height, 6), tint, p, [1, 1, 1], rotation),
    leaf = (tint, p, length, width, angle = 0, lift = 0) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute([
        0, 0, 0, width, 0.12, length * 0.43, 0, 0.07, length, -width, 0.12, length * 0.43,
      ], 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute([0.5, 0, 1, 0.45, 0.5, 1, 0, 0.45], 2));
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      geo.computeVertexNormals();
      add(geo, tint, p, [1, 1, 1], [lift, angle, 0]);
    };

  if (definition.id === "fern") {
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      for (let n = 1; n <= 5; n++) {
        const r = n * 0.15, h = Math.sin(n / 6 * Math.PI) * 0.52;
        for (const side of [-1, 1])
          leaf(n % 2 ? color : green, [Math.sin(a) * r, h, Math.cos(a) * r], 0.38 - n * 0.035, 0.1, a + side * 1.05, 0.12);
      }
      leaf(color, [0, 0.1, 0], 1.1, 0.06, a, -0.22);
    }
  } else if (definition.id === "horsetail") {
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4, x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.3, height = 0.95 + (i % 3) * 0.2;
      stalk(color, [x, height / 2, z], height, 0.045);
      for (let n = 1; n < 5; n++) {
        stalk(accent, [x, n * height / 5, z], 0.05, 0.067);
        for (let b = 0; b < 4; b++)
          leaf(color, [x, n * height / 5, z], 0.26, 0.025, b * Math.PI / 2 + i, 0.35);
      }
    }
  } else if (definition.id === "cycad") {
    orb(0x816641, [0, 0.18, 0], [0.22, 0.27, 0.22]);
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI * 2 / 9;
      leaf(i % 2 ? color : green, [0, 0.35, 0], 1.05, 0.16, a, -0.45);
      leaf(color, [Math.sin(a) * 0.3, 0.48, Math.cos(a) * 0.3], 0.7, 0.13, a + 0.15, -0.12);
    }
  } else if (definition.id === "ginkgo") {
    stalk(0x826b43, [0, 0.6, 0], 1.2, 0.07);
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4;
      leaf(i % 2 ? color : accent, [Math.cos(a) * 0.18, 0.6 + (i % 3) * 0.2, Math.sin(a) * 0.18], 0.55, 0.36, a, 0.15);
    }
  } else if (definition.id === "lotus") {
    for (let i = 0; i < 3; i++) {
      const a = i * 2.4;
      orb(green, [Math.cos(a) * 0.4, 0.12, Math.sin(a) * 0.4], [0.45, 0.055, 0.4]);
      orb(0xc1ac7d, [Math.cos(a) * 0.35, 0.05, Math.sin(a) * 0.35], [0.2, 0.12, 0.32]);
    }
    stalk(green, [0, 0.3, 0], 0.6);
    for (let i = 0; i < 7; i++)
      leaf(i % 2 ? color : 0xf0c4d2, [0, 0.58, 0], 0.42, 0.15, i * 0.9, -0.6);
    orb(0xe9ca6c, [0, 0.68, 0], [0.13, 0.1, 0.13]);
  } else if (definition.id === "tuber") {
    for (let i = 0; i < 4; i++) {
      const a = i * 2.4;
      orb(i % 2 ? color : accent, [Math.sin(a) * 0.35, 0.16, Math.cos(a) * 0.35], [0.2, 0.18, 0.37]);
      leaf(green, [0, 0.25, 0], 0.7, 0.2, a, -0.65);
    }
  } else if (definition.id === "mushroom") {
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4, r = i ? 0.3 + i * 0.025 : 0, height = 0.35 + (i % 3) * 0.2,
        x = Math.sin(a) * r, z = Math.cos(a) * r;
      stalk(0xe6d6ad, [x, height / 2, z], height, 0.06);
      orb(i % 2 ? color : 0xc99355, [x, height, z], [0.27, 0.14, 0.27]);
      orb(0xf1dfb1, [x + 0.08, height + 0.115, z], [0.045, 0.025, 0.045]);
    }
  } else if (definition.id === "melon") {
    orb(color, [0, 0.35, 0], [0.62, 0.4, 0.48]);
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7;
      orb(0x66864b, [Math.sin(a) * 0.56, 0.35, Math.cos(a) * 0.4], [0.06, 0.32, 0.055]);
    }
    leaf(green, [0.5, 0.08, 0.2], 0.75, 0.26, 1.3, 0.02);
    stalk(stem, [0, 0.78, 0], 0.25, 0.055, [0, 0, 0.5]);
  } else if (definition.id === "crystal-fruit") {
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4;
      leaf(0x536d69, [0, 0.14, 0], 0.72, 0.2, a, -0.2);
      add(new THREE.OctahedronGeometry(0.28), i % 2 ? color : 0xe0c3ef,
        [Math.sin(a) * 0.28, 0.38 + (i % 2) * 0.23, Math.cos(a) * 0.28], [0.7, 1.4, 0.7]);
    }
  } else {
    const fig = definition.id === "fig", frosty = definition.id === "frostberry";
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4, x = Math.sin(a) * 0.28, z = Math.cos(a) * 0.28, h = 0.4 + (i % 3) * 0.14;
      stalk(stem, [x, h / 2, z], h, 0.028);
      leaf(frosty ? 0x819f91 : green, [x, h * 0.7, z], 0.54, 0.21, a, -0.25);
      orb(i % 2 ? color : accent, [x, h + 0.12, z], fig ? [0.17, 0.23, 0.17] : [0.13, 0.13, 0.13]);
      if (!fig) orb(color, [x + 0.12, h + 0.05, z + 0.1], [0.1, 0.1, 0.1]);
    }
  }
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  geometry.computeBoundingSphere();
  geometry.userData.shared = true;
  return geometry;
}

export function createForageModel(food) {
  const definition = plantDefinition(food);
  if (!geometries.has(definition.id)) geometries.set(definition.id, build(definition));
  const root = new THREE.Group(), mesh = new THREE.Mesh(geometries.get(definition.id), material(definition));
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  root.add(mesh);
  root.rotation.y = ((Number(food.id) || 0) * 2.39996) % (Math.PI * 2);
  root.userData.plantKind = definition.id;
  root.userData.dispose = () => {};
  return root;
}
