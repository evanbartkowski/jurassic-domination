import test from "node:test";
import assert from "node:assert/strict";
import {
  ADAPTATIONS, GENE_IDS, makeGenome, normalizeGenome, neutralGenome, validGenome,
  phenotype, newAdaptationState, recordExposure, acquiredAdaptations, exposureProgress,
} from "../src/genetics.js";
import { newProfile, normalizeProfile, recordRun } from "../src/profile.js";
import { ancestryOptions, normalizeAncestry } from "../src/ancestry.js";
import { feedEntity } from "../src/progression.js";
import { SPECIES_BY_ID } from "../src/data.js";

test("genomes use deterministic independent seeds and preserve immutable parental data", () => {
  const species = SPECIES_BY_ID.compsognathus;
  const founder = makeGenome("world:41:player", species);
  assert.deepEqual(makeGenome("world:41:player", species), founder);
  assert.notDeepEqual(makeGenome("world:41:creature:1", species), founder);
  assert.notDeepEqual(makeGenome("world:41:player", SPECIES_BY_ID.psittacosaurus), founder);
  const before = structuredClone(founder);
  const child = makeGenome("world:42:egg:1", species, founder);
  assert.equal(child.parentSeed, founder.seed);
  assert.equal(child.generation, 2);
  assert.deepEqual(founder, before);
  assert.deepEqual(makeGenome("world:42:egg:1", species, founder), child);
  assert.equal(validGenome(child), true);
  const copied = normalizeGenome(child);
  copied.alleles.mass = copied.alleles.mass === 100 ? 99 : 100;
  assert.notEqual(child.alleles.mass, copied.alleles.mass);
});

test("neutral migration genes change no existing body size, movement, stamina or resistance", () => {
  const neutral = phenotype(neutralGenome(1907));
  for (const field of ["size", "speed", "staminaRecovery", "staminaCost", "brightness"])
    assert.equal(neutral[field], 1, field);
  assert.equal(neutral.resistance, 0);
  assert.equal(neutral.hue, 0);
  assert.equal(neutral.markings, "plain");
  assert.deepEqual(neutral.adaptations, []);
  assert.deepEqual(neutral.discoveries, []);
  assert.deepEqual(phenotype(undefined), neutral);
});

test("all founders and many inherited generations stay within small bounded tradeoffs", () => {
  let parent = neutralGenome();
  for (let seed = 0; seed < 10000; seed++) {
    const genome = makeGenome(seed, "velociraptor", seed % 2 ? parent : null);
    const p = phenotype(genome), epsilon = 1e-9;
    assert.ok(p.size >= .93 - epsilon && p.size <= 1.07 + epsilon);
    assert.ok(p.speed >= .96 - epsilon && p.speed <= 1.04 + epsilon);
    assert.ok(p.staminaRecovery >= .95 - epsilon && p.staminaRecovery <= 1.05 + epsilon);
    assert.ok(p.staminaCost >= .95 - epsilon && p.staminaCost <= 1.05 + epsilon);
    assert.ok(p.resistance >= -.03 - epsilon && p.resistance <= .03 + epsilon);
    assert.ok(GENE_IDS.every((id) => Number.isInteger(genome.alleles[id]) && Math.abs(genome.alleles[id]) <= 100));
    parent = genome;
  }
  const heavy = neutralGenome(), light = neutralGenome();
  heavy.alleles.mass = 100; light.alleles.mass = -100;
  assert.ok(phenotype(heavy).size > phenotype(light).size);
  assert.ok(phenotype(heavy).speed < phenotype(light).speed);
  assert.ok(phenotype(heavy).staminaCost > phenotype(light).staminaCost);
  const armored = neutralGenome(); armored.alleles.hide = 100;
  assert.ok(phenotype(armored).resistance > 0);
  assert.ok(phenotype(armored).speed < 1);
});

test("inheritance blends traits rather than stacking previous bonuses or acquired exposure", () => {
  const parent = neutralGenome(7, 100);
  for (const id of GENE_IDS) parent.alleles[id] = 100;
  let total = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const child = makeGenome(seed, "microraptor", parent);
    assert.equal(child.generation, 101);
    assert.equal(child.adaptations, undefined);
    total += child.alleles.mass;
  }
  assert.ok(total / 1000 > 40 && total / 1000 < 56);
  assert.equal(phenotype(parent).resistance < .031, true);
});

test("malformed genes cannot inject large stats or poison a deterministic founder", () => {
  const raw = makeGenome(12, "psittacosaurus");
  raw.alleles.mass = Infinity;
  assert.equal(validGenome(raw), false);
  assert.deepEqual(normalizeGenome(raw, 9, "psittacosaurus"), makeGenome(9, "psittacosaurus"));
  assert.equal(phenotype(raw).size, 1);
  assert.equal(validGenome({ ...neutralGenome(), alleles: Object.create({ mass: 100 }) }), false);
});

test("acquired acclimation requires real elapsed exposure and unlocks exactly once", () => {
  const state = newAdaptationState();
  assert.deepEqual(recordExposure(state, "water", ADAPTATIONS.water.threshold - .5), []);
  assert.deepEqual(acquiredAdaptations(state), []);
  assert.deepEqual(recordExposure(state, "water", .5), ["water"]);
  assert.deepEqual(recordExposure(state, "water", .5), []);
  assert.deepEqual(acquiredAdaptations(state), ["water"]);
  assert.equal(exposureProgress(state, "water"), 75.5);
  const before = structuredClone(state);
  recordExposure(state, "water", -8);
  recordExposure(state, "water", Infinity);
  recordExposure(state, "__proto__", 10);
  assert.deepEqual(state, before);
  assert.equal(exposureProgress(state, "__proto__"), 0);
  assert.deepEqual(acquiredAdaptations(["water", "bogus"]), ["water"]);
});

