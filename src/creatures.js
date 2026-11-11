import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { SKINS } from "./content.js";
import { phenotype } from './genetics.js';
export function genomeAppearanceKey(genome) {
  const p = phenotype(genome);
  return `${Math.round(p.hue / .0225)}:${p.markings === 'speckled' ? 'speckled' : p.markings === 'banded' ? 'banded' : 'skin'}`;
}

const sphere = new THREE.SphereGeometry(1, 28, 20);
const cone = new THREE.ConeGeometry(1, 1, 16);
const materialCache = new Map(),
  textureCache = new Map(),
  bumpCache = new Map(),
  eyeCache = new Map();

function eyeTexture(isPredator = true) {
  const key = isPredator ? "predator" : "herbivore";
  if (eyeCache.has(key)) return eyeCache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  if (c && c.createRadialGradient) {
    c.fillStyle = "#16120e";
    c.fillRect(0, 0, 256, 256);

    const irisGrad = c.createRadialGradient(128, 128, 20, 128, 128, 112);
    if (isPredator) {
      irisGrad.addColorStop(0, "#ffb822");
      irisGrad.addColorStop(0.5, "#e66a08");
      irisGrad.addColorStop(0.85, "#992a04");
      irisGrad.addColorStop(1, "#260601");
    } else {
      irisGrad.addColorStop(0, "#c4b47a");
      irisGrad.addColorStop(0.5, "#6d5a34");
      irisGrad.addColorStop(0.85, "#3d321e");
      irisGrad.addColorStop(1, "#14110b");
    }
    c.fillStyle = irisGrad;
    c.beginPath();
    c.arc(128, 128, 108, 0, Math.PI * 2);
    c.fill();

    c.strokeStyle = isPredator ? "rgba(255, 230, 130, 0.4)" : "rgba(230, 220, 170, 0.35)";
    c.lineWidth = 1.6;
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      c.beginPath();
      c.moveTo(128 + Math.cos(a) * 32, 128 + Math.sin(a) * 32);
      c.lineTo(128 + Math.cos(a) * 105, 128 + Math.sin(a) * 105);
      c.stroke();
    }

    c.fillStyle = "#040507";
    c.beginPath();
    if (isPredator) {
      c.ellipse(128, 128, 16, 92, 0, 0, Math.PI * 2);
    } else {
      c.ellipse(128, 128, 54, 46, 0, 0, Math.PI * 2);
    }
    c.fill();

    c.fillStyle = "rgba(255, 255, 255, 0.92)";
    c.beginPath();
    c.arc(102, 94, 14, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255, 255, 255, 0.55)";
    c.beginPath();
    c.arc(150, 148, 6, 0, Math.PI * 2);
    c.fill();
  } else if (c) {
    c.fillStyle = isPredator ? "#e66a08" : "#6d5a34";
    c.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  eyeCache.set(key, tex);
  return tex;
}

