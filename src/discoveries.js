import { WORLD_RADIUS, biomeAt } from "./world-data.js";

export const EXPLORATION_CELL_SIZE = 80;
export const EXPLORATION_GRID_SIZE = Math.ceil(WORLD_RADIUS * 2 / EXPLORATION_CELL_SIZE);
export const EXPLORATION_CELL_LIMIT = EXPLORATION_GRID_SIZE ** 2;
const explorableCells = new Set();
for (let x = 0; x < EXPLORATION_GRID_SIZE; x++) for (let y = 0; y < EXPLORATION_GRID_SIZE; y++) {
  if (Math.hypot(-WORLD_RADIUS + (x + .5) * EXPLORATION_CELL_SIZE,
    -WORLD_RADIUS + (y + .5) * EXPLORATION_CELL_SIZE) <= WORLD_RADIUS) explorableCells.add(`${x},${y}`);
}
const rawLandmarks = [
  { id: "first-nest", name: "The First Nest", kind: "fossil", x: 48, y: -34, color: 0xd4bd87,
    hint: "Look southeast of the hatching grounds, near the old nesting stones.",
    lore: "Tiny tracks surround one enormous impression. The oldest survivors sheltered their young before they hunted." },
  { id: "tidal-archive", name: "Tidal Archive", kind: "ruin", x: 220, y: 190, color: 0x6edbd8,
    hint: "Travel into the Sunken Fen in the southeast. The tidal pillars stand at 220 east, 190 south.",
    lore: "Layered shells record an inland sea. A hunter that survives its waters may inherit more than an appetite." },
  { id: "abyssal-tooth", name: "Abyssal Tooth", kind: "fossil", x: -290, y: 180, color: 0x68b7ef,
    hint: "A black tooth rises in the southwest fen: 290 west, 180 south. Find the tooth without entering deep water.",
    lore: "The tooth belongs to no river hunter. Its grooves point toward a lineage shaped by currents, pressure, and patience." },
  { id: "drowned-archive", name: "The Drowned Steps", kind: "ruin", x: -150, y: 278, color: 0x84c8bf,
    hint: "Follow the southwest fen edge to 150 west, 278 south. Stone steps emerge beside the reeds.",
    lore: "Flood marks climb these steps. The water always returned; the creatures that listened learned when to move." },
  { id: "frost-observatory", name: "Frost Observatory", kind: "ruin", x: -510, y: 430, color: 0xb1def5,
    hint: "Reach Frostfang Steppe, southwest of the basin. The ice-ringed observatory is at 510 west, 430 south.",
    lore: "Ice preserves the bones of a creature that slept through the hardest season. Cold survival can awaken its adaptation." },
  { id: "ember-forge", name: "Ember Forge", kind: "ruin", x: 835, y: -330, color: 0xffa26f,
    hint: "Enter the northeastern Ashen Caldera. Find the forge at 835 east, 330 north; avoid glowing fallout zones.",
    lore: "Ash has buried these stones a hundred times. Fire did not make their inhabitants invincible; it taught them where to stand." },
  { id: "elder-circle", name: "Elderroot Circle", kind: "standing-stones", x: -760, y: 470, color: 0x9ad5a2,
    hint: "Ancient standing stones shelter the southwest Elderroot Sanctuary at 760 west, 470 south.",
    lore: "Each stone bears a different footprint. The great herds survived because no single form ruled every season." },
  { id: "titan-fossil", name: "The Titan's Last Step", kind: "fossil", x: 930, y: -610, color: 0xe4d6ae,
    hint: "A vast fossil lies northeast in the Titan Graveyard at 930 east, 610 north.",
    lore: "A healed fracture crosses the titan's leg. Even the largest bodies survived by recovering, choosing battles, and moving on." },
  { id: "storm-spire", name: "Stormglass Spire", kind: "standing-stones", x: -890, y: 710, color: 0xc4b0f4,
    hint: "Seek the violet spire southwest in Stormglass Highlands, at 890 west, 710 south.",
    lore: "The glass remembers ancient impacts. Fixed warning signs precede the greatest changes; those who read them leave a longer history." },
  { id: "origin-vault", name: "The Origin Vault", kind: "ruin", x: 1020, y: 1110, color: 0xf0d38a,
    hint: "Beyond the outer bands, the Origin Vault stands southeast at 1020 east, 1110 south.",
    lore: "An unfinished spiral unites tooth, feather, scale, and shell. Extraordinary ancestry is earned through a lifetime of discoveries." },
];
export const LANDMARKS = Object.freeze(rawLandmarks.map((landmark) => Object.freeze({
  ...landmark, radius: 18, tier: biomeAt(landmark.x, landmark.y).tier,
  regionId: biomeAt(landmark.x, landmark.y).id,
})));
const byId = new Map(LANDMARKS.map((landmark) => [landmark.id, landmark]));
const membership = new WeakMap();
const finite = (n, min = 0, max = 1e12) => typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const plain = (v) => !!v && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
function visitedSet(state) {
  let cached = membership.get(state);
  if (!cached || cached.size !== state.visited.length) {
    cached = new Set(state.visited); membership.set(state, cached);
  }
  return cached;
}
function gridCell(x, y) {
  if (!finite(x, -WORLD_RADIUS, WORLD_RADIUS) || !finite(y, -WORLD_RADIUS, WORLD_RADIUS)) return null;
  return { x: Math.min(EXPLORATION_GRID_SIZE - 1, Math.floor((x + WORLD_RADIUS) / EXPLORATION_CELL_SIZE)),
    y: Math.min(EXPLORATION_GRID_SIZE - 1, Math.floor((y + WORLD_RADIUS) / EXPLORATION_CELL_SIZE)) };
}

