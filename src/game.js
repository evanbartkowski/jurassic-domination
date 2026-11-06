import { SPECIES, SPECIES_BY_ID, MUTATIONS, DIFFICULTIES } from './data.js';

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const thresholds = [60, 125, 210, 320, 470, 640, 850, 1150];
export const WORLD_RADIUS = 160;

/** Seeded, renderer-independent simulation. update accepts seconds and caps stalls. */
export class Game {
  constructor({ seed = Date.now(), difficulty = 'survival', upgrades = {} } = {}) {
    this.seed = Number(seed) >>> 0;
    this._randomState = this.seed;
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : 'survival';
    this.rules = DIFFICULTIES[this.difficulty];
    this.upgrades = {
      vitality: clamp(Number(upgrades.vitality) || 0, 0, 5),
      instinct: clamp(Number(upgrades.instinct) || 0, 0, 5),
      metabolism: clamp(Number(upgrades.metabolism) || 0, 0, 5),
    };
    this.state = 'egg';
    this.worldRadius = WORLD_RADIUS;
    this.time = 0;
    this.eggTime = 0;
    this.tier = 0;
    this.ascensions = 0;
    this.danger = 0;
    this.biome = 'Fernwood Basin';
    this.entities = [];
    this.foods = [];
    this.events = [];
    this.mutations = [];
    this.evolutionChoices = [];
    this.mutationChoices = [];
    this.boss = null;
    this.cause = '';
    this._nextId = 1;
    this._respawnTimer = 0;
    this._nextBoss = 125;
    this._warningCooldown = 0;
    this._eatCooldown = 0;
    this._threatCount = 0;
    this._starter = this.pick(SPECIES.filter(s => s.tier === 0));
    this.player = {
      x: 0, y: 0, angle: 0, speciesId: this._starter.id,
      hp: 1, maxHp: 1, stamina: 100, hunger: 100, xp: 0,
      kills: 0, score: 0, abilityCooldown: 0, dashCooldown: 0,
      attackCooldown: 0, invulnerable: 0, attacking: 0, abilityActive: 0,
    };
    this.refreshStats(true);
    this._populate();
  }

  random() {
    this._randomState = (this._randomState + 0x6D2B79F5) >>> 0;
    let n = this._randomState;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  }

  pick(array) { return array[Math.floor(this.random() * array.length)]; }
  get species() { return SPECIES_BY_ID[this.player.speciesId]; }
  get nextThreshold() { return Math.round(thresholds[this.tier] * (1 + this.ascensions * .38)); }
  get mutationCounts() {
    const counts = {};
    for (const id of this.mutations) counts[id] = (counts[id] || 0) + 1;
    return counts;
  }

  refreshStats(heal = false) {
    const p = this.player, s = this.species, m = this.mutationCounts;
    const ratio = p.hp / Math.max(1, p.maxHp);
    p.maxHp = Math.round(s.hp * (1 + this.upgrades.vitality * .05 + (m.vitality || 0) * .18) * (1 + this.ascensions * .15));
    p.hp = heal ? p.maxHp : Math.min(p.maxHp, p.maxHp * ratio);
    p.damage = s.damage * (1 + this.upgrades.instinct * .04 + (m.razor || 0) * .18) * (1 + this.ascensions * .14);
    p.speed = s.speed * (1 + (m.swift || 0) * .1);
    p.armor = Math.min(.45, (m.ironhide || 0) * .12);
  }

  _populate() {
    for (let i = 0; i < 56; i++) {
      const a = this.random() * TAU;
      const radius = i < 15 ? 9 + this.random() * 24 : 30 + this.random() * 116;
      const tier = this._worldTier(radius);
      const s = this.pick(SPECIES.filter(s => s.tier === tier));
      this.spawnEntity(s.id, Math.cos(a) * radius, Math.sin(a) * radius, { passive: i < 7 });
    }
    for (let i = 0; i < 135; i++) {
      const a = this.random() * TAU;
      const radius = i < 20 ? 3 + this.random() * 26 : this.random() * 148;
      this.spawnFood('plant', Math.cos(a) * radius, Math.sin(a) * radius, 1);
    }
    // A readable first meal near the nest, independent of random terrain.
    this.spawnFood('plant', 3, 1, 2);
    this.spawnFood('plant', -3, -2, 2);
  }

