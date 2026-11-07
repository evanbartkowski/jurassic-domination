import test from "node:test";
import assert from "node:assert/strict";
import { newProfile, normalizeProfile, recordRun } from "../src/profile.js";
import { SHOP_ITEMS, PETS, DECORATIONS } from "../src/collection-data.js";
import {
  purchaseItem,
  awardRareDNA,
  grantFind,
  checkAchievements,
  placeIslandItem,
  moveIslandItem,
  storeIslandItem,
  availableCount,
  equipPet,
  equipCosmetic,
} from "../src/collections.js";
test("all 49 catalog items have unique valid prices and can be purchased", () => {
  const p = newProfile();
  p.dna = 10000;
  assert.equal(SHOP_ITEMS.length, 49);
  assert.equal(new Set(SHOP_ITEMS.map((i) => i.sku)).size, 49);
  for (const item of SHOP_ITEMS) {
    const before = p.dna;
    assert.ok(purchaseItem(p, item.sku).ok, item.sku);
    assert.equal(p.dna, before - item.price);
  }
  assert.equal(p.pets.length, 18);
  assert.equal(Object.keys(p.decorations).length, 17);
});
test("purchases reject insufficient DNA, forged ids and duplicate pets without charging", () => {
  const p = newProfile();
  assert.equal(purchaseItem(p, "pet:compy").ok, false);
  p.dna = 100;
  assert.ok(purchaseItem(p, "pet:compy").ok);
  const balance = p.dna;
  for (const sku of ["pet:compy", "__proto__", "constructor", "pet:fake"])
    assert.equal(purchaseItem(p, sku).ok, false);
  assert.equal(p.dna, balance);
  assert.ok(equipPet(p, "compy"));
  assert.equal(equipPet(p, "rex"), false);
  assert.equal(equipCosmetic(p, "royal-crown"), false);
});
test("rare DNA and item receipts are banked only once including after save reload", () => {
  let p = newProfile();
  assert.ok(awardRareDNA(p, "rare-1", 3));
  assert.equal(awardRareDNA(p, "rare-1", 3), false);
  assert.equal(awardRareDNA(p, "invalid", 100), false);
  assert.equal(p.dna, 3);
  assert.ok(grantFind(p, "pet:compy", "egg-1").ok);
  p = normalizeProfile(JSON.parse(JSON.stringify(p)));
  assert.equal(grantFind(p, "pet:compy", "egg-1").ok, false);
  assert.equal(p.pets.length, 1);
  assert.equal(grantFind(p, "pet:compy", "egg-2").dna, 1);
  assert.equal(p.dna, 4);
});
test("ordinary death gives no DNA and selected milestones award only once", () => {
  const p = newProfile();
  const run = {
    dna: 999,
    score: 0,
    kills: 0,
    tier: 0,
    time: 1,
    speciesId: "compy",
  };
  recordRun(p, run);
  assert.equal(p.dna, 0);
  p.highestTier = 1;
  checkAchievements(p);
  const balance = p.dna;
  assert.ok(balance > 0);
  checkAchievements(p);
  recordRun(p, run);
  assert.equal(p.dna, balance);
});
test("v2 saves preserve currency, progression and claimed milestones", () => {
  const p = normalizeProfile({
    version: 2,
    dna: 37,
    upgrades: { vitality: 2 },
    highestTier: 1,
    achievements: ["first-evolution"],
    skins: ["natural", "obsidian"],
  });
  checkAchievements(p);
  assert.equal(p.dna, 37);
  assert.equal(p.upgrades.vitality, 2);
  assert.ok(p.claimedAchievements.includes("first-evolution"));
  assert.equal(p.version, 3);
});
test("island validates owned copies, collisions, finite coordinates and shores", () => {
  const p = newProfile();
  p.dna = 100;
  purchaseItem(p, "pet:compy");
  purchaseItem(p, "decoration:fern");
  purchaseItem(p, "decoration:fern");
  const pet = placeIslandItem(p, "pet", "compy", 0, 0);
  assert.ok(pet.ok);
  assert.equal(availableCount(p, "pet", "compy"), 0);
  assert.equal(placeIslandItem(p, "pet", "compy", 10, 0).ok, false);
  for (const [x, y] of [
    [0, 0],
    [NaN, 0],
    [Infinity, 0],
    [33, 0],
  ])
    assert.equal(placeIslandItem(p, "decoration", "fern", x, y).ok, false);
  assert.ok(placeIslandItem(p, "decoration", "fern", 8, 0).ok);
  assert.equal(availableCount(p, "decoration", "fern"), 1);
  assert.ok(moveIslandItem(p, pet.placement.id, 0, 8, Math.PI).ok);
  assert.equal(moveIslandItem(p, pet.placement.id, 8, 0).ok, false);
  assert.ok(storeIslandItem(p, pet.placement.id));
  assert.equal(availableCount(p, "pet", "compy"), 1);
  assert.ok(p.pets.includes("compy"));
});
test("island save migration removes invalid placements without losing owned inventory", () => {
  const p = newProfile();
  p.pets = ["compy"];
  p.decorations.fern = 2;
  placeIslandItem(p, "pet", "compy", 0, 0);
  placeIslandItem(p, "decoration", "fern", 8, 0);
  p.island.placements.push(
    { id: "i99", kind: "pet", itemId: "rex", x: 5, y: 10, rotation: 0 },
    {
      id: "i100",
      kind: "decoration",
      itemId: "fern",
      x: Infinity,
      y: 0,
      rotation: 0,
    },
  );
  const restored = normalizeProfile(p);
  assert.equal(restored.island.placements.length, 2);
  assert.equal(restored.decorations.fern, 2);
  assert.ok(restored.island.nextId > 2);
});
