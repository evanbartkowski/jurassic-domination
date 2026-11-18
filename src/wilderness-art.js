import {createMarineActor,animateMarineActor} from './marine-presentation.js';
import{SPECIES_BY_ID}from'./data.js';
import{marineRoster,marineBodyLength}from'./marine-ecology.js';
import{anatomyForSpecies}from'./anatomy.js';
import * as THREE from "three";
import {naturalMaterial} from './natural-materials.js';
import {createFrontierFeature} from './frontier-art.js';
import { BOTANY } from './botany.js';
import { poolMaterial, biomeLook } from './environment-presentation.js';
import { biomeAt } from './world-data.js';
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { marinePose } from "./wilderness.js";
import { createDecoration } from "./collection-art.js";
export function createWildFeature(f, elevation = 0) {
  if(['frontier-rock','frontier-site','shelter'].includes(f.type))return createFrontierFeature(f);
  const root = new THREE.Group(),
    owned = [],
    materials = [];
  root.position.set(f.x, elevation, f.y);
  root.userData.feature = f;
  function mesh(geo, color, pos, scale) {
    const mat = naturalMaterial(f.type==='fallen-log'?'wood':f.type==='carnivore'||f.type==='toxic-bloom'?'leaf':'stone',color,{
      roughness: 0.78,
      metalness: 0,
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
  const rockTint=new THREE.Color(biomeLook(biomeAt(f.x,f.y).id).ground).lerp(new THREE.Color(0x9a9b8f),.65);
  if (f.type === "boulder") {
    mesh(
      BOTANY.rock[0].clone(),
      rockTint,
      [0, 0, 0],
      [f.radius, f.radius * 0.65, f.radius * 0.8],
    );
    root.children[0].material.vertexColors = true;
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
      BOTANY.log[0].clone(),
      0xffffff,
      [0, 0, 0],
    );
    log.material.vertexColors = true;
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
    if (f.subtype === "cave") {
      // Grand prehistoric cave mouth / rocky cavern alcove
      const caveArch = mesh(
        new THREE.SphereGeometry(f.radius * 0.75, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
        0x2c2d30,
        [0, 0, 0],
        [1.4, 0.9, 1.2],
      );
      const voidMouth = mesh(
        new THREE.CircleGeometry(f.radius * 0.55, 24),
        0x050608,
        [0, 1.2, 0.4],
        [1, 0.7, 1],
      );
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI - Math.PI / 2;
        mesh(
          new THREE.DodecahedronGeometry(1.2 + (i % 2) * 0.6),
          0x3a3b40,
          [Math.cos(a) * (f.radius * 0.68), 0.8, Math.sin(a) * (f.radius * 0.68)],
          [1.2, 0.9, 1.1],
        );
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI - 0.7;
        const shroom = mesh(
          new THREE.SphereGeometry(0.28, 12, 12),
          i % 2 ? 0x38bdf8 : 0x4ade80,
          [Math.cos(a) * (f.radius * 0.48), 0.4, Math.sin(a) * (f.radius * 0.48) + 0.3],
        );
        shroom.material.emissive.setHex(i % 2 ? 0x0284c7 : 0x16a34a);
        shroom.material.emissiveIntensity = 2.5;
      }
    } else {
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
    }
  } else if (f.type === "water") {
    const water = mesh(
      new THREE.CircleGeometry(f.radius, 64),
      0x246c78,
      [0, 0.1, 0],
    );
    water.rotation.x = -Math.PI / 2;
    water.material = poolMaterial(f.radius,biomeLook(biomeAt(f.x,f.y).id).water); materials.push(water.material);
    water.castShadow = false; water.receiveShadow = false;
    root.userData.waterSurface = water;
    const shore = mesh(
      new THREE.RingGeometry(f.radius, f.radius + 1.1, 64),
      0x827e58,
      [0, 0.08, 0],
    );
    shore.rotation.x = -Math.PI / 2;
    shore.material.roughness = .38;
    shore.material.color.setHex(0x65705c);
    root.userData.ripples = [];
    // Waves, foam and contact ripples share the water shader rather than rings.
    root.userData.swimmers=[];
    const makeMarine=(wrapper,id,index)=>{wrapper.userData.model?.userData.dispose();wrapper.clear();const species=SPECIES_BY_ID[id]||SPECIES_BY_ID.tideweaver,model=createMarineActor(species),profile=anatomyForSpecies(species),scale=marineBodyLength(f,index)/profile.length;model.scale.setScalar(scale);model.position.y=-Math.max(.5,Math.max(profile.head[1]+profile.skull[2],profile.hip+profile.depth)*scale*.75);wrapper.add(model);wrapper.userData.model=model;wrapper.userData.speciesId=species.id;};
    root.userData.makeMarine=makeMarine;
    for(let i=0;i<3;i++){const wrapper=new THREE.Group();makeMarine(wrapper,marineRoster(f)[i],i);root.add(wrapper);root.userData.swimmers.push(wrapper);}
  } else if (f.type === "volcano") {
    // Majestic prehistoric obsidian caldera with jagged rim crags
    const mountain = mesh(
      new THREE.CylinderGeometry(3.5, f.radius, 9.5, 48, 8, true),
      0x241d1a,
      [0, 4.75, 0],
    );
    // Jagged basalt crags encircling the caldera rim
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const cragHeight = 1.2 + (i % 3) * 0.7;
      mesh(
        new THREE.ConeGeometry(0.85, cragHeight, 5),
        0x191412,
        [Math.cos(a) * 3.4, 9.5 + cragHeight * 0.45, Math.sin(a) * 3.4],
        [1, 1, 1],
        [(i % 2 ? 0.2 : -0.2), a, 0],
      );
    }
    // High-temperature incandescent lava pool
    const lava = mesh(
      new THREE.CircleGeometry(3.4, 48),
      0xff6a00,
      [0, 9.55, 0],
    );
    lava.rotation.x = -Math.PI / 2;
    lava.material.emissive.setHex(0xff3300);
    lava.material.emissiveIntensity = 2.8;
    root.userData.lava = lava;

    // Glowing magma core center
    const core = mesh(
      new THREE.CircleGeometry(1.8, 32),
      0xffdf66,
      [0, 9.58, 0],
    );
    core.rotation.x = -Math.PI / 2;
    core.material.emissive.setHex(0xffaa22);
    core.material.emissiveIntensity = 3.5;
    root.userData.lavaCore = core;

    // Cascading lava rivers down the slopes
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + 0.3;
      const flow = mesh(
        new THREE.CylinderGeometry(0.25, 0.9, 13, 8),
        0xff4d00,
        [Math.cos(a) * (f.radius * 0.52), 4.2, Math.sin(a) * (f.radius * 0.52)],
      );
      flow.rotation.z = Math.sin(a) * 0.78;
      flow.rotation.x = Math.cos(a) * 0.78;
      flow.material.emissive.setHex(0xe62e00);
      flow.material.emissiveIntensity = 2.2;
    }

    // Rising smoke & ember plume column
    const smoke = mesh(
      new THREE.CylinderGeometry(1.2, 5.5, 14, 16, 1, true),
      0x251c19,
      [0, 16.5, 0],
    );
    smoke.material.transparent = true;
    smoke.material.opacity = 0.35;
    smoke.material.depthWrite = false;
    root.userData.smoke = smoke;
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
    root.userData.jawHalves = [];
    for (const side of [-1, 1]) {
      const half = new THREE.Group();head.add(half);root.userData.jawHalves.push(half);
      const m = mesh(
        sphere(),
        f.type === "carnivore" ? 0x903f44 : 0xb9815b,
        [0, 2.6, side * 0.45],
        [0.95, 0.42, 0.65],
      );
      root.attach(m);
      half.attach(m);
      for (let i = 0; i < 6; i++) {
        const tooth = mesh(new THREE.ConeGeometry(0.09, 0.42, 8), 0xded6ae, [
          (i - 2.5) * 0.29,
          2.9,
          side * 0.7,
        ]);
        half.attach(tooth);
      }
    }
  }
  if(f.type === 'carnivore') {
    const warning = mesh(new THREE.RingGeometry(.3,f.radius+3.2,48,1,-.55,1.1),0xff773f,[0,.12,0]);
    warning.rotation.x=-Math.PI/2;warning.material.emissive.setHex(0xff6622);warning.material.emissiveIntensity=1.3;warning.material.transparent=true;warning.material.opacity=.35;warning.material.depthWrite=false;warning.material.side=THREE.DoubleSide;
    warning.visible=false;root.userData.attackWarning=warning;
  }
  root.userData.animate = (t, player, marineState) => {
    if(root.userData.attackWarning){const w=root.userData.attackWarning;w.visible=!f.dead&&!!f.attackDueAt;w.rotation.z=-(f.attackAngle||0);w.material.opacity=.22+(Math.sin(t*16)+1)*.13;}
    root.userData.waterSurface?.material.userData.update(t,player,f);
    const marineDt=Math.max(0,Math.min(.1,t-(root.userData.lastMarineT??t)));root.userData.lastMarineT=t;
    root.userData.swimmers?.forEach((m,i)=>{const pose=marinePose(f,t,i,player,marineState);if(pose.speciesId&&pose.speciesId!==m.userData.speciesId)root.userData.makeMarine(m,pose.speciesId,i);const deathAge=pose.dead?Math.max(0,t-(pose.deadAt??((pose.respawnAt||t+35)-35))):0;m.visible=!pose.dead||deathAge<1.8;m.position.set(pose.x-f.x,.06-(pose.dead?deathAge*2:0),pose.y-f.y);m.rotation.y=-pose.angle;m.rotation.z=pose.dead?Math.min(1.7,deathAge*2):0;m.userData.model.userData.isDead=!!pose.dead;animateMarineActor(m.userData.model,marineDt,t,pose.dead?0:pose.hunting?1.3:.45,!!pose.attackWindup);});
    root.userData.ripples?.forEach((m, i) => {
      m.scale.setScalar(1 + Math.sin(t * 0.75 + i * 2.1 + f.phase) * 0.025);
      m.material.opacity = 0.1 + (Math.sin(t * 0.65 + i) + 1) * 0.055;
    });
    if (f.destroyed) {
      root.scale.set(1.2, 0.18, 1.2);
      root.position.y = -0.3;
      return;
    }
    if (f.dead && root.userData.jaw) {
      root.userData.jaw.rotation.z = Math.PI / 2.3;
      root.userData.jaw.position.y = 0.35;
      root.userData.jaw.scale.set(0.8, 0.35, 0.8);
      if (root.userData.prop) root.userData.prop.scale.set(1.2, 0.35, 1.2);
      return;
    }
    if (root.userData.lava) {
      root.userData.lava.material.emissiveIntensity = 2.4 + Math.sin(t * 3.5 + f.phase) * 0.8;
      if (root.userData.lavaCore) root.userData.lavaCore.material.emissiveIntensity = 3.2 + Math.cos(t * 4 + f.phase) * 1.1;
      if (root.userData.smoke) {
        root.userData.smoke.rotation.y = t * 0.15;
        root.userData.smoke.material.opacity = 0.28 + Math.sin(t * 1.8) * 0.08;
      }
    }
    if (root.userData.jaw) {
      if (f.type === "carnivore") {
        const px = player ? (player.x !== undefined ? player.x : player.position ? player.position.x : 0) : 0;
        const pz = player ? (player.y !== undefined ? player.y : player.z !== undefined ? player.z : player.position ? player.position.z : 0) : 0;
        const dPlayer = Math.hypot(px - f.x, pz - f.y);
        const near = dPlayer < f.radius + 4.5;
        const striking = f.lastStrike && (t - f.lastStrike) < 0.45;
        const strikeProg = striking ? 1 - (t - f.lastStrike) / 0.45 : 0;
        const winding = !!f.attackDueAt;
        const windup = winding ? THREE.MathUtils.clamp((t-f.attackStartedAt)/.8,0,1) : 0;
        const aimAngle = winding || striking ? f.attackAngle : near ? Math.atan2(pz - f.y, px - f.x) : f.phase;
        root.userData.jawHalves?.forEach((half,i)=>{half.position.z=(i===0?-1:1)*(winding?.25+windup*.55:striking?-.12:.1);});
        
        root.userData.jaw.rotation.y = THREE.MathUtils.damp(root.userData.jaw.rotation.y, -aimAngle, 6, 1/60);
        const lunge = striking ? Math.sin(strikeProg * Math.PI) * (f.radius+2) : winding ? -.5*windup : near ? 0.35 : 0;
        root.userData.jaw.position.x = Math.cos(aimAngle) * lunge;
        root.userData.jaw.position.z = Math.sin(aimAngle) * lunge;
        root.userData.jaw.rotation.z = striking
          ? Math.sin(strikeProg * Math.PI) * 0.8
          : near
            ? Math.sin(t * 7) * 0.25 - 0.2
            : Math.sin(t * 2 + f.phase) * 0.12;
      } else {
        root.userData.jaw.rotation.z = Math.sin(t + f.phase) * 0.17;
      }
    }
    if (root.userData.spore)
      root.userData.spore.position.y = 1 + Math.sin(t * 0.8 + f.phase) * 0.3;
  };
  root.userData.dispose = () => {
    root.userData.swimmers?.forEach(m=>m.userData.model.userData.dispose());
    owned.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    root.userData.prop?.userData.dispose();
  };
  return root;
}
