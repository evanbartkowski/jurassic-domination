import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import {
  evaluateObjectives,
  evaluateDanger,
  evaluateRegionHazard,
  evaluateCreatureThreat,
  getSurvivalHint,
  OBJECTIVE_STAGES,
} from "../src/tutorial.js";
import { SPECIES, SPECIES_BY_ID } from "../src/data.js";

function makeGame(options = {}) {
  const g = new Game({ seed: 777, ...options });
  g.entities = [];
  g.foods = [];
  g.lairs = [];
  g._streamWorld = () => {};
  g._replenish = () => {};
  g.worldFeatures = [];
  return g;
}

test("objective stages progression sequence transitions logically through player life cycle", () => {
  const g = makeGame();
  
  // 1. Egg state
  assert.equal(g.state, "egg");
  let obj = evaluateObjectives(g);
  assert.equal(obj.step, 1);
  assert.equal(obj.stageId, "hatch");
  assert.ok(obj.title.includes("Egg"));

  // 2. First Sustenance
  g.hatch();
  assert.equal(g.state, "playing");
  obj = evaluateObjectives(g);
  assert.equal(obj.step, 2);
  assert.equal(obj.stageId, "sustenance");
  assert.ok(obj.title.includes("Food"));

  // Sate hunger / nutrients
  g.player.nutrients = 15;
  g.player.xp = 12;

  // 3. Primal Roar
  obj = evaluateObjectives(g);
  assert.equal(obj.step, 3);
  assert.equal(obj.stageId, "roar");
  assert.ok(obj.title.includes("Roar"));

  // Perform roar
  g.roar();
  assert.ok(g._hasRoared);

  // 4. Basin Survival
  obj = evaluateObjectives(g);
  assert.equal(obj.step, 4);
  assert.equal(obj.stageId, "basin-survival");

  // Advance time past 50s
  g.time = 55;

  // 5. Biomass accumulation
  obj = evaluateObjectives(g);
  assert.equal(obj.step, 5);
  assert.equal(obj.stageId, "biomass");

  // Reach evolution threshold
  g.gainXP(g.nextThreshold);
  assert.ok(g.evolutionReady);

  // 6. First Evolution
  obj = evaluateObjectives(g);
  assert.equal(obj.step, 6);
  assert.equal(obj.stageId, "first-evolution");

  // Evolve to Tier 1
  g.openEvolution();
  g.evolve(g.evolutionChoices[0], g.mutationChoices[0]);
  assert.equal(g.tier, 1);

  // 7. Wild Frontier (still in basin < 55)
  obj = evaluateObjectives(g);
  assert.equal(obj.step, 7);
  assert.equal(obj.stageId, "wild-frontier");

  // Move outside basin (> 55 units)
  g.player.x = 65;
  g.player.y = 0;

  // 8. Predator Mastery (kills < 3)
  obj = evaluateObjectives(g);
  assert.equal(obj.step, 8);
  assert.equal(obj.stageId, "predator-mastery");

  // Complete kills
  g.player.kills = 3;

  // 9. Continental regions exploration
  obj = evaluateObjectives(g);
  assert.equal(obj.step, 9);
  assert.equal(obj.stageId, "ancient-discovery");

  // Discover 3 regions
  g.discoveredRegions = new Set(["fernwood", "savannah", "redwood"]);

  // 10. Apex dominance
  obj = evaluateObjectives(g);
  assert.equal(obj.step, 10);
  assert.equal(obj.stageId, "apex-dominance");
});

test("danger evaluation accurately reflects safe basin vs nearby lethal apex predators", () => {
  const g = makeGame();
  g.hatch();
  g.player.x = 0;
  g.player.y = 0;

  // Inside basin with no enemies: safe
  let danger = evaluateDanger(g);
  assert.equal(danger.level, "SAFE");
  assert.ok(danger.percent <= 0.35);

  // Spawn an apex lethal predator nearby (Tyrannosaurus is tier 5, player is tier 0)
  const rex = g.spawnEntity("tyrannosaurus", 15, 0, { passive: false });
  rex.intent = "hunt";
  rex.aggro = 10;

  danger = evaluateDanger(g);
  assert.equal(danger.level, "APEX");
  assert.ok(danger.percent >= 0.8);
  assert.ok(danger.apexCount >= 1);
  assert.ok(danger.label.includes("APEX"));
});

