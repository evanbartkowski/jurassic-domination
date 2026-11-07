import { biomeAt } from "./world-data.js";

export const BOSS_ENCOUNTER_RADIUS = 65;
const bands = [32, 64, 128, 256, Infinity];
const names = ["0-31", "32-63", "64-127", "128-255", "256+"];
const number = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
const count = (table, key, amount = 1) => { table[key || "unknown"] = (table[key || "unknown"] || 0) + amount; };
const table = () => Object.create(null);
const plainTable = (value) => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));

/** Local analysis only. Stores bounded aggregates, no user/device identifiers or network data. */
export function createBalanceRecorder(game) {
  const starterId = game.player.speciesId, evolutions = [], offers = [], encounters = new Set(), kills = new Set(),
    population = names.map((band) => ({ band, samples: 0, totalMs: 0, maxMs: 0 })),
    tierSeconds = new Array(8).fill(0);
  let previousSpecies = starterId, previousTier = game.tier, previousTime = game.time,
    offersSeen = new Set(), peakEntities = game.entities.length, maxTier = game.tier, bossKills = 0;
  function sample(g, events = [], tickMs) {
    const dt = Math.max(0, g.time - previousTime);
    tierSeconds[previousTier] += dt; previousTime = g.time;
    if (g.player.speciesId !== previousSpecies) {
      if (evolutions.length < 128) evolutions.push({ from: previousSpecies, to: g.player.speciesId, tier: g.tier, at: g.time });
      previousSpecies = g.player.speciesId;
    }
    previousTier = g.tier; maxTier = Math.max(maxTier, g.tier);
    if (g.evolutionChoices?.length) {
      const key = `${g.tier}:${g.ascensions || 0}:${g.formStarted || 0}:${g.evolutionChoices.join(",")}`;
      if (!offersSeen.has(key) && offers.length < 128) {
        offersSeen.add(key); offers.push({ tier: Math.min(7, g.tier + 1), choices: [...g.evolutionChoices].slice(0, 128) });
      }
    }
    peakEntities = Math.max(peakEntities, g.entities.length);
    for (const entity of g.entities) if (entity.boss && encounters.size < 256 &&
      Math.hypot(entity.x - g.player.x, entity.y - g.player.y) <= BOSS_ENCOUNTER_RADIUS) encounters.add(entity.id);
    for (const event of events) if (event.type === "kill" && event.boss) {
      const key = event.entityId ?? `${event.speciesId}:${g.time}`;
      if (!kills.has(key) && kills.size < 256) {
        kills.add(key); bossKills++;
        if (encounters.size < 256) encounters.add(key);
      }
    }
    if (number(tickMs)) {
      const row = population[bands.findIndex((upper) => g.entities.length < upper)];
      row.samples++; row.totalMs += tickMs; row.maxMs = Math.max(row.maxMs, tickMs);
    }
  }
  return {
    sample,
    finish(g) {
      sample(g);
      return {
        version: 1, seed: g.seed, durationSeconds: g.time, ended: g.state === "dead",
        starterId, speciesId: g.player.speciesId, regionId: biomeAt(g.player.x, g.player.y).id,
        cause: g.state === "dead" ? g.cause : null, tierReached: maxTier, tierSeconds: [...tierSeconds],
        evolutions: evolutions.map((e) => ({ ...e })), offers: offers.map((o) => ({ ...o, choices: [...o.choices] })),
        bosses: { encountered: Math.max(encounters.size, bossKills), killed: bossKills },
        discoveries: g.exploration ? g.exploration.discoveries.map((d) => d.id) : null,
        peakEntities, population: population.map((p) => ({ ...p })),
      };
    },
  };
}

function normalize(attempt) {
  if (attempt?.balance) return attempt.balance;
  if (attempt?.version === 1 && number(attempt.durationSeconds)) return attempt;
  return {
    durationSeconds: number(attempt?.survivedSeconds) ? attempt.survivedSeconds : number(attempt?.time) ? attempt.time : null,
    ended: attempt?.cause ? !["time limit", "Run ended"].includes(attempt.cause) : null,
    starterId: attempt?.starterId || null, speciesId: attempt?.speciesId || null,
    regionId: attempt?.regionId || null, cause: attempt?.cause || null,
    tierReached: Number.isInteger(attempt?.tier) ? Math.max(0, attempt.tier - ("survivedSeconds" in attempt ? 1 : 0)) : null,
    evolutions: null, offers: null, bosses: null, discoveries: null, population: null,
  };
}

