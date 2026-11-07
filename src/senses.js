import { SPECIES_BY_ID } from "./data.js";
import { hasLineOfSight } from "./combat.js";
import { conditionsAt } from "./world-events.js";
import { phenotype } from "./genetics.js";

export const MAX_TRAILS = 96;
export const SENSE_INTERVAL = 0.25;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function initializeSenses(game) {
  game.senses = {
    windAngle: ((game.seed >>> 4) % 628) / 100,
    trails: [], lastPlayerX: game.player.x, lastPlayerY: game.player.y,
    nextTrailAt: 0, nextNoiseAt: 0, nextBloodAt: 0,
  };
}

/** Nearby trunks, rocks and low vegetation interrupt a crouching silhouette. */
export function terrainCover(game, actor = game.player) {
  let cover = 0;
  for (const feature of game.worldFeatures || []) {
    const weight = feature.type === "fallen-log" ? 0.8
      : feature.type === "boulder" ? 0.65
        : ["mushrooms", "toxic-bloom"].includes(feature.type) ? 0.45 : 0;
    if (!weight) continue;
    const gap = distance(actor, feature) - feature.radius;
    if (gap < 4) cover = Math.max(cover, weight * Math.max(0, 1 - Math.max(0, gap) / 4));
  }
  return cover;
}

function leaveTrail(game, kind, x, y, strength, lifetime, sourceId) {
  if (!game.senses) initializeSenses(game);
  const trail = { kind, x, y, strength, sourceId, angle: game.player.angle || 0, createdAt: game.time, expiresAt: game.time + lifetime };
  game.senses.trails.push(trail);
  if (game.senses.trails.length > MAX_TRAILS) game.senses.trails.splice(0, game.senses.trails.length - MAX_TRAILS);
  return trail;
}
export function recordNoise(game, x, y, strength = 1, sourceId = "player") {
  return leaveTrail(game, "sound", x, y, Math.max(0.1, Math.min(3, strength)), 2.4, sourceId);
}
export function recordBlood(game, x, y, sourceId = "player") {
  return leaveTrail(game, "blood", x, y, 1.4, 18, sourceId);
}

export function updateSenses(game, dt, input = {}) {
  if (!game.senses) initializeSenses(game);
  const state = game.senses, p = game.player, time = game.time,
    weather = conditionsAt(game, p.x, p.y);
  state.windAngle = weather.wind.angle;
  state.trails = state.trails.filter((trail) => trail.expiresAt > time);
  const moved = Math.hypot(p.x - state.lastPlayerX, p.y - state.lastPlayerY),
    moving = Math.hypot(p.vx || 0, p.vy || 0) > 1.5 || moved > 0.5;
  if (time >= state.nextTrailAt && moved > 1.3 && !p.submerged) {
    leaveTrail(game, p.crouching ? "scent" : "footprint", p.x, p.y, p.crouching ? 0.45 : 0.8, 13, "player");
    state.lastPlayerX = p.x; state.lastPlayerY = p.y;
    state.nextTrailAt = time + (p.crouching ? 1.1 : 0.55);
  }
  if (time >= state.nextNoiseAt && ((moving && input.sprint && !p.crouching) || p.attacking > 0 || p.abilityActive > 0.2)) {
    recordNoise(game, p.x, p.y, p.abilityActive > 0.2 ? 2.3 : p.attacking > 0 ? 1.6 : 1);
    state.nextNoiseAt = time + 0.55;
  }
  if (time >= state.nextBloodAt && p.hp < p.maxHp * 0.4 && moving && !p.submerged) {
    recordBlood(game, p.x, p.y);
    state.nextBloodAt = time + 1.4;
  }
}

