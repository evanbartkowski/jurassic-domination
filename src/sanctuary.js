export const ISLAND_TRIALS = [
  {
    id: "haven",
    name: "A Living Haven",
    seconds: 180,
    pets: 3,
    decorations: 8,
    care: 9,
    rare: true,
    rewards: ["cosmetic:royal-crown", "decoration:fountain"],
  },
  {
    id: "keeper",
    name: "Keeper of Legends",
    seconds: 900,
    pets: 6,
    decorations: 20,
    care: 30,
    rare: true,
    rewards: ["cosmetic:astral-crown", "decoration:obelisk"],
  },
  {
    id: "botanical-garden",
    name: "Primeval Flora",
    seconds: 360,
    pets: 4,
    decorations: 15,
    care: 15,
    rare: false,
    rewards: ["cosmetic:leaf-wreath", "decoration:pavilion"],
  },
  {
    id: "apex-sanctuary",
    name: "Sanctuary of the Apex",
    seconds: 1200,
    pets: 10,
    decorations: 35,
    care: 50,
    rare: true,
    rewards: ["cosmetic:solar-halo", "decoration:volcano"],
  },
];

export const COMPANION_SYNERGIES = {
  compy: { role: "prowler", name: "Prowler Sense", desc: "+8% movement speed; highlights scent trails and nearby carnivores." },
  feather: { role: "prowler", name: "Prowler Sense", desc: "+8% movement speed; highlights scent trails and nearby carnivores." },
  raptor: { role: "prowler", name: "Prowler Sense", desc: "+12% movement speed; highlights scent trails and critical flank opportunities." },
  pebble: { role: "forager", name: "Forager Instinct", desc: "+15% nutrition from plants; reveals hidden edible flora." },
  sprout: { role: "forager", name: "Forager Instinct", desc: "+20% nutrition from plants; reveals hidden edible flora." },
  stride: { role: "forager", name: "Forager Instinct", desc: "+25% nutrition from plants; detects rare Sunheart & Moondrop fruits." },
  crest: { role: "tracker", name: "Tracker Instinct", desc: "Senses wounded prey and blood trails from 60 units away." },
  dome: { role: "bulwark", name: "Bulwark Guard", desc: "+10% armor defense; absorbs 25% of knockback taken." },
  spike: { role: "bulwark", name: "Bulwark Guard", desc: "+12% armor defense; reflects 10% damage to melee attackers." },
  club: { role: "bulwark", name: "Bulwark Guard", desc: "+15% armor defense; reduces heavy knockback by 50%." },
  frill: { role: "bulwark", name: "Bulwark Guard", desc: "+15% armor defense; grants frontal shield against lunges." },
  titan: { role: "titan", name: "Titan's Grace", desc: "+20% maximum HP; provides passive vitality regeneration." },
  sail: { role: "aquatic", name: "Aquatic Instinct", desc: "Eliminates deep-water movement penalties; detects marine predators." },
  serpent: { role: "aquatic", name: "Abyssal Affinity", desc: "Rapid swimming speed; attacks inflict corrosive venom." },
  ember: { role: "cinder", name: "Cinder Ward", desc: "Immunity to environmental scorching; bite attacks inflict burn." },
  phoenix: { role: "cinder", name: "Solar Ward", desc: "Immunity to heat; heals 15% HP upon reaching critical health (once per life)." },
  rex: { role: "apex", name: "Majestic Aura", desc: "Frightens smaller predators away; +20% primal roar radius." },
  unicorn: { role: "celestial", name: "Starlight Veil", desc: "+20% stamina recovery; cleanses poison & frost when resting." },
};
export function sanctuaryProgress(p, trial) {
  const placed = p.island.placements,
    petIds = placed.filter((a) => a.kind === "pet").map((a) => a.itemId);
  return {
    seconds: p.island.visitSeconds || 0,
    pets: petIds.length,
    decorations: placed.filter((a) => a.kind === "decoration").length,
    care: Object.values(p.island.care || {}).reduce((a, b) => a + b, 0),
    rare: petIds.some((id) =>
      [
        "raptor",
        "frill",
        "club",
        "sail",
        "rex",
        "titan",
        "ember",
        "unicorn",
        "serpent",
        "phoenix",
      ].includes(id),
    ),
  };
}
export function careForPet(p, placementId) {
  const pet = p.island.placements.find(
    (a) => a.id === placementId && a.kind === "pet",
  );
  if (!pet) return { ok: false, reason: "Choose a pet living on your island." };
  const now = p.island.visitSeconds || 0;
  p.island.lastCare ||= {};
  p.island.care ||= {};
  if (now - (p.island.lastCare[pet.itemId] ?? -60) < 60)
    return {
      ok: false,
      reason:
        "Your companion is content. Return after a minute of island time.",
    };
  p.island.lastCare[pet.itemId] = now;
  p.island.care[pet.itemId] = Math.min(
    100,
    (p.island.care[pet.itemId] || 0) + 1,
  );
  return { ok: true };
}
