import { REGIONS, biomeAt, seeded, WORLD_RADIUS } from "./world-data.js";

export const WEATHER_WINDOW = 180;
export const WORLD_SCAR_LIMIT = 24;
const WARNING_SECONDS = 24;
const ACTIVE_END = 140;
const SCAR_LIFETIME = 540;
const cache = new WeakMap();
const climate = {
  fernwood: 22, savannah: 30, fen: 24, redwood: 18, marsh: 18,
  desert: 38, frost: -7, volcano: 34, grove: 21, graveyard: 24,
  highlands: 9, sky: 13, peaks: 0, origin: 2,
};
const seasons = ["Wet season", "Growing season", "Dry season", "Cold season"];
const definitions = {
  clear: { label: "Clear skies", movement: 1, food: 1, scent: 1, visibility: 1, temperature: 0, color: 0x93bec2 },
  rain: { label: "Seasonal rain", movement: .97, food: 1.3, scent: .38, visibility: .72, temperature: -4, color: 0x65bde1 },
  flood: { label: "Rising floodwater", movement: .83, food: .72, scent: .25, visibility: .62, temperature: -3, color: 0x43aee3 },
  drought: { label: "Regional drought", movement: 1, food: .48, scent: .82, visibility: 1, temperature: 8, color: 0xe4bd68 },
  frost: { label: "Hard frost", movement: .91, food: .65, scent: .68, visibility: .82, temperature: -12, color: 0xade3fb },
  ashfall: { label: "Drifting volcanic ash", movement: .96, food: .7, scent: .5, visibility: .64, temperature: 4, color: 0xc08b79 },
  fire: { label: "Grassfire", movement: 1, food: .5, scent: .55, visibility: .74, temperature: 10, color: 0xf69956 },
  eruption: { label: "Caldera eruption", movement: .94, food: .48, scent: .35, visibility: .58, temperature: 12, color: 0xff8159 },
  meteor: { label: "Meteor fall", movement: 1, food: .85, scent: .8, visibility: .88, temperature: 0, color: 0xc6a9ff },
};
const catastrophic = new Set(["fire", "eruption", "meteor"]);
const finite = (n, min = 0, max = 1e12) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return value >>> 0;
}
function offsetFor(region) { return hash(region.id) % 65; }
function epochAt(region, clock) { return Math.floor((clock + offsetFor(region)) / WEATHER_WINDOW); }
function eventSchedule(seed, region, epoch) {
  const random = seeded((seed ^ hash(region.id) ^ Math.imul(epoch + 171, 0x45d9f3b)) >>> 0);
  const roll = random(), season = Math.floor(Math.max(0, epoch) / 4) % 4;
  let event = "clear";
  // The first sheltered window is always gentle. Dangerous events never target it.
  if (region.id === "fernwood") event = epoch === 0 ? "clear" : roll < .62 ? "rain" : roll < .75 ? "drought" : "clear";
  else if (region.id === "volcano") event = epoch > 0 && roll < .1 ? "eruption" : roll < .68 ? "ashfall" : "drought";
  else if (["frost", "peaks", "origin"].includes(region.id)) event = epoch > 1 && region.tier >= 6 && roll < .045 ? "meteor" : roll < .7 ? "frost" : "clear";
  else if (["fen", "marsh"].includes(region.id)) event = roll < .28 ? "flood" : roll < .72 ? "rain" : "drought";
  else if (["savannah", "desert", "graveyard"].includes(region.id)) event = epoch > 0 && roll < .06 ? "fire" : roll < .56 ? "drought" : roll < .78 ? "rain" : "clear";
  else if (region.id === "highlands" && epoch > 1 && roll < .04) event = "meteor";
  else event = roll < (season === 0 ? .68 : .46) ? "rain" : roll < .72 ? "clear" : season === 3 ? "frost" : "drought";
  const start = epoch * WEATHER_WINDOW - offsetFor(region);
  const radius = (region.minRadius + region.maxRadius) * .5;
  let angle = random() * Math.PI * 2;
  if (region.side === "north") angle = Math.PI + .25 + random() * (Math.PI - .5);
  if (region.side === "south") angle = .25 + random() * (Math.PI - .5);
  const windAngle = random() * Math.PI * 2;
  const windSpeed = .5 + random() * .9;
  return {
    id: `${region.id}:${epoch}:${event}`, event, regionId: region.id, epoch, start,
    impactAt: start + WARNING_SECONDS,
    x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
    radius: event === "eruption" ? 24 : event === "meteor" ? 18 : 22,
    wind: Object.freeze({ x: Math.cos(windAngle) * windSpeed, y: Math.sin(windAngle) * windSpeed, angle: windAngle }),
  };
}
function stateCache(state) {
  let entry = cache.get(state);
  if (!entry) { entry = { regions: new Map() }; cache.set(state, entry); }
  return entry;
}
function scheduleFor(state, region) {
  const epoch = epochAt(region, state.clock), stored = stateCache(state).regions.get(region.id);
  if (stored?.schedule.epoch === epoch) return stored;
  const entry = { schedule: eventSchedule(state.seed, region, epoch), profiles: new Map() };
  stateCache(state).regions.set(region.id, entry);
  return entry;
}
function phaseAt(schedule, clock) {
  if (schedule.event === "clear") return "clear";
  const elapsed = clock - schedule.start;
  return elapsed < WARNING_SECONDS ? "warning" : elapsed < ACTIVE_END ? "active" : "recovery";
}

