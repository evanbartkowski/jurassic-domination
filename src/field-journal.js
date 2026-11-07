import { SPECIES_BY_ID } from "./data.js";
import { REGIONS } from "./world-data.js";
import { phenotype, ADAPTATIONS, GENETIC_DISCOVERIES, normalizeAdaptations, validGenome } from "./genetics.js";
import { normalizeAncestry, ancestryDiscoveryName } from "./ancestry.js";
import { LANDMARKS, hasDiscovery, discoveryStatus } from "./discoveries.js";
import { worldStatus } from "./world-events.js";
import { survivalStatus } from "./survival.js";

export const escapeJournalHTML = (value) => String(value ?? "").replace(/[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const esc = escapeJournalHTML;
const safe = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const percent = (value) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
const duration = (seconds) => `${Math.floor(safe(seconds) / 60)}m ${Math.floor(safe(seconds) % 60)}s`;
const integer = (n) => Math.floor(safe(n)).toLocaleString();
const nameOf = (id) => SPECIES_BY_ID[id]?.name || "Unknown ancestor";
const regionOf = (id) => REGIONS.find((region) => region.id === id)?.name || "Uncharted ground";
const swatch = (color) => `#${color.toString(16).padStart(6, "0")}`;
const symbol = (name) => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">${{
  spiral: '<path d="M8 3c0 13 16 13 16 26M24 3C24 16 8 16 8 29M9 7h14M11 12h10M11 20h10M9 25h14"/>',
  compass: '<circle cx="16" cy="16" r="12"/><path d="m20 10-3 8-5 4 3-8 5-4Z"/><path d="M16 1v4M16 27v4M1 16h4M27 16h4"/>',
  leaf: '<path d="M26 5C10 2 3 10 8 21c10 7 20-1 18-16ZM5 28 21 11M10 23v-9M16 17h9"/>',
  history: '<path d="M8 9A11 11 0 1 1 5 19M4 4v8h8M16 8v9l6 4"/>',
}[name]}</svg>`;
function stat(label, value, note = "") {
  return `<div class="field-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ""}</div>`;
}
function trait(label, value, detail, positiveGood = true) {
  return `<div class="field-trait"><span>${esc(label)}</span><strong class="${(value >= 0) === positiveGood ? "field-up" : "field-down"}">${percent(value)}</strong><small>${esc(detail)}</small></div>`;
}
function adaptationCards(game, traits) {
  const progress = normalizeAdaptations(game.player.adaptations);
  const descriptions = {
    frost: "Move through cold regions or hard frost.", cinder: "Move through volcanic heat or severe drought.",
    water: "Travel through water; aquatic forms move fastest there.", stealth: "Stalk through natural cover while holding H.",
  };
  return Object.entries(ADAPTATIONS).map(([id, definition]) => {
    const earned = progress[id] >= definition.threshold, inherited = traits.adaptations.includes(id),
      value = Math.min(definition.threshold, progress[id]), ratio = value / definition.threshold;
    return `<article class="field-adaptation ${earned ? "earned" : ""}"><div><h3>${esc(definition.name)}</h3><span>${earned ? "ACQUIRED" : inherited ? "INHERITED AFFINITY" : "DEVELOPING"}</span></div><p>${esc(descriptions[id])}</p><progress value="${value}" max="${definition.threshold}" aria-label="${esc(definition.name)} exposure progress">${Math.round(ratio * 100)}%</progress><footer><strong>${Math.floor(value)} / ${definition.threshold}s</strong><span>${earned ? "Carried for this life" : inherited ? "Affinity already supports survival" : "Progress while moving above 40% health"}</span></footer></article>`;
  }).join("");
}
function landmarksHTML(game) {
  return LANDMARKS.map((site, index) => {
    const found = hasDiscovery(game, site.id);
    return `<article class="field-site ${found ? "discovered" : ""}" style="--site-color:${swatch(site.color)}"><div class="field-site-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</div><div><div class="field-site-meta"><span>${esc(regionOf(site.regionId))}</span><b>${found ? "RECORDED" : "FIELD LEAD"}</b></div><h3>${found ? esc(site.name) : `Uncharted ${site.kind === "fossil" ? "fossil" : site.kind === "ruin" ? "ruins" : "standing stones"}`}</h3><p>${esc(found ? site.lore : site.hint)}</p>${found ? `<small>${esc(site.kind.replaceAll("-", " "))} · ${Math.round(Math.abs(site.x))} ${site.x < 0 ? "west" : "east"}, ${Math.round(Math.abs(site.y))} ${site.y < 0 ? "north" : "south"}</small>` : ""}</div></article>`;
  }).join("");
}
function ancestryHTML(ancestry) {
  if (!ancestry.recent.length) return '<p class="field-empty">Your bloodline begins here. A completed life will leave the first record.</p>';
  return `<details class="field-ancestry"><summary>Open ${ancestry.recent.length} recent ${ancestry.recent.length === 1 ? "life" : "lives"}<span>Up to 32 completed records</span></summary><ol>${ancestry.recent.map((record) => `<li><span class="field-generation">${String(record.generation).padStart(2, "0")}</span><div><h3>${esc(nameOf(record.speciesId))}</h3><p>Tier ${record.tier + 1} · ${duration(record.time)} · ${integer(record.kills)} kills · ${integer(record.guardians)} guardians</p>${record.adaptations.length ? `<small>${record.adaptations.map((id) => esc(ADAPTATIONS[id]?.name || id)).join(" · ")}</small>` : ""}</div></li>`).join("")}</ol></details>`;
}
function legacyJournalHTML(profile) {
  const ancestry = normalizeAncestry(profile.ancestry);
  const discoveries = ancestry.discoveries.map((id) => {
    const site = LANDMARKS.find((landmark) => landmark.id === id), genetic = GENETIC_DISCOVERIES[id];
    return `<article class="field-site discovered"><div><div class="field-site-meta"><span>COMPLETED-LIFE RECORD</span></div><h3>${esc(site?.name || genetic?.name || ancestryDiscoveryName(id))}</h3><p>${esc(site?.lore || genetic?.description || "A discovery remembered by your ancestors.")}</p></div></article>`;
  }).join("");
  return `<div class="field-journal"><div class="field-hero"><div><p class="field-kicker">THE BLOODLINE CONTINUES</p><h2>Your ancestral record</h2><p class="field-hero-sub">Completed lives, lasting discoveries and the generations they shaped.</p></div></div><div class="field-stats">${stat("Completed lives", integer(ancestry.generations))}${stat("Longest life", duration(ancestry.longestLife))}${stat("Highest legacy tier", ancestry.generations ? ancestry.highestTier + 1 : "Unrecorded")}${stat("Guardian victories", integer(ancestry.guardianVictories))}</div><p class="field-intro">A completed life can influence the next hatchling through small inherited tradeoffs. Begin a life to open its individual field notes, exposure progress and exploration map.</p>${ancestryHTML(ancestry)}<section class="field-section"><div class="field-section-heading"><span>${symbol("compass")}</span><div><p class="field-kicker">MEMORIES THAT REMAIN</p><h2>Inherited discoveries</h2></div></div>${discoveries ? `<div class="field-sites">${discoveries}</div>` : '<p class="field-empty">Your ancestors have yet to record a discovery.</p>'}</section><footer class="field-footer"><span>These records describe completed lives.</span><span>Living maps and acquired adaptations belong to each current life.</span></footer></div>`;
}

