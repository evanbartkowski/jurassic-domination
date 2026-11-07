import { SKINS, PERMANENT_MODIFIERS } from "./content.js";
import { normalizeCollection, checkAchievements } from "./collections.js";
import { normalizeBindings } from "./controls.js";
import { newAncestry, normalizeAncestry, recordAncestryRun } from "./ancestry.js";
export const PROFILE_KEY = "jurassic-domination.profile.v1";
export const PROFILE_VERSION = 4;
export const SETTINGS_KEY = "jurassic-domination.settings.v1";
export const DEFAULT_SETTINGS = {
  master: 0.7,
  music: 0.55,
  sfx: 0.8,
  quality: "high",
  shake: true,
  showDamage: true,
  fullscreen: false,
  controls: normalizeBindings(),
  uiScale: 1,
  reducedMotion: false,
  gamepad: true,
};
export const UPGRADE_IDS = ["vitality", "instinct", "metabolism"];
export function newProfile() {
  return {
    version: PROFILE_VERSION,
    dna: 0,
    bestScore: 0,
    runs: 0,
    totalKills: 0,
    highestTier: 0,
    unlocked: [],
    hunted: [],
    skins: ["natural"],
    equippedSkin: "natural",
    modifiers: [],
    regions: [],
    upgrades: { vitality: 0, instinct: 0, metabolism: 0 },
    history: [],
    completedRuns: [],
    activeFindClaims: [],
    achievements: [],
    ancestry: newAncestry(),
    ...normalizeCollection(),
  };
}
const integer = (n, fallback = 0, max = 1e9) =>
  Number.isFinite(n) ? Math.max(0, Math.min(max, Math.floor(n))) : fallback;
