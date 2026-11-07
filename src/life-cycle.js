import { SPECIES_BY_ID } from "./data.js";
import { makeGenome, phenotype } from "./genetics.js";
import { seeded } from "./world-data.js";
import { hasLineOfSight } from "./combat.js";

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** Fast small hunters mature sooner; armored giants invest in fewer young. */
export function lifeProfile(species) {
  const body = species.body, slow = ["longneck", "quad", "dragon"].includes(body);
  return {
    maturitySeconds: Math.min(96, (slow ? 62 : ["bird", "raptor"].includes(body) ? 42 : 50) + species.tier * 4),
    incubationSeconds: 22 + species.tier * 3 + (slow ? 9 : 0),
    nestingCycle: 72 + species.tier * 9 + (slow ? 20 : 0),
    territoryRadius: 14 + Math.min(8, species.size * 0.8),
  };
}

export function initializeLifeEntity(game, entity, options = {}) {
  const species = SPECIES_BY_ID[entity.speciesId], life = lifeProfile(species);
  entity.maturitySeconds ??= life.maturitySeconds;
  entity.nestId ??= options.nestId || null;
  entity.parentIds ??= [...(options.parentIds || [])].slice(0, 2);
  entity.groupRole ??= entity.juvenile ? "juvenile" : "solitary";
  entity.territoryRadius ??= life.territoryRadius;
  entity.roleSign ??= entity.id % 2 ? 1 : -1;
  entity.rivalId ??= null;
  entity.territoryRetreat ??= null;
  return entity;
}

export function matureEntity(entity, species, dt) {
  if (!entity.juvenile) return;
  entity.age += dt;
  const progress = Math.min(1, entity.age / (entity.maturitySeconds || lifeProfile(species).maturitySeconds)),
    geneticSize = entity.genome ? phenotype(entity.genome).size : 1;
  entity.scaleFactor = (0.42 + 0.58 * progress) * (1 + (entity.growth || 0) * 0.28) * geneticSize;
  const hp = entity.adultMaxHp * (0.45 + 0.55 * progress);
  entity.hp = Math.min(hp, entity.hp + Math.max(0, hp - entity.maxHp));
  entity.maxHp = hp;
  if (progress >= 1) {
    entity.juvenile = false;
    entity.behavior = species.temperament;
    entity.groupRole = "follower";
  }
}

export function createNest(game, key, species, x, y, random = seeded(game.seed)) {
  if (Math.hypot(x, y) < 55 + lifeProfile(species).territoryRadius) return null;
  game.nests ||= [];
  const existing = game.nests.find((nest) => nest.id === `nest:${key}`);
  if (existing) return existing;
  const nest = {
    id: `nest:${key}`, x, y, speciesId: species.id, homeChunk: key,
    parentIds: [], eggIds: [], born: 0, generation: 0,
    nextLayAt: game.time + lifeProfile(species).nestingCycle,
    territoryRadius: lifeProfile(species).territoryRadius,
  };
  let parent = game.entities.filter((e) => e.homeChunk === key && e.speciesId === species.id && !e.juvenile && !e.boss)
    .sort((a, b) => distance(a, nest) - distance(b, nest))[0];
  if (!parent || distance(parent, nest) > 36) parent = game.spawnEntity(species.id, x + 5, y + 2, { homeChunk: key });
  initializeLifeEntity(game, parent, { nestId: nest.id });
  parent.nestId = nest.id;
  parent.homeX = x; parent.homeY = y;
  parent.groupRole = "parent";
  nest.parentIds.push(parent.id);
  game.nests.push(nest);
  for (let i = 0; i < 2; i++) layEgg(game, nest, parent, random);
  return nest;
}

function layEgg(game, nest, parent, random) {
  const species = SPECIES_BY_ID[nest.speciesId], life = lifeProfile(species),
    eggIndex = nest.born + nest.eggIds.length + nest.generation * 17,
    genome = makeGenome(`${game.seed}:${nest.id}:offspring:${eggIndex}`, species, parent.genome || null),
    angle = random() * Math.PI * 2;
  const egg = game.spawnFood("egg", nest.x + Math.cos(angle) * 1.7, nest.y + Math.sin(angle) * 1.7, 14 + species.tier * 12, {
    tier: species.tier, speciesId: species.id, homeChunk: nest.homeChunk,
    hatchAfter: life.incubationSeconds + random() * 6,
    nestId: nest.id, parentIds: [...nest.parentIds], genome,
  });
  nest.eggIds.push(egg.id);
  return egg;
}

