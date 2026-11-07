export const WORLD_RADIUS = 1600;
export const CHUNK_SIZE = 160;
export const BANDS = [180, 380, 600, 820, 1040, 1260, 1450, 1600];
const names = [
  [
    "fernwood",
    "Fernwood Basin",
    0x456b40,
    "Sheltered nesting grounds. Small prey and edible ferns.",
  ],
  [
    "savannah",
    "Amber Savannah",
    0x92905a,
    "Open grasslands patrolled by raptor packs.",
  ],
  [
    "fen",
    "Sunken Fen",
    0x335c53,
    "Mist, crocodilian ambushers and luminous marsh flowers.",
  ],
  [
    "redwood",
    "Redwood Valley",
    0x3d6446,
    "Ancient groves shelter armored grazers and pack hunters.",
  ],
  [
    "marsh",
    "Mooncap Marsh",
    0x465260,
    "Giant mushrooms, venomous creatures and rare mooncaps.",
  ],
  [
    "desert",
    "The Bone Expanse",
    0x9c8663,
    "Bleached dunes, exposed nests and territorial horned beasts.",
  ],
  [
    "frost",
    "Frostfang Steppe",
    0x879c9d,
    "Pale forests conceal fast hunters and frost-breathing beasts.",
  ],
  [
    "volcano",
    "Ashen Caldera",
    0x63534d,
    "Black stone and lava vents sustain the largest predators.",
  ],
  [
    "grove",
    "Elderroot Sanctuary",
    0x547b68,
    "Titanic herbivores roam among forgotten standing stones.",
  ],
  [
    "graveyard",
    "The Titan Graveyard",
    0x877f66,
    "Titanic skeletons shelter the last and largest prehistoric hunters.",
  ],
  [
    "highlands",
    "Stormglass Highlands",
    0x626471,
    "Great herds and southern giants roam mineral-rich ridges.",
  ],
  [
    "sky",
    "Celestial Gardens",
    0x698281,
    "Unicorns, gryphons and sunlit relic groves.",
  ],
  [
    "peaks",
    "Dragonspine Peaks",
    0x5a4b6c,
    "Dragons guard mineral-rich nests and ancient bones.",
  ],
];
export const REGIONS = names.map(([id, name, color, description], i) => ({
  id,
  name,
  color,
  description,
  tier: i === 0 ? 0 : Math.ceil(i / 2),
  side: i === 0 ? "all" : i % 2 ? "north" : "south",
  minRadius: i === 0 ? 0 : BANDS[Math.ceil(i / 2) - 1],
  maxRadius: BANDS[i === 0 ? 0 : Math.ceil(i / 2)],
}));
// Both outermost regions hold primordial creatures, beyond the mythical gardens.
REGIONS.push({
  id: "origin",
  name: "Crown of the World",
  tier: 7,
  side: "all",
  minRadius: 1450,
  maxRadius: 1600,
  color: 0x4c5663,
  description: "The last frontier. Primordial creatures and the rarest relics.",
});
export function biomeAt(x, y) {
  const radius = Math.hypot(x, y);
  if (radius < 180) return REGIONS[0];
  if (radius >= 1450) return REGIONS.at(-1);
  const tier = Math.min(
    6,
    BANDS.findIndex((r) => radius < r),
  );
  return REGIONS[1 + (tier - 1) * 2 + (y >= 0 ? 1 : 0)];
}
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = state;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}
export function chunkSeed(seed, cx, cy) {
  return (
    (seed ^ Math.imul(cx + 710, 73856093) ^ Math.imul(cy + 913, 19349663)) >>> 0
  );
}
export function chunkKey(x, y) {
  return `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)}`;
}
export function foodEfficiency(playerTier, foodTier = 0) {
  return Math.max(
    0.003,
    Math.pow(0.14, Math.max(0, playerTier - foodTier - 1)),
  );
}
export const LAIRS = [
  {
    id: "matriarch",
    name: "The Frilled Matriarch",
    speciesId: "styracosaurus",
    x: 245,
    y: -100,
    tier: 2,
    respawn: 180,
  },
  {
    id: "marshfang",
    name: "Marshfang",
    speciesId: "sarcosuchus",
    x: -340,
    y: 180,
    tier: 3,
    respawn: 200,
  },
  {
    id: "boneking",
    name: "The Bone King",
    speciesId: "tyrannosaurus",
    x: 580,
    y: -320,
    tier: 4,
    respawn: 220,
  },
  {
    id: "frostmaw",
    name: "Frostmaw",
    speciesId: "frost-dragon",
    x: -630,
    y: 430,
    tier: 6,
    respawn: 260,
  },
  {
    id: "cinder",
    name: "Cinder, the Ash Tyrant",
    speciesId: "giganotosaurus",
    x: 920,
    y: -240,
    tier: 5,
    respawn: 240,
  },
  {
    id: "unicorn",
    name: "The Starhorn Sovereign",
    speciesId: "celestial-unicorn",
    x: -1030,
    y: 420,
    tier: 6,
    respawn: 280,
  },
  {
    id: "elder",
    name: "Vhal, the Elder Flame",
    speciesId: "elder-dragon",
    x: 1120,
    y: -650,
    tier: 7,
    respawn: 300,
  },
  {
    id: "serpent",
    name: "Jormungandr, World Eater",
    speciesId: "world-serpent",
    x: -1390,
    y: 430,
    tier: 7,
    respawn: 320,
  },
];
