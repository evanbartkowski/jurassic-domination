import { Game } from "./game.js";
import { DIFFICULTIES, SPECIES_BY_ID, MUTATIONS } from "./data.js";
import { WORLD_RADIUS, LAIRS, REGIONS } from "./world-data.js";
import { SKINS, PERMANENT_MODIFIERS, RUN_SKILLS, POWERUPS } from "./content.js";
import { BLOODLINES } from "./progression.js";
import { CATALOG, COSMETICS, PETS } from "./collection-data.js";
import { validGenome, neutralGenome, geneticSeed, newAdaptationState } from "./genetics.js";
import { initializeSenses, MAX_TRAILS } from "./senses.js";
import { initializeLifeEntity } from "./life-cycle.js";
import { initializeWorldState, isWorldStateValid } from "./world-events.js";
import { initializeDiscoveryState, isExplorationStateValid } from "./discoveries.js";
import { newSurvivalState, validSurvival } from "./survival.js";

export const SNAPSHOT_VERSION = 2;
export const CONTENT_VERSION = 1;
export const MAX_SNAPSHOT_BYTES = 16 * 1024 * 1024;
const scalarFields = [
  "seed", "_randomState", "difficulty", "upgrades", "state", "time", "eggTime",
  "tier", "ascensions", "danger", "biome", "entities", "foods", "events",
  "mutations", "evolutionReady", "lineage", "formStarted", "evolutionChoices",
  "mutationChoices", "boss", "cause", "_nextId", "_respawnTimer", "_nextBoss",
  "_warningCooldown", "_eatCooldown", "_threatCount", "player", "skinId",
  "_chunkPosition", "buffs", "runSkills", "earnedDNA", "projectiles", "lairs",
  "waypoint", "_bossSelection", "secretSite", "worldFeatures", "_hazardCooldown",
  "hazardHint", "region", "cosmeticId", "petId", "commandSequence",
  "worldState", "exploration", "survival", "senses", "nests", "_nextSocialAt",
  "formHistory", "guardianKills", "hitStop", "_hasRoared", "survivalBehavior",
  "playerMateId", "playerNest", "playerOffspringCount", "strongestDefeated",
  "build",
];
const baseSetFields = ["modifiers", "knownUnlocks", "foundUnlocks", "activeChunks", "discoveredRegions"];
const setFields = [...baseSetFields, "dominatedRegions", "excavatedLandmarks"];
const mapFields = ["chunks", "marineState"];
const states = new Set(["egg", "playing", "evolution", "dead", "mutation-choice"]);
const idPattern = /^[a-zA-Z0-9:_-]{1,96}$/;
const chunkPattern = /^-?\d{1,4},-?\d{1,4}$/;
const foodTypes = new Set(["plant", "meat", "essence", "egg", "rareplant", "lineage-fruit", "relic", "fossil", "dna", "pet-egg", "decoration-cache", "cosmetic-cache", "mutation-catalyst"]);
const featureTypes = new Set(["boulder", "fallen-log", "landmark", "water", "volcano", "mushrooms", "toxic-bloom", "carnivore"]);
const finite = (n, low = -1e12, high = 1e12) => typeof n === "number" && Number.isFinite(n) && n >= low && n <= high;
const integer = (n, low = 0, high = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(n) && n >= low && n <= high;
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const array = (v, limit) => Array.isArray(v) && v.length <= limit;
const nestPattern = /^nest:-?\d{1,4},-?\d{1,4}$/;
const groupRoles = new Set(["juvenile", "solitary", "parent", "follower", "leader", "flanker", "scout"]);
const channels = new Set(["none", "sight", "sound", "blood", "footprint", "scent", "nest-theft"]);
const trailKinds = new Set(["sound", "blood", "footprint", "scent"]);
const idsValid = (ids, limit) => array(ids, limit) && new Set(ids).size === ids.length && ids.every((id) => integer(id, 1));
const nestIdValid = (id) => id === null || (typeof id === "string" && nestPattern.test(id));
function sensoryValid(sense) {
  return sense === undefined || sense === null || (object(sense) &&
    finite(sense.nextCheck, 0) && finite(sense.expires, 0) && finite(sense.x) && finite(sense.y) &&
    typeof sense.detected === "boolean" && typeof sense.visible === "boolean" && channels.has(sense.channel));
}
function lifeActorValid(actor) {
  return validGenome(actor.genome) && finite(actor.geneticSpeed, .96 - 1e-9, 1.04 + 1e-9) &&
    finite(actor.maturitySeconds, 42, 100) && nestIdValid(actor.nestId) && idsValid(actor.parentIds, 2) &&
    groupRoles.has(actor.groupRole) && finite(actor.territoryRadius, 14, 22) &&
    (actor.roleSign === -1 || actor.roleSign === 1) && (actor.rivalId === null || integer(actor.rivalId, 1)) &&
    (actor.territoryRetreat === null || (object(actor.territoryRetreat) && finite(actor.territoryRetreat.x) &&
      finite(actor.territoryRetreat.y) && finite(actor.territoryRetreat.until, 0))) && sensoryValid(actor.sensory);
}
function nestValid(nest, chunk) {
  return object(nest) && typeof nest.id === "string" && nestPattern.test(nest.id) &&
    typeof nest.homeChunk === "string" && chunkPattern.test(nest.homeChunk) && nest.id === `nest:${nest.homeChunk}` &&
    (chunk === undefined || nest.homeChunk === chunk) && !!SPECIES_BY_ID[nest.speciesId] &&
    finite(nest.x) && finite(nest.y) && idsValid(nest.parentIds, 2) && idsValid(nest.eggIds, 2) &&
    integer(nest.born, 0, 1e9) && integer(nest.generation, 0, 1e9) && finite(nest.nextLayAt, 0) &&
    finite(nest.territoryRadius, 14, 22);
}
function sensesValid(senses) {
  return object(senses) && finite(senses.windAngle, -Math.PI * 2, Math.PI * 2) &&
    finite(senses.lastPlayerX) && finite(senses.lastPlayerY) &&
    ["nextTrailAt", "nextNoiseAt", "nextBloodAt"].every((id) => finite(senses[id], 0)) &&
    array(senses.trails, MAX_TRAILS) && senses.trails.every((trail) =>
      object(trail) && trailKinds.has(trail.kind) && finite(trail.x) && finite(trail.y) && finite(trail.angle) &&
      finite(trail.strength, .1, 3) && (trail.sourceId === "player" || integer(trail.sourceId, 1)) &&
      finite(trail.createdAt, 0) && finite(trail.expiresAt, trail.createdAt, trail.createdAt + 60));
}
function livingWorldValid(game) {
  const p = game.player;
  if (!validGenome(p.genome) || !object(p.adaptations) ||
    !["frost", "cinder", "water", "stealth"].every((id) => finite(p.adaptations[id], 0, 100000)) ||
    typeof p.crouching !== "boolean" || typeof p.submerged !== "boolean" ||
    !object(game.survival) || !validSurvival(game.survival) || !isWorldStateValid(game.worldState) ||
    !isExplorationStateValid(game.exploration) || !sensesValid(game.senses) || !finite(game._nextSocialAt, 0) ||
    !integer(game.guardianKills, 0, 1e9) || !array(game.formHistory, 128) || !game.formHistory.length ||
    !game.formHistory.every((id) => !!SPECIES_BY_ID[id]) || !array(game.nests, 9) ||
    !game.nests.every((nest) => nestValid(nest) && game.activeChunks.includes(nest.homeChunk))) return false;
  const nests = new Set();
  for (const nest of game.nests) { if (nests.has(nest.id)) return false; nests.add(nest.id); }
  for (const [key, chunk] of game.chunks) {
    if (!array(chunk.nests, 1) || !chunk.nests.every((nest) => nestValid(nest, key))) return false;
    for (const nest of chunk.nests) { if (nests.has(nest.id)) return false; nests.add(nest.id); }
  }
  return true;
}
function plainTree(value, depth = 0, budget = { nodes: 0 }) {
  if (++budget.nodes > 600000 || depth > 14) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return finite(value);
  if (typeof value === "string") return value.length <= 4096;
  if (Array.isArray(value)) return value.length <= 100000 && value.every((v) => plainTree(v, depth + 1, budget));
  if (!object(value)) return false;
  return Object.entries(value).every(([k, v]) => !["__proto__", "prototype", "constructor"].includes(k) && plainTree(v, depth + 1, budget));
}
function actorValid(actor, player = false, version = SNAPSHOT_VERSION) {
  if (!(object(actor) && !!SPECIES_BY_ID[actor.speciesId] &&
    finite(actor.x, -1e6, 1e6) && finite(actor.y, -1e6, 1e6) && finite(actor.angle) &&
    finite(actor.hp, 0, 1e9) && finite(actor.maxHp, 1, 1e9) && actor.hp <= actor.maxHp + .01 &&
    (player || integer(actor.id, 1)))) return false;
  const fields = player ? ["stamina", "hunger", "xp", "kills", "score", "abilityCooldown", "dashCooldown", "attackCooldown", "invulnerable", "attacking", "abilityActive", "nutrients", "growth", "specialCooldown", "techniqueCooldown", "guard", "empowered", "camouflage", "chilled", "poisoned", "combo", "comboTime", "damage", "speed", "armor"]
    : ["nutrients", "growth", "baseMaxHp", "damage", "hunger", "feedCooldown", "adultMaxHp", "attackCooldown", "stunned", "fear", "poison", "poisonTick", "hitFlash", "wanderTime", "aggro", "attacking", "skillCooldown", "slowed", "age", "scaleFactor"];
  if (!fields.every((k) => finite(actor[k], 0)) || actor.hunger > 100 || actor.growth > 1) return false;
  if (!player && version >= 2 && !lifeActorValid(actor)) return false;
  if (player) return finite(actor.vx) && finite(actor.vy) && finite(actor.formScale, .1, 1000) && actor.stamina <= 100 && actor.armor <= 1 &&
    (actor.venomFang === undefined || finite(actor.venomFang, 0)) &&
    (actor.roarCooldown === undefined || finite(actor.roarCooldown, 0)) &&
    (actor.bleeding === undefined || finite(actor.bleeding, 0)) &&
    (actor.burning === undefined || finite(actor.burning, 0)) &&
    (actor.sleeping === undefined || finite(actor.sleeping, 0));
  if (!finite(actor.telegraph, -.1, 60) || !finite(actor.homeX) || !finite(actor.homeY) || (actor.homeChunk !== undefined && !chunkPattern.test(actor.homeChunk)) ||
    (actor.bleeding !== undefined && !finite(actor.bleeding, 0)) ||
    (actor.bleedTick !== undefined && !finite(actor.bleedTick, 0)) ||
    (actor.burning !== undefined && !finite(actor.burning, 0)) ||
    (actor.burnTick !== undefined && !finite(actor.burnTick, 0)) ||
    (actor.sleeping !== undefined && !finite(actor.sleeping, 0)) ||
    (actor.inTree !== undefined && typeof actor.inTree !== "boolean") ||
    (actor.treeY !== undefined && !finite(actor.treeY)) ||
    (actor.treeDrop !== undefined && !finite(actor.treeDrop)) ||
    !["passive", "boss", "roaming", "juvenile"].every((k) => typeof actor[k] === "boolean") || typeof actor.behavior !== "string") return false;
  const cast = actor.cast;
  return cast === null || (object(cast) && ["circle", "cone"].includes(cast.shape) && finite(cast.remaining, 0) && finite(cast.radius, 0) && finite(cast.angle) && finite(cast.x) && finite(cast.y));
}
function foodValid(food, version = SNAPSHOT_VERSION) {
  return object(food) && integer(food.id, 1) && finite(food.x, -1e6, 1e6) && finite(food.y, -1e6, 1e6) &&
    foodTypes.has(food.type) && finite(food.age, 0) && finite(food.value, 0) && integer(food.tier, 0, 7) &&
    (food.homeChunk === undefined || chunkPattern.test(food.homeChunk)) && (!food.speciesId || !!SPECIES_BY_ID[food.speciesId]) &&
    (food.type !== "egg" || (!!SPECIES_BY_ID[food.speciesId] && finite(food.hatchAfter, 0))) &&
    (food.type !== "lineage-fruit" || ["sunheart", "moondrop"].includes(food.fruit)) &&
    (!food.sku || Object.hasOwn(CATALOG, food.sku)) &&
    (version < 2 || ((food.genome === undefined || validGenome(food.genome)) &&
      (food.nestId === undefined || nestIdValid(food.nestId)) &&
      (food.parentIds === undefined || idsValid(food.parentIds, 2))));
}

/** JSON-only checkpoint: never serializes prototypes, renderer objects or closures. */
export function snapshotGame(game) {
  if (!(game instanceof Game)) throw new Error("A Game is required to create a run snapshot");
  const data = {};
  for (const key of scalarFields) if (game[key] !== undefined) data[key] = game[key];
  for (const key of setFields) data[key] = [...(game[key] || [])];
  for (const key of mapFields) data[key] = [...(game[key] || [])];
  data.starterId = game._starter.id;
  const result = { format: "jd-run", version: SNAPSHOT_VERSION, contentVersion: CONTENT_VERSION,
    runId: game.runId, tick: game.tick || 0, game: data };
  const text = JSON.stringify(result, (_key, value) => {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Run contains a nonfinite value");
    return value;
  });
  if (text.length > MAX_SNAPSHOT_BYTES) throw new Error("Run snapshot exceeds the supported size budget");
  const copy = JSON.parse(text);
  if (!validateSnapshot(copy)) throw new Error("Run state cannot be saved safely");
  return copy;
}

/** Validate before constructing any simulation object; malformed imports return false. */
export function validateSnapshot(snapshot) {
  try {
    if (!object(snapshot) || snapshot.format !== "jd-run" || ![1, SNAPSHOT_VERSION].includes(snapshot.version) ||
      snapshot.contentVersion !== CONTENT_VERSION || typeof snapshot.runId !== "string" || !idPattern.test(snapshot.runId) ||
      !integer(snapshot.tick) || !object(snapshot.game) || !plainTree(snapshot)) return false;
    if (JSON.stringify(snapshot).length > MAX_SNAPSHOT_BYTES) return false;
    const g = snapshot.game, version = snapshot.version;
    if (!integer(g.seed, 0, 0xffffffff) || !integer(g._randomState, 0, 0xffffffff) || !DIFFICULTIES[g.difficulty] ||
      !states.has(g.state) || !integer(g.tier, 0, 7) || !integer(g.ascensions, 0, 1000000) || !finite(g.time, 0) ||
      !finite(g.eggTime, 0) || !SPECIES_BY_ID[g.starterId] || !actorValid(g.player, true, version) || !integer(g.commandSequence) ||
      g.tier !== SPECIES_BY_ID[g.player.speciesId].tier || !integer(g._nextId, 1) || !object(g.upgrades) ||
      !["vitality", "instinct", "metabolism"].every((k) => finite(g.upgrades[k], 0, 5))) return false;
    if (!["xp", "stamina", "hunger", "kills", "score", "nutrients", "growth"].every((k) => finite(g.player[k], 0)) ||
      g.player.stamina > 100 || g.player.hunger > 100 || g.player.growth > 1 || !finite(g.player.formScale, 0.1, 1000)) return false;
    if (!["_respawnTimer", "_nextBoss", "_warningCooldown", "_eatCooldown", "_threatCount", "formStarted", "earnedDNA", "_bossSelection"].every((k) => finite(g[k], 0)) ||
      typeof g.evolutionReady !== "boolean" || !finite(g.danger, 0, 1) || typeof g.biome !== "string" || typeof g.cause !== "string" ||
      typeof g._chunkPosition !== "string" || (g._hazardCooldown !== undefined && !finite(g._hazardCooldown, 0))) return false;
    if (!array(g.entities, 512) || !g.entities.every((a) => actorValid(a, false, version)) ||
      !array(g.foods, 4096) || !g.foods.every((food) => foodValid(food, version)) || !array(g.events, 160) ||
      !array(g.projectiles, 512) || !array(g.lairs, 64) || !array(g.runSkills, 6) ||
      !g.runSkills.every((s) => object(s) && RUN_SKILLS.some((r) => r.id === s.id) && finite(s.cooldown, 0)) ||
      !array(g.mutations, 100000) || !g.mutations.every((id) => MUTATIONS.some((m) => m.id === id)) ||
      !array(g.evolutionChoices, 100) || !g.evolutionChoices.every((id) => !!SPECIES_BY_ID[id]) ||
      !array(g.mutationChoices, 8) || !g.mutationChoices.every((id) => MUTATIONS.some((m) => m.id === id))) return false;
    if (!baseSetFields.every((k) => array(g[k], k === "activeChunks" ? 9 : 4096)) ||
      (g.dominatedRegions !== undefined && !array(g.dominatedRegions, 4096)) ||
      (g.excavatedLandmarks !== undefined && !array(g.excavatedLandmarks, 4096)) ||
      !g.activeChunks.every((key) => typeof key === "string" && chunkPattern.test(key)) || new Set(g.activeChunks).size !== g.activeChunks.length ||
      !g.modifiers.every((id) => PERMANENT_MODIFIERS.some((m) => m.id === id)) ||
      !SKINS.some((s) => s.id === g.skinId) || !array(g.chunks, 2048) || !array(g.marineState, 9)) return false;
    const ids = new Set();
    for (const record of [...g.entities, ...g.foods]) {
      if (ids.has(record.id) || record.id >= g._nextId) return false;
      ids.add(record.id);
    }
    const chunkIds = new Set();
    for (const entry of g.chunks) {
      if (!array(entry, 2) || entry.length !== 2 || !chunkPattern.test(entry[0]) || !object(entry[1])) return false;
      if (chunkIds.has(entry[0])) return false;
      chunkIds.add(entry[0]);
      const c = entry[1];
      if (g.activeChunks.includes(entry[0]) || !finite(c.savedAt, 0) || !array(c.entities, 256) || !array(c.foods, 1024) ||
        !c.entities.every((a) => actorValid(a, false, version)) || !c.foods.every((food) => foodValid(food, version))) return false;
      for (const record of [...c.entities, ...c.foods]) {
        if (ids.has(record.id) || record.id >= g._nextId) return false;
        ids.add(record.id);
      }
    }
    const pools = new Set();
    for (const entry of g.marineState) {
      if (!array(entry, 2) || entry.length !== 2 || typeof entry[0] !== "string" || !object(entry[1]) ||
        !array(entry[1].swimmers, 3) || entry[1].swimmers.length !== 3 ||
        !entry[1].swimmers.every((s) => object(s) && finite(s.x) && finite(s.y) && finite(s.angle) && typeof s.hunting === "boolean") || pools.has(entry[0])) return false;
      pools.add(entry[0]);
    }
    if (!array(g.worldFeatures, 160) || !g.worldFeatures.every((f) => object(f) && typeof f.id === "string" && featureTypes.has(f.type) && finite(f.x) && finite(f.y) && finite(f.radius, .01, 1000) && integer(f.tier, 0, 7) && finite(f.phase) && typeof f.solid === "boolean")) return false;
    if (![...pools].every((id) => g.worldFeatures.some((f) => f.id === id && f.type === "water"))) return false;
    if (!g.projectiles.every((s) => object(s) && (typeof s.id === "string" || integer(s.id, 1)) && finite(s.x) && finite(s.y) && finite(s.angle) && finite(s.speed, 0, 1000) && finite(s.life, 0, 120) && finite(s.radius, 0, 100) && finite(s.damage, 0) && typeof s.kind === "string")) return false;
    if (new Set(g.lairs.map((l) => l.id)).size !== g.lairs.length || !g.lairs.every((l) => object(l) && LAIRS.some((d) => d.id === l.id) && !!SPECIES_BY_ID[l.speciesId] && finite(l.x) && finite(l.y) && finite(l.respawnAt, 0) && finite(l.respawn, 1) && integer(l.defeats) && (l.entityId === null || integer(l.entityId, 1)))) return false;
    if (g.boss !== null && !(object(g.boss) && integer(g.boss.id, 1) && typeof g.boss.name === "string" && !!SPECIES_BY_ID[g.boss.speciesId] && finite(g.boss.hp, 0) && finite(g.boss.maxHp, 1))) return false;
    if (g.waypoint !== null && !(object(g.waypoint) && finite(g.waypoint.x) && finite(g.waypoint.y))) return false;
    if (!object(g.secretSite) || !finite(g.secretSite.x) || !finite(g.secretSite.y) || !["skin", "modifier"].includes(g.secretSite.type)) return false;
    if (g.cosmeticId !== undefined && g.cosmeticId !== "none" && !COSMETICS.some((c) => c.id === g.cosmeticId)) return false;
    if (g.petId !== undefined && g.petId !== null && !PETS.some((p) => p.id === g.petId)) return false;
    if (!g.discoveredRegions.every((id) => REGIONS.some((r) => r.id === id))) return false;
    if (g.survivalBehavior !== undefined && (!object(g.survivalBehavior) ||
      !["nightKills", "nightTime", "waterTime", "aquaticKills", "damageBlocked", "apexHitsTaken", "statusInflicted", "coldTime", "packKills", "roarsWithPack"].every((k) => finite(g.survivalBehavior[k], 0)))) return false;
    if (g.hitStop !== undefined && !finite(g.hitStop, 0)) return false;
    if (g._hasRoared !== undefined && typeof g._hasRoared !== "boolean") return false;
    if (g.playerMateId !== undefined && g.playerMateId !== null && !integer(g.playerMateId, 1)) return false;
    if (g.playerOffspringCount !== undefined && !integer(g.playerOffspringCount, 0)) return false;
    if (g.strongestDefeated !== undefined && g.strongestDefeated !== null && !SPECIES_BY_ID[g.strongestDefeated]) return false;
    if (g.build !== undefined && (!object(g.build) || !object(g.build.offensive) || !object(g.build.defensive) || !object(g.build.passive) || !object(g.build.transformations) || !array(g.build.activeSynergies, 32))) return false;
    if (g.playerNest !== undefined && g.playerNest !== null && (!object(g.playerNest) || !finite(g.playerNest.x) || !finite(g.playerNest.y) || !SPECIES_BY_ID[g.playerNest.speciesId] || !finite(g.playerNest.hatchTimer, 0) || (g.playerNest.eggId !== null && !integer(g.playerNest.eggId, 1)) || typeof g.playerNest.hatched !== "boolean")) return false;
    if (version >= 2 && !livingWorldValid(g)) return false;
    return object(g.lineage) && object(g.lineage.fruits) &&
      ["sunheart", "moondrop"].every((k) => integer(g.lineage.fruits[k])) &&
      ["lavaKills", "guardians", "formKills", "formGuardians"].every((k) => integer(g.lineage[k])) &&
      array(g.lineage.used, 128) && g.lineage.used.every((id) => BLOODLINES.some((b) => b.id === id)) &&
      object(g.buffs) && Object.entries(g.buffs).every(([id, left]) => POWERUPS.some((p) => p.id === id) && finite(left, 0));
  } catch { return false; }
}

/** Migrate only recognized older state. No constructor, stat refresh or PRNG call. */
export function migrateSnapshot(snapshot) {
  if (!validateSnapshot(snapshot)) throw new Error("Invalid or unsupported run snapshot");
  const copy = JSON.parse(JSON.stringify(snapshot));
  if (copy.version === SNAPSHOT_VERSION) return copy;
  const game = copy.game;
  game.player.genome = neutralGenome(geneticSeed(`${game.seed}:player`), 1);
  game.player.adaptations = newAdaptationState();
  game.player.crouching = false; game.player.submerged = false;
  game.survival = newSurvivalState();
  game.formHistory = [game.player.speciesId];
  game.guardianKills = game.lineage.guardians;
  game.nests = []; game._nextSocialAt = 0;
  const groups = [{ entities: game.entities, foods: game.foods }, ...game.chunks.map((entry) => entry[1])];
  for (const chunk of groups) {
    chunk.nests = [];
    for (const actor of chunk.entities) {
      actor.genome = neutralGenome(geneticSeed(`${game.seed}:creature:${actor.id}`));
      actor.geneticSpeed = 1;
      initializeLifeEntity(game, actor);
      // Existing young already grew on the original 100-second schedule.
      if (actor.juvenile) actor.maturitySeconds = 100;
    }
    for (const food of chunk.foods) if (food.type === "egg")
      food.genome = neutralGenome(geneticSeed(`${game.seed}:egg:${food.id}`));
  }
  initializeSenses(game);
  // Introduce weather from its first window instead of inventing overdue
  // catastrophes around an older survivor. The original run clock is intact.
  const environment = { seed: game.seed, time: 0 };
  initializeWorldState(environment); game.worldState = environment.worldState;
  initializeDiscoveryState(game);
  game.dominatedRegions = [];
  game.excavatedLandmarks = [];
  game.survivalBehavior = {
    nightKills: 0,
    nightTime: 0,
    waterTime: 0,
    aquaticKills: 0,
    damageBlocked: 0,
    apexHitsTaken: 0,
    statusInflicted: 0,
    coldTime: 0,
    packKills: 0,
    roarsWithPack: 0,
  };
  game.hitStop = 0;
  game._hasRoared = false;
  game.playerMateId = null;
  game.playerNest = null;
  game.playerOffspringCount = 0;
  game.strongestDefeated = null;
  copy.version = SNAPSHOT_VERSION;
  if (!validateSnapshot(copy)) throw new Error("Invalid or unsupported run snapshot migration");
  return copy;
}

/** Restore prototypes explicitly without rerolling a world or emitting duplicate finds. */
export function restoreGame(snapshot) {
  const copy = migrateSnapshot(snapshot);
  const game = Object.create(Game.prototype), data = copy.game;
  for (const key of scalarFields) if (data[key] !== undefined) game[key] = data[key];
  for (const key of setFields) game[key] = new Set(data[key] || []);
  for (const key of mapFields) game[key] = new Map(data[key] || []);
  game.runId = copy.runId;
  game.tick = copy.tick;
  game._starter = SPECIES_BY_ID[data.starterId];
  game.rules = DIFFICULTIES[game.difficulty];
  game.worldRadius = WORLD_RADIUS;
  if (!game.survivalBehavior) {
    game.survivalBehavior = {
      nightKills: 0,
      nightTime: 0,
      waterTime: 0,
      aquaticKills: 0,
      damageBlocked: 0,
      apexHitsTaken: 0,
      statusInflicted: 0,
      coldTime: 0,
      packKills: 0,
      roarsWithPack: 0,
    };
  }
  if (game.hitStop === undefined) game.hitStop = 0;
  if (game._hasRoared === undefined) game._hasRoared = false;
  if (game.playerMateId === undefined) game.playerMateId = null;
  if (game.playerNest === undefined) game.playerNest = null;
  if (game.playerOffspringCount === undefined) game.playerOffspringCount = 0;
  if (game.strongestDefeated === undefined) game.strongestDefeated = null;
  return game;
}
