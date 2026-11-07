import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LANDMARKS } from "./discoveries.js";
import { worldStatus } from "./world-events.js";

const TRAIL_LIMIT = 96, NEST_LIMIT = 9, SCAR_LIMIT = 16, PARTICLE_LIMIT = 240;
const TAU = Math.PI * 2;
const fract = (value) => value - Math.floor(value);

/** Fixed-size visual pools. Rendering never changes simulation or consumes its RNG. */
export function createEcologyArt(scene) {
  const root = new THREE.Group(); root.name = "Living ecosystem"; root.visible = false; scene.add(root);
  const geometries = new Set(), materials = new Set(), palette = new Map(), transform = new THREE.Object3D(), color = new THREE.Color();
  let disposed = false;
  const own = (geometry) => { geometries.add(geometry); return geometry; };
  function material(value, options = {}) {
    const key = `${value}:${JSON.stringify(options)}`;
    if (!palette.has(key)) {
      const result = new THREE.MeshStandardMaterial({ color: value, roughness: 0.92, ...options });
      palette.set(key, result); materials.add(result);
    }
    return palette.get(key);
  }
  const box = own(new THREE.BoxGeometry(1, 1, 1)),
    bone = own(new THREE.CylinderGeometry(1, 1, 1, 6)),
    pebble = own(new THREE.IcosahedronGeometry(1, 0)),
    circle = own(new THREE.CircleGeometry(1, 18)),
    ring = own(new THREE.RingGeometry(0.97, 1, 64));
  function pool(geometry, mat, count, name) {
    const mesh = new THREE.InstancedMesh(geometry, mat, count); mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
    root.add(mesh); return mesh;
  }
  function instance(mesh, index, x, height, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    transform.position.set(x, height, z); transform.scale.set(sx, sy, sz); transform.rotation.set(rx, ry, rz);
    transform.updateMatrix(); mesh.setMatrixAt(index, transform.matrix);
  }
  function finish(mesh, count) { mesh.count = count; mesh.visible = count > 0; mesh.instanceMatrix.needsUpdate = true; }

  const foot = new THREE.Shape();
  foot.moveTo(-0.14, -0.3); foot.lineTo(-0.24, 0.02); foot.lineTo(-0.4, 0.28);
  foot.lineTo(-0.19, 0.17); foot.lineTo(-0.1, 0.5); foot.lineTo(0, 0.16);
  foot.lineTo(0.16, 0.42); foot.lineTo(0.13, 0.07); foot.lineTo(0.17, -0.2); foot.closePath();
  const footprints = pool(own(new THREE.ShapeGeometry(foot)), material(0x31412c, { transparent: true, opacity: 0.68, depthWrite: false, side: THREE.DoubleSide }), TRAIL_LIMIT, "Footprints"),
    blood = pool(circle, material(0x701e22, { transparent: true, opacity: 0.73, depthWrite: false, side: THREE.DoubleSide }), TRAIL_LIMIT, "Blood trails"),
    twigs = pool(bone, material(0x735030), NEST_LIMIT * 18, "Woven nest branches"),
    nestBeds = pool(circle, material(0x826443, { side: THREE.DoubleSide }), NEST_LIMIT, "Nesting hollows"),
    scars = pool(circle, material(0x292820, { transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide }), SCAR_LIMIT, "Weather scars");
  const hazardMaterial = material(0xf8bd72, { emissive: 0xf2a24b, emissiveIntensity: 0.8, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    hazardRing = new THREE.Mesh(ring, hazardMaterial),
    hazardGround = new THREE.Mesh(circle, material(0x743d20, { emissive: 0xa64212, emissiveIntensity: 0.35, transparent: true, opacity: 0.17, depthWrite: false, side: THREE.DoubleSide }));
  hazardRing.name = "Forecast impact boundary"; hazardGround.name = "Forecast impact ground";
  hazardRing.rotation.x = hazardGround.rotation.x = -Math.PI / 2; root.add(hazardRing, hazardGround);

  function landmarkModel(landmark, index) {
    const group = new THREE.Group(); group.name = landmark.name; group.position.set(landmark.x, 0, landmark.y);
    const batches = new Map();
    function shape(geometry, mat, position, scale, rotation = [0, 0, 0]) {
      transform.position.set(...position); transform.scale.set(...scale); transform.rotation.set(...rotation); transform.updateMatrix();
      let copy = geometry.clone().applyMatrix4(transform.matrix);
      if (copy.index) { const indexed = copy; copy = copy.toNonIndexed(); indexed.dispose(); }
      if (!batches.has(mat)) batches.set(mat, []); batches.get(mat).push(copy);
    }
    const stone = material(0x778071), moss = material(0x3d6141), ivory = material(0xc8ba91), glyph = material(landmark.color, { emissive: landmark.color, emissiveIntensity: 0.35 });
    if (landmark.kind === "fossil") {
      for (let i = 0; i < 8; i++) {
        const along = (i - 3.5) * 1.25;
        shape(pebble, ivory, [along, 0.42, 0], [0.72, 0.42, 0.52]);
        if (i < 6) for (const side of [-1, 1]) shape(bone, ivory, [along, 0.38, side * 1.45], [0.16, 2.6, 0.16], [Math.PI / 2, 0, side * 0.22]);
      }
      shape(pebble, ivory, [5.8, 0.55, 0], [1.9, 0.65, 0.94]);
      for (let i = 0; i < 5; i++) shape(pebble, stone, [Math.cos(i * 2.7) * 5.8, 0.15, Math.sin(i * 2.7) * 3.5], [0.8, 0.4, 0.6]);
    } else {
      const standing = landmark.kind === "standing-stones";
      for (let i = 0; i < (standing ? 7 : 6); i++) {
        const angle = i * TAU / (standing ? 7 : 6), height = 3.5 + fract((i + index) * 0.75487) * 2.8,
          x = Math.cos(angle) * 5, z = Math.sin(angle) * 5;
        shape(box, stone, [x, height / 2, z], [1.5, height, 1.35], [0.02, angle, i % 3 === 0 ? 0.09 : -0.025]);
        shape(pebble, moss, [x, 0.3, z], [1.3, 0.4, 1.1]);
        if (!standing && i % 2 === 0) shape(box, stone, [x * 0.8, height, z * 0.8], [4.2, 0.65, 1.8], [0, angle + Math.PI / 2, 0.04]);
        shape(box, glyph, [x * 0.83, height * 0.6, z * 0.83], [0.12, 1.1, 0.12], [0, angle, 0.22]);
      }
      shape(box, stone, [0, 0.28, 0], [5, 0.55, 5]);
      shape(box, glyph, [0, 0.57, 0], [2.5, 0.07, 0.2], [0, 0.7, 0]);
    }
    for (const [mat, parts] of batches) {
      const geometry = own(mergeGeometries(parts, false)); parts.forEach((part) => part.dispose());
      const mesh = new THREE.Mesh(geometry, mat); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
    }
    const halo = new THREE.Mesh(ring, material(landmark.color, { emissive: landmark.color, emissiveIntensity: 0.8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = 0.12; halo.scale.setScalar(8); group.add(halo); group.userData.halo = halo;
    root.add(group); return { landmark, group };
  }
  const landmarks = LANDMARKS.map(landmarkModel);
  const dropsGeometry = own(new THREE.BufferGeometry()), motesGeometry = own(new THREE.BufferGeometry()),
    dropsData = new Float32Array(PARTICLE_LIMIT * 6), motesData = new Float32Array(PARTICLE_LIMIT * 3);
  dropsGeometry.setAttribute("position", new THREE.BufferAttribute(dropsData, 3).setUsage(THREE.DynamicDrawUsage));
  motesGeometry.setAttribute("position", new THREE.BufferAttribute(motesData, 3).setUsage(THREE.DynamicDrawUsage));
  const rainMaterial = new THREE.LineBasicMaterial({ color: 0x94cce1, transparent: true, opacity: 0.36, depthWrite: false }),
    moteMaterial = new THREE.PointsMaterial({ color: 0xc7d0cb, size: 0.16, transparent: true, opacity: 0.66, depthWrite: false });
  materials.add(rainMaterial); materials.add(moteMaterial);
  const rain = new THREE.LineSegments(dropsGeometry, rainMaterial), motes = new THREE.Points(motesGeometry, moteMaterial);
  rain.frustumCulled = motes.frustumCulled = false; rain.name = "Seasonal rain"; motes.name = "Windborne weather"; root.add(rain, motes);

  function update(game, dt = 0, detail = "high") {
    if (disposed) return;
    root.visible = !!game?.player;
    if (!root.visible) return;
    const p = game.player, time = game.time || 0, trailBudget = detail === "low" ? 40 : TRAIL_LIMIT;
    let footCount = 0, bloodCount = 0, twigCount = 0, nestCount = 0, scarCount = 0;
    for (const trail of (game.senses?.trails || []).slice(-trailBudget)) {
      if (trail.expiresAt <= time || Math.hypot(trail.x - p.x, trail.y - p.y) > 85) continue;
      const fade = Math.max(0.1, Math.min(1, (trail.expiresAt - time) / 5));
      if (trail.kind === "footprint") {
        instance(footprints, footCount++, trail.x, 0.12, trail.y, 0.65 * fade, 0.65 * fade, 0.65 * fade, -Math.PI / 2, 0, -(trail.angle || 0) - Math.PI / 2);
      } else if (trail.kind === "blood") {
        instance(blood, bloodCount++, trail.x, 0.13, trail.y, 0.52 * fade, 0.3 * fade, 1, -Math.PI / 2, 0, trail.angle || 0);
      }
    }
    for (const nest of (game.nests || []).slice(0, NEST_LIMIT)) {
      if (Math.hypot(nest.x - p.x, nest.y - p.y) > 120) continue;
      instance(nestBeds, nestCount++, nest.x, 0.07, nest.y, 2.8, 2.8, 1, -Math.PI / 2);
      for (let i = 0; i < 18; i++) {
        const angle = i * TAU / 18, radius = 2.55 + Math.sin(i * 4.4) * 0.2;
        instance(twigs, twigCount++, nest.x + Math.cos(angle) * radius, 0.2 + i % 3 * 0.06, nest.y + Math.sin(angle) * radius, 0.1, 1.65, 0.1, Math.PI / 2, 0, -angle);
      }
    }
    const status = game.worldState ? worldStatus(game) : null;
    for (const scar of game.worldState?.scars || []) {
      if (Math.hypot(scar.x - p.x, scar.y - p.y) > scar.radius + 150) continue;
      if (scarCount >= SCAR_LIMIT) break;
      instance(scars, scarCount, scar.x, 0.06, scar.y, scar.radius, scar.radius * 0.92, 1, -Math.PI / 2, 0, scar.at || 0);
      color.setHex(scar.event === "meteor" ? 0x343033 : scar.event === "eruption" ? 0x423229 : 0x393528); scars.setColorAt(scarCount++, color);
    }
    finish(footprints, footCount); finish(blood, bloodCount); finish(twigs, twigCount); finish(nestBeds, nestCount); finish(scars, scarCount);
    if (scars.instanceColor) scars.instanceColor.needsUpdate = true;
    const hazard = status?.hazard, hazardVisible = !!hazard && Math.hypot(hazard.x - p.x, hazard.y - p.y) < 160 + hazard.radius;
    hazardRing.visible = hazardGround.visible = hazardVisible;
    if (hazardVisible) {
      hazardRing.position.set(hazard.x, 0.14, hazard.y); hazardGround.position.set(hazard.x, 0.08, hazard.y);
      hazardRing.scale.setScalar(hazard.radius); hazardGround.scale.setScalar(hazard.radius);
      hazardMaterial.color.setHex(hazard.color); hazardMaterial.emissive.setHex(hazard.color);
      hazardMaterial.opacity = hazard.active ? 0.72 : 0.45 + Math.sin(time * 3) * 0.17;
    }
    for (const { landmark, group } of landmarks) {
      group.visible = Math.hypot(landmark.x - p.x, landmark.y - p.y) < (detail === "low" ? 100 : 150);
      if (group.visible) group.userData.halo.visible = !!game.exploration?.discoveries.some((record) => record.id === landmark.id);
    }
    const weather = status?.phase === "active" ? status.event : "clear",
      rainy = ["rain", "flood"].includes(weather), dusty = ["frost", "ashfall", "fire", "eruption"].includes(weather),
      particleCount = detail === "low" ? 48 : detail === "medium" ? 120 : PARTICLE_LIMIT;
    rain.visible = rainy; motes.visible = dusty;
    if (rainy || dusty) {
      const wind = status.wind, speed = rainy ? 18 : weather === "frost" ? 1.6 : 2.8;
      for (let i = 0; i < particleCount; i++) {
        const phase = fract(i * 0.618033 + time * speed / 25),
          x = p.x + (fract(i * 0.754877 + time * wind.x * 0.004) - 0.5) * 85,
          z = p.y + (fract(i * 0.56984 + time * wind.y * 0.004) - 0.5) * 85,
          height = 2 + (1 - phase) * 25;
        if (rainy) {
          dropsData.set([x, height, z, x + wind.x * 0.35, height - 1.4, z + wind.y * 0.35], i * 6);
        } else {
          motesData[i * 3] = x; motesData[i * 3 + 1] = height; motesData[i * 3 + 2] = z;
        }
      }
      if (rainy) { dropsGeometry.setDrawRange(0, particleCount * 2); dropsGeometry.attributes.position.needsUpdate = true; }
      else {
        motesGeometry.setDrawRange(0, particleCount); motesGeometry.attributes.position.needsUpdate = true;
        moteMaterial.color.setHex(weather === "frost" ? 0xe5f5ff : ["fire", "eruption"].includes(weather) ? 0xf6a05a : 0xc1bab0);
        moteMaterial.size = weather === "frost" ? 0.2 : 0.13;
      }
    }
    root.userData.counts = { footprints: footCount, blood: bloodCount, nests: nestCount, scars: scarCount, weather: rainy || dusty ? particleCount : 0 };
  }
  function dispose() {
    if (disposed) return; disposed = true; scene.remove(root);
    root.traverse((object) => { if (object.isInstancedMesh) object.dispose(); });
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((mat) => mat.dispose());
    root.clear();
  }
  return { root, update, dispose };
}