export function hatchEgg(game, food) {
  const parent = food.parentIds?.map((id) => game.entities.find((e) => e.id === id)).find(Boolean),
    juvenile = game.spawnEntity(food.speciesId, food.x, food.y, {
      juvenile: true, homeChunk: food.homeChunk, passive: true,
      nestId: food.nestId, parentIds: food.parentIds || [],
      genome: food.genome,
    });
  initializeLifeEntity(game, juvenile, { nestId: food.nestId, parentIds: food.parentIds });
  juvenile.age = Math.max(0, food.age - food.hatchAfter);
  if (parent) {
    juvenile.homeX = parent.homeX; juvenile.homeY = parent.homeY;
    juvenile.packId = parent.packId;
  }
  const nest = game.nests?.find((n) => n.id === food.nestId);
  if (nest) { nest.born++; nest.eggIds = nest.eggIds.filter((id) => id !== food.id); }
  return juvenile;
}

/** Consumption is explicit: an NPC raiding a nest never blames a nearby player. */
export function notifyNestTheft(game, food, consumer = game.player) {
  const nest = game.nests?.find((record) => record.id === food.nestId);
  if (!nest || food.type !== "egg") return;
  nest.eggIds = nest.eggIds.filter((id) => id !== food.id);
  for (const parentId of nest.parentIds) {
    const parent = game.entities.find((entity) => entity.id === parentId);
    if (!parent || distance(parent, consumer) > nest.territoryRadius + 10) continue;
    if (consumer === game.player) {
      parent.aggro = Math.max(parent.aggro, 8);
      parent.sensory = { nextCheck: 0, detected: true, visible: false, x: consumer.x, y: consumer.y, expires: game.time + 6, channel: "nest-theft" };
    } else {
      parent.rivalId = consumer.id;
      consumer.territoryRetreat = { x: nest.x, y: nest.y, until: game.time + 5 };
    }
  }
}

/** Twice-per-second social decisions; population replacement needs living parents. */
export function updateLifeCycle(game) {
  if (game.time < (game._nextSocialAt || 0)) return;
  game._nextSocialAt = game.time + 0.5;
  const byId = new Map(game.entities.map((entity) => [entity.id, entity])),
    foodIds = new Set(game.foods.map((food) => food.id)), groups = new Map();
  for (const entity of game.entities) {
    initializeLifeEntity(game, entity);
    const groupId = entity.packId || entity.nestId;
    if (groupId) { if (!groups.has(groupId)) groups.set(groupId, []); groups.get(groupId).push(entity); }
  }
  for (const members of groups.values()) {
    const adults = members.filter((e) => !e.juvenile).sort((a, b) => b.adultMaxHp - a.adultMaxHp || a.id - b.id);
    for (const [index, entity] of adults.entries())
      entity.groupRole = index === 0 ? "leader" : index % 2 ? "flanker" : "scout";
    const lookout = adults.find((entity) => entity.sensory?.visible && entity.sensory.expires > game.time);
    if (lookout?.packId) for (const member of members) {
      if (member === lookout || member.sensory?.detected || distance(member, lookout) > 30) continue;
      // Pack calls communicate a location, never live omniscient target data.
      member.sensory = { nextCheck: 0, detected: true, visible: false,
        x: lookout.sensory.x, y: lookout.sensory.y, expires: game.time + 3, channel: "sound" };
    }
  }
  for (const nest of game.nests || []) {
    const parents = nest.parentIds.map((id) => byId.get(id)).filter(Boolean);
    nest.eggIds = nest.eggIds.filter((id) => foodIds.has(id));
    const offspring = game.entities.filter((e) => e.nestId === nest.id && !nest.parentIds.includes(e.id));
    if (parents.length && !nest.eggIds.length && offspring.length < 3 && game.time >= nest.nextLayAt && game.entities.length < 190 && game.foods.length < 280) {
      nest.generation++;
      layEgg(game, nest, parents[0], seeded(game.seed ^ parents[0].id ^ nest.generation * 12347));
      nest.nextLayAt = game.time + lifeProfile(SPECIES_BY_ID[nest.speciesId]).nestingCycle;
    }
    // Parents drive unrelated weaker animals away from a nesting territory.
    for (const parent of parents) {
      parent.rivalId = null;
      if (distance(parent, nest) > nest.territoryRadius + 12) continue;
      const rival = game.entities.find((e) => e.id !== parent.id && e.nestId !== nest.id && !e.juvenile && !e.boss
        && (!parent.packId || e.packId !== parent.packId) && distance(e, nest) < nest.territoryRadius * 0.7
        && hasLineOfSight(parent, e, game.worldFeatures || [])
        && e.adultMaxHp < parent.adultMaxHp * 0.85);
      if (rival) {
        parent.rivalId = rival.id;
        rival.territoryRetreat = { x: nest.x, y: nest.y, until: game.time + 2.5 };
      }
    }
  }
}