/** Independent, JSON-only environmental state. It never consumes the creature PRNG. */
export function initializeWorldState(game) {
  if (game.worldState) return game.worldState;
  game.worldState = {
    version: 1, seed: (Number(game.seed) ^ 0x728e94cd) >>> 0,
    clock: Math.max(0, Number(game.time) || 0), lastEpoch: -1, noticeKey: "", scars: [],
  };
  refreshScars(game.worldState);
  return game.worldState;
}
function refreshScars(state) {
  const scars = [], asOf = Math.floor(state.clock / 30) * 30;
  for (const region of REGIONS) {
    if (region.tier === 0) continue;
    const current = epochAt(region, asOf);
    for (let epoch = Math.max(1, current - 4); epoch <= current; epoch++) {
      const schedule = eventSchedule(state.seed, region, epoch);
      if (!catastrophic.has(schedule.event) || schedule.impactAt < 180 ||
        schedule.impactAt > asOf || asOf >= schedule.impactAt + SCAR_LIFETIME) continue;
      scars.push({ id: schedule.id, event: schedule.event, regionId: region.id,
        x: schedule.x, y: schedule.y, radius: schedule.radius,
        at: schedule.impactAt, expires: schedule.impactAt + SCAR_LIFETIME,
        color: definitions[schedule.event].color });
    }
  }
  state.scars = scars.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).slice(0, WORLD_SCAR_LIMIT);
  state.lastEpoch = Math.floor(state.clock / 30);
}

/** One call per authoritative simulation update. Emits notices, never random rewards. */
export function updateWorldEvents(game, dt) {
  const state = initializeWorldState(game);
  if (!finite(dt, 0, 3600)) return;
  state.clock += dt;
  if (state.lastEpoch !== Math.floor(state.clock / 30)) refreshScars(state);
  const p = game.player;
  if (!p) return;
  const region = biomeAt(p.x, p.y), stored = scheduleFor(state, region),
    phase = phaseAt(stored.schedule, state.clock), key = `${stored.schedule.id}:${phase}`;
  if (state.noticeKey === key) return;
  state.noticeKey = key;
  if (phase === "clear" || phase === "recovery") return;
  const status = worldStatus(game);
  game.emit?.("world-event", { event: status.event, phase, text: status.label,
    detail: status.detail, x: status.hazard?.x ?? p.x, y: status.hazard?.y ?? p.y,
    radius: status.hazard?.radius || 0 });
}

/** Constant regional profiles are cached; positional hazard checks are small and bounded. */
export function conditionsAt(game, x, y) {
  const state = game.worldState || initializeWorldState(game), region = biomeAt(x, y),
    entry = scheduleFor(state, region), schedule = entry.schedule,
    phase = phaseAt(schedule, state.clock);
  const season = Math.floor(state.clock / 720) % 4, profileKey = `${phase}:${season}`;
  let profile = entry.profiles.get(profileKey);
  if (!profile) {
    const effect = definitions[schedule.event], active = phase === "active";
    profile = Object.freeze({
      event: schedule.event, phase, label: effect.label, regionId: region.id,
      movementMultiplier: active ? effect.movement : 1,
      foodGrowthMultiplier: active ? effect.food : 1,
      scentMultiplier: active ? effect.scent : 1,
      visibilityMultiplier: active ? effect.visibility : 1,
      temperature: climate[region.id] + [0, 2, 5, -6][season] + (active ? effect.temperature : 0),
      wind: schedule.wind, hazardDamagePerSecond: 0, hazardCause: "", color: effect.color,
    });
    entry.profiles.set(profileKey, profile);
  }
  const hit = worldImpactAt(game, x, y, schedule, phase);
  return hit ? { ...profile, ...hit } : profile;
}

