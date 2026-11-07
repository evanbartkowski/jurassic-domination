// Compact simulation data only. Founders and offspring use their own seeded
// stream, so creating a genome never changes combat, loot or world randomness.
export const GENE_IDS = Object.freeze([
  "mass", "stride", "endurance", "hide", "pigment", "pattern", "thermal",
  "aquatic", "alertness",
]);
export const ADAPTATIONS = Object.freeze({
  frost: { name: "Frost acclimation", threshold: 90, hint: "Survive 90 seconds of cold exposure." },
  cinder: { name: "Cinder acclimation", threshold: 90, hint: "Survive 90 seconds of volcanic heat." },
  water: { name: "Water acclimation", threshold: 75, hint: "Spend 75 seconds moving in water." },
  stealth: { name: "Silent hunter", threshold: 60, hint: "Travel unseen through cover for 60 seconds." },
});
export const GENETIC_DISCOVERIES = Object.freeze({
  "aurora-hide": { name: "Aurora Hide", description: "An unusual union of cold affinity and resilient scales." },
  "tidewalker": { name: "Tidewalker", description: "Exceptional aquatic affinity paired with endurance." },
  "ashen-veil": { name: "Ashen Veil", description: "Heat affinity and watchful instincts share one bloodline." },
});
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const plain = (o) => o !== null && typeof o === "object" && !Array.isArray(o) &&
  Object.getPrototypeOf(o) === Object.prototype;
const uint = (n) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
const integer = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

/** Stable across runtimes; suitable for identities, not security or encryption. */
export function geneticSeed(value) {
  const source = typeof value === "string" ? value : String(value ?? 0);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return hash >>> 0;
}
function randomFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
export function validGenome(raw) {
  return plain(raw) && raw.version === 1 && uint(raw.seed) &&
    integer(raw.generation, 0, 1000000) && (raw.parentSeed === null || uint(raw.parentSeed)) &&
    plain(raw.alleles) && GENE_IDS.every((id) => Object.hasOwn(raw.alleles, id) && integer(raw.alleles[id], -100, 100));
}
/** A migration genome preserves all existing sizes and stats in older lives. */
export function neutralGenome(seed = 0, generation = 0) {
  return { version: 1, seed: uint(seed) ? seed : geneticSeed(seed),
    generation: integer(generation, 0, 1000000) ? generation : 0, parentSeed: null,
    alleles: Object.fromEntries(GENE_IDS.map((id) => [id, 0])) };
}
/** Parent contribution is bounded and mean reverting, never a stacking bonus. */
export function makeGenome(seed, species, parent = null) {
  const speciesId = typeof species === "string" ? species : species?.id || "unknown";
  const source = geneticSeed(`${seed ?? 0}|${speciesId}`), random = randomFrom(source);
  const inherited = validGenome(parent), alleles = {};
  for (const id of GENE_IDS) {
    const founder = Math.floor(random() * 201) - 100;
    alleles[id] = inherited
      ? clamp(Math.round(parent.alleles[id] * .48 + founder * .52), -100, 100)
      : founder;
  }
  return { version: 1, seed: source,
    generation: inherited ? Math.min(1000000, parent.generation + 1) : 1,
    parentSeed: inherited ? parent.seed : null, alleles };
}
export function normalizeGenome(raw, fallbackSeed = 0, species = "unknown") {
  if (!validGenome(raw)) return makeGenome(fallbackSeed, species);
  return { version: 1, seed: raw.seed, generation: raw.generation,
    parentSeed: raw.parentSeed, alleles: Object.fromEntries(GENE_IDS.map((id) => [id, raw.alleles[id]])) };
}
/** Species determine anatomy; genes provide small individual tradeoffs. */
export function phenotype(genome) {
  const raw = validGenome(genome) ? genome.alleles : null;
  const gene = (id) => (raw?.[id] || 0) / 100;
  const mass = gene("mass"), stride = gene("stride"), endurance = gene("endurance"),
    hide = gene("hide"), thermal = gene("thermal"), aquatic = gene("aquatic"), alertness = gene("alertness");
  const adaptations = [];
  if (thermal >= .55) adaptations.push("frost");
  if (thermal <= -.55) adaptations.push("cinder");
  if (aquatic >= .55) adaptations.push("water");
  if (alertness >= .55) adaptations.push("stealth");
  const discoveries = [];
  if (thermal >= .8 && hide >= .7) discoveries.push("aurora-hide");
  if (aquatic >= .85 && endurance >= .8) discoveries.push("tidewalker");
  if (thermal <= -.8 && alertness >= .8) discoveries.push("ashen-veil");
  const pattern = gene("pattern");
  return {
    size: 1 + mass * .07,
    speed: 1 + stride * .025 - mass * .01 - hide * .005,
    staminaRecovery: 1 + endurance * .035 - stride * .015,
    staminaCost: 1 - endurance * .03 + mass * .02,
    resistance: hide * .025 - stride * .005,
    hue: gene("pigment") * .045,
    brightness: 1 + hide * .04 + gene("pigment") * .04,
    markings: pattern < -.5 ? "banded" : pattern > .5 ? "speckled" : pattern > 0 ? "striped" : "plain",
    adaptations,
    discoveries,
    discovery: discoveries[0] || null,
  };
}
export function newAdaptationState() {
  return { frost: 0, cinder: 0, water: 0, stealth: 0 };
}
export function normalizeAdaptations(raw) {
  const state = newAdaptationState();
  for (const id of Object.keys(ADAPTATIONS)) {
    // Older result records may contain only the earned ids rather than timers.
    if (Array.isArray(raw)) state[id] = raw.includes(id) ? ADAPTATIONS[id].threshold : 0;
    else if (Number.isFinite(raw?.[id])) state[id] = clamp(raw[id], 0, 100000);
  }
  return state;
}
export function acquiredAdaptations(raw) {
  const state = normalizeAdaptations(raw);
  return Object.keys(ADAPTATIONS).filter((id) => state[id] >= ADAPTATIONS[id].threshold);
}
export function exposureProgress(raw, kind) {
  return Object.hasOwn(ADAPTATIONS, kind) ? normalizeAdaptations(raw)[kind] : 0;
}
/** Call with authoritative elapsed seconds only while the condition is met. */
export function recordExposure(state, kind, seconds) {
  if (!plain(state) || !Object.hasOwn(ADAPTATIONS, kind) || !Number.isFinite(seconds) || seconds <= 0) return [];
  const previous = Number.isFinite(state[kind]) ? clamp(state[kind], 0, 100000) : 0;
  state[kind] = clamp(previous + seconds, 0, 100000);
  return previous < ADAPTATIONS[kind].threshold && state[kind] >= ADAPTATIONS[kind].threshold ? [kind] : [];
}
export function adaptationLabel(id) { return ADAPTATIONS[id]?.name || "Unknown adaptation"; }
