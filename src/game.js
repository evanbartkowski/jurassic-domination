import { SPECIES, SPECIES_BY_ID, MUTATIONS, DIFFICULTIES, STARTER_SPECIES } from "./data.js";
import {
  BUILD_CATEGORIES,
  BUILD_MUTATIONS,
  MUTATION_SYNERGIES,
  createBuildState,
  calculateBuildPower,
  applyBuildMutation,
  canEquipOrUpgrade,
  checkNewSynergies,
  renderStars,
} from "./build-system.js";
import { rollCollectionItem } from "./collection-data.js";
import { Ecosystem, initializeEcosystem } from "./ecosystem.js";
import {
  newLineage,
  chooseEvolutions,
  eligibleBloodlines,
  creatureKit,
  SPECIALS,
  growthFromFood,
  feedEntity,
  BLOODLINES,
} from "./progression.js";
import { ABILITIES } from "./content.js";
import { canEatFood, forageForRegion, plantDefinition } from "./forage.js";
import { sweepMove, hasLineOfSight, attackLineClear } from "./combat.js";
import { makeGenome, normalizeGenome, phenotype, newAdaptationState } from './genetics.js';
import { initializeLifeEntity } from './life-cycle.js';
import { initializeWorldState, updateWorldEvents, getTimeOfDay } from './world-events.js';
import { initializeDiscoveryState, recordExploration, LANDMARKS, interactWithLandmark } from './discoveries.js';
import { newSurvivalState, updateSurvival, survivalSpeed, setMovementPosture } from './survival.js';
import { recordNoise, recordBlood } from './senses.js';
import { COMPANION_SYNERGIES } from './sanctuary.js';
import {
  WORLD_RADIUS,
  biomeAt,
  foodEfficiency,
  chunkKey,
  REGIONAL_ALPHAS,
} from "./world-data.js";

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const thresholds = [60, 160, 360, 780, 1450, 2400, 3800, 5800];
export { WORLD_RADIUS };

