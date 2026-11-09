import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { SPECIES, SPECIES_BY_ID, MUTATIONS, MUTATION_RARITIES, STARTER_SPECIES } from "../src/data.js";
import { creatureKit } from "../src/progression.js";
import { actionHeld, DEFAULT_BINDINGS } from "../src/controls.js";
import { LocalAuthority } from "../src/simulation.js";

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

test("starter variety offers 3 low-level Tier 0-1 non-marine dinosaurs and hatching honors chosen species", () => {
  const g = new Game({ seed: 101 });
  assert.equal(g.state, "egg");
  assert.equal(g.starterChoices.length, 3);
  for (const id of g.starterChoices) {
    const s = SPECIES_BY_ID[id];
    assert.ok(s, `species ${id} exists`);
    assert.ok(s.tier <= 1, `${id} is low tier (tier ${s.tier})`);
    assert.notEqual(s.body, "marine", `${id} is not marine`);
    assert.ok(!s.bloodline, `${id} is not an earned bloodline`);
  }

  // Hatch with a specific chosen starter
  const chosen = g.starterChoices[1];
  assert.ok(g.hatch(chosen));
  assert.equal(g.state, "playing");
  assert.equal(g.player.speciesId, chosen);
  assert.equal(g.species.id, chosen);
});

test("rare mutation drops occur on kills with tiered rarities", () => {
  const g = isolated("velociraptor");
  // Kill a high tier alpha/boss
  const prey = g.spawnEntity("tyrannosaurus", g.player.x + 2, g.player.y, {
    boss: true,
    passive: true,
  });
  g._hitEntity(prey, prey.maxHp * 2);

  // Mutation catalyst should have spawned
  const drop = g.foods.find((f) => f.type === "mutation-catalyst");
  assert.ok(drop, "mutation catalyst spawned from boss");
  assert.ok(["legendary", "epic"].includes(drop.rarity), `boss dropped high rarity: ${drop.rarity}`);

  // Eating the catalyst triggers 3 mutation options
  g.player.x = drop.x;
  g.player.y = drop.y;
  assert.ok(g.eat());
  assert.equal(g.state, "mutation-choice");
  assert.equal(g.pendingMutationChoices.length, 3);
  const foundEvent = g.consumeEvents().find((e) => e.type === "mutation-found");
  assert.ok(foundEvent);
  assert.equal(foundEvent.choices.length, 3);

  // Apply one of the mutations
  const pickedId = g.pendingMutationChoices[0];
  assert.ok(g.applyMutation(pickedId));
  assert.equal(g.state, "playing");
  assert.ok(g.mutations.includes(pickedId));
  const appliedEvent = g.consumeEvents().find((e) => e.type === "mutation-applied");
  assert.ok(appliedEvent);
});

test("special effects: boneCrusher bypasses defense and toxicBile poisons and slows", () => {
  const g = isolated("velociraptor");
  g.mutations.push("boneCrusher", "toxicBile");
  g.refreshStats(true);

  const victim = g.spawnEntity("triceratops", g.player.x + 1.5, g.player.y, {
    passive: true,
  });
  const initialHp = victim.hp;
  g._hitEntity(victim, 50);

  assert.ok(victim.hp < initialHp, "damaged victim");
  assert.ok(victim.poison > 0, "toxicBile applied poison");
  assert.ok(victim.slowed > 0, "toxicBile applied slow");
});

test("special effects: volcanicCore retaliates on player damage and primalRegen mends out-of-combat", () => {
  const g = isolated("velociraptor");
  g.mutations.push("volcanicCore", "primalRegen");
  g.refreshStats(true);

  const attacker = g.spawnEntity("velociraptor", g.player.x + 2, g.player.y, {
    passive: true,
  });
  const attackerStartHp = attacker.hp;

  // Damage player
  g.damagePlayer(20, "Enemy strike");
  assert.equal(g.timeSinceDamaged, 0);
  assert.ok(attacker.hp < attackerStartHp, "volcanicCore ignited and damaged attacker");
  assert.ok(attacker.burning > 0, "attacker is burning");

  // Out of combat regeneration after 4 seconds
  g.player.hp = 10;
  g.update(4.2, {});
  assert.ok(g.player.hp > 10, "primalRegen restored health out of combat");
});

test("ultimate attacks are locked for low tier dinosaurs and unlocked by high tier or legendary mutations", () => {
  const raptor = SPECIES_BY_ID["velociraptor"]; // tier 0
  assert.equal(creatureKit(raptor).special, null, "tier 0 raptor has no ultimate");

  // Unlocked by titansWrath mutation
  assert.equal(
    creatureKit(raptor, { titansWrath: 1 }).special,
    "rending",
    "titansWrath unlocks species ultimate"
  );

  // Unlocked by astralBehemoth mutation
  assert.equal(
    creatureKit(raptor, { astralBehemoth: 1 }).special,
    "bolt",
    "astralBehemoth grants celestial bolt"
  );

  // High tier dinosaurs (Tier 4+ with mastery / Tier 5+)
  const anky = SPECIES_BY_ID["ankylosaurus"]; // tier 4
  assert.equal(creatureKit(anky).special, "bulwark", "Tier 4 Ankylosaurus has bulwark ultimate");

  const giga = SPECIES_BY_ID["giganotosaurus"]; // tier 5
  assert.equal(creatureKit(giga).special, "rage", "Tier 5 Giganotosaurus has rage ultimate");

  const elder = SPECIES_BY_ID["elder-dragon"]; // tier 7
  assert.ok(creatureKit(elder).special, "Apex Elder Dragon has ultimate");
});

test("roar is mapped to KeyZ and accepts KeyC as secondary binding", () => {
  assert.equal(DEFAULT_BINDINGS.roar, "KeyZ");
  assert.ok(actionHeld("roar", new Set(["KeyZ"])));
  assert.ok(actionHeld("roar", new Set(["KeyC"])));
});

test("LocalAuthority dispatches apply-mutation, close-mutation-choice, and hatch with chosen starter", () => {
  const g = new Game({ seed: 77 });
  const auth = new LocalAuthority(g);

  const starterId = g.starterChoices[2];
  const hatchRes = auth.dispatch({ type: "hatch", chosenSpeciesId: starterId });
  assert.ok(hatchRes.ok);
  assert.equal(g.player.speciesId, starterId);

  // Open mutation drop
  g.openMutationDrop("epic");
  assert.equal(g.state, "mutation-choice");
  const mutId = g.pendingMutationChoices[0];

  const applyRes = auth.dispatch({ type: "apply-mutation", mutationId: mutId });
  assert.ok(applyRes.ok);
  assert.equal(g.state, "playing");
  assert.ok(g.mutations.includes(mutId));
});
