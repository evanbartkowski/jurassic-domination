import { Game } from "./game.js";
import { SPECIES_BY_ID } from "./data.js";
import { WORLD_RADIUS, chunkKey } from "./world-data.js";
import { snapshotGame, restoreGame } from "./run-state.js";
import { phenotype, validGenome, GENE_IDS } from "./genetics.js";
import { conditionsAt, worldStatus } from "./world-events.js";
import { MAX_TRAILS } from "./senses.js";

export const PROTOCOL_VERSION = 1;
export const TICK_RATE = 60;
export const FIXED_DELTA = 1 / TICK_RATE;
const movement = new Set(["x", "y", "aim", "attack", "ability", "special", "technique", "roar", "skill", "sprint", "dash", "eat", "evolve", "crouch"]);
const flags = ["attack", "ability", "special", "technique", "roar", "sprint", "dash", "eat", "evolve", "crouch"];
const commandFields = {
  hatch: [], "open-evolution": [], "close-evolution": [], evolve: ["speciesId", "mutationId"], waypoint: ["x", "y"],
};
const plain = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
export function normalizeInput(input = {}) {
  if (!plain(input) || Object.keys(input).some((key) => !movement.has(key))) throw new Error("Unsupported input field");
  const result = {};
  for (const key of ["x", "y", "aim"])
    if (input[key] !== undefined) {
      if (typeof input[key] !== "number" || !Number.isFinite(input[key])) throw new Error("Invalid movement input");
      result[key] = key === "aim" ? Math.atan2(Math.sin(input[key]), Math.cos(input[key])) : Math.max(-1, Math.min(1, input[key]));
    }
  const length = Math.hypot(result.x || 0, result.y || 0);
  if (length > 1) { result.x /= length; result.y /= length; }
  for (const key of flags) if (input[key] !== undefined) {
    if (typeof input[key] !== "boolean") throw new Error("Invalid action input");
    result[key] = input[key];
  }
  if (input.skill !== undefined) {
    if (!Number.isInteger(input.skill) || input.skill < -1 || input.skill > 5) throw new Error("Invalid relic slot");
    result.skill = input.skill;
  }
  return result;
}

