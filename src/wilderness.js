import {
  seeded,
  chunkSeed,
  biomeAt,
  CHUNK_SIZE,
  WORLD_RADIUS,
} from "./world-data.js";
import {frontierFeatures,blockedFrontierPoint,pathDistance,LOCATIONS} from './frontier-map.js';
import {MARINE_TRAITS,marineRoster,marineBodyLength} from './marine-ecology.js';
export function worldFeatures(seed, cx, cy) {
  const random = seeded(chunkSeed(seed, cx, cy) ^ 0x6a983b),
    items = [];
  for (let i = 0; i < 15; i++) {
    const x = (cx + 0.08 + random() * 0.84) * CHUNK_SIZE,
      y = (cy + 0.08 + random() * 0.84) * CHUNK_SIZE;
    if (Math.hypot(x, y) < 55 || Math.hypot(x, y) > WORLD_RADIUS - 20) continue;
    const region = biomeAt(x, y),
      type =
        i < 5
          ? "boulder"
          : i < 7
            ? "fallen-log"
            : i === 7
              ? "landmark"
              : i === 8
                ? region.id === "volcano"
                  ? "volcano"
                  : "water"
                : i < 11
                  ? "mushrooms"
                  : i < 13
                    ? "toxic-bloom"
                    : "carnivore";
    const subtype = type === "landmark" ? ((cx + cy + i) % 2 === 0 ? "cave" : "monolith") : null;
    const isLargeWater = (cx + cy + i) % 3 === 0;
    const radius =
      type === "water"
        ? (isLargeWater ? (22 + random() * 10) : (12 + random() * 5))
        : type === "volcano"
          ? 14
          : type === "boulder"
            ? 1.8 + random() * 2
            : type === "fallen-log"
              ? 3.5
              : type === "landmark"
                ? 4.5
                : type === "carnivore"
                  ? 2
                  : 1.5;
    items.push({
      id: `${cx},${cy}:${i}`,
      type,
      subtype,
      x,
      y,
      radius,
      tier: region.tier,
      solid: ["boulder", "fallen-log", "landmark"].includes(type),
      phase: random() * 6.28,
    });
  }
  const visible=items.filter(
    (f) =>
      ["water", "volcano"].includes(f.type) ||
      !items.some(
        (other) =>
          ["water", "volcano"].includes(other.type) &&
          Math.hypot(f.x - other.x, f.y - other.y) <
            other.radius + f.radius + 2,
      ),
  ).filter(f=>!(f.type==='water'&&blockedFrontierPoint(seed,f.x,f.y,f.radius+2))&&!(f.solid&&pathDistance(f.x,f.y)<12)&&!LOCATIONS.some(s=>s.kind!=='lagoon'&&Math.hypot(f.x-s.x,f.y-s.y)<s.radius));
  return [...visible,...frontierFeatures(seed,cx,cy).filter(f=>f.type!=='shelter'||!visible.some(w=>w.type==='water'&&Math.hypot(f.x-w.x,f.y-w.y)<w.radius+8))];
}
export function resolveObstacles(actor, size, features, onDemolish) {
  for (const f of features) {
    if(f.type==='shelter'){
      const padding=Math.min(.8,size*.25);
      for(const side of [-1,1]){const dx=actor.x-f.x-side*4.4,dy=actor.y-f.y;if(Math.abs(dx)<1.5+padding&&Math.abs(dy)<4.2+padding)actor.x=f.x+side*4.4+Math.sign(dx||-side)*(1.5+padding);}
    }
    if (!f.solid || f.destroyed) continue;
    const dx = actor.x - f.x,
      dy = actor.y - f.y,
      d = Math.hypot(dx, dy),
      r = f.radius + Math.min(3, size * 0.35);
    if (d < r) {
      const isMassive = size >= 2.8 || actor?.charging || actor?.dashing || actor?.sprinting;
      if (isMassive && (f.type === "boulder" || f.type === "fallen-log")) {
        f.destroyed = true;
        f.solid = false;
        if (typeof onDemolish === "function") onDemolish(f, actor);
        continue;
      }
      const angle = d > 0.001 ? Math.atan2(dy, dx) : 0;
      actor.x = f.x + Math.cos(angle) * r;
      actor.y = f.y + Math.sin(angle) * r;
    }
  }
}
export const MARINE_SWIMMERS = 3;
/** Demolition rewards use the same IDs, age and types as all other run loot. */
export function spawnDemolitionLoot(game, feature) {
  if (feature.type === 'fallen-log') {
    for (let i = 0; i < 3; i++) game.spawnFood('meat', feature.x + (i - 1) * 1.2,
      feature.y + ((i % 2) - .5) * 1.2, 20, { source: 'log-grubs', name: 'Log Grubs' });
  } else if (feature.type === 'boulder') {
    game.spawnFood('essence', feature.x, feature.y, 45, { source: 'amber-geode', name: 'Amber Essence' });
  }
  game.emit('obstacle-demolished', { feature });
}
export function marineSpeed(f, index, hunting = false) {
  return (hunting ? 5.2 : 3.2) + Math.min(7, f.tier || 0) * 0.25 + index * 0.24;
}
// Rendering only reads this state. Aggro changes a swimmer's destination, never its position.
export function marinePose(f, time, index, _player, marineState) {
  const swimmer = marineState?.get(f.id)?.swimmers[index];
  if (swimmer) return swimmer;
  const a = time * (0.3 + index * 0.07) + index * 2.1 + f.phase,
    r = f.radius * (0.45 + index * 0.12);
  return {
    x: f.x + Math.cos(a) * r,
    y: f.y + Math.sin(a) * r,
    angle: a + Math.PI / 2,
    hunting: false,
  };
}
function swim(f, game, dt) {
  const states = (game.marineState ||= new Map());
  let state = states.get(f.id);
  if (!state) {
    state = {
      swimmers: Array.from({ length: MARINE_SWIMMERS }, (_, i) => {
        const pose = marinePose(f, Math.max(0, game.time - dt), i);
        const speciesId=marineRoster(f)[i],traits=MARINE_TRAITS[speciesId]||{},maxHp=(50+(f.tier||0)*35)*(traits.hp||1);
        return {
          ...pose,
          id: `${f.id}:swimmer:${i}`,
          poolId: f.id,
          index: i,
          speciesId,
          name: speciesId.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' '),
          hp: maxHp,
          maxHp,
          tier: f.tier || 0,
        };
      }),
    };
    states.set(f.id, state);
  }
  const p = game.player,
    playerDistToCenter = Math.hypot(p.x - f.x, p.y - f.y),
    // Water predators strictly hunt only if player is actually inside deep water
    playerInDeepWater = playerDistToCenter <= Math.max(1, f.radius - 2.2),
    hunting = playerInDeepWater;
  for (let i = 0; i < state.swimmers.length; i++) {
    const fish = state.swimmers[i];
    if (fish.dead) {
      if (game.time >= (fish.respawnAt || 0)) {
        fish.dead = false;
        fish.maxHp = (50 + (f.tier || 0) * 35)*(MARINE_TRAITS[fish.speciesId]?.hp||1);
        fish.hp = fish.maxHp;
        fish.deadAt = null;
        fish.hunting = false;
        fish.attackWindup = 0;
        fish.biteReadyUntil = 0;
        fish.attackCooldown = 1;
      } else {
        continue;
      }
    }
    const canHunt=!MARINE_TRAITS[fish.speciesId]?.passive||(fish.angeredUntil||0)>game.time;
    const patrol = marinePose(f, game.time, i),
      target = hunting&&canHunt ? p : patrol;
    let tx = target.x - f.x,
      ty = target.y - f.y;
    // Keep the entire predator strictly submerged in its pool, away from the dry bank.
    const targetRadius = Math.hypot(tx, ty),
      limit = Math.max(1, f.radius - Math.max(3,marineBodyLength(f,i)*.55));
    if (targetRadius > limit) {
      tx *= limit / targetRadius;
      ty *= limit / targetRadius;
    }
    const dx = f.x + tx - fish.x,
      dy = f.y + ty - fish.y,
      distance = Math.hypot(dx, dy),
      desired = Math.atan2(dy, dx),
      turn = Math.atan2(Math.sin(desired - fish.angle), Math.cos(desired - fish.angle)),
      maxTurn = dt * (hunting ? 2.8 : 1.9);
    if(!(fish.attackWindup>0)&&!(fish.biteReadyUntil>game.time))fish.angle += Math.max(-maxTurn, Math.min(maxTurn, turn));
    const step = Math.min(distance, marineSpeed(f, i, hunting)*(MARINE_TRAITS[fish.speciesId]?.speed||1) * dt * (fish.attackWindup>0?.15:1)),
      nx = fish.x + Math.cos(fish.angle) * step,
      ny = fish.y + Math.sin(fish.angle) * step;
    // Reject an outward step instead of snapping back to the water boundary.
    if (Math.hypot(nx - f.x, ny - f.y) <= limit) {
      fish.x = nx;
      fish.y = ny;
    }
    fish.hunting = hunting&&canHunt;
    fish.attackCooldown=Math.max(0,(fish.attackCooldown||0)-dt);
    if(fish.hunting&&Math.hypot(fish.x-p.x,fish.y-p.y)<marineBodyLength(f,i)*.42+3&&fish.attackCooldown===0&&!fish.attackWindup){fish.attackWindup=.48;fish.attackAngle=fish.angle;}
    if(fish.attackWindup>0){fish.attackWindup=Math.max(0,fish.attackWindup-dt);if(fish.attackWindup===0){fish.biteReadyUntil=game.time+.18;fish.attackCooldown=1.5;}}
  }
  return state;
}
export function updateWildlife(game, dt) {
  const p = game.player,
    features = game.worldFeatures || [];
  resolveObstacles(p, game.effectiveSize || game.species.size, features,
    feature => spawnDemolitionLoot(game, feature));
  game._hazardCooldown = Math.max(0, (game._hazardCooldown || 0) - dt);
  game.hazardHint = "";
  const activePools = new Set();
  for (const f of features) {
    if (f.type === "water") {
      activePools.add(f.id);
      swim(f, game, Math.max(0, Math.min(0.1, dt)));
    }
    const d = Math.hypot(p.x - f.x, p.y - f.y);
    if (d > f.radius + 8 && !f.attackDueAt) continue;
    if (f.type === "water" && d < f.radius) {
      const aquatic = game.species.body === 'marine', amphibious = game.species.body === 'croc';
      const drag = aquatic ? .2 : amphibious ? .7 : 2.7;
      p.vx *= Math.exp(-dt * drag);
      p.vy *= Math.exp(-dt * drag);
      game.hazardHint = p.submerged ? 'SUBMERGED · QUIET MOVEMENT' : "DEEP WATER · MARINE PREDATORS";
      let contactingDamage=1;
      if (
        game._hazardCooldown === 0 &&
        d <= f.radius - 2.0 &&
        [0, 1, 2].some((i) => {
          const fish = marinePose(f, game.time, i, p, game.marineState);
          if (!fish || fish.dead||!fish.hunting||!(fish.biteReadyUntil>0)||fish.biteReadyUntil<game.time) return false;
          const contact=(
            Math.hypot(
              fish.x + Math.cos(fish.angle) * marineBodyLength(f,i)*.36 - p.x,
              fish.y + Math.sin(fish.angle) * marineBodyLength(f,i)*.36 - p.y,
            ) < 1.35 + (game.effectiveSize || game.species.size) * 0.3
          );
          if(contact)contactingDamage=MARINE_TRAITS[fish.speciesId]?.damage||1;return contact;
        })
      ) {
        game.damagePlayer(
          (11 + f.tier * 6) * contactingDamage * game.rules.enemyDamage * (aquatic ? p.submerged ? .25 : .5 : amphibious ? .7 : 1),
          "Marine predator bite",
        );
        game._hazardCooldown = 1.0;
        game.emit("water-bite", { x: p.x, y: p.y });
      }
    }
    if (["toxic-bloom", "mushrooms"].includes(f.type) && d < f.radius + 1) {
      game.hazardHint =
        f.type === "mushrooms" ? "TOXIC SPORES" : "POISONOUS BLOOM";
      p.poisoned = Math.max(p.poisoned, 4);
    }
    if (f.type === "carnivore" && !f.dead) {
      if (d < f.radius + 5) game.hazardHint = f.attackDueAt ? "SNAPJAW WINDUP � SIDESTEP" : "CARNIVOROUS PLANT";
      if (f.attackDueAt && game.time >= f.attackDueAt) {
        f.attackDueAt = 0;
        f.lastStrike = game.time;
        f.nextAttackAt = game.time + 1.6;
        const angle = Math.atan2(p.y-f.y,p.x-f.x);
        const delta = Math.atan2(Math.sin(angle-f.attackAngle),Math.cos(angle-f.attackAngle));
        if (d < f.radius + 3.2 && Math.abs(delta) < .55 && !(p.invulnerable > 0)) {
          game.damagePlayer((9 + f.tier * 5) * game.rules.enemyDamage, "Snapjaw pitcher");
          p.poisoned = 3;
        }
        game.emit("plant-bite", { x: f.x, y: f.y });
      } else if (!f.attackDueAt && d < f.radius + 3.2 && game.time >= (f.nextAttackAt || 0)) {
        f.attackStartedAt = game.time;
        f.attackDueAt = game.time + .8;
        f.attackAngle = Math.atan2(p.y-f.y,p.x-f.x);
      }
    }
    if (f.type === "volcano" && d < f.radius) {
      game.hazardHint = "ACTIVE CALDERA";
      if (game._hazardCooldown === 0) {
        game.damagePlayer(15 + f.tier * 5, "Caldera heat");
        game._hazardCooldown = 0.65;
      }
    }
  }
  // Streamed pools cannot accumulate simulation state throughout an entire expedition.
  if (game.marineState)
    for (const id of game.marineState.keys())
      if (!activePools.has(id)) game.marineState.delete(id);
}
