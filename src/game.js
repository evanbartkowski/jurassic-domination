import { SPECIES, SPECIES_BY_ID, MUTATIONS, DIFFICULTIES } from "./data.js";
import { rollCollectionItem } from "./collection-data.js";
import { Ecosystem, initializeEcosystem } from "./ecosystem.js";
import { ABILITIES } from "./content.js";
import {
  WORLD_RADIUS,
  biomeAt,
  foodEfficiency,
  chunkKey,
} from "./world-data.js";

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const thresholds = [60, 160, 340, 680, 1100, 1800, 2800, 4200];
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
  } = {}) {
    this.seed = Number(seed) >>> 0;
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
    this._starter = this.pick(SPECIES.filter((s) => s.tier === 0));
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
    };
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
  get nextThreshold() {
    return Math.round(thresholds[this.tier] * (1 + this.ascensions * 0.38));
  }
  get mutationCounts() {
    const counts = {};
    for (const id of this.mutations) counts[id] = (counts[id] || 0) + 1;
    return counts;
  }

  refreshStats(heal = false) {
    const p = this.player,
      s = this.species,
      m = this.mutationCounts;
    const ratio = p.hp / Math.max(1, p.maxHp);
    p.maxHp = Math.round(
      s.hp *
        (1 +
          this.upgrades.vitality * 0.05 +
          (m.vitality || 0) * 0.18 +
          (this.modifiers.has("ancient-heart") ? 0.08 : 0)) *
        (1 + this.ascensions * 0.15),
    );
    p.hp = heal ? p.maxHp : Math.min(p.maxHp, p.maxHp * ratio);
    p.damage =
      s.damage *
      (1 +
        this.upgrades.instinct * 0.04 +
        (m.razor || 0) * 0.18 +
        (this.modifiers.has("predator-mark") ? 0.06 : 0)) *
      (1 + this.ascensions * 0.14) *
      (this.hasBuff("damage") ? 1.5 : 1);
    p.speed =
      s.speed *
      (1 + (m.swift || 0) * 0.1 + (this.modifiers.has("wanderer") ? 0.07 : 0)) *
      (this.hasBuff("speed") ? 1.4 : 1);
    p.armor = Math.min(
      0.55,
      (m.ironhide || 0) * 0.12 + (s.body === "quad" ? 0.12 : 0),
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
    const entity = {
      id: this._nextId++,
      x,
      y,
      angle: this.random() * TAU,
      speciesId,
      hp: maxHp * (options.juvenile ? 0.45 : 1),
      maxHp: maxHp * (options.juvenile ? 0.45 : 1),
      adultMaxHp: maxHp,
      attackCooldown: 1 + this.random(),
      telegraph: 0,
      intent: "wander",
      passive: options.passive ?? ["quad", "longneck"].includes(s.body),
      boss: !!options.boss,
      stunned: 0,
      fear: 0,
      poison: 0,
      poisonTick: 0,
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
      age: 0,
      scaleFactor: options.juvenile ? 0.42 : 1,
    };
    this.entities.push(entity);
    return entity;
  }

  spawnFood(type, x, y, value = 12, options = {}) {
    const food = {
      id: this._nextId++,
      type,
      x,
      y,
      value,
      age: 0,
      tier: biomeAt(x, y).tier,
      ...options,
    };
    this.foods.push(food);
    return food;
  }

  hatch() {
    if (this.state !== "egg") return false;
    this.state = "playing";
    this.player.invulnerable = 2.5;
    this.emit("hatch", {
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
    const dt = clamp(Number(delta) || 0, 0, 0.1);
    if (this.state === "egg") {
      this.eggTime += dt;
      if (this.eggTime >= 3 || input.attack || input.eat) this.hatch();
      return;
    }
    if (this.state !== "playing" || dt === 0) return;
    if (this.player.xp >= this.nextThreshold) {
      this._offerEvolution();
      return;
    }
    this.time += dt;
    const p = this.player,
      s = this.species,
      m = this.mutationCounts;
    for (const key of [
      "abilityCooldown",
      "dashCooldown",
      "attackCooldown",
      "invulnerable",
      "attacking",
      "abilityActive",
    ])
      p[key] = Math.max(0, p[key] - dt);
    this._eatCooldown = Math.max(0, this._eatCooldown - dt);
    this._warningCooldown = Math.max(0, this._warningCooldown - dt);
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
    const speed = p.speed * (sprint ? 1.65 : 1) * (p.chilled > 0 ? 0.6 : 1);
    // Acceleration and braking remove abrupt starts while preserving precise aim.
    const response = 1 - Math.exp(-dt * (length > 0.05 ? 13 : 19));
    p.vx += (mx * speed - p.vx) * response;
    p.vy += (my * speed - p.vy) * response;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.stamina = clamp(
      p.stamina + (sprint ? -20 : 24 + (m.swift || 0) * 5) * dt,
      0,
      100,
    );
    if (input.dash) this.dash(mx, my);
    this._containPlayer();
    if (input.attack) this.attack();
    if (input.ability) this.ability();
    if (input.eat) this.eat();

    this.updateEcosystem(dt, input);
    if (this.state !== "playing") return;
    const radius = Math.hypot(p.x, p.y);
    const hungerDrain =
      0.39 *
      (1 + this.tier * 0.07) *
      this.rules.hunger *
      Math.max(0.35, 1 - this.upgrades.metabolism * 0.06) *
      Math.pow(0.75, m.metabolism || 0);
    p.hunger = Math.max(0, p.hunger - hungerDrain * dt * (sprint ? 1.45 : 1));
    if (p.hunger > 60 && p.hp < p.maxHp)
      p.hp = Math.min(
        p.maxHp,
        p.hp + p.maxHp * 0.009 * dt * (s.body === "equine" ? 1.6 : 1),
      );
    if (p.hunger <= 0)
      this.damagePlayer(p.maxHp * 0.035 * dt, "Starvation", true);
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
        this.ascensions * 0.1,
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

  attack() {
    const p = this.player;
    if (this.state !== "playing" || p.attackCooldown > 0) return false;
    p.attackCooldown = ["raptor", "bird"].includes(this.species.body)
      ? 0.43
      : 0.52;
    p.attacking = 0.2;
    const reach = 2.8 + this.species.size * 1.1;
    this.emit("attack", { angle: p.angle, radius: reach });
    for (const e of [...this.entities]) {
      const target = SPECIES_BY_ID[e.speciesId];
      if (
        distance(p, e) < reach + target.size * 0.45 &&
        Math.abs(angleDifference(Math.atan2(e.y - p.y, e.x - p.x), p.angle)) <
          1.25
      ) {
        const multiplier =
          (p.empowered > 0 ? 1.65 : 1) *
          (this.species.body === "raptor"
            ? 1 + Math.min(3, p.combo) * 0.1
            : 1) *
          (this.species.body === "croc" && e.aggro <= 0 ? 1.35 : 1);
        if (this.species.body === "serpent" || p.venomFang > 0) {
          e.poison = 5;
          e.poisonTick = 0;
        }
        this._hitEntity(e, p.damage * multiplier, 0.65);
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
    if (this.state !== "playing" || p.dashCooldown > 0 || p.stamina < cost)
      return false;
    const angle = Math.hypot(mx, my) > 0.05 ? Math.atan2(my, mx) : p.angle;
    const amount = 5.8 + this.species.size * 0.45;
    p.x += Math.cos(angle) * amount;
    p.y += Math.sin(angle) * amount;
    p.stamina -= cost;
    p.dashCooldown = this.species.body === "bird" ? 1.2 : 1.6;
    p.invulnerable = Math.max(p.invulnerable, 0.32);
    this._containPlayer();
    this.emit("dash", { angle });
    return true;
  }

  ability() {
    const p = this.player,
      s = this.species,
      m = this.mutationCounts;
    if (this.state !== "playing" || p.abilityCooldown > 0) return false;
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
      p.x += Math.cos(p.angle) * (4 + s.size);
      p.y += Math.sin(p.angle) * (4 + s.size);
      this._containPlayer();
      p.invulnerable = Math.max(p.invulnerable, 0.6);
    }
    if (type === "heal") {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
      p.guard = 3;
    }
    const radius = definition.radius + s.size;
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
        (definition.shape === "cone" && angle > 0.9)
      )
        continue;
      if (type === "venom") {
        e.poison = 5;
        e.poisonTick = 0;
      }
      if (type === "roar") e.fear = 3;
      if (type === "frost" || type === "web") e.slowed = 6;
      e.stunned = ["stomp", "petrify", "lightning"].includes(type) ? 1.4 : 0.4;
      const damage = p.damage * definition.power;
      this._hitEntity(e, damage, 1.4);
      if (type === "blood") p.hp = Math.min(p.maxHp, p.hp + damage * 0.2);
    }
    return true;
  }

  eat() {
    if (this.state !== "playing" || this._eatCooldown > 0) return false;
    const p = this.player,
      radius = 3.4 + this.species.size * 0.6;
    const available = this.foods
      .filter((f) => distance(p, f) <= radius)
      .sort((a, b) => distance(p, a) - distance(p, b));
    const food = available[0];
    if (!food) return false;
    this.foods = this.foods.filter((f) => f.id !== food.id);
    this._eatCooldown = 0.17;
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
    p.hunger = Math.min(
      100,
      p.hunger +
        (food.type === "meat"
          ? 25
          : food.type === "essence"
            ? 40
            : food.type === "egg"
              ? 30
              : 12) *
          (1 + (m.metabolism || 0) * 0.15) *
          Math.max(0.08, Math.sqrt(quality)),
    );
    p.hp = Math.min(
      p.maxHp,
      p.hp +
        p.maxHp *
          (food.type === "plant" ? 0.025 : 0.075) *
          Math.max(0.12, Math.sqrt(quality)) *
          (this.species.body === "longneck" ? 1.4 : 1),
    );
    this.collectSpecial(food);
    this.gainXP(food.value * quality);
    this.emit("eat", {
      x: food.x,
      y: food.y,
      amount: food.value,
      food: food.type,
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
    if (this.player.xp >= this.nextThreshold) this._offerEvolution();
  }

  _offerEvolution() {
    this.state = "evolution";
    const candidates = SPECIES.filter(
      (s) => s.tier === Math.min(7, this.tier + 1),
    );
    this.evolutionChoices = this._sample(candidates, 3).map((s) => s.id);
    this.mutationChoices = this._sample(MUTATIONS, 3).map((m) => m.id);
    this.emit("evolution-ready", {
      text:
        this.tier === 7
          ? "Ascension awaits. Become something greater."
          : "Evolution unlocked. Choose your next form.",
    });
  }

  _sample(array, count) {
    const pool = [...array],
      result = [];
    while (result.length < count && pool.length)
      result.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    return result;
  }

  evolve(speciesId, mutationId) {
    if (
      this.state !== "evolution" ||
      !this.evolutionChoices.includes(speciesId) ||
      !this.mutationChoices.includes(mutationId)
    )
      return false;
    const threshold = this.nextThreshold;
    if (this.tier === 7) this.ascensions++;
    else this.tier++;
    this.player.speciesId = speciesId;
    this.player.xp = Math.max(0, this.player.xp - threshold);
    this.mutations.push(mutationId);
    this.refreshStats(true);
    this.player.hunger = 100;
    this.player.stamina = 100;
    this.player.invulnerable = 3;
    this.player.abilityCooldown = 0;
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

  damagePlayer(amount, cause = "A predator", bypass = false) {
    if (this.state !== "playing" || amount <= 0 || !Number.isFinite(amount))
      return false;
    const p = this.player;
    if (p.invulnerable > 0 && !bypass) return false;
    const damage =
      amount *
      (1 - p.armor) *
      (p.guard > 0 ? 0.35 : 1) *
      (this.hasBuff("shield") ? 0.6 : 1);
    p.hp = Math.max(0, p.hp - damage);
    if (!bypass) {
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

  _hitEntity(e, amount, knockback = 0) {
    if (!this.entities.includes(e) || e.hp <= 0) return;
    e.hp -= amount;
    e.hitFlash = 0.18;
    e.aggro = 10;
    if (e.packId)
      for (const mate of this.entities)
        if (mate.packId === e.packId && distance(mate, e) < 45) mate.aggro = 12;
    if (knockback) {
      const angle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
      e.x += Math.cos(angle) * knockback;
      e.y += Math.sin(angle) * knockback;
    }
    this.emit("hit", { x: e.x, y: e.y, amount, target: e.id });
    if (e.hp > 0) return;
    const s = SPECIES_BY_ID[e.speciesId];
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
        (14 + s.tier * 14) * (e.boss ? 1.7 : 1),
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
      if (this.random() < 0.28)
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
    if (this.mutationCounts.predator)
      this.player.hp = Math.min(
        this.player.maxHp,
        this.player.hp +
          this.player.maxHp * 0.05 * this.mutationCounts.predator,
      );
    if (e.boss) this.boss = null;
    this.emit("kill", {
      x: e.x,
      y: e.y,
      text: e.boss ? `${s.name} alpha defeated` : s.name,
      boss: e.boss,
      lairId: e.lairId,
      entityId: e.id,
    });
  }

  getResults() {
    return {
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
    };
  }
}
Object.assign(Game.prototype, Ecosystem);