function skinBumpTexture(kind) {
  if (bumpCache.has(kind)) return bumpCache.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d");
  if (c && c.fillRect) {
    c.fillStyle = "#222222";
    c.fillRect(0, 0, 512, 512);

    for (let row = 0; row < 38; row++) {
      for (let col = 0; col < 30; col++) {
        const x = col * 18 + (row % 2) * 9,
          y = row * 14;
        c.fillStyle = "#ececec";
        c.beginPath();
        c.ellipse(
          x,
          y,
          kind === "feather" ? 4.5 : 8.2,
          kind === "feather" ? 11.5 : 6.0,
          kind === "feather" ? -0.32 : 0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.5, 1.5);
  bumpCache.set(kind, map);
  return map;
}

function skinTexture(kind) {
  if (textureCache.has(kind)) return textureCache.get(kind);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const c = canvas.getContext("2d");
  if (c && c.fillRect) {
    c.fillStyle = "#c8c3af";
    c.fillRect(0, 0, 1024, 1024);

    // High-resolution reptilian polygonal scale matrix with deep recessed crevices and specular domes
    for (let row = 0; row < 54; row++) {
      for (let col = 0; col < 44; col++) {
        const x = col * 24 + (row % 2) * 12,
          y = row * 19;
        const value = 194 + ((row * 37 + col * 19) % 38);

        // Crevice shadow border
        c.fillStyle = "rgba(34, 40, 30, 0.28)";
        c.beginPath();
        c.ellipse(
          x,
          y,
          kind === "feather" ? 6.2 : 11.5,
          kind === "feather" ? 15.5 : 8.8,
          kind === "feather" ? -0.32 : 0,
          0,
          Math.PI * 2,
        );
        c.fill();

        // Scale dorsal plate highlight
        c.fillStyle = `rgb(${value},${value + 5},${value - 3})`;
        c.beginPath();
        c.ellipse(
          x - 0.8,
          y - 0.8,
          kind === "feather" ? 5.2 : 9.8,
          kind === "feather" ? 13.5 : 7.2,
          kind === "feather" ? -0.32 : 0,
          0,
          Math.PI * 2,
        );
        c.fill();

        // Secondary specular highlight crest on the scale dome
        c.fillStyle = "rgba(255, 255, 245, 0.20)";
        c.beginPath();
        c.ellipse(
          x - 2.0,
          y - 1.5,
          kind === "feather" ? 2.6 : 4.6,
          kind === "feather" ? 6.5 : 3.4,
          kind === "feather" ? -0.32 : 0,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }

    // Broad organic pigment markings and predator camouflage
    if (kind === "speckled") {
      // Predatory rosette spots and dappled camouflage
      for (let i = 0; i < 90; i++) {
        const sx = (i * 127) % 1024, sy = (i * 181) % 1024;
        c.fillStyle = "rgba(32, 38, 30, 0.42)";
        c.beginPath();
        c.arc(sx, sy, 12 + (i % 10), 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(185, 142, 70, 0.32)";
        c.beginPath();
        c.arc(sx, sy, 6 + (i % 6), 0, Math.PI * 2);
        c.fill();
      }
    } else if (kind === "banded") {
      // Striated predator tiger-stripes across flank
      for (let i = 0; i < 24; i++) {
        const bx = i * 44, by = 500 + Math.sin(i * 1.2) * 150;
        c.fillStyle = "rgba(24, 32, 24, 0.45)";
        c.beginPath();
        c.ellipse(bx, by, 22, 420, 0.28, 0, Math.PI * 2);
        c.fill();
      }
    } else if (kind === "feather") {
      // Directional plumulaceous shafts
      for (let i = 0; i < 75; i++) {
        const fx = (i * 97) % 1024, fy = (i * 157) % 1024;
        c.fillStyle = "rgba(225, 212, 175, 0.36)";
        c.beginPath();
        c.ellipse(fx, fy, 5.5, 36, -0.35, 0, Math.PI * 2);
        c.fill();
      }
    } else {
      // Subtle dorsal spine counter-shading
      for (let i = 0; i < 28; i++) {
        c.fillStyle = "rgba(34, 40, 32, 0.22)";
        c.beginPath();
        c.ellipse(i * 38, 480 + Math.sin(i * 0.8) * 90, 26, 320, 0.15, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2.5, 1.5);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  textureCache.set(kind, map);
  return map;
}

function mat(color, kind = "skin", glow = false, isPredator = true) {
  const key = `${color}:${kind}:${glow}:${isPredator}`;
  if (!materialCache.has(key)) {
    const isEye = kind === "eye";
    const isHorn = kind === "horn";
    const hasSkinTex = ["skin", "feather", "speckled", "banded"].includes(kind);
    const m = new THREE.MeshStandardMaterial({
      color: isEye ? 0xffffff : color,
      roughness: isEye ? 0.06 : isHorn ? 0.36 : 0.60,
      metalness: isHorn ? 0.08 : isEye ? 0.04 : 0.03,
      map: isEye ? eyeTexture(isPredator) : (hasSkinTex ? skinTexture(kind) : null),
      bumpMap: isEye ? null : (hasSkinTex ? skinBumpTexture(kind) : null),
      bumpScale: 0.065,
      emissive: glow ? color : isEye ? 0x181005 : 0,
      emissiveIntensity: glow ? 0.38 : isEye ? 0.12 : 0,
      side: kind === "membrane" ? THREE.DoubleSide : THREE.FrontSide,
    });
    m.userData.shared = true;
    m.userData.surface = kind;
    materialCache.set(key, m);
  }
  return materialCache.get(key);
}
function add(parent, geo, material, position, scale, rotation) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...position);
  m.scale.set(...scale);
  if (rotation) m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function organic(parent, color, p, s, r, kind = "skin") {
  return add(parent, sphere, mat(color, kind), p, s, r);
}
function horn(parent, color, p, s, r) {
  return add(parent, cone, mat(color, "horn"), p, s, r);
}
function profileGeometry(sections) {
  const v = [],
    n = [],
    uv = [],
    indices = [],
    sides = 32;
  const curve = new THREE.CatmullRomCurve3(
      sections.map((s) => new THREE.Vector3(s[0], s[1], 0)),
    ),
    count = sections.length * 8;
  for (let i = 0; i <= count; i++) {
    const t = i / count,
      p = curve.getPoint(t),
      f = t * (sections.length - 1),
      a = Math.min(sections.length - 2, Math.floor(f)),
      mix = f - a;
    const ry = THREE.MathUtils.lerp(sections[a][2], sections[a + 1][2], mix),
      rz = THREE.MathUtils.lerp(sections[a][3], sections[a + 1][3], mix);
    for (let j = 0; j <= sides; j++) {
      const theta = (j / sides) * Math.PI * 2;
      v.push(p.x, p.y + Math.cos(theta) * ry, Math.sin(theta) * rz);
      n.push(0, Math.cos(theta), Math.sin(theta));
      uv.push(t, j / sides);
      if (i < count && j < sides) {
        const k = i * (sides + 1) + j;
        indices.push(
          k,
          k + 1,
          k + sides + 1,
          k + 1,
          k + sides + 2,
          k + sides + 1,
        );
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
function tube(points, radii, radial = 20) {
  const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    ),
    steps = Math.max(16, points.length * 8),
    frames = curve.computeFrenetFrames(steps, false);
  const vertices = [],
    normals = [],
    uv = [],
    indices = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      position = curve.getPoint(t),
      f = t * (radii.length - 1),
      a = Math.min(radii.length - 2, Math.floor(f)),
      r = THREE.MathUtils.lerp(radii[a], radii[a + 1], f - a);
    for (let j = 0; j <= radial; j++) {
      const angle = (j / radial) * Math.PI * 2,
        n = frames.normals[i]
          .clone()
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(frames.binormals[i], Math.sin(angle));
      vertices.push(
        position.x + n.x * r,
        position.y + n.y * r,
        position.z + n.z * r,
      );
      normals.push(n.x, n.y, n.z);
      uv.push(j / radial, t);
      if (i < steps && j < radial) {
        const k = i * (radial + 1) + j;
        indices.push(
          k,
          k + radial + 1,
          k + 1,
          k + 1,
          k + radial + 1,
          k + radial + 2,
        );
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  return geo;
}
// Static surface pieces are combined by material; joints remain independently animated.
function mergeStatic(group, owned) {
  const buckets = new Map();
  for (const child of [...group.children])
    if (child.isMesh && !child.userData.animated) {
      child.updateMatrix();
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(child.matrix);
      const list = buckets.get(child.material) || [];
      list.push(geometry);
      buckets.set(child.material, list);
      group.remove(child);
    }
  for (const [material, geometries] of buckets) {
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!geometry) continue;
    owned.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

export function createDinosaur(
  species,
  decorative = false,
  skinId = "natural",
  genome = null,
) {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const skin = SKINS.find((s) => s.id === skinId) || SKINS[0], pigment = Number(genomeAppearanceKey(genome).split(':')[0]) * .0225,
    c = skinId === 'natural' ? new THREE.Color(species.color).offsetHSL(pigment, 0, 0).getHex() : skin.color ?? species.color,
    accent = skin.accent ?? species.accent;
  const dark = new THREE.Color(c).multiplyScalar(0.62).getHex(),
    light = new THREE.Color(c).lerp(new THREE.Color(0xd8cdb3), 0.42).getHex();
  const bone = 0xe4d8bb,
    owned = new Set(),
    legs = [],
    wings = [],
    flippers = [],
    tails = [],
    eyes = [],
    arms = [];
  const type = species.body,
    name = species.id;
  const marine = type === "marine", longSwimmer = species.anatomy === "plesiosaur",
    serpent = type === "serpent",
    croc = type === "croc",
    horse = type === "equine",
    dragon = type === "dragon",
    gryphon = type === "gryphon",
    sauropod = type === "longneck";
  const quadruped = [
    "quad",
    "longneck",
    "croc",
    "equine",
    "dragon",
    "gryphon",
  ].includes(type);
  const h = marine ? 0.75 : serpent ? 0.95 : croc ? 0.6 : horse ? 1.5 : quadruped ? 1.15 : 1.65;
  const bodyLength = marine ? 1.65 : sauropod ? 1.7 : horse ? 1.4 : 1.35,
    thickness = marine ? (longSwimmer ? .52 : .72) : croc
      ? 0.36
      : horse
        ? 0.59
        : serpent
          ? 0.48
          : quadruped
            ? 0.73
            : 0.69;
  const torso = profileGeometry([
    [-bodyLength - 0.15, h, 0.03, 0.03],
    [-bodyLength, h, 0.32, 0.3],
    [-0.8, h + 0.03, thickness, 0.56],
    [-0.1, h, thickness * 0.96, 0.6],
    [0.65, h + 0.08, thickness * 0.78, 0.47],
    [1.1, h + 0.18, 0.3, 0.3],
    [1.3, h + 0.24, 0.02, 0.02],
  ]);
  owned.add(torso);
  add(body, torso, mat(c, horse ? "fur" : "skin"), [0, 0, 0], [1, 1, 1]);
  organic(
    body,
    light,
    [0.1, h - thickness * 0.68, 0],
    [bodyLength * 0.66, 0.17, 0.39],
    null,
    horse ? "fur" : "skin",
  );
  // A curved anatomical neck joins the chest and skull.
  const head = new THREE.Group();
  let headX = 1.34,
    headY = h + 0.7;
  if (sauropod) {
    headX = 2.05;
    headY = 4.35;
  }
  if (horse || gryphon) {
    headX = 1.12;
    headY = h + 1.14;
  }
  if (croc) {
    headX = 1.48;
    headY = 0.72;
  }
  if (serpent) {
    headX = 0.95;
    headY = 1.28;
  }
  if (marine) { headX = longSwimmer ? 3.25 : 1.65; headY = longSwimmer ? 1.13 : .88; }
  const neckMidX = marine && longSwimmer ? 1.9 : sauropod ? 1.25 : 0.92;
  const neckMidY = h + (marine && longSwimmer ? .26 : sauropod ? 1.85 : horse ? 0.64 : marine ? 0.08 : 0.35);
  const neckGeo = tube(
    [
      [0.55, h + 0.08, 0],
      [neckMidX, neckMidY, 0],
      [headX - 0.12, headY - 0.22, 0],
    ],
    [
      marine ? .37 : horse ? 0.42 : 0.46,
      marine ? (longSwimmer ? .22 : .4) : sauropod ? 0.36 : horse ? 0.31 : 0.36,
      marine ? (longSwimmer ? .18 : .34) : sauropod ? 0.23 : horse ? 0.23 : 0.29,
    ],
  );
  owned.add(neckGeo);
  add(body, neckGeo, mat(c, horse ? "fur" : "skin"), [0, 0, 0], [1, 1, 1]);
  head.position.set(headX, headY, 0);
  body.add(head);
  const rex = type === "rex" || dragon || (marine && !longSwimmer),
    headLength = marine ? (longSwimmer ? .52 : 1.16) : croc ? 1.18 : rex ? 0.84 : horse ? 0.62 : 0.55;
  if (horse) {
    organic(head, c, [0.07, 0.05, 0], [0.26, 0.42, 0.23], [0, 0, 0.3], "fur");
    organic(head, c, [0.44, -0.26, 0], [0.45, 0.23, 0.21], [0, 0, -0.4], "fur");
    organic(head, light, [0.75, -0.4, 0], [0.22, 0.17, 0.23], null, "fur");
    for (const side of [-1, 1])
      organic(
        head,
        c,
        [-0.1, 0.5, side * 0.16],
        [0.07, 0.29, 0.075],
        [side * 0.15, 0, 0.1],
        "fur",
      );
  } else {
    const skull = profileGeometry([
      [-0.32, 0.02, 0.03, 0.03],
      [-0.19, 0.08, 0.28, 0.28],
      [0.12, 0.09, 0.35, 0.34],
      [headLength * 0.65, 0.035, croc ? 0.16 : 0.24, croc ? 0.36 : 0.29],
      [headLength * 1.26, -0.02, croc ? 0.13 : 0.17, croc ? 0.28 : 0.23],
      [headLength * 1.35, -0.02, 0.025, 0.025],
    ]);
    owned.add(skull);
    add(head, skull, mat(c), [0, 0, 0], [1, 1, 1]);
    organic(
      head,
      dark,
      [headLength * 0.53, -0.165, 0],
      [headLength * 0.82, 0.035, croc ? 0.3 : 0.25],
    );
  }
  const jaw = new THREE.Group();
  jaw.position.set(-0.14, -0.16, 0);
  head.add(jaw);
  organic(
    jaw,
    light,
    [headLength * 0.73, horse ? -0.14 : -0.07, 0],
    [headLength * 0.87, horse ? 0.075 : 0.085, horse ? 0.2 : 0.26],
    horse ? [0, 0, -0.25] : null,
    horse ? "fur" : "skin",
  );
  if (!horse) {
    // Modeled fleshy pink tongue along the floor of the lower jaw
    organic(
      jaw,
      0xaf384a,
      [headLength * 0.62, 0.02, 0],
      [headLength * 0.52, 0.045, 0.13],
      null,
      "skin",
    );
  }
  const isCarnivore = !horse && !sauropod && type !== "quad";
  for (const side of [-1, 1]) {
    // Rugose postorbital / supraorbital brow ridge
    organic(
      head,
      dark,
      [-0.015, 0.27, side * (horse ? 0.22 : 0.3)],
      [0.2, 0.055, 0.065],
      [0, 0, -0.12],
    );
    // Sculpted eye socket eyelid rim
    organic(
      head,
      dark,
      [0.045, 0.25, side * (horse ? 0.24 : 0.34)],
      [0.08, 0.035, 0.028],
      [0, 0, -0.14],
    );
    const eye = organic(
      head,
      horse ? 0x413b32 : 0xd9b16b,
      [0.045, 0.215, side * (horse ? 0.235 : 0.337)],
      [0.052, 0.050, 0.028],
      null,
      "eye",
    );
    eyes.push(eye);
    organic(
      head,
      dark,
      [headLength * 1.13, 0.02, side * (croc ? 0.3 : 0.22)],
      [0.046, 0.029, 0.019],
    );
    if (isCarnivore) {
      const toothCount = croc ? 11 : rex ? 9 : 6;
      for (let i = 0; i < toothCount; i++) {
        const x = 0.08 + (i * headLength * 0.95) / (toothCount - 1);
        const fangPeak = rex ? (i >= 1 && i <= 3 ? 1.45 : 0.88) : 1.0;
        const toothLen = (rex ? 0.16 : 0.11) * fangPeak;
        // Upper recurved ivory teeth
        horn(
          head,
          bone,
          [x, -0.165, side * (croc ? 0.28 : 0.25)],
          [0.026, toothLen, 0.024],
          [0, 0, Math.PI + 0.22],
        );
        // Lower interlocking mandibular teeth
        horn(
          jaw,
          bone,
          [x + 0.08, 0.055, side * (croc ? 0.26 : 0.235)],
          [0.022, toothLen * 0.82, 0.022],
          [0, 0, -0.16],
        );
      }
    }
    if (gryphon)
      horn(
        head,
        0xbcb27c,
        [0.81, -0.08, 0],
        [0.2, 0.65, 0.23],
        [0, 0, -Math.PI / 2 - 0.2],
      );
  }
  if (marine) for (const side of [-1, 1]) for (const front of [false, true]) {
    const fin = new THREE.Group();
    fin.position.set(front ? .6 : -1.02, .58, side * .48);
    body.add(fin);
    organic(fin, c, [-.22, -.06, side * .68], [.44, .1, longSwimmer ? 1.02 : 1.26], [0, side * .36, side * .08]);
    organic(fin, light, [-.28, -.13, side * .7], [.32, .035, longSwimmer ? .86 : 1.1], [0, side * .36, 0]);
    mergeStatic(fin, owned); flippers.push({ fin, side, front });
  }
  if (marine && !longSwimmer) for (let i = 0; i < 7; i++)
    horn(body, accent, [-1.1 + i * .32, 1.28 + Math.sin(i / 6 * Math.PI) * .1, 0], [.1, .18 + (i % 2) * .08, .09], [0, 0, .3]);
  if (!serpent && !marine)
    for (const side of [-1, 1]) {
      const positions = quadruped ? [-0.88, 0.82] : [-0.6];
      for (const hip of positions) {
        const upper = new THREE.Group();
        upper.position.set(hip, h - 0.15, side * (croc ? 0.65 : 0.48));
        body.add(upper);
        const legLength = horse ? 1.28 : h - 0.05,
          upperLength = legLength * 0.49,
          lowerLength = legLength * 0.5;
        organic(
          upper,
          c,
          [-0.08, -upperLength * 0.39, 0],
          [quadruped ? 0.23 : 0.34, upperLength * 0.72, 0.235],
          [0, 0, 0.18],
        );
        const knee = new THREE.Group();
        knee.position.set(-0.14, -upperLength, 0);
        upper.add(knee);
        organic(
          knee,
          light,
          [0.1, -lowerLength * 0.45, 0],
          [0.13, lowerLength * 0.6, 0.13],
          [0, 0, -0.18],
        );
        organic(
          knee,
          dark,
          [0.23, -lowerLength + 0.07, 0],
          [horse ? 0.24 : 0.31, 0.09, 0.16],
        );
        const isRaptor = /raptor|utahraptor|deinonychus|pyroraptor/.test(name);
        if (horse)
          organic(
            knee,
            0x45423a,
            [0.28, -lowerLength + 0.025, 0],
            [0.17, 0.1, 0.18],
          );
        else
          for (let toe = 0; toe < 3; toe++) {
            const sickleToe = isRaptor && toe === 1;
            organic(
              knee,
              c,
              [0.38, -lowerLength + (sickleToe ? 0.16 : 0.055), (toe - 1) * 0.115],
              [0.22, 0.065, 0.052],
              sickleToe ? [0, 0, 0.48] : null,
            );
            // Prominent hyper-extended predatory sickle claw on Digit II
            horn(
              knee,
              sickleToe ? 0x222222 : bone,
              [sickleToe ? 0.46 : 0.59, -lowerLength + (sickleToe ? 0.24 : 0.06), (toe - 1) * 0.115],
              [sickleToe ? 0.048 : 0.035, sickleToe ? 0.42 : 0.17, sickleToe ? 0.048 : 0.035],
              [0, 0, sickleToe ? -2.45 : -Math.PI / 2],
            );
          }
        mergeStatic(knee, owned);
        mergeStatic(upper, owned);
        legs.push({
          upper,
          knee,
          side,
          front: hip > 0,
          rest: upper.rotation.z,
          length: legLength,
        });
      }
      if (!quadruped) {
        const isRaptor = /raptor|utahraptor|deinonychus|pyroraptor/.test(name);
        const arm = new THREE.Group();
        arm.position.set(0.72, h + 0.15, side * (isRaptor || (species.size || 1) < 1.1 ? 0.32 : 0.42));
        body.add(arm);
        arms.push({ arm, side });
        organic(
          arm,
          c,
          [0.12, -0.21, side * 0.12],
          [0.12, 0.32, 0.13],
          [side * 0.3, 0, 0.4],
        );
        organic(arm, light, [0.28, -0.4, side * 0.22], [0.27, 0.075, 0.08]);
        const tyrant = /tyrannosaurus|tarbosaurus|albertosaurus|ashborn/.test(name);
        if (tyrant) arm.scale.setScalar(0.62);
        if (isRaptor) {
          // Layered aerodynamic primary and secondary wing plumes along forearm
          for (let f = 0; f < 5; f++) {
            organic(
              arm,
              accent,
              [0.16 + f * 0.09, -0.26 - f * 0.035, side * (0.16 + f * 0.02)],
              [0.34, 0.09, 0.024],
              [0, side * 0.22, 0.42],
              "feather",
            );
          }
        }
        for (let finger = 0; finger < (tyrant ? 2 : 3); finger++)
          horn(
            arm,
            isRaptor ? 0x222222 : bone,
            [0.55, -0.45, side * (0.13 + finger * 0.08)],
            [0.028, 0.26, 0.028],
            [0, 0, -2],
          );
        mergeStatic(arm, owned);
      }
    }
  // Continuous articulated tails bend from the pelvis rather than swinging rigidly.
  let tailParent = body;
  const tailCount = horse ? 1 : marine ? 5 : serpent ? 15 : 7;
  for (let i = 0; i < tailCount; i++) {
    const node = new THREE.Group();
    node.position.set(
      i === 0 ? -1.03 : serpent ? -0.6 : -0.44,
      i === 0 ? h + 0.03 : 0,
      0,
    );
    tailParent.add(node);
    const radius = serpent
      ? Math.max(0.07, 0.58 * (1 - i / tailCount) ** 0.7)
      : Math.max(0.025, 0.36 * (1 - i / tailCount));
    if (!horse) {
      const endRadius = serpent
        ? Math.max(0.025, 0.58 * (1 - (i + 1) / tailCount) ** 0.7)
        : Math.max(0.009, 0.36 * (1 - (i + 1) / tailCount));
      const geo = tube(
        [
          [0, 0, 0],
          [-0.25, 0, 0],
          [serpent ? -0.64 : -0.47, 0, 0],
        ],
        [radius, (radius + endRadius) / 2, endRadius],
        12,
      );
      owned.add(geo);
      add(node, geo, mat(c), [0, 0, 0], [1, 1, 1]);
    }
    if (serpent && species.tier >= 6 && i % 2 === 0)
      horn(node, accent, [-0.2, radius, 0], [0.1, 0.28, 0.1], [0, 0, 0.35]);
    mergeStatic(node, owned);
    tails.push(node);
    tailParent = node;
  }
  if (horse)
    for (let i = 0; i < 8; i++) {
      const geo = tube(
        [
          [0, 0.12, (i - 4) * 0.035],
          [-0.37, -0.25, (i - 4) * 0.045],
          [-0.55, -1.1, (i - 4) * 0.025],
        ],
        [0.065, 0.05, 0.005],
        6,
      );
      owned.add(geo);
      add(tails[0], geo, mat(accent, "fur"), [0, 0, 0], [1, 1, 1]);
    }
  // Species-specific skulls, sails, armor, crests and feathers preserve silhouettes.
  if (/tricer|styrac|protocer|pachyrhino/.test(name)) {
    // Grand anatomically sculpted neck frill with parabolic curvature
    organic(head, c, [-0.31, 0.22, 0], [0.16, 0.82, 0.78], [0, 0, 0.24]);
    // Perimeter epoccipital spikes encircling the frill margin
    for (let i = 0; i < 11; i++) {
      const a = (i / 10) * Math.PI;
      horn(
        head,
        accent,
        [-0.34, 0.22 + Math.sin(a) * 0.78, Math.cos(a) * 0.72],
        [0.075, 0.28, 0.07],
        [Math.cos(a) * 1.25, 0, 0],
      );
    }
    // Forward-curved brow horns with ringed keratin ridges
    for (const side of [-1, 1])
      horn(
        head,
        bone,
        [0.24, 0.54, side * 0.26],
        [0.095, name === "protoceratops" ? 0.2 : 0.84, 0.095],
        [0, 0, -0.55],
      );
    // Nasal horn
    horn(head, bone, [0.68, 0.24, 0], [0.09, 0.38, 0.09], [0, 0, -0.42]);
    // Sturdy rostral beak
    horn(head, dark, [headLength * 1.28, -0.06, 0], [0.09, 0.24, 0.09], [0, 0, -2.1]);
  }
  if (/pachycephalo|stygimoloch/.test(name))
    organic(head, accent, [-0.06, 0.42, 0], [0.38, 0.33, 0.34]);
  if (/carno|cerato/.test(name)) {
    for (const side of [-1, 1]) {
      horn(
        head,
        bone,
        [0.08, 0.54, side * 0.26],
        [0.09, 0.44, 0.09],
        [side * 0.32, 0, -0.65],
      );
    }
    for (let k = 0; k < 7; k++) {
      organic(body, dark, [-1.2 + k * 0.35, h + 0.64, 0], [0.08, 0.14, 0.08]);
    }
  }
  if (/tyrannosaurus|tarbosaurus|albertosaurus|ashborn/.test(name)) {
    for (const side of [-1, 1]) {
      // Rugose postorbital brow horns above the eyes
      organic(head, c, [-0.18, 0.06, side * 0.32], [0.28, 0.26, 0.16]);
      horn(head, dark, [0.08, 0.36, side * 0.28], [0.08, 0.24, 0.08], [side * 0.25, 0, -0.2]);
      // Temporal fenestra jaw muscle bulge
      organic(head, dark, [-0.12, -0.02, side * 0.34], [0.22, 0.20, 0.12]);
    }
  }
  if (/brachio|apatos|diplo/.test(name)) {
    // High-domed cranial forehead with dorsal nostrils
    organic(head, c, [0.06, 0.38, 0], [0.24, 0.32, 0.22]);
    organic(head, dark, [0.18, 0.42, 0], [0.12, 0.16, 0.14]);
  }
  if (/spino|dimetro|acrocantho/.test(name)) {
    // Majestic tall arching neural spine dorsal sail
    const verts = [],
      steps = 16;
    for (let i = 0; i < steps; i++) {
      const x = -1.35 + i * 0.18,
        x2 = x + 0.18,
        y =
          h +
          0.5 +
          Math.sin((i / steps) * Math.PI) *
            (name === "acrocanthosaurus" ? 0.6 : 1.45),
        y2 = h + 0.5 + Math.sin(((i + 1) / steps) * Math.PI) * (name === "acrocanthosaurus" ? 0.6 : 1.45);
      verts.push(
        x,
        h + 0.4,
        0,
        x,
        y,
        0,
        x2,
        y2,
        0,
        x,
        h + 0.4,
        0,
        x2,
        y2,
        0,
        x2,
        h + 0.4,
        0,
      );
      // Tall neural spine structural ribs
      horn(body, dark, [x, y - 0.12, 0], [0.04, 0.45, 0.04]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    geo.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        new Array((verts.length / 3) * 2).fill(0),
        2,
      ),
    );
    owned.add(geo);
    add(body, geo, mat(accent, "membrane"), [0, 0, 0], [1, 1, 1]);
    for (let i = 0; i < 5; i++) {
      if (tails[i + 1]) {
        organic(tails[i + 1], accent, [-0.15, 0.28, 0], [0.24, 0.42, 0.025], [0, 0, 0.15], "membrane");
      }
    }
  }
  if (/stego|kentros/.test(name)) {
    // Alternating double row of angular diamond plates along spine
    for (let i = 0; i < 11; i++) {
      const side = i % 2 ? -0.12 : 0.12;
      const plateScale = 0.54 + Math.sin((i / 11) * Math.PI) * 0.42;
      organic(
        body,
        accent,
        [-1.6 + i * 0.32, h + 0.76, side],
        [0.22, plateScale, 0.055],
        [0, 0, -0.16],
      );
    }
    // 4-spike horizontal thagomizer on tail tip
    const tailEnd = tails.at(-1);
    if (tailEnd) {
      for (const side of [-1, 1]) {
        for (let sp = 0; sp < 2; sp++) {
          horn(
            tailEnd,
            bone,
            [-0.1 - sp * 0.22, 0.08, side * 0.28],
            [0.065, 0.62, 0.065],
            [side * 1.35, 0, -0.25],
          );
        }
      }
      mergeStatic(tailEnd, owned);
    }
  }
  if (/ankylo|euoplo|minmi|behemoth/.test(name)) {
    // Carapace of multi-tiered keeled osteoderm armor plates
    for (let row = 0; row < 5; row++)
      for (let i = 0; i < 8; i++) {
        const z = (row - 2) * 0.28,
          x = -1.1 + i * 0.32;
        organic(
          body,
          dark,
          [x, h + 0.64 - Math.abs(z) * 0.28, z],
          [0.22, 0.17, 0.18],
        );
        if (i % 2 === 0)
          horn(body, accent, [x, h + 0.72, z], [0.08, 0.3, 0.08]);
      }
    // Heavy lateral triangular spikes along both flanks
    for (const side of [-1, 1]) {
      for (let s = 0; s < 6; s++) {
        horn(
          body,
          bone,
          [-0.9 + s * 0.32, h + 0.28, side * 0.76],
          [0.08, 0.38, 0.08],
          [side * 1.25, 0, 0],
        );
      }
    }
    // Heavy fused bone tail club
    const tailClub = tails.at(-1);
    if (tailClub) {
      organic(tailClub, accent, [-0.28, 0, 0], [0.48, 0.34, 0.46]);
      for (const side of [-1, 1]) {
        organic(tailClub, dark, [-0.28, 0, side * 0.26], [0.38, 0.28, 0.34]);
      }
      mergeStatic(tailClub, owned);
    }
  }
  if (/dilopho|oviraptor|parasauro/.test(name))
    organic(head, accent, [-0.17, 0.5, 0], [0.45, 0.48, 0.1], [0, 0, 0.55]);
  if (/amarga/.test(name))
    for (let i = 0; i < 9; i++)
      for (const side of [-1, 1])
        horn(
          body,
          bone,
          [0.7 + i * 0.13, 1.9 + i * 0.2, side * 0.14],
          [0.035, 0.7, 0.035],
          [side * 0.2, 0, 0.3],
        );
  if (/quetzal|hatzego|pteranodon|pterodactyl/.test(name)) {
    // Majestic swept-back pterosaur cranial crest
    const crestGeo = tube(
      [
        [-0.08, 0.38, 0],
        [-0.52, 0.82, 0],
        [-1.05, 1.25, 0],
      ],
      [0.085, 0.055, 0.015],
      8,
    );
    owned.add(crestGeo);
    add(head, crestGeo, mat(accent), [0, 0, 0], [1, 1, 1]);
    // Long dagger-like pterosaur spear beak
    const beakGeo = tube(
      [
        [0.45, 0.08, 0],
        [1.05, 0.03, 0],
        [1.7, -0.04, 0],
      ],
      [0.11, 0.065, 0.015],
      8,
    );
    owned.add(beakGeo);
    add(head, beakGeo, mat(accent), [0, 0, 0], [1, 1, 1]);
  }
  const bird = type === "bird",
    flight =
      (bird &&
        /micro|archaeo|quetzalcoatlus|hatzegopteryx|phoenix|thunderbird|pteranodon|pterodactyl|wyvern|quetzalcoatl/.test(
          name,
        )) ||
      /quetzalcoatlus|hatzegopteryx|pteranodon|pterodactyl|wyvern|phoenix|thunderbird|quetzalcoatl/.test(
        name,
      );
  if (bird || /raptor|yutyrannus|therizino/.test(name)) {
    for (let i = 0; i < 16; i++)
      organic(
        body,
        accent,
        [-1.1 + i * 0.13, h + 0.72, 0],
        [0.14, 0.17, 0.055],
        [0, 0, 0.6],
        "feather",
      );
    for (let i = 0; i < 7; i++)
      organic(
        tails[2],
        accent,
        [-0.1 - i * 0.13, 0.08, (i % 2 ? 1 : -1) * 0.12],
        [0.42, 0.06, 0.17],
        [0, i * 0.1, 0.1],
        "feather",
      );
    if (/raptor|utahraptor|deinonychus|pyroraptor/.test(name)) {
      const tipTail = tails.at(-1);
      const subTip = tails.at(-2);
      for (const side of [-1, 1]) {
        for (let f = 0; f < 3; f++) {
          const parentTail = f === 0 ? subTip : tipTail;
          if (parentTail) {
            organic(
              parentTail,
              accent,
              [-0.15 - f * 0.11, 0.03, side * (0.14 + f * 0.06)],
              [0.34, 0.024, 0.15],
              [0, side * 0.32, 0.06],
              "feather",
            );
          }
        }
      }
    }
  }
  if (dragon || gryphon || flight || name === "pegasus")
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(-0.18, h + 0.57, side * 0.39);
      body.add(wing);
      const feathered =
          gryphon ||
          (flight && !/quetzalcoatlus|hatzegopteryx|pteranodon|pterodactyl|wyvern|dragon/.test(name)) ||
          name === "pegasus",
        span = feathered ? 2.5 : 3.4;
      const geo = tube(
        [
          [0, 0, 0],
          [-0.25, 0.36, side * 1.2],
          [-0.6, 0.5, side * span],
        ],
        [0.11, 0.08, 0.025],
        8,
      );
      owned.add(geo);
      add(wing, geo, mat(c), [0, 0, 0], [1, 1, 1]);
      if (feathered) {
        for (let i = 0; i < 12; i++)
          organic(
            wing,
            accent,
            [
              -0.25 - i * 0.065,
              0.12 + Math.sin(i * 0.2) * 0.1,
              side * (0.35 + i * 0.18),
            ],
            [0.75 - i * 0.025, 0.06, 0.14],
            [0, side * 0.28, 0],
            "feather",
          );
      } else {
        const points = [
            [0, 0.02, 0],
            [-0.25, 0.3, side * 1.1],
            [-0.6, 0.48, side * span],
            [-1.05, 0.05, side * (span - 0.45)],
            [-1.48, -0.1, side * 1.7],
            [-1.5, -0.15, side * 0.55],
          ],
          v = [];
        for (let i = 1; i < points.length - 1; i++)
          v.push(...points[0], ...points[i], ...points[i + 1]);
        const membrane = new THREE.BufferGeometry();
        membrane.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(v, 3),
        );
        membrane.computeVertexNormals();
        membrane.setAttribute(
          "uv",
          new THREE.Float32BufferAttribute(
            new Array((v.length / 3) * 2).fill(0),
            2,
          ),
        );
        owned.add(membrane);
        add(wing, membrane, mat(accent, "membrane"), [0, 0, 0], [1, 1, 1]);
        for (let i = 0; i < 3; i++) {
          const end = points[3 + i],
            rib = tube([[-0.25, 0.3, side * 1.1], end], [0.045, 0.012], 6);
          owned.add(rib);
          add(wing, rib, mat(c), [0, 0, 0], [1, 1, 1]);
        }
      }
      mergeStatic(wing, owned);
      wings.push({ wing, side });
    }
  if (horse) {
    if (name !== "pegasus") {
      const hornGeo = tube(
        [
          [0.07, 0.4, 0],
          [0.22, 0.9, 0],
          [0.37, 1.45, 0],
        ],
        [0.12, 0.065, 0.002],
        12,
      );
      owned.add(hornGeo);
      add(head, hornGeo, mat(accent, "horn"), [0, 0, 0], [1, 1, 1]);
    }
    for (let i = 0; i < 10; i++)
      organic(
        body,
        accent,
        [0.55 + i * 0.05, h + 0.45 + i * 0.07, -0.045],
        [0.15, 0.2, 0.085],
        [0, 0, 0.3],
        "fur",
      );
  }
  if (dragon || (serpent && species.tier >= 6)) {
    for (const side of [-1, 1])
      horn(
        head,
        accent,
        [-0.25, 0.58, side * 0.24],
        [0.11, 0.7, 0.11],
        [side * 0.4, 0, 0.65],
      );
    for (let i = 0; i < 8; i++)
      horn(
        body,
        accent,
        [-1 + i * 0.25, h + 0.8, 0],
        [0.09, 0.35, 0.1],
        [0, 0, 0.25],
      );
  }
  if (name === "hydra" || name === "cerberus")
    for (const side of [-1, 1]) {
      const other = head.clone(true);
      other.position.z = side * 0.64;
      other.position.y -= 0.2;
      other.scale.setScalar(0.78);
      body.add(other);
    }
  mergeStatic(jaw, owned);
  mergeStatic(head, owned);
  mergeStatic(body, owned);
  const scale = species.size * 0.7;
  root.scale.setScalar(scale);
  root.userData = {
    body,
    head,
    headBaseX: headX,
    headBaseY: headY,
    headBaseZ: 0,
    jaw,
    legs,
    arms,
    wings,
    flippers,
    tails,
    species,
    baseScale: scale,
    decorative,
    skinId,
    phase: 0,
    speed: 0,
    lastX: null,
    lastY: null,
    attackBlend: 0,
    dispose() {
      owned.forEach((g) => g.dispose());
    },
  };
  root.userData.genomeKey = genomeAppearanceKey(genome);
  if (skinId === 'natural') {
    const pattern = root.userData.genomeKey.split(':')[1];
    if (pattern !== 'skin') root.traverse(obj => {
      const surface = material => material?.userData.surface === 'skin' ? mat(material.color.getHex(), pattern) : material;
      if (obj.material) obj.material = Array.isArray(obj.material) ? obj.material.map(surface) : surface(obj.material);
    });
  }
  return root;
}

export function animateCreature(
  model,
  dt,
  time,
  speed,
  attacking = false,
  turn = 0,
) {
  const d = model.userData,
    { body, head, jaw, legs, wings, tails, species } = d;
  const isJuv = d.isJuvenile || ((model.scale.x || 1) / (d.baseScale || 1)) < 0.68;
  const headScale = isJuv ? 1.32 : 1.0;
  head.scale.setScalar(headScale);
  jaw.scale.setScalar(headScale);
  const strideRate = isJuv ? 1.5 : 1.0;
  d.speed = THREE.MathUtils.damp(d.speed, Math.min(1.6, speed), 8, dt);
  d.phase +=
    (dt * (2 + d.speed * 8.5) * strideRate) / Math.sqrt(Math.max(0.7, species.size));
  d.attackBlend = THREE.MathUtils.damp(
    d.attackBlend,
    attacking ? 1 : 0,
    attacking ? 20 : 9,
    dt,
  );
  const phase = d.phase,
    stride = d.speed,
    quad = legs.length === 4;
  const breathSpeed = isJuv ? 3.2 : 2.0;
  const breathCycle = Math.sin(time * breathSpeed + (model.id || 0));
  body.scale.set(1 + breathCycle * 0.022, 1 + breathCycle * 0.034, 1 + breathCycle * 0.02);
  const breath = breathCycle * 0.024;
  const strike = d.attackBlend;

  const pelvicRoll = Math.sin(phase) * (quad ? 0.022 : 0.038) * stride;
  const pelvicYaw = Math.cos(phase) * (quad ? 0.014 : 0.026) * stride;
  const pelvicBounce = Math.abs(Math.sin(phase)) * 0.036 * stride;

  body.position.x = strike * 0.42 * Math.min(2.5, species.size);
  body.position.y =
    -pelvicBounce +
    Math.sin(time * 1.9 + model.id) * 0.018 +
    breath * 0.4 -
    strike * 0.12;
  body.position.z = Math.sin(phase) * 0.032 * stride;
  body.rotation.x = THREE.MathUtils.damp(body.rotation.x, -turn * 0.12, 7, dt);
  body.rotation.y = pelvicYaw;
  body.rotation.z = pelvicRoll - strike * 0.28;
  for (const leg of legs) {
    const offset = quad
      ? leg.front
        ? leg.side > 0
          ? 0
          : Math.PI
        : leg.side > 0
          ? Math.PI
          : 0
      : leg.side > 0
        ? 0
        : Math.PI;
    const cycle = phase + offset,
      wave = Math.sin(cycle);
    leg.upper.rotation.z = wave * 0.48 * stride;
    leg.knee.rotation.z = Math.max(0, -wave) * 0.66 * stride - 0.08;
    leg.upper.position.y =
      (species.body === "equine"
        ? 1.35
        : ["quad", "longneck", "dragon", "gryphon"].includes(species.body)
          ? 1
          : species.body === "croc"
            ? 0.45
            : 1.5) +
      Math.max(0, wave) * 0.045 * stride;
  }
  const baseHX = d.headBaseX ?? head.position.x;
  const baseHY = d.headBaseY ?? head.position.y;
  const windup = strike < 0.35 ? strike / 0.35 : 1 - (strike - 0.35) / 0.65;
  const strikeSnap = strike < 0.35 ? -strike * 0.35 : (strike - 0.35) * 1.5;
  const strikeDrop = strike * (species.body === "croc" ? 0.08 : 0.16);
  head.position.x = baseHX + strikeSnap * 0.45 * Math.min(2.2, species.size);
  head.position.y = Math.max(0.18, baseHY - strikeDrop + windup * 0.08);
  head.rotation.z =
    Math.sin(phase + 0.4) * 0.026 * stride +
    Math.sin(time * 0.9) * 0.025 -
    strike * (species.body === "croc" ? 0.18 : 0.38);
  head.rotation.y = THREE.MathUtils.damp(head.rotation.y, turn * 0.42 + Math.sin(strike * Math.PI) * 0.25, 9, dt);
  jaw.rotation.z = Math.max(-0.48, -strike * 0.48 + Math.sin(time * 2) * 0.014);

  if (stride < 0.4 && strike < 0.2) {
    const lookSeed = (model.id || 1) * 31.7;
    head.rotation.y += Math.sin(time * 0.45 + lookSeed * 1.6) * 0.22;
    head.rotation.x = Math.sin(time * 0.8 + lookSeed) * 0.12;
  }
  if (isJuv) {
    head.rotation.z += Math.sin(time * 3.8 + (model.id || 0)) * 0.05;
    head.rotation.y += Math.sin(time * 2.4 + (model.id || 0)) * 0.07;
  }
  if (stride < 0.18 && ["quad", "longneck"].includes(species.body) && strike < 0.1) {
    const graze = Math.max(0, Math.sin(time * 0.42 + (model.id || 0) * 11.0) - 0.35) * 1.5;
    head.position.y = Math.max(0.2, head.position.y - graze * 0.28);
    head.rotation.z += graze * 0.25;
    jaw.rotation.z -= Math.sin(time * 6.5) * graze * 0.08;
  }
  if (stride < 0.18 && ["rex", "raptor", "serpent", "croc"].includes(species.body) && strike < 0.1) {
    const sniff = Math.max(0, Math.sin(time * 0.5 + (model.id || 0) * 17.0) - 0.45) * 1.5;
    head.position.y = Math.max(0.18, head.position.y + sniff * 0.12);
    head.rotation.z -= sniff * 0.12;
    head.rotation.x += Math.sin(time * 9.0) * sniff * 0.06;
  }
  if (d.isSleeping) {
    head.position.y = Math.max(0.2, baseHY - 0.28);
    head.rotation.y += 0.72;
    head.rotation.z += 0.08;
    body.position.y -= 0.12;
  }

  for (const { arm, side } of d.arms || []) {
    arm.rotation.z = -strike * 0.95;
    arm.rotation.x = side * strike * 0.45;
  }
  for (const { wing, side } of wings || []) {
    wing.rotation.y = side * strike * 0.75;
    wing.rotation.z = -strike * 0.55;
  }
  tails.forEach((node, i) => {
    const frac = (i + 1) / Math.max(1, tails.length);
    const swayAmp = (species.body === "serpent" ? 0.22 : 0.08 + frac * 0.09) * (1 + stride * 0.65);
    const wave = Math.sin(phase * 0.65 - i * 0.42) * swayAmp;
    const turnInertia = -turn * (0.05 + frac * 0.14);
    const idleSway = Math.sin(time * 1.6 - i * 0.4 + (model.id || 0)) * (0.05 + frac * 0.06) * Math.max(0, 1 - stride);
    const strikeWhip = Math.sin(strike * Math.PI) * (species.body === "longneck" ? 0.95 : 0.45);
    node.rotation.y = wave + turnInertia + idleSway + strikeWhip;
    node.rotation.z = Math.sin(time * 1.3 - i * 0.24) * 0.018 - (stride > 0.3 && !quad ? 0.035 * frac : 0);
  });
  const impact = strike;
  if (species.body === "marine") {
    const isWet = d.isWet !== false;
    if (isWet) {
      body.rotation.x = Math.sin(phase * .65) * .05 * stride;
      body.position.y += Math.sin(phase * .6) * .04;
      for (const { fin, side, front } of d.flippers || []) {
        const row = Math.sin(phase * .85 + (front ? 0 : 1.7));
        fin.rotation.x = side * (.12 + row * (.12 + stride * .25));
        fin.rotation.y = side * row * .18 * stride;
      }
    } else {
      // Beached on dry land: belly rests flat on ground, flippers trail/struggle
      body.position.y -= 0.28;
      body.rotation.x = Math.sin(phase * 0.4) * 0.08 * stride;
      for (const { fin, side, front } of d.flippers || []) {
        const crawl = Math.sin(phase * 0.5 + (front ? 0 : 1.2));
        fin.rotation.x = side * (0.05 + crawl * 0.08 * stride);
        fin.rotation.y = -side * (0.35 - crawl * 0.12 * stride);
      }
    }
  }
  if (species.body === "raptor" || species.body === "bird")
    body.position.y += Math.sin(impact * Math.PI) * 0.3;
  if (species.body === "quad") {
    head.rotation.z -= impact * 0.22;
    body.rotation.z -= impact * 0.06;
  }
  if (species.body === "croc") body.rotation.x += impact * 0.22;
  if (species.body === "longneck") {
    head.rotation.z += impact * 0.16;
    body.position.y -= impact * 0.08;
  }
  if (species.body === "serpent")
    tails.forEach(
      (n, i) => (n.rotation.y += Math.sin(i * 0.6) * impact * 0.25),
    );
  if (["flame", "venom", "frost"].includes(species.abilityType)) {
    jaw.rotation.z -= impact * 0.22;
    head.rotation.z -= impact * 0.1;
  }
  const isFlying = d.isFlying;
  const isDiving = d.diveState === "diving";
  const flapFreq = species.size > 2.5 ? 4.5 : 5.8;
  const flapCycle = Math.sin(time * flapFreq + (model.id || 0) * 1.6);
  const flapCos = Math.cos(time * flapFreq + (model.id || 0) * 1.6);
  wings.forEach(({ wing, side }) => {
    if (isDiving) {
      wing.rotation.x = side * 0.15;
      wing.rotation.y = side * 0.58;
      wing.rotation.z = -0.32;
    } else if (isFlying) {
      const flapAmp = 0.52 + Math.min(0.22, stride * 0.35);
      wing.rotation.x = side * (0.08 + flapCycle * flapAmp);
      wing.rotation.y = side * (0.12 - flapCos * 0.18);
      wing.rotation.z = -flapCycle * 0.18;
    } else {
      wing.rotation.x = side * (0.12 + Math.sin(time * 2.2 + (model.id || 0)) * 0.12 + stride * 0.15);
      wing.rotation.y = side * 0.22;
      wing.rotation.z = Math.sin(time * 2.2) * 0.04;
    }
  });
}