  _worldTier(radius) {
    if (radius < 37) return 0;
    if (radius < 66) return this.random() < .65 ? 1 : 2;
    if (radius < 100) return this.random() < .55 ? 2 : 3;
    if (radius < 128) return this.random() < .55 ? 4 : 5;
    return this.random() < .65 ? 5 : 6;
  }

  spawnEntity(speciesId, x, y, options = {}) {
    const s = SPECIES_BY_ID[speciesId];
    if (!s) return null;
    const maxHp = s.hp * .78 * this.rules.enemyHealth * (options.boss ? 2.8 : 1) * (1 + this.ascensions * .22);
    const entity = {
      id: this._nextId++, x, y, angle: this.random() * TAU, speciesId,
      hp: maxHp, maxHp, attackCooldown: 1 + this.random(), telegraph: 0,
      intent: 'wander', passive: options.passive ?? ['quad', 'longneck'].includes(s.body),
      boss: !!options.boss, stunned: 0, fear: 0, poison: 0, poisonTick: 0, hitFlash: 0,
      wanderTime: this.random() * 4, aggro: 0, attacking: 0,
    };
    this.entities.push(entity);
    return entity;
  }

  spawnFood(type, x, y, value = 12) {
    const food = { id: this._nextId++, type, x, y, value, age: 0 };
    this.foods.push(food);
    return food;
  }

  hatch() {
    if (this.state !== 'egg') return false;
    this.state = 'playing';
    this.player.invulnerable = 2.5;
    this.emit('hatch', { text: `A ${this.species.name} is born. Eat. Adapt. Survive.` });
    return true;
  }

  emit(type, data = {}) {
    this.events.push({ type, x: this.player.x, y: this.player.y, ...data });
    if (this.events.length > 160) this.events.shift();
  }

  consumeEvents() { return this.events.splice(0); }