/** Actual offline authority: accepts intent, advances a fixed tick, owns outcomes. */
export class LocalAuthority {
  constructor(game, { maxReplayEntries = 36000 } = {}) {
    if (!(game instanceof Game)) throw new Error("LocalAuthority requires a Game");
    this.game = game;
    this.sequence = game.commandSequence || 0;
    this._history = [];
    this._historyStart = 0;
    this.maxReplayEntries = Math.max(0, Math.min(100000, maxReplayEntries));
  }
  get commands() {
    return [...this._history.slice(this._historyStart), ...this._history.slice(0, this._historyStart)].map((entry) => ({ ...entry, payload: { ...entry.payload } }));
  }
  _sequence(sequence) {
    const next = sequence === undefined ? this.sequence + 1 : sequence;
    if (!Number.isSafeInteger(next) || next <= this.sequence) throw new Error("Duplicate or stale command sequence");
    if (next !== this.sequence + 1) throw new Error("Command sequence gap");
    return next;
  }
  _record(sequence, kind, payload) {
    this.sequence = sequence;
    this.game.commandSequence = sequence;
    if (this.maxReplayEntries) {
      const record = { sequence, tick: this.game.tick, kind, payload: { ...payload } };
      if (this._history.length < this.maxReplayEntries) this._history.push(record);
      else { this._history[this._historyStart] = record; this._historyStart = (this._historyStart + 1) % this.maxReplayEntries; }
    }
  }
  step(input = {}, sequence) {
    try {
      const normalized = normalizeInput(input), next = this._sequence(sequence);
      if (!["egg", "playing"].includes(this.game.state)) return { ok: false, error: "Run is not advancing", tick: this.game.tick };
      this.game.update(FIXED_DELTA, normalized);
      this.game.tick++;
      this._record(next, "step", normalized);
      return { ok: true, tick: this.game.tick };
    } catch (error) { return { ok: false, error: error.message, tick: this.game.tick }; }
  }
  dispatch(command, sequence) {
    try {
      if (!plain(command) || !Object.hasOwn(commandFields, command.type) ||
        Object.keys(command).some((key) => key !== "type" && !commandFields[command.type].includes(key))) throw new Error("Unsupported command");
      const next = this._sequence(sequence), g = this.game;
      let ok = false;
      switch (command.type) {
        case "hatch": ok = g.hatch(); break;
        case "open-evolution": ok = g.openEvolution(); break;
        case "close-evolution": ok = g.closeEvolution(); break;
        case "evolve":
          if (typeof command.speciesId !== "string" || typeof command.mutationId !== "string") throw new Error("Invalid evolution intent");
          ok = g.evolve(command.speciesId, command.mutationId); break;
        case "waypoint":
          if (![command.x, command.y].every((n) => typeof n === "number" && Number.isFinite(n)) || Math.hypot(command.x, command.y) > WORLD_RADIUS) throw new Error("Invalid destination");
          if (g.state === "dead") throw new Error("Run has ended");
          g.waypoint = { x: command.x, y: command.y }; ok = true; break;
      }
      if (!ok) return { ok: false, error: "Command is not available in this state", tick: g.tick };
      this._record(next, "dispatch", command);
      return { ok: true, tick: g.tick };
    } catch (error) { return { ok: false, error: error.message, tick: this.game.tick }; }
  }
  checkpoint() { return snapshotGame(this.game); }
  /** Trusted offline caller chooses owner visibility; this is not network authorization. */
  interestSnapshot({ x = this.game.player.x, y = this.game.player.y, radius = 160, includeOwnerState = true } = {}) {
    if (![x, y, radius].every(Number.isFinite) || radius < 1 || radius > 800 || typeof includeOwnerState !== "boolean") throw new Error("Invalid interest area");
    const g = this.game, within = (e) => (e.x - x) ** 2 + (e.y - y) ** 2 <= radius ** 2,
      identity = (id) => `${g.runId}:creature:${id}`,
      copy = (source, fields) => Object.fromEntries(fields.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])),
      genome = (source) => validGenome(source) ? { version: source.version, seed: source.seed,
        generation: source.generation, parentSeed: source.parentSeed,
        alleles: Object.fromEntries(GENE_IDS.map((id) => [id, source.alleles[id]])) } : null,
      appearance = (source) => { const traits = phenotype(source); return { hue: traits.hue, brightness: traits.brightness, markings: traits.markings }; },
      actor = (e) => ({ ...copy(e, ["speciesId", "x", "y", "angle", "hp", "maxHp", "attacking", "age", "maturitySeconds", "juvenile", "groupRole", "roleSign", "territoryRadius", "nestId", "packId", "stunned", "slowed", "hitFlash"]),
        id: identity(e.id), scale: e.scaleFactor || 1, genome: genome(e.genome), appearance: appearance(e.genome),
        parentIds: (e.parentIds || []).slice(0, 2).map(identity),
        cast: e.cast ? copy(e.cast, ["shape", "remaining", "radius", "angle", "x", "y"]) : null }),
      player = { ...copy(g.player, ["speciesId", "x", "y", "angle", "hp", "maxHp", "attacking", "abilityActive", "growth", "formScale", "crouching", "submerged"]),
        id: `${g.runId}:player`, tier: g.tier, scale: g.effectiveSize,
        genome: genome(g.player.genome), appearance: appearance(g.player.genome) },
      localWeather = conditionsAt(g, x, y), status = worldStatus(g),
      hazardNear = status.hazard && (status.hazard.x - x) ** 2 + (status.hazard.y - y) ** 2 <= (radius + status.hazard.radius) ** 2;
    if (includeOwnerState) Object.assign(player, copy(g.player, ["stamina", "hunger", "xp", "kills", "score", "abilityCooldown", "dashCooldown", "attackCooldown", "invulnerable", "specialCooldown", "techniqueCooldown", "nutrients", "damage", "speed", "armor"]));
    const view = { protocol: PROTOCOL_VERSION, runId: g.runId, tick: g.tick, state: g.state, time: g.time, chunk: chunkKey(x, y), player,
      entities: g.entities.filter(within).slice(0, 512).map(actor),
      foods: g.foods.filter(within).slice(0, 4096).map((f) => ({ ...copy(f, ["type", "x", "y", "tier", "plantKind", "speciesId", "age", "hatchAfter", "nestId"]),
        id: `${g.runId}:food:${f.id}`, ...(f.type === "egg" ? { genome: genome(f.genome) } : {}) })),
      projectiles: g.projectiles.filter(within).slice(0, 512).map((s) => ({ ...copy(s, ["x", "y", "angle", "speed", "life", "radius", "kind", "owner"]), id: `${g.runId}:projectile:${s.id}` })),
      nests: (g.nests || []).filter(within).slice(0, 64).map((n) => ({ ...copy(n, ["id", "x", "y", "speciesId", "territoryRadius", "generation", "born"]),
        parentIds: n.parentIds.slice(0, 2).map(identity), eggIds: n.eggIds.slice(0, 4).map((id) => `${g.runId}:food:${id}`) })),
      trails: (g.senses?.trails || []).filter((trail) => trail.expiresAt > g.time && within(trail)).slice(-MAX_TRAILS).map((trail) => ({
        ...copy(trail, ["kind", "x", "y", "angle", "strength", "createdAt", "expiresAt"]),
        sourceId: trail.sourceId === "player" ? `${g.runId}:player` : identity(trail.sourceId) })),
      weather: { ...copy(localWeather, ["event", "phase", "label", "temperature", "movementMultiplier", "foodGrowthMultiplier", "scentMultiplier", "visibilityMultiplier", "color"]),
        wind: { ...localWeather.wind }, hazard: hazardNear ? { ...status.hazard } : null,
        scars: (g.worldState?.scars || []).filter((scar) => scar.expires > g.worldState.clock && within(scar)).slice(0, 24).map((scar) => ({ ...scar })) },
    };
    if (includeOwnerState) view.owner = {
      adaptations: copy(g.player.adaptations || {}, ["frost", "cinder", "water", "stealth"]),
      survival: copy(g.survival || {}, ["temperature", "fatigue", "strain"]),
      exploration: { visited: (g.exploration?.visited || []).slice(0, 1600),
        discoveries: (g.exploration?.discoveries || []).slice(0, 10).map((record) => ({ id: record.id, at: record.at })),
        travel: g.exploration?.travel || 0 },
    };
    return view;
  }
}

export function replayCommands(checkpoint, commands) {
  const authority = new LocalAuthority(restoreGame(checkpoint));
  for (const command of commands) {
    const result = command.kind === "step" ? authority.step(command.payload, command.sequence) : command.kind === "dispatch" ? authority.dispatch(command.payload, command.sequence) : { ok: false, error: "Unknown replay command" };
    if (!result.ok) throw new Error(`Replay failed: ${result.error}`);
  }
  return authority.game;
}
