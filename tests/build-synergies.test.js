import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { SPECIES_BY_ID } from "../src/data.js";
import {
  BUILD_CATEGORIES,
  createBuildState,
  calculateBuildPower,
  canEquipOrUpgrade,
  applyBuildMutation,
  checkNewSynergies,
} from "../src/build-system.js";
import { snapshotGame, restoreGame } from "../src/run-state.js";
import { evaluateCreatureThreat } from "../src/tutorial.js";
import { computeUpgradeDiff, renderRankBadgeHTML } from "../src/ui.js";

function isolated(speciesId = "velociraptor") {
  const g = new Game({ seed: 42 });
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

test("build system category slot constraints strictly limit equipped mutations", () => {
  const build = createBuildState();

  // Test offensive slots (max 4)
  assert.equal(BUILD_CATEGORIES.offensive.maxEquipped, 4);
  assert.ok(applyBuildMutation(build, "serratedFangs").ok);
  assert.ok(applyBuildMutation(build, "bleedingClaws").ok);
  assert.ok(applyBuildMutation(build, "frostBite").ok);
  assert.ok(applyBuildMutation(build, "venomSpit").ok);
  assert.equal(Object.keys(build.offensive).length, 4);

  // 5th offensive mutation must be rejected
  assert.equal(canEquipOrUpgrade(build, "spikedTail"), false);
  assert.equal(applyBuildMutation(build, "spikedTail").ok, false);
  assert.equal(Object.keys(build.offensive).length, 4);

  // But existing offensive mutation can be upgraded
  assert.equal(canEquipOrUpgrade(build, "serratedFangs"), true);
  assert.ok(applyBuildMutation(build, "serratedFangs").ok);
  assert.equal(build.offensive.serratedFangs, 2);

  // Test defensive slots (max 4)
  assert.equal(BUILD_CATEGORIES.defensive.maxEquipped, 4);
  assert.ok(applyBuildMutation(build, "thickScales").ok);
  assert.ok(applyBuildMutation(build, "regenerativeTissue").ok);
  assert.ok(applyBuildMutation(build, "reflectiveArmor").ok);
  assert.ok(applyBuildMutation(build, "armoredHide").ok);
  assert.equal(Object.keys(build.defensive).length, 4);
  assert.equal(canEquipOrUpgrade(build, "thorns"), false);
  assert.equal(applyBuildMutation(build, "thorns").ok, false);

  // Test passive slots (max 4)
  assert.equal(BUILD_CATEGORIES.passive.maxEquipped, 4);
  assert.ok(applyBuildMutation(build, "bloodlust").ok);
  assert.ok(applyBuildMutation(build, "rapidMetabolism").ok);
  assert.ok(applyBuildMutation(build, "packInstinct").ok);
  assert.ok(applyBuildMutation(build, "adrenaline").ok);
  assert.equal(Object.keys(build.passive).length, 4);
  assert.equal(canEquipOrUpgrade(build, "apexCrit"), false);
  assert.equal(applyBuildMutation(build, "apexCrit").ok, false);
});

test("mutations level from Lv 1 to Lv 5 with scaling build power and cap at Lv 5", () => {
  const build = createBuildState();
  assert.equal(calculateBuildPower(build), 0);

  // Level serratedFangs from 1 to 5
  for (let lvl = 1; lvl <= 5; lvl++) {
    assert.equal(canEquipOrUpgrade(build, "serratedFangs"), true);
    assert.ok(applyBuildMutation(build, "serratedFangs").ok);
    assert.equal(build.offensive.serratedFangs, lvl);
  }

  // At Lv 5, further upgrades are disallowed
  assert.equal(canEquipOrUpgrade(build, "serratedFangs"), false);
  assert.equal(applyBuildMutation(build, "serratedFangs").ok, false);
  assert.equal(build.offensive.serratedFangs, 5);

  const power = calculateBuildPower(build);
  assert.ok(power > 0, "Build power scales with mutation levels");
});

test("all 7 mutation synergies unlock when their specific prerequisite mutations are satisfied", () => {
  // 1. Hemorrhage: serratedFangs V + bloodlust III
  const b1 = createBuildState();
  b1.offensive.serratedFangs = 5;
  b1.passive.bloodlust = 3;
  const newSyn1 = checkNewSynergies(b1);
  assert.ok(newSyn1.includes("hemorrhage"), "Hemorrhage unlocks with serratedFangs V + bloodlust III");

  // 2. Seismic Slam: spikedTail III + thickScales III
  const b2 = createBuildState();
  b2.offensive.spikedTail = 3;
  b2.defensive.thickScales = 3;
  const newSyn2 = checkNewSynergies(b2);
  assert.ok(newSyn2.includes("seismicSlam"), "Seismic Slam unlocks with spikedTail III + thickScales III");

  // 3. Plague Cloud: venomSpit III + toxicBlood III
  const b3 = createBuildState();
  b3.offensive.venomSpit = 3;
  b3.defensive.toxicBlood = 3;
  const newSyn3 = checkNewSynergies(b3);
  assert.ok(newSyn3.includes("plagueCloud"), "Plague Cloud unlocks with venomSpit III + toxicBlood III");

  // 4. Alpha's Command: packInstinct III
  const b4 = createBuildState();
  b4.passive.packInstinct = 3;
  const newSyn4 = checkNewSynergies(b4);
  assert.ok(newSyn4.includes("alphasCommand"), "Alpha's Command unlocks with packInstinct III");

  // 5. Inferno: fireBreath III + rapidMetabolism III
  const b5 = createBuildState();
  b5.offensive.fireBreath = 3;
  b5.passive.rapidMetabolism = 3;
  const newSyn5 = checkNewSynergies(b5);
  assert.ok(newSyn5.includes("inferno"), "Inferno unlocks with fireBreath III + rapidMetabolism III");

  // 6. Glacial Fortress: frostBite III + armoredHide III
  const b6 = createBuildState();
  b6.offensive.frostBite = 3;
  b6.defensive.armoredHide = 3;
  const newSyn6 = checkNewSynergies(b6);
  assert.ok(newSyn6.includes("glacialFortress"), "Glacial Fortress unlocks with frostBite III + armoredHide III");

  // 7. Juggernaut: chargingHorns III + adrenaline III
  const b7 = createBuildState();
  b7.offensive.chargingHorns = 3;
  b7.passive.adrenaline = 3;
  const newSyn7 = checkNewSynergies(b7);
  assert.ok(newSyn7.includes("juggernaut"), "Juggernaut unlocks with chargingHorns III + adrenaline III");
});

test("Hemorrhage synergy produces AoE explosion on kill and heals player by 10% max HP", () => {
  const g = isolated("velociraptor");
  g.build.activeSynergies.push("hemorrhage");
  g.player.maxHp = 100;
  g.player.hp = 50;

  // Spawn prey and nearby bystander
  const target = g.spawnEntity("compsognathus", g.player.x + 2, g.player.y, { maxHp: 30, hp: 30 });
  const bystander = g.spawnEntity("dryosaurus", g.player.x + 4, g.player.y, { maxHp: 50, hp: 50 });
  target.bleeding = 3;

  // Kill target
  g._hitEntity(target, 100);

  // Target should be dead
  assert.ok(target.hp <= 0, "Target defeated");

  // Player should have healed for 10% max HP (50 + 10 = 60)
  assert.equal(g.player.hp, 60, "Player healed 10% max HP on Hemorrhage trigger");

  // Bystander should have taken Hemorrhage explosion damage
  assert.ok(bystander.hp < 50, "Bystander damaged by Hemorrhage burst");
  assert.ok(bystander.bleeding > 0, "Bystander received bleed effect from Hemorrhage");

  // Synergy-burst event was emitted
  const burstEvent = g.events.find((e) => e.type === "synergy-burst" && e.synergy === "hemorrhage");
  assert.ok(burstEvent, "Hemorrhage synergy-burst event emitted");
});

test("Seismic Slam synergy creates a ground shockwave on dash that stuns and damages nearby enemies", () => {
  const g = isolated("velociraptor");
  g.build.activeSynergies.push("seismicSlam");
  g.player.stamina = 100;
  g.player.dashCooldown = 0;

  const enemy = g.spawnEntity("compsognathus", g.player.x + 4, g.player.y, { maxHp: 100, hp: 100 });
  const initialHp = enemy.hp;

  // Execute dash
  g.dash();

  // Enemy within shockwave radius took damage and was stunned
  assert.ok(enemy.hp < initialHp, "Enemy took seismic slam shockwave damage");
  assert.ok(enemy.stunned > 0, "Enemy stunned by seismic slam shockwave");

  const burstEvent = g.events.find((e) => e.type === "synergy-burst" && e.synergy === "seismicSlam");
  assert.ok(burstEvent, "Seismic slam synergy-burst event emitted");
});

test("Alpha's Command synergy spawns pack companions and grants pack frenzy on roar", () => {
  const g = isolated("velociraptor");
  g.build.activeSynergies.push("alphasCommand");
  g.player.roarCooldown = 0;

  const countBefore = g.entities.length;
  g.roar();

  // Should have summoned pack hunting companions
  assert.ok(g.entities.length > countBefore, "Pack hunting companions summoned on roar");
  const companion = g.entities.find((e) => e.isCompanion);
  assert.ok(companion, "Friendly pack companion spawned");
  assert.ok(companion.frenzy > 0, "Packmate unleashed in frenzy");

  const burstEvent = g.events.find((e) => e.type === "synergy-burst" && e.synergy === "alphasCommand");
  assert.ok(burstEvent, "Alpha's Command synergy-burst event emitted");
});

test("protective barrier adaptation absorbs incoming damage before health depletion", () => {
  const g = isolated("velociraptor");
  g.build.defensive.protectiveBarrier = 3;
  g.player.hp = 100;
  g.player.maxHp = 100;
  g.build.barrierHp = 60; // 60 barrier points
  g.build.barrierMax = 60;

  // Take 40 damage
  g.damagePlayer(40, "predator strike");

  // Barrier absorbed all 40 damage, player HP remains at 100
  assert.equal(g.player.hp, 100, "HP protected by barrier");
  assert.ok(Math.abs(g.build.barrierHp - 20) < 0.5, "Barrier absorbed damage (approx 20 remaining)");
});

test("encounter escalation spawns elite mutated predators with proper threat classification", () => {
  const g = isolated("velociraptor");

  // Test direct elite predator spawn
  const elitePredator = g.spawnEntity("ceratosaurus", g.player.x + 20, g.player.y + 20, {
    eliteMutation: "Blazing",
  });
  assert.equal(elitePredator.eliteMutation, "Blazing");

  // Threat evaluation gives elite threat badges
  const threat = evaluateCreatureThreat(elitePredator, g);
  assert.ok(threat.badgeClass.includes("elite-blazing"), `Threat badge includes elite class: ${threat.badgeClass}`);
  assert.ok(threat.threatLabel.includes("BLAZING ELITE"), `Threat label announces elite: ${threat.threatLabel}`);
  assert.equal(threat.symbol, "🔥");

  // Build power scaling works correctly
  g.build.offensive.fireBreath = 5;
  g.build.offensive.thunderJaws = 5;
  g.build.defensive.thickScales = 5;
  assert.ok(g.buildPower >= 150, "Build power reaches high echelon");
});

test("snapshotGame and restoreGame preserve 4-category build state, slot levels, and active synergies", () => {
  const g = isolated("velociraptor");
  g.build.offensive.serratedFangs = 4;
  g.build.offensive.bleedingClaws = 2;
  g.build.defensive.thickScales = 3;
  g.build.passive.bloodlust = 5;
  g.build.activeSynergies.push("hemorrhage");

  const initialPower = g.buildPower;
  assert.ok(initialPower > 0);

  // Snapshot
  const snap = snapshotGame(g);
  assert.ok(snap.game.build, "Snapshot includes build object");
  assert.equal(snap.game.build.offensive.serratedFangs, 4);
  assert.equal(snap.game.build.passive.bloodlust, 5);
  assert.ok(snap.game.build.activeSynergies.includes("hemorrhage"));

  // Restore
  const restored = restoreGame(snap);
  assert.ok(restored.build, "Restored game has build object");
  assert.equal(restored.build.offensive.serratedFangs, 4);
  assert.equal(restored.build.offensive.bleedingClaws, 2);
  assert.equal(restored.build.defensive.thickScales, 3);
  assert.equal(restored.build.passive.bloodlust, 5);
  assert.ok(restored.build.activeSynergies.includes("hemorrhage"));
  assert.equal(restored.buildPower, initialPower, "Build power perfectly preserved across restore");
});

test("card system computes accurate upgrade diffs, stat delta badges, and rank indicators", () => {
  // Test brand new mutation (currentLvl = 0, nextLvl = 1)
  const newDiffs = computeUpgradeDiff({ id: "serratedFangs" }, 0, 1);
  assert.ok(Array.isArray(newDiffs));
  assert.ok(newDiffs.length > 0);
  assert.ok(newDiffs.some((d) => d.tag && d.tag.includes("Bleed")), "New bleed tag generated for serrated fangs");

  const newVenom = computeUpgradeDiff({ id: "venomSpit" }, 0, 1);
  assert.ok(newVenom.some((d) => d.tag && d.tag.includes("35 Damage")), "New base damage tag generated for venom spit");

  // Test upgrading mutation from Rank 1 to Rank 2
  const upgradeDiffs = computeUpgradeDiff({ id: "serratedFangs" }, 1, 2);
  assert.ok(upgradeDiffs.length > 0);
  const bleedDelta = upgradeDiffs.find((d) => d.label === "Bleed Dmg");
  assert.ok(bleedDelta, "Bleed Dmg stat delta is calculated");
  assert.equal(bleedDelta.from, "15%");
  assert.equal(bleedDelta.to, "30%");
  assert.equal(bleedDelta.delta, "+15%");

  // Test venomSpit upgrade from Rank 1 to Rank 2
  const venomDiffs = computeUpgradeDiff({ id: "venomSpit" }, 1, 2);
  const dmgDelta = venomDiffs.find((d) => d.label === "Damage");
  assert.ok(dmgDelta, "Damage stat delta is calculated for venom spit");
  assert.equal(dmgDelta.from, "35");
  assert.equal(dmgDelta.to, "55");
  assert.equal(dmgDelta.delta, "+20");

  const cdDelta = venomDiffs.find((d) => d.label === "Cooldown");
  assert.ok(cdDelta, "Cooldown reduction calculated for venom spit");
  assert.equal(cdDelta.from, "4s");
  assert.equal(cdDelta.to, "3.2s");
  assert.equal(cdDelta.delta, "-0.8s");

  // Test Rank 4 -> Rank 5 trait unlock tag (e.g. toxic pool)
  const maxVenomDiffs = computeUpgradeDiff({ id: "venomSpit" }, 4, 5);
  assert.ok(maxVenomDiffs.some((d) => d.tag && d.tag.includes("Lingering Toxic Pools")), "Unlocked trait tag generated on max rank");

  // Test rank badge HTML generation
  const rankHtmlNew = renderRankBadgeHTML(0, 1, false);
  assert.ok(rankHtmlNew.includes("NEW UNLOCK"));
  assert.ok(rankHtmlNew.includes("RANK 1"));

  const rankHtmlUpgrade = renderRankBadgeHTML(2, 3, true);
  assert.ok(rankHtmlUpgrade.includes("RANK 2"));
  assert.ok(rankHtmlUpgrade.includes("RANK 3"));
  assert.ok(rankHtmlUpgrade.includes("upgrading"));
});