/** Local aftermath persists for nine minutes and lowers vegetation recovery. */
export function worldImpactAt(game, x, y, schedule, phase) {
  const state = game.worldState || initializeWorldState(game);
  if (!schedule) {
    const entry = scheduleFor(state, biomeAt(x, y));
    schedule = entry.schedule; phase = phaseAt(schedule, state.clock);
  }
  const activeDanger = phase === "active" && catastrophic.has(schedule.event) &&
    schedule.impactAt >= 180 && Math.hypot(x - schedule.x, y - schedule.y) < schedule.radius;
  if (activeDanger) return {
    hazardDamagePerSecond: schedule.event === "eruption" ? 4 : schedule.event === "meteor" ? 3 : 2,
    hazardCause: schedule.event === "meteor" ? "Cooling meteor crater" : schedule.event === "eruption" ? "Volcanic fallout" : "Grassfire",
    foodGrowthMultiplier: .25, scorched: true,
  };
  for (const scar of state.scars) {
    if (scar.expires <= state.clock || Math.hypot(x - scar.x, y - scar.y) >= scar.radius) continue;
    return { foodGrowthMultiplier: .45, hazardDamagePerSecond: 0, hazardCause: "", scorched: true };
  }
  return null;
}

export function getTimeOfDay(clock = 0) {
  const cycle = 240;
  const t = ((Number(clock) % cycle) + cycle) % cycle;
  const progress = t / cycle;
  if (progress < 0.20) {
    const sub = progress / 0.20;
    return { name: "dawn", label: "Dawn", progress, sub, ambientIntensity: 0.75 + sub * 0.25 };
  } else if (progress < 0.55) {
    const sub = (progress - 0.20) / 0.35;
    return { name: "day", label: "Daylight", progress, sub, ambientIntensity: 1.0 };
  } else if (progress < 0.75) {
    const sub = (progress - 0.55) / 0.20;
    return { name: "dusk", label: "Twilight", progress, sub, ambientIntensity: 1.0 - sub * 0.35 };
  } else {
    const sub = (progress - 0.75) / 0.25;
    return { name: "night", label: "Deep Night", progress, sub, ambientIntensity: 0.38 };
  }
}

export function worldStatus(game) {
  const state = game.worldState || initializeWorldState(game), p = game.player || { x: 0, y: 0 },
    region = biomeAt(p.x, p.y), entry = scheduleFor(state, region), schedule = entry.schedule,
    phase = phaseAt(schedule, state.clock), effect = definitions[schedule.event],
    dangerous = catastrophic.has(schedule.event) && schedule.impactAt >= 180;
  const descriptions = {
    clear: "Wind carries scent. Cover still breaks sight.",
    rain: "Rain washes scent trails away and encourages fresh forage.",
    flood: "Floodwater slows travel; scent fades quickly and forage thins.",
    drought: "Heat and dry soil reduce new forage. Seek wet ground or travel on.",
    frost: "Cold slows travel and vegetation. Shelter and cold adaptations help.",
    ashfall: "Ash reduces visibility, scent, and plant recovery.",
    fire: "A grassfire has a fixed burn area. Leave the glowing circle before it ignites.",
    eruption: "A fixed fallout zone is marked. Leave it before the eruption; burned ground recovers slowly.",
    meteor: "A fixed impact site is marked. Leave the circle; the crater stays hot after impact.",
  };
  return {
    ...conditionsAt(game, p.x, p.y), season: seasons[Math.floor(state.clock / 720) % 4],
    timeOfDay: getTimeOfDay(state.clock),
    label: `${phase === "warning" ? "Approaching: " : phase === "recovery" ? "Passing: " : ""}${effect.label}`,
    detail: descriptions[schedule.event],
    remaining: Math.max(0, (phase === "warning" ? WARNING_SECONDS : phase === "active" ? ACTIVE_END : WEATHER_WINDOW) - (state.clock - schedule.start)),
    hazard: dangerous && ["warning", "active"].includes(phase) ? {
      x: schedule.x, y: schedule.y, radius: schedule.radius, color: effect.color,
      active: phase === "active", event: schedule.event,
    } : null,
    scars: state.scars,
  };
}

export function isWorldStateValid(state) {
  return plain(state) && state.version === 1 && Number.isInteger(state.seed) && finite(state.seed, 0, 0xffffffff) &&
    finite(state.clock) && Number.isSafeInteger(state.lastEpoch) && state.lastEpoch >= -1 &&
    typeof state.noticeKey === "string" && state.noticeKey.length <= 128 &&
    Array.isArray(state.scars) && state.scars.length <= WORLD_SCAR_LIMIT &&
    new Set(state.scars.map((s) => s?.id)).size === state.scars.length && state.scars.every((s) =>
      plain(s) && typeof s.id === "string" && s.id.length <= 96 && catastrophic.has(s.event) &&
      REGIONS.some((r) => r.id === s.regionId && r.tier > 0) && finite(s.x, -WORLD_RADIUS, WORLD_RADIUS) &&
      finite(s.y, -WORLD_RADIUS, WORLD_RADIUS) && finite(s.radius, 1, 40) && finite(s.at) &&
      finite(s.expires, s.at, s.at + SCAR_LIFETIME) && Number.isInteger(s.color) && finite(s.color, 0, 0xffffff));
}