/** Pure view builder. The caller owns opening/closing and simulation pause. */
export function fieldJournalHTML(game, profile = {}) {
  if (!game?.player || !game.species) return legacyJournalHTML(profile);
  const p = game.player, traits = phenotype(p.genome), ancestry = normalizeAncestry(profile.ancestry),
    exploration = discoveryStatus(game), weather = worldStatus(game), survival = survivalStatus(game),
    generation = validGenome(p.genome) ? p.genome.generation : ancestry.generations + 1,
    unusual = traits.discoveries.map((id) => GENETIC_DISCOVERIES[id]).filter(Boolean),
    inheritedDiscoveries = ancestry.discoveries.filter((id) => Object.hasOwn(GENETIC_DISCOVERIES, id));
  return `<div class="field-journal">
    <div class="field-hero"><div class="field-portrait"><img src="assets/portraits/species-${esc(p.speciesId)}.webp" alt="${esc(game.species.name)}" decoding="async"/></div><div><p class="field-kicker">A LIFE WORTH REMEMBERING</p><h2>${esc(game.species.name)}</h2><p class="field-hero-sub">Generation ${integer(generation)} · Tier ${game.tier + 1} · ${duration(game.time)} alive</p><div class="field-pills"><span>${esc(survival.label)}</span><span>${esc(traits.markings)} markings</span><span>${esc(weather.season)}</span></div></div><div class="field-page-mark" aria-hidden="true">FIELD<br/>NOTES<span>01-04</span></div></div>
    <div class="field-observation"><span>${symbol("compass")}</span><div><strong>${esc(weather.label)}</strong><p>${esc(weather.detail)}</p></div></div>
    <section class="field-section" aria-labelledby="field-genetics-heading"><div class="field-section-heading"><span>${symbol("spiral")}</span><div><p class="field-kicker">01 / INDIVIDUAL VARIATION</p><h2 id="field-genetics-heading">Written in your scales</h2></div></div><p class="field-intro">Species define your anatomy. Inherited genes add small differences in size, movement, endurance and resistance. Parent traits blend with fresh variation each generation.</p><div class="field-traits">${trait("Body size", traits.size - 1, "Relative to your species and growth")}${trait("Movement", traits.speed - 1, "Stride, mass and hide tradeoffs")}${trait("Stamina recovery", traits.staminaRecovery - 1, "Endurance balanced against stride")}${trait("Stamina cost", traits.staminaCost - 1, "Lower cost sustains long pursuits", false)}${trait("Damage resistance", traits.resistance, "Added resistance from resilient hide")}</div><p class="field-note">Appearance: ${esc(traits.markings)} markings, ${traits.hue === 0 ? "balanced" : traits.hue < 0 ? "cooler" : "warmer"} pigment, ${percent(traits.brightness - 1)} brightness. Growth, evolution and genes combine to shape your current body.</p>${unusual.length ? `<div class="field-genetic-find"><strong>Extraordinary genetic discovery</strong>${unusual.map((find) => `<h3>${esc(find.name)}</h3><p>${esc(find.description)}</p>`).join("")}</div>` : ""}<div class="field-adaptations">${adaptationCards(game, traits)}</div><p class="field-note">Acquired adaptations belong to this life. Bloodline conditions and evolution decisions are recorded in the <kbd>J</kbd> bloodline journal.</p></section>
    <section class="field-section" aria-labelledby="field-survival-heading"><div class="field-section-heading"><span>${symbol("leaf")}</span><div><p class="field-kicker">02 / READ THE ENVIRONMENT</p><h2 id="field-survival-heading">Instinct keeps you alive</h2></div></div><div class="field-stats">${stat("Movement", survival.mode.replaceAll("-", " "))}${stat("Exposure", Math.abs(survival.temperature) < .2 ? "Comfortable" : survival.temperature < 0 ? "Cold" : "Hot", `${Math.round(Math.abs(survival.temperature) * 100)}% strain from temperature`)}${stat("Fatigue", `${Math.round(survival.fatigue)}%`, "Walking and rest restore endurance")}${stat("Injury recovery", survival.strain > 0 ? `${survival.strain.toFixed(1)}s` : "Recovered", "Rest with food to recover faster")}</div><div class="field-survival-grid"><article><h3><kbd>H</kbd> Stalk & dive</h3><p>Hold H to move quietly and reduce your profile. Cover breaks sight; wind carries scent. Aquatic and amphibious creatures can dive while holding H in water.</p></article><article><h3>Follow the living ground</h3><p>Rain washes scent away and encourages forage. Floods slow travel. Drought thins food. Hard frost and heat reward suitable adaptations and a change of route.</p></article><article><h3>Read the warning circle</h3><p>Grassfires, volcanic fallout and rare meteors mark fixed danger zones before activation. Move clear of the circle. Burned ground supports less new forage while it recovers.</p></article><article><h3>Choose the right body</h3><p>Aquatic forms excel in water; crocodilian forms travel both habitats. Wing-assisted forms retain ground navigation. Full vertical flight, deep ocean layers and burrowing remain future exploration systems.</p></article></div></section>
    <section class="field-section" aria-labelledby="field-discovery-heading"><div class="field-section-heading"><span>${symbol("compass")}</span><div><p class="field-kicker">03 / A WORLD WITH A MEMORY</p><h2 id="field-discovery-heading">Sites & stories</h2></div><span class="field-count">${exploration.found} / ${exploration.total} FOUND</span></div><p class="field-intro">The map reveals nearby ground as you travel. These landmarks occupy fixed reachable locations in every world. Following a field lead can uncover lore and open new ancestry possibilities.</p><div class="field-map-progress"><span>Explored ground</span><progress value="${exploration.coverage * 100}" max="100" aria-label="Explored map cells">${Math.round(exploration.coverage * 100)}%</progress><strong>${Math.round(exploration.coverage * 100)}%</strong></div><div class="field-sites">${landmarksHTML(game)}</div></section>
    <section class="field-section" aria-labelledby="field-ancestry-heading"><div class="field-section-heading"><span>${symbol("history")}</span><div><p class="field-kicker">04 / THE BLOODLINE CONTINUES</p><h2 id="field-ancestry-heading">Those who came before</h2></div></div><p class="field-intro">Completed lives become ancestry records and may influence the next hatchling. Inheritance keeps its small tradeoffs across generations. Your living dinosaur's map, injuries and acquired adaptations stay with its current life.</p><div class="field-stats">${stat("Completed lives", integer(ancestry.generations))}${stat("Longest life", duration(ancestry.longestLife))}${stat("Highest legacy tier", ancestry.generations ? ancestry.highestTier + 1 : "Unrecorded")}${stat("Guardian victories", integer(ancestry.guardianVictories))}</div>${inheritedDiscoveries.length ? `<p class="field-note">Genetic discoveries recorded by ancestors: ${inheritedDiscoveries.map((id) => esc(ancestryDiscoveryName(id))).join(" · ")}.</p>` : ""}${ancestryHTML(ancestry)}</section>
    <footer class="field-footer"><span>Each step becomes part of this life.</span><span><kbd>M</kbd> Map &nbsp; <kbd>J</kbd> Bloodlines &nbsp; <kbd>L</kbd> Field journal</span></footer>
  </div>`;
}
