import {
  validGenome, normalizeGenome, phenotype, acquiredAdaptations, GENETIC_DISCOVERIES,
} from "./genetics.js";

const integer = (n, max = 1e9) => Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : 0;
const shortId = (id) => typeof id === "string" && /^[a-zA-Z0-9:_-]{1,160}$/.test(id);
const discoveryId = (id) => typeof id === "string" && /^[a-z][a-z0-9-]{0,79}$/.test(id);
const unique = (ids, limit) => [...new Set(ids)].slice(-limit);
const discoveryIds = (raw) => unique((Array.isArray(raw) ? raw : [])
  .map((entry) => typeof entry === "string" ? entry : entry?.id).filter(discoveryId), 64);

export function newAncestry() {
  return { version: 1, generations: 0, totalSurvival: 0, longestLife: 0,
    highestTier: 0, guardianVictories: 0, discoveries: [], recent: [], lastAncestor: null };
}
function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object" || !shortId(raw.runId)) return null;
  return { runId: raw.runId, generation: integer(raw.generation, 1000000),
    speciesId: shortId(raw.speciesId) ? raw.speciesId : "unknown",
    tier: integer(raw.tier, 7), time: integer(raw.time), kills: integer(raw.kills),
    guardians: integer(raw.guardians), date: typeof raw.date === "string" ? raw.date.slice(0, 40) : "",
    genome: validGenome(raw.genome) ? normalizeGenome(raw.genome) : null,
    adaptations: acquiredAdaptations(raw.adaptations), discoveries: discoveryIds(raw.discoveries) };
}
export function normalizeAncestry(raw) {
  const ancestry = newAncestry();
  if (!raw || typeof raw !== "object") return ancestry;
  for (const id of ["generations", "totalSurvival", "longestLife", "highestTier", "guardianVictories"])
    ancestry[id] = integer(raw[id], id === "highestTier" ? 7 : id === "generations" ? 1000000 : 1e9);
  ancestry.discoveries = discoveryIds(raw.discoveries);
  const seen = new Set();
  ancestry.recent = (Array.isArray(raw.recent) ? raw.recent : []).map(normalizeRecord).filter((entry) => {
    if (!entry || seen.has(entry.runId)) return false;
    seen.add(entry.runId); return true;
  }).slice(0, 32);
  ancestry.lastAncestor = normalizeRecord(raw.lastAncestor) || ancestry.recent[0] || null;
  return ancestry;
}
/** Backups can restore a living checkpoint without erasing completed history.
 * Cumulative summaries use the larger value rather than summing overlapping
 * histories; individual records and discoveries are united by stable identity.
 */
export function mergeAncestry(first, second) {
  const a = normalizeAncestry(first), b = normalizeAncestry(second), merged = newAncestry();
  for (const id of ["generations", "totalSurvival", "longestLife", "highestTier", "guardianVictories"])
    merged[id] = Math.max(a[id], b[id]);
  merged.discoveries = unique([...a.discoveries, ...b.discoveries], 64);
  const byRun = new Map();
  for (const record of [...a.recent, ...b.recent, a.lastAncestor, b.lastAncestor].filter(Boolean)) {
    const prior = byRun.get(record.runId);
    if (!prior || record.generation > prior.generation || (!prior.genome && record.genome)) byRun.set(record.runId, record);
  }
  merged.recent = [...byRun.values()].sort((left, right) => right.generation - left.generation ||
    right.date.localeCompare(left.date) || left.runId.localeCompare(right.runId)).slice(0, 32);
  merged.lastAncestor = merged.recent[0] || null;
  return merged;
}
/** Only a completed life seeds the next one; living checkpoints confer nothing. */
export function ancestryOptions(profile) {
  const ancestry = normalizeAncestry(profile?.ancestry);
  return {
    ancestorGenome: ancestry.lastAncestor?.genome ? normalizeGenome(ancestry.lastAncestor.genome) : null,
    ancestorSpeciesId: ancestry.lastAncestor?.speciesId || null,
    generation: Math.min(1000000, ancestry.generations + 1),
  };
}
/** Invoked by profile.recordRun after its durable run-id completion check. */
export function recordAncestryRun(profile, results, date = new Date().toISOString()) {
  const ancestry = profile.ancestry = normalizeAncestry(profile.ancestry);
  const runId = shortId(results.runId) ? results.runId : `legacy:${integer(profile.runs)}`;
  if (ancestry.recent.some((entry) => entry.runId === runId) || ancestry.lastAncestor?.runId === runId) return null;
  const genome = validGenome(results.genome) ? normalizeGenome(results.genome) : null;
  const discoveries = unique([...discoveryIds(results.discoveries), ...phenotype(genome).discoveries], 64);
  const record = normalizeRecord({ ...results, runId,
    generation: Math.min(1000000, ancestry.generations + 1), genome,
    guardians: results.guardians ?? results.lineage?.guardians,
    adaptations: results.adaptations, discoveries, date });
  ancestry.generations = Math.min(1000000, ancestry.generations + 1);
  ancestry.totalSurvival = Math.min(1e9, ancestry.totalSurvival + record.time);
  ancestry.longestLife = Math.max(ancestry.longestLife, record.time);
  ancestry.highestTier = Math.max(ancestry.highestTier, record.tier);
  ancestry.guardianVictories = Math.min(1e9, ancestry.guardianVictories + record.guardians);
  ancestry.discoveries = unique([...ancestry.discoveries, ...discoveries], 64);
  ancestry.recent.unshift(record);
  ancestry.recent = ancestry.recent.slice(0, 32);
  ancestry.lastAncestor = record;
  return record;
}
export function ancestryDiscoveryName(id) {
  return GENETIC_DISCOVERIES[id]?.name || id.split("-").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}