test("region hazard evaluation detects biomes 2+ tiers above the player form", () => {
  const g = makeGame();
  g.hatch();
  g.tier = 0; // Tier 0 hatchling

  // Fernwood is Tier 0 -> not hazardous
  g.player.x = 10;
  g.player.y = 10;
  let hazard = evaluateRegionHazard(g);
  assert.equal(hazard.isDangerous, false);

  // Move outward to high-tier biomes (e.g. Ashen Caldera / Volcano is Tier 4+)
  g.player.x = 1100;
  g.player.y = 1100;
  hazard = evaluateRegionHazard(g);
  if (hazard.regionTier >= 2) {
    assert.equal(hazard.isDangerous, true);
    assert.ok(hazard.warningTitle.includes("HAZARDOUS"));
    assert.ok(hazard.tierDiff >= 2);
  }
});

test("creature threat evaluation computes correct visual badges, symbols and behavior labels", () => {
  const g = makeGame();
  g.hatch();
  g.tier = 1;

  // Prey (Tier 0)
  const prey = g.spawnEntity("coelophysis", 10, 0, { passive: true });
  let threat = evaluateCreatureThreat(prey, g);
  assert.equal(threat.threatTier, "prey");
  assert.equal(threat.symbol, "🌿");
  assert.equal(threat.badgeClass, "threat-prey");

  // Fair match (Tier 1)
  const fair = g.spawnEntity("velociraptor", 12, 0, { passive: true });
  threat = evaluateCreatureThreat(fair, g);
  assert.equal(threat.threatTier, "fair");
  assert.equal(threat.symbol, "⚔️");

  // Dangerous (Tier 2 vs Player Tier 1)
  const dangerous = g.spawnEntity("ceratosaurus", 14, 0, { passive: false });
  threat = evaluateCreatureThreat(dangerous, g);
  assert.equal(threat.threatTier, "danger");
  assert.equal(threat.symbol, "⚠️");

  // Lethal apex (Tier 5 or Boss)
  const apex = g.spawnEntity("tyrannosaurus", 16, 0, { boss: true });
  threat = evaluateCreatureThreat(apex, g);
  assert.equal(threat.threatTier, "lethal");
  assert.equal(threat.symbol, "💀");
  assert.equal(threat.isApex, true);

  // Charging behavior
  dangerous.charging = 0.5;
  threat = evaluateCreatureThreat(dangerous, g);
  assert.equal(threat.behavior, "charge");
  assert.ok(threat.behaviorLabel.includes("CHARGING"));

  // Strike imminent telegraph
  fair.telegraph = 0.2;
  threat = evaluateCreatureThreat(fair, g);
  assert.equal(threat.behavior, "strike");
  assert.ok(threat.behaviorLabel.includes("IMMINENT"));
});

test("early game basin hunger grace reduces starvation rate inside safe nursery basin", () => {
  const g = makeGame();
  g.hatch();
  g.player.x = 10;
  g.player.y = 10; // inside basin (< 55)
  g.tier = 0;
  g.player.hunger = 100;

  g.update(1.0, {});
  const hungerInside = 100 - g.player.hunger;

  // Move outside basin
  const gOut = makeGame();
  gOut.hatch();
  gOut.player.x = 90;
  gOut.player.y = 90;
  gOut.tier = 0;
  gOut.player.hunger = 100;

  gOut.update(1.0, {});
  const hungerOutside = 100 - gOut.player.hunger;

  // Hunger drain inside should be lower (30% grace)
  assert.ok(hungerInside < hungerOutside);
});

test("combat hit-stop timer triggers on connecting melee attacks and heavy player damage", () => {
  const g = makeGame();
  g.hatch();
  g.player.x = 0;
  g.player.y = 0;

  const target = g.spawnEntity("coelophysis", 2, 0, { hp: 50 });
  assert.equal(g.hitStop, 0);

  // Perform bite attack
  g.attack();
  // Hit-stop should now be active (brief micro-freeze for impact feel)
  assert.ok(g.hitStop > 0);

  // Updating advances and decays hitStop
  g.update(0.06, {});
  assert.equal(g.hitStop, 0);
});

test("companion pet equipped grants expedition speed bonus", () => {
  const gWithoutPet = makeGame();
  gWithoutPet.hatch();
  const baseSpeed = gWithoutPet.player.speed;

  const gWithPet = makeGame();
  gWithPet.petId = "pet-raptor";
  gWithPet.hatch();
  gWithPet.refreshStats(true);
  const buffedSpeed = gWithPet.player.speed;

  assert.ok(buffedSpeed > baseSpeed);
  assert.ok(Math.abs(buffedSpeed / baseSpeed - 1.05) < 0.001);
});