/** A sensory sample stores a last known position; memory never follows a hidden target. */
export function perceivePlayer(game, entity) {
  const time = game.time, previous = entity.sensory;
  // Contact is cheap to check immediately, including after a knockback. Broader
  // sight, wind and trail scans remain scheduled at four samples per second.
  if (previous && time < previous.nextCheck) {
    if (!previous.visible && distance(entity, game.player) < 3.5 && hasLineOfSight(entity, game.player, game.worldFeatures || [])) {
      Object.assign(previous, { detected: true, visible: true, x: game.player.x, y: game.player.y, expires: time + 5, channel: "sight" });
    }
    return previous;
  }
  const p = game.player, species = SPECIES_BY_ID[entity.speciesId],
    range = entity.boss ? 110 : entity.behavior === "ambusher" ? 19 : (22 + species.size * 2) * (entity.groupRole === "scout" ? 1.15 : 1),
    d = distance(entity, p), weather = conditionsAt(game, entity.x, entity.y),
    cover = p.crouching ? terrainCover(game, p) : 0,
    silent = p.crouching && ((game.geneticTraits || phenotype(p.genome)).adaptations.includes("stealth") || p.adaptations?.stealth >= 60),
    concealment = (p.camouflage > 0 ? 0.2 : 1) * (p.crouching ? 0.62 - cover * 0.3 : 1) * (p.submerged ? 0.35 : 1),
    visionRange = Math.max(3.5, range * weather.visibilityMultiplier * concealment * (silent ? .92 : 1)),
    angle = Math.atan2(p.y - entity.y, p.x - entity.x),
    facing = Math.cos(angle - entity.angle),
    // Herbivores have wider peripheral vision (~270 deg), predators have forward binocular vision (~160 deg).
    // Stalking/crouching behind an animal stays outside its vision cone.
    herbivore = ["quad", "longneck"].includes(species.body) || species.temperament === "herbivore",
    minFacing = herbivore ? -0.55 : 0.15,
    inView = (facing > minFacing && (!p.crouching || facing > 0.35)) ||
      (!p.crouching && d < 13) ||
      d < 2.5 ||
      entity.aggro > 0;
  const sensory = {
    nextCheck: time + SENSE_INTERVAL,
    detected: false, visible: false, x: previous?.x ?? entity.x,
    y: previous?.y ?? entity.y, expires: previous?.expires ?? 0,
    channel: previous?.channel || "none",
  };
  if (d < visionRange && inView && hasLineOfSight(entity, p, game.worldFeatures || [])) {
    Object.assign(sensory, { detected: true, visible: true, x: p.x, y: p.y, expires: time + 5, channel: "sight" });
  } else {
    // Proximity scent detection: carnivores and keen trackers smell prey nearby unless blocked by solid cover
    const keenSmell = ["rex", "serpent", "croc", "raptor"].includes(species.body) || species.temperament === "hunter" || species.temperament === "carnivore";
    const scentProximity = (keenSmell ? (12 + species.size * 1.8) : (7 + species.size)) * weather.scentMultiplier * (p.crouching ? 0.65 : 1);
    if (d < scentProximity && p.camouflage <= 0 && !p.submerged && hasLineOfSight(entity, p, game.worldFeatures || [])) {
      Object.assign(sensory, { detected: true, visible: false, x: p.x, y: p.y, expires: time + 4, channel: "scent" });
    } else {
      let best = null, bestScore = 0;
    for (const trail of game.senses?.trails || []) {
      if (trail.sourceId !== "player" || trail.expiresAt <= time) continue;
      const gap = distance(entity, trail), age = time - trail.createdAt;
      let reach;
      if (trail.kind === "sound") {
        reach = (14 + 17 * trail.strength) * (hasLineOfSight(entity, trail, game.worldFeatures || []) ? 1 : 0.62);
      } else {
        const downwind = gap > 0.01
          ? ((entity.x - trail.x) * weather.wind.x + (entity.y - trail.y) * weather.wind.y) / gap : 1;
        reach = (trail.kind === "blood" ? 30 : trail.kind === "footprint" ? 19 : 15)
          * weather.scentMultiplier * (0.58 + 0.7 * Math.max(0, downwind)) * trail.strength;
        // Old prints can be inspected nearby even when the wind carries scent away.
        if (trail.kind === "footprint") reach = Math.max(6, reach);
      }
      if (gap >= reach) continue;
      const score = (1 - gap / reach) * trail.strength / (1 + age * 0.16);
      if (score > bestScore) { best = trail; bestScore = score; }
    }
    if (best) Object.assign(sensory, {
      detected: true, x: best.x, y: best.y,
      expires: time + (best.kind === "blood" ? 9 : 4), channel: best.kind,
    });
    else if (previous?.detected && previous.expires > time && distance(entity, previous) > 2) {
      Object.assign(sensory, { detected: true });
    }
    }
  }
  entity.sensory = sensory;
  return sensory;
}
