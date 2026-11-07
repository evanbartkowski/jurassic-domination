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
];
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