  update(delta, input = {}) {
    const dt = clamp(Number(delta) || 0, 0, .1);
    if (this.state === 'egg') {
      this.eggTime += dt;
      if (this.eggTime >= 3 || input.attack || input.eat) this.hatch();
      return;
    }
    if (this.state !== 'playing' || dt === 0) return;
    if (this.player.xp >= this.nextThreshold) { this._offerEvolution(); return; }
    this.time += dt;
    const p = this.player, s = this.species, m = this.mutationCounts;
    for (const key of ['abilityCooldown', 'dashCooldown', 'attackCooldown', 'invulnerable', 'attacking', 'abilityActive']) p[key] = Math.max(0, p[key] - dt);
    this._eatCooldown = Math.max(0, this._eatCooldown - dt);
    this._warningCooldown = Math.max(0, this._warningCooldown - dt);
    let mx = Number(input.x) || 0, my = Number(input.y) || 0;
    const length = Math.hypot(mx, my);
    if (length > 1) { mx /= length; my /= length; }
    if (Number.isFinite(input.aim)) p.angle = input.aim;
    else if (length > .05) p.angle = Math.atan2(my, mx);
    const sprint = !!input.sprint && p.stamina > 2 && length > .05;
    const speed = p.speed * (sprint ? 1.35 : 1);
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.stamina = clamp(p.stamina + (sprint ? -20 : 24 + (m.swift || 0) * 5) * dt, 0, 100);
    if (input.dash) this.dash(mx, my);
    this._containPlayer();
    if (input.attack) this.attack();
    if (input.ability) this.ability();
    if (input.eat) this.eat();

    const radius = Math.hypot(p.x, p.y);
    this.biome = radius < 44 ? 'Fernwood Basin' : radius < 86 ? 'Amber Savannah' : radius < 124 ? 'Ashen Highlands' : 'The Forbidden Reach';
    const hungerDrain = .49 * this.rules.hunger * Math.max(.35, 1 - this.upgrades.metabolism * .06) * Math.pow(.75, m.metabolism || 0);
    p.hunger = Math.max(0, p.hunger - hungerDrain * dt * (sprint ? 1.45 : 1));
    if (p.hunger > 60 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .009 * dt);
    if (p.hunger <= 0) this.damagePlayer(p.maxHp * .035 * dt, 'Starvation', true);
    // The far outer ring is volcanic: an explicit warning precedes continuous damage.
    if (radius > 151) {
      if (this._warningCooldown === 0) {
        this.emit('warning', { text: 'Volcanic boundary! Return toward the basin.' });
        this._warningCooldown = 5;
      }
      this.damagePlayer(p.maxHp * .055 * dt, 'Volcanic exposure', true);
    }
    if (this.state === 'dead') return;

    this._threatCount = 0;
    for (const e of [...this.entities]) this._updateEntity(e, dt);
    this.danger = clamp(this._threatCount / 4 + Math.max(0, radius - 40) / 190 + this.time / 1800 + this.ascensions * .1, 0, 1);
    for (const f of this.foods) f.age += dt;
    this.foods = this.foods.filter(f => f.type === 'plant' || f.age < 125);
    this._respawnTimer += dt;
    if (this._respawnTimer > 3) { this._respawnTimer = 0; this._replenish(); }
    if (this.time >= this._nextBoss) this._spawnBoss();
    if (this.boss && !this.entities.some(e => e.id === this.boss.id)) this.boss = null;
    p.score += dt * (1 + this.tier * .15) * this.rules.score;
  }

  _containPlayer() {
    const p = this.player, radius = Math.hypot(p.x, p.y);
    if (radius > this.worldRadius - 1) {
      p.x *= (this.worldRadius - 1) / radius;
      p.y *= (this.worldRadius - 1) / radius;
    }
  }

  attack() {
    const p = this.player;
    if (this.state !== 'playing' || p.attackCooldown > 0) return false;
    p.attackCooldown = .48;
    p.attacking = .2;
    const reach = 2.8 + this.species.size * 1.1;
    this.emit('attack', { angle: p.angle, radius: reach });
    for (const e of [...this.entities]) {
      const target = SPECIES_BY_ID[e.speciesId];
      if (distance(p, e) < reach + target.size * .45 && Math.abs(angleDifference(Math.atan2(e.y - p.y, e.x - p.x), p.angle)) < 1.25) {
        this._hitEntity(e, p.damage, .65);
      }
    }
    return true;
  }

  dash(mx = 0, my = 0) {
    const p = this.player, m = this.mutationCounts;
    const cost = Math.max(10, 28 - (m.adrenaline || 0) * 5);
    if (this.state !== 'playing' || p.dashCooldown > 0 || p.stamina < cost) return false;
    const angle = Math.hypot(mx, my) > .05 ? Math.atan2(my, mx) : p.angle;
    const amount = 5.8 + this.species.size * .45;
    p.x += Math.cos(angle) * amount;
    p.y += Math.sin(angle) * amount;
    p.stamina -= cost;
    p.dashCooldown = 1.6;
    p.invulnerable = Math.max(p.invulnerable, .32);
    this._containPlayer();
    this.emit('dash', { angle });
    return true;
  }