export function normalizeProfile(raw) {
  const p = newProfile();
  if (!raw || typeof raw !== "object") return p;
  Object.assign(p, normalizeCollection(raw));
  for (const k of ["dna", "bestScore", "runs", "totalKills", "highestTier"])
    p[k] = integer(raw[k], 0, k === "highestTier" ? 7 : 1e9);
  p.hunted = [
    ...new Set(
      (Array.isArray(raw.hunted) ? raw.hunted : []).filter(
        (id) => typeof id === "string" && id.length < 80,
      ),
    ),
  ].slice(0, 512);
  p.unlocked = Array.isArray(raw.unlocked)
    ? [
        ...new Set(
          raw.unlocked.filter((s) => typeof s === "string" && s.length < 80),
        ),
      ].slice(0, 512)
    : [];
  p.achievements = Array.isArray(raw.achievements)
    ? [
        ...new Set(
          raw.achievements.filter(
            (s) => typeof s === "string" && s.length < 80,
          ),
        ),
      ].slice(0, 100)
    : [];
  p.skins = [
    "natural",
    ...new Set(
      (Array.isArray(raw.skins) ? raw.skins : []).filter(
        (id) => id !== "natural" && SKINS.some((s) => s.id === id),
      ),
    ),
  ];
  p.equippedSkin = p.skins.includes(raw.equippedSkin)
    ? raw.equippedSkin
    : "natural";
  p.modifiers = [
    ...new Set(
      (Array.isArray(raw.modifiers) ? raw.modifiers : []).filter((id) =>
        PERMANENT_MODIFIERS.some((m) => m.id === id),
      ),
    ),
  ];
  p.regions = [
    ...new Set(
      (Array.isArray(raw.regions) ? raw.regions : []).filter(
        (id) => typeof id === "string" && id.length < 40,
      ),
    ),
  ];
  for (const k of UPGRADE_IDS) p.upgrades[k] = integer(raw.upgrades?.[k], 0, 5);
  p.history = Array.isArray(raw.history)
    ? raw.history
        .filter((r) => r && typeof r === "object")
        .slice(0, 10)
        .map((r) => ({
          speciesId: typeof r.speciesId === "string" ? r.speciesId : "",
          score: integer(r.score),
          kills: integer(r.kills),
          tier: integer(r.tier, 0, 7),
          time: integer(r.time),
          date: typeof r.date === "string" ? r.date : "",
        }))
    : [];
  p.completedRuns = [...new Set((Array.isArray(raw.completedRuns) ? raw.completedRuns : []).filter(
    (id) => typeof id === "string" && id.length > 0 && id.length <= 160,
  ))].slice(-8192);
  // This ledger lasts for one living expedition. SaveStore rejects oversized
  // imports before normalization; never silently evict a valid live receipt.
  p.activeFindClaims = [...new Set((Array.isArray(raw.activeFindClaims) ? raw.activeFindClaims : []).filter(
    (id) => typeof id === "string" && id.length > 0 && id.length <= 160,
  ))];
  p.ancestry = normalizeAncestry(raw.ancestry);
  return p;
}
export function normalizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS, controls: normalizeBindings() };
  if (!raw || typeof raw !== "object") return s;
  for (const k of ["master", "music", "sfx"])
    if (Number.isFinite(raw[k])) s[k] = Math.max(0, Math.min(1, raw[k]));
  if (["low", "medium", "high"].includes(raw.quality)) s.quality = raw.quality;
  for (const k of ["shake", "showDamage"])
    if (typeof raw[k] === "boolean") s[k] = raw[k];
  s.controls = normalizeBindings(raw.controls);
  if (Number.isFinite(raw.uiScale)) s.uiScale = Math.max(0.85, Math.min(1.25, raw.uiScale));
  for (const k of ["reducedMotion", "gamepad"])
    if (typeof raw[k] === "boolean") s[k] = raw[k];
  return s;
}
export function loadData(storage) {
  let profile,
    settings,
    failed = false;
  try {
    profile = JSON.parse(storage.getItem(PROFILE_KEY) || "null");
  } catch {
    failed = true;
  }
  try {
    settings = JSON.parse(storage.getItem(SETTINGS_KEY) || "null");
  } catch {
    failed = true;
  }
  return {
    profile: normalizeProfile(profile),
    settings: normalizeSettings(settings),
    failed,
  };
}
export function unlockDiscovery(profile, type, id) {
  const field =
    type === "skin" ? "skins" : type === "modifier" ? "modifiers" : null;
  const pool = type === "skin" ? SKINS : PERMANENT_MODIFIERS;
  if (
    !field ||
    !pool.some((item) => item.id === id) ||
    profile[field].includes(id)
  )
    return false;
  profile[field].push(id);
  return true;
}
export function equipSkin(profile, id) {
  if (!profile.skins.includes(id) || !SKINS.some((s) => s.id === id))
    return false;
  profile.equippedSkin = id;
  return true;
}
export function saveData(storage, profile, settings) {
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
export function upgradeCost(level) {
  return 3 + level * 3;
}
export function purchaseUpgrade(profile, id) {
  if (!UPGRADE_IDS.includes(id) || profile.upgrades[id] >= 5) return false;
  const cost = upgradeCost(profile.upgrades[id]);
  if (profile.dna < cost) return false;
  profile.dna -= cost;
  profile.upgrades[id]++;
  return true;
}
export function recordRun(profile, results, date = new Date().toISOString()) {
  // A durable run identity makes a repeated terminal event idempotent after
  // a checkpoint recovery. Legacy callers without an id keep their old API.
  if (typeof results.runId === "string" && results.runId.length > 0 && results.runId.length <= 160) {
    profile.completedRuns ||= [];
    if (profile.completedRuns.includes(results.runId)) return [];
    profile.completedRuns.push(results.runId);
    profile.completedRuns = profile.completedRuns.slice(-8192);
  }
  profile.runs++;
  profile.bestScore = Math.max(profile.bestScore, integer(results.score));
  profile.totalKills += integer(results.kills);
  profile.highestTier = Math.max(
    profile.highestTier,
    integer(results.tier, 0, 7),
  );
  if (!profile.unlocked.includes(results.speciesId))
    profile.unlocked.push(results.speciesId);
  profile.history.unshift({ ...results, date });
  profile.history = profile.history.slice(0, 10);
  recordAncestryRun(profile, results, date);
  return checkAchievements(profile, {
    tier: results.tier,
    time: results.time,
  }).map((a) => a.id);
}
