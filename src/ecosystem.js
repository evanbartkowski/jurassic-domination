import {
  worldFeatures,
  resolveObstacles,
  updateWildlife,
} from "./wilderness.js";
import { feedEntity, growthFromFood, creatureKit } from "./progression.js";
import { canEatFood, speciesDiet, plantDefinition } from "./forage.js";
import { attackProfile, firstSolidHit, segmentCircleHit, hasLineOfSight, attackLineClear, sweepMove } from "./combat.js";
import { SPECIES, SPECIES_BY_ID } from "./data.js";
import { initializeSenses, updateSenses, perceivePlayer } from "./senses.js";
import { createNest, initializeLifeEntity, matureEntity, hatchEgg, updateLifeCycle, notifyNestTheft } from "./life-cycle.js";
import { conditionsAt } from "./world-events.js";
import { rollCollectionItem } from "./collection-data.js";
import {
  ABILITIES,
  TECHNIQUES,
  RUN_SKILLS,
  POWERUPS,
  SKINS,
  PERMANENT_MODIFIERS,
} from "./content.js";
import {
  WORLD_RADIUS,
  CHUNK_SIZE,
  biomeAt,
  chunkKey,
  chunkSeed,
  seeded,
  LAIRS,
  foodEfficiency,
} from "./world-data.js";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function inAttackZone(point, zone) {
  const distance = dist(point, zone);
  if (distance > zone.radius) return false;
  return (
    zone.shape !== "cone" ||
    Math.abs(
      angleDiff(Math.atan2(point.y - zone.y, point.x - zone.x), zone.angle),
    ) <= 0.75
  );
}
export function initializeEcosystem(
  game,
  { modifiers = [], skinId = "natural", knownUnlocks = [] } = {},
) {
  game.modifiers = new Set(
    modifiers.filter((id) => PERMANENT_MODIFIERS.some((m) => m.id === id)),
  );
  game.skinId = SKINS.some((s) => s.id === skinId) ? skinId : "natural";
  game.knownUnlocks = new Set(knownUnlocks);
  game.foundUnlocks = new Set();
  game.chunks = new Map();
  game.activeChunks = new Set();
  game._chunkPosition = "";
  game.buffs = {};
  game.runSkills = [];
  game.discoveredRegions = new Set();
  game.earnedDNA = 0;
  game.projectiles = [];
  game.nests = [];
  game._nextSocialAt = 0;
  initializeSenses(game);
  game.lairs = LAIRS.map((l) => ({
    ...l,
    entityId: null,
    respawnAt: 0,
    defeats: 0,
  }));
  game.waypoint = null;
  game._bossSelection = 0;
  Object.assign(game.player, {
    vx: 0,
    vy: 0,
    techniqueCooldown: 0,
    roarCooldown: 0,
    guard: 0,
    empowered: 0,
    camouflage: 0,
    chilled: 0,
    poisoned: 0,
    bleeding: 0,
    burning: 0,
    sleeping: 0,
    combo: 0,
    comboTime: 0,
  });
  const random = seeded(game.seed ^ 0x148c2),
    a = random() * Math.PI * 2,
    r = 1150 + random() * 340;
  game.secretSite = {
    x: Math.cos(a) * r,
    y: Math.sin(a) * r,
    type: random() < 0.55 ? "skin" : "modifier",
    reward: null,
  };
}