/** Per-life exploration. Death ends this map; profile history may separately remember lore. */
export function initializeDiscoveryState(game) {
  if (game.exploration) return game.exploration;
  game.exploration = {
    version: 1, visited: [], discoveries: [], travel: 0,
    lastX: game.player?.x || 0, lastY: game.player?.y || 0,
  };
  return game.exploration;
}

/** Reveals a small neighborhood and records a landmark once, without loot or RNG. */
export function recordExploration(game) {
  const state = initializeDiscoveryState(game), p = game.player;
  if (!p || !finite(p.x, -WORLD_RADIUS, WORLD_RADIUS) || !finite(p.y, -WORLD_RADIUS, WORLD_RADIUS)) return [];
  const distance = Math.hypot(p.x - state.lastX, p.y - state.lastY);
  // Administrative teleports and restored positions do not manufacture travel accomplishments.
  if (distance <= EXPLORATION_CELL_SIZE) state.travel += distance;
  state.lastX = p.x; state.lastY = p.y;
  const cell = gridCell(p.x, p.y), known = visitedSet(state);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const x = cell.x + dx, y = cell.y + dy;
    if (x < 0 || y < 0 || x >= EXPLORATION_GRID_SIZE || y >= EXPLORATION_GRID_SIZE) continue;
    const key = `${x},${y}`;
    if (known.has(key)) continue;
    known.add(key); state.visited.push(key);
  }
  const found = [];
  for (const landmark of LANDMARKS) {
    if (Math.hypot(p.x - landmark.x, p.y - landmark.y) > landmark.radius || hasDiscovery(game, landmark.id)) continue;
    state.discoveries.push({ id: landmark.id, at: Math.max(0, game.time || 0) });
    found.push(landmark);
    game.emit?.("discovery", { id: landmark.id, text: landmark.name, lore: landmark.lore,
      regionId: landmark.regionId, x: landmark.x, y: landmark.y });
  }
  return found;
}

export function hasDiscovery(game, id) {
  return !!game.exploration?.discoveries.some((record) => record.id === id);
}
export function isExplored(game, x, y) {
  const cell = gridCell(x, y);
  return !!cell && !!game.exploration && visitedSet(game.exploration).has(`${cell.x},${cell.y}`);
}
export function landmarkPosition(id) {
  const landmark = byId.get(id);
  return landmark ? { x: landmark.x, y: landmark.y } : null;
}
function direction(dx, dy) {
  if (Math.hypot(dx, dy) < 18) return "here";
  const angle = Math.atan2(dy, dx), names = ["east", "southeast", "south", "southwest", "west", "northwest", "north", "northeast"];
  return names[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}
export function discoveryStatus(game) {
  const state = initializeDiscoveryState(game), p = game.player || { x: 0, y: 0 },
    found = new Set(state.discoveries.map((r) => r.id));
  const nearest = LANDMARKS.filter((l) => !found.has(l.id)).sort((a, b) =>
    Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  return {
    found: found.size, total: LANDMARKS.length, visitedCells: state.visited.length,
    coverage: state.visited.filter((key) => explorableCells.has(key)).length / explorableCells.size, travel: state.travel,
    records: state.discoveries.map((record) => ({ ...byId.get(record.id), at: record.at })),
    next: nearest ? { ...nearest, distance: Math.hypot(nearest.x - p.x, nearest.y - p.y),
      direction: direction(nearest.x - p.x, nearest.y - p.y) } : null,
  };
}

export function isExplorationStateValid(state) {
  return plain(state) && state.version === 1 && finite(state.travel) &&
    finite(state.lastX, -WORLD_RADIUS, WORLD_RADIUS) && finite(state.lastY, -WORLD_RADIUS, WORLD_RADIUS) &&
    Array.isArray(state.visited) && state.visited.length <= EXPLORATION_CELL_LIMIT &&
    new Set(state.visited).size === state.visited.length && state.visited.every((key) => {
      if (typeof key !== "string" || !/^\d{1,2},\d{1,2}$/.test(key)) return false;
      const [x, y] = key.split(",").map(Number);
      return x < EXPLORATION_GRID_SIZE && y < EXPLORATION_GRID_SIZE && key === `${x},${y}`;
    }) && Array.isArray(state.discoveries) && state.discoveries.length <= LANDMARKS.length &&
    new Set(state.discoveries.map((r) => r?.id)).size === state.discoveries.length &&
    state.discoveries.every((r) => plain(r) && byId.has(r.id) && finite(r.at));
}
