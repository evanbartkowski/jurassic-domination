import { SPECIES, SPECIES_BY_ID } from "./data.js";
export const EVOLUTION_RARITIES = {
  regular: { name: "Regular", color: "#b9cbb0", weight: 1 },
  rare: { name: "Rare", color: "#77bced", weight: 0.08 },
  epic: { name: "Epic", color: "#c997f0", weight: 0.025 },
  legendary: { name: "Legendary", color: "#f2c76d", weight: 0.006 },
};
export const BLOODLINES = [
  {
    id: "verdant-seed",
    speciesId: "verdant-psittacosaurus",
    name: "Seed of Elderroot",
    tier: 1,
    description: "Eat 3 rare Sunheart Fruits in this life.",
    test: (g) => (g.lineage.fruits.sunheart || 0) >= 3,
  },
  {
    id: "verdant-guard",
    speciesId: "verdant-iguanodon",
    name: "Elderroot Guardian",
    tier: 2,
    description:
      "Evolve from Verdant Psittacosaurus after eating 2 more Sunheart Fruits.",
    test: (g) =>
      g.species.id === "verdant-psittacosaurus" &&
      (g.lineage.fruits.sunheart || 0) >= 2,
  },
  {
    id: "verdant-elder",
    speciesId: "elderroot-therizinosaurus",
    name: "The Elderroot Line",
    tier: 3,
    description: "As Verdant Iguanodon, survive 180 seconds in that form.",
    test: (g) =>
      g.species.id === "verdant-iguanodon" && g.time - g.formStarted >= 180,
  },
  {
    id: "cinderfang",
    speciesId: "cinderfang-carnotaurus",
    name: "Ten Hearts of Lava",
    tier: 4,
    description: "Kill 10 creatures that live in Ashen Caldera in this life.",
    test: (g) => g.lineage.lavaKills >= 10,
  },
  {
    id: "ashborn",
    speciesId: "ashborn-tyrannosaurus",
    name: "Ashborn Dynasty",
    tier: 5,
    description: "As Cinderfang, defeat a named lair guardian.",
    test: (g) =>
      g.species.id === "cinderfang-carnotaurus" && g.lineage.formGuardians >= 1,
  },
  {
    id: "eclipse",
    speciesId: "eclipse-wyrm",
    name: "The Eclipse Covenant",
    tier: 6,
    description:
      "Eat 3 Moondrop Fruits and defeat 3 named guardians in one life.",
    test: (g) =>
      (g.lineage.fruits.moondrop || 0) >= 3 && g.lineage.guardians >= 3,
  },
  {
    id: "stormcrown",
    speciesId: "stormcrown-dragon",
    name: "Crown of the Storm",
    tier: 7,
    description: "Become Eclipse Wyrm, then defeat 15 prey in that form.",
    test: (g) => g.species.id === "eclipse-wyrm" && g.lineage.formKills >= 15,
  },
];
export function newLineage() {
  return {
    fruits: { sunheart: 0, moondrop: 0 },
    lavaKills: 0,
    guardians: 0,
    formKills: 0,
    formGuardians: 0,
    used: [],
  };
}
export function eligibleBloodlines(g) {
  return BLOODLINES.filter(
    (b) =>
      b.tier === Math.min(7, g.tier + 1) &&
      !g.lineage.used.includes(b.id) &&
      b.test(g),
  );
}
export function evolutionPool(g) {
  return SPECIES.filter(
    (s) => s.tier === Math.min(7, g.tier + 1) && !s.bloodline,
  );
}
export function chooseEvolutions(g) {
  const pool = evolutionPool(g),
    regular = pool.filter((s) => s.rarity === "regular"),
    result = [];
  for (let i = 0; i < 3; i++) {
    const roll = g.random(),
      rarity =
        roll < 0.006
          ? "legendary"
          : roll < 0.031
            ? "epic"
            : roll < 0.111
              ? "rare"
              : "regular";
    let choices = pool.filter(
      (s) => s.rarity === rarity && !result.includes(s.id),
    );
    if (!choices.length)
      choices = regular.filter((s) => !result.includes(s.id));
    if (!choices.length) choices = pool.filter((s) => !result.includes(s.id));
    if (choices.length) result.push(g.pick(choices).id);
  }
  return [...result, ...eligibleBloodlines(g).map((b) => b.speciesId)];
}
export const SPECIALS = {
  rending: {
    name: "Rending Flurry",
    description: "A second claw attack that poisons wounded prey.",
    cooldown: 8,
    stamina: 24,
    type: "attack",
  },
  rage: {
    name: "Predator Focus",
    description: "Damage and speed surge for 7 seconds.",
    cooldown: 17,
    stamina: 28,
    type: "buff",
  },
  bulwark: {
    name: "Living Fortress",
    description: "Brace for 6 seconds and empower your next bite.",
    cooldown: 15,
    stamina: 30,
    type: "defense",
  },
  renewal: {
    name: "Ancient Renewal",
    description: "Restore 25% health and purge poison and frost.",
    cooldown: 22,
    stamina: 32,
    type: "heal",
  },
  bolt: {
    name: "Astral Bolt",
    description: "Launch an aimed bolt up to 32 units.",
    cooldown: 12,
    stamina: 30,
    type: "ranged",
  },
  shed: {
    name: "Shed Skin",
    description:
      "Cleanse poison and frost, heal 12%, and gain brief protection.",
    cooldown: 17,
    stamina: 26,
    type: "heal",
  },
  deathroll: {
    name: "Death Roll",
    description: "A close crushing strike that stuns nearby prey.",
    cooldown: 10,
    stamina: 28,
    type: "attack",
  },
};
export function creatureKit(s) {
  const special = {
    raptor: "rending",
    rex: "rage",
    quad: "bulwark",
    longneck: "renewal",
    dragon: "bolt",
    serpent: "shed",
    croc: "deathroll",
    gryphon: "rending",
    equine: "renewal",
  }[s.body];
  return {
    dash:
      ["raptor", "bird", "equine", "gryphon", "dragon"].includes(s.body) ||
      (s.body === "rex" && s.size < 2),
    special: special || null,
  };
}
export function growthFromFood(nutrients, tier) {
  return Math.max(
    0,
    Math.min(1, (Number(nutrients) || 0) / (140 + Math.max(0, tier) * 140)),
  );
}
export function growthName(growth) {
  return growth >= 0.9
    ? "Veteran"
    : growth >= 0.5
      ? "Mature"
      : growth >= 0.15
        ? "Growing"
        : "Young";
}
export function feedEntity(game, e, food) {
  const s = SPECIES_BY_ID[e.speciesId];
  e.nutrients = (e.nutrients || 0) + Math.max(0, food.value || 0);
  e.growth = growthFromFood(e.nutrients, s.tier);
  const ratio = e.hp / Math.max(1, e.maxHp);
  e.adultMaxHp = e.baseMaxHp * (1 + e.growth * 0.4);
  e.maxHp =
    e.adultMaxHp * (e.juvenile ? 0.45 + 0.55 * Math.min(1, e.age / 100) : 1);
  e.hp = Math.min(e.maxHp, e.maxHp * ratio + e.maxHp * 0.06);
  e.damage = s.damage * (1 + e.growth * 0.32);
  e.scaleFactor =
    (e.juvenile ? 0.42 + 0.58 * Math.min(1, e.age / 100) : 1) *
    (1 + e.growth * 0.28);
  e.hunger = Math.min(100, (e.hunger || 0) + 35);
}