  ability() {
    const p = this.player, s = this.species, m = this.mutationCounts;
    if (this.state !== 'playing' || p.abilityCooldown > 0 || p.stamina < 24) return false;
    const type = s.abilityType;
    p.abilityCooldown = Math.max(3, 8 * Math.pow(.82, m.adrenaline || 0));
    p.stamina -= 24;
    p.abilityActive = .8;
    if (type === 'pounce' || type === 'charge') {
      p.x += Math.cos(p.angle) * (4 + s.size);
      p.y += Math.sin(p.angle) * (4 + s.size);
      this._containPlayer();
      p.invulnerable = Math.max(p.invulnerable, .6);
    }
    const radius = type === 'flame' ? 10 + s.size : type === 'stomp' ? 5.8 + s.size : type === 'roar' ? 9 + s.size : 5 + s.size;
    this.emit('ability', { ability: type, angle: p.angle, radius, text: s.ability });
    for (const e of [...this.entities]) {
      const dist = distance(p, e);
      const angle = Math.abs(angleDifference(Math.atan2(e.y - p.y, e.x - p.x), p.angle));
      if (dist > radius + SPECIES_BY_ID[e.speciesId].size * .4 || (type === 'flame' && angle > .9)) continue;
      if (type === 'venom') { e.poison = 5; e.poisonTick = 0; }
      if (type === 'roar') e.fear = 3;
      e.stunned = type === 'stomp' ? 1.4 : .6;
      this._hitEntity(e, p.damage * (type === 'venom' ? 1.15 : type === 'flame' ? 2.3 : 1.85), 1.4);
    }
    return true;
  }

