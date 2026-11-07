import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { LocalAuthority } from "../src/simulation.js";
import { phenotype } from "../src/genetics.js";
import { recordExploration } from "../src/discoveries.js";

test("interest view includes bounded authoritative life, social, weather and tracking render data", () => {
  const game = new Game({ seed: 860, runId: "interest-immersion" }), authority = new LocalAuthority(game);
  authority.dispatch({ type: "hatch" });
  const near = game.spawnEntity("compsognathus", 8, 0, { juvenile: true }),
    far = game.spawnEntity("compsognathus", 400, 0);
  near.groupRole = "scout"; near.age = 9;
  game.nests = [{ id: "near-nest", x: 9, y: 0, speciesId: near.speciesId, territoryRadius: 15, generation: 1, born: 2, parentIds: [near.id], eggIds: [] },
    { id: "far-nest", x: 400, y: 0, speciesId: far.speciesId, territoryRadius: 15, generation: 1, born: 2, parentIds: [far.id], eggIds: [] }];
  game.senses.trails = [
    { kind: "footprint", x: 3, y: 0, angle: 0, strength: 1, createdAt: 0, expiresAt: 10, sourceId: "player" },
    { kind: "blood", x: 400, y: 0, angle: 0, strength: 1, createdAt: 0, expiresAt: 10, sourceId: "player" },
    { kind: "sound", x: 4, y: 0, angle: 0, strength: 1, createdAt: 0, expiresAt: 0, sourceId: "player" },
  ];
  recordExploration(game);
  const view = authority.interestSnapshot({ radius: 30 }), actor = view.entities.find((e) => e.id.endsWith(`:${near.id}`));
  assert.equal(actor.age, 9); assert.equal(actor.juvenile, true); assert.equal(actor.groupRole, "scout");
  assert.deepEqual(actor.genome, near.genome); assert.equal(actor.appearance.markings, phenotype(near.genome).markings);
  assert.ok(!view.entities.some((e) => e.id.endsWith(`:${far.id}`)));
  assert.equal(view.nests.length, 1); assert.equal(view.trails.length, 1);
  assert.equal(view.trails[0].sourceId, `${game.runId}:player`);
  assert.ok(Number.isFinite(view.weather.wind.angle)); assert.ok(view.weather.event);
  assert.equal(view.owner.exploration.visited.length, game.exploration.visited.length);
  assert.equal(view._randomState, undefined); assert.equal(view.seed, undefined); assert.equal(view.secretSite, undefined);
});

test("interest data copies cannot mutate authority genes, owner discoveries, trails or cached wind", () => {
  const game = new Game({ seed: 861, runId: "interest-copy" }), authority = new LocalAuthority(game);
  const entity = game.spawnEntity("compsognathus", 2, 0); recordExploration(game);
  const view = authority.interestSnapshot(), original = entity.genome.alleles.mass,
    wind = authority.interestSnapshot().weather.wind.x;
  view.entities.find((e) => e.id.endsWith(`:${entity.id}`)).genome.alleles.mass = 1000;
  view.player.genome.alleles.mass = 1000; view.owner.exploration.visited.push("99,99");
  view.weather.wind.x = 1000;
  assert.equal(entity.genome.alleles.mass, original);
  assert.notEqual(game.player.genome.alleles.mass, 1000);
  assert.ok(!game.exploration.visited.includes("99,99"));
  assert.equal(authority.interestSnapshot().weather.wind.x, wind);
  const publicView = authority.interestSnapshot({ includeOwnerState: false });
  assert.equal(publicView.owner, undefined); assert.equal(publicView.player.xp, undefined);
  assert.equal(publicView.player.hunger, undefined); assert.ok(publicView.player.appearance);
  assert.throws(() => authority.interestSnapshot({ includeOwnerState: "yes" }), /Invalid interest/);
});

test("interest filtering caps trail payload even if a trusted fixture exceeds the normal simulation budget", () => {
  const game = new Game({ seed: 862, runId: "interest-bounds" }), authority = new LocalAuthority(game);
  game.senses.trails = Array.from({ length: 120 }, (_, i) => ({ kind: "scent", x: 1, y: 0,
    angle: 0, strength: 1, createdAt: i / 100, expiresAt: 99, sourceId: "player" }));
  assert.equal(authority.interestSnapshot().trails.length, 96);
});
