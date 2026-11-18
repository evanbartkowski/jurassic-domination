import { SPECIES, SPECIES_BY_ID } from "./data.js";
import { phenotype, exposureProgress } from "./genetics.js";
import { hasDiscovery } from './discoveries.js';
export const EVOLUTION_RARITIES = {
  regular: { name: "Regular", color: "#b9cbb0", weight: 1 },
  rare: { name: "Rare", color: "#77bced", weight: 0.08 },
  epic: { name: "Epic", color: "#c997f0", weight: 0.025 },
  legendary: { name: "Legendary", color: "#f2c76d", weight: 0.001 },
};
export const BLOODLINES = [
  {
    id: 'tidal-memory', speciesId: 'tideweaver', name: 'Memory of the Tides', tier: 2,
    description: 'Find the Tidal Archive and swim while healthy for 25 seconds this life (15 with inherited water affinity).',
    test: g => hasDiscovery(g, 'tidal-archive') && exposureProgress(g.player.adaptations, 'water') >= (phenotype(g.player.genome).adaptations.includes('water') ? 15 : 25),
  },
  {
    id: 'abyssal-dynasty', speciesId: 'abyssal-kronosaur', name: 'The Drowned Dynasty', tier: 4,
    description: 'Remember Tideweaver in this life, defeat a named guardian and discover the Abyssal Tooth.',
    test: g => (g.formHistory || []).includes('tideweaver') && (g.guardianKills || 0) >= 1 && hasDiscovery(g, 'abyssal-tooth'),
  },
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
    (s) => s.tier === Math.min(7, g.tier + 1) && !s.bloodline&&!s.wildOnly,
  );
}
export const BEHAVIOR_AFFINITIES = {
  night: { id: "night", label: "Night Stalker", icon: "🌙", description: "Hunts and prowls primarily under cover of darkness." },
  aquatic: { id: "aquatic", label: "Aquatic Hunter", icon: "🌊", description: "Adapts to swimming and hunting deep in waterways." },
  armored: { id: "armored", label: "Living Fortress", icon: "🛡️", description: "Absorbs damage and deflects lethal frontal attacks." },
  venom: { id: "venom", label: "Toxin Specialist", icon: "🧪", description: "Inflicts debilitating poison and lingering bleed." },
  frost: { id: "frost", label: "Frost Survivor", icon: "❄️", description: "Withstands bitter subzero temperatures." },
  pack: { id: "pack", label: "Pack Leader", icon: "🐺", description: "Coordinates hunts and rallies allies with roars." },
};

export function getActiveAffinities(g) {
  const b = g?.survivalBehavior || {};
  const affinities = [];
  if ((b.nightKills || 0) >= 2 || (b.nightTime || 0) >= 40) affinities.push(BEHAVIOR_AFFINITIES.night);
  if ((b.waterTime || 0) >= 15 || (b.aquaticKills || 0) >= 1) affinities.push(BEHAVIOR_AFFINITIES.aquatic);
  if ((b.damageBlocked || 0) >= 50 || (b.apexHitsTaken || 0) >= 3) affinities.push(BEHAVIOR_AFFINITIES.armored);
  if ((b.statusInflicted || 0) >= 4) affinities.push(BEHAVIOR_AFFINITIES.venom);
  if ((b.coldTime || 0) >= 20) affinities.push(BEHAVIOR_AFFINITIES.frost);
  if ((b.packKills || 0) >= 2 || (b.roarsWithPack || 0) >= 2) affinities.push(BEHAVIOR_AFFINITIES.pack);
  return affinities;
}

export function speciesMatchesAffinity(s, affinityId) {
  if (!s) return false;
  if (affinityId === "night") return ["raptor", "bird"].includes(s.body) || /troodon|carnotaurus|velociraptor|dromaeo/.test(s.id);
  if (affinityId === "aquatic") return ["marine", "croc"].includes(s.body) || /spino|baryonyx|sucho|sarco|kronosaur|tideweaver/.test(s.id);
  if (affinityId === "armored") return ["quad", "longneck"].includes(s.body) || /ankylo|stego|tricer|titan|pachy/.test(s.id);
  if (affinityId === "venom") return s.body === "serpent" || ["venom", "flame"].includes(s.abilityType) || /dilopho|guanlong|wyrm/.test(s.id);
  if (affinityId === "frost") return s.abilityType === "frost" || /yutyrannus|cryolopho|mammoth|glacier|blizzard/.test(s.id);
  if (affinityId === "pack") return s.temperament === "pack" || /raptor|compsognathus|wolf/.test(s.id);
  return false;
}

export function getAffinityForSpecies(s, affinities) {
  if (!s || !affinities || !affinities.length) return null;
  return affinities.find((aff) => speciesMatchesAffinity(s, aff.id)) || null;
}