  eat() {
    if (this.state !== 'playing' || this._eatCooldown > 0) return false;
    const p = this.player, radius = 3.4 + this.species.size * .6;
    const available = this.foods.filter(f => distance(p, f) <= radius).sort((a, b) => distance(p, a) - distance(p, b));
    const food = available[0];
    if (!food) return false;
    this.foods = this.foods.filter(f => f.id !== food.id);
    this._eatCooldown = .17;
    const m = this.mutationCounts;
    p.hunger = Math.min(100, p.hunger + (food.type === 'meat' ? 25 : food.type === 'essence' ? 40 : 12) * (1 + (m.metabolism || 0) * .15));
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * (food.type === 'plant' ? .025 : .075));
    this.gainXP(food.value);
    this.emit('eat', { x: food.x, y: food.y, amount: food.value, food: food.type });
    return true;
  }

  gainXP(amount) {
    if (this.state !== 'playing' || !Number.isFinite(amount) || amount <= 0) return;
    const bonus = 1 + (this.mutationCounts.catalyst || 0) * .2;
    this.player.xp += amount * bonus;
    this.player.score += amount * 5 * this.rules.score;
    if (this.player.xp >= this.nextThreshold) this._offerEvolution();
  }

  _offerEvolution() {
    this.state = 'evolution';
    const candidates = SPECIES.filter(s => s.tier === Math.min(7, this.tier + 1));
    this.evolutionChoices = this._sample(candidates, 3).map(s => s.id);
    this.mutationChoices = this._sample(MUTATIONS, 3).map(m => m.id);
    this.emit('evolution-ready', { text: this.tier === 7 ? 'Ascension awaits. Become something greater.' : 'Evolution unlocked. Choose your next form.' });
  }

  _sample(array, count) {
    const pool = [...array], result = [];
    while (result.length < count && pool.length) result.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
    return result;
  }

  evolve(speciesId, mutationId) {
    if (this.state !== 'evolution' || !this.evolutionChoices.includes(speciesId) || !this.mutationChoices.includes(mutationId)) return false;
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
    this.state = 'playing';
    this.emit('evolve', { text: `${this.species.name}${this.ascensions ? ` · Ascension ${this.ascensions}` : ''}`, radius: 8 + this.species.size });
    // Large meals may cross another threshold; offer it on the next update cycle.
    return true;
  }

  damagePlayer(amount, cause = 'A predator', bypass = false) {
    if (this.state !== 'playing' || amount <= 0 || !Number.isFinite(amount)) return false;
    const p = this.player;
    if (p.invulnerable > 0 && !bypass) return false;
    const damage = amount * (1 - p.armor);
    p.hp = Math.max(0, p.hp - damage);
    if (!bypass) {
      p.invulnerable = .38;
      this.emit('hit', { amount: damage, target: 'player', cause });
    }
    if (p.hp <= 0) {
      this.state = 'dead';
      this.cause = cause;
      this.emit('death', { text: cause });
    }
    return true;
  }

  _hitEntity(e, amount, knockback = 0) {
    if (!this.entities.includes(e) || e.hp <= 0) return;
    e.hp -= amount;
    e.hitFlash = .18;
    e.aggro = 10;
    if (knockback) {
      const angle = Math.atan2(e.y - this.player.y, e.x - this.player.x);
      e.x += Math.cos(angle) * knockback;
      e.y += Math.sin(angle) * knockback;
    }
    this.emit('hit', { x: e.x, y: e.y, amount, target: e.id });
    if (e.hp > 0) return;
    const s = SPECIES_BY_ID[e.speciesId];
    this.entities = this.entities.filter(other => other !== e);
    this.player.kills++;
    this.player.score += (30 + s.tier * 35) * (e.boss ? 5 : 1) * this.rules.score;
    const count = e.boss ? 5 : 1;
    for (let i = 0; i < count; i++) this.spawnFood(e.boss ? 'essence' : 'meat', e.x + (this.random() - .5) * 2, e.y + (this.random() - .5) * 2, (14 + s.tier * 10) * (e.boss ? 1.7 : 1));
    if (this.mutationCounts.predator) this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * .05 * this.mutationCounts.predator);
    if (e.boss) this.boss = null;
    this.emit('kill', { x: e.x, y: e.y, text: e.boss ? `${s.name} alpha defeated` : s.name, boss: e.boss });
  }

  _updateEntity(e, dt) {
    if (this.state !== 'playing' || !this.entities.includes(e)) return;
    const p = this.player, s = SPECIES_BY_ID[e.speciesId];
    for (const key of ['attackCooldown', 'stunned', 'fear', 'hitFlash', 'aggro', 'attacking']) e[key] = Math.max(0, e[key] - dt);
    if (e.poison > 0) {
      const elapsed = Math.min(dt, e.poison);
      e.poison = Math.max(0, e.poison - dt);
      e.poisonTick += elapsed;
      // Discrete venom ticks keep hit feedback legible and avoid creating a
      // floating damage label for every simulation frame and poisoned creature.
      if (e.poisonTick >= .4 || e.poison === 0) {
        this._hitEntity(e, p.damage * .14 * e.poisonTick);
        e.poisonTick = 0;
      }
      if (e.hp <= 0) return;
    }
    if (e.stunned > 0) { e.intent = 'stunned'; e.telegraph = 0; return; }
    const dist = distance(e, p);
    // Distant creatures wander cheaply, while encounters remain active near the player.
    const aggroRange = (e.boss ? 48 : 16 + s.size * 2) + Math.min(12, this.time / 100);
    const aggressive = !e.passive || e.aggro > 0 || e.boss;
    const canHunt = aggressive && dist < aggroRange;
    const threatened = dist < 14 && (s.tier < this.tier - 1 || (e.hp < e.maxHp * .23 && !e.boss));
    let movement = .25;
    if (e.fear > 0 || threatened || (e.passive && e.aggro <= 0 && dist < 8)) {
      e.intent = 'flee';
      e.angle = Math.atan2(e.y - p.y, e.x - p.x);
      movement = .72;
      e.telegraph = 0;
    } else if (canHunt) {
      this._threatCount++;
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      const range = 1.8 + (s.size + this.species.size) * .55;
      if (dist < range + .65) {
        movement = 0;
        e.intent = 'attack';
        if (e.attackCooldown <= 0 && e.telegraph <= 0) e.telegraph = .58;
      } else { e.intent = 'hunt'; movement = .79 + (e.boss ? .06 : 0) + Math.min(.17, this.time / 2800); }
      if (e.telegraph > 0) {
        e.telegraph -= dt;
        movement = .1;
        if (e.telegraph <= 0) {
          e.attacking = .25;
          e.attackCooldown = e.boss ? 1.5 : 1.7;
          if (dist < range + 1.5) {
            this.damagePlayer(s.damage * .72 * this.rules.enemyDamage * (e.boss ? 1.2 : 1) * (1 + this.time / 1200 + this.ascensions * .25), `${e.boss ? 'Alpha ' : ''}${s.name}`);
          }
        }
      }
    } else {
      e.intent = 'wander';
      e.telegraph = 0;
      e.wanderTime -= dt;
      if (e.wanderTime <= 0) { e.wanderTime = 2 + this.random() * 5; e.angle += (this.random() - .5) * 2.5; }
    }
    e.x += Math.cos(e.angle) * s.speed * movement * dt;
    e.y += Math.sin(e.angle) * s.speed * movement * dt;
    const radius = Math.hypot(e.x, e.y);
    if (radius > 155) { e.x *= 155 / radius; e.y *= 155 / radius; e.angle += Math.PI; }
    // Soft collision gives large bodies weight without trapping the player.
    const separation = (s.size + this.species.size) * .42;
    if (dist < separation && dist > .001) {
      const push = (separation - dist) * .35;
      e.x += (e.x - p.x) / dist * push;
      e.y += (e.y - p.y) / dist * push;
    }
    if (this.boss?.id === e.id) this.boss.hp = e.hp;
  }

  _replenish() {
    if (this.entities.length < 58) {
      const a = this.random() * TAU;
      const r = 25 + this.random() * 32;
      let x = this.player.x + Math.cos(a) * r, y = this.player.y + Math.sin(a) * r;
      const radius = Math.hypot(x, y);
      if (radius > 147) { x *= 147 / radius; y *= 147 / radius; }
      const regional = this._worldTier(Math.hypot(x, y));
      const tier = clamp(Math.max(regional, this.tier - 1 + (this.random() < .3 ? 1 : 0)), 0, 7);
      const s = this.pick(SPECIES.filter(s => s.tier === tier));
      this.spawnEntity(s.id, x, y);
    }
    if (this.foods.filter(f => f.type === 'plant').length < 115) {
      const a = this.random() * TAU, r = this.random() * 145;
      this.spawnFood('plant', Math.cos(a) * r, Math.sin(a) * r, 1 + Math.floor(r / 50));
    }
  }

  _spawnBoss() {
    this._nextBoss = this.time + 150;
    if (this.boss) return;
    const tier = Math.min(7, this.tier + 1);
    const s = this.pick(SPECIES.filter(s => s.tier === tier));
    const angle = this.random() * TAU;
    let x = this.player.x + Math.cos(angle) * 34, y = this.player.y + Math.sin(angle) * 34;
    const radius = Math.hypot(x, y);
    if (radius > 145) { x *= 145 / radius; y *= 145 / radius; }
    const e = this.spawnEntity(s.id, x, y, { boss: true, passive: false });
    this.boss = { id: e.id, name: `Alpha ${s.name}`, hp: e.hp, maxHp: e.maxHp, speciesId: s.id };
    this.emit('boss', { x, y, text: `An alpha ${s.name} is hunting you.`, radius: 18 });
  }

  getResults() {
    return {
      speciesId: this.player.speciesId, tier: this.tier, kills: this.player.kills,
      time: Math.floor(this.time), score: Math.floor(this.player.score),
      dna: Math.max(1, Math.floor(this.player.kills * .7 + this.tier * 4 + this.time / 45 + this.ascensions * 14)),
      cause: this.cause || 'Run ended', ascensions: this.ascensions, seed: this.seed, difficulty: this.difficulty,
      mutations: [...this.mutations],
    };
  }
}
