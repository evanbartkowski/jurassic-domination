import { SPECIES, SPECIES_BY_ID } from "./data.js";
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
    guard: 0,
    empowered: 0,
    camouflage: 0,
    chilled: 0,
    poisoned: 0,
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
  hasBuff(id) {
    return (this.buffs[id] || 0) > 0;
  },
  populateWorld() {
    this._streamWorld(true);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2,
        r = 12 + this.random() * 17;
      this.spawnEntity(
        this.pick(SPECIES.filter((s) => s.tier === 0)).id,
        Math.cos(a) * r,
        Math.sin(a) * r,
        {
          passive: i < 5,
          behavior: i < 5 ? "neutral" : "hunter",
          homeChunk: "0,0",
        },
      );
    }
    this.spawnFood("plant", 3, 1, 2, { tier: 0, homeChunk: "0,0" });
    this.spawnFood("plant", -3, -2, 2, { tier: 0, homeChunk: "-1,-1" });
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
        this.chunks.set(old, { entities, foods, savedAt: this.time });
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
          this.chunks.delete(next);
        } else this._generateChunk(next);
      }
    this.activeChunks = wanted;
  },
  _generateChunk(key) {
    const [cx, cy] = key.split(",").map(Number),
      random = seeded(chunkSeed(this.seed, cx, cy));
    const point = () => ({
      x: (cx + random()) * CHUNK_SIZE,
      y: (cy + random()) * CHUNK_SIZE,
    });
    for (let i = 0; i < 9; i++) {
      const p = point();
      if (Math.hypot(p.x, p.y) > WORLD_RADIUS - 8 || Math.hypot(p.x, p.y) < 10)
        continue;
      const region = biomeAt(p.x, p.y),
        tier = clamp(
          region.tier + (random() < 0.12 && region.tier > 0 ? -1 : 0),
          0,
          7,
        );
      const candidates = SPECIES.filter((s) => s.tier === tier),
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
      const e = this.spawnEntity(s.id, p.x, p.y, { homeChunk: key });
      if (s.temperament === "pack" && i < 5) {
        e.packId = `${key}:${i}`;
        for (let j = 0; j < 2; j++)
          this.spawnEntity(s.id, p.x + 4 + j * 2, p.y - 3 + j * 3, {
            homeChunk: key,
            packId: e.packId,
          });
      }
    }
    for (let i = 0; i < 18; i++) {
      const p = point();
      if (Math.hypot(p.x, p.y) > WORLD_RADIUS - 5) continue;
      const tier = biomeAt(p.x, p.y).tier;
      this.spawnFood("plant", p.x, p.y, 2 + tier * 4, { tier, homeChunk: key });
    }
    const nest = point(),
      tier = biomeAt(nest.x, nest.y).tier,
      pool = SPECIES.filter((s) => s.tier === tier);
    if (Math.hypot(nest.x, nest.y) < WORLD_RADIUS - 12) {
      const s = pool[Math.floor(random() * pool.length)];
      for (let i = 0; i < 2; i++)
        this.spawnFood("egg", nest.x + i * 1.5, nest.y, 14 + tier * 12, {
          tier,
          speciesId: s.id,
          hatchAfter: 55 + random() * 65,
          homeChunk: key,
        });
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
      this.entities.filter((e) => dist(e, this.player) < 100).length < 12 &&
      this.entities.length < 190
    ) {
      const a = this.random() * Math.PI * 2,
        r = 30 + this.random() * 45;
      const x = this.player.x + Math.cos(a) * r,
        y = this.player.y + Math.sin(a) * r;
      if (Math.hypot(x, y) < WORLD_RADIUS - 12) {
        const region = biomeAt(x, y),
          s = this.pick(SPECIES.filter((s) => s.tier === region.tier));
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
        this.spawnFood("plant", x, y, 2 + tier * 4, {
          tier,
          homeChunk: chunkKey(x, y),
        });
    }
  },
  updateEcosystem(dt, input) {
    const p = this.player;
    this._streamWorld();
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
      "guard",
      "empowered",
      "camouflage",
      "chilled",
      "poisoned",
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
    if (input.technique) this.technique();
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
          const e = this.spawnEntity(food.speciesId, food.x, food.y, {
            juvenile: true,
            homeChunk: food.homeChunk,
            passive: true,
          });
          e.age = Math.max(0, food.age - food.hatchAfter);
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
          text: `${skill.name} discovered! Press ${["F", "G", "C", "V", "B", "N"][this.runSkills.length - 1]} · lasts until death.`,
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
      tech = TECHNIQUES[s.technique];
    if (
      this.state !== "playing" ||
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
      p.x += Math.cos(a) * 5;
      p.y += Math.sin(a) * 5;
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
        p.x += Math.cos(p.angle) * 8;
        p.y += Math.sin(p.angle) * 8;
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
        if (inAttackZone(e, zone)) {
          if (type === "coil") {
            e.slowed = 5;
            e.stunned = 1;
          } else if (type === "quake") e.stunned = 1.8;
          this._hitEntity(
            e,
            p.damage * (type === "cleave" ? 2.2 : 1.4),
            type === "wind" ? 4 : 1.5,
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
    if (e.juvenile) {
      e.age += dt;
      const progress = Math.min(1, e.age / 100);
      e.scaleFactor = 0.42 + 0.58 * progress;
      const hp = e.adultMaxHp * (0.45 + 0.55 * progress);
      e.hp = Math.min(hp, e.hp + Math.max(0, hp - e.maxHp));
      e.maxHp = hp;
      if (e.age >= 100) {
        e.juvenile = false;
        e.scaleFactor = 1;
        e.behavior = s.temperament;
      }
    }
    const distance = dist(e, p);
    if (distance > 130 && !e.boss && !e.cast) return;
    for (const key of [
      "attackCooldown",
      "skillCooldown",
      "stunned",
      "fear",
      "hitFlash",
      "aggro",
      "attacking",
      "slowed",
    ])
      e[key] = Math.max(0, (e[key] || 0) - dt);
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
        if (inAttackZone(p, zone)) {
          this.damagePlayer(
            s.damage *
              (ABILITIES[s.abilityType]?.power || 1.8) *
              0.66 *
              this.rules.enemyDamage *
              (e.boss ? 1.18 : 1),
            `${e.boss ? e.name || "Alpha " : ""}${s.name}: ${s.ability}`,
          );
          if (s.abilityType === "frost" || s.abilityType === "web")
            p.chilled = 3;
          if (s.abilityType === "venom") p.poisoned = 4;
        }
        if (s.abilityType === "heal")
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.12);
        this.emit("enemy-ability", {
          x: zone.x,
          y: zone.y,
          radius: zone.radius,
          angle: zone.angle,
          ability: s.abilityType,
        });
      }
      return;
    }
    const aggressive =
      e.behavior === "hunter" ||
      e.behavior === "ambusher" ||
      e.behavior === "pack" ||
      e.aggro > 0 ||
      e.boss;
    const pack = e.packId
      ? this.entities.filter((m) => m.packId === e.packId && dist(m, e) < 40)
      : [];
    const afraid =
      !e.boss &&
      e.aggro <= 0 &&
      (s.tier < this.tier - 1 ||
        e.hp < e.maxHp * 0.22 ||
        (e.behavior === "skittish" && distance < 15) ||
        (e.behavior === "pack" && s.tier < this.tier && pack.length < 3));
    const homeDistance = Math.hypot(e.x - e.homeX, e.y - e.homeY),
      detect = e.boss ? 110 : e.behavior === "ambusher" ? 12 : 22 + s.size * 2;
    const hunt =
      aggressive &&
      !afraid &&
      distance < detect &&
      p.camouflage <= 0 &&
      (!e.juvenile || e.aggro > 0) &&
      (!e.lairId || homeDistance < 85 || distance < 8);
    let move = 0.2,
      targetAngle = e.angle;
    if (e.fear > 0 || afraid) {
      e.intent = "flee";
      targetAngle = Math.atan2(e.y - p.y, e.x - p.x);
      move = 0.9;
      e.telegraph = 0;
    } else if (hunt) {
      this._threatCount++;
      e.aggro = Math.max(e.aggro, 1);
      const flank = e.packId ? ((e.id % 3) - 1) * 0.6 : 0;
      targetAngle =
        Math.atan2(p.y - e.y, p.x - e.x) + flank * (distance > 7 ? 1 : 0);
      const range = 1.8 + (s.size + this.species.size) * 0.55;
      if (
        s.tier >= 1 &&
        e.skillCooldown <= 0 &&
        distance < 25 &&
        distance > range * 0.65
      ) {
        const a = ABILITIES[s.abilityType],
          shape = a.shape,
          castRadius = shape === "cone" ? a.radius + s.size : 4.5 + s.size;
        e.cast = {
          x: shape === "cone" ? e.x : p.x,
          y: shape === "cone" ? e.y : p.y,
          radius: castRadius,
          angle: Math.atan2(p.y - e.y, p.x - e.x),
          shape,
          remaining: e.boss ? 1.2 : 0.95,
          total: e.boss ? 1.2 : 0.95,
          kind: s.abilityType,
        };
        e.skillCooldown =
          (e.boss && e.hp < e.maxHp * 0.5 ? 7 : 12) + this.random() * 3;
        e.intent = "casting";
        e.telegraph = 0;
        return;
      }
      if (distance < range + 0.65) {
        move = 0;
        e.intent = "attack";
        if (e.attackCooldown <= 0 && e.telegraph <= 0) e.telegraph = 0.65;
      } else {
        e.intent = e.packId ? "flank" : "hunt";
        move = 0.86 + (e.boss ? 0.12 : 0) + Math.min(0.12, this.time / 3600);
      }
      if (e.telegraph > 0) {
        e.telegraph -= dt * (e.slowed > 0 ? 0.4 : 1);
        move = 0;
        if (e.telegraph <= 0) {
          e.attacking = 0.28;
          e.attackCooldown = e.boss ? 1.25 : 1.7;
          if (dist(e, p) < range + 1.0)
            this.damagePlayer(
              s.damage *
                0.77 *
                this.rules.enemyDamage *
                (e.boss ? 1.2 : 1) *
                (1 + this.ascensions * 0.2),
              `${e.boss ? "Alpha " : ""}${s.name}`,
            );
        }
      }
    } else if (homeDistance > 50 || (e.boss && homeDistance > 65)) {
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
      }
      if (e.behavior === "ambusher") move = 0.06;
    }
    const turn = angleDiff(targetAngle, e.angle);
    e.angle += turn * Math.min(1, dt * 7);
    const speed =
      s.speed * move * (e.slowed > 0 ? 0.35 : 1) * (e.juvenile ? 0.65 : 1);
    e.x += Math.cos(e.angle) * speed * dt;
    e.y += Math.sin(e.angle) * speed * dt;
    const radius = Math.hypot(e.x, e.y);
    if (radius > WORLD_RADIUS - 5) {
      e.x *= (WORLD_RADIUS - 5) / radius;
      e.y *= (WORLD_RADIUS - 5) / radius;
      e.angle += Math.PI;
    }
    const separation = (s.size + this.species.size) * 0.42;
    if (distance < separation && distance > 0.001) {
      e.x += ((e.x - p.x) / distance) * (separation - distance) * 0.25;
      e.y += ((e.y - p.y) / distance) * (separation - distance) * 0.25;
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
