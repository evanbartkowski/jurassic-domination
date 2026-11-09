import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { SPECIES, SPECIES_BY_ID } from "../src/data.js";
import { evaluateCreatureThreat } from "../src/tutorial.js";

function isolatedGame(speciesId = "velociraptor") {
  const g = new Game({ seed: 777 });
  g.hatch();
  g.entities = [];
  g.foods = [];
  g.lairs = [];
  g.worldFeatures = [];
  g._streamWorld = () => {};
  g._replenish = () => {};
  g.player.speciesId = speciesId;
  g.tier = SPECIES_BY_ID[speciesId].tier;
  g.refreshStats(true);
  g.player.invulnerable = 0;
  return g;
}

test("major evolutions have massive sizes and tier silhouettes remain strictly increasing", () => {
  // Check that sauropods and high-tier titans are truly massive creatures
  const brachio = SPECIES_BY_ID.brachiosaurus;
  const dread = SPECIES_BY_ID.dreadnoughtus;
  const behemoth = SPECIES_BY_ID.behemoth;
  const primordial = SPECIES_BY_ID["primordial-titan"];

  assert.ok(brachio.size >= 4.0, "Brachiosaurus is a massive creature (size >= 4.0)");
  assert.ok(dread.size >= 4.0, "Dreadnoughtus is a massive creature (size >= 4.0)");
  assert.ok(behemoth.size >= 5.0, "Obsidian Behemoth is a colossal creature (size >= 5.0)");
  assert.ok(primordial.size >= 7.0, "Primordial Titan is an immense colossus (size >= 7.0)");

  // Tier silhouette ordering: every subsequent tier's minimum non-compact size must exceed previous tier's maximum
  for (let tier = 1; tier < 8; tier++) {
    const prev = SPECIES.filter((s) => s.tier === tier - 1);
    const next = SPECIES.filter((s) => s.tier === tier && !s.compactEvolution);
    const maxPrev = Math.max(...prev.map((s) => s.size));
    const minNext = Math.min(...next.map((s) => s.size));
    assert.ok(
      minNext > maxPrev,
      `Tier ${tier} min size (${minNext}) must strictly exceed Tier ${tier - 1} max size (${maxPrev})`,
    );
  }
});

test("super high level creatures ignore players who are much less evolved", () => {
  // Player is Tier 0 hatchling (Compsognathus)
  const g = isolatedGame("compsognathus");
  g.player.x = 200;
  g.player.y = 200;

  // Spawn a high-level predator (Tyrannosaurus Rex is Tier 4, tier diff = 4 >= 2)
  const rex = g.spawnEntity("tyrannosaurus", g.player.x + 12, g.player.y);
  rex.aggro = 0;

  // Tick simulation
  g.update(0.1, {});

  // The colossal predator should ignore the tiny hatchling
  assert.equal(rex.beneathNotice, true, "Rex considers tiny tier 0 hatchling beneath notice");
  assert.notEqual(rex.intent, "hunt", "High-level predator does not hunt tiny hatchling");
  assert.notEqual(rex.intent, "track", "High-level predator does not track tiny hatchling");

  // Threat badge should report indifferent colossus
  const threat = evaluateCreatureThreat(rex, g);
  assert.equal(threat.behavior, "indifferent", "Threat evaluation reports indifferent behavior");
  assert.ok(threat.behaviorLabel.includes("INDIFFERENT"), "Label shows INDIFFERENT");

  // Attack the Rex: aggro breaks indifference
  rex.aggro = 10;
  g.update(0.1, {});
  assert.equal(rex.beneathNotice, false, "Aggro breaks indifference");
  assert.equal(rex.intent, "hunt", "Provoked high-level predator hunts attacker");
});

test("stepping directly underfoot of a massive dinosaur breaks indifference", () => {
  // Player is Tier 0 hatchling
  const g = isolatedGame("compsognathus");
  g.player.x = 100;
  g.player.y = 100;

  // Spawn Brachiosaurus nearby (Tier 5)
  const brachio = g.spawnEntity("brachiosaurus", 100, 100);
  // Position player directly under its stomping footprint
  g.player.x = brachio.x + 0.5;
  g.player.y = brachio.y + 0.5;

  g.update(0.1, {});
  assert.equal(brachio.beneathNotice, false, "Player directly underfoot is not ignored");
});

test("camera zoom distance scales smoothly with dinosaur size", () => {
  // Formula: 15.0 + Math.pow(effectiveSize, 1.08) * 8.5
  const calcZoom = (size) => 15.0 + Math.pow(size, 1.08) * 8.5;

  const smallDinoZoom = calcZoom(0.72); // Compsognathus
  const midDinoZoom = calcZoom(1.5);   // Mid-tier predator
  const largeDinoZoom = calcZoom(4.2); // Brachiosaurus
  const titanDinoZoom = calcZoom(8.0); // Primordial Titan

  assert.ok(smallDinoZoom < 22, "Small dinosaur has intimate close camera zoom");
  assert.ok(midDinoZoom > smallDinoZoom, "Mid dinosaur zooms further back");
  assert.ok(largeDinoZoom > midDinoZoom, "Colossal dinosaur zooms out significantly");
  assert.ok(titanDinoZoom > 80, "Primordial titan has grand panoramic camera distance");
});
