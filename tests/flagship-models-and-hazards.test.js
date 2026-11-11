import test from "node:test";
import assert from "node:assert/strict";
import { FLAGSHIP_SPECIES_IDS } from "../src/flagship-models.js";
import { Game } from "../src/game.js";
import { AudioEngine } from "../src/audio.js";

test("all 10 flagship species models are registered and defined", () => {
  const expected = [
    "velociraptor",
    "tyrannosaurus",
    "triceratops",
    "spinosaurus",
    "ankylosaurus",
    "stegosaurus",
    "brachiosaurus",
    "compsognathus",
    "carnotaurus",
    "dilophosaurus",
  ];
  for (const id of expected) {
    assert.ok(FLAGSHIP_SPECIES_IDS.has(id), `Missing flagship species: ${id}`);
  }
  assert.equal(FLAGSHIP_SPECIES_IDS.size, 10);
});

test("player attack demolishes nearby fallen logs and spawns insects", () => {
  const g = new Game({ seed: 42 });
  g.hatch();
  const p = g.player;

  // Place a fallen-log directly in front of the player
  const logFeature = {
    id: "test-log-1",
    type: "fallen-log",
    x: p.x + 2.5,
    y: p.y,
    radius: 3.5,
    solid: true,
    destroyed: false,
  };
  g.worldFeatures = [logFeature];
  p.angle = 0; // facing +X toward log
  const initialFoodCount = (g.foods || []).length;

  // Attack the log
  g.attack();

  assert.ok(logFeature.destroyed, "Fallen log should be destroyed after attack");
  assert.ok(!logFeature.solid, "Destroyed log should no longer be solid");
  assert.ok(g.foods.length > initialFoodCount, "Insects/food should spawn from smashed log");
  const grubs = g.foods.filter((f) => String(f.id).includes("demolish_grub") || f.type === "insect");
  assert.ok(grubs.length >= 1, "Should spawn demolish grubs");
});

test("player attack smashes amber boulders into essence", () => {
  const g = new Game({ seed: 88 });
  g.hatch();
  const p = g.player;

  const boulderFeature = {
    id: "test-boulder-1",
    type: "boulder",
    x: p.x + 2.0,
    y: p.y,
    radius: 2.0,
    solid: true,
    destroyed: false,
    hits: 1, // 1 hit already, next hit will shatter
  };
  g.worldFeatures = [boulderFeature];
  p.angle = 0;

  g.attack();

  assert.ok(boulderFeature.destroyed, "Boulder should be shattered");
  assert.ok(!boulderFeature.solid, "Shattered boulder should not be solid");
  const amber = g.foods.filter((f) => f.type === "amber");
  assert.ok(amber.length >= 1, "Should spawn amber essence on boulder smash");
});

test("audio engine handles thunder and demolish sound events safely without errors", () => {
  const audio = new AudioEngine();
  // Safe calls even without WebAudio unlock
  assert.doesNotThrow(() => {
    audio.play("thunder");
    audio.play("demolish");
    audio.play("rock_smash");
    audio.play("bite_flesh");
  });
});