export function pickWeightedByBehavior(choices, affinities, randomFn) {
  if (!choices.length) return null;
  if (!affinities || !affinities.length) {
    const idx = Math.floor(randomFn() * choices.length);
    return choices[Math.max(0, Math.min(choices.length - 1, idx))];
  }
  const weights = choices.map((s) => {
    const matches = affinities.some((aff) => speciesMatchesAffinity(s, aff.id));
    return matches ? 3.5 : 1.0;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = randomFn() * total;
  for (let i = 0; i < choices.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return choices[i];
  }
  return choices[choices.length - 1];
}

export function chooseEvolutions(g) {
  const pool = evolutionPool(g),
    regular = pool.filter((s) => s.rarity === "regular"),
    result = [],
    affinities = getActiveAffinities(g);
  for (let i = 0; i < 3; i++) {
    const roll = g.random(),
      rarity =
        roll < 0.001
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
    if (choices.length) {
      const chosen = pickWeightedByBehavior(choices, affinities, () => g.random());
      result.push(chosen.id);
    }
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
export const EVOLUTION_ARCHETYPES = {
  ambush: {
    id: "ambush",
    name: "Ambush Predator",
    tagline: "Stalk from brush, lethal first strike",
    pros: "+25% bite damage, +8% movement speed",
    cons: "-15% maximum HP",
    icon: "🗡️",
    damageMultiplier: 1.25,
    speedBonus: 1.08,
    hpMultiplier: 0.85,
  },
  titan: {
    id: "titan",
    name: "Armored Titan",
    tagline: "Unstoppable living fortress",
    pros: "+42% maximum HP and +20% armor",
    cons: "-20% movement speed, -12% bite damage",
    icon: "🛡️",
    damageMultiplier: 0.88,
    speedBonus: 0.80,
    hpMultiplier: 1.42,
    armorBonus: 0.20,
  },
  pack: {
    id: "pack",
    name: "Pack Hunter",
    tagline: "Coordinated swarm tactics",
    pros: "+15% movement speed, 12% faster bites",
    cons: "-5% maximum HP",
    icon: "🐺",
    damageMultiplier: 1.05,
    speedBonus: 1.15,
    hpMultiplier: 0.95,
    attackInterval: .88,
  },
  venom: {
    id: "venom",
    name: "Venom Specialist",
    tagline: "Slow-acting corrosive toxins",
    pros: "Poisonous bites, 65% less poison damage",
    cons: "-18% direct damage and -10% maximum HP",
    icon: "🧪",
    damageMultiplier: 0.82,
    speedBonus: 1.05,
    hpMultiplier: 0.90,
    toxinResistance: .65,
  },
  apex: {
    id: "apex",
    name: "Apex Destroyer",
    tagline: "Colossal territorial overlord",
    pros: "+25% bite damage and +20% maximum HP",
    cons: "-8% movement speed, +20% hunger drain",
    icon: "👑",
    damageMultiplier: 1.25,
    speedBonus: 0.92,
    hpMultiplier: 1.20,
    hungerDrainMult: 1.20,
  },
  glass:{id:'glass',name:'Glass Cannon',tagline:'A lethal strike in a fragile body',pros:'+42% bite damage, +8% movement speed',cons:'-30% maximum HP',icon:'claw',damageMultiplier:1.42,speedBonus:1.08,hpMultiplier:.70},
  sprinter:{id:'sprinter',name:'Fleetfoot',tagline:'Survive by outrunning the jaws',pros:'+28% speed, +35% stamina recovery',cons:'-22% maximum HP, -10% bite damage',icon:'bolt',damageMultiplier:.90,speedBonus:1.28,hpMultiplier:.78,staminaRecovery:1.35,staminaCost:.78},
  burst:{id:'burst',name:'Burst Hunter',tagline:'Commit, devastate, disengage',pros:'+40% species-ability damage, +12% bite damage',cons:'Species ability recharges 25% slower; -8% HP',icon:'flame',damageMultiplier:1.12,speedBonus:1.06,hpMultiplier:.92,abilityPower:1.40,abilityInterval:1.25},
  colossus:{id:'colossus',name:'Enduring Colossus',tagline:'An immovable wall of muscle',pros:'+48% maximum HP, +12% armor',cons:'-22% movement speed, -20% bite damage',icon:'shield',damageMultiplier:.80,speedBonus:.78,hpMultiplier:1.48,armorBonus:.12},
};

export function archetypeForSpecies(s) {
  if (!s) return EVOLUTION_ARCHETYPES.ambush;
  if(s.body==='serpent'||s.abilityType==='venom')return EVOLUTION_ARCHETYPES.venom;
  if(/phoenix|carcharodontosaurus|hatzegopteryx|dilophosaurus|archaeopteryx/.test(s.id))return EVOLUTION_ARCHETYPES.glass;
  if(/ornithomimus|gallimimus|dryosaurus|lesothosaurus|hypsilophodon|mononykus|leaellynasaura/.test(s.id))return EVOLUTION_ARCHETYPES.sprinter;
  if(/carnotaurus|baryonyx|acrocanthosaurus|wyvern|gryphon|thunder-drake/.test(s.id))return EVOLUTION_ARCHETYPES.burst;
  if(s.body==='longneck')return EVOLUTION_ARCHETYPES.colossus;
  if(/ankylosaurus|euoplocephalus|minmi|triceratops|styracosaurus|pachyrhinosaurus|behemoth/.test(s.id))return EVOLUTION_ARCHETYPES.titan;
  if ((s.tier >= 4 && ["rex", "dragon", "longneck"].includes(s.body)) || s.tier >= 5) return EVOLUTION_ARCHETYPES.apex;
  if (["quad", "croc"].includes(s.body) || /ankylo|stego|tricer/.test(s.id)) return EVOLUTION_ARCHETYPES.titan;
  if (s.temperament === "pack" || /raptor|compsognathus/.test(s.id)) return EVOLUTION_ARCHETYPES.pack;
  if (["venom", "flame", "frost"].includes(s.abilityType) || s.body === "serpent") return EVOLUTION_ARCHETYPES.venom;
  return EVOLUTION_ARCHETYPES.ambush;
}

export function creatureKit(s, mutations = {}) {
  const baseSpecial = {
    raptor: "rending",
    rex: "rage",
    quad: "bulwark",
    longneck: "renewal",
    dragon: "bolt",
    serpent: "shed",
    croc: "deathroll",
    marine: "deathroll",
    gryphon: "rending",
    equine: "renewal",
    bird: s.tier >= 6 ? "bolt" : "rending",
  }[s.body];
  const identity = [...s.id].reduce((n, c) => n + c.charCodeAt(0), 0);
  const count = s.tier === 0 ? 0
    : s.tier === 1 ? (identity % 4 === 0 ? 0 : 1)
      : s.tier === 2 ? 1
        : s.tier === 3 ? (identity % 3 === 0 ? 1 : 2)
          : s.tier === 4 ? (identity % 3 === 0 ? 3 : 2)
            : 3;
  const ability = count >= 1 ? s.abilityType : null,
    technique = count >= 2 ? s.technique : null;
  // Ultimate attacks are rare & harder to get: unlocked by Tier 4+ heavyweight/apex dinosaurs or rare/legendary mutations
  const hasUltimateMutation = (mutations.titansWrath || 0) > 0 || (mutations.astralBehemoth || 0) > 0;
  const ultimateUnlocked = (count >= 3 && s.tier >= 4) || (s.tier>=3 && hasUltimateMutation);
  const specialKey = (mutations.astralBehemoth || 0) > 0 ? "bolt" : baseSpecial;
  const extra = ultimateUnlocked ? specialKey : null;
  return {
    dash:
      ["raptor", "bird", "equine", "gryphon", "dragon"].includes(s.body) ||
      (s.body === "rex" && s.size < 2),
    ability,
    technique,
    special: extra || null,
    abilityCount: Number(!!ability) + Number(!!technique) + Number(!!extra),
    archetype: archetypeForSpecies(s),
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
  const genetic = phenotype(e.genome);
  const maturity = Math.min(1, (e.age || 0) / Math.max(1, e.maturitySeconds || 100));
  e.nutrients = (e.nutrients || 0) + Math.max(0, food.value || 0);
  e.growth = growthFromFood(e.nutrients, s.tier);
  const ratio = e.hp / Math.max(1, e.maxHp);
  e.adultMaxHp = e.baseMaxHp * (1 + e.growth * 0.4);
  e.maxHp =
    e.adultMaxHp * (e.juvenile ? 0.45 + 0.55 * maturity : 1);
  e.hp = Math.min(e.maxHp, e.maxHp * ratio + e.maxHp * 0.06);
  e.damage = s.damage * (1 + e.growth * 0.32);
  e.scaleFactor =
    (e.juvenile ? 0.42 + 0.58 * maturity : 1) *
    (1 + e.growth * 0.28) * genetic.size;
  e.hunger = Math.min(100, (e.hunger || 0) + 35);
  e.wildMeals = (e.wildMeals || 0) + 1;
  if (!e.boss && !e.juvenile && e.wildMeals >= 5 && e.growth >= 0.5 && s.tier < 7) {
    const pool = SPECIES.filter(next => next.tier === s.tier + 1 && !next.bloodline && next.diet === s.diet && (next.body === 'marine') === (s.body === 'marine'));
    if (pool.length) {
      const next = pool[Math.floor(game.random() * pool.length)];
      const ratio = e.hp / e.maxHp;
      e.speciesId = next.id; e.name = next.name;
      e.baseMaxHp = next.hp; e.adultMaxHp = next.hp; e.maxHp = next.hp;
      e.hp = Math.max(1, e.maxHp * ratio); e.damage = next.damage; e.speed = next.speed;
      e.nutrients = 0; e.growth = 0; e.scaleFactor = genetic.size; e.wildMeals = 0;
      e.wildEvolutions = (e.wildEvolutions || 0) + 1;
      game.emit('wild-evolution', {x:e.x,y:e.y,speciesId:next.id,text:next.name + ' evolved in the wild'});
    }
  }
}
