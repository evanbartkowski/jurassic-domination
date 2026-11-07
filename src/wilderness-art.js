import * as THREE from "three";
import { marinePose } from "./wilderness.js";
import { createDecoration } from "./collection-art.js";
export function createWildFeature(f) {
  const root = new THREE.Group(),
    owned = [],
    materials = [];
  root.position.set(f.x, 0, f.y);
  root.userData.feature = f;
  function mesh(geo, color, pos, scale) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.78,
      metalness: 0.04,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    owned.push(geo);
    materials.push(mat);
    return m;
  }
  const sphere = () => new THREE.SphereGeometry(1, 20, 14);
  if (f.type === "boulder") {
    mesh(
      new THREE.DodecahedronGeometry(1, 2),
      0x787c6d,
      [0, f.radius * 0.48, 0],
      [f.radius, f.radius * 0.65, f.radius * 0.8],
    );
    for (let i = 0; i < 5; i++)
      mesh(
        sphere(),
        0x62734e,
        [
          Math.cos(i * 2) * f.radius * 0.7,
          0.4,
          Math.sin(i * 2) * f.radius * 0.6,
        ],
        [0.6, 0.18, 0.7],
      );
  } else if (f.type === "fallen-log") {
    const log = mesh(
      new THREE.CylinderGeometry(0.8, 1, 7, 20),
      0x5c4934,
      [0, 0.75, 0],
    );
    log.rotation.z = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const ring = mesh(
        new THREE.TorusGeometry(0.55 - i * 0.1, 0.025, 5, 32),
        0x927a52,
        [3.51, 0.75, 0],
      );
      ring.rotation.y = Math.PI / 2;
    }
    mesh(sphere(), 0x6b7b4e, [0, 1.4, 0], [2.6, 0.2, 0.8]);
  } else if (f.type === "landmark") {
    const prop = createDecoration("ruins");
    prop.scale.setScalar(2);
    root.add(prop);
    root.userData.prop = prop;
    for (let i = 0; i < 4; i++)
      mesh(new THREE.BoxGeometry(0.7, 3, 0.7), 0x7e8b7c, [
        Math.cos((i * Math.PI) / 2) * 3,
        1.5,
        Math.sin((i * Math.PI) / 2) * 3,
      ]);
  } else if (f.type === "water") {
    const water = mesh(
      new THREE.CircleGeometry(f.radius, 64),
      0x255b63,
      [0, 0.1, 0],
    );
    water.rotation.x = -Math.PI / 2;
    water.material.metalness = 0.4;
    water.material.roughness = 0.2;
    const shore = mesh(
      new THREE.RingGeometry(f.radius, f.radius + 1.1, 64),
      0x827e58,
      [0, 0.08, 0],
    );
    shore.rotation.x = -Math.PI / 2;
    root.userData.swimmers = [];
    for (let i = 0; i < 3; i++) {
      const fish = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 12),
        new THREE.MeshStandardMaterial({ color: 0x34505a, roughness: 0.5 }),
      );
      owned.push(body.geometry);
      materials.push(body.material);
      body.scale.set(2, 0.23, 0.48);
      fish.add(body);
      const fin = new THREE.Mesh(
        new THREE.ConeGeometry(0.38, 0.9, 3),
        body.material,
      );
      owned.push(fin.geometry);
      fin.position.set(-0.2, 0.45, 0);
      fish.add(fin);
      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.65, 1, 3),
        body.material,
      );
      owned.push(tail.geometry);
      tail.position.x = -2;
      tail.rotation.z = Math.PI / 2;
      fish.add(tail);
      root.add(fish);
      root.userData.swimmers.push(fish);
    }
  } else if (f.type === "volcano") {
    const mountain = mesh(
      new THREE.CylinderGeometry(2, f.radius, 8, 48, 8, true),
      0x4a4642,
      [0, 4, 0],
    );
    const lava = mesh(
      new THREE.CircleGeometry(2.1, 40),
      0xff6228,
      [0, 8.05, 0],
    );
    lava.rotation.x = -Math.PI / 2;
    lava.material.emissive.setHex(0xff3f0a);
    lava.material.emissiveIntensity = 2;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.256;
      const flow = mesh(
        new THREE.CylinderGeometry(0.12, 0.5, 12, 12),
        0xff6228,
        [Math.cos(a) * 4.8, 3, Math.sin(a) * 4.8],
      );
      flow.rotation.z = Math.sin(a) * 0.65;
      flow.rotation.x = Math.cos(a) * 0.65;
      flow.material.emissive.setHex(0xc7350a);
    }
  } else if (f.type === "mushrooms") {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4,
        r = i * 0.18;
      mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 0.65 + i * 0.04, 10),
        0xbdb78f,
        [Math.cos(a) * r, 0.32, Math.sin(a) * r],
      );
      mesh(
        new THREE.SphereGeometry(
          0.3 + i * 0.018,
          20,
          12,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2,
        ),
        0x8d58a6,
        [Math.cos(a) * r, 0.68 + i * 0.04, Math.sin(a) * r],
      );
    }
    root.userData.spore = mesh(sphere(), 0xa7b36e, [0, 1, 0], [1.8, 0.45, 1.8]);
    root.userData.spore.material.transparent = true;
    root.userData.spore.material.opacity = 0.12;
    root.userData.spore.material.depthWrite = false;
  } else {
    const fern = createDecoration("fern");
    fern.scale.setScalar(f.type === "carnivore" ? 2 : 1.5);
    root.add(fern);
    root.userData.prop = fern;
    const stalk = mesh(
      new THREE.CylinderGeometry(0.15, 0.4, 2.5, 16),
      0x547b43,
      [0, 1.2, 0],
    );
    const head = new THREE.Group();
    head.position.y = 2.6;
    root.add(head);
    root.userData.jaw = head;
    for (const side of [-1, 1]) {
      const m = mesh(
        sphere(),
        f.type === "carnivore" ? 0x903f44 : 0xb9815b,
        [0, 2.6, side * 0.45],
        [0.95, 0.42, 0.65],
      );
      root.attach(m);
      head.attach(m);
      for (let i = 0; i < 6; i++) {
        const tooth = mesh(new THREE.ConeGeometry(0.09, 0.42, 8), 0xded6ae, [
          (i - 2.5) * 0.29,
          2.9,
          side * 0.7,
        ]);
        head.attach(tooth);
      }
    }
  }
  root.userData.animate = (t, player) => {
    root.userData.swimmers?.forEach((m, i) => {
      const pose = marinePose(f, t, i, player);
      m.position.set(pose.x - f.x, 0.18, pose.y - f.y);
      m.rotation.y = -pose.angle;
    });
    if (root.userData.jaw)
      root.userData.jaw.rotation.z =
        Math.sin(t * (f.type === "carnivore" ? 3 : 1) + f.phase) * 0.17;
    if (root.userData.spore)
      root.userData.spore.position.y = 1 + Math.sin(t * 0.8 + f.phase) * 0.3;
  };
  root.userData.dispose = () => {
    owned.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    root.userData.prop?.userData.dispose();
  };
  return root;
}