export const Ecosystem = {
  onFoodConsumed(food, consumer = this.player) {
    notifyNestTheft(this, food, consumer);
  },
  hasBuff(id) {
    return (this.buffs[id] || 0) > 0;
  },
  populateWorld() {
    this._streamWorld(true);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2,
        r = 24 + this.random() * 17;
      this.spawnEntity(
        this.pick(SPECIES.filter((s) => s.tier === 0)).id,
        Math.cos(a) * r,
        Math.sin(a) * r,
        {
          passive: i < 2,
          behavior: i < 2 ? "neutral" : "hunter",
          homeChunk: "0,0",
        },
      );
    }
    this.spawnFood("plant", 3, 1, 2, { tier: 0, plantKind: "berry", homeChunk: "0,0" });
    this.spawnFood("plant", -3, -2, 2, { tier: 0, plantKind: "fig", homeChunk: "-1,-1" });
    this.spawnFood("egg", 14, -6, 14, {
      tier: 0,
      speciesId: "coelophysis",
      hatchAfter: 85,
      homeChunk: "0,-1",
    });
    // A visible specimen teaches rare-plant effects without giving free evolution.
    this.spawnFood("rareplant", -13, 9, 4, {
      tier: 0,
      powerup: "speed",
      homeChunk: "-1,0",
    });
  },
  _worldTier(radius) {
    return biomeAt(radius, 0).tier;
  },
  _streamWorld(force = false) {
    const p = this.player,
      key = chunkKey(p.x, p.y);
    if (!force && this._chunkPosition === key) return;
    this._chunkPosition = key;
    const [cx, cy] = key.split(",").map(Number),
      wanted = new Set();
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const x = cx + dx,
          y = cy + dy;
        if (
          Math.hypot((x + 0.5) * CHUNK_SIZE, (y + 0.5) * CHUNK_SIZE) >
          WORLD_RADIUS + CHUNK_SIZE * 0.7
        )
          continue;
        wanted.add(`${x},${y}`);
      }
    for (const old of this.activeChunks)
      if (!wanted.has(old)) {
        const entities = this.entities.filter(
            (e) => e.homeChunk === old && !e.boss,
          ),
          foods = this.foods.filter((f) => f.homeChunk === old);
        const nests = this.nests.filter((nest) => nest.homeChunk === old);
        this.chunks.set(old, { entities, foods, nests, savedAt: this.time });
        this.nests = this.nests.filter((nest) => nest.homeChunk !== old);
        this.entities = this.entities.filter(
          (e) => e.homeChunk !== old || e.boss,
        );
        this.foods = this.foods.filter((f) => f.homeChunk !== old);
      }
    for (const next of wanted)
      if (!this.activeChunks.has(next)) {
        const saved = this.chunks.get(next);
        if (saved) {
          const elapsed = this.time - saved.savedAt;
          for (const f of saved.foods) f.age += elapsed;
          for (const e of saved.entities) if (e.juvenile) e.age += elapsed;
          this.entities.push(...saved.entities);
          this.foods.push(...saved.foods);
          this.nests.push(...(saved.nests || []));
          this.chunks.delete(next);
        } else this._generateChunk(next);
      }
    this.activeChunks = wanted;
    this.worldFeatures = [...wanted].flatMap((key) => {
      const [x, y] = key.split(",").map(Number);
      return worldFeatures(this.seed, x, y);
    });
    // Streaming may also run at a paused checkpoint boundary. Retire departed
    // pools here without advancing wildlife or applying environmental damage.
    if (this.marineState) {
      const pools = new Set(this.worldFeatures.filter((feature) => feature.type === "water").map((feature) => feature.id));
      for (const id of this.marineState.keys()) if (!pools.has(id)) this.marineState.delete(id);
    }
  },
  _generateChunk(key) {
    const [cx, cy] = key.split(",").map(Number),
      random = seeded(chunkSeed(this.seed, cx, cy));
    const point = () => ({
      x: (cx + random()) * CHUNK_SIZE,
      y: (cy + random()) * CHUNK_SIZE,
    });
    for (let i = 0; i < 5; i++) {
      const p = point();
      if (Math.hypot(p.x, p.y) > WORLD_RADIUS - 8 || Math.hypot(p.x, p.y) < 10)
        continue;
      const region = biomeAt(p.x, p.y),
        tier = clamp(
          region.tier + (random() < 0.12 && region.tier > 0 ? -1 : 0),
          0,
          7,
        );
      const candidates = SPECIES.filter((s) => s.tier === tier && !s.bloodline),
        habitat =
          region.id === "sky"
            ? candidates.filter((s) =>
                ["equine", "gryphon", "bird"].includes(s.body),
              )
            : region.id === "peaks"
              ? candidates.filter((s) =>
                  ["dragon", "serpent", "quad"].includes(s.body),
                )
              : candidates;
      const pool = habitat.length ? habitat : candidates,
        s = pool[Math.floor(random() * pool.length)];
      const spawnHash = (Math.imul((this._nextId || 1), 0x45d9f3b) >>> 0) / 4294967296;
      const isJuvenile = i >= 2 && spawnHash > 0.62 && ["quad", "longneck", "raptor", "bird", "equine", "croc"].includes(s.body);
      const e = this.spawnEntity(s.id, p.x, p.y, {
        homeChunk: key,
        juvenile: isJuvenile,
        passive: isJuvenile ? true : undefined,
      });
      const hash = (Math.imul(e.id, 0x45d9f3b) >>> 0) / 4294967296;
      if (isJuvenile) {
        e.groupRole = "juvenile";
        e.intent = "follow";
      } else if (
        ["fernwood", "redwood", "grove", "fen"].includes(region.id) &&
        (["raptor", "bird"].includes(s.body) || s.behavior === "ambusher") &&
        hash < 0.45
      ) {
        e.inTree = true;
        e.treeY = 4.8 + ((hash * 10) % 1.5);
        e.treeDrop = 0;
        e.intent = "ambush";
      }
      if (s.temperament === "pack" && i < 3) {
        e.packId = `${key}:${i}`;
        e.groupRole = "leader";
        for (let j = 0; j < 2; j++) {
          const flankDino = this.spawnEntity(s.id, p.x + 4 + j * 2, p.y - 3 + j * 3, {
            homeChunk: key,
            packId: e.packId,
            groupRole: "flanker",
          });
          if (flankDino) flankDino.roleSign = j % 2 === 0 ? 1 : -1;
        }
      }
    }
    for (let i = 0; i < 18; i++) {
      const p = point();
      if (Math.hypot(p.x, p.y) > WORLD_RADIUS - 5) continue;
      const tier = biomeAt(p.x, p.y).tier;
      this.spawnFood("plant", p.x, p.y, 2 + tier * 4, { tier, homeChunk: key });
    }
    if (random() < 0.16) {
      const p = point(),
        region = biomeAt(p.x, p.y),
        fruit = region.tier <= 3 ? "sunheart" : "moondrop";
      if (Math.hypot(p.x, p.y) > 35 && Math.hypot(p.x, p.y) < WORLD_RADIUS - 20)
        for (let i = 0; i < 3; i++)
          this.spawnFood(
            "lineage-fruit",
            p.x + i * 1.6,
            p.y,
            6 + region.tier * 6,
            { tier: region.tier, fruit, homeChunk: key },
          );
    }
    const nest = point(),
      tier = biomeAt(nest.x, nest.y).tier,
      pool = SPECIES.filter((s) => s.tier === tier && !s.bloodline);
    if (Math.hypot(nest.x, nest.y) < WORLD_RADIUS - 12) {
      const s = pool[Math.floor(random() * pool.length)],
        // Nests belong to an animal already living here. Reusing a seeded
        // resident avoids adding another adult to every streamed chunk.
        resident = this.entities.filter((e) => e.homeChunk === key && !e.juvenile && !e.boss)
          .sort((a, b) => (dist(a, nest) - (a.speciesId === s.id ? 40 : 0)) -
            (dist(b, nest) - (b.speciesId === s.id ? 40 : 0)))[0];
      if (resident) createNest(this, key, SPECIES_BY_ID[resident.speciesId], resident.x + 4, resident.y + 2, random);
    }
    if (random() < 0.42) {
      const p = point();
      if (Math.hypot(p.x, p.y) < WORLD_RADIUS - 35)
        this.spawnFood("rareplant", p.x, p.y, 5 + tier * 6, {
          tier,
          powerup: POWERUPS[Math.floor(random() * POWERUPS.length)].id,
          homeChunk: key,
        });
    }
    if (random() < 0.032) {
      const p = point();
      if (Math.hypot(p.x, p.y) < WORLD_RADIUS - 35)
        this.spawnFood("relic", p.x, p.y, 12 + tier * 8, {
          tier,
          skillId: RUN_SKILLS[Math.floor(random() * RUN_SKILLS.length)].id,
          homeChunk: key,
        });
    }
    if (random() < 0.0035) {
      const p = point();
      if (Math.hypot(p.x, p.y) < WORLD_RADIUS - 35)
        this.spawnFood("fossil", p.x, p.y, 20 + tier * 10, {
          tier,
          rewardType: random() < 0.65 ? "skin" : "modifier",
          homeChunk: key,
        });
    }
    for (const [type, chance, kind] of [
      ["dna", 0.025, null],
      ["pet-egg", 0.0035, "pet"],
      ["decoration-cache", 0.015, "decoration"],
      ["cosmetic-cache", 0.004, "cosmetic"],
    ]) {
      if (random() >= chance) continue;
      const p = point();
      if (Math.hypot(p.x, p.y) >= WORLD_RADIUS - 35) continue;
      this.spawnFood(type, p.x, p.y, 0, {
        tier,
        homeChunk: key,
        amount: 1 + Math.floor(random() * 4),
        sku: kind ? rollCollectionItem(kind, random).sku : null,
      });
    }
    if (chunkKey(this.secretSite.x, this.secretSite.y) === key)
      this.spawnFood("fossil", this.secretSite.x, this.secretSite.y, 120, {
        tier: 6,
        rewardType: this.secretSite.type,
        homeChunk: key,
      });
  },
  _replenish() {
    this._streamWorld();
    // Replacement spawns obey the location, never the player's evolution tier.
    if (
      this.entities.filter((e) => dist(e, this.player) < 100).length < 6 &&
      this.entities.length < 190
    ) {
      const a = this.random() * Math.PI * 2,
        r = 45 + this.random() * 55;
      const x = this.player.x + Math.cos(a) * r,
        y = this.player.y + Math.sin(a) * r;
      if (Math.hypot(x, y) < WORLD_RADIUS - 12) {
        const region = biomeAt(x, y),
          s = this.pick(
            SPECIES.filter((s) => s.tier === region.tier && !s.bloodline),
          );
        this.spawnEntity(s.id, x, y, { homeChunk: chunkKey(x, y) });
      }
    }
    if (
      this.foods.filter((f) => dist(f, this.player) < 65 && f.type === "plant")
        .length < 10 &&
      this.foods.length < 280
    ) {
      const a = this.random() * Math.PI * 2,
        r = 8 + this.random() * 55,
        x = this.player.x + Math.cos(a) * r,
        y = this.player.y + Math.sin(a) * r,
        tier = biomeAt(x, y).tier;
      if (Math.hypot(x, y) < WORLD_RADIUS - 5)
        if (this.random() < conditionsAt(this, x, y).foodGrowthMultiplier) this.spawnFood("plant", x, y, 2 + tier * 4, {
          tier,
          homeChunk: chunkKey(x, y),
        });
    }
  },
  updateEcosystem(dt, input) {
    const p = this.player;
    this._streamWorld();
    updateWildlife(this, dt);
    updateSenses(this, dt, input);
    for (const shot of this.projectiles) {
      if (shot.hit || shot.life <= 0) { shot.life = 0; continue; }
      const travel = Math.min(dt, Math.max(0, shot.life)),
        start = { x: shot.x, y: shot.y },
        end = { x: shot.x + Math.cos(shot.angle) * shot.speed * travel, y: shot.y + Math.sin(shot.angle) * shot.speed * travel },
        block = firstSolidHit(start, end, this.worldFeatures || [], shot.radius, true);
      let contact = block?.t ?? Infinity, target = null;
      if (shot.owner === "player") {
        for (const entity of this.entities) {
          const t = segmentCircleHit(start, end, entity, shot.radius + SPECIES_BY_ID[entity.speciesId].size * 0.4 * (entity.scaleFactor || 1));
          if (t !== null && t < contact) { contact = t; target = entity; }
        }
      } else {
        const t = segmentCircleHit(start, end, p, shot.radius + this.effectiveSize * 0.35);
        if (t !== null && t < contact) { contact = t; target = p; }
      }
      const fraction = Number.isFinite(contact) ? contact : 1;
      shot.x = start.x + (end.x - start.x) * fraction;
      shot.y = start.y + (end.y - start.y) * fraction;
      if (target && shot.owner === "player") this._hitEntity(target, shot.damage, 0.5);
      else if (target && this.damagePlayer(shot.damage, shot.cause)) {
        if (shot.kind === "venom") p.poisoned = 5;
        if (shot.kind === "flame") p.burning = 4;
        if (shot.kind === "blood") p.bleeding = 4;
        if (shot.kind === "frost" || shot.kind === "web") p.chilled = 3;
      }
      if (Number.isFinite(contact)) shot.hit = true;
      shot.life -= dt;
    }
    this.projectiles = this.projectiles.filter((s) => s.life > 0 && !s.hit);
    let expired = false;
    for (const id of Object.keys(this.buffs)) {
      this.buffs[id] = Math.max(0, this.buffs[id] - dt);
      if (this.buffs[id] === 0) {
        delete this.buffs[id];
        expired = true;
      }
    }
    if (expired) this.refreshStats();
    for (const key of [
      "techniqueCooldown",
      "roarCooldown",
      "guard",
      "empowered",
      "camouflage",
      "chilled",
      "poisoned",
      "bleeding",
      "burning",
      "sleeping",
      "comboTime",
      "venomFang",
    ])
      p[key] = Math.max(0, (p[key] || 0) - dt);
    if (p.comboTime === 0) p.combo = 0;
    for (const skill of this.runSkills)
      skill.cooldown = Math.max(0, skill.cooldown - dt);
    if (this.hasBuff("regen"))
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.025 * dt);
    if (p.poisoned > 0) this.damagePlayer(p.maxHp * 0.008 * dt, "Venom", true);
    if (p.bleeding > 0) {
      const pMoving = Math.hypot(input.dx || 0, input.dy || 0) > 0.15;
      this.damagePlayer(p.maxHp * (pMoving ? 0.016 : 0.007) * dt, "Hemorrhage", true);
    }
    if (p.burning > 0) this.damagePlayer(p.maxHp * 0.012 * dt, "Flame", true);
    if (p.sleeping > 0) {
      input.dx = 0;
      input.dy = 0;
      input.attack = false;
      input.ability = false;
      input.technique = false;
      input.roar = false;
    }
    if (input.technique) this.technique();
    if (input.roar) this.roar();
    if (Number.isInteger(input.skill)) this.useRunSkill(input.skill);
    const region = biomeAt(p.x, p.y);
    this.region = region;
    this.biome = region.name;
    if (!this.discoveredRegions.has(region.id)) {
      this.discoveredRegions.add(region.id);
      this.emit("region", {
        regionId: region.id,
        text: `${region.name} · Region level ${region.tier + 1}`,
      });
    }
    for (const food of [...this.foods]) {
      if (food.type === "egg" && food.age >= food.hatchAfter) {
        if (this.entities.length >= 230) continue;
        this.foods = this.foods.filter((f) => f !== food);
        if (this.entities.length < 230) {
          hatchEgg(this, food);
        }
        this.emit("egg-hatch", {
          x: food.x,
          y: food.y,
          text: "An uneaten egg has hatched.",
        });
      }
      if (this.hasBuff("magnet") && dist(food, p) < 19) {
        const a = Math.atan2(p.y - food.y, p.x - food.x),
          step = Math.min(dist(food, p), dt * 14);
        food.x += Math.cos(a) * step;
        food.y += Math.sin(a) * step;
      }
    }
    if (this.hasBuff("autoeat")) this.eat();
    this._updateLairs();
    updateLifeCycle(this);
  },
  collectSpecial(food) {
    if (food.type === "dna")
      this.emit("dna-find", {
        amount: food.amount || 2,
        receipt: `find:${this.seed}:${food.id}:dna`,
        text: `Rare DNA discovered · +${food.amount || 2} DNA`,
      });
    if (["pet-egg", "decoration-cache", "cosmetic-cache"].includes(food.type))
      this.emit("collection-find", {
        sku: food.sku,
        receipt: `find:${this.seed}:${food.id}:item`,
        text: "A permanent collection discovery!",
      });
    if (food.type === "rareplant") {
      const power = POWERUPS.find((b) => b.id === food.powerup) || POWERUPS[0];
      this.buffs[power.id] = Math.min(
        power.duration * 2,
        (this.buffs[power.id] || 0) + power.duration,
      );
      this.refreshStats();
      this.emit("powerup", {
        x: food.x,
        y: food.y,
        text: `${power.name}: ${power.description}`,
        powerup: power.id,
      });
    }
    if (food.type === "relic") {
      const skill =
        RUN_SKILLS.find((s) => s.id === food.skillId) || RUN_SKILLS[0];
      if (!this.runSkills.some((s) => s.id === skill.id)) {
        this.runSkills.push({ id: skill.id, cooldown: 0 });
        this.emit("run-skill", {
          text: `${skill.name} discovered! Press ${["F", "G", "Z", "V", "B", "N"][this.runSkills.length - 1]} · lasts until death.`,
          skillId: skill.id,
        });
      } else {
        this.buffs.damage = Math.max(this.buffs.damage || 0, 45);
        this.refreshStats();
        this.emit("powerup", {
          text: "Familiar relic: your damage surges for 45 seconds.",
        });
      }
    }
    if (food.type === "fossil") {
      const type = food.rewardType === "modifier" ? "modifier" : "skin",
        pool =
          type === "skin"
            ? SKINS.filter((s) => s.id !== "natural")
            : PERMANENT_MODIFIERS;
      const unseen = pool.filter(
        (item) =>
          !this.knownUnlocks.has(item.id) && !this.foundUnlocks.has(item.id),
      );
      if (unseen.length) {
        const reward =
          unseen.find((item) => item.id === food.rewardId) || this.pick(unseen);
        this.foundUnlocks.add(reward.id);
        if (type === "modifier") {
          this.modifiers.add(reward.id);
          this.refreshStats();
        }
        this.emit("unlock", {
          unlockType: type,
          unlockId: reward.id,
          text: `PERMANENT DISCOVERY · ${reward.name}`,
        });
      } else {
        this.emit("dna-find", {
          amount: 2,
          receipt: `find:${this.seed}:${food.id}:fossil`,
          text: "Ancient duplicate · +2 rare DNA",
        });
      }
    }
  },
  technique() {
    const p = this.player,
      s = this.species,
      tech = TECHNIQUES[this.kit.technique];
    if (
      this.state !== "playing" ||
      !tech ||
      p.techniqueCooldown > 0 ||
      p.stamina < tech.stamina
    )
      return false;
    p.techniqueCooldown = tech.cooldown;
    p.stamina -= tech.stamina;
    p.abilityActive = 0.6;
    const type = tech.type;
    if (type === "guard") p.guard = 4;
    else if (type === "evade" || type === "camouflage") {
      const a = p.angle + (type === "evade" ? Math.PI / 2 : 0);
      sweepMove(p, Math.cos(a) * 5, Math.sin(a) * 5, this.effectiveSize, this.worldFeatures || []);
      p.invulnerable = 1;
      p.empowered = 5;
      if (type === "camouflage") p.camouflage = 3;
    } else if (type === "cleanse") {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.18);
      p.stamina = Math.min(100, p.stamina + 45);
      p.poisoned = 0;
      p.chilled = 0;
      this.buffs.speed = Math.max(this.buffs.speed || 0, 7);
      this.refreshStats();
    } else if (type === "rally") {
      this.buffs.damage = Math.max(this.buffs.damage || 0, 8);
      this.buffs.speed = Math.max(this.buffs.speed || 0, 8);
      this.refreshStats();
      p.stamina = Math.min(100, p.stamina + 30);
    } else if (type === "venomfang") p.venomFang = 6;
    else {
      if (type === "dive") {
        sweepMove(p, Math.cos(p.angle) * 8, Math.sin(p.angle) * 8, this.effectiveSize, this.worldFeatures || []);
        p.invulnerable = 0.8;
      }
      if (type === "wind") {
        this.buffs.speed = Math.max(this.buffs.speed || 0, 7);
        this.refreshStats();
      }
      const radius =
          (type === "quake" ? 9 : type === "feather" ? 10 : 7) + s.size,
        zone = {
          x: p.x,
          y: p.y,
          radius,
          angle: p.angle,
          shape: ["cleave", "feather", "dive"].includes(type)
            ? "cone"
            : "circle",
        };
      for (const e of [...this.entities])
        if (inAttackZone(e, zone) && attackLineClear(p, e, this.worldFeatures || [], type)) {
          if (type === "coil") {
            e.slowed = 5;
            e.stunned = 1;
          } else if (type === "quake") {
            e.stunned = 1.8;
          } else if (type === "cleave") {
            e.bleeding = 6;
            e.bleedTick = 0;
          } else if (type === "feather") {
            e.bleeding = 4;
            e.bleedTick = 0;
          }
          this._hitEntity(
            e,
            p.damage * (type === "cleave" ? 2.2 : 1.4),
            type === "wind" ? 4.8 : type === "quake" ? 2.8 : 1.5,
          );
        }
    }
    this._containPlayer();
    this.emit("ability", {
      ability: type,
      text: tech.name,
      angle: p.angle,
      radius: 7 + s.size,
    });
    return true;
  },
  useRunSkill(index) {
    const slot = this.runSkills[index],
      p = this.player;
    if (this.state !== "playing" || !slot || slot.cooldown > 0) return false;
    const skill = RUN_SKILLS.find((s) => s.id === slot.id);
    slot.cooldown = skill.cooldown;
    if (skill.id === "rebirth") {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.5);
      p.invulnerable = 6;
    } else if (skill.id === "timewarp") {
      for (const e of this.entities)
        if (dist(e, p) < 30) {
          e.slowed = 8;
          e.stunned = 1;
        }
    } else {
      if (skill.id === "blink") {
        p.x += Math.cos(p.angle) * 20;
        p.y += Math.sin(p.angle) * 20;
        this._containPlayer();
        p.invulnerable = 1.5;
      }
      const center =
        skill.id === "meteor"
          ? { x: p.x + Math.cos(p.angle) * 14, y: p.y + Math.sin(p.angle) * 14 }
          : p;
      const radius =
        skill.id === "thunder" ? 28 : skill.id === "meteor" ? 13 : 19;
      for (const e of [...this.entities])
        if (dist(e, center) < radius) {
          e.stunned = skill.id === "meteor" ? 2 : 1;
          const damage = p.damage * (skill.id === "meteor" ? 4 : 2.6);
          this._hitEntity(e, damage, 2);
          if (skill.id === "soulstorm")
            p.hp = Math.min(p.maxHp, p.hp + damage * 0.16);
        }
      this.emit("ability", {
        x: center.x,
        y: center.y,
        ability: skill.id === "meteor" ? "flame" : "nova",
        radius,
        text: skill.name,
        angle: p.angle,
      });
    }
    if (skill.id === "rebirth" || skill.id === "timewarp")
      this.emit("ability", {
        ability: skill.id === "rebirth" ? "heal" : "nova",
        radius: skill.id === "rebirth" ? 8 : 30,
        text: skill.name,
        angle: p.angle,
      });
    this.emit("run-cast", { text: skill.name, skillId: skill.id });
    return true;
  },
  _updateEntity(e, dt) {
    if (this.state !== "playing" || !this.entities.includes(e)) return;
    const p = this.player,
      s = SPECIES_BY_ID[e.speciesId];
    initializeLifeEntity(this, e);
    matureEntity(e, s, dt);
    e.hunger = Math.max(0, (e.hunger ?? 100) - dt * 0.65);
    e.feedCooldown = Math.max(0, (e.feedCooldown || 0) - dt);
    const distance = dist(e, p);
    if (distance > 130 && !e.boss && !e.cast) return;
    const weather = conditionsAt(this, e.x, e.y);
    if (weather.hazardDamagePerSecond > 0) {
      e.hp = Math.max(0, e.hp - weather.hazardDamagePerSecond * dt);
      if (e.hp <= 0) {
        // Environmental deaths replenish the food chain, never player score,
        // guardian accomplishments, rare boss rewards or kill statistics.
        this.entities = this.entities.filter((other) => other !== e);
        if (this.foods.length < 350) this.spawnFood("meat", e.x, e.y, 16 + s.tier * 16, {
          tier: s.tier, homeChunk: e.homeChunk || chunkKey(e.x, e.y),
        });
        const lair = e.lairId && this.lairs.find((record) => record.id === e.lairId);
        if (lair) { lair.entityId = null; lair.respawnAt = this.time + lair.respawn; }
        if (this.boss?.id === e.id) this.boss = null;
        this.emit("wildlife-loss", { x: e.x, y: e.y, speciesId: s.id, cause: weather.hazardCause });
        return;
      }
    }
    for (const key of [
      "attackCooldown",
      "skillCooldown",
      "chargeCooldown",
      "stunned",
      "fear",
      "hitFlash",
      "aggro",
      "attacking",
      "slowed",
    ])
      e[key] = Math.max(0, (e[key] || 0) - dt);

    if (e.isFlying) {
      e.diveTimer = (e.diveTimer || 5) - dt;
      if (e.diveState === "cruising") {
        e.altitude = 7.5 + Math.sin(this.time * 2 + (e.id || 1)) * 0.7;
        if (e.diveTimer <= 0 && distance < 26) {
          e.diveState = "diving";
          e.diveTimer = 1.4;
          this.audio?.playSample?.("birdScream", 0.75);
        }
      } else if (e.diveState === "diving") {
        e.altitude = Math.max(0.4, (e.altitude || 7.5) - dt * 6.5);
        if (e.altitude <= 0.6 || distance < 3.2) {
          e.diveState = "grounded";
          e.diveTimer = 2.4;
          if (distance < 3.2 && e.attackCooldown <= 0) {
            e.telegraph = 0.3;
          }
        }
      } else if (e.diveState === "grounded") {
        e.altitude = 0.4;
        if (e.diveTimer <= 0) {
          e.diveState = "ascending";
        }
      } else if (e.diveState === "ascending") {
        e.altitude = Math.min(7.5, (e.altitude || 0.4) + dt * 5.2);
        if (e.altitude >= 7.5) {
          e.diveState = "cruising";
          e.diveTimer = 5 + (e.id % 5);
        }
      }
    }
    if (e.poison > 0) {
      const elapsed = Math.min(dt, e.poison);
      e.poison = Math.max(0, e.poison - dt);
      e.poisonTick += elapsed;
      if (e.poisonTick >= 0.4 || e.poison === 0) {
        this._hitEntity(e, p.damage * 0.14 * e.poisonTick);
        e.poisonTick = 0;
      }
      if (e.hp <= 0) return;
    }
    if (e.bleeding > 0) {
      const elapsed = Math.min(dt, e.bleeding);
      e.bleeding = Math.max(0, e.bleeding - dt);
      e.bleedTick = (e.bleedTick || 0) + elapsed;
      if (e.bleedTick >= 0.35 || e.bleeding === 0) {
        const moveMult = (e.speed || 0) > 0.4 ? 2.2 : 1.0;
        this._hitEntity(e, p.damage * 0.16 * moveMult * e.bleedTick);
        e.bleedTick = 0;
      }
      if (e.hp <= 0) return;
    }
    if (e.burning > 0) {
      const elapsed = Math.min(dt, e.burning);
      e.burning = Math.max(0, e.burning - dt);
      e.burnTick = (e.burnTick || 0) + elapsed;
      if (e.burnTick >= 0.28 || e.burning === 0) {
        this._hitEntity(e, p.damage * 0.22 * e.burnTick);
        e.burnTick = 0;
      }
      if (e.hp <= 0) return;
    }
    if (e.sleeping > 0) {
      e.sleeping = Math.max(0, e.sleeping - dt);
      e.intent = "sleeping";
      e.telegraph = 0;
      e.cast = null;
      return;
    }
    if (e.stunned > 0) {
      e.intent = "stunned";
      e.telegraph = 0;
      e.cast = null;
      return;
    }
    if (e.cast) {
      e.cast.remaining -= dt * (e.slowed > 0 ? 0.4 : 1);
      e.intent = "casting";
      e.telegraph = 0;
      if (e.cast.remaining <= 0) {
        const zone = e.cast;
        e.cast = null;
        e.attacking = 0.55;
        const ranged = attackProfile(s);
        if (ranged.ranged) {
          this.projectiles.push({
            id: `${e.id}:${this.time}`,
            x: e.x,
            y: e.y,
            angle: zone.angle,
            speed: ranged.projectileSpeed,
            life: ranged.range / ranged.projectileSpeed,
            radius: s.abilityType === "flame" ? 1.8 : 0.9,
            kind: s.abilityType,
            damage:
              (e.damage || s.damage) *
              (ABILITIES[s.abilityType]?.power || 1.6) *
              0.75 *
              this.rules.enemyDamage,
            cause: `${s.name}: ${s.ability}`,
          });
        }
        if (!ranged.ranged && inAttackZone(p, zone) && attackLineClear(e, p, this.worldFeatures || [], s.abilityType)) {
          this.damagePlayer(
            (e.damage || s.damage) *
              (ABILITIES[s.abilityType]?.power || 1.8) *
              0.66 *
              this.rules.enemyDamage *
              (e.boss ? 1.18 : 1),
            `${e.boss ? e.name || "Alpha " : ""}${s.name}: ${s.ability}`,
          );
          if (s.abilityType === "frost" || s.abilityType === "web")
            p.chilled = 3;
          if (s.abilityType === "venom") p.poisoned = 4;
          if (s.abilityType === "flame") p.burning = 4;
          if (s.abilityType === "blood" || s.abilityType === "pounce") p.bleeding = 4;
          if (s.abilityType === "stomp" || s.abilityType === "tailspin") {
            const kbAngle = Math.atan2(p.y - e.y, p.x - e.x);
            sweepMove(p, Math.cos(kbAngle) * 3.5, Math.sin(kbAngle) * 3.5, this.effectiveSize, this.worldFeatures || []);
          }
        }
        if (s.abilityType === "heal")
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.12);
        this.emit("enemy-ability", {
          speciesId: s.id,
          x: zone.x,
          y: zone.y,
          radius: zone.radius,
          angle: zone.angle,
          ability: s.abilityType,
        });
      }
      return;
    }
    const sensory = perceivePlayer(this, e),
      nest = e.nestId ? this.nests.find((n) => n.id === e.nestId) : null,
      defendingNest = nest && nest.parentIds.includes(e.id) && sensory.detected &&
        Math.hypot(sensory.x - nest.x, sensory.y - nest.y) < nest.territoryRadius &&
        Math.hypot(sensory.x, sensory.y) > 55;
    const aggressive =
      e.behavior === "hunter" ||
      e.behavior === "ambusher" ||
      e.behavior === "pack" ||
      defendingNest ||
      e.aggro > 0 ||
      e.boss;
    const pack = e.packId
      ? this.entities.filter((m) => m.packId === e.packId && dist(m, e) < 40)
      : [];
    const afraid =
      !e.boss &&
      e.aggro <= 0 &&
      sensory.detected &&
      (s.tier < this.tier - 1 ||
        e.hp < e.maxHp * 0.22 ||
        (e.juvenile && distance < 16) ||
        (e.behavior === "skittish" && distance < 15) ||
        (e.behavior === "pack" && s.tier < this.tier && pack.length < 3));
    const homeDistance = Math.hypot(e.x - e.homeX, e.y - e.homeY);
    const hunt =
      aggressive &&
      !afraid &&
      (sensory.visible || defendingNest) &&
      (!e.juvenile || e.aggro > 0) &&
      (!e.lairId || homeDistance < 85 || distance < 8);
    if (e.inTree) {
      if (distance < 11 || (sensory.detected && distance < 13)) {
        e.inTree = false;
        e.treeDrop = 1.0;
        e.aggro = 10;
        e.attacking = 0.45;
        this.emit("ambush-leap", { x: e.x, y: e.y, speciesId: s.id });
        sweepMove(e, Math.cos(Math.atan2(p.y - e.y, p.x - e.x)) * 3.2, Math.sin(Math.atan2(p.y - e.y, p.x - e.x)) * 3.2, s.size * (e.scaleFactor || 1), this.worldFeatures || []);
      } else {
        e.intent = "ambush";
        return;
      }
    }
    if (e.packId && e.aggro > 0 && pack.length > 0) {
      for (const m of pack) m.aggro = Math.max(m.aggro, e.aggro);
    }
    let move = 0.2,
      targetAngle = e.angle;
    if (e.fear > 0 || afraid) {
      e.intent = "flee";
      targetAngle = Math.atan2(e.y - (sensory.detected ? sensory.y : p.y), e.x - (sensory.detected ? sensory.x : p.x));
      move = 0.9;
      e.telegraph = 0;
    } else if (hunt) {
      this._threatCount++;
      e.aggro = Math.max(e.aggro, 1);
      const flank = e.packId
        ? (e.groupRole === "leader" ? 0 : e.roleSign * (e.groupRole === "flanker" ? 0.75 : 0.35)) : 0;
      targetAngle =
        Math.atan2(p.y - e.y, p.x - e.x) + flank * (distance > 7 ? 1 : 0);
      const combat = attackProfile({
          ...s,
          size: s.size * (1 + (e.growth || 0) * 0.28),
        }),
        range = combat.reach + this.effectiveSize * 0.4;
      if (s.tier >= 1 && combat.ranged && !e.boss && distance < 14) {
        if (distance < 6.5) {
          targetAngle = Math.atan2(e.y - p.y, e.x - p.x);
          move = 0.95;
        } else if (distance < 12) {
          targetAngle = Math.atan2(p.y - e.y, p.x - e.x) + 1.25 * (e.roleSign || 1);
          move = 0.72;
        }
      }
      const isCharger = s.tier >= 1 && (["charge", "pounce"].includes(s.abilityType) || ["triceratops", "pachycephalosaurus", "carnotaurus"].includes(s.id));
      if (e.charging > 0) {
        e.charging -= dt;
        move = 2.4;
        targetAngle = e.chargeAngle;
        e.intent = "charge";
        if (dist(e, p) < range + 1.2 && hasLineOfSight(e, p, this.worldFeatures || [])) {
          this.damagePlayer(
            (e.damage || s.damage) * 1.55 * this.rules.enemyDamage * (e.boss ? 1.35 : 1),
            `${e.boss ? "Alpha " : ""}${s.name} Trample Charge`,
          );
          p.vx += Math.cos(targetAngle) * 12;
          p.vy += Math.sin(targetAngle) * 12;
          this.emit("hit", { target: "player", x: p.x, y: p.y });
          e.charging = 0;
          e.chargeCooldown = 5.5;
        }
        if (e.charging <= 0) e.chargeCooldown = 5.5;
      } else if (!e.chargeWindup && (e.chargeCooldown || 0) <= 0 && isCharger && distance >= 7.5 && distance <= 15 && hasLineOfSight(e, p, this.worldFeatures || [])) {
        e.chargeWindup = 0.38;
        e.chargeAngle = Math.atan2(p.y - e.y, p.x - e.x);
      } else if (e.chargeWindup > 0) {
        e.chargeWindup -= dt;
        move = 0;
        targetAngle = e.chargeAngle;
        e.intent = "charge";
        if (e.chargeWindup <= 0) {
          e.charging = 0.75;
        }
      }
      if (
        creatureKit(s).ability &&
        e.skillCooldown <= 0 &&
        distance < combat.range &&
        distance > range * 0.65 &&
        attackLineClear(e, p, this.worldFeatures || [], combat.ranged ? null : s.abilityType)
      ) {
        const a = ABILITIES[s.abilityType],
          shape = a.shape,
          castRadius = shape === "cone" ? combat.range : 4.5 + s.size;
        e.cast = {
          x: e.x,
          y: e.y,
          radius: castRadius,
          angle: Math.atan2(p.y - e.y, p.x - e.x),
          shape,
          remaining: e.boss ? 0.32 : 0.2,
          total: e.boss ? 0.32 : 0.2,
          kind: s.abilityType,
        };
        e.skillCooldown =
          (e.boss && e.hp < e.maxHp * 0.5 ? 3.5 : 6) + this.random() * 2;
        e.intent = "casting";
        e.telegraph = 0;
        return;
      }
      if (distance < range + 0.65 && hasLineOfSight(e, p, this.worldFeatures || [])) {
        move = 0;
        e.intent = "attack";
        if (e.attackCooldown <= 0 && e.telegraph <= 0)
          e.telegraph = combat.windup;
      } else {
        e.intent = e.packId ? "flank" : "hunt";
        move = 0.86 + (e.boss ? 0.12 : 0) + Math.min(0.12, this.time / 3600);
      }
      if (e.telegraph > 0) {
        e.telegraph -= dt * (e.slowed > 0 ? 0.4 : 1);
        move = 0;
        if (e.telegraph <= 0) {
          e.attacking = 0.28;
          this.emit("enemy-strike", { x: e.x, y: e.y, angle: e.angle, radius: range, speciesId: s.id });
          e.attackCooldown = combat.cooldown * (e.boss ? 0.8 : 1);
          if (s.tier >= 1) sweepMove(e, Math.cos(targetAngle) * (0.8 + s.size * 0.22), Math.sin(targetAngle) * (0.8 + s.size * 0.22), s.size * (e.scaleFactor || 1), this.worldFeatures || []);
          if (["pounce", "charge"].includes(s.abilityType)) {
            sweepMove(e, Math.cos(targetAngle) * 1.4, Math.sin(targetAngle) * 1.4, s.size * (e.scaleFactor || 1), this.worldFeatures || []);
          }
          if (dist(e, p) < range + 0.35 && hasLineOfSight(e, p, this.worldFeatures || []))
            this.damagePlayer(
              (e.damage || s.damage) *
                (s.tier === 0 ? 1.02 : 1.15 + s.tier * 0.05) *
                this.rules.enemyDamage *
                (e.boss ? 1.25 : 1) *
                (1 + this.ascensions * 0.2),
              `${e.boss ? "Alpha " : ""}${s.name}`,
            );
        }
      }
    } else if (sensory.detected && !sensory.visible && !e.juvenile &&
      (!nest || homeDistance < nest.territoryRadius + 18)) {
      if (aggressive && !afraid) {
        e.intent = "track";
        targetAngle = Math.atan2(sensory.y - e.y, sensory.x - e.x);
        move = e.behavior === "ambusher" ? 0.35 : 0.55;
        e.telegraph = 0;
      } else {
        e.intent = "alert";
        targetAngle = Math.atan2(sensory.y - e.y, sensory.x - e.x);
        move = 0.08;
        e.telegraph = 0;
      }
    } else if (e.territoryRetreat?.until > this.time) {
      e.intent = "yield";
      targetAngle = Math.atan2(e.y - e.territoryRetreat.y, e.x - e.territoryRetreat.x);
      move = 0.7;
      e.telegraph = 0;
    } else if (e.juvenile && e.parentIds.length) {
      const parent = e.parentIds.map((id) => this.entities.find((m) => m.id === id)).find(Boolean);
      if (parent) {
        e.intent = "follow";
        targetAngle = Math.atan2(parent.y - e.y, parent.x - e.x);
        move = dist(e, parent) > 5 + s.size ? 0.7 : 0.12;
        e.telegraph = 0;
      }
    } else if (e.rivalId && this.entities.some((rival) => rival.id === e.rivalId)) {
      const rival = this.entities.find((rival) => rival.id === e.rivalId);
      const rDist = dist(e, rival);
      if (rDist > 32 || rival.hp <= 0) {
        e.rivalId = null;
      } else {
        const rivalSpecies = SPECIES_BY_ID[rival.speciesId];
        const combat = attackProfile({
          ...s,
          size: s.size * (1 + (e.growth || 0) * 0.28),
        });
        const strikeRange = combat.reach + (rivalSpecies.size * (rival.scaleFactor || 1)) * 0.45;
        targetAngle = Math.atan2(rival.y - e.y, rival.x - e.x);
        if (rDist < strikeRange + 0.65 && hasLineOfSight(e, rival, this.worldFeatures || [])) {
          move = 0;
          e.intent = "fight";
          if (e.attackCooldown <= 0 && e.telegraph <= 0) {
            e.telegraph = combat.windup || 0.25;
          }
        } else {
          e.intent = e.behavior === "neutral" ? "defend" : "fight";
          move = e.behavior === "neutral" ? 0.55 : 0.82;
        }
        if (e.telegraph > 0) {
          e.telegraph -= dt * (e.slowed > 0 ? 0.4 : 1);
          move = 0;
          if (e.telegraph <= 0) {
            e.attacking = 0.28;
            this.emit("enemy-strike", { x: e.x, y: e.y, angle: e.angle, radius: strikeRange, speciesId: s.id });
            e.attackCooldown = combat.cooldown || 1.1;
            sweepMove(e, Math.cos(targetAngle) * (0.8 + s.size * 0.2), Math.sin(targetAngle) * (0.8 + s.size * 0.2), s.size * (e.scaleFactor || 1), this.worldFeatures || []);
            if (dist(e, rival) < strikeRange + 0.55 && hasLineOfSight(e, rival, this.worldFeatures || [])) {
              const dmg = (e.damage || s.damage) * (s.tier === 0 ? 0.9 : 1.0 + s.tier * 0.08);
              this._creatureDamage(rival, e, dmg, 1.4);
              if (s.abilityType === "feather" || s.body === "raptor") rival.bleeding = Math.max(rival.bleeding || 0, 3.5);
              else if (s.abilityType === "venom") rival.poison = Math.max(rival.poison || 0, 3.5);
              if (rival.hp <= 0) {
                e.rivalId = null;
                e.hunger = Math.max(0, e.hunger - 35);
              }
            }
          }
        }
      }
    } else if (homeDistance > (nest ? nest.territoryRadius : 50) || (e.boss && homeDistance > 65)) {
      e.intent = "return";
      move = 0.65;
      targetAngle = Math.atan2(e.homeY - e.y, e.homeX - e.x);
      e.telegraph = 0;
      if (e.boss) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.015 * dt);
    } else {
      e.intent =
        e.behavior === "neutral" || e.behavior === "territorial"
          ? "graze"
          : e.behavior === "ambusher"
            ? "ambush"
            : "wander";
      e.telegraph = 0;
      e.wanderTime -= dt;
      if (e.wanderTime <= 0) {
        e.wanderTime = 2 + this.random() * 5;
        targetAngle = e.angle + (this.random() - 0.5) * 2;
        if (!e.rivalId && !e.juvenile && (e.behavior === "hunter" || e.behavior === "pack" || e.behavior === "territorial" || s.diet === "carnivore")) {
          const preyCandidates = this.entities.filter((other) =>
            other.id !== e.id &&
            other.hp > 0 &&
            dist(e, other) < 18 + s.size &&
            !(e.packId && other.packId === e.packId) &&
            !(e.nestId && other.nestId === e.nestId) &&
            !other.boss &&
            hasLineOfSight(e, other, this.worldFeatures || []) &&
            (SPECIES_BY_ID[other.speciesId].diet === "herbivore" ||
             SPECIES_BY_ID[other.speciesId].tier <= s.tier ||
             other.hp < other.maxHp * 0.75)
          );
          if (preyCandidates.length > 0) {
            preyCandidates.sort((a, b) => dist(e, a) - dist(e, b));
            const prey = preyCandidates[0];
            e.rivalId = prey.id;
            const preySpecies = SPECIES_BY_ID[prey.speciesId];
            if (preySpecies.temperament === "skittish" || preySpecies.diet === "herbivore") {
              prey.fear = 3.5;
            } else if (!prey.rivalId && !prey.aggro) {
              prey.rivalId = e.id;
            }
          }
        }
      }
      if (e.behavior === "ambusher") move = 0.06;
    }
    if (!hunt && !afraid && !["track", "follow", "yield", "defend", "fight"].includes(e.intent) && e.fear <= 0 && e.hunger < 90) {
      const herbivore = speciesDiet(s) === "herbivore";
      let meal=null, nearest=400;
      for (const f of this.foods) {
        if (f.nestId && f.nestId === e.nestId) continue;
        if (!(f.type === "plant" || (!herbivore && ["meat", "essence", "egg"].includes(f.type))) || !canEatFood(s,f)) continue;
        const d=(f.x-e.x)**2+(f.y-e.y)**2;
        if (d<nearest) { meal=f; nearest=d; }
      }
      if (meal) {
        targetAngle = Math.atan2(meal.y - e.y, meal.x - e.x);
        move = 0.4;
        e.intent = "forage";
        if (dist(meal, e) < 2 + s.size * 0.35 && e.feedCooldown === 0) {
          this.onFoodConsumed(meal, e);
          this.foods = this.foods.filter((f) => f !== meal);
          feedEntity(this, e, {
            ...meal,
            value: meal.value * foodEfficiency(s.tier, meal.tier || 0) * (meal.type === "plant" ? plantDefinition(meal).nutrition : 1),
          });
          e.feedCooldown = 3;
          e.intent = "feed";
          move = 0;
        }
      }
    }
    // Steer around a nearby solid rather than endlessly biting its far side.
    if (move > 0) {
      const probe = { x: e.x + Math.cos(targetAngle) * 5, y: e.y + Math.sin(targetAngle) * 5 },
        block = firstSolidHit(e, probe, this.worldFeatures || [], Math.min(3, s.size * (e.scaleFactor || 1) * 0.35), true);
      if (block) {
        const outward = Math.atan2(e.y - block.feature.y, e.x - block.feature.x),
          side = Math.sin(targetAngle - outward) >= 0 ? 1 : -1;
        targetAngle = outward + side * Math.PI / 2;
      }
    }
    const turn = angleDiff(targetAngle, e.angle);
    e.angle += turn * Math.min(1, dt * 7);
    const speed =
      s.speed * (e.geneticSpeed || 1) * move * (e.slowed > 0 ? 0.35 : 1) * (e.juvenile ? 0.65 : 1)
        * weather.movementMultiplier;
    sweepMove(e, Math.cos(e.angle) * speed * dt, Math.sin(e.angle) * speed * dt, s.size * (e.scaleFactor || 1), this.worldFeatures || []);
    resolveObstacles(
      e,
      s.size * (1 + (e.growth || 0) * 0.28),
      this.worldFeatures || [],
    );
    const radius = Math.hypot(e.x, e.y);
    if (radius > WORLD_RADIUS - 5) {
      e.x *= (WORLD_RADIUS - 5) / radius;
      e.y *= (WORLD_RADIUS - 5) / radius;
      e.angle += Math.PI;
    }
    const separation =
      (s.size * (1 + (e.growth || 0) * 0.28) + this.effectiveSize) * 0.42;
    if (distance < separation && distance > 0.001) {
      sweepMove(e, ((e.x - p.x) / distance) * (separation - distance) * 0.25,
        ((e.y - p.y) / distance) * (separation - distance) * 0.25, s.size * (e.scaleFactor || 1), this.worldFeatures || []);
    }
    if (this.boss?.id === e.id) this.boss.hp = e.hp;
  },
  _updateLairs() {
    for (const lair of this.lairs) {
      let e = this.entities.find((e) => e.id === lair.entityId);
      if (lair.entityId && !e) {
        lair.entityId = null;
        lair.respawnAt = this.time + lair.respawn;
      }
      if (!lair.entityId && this.time >= lair.respawnAt) {
        e = this.spawnEntity(lair.speciesId, lair.x, lair.y, {
          boss: true,
          lairId: lair.id,
          name: lair.name,
        });
        lair.entityId = e.id;
      }
    }
    const bosses = this.entities
      .filter((e) => e.boss && dist(e, this.player) < 115)
      .sort((a, b) => dist(a, this.player) - dist(b, this.player));
    const nearest = bosses[0];
    if (nearest)
      this.boss = {
        id: nearest.id,
        name: nearest.name || `Alpha ${SPECIES_BY_ID[nearest.speciesId].name}`,
        hp: nearest.hp,
        maxHp: nearest.maxHp,
        speciesId: nearest.speciesId,
      };
    else if (
      this.boss &&
      !this.entities.find((e) => e.id === this.boss.id && e.roaming)
    )
      this.boss = null;
  },
  _spawnBoss() {
    this._nextBoss = this.time + 190;
    if (this.boss) return;
    const s = this.pick(
        SPECIES.filter((s) => s.tier === Math.min(7, this.tier + 1)),
      ),
      a = this.random() * Math.PI * 2;
    let x = this.player.x + Math.cos(a) * 34,
      y = this.player.y + Math.sin(a) * 34;
    const r = Math.hypot(x, y);
    if (r > WORLD_RADIUS - 20) {
      x *= (WORLD_RADIUS - 20) / r;
      y *= (WORLD_RADIUS - 20) / r;
    }
    const e = this.spawnEntity(s.id, x, y, {
      boss: true,
      passive: false,
      roaming: true,
    });
    this.boss = {
      id: e.id,
      name: `Alpha ${s.name}`,
      hp: e.hp,
      maxHp: e.maxHp,
      speciesId: s.id,
    };
    this.emit("boss", { x, y, text: `An alpha ${s.name} is hunting you.` });
  },
};