/** Seeded, renderer-independent simulation. update accepts seconds and caps stalls. */
export class Game {
  constructor({
    seed = Date.now(),
    difficulty = "survival",
    upgrades = {},
    modifiers = [],
    skinId = "natural",
    knownUnlocks = [],
    ancestorGenome = null,
    generation,
    runId,
    petId = null,
    cosmeticId = "none",
    starterChoices = null,
    starterId = null,
    build = null,
  } = {}) {
    this.seed = Number(seed) >>> 0;
    this.petId = petId || null;
    this.cosmeticId = cosmeticId || "none";
    this.build = build || createBuildState();
    this.runId = typeof runId === "string" && /^[a-zA-Z0-9:_-]{1,96}$/.test(runId)
      ? runId : (globalThis.crypto?.randomUUID?.() || `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
    this.tick = 0;
    this.commandSequence = 0;
    this._randomState = this.seed;
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : "survival";
    this.rules = DIFFICULTIES[this.difficulty];
    this.upgrades = {
      vitality: clamp(Number(upgrades.vitality) || 0, 0, 5),
      instinct: clamp(Number(upgrades.instinct) || 0, 0, 5),
      metabolism: clamp(Number(upgrades.metabolism) || 0, 0, 5),
    };
    this.state = "egg";
    this.worldRadius = WORLD_RADIUS;
    this.time = 0;
    this.eggTime = 0;
    this.tier = 0;
    this.ascensions = 0;
    this.danger = 0;
    this.biome = "Fernwood Basin";
    this.entities = [];
    this.foods = [];
    this.events = [];
    this.mutations = [];
    this.evolutionReady = false;
    this.lineage = newLineage();
    this.formStarted = 0;
    this.evolutionChoices = [];
    this.mutationChoices = [];
    this.boss = null;
    this.cause = "";
    this._nextId = 1;
    this._respawnTimer = 0;
    this._nextBoss = 125;
    this._warningCooldown = 0;
    this._eatCooldown = 0;
    this._threatCount = 0;
    this._hasRoared = false;
    this.hitStop = 0;
    this.timeSinceDamaged = 0;
    this.pendingMutationChoices = [];
    this._starter = starterId && SPECIES_BY_ID[starterId]
      ? SPECIES_BY_ID[starterId]
      : this.pick(SPECIES.filter((s) => s.tier === 0));
    if (starterChoices && Array.isArray(starterChoices) && starterChoices.length > 0) {
      this.starterChoices = [...starterChoices];
      if (!this.starterChoices.includes(this._starter.id)) {
        this.starterChoices[0] = this._starter.id;
      }
    } else {
      const h = (this.seed ^ 0x85ebca6b) >>> 0;
      const others = STARTER_SPECIES.filter((s) => s.id !== this._starter.id);
      const sorted = [...others].sort((a, b) => {
        const valA = ((h ^ a.id.charCodeAt(0) ^ (a.id.charCodeAt(1) || 0)) * 2654435761) >>> 0;
        const valB = ((h ^ b.id.charCodeAt(0) ^ (b.id.charCodeAt(1) || 0)) * 2654435761) >>> 0;
        return valA - valB;
      });
      this.starterChoices = [this._starter.id, sorted[0]?.id, sorted[1]?.id].filter(Boolean);
    }
    this.player = {
      x: 0,
      y: 0,
      angle: 0,
      speciesId: this._starter.id,
      hp: 1,
      maxHp: 1,
      stamina: 100,
      hunger: 100,
      xp: 0,
      kills: 0,
      score: 0,
      abilityCooldown: 0,
      dashCooldown: 0,
      attackCooldown: 0,
      invulnerable: 0,
      attacking: 0,
      abilityActive: 0,
      nutrients: 0,
      growth: 0,
      formScale: 1,
      specialCooldown: 0,
      genome: makeGenome(`${this.seed}:player`, this._starter, ancestorGenome),
      adaptations: newAdaptationState(),
      crouching: false,
      submerged: false,
    };
    this.formHistory = [this._starter.id];
    if (Number.isInteger(generation) && generation >= 1 && generation <= 1000000) this.player.genome.generation = generation;
    this.guardianKills = 0;
    this.survival = newSurvivalState();
    this.survivalBehavior = {
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
    this.dominatedRegions = new Set();
    this.playerMateId = null;
    this.playerNest = null;
    this.playerOffspringCount = 0;
    this.strongestDefeated = null;
    this.excavatedLandmarks = new Set();
    initializeWorldState(this);
    initializeDiscoveryState(this);
    initializeEcosystem(this, { modifiers, skinId, knownUnlocks });
    this.refreshStats(true);
    this._populate();
  }

  random() {
    this._randomState = (this._randomState + 0x6d2b79f5) >>> 0;
    let n = this._randomState;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }

  pick(array) {
    return array[Math.floor(this.random() * array.length)];
  }
  get species() {
    return SPECIES_BY_ID[this.player.speciesId];
  }
  get effectiveSize() {
    return this.species.size * (this.player.formScale || 1) * (1 + (this.player.growth || 0) * 0.28) * this.geneticTraits.size;
  }
  get geneticTraits() {
    if (!this._phenotype || this._genomeRef !== this.player.genome) {
      this._genomeRef = this.player.genome;
      this._phenotype = phenotype(this.player.genome);
    }
    return this._phenotype;
  }
  get kit() {
    return creatureKit(this.species, this.mutationCounts);
  }
  get nextThreshold() {
    return Math.round(thresholds[this.tier] * (1 + this.ascensions * 0.38));
  }
  get mutationCounts() {
    const counts = {};
    for (const id of this.mutations) counts[id] = (counts[id] || 0) + 1;
    return counts;
  }
  get buildPower() {
    return calculateBuildPower(this.build);
  }

  refreshStats(heal = false) {
    const p = this.player,
      s = this.species,
      m = this.mutationCounts,
      b = this.build || {};
    const ratio = p.hp / Math.max(1, p.maxHp);
    const synergy = this.petId ? COMPANION_SYNERGIES[this.petId] : null;

    // Build bonuses from 4 upgrade categories
    const thickScalesLvl = b.defensive?.thickScales || 0;
    const thickScalesHp = thickScalesLvl >= 3 ? (thickScalesLvl >= 5 ? 0.35 : 0.25) : (thickScalesLvl > 0 ? 0.12 : 0);
    const thickScalesRed = thickScalesLvl > 0 ? (0.06 + thickScalesLvl * 0.05) : 0;

    const armoredHideLvl = b.defensive?.armoredHide || 0;
    const armoredHideArmor = armoredHideLvl > 0 ? (armoredHideLvl * 8) / 100 : 0;

    const hasteLvl = b.passive?.predatoryHaste || 0;
    const hasteSpeed = hasteLvl > 0 ? (hasteLvl * 0.068) : 0;

    const wideCleaveLvl = b.passive?.wideCleave || 0;
    const wideCleaveDmg = wideCleaveLvl >= 3 ? (wideCleaveLvl * 0.07) : 0;

    const berserkActive = b.transformations?.berserkerRage && (ratio < 0.5);

    p.maxHp = Math.round(
      s.hp *
        (1 + (p.growth || 0) * 0.4) *
        (1 +
          this.upgrades.vitality * 0.05 +
          (m.vitality || 0) * 0.18 +
          thickScalesHp +
          (this.modifiers.has("ancient-heart") ? 0.08 : 0)) *
        (1 + this.ascensions * 0.15) *
        (synergy?.role === "titan" ? 1.20 : 1),
    );
    p.hp = heal ? p.maxHp : Math.min(p.maxHp, p.maxHp * ratio);
    p.damage =
      s.damage *
      (1 + (p.growth || 0) * 0.32) *
      (1 +
        this.upgrades.instinct * 0.04 +
        (m.razor || 0) * 0.18 +
        wideCleaveDmg +
        (this.modifiers.has("predator-mark") ? 0.06 : 0)) *
      (1 + this.ascensions * 0.14) *
      (this.hasBuff("damage") ? 1.5 : 1) *
      (berserkActive ? 2.0 : 1);
    p.speed =
      s.speed * this.geneticTraits.speed *
      (1 - (p.growth || 0) * 0.04) *
      (1 + (m.swift || 0) * 0.1 + hasteSpeed + (this.modifiers.has("wanderer") ? 0.07 : 0)) *
      (this.hasBuff("speed") ? 1.4 : 1) *
      (synergy?.role === "prowler" ? 1.10 : (this.petId ? 1.05 : 1)) *
      (berserkActive ? 1.4 : 1);
    p.armor = Math.min(
      0.75,
      (m.ironhide || 0) * 0.12 + (s.body === "quad" ? 0.12 : 0) + (synergy?.role === "bulwark" ? 0.15 : 0) + thickScalesRed + armoredHideArmor,
    );
  }

  _populate() {
    this.populateWorld();
  }

  spawnEntity(speciesId, x, y, options = {}) {
    const s = SPECIES_BY_ID[speciesId];
    if (!s) return null;
    const maxHp =
      s.hp *
      0.78 *
      this.rules.enemyHealth *
      (options.boss ? 2.8 : 1) *
      (1 + this.ascensions * 0.22);
    const nutrients = Number.isFinite(options.nutrients)
      ? Math.max(0, options.nutrients)
      : options.juvenile
        ? 0
        : this.random() < 0.15
          ? (140 + s.tier * 140) * (0.45 + this.random() * 0.55)
          : this.random() * 25;
    const growth = growthFromFood(nutrients, s.tier),
      grownHp = maxHp * (1 + growth * 0.4);
    const isInjured = options.injured === true || (
      options.injured === undefined &&
      options.homeChunk &&
      options.passive === undefined &&
      !options.boss &&
      !options.juvenile &&
      this.random() < 0.32
    );
    const idHash = Math.abs(Math.sin((x * 37.1 + y * 17.3 + this._nextId) * 12.7));
    const isSleeping = !options.boss && !isInjured && options.sleeping === undefined && ((idHash * 5.3) % 1 < 0.12);
    const isAerial = (/quetzalcoatlus|hatzegopteryx|pteranodon|archaeopteryx|pterodactyl|wyvern|phoenix|thunderbird|quetzalcoatl/.test(s.id) || (s.body === "dragon" && s.tier >= 6)) && s.tier >= 3;
    const isFlying = isAerial && !options.boss && (options.flying ?? (((idHash * 7.1) % 1) < 0.65));
    const fullMaxHp = grownHp * (options.juvenile ? 0.45 : 1);
    const initialHp = Number.isFinite(options.hp)
      ? Math.max(1, Math.min(fullMaxHp, options.hp))
      : isInjured
        ? Math.max(6, Math.round(fullMaxHp * (0.35 + this.random() * 0.45)))
        : fullMaxHp;
    const entity = {
      id: this._nextId++,
      x,
      y,
      angle: this.random() * TAU,
      speciesId,
      nutrients,
      growth,
      baseMaxHp: maxHp,
      damage: s.damage * (1 + growth * 0.32),
      hunger: 65 + this.random() * 35,
      feedCooldown: 0,
      hp: initialHp,
      maxHp: fullMaxHp,
      adultMaxHp: grownHp,
      injured: (isInjured && ((idHash * 2.3) % 1 < 0.35)) || initialHp < fullMaxHp * 0.85,
      isSleeping: options.sleeping ?? isSleeping,
      isFlying,
      altitude: isFlying ? 7.5 : 0,
      diveState: isFlying ? "cruising" : "grounded",
      diveTimer: 4 + ((idHash * 4.9) % 6),
      attackCooldown: 1 + this.random(),
      telegraph: 0,
      intent: "wander",
      passive: options.passive ?? ["quad", "longneck"].includes(s.body),
      boss: !!options.boss,
      stunned: 0,
      fear: 0,
      poison: 0,
      poisonTick: 0,
      bleeding: (isInjured && initialHp < fullMaxHp * 0.5 && this.random() < 0.25) ? 2.5 : 0,
      bleedTick: 0,
      burning: 0,
      burnTick: 0,
      sleeping: 0,
      hitFlash: 0,
      wanderTime: this.random() * 4,
      aggro: 0,
      attacking: 0,
      skillCooldown: 5 + this.random() * 9,
      cast: null,
      slowed: 0,
      homeX: x,
      homeY: y,
      behavior:
        options.behavior ||
        (options.passive === true
          ? "neutral"
          : options.passive === false
            ? "hunter"
            : s.temperament),
      homeChunk: options.homeChunk,
      packId: options.packId || null,
      lairId: options.lairId || null,
      name: options.name || null,
      roaming: !!options.roaming,
      juvenile: !!options.juvenile,
      isPlayerOffspring: !!options.isPlayerOffspring,
      isPlayerMate: !!options.isPlayerMate,
      age: 0,
      scaleFactor: (options.juvenile ? 0.42 : 1) * (1 + growth * 0.28),
    };
    entity.genome = options.genome ? normalizeGenome(options.genome, `${this.seed}:creature:${entity.id}`, s) : makeGenome(`${this.seed}:creature:${entity.id}`, s, options.parentGenome);
    const traits = phenotype(entity.genome);
    entity.geneticSpeed = traits.speed;
    entity.scaleFactor *= traits.size;
    initializeLifeEntity(this, entity, options);

    // Elite Mutated Predator Escalation (derived from idHash to preserve simulation PRNG stream)
    const isCarnivore = !["herbivore"].includes(s.behavior) && s.temperament !== "skittish";
    let eliteMutation = options.eliteMutation || null;
    if (!eliteMutation && !options.boss && !options.juvenile && isCarnivore && s.tier >= 1) {
      const bPow = this.build ? calculateBuildPower(this.build) : 0;
      const eliteChance = Math.min(0.32, (this.tier * 0.035) + (bPow * 0.012));
      const eliteRoll = (idHash * 13.7) % 1;
      if (eliteRoll < eliteChance) {
        const types = ["Blazing", "Venomous", "Armored", "Frost", "Berserk"];
        eliteMutation = types[Math.floor(((idHash * 31.9) % 1) * types.length)];
      }
    }
    if (eliteMutation) {
      entity.eliteMutation = eliteMutation;
      entity.name = options.name || `${eliteMutation} ${s.name}`;
      if (eliteMutation === "Armored") {
        entity.maxHp = Math.round(entity.maxHp * 1.85);
        entity.hp = entity.maxHp;
        entity.adultMaxHp = entity.maxHp;
        entity.armor = 0.40;
      } else if (eliteMutation === "Blazing") {
        entity.damage = Math.round(entity.damage * 1.35);
        entity.maxHp = Math.round(entity.maxHp * 1.4);
        entity.hp = entity.maxHp;
        entity.adultMaxHp = entity.maxHp;
      } else if (eliteMutation === "Venomous") {
        entity.damage = Math.round(entity.damage * 1.25);
        entity.maxHp = Math.round(entity.maxHp * 1.35);
        entity.hp = entity.maxHp;
        entity.adultMaxHp = entity.maxHp;
      } else if (eliteMutation === "Frost") {
        entity.damage = Math.round(entity.damage * 1.3);
        entity.maxHp = Math.round(entity.maxHp * 1.45);
        entity.hp = entity.maxHp;
        entity.adultMaxHp = entity.maxHp;
      } else if (eliteMutation === "Berserk") {
        entity.damage = Math.round(entity.damage * 1.5);
        entity.maxHp = Math.round(entity.maxHp * 1.3);
        entity.hp = entity.maxHp;
        entity.adultMaxHp = entity.maxHp;
      }
    }

    this.entities.push(entity);
    return entity;
  }

  spawnFood(type, x, y, value = 12, options = {}) {
    const plant = type === "plant" ? (options.plantKind
      ? plantDefinition(options)
      : forageForRegion(biomeAt(x, y), () => {
        const hash=Math.sin(x*12.9898+y*78.233+this.seed*.017)*43758.5453;
        return hash-Math.floor(hash);
      })) : null;
    const food = {
      id: this._nextId++,
      type,
      x,
      y,
      value,
      age: 0,
      tier: biomeAt(x, y).tier,
      ...(plant ? { plantKind: plant.id, name: plant.name, color: plant.color } : {}),
      ...options,
    };
    this.foods.push(food);
    return food;
  }

  hatch(chosenSpeciesId = null) {
    if (this.state !== "egg") return false;
    if (chosenSpeciesId && SPECIES_BY_ID[chosenSpeciesId] && this.starterChoices.includes(chosenSpeciesId)) {
      this.player.speciesId = chosenSpeciesId;
      this.formHistory = [chosenSpeciesId];
      this.player.genome = makeGenome(`${this.seed}:player`, SPECIES_BY_ID[chosenSpeciesId]);
      this.refreshStats(true);
    }
    this.state = "playing";
    this.player.invulnerable = 2.5;
    this.emit("hatch", {
      speciesId: this.player.speciesId,
      text: `A ${this.species.name} is born. Eat. Adapt. Survive.`,
    });
    return true;
  }

  emit(type, data = {}) {
    this.events.push({ type, x: this.player.x, y: this.player.y, ...data });
    if (this.events.length > 160) this.events.shift();
  }

  consumeEvents() {
    return this.events.splice(0);
  }

  update(delta, input = {}) {
    let dt = clamp(Number(delta) || 0, 0, 0.1);
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      dt *= 0.2;
    }
    if (this.state === "egg") {
      this.eggTime += dt;
      if (this.eggTime >= 3 || input.attack || input.eat) this.hatch();
      return;
    }
    if (this.state === "mutation-choice") {
      if (input.attack || input.eat || input.evolve) {
        this.applyMutation(this.pendingMutationChoices?.[0]);
      }
      return;
    }
    if (this.state !== "playing" || dt === 0) return;
    this._markEvolutionReady();
    if (input.evolve && this.openEvolution()) return;
    this.time += dt;
    updateWorldEvents(this, dt);
    const p = this.player,
      s = this.species,
      m = this.mutationCounts;
    const previousX = p.x, previousY = p.y;
    for (const key of [
      "abilityCooldown",
      "dashCooldown",
      "attackCooldown",
      "invulnerable",
      "attacking",
      "abilityActive",
      "specialCooldown",
    ])
      p[key] = Math.max(0, p[key] - dt);
    this._eatCooldown = Math.max(0, this._eatCooldown - dt);
    this._warningCooldown = Math.max(0, this._warningCooldown - dt);
    this.timeSinceDamaged = (this.timeSinceDamaged || 0) + dt;
    if (m.primalRegen && this.timeSinceDamaged >= 4.0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.04 * dt);
    }
    if (p.regeneration > 0 && p.hp < p.maxHp) {
      p.regeneration = Math.max(0, p.regeneration - dt);
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.05 * dt);
    }
    if (p.bulwarkActive > 0) {
      p.bulwarkActive = Math.max(0, p.bulwarkActive - dt);
    }
    if (this.decoyHusk) {
      this.decoyHusk.life -= dt;
      if (this.decoyHusk.life <= 0) this.decoyHusk = null;
    }
    const regenLvl = this.build?.defensive?.regenerativeTissue || 0;
    if (regenLvl > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (0.012 + (regenLvl - 1) * 0.0095) * dt);
    }
    const barrierLvl = this.build?.defensive?.protectiveBarrier || 0;
    if (barrierLvl > 0) {
      this.build.barrierTimer = (this.build.barrierTimer || 0) + dt;
      const cooldown = Math.max(9, 23 - barrierLvl * 3);
      if (this.build.barrierTimer >= cooldown) {
        this.build.barrierTimer = 0;
        const maxBarrier = p.maxHp * (0.12 + barrierLvl * 0.08);
        this.build.barrierHp = maxBarrier;
        this.build.barrierMax = maxBarrier;
        this.emit("buff", { text: `AEGIS BARRIER: Absorbs ${Math.round(maxBarrier)} dmg!` });
      }
    }
    let mx = Number(input.x) || 0,
      my = Number(input.y) || 0;
    const length = Math.hypot(mx, my);
    if (length > 1) {
      mx /= length;
      my /= length;
    }
    if (Number.isFinite(input.aim)) p.angle = input.aim;
    else if (length > 0.05) p.angle = Math.atan2(my, mx);
    const sprint = !!input.sprint && p.stamina > 2 && length > 0.05;
    p.sprinting = sprint;
    setMovementPosture(this, input);
    p.speedBoost = Math.max(0, (p.speedBoost || 0) - dt);
    p.counterReady = Math.max(0, (p.counterReady || 0) - dt);
    const hungerSlow = p.hunger <= 0 && (p.starvationTimer || 0) > 5 ? 0.85 : 1;
    const speedBoostMult = p.speedBoost > 0 ? (1 + 0.35 * Math.min(1, p.speedBoost / 2.0)) : 1;
    const speed = p.speed * (sprint ? 1.65 : 1) * (p.chilled > 0 ? 0.6 : 1) * hungerSlow * speedBoostMult * survivalSpeed(this);
    // Acceleration and braking remove abrupt starts while preserving precise aim.
    const response = 1 - Math.exp(-dt * (length > 0.05 ? 13 : 19));
    p.vx += (mx * speed - p.vx) * response;
    p.vy += (my * speed - p.vy) * response;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.stamina = clamp(
      p.stamina + (sprint ? -20 * this.geneticTraits.staminaCost : (24 + (m.swift || 0) * 5) * this.geneticTraits.staminaRecovery * (1 - this.survival.fatigue * .001)) * dt,
      0,
      100,
    );
    if (sprint && this.build?.activeSynergies?.includes("inferno")) {
      this._infernoTimer = (this._infernoTimer || 0) + dt;
      if (this._infernoTimer >= 0.28) {
        this._infernoTimer = 0;
        this.build.flameTrails ||= [];
        this.build.flameTrails.push({
          x: p.x,
          y: p.y,
          life: 3.5,
          radius: 2.2,
          damage: p.damage * 0.55,
        });
      }
    }
    if (input.dash) this.dash(mx, my);
    this._containPlayer();
    if (input.attack) this.attack();
    if (input.ability) this.ability();
    if (input.special) this.special();
    if (input.eat) this.eat();

    // XP Magnetism
    const magnetLvl = this.build?.passive?.xpMagnetism || 0;
    if (magnetLvl > 0 || this.hasBuff("magnet")) {
      const radius = magnetLvl > 0 ? (8 + (magnetLvl - 1) * 7.5) : 18;
      const pullSpeed = 12 + magnetLvl * 4;
      for (const f of this.foods) {
        const d = distance(p, f);
        if (d < radius && d > 0.5) {
          const a = Math.atan2(p.y - f.y, p.x - f.x);
          f.x += Math.cos(a) * pullSpeed * dt;
          f.y += Math.sin(a) * pullSpeed * dt;
        }
      }
    }

    // Flame Trails (Inferno Synergy)
    if (this.build?.flameTrails?.length) {
      for (const trail of this.build.flameTrails) {
        trail.life -= dt;
        for (const e of this.entities) {
          if (distance(e, trail) < trail.radius) {
            e.burning = Math.max(e.burning || 0, 2.5);
            e.hp -= trail.damage * dt;
            e.hitFlash = 0.1;
          }
        }
      }
      this.build.flameTrails = this.build.flameTrails.filter((t) => t.life > 0);
    }

    // Poison Clouds (Plague Cloud Synergy)
    if (this.build?.poisonClouds?.length) {
      for (const cloud of this.build.poisonClouds) {
        cloud.life -= dt;
        for (const e of this.entities) {
          if (distance(e, cloud) < cloud.radius) {
            e.poison = Math.max(e.poison || 0, 4.0);
            e.slowed = Math.max(e.slowed || 0, 3.0);
            e.hp -= cloud.damage * dt;
          }
        }
      }
      this.build.poisonClouds = this.build.poisonClouds.filter((c) => c.life > 0);
    }

    this.updateEcosystem(dt, input);
    if (this.state !== "playing") return;
    if (this.survivalBehavior) {
      const tod = getTimeOfDay(this.time);
      if (tod.name === "night" || tod.name === "dusk") {
        this.survivalBehavior.nightTime = (this.survivalBehavior.nightTime || 0) + dt;
      }
      if (p.submerged || (this.hazardHint && this.hazardHint.includes("WATER"))) {
        this.survivalBehavior.waterTime = (this.survivalBehavior.waterTime || 0) + dt;
      }
      if (this.region?.id === "frost") {
        this.survivalBehavior.coldTime = (this.survivalBehavior.coldTime || 0) + dt;
      }
    }
    if (this.playerNest && !this.playerNest.hatched) {
      this.playerNest.hatchTimer -= dt;
      if (this.playerNest.hatchTimer <= 0) {
        this.playerNest.hatched = true;
        const heir = this.spawnEntity(this.playerNest.speciesId, this.playerNest.x + 1, this.playerNest.y, {
          juvenile: true,
          passive: true,
          isPlayerOffspring: true,
          packId: "player-family",
          genome: makeGenome(`${this.seed}:heir`, this.playerNest.speciesId, this.player.genome),
        });
        if (heir) {
          heir.homeX = this.playerNest.x;
          heir.homeY = this.playerNest.y;
          this.playerOffspringCount = (this.playerOffspringCount || 0) + 1;
          this.emit("egg-hatch", { text: `AN HEIR IS BORN! Offspring hatched and joined your pack!` });
          this.emit("dna-find", { amount: 2, receipt: `heir:${this.runId}:${this.playerOffspringCount}` });
        }
      }
    }
    updateSurvival(this, dt, input, Math.hypot(p.x-previousX,p.y-previousY) > dt * .3);
    if (this.state !== 'playing') return;
    recordExploration(this);
    const radius = Math.hypot(p.x, p.y);
    const inBasin = radius < 55;
    const earlyBasinGrace = inBasin && (this.tier === 0 || this.time < 120) ? 0.7 : 1;
    const hungerDrain =
      0.39 *
      (1 + this.tier * 0.07) *
      this.rules.hunger *
      earlyBasinGrace *
      Math.max(0.35, 1 - this.upgrades.metabolism * 0.06) *
      Math.pow(0.75, m.metabolism || 0);
    p.hunger = Math.max(0, p.hunger - hungerDrain * dt * (sprint ? 1.45 : 1));
    if (p.hunger > 60 && p.hp < p.maxHp)
      p.hp = Math.min(
        p.maxHp,
        p.hp + p.maxHp * 0.009 * dt * (s.body === "equine" ? 1.6 : 1),
      );
    if (p.hunger <= 0) {
      p.starvationTimer = (p.starvationTimer || 0) + dt;
      if (!p._lastStarveWarn || this.time - p._lastStarveWarn > 4) {
        this.emit("warning", { text: "CRITICAL STARVATION: Feed immediately!" });
        p._lastStarveWarn = this.time;
      }
      const rate = p.starvationTimer > 10 ? 0.055 : 0.035;
      this.damagePlayer(p.maxHp * rate * dt, "Starvation", true);
    } else {
      p.starvationTimer = 0;
    }
    // The far outer ring is volcanic: an explicit warning precedes continuous damage.
    if (radius > WORLD_RADIUS - 35) {
      if (this._warningCooldown === 0) {
        this.emit("warning", {
          text: "Volcanic boundary! Return toward the basin.",
        });
        this._warningCooldown = 5;
      }
      this.damagePlayer(p.maxHp * 0.055 * dt, "Volcanic exposure", true);
    }
    if (this.state === "dead") return;

    this._threatCount = 0;
    for (const e of [...this.entities]) this._updateEntity(e, dt);
    this.danger = clamp(
      this._threatCount / 4 +
        biomeAt(p.x, p.y).tier * 0.075 +
        this.time / 2400 +
        this.ascensions * 0.1 +
        this.buildPower * 0.012,
      0,
      1,
    );
    for (const f of this.foods) f.age += dt;
    this.foods = this.foods.filter(
      (f) => !["meat", "essence"].includes(f.type) || f.age < 180,
    );
    this._respawnTimer += dt;
    if (this._respawnTimer > 3) {
      this._respawnTimer = 0;
      this._replenish();
    }
    if (this.time >= this._nextBoss) this._spawnBoss();
    if (this.boss && !this.entities.some((e) => e.id === this.boss.id))
      this.boss = null;
    p.score += dt * (1 + this.tier * 0.15) * this.rules.score;
  }

  _containPlayer() {
    const p = this.player,
      radius = Math.hypot(p.x, p.y);
    if (radius > this.worldRadius - 1) {
      p.x *= (this.worldRadius - 1) / radius;
      p.y *= (this.worldRadius - 1) / radius;
    }
  }

  _hitMarine(fish, damage, isCrit = false, feature = null) {
    if (!fish || fish.dead) return;
    const p = this.player;
    const f = feature || (this.worldFeatures || []).find((feat) => feat.id === fish.poolId);
    const tier = f?.tier || fish.tier || 0;
    fish.maxHp = fish.maxHp || (50 + tier * 35);
    fish.hp = (Number.isFinite(fish.hp) ? fish.hp : fish.maxHp) - damage;
    this.emit("hit", {
      amount: damage,
      x: fish.x,
      y: fish.y,
      target: "marine",
      speciesId: fish.speciesId || "tideweaver",
      crit: isCrit,
    });
    if (fish.hp <= 0) {
      fish.dead = true;
      fish.respawnAt = this.time + 35;
      this.gainXP(35 + tier * 25);
      p.kills++;
      p.score += 85 + tier * 55;
      this.spawnFood("meat", fish.x, fish.y, 30 + tier * 25, {
        tier,
        homeChunk: f?.homeChunk || "0,0",
      });
      this.emit("kill", { x: fish.x, y: fish.y, speciesId: fish.speciesId || "tideweaver", water: true });
    }
  }

  triggerPerfectDodge(details = {}) {
    const p = this.player;
    if (this.state !== "playing" || p.hp <= 0) return false;
    if (this._lastDodgeTime && (this.time - this._lastDodgeTime) < 0.35) return false;
    this._lastDodgeTime = this.time;

    // 1. Stamina boost refund
    p.stamina = Math.min(100, (p.stamina || 0) + 32);

    // 2. Adrenaline speed surge
    p.empowered = Math.max(p.empowered || 0, 2.5);
    p.speedBoost = Math.max(p.speedBoost || 0, 2.2);

    // 3. Counter-Attack critical readiness: next strike hits for +75% damage
    p.counterReady = 3.5;

    // 4. Brief invulnerability window (i-frame)
    p.invulnerable = Math.max(p.invulnerable || 0, 0.45);

    // 5. Emit event for floating text, screen pop and audio feedback
    this.emit("perfect-dodge", {
      x: details.x ?? p.x,
      y: details.y ?? p.y,
      cause: details.cause || "Telegraphed Strike",
    });

    return true;
  }

  attack() {
    const p = this.player;
    if (this.state !== "playing" || p.attackCooldown > 0) return false;
    recordNoise(this, p.x, p.y, 1);
    p.attackCooldown = ["raptor", "bird"].includes(this.species.body)
      ? 0.43
      : 0.52;
    p.attacking = 0.28;
    const wideCleaveLvl = this.build?.passive?.wideCleave || 0;
    const reachMult = wideCleaveLvl > 0 ? (1 + wideCleaveLvl * 0.16) : 1;
    const baseReach = 2.8 + this.effectiveSize * 1.45 + (this.effectiveSize >= 3.0 ? (this.effectiveSize - 2.8) * 1.6 : 0);
    const reach = baseReach * reachMult;
    const maxArc = wideCleaveLvl >= 5 ? 3.14 : (wideCleaveLvl > 0 ? 1.25 + wideCleaveLvl * 0.2 : 1.25);
    this.emit("attack", { x: p.x, y: p.y, angle: p.angle, radius: reach, size: this.effectiveSize });

    const apexCritLvl = this.build?.passive?.apexCrit || 0;
    const apexCritChance = apexCritLvl > 0 ? (0.12 + (apexCritLvl - 1) * 0.07) : 0;
    const apexCritMult = apexCritLvl > 0 ? (1.5 + (apexCritLvl - 1) * 0.32) : 1.0;
    const isApexCrit = apexCritLvl > 0 && this.random() < apexCritChance;
    const isCounter = (p.counterReady || 0) > 0;
    if (isCounter) {
      p.counterReady = 0;
      this.emit("counter-strike", { x: p.x, y: p.y });
    }

    for (const e of [...this.entities]) {
      if (e.isFlying && (e.altitude || 0) > 2.2) continue;
      const target = SPECIES_BY_ID[e.speciesId];
      if (
        distance(p, e) < reach + target.size * 0.45 &&
        Math.abs(angleDifference(Math.atan2(e.y - p.y, e.x - p.x), p.angle)) <
          maxArc && hasLineOfSight(p, e, this.worldFeatures || [])
      ) {
        const hitAngle = Math.atan2(e.y - p.y, e.x - p.x);
        const relAngle = Math.abs(angleDifference(hitAngle, e.angle));
        const isRear = relAngle < 0.95;
        const isHeadOn = relAngle > 2.25;
        let directionalMult = 1.0;
        let legWound = false;

        if (isRear) {
          directionalMult = 1.35;
          legWound = true;
        } else if (isHeadOn && (["quad", "croc"].includes(target.body) || /ankylo|stego|tricer/.test(e.speciesId))) {
          directionalMult = 0.65;
        }

        const stealthCrit = p.crouching && (this.mutationCounts.stealthScales || 0) > 0;
        const isCrit = isCounter || p.empowered > 0 || stealthCrit || isApexCrit || (isRear && (this.species.body === "raptor" || this.hasBuff("ambush")));
        const multiplier =
          directionalMult *
          (isCounter ? 1.75 : 1) *
          (p.empowered > 0 ? 1.65 : 1) *
          (isApexCrit ? apexCritMult : (isCrit ? (stealthCrit ? 1.5 : 1.25) : 1)) *
          (this.species.body === "raptor"
            ? 1 + Math.min(3, p.combo) * 0.1
            : 1) *
          (this.species.body === "croc" && e.aggro <= 0 ? 1.35 : 1);
        if (this.species.body === "serpent" || p.venomFang > 0) {
          e.poison = 5;
          e.poisonTick = 0;
          if (this.survivalBehavior) this.survivalBehavior.statusInflicted = (this.survivalBehavior.statusInflicted || 0) + 1;
        }
        if (legWound) {
          e.slowed = Math.max(e.slowed || 0, 3.5);
        }
        const targetMass = (target.size || 1) * (e.scaleFactor || 1);
        const massRatio = Math.max(0.25, Math.min(2.5, this.effectiveSize / targetMass));
        const knockback = 0.65 * massRatio;
        this._hitEntity(e, p.damage * multiplier, knockback, isCrit, hitAngle);
      }
    }
    for (const f of this.worldFeatures || []) {
      if (!f.solid || f.destroyed) continue;
      if (f.type !== "fallen-log" && f.type !== "boulder") continue;
      const df = Math.hypot(f.x - p.x, f.y - p.y);
      if (
        df < reach + f.radius &&
        Math.abs(angleDifference(Math.atan2(f.y - p.y, f.x - p.x), p.angle)) < maxArc
      ) {
        f.hits = (f.hits || 0) + 1;
        const requiredHits = f.type === "boulder" ? (this.effectiveSize >= 2.2 ? 1 : 2) : 1;
        if (f.hits >= requiredHits || this.effectiveSize >= 2.5) {
          f.destroyed = true;
          f.solid = false;
          try {
            this.sound?.play?.("demolish");
          } catch {}
          this.emit("obstacle-demolished", { feature: f });
          if (f.type === "fallen-log") {
            this.notifications?.push?.({ text: "🪵 Hollow Log Smashed! Insects scattered!", color: "#ca8a04", time: 3 });
            if (Array.isArray(this.foods)) {
              for (let i = 0; i < 3; i++) {
                this.foods.push({
                  id: `demolish_grub_${f.id}_${i}_${Math.floor(this.time * 100)}`,
                  type: "insect",
                  x: f.x + (i - 1) * 1.2,
                  y: f.y + ((i % 2) - 0.5) * 1.2,
                  value: 20,
                  nutrition: 25,
                  spawned: this.time,
                });
              }
            }
          } else if (f.type === "boulder") {
            this.notifications?.push?.({ text: "💎 Amber Geode Shattered! Essence exposed!", color: "#f59e0b", time: 3 });
            if (Array.isArray(this.foods)) {
              this.foods.push({
                id: `demolish_amber_${f.id}_${Math.floor(this.time * 100)}`,
                type: "amber",
                x: f.x,
                y: f.y,
                value: 45,
                nutrition: 15,
                spawned: this.time,
              });
            }
          }
        }
      }
    }
    if (this.marineState) {
      for (const [poolId, poolState] of this.marineState.entries()) {
        const f = (this.worldFeatures || []).find((feat) => feat.id === poolId);
        if (!f || Math.hypot(p.x - f.x, p.y - f.y) > f.radius + reach + 6) continue;
        for (let i = 0; i < (poolState.swimmers || []).length; i++) {
          const fish = poolState.swimmers[i];
          if (!fish || fish.dead) continue;
          const dFish = Math.hypot(fish.x - p.x, fish.y - p.y);
          if (
            dFish < reach + 2.5 &&
            Math.abs(angleDifference(Math.atan2(fish.y - p.y, fish.x - p.x), p.angle)) < 1.65
          ) {
            const multiplier = (isCounter ? 1.75 : 1) * (p.empowered > 0 ? 1.65 : 1) * (this.species.body === "croc" ? 1.5 : 1);
            const damage = p.damage * multiplier;
            this._hitMarine(fish, damage, isCounter || p.empowered > 0, f);
          }
        }
      }
    }
    for (const f of (this.worldFeatures || [])) {
      if (f.type !== "carnivore" || f.dead) continue;
      const dPlant = Math.hypot(f.x - p.x, f.y - p.y);
      if (dPlant < reach + f.radius + 1.2 && Math.abs(angleDifference(Math.atan2(f.y - p.y, f.x - p.x), p.angle)) < 1.6) {
        f.hp = (Number.isFinite(f.hp) ? f.hp : (45 + (f.tier || 0) * 35)) - p.damage;
        f.hitFlash = 0.3;
        this.emit("hit", { x: f.x, y: f.y, target: "plant" });
        if (f.hp <= 0) {
          f.dead = true;
          this.gainXP(25 + (f.tier || 0) * 20);
          p.kills++;
          p.score += 65 + (f.tier || 0) * 45;
          this.spawnFood("meat", f.x, f.y, 25 + (f.tier || 0) * 20, {
            tier: f.tier || 0,
            homeChunk: f.homeChunk || "0,0",
          });
          this.spawnFood("plant", f.x + 1.2, f.y, 18, {
            tier: f.tier || 0,
            homeChunk: f.homeChunk || "0,0",
          });
          this.emit("kill", { x: f.x, y: f.y, target: "plant" });
        }
      }
    }
    if (this.build?.transformations?.thunderJaws) {
      for (const foe of this.entities) {
        if (distance(p, foe) < 6.5) {
          foe.hp -= 60;
          foe.hitFlash = 0.2;
          this.emit("hit", { x: foe.x, y: foe.y, amount: 60, target: foe.id, lightning: true });
        }
      }
      this.emit("ability", { ability: "shockwave", radius: 6.5, text: "Thunder Jaws Discharge" });
    }
    const boneLvl = this.build?.offensive?.boneProjectiles || 0;
    if (boneLvl > 0) {
      const splinterCount = 1 + boneLvl;
      const splinterDmg = 20 + boneLvl * 18;
      for (let sIdx = 0; sIdx < splinterCount; sIdx++) {
        const spreadAngle = p.angle + (sIdx - (splinterCount - 1) / 2) * 0.22;
        this.projectiles.push({
          id: this._nextId++,
          x: p.x + Math.cos(p.angle) * 1.5,
          y: p.y + Math.sin(p.angle) * 1.5,
          angle: spreadAngle,
          speed: 28,
          life: 0.75,
          radius: 0.6,
          damage: splinterDmg,
          kind: "bone",
        });
      }
    }
    p.empowered = 0;
    p.combo = Math.min(4, p.combo + 1);
    p.comboTime = 2;
    return true;
  }

  dash(mx = 0, my = 0) {
    const p = this.player,
      m = this.mutationCounts;
    const cost = Math.max(10, 28 - (m.adrenaline || 0) * 5);
    const hasJuggernaut = !!this.build?.activeSynergies?.includes("juggernaut");
    if (
      (!this.kit.dash && !hasJuggernaut) ||
      this.state !== "playing" ||
      p.dashCooldown > 0 ||
      p.stamina < cost
    )
      return false;
    const angle = Math.hypot(mx, my) > 0.05 ? Math.atan2(my, mx) : p.angle;
    const amount = 5.8 + this.effectiveSize * 0.45;
    sweepMove(p, Math.cos(angle) * amount, Math.sin(angle) * amount, this.effectiveSize, this.worldFeatures || []);
    p.stamina -= cost;
    p.dashCooldown = this.species.body === "bird" ? 1.2 : 1.6;
    p.invulnerable = Math.max(p.invulnerable, 0.38);
    this._containPlayer();

    // Skillful Perfect Dodge: evading an active enemy strike or windup
    let dodgedThreat = null;
    for (const e of this.entities) {
      if (e.dead || e.isSleeping) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (((e.attacking || 0) > 0 || (e.telegraph || 0) > 0) && d < 6.8) {
        dodgedThreat = e;
        break;
      }
    }
    if (dodgedThreat) {
      const threatSpecies = SPECIES_BY_ID[dodgedThreat.speciesId];
      this.triggerPerfectDodge({
        x: p.x,
        y: p.y,
        cause: `${dodgedThreat.boss ? "Alpha " : ""}${threatSpecies?.name || "Predator"}`,
      });
    }

    // Juggernaut Synergy: locomotive charge trampling all enemies
    if (this.build?.activeSynergies?.includes("juggernaut")) {
      for (const e of [...this.entities]) {
        if (distance(p, e) < 4.8) {
          const juggernautDmg = p.damage * 3.0;
          this._hitEntity(e, juggernautDmg, 4.5, true, angle);
          e.stunned = Math.max(e.stunned || 0, 1.8);
        }
      }
      this.emit("synergy-burst", { synergy: "juggernaut", x: p.x, y: p.y, text: "JUGGERNAUT TRAMPLE!" });
    } else if (this.build?.offensive?.chargingHorns) {
      const hornLvl = this.build.offensive.chargingHorns;
      const impactDmg = 45 + hornLvl * 45;
      for (const e of [...this.entities]) {
        if (distance(p, e) < 3.8) {
          this._hitEntity(e, impactDmg, 2.0 + hornLvl * 0.7, false, angle);
          if (hornLvl >= 5) e.stunned = Math.max(e.stunned || 0, 1.6);
        }
      }
    }

    // Seismic Slam Synergy: ground shockwave
    if (this.build?.activeSynergies?.includes("seismicSlam")) {
      for (const e of [...this.entities]) {
        if (distance(p, e) < 8.5) {
          this._hitEntity(e, p.damage * 0.9, 3.2, false);
          e.stunned = Math.max(e.stunned || 0, 2.0);
        }
      }
      this.emit("synergy-burst", { synergy: "seismicSlam", x: p.x, y: p.y, radius: 8.5, text: "SEISMIC SLAM SHOCKWAVE!" });
    }

    if (this.marineState) {
      for (const [poolId, poolState] of this.marineState.entries()) {
        const f = (this.worldFeatures || []).find((feat) => feat.id === poolId);
        if (!f || Math.hypot(p.x - f.x, p.y - f.y) > f.radius + 12) continue;
        for (const fish of (poolState.swimmers || [])) {
          if (!fish || fish.dead) continue;
          const dFish = Math.hypot(p.x - fish.x, p.y - fish.y);
          if (hasJuggernaut && dFish < 5.2) {
            this._hitMarine(fish, p.damage * 3.0, true, f);
          } else if (this.build?.activeSynergies?.includes("seismicSlam") && dFish < 8.5) {
            this._hitMarine(fish, p.damage * 0.9, false, f);
          } else if (this.build?.offensive?.chargingHorns && dFish < 4.2) {
            const hornLvl = this.build.offensive.chargingHorns;
            this._hitMarine(fish, 45 + hornLvl * 45, false, f);
          }
        }
      }
    }

    // Inferno Synergy: Drop molten flame trail nodes
    if (this.build?.activeSynergies?.includes("inferno")) {
      this.build.flameTrails ||= [];
      for (let i = 0; i < 4; i++) {
        const frac = i / 4;
        this.build.flameTrails.push({
          x: p.x - Math.cos(angle) * (amount * frac),
          y: p.y - Math.sin(angle) * (amount * frac),
          life: 4.5,
          radius: 2.6,
          damage: p.damage * 0.75,
        });
      }
      this.emit("synergy-burst", { synergy: "inferno", x: p.x, y: p.y, text: "INFERNO TRAIL IGNITED!" });
    }

    if (m.shockwaveStride) {
      for (const e of this.entities) {
        if (distance(p, e) < 5.2 && SPECIES_BY_ID[e.speciesId].tier <= this.tier) {
          e.stunned = Math.max(e.stunned || 0, 1.2);
          sweepMove(e, Math.cos(angle) * 2.8, Math.sin(angle) * 2.8, 1, this.worldFeatures || []);
        }
      }
      this.emit("ability", { ability: "shockwave", radius: 5.2, text: "Seismic Stride" });
    }
    this.emit("dash", { angle, x: p.x, y: p.y });
    return true;
  }

  ability() {
    const p = this.player,
      s = this.species,
      m = this.mutationCounts;
    if (this.state !== "playing" || !this.kit.ability || p.abilityCooldown > 0) return false;
    const type = s.abilityType,
      definition = ABILITIES[type];
    if (p.stamina < definition.stamina) return false;
    p.abilityCooldown = Math.max(
      3,
      definition.cooldown * Math.pow(0.82, m.adrenaline || 0),
    );
    p.stamina -= definition.stamina;
    p.abilityActive = 0.8;
    if (type === "pounce" || type === "charge" || type === "ambush") {
      sweepMove(p, Math.cos(p.angle) * (4 + s.size), Math.sin(p.angle) * (4 + s.size), this.effectiveSize, this.worldFeatures || []);
      this._containPlayer();
      p.invulnerable = Math.max(p.invulnerable, 0.6);
    }
    if (type === "heal") {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
      p.guard = 3;
    }
    const radius = definition.radius + this.effectiveSize;
    this.emit("ability", {
      ability: type,
      angle: p.angle,
      radius,
      text: s.ability,
    });
    for (const e of [...this.entities]) {
      const dist = distance(p, e);
      const angle = Math.abs(
        angleDifference(Math.atan2(e.y - p.y, e.x - p.x), p.angle),
      );
      if (
        dist > radius + SPECIES_BY_ID[e.speciesId].size * 0.4 ||
        (definition.shape === "cone" && angle > 0.9) ||
        !attackLineClear(p, e, this.worldFeatures || [], type)
      )
        continue;
      if (type === "venom") {
        e.poison = 5;
        e.poisonTick = 0;
      }
      if (type === "flame") {
        e.burning = 5;
        e.burnTick = 0;
      }
      if (type === "blood" || type === "ambush") {
        e.bleeding = 5;
        e.bleedTick = 0;
      }
      if (type === "roar") e.fear = 4;
      if (type === "frost" || type === "web") e.slowed = 6;
      e.stunned = ["stomp", "petrify", "lightning"].includes(type) ? 1.4 : 0.4;
      const knockbackForce = type === "tailspin" ? 4.5 : type === "stomp" ? 3.2 : type === "charge" ? 3.6 : 1.4;
      const damage = p.damage * definition.power;
      this._hitEntity(e, damage, knockbackForce);
      if (type === "blood") p.hp = Math.min(p.maxHp, p.hp + damage * 0.2);
    }
    if (this.marineState) {
      for (const [poolId, poolState] of this.marineState.entries()) {
        const f = (this.worldFeatures || []).find((feat) => feat.id === poolId);
        if (!f || Math.hypot(p.x - f.x, p.y - f.y) > f.radius + radius + 6) continue;
        for (let i = 0; i < (poolState.swimmers || []).length; i++) {
          const fish = poolState.swimmers[i];
          if (!fish || fish.dead) continue;
          const dFish = Math.hypot(fish.x - p.x, fish.y - p.y);
          const angle = Math.abs(angleDifference(Math.atan2(fish.y - p.y, fish.x - p.x), p.angle));
          if (
            dFish <= radius + 2.2 &&
            (definition.shape !== "cone" || angle <= 1.15)
          ) {
            const abilityDamage = p.damage * definition.power;
            this._hitMarine(fish, abilityDamage, false, f);
          }
        }
      }
    }
    return true;
  }

  roar() {
    const p = this.player,
      s = this.species;
    if (this.state !== "playing" || (p.roarCooldown || 0) > 0 || p.stamina < 14) return false;
    this._hasRoared = true;
    p.roarCooldown = 6.0;
    p.stamina -= 14;
    p.abilityActive = 0.7;
    recordNoise(this, p.x, p.y, 3.8);
    const roarRadius = 18 + this.effectiveSize * 3.5;
    const playerPower = this.tier * 10 + s.size;
    this.emit("roar", {
      speciesId: s.id,
      x: p.x,
      y: p.y,
      radius: roarRadius,
      power: playerPower,
    });
    for (const e of [...this.entities]) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > roarRadius) continue;
      const s2 = SPECIES_BY_ID[e.speciesId];
      if (!this.playerMateId && e.speciesId === s.id && !e.juvenile && this.tier >= 1 && (p.growth || 0) >= 0.35 && d < 14) {
        this.playerMateId = e.id;
        e.isPlayerMate = true;
        e.packId = "player-family";
        e.behavior = "pack";
        e.aggro = 0;
        e.fear = 0;
        this.emit("courtship", { text: `MATE BOND FORMED: Your ${s.name} companion joins your family!` });
        continue;
      }
      const entityPower = s2.tier * 10 + s2.size * (e.scaleFactor || 1);
      if (entityPower < playerPower - 2 || e.juvenile || s2.temperament === "skittish") {
        e.fear = 7.0;
        e.aggro = 0;
        e.intent = "flee";
      } else {
        e.aggro = 14.0;
        e.intent = "hunt";
      }
    }
    if (this.marineState) {
      for (const [, poolState] of this.marineState.entries()) {
        for (const fish of (poolState.swimmers || [])) {
          if (!fish || fish.dead) continue;
          if (Math.hypot(p.x - fish.x, p.y - fish.y) < roarRadius) {
            this._hitMarine(fish, 25 + this.tier * 10, false);
          }
        }
      }
    }
    if (this.playerMateId || this.playerOffspringCount > 0) {
      if (this.survivalBehavior) this.survivalBehavior.roarsWithPack = (this.survivalBehavior.roarsWithPack || 0) + 1;
    }
    // Alpha's Command Synergy
    if (this.build?.activeSynergies?.includes("alphasCommand")) {
      if (!this.build.packmates?.length) {
        this.build.packmates = [];
        for (let i = 0; i < 3; i++) {
          const comp = this.spawnEntity("velociraptor", p.x + (i - 1) * 2.5, p.y + 2, {
            passive: false,
            packId: "player-family",
            name: `Apex Packmate #${i + 1}`,
          });
          if (comp) {
            comp.isCompanion = true;
            this.build.packmates.push(comp.id);
          }
        }
      }
      for (const compId of this.build.packmates) {
        const mate = this.entities.find((e) => e.id === compId);
        if (mate) {
          mate.frenzy = 6.0;
          mate.speedBonus = 2.0;
          mate.invulnerable = 5.0;
          mate.aggro = 25.0;
        }
      }
      this.emit("synergy-burst", {
        synergy: "alphasCommand",
        x: p.x,
        y: p.y,
        text: "ALPHA'S COMMAND: Packmates Unleashed in Frenzy!",
      });
    }
    return true;
  }

  buildPlayerNest() {
    const p = this.player;
    if (this.playerNest) return false;
    this.playerNest = {
      x: p.x,
      y: p.y,
      speciesId: p.speciesId,
      hatchTimer: 20,
      eggId: null,
      hatched: false,
    };
    const egg = this.spawnFood("egg", p.x + 1.2, p.y + 0.8, 40, {
      tier: this.tier,
      speciesId: p.speciesId,
      homeChunk: chunkKey(p.x, p.y),
      hatchAfter: 20,
      isPlayerEgg: true,
      genome: makeGenome(`${this.seed}:playerEgg`, p.speciesId, p.genome),
    });
    this.playerNest.eggId = egg.id;
    this.emit("nest-built", { text: "FAMILY NEST ESTABLISHED: Protect your egg until it hatches!" });
    return true;
  }

  eat() {
    if (this.state !== "playing" || this._eatCooldown > 0) return false;
    const p = this.player,
      radius = 3.4 + this.effectiveSize * 0.6;
    let food=null, nearest=radius*radius;
    for (const candidate of this.foods) {
      if (!canEatFood(this.species,candidate)) continue;
      const d=(candidate.x-p.x)**2+(candidate.y-p.y)**2;
      if (d<=nearest) { food=candidate; nearest=d; }
    }
    if (!food) {
      for (const landmark of LANDMARKS) {
        if (Math.hypot(landmark.x - p.x, landmark.y - p.y) < 14) {
          const res = interactWithLandmark(this, landmark);
          if (res) {
            this._eatCooldown = 0.5;
            this.emit("interact", { text: res.text, detail: res.detail, ok: res.ok });
            return true;
          }
        }
      }
      if (!this.playerNest && this.playerMateId) {
        if (this.buildPlayerNest()) {
          this._eatCooldown = 0.5;
          return true;
        }
      }
      return false;
    }
    this.onFoodConsumed(food);
    this.foods = this.foods.filter((f) => f.id !== food.id);
    if (this.survival) this.survival.strain = Math.max(0, this.survival.strain - 3);
    this._eatCooldown = 0.17;
    if (food.type === "mutation-catalyst") {
      this.collectSpecial(food);
      this.emit("collect", { x: food.x, y: food.y });
      this.openMutationDrop(food.rarity || "common");
      return true;
    }
    if (
      ["dna", "pet-egg", "decoration-cache", "cosmetic-cache"].includes(
        food.type,
      )
    ) {
      this.collectSpecial(food);
      this.emit("collect", { x: food.x, y: food.y });
      return true;
    }
    const m = this.mutationCounts;
    const quality = foodEfficiency(this.tier, food.tier || 0);
    const rapidMetaLvl = this.build?.passive?.rapidMetabolism || 0;
    if (rapidMetaLvl >= 3) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (0.05 + rapidMetaLvl * 0.03));
    }
    const metaMult = rapidMetaLvl > 0 ? (1 + rapidMetaLvl * 0.2) : 1;
    p.hunger = Math.min(
      100,
      p.hunger +
        (food.type === "meat"
          ? 25
          : food.type === "essence"
            ? 40
            : food.type === "egg"
              ? 30
              : food.type === "plant" ? plantDefinition(food).hunger : 12) *
          (1 + (m.metabolism || 0) * 0.15) *
          metaMult *
          Math.max(0.08, Math.sqrt(quality)),
    );
    p.hp = Math.min(
      p.maxHp,
      p.hp +
        p.maxHp *
          (food.type === "plant" ? plantDefinition(food).healing : 0.075) *
          Math.max(0.12, Math.sqrt(quality)) *
          (this.species.body === "longneck" ? 1.4 : 1),
    );
    if (food.type === "lineage-fruit") {
      const fruit = food.fruit;
      if (Object.hasOwn(this.lineage.fruits, fruit))
        this.lineage.fruits[fruit]++;
      this.emit("lineage-progress", {
        text: `${fruit === "sunheart" ? "Sunheart" : "Moondrop"} Fruit consumed - bloodline progress saved for this life.`,
      });
    }
    this.player.nutrients += Math.max(0, food.value || 0) * quality * (food.type === "plant" ? plantDefinition(food).nutrition : 1);
    this.player.growth = growthFromFood(this.player.nutrients, this.tier);
    this.refreshStats();
    this.collectSpecial(food);
    this.gainXP(food.value * quality);
    this.emit("eat", {
      x: food.x,
      y: food.y,
      amount: food.value,
      food: food.type,
      plantKind: food.plantKind,
    });
    return true;
  }

  gainXP(amount) {
    if (this.state !== "playing" || !Number.isFinite(amount) || amount <= 0)
      return;
    const bonus =
      1 +
      (this.mutationCounts.catalyst || 0) * 0.2 +
      (this.modifiers.has("forager") ? 0.08 : 0);
    this.player.xp += amount * bonus;
    this.player.score += amount * 5 * this.rules.score;
    this._markEvolutionReady();
  }

  _markEvolutionReady() {
    if (
      this.state === "playing" &&
      this.player.xp >= this.nextThreshold &&
      !this.evolutionReady
    ) {
      this.evolutionReady = true;
      this.emit("evolution-ready", {
        text: "Evolution ready. Press T or the flashing indicator when you choose.",
      });
    }
  }
  openEvolution() {
    if (this.state !== "playing" || this.player.xp < this.nextThreshold)
      return false;
    if (!this.evolutionChoices.length) {
      this.evolutionChoices = chooseEvolutions(this);
      this.mutationChoices = this._sample(MUTATIONS, 3).map((m) => m.id);
    } else
      for (const b of eligibleBloodlines(this))
        if (!this.evolutionChoices.includes(b.speciesId))
          this.evolutionChoices.push(b.speciesId);
    this.state = "evolution";
    return true;
  }
  closeEvolution() {
    if (this.state !== "evolution") return false;
    this.state = "playing";
    return true;
  }
  openMutationDrop(rarity = "common") {
    if (this.state !== "playing") return false;
    this.build ||= createBuildState();
    const pool = [...MUTATIONS];

    // Collect upgradeable mutations that player currently possesses
    const upgradeable = [];
    for (const cat of ["offensive", "defensive", "passive", "transformations"]) {
      for (const [id, lvl] of Object.entries(this.build[cat] || {})) {
        if (lvl < 5) {
          const mut = pool.find((m) => m.id === id);
          if (mut) upgradeable.push(mut);
        }
      }
    }

    // Filter mutations that can be equipped or upgraded
    const validPool = pool.filter((m) => canEquipOrUpgrade(this.build, m.id));
    const activePool = validPool.length >= 3 ? validPool : pool;

    const chosen = [];
    if (upgradeable.length > 0 && this.random() < 0.65) {
      chosen.push(this.pick(upgradeable));
    }
    const matchingRarity = activePool.filter((m) => m.rarity === rarity && !chosen.some((c) => c.id === m.id));
    if (matchingRarity.length > 0 && chosen.length < 3) {
      chosen.push(this.pick(matchingRarity));
    }
    const remaining = activePool.filter((m) => !chosen.some((c) => c.id === m.id));
    const extra = this._sample(remaining, Math.min(remaining.length, 3 - chosen.length));
    const options = [...chosen, ...extra];
    this.pendingMutationChoices = options.map((m) => m.id);
    this.state = "mutation-choice";

    // Annotate choices with current level, next level, and synergy readiness
    const annotatedChoices = options.map((m) => {
      const cat = m.category || (BUILD_MUTATIONS[m.id]?.category) || "offensive";
      const currentLvl = this.build[cat]?.[m.id] || 0;
      const nextLvl = currentLvl + 1;
      const bm = BUILD_MUTATIONS[m.id];
      const lvlData = bm?.levels?.[nextLvl - 1];

      let wouldSynergize = false;
      let wouldSynergizeName = "";
      for (const [synKey, syn] of Object.entries(MUTATION_SYNERGIES)) {
        if (this.build.activeSynergies?.includes(synKey)) continue;
        if (syn.requires[m.id] && syn.requires[m.id] <= nextLvl) {
          let otherSatisfied = true;
          for (const [reqId, minLvl] of Object.entries(syn.requires)) {
            if (reqId === m.id) continue;
            const actLvl = (this.build.offensive?.[reqId] || 0) +
                           (this.build.defensive?.[reqId] || 0) +
                           (this.build.passive?.[reqId] || 0) +
                           (this.build.transformations?.[reqId] || 0);
            if (actLvl < minLvl) { otherSatisfied = false; break; }
          }
          if (otherSatisfied) {
            wouldSynergize = true;
            wouldSynergizeName = syn.name;
            break;
          }
        }
      }

      return {
        ...m,
        currentLvl,
        nextLvl,
        isUpgrade: currentLvl > 0,
        levelDesc: lvlData?.desc || m.description,
        wouldSynergize,
        wouldSynergizeName,
      };
    });

    this.emit("mutation-found", {
      rarity,
      choices: annotatedChoices,
    });
    return true;
  }
  applyMutation(mutationId) {
    if (this.state !== "mutation-choice") return false;
    if (!this.pendingMutationChoices?.includes(mutationId)) return false;
    const mutation = MUTATIONS.find((m) => m.id === mutationId);
    if (!mutation) return false;
    this.mutations.push(mutationId);
    this.build ||= createBuildState();
    const buildRes = applyBuildMutation(this.build, mutationId);
    if (mutationId === "titansWrath") {
      this.player.maxHp = Math.round(this.player.maxHp * 1.4);
      this.player.hp = this.player.maxHp;
    }
    this.refreshStats(true);
    this.pendingMutationChoices = [];
    this.state = "playing";
    this.emit("mutation-applied", {
      id: mutationId,
      mutation,
      level: buildRes.level || 1,
      category: buildRes.category || mutation.category,
      text: buildRes.ok ? `MUTATION ADAPTED: ${mutation.name} (Lv ${buildRes.level})!` : `MUTATION ADAPTED: ${mutation.name}!`,
    });
    if (buildRes.newSynergies?.length) {
      for (const synKey of buildRes.newSynergies) {
        const syn = MUTATION_SYNERGIES[synKey];
        this.emit("synergy-unlocked", {
          synergy: synKey,
          definition: syn,
          text: `⚡ UNLOCKED ${syn.title.toUpperCase()}!`,
        });
      }
    }
    return true;
  }
  closeMutationChoice() {
    if (this.state !== "mutation-choice") return false;
    this.pendingMutationChoices = [];
    this.state = "playing";
    return true;
  }
  _offerEvolution() {
    return this.openEvolution();
  }
  special() {
    const p = this.player,
      key = this.kit.special,
      skill = SPECIALS[key];
    if (
      this.state !== "playing" ||
      !skill ||
      p.specialCooldown > 0 ||
      p.stamina < skill.stamina
    )
      return false;
    p.stamina -= skill.stamina;
    p.specialCooldown = skill.cooldown;
    p.abilityActive = 0.6;
    if (key === "rage") {
      this.buffs.damage = Math.max(this.buffs.damage || 0, 7);
      this.buffs.speed = Math.max(this.buffs.speed || 0, 7);
      p.chilled = 0;
      p.slowed = 0;
      this.refreshStats();
      recordNoise(this, p.x, p.y, 4.0);
      for (const e of this.entities) {
        if (distance(p, e) < 6 + this.effectiveSize) {
          e.fear = 3.5;
          e.stunned = 0.4;
        }
      }
    } else if (key === "bulwark") {
      p.guard = 6;
      p.empowered = 6;
      p.bulwarkActive = 6;
    } else if (key === "renewal") {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.30);
      p.poisoned = 0;
      p.chilled = 0;
      p.burning = 0;
      p.bleeding = 0;
      p.regeneration = 5.0;
    } else if (key === "shed") {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.15);
      p.poisoned = 0;
      p.chilled = 0;
      p.burning = 0;
      p.bleeding = 0;
      p.invulnerable = Math.max(p.invulnerable, 1.2);
      this.buffs.speed = Math.max(this.buffs.speed || 0, 3.5);
      this.refreshStats();
      this.decoyHusk = { x: p.x, y: p.y, life: 3.0, radius: 8.0 };
      for (const e of this.entities) {
        if (distance(p, e) < 12) {
          e.aggro = 0;
        }
      }
    } else if (key === "bolt") {
      this.projectiles.push({
        id: "player:" + this.time,
        owner: "player",
        x: p.x,
        y: p.y,
        angle: p.angle,
        speed: 28,
        life: 36 / 28,
        radius: 1.2,
        kind: "lightning",
        damage: p.damage * 2.3,
        cause: skill.name,
      });
    } else if (key === "deathroll") {
      for (const e of [...this.entities]) {
        const d = distance(p, e);
        if (d < 4.8 + this.effectiveSize && hasLineOfSight(p, e, this.worldFeatures || [])) {
          const pullAngle = Math.atan2(p.y - e.y, p.x - e.x);
          sweepMove(e, Math.cos(pullAngle) * 2.2, Math.sin(pullAngle) * 2.2, SPECIES_BY_ID[e.speciesId].size, this.worldFeatures || []);
          e.stunned = 1.6;
          this._hitEntity(e, p.damage * 2.5, 0.4);
        }
      }
    } else if (key === "rending") {
      for (const e of [...this.entities]) {
        const d = distance(p, e),
          arc = Math.abs(angleDifference(Math.atan2(e.y - p.y, e.x - p.x), p.angle));
        if (d < 4.2 + this.effectiveSize && arc < 1.3 && hasLineOfSight(p, e, this.worldFeatures || [])) {
          const wasAfflicted = (e.poison > 0) || (e.bleeding > 0);
          e.poison = 4;
          e.poisonTick = 0;
          e.bleeding = 4;
          e.bleedTick = 0;
          const rendDmg = p.damage * (wasAfflicted ? 2.6 : 1.9);
          if (wasAfflicted) {
            this.emit("synergy-burst", { synergy: "hemorrhage", x: e.x, y: e.y });
          }
          this._hitEntity(e, rendDmg, 1.2);
        }
      }
    }
    this.emit("ability", {
      ability: key,
      specialKey: key,
      radius: (key === "rage" ? 7 : key === "deathroll" ? 5 : 4.5) + this.effectiveSize,
      angle: p.angle,
      x: p.x,
      y: p.y,
      text: skill.name,
    });
    return true;
  }

  _sample(array, count) {
    const pool = [...array],
      result = [];
    while (result.length < count && pool.length)
      result.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    return result;
  }

  evolve(speciesId, mutationId = null) {
    const offeredSpecies = SPECIES_BY_ID[speciesId];
    if (
      this.state !== "evolution" ||
      !offeredSpecies ||
      (mutationId && !MUTATIONS.some((mutation) => mutation.id === mutationId)) ||
      this.player.xp < this.nextThreshold || offeredSpecies.tier !== Math.min(7, this.tier + 1) ||
      (offeredSpecies.bloodline && !eligibleBloodlines(this).some((path) => path.speciesId === speciesId)) ||
      !this.evolutionChoices.includes(speciesId) ||
      (mutationId && !this.mutationChoices.includes(mutationId))
    )
      return false;
    const threshold = this.nextThreshold;
    if (
      SPECIES_BY_ID[speciesId].bloodline &&
      this.lineage.used.includes(SPECIES_BY_ID[speciesId].bloodline)
    )
      return false;
    if (this.tier === 7) this.ascensions++;
    else this.tier++;
    const bloodline = BLOODLINES.find((b) => b.speciesId === speciesId);
    if (bloodline) {
      if (this.lineage.used.includes(bloodline.id)) return false;
      this.lineage.used.push(bloodline.id);
      if (bloodline.id.startsWith("verdant")) this.lineage.fruits.sunheart = 0;
      if (bloodline.id === "cinderfang") this.lineage.lavaKills = 0;
      if (bloodline.id === "eclipse") {
        this.lineage.fruits.moondrop = 0;
        this.lineage.guardians = 0;
      }
    }
    const previousSize=this.effectiveSize,
      nextSpecies=SPECIES_BY_ID[speciesId];
    this.player.speciesId = speciesId;
    this.formHistory = [...(this.formHistory || []), speciesId].slice(-64);
    this.player.formScale=nextSpecies.compactEvolution?1:Math.max(1,previousSize*1.06/(nextSpecies.size*this.geneticTraits.size));
    this.player.nutrients = 0;
    this.player.growth = 0;
    this.formStarted = this.time;
    this.lineage.formKills = 0;
    this.lineage.formGuardians = 0;
    this.evolutionReady = false;
    this.player.xp = Math.max(0, this.player.xp - threshold);
    if (mutationId) this.mutations.push(mutationId);
    this.refreshStats(true);
    this.player.hunger = 100;
    this.player.stamina = 100;
    this.player.invulnerable = 3;
    this.player.abilityCooldown = 0;
    this.player.specialCooldown = 0;
    this.player.techniqueCooldown = 0;
    this.player.dashCooldown = 0;
    this.player.score += 250 * (this.tier + this.ascensions) * this.rules.score;
    this.evolutionChoices = [];
    this.mutationChoices = [];
    this.state = "playing";
    this.emit("evolve", {
      text: `${this.species.name}${this.ascensions ? ` · Ascension ${this.ascensions}` : ""}`,
      radius: 8 + this.species.size,
    });
    // Large meals may cross another threshold; offer it on the next update cycle.
    return true;
  }

  damagePlayer(amount, cause = "A predator", bypass = false, attackerAngle = null) {
    if (this.state !== "playing" || amount <= 0 || !Number.isFinite(amount))
      return false;
    const p = this.player;
    if (p.invulnerable > 0 && !bypass) return false;

    let frontalShield = 1.0;
    let flankVuln = 1.0;
    if (attackerAngle !== null) {
      const rel = Math.abs(angleDifference(attackerAngle, p.angle));
      if (rel > 2.2) {
        if (p.crouching || ["quad", "longneck"].includes(this.species.body) || /ankylo|stego|tricer/.test(this.species.id)) {
          frontalShield = 0.65;
          if (this.survivalBehavior) this.survivalBehavior.damageBlocked = (this.survivalBehavior.damageBlocked || 0) + (amount * 0.35);
        }
      } else if (rel < 0.95) {
        flankVuln = 1.25;
      }
    }

    const damage =
      amount *
      frontalShield *
      flankVuln *
      (1 - p.armor) *
      (1 - this.geneticTraits.resistance) *
      (p.guard > 0 ? 0.35 : 1) *
      (this.hasBuff("shield") ? 0.6 : 1);

    let absorbedDamage = damage;
    if (this.build?.barrierHp > 0) {
      if (this.build.barrierHp >= absorbedDamage) {
        this.build.barrierHp -= absorbedDamage;
        absorbedDamage = 0;
      } else {
        absorbedDamage -= this.build.barrierHp;
        this.build.barrierHp = 0;
      }
    }
    p.hp = Math.max(0, p.hp - absorbedDamage);
    p.sleeping = 0;
    if (!bypass) {
      this.timeSinceDamaged = 0;

      // Reflective Armor
      const reflectLvl = this.build?.defensive?.reflectiveArmor || 0;
      if (reflectLvl > 0) {
        const reflectPct = 0.15 + (reflectLvl - 1) * 0.11;
        const refDmg = damage * reflectPct;
        for (const e of this.entities) {
          if (distance(p, e) < 5.5) {
            e.hp -= refDmg;
            e.hitFlash = 0.15;
            this.emit("hit", { x: e.x, y: e.y, amount: refDmg, target: e.id, reflect: true });
          }
        }
      }

      // Thorns
      const thornsLvl = this.build?.defensive?.thorns || 0;
      if (thornsLvl > 0) {
        const thornDmg = 18 + (thornsLvl - 1) * 20;
        for (const e of this.entities) {
          if (distance(p, e) < 4.5) {
            e.hp -= thornDmg;
            e.hitFlash = 0.15;
            if (thornsLvl >= 3) e.bleeding = Math.max(e.bleeding || 0, 3.0);
            this.emit("hit", { x: e.x, y: e.y, amount: thornDmg, target: e.id, thorns: true });
          }
        }
      }

      // Toxic Blood
      const toxicBloodLvl = this.build?.defensive?.toxicBlood || 0;
      if (toxicBloodLvl > 0) {
        const acidDmg = 25 + (toxicBloodLvl - 1) * 31;
        for (const e of this.entities) {
          if (distance(p, e) < 5.0) {
            e.poison = Math.max(e.poison || 0, 4.0);
            e.hp -= acidDmg;
            this.emit("hit", { x: e.x, y: e.y, amount: acidDmg, target: e.id, poison: true });
          }
        }
      }

      // Glacial Fortress Synergy: Flash-freeze on heavy hit
      if (this.build?.activeSynergies?.includes("glacialFortress") && (amount > p.maxHp * 0.16 || amount > 25)) {
        if (!this._lastGlacialProc || this.time - this._lastGlacialProc > 8) {
          this._lastGlacialProc = this.time;
          for (const e of this.entities) {
            if (distance(p, e) < 7.5) {
              e.frozen = 3.0;
              e.stunned = 3.0;
              e.chilled = 5.0;
            }
          }
          p.invulnerable = Math.max(p.invulnerable, 1.5);
          this.emit("synergy-burst", { synergy: "glacialFortress", x: p.x, y: p.y, text: "GLACIAL FORTRESS: Flash-Freeze Barrier!" });
        }
      }

      // Volcanic Scales Transformation
      if (this.build?.transformations?.volcanicScales) {
        for (const e of this.entities) {
          if (distance(p, e) < 7.0) {
            e.burning = Math.max(e.burning || 0, 3.5);
            e.hp -= p.damage * 0.85;
            this.emit("hit", { x: e.x, y: e.y, amount: p.damage * 0.85, target: e.id, fire: true });
          }
        }
      }

      if (this.mutationCounts.volcanicCore) {
        for (const e of this.entities) {
          if (distance(p, e) < 6.5) {
            e.burning = Math.max(e.burning || 0, 3.5);
            e.hp -= p.damage * 0.75;
            this.emit("hit", { x: e.x, y: e.y, amount: p.damage * 0.75, target: e.id, fire: true });
          }
        }
        this.emit("ability", { ability: "shockwave", radius: 6.5, text: "Volcanic Retaliation" });
      }
      const causeStr = typeof cause === "string" ? cause : (cause?.name || "");
      if (this.survivalBehavior && (causeStr.includes("Apex") || causeStr.includes("Alpha") || (amount > p.maxHp * 0.2))) {
        this.survivalBehavior.apexHitsTaken = (this.survivalBehavior.apexHitsTaken || 0) + 1;
      }
      recordBlood(this, p.x, p.y);
      if (damage > p.maxHp * .22 && this.survival) this.survival.strain = 12;
      if (damage > p.maxHp * 0.16) this.hitStop = 0.05;
      p.invulnerable = 0.38;
      this.emit("hit", { amount: damage, target: "player", cause });
    }
    if (p.hp <= 0) {
      this.state = "dead";
      this.cause = cause;
      this.emit("death", { text: cause });
    }
    return true;
  }

  _hitEntity(e, amount, knockback = 0, isCrit = false, hitAngle = null) {
    if (!this.entities.includes(e) || e.hp <= 0) return;
    this.hitStop = 0.045;
    e.sleeping = 0;
    if (e.telegraph > 0 && (amount > e.maxHp * 0.14 || knockback > 0.8)) {
      e.telegraph = 0;
      e.cast = null;
    }
    const m = this.mutationCounts || {};
    const res = phenotype(e.genome).resistance;
    let actualAmount = amount;
    if (e.eliteMutation === "Armored") {
      actualAmount *= 0.60;
    }
    if (m.boneCrusher) {
      actualAmount *= (1 - res * 0.55);
      if (this.random() < 0.28) {
        e.stunned = Math.max(e.stunned || 0, 1.2);
      }
    } else {
      actualAmount *= (1 - res);
    }
    if (m.toxicBile) {
      e.poison = Math.max(e.poison || 0, 4.5);
      e.slowed = Math.max(e.slowed || 0, 3.5);
    }

    // Build Offensive Mutations & Synergies
    const fangsLvl = this.build?.offensive?.serratedFangs || 0;
    const clawsLvl = this.build?.offensive?.bleedingClaws || 0;
    if (fangsLvl > 0 || clawsLvl > 0) {
      e.bleeding = Math.max(e.bleeding || 0, 3.5 + fangsLvl * 0.3);
      e.bleedRate = 0.15 + fangsLvl * 0.13 + clawsLvl * 0.10;
    }
    const frostLvl = this.build?.offensive?.frostBite || 0;
    if (frostLvl > 0) {
      e.chilled = Math.max(e.chilled || 0, 3.0 + frostLvl * 0.4);
      e.freezeHits = (e.freezeHits || 0) + 1;
      const neededHits = frostLvl >= 5 ? 2 : frostLvl >= 4 ? 3 : 5;
      if (e.freezeHits >= neededHits) {
        e.freezeHits = 0;
        e.stunned = Math.max(e.stunned || 0, 1.5 + frostLvl * 0.2);
        e.frozen = 2.0;
        this.emit("hit", { x: e.x, y: e.y, target: e.id, frozen: true });
      }
    }
    const spitLvl = this.build?.offensive?.venomSpit || 0;
    if (spitLvl > 0) {
      e.poison = Math.max(e.poison || 0, 4.0);
      e.slowed = Math.max(e.slowed || 0, 2.5);
    }
    if (this.build?.activeSynergies?.includes("plagueCloud")) {
      this.build.poisonClouds ||= [];
      if (this.build.poisonClouds.length < 8) {
        this.build.poisonClouds.push({
          x: e.x,
          y: e.y,
          life: 6.0,
          radius: 4.5,
          damage: 28,
        });
        this.emit("synergy-burst", { synergy: "plagueCloud", x: e.x, y: e.y });
      }
    }
    const chainLvl = this.build?.offensive?.chainLightning || 0;
    if (chainLvl > 0) {
      const maxArcs = chainLvl;
      const arcDmg = actualAmount * (0.35 + chainLvl * 0.12);
      let hitCount = 0;
      for (const other of this.entities) {
        if (other !== e && distance(other, e) < 8.0 && hitCount < maxArcs) {
          other.hp -= arcDmg;
          other.hitFlash = 0.18;
          if (chainLvl >= 3 && this.random() < 0.25) other.stunned = Math.max(other.stunned || 0, 1.0);
          this.emit("hit", { x: other.x, y: other.y, amount: arcDmg, target: other.id, lightning: true });
          hitCount++;
        }
      }
    }
    const tailLvl = this.build?.offensive?.spikedTail || 0;
    if (tailLvl > 0 && knockback > 0) {
      const tailSweepDmg = actualAmount * (0.5 + tailLvl * 0.25);
      for (const other of this.entities) {
        if (other !== e && distance(this.player, other) < 4.5) {
          other.hp -= tailSweepDmg;
          if (tailLvl >= 3) other.stunned = Math.max(other.stunned || 0, 1.0);
          this.emit("hit", { x: other.x, y: other.y, amount: tailSweepDmg, target: other.id, knockback: true });
        }
      }
    }

    e.hp -= actualAmount;
    e.hitFlash = 0.18;
    e.aggro = 10;
    recordBlood(this, e.x, e.y, e.id);
    if (e.packId)
      for (const mate of this.entities)
        if (mate.packId === e.packId && distance(mate, e) < 45) mate.aggro = 12;
    if (knockback) {
      const angle = hitAngle !== null ? hitAngle : Math.atan2(e.y - this.player.y, e.x - this.player.x);
      const res = sweepMove(e, Math.cos(angle) * knockback, Math.sin(angle) * knockback, SPECIES_BY_ID[e.speciesId].size * (e.scaleFactor || 1), this.worldFeatures || []);
      if (res?.hit && knockback > 0.35) {
        const wallBonus = amount * 0.25;
        e.hp -= wallBonus;
        e.stunned = Math.max(e.stunned || 0, 1.0);
        this.emit("hit", { x: e.x, y: e.y, amount: wallBonus, target: e.id, wallSlam: true });
      }
    }
    this.emit("hit", { x: e.x, y: e.y, amount, target: e.id, crit: isCrit });
    if (e.hp > 0) return;
    this.hitStop = e.boss ? 0.09 : 0.065;
    const s = SPECIES_BY_ID[e.speciesId];
    if (e.isRegionalAlpha && e.alphaRegion) {
      this.dominatedRegions ||= new Set();
      this.dominatedRegions.add(e.alphaRegion);
      this.emit("dominance", {
        regionId: e.alphaRegion,
        text: `TERRITORIAL DOMINANCE: ${e.name} Slain! You rule ${biomeAt(e.x, e.y).name}!`,
      });
      this.emit("dna-find", { amount: 3, receipt: `dominance:${e.alphaRegion}` });
    }
    if (!this.strongestDefeated || s.tier > (SPECIES_BY_ID[this.strongestDefeated]?.tier || 0)) {
      this.strongestDefeated = s.id;
    }
    if (this.survivalBehavior) {
      const tod = getTimeOfDay(this.time);
      if (tod.name === "night" || tod.name === "dusk") {
        this.survivalBehavior.nightKills = (this.survivalBehavior.nightKills || 0) + 1;
      }
      if (this.playerMateId || this.petId) {
        this.survivalBehavior.packKills = (this.survivalBehavior.packKills || 0) + 1;
      }
    }
    this.entities = this.entities.filter((other) => other !== e);
    this.player.kills++;
    this.player.score +=
      (30 + s.tier * 35) * (e.boss ? 5 : 1) * this.rules.score;
    const count = e.boss ? 5 : 1;
    for (let i = 0; i < count; i++)
      this.spawnFood(
        e.boss ? "essence" : "meat",
        e.x + (this.random() - 0.5) * 2,
        e.y + (this.random() - 0.5) * 2,
        (16 + s.tier * 16) * (e.boss ? 1.7 : 1),
        { tier: s.tier, homeChunk: e.homeChunk || chunkKey(e.x, e.y) },
      );
    if (e.lairId) {
      const lair = this.lairs.find((l) => l.id === e.lairId);
      if (lair) {
        lair.defeats++;
        lair.entityId = null;
        lair.respawnAt = this.time + lair.respawn;
      }
      this.spawnFood("rareplant", e.x + 2, e.y, 20, {
        tier: s.tier,
        powerup: this.pick(["damage", "magnet", "autoeat", "regen"]),
      });
      const isEliteOrBoss = !!e.boss || !!e.isAlpha;
      if (this.random() < (isEliteOrBoss ? 0.55 : 0.07))
        this.spawnFood("relic", e.x - 2, e.y, 30, {
          tier: s.tier,
          skillId: this.pick([
            "meteor",
            "timewarp",
            "soulstorm",
            "blink",
            "thunder",
            "rebirth",
          ]),
        });
      if (this.random() < 0.045)
        this.spawnFood("fossil", e.x, e.y + 2, 40, {
          tier: s.tier,
          rewardType: this.random() < 0.6 ? "skin" : "modifier",
        });
      const homeChunk = chunkKey(e.x, e.y);
      if (this.random() < 0.15)
        this.spawnFood("dna", e.x + 3, e.y - 2, 0, {
          tier: s.tier,
          amount: 2 + Math.floor(this.random() * 4),
          homeChunk,
        });
      if (this.random() < 0.012)
        this.spawnFood("pet-egg", e.x - 3, e.y - 2, 0, {
          tier: s.tier,
          sku: rollCollectionItem("pet", () => this.random()).sku,
          homeChunk,
        });
      if (this.random() < 0.08)
        this.spawnFood("decoration-cache", e.x + 3, e.y + 2, 0, {
          tier: s.tier,
          sku: rollCollectionItem("decoration", () => this.random()).sku,
          homeChunk,
        });
    }
    // Rare Mutation Catalyst Drop (using deterministic hash to preserve PRNG sequence)
    const isBoss = !!e.boss || !!e.isAlpha;
    const isHighTier = s.tier >= 4;
    const mutationChance = isBoss ? 1.0 : isHighTier ? 0.16 : 0.05;
    const dropHash = Math.abs(Math.sin((e.x * 43.1 + e.y * 19.7 + e.id + this.seed) * 17.3));
    const dropRoll = (dropHash * 1000) % 1;
    if (dropRoll < mutationChance) {
      const rarityRoll = (dropHash * 10000) % 1;
      let rarity = "common";
      if (isBoss) {
        rarity = rarityRoll < 0.45 ? "legendary" : "epic";
      } else if (isHighTier) {
        rarity = rarityRoll < 0.15 ? "legendary" : rarityRoll < 0.55 ? "epic" : "rare";
      } else {
        rarity = rarityRoll < 0.05 ? "epic" : rarityRoll < 0.35 ? "rare" : "common";
      }
      this.spawnFood("mutation-catalyst", e.x, e.y, 45, {
        tier: s.tier,
        rarity,
        homeChunk: e.homeChunk || chunkKey(e.x, e.y),
      });
    }
    // Hemorrhage Ultimate Mutation on Kill
    if (this.build?.activeSynergies?.includes("hemorrhage") && ((e.bleeding || 0) > 0 || (e.bleedRate || 0) > 0 || isCrit)) {
      const aoeRadius = 12;
      const aoeDamage = 120 + this.player.damage * 0.6;
      for (const other of this.entities) {
        if (other !== e && distance(other, e) < aoeRadius) {
          other.hp -= aoeDamage;
          other.bleeding = Math.max(other.bleeding || 0, 4.0);
          other.hitFlash = 0.2;
          this.emit("hit", { x: other.x, y: other.y, amount: aoeDamage, target: other.id, bleed: true });
        }
      }
      const healAmt = this.player.maxHp * 0.10;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmt);
      this.emit("synergy-burst", {
        synergy: "hemorrhage",
        x: e.x,
        y: e.y,
        radius: aoeRadius,
        damage: aoeDamage,
        heal: healAmt,
        text: "HEMORRHAGE ERUPTION! Crimson Burst & Life Restored!",
      });
    }

    // Bloodlust Passive on Kill
    const bloodlustLvl = this.build?.passive?.bloodlust || 0;
    if (bloodlustLvl > 0) {
      this.buffs.speed = Math.max(this.buffs.speed || 0, 4.0 + bloodlustLvl * 0.8);
      this.buffs.damage = Math.max(this.buffs.damage || 0, 4.0 + bloodlustLvl * 0.8);
      if (bloodlustLvl >= 4) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * (bloodlustLvl >= 5 ? 0.08 : 0.04));
      }
      this.refreshStats();
    }

    if (this.mutationCounts.predator)
      this.player.hp = Math.min(
        this.player.maxHp,
        this.player.hp +
          this.player.maxHp * 0.06 * this.mutationCounts.predator,
      );
    if (this.mutationCounts.bloodRush) {
      this.buffs.speed = Math.max(this.buffs.speed || 0, 6.0);
      this.buffs.damage = Math.max(this.buffs.damage || 0, 6.0);
      this.refreshStats();
      this.emit("buff", { text: "PRIMAL FRENZY! Speed & Damage Surging!" });
    }
    if (e.boss) this.boss = null;
    this.lineage.formKills++;
    if (biomeAt(e.homeX ?? e.x, e.homeY ?? e.y).id === "volcano")
      this.lineage.lavaKills++;
    if (e.lairId) {
      this.lineage.guardians++;
      this.guardianKills++;
      this.lineage.formGuardians++;
    }
    this.emit("kill", {
      speciesId: s.id,
      x: e.x,
      y: e.y,
      text: e.boss ? `${s.name} alpha defeated` : s.name,
      boss: e.boss,
      lairId: e.lairId,
      entityId: e.id,
    });
  }

  _creatureDamage(victim, attacker, amount, knockback = 0) {
    if (!this.entities.includes(victim) || victim.hp <= 0) return;
    victim.sleeping = 0;
    const resistance = victim.genome ? phenotype(victim.genome).resistance : 0;
    const actualDamage = Math.max(1, amount * (1 - resistance));
    victim.hp = Math.max(0, victim.hp - actualDamage);
    victim.hitFlash = 0.22;
    recordBlood(this, victim.x, victim.y, victim.id);
    if (knockback && attacker) {
      const angle = Math.atan2(victim.y - attacker.y, victim.x - attacker.x);
      sweepMove(victim, Math.cos(angle) * knockback, Math.sin(angle) * knockback, SPECIES_BY_ID[victim.speciesId].size * (victim.scaleFactor || 1), this.worldFeatures || []);
    }
    this.emit("hit", { x: victim.x, y: victim.y, amount: actualDamage, target: victim.id });
    if (victim.hp > 0) {
      const victimSpecies = SPECIES_BY_ID[victim.speciesId];
      if (victimSpecies.temperament === "skittish" || victim.hp < victim.maxHp * 0.22) {
        victim.fear = 4.5;
        victim.rivalId = null;
      } else if (!victim.rivalId || victim.rivalId !== attacker.id) {
        victim.rivalId = attacker.id;
      }
      return;
    }
    const s = SPECIES_BY_ID[victim.speciesId];
    this.entities = this.entities.filter((other) => other !== victim);
    this.emit("kill", { speciesId: s.id, x: victim.x, y: victim.y, wild: true });
    const count = victim.boss ? 4 : Math.min(3, Math.max(1, Math.round(s.size * 0.75)));
    for (let i = 0; i < count; i++) {
      this.spawnFood(
        "meat",
        victim.x + (this.random() - 0.5) * 2,
        victim.y + (this.random() - 0.5) * 2,
        14 + s.tier * 12,
        { tier: s.tier, homeChunk: victim.homeChunk || chunkKey(victim.x, victim.y) },
      );
    }
    if (victim.lairId) {
      const lair = this.lairs.find((l) => l.id === victim.lairId);
      if (lair) {
        lair.defeats++;
        lair.entityId = null;
        lair.respawnAt = this.time + lair.respawn;
      }
    }
    if (this.boss?.id === victim.id) this.boss = null;
  }

  getResults() {
    return {
      runId: this.runId,
      speciesId: this.player.speciesId,
      tier: this.tier,
      kills: this.player.kills,
      time: Math.floor(this.time),
      score: Math.floor(this.player.score),
      dna: this.earnedDNA,
      cause: this.cause || "Run ended",
      ascensions: this.ascensions,
      seed: this.seed,
      difficulty: this.difficulty,
      mutations: [...this.mutations],
      genome: structuredClone(this.player.genome),
      adaptations: { ...this.player.adaptations },
      guardians: this.guardianKills,
      discoveries: (this.exploration?.discoveries || []).map(d => ({ ...d })),
      regionId: biomeAt(this.player.x, this.player.y).id,
      strongestDefeated: this.strongestDefeated || null,
      offspringCount: this.playerOffspringCount || 0,
      dominatedRegions: [...(this.dominatedRegions || [])],
      mateSpecies: this.playerMateId ? (this.entities.find((e) => e.id === this.playerMateId)?.speciesId || null) : null,
      formHistory: [...(this.formHistory || [this.player.speciesId])],
    };
  }
}
Object.assign(Game.prototype, Ecosystem);