/** Absence in a finite sample is reported as unobserved, never proof a path is impossible. */
export function summarizeBalance(attempts, { branchIds = [] } = {}) {
  const runs = attempts.map(normalize), durations = runs.filter((r) => number(r.durationSeconds)),
    deaths = runs.filter((r) => r.ended === true), completed = deaths.filter((r) => number(r.durationSeconds)),
    deathsBySpecies = table(), deathsByRegion = table(), deathsByCause = table(),
    starterPicks = table(), evolutionPicks = table(), discoveries = table(), offersBySpecies = table(),
    reached = new Array(8).fill(0), tierSeconds = new Array(8).fill(0),
    population = names.map((band) => ({ band, samples: 0, totalMs: 0, maxMs: 0 }));
  let knownTierRuns = 0, knownStarterRuns = 0, knownEvolutionRuns = 0, knownDiscoveryRuns = 0,
    knownBossRuns = 0, knownOfferRuns = 0, offered = 0, evolved = 0, bossEncounters = 0, bossKills = 0;
  for (const run of runs) {
    if (run.ended) { count(deathsBySpecies, run.speciesId); count(deathsByRegion, run.regionId); count(deathsByCause, run.cause); }
    if (run.starterId) { knownStarterRuns++; count(starterPicks, run.starterId); }
    if (Number.isInteger(run.tierReached) && run.tierReached >= 0 && run.tierReached < 8) {
      knownTierRuns++;
      for (let tier = 0; tier <= run.tierReached; tier++) reached[tier]++;
    }
    if (Array.isArray(run.tierSeconds)) run.tierSeconds.forEach((seconds, tier) => { if (tier < 8 && number(seconds)) tierSeconds[tier] += seconds; });
    if (Array.isArray(run.evolutions)) {
      knownEvolutionRuns++; evolved += run.evolutions.length;
      run.evolutions.forEach((e) => count(evolutionPicks, e.to));
    }
    if (Array.isArray(run.offers)) {
      knownOfferRuns++; offered += run.offers.length;
      run.offers.forEach((o) => o.choices.forEach((id) => count(offersBySpecies, id)));
    }
    if (Array.isArray(run.discoveries)) { knownDiscoveryRuns++; new Set(run.discoveries).forEach((id) => count(discoveries, id)); }
    if (run.bosses && number(run.bosses.encountered) && number(run.bosses.killed)) {
      knownBossRuns++; bossEncounters += run.bosses.encountered; bossKills += run.bosses.killed;
    }
    for (const row of run.population || []) {
      const target = population.find((p) => p.band === row.band);
      if (!target || !number(row.samples) || !number(row.totalMs) || !number(row.maxMs)) continue;
      target.samples += row.samples; target.totalMs += row.totalMs; target.maxMs = Math.max(target.maxMs, row.maxMs);
    }
  }
  return {
    runs: runs.length, deaths: deaths.length, censoredRuns: runs.filter((r) => r.ended === false).length,
    unknownEndStateRuns: runs.filter((r) => r.ended === null || r.ended === undefined).length,
    averageObservedDurationSeconds: durations.length ? durations.reduce((sum, r) => sum + r.durationSeconds, 0) / durations.length : null,
    averageCompletedSurvivalSeconds: completed.length ? completed.reduce((sum, r) => sum + r.durationSeconds, 0) / completed.length : null,
    deathsBySpecies: plainTable(deathsBySpecies), deathsByRegion: plainTable(deathsByRegion), deathsByCause: plainTable(deathsByCause),
    starterPicks: { observedRuns: knownStarterRuns, counts: plainTable(starterPicks) },
    evolutionPicks: { observedRuns: knownEvolutionRuns, counts: plainTable(evolutionPicks) },
    tiers: reached.map((runs, tier) => ({ tier: tier + 1, reached: runs, rate: knownTierRuns ? runs / knownTierRuns : null, observedSeconds: tierSeconds[tier] })),
    evolution: { observedOfferRuns: knownOfferRuns, observedOffers: offered, completed: knownEvolutionRuns ? evolved : null,
      conversionRate: offered && knownOfferRuns === knownEvolutionRuns ? Math.min(1, evolved / offered) : null,
      offersBySpecies: plainTable(offersBySpecies) },
    bosses: { observedRuns: knownBossRuns, encounters: knownBossRuns ? bossEncounters : null, killed: knownBossRuns ? bossKills : null,
      completionRate: bossEncounters ? bossKills / bossEncounters : null },
    discoveries: { observedRuns: knownDiscoveryRuns, counts: plainTable(discoveries) },
    unobservedBranches: branchIds.filter((id) => !evolutionPicks[id]),
    branchReachabilityNote: "An unobserved branch is not proof it is unreachable. Validate its prerequisites with targeted simulation and rule tests.",
    performanceByPopulation: population.map((p) => ({ band: p.band, samples: p.samples,
      meanTickMs: p.samples ? p.totalMs / p.samples : null, maxTickMs: p.samples ? p.maxMs : null })),
    interpretation: "Time-limit runs are censored. Bot survival and renderer-free CPU timings do not measure human difficulty or GPU frame rate.",
  };
}