test("extraordinary genetic discoveries are reproducible and optional, never required for acquired traits", () => {
  const genome = neutralGenome();
  genome.alleles.aquatic = 90; genome.alleles.endurance = 90;
  assert.deepEqual(phenotype(genome).discoveries, ["tidewalker"]);
  assert.ok(phenotype(genome).adaptations.includes("water"));
  const legacy = neutralGenome(), exposure = newAdaptationState();
  recordExposure(exposure, "water", ADAPTATIONS.water.threshold);
  assert.ok(acquiredAdaptations(exposure).includes("water"));
  assert.deepEqual(phenotype(legacy).discoveries, []);
});

test("completed life ancestry is permanent, bounded, idempotent and does not resurrect a creature", () => {
  const profile = newProfile(), genome = makeGenome("first", "compsognathus");
  const living = { runId: "life:1", speciesId: "velociraptor", tier: 1,
    time: 160, kills: 8, guardians: 2, score: 100, genome,
    adaptations: { water: 80 }, discoveries: [{ id: "tidal-archive", at: 125 }] };
  assert.equal(ancestryOptions(profile).ancestorGenome, null);
  recordRun(profile, living, "2026-11-07");
  const once = structuredClone(profile);
  assert.deepEqual(recordRun(profile, living), []);
  assert.deepEqual(profile, once);
  assert.equal(profile.ancestry.generations, 1);
  assert.equal(profile.ancestry.totalSurvival, 160);
  assert.equal(profile.ancestry.guardianVictories, 2);
  assert.equal(profile.ancestry.lastAncestor.runId, "life:1");
  assert.deepEqual(profile.ancestry.lastAncestor.adaptations, ["water"]);
  assert.ok(profile.ancestry.discoveries.includes("tidal-archive"));
  const options = ancestryOptions(profile);
  assert.equal(options.ancestorSpeciesId, "velociraptor");
  assert.equal(options.generation, 2);
  assert.equal(options.hp, undefined);
  options.ancestorGenome.alleles.mass = 1000;
  assert.equal(validGenome(profile.ancestry.lastAncestor.genome), true);
  const restored = normalizeProfile(JSON.parse(JSON.stringify(profile)));
  assert.deepEqual(restored.ancestry, profile.ancestry);
  recordRun(restored, living);
  assert.equal(restored.ancestry.generations, 1);
});

test("ancestry retains latest 32 generations and cumulative accomplishments without large save growth", () => {
  const profile = newProfile();
  for (let n = 0; n < 90; n++) recordRun(profile, {
    runId: `bounded:${n}`, speciesId: "compsognathus", score: 0, kills: 1, time: n,
    tier: 0, guardians: 1, genome: makeGenome(n, "compsognathus", ancestryOptions(profile).ancestorGenome),
  }, "2026-11-07");
  assert.equal(profile.ancestry.recent.length, 32);
  assert.equal(profile.ancestry.generations, 90);
  assert.equal(profile.ancestry.guardianVictories, 90);
  assert.equal(profile.ancestry.longestLife, 89);
  assert.equal(profile.ancestry.lastAncestor.runId, "bounded:89");
  assert.equal(profile.ancestry.recent[31].runId, "bounded:58");
  assert.ok(JSON.stringify(profile.ancestry).length < 26000);
});

test("old profiles keep purchases, scores and discoveries while lineage starts safely", () => {
  const p = normalizeProfile({ version: 3, dna: 53, runs: 20, totalKills: 120,
    unlocked: Array.from({ length: 180 }, (_, n) => `legacy-${n}`), hunted: ["legacy-unlisted"],
    upgrades: { vitality: 3 }, ancestry: { generations: Infinity, discoveries: [null, "__proto__"],
      recent: [{ runId: "bad", genome: { alleles: { mass: 100000 } } }] } });
  assert.equal(p.dna, 53); assert.equal(p.runs, 20); assert.equal(p.upgrades.vitality, 3);
  assert.equal(p.unlocked.length, 180); assert.deepEqual(p.hunted, ["legacy-unlisted"]);
  assert.equal(p.ancestry.generations, 0);
  assert.equal(p.ancestry.lastAncestor.genome, null);
  assert.equal(ancestryOptions(p).ancestorGenome, null);
  assert.deepEqual(normalizeAncestry().recent, []);
});

test("NPC meals preserve genetic size and species-specific juvenile maturation", () => {
  const s = SPECIES_BY_ID.triceratops, genome = neutralGenome();
  genome.alleles.mass = 100;
  const e = { speciesId: s.id, genome, nutrients: 0, hp: s.hp * .5,
    maxHp: s.hp * .5, baseMaxHp: s.hp, juvenile: true, age: 30, maturitySeconds: 60, hunger: 0 };
  feedEntity(null, e, { value: 0 });
  assert.equal(e.scaleFactor, (.42 + .58 * .5) * 1.07);
  assert.equal(e.maxHp, s.hp * (.45 + .55 * .5));
  e.juvenile = false;
  feedEntity(null, e, { value: 10000 });
  assert.equal(e.scaleFactor, 1.28 * 1.07);
  assert.ok(e.maxHp > s.hp);
});
