import {
  CATALOG,
  PETS,
  COSMETICS,
  DECORATIONS,
  ACHIEVEMENTS,
} from "./collection-data.js";
const integer = (n, max = 1e9) =>
  Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
const unique = (raw, valid) => [
  ...new Set((Array.isArray(raw) ? raw : []).filter(valid)),
];
export const ISLAND_RADIUS = 32;
export function ownedCount(p, sku) {
  const item = CATALOG[sku];
  if (!item) return 0;
  return item.kind === "skin"
    ? Number(p.skins.includes(item.id))
    : item.kind === "cosmetic"
      ? Number(p.cosmetics.includes(item.id))
      : item.kind === "pet"
        ? Number(p.pets.includes(item.id))
        : p.decorations[item.id] || 0;
}
export function availableCount(p, kind, id) {
  const owned =
    kind === "pet" ? Number(p.pets.includes(id)) : p.decorations[id] || 0;
  return Math.max(
    0,
    owned -
      p.island.placements.filter((a) => a.kind === kind && a.itemId === id)
        .length,
  );
}
export function normalizeCollection(raw = {}) {
  const p = {
    cosmetics: [
      "none",
      ...unique(raw.cosmetics, (id) => COSMETICS.some((c) => c.id === id)),
    ],
    equippedCosmetic: "none",
    pets: unique(raw.pets, (id) => PETS.some((p) => p.id === id)),
    activePet: null,
    decorations: {},
    claimedAchievements: unique(
      Number(raw.version) >= 3 ? raw.claimedAchievements : raw.achievements,
      (id) => ACHIEVEMENTS.some((a) => a.id === id),
    ),
    claimedFinds: unique(
      raw.claimedFinds,
      (id) => typeof id === "string" && id.length <= 160,
    ).slice(-2048),
    bossKills: integer(raw.bossKills),
    dnaFinds: integer(raw.dnaFinds),
    island: {
      name: "My Dinosaur Sanctuary",
      placements: [],
      nextId: 1,
      grid: true,
      visitSeconds: integer(raw.island?.visitSeconds),
      care: {},
      lastCare: {},
      trials: unique(raw.island?.trials, (id) =>
        ["haven", "keeper"].includes(id),
      ),
    },
  };
  for (const pet of PETS) {
    p.island.care[pet.id] = integer(raw.island?.care?.[pet.id], 100);
    if (Number.isFinite(raw.island?.lastCare?.[pet.id]))
      p.island.lastCare[pet.id] = Math.min(
        p.island.visitSeconds,
        integer(raw.island.lastCare[pet.id]),
      );
  }
  if (p.cosmetics.includes(raw.equippedCosmetic))
    p.equippedCosmetic = raw.equippedCosmetic;
  if (p.pets.includes(raw.activePet)) p.activePet = raw.activePet;
  for (const item of DECORATIONS) {
    const amount = integer(raw.decorations?.[item.id], 99);
    if (amount) p.decorations[item.id] = amount;
  }
  if (typeof raw.island?.name === "string" && raw.island.name.trim())
    p.island.name = raw.island.name.trim().slice(0, 36);
  if (typeof raw.island?.grid === "boolean") p.island.grid = raw.island.grid;
  const ids = new Set();
  for (const a of (Array.isArray(raw.island?.placements)
    ? raw.island.placements
    : []
  ).slice(0, 96)) {
    if (
      !a ||
      typeof a.id !== "string" ||
      !/^i\d+$/.test(a.id) ||
      ids.has(a.id) ||
      !Number.isFinite(a.x) ||
      !Number.isFinite(a.y) ||
      !Number.isFinite(a.rotation)
    )
      continue;
    if (!placementValid(p, a.kind, a.itemId, a.x, a.y).ok) continue;
    p.island.placements.push({
      id: a.id,
      kind: a.kind,
      itemId: a.itemId,
      x: a.x,
      y: a.y,
      rotation: normalizeRotation(a.rotation),
    });
    ids.add(a.id);
  }
  p.island.nextId = Math.max(
    1,
    integer(raw.island?.nextId),
    ...p.island.placements.map((a) => Number(a.id.slice(1)) + 1),
  );
  return p;
}
export function purchaseItem(p, sku) {
  const item = CATALOG[sku];
  if (!item) return { ok: false, reason: "Unknown item." };
  if (item.kind !== "decoration" && ownedCount(p, sku))
    return { ok: false, reason: "Already owned." };
  if (item.kind === "decoration" && ownedCount(p, sku) >= 99)
    return { ok: false, reason: "Inventory is full for this decoration." };
  if (p.dna < item.price)
    return {
      ok: false,
      reason: "Find rare DNA or earn achievement rewards first.",
    };
  p.dna -= item.price;
  addItem(p, item);
  return { ok: true, item };
}
function addItem(p, item) {
  if (item.kind === "skin") p.skins.push(item.id);
  else if (item.kind === "cosmetic") p.cosmetics.push(item.id);
  else if (item.kind === "pet") p.pets.push(item.id);
  else p.decorations[item.id] = (p.decorations[item.id] || 0) + 1;
}
function claim(p, receipt) {
  if (
    typeof receipt !== "string" ||
    !receipt ||
    receipt.length > 160 ||
    p.claimedFinds.includes(receipt) ||
    p.activeFindClaims?.includes(receipt)
  )
    return false;
  p.claimedFinds.push(receipt);
  p.claimedFinds = p.claimedFinds.slice(-2048);
  p.activeFindClaims ||= [];
  p.activeFindClaims.push(receipt);
  return true;
}
export function awardRareDNA(p, receipt, amount) {
  if (
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > 5 ||
    !claim(p, receipt)
  )
    return false;
  p.dna += amount;
  p.dnaFinds++;
  return true;
}
export function recordGuardianKill(p, receipt) {
  if (!claim(p, receipt)) return false;
  p.bossKills++;
  return true;
}
export function grantFind(p, sku, receipt) {
  const item = CATALOG[sku];
  if (!item || !claim(p, receipt))
    return { ok: false, reason: "This find was already collected." };
  if (
    (item.kind !== "decoration" && ownedCount(p, sku)) ||
    ownedCount(p, sku) >= 99
  ) {
    p.dna++;
    p.dnaFinds++;
    return { ok: true, duplicate: true, dna: 1, item };
  }
  addItem(p, item);
  return { ok: true, item, dna: 0 };
}
export function checkAchievements(p, progress = {}) {
  const awarded = [];
  for (const a of ACHIEVEMENTS)
    if (a.condition(p, progress) && !p.achievements.includes(a.id)) {
      p.achievements.push(a.id);
      const reward = p.claimedAchievements.includes(a.id) ? 0 : a.reward;
      if (!p.claimedAchievements.includes(a.id))
        p.claimedAchievements.push(a.id);
      p.dna += reward;
      awarded.push({ id: a.id, name: a.name, reward });
    }
  return awarded;
}
export function equipCosmetic(p, id) {
  if (!p.cosmetics.includes(id)) return false;
  p.equippedCosmetic = id;
  return true;
}
export function equipPet(p, id) {
  if (id !== null && !p.pets.includes(id)) return false;
  p.activePet = id;
  return true;
}
function normalizeRotation(value) {
  return ((value % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
}
export function placementValid(p, kind, id, x, y, ignoreId = null) {
  const item = CATALOG[`${kind}:${id}`];
  if (!item || !["pet", "decoration"].includes(kind))
    return { ok: false, reason: "Select an owned pet or decoration." };
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    Math.hypot(x, y) > ISLAND_RADIUS - (item.footprint || 1)
  )
    return {
      ok: false,
      reason: "Place items on the grassy island, away from the shoreline.",
    };
  const existing = p.island.placements.find((a) => a.id === ignoreId);
  if (!existing && availableCount(p, kind, id) <= 0)
    return {
      ok: false,
      reason: "No unplaced copies remain in your inventory.",
    };
  if (
    !existing &&
    p.island.placements.filter((a) => a.kind === kind).length >=
      (kind === "pet" ? 16 : 80)
  )
    return {
      ok: false,
      reason:
        kind === "pet"
          ? "Your island can host sixteen pets at once."
          : "Your island can hold eighty decorations.",
    };
  for (const a of p.island.placements) {
    if (a.id === ignoreId) continue;
    const other = CATALOG[`${a.kind}:${a.itemId}`],
      separation = ((item.footprint || 1) + (other?.footprint || 1)) * 0.65;
    if (Math.hypot(a.x - x, a.y - y) < separation)
      return {
        ok: false,
        reason: "Leave a little more room around this placement.",
      };
  }
  return { ok: true };
}
export function placeIslandItem(p, kind, id, x, y, rotation = 0) {
  if (!Number.isFinite(rotation))
    return { ok: false, reason: "Invalid rotation." };
  const result = placementValid(p, kind, id, x, y);
  if (!result.ok) return result;
  const placement = {
    id: `i${p.island.nextId++}`,
    kind,
    itemId: id,
    x,
    y,
    rotation: normalizeRotation(rotation),
  };
  p.island.placements.push(placement);
  return { ok: true, placement };
}
export function moveIslandItem(p, id, x, y, rotation) {
  const item = p.island.placements.find((a) => a.id === id);
  if (!item) return { ok: false, reason: "Select an island item first." };
  const result = placementValid(p, item.kind, item.itemId, x, y, id);
  if (!result.ok || !Number.isFinite(rotation ?? item.rotation))
    return { ok: false, reason: result.reason || "Invalid rotation." };
  Object.assign(item, {
    x,
    y,
    rotation: normalizeRotation(rotation ?? item.rotation),
  });
  return { ok: true, placement: item };
}
export function storeIslandItem(p, id) {
  const index = p.island.placements.findIndex((a) => a.id === id);
  if (index < 0) return false;
  p.island.placements.splice(index, 1);
  return true;
}
export function renameIsland(p, name) {
  if (typeof name !== "string" || !name.trim()) return false;
  p.island.name = name.trim().slice(0, 36);
  return true;
}
