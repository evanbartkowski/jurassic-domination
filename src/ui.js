import { SPECIES, MUTATIONS, TIERS, MUTATION_RARITIES } from "./data.js";
import {
  BUILD_CATEGORIES,
  BUILD_MUTATIONS,
  MUTATION_SYNERGIES,
  calculateBuildPower,
  renderStars,
} from "./build-system.js";
import {
  ABILITIES,
  TECHNIQUES,
  SKINS,
  PERMANENT_MODIFIERS,
  POWERUPS,
  RUN_SKILLS,
} from "./content.js";
import {
  BLOODLINES,
  eligibleBloodlines,
  EVOLUTION_RARITIES,
  creatureKit,
  SPECIALS,
  growthName,
  getActiveAffinities,
  getAffinityForSpecies,
} from "./progression.js";
import { REGIONS } from "./world-data.js";
import { upgradeCost } from "./profile.js";
import {
  CATALOG,
  SHOP_ITEMS,
  PETS,
  DECORATIONS,
  ACHIEVEMENTS,
  RARITIES,
} from "./collection-data.js";
import { ISLAND_TRIALS, sanctuaryProgress } from "./sanctuary.js";
import { ownedCount, availableCount } from "./collections.js";
import { dietName } from "./forage.js";
import { ACTIONS, DEFAULT_BINDINGS, keyLabel, rebind } from "./controls.js";
import { fieldJournalHTML } from './field-journal.js';
import { evaluateObjectives, getSurvivalHint, evaluateDanger, evaluateRegionHazard } from "./tutorial.js";

const $ = (selector, parent = document) => parent.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const modelMood = (p, a) =>
  `${p.island.care?.[a.itemId] || 0} lasting bonds  -  Safe, curious and at home.`;
const portrait = (id, kind = "species") =>
  `<img class="rendered-icon" src="assets/portraits/${kind}-${id}.webp" alt="" loading="lazy" decoding="async"/>`;
const number = (value = 0) => Math.floor(value).toLocaleString();
const clock = (seconds = 0) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
const species = (id) =>
  SPECIES.find((entry) => entry.id === (typeof id === "object" ? id.id : id)) ||
  SPECIES[0];
const tierName = (tier) =>
  typeof TIERS[tier] === "string"
    ? TIERS[tier]
    : TIERS[tier]?.name || `Tier ${tier + 1}`;
const icons = {
  claw: '<path d="M5 20C5 10 7 4 11 2c-1 7-1 10 1 12M11 21c1-8 3-13 7-16-2 8-2 11-1 14M17 22c1-5 3-8 5-9-1 5-1 7-1 9"/>',
  dna: '<path d="M7 2c0 10 10 10 10 20M17 2C17 12 7 12 7 22M8 5h8M9 9h6M9 15h6M8 19h8"/>',
  heart:
    '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  leaf: '<path d="M20 3C8 2 2 7 5 14c3 8 15 5 15-11ZM4 21 15 10M8 16v-5M12 12h5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  cross: '<path d="m6 6 12 12M6 18 18 6"/>',
  settings:
    '<path d="m9 3-1 3-3 1 1 4-1 3 3 3 1 4h6l1-4 3-3-1-3 1-4-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  skull:
    '<path d="M5 14a9 9 0 1 1 14 0l-2 2v5H7v-5l-2-2Z"/><circle cx="8" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/><path d="m10 15 2-2 2 2M10 18v3M14 18v3"/>',
  book: '<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15"/>',
  trophy:
    '<path d="M7 3h10v6a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 5 4M17 5h4v3a4 4 0 0 1-5 4M12 14v6M8 21h8"/>',
};
const icon = (name, cls = "") =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.claw}</svg>`;
const silhouettes = {
  raptor:
    "M7 50 20 39 33 35 47 23 64 23 74 15 88 16 94 23 79 29 68 30 65 40 72 48 70 53 63 48 58 42 52 46 60 60 54 65 47 65 50 60 42 49 34 48 29 60 24 63 16 63 23 57 25 44Z",
  rex: "M4 47 24 38 40 32 55 19 70 13 91 15 96 28 86 34 72 32 67 40 73 46 68 50 61 43 53 48 61 63 56 69 45 69 49 63 40 49 31 49 26 65 15 65 21 59 22 45Z",
  quad: "M4 44 14 35 32 27 56 25 72 29 80 23 84 10 87 24 95 31 96 42 87 48 78 45 73 60 65 60 65 44 37 47 30 62 22 62 23 46Z",
  longneck:
    "M4 41 22 35 41 33 52 29 61 19 65 5 73 3 79 7 74 14 72 31 65 43 64 63 57 63 54 47 33 47 28 62 20 62 21 44Z",
  dragon:
    "M4 52 24 42 37 35 33 14 46 26 49 5 59 29 71 25 83 12 88 18 98 22 90 31 77 33 67 42 74 61 64 65 59 49 44 49 35 63 24 63 28 49Z",
  bird: "M4 37 20 32 35 23 47 13 49 27 62 20 75 6 84 10 80 18 96 20 85 27 74 26 63 40 53 45 57 62 50 66 42 66 45 59 40 44 23 47 18 43Z",
  equine:
    "M5 52Q13 26 24 33L52 33L66 16L71 8L74 18L85 26L98 27L94 35L80 35L70 44L74 65L67 65L61 45L37 46L31 66L24 66L25 46L18 41L12 59Z M78 23L87 4L84 26Z",
  serpent:
    "M2 58Q20 70 41 50Q66 24 51 18Q38 16 40 29L30 30Q24 5 47 5Q80 5 72 30Q65 44 48 53Q34 64 49 66Q70 70 79 46L74 38L80 30L94 30L100 37L92 44Q87 73 57 75Q28 78 28 64Q11 68 2 58Z",
  croc: "M1 47L27 39L55 38L73 32L98 35L99 41L79 46L64 49L70 60L62 62L53 49L36 50L31 62L23 60L28 48Z",
  gryphon:
    "M3 52L19 39L39 32L35 9L53 25L63 6L69 26L78 19L88 20L98 28L86 30L80 43L72 45L76 65L68 65L62 48L40 47L34 65L26 65L28 47L18 47L11 59Z",
};
const animal = (s) =>
  `<svg class="animal" viewBox="0 0 100 76" aria-hidden="true"><path d="${silhouettes[s?.body] || silhouettes.raptor}" fill="currentColor"/></svg>`;
const small = (key, text) =>
  `<span class="key-help"><kbd>${key}</kbd><span>${text}</span></span>`;
const skillSummary = (s) => {
  const kit = creatureKit(s);
  return [kit.ability && `Q · ${s.ability}`, kit.technique && `R · ${TECHNIQUES[kit.technique].name}`, kit.special && `X · ${SPECIALS[kit.special].name}`].filter(Boolean).join(" / ") || "INSTINCT ONLY · BITE & SURVIVE";
};

export function computeUpgradeDiff(m, currentLvl, nextLvl) {
  const isUpgrade = currentLvl > 0;
  const bm = BUILD_MUTATIONS[m.id] || m;
  const curr = bm.levels?.[currentLvl - 1];
  const next = bm.levels?.[nextLvl - 1] || curr || {};

  const deltas = [];

  if (isUpgrade && curr) {
    if (next.damage !== undefined && curr.damage !== undefined && next.damage !== curr.damage) {
      deltas.push({ label: "Damage", from: `${curr.damage}`, to: `${next.damage}`, delta: `+${next.damage - curr.damage}` });
    }
    if (next.cooldown !== undefined && curr.cooldown !== undefined && next.cooldown !== curr.cooldown) {
      deltas.push({ label: "Cooldown", from: `${curr.cooldown}s`, to: `${next.cooldown}s`, delta: `-${(curr.cooldown - next.cooldown).toFixed(1)}s` });
    }
    if (next.bleedDmg !== undefined && curr.bleedDmg !== undefined && next.bleedDmg !== curr.bleedDmg) {
      deltas.push({ label: "Bleed Dmg", from: `${Math.round(curr.bleedDmg * 100)}%`, to: `${Math.round(next.bleedDmg * 100)}%`, delta: `+${Math.round((next.bleedDmg - curr.bleedDmg) * 100)}%` });
    }
    if (next.bleedRate !== undefined && curr.bleedRate !== undefined && next.bleedRate !== curr.bleedRate) {
      deltas.push({ label: "Laceration", from: `${Math.round(curr.bleedRate * 100)}%`, to: `${Math.round(next.bleedRate * 100)}%`, delta: `+${Math.round((next.bleedRate - curr.bleedRate) * 100)}%` });
    }
    if (next.arcs !== undefined && curr.arcs !== undefined && next.arcs !== curr.arcs) {
      deltas.push({ label: "Chain Foes", from: `${curr.arcs}`, to: `${next.arcs}`, delta: `+${next.arcs - curr.arcs}` });
    }
    if (next.projectiles !== undefined && curr.projectiles !== undefined && next.projectiles !== curr.projectiles) {
      deltas.push({ label: "Projectiles", from: `${curr.projectiles}`, to: `${next.projectiles}`, delta: `+${next.projectiles - curr.projectiles}` });
    }
    if (next.tailDmg !== undefined && curr.tailDmg !== undefined && next.tailDmg !== curr.tailDmg) {
      deltas.push({ label: "Tail Sweep", from: `${Math.round(curr.tailDmg * 100)}%`, to: `${Math.round(next.tailDmg * 100)}%`, delta: `+${Math.round((next.tailDmg - curr.tailDmg) * 100)}%` });
    }
    if (next.impactDmg !== undefined && curr.impactDmg !== undefined && next.impactDmg !== curr.impactDmg) {
      deltas.push({ label: "Impact Dmg", from: `${curr.impactDmg}`, to: `${next.impactDmg}`, delta: `+${next.impactDmg - curr.impactDmg}` });
    }
    if (next.coneDmg !== undefined && curr.coneDmg !== undefined && next.coneDmg !== curr.coneDmg) {
      deltas.push({ label: "Flame Dmg", from: `${curr.coneDmg}`, to: `${next.coneDmg}`, delta: `+${next.coneDmg - curr.coneDmg}` });
    }
    if (next.hpBonus !== undefined && curr.hpBonus !== undefined && next.hpBonus !== curr.hpBonus) {
      deltas.push({ label: "Max HP", from: `+${Math.round(curr.hpBonus * 100)}%`, to: `+${Math.round(next.hpBonus * 100)}%`, delta: `+${Math.round((next.hpBonus - curr.hpBonus) * 100)}%` });
    }
    if (next.dmgReduct !== undefined && curr.dmgReduct !== undefined && next.dmgReduct !== curr.dmgReduct) {
      deltas.push({ label: "Dampening", from: `${Math.round(curr.dmgReduct * 100)}%`, to: `${Math.round(next.dmgReduct * 100)}%`, delta: `+${Math.round((next.dmgReduct - curr.dmgReduct) * 100)}%` });
    }
    if (next.reflect !== undefined && curr.reflect !== undefined && next.reflect !== curr.reflect) {
      deltas.push({ label: "Deflect", from: `${Math.round(curr.reflect * 100)}%`, to: `${Math.round(next.reflect * 100)}%`, delta: `+${Math.round((next.reflect - curr.reflect) * 100)}%` });
    }
    if (next.armor !== undefined && curr.armor !== undefined && next.armor !== curr.armor) {
      deltas.push({ label: "Armor", from: `+${Math.round(curr.armor * 100)}%`, to: `+${Math.round(next.armor * 100)}%`, delta: `+${Math.round((next.armor - curr.armor) * 100)}%` });
    }
    if (next.barrier !== undefined && curr.barrier !== undefined && next.barrier !== curr.barrier) {
      deltas.push({ label: "Aegis", from: `${Math.round(curr.barrier * 100)}%`, to: `${Math.round(next.barrier * 100)}%`, delta: `+${Math.round((next.barrier - curr.barrier) * 100)}%` });
    }
    if (next.critChance !== undefined && curr.critChance !== undefined && next.critChance !== curr.critChance) {
      deltas.push({ label: "Crit Chance", from: `${Math.round(curr.critChance * 100)}%`, to: `${Math.round(next.critChance * 100)}%`, delta: `+${Math.round((next.critChance - curr.critChance) * 100)}%` });
    }
    if (next.critMult !== undefined && curr.critMult !== undefined && next.critMult !== curr.critMult) {
      deltas.push({ label: "Crit Multi", from: `${curr.critMult}x`, to: `${next.critMult}x`, delta: `+${(next.critMult - curr.critMult).toFixed(1)}x` });
    }
    if (next.speed !== undefined && curr.speed !== undefined && next.speed !== curr.speed) {
      deltas.push({ label: "Move Speed", from: `+${Math.round(curr.speed * 100)}%`, to: `+${Math.round(next.speed * 100)}%`, delta: `+${Math.round((next.speed - curr.speed) * 100)}%` });
    }
    if (next.slow !== undefined && curr.slow !== undefined && next.slow !== curr.slow) {
      deltas.push({ label: "Slow Power", from: `${Math.round(curr.slow * 100)}%`, to: `${Math.round(next.slow * 100)}%`, delta: `+${Math.round((next.slow - curr.slow) * 100)}%` });
    }

    if (next.toxicPool && !curr.toxicPool) deltas.push({ tag: "🧪 Lingering Toxic Pools" });
    if (next.electrocute && !curr.electrocute) deltas.push({ tag: "⚡ Electrocution Stun" });
    if (next.fullCircle && !curr.fullCircle) deltas.push({ tag: "🌀 360° Tail Spin Sweep" });
    if (next.armorShatter && !curr.armorShatter) deltas.push({ tag: "🛡️ Shatters Enemy Armor" });
    if (next.trample && !curr.trample) deltas.push({ tag: "🦏 Trample Through Prey" });
    if (next.fireExplosion && !curr.fireExplosion) deltas.push({ tag: "🔥 Fiery Nova Blast" });
    if (next.flashFreeze && !curr.flashFreeze) deltas.push({ tag: "❄️ Instant Flash Freeze" });
    if (next.semicircle && !curr.semicircle) deltas.push({ tag: "🪓 180° Cleave Arc" });
  } else {
    if (next.damage) deltas.push({ tag: `⚔️ Base ${next.damage} Damage` });
    if (next.bleedDmg) deltas.push({ tag: `🩸 +${Math.round(next.bleedDmg * 100)}% Bleed over ${next.duration || 3}s` });
    if (next.cooldown) deltas.push({ tag: `⏱️ ${next.cooldown}s Cooldown` });
    if (next.hpBonus) deltas.push({ tag: `❤️ +${Math.round(next.hpBonus * 100)}% Max HP` });
    if (next.dmgReduct) deltas.push({ tag: `🛡️ -${Math.round(next.dmgReduct * 100)}% Damage Taken` });
    if (next.speed) deltas.push({ tag: `⚡ +${Math.round(next.speed * 100)}% Move Speed` });
    if (next.critChance) deltas.push({ tag: `🎯 +${Math.round(next.critChance * 100)}% Crit (${next.critMult || 1.5}x)` });
    if (deltas.length === 0) deltas.push({ tag: "🧬 New Genetic Trait" });
  }

  return deltas;
}

export function renderCardDiffsHTML(deltas) {
  if (!deltas || deltas.length === 0) return "";
  return `
    <div class="card-upgrade-deltas">
      <div class="deltas-title">WHAT THIS CHANGES:</div>
      <div class="deltas-list">
        ${deltas.map((d) => {
          if (d.tag) {
            return `<div class="delta-tag-pill">${esc(d.tag)}</div>`;
          }
          return `
            <div class="delta-row">
              <span class="delta-label">${esc(d.label)}</span>
              <span class="delta-values">${esc(d.from)} <i class="delta-arrow">➔</i> <b>${esc(d.to)}</b></span>
              <span class="delta-badge">${esc(d.delta)}</span>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

export function renderRankBadgeHTML(currentLvl, nextLvl, isUpgrade) {
  const maxLvl = 5;
  const pips = [];
  for (let i = 1; i <= maxLvl; i++) {
    if (isUpgrade) {
      if (i <= currentLvl) pips.push(`<span class="rank-pip filled">★</span>`);
      else if (i === nextLvl) pips.push(`<span class="rank-pip target" title="Target Rank">★</span>`);
      else pips.push(`<span class="rank-pip empty">☆</span>`);
    } else {
      if (i === 1) pips.push(`<span class="rank-pip filled new-pip">★</span>`);
      else pips.push(`<span class="rank-pip empty">☆</span>`);
    }
  }

  return `
    <div class="card-rank-wrap ${isUpgrade ? "upgrading" : "new"}">
      <div class="rank-labels">
        ${isUpgrade ? `
          <span class="rank-badge curr">RANK ${currentLvl}</span>
          <span class="rank-transition-arrow">➔</span>
          <span class="rank-badge next">RANK ${nextLvl}</span>
        ` : `
          <span class="rank-badge new-discovery">NEW UNLOCK</span>
          <span class="rank-badge next">RANK 1</span>
        `}
      </div>
      <div class="rank-pips">${pips.join("")}</div>
    </div>
  `;
}

export function attach3DTilt(element) {
  element.addEventListener("pointermove", (e) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -11;
    const rotateY = ((x - centerX) / centerX) * 11;
    const mouseXPercent = (x / rect.width) * 100;
    const mouseYPercent = (y / rect.height) * 100;

    element.style.setProperty("--mouse-x", `${mouseXPercent.toFixed(1)}%`);
    element.style.setProperty("--mouse-y", `${mouseYPercent.toFixed(1)}%`);
    element.style.transform = `perspective(850px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(14px) scale3d(1.025, 1.025, 1.025)`;
  });

  element.addEventListener("pointerleave", () => {
    element.style.transform = "";
    element.style.setProperty("--mouse-x", "50%");
    element.style.setProperty("--mouse-y", "50%");
  });
}

export class UI {
  constructor(callbacks, profile, settings) {
    this.callbacks = callbacks;
    this.profile = profile;
    this.settings = settings;
    this.overlay = $("#overlay");
    this.hud = $("#hud");
    this._view = "menu";
    this.returnView = "menu";
    this.difficulty = "survival";
    this.lastHud = 0;
    this.toastTimer = null;
    this.buildHUD();
    this.showMenu(profile);
  }

  get view() {
    return this._view;
  }

  bind(action, fn) {
    this.overlay
      .querySelectorAll(`[data-action="${action}"]`)
      .forEach((element) => element.addEventListener("click", fn));
  }

  screen(view, html, className = "") {
    this.bindingTarget = null;
    this._view = view;
    this.overlay.hidden = false;
    this.overlay.className = `overlay ${className}`;
    this.overlay.innerHTML = html;
    this.overlay.scrollTop = 0;
    this.overlay.querySelector("[data-focus]")?.focus({ preventScroll: true });
  }

  header(eyebrow, title, subtitle = "") {
    return `<header class="panel-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${subtitle ? `<p class="panel-subtitle">${subtitle}</p>` : ""}</div><button class="icon-button" data-action="back" aria-label="Go back">${icon("cross")}</button></header>`;
  }

  showMenu(profile = this.profile) {
    this.profile = profile;
    this.hud.hidden = true;
    this.returnView = "menu";
    this.screen(
      "menu",
      `
      <div class="menu-art" aria-hidden="true"></div><div class="menu-grain" aria-hidden="true"></div>
      <div class="menu-shell">
        <header class="menu-top"><span class="brand-mark">${icon("claw")}<span>JURASSIC DOMINATION</span></span><button class="icon-button" data-action="settings" aria-label="Open settings">${icon("settings")}</button></header>
        <div class="menu-main">
          <div class="menu-copy"><p class="eyebrow"><span class="gold-line"></span> THE WILD REMEMBERS YOUR BLOODLINE</p>
            <h1 class="game-title"><span>JURASSIC</span><span>DOMINATION<span class="title-dot">.</span></span></h1>
            <p class="menu-description">One fragile egg. An untamed continent.<br>Become a legend. Build a home.</p>
            <div class="menu-chapter"><span>THE LIVING PREHISTORIC WORLD</span><b>${SPECIES.length} FORMS · GENETICS · ANCIENT DISCOVERIES</b></div>
            <div class="menu-actions">${this.savedRun ? `<div class="save-summary"><strong>${esc(this.savedRun.name)}</strong><small>TIER ${this.savedRun.tier + 1} · ${clock(this.savedRun.time)} SURVIVED · ${esc(this.savedRun.difficulty.toUpperCase())}</small></div><button class="button primary continue-button" data-action="continue" data-focus>CONTINUE THIS LIFE ${icon("arrow")}</button>` : ""}<button class="button ${this.savedRun ? "secondary" : "primary"} play-button" data-action="start" ${this.savedRun ? "" : "data-focus"}><span>${icon("claw")} BEGIN A NEW LIFE</span>${icon("arrow")}</button>
              <div class="secondary-actions"><button class="button quiet" data-action="tutorial">${icon("book")} HOW TO SURVIVE</button><button class="button quiet" data-action="guide">ENCYCLOPEDIA ${icon("arrow")}</button></div>
              <button class="legacy-link" data-action="legacy">${icon("dna")}<span>THE ANCESTRAL LEGACY <b>${number(profile.dna)} DNA</b></span>${icon("arrow")}</button>
              <button class="cosmetic-link" data-action="field-journal">FIELD JOURNAL & GENERATIONS <span>${profile.ancestry?.generations || 0} ANCESTORS</span></button>
              <button class="cosmetic-link" data-action="wardrobe">APPEARANCE & ANCIENT RELICS <span>${(profile.skins || ["natural"]).length} SKINS</span></button>
              <div class="collection-entrances"><button data-action="shop">${icon("dna")} DNA SHOP <b>${number(profile.dna)}</b></button><button data-action="island">${icon("leaf")} MY DINOSAUR ISLAND</button></div>
            </div>
            <div class="difficulty-picker" role="group" aria-label="Difficulty"><span>WORLD</span>${[
              ["explorer", "EXPLORER"],
              ["survival", "SURVIVAL"],
              ["extinction", "EXTINCTION"],
            ]
              .map(
                ([id, text]) =>
                  `<button data-difficulty="${id}" aria-pressed="${this.difficulty === id}" class="${this.difficulty === id ? "selected" : ""}">${text}</button>`,
              )
              .join("")}</div>
            <p class="difficulty-description">${this.difficultyText()}</p>
          </div>
          <div class="menu-art-caption"><span class="caption-number">01 / THE FIRST BREATH</span><p>HATCH.<br>HUNT.<br><em>EVOLVE.</em></p><span class="caption-rule"></span><span class="caption-small">THE FOOD CHAIN HAS NO MERCY.</span></div>
        </div>
        <footer class="menu-footer"><div class="menu-record"><span>BEST RUN <strong>${number(profile.bestScore)}</strong></span><span>LIVES LIVED <strong>${number(profile.runs)}</strong></span><span>SPECIES DISCOVERED <strong>${new Set([...(profile.unlocked || []), ...(profile.hunted || [])]).size} / ${SPECIES.length}</strong></span></div><div class="version-label"><span class="status-dot"></span> OFFLINE SINGLE PLAYER <span class="version">v0.8.0</span><button data-action="quit" class="text-button">QUIT</button></div></footer>
      </div>`,
      "menu-screen",
    );
    this.bind("start", () => this.savedRun ? this.showNewLifePrompt() : this.callbacks.start(this.difficulty));
    this.bind("continue", () => this.callbacks.continue?.());
    this.bind("tutorial", () => this.showTutorial());
    this.bind("guide", () => this.showGuide());
    this.bind("wardrobe", () => this.showWardrobe());
    this.bind("shop", () => this.showShop());
    this.bind("island", () => this.callbacks.island());
    this.bind("legacy", () => this.showLegacy());
    this.bind('field-journal', () => this.showFieldJournal(null));
    this.bind("settings", () => this.showSettings());
    this.bind("quit", () => this.callbacks.quit?.());
    this.overlay.querySelectorAll("[data-difficulty]").forEach((button) =>
      button.addEventListener("click", () => {
        this.difficulty = button.dataset.difficulty;
        this.showMenu();
      }),
    );
  }

  difficultyText() {
    return {
      explorer: "A gentler ecosystem. Learn the hunt. Discover your lineage.",
      survival: "The intended challenge. Hungry predators. No second chances.",
      extinction: "An unforgiving world for those who have mastered the hunt.",
    }[this.difficulty];
  }

  setSavedRun(summary) {
    this.savedRun = summary;
    if (this.view === "menu") this.showMenu();
  }

  setSaveStatus(message, failed = false) {
    this.saveMessage = message;
    this.saveFailed = failed;
    for (const id of ["hud-save-status", "pause-save-status"]) {
      const node = $("#" + id);
      if (node) { node.textContent = message; node.classList.toggle("failed", failed); }
    }
  }

  showNewLifePrompt() {
    this.screen("new-life", `<div class="modal-panel pause-panel"><p class="eyebrow">ONE LIFE AT A TIME</p><h1>Begin again?</h1><p class="panel-subtitle">Starting a new life ends your saved ${esc(this.savedRun?.name || "creature")} run. Permanent discoveries, sanctuary items and DNA stay with your lineage.</p><div class="stacked-buttons"><button class="button primary" data-action="keep" data-focus>KEEP MY CURRENT LIFE</button><button class="button secondary" data-action="new-life">END SAVED LIFE & START NEW</button></div></div>`, "shade-screen");
    this.bind("keep", () => this.showMenu());
    this.bind("new-life", () => this.callbacks.start(this.difficulty));
  }

  showBackups(exportText, preview, restore) {
    this.screen("backups", `<div class="wide-panel backup-panel">${this.header("PROTECT YOUR LINEAGE", "Save backups", "A backup contains your permanent profile, settings and any living run. Keep the file somewhere safe.")}<div class="backup-actions"><button class="button primary" data-action="export-backup">DOWNLOAD BACKUP</button></div><label for="backup-file">RESTORE A BACKUP FILE</label><input id="backup-file" type="file" accept=".json,application/json"/><label for="backup-text">OR PASTE BACKUP DATA</label><textarea id="backup-text" spellcheck="false" placeholder="Paste a Jurassic Domination backup here"></textarea><div class="backup-actions"><button class="button secondary" data-action="preview-backup">CHECK BACKUP</button></div><p id="backup-message" class="backup-message" role="status">Importing replaces the local profile and saved life after you review the backup. Recorded dead runs cannot be resumed.</p><div id="backup-preview" class="backup-preview" hidden></div><div class="panel-bottom"><span>Offline backups are portable between this game's browser and Windows builds.</span><button class="button primary" data-action="back">DONE</button></div></div>`, "shade-screen");
    this.bind("export-backup", () => {
      try {
        const value = exportText(), blob = new Blob([value], { type: "application/json" }), url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url; link.download = `jurassic-domination-backup-${new Date().toISOString().slice(0,10)}.json`;
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        $("#backup-message").textContent = "Backup downloaded. Your current data is unchanged.";
      } catch (error) { $("#backup-message").textContent = error.message || "Backup export failed."; }
    });
    $("#backup-file").onchange = async (event) => {
      const field = $("#backup-text"), previewPanel = $("#backup-preview"), message = $("#backup-message");
      previewPanel.hidden = true;
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 12 * 1024 * 1024) { message.textContent = "This file is too large to be a supported backup."; return; }
      try {
        const text = await file.text();
        if (!field.isConnected || this.view !== "backups") return;
        field.value = text;
        message.textContent = "File loaded. Check the backup before restoring.";
      } catch { if (message.isConnected) message.textContent = "The backup file could not be read. Choose it again or paste its contents."; }
    };
    $("#backup-text").oninput = () => { $("#backup-preview").hidden = true; };
    this.bind("preview-backup", () => {
      const text = $("#backup-text").value, result = preview(text);
      const panel = $("#backup-preview");
      panel.hidden = !result.ok;
      if (!result.ok) { $("#backup-message").textContent = result.error || "This backup is invalid."; return; }
      const p = result.data.profile;
      panel.innerHTML = `<strong>REVIEW BEFORE RESTORING</strong><p>${number(p.dna)} DNA · ${number(p.runs)} lives recorded · ${p.unlocked.length} evolved forms · ${p.pets.length} companions</p><p>${result.data.run ? "A living expedition is included." : "Permanent profile only; no living expedition."}</p>${(result.warnings || []).map((warning) => `<p>${esc(warning)}</p>`).join("")}<button class="button primary" id="restore-backup">REPLACE LOCAL SAVE WITH THIS BACKUP</button>`;
      $("#backup-message").textContent = "Backup is valid. Review the contents above before replacing your local save.";
      $("#restore-backup").onclick = () => {
        const restored = restore(text);
        if (!restored.ok) { $("#backup-message").textContent = restored.error || "Restore failed. Existing save retained."; return; }
        this.showMenu(); this.toast(restored.data?.run ? "Backup restored. Continue your expedition from the title screen." : "Backup restored. Your permanent lineage is available.");
      };
    });
    this.bind("back", () => this.showSettings());
  }

  buildHUD() {
    this.hud.innerHTML = `<span id="hud-save-status" class="save-indicator" role="status"></span>
      <div id="hud-hunger-vignette" class="hunger-vignette" aria-hidden="true"></div>
      <div id="hud-starving-alert" class="starving-alert" aria-hidden="true" hidden><span class="starving-title">STARVING · HUNT FOR FLESH</span><span class="starving-sub">YOUR BODY WEAKENS · FEED IMMEDIATELY</span></div>
      <div class="hud-top-center-vitals">
        <div class="vital hp-vital">
          <div class="vital-label">${icon("heart")}<span>VITALITY</span><b id="hud-hp-text">100 / 100</b></div>
          <div class="meter health" role="progressbar" aria-label="Health"><span id="hud-hp"></span></div>
        </div>
        <div class="vital stamina-vital">
          <div class="vital-label">${icon("bolt")}<span>STAMINA</span><b id="hud-stamina-text">100%</b></div>
          <div class="meter stamina" role="progressbar" aria-label="Stamina"><span id="hud-stamina"></span></div>
        </div>
      </div>
      <div id="hud-objective-panel" class="hud-objective-panel">
        <div class="objective-header-row">
          <span class="objective-badge">CURRENT GOAL</span>
          <span id="hud-obj-step" class="objective-step">STEP 1 / 10</span>
          <button id="guide-shortcut-btn" class="guide-shortcut-btn" title="Survival Guide & Controls">? GUIDE</button>
        </div>
        <div class="objective-title-row">
          <span id="hud-obj-title" class="objective-title">Break Free from the Egg</span>
          <span id="hud-obj-progress" class="objective-progress">0%</span>
        </div>
        <div class="meter objective-meter"><span id="hud-obj-bar"></span></div>
        <p id="hud-obj-hint" class="objective-hint">Press E or click to hatch.</p>
      </div>
      <div id="hud-region-hazard" class="hud-region-hazard" hidden>
        <span class="hazard-icon">⚠️</span>
        <div class="hazard-text">
          <strong id="hazard-title">EXTREME HAZARD REGION</strong>
          <span id="hazard-desc">Tier 3 Zone · Form Tier 1</span>
        </div>
      </div>
      <div class="hud-top"><div class="species-card"><span class="species-emblem" id="hud-emblem">${icon("claw")}</span><div><p class="eyebrow" id="hud-tier">A NEW LIFE</p><h2 id="hud-species">The beginning</h2><span class="small-muted" id="hud-biome">FERN MEADOW</span></div></div>
        <div class="hud-run"><span class="hud-dna" id="hud-dna">0 DNA</span><span class="run-timer" id="hud-time">00:00</span><span class="run-kills">${icon("skull")}<b id="hud-kills">0</b></span><button class="icon-button" id="pause-button" aria-label="Pause game">${icon("pause")}</button></div></div>
      <div class="minimap-wrap"><div class="map-header"><span>THE LOST CONTINENT</span><span>N ↑</span></div><canvas id="minimap" width="180" height="180" aria-label="Minimap with player, nearby creatures, and food"></canvas><div class="map-footer"><span class="status-dot"></span><span id="hud-threat">ECOSYSTEM STABLE</span></div><div class="hud-danger-panel" id="hud-danger-panel"><div class="danger-header-row"><span>THREAT LEVEL</span><b id="hud-danger-label">🌿 SAFE BASIN</b></div><div class="meter danger-meter"><span id="hud-danger-bar"></span></div></div></div>
      <div class="hud-bottom"><div class="vital-status-feed"><p class="hunger-warning" id="hud-warning"></p><span id="hud-diet"></span></div></div>
      <div class="abilities"><div class="ability-key"><kbd>LMB</kbd>${icon("claw")}<span>BITE</span><i id="attack-ready"></i></div><div class="ability-key"><kbd>Q</kbd>${icon("bolt")}<span id="hud-ability">PRIMAL INSTINCT</span><b id="hud-ability-cooldown">READY</b></div><div class="ability-key"><kbd>SHIFT</kbd>${icon("arrow")}<span id="dash-name">DASH</span><b id="hud-dash-cooldown">READY</b></div><div class="ability-key eat-key"><kbd>E</kbd>${icon("leaf")}<span>FEED</span><b>HOLD</b></div></div>
      <div class="evolution-progress"><div class="evolution-heading"><span>${icon("dna")} NEXT EVOLUTION</span><b id="hud-xp-text">0 / 60</b></div><div class="meter xp"><span id="hud-xp"></span></div><p id="hud-score">SCORE 0</p><button id="evolve-ready" hidden aria-label="Open evolution choices"><kbd>T</kbd> EVOLUTION READY <span>CHOOSE WHEN YOU ARE READY</span></button><span id="growth-status"></span><button id="bloodline-journal">J - COMPENDIUM</button><button id="build-shortcut-btn" class="build-shortcut-btn"><kbd>B</kbd> BUILDS</button></div></div>
      <div class="hud-controls">${small("W A S D", "MOVE")}${small("MOUSE", "AIM")}${small("SPACE", "BITE")}${small("B", "BUILDS")}${small("ESC", "PAUSE")}</div>
      <div id="egg-prompt" class="egg-prompt" hidden><p class="eyebrow">A NEW LIFE STIRS</p><h2>Break into the unknown.</h2><p>Every predator was once prey. Choose your species before birth:</p><div class="starter-choices" id="starter-choices"></div><button id="hatch-button" class="button primary">CRACK THE SHELL ${icon("arrow")}</button><span class="small-muted">SELECT A SPECIES OR PRESS [1], [2], [3] / E / SPACE TO HATCH</span></div>
    `;
    $("#pause-button").addEventListener("click", () =>
      this.callbacks.pause?.(),
    );
    $("#guide-shortcut-btn")?.addEventListener("click", () => {
      this.callbacks.pause?.();
      this.showTutorial();
    });
    $("#evolve-ready").onclick = () => this.callbacks.evolution();
    $("#bloodline-journal").onclick = () => {
      this.callbacks.pause();
      this.callbacks.bloodlines();
    };
    $("#build-shortcut-btn")?.addEventListener("click", () => {
      this.callbacks.pause?.();
      this.showBuildSheet(this.currentGame);
    });
    const extra = document.createElement("div");
    extra.className = "ability-key special-key";
    extra.id = "special-key";
    extra.innerHTML =
      '<kbd>X</kbd><span id="special-name"></span><b id="special-cooldown">READY</b>';
    $(".abilities").append(extra);
    $("#hatch-button").addEventListener("click", () => this.callbacks.hatch(this.selectedStarterId || this.currentGame?._starter?.id));
  }

  showHUD() {
    this._view = "hud";
    this.overlay.hidden = true;
    this.hud.hidden = false;
    document.activeElement?.blur();
  }

  updateHUD(game, dt = 0) {
    if (!game) return;
    this.currentGame = game;
    const controlSignature = JSON.stringify(this.settings.controls || DEFAULT_BINDINGS);
    if (this.controlSignature !== controlSignature) { this.controlSignature = controlSignature; this.refreshControlLabels(); }
    const p = game.player;
    const s = species(p.speciesId);
    $("#hud-tier").textContent =
      `TIER ${(game.tier ?? s.tier) + 1} · ${tierName(game.tier ?? s.tier)}`;
    $("#hud-species").textContent =
      game.state === "egg" ? "An unhatched possibility" : s.name;
    $("#hud-biome").textContent = (game.biome || "Fern meadow").toUpperCase();
    $("#hud-time").textContent = clock(game.time);
    $("#hud-dna").textContent = `${number(this.profile.dna)} DNA`;
    $("#hud-kills").textContent = number(p.kills);
    $("#hud-hp-text").textContent =
      `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
    $("#hud-hp").style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    $("#hud-stamina").style.width = `${Math.max(0, p.stamina)}%`;
    $("#hud-stamina-text").textContent = `${Math.ceil(p.stamina)}%`;
    const hungerMeter = $("#hud-hunger");
    if (hungerMeter) {
      hungerMeter.style.width = `${Math.max(0, p.hunger)}%`;
      $("#hud-hunger-text").textContent = `${Math.ceil(p.hunger)}%`;
    }
    const vignette = $("#hud-hunger-vignette");
    if (vignette) {
      const hungerFactor = Math.max(0, Math.min(1, (65 - p.hunger) / 65));
      vignette.style.opacity = (hungerFactor * 0.92).toFixed(3);
    }
    const starvingAlert = $("#hud-starving-alert");
    if (starvingAlert) {
      starvingAlert.hidden = p.hunger >= 25 || game.state !== "playing";
    }
    for (const [id, value, max] of [["hud-hp", p.hp, p.maxHp], ["hud-stamina", p.stamina, 100]]) {
      const meter = $("#" + id)?.parentElement;
      if (meter) {
        meter.setAttribute("aria-valuenow", Math.round(value));
        meter.setAttribute("aria-valuemax", Math.round(max));
        meter.setAttribute("aria-valuemin", "0");
      }
    }
    if (this.hudSpecies !== s.id) {
      this.hudSpecies = s.id;
      $("#hud-emblem").innerHTML = portrait(s.id);
      $("#hud-diet").textContent = dietName(s) === "Carnivore" ? "CARNIVORE · MEAT / FRUIT / FUNGI" : `${dietName(s).toUpperCase()} · ALL FORAGE`;
      this.hud.dataset.rarity = s.rarity || "regular";
    }
    const threshold = game.nextThreshold || 1;
    $("#hud-xp").style.width = `${Math.min(100, (p.xp / threshold) * 100)}%`;
    $("#hud-xp-text").textContent =
      `${Math.floor(p.xp)} / ${Math.floor(threshold)}`;
    $("#hud-score").textContent = `SCORE ${number(p.score)}`;
    $("#hud-ability").textContent = (
      typeof s.ability === "object"
        ? s.ability.name
        : s.ability || "PRIMAL INSTINCT"
    ).toUpperCase();
    $("#hud-ability-cooldown").textContent =
      p.abilityCooldown > 0 ? `${p.abilityCooldown.toFixed(1)}s` : "READY";
    $("#hud-ability-cooldown").closest(".ability-key").classList.toggle("cooling", p.abilityCooldown > 0);
    $("#evolve-ready").hidden =
      !game.evolutionReady || game.state !== "playing";
    $("#growth-status").textContent =
      `${growthName(p.growth || 0).toUpperCase()} - ${Math.round((p.growth || 0) * 100)}% GROWTH - ${Math.round((1 + (p.growth || 0) * 0.28) * 100)}% SIZE`;
    const kit = creatureKit(s),
      special = SPECIALS[kit.special];
    $("#hud-ability").closest(".ability-key").hidden = !kit.ability;
    $("#special-key").hidden = !special;
    if (special) {
      $("#special-name").textContent = special.name;
      $("#special-cooldown").textContent =
        p.specialCooldown > 0 ? `${p.specialCooldown.toFixed(1)}s` : "READY";
      $("#special-key").classList.toggle("cooling", p.specialCooldown > 0);
    }
    $("#dash-name").textContent = kit.dash ? "DASH" : "NO DASH";
    $("#hud-dash-cooldown")
      .closest(".ability-key")
      .classList.toggle("unavailable", !kit.dash);
    $("#hud-dash-cooldown").textContent = !kit.dash
      ? "HEAVY FORM"
      : p.dashCooldown > 0
        ? `${p.dashCooldown.toFixed(1)}s`
        : "READY";
    $("#attack-ready").classList.toggle("cooling", p.attackCooldown > 0);
    $("#hud-dash-cooldown").closest(".ability-key").classList.toggle("cooling", p.dashCooldown > 0);
    $("#hud-warning").textContent =
      p.hunger < 15
        ? "STARVING — EAT TO SURVIVE"
        : p.hp < p.maxHp * 0.25
          ? "CRITICAL — FIND FOOD AND RETREAT"
          : "";
    const threat = Number(game.danger || 0);
    $("#hud-threat").textContent =
      threat > 0.7
        ? "CRITICAL THREAT"
        : threat > 0.35
          ? "PREDATORS ON THE HUNT"
          : "ECOSYSTEM STABLE";
    $("#hud-threat").classList.toggle("danger-text", threat > 0.35);
    $("#egg-prompt").hidden = game.state !== "egg";
    if (game.state === "egg") {
      const container = $("#starter-choices");
      if (container && this._renderedStarterChoices !== (game.starterChoices || []).join(",")) {
        this._renderedStarterChoices = (game.starterChoices || []).join(",");
        this.selectedStarterId = this.selectedStarterId || game.starterChoices?.[0] || game._starter?.id;
        container.innerHTML = (game.starterChoices || []).map((id, idx) => {
          const sp = species(id);
          const isSel = id === this.selectedStarterId;
          const dietColor = sp.diet === "carnivore" ? "#f87171" : sp.diet === "herbivore" ? "#4ade80" : "#fbbf24";
          return `
            <button type="button" class="starter-egg-card ${isSel ? "selected" : ""}" data-starter="${esc(sp.id)}">
              <span class="starter-num">[${idx + 1}]</span>
              <div class="starter-icon">${portrait(sp.id)}</div>
              <h3>${esc(sp.name)}</h3>
              <div class="starter-meta">
                <span class="starter-diet" style="color:${dietColor}">${esc(sp.diet.toUpperCase())}</span>
                <span class="starter-body">${esc(sp.body.toUpperCase())}</span>
              </div>
              <div class="starter-stats">
                <span>HP <b>${sp.hp}</b></span>
                <span>DMG <b>${sp.damage}</b></span>
                <span>SPD <b>${sp.speed}</b></span>
              </div>
              <p class="starter-desc">${esc(sp.description)}</p>
            </button>
          `;
        }).join("");
        container.querySelectorAll(".starter-egg-card").forEach((card) => {
          card.onclick = () => {
            this.selectedStarterId = card.dataset.starter;
            container.querySelectorAll(".starter-egg-card").forEach((c) => c.classList.toggle("selected", c === card));
          };
        });
      }
    }
    this.hud.classList.toggle("critical", p.hp < p.maxHp * 0.25);
    this.hud.classList.toggle("hungry", p.hunger < 25);

    const obj = evaluateObjectives(game, this.profile);
    const objStep = $("#hud-obj-step");
    if (objStep) objStep.textContent = `STEP ${obj.step} / ${obj.totalSteps}`;
    const objTitle = $("#hud-obj-title");
    if (objTitle) objTitle.textContent = obj.title;
    const objProgress = $("#hud-obj-progress");
    if (objProgress) objProgress.textContent = obj.progressText;
    const objBar = $("#hud-obj-bar");
    if (objBar) objBar.style.width = `${Math.round(obj.progress * 100)}%`;
    const objHint = $("#hud-obj-hint");
    if (objHint) objHint.textContent = getSurvivalHint(game) || obj.hint;

    const dangerLabel = $("#hud-danger-label");
    if (dangerLabel) {
      dangerLabel.textContent = obj.danger.label;
      dangerLabel.style.color = obj.danger.color;
    }
    const dangerBar = $("#hud-danger-bar");
    if (dangerBar) {
      dangerBar.style.width = `${Math.round(obj.danger.percent * 100)}%`;
      dangerBar.style.background = obj.danger.color;
    }

    const hazardBanner = $("#hud-region-hazard");
    if (hazardBanner) {
      hazardBanner.hidden = !obj.regionHazard.isDangerous || game.state !== "playing";
      if (obj.regionHazard.isDangerous) {
        const titleEl = $("#hazard-title");
        if (titleEl) titleEl.textContent = obj.regionHazard.warningTitle;
        const descEl = $("#hazard-desc");
        if (descEl) descEl.textContent = obj.regionHazard.warningDesc;
      }
    }
  }

  refreshControlLabels() {
    const controls = this.settings.controls || DEFAULT_BINDINGS;
    for (const [id, action] of [["hud-ability", "ability"], ["hud-technique", "technique"], ["hud-roar", "roar"], ["special-name", "special"], ["dash-name", "dash"], ["attack-ready", "attack"]]) {
      const box = $("#" + id)?.closest(".ability-key"), key = box?.querySelector("kbd");
      if (key) key.textContent = keyLabel(controls[action]);
    }
    const feed = $(".eat-key kbd"); if (feed) feed.textContent = keyLabel(controls.eat);
    const evolution = $("#evolve-ready kbd"); if (evolution) evolution.textContent = keyLabel(controls.evolve);
    const journal = $("#bloodline-journal"); if (journal) journal.textContent = `${keyLabel(controls.journal)} · BLOODLINE PATHS`;
    const hatch = $(".egg-prompt .small-muted"); if (hatch) hatch.textContent = `PRESS ${keyLabel(controls.eat)} OR CLICK TO HATCH`;
    const help = this.hud.querySelectorAll(".hud-controls kbd");
    if (help[0]) help[0].textContent = ["up", "left", "down", "right"].map((action) => keyLabel(controls[action])).join(" ");
    if (help[2]) help[2].textContent = keyLabel(controls.attack);
  }

  showPause() {
    this.returnView = "pause";
    const hasMutations = (this.currentGame?.mutations || []).length > 0;
    this.screen(
      "pause",
      `<div class="modal-panel pause-panel"><p class="eyebrow">THE HUNT CAN WAIT</p><h1>Catch your breath.</h1><p class="panel-subtitle">Your world is paused. Returning to the title keeps this life.</p><p class="save-status" id="pause-save-status"></p><div class="stacked-buttons"><button class="button primary" data-action="resume" data-focus>RESUME THE HUNT ${icon("arrow")}</button><button class="button secondary" data-action="build-sheet">🧬 MUTATION BUILDS & SYNERGIES</button><button class="button secondary" data-action="compendium">${icon("book")} COMPENDIUM (ENCYCLOPEDIA · JOURNAL · BLOODLINES)</button><button class="button secondary" data-action="settings">${icon("settings")} SETTINGS</button><button class="button secondary" data-action="tutorial">${icon("book")} SURVIVAL GUIDE</button><button class="button quiet" data-action="menu">SAVE & RETURN TO TITLE</button></div>${hasMutations ? `<div class="run-adaptations"><strong>THIS LIFE</strong><p>${(this.currentGame.mutations).map((id) => esc(MUTATIONS.find((m) => m.id === id)?.name || id)).join(" · ")}</p></div>` : ""}<p class="small-muted">Rare DNA and permanent finds save immediately. Ordinary deaths grant no DNA.</p><span class="pause-hint">ESC TO RESUME</span></div>`,
      "shade-screen",
    );
    this.bind("resume", () => this.callbacks.resume());
    this.bind("build-sheet", () => this.showBuildSheet(this.currentGame));
    this.bind("compendium", () => this.showCompendium("encyclopedia", this.currentGame));
    this.bind("field-journal", () => this.showCompendium("journal", this.currentGame));
    this.bind("bloodlines", () => this.showCompendium("bloodlines", this.currentGame));
    this.bind("guide", () => this.showCompendium("encyclopedia", this.currentGame));
    this.bind("settings", () => this.showSettings());
    this.bind("tutorial", () => this.showTutorial());
    this.bind("menu", () => this.callbacks.menu());
    this.setSaveStatus(this.saveMessage || "CHECKPOINTS SAVE AUTOMATICALLY", !!this.saveFailed);
  }

  showCompendium(initialTab = "encyclopedia", game = this.currentGame) {
    if (["menu", "pause"].includes(this._view)) this.returnView = this._view;
    this.compendiumTab = initialTab;
    const unlocked = [
      ...new Set([
        ...(this.profile.unlocked || []),
        ...(this.profile.hunted || []),
      ]),
    ];
    this.guideSelection ||= unlocked.at(-1) || SPECIES[0].id;
    const eligible = game ? eligibleBloodlines(game) : [],
      g = game?.lineage;

    const renderTabsNav = () => `
      <div class="compendium-tabs" role="tablist">
        <button class="compendium-tab-btn ${this.compendiumTab === "encyclopedia" ? "active" : ""}" data-comp-tab="encyclopedia" role="tab">${icon("book")} DINOSAUR ENCYCLOPEDIA</button>
        <button class="compendium-tab-btn ${this.compendiumTab === "journal" ? "active" : ""}" data-comp-tab="journal" role="tab">${icon("leaf")} FIELD JOURNAL & SURVIVAL</button>
        <button class="compendium-tab-btn ${this.compendiumTab === "bloodlines" ? "active" : ""}" data-comp-tab="bloodlines" role="tab">${icon("dna")} BLOODLINE PATHS</button>
        <button class="compendium-tab-btn ${this.compendiumTab === "build" ? "active" : ""}" data-comp-tab="build" role="tab">🧬 MUTATION BUILDS</button>
        <button class="compendium-tab-btn ${this.compendiumTab === "lineage" ? "active" : ""}" data-comp-tab="lineage" role="tab">👑 FAMILY TREE & ANCESTRY</button>
      </div>
    `;

    const getBodyHTML = () => {
      if (this.compendiumTab === "build") {
        const b = game?.build || { offensive: {}, defensive: {}, passive: {}, transformations: {}, activeSynergies: [] };
        const buildPower = calculateBuildPower(b);
        const renderCategorySlots = (catKey) => {
          const catDef = BUILD_CATEGORIES[catKey];
          const maxSlots = catDef?.maxEquipped || 4;
          const equipped = Object.entries(b[catKey] || {});
          const slotsHTML = [];
          for (let i = 0; i < maxSlots; i++) {
            if (i < equipped.length) {
              const [id, lvl] = equipped[i];
              const def = BUILD_MUTATIONS[id] || MUTATIONS.find((m) => m.id === id) || { name: id, icon: "🧬" };
              const lvlData = def.levels?.[lvl - 1];
              slotsHTML.push(`
                <div class="build-slot filled">
                  <div class="slot-header">
                    <span class="slot-icon">${def.icon || "🧬"}</span>
                    <span class="slot-name">${esc(def.name)}</span>
                    <span class="slot-stars">${renderStars(lvl)}</span>
                  </div>
                  <p class="slot-desc">${esc(lvlData?.desc || def.description || "")}</p>
                </div>
              `);
            } else {
              slotsHTML.push(`
                <div class="build-slot empty">
                  <span class="slot-empty-label">+ Empty ${esc(catDef?.name || "Mutation")} Slot</span>
                </div>
              `);
            }
          }
          return slotsHTML.join("");
        };
        const synergiesHTML = Object.entries(MUTATION_SYNERGIES).map(([key, syn]) => {
          const isUnlocked = b.activeSynergies?.includes(key);
          return `
            <div class="synergy-card ${isUnlocked ? "unlocked" : "locked"}" style="--syn-color:${syn.color}; --syn-border:${syn.border}; --syn-bg:${syn.bg}">
              <div class="synergy-card-header">
                <span class="synergy-icon">${syn.icon}</span>
                <div class="synergy-title-wrap">
                  <h3>${esc(syn.name)}</h3>
                  <span class="synergy-req">${esc(syn.reqText)}</span>
                </div>
                <span class="synergy-status-badge">${isUnlocked ? "⚡ UNLOCKED" : "🔒 LOCKED"}</span>
              </div>
              <p class="synergy-desc">${esc(syn.description)}</p>
            </div>
          `;
        }).join("");

        return `
          <div class="compendium-build-wrap" style="padding:16px;max-height:64vh;overflow-y:auto;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <div>
                <h2 style="font-size:20px;color:#f3f4f6;margin-bottom:4px;">DINOSAUR MUTATION BUILD & SYNERGIES</h2>
                <p style="font-size:13px;color:#94a3b8;">4 Upgrade Disciplines · Max 4 Mutations Each · Level 1-5 Stacking</p>
              </div>
              <div class="build-power-badge" style="background:rgba(234,179,8,0.15);border:1px solid #eab308;padding:8px 14px;border-radius:8px;text-align:right;">
                <span style="font-size:10px;color:#fde047;display:block;">APEX BUILD POWER</span>
                <strong style="font-size:22px;color:#fde047;">⚡ ${Math.round(buildPower)}</strong>
              </div>
            </div>
            <div class="build-categories-grid">
              <div class="build-category-col" style="--col-color:#f87171; --col-border:#ef4444">
                <div class="category-header"><span>⚔️</span><h2>Offensive Mutations</h2><small>Max 4</small></div>
                <div class="category-slots">${renderCategorySlots("offensive")}</div>
              </div>
              <div class="build-category-col" style="--col-color:#38bdf8; --col-border:#0284c7">
                <div class="category-header"><span>🛡️</span><h2>Defensive Adaptations</h2><small>Max 4</small></div>
                <div class="category-slots">${renderCategorySlots("defensive")}</div>
              </div>
              <div class="build-category-col" style="--col-color:#fbbf24; --col-border:#d97706">
                <div class="category-header"><span>⚡</span><h2>Passive Abilities</h2><small>Max 4</small></div>
                <div class="category-slots">${renderCategorySlots("passive")}</div>
              </div>
            </div>
            <div class="synergy-section" style="margin-top:20px;">
              <h2 style="font-size:16px;color:#e2e8f0;margin-bottom:12px;">🧬 Powerful Mutation Synergies</h2>
              <div class="synergy-grid">${synergiesHTML}</div>
            </div>
          </div>
        `;
      }
      if (this.compendiumTab === "journal") {
        return `<div class="field-journal-wrap">${fieldJournalHTML(game, this.profile)}</div>`;
      }
      if (this.compendiumTab === "bloodlines") {
        return `
          <div class="bloodlines-wrap">
            <p class="lineage-counters">${g ? `Sunheart fruit: ${g.fruits.sunheart} / Moondrop fruit: ${g.fruits.moondrop} / Lava creatures: ${g.lavaKills} / Guardians: ${g.guardians}` : "Start a life to track these conditions."}</p>
            <div class="bloodline-grid">${BLOODLINES.map(
              (b) => {
                const s = species(b.speciesId),
                  used = g?.used.includes(b.id),
                  ready = eligible.some((e) => e.id === b.id);
                return `<article data-rarity="${s.rarity}" style="--lineage-color:${EVOLUTION_RARITIES[s.rarity].color}"><img src="assets/portraits/species-${s.id}.webp" alt=""/><span class="evolution-rarity">${s.rarity.toUpperCase()} - TIER ${b.tier + 1}</span><h2>${s.name}</h2><p>${b.description}</p><strong>${used ? "CLAIMED THIS LIFE" : ready ? "AVAILABLE AT YOUR NEXT EVOLUTION" : "CONDITIONS NOT MET"}</strong></article>`;
              },
            ).join("")}</div>
          </div>
        `;
      }
      if (this.compendiumTab === "lineage") {
        const ancestry = this.profile?.ancestry || { generations: 0, recent: [] };
        const runs = ancestry.recent || [];
        return `
          <div class="lineage-tree-wrap" style="padding:16px 20px;max-height:64vh;overflow-y:auto;">
            <div class="lineage-header-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;background:rgba(0,0,0,0.35);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);">
              <div><span style="font-size:11px;color:#94a3b8;display:block;">DYNASTY GENERATIONS</span><strong style="font-size:22px;color:#fde047;">${ancestry.generations || 0}</strong></div>
              <div><span style="font-size:11px;color:#94a3b8;display:block;">LONGEST SURVIVAL</span><strong style="font-size:22px;color:#86efac;">${clock(ancestry.longestLife || 0)}</strong></div>
              <div><span style="font-size:11px;color:#94a3b8;display:block;">TOTAL TIME SURVIVED</span><strong style="font-size:22px;color:#93c5fd;">${clock(ancestry.totalSurvival || 0)}</strong></div>
              <div><span style="font-size:11px;color:#94a3b8;display:block;">APEX GUARDIANS SLAIN</span><strong style="font-size:22px;color:#fca5a5;">${ancestry.guardianVictories || 0}</strong></div>
            </div>
            <h2 style="font-size:18px;letter-spacing:1px;color:#f3f4f6;margin-bottom:6px;">MULTI-GENERATIONAL DYNASTY</h2>
            <p class="panel-subtitle" style="font-size:13px;color:#94a3b8;margin-bottom:16px;">Each life passes down genetic markings, survival instincts, and territorial dominance.</p>
            ${runs.length ? `
              <div class="family-tree-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
                ${runs.map((r, idx) => {
                  const sp = species(r.speciesId);
                  return `
                    <div class="family-node ${idx === 0 ? "current-ancestor" : ""}" style="background:rgba(15,23,42,0.75);border:1px solid ${idx === 0 ? "rgba(234,179,8,0.6)" : "rgba(255,255,255,0.08)"};border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;">
                      <div class="family-node-header" style="display:flex;justify-content:space-between;align-items:center;">
                        <span class="gen-badge" style="background:rgba(234,179,8,0.2);color:#fde047;border:1px solid rgba(234,179,8,0.4);padding:2px 8px;border-radius:12px;font:700 11px system-ui;">GEN ${r.generation || (runs.length - idx)}</span>
                        <span class="date-badge" style="font-size:11px;color:#64748b;">${r.date ? r.date.split("T")[0] : "Primordial Era"}</span>
                      </div>
                      <div class="family-node-body" style="display:flex;gap:12px;align-items:center;">
                        <div class="node-portrait" style="width:52px;height:52px;flex-shrink:0;">${portrait(sp?.id || "compsognathus")}</div>
                        <div class="node-info" style="overflow:hidden;">
                          <h3 style="font-size:15px;margin:0;color:#f8fafc;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">${esc(sp?.name || "Ancestor")}</h3>
                          <span style="font-size:12px;color:#94a3b8;">Tier ${(r.tier ?? 0) + 1} Apex</span>
                          <p style="font-size:11px;color:#e2e8f0;margin:3px 0 0;opacity:0.8;white-space:nowrap;text-overflow:ellipsis;overflow:hidden;">Defeated: ${esc(r.strongestDefeated ? (species(r.strongestDefeated)?.name || r.strongestDefeated) : "None")}</p>
                        </div>
                      </div>
                      <div class="family-node-stats" style="display:flex;justify-content:space-between;font-size:11px;color:#cbd5e1;background:rgba(0,0,0,0.3);padding:6px 10px;border-radius:6px;">
                        <span>⏱️ ${clock(r.time || 0)}</span>
                        <span>⚔️ ${r.kills || 0}</span>
                        <span>👑 ${r.dominatedCount || 0}</span>
                        <span>🐣 ${r.offspringCount || 0}</span>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            ` : `<p style="color:#94a3b8;font-style:italic;">No ancestral records yet. Hatch and complete a life to establish your dinosaur family tree!</p>`}
          </div>
        `;
      }
      return `
        <div class="encyclopedia-toolbar"><label>SEARCH<input id="guide-search" type="search" placeholder="Name, habitat or ability…" autocomplete="off"/></label><label>COLLECTION<select id="guide-filter"><option value="all">All potential forms</option><option value="unlocked">Evolved or hunted</option><option value="mythic">Mythological creatures</option>${TIERS.map((name, i) => `<option value="tier:${i}">${i + 1} · ${esc(name)}</option>`).join("")}</select></label></div>
        <div class="encyclopedia-layout"><section class="specimen-panel"><canvas id="specimen-canvas" aria-label="Rotating 3D dinosaur specimen. Drag to rotate."></canvas><span class="specimen-hint">LIVE 3D SPECIMEN · DRAG TO ROTATE</span><div id="specimen-info"></div></section><div id="guide-results" class="species-grid encyclopedia-results"></div></div>
      `;
    };

    this.screen(
      "guide",
      `<div class="wide-panel compendium-panel">${this.header("THE LIVING ARCHIVE & COMPENDIUM", "Compendium", `${unlocked.length} evolved or hunted forms recorded · ${SPECIES.length} dinosaur and mythical species`)}
      ${renderTabsNav()}
      <div id="compendium-container">${getBodyHTML()}</div>
      <div class="panel-bottom"><span>Discoveries persist in your ancestry. Press ESC to return.</span><button class="button primary" data-action="back" data-focus>RETURN ${icon("arrow")}</button></div></div>`,
      "shade-screen",
    );

    const wireEncyclopedia = () => {
      const showDetails = (s) => {
        this.guideSelection = s.id;
        const kit = creatureKit(s), technique = TECHNIQUES[kit.technique];
        const info = $("#specimen-info");
        if (!info) return;
        info.innerHTML =
          `<span class="eyebrow">${unlocked.includes(s.id) ? "DISCOVERED & RECORDED" : "UNDISCOVERED · FUTURE FORM"} / ${esc(tierName(s.tier))}</span><span class="evolution-rarity" style="--lineage-color:${EVOLUTION_RARITIES[s.rarity || "regular"].color}">${(s.rarity || "regular").toUpperCase()} · ${kit.abilityCount} SPECIES SKILLS</span><h2>${esc(s.name)}</h2><p>${esc(s.description)}</p><div class="species-stats"><span>HP <b>${s.hp}</b></span><span>ATK <b>${s.damage}</b></span><span>SPD <b>${s.speed}</b></span></div><dl>${kit.ability ? `<dt>Q · ${esc(s.ability)}</dt><dd>${esc(s.abilityDescription)}</dd>` : ""}${technique ? `<dt>R · ${esc(technique.name)}</dt><dd>${esc(technique.description)}</dd>` : ""}${SPECIALS[kit.special] ? `<dt>X · ${SPECIALS[kit.special].name}</dt><dd>${SPECIALS[kit.special].description}</dd>` : ""}${kit.abilityCount ? "" : "<dt>Instinct only</dt><dd>This form relies on its bite, movement and innate adaptation. Species skills develop in later evolutions.</dd>"}<dt>Diet</dt><dd>${esc(dietName(s))}</dd><dt>Body size</dt><dd>${s.size.toFixed(2)} · ${s.compactEvolution ? "Rare compact evolution: a smaller, specialized body." : "Grows with evolution and feeding."}</dd><dt>Mobility</dt><dd>${kit.dash ? "Shift: dodge/dash available." : "Heavy form: no dash. Use positioning, sprint and defensive skills."}</dd><dt>Innate adaptation</dt><dd>${esc(s.passive)}</dd><dt>Habitat & temperament</dt><dd>${esc(s.habitat)} · ${esc(s.temperament)}.</dd></dl>`;
        $("#guide-results")
          ?.querySelectorAll("[data-inspect]")
          .forEach((b) =>
            b.setAttribute("aria-pressed", String(b.dataset.inspect === s.id)),
          );
      };
      const renderCards = () => {
        const searchInput = $("#guide-search");
        const filterInput = $("#guide-filter");
        if (!searchInput || !filterInput) return;
        const query = searchInput.value.trim().toLowerCase(),
          filter = filterInput.value;
        const found = SPECIES.filter(
          (s) =>
            (!query ||
              `${s.name} ${s.habitat} ${s.ability}`
                .toLowerCase()
                .includes(query)) &&
            (filter === "all" ||
              (filter === "unlocked" && unlocked.includes(s.id)) ||
              (filter === "mythic" && s.tier >= 6) ||
              (filter.startsWith("tier:") && s.tier === Number(filter.slice(5)))),
        );
        const results = $("#guide-results");
        if (!results) return;
        results.innerHTML = found.length
          ? found
              .map(
                (s) =>
                  `<button class="species-entry ${unlocked.includes(s.id) ? "discovered" : ""}" data-inspect="${s.id}" data-rarity="${s.rarity || "regular"}" style="--lineage-color:${EVOLUTION_RARITIES[s.rarity || "regular"].color}" aria-pressed="${s.id === this.guideSelection}"><span class="species-tier">${s.tier + 1} / ${esc(tierName(s.tier))} · ${unlocked.includes(s.id) ? "RECORDED" : "UNDISCOVERED"}</span><span class="evolution-rarity">${(s.rarity || "regular").toUpperCase()}</span><div class="creature-art">${portrait(s.id)}</div><h2>${esc(s.name)}</h2><span class="species-ability">${esc(skillSummary(s))}</span></button>`,
              )
              .join("")
          : '<p class="empty-collection">No recorded specimens match. Hatch and evolve to grow your collection, or select All potential forms.</p>';
        results
          .querySelectorAll("[data-inspect]")
          .forEach(
            (b) => (b.onclick = () => showDetails(species(b.dataset.inspect))),
          );
      };
      const searchInput = $("#guide-search");
      if (searchInput) searchInput.oninput = renderCards;
      const filterInput = $("#guide-filter");
      if (filterInput) filterInput.onchange = renderCards;
      renderCards();
      showDetails(species(this.guideSelection));
    };

    if (this.compendiumTab === "encyclopedia") {
      wireEncyclopedia();
    }

    this.overlay.querySelectorAll("[data-comp-tab]").forEach((btn) => {
      btn.onclick = () => {
        this.showCompendium(btn.dataset.compTab, game);
      };
    });

    this.bind("back", () => this.back());
  }

  showGuide() {
    this.showCompendium("encyclopedia");
  }

  showFieldJournal(game = this.currentGame) {
    this.showCompendium("journal", game);
  }

  showBloodlines(game = this.currentGame) {
    this.showCompendium("bloodlines", game);
  }

  showTutorial() {
    if (["menu", "pause", "death"].includes(this._view))
      this.returnView = this._view;
    this.screen(
      "tutorial",
      `<div class="wide-panel guide-panel survival-guide-panel">${this.header("THE SURVIVAL GUIDE & REFRESHER", "Survive. Adapt. Evolve.", "Everything you need to master early survival, enemy threats, and evolutionary dominance.")}
      <div class="survival-guide-grid">
        <article class="guide-section-card">
          <span class="guide-section-tag">01 · STARTER BASIN</span>
          <h2>The Nursery Basin (Safe Zone)</h2>
          <p>Every life begins in the central green basin (radius &lt; 55). In this sanctuary, wild predators will not hunt you unprovoked and safe berries and figs are plentiful.</p>
          <div class="guide-tip-pill">🌿 Tip: Stay inside the basin until you have fed, grown your body, and reached your first Evolution threshold!</div>
        </article>

        <article class="guide-section-card">
          <span class="guide-section-tag">02 · CONTROLS & INSTINCTS</span>
          <h2>Controls Refresher</h2>
          <div class="guide-controls-grid">
            <div class="ctrl-row"><kbd>W A S D</kbd><span>Move & sprint</span></div>
            <div class="ctrl-row"><kbd>MOUSE</kbd><span>Aim direction</span></div>
            <div class="ctrl-row"><kbd>LMB / SPACE</kbd><span>Bite & attack</span></div>
            <div class="ctrl-row"><kbd>E</kbd><span>Hold to feed / hatch</span></div>
            <div class="ctrl-row"><kbd>C</kbd><span>Primal roar</span></div>
            <div class="ctrl-row"><kbd>SHIFT</kbd><span>Dash / dodge</span></div>
            <div class="ctrl-row"><kbd>Q / R / X</kbd><span>Species skills</span></div>
            <div class="ctrl-row"><kbd>T</kbd><span>Open evolution</span></div>
          </div>
        </article>

        <article class="guide-section-card">
          <span class="guide-section-tag">03 · ENEMY READABILITY</span>
          <h2>Threat & Danger Ratings</h2>
          <div class="threat-guide-rows">
            <div class="threat-guide-item lethal"><span class="badge-tag">💀 LETHAL APEX</span><p>2+ tiers above or Alpha boss. Lethal bites. Retreat immediately!</p></div>
            <div class="threat-guide-item danger"><span class="badge-tag">⚠️ DANGEROUS</span><p>1 tier above. Dangerous match. Use mobility, kiting, and skills.</p></div>
            <div class="threat-guide-item fair"><span class="badge-tag">⚔️ FAIR MATCH</span><p>Equal tier. Balanced fight. Mind enemy strike telegraphs.</p></div>
            <div class="threat-guide-item prey"><span class="badge-tag">🌿 PREY</span><p>Weaker tier. Prime food source for nutrients, growth, and XP.</p></div>
          </div>
        </article>

        <article class="guide-section-card">
          <span class="guide-section-tag">04 · ENEMY TELEGRAPHS</span>
          <h2>Telegraphs & Combat Impact</h2>
          <div class="telegraph-guide-rows">
            <div><strong>⚡ CHARGING</strong><span>Trample lane appears on ground. Step laterally outside the line!</span></div>
            <div><strong>💥 ATTACK IMMINENT</strong><span>Close-range bite windup. Dash or step backward to dodge.</span></div>
            <div><strong>🔮 CASTING</strong><span>Red danger circle/cone on ground. Vacate the highlighted zone before impact!</span></div>
            <div><strong>🩸 COMBAT CRUNCH</strong><span>Flank hits and empowered bites trigger Critical Hits with hit-stop crunch!</span></div>
          </div>
        </article>

        <article class="guide-section-card">
          <span class="guide-section-tag">05 · PROGRESSION & BIOMES</span>
          <h2>The Evolutionary Path</h2>
          <p>Eating fills your growth meter (growing larger and increasing HP/ATK in your current form) while XP builds toward your Evolution threshold. When the evolution bar glows, press <kbd>T</kbd> to evolve into new species branches.</p>
          <div class="guide-tip-pill">⚠️ Warning: Wild biomes (redwoods, swamps, desert, caldera) have regional tiers. Entering a zone 2+ tiers above you will trigger hazard alerts!</div>
        </article>
      </div>

      <div class="panel-bottom"><span>Ready to dominate the food chain. Press ESC to return.</span><button class="button primary" data-action="back" data-focus>RETURN TO HUNT ${icon("arrow")}</button></div></div>`,
      "shade-screen",
    );
    this.bind("back", () => this.back());
  }



  showWardrobe() {
    this.returnView = "menu";
    const p = this.profile;
    this.screen(
      "wardrobe",
      `<div class="wide-panel wardrobe-panel">${this.header("WHAT TIME COULD NOT BURY", "Skins & Ancient Relics", "Exceptionally rare fossils unlock permanent discoveries. Equipped skins apply to every form.")}
      <h2 class="section-label">YOUR APPEARANCE</h2><div class="skin-grid">${SKINS.map(
        (s) => {
          const owned = (p.skins || ["natural"]).includes(s.id),
            equipped = p.equippedSkin === s.id;
          return `<button class="skin-card ${equipped ? "equipped" : ""}" data-skin="${s.id}" ${owned ? "" : "disabled"} aria-pressed="${equipped}"><span class="skin-orb" style="--skin:${s.color === null ? "#81945f" : `#${s.color.toString(16).padStart(6, "0")}`};--accent:${s.accent === null ? "#d8c99d" : `#${s.accent.toString(16).padStart(6, "0")}`}"></span><strong>${esc(s.name)}</strong><small>${esc(s.description)}</small><b>${equipped ? "EQUIPPED" : owned ? "EQUIP" : "UNDISCOVERED"}</b></button>`;
        },
      ).join("")}</div>
      <h2 class="section-label relic-heading">PERMANENT WORLD RELICS</h2><div class="modifier-grid">${PERMANENT_MODIFIERS.map((m) => `<article class="modifier-card ${(p.modifiers || []).includes(m.id) ? "owned" : ""}">${icon("dna")}<div><h3>${esc(m.name)}</h3><p>${esc(m.description)}</p></div><b>${(p.modifiers || []).includes(m.id) ? "ACTIVE" : "UNDISCOVERED"}</b></article>`).join("")}</div><p class="survival-tip">Explore distant regions and defeat lair guardians to seek ancient fossils. Unlocks persist through death. Rare plants and relic skills found during a run are separate, temporary discoveries.</p>
      <div class="panel-bottom"><span>Find rare appearances in the world or buy them with earned DNA.</span><button class="button secondary" data-action="wardrobe-shop">BROWSE DNA SHOP</button><button class="button primary" data-action="back" data-focus>RETURN ${icon("arrow")}</button></div></div>`,
      "shade-screen",
    );
    this.overlay.querySelectorAll("[data-skin]").forEach(
      (b) =>
        (b.onclick = () => {
          this.callbacks.skin?.(b.dataset.skin);
          this.showWardrobe();
        }),
    );
    this.bind("wardrobe-shop", () => this.showShop("skin"));
    this.bind("back", () => this.back());
  }

  showShop(category = this.shopCategory || "pet") {
    this.hud.hidden = true;
    this.returnView = "menu";
    this.shopCategory = category;
    this.shopSelection ||=
      SHOP_ITEMS.find((i) => i.kind === category)?.sku || SHOP_ITEMS[0].sku;
    this.screen(
      "shop",
      `<div class="wide-panel dna-shop">${this.header("THE ANCESTRAL EXCHANGE", "The DNA Shop", "Permanent companions, appearances, and pieces of your own prehistoric home.")}
      <div class="shop-wallet"><span>${icon("dna")} AVAILABLE DNA <strong id="shop-wallet">${number(this.profile.dna)}</strong></span><p>DNA comes from selected one-time achievements and rare map finds.</p><button class="button compact secondary" data-action="shop-legacy">ACHIEVEMENTS & GROWTH</button><button class="button compact secondary" data-action="shop-island">MY ISLAND</button></div>
      <div class="shop-toolbar"><div class="shop-tabs">${[
        ["skin", "Skins"],
        ["cosmetic", "Crowns & cosmetics"],
        ["pet", "Dinosaur pets"],
        ["decoration", "Island decorations"],
      ]
        .map(
          ([id, name]) =>
            `<button data-shop-category="${id}" aria-pressed="${category === id}">${name}</button>`,
        )
        .join(
          "",
        )}</div><label>RARITY<select id="shop-rarity"><option value="all">All rarities</option>${Object.entries(
        RARITIES,
      )
        .map(([id, r]) => `<option value="${id}">${r.name}</option>`)
        .join("")}</select></label></div>
      <div class="shop-layout"><section class="shop-feature"><canvas id="shop-preview" aria-label="Live 3D item preview. Drag to rotate."></canvas><span class="specimen-hint">LIVE PREVIEW · DRAG TO ROTATE</span><div id="shop-details"></div></section><div id="shop-items" class="shop-grid"></div></div>
      <div class="panel-bottom"><span>Owned pets and decorations survive every death. No real-money purchases.</span><button class="button primary" data-action="back" data-focus>RETURN ${icon("arrow")}</button></div><div id="shop-status" role="status"></div></div>`,
      "shade-screen",
    );
    this.overlay.querySelectorAll("[data-shop-category]").forEach(
      (b) =>
        (b.onclick = () => {
          this.shopCategory = b.dataset.shopCategory;
          this.refreshShop();
        }),
    );
    $("#shop-rarity").onchange = () => this.refreshShop();
    this.bind("shop-legacy", () => this.showLegacy());
    this.bind("shop-island", () => this.callbacks.island());
    this.bind("back", () => this.back());
    this.refreshShop();
  }
  refreshShop() {
    if (this.view !== "shop") return;
    const p = this.profile,
      rarity = $("#shop-rarity").value;
    const items = SHOP_ITEMS.filter(
      (i) =>
        i.kind === this.shopCategory &&
        (rarity === "all" || i.rarity === rarity),
    );
    if (items.length && !items.some((i) => i.sku === this.shopSelection))
      this.shopSelection = items[0].sku;
    $("#shop-wallet").textContent = number(p.dna);
    this.overlay
      .querySelectorAll("[data-shop-category]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.shopCategory === this.shopCategory),
        ),
      );
    $("#shop-items").innerHTML = items.length
      ? items
          .map((item) => {
            const count = ownedCount(p, item.sku),
              r = RARITIES[item.rarity];
            return `<button class="shop-card ${this.shopSelection === item.sku ? "selected" : ""}" data-product="${item.sku}" data-rarity="${item.rarity}" style="--rarity:${r.color}" aria-pressed="${this.shopSelection === item.sku}"><span class="rarity-label">${r.name}</span><div class="shop-item-art">${portrait(item.id, item.kind)}</div><h2>${esc(item.name)}</h2><p>${item.kind === "decoration" ? `${count} OWNED` : count ? "PERMANENTLY OWNED" : `${item.price} DNA`}</p><span>${item.kind === "decoration" ? `${item.price} DNA EACH` : count ? "SELECT TO EQUIP" : "FIND OR BUY"}</span></button>`;
          })
          .join("")
      : '<p class="empty-collection">No items in this rarity. Choose another filter.</p>';
    this.overlay.querySelectorAll("[data-product]").forEach(
      (b) =>
        (b.onclick = () => {
          this.shopSelection = b.dataset.product;
          this.refreshShop();
        }),
    );
    this.refreshShopDetails();
  }
  refreshShopDetails() {
    const p = this.profile,
      item = CATALOG[this.shopSelection];
    if (!item) return;
    const count = ownedCount(p, item.sku),
      unique = item.kind !== "decoration",
      r = RARITIES[item.rarity];
    const owned = unique && count > 0,
      full = item.kind === "decoration" && count >= 99;
    $("#shop-details").innerHTML =
      `<span class="rarity-label" style="color:${r.color}">${r.name} · ${item.kind === "pet" ? "PERMANENT PET" : item.kind.toUpperCase()}</span><h2>${esc(item.name)}</h2><p>${esc(item.description)}</p><div class="shop-detail-price">${item.price} <small>DNA${item.kind === "decoration" ? " PER COPY" : ""}</small></div><button class="button ${owned ? "secondary" : "primary"}" data-buy="${item.sku}" ${owned || full || p.dna < item.price ? "disabled" : ""}>${owned ? "OWNED" : full ? "INVENTORY FULL" : `BUY · ${item.price} DNA`}</button>
      ${count && item.kind === "skin" ? `<button class="button secondary" data-equip-skin="${item.id}">${p.equippedSkin === item.id ? "EQUIPPED" : "EQUIP SKIN"}</button>` : ""}
      ${count && item.kind === "cosmetic" ? `<button class="button secondary" data-equip-cosmetic="${item.id}">${p.equippedCosmetic === item.id ? "UNEQUIP COSMETIC" : "EQUIP COSMETIC"}</button>` : ""}
      ${count && item.kind === "pet" ? `<button class="button secondary" data-equip-pet="${item.id}">${p.activePet === item.id ? "LEAVE ON ISLAND" : "TAKE ON EXPEDITIONS"}</button>` : ""}
      ${count && ["pet", "decoration"].includes(item.kind) ? '<button class="button secondary" data-place-product>PLACE ON MY ISLAND</button>' : ""}
      <small class="shop-source">${owned ? "This collectible is permanent." : p.dna < item.price ? `You need ${item.price - p.dna} more DNA.` : "Purchases save immediately."} ${item.kind === "pet" ? "Pets are extremely rare map finds and cosmetic companions, with no combat advantage." : item.kind === "decoration" ? "Rare decoration caches can also be found in the world." : ""}</small>`;
    $("[data-buy]").onclick = () => this.callbacks.purchase(item.sku);
    $("[data-equip-skin]")?.addEventListener("click", () => {
      this.callbacks.skin(item.id);
      this.refreshShop();
    });
    $("[data-equip-cosmetic]")?.addEventListener("click", () => {
      this.callbacks.cosmetic(
        p.equippedCosmetic === item.id ? "none" : item.id,
      );
      this.refreshShop();
    });
    $("[data-equip-pet]")?.addEventListener("click", () => {
      this.callbacks.pet(p.activePet === item.id ? null : item.id);
      this.refreshShop();
    });
    $("[data-place-product]")?.addEventListener("click", () =>
      this.callbacks.island({ kind: item.kind, id: item.id }),
    );
  }
  showIsland(profile = this.profile) {
    this.profile = profile;
    this.hud.hidden = true;
    this.returnView = "menu";
    this.islandTab ||= "pet";
    this.islandState = { selected: null, tool: null };
    this.screen(
      "island",
      `<div class="sanctuary-shell"><canvas id="island-canvas" aria-label="Your editable dinosaur island. Drag to orbit, scroll to zoom, right-drag to pan."></canvas>
      <header class="sanctuary-top"><div><p class="eyebrow">YOUR PERMANENT SANCTUARY</p><label class="island-name-label"><input id="island-name" aria-label="Island name" maxlength="36" value="${esc(profile.island.name)}"/></label></div><div><span>${icon("dna")} <b id="island-wallet">${number(profile.dna)}</b> DNA</span><button class="button compact secondary" data-island-command="build" id="build-toggle">ENTER BUILD MODE</button><button class="button compact secondary" data-action="island-shop">SHOP</button><button class="button compact secondary" data-action="back">RETURN TO TITLE</button></div></header>
      <aside class="island-sidebar"><p class="eyebrow">YOUR COLLECTION</p><h2>Make it yours.</h2><div class="island-tabs"><button data-island-tab="pet">PETS</button><button data-island-tab="decoration">DECORATIONS</button></div><p class="island-inventory-hint">Choose an unplaced item, then click the island. Arrows + Enter also place items.</p><div id="island-inventory"></div><button class="button secondary" data-action="island-shop">FIND MORE IN THE SHOP</button></aside>
      <aside id="island-selection" class="island-selection"></aside>
      <div class="island-tools"><button data-island-command="undo" aria-label="Undo island change">UNDO</button><button data-island-command="redo" aria-label="Redo island change">REDO</button><button id="island-grid" data-island-command="grid">${profile.island.grid ? "HIDE" : "SHOW"} GRID</button><button data-island-command="cancel">CANCEL PLACEMENT</button></div><div class="island-bottom"><p id="island-status" role="status">A safe home for your permanent companions.</p><span id="island-controls">DRAG: ORBIT · RIGHT-DRAG / WASD: PAN · SCROLL: ZOOM · R: ROTATE · DELETE: STORE · ESC: CANCEL / LEAVE</span></div></div>`,
      "island-screen",
    );
    this.overlay.querySelectorAll("[data-island-tab]").forEach(
      (b) =>
        (b.onclick = () => {
          this.islandTab = b.dataset.islandTab;
          this.refreshIslandInventory(this.profile, this.islandState);
        }),
    );
    this.bind("island-shop", () => this.showShop(this.islandTab));
    this.bind("back", () => this.callbacks.menu());
    $("#island-name").onkeydown = (e) => {
      if (e.key === "Enter") e.target.blur();
    };
    $("#island-name").onchange = (e) =>
      this.callbacks.islandAction("rename", { name: e.target.value });
    this.overlay
      .querySelectorAll("[data-island-command]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            this.callbacks.islandAction(b.dataset.islandCommand, {})),
      );
    this.refreshIslandInventory(profile, this.islandState);
  }
  refreshIslandInventory(profile = this.profile, state = this.islandState) {
    if (this.view !== "island") return;
    this.profile = profile;
    this.islandState = state || { selected: null, tool: null };
    const p = profile;
    $("#island-wallet").textContent = number(p.dna);
    this.overlay
      .querySelectorAll("[data-island-tab]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.islandTab === this.islandTab),
        ),
      );
    const items = (this.islandTab === "pet" ? PETS : DECORATIONS).filter(
      (i) => ownedCount(p, i.sku) > 0,
    );
    $("#island-inventory").innerHTML = items.length
      ? items
          .map((item) => {
            const available = availableCount(p, item.kind, item.id);
            return `<article class="island-inventory-item" data-rarity="${item.rarity}" style="--rarity:${RARITIES[item.rarity].color}"><button data-island-item="${item.sku}" ${available <= 0 ? "disabled" : ""}><span class="rarity-label">${RARITIES[item.rarity].name}</span><strong>${esc(item.name)}</strong><small>${available} AVAILABLE${item.kind === "decoration" ? ` / ${ownedCount(p, item.sku)} OWNED` : available ? "" : " · ROAMING ON ISLAND"}</small></button>${item.kind === "pet" ? `<button class="pet-expedition" data-island-companion="${item.id}">${p.activePet === item.id ? "EXPEDITION COMPANION" : "TAKE ON EXPEDITIONS"}</button>` : ""}</article>`;
          })
          .join("")
      : `<p class="island-empty">${this.islandTab === "pet" ? "No permanent pets yet. Seek exceptionally rare companion eggs or buy your first dinosaur friend with DNA." : "Your decoration inventory is empty. Find rare supply caches or visit the DNA Shop."}</p>`;
    this.overlay.querySelectorAll("[data-island-item]").forEach(
      (b) =>
        (b.onclick = () => {
          const item = CATALOG[b.dataset.islandItem];
          this.callbacks.islandAction("tool", { kind: item.kind, id: item.id });
        }),
    );
    this.overlay.querySelectorAll("[data-island-companion]").forEach(
      (b) =>
        (b.onclick = () => {
          this.callbacks.pet(
            p.activePet === b.dataset.islandCompanion
              ? null
              : b.dataset.islandCompanion,
          );
          this.refreshIslandInventory(p, this.islandState);
        }),
    );
    const placement = p.island.placements.find(
        (a) => a.id === this.islandState.selected,
      ),
      item = this.islandState.tool
        ? CATALOG[`${this.islandState.tool.kind}:${this.islandState.tool.id}`]
        : placement
          ? CATALOG[`${placement.kind}:${placement.itemId}`]
          : null;
    $("#island-selection").innerHTML = item
      ? `<p class="eyebrow">${this.islandState.tool ? "PLACEMENT MODE" : "SELECTED"}</p><h2>${esc(item.name)}</h2><span class="rarity-label" style="color:${RARITIES[item.rarity].color}">${RARITIES[item.rarity].name}</span><p>${this.islandState.tool ? "Click the island or use arrows + Enter. Invalid positions are marked red." : "Move or rotate this item, or store it safely in your permanent inventory."}</p><div>${!this.islandState.tool ? '<button data-selection-action="move">MOVE</button>' : ""}<button data-selection-action="rotate">ROTATE 45°</button>${!this.islandState.tool ? '<button data-selection-action="store">STORE</button>' : '<button data-selection-action="cancel">CANCEL</button>'}</div>`
      : '<p class="eyebrow">ISLAND LIFE</p><h2>A place to belong.</h2><p>Your pets roam peacefully here. Select an owned item to place it, or click a placed item to move, rotate, or store it. Everything saves automatically.</p>';
    this.overlay
      .querySelectorAll("[data-selection-action]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            this.callbacks.islandAction(b.dataset.selectionAction, {})),
      );
    const building = !!this.islandState.buildMode;
    $(".sanctuary-shell").classList.toggle("building", building);
    $("#build-toggle").textContent = building
      ? "FINISH BUILDING"
      : "ENTER BUILD MODE";
    $("#build-toggle").setAttribute("aria-pressed", String(building));
    $("#island-controls").textContent = building
      ? "DRAG: ORBIT - WASD: PAN - R: ROTATE - DELETE: STORE - ENTER: PLACE"
      : "DRAG: ORBIT - RIGHT-DRAG / WASD: PAN - SCROLL: ZOOM - CLICK A PET TO INTERACT - ESC: LEAVE";
    if (!building) {
      $("#island-selection").innerHTML =
        placement?.kind === "pet"
          ? `<p class="eyebrow">YOUR COMPANION</p>${portrait(item.id, "pet")}<h2>${esc(item.name)}</h2><p>${esc(modelMood(profile, placement))}</p><button class="button secondary" data-care>FEED & BOND</button><p>Care once per minute of active island time. Bonds survive every expedition.</p>`
          : '<p class="eyebrow">SANCTUARY LIFE</p><h2>Slow down. Stay awhile.</h2><p>Click a roaming pet to feed and bond. Orbit, zoom and explore. Enable build mode when you want to decorate.</p>';
      $("[data-care]")?.addEventListener("click", () =>
        this.callbacks.islandAction("care", { id: placement.id }),
      );
      let trials = $("#sanctuary-trials");
      if (!trials) {
        trials = document.createElement("aside");
        trials.id = "sanctuary-trials";
        trials.className = "sanctuary-trials";
        $(".sanctuary-shell").append(trials);
      }
      trials.innerHTML =
        '<p class="eyebrow">SANCTUARY TREASURES</p>' +
        ISLAND_TRIALS.map((t) => {
          const g = sanctuaryProgress(p, t),
            done = p.island.trials.includes(t.id),
            ready =
              g.seconds >= t.seconds &&
              g.pets >= t.pets &&
              g.decorations >= t.decorations &&
              g.care >= t.care &&
              g.rare;
          return `<article><strong>${t.name}</strong><small>${Math.min(t.pets, g.pets)}/${t.pets} pets  -  ${Math.min(t.decorations, g.decorations)}/${t.decorations} decorations<br>${Math.min(t.care, g.care)}/${t.care} care  -  ${Math.min(Math.floor(g.seconds / 60), t.seconds / 60)}/${t.seconds / 60} island minutes<br>${g.rare ? "READY:" : "NEED:"} Rare or better resident</small><span>${t.rewards.map((sku) => CATALOG[sku].name).join(" + ")}</span><button data-trial="${t.id}" ${!ready || done ? "disabled" : ""}>${done ? "TREASURES CLAIMED" : ready ? "CLAIM TREASURES" : "CONDITIONS NOT MET"}</button></article>`;
        }).join("");
      trials.querySelectorAll("[data-trial]").forEach(
        (b) =>
          (b.onclick = () =>
            this.callbacks.islandAction("claim-trial", {
              id: b.dataset.trial,
            })),
      );
    }
    $("#island-grid").textContent = `${p.island.grid ? "HIDE" : "SHOW"} GRID`;
  }
  islandHint(text) {
    if (this.view === "island" && $("#island-status").textContent !== text)
      $("#island-status").textContent = text;
  }
  showLegacy() {
    this.returnView = "menu";
    const achievements = ACHIEVEMENTS.map((a) => [
      a.id,
      a.name,
      `${a.description}${a.reward ? ` Reward: ${a.reward} DNA, once.` : ""}`,
    ]);
    const upgrades = [
      {
        id: "vitality",
        name: "Enduring bloodline",
        description: "Begin every life with more maximum vitality.",
        icon: "heart",
        effect: "+5% vitality per rank",
      },
      {
        id: "instinct",
        name: "Predator’s instinct",
        description: "Carry the strength of your ancestors into every hunt.",
        icon: "claw",
        effect: "+4% bite damage per rank",
      },
      {
        id: "metabolism",
        name: "Ancient metabolism",
        description: "Survive longer between meals and keep hunting.",
        icon: "leaf",
        effect: "−6% hunger drain per rank",
      },
    ];
    this.screen(
      "legacy",
      `<div class="wide-panel legacy-panel">${this.header("WHAT SURVIVES YOU", "An ancestral advantage.", "Every life leaves something behind. Spend ancestral DNA on permanent growth.")}
      <div class="dna-balance">${icon("dna")}<div><span>AVAILABLE ANCESTRAL DNA</span><strong>${number(this.profile.dna)}</strong></div></div>
      <div class="legacy-grid">${upgrades
        .map((entry) => {
          const rank = this.profile.upgrades?.[entry.id] || 0;
          const cost = upgradeCost(rank);
          return `<article class="legacy-card"><div class="legacy-icon">${icon(entry.icon)}</div><span class="eyebrow">RANK ${rank} / 5</span><h2>${entry.name}</h2><p>${entry.description}</p><span class="legacy-effect">${entry.effect}</span><div class="rank-pips">${Array.from({ length: 5 }, (_, i) => `<i class="${i < rank ? "filled" : ""}"></i>`).join("")}</div><button class="button ${rank < 5 && this.profile.dna >= cost ? "primary" : "secondary"}" data-upgrade="${entry.id}" ${rank >= 5 || this.profile.dna < cost ? "disabled" : ""}>${rank >= 5 ? "BLOODLINE MASTERED" : `UPGRADE · ${cost} DNA`} ${icon("dna")}</button></article>`;
        })
        .join("")}</div>
      <div class="legacy-records"><div><span>TOTAL HUNTS</span><strong>${number(this.profile.runs)}</strong></div><div><span>ALL-TIME KILLS</span><strong>${number(this.profile.totalKills)}</strong></div><div><span>BEST SCORE</span><strong>${number(this.profile.bestScore)}</strong></div><div><span>HIGHEST TIER</span><strong>${Math.max(0, this.profile.highestTier ?? -1) + 1}</strong></div></div>
      <section class="legacy-achievements"><h2 class="section-label">MARKS OF A SURVIVOR</h2><div class="achievement-grid">${achievements.map(([id, name, description]) => `<article class="achievement ${(this.profile.achievements || []).includes(id) ? "earned" : ""}">${icon("trophy")}<div><h3>${name}</h3><p>${description}</p></div><span>${(this.profile.achievements || []).includes(id) ? "EARNED" : "LOCKED"}</span></article>`).join("")}</div></section>
      ${
        (this.profile.history || []).length
          ? `<section class="recent-hunts"><h2 class="section-label">RECENT LIVES</h2><div class="hunt-list">${this.profile.history
              .slice(0, 5)
              .map(
                (run) =>
                  `<div class="hunt-row"><span class="hunt-form">${portrait(species(run.speciesId).id)}<strong>${esc(species(run.speciesId).name)}</strong></span><span>${clock(run.time)} SURVIVED</span><span>${number(run.kills)} KILLS</span><b>${number(run.score)} PTS</b></div>`,
              )
              .join("")}</div></section>`
          : ""
      }
      <div class="panel-bottom"><span>Upgrades apply when your next life begins.</span><button class="button primary" data-action="back" data-focus>RETURN ${icon("arrow")}</button></div></div>`,
      "shade-screen",
    );
    this.overlay.querySelectorAll("[data-upgrade]").forEach((button) =>
      button.addEventListener("click", () => {
        this.callbacks.upgrade(button.dataset.upgrade);
        this.showLegacy();
      }),
    );
    this.bind("back", () => this.back());
  }

  showSettings() {
    if (["menu", "pause"].includes(this._view)) this.returnView = this._view;
    const s = this.settings;
    const range = (id, name, hint) =>
      `<label class="setting-row" for="setting-${id}"><span><strong>${name}</strong><small>${hint}</small></span><div class="range-control"><input id="setting-${id}" data-setting="${id}" type="range" min="0" max="1" step="0.01" value="${s[id] ?? 0.7}"/><output id="output-${id}" for="setting-${id}">${Math.round((s[id] ?? 0.7) * 100)}%</output></div></label>`;
    const toggle = (id, name, hint) =>
      `<label class="setting-row" for="setting-${id}"><span><strong>${name}</strong><small>${hint}</small></span><span class="toggle"><input id="setting-${id}" data-setting="${id}" type="checkbox" ${s[id] ? "checked" : ""}/><i></i></span></label>`;
    this.screen(
      "settings",
      `<div class="wide-panel settings-panel">${this.header("MAKE THE WORLD YOURS", "Settings", "Changes save automatically.")}
      <div class="settings-columns"><section><h2 class="section-label">AUDIO</h2>${range("master", "Master volume", "All game audio")}${range("music", "Music", "Original ambient soundtrack")}${range("sfx", "Sound effects", "Combat, creatures, and the wild")}</section><section><h2 class="section-label">DISPLAY & COMFORT</h2><label class="setting-row" for="setting-quality"><span><strong>Visual quality</strong><small>Shadows and world detail</small></span><select id="setting-quality" data-setting="quality"><option value="low" ${s.quality === "low" ? "selected" : ""}>LOW</option><option value="medium" ${s.quality === "medium" ? "selected" : ""}>MEDIUM</option><option value="high" ${s.quality === "high" ? "selected" : ""}>HIGH</option></select></label>${toggle("shake", "Camera shake", "Impact feedback during combat")}${toggle("showDamage", "Damage numbers", "Show hit values above creatures")}<div class="setting-row"><span><strong>Fullscreen</strong><small>Toggle anytime with F11</small></span><button class="button compact secondary" data-action="fullscreen">TOGGLE</button></div></section></div>
      <p class="survival-tip">Press J during play for rare bloodline conditions. Meals increase size and strength in your current form. Menus support keyboard navigation. Audio starts after your first interaction. Pause automatically protects your run when the window loses focus.</p><div class="panel-bottom"><span>Stored locally on this device.</span><button class="button primary" data-action="back" data-focus>DONE ${icon("arrow")}</button></div></div>`,
      "shade-screen",
    );
    this.overlay.querySelectorAll("[data-setting]").forEach((input) =>
      input.addEventListener(
        input.type === "range" ? "input" : "change",
        () => {
          this.settings[input.dataset.setting] =
            input.type === "checkbox"
              ? input.checked
              : input.type === "range"
                ? Number(input.value)
                : input.value;
          const output = $(`#output-${input.dataset.setting}`);
          if (output)
            output.textContent = `${Math.round(Number(input.value) * 100)}%`;
          this.callbacks.settings({ ...this.settings });
        },
      ),
    );
    const comfort = document.createElement("section");
    comfort.className = "expedition-settings";
    comfort.innerHTML = `<h2 class="section-label">CONTROLS & ACCESSIBILITY</h2><label class="setting-row" for="setting-ui-scale"><span><strong>Interface size</strong><small>Enlarge the survival HUD and menus</small></span><select id="setting-ui-scale"><option value="0.85">COMPACT · 85%</option><option value="1">STANDARD · 100%</option><option value="1.15">LARGE · 115%</option><option value="1.25">EXTRA LARGE · 125%</option></select></label><label class="setting-row"><span><strong>Reduced motion</strong><small>Quiet interface animation and camera shake</small></span><input id="setting-reduced-motion" type="checkbox" ${s.reducedMotion ? "checked" : ""}/></label><label class="setting-row"><span><strong>Controller input</strong><small>Standard Xbox / PlayStation gamepad mapping</small></span><input id="setting-gamepad" type="checkbox" ${s.gamepad !== false ? "checked" : ""}/></label><div class="backup-actions"><button class="button secondary" data-action="controls">CUSTOMIZE CONTROLS</button><button class="button secondary" data-action="backups">SAVE BACKUPS</button></div>`;
    $(".settings-panel .survival-tip").before(comfort);
    $("#setting-ui-scale").value = String(s.uiScale || 1);
    $("#setting-ui-scale").onchange = (event) => {
      this.settings.uiScale = Number(event.target.value);
      this.callbacks.settings({ ...this.settings });
    };
    for (const [id, setting] of [["setting-reduced-motion", "reducedMotion"], ["setting-gamepad", "gamepad"]])
      $("#" + id).onchange = (event) => {
        this.settings[setting] = event.target.checked;
        this.callbacks.settings({ ...this.settings });
      };
    this.bind("controls", () => this.showControls());
    this.bind("backups", () => this.callbacks.backups?.());
    this.bind("fullscreen", () => this.callbacks.fullscreen());
    this.bind("back", () => this.back());
  }

  showControls() {
    const controls = this.settings.controls || DEFAULT_BINDINGS;
    this.screen("controls", `<div class="wide-panel controls-panel">${this.header("YOUR INSTINCTS, YOUR CONTROLS", "Customize controls", "Select an action and press a key. Occupied keys swap actions. Escape and F11 remain reserved.")}<p id="binding-hint" class="survival-tip" role="status">Mouse left-click always bites. Arrow keys provide movement unless rebound to another action.</p><div class="binding-grid">${ACTIONS.map(([action, label]) => `<button class="binding-button" data-binding="${action}" aria-label="Rebind ${label}, currently ${keyLabel(controls[action])}"><span>${label}</span><kbd>${keyLabel(controls[action])}</kbd></button>`).join("")}</div><p class="survival-tip"><strong>STANDARD CONTROLLER</strong>Left stick / D-pad: move · Right stick: aim · RT: bite · RB / LB: ability / technique · Y / Triangle: special · A / Cross: dash · X / Square: feed · B / Circle: evolution · Left stick click: sprint · View: map · Menu: pause. Relics use their keyboard controls.</p><div class="panel-bottom"><button class="button secondary" data-action="reset-controls">RESTORE DEFAULTS</button><button class="button primary" data-action="back">DONE</button></div></div>`, "shade-screen");
    this.overlay.querySelectorAll("[data-binding]").forEach((button) => button.onclick = () => {
      this.bindingTarget = button.dataset.binding;
      this.overlay.querySelectorAll("[data-binding]").forEach((item) => item.classList.toggle("listening", item === button));
      $("#binding-hint").textContent = `Press a key for ${ACTIONS.find(([action]) => action === this.bindingTarget)[1]}. Escape cancels.`;
    });
    this.bind("reset-controls", () => {
      this.settings.controls = { ...DEFAULT_BINDINGS };
      this.callbacks.settings({ ...this.settings });
      this.showControls();
    });
    this.bind("back", () => this.showSettings());
  }

  captureBinding(event) {
    if (!this.bindingTarget || this.view !== "controls") return false;
    if (event.code === "Escape") { this.showControls(); return true; }
    const next = rebind(this.settings.controls, this.bindingTarget, event.code);
    if (!next) {
      $("#binding-hint").textContent = "Choose a letter, number, arrow, Tab, Space, Shift or Ctrl. Escape cancels.";
      return true;
    }
    this.settings.controls = next;
    this.callbacks.settings({ ...this.settings });
    this.showControls();
    return true;
  }

  selectEvolutionIndex(idx) {
    if (this._view !== "evolution") return;
    const cards = this.overlay.querySelectorAll(".evolution-card");
    if (!cards[idx]) return;
    this.chosenEvolutionIndex = idx;
    this.chosenSpecies = cards[idx].dataset.species;
    cards.forEach((c, i) => {
      const isCardSel = i === idx;
      c.classList.toggle("selected", isCardSel);
      c.setAttribute("aria-pressed", isCardSel ? "true" : "false");
      if (isCardSel) c.focus({ preventScroll: true });
    });
  }

  cycleEvolutionSelection(direction) {
    if (this._view !== "evolution") return;
    const cards = this.overlay.querySelectorAll(".evolution-card");
    if (!cards.length) return;
    const nextIdx = ((this.chosenEvolutionIndex || 0) + direction + cards.length) % cards.length;
    this.selectEvolutionIndex(nextIdx);
  }

  confirmChosenEvolution() {
    if (this.isConfirmingEvolution || !this.chosenSpecies) return;
    this.isConfirmingEvolution = true;

    const cards = this.overlay.querySelectorAll(".evolution-card");
    cards.forEach((card) => {
      if (card.dataset.species === this.chosenSpecies) {
        card.classList.add("burst-confirmed");
        const ring = document.createElement("div");
        ring.className = "burst-shockwave-ring";
        card.appendChild(ring);
      } else {
        card.classList.add("dismissed");
      }
    });

    const bottomBtn = this.overlay.querySelector('[data-action="evolve"]');
    if (bottomBtn) {
      bottomBtn.classList.add("confirming");
      bottomBtn.textContent = "EVOLUTION EMBRACED! 🧬";
    }

    try {
      this.callbacks.audio?.play?.("evolve");
    } catch {}

    setTimeout(() => {
      this.callbacks.evolve(this.chosenSpecies, this.chosenMutation);
    }, 320);
  }

  showEvolution(game) {
    this.evolutionGame = game;
    this.isConfirmingEvolution = false;
    this.chosenEvolutionIndex = 0;
    this.chosenSpecies =
      typeof game.evolutionChoices?.[0] === "object"
        ? game.evolutionChoices[0].id
        : game.evolutionChoices?.[0];
    this.chosenMutation =
      typeof game.mutationChoices?.[0] === "object"
        ? game.mutationChoices[0].id
        : game.mutationChoices?.[0];
    const speciesChoices = game.evolutionChoices || [];
    const affinities = getActiveAffinities(game);
    const mutations = (game.mutationChoices || [])
      .map((id) =>
        typeof id === "object" ? id : MUTATIONS.find((m) => m.id === id),
      )
      .filter(Boolean);
    this.screen(
      "evolution",
      `<div class="wide-panel evolution-panel"><div class="evolution-title"><span class="evolution-orbit">${icon("dna")}</span><p class="eyebrow">THE WORLD CHANGED YOU</p><h1>Answer the call.</h1><p>Choose your next form and a mutation for this life.</p></div>
      <div class="evolution-choices" role="group" aria-label="Choose a species">${speciesChoices
        .map((id, i) => {
          const s = species(id);
          const hpDelta = Math.round((s.hp / game.species.hp - 1) * 100), atkDelta = Math.round((s.damage / game.species.damage - 1) * 100);
          const affinity = getAffinityForSpecies(s, affinities);
          const affinityBadge = affinity
            ? `<div class="behavior-match-pill" style="display:inline-flex;align-items:center;gap:4px;background:rgba(234,179,8,0.18);border:1px solid rgba(234,179,8,0.5);border-radius:12px;padding:2px 8px;font:700 11px system-ui;color:#fde047;margin-top:4px;"><span>${affinity.icon}</span> BEHAVIOR MATCH · ${esc(affinity.label.toUpperCase())}</div>`
            : "";
          const rarityMeta = EVOLUTION_RARITIES[s.rarity || "regular"] || EVOLUTION_RARITIES.regular;
          return `<button class="evolution-card rarity-${esc(s.rarity || "regular")} ${i === 0 ? "selected" : ""}" data-species="${esc(s.id)}" data-rarity="${s.rarity || "regular"}" style="--stagger:${i}; --lineage-color:${rarityMeta.color}; --card-color:${rarityMeta.color}; --card-glow:${rarityMeta.color}55;" aria-pressed="${i === 0}">
            <div class="card-ambient-glow"></div>
            <div class="card-key-pill"><kbd>${i + 1}</kbd> <span>FORM</span></div>
            <span class="eyebrow">TIER ${s.tier + 1} / ${esc(tierName(s.tier))}</span>
            <span class="evolution-rarity">${rarityMeta.name.toUpperCase()}${s.bloodline ? " - EARNED BLOODLINE" : ""}</span>
            <div class="evolution-creature">${portrait(s.id)}</div>
            <h2>${esc(s.name)}</h2>
            ${affinityBadge}
            <p>${esc(s.description)}</p>
            <div class="species-stats">
              <span>HP <b>${s.hp}</b><small>${hpDelta >= 0 ? "+" : ""}${hpDelta}%</small></span>
              <span>ATK <b>${s.damage}</b><small>${atkDelta >= 0 ? "+" : ""}${atkDelta}%</small></span>
              <span>SPD <b>${s.speed}</b></span>
            </div>
            <span class="evolution-body">${s.compactEvolution ? "COMPACT RARE FORM" : "LARGER EVOLVED BODY"} · ${creatureKit(s).abilityCount} SKILLS</span>
            <span class="species-ability">${esc(skillSummary(s))}</span>
            <span class="choice-indicator"></span>
          </button>`;
        })
        .join("")}</div>
      <div class="mutation-heading"><span class="eyebrow">ADAPTATION</span><p>One mutation. Every future form.</p></div><div class="mutation-choices" role="group" aria-label="Choose a mutation">${mutations.map((m, i) => `<button class="mutation-card ${i === 0 ? "selected" : ""}" data-mutation="${esc(m.id)}" aria-pressed="${i === 0}">${icon("dna")}<span><strong>${esc(m.name)}</strong><small>${esc(m.description)}</small></span><span class="choice-indicator"></span></button>`).join("")}</div>
      <div class="panel-bottom">
        <span class="keyboard-nav-hint">Keys <kbd>[1]</kbd> <kbd>[2]</kbd> <kbd>[3]</kbd> or <kbd>←</kbd> <kbd>→</kbd> + <kbd>ENTER</kbd> to evolve.</span>
        <button class="button secondary" data-action="postpone">KEEP GROWING - ESC</button>
        <button class="button primary" data-action="evolve" data-focus>EMBRACE EVOLUTION ${icon("arrow")}</button>
      </div></div>`,
      "shade-screen evolution-screen",
    );
    this.bind("postpone", () => this.callbacks.postpone());

    const speciesCards = this.overlay.querySelectorAll(".evolution-card");
    speciesCards.forEach((button, idx) => {
      attach3DTilt(button);
      button.addEventListener("click", () => {
        if (this.chosenEvolutionIndex === idx) {
          this.confirmChosenEvolution();
        } else {
          this.selectEvolutionIndex(idx);
        }
      });
      button.addEventListener("dblclick", () => {
        this.confirmChosenEvolution();
      });
    });

    this.overlay.querySelectorAll("[data-mutation]").forEach((button) =>
      button.addEventListener("click", () => {
        this.chosenMutation = button.dataset.mutation;
        this.overlay.querySelectorAll("[data-mutation]").forEach((b) => {
          b.classList.toggle("selected", b === button);
          b.setAttribute("aria-pressed", b === button);
        });
      }),
    );
    this.bind("evolve", () => this.confirmChosenEvolution());
  }

  selectStarter(speciesId) {
    if (!speciesId) return;
    this.selectedStarterId = speciesId;
    const container = $("#starter-choices");
    if (container) {
      container.querySelectorAll(".starter-egg-card").forEach((c) => {
        c.classList.toggle("selected", c.dataset.starter === speciesId);
      });
    }
  }

  selectMutationIndex(idx, autoConfirm = false) {
    if (this._view !== "mutation-choice" || !this.mutationChoices?.[idx]) return;
    this.chosenMutationIndex = idx;
    this.chosenMutationId = this.mutationChoices[idx].id;
    const cards = this.overlay.querySelectorAll(".mutation-pick-card");
    cards.forEach((card, i) => {
      const isCardSel = i === idx;
      card.classList.toggle("selected", isCardSel);
      card.setAttribute("aria-pressed", isCardSel ? "true" : "false");
      if (isCardSel) {
        card.focus({ preventScroll: true });
      }
    });
    if (autoConfirm) {
      this.confirmChosenMutation();
    }
  }

  cycleMutationSelection(direction) {
    if (this._view !== "mutation-choice" || !this.mutationChoices?.length) return;
    const total = this.mutationChoices.length;
    const nextIdx = (this.chosenMutationIndex + direction + total) % total;
    this.selectMutationIndex(nextIdx, false);
  }

  confirmChosenMutation(mutationId = this.chosenMutationId) {
    if (this.isConfirmingMutation || !mutationId) return;
    this.isConfirmingMutation = true;

    const cards = this.overlay.querySelectorAll(".mutation-pick-card");
    cards.forEach((card) => {
      if (card.dataset.mutation === mutationId) {
        card.classList.add("burst-confirmed");
        const ring = document.createElement("div");
        ring.className = "burst-shockwave-ring";
        card.appendChild(ring);
      } else {
        card.classList.add("dismissed");
      }
    });

    const bottomBtn = this.overlay.querySelector('[data-action="apply-mutation"]');
    if (bottomBtn) {
      bottomBtn.classList.add("confirming");
      bottomBtn.textContent = "MUTATION EMBRACED! ⚡";
    }

    try {
      this.callbacks.audio?.play?.("evolve");
    } catch {}

    setTimeout(() => {
      this.callbacks.applyMutation(mutationId);
    }, 320);
  }

  showMutationChoice(game, event = null) {
    this.mutationGame = game;
    this.isConfirmingMutation = false;
    const choices = (event?.choices || (game.pendingMutationChoices || []).map((id) => MUTATIONS.find((m) => m.id === id))).filter(Boolean);
    this.mutationChoices = choices;
    this.chosenMutationIndex = 0;
    this.chosenMutationId = choices[0]?.id || null;
    const rarity = event?.rarity || "common";
    const rarityMeta = MUTATION_RARITIES[rarity] || MUTATION_RARITIES.common;
    this.screen(
      "mutation-choice",
      `<div class="wide-panel mutation-choice-panel">
        <div class="mutation-choice-header">
          <span class="mutation-crystal-orbit" style="--glow-color:${rarityMeta.color}">${icon("dna")}</span>
          <p class="eyebrow" style="color:${rarityMeta.color}">GENETIC CATALYST · ${esc(rarity.toUpperCase())} HARVEST</p>
          <h1>Adapt. Mutate. Ascend.</h1>
          <p>You have felled a worthy foe and absorbed an ancient evolutionary catalyst. Select 1 of 3 permanent mutations:</p>
        </div>
        <div class="mutation-card-grid" role="group" aria-label="Select a mutation">
          ${choices.map((m, idx) => {
            const mRarity = MUTATION_RARITIES[m.rarity] || MUTATION_RARITIES.common;
            const isSel = idx === 0;
            const cat = m.category || BUILD_MUTATIONS[m.id]?.category || "offensive";
            const catDef = BUILD_CATEGORIES[cat];
            const currentLvl = m.currentLvl || game?.build?.[cat]?.[m.id] || 0;
            const nextLvl = m.nextLvl || currentLvl + 1;
            const isUpgrade = m.isUpgrade || currentLvl > 0;
            const levelDesc = m.levelDesc || m.description;
            const deltas = computeUpgradeDiff(m, currentLvl, nextLvl);
            return `
              <button type="button" class="mutation-pick-card rarity-${esc(m.rarity || "common")} ${isSel ? "selected" : ""} ${m.wouldSynergize ? "synergy-ready" : ""}" data-mutation="${esc(m.id)}" data-card-idx="${idx}" style="--stagger:${idx}; --card-border:${mRarity.border}; --card-bg:${mRarity.bg}; --card-color:${mRarity.color}; --card-glow:${mRarity.color}55;">
                <div class="card-ambient-glow"></div>
                <div class="card-top-row">
                  <div class="card-key-pill"><kbd>${idx + 1}</kbd> <span>SELECT</span></div>
                  <span class="card-category-pill" style="border-color:${catDef?.border || mRarity.border}; color:${catDef?.color || mRarity.color}">${catDef?.icon || "🧬"} ${esc(catDef?.name || "Mutation")}</span>
                  <span class="card-rarity-pill rarity-${esc(m.rarity || "common")}">${esc(mRarity.name.toUpperCase())}</span>
                </div>
                ${m.wouldSynergize ? `<div class="card-synergy-banner">🔥 SYNERGY UNLOCK READY: ${esc(m.wouldSynergizeName || "COMBINATION")}!</div>` : ""}
                <div class="mutation-symbol-ring" style="color:${mRarity.color}">${catDef?.icon || icon("dna")}</div>
                <h2>${esc(m.name)}</h2>
                ${renderRankBadgeHTML(currentLvl, nextLvl, isUpgrade)}
                <p class="mutation-desc">${esc(levelDesc)}</p>
                ${renderCardDiffsHTML(deltas)}
                <div class="mutation-pick-btn">${isUpgrade ? `UPGRADE TO RANK ${nextLvl}` : "EMBRACE MUTATION"}</div>
              </button>
            `;
          }).join("")}
        </div>
        <div class="panel-bottom mutation-choice-bottom">
          <span class="keyboard-nav-hint">Use keys <kbd>[1]</kbd> <kbd>[2]</kbd> <kbd>[3]</kbd> or <kbd>←</kbd> <kbd>→</kbd> + <kbd>ENTER</kbd> to select.</span>
          <button class="button secondary" data-action="postpone-mutation">POSTPONE (ESC)</button>
          <button class="button primary" data-action="apply-mutation" data-focus>EMBRACE MUTATION ${icon("arrow")}</button>
        </div>
      </div>`,
      "shade-screen mutation-modal-screen",
    );
    this.bind("postpone-mutation", () => this.callbacks.postponeMutation?.());

    const cardElements = this.overlay.querySelectorAll(".mutation-pick-card");
    cardElements.forEach((card, idx) => {
      attach3DTilt(card);
      card.addEventListener("click", () => {
        if (this.chosenMutationIndex === idx) {
          this.confirmChosenMutation(card.dataset.mutation);
        } else {
          this.selectMutationIndex(idx, false);
        }
      });
      card.addEventListener("dblclick", () => {
        this.confirmChosenMutation(card.dataset.mutation);
      });
    });

    this.bind("apply-mutation", () => {
      this.confirmChosenMutation();
    });
  }

  showBuildSheet(game = this.currentGame) {
    if (!game) return;
    this.currentGame = game;
    if (["menu", "pause"].includes(this._view)) this.returnView = this._view;
    else if (this._view === "hud") this.returnView = "hud";
    const b = game.build || { offensive: {}, defensive: {}, passive: {}, transformations: {}, activeSynergies: [] };
    const buildPower = calculateBuildPower(b);

    const renderCategorySlots = (catKey) => {
      const catDef = BUILD_CATEGORIES[catKey];
      const maxSlots = catDef.maxEquipped;
      const equipped = Object.entries(b[catKey] || {});
      const slotsHTML = [];
      for (let i = 0; i < maxSlots; i++) {
        if (i < equipped.length) {
          const [id, lvl] = equipped[i];
          const def = BUILD_MUTATIONS[id] || MUTATIONS.find((m) => m.id === id) || { name: id, icon: "🧬" };
          const lvlData = def.levels?.[lvl - 1];
          slotsHTML.push(`
            <div class="build-slot filled">
              <div class="slot-header">
                <span class="slot-icon">${def.icon || "🧬"}</span>
                <span class="slot-name">${esc(def.name)}</span>
                <span class="slot-stars">${renderStars(lvl)}</span>
              </div>
              <p class="slot-desc">${esc(lvlData?.desc || def.description || "")}</p>
            </div>
          `);
        } else {
          slotsHTML.push(`
            <div class="build-slot empty">
              <span class="slot-empty-label">+ Empty ${esc(catDef.name)} Slot</span>
            </div>
          `);
        }
      }
      return slotsHTML.join("");
    };

    const synergiesHTML = Object.entries(MUTATION_SYNERGIES).map(([key, syn]) => {
      const isUnlocked = b.activeSynergies?.includes(key);
      return `
        <div class="synergy-card ${isUnlocked ? "unlocked" : "locked"}" style="--syn-color:${syn.color}; --syn-border:${syn.border}; --syn-bg:${syn.bg}">
          <div class="synergy-card-header">
            <span class="synergy-icon">${syn.icon}</span>
            <div class="synergy-title-wrap">
              <h3>${esc(syn.name)}</h3>
              <span class="synergy-req">${esc(syn.reqText)}</span>
            </div>
            <span class="synergy-status-badge">${isUnlocked ? "⚡ UNLOCKED" : "🔒 LOCKED"}</span>
          </div>
          <p class="synergy-desc">${esc(syn.description)}</p>
        </div>
      `;
    }).join("");

    this.screen(
      "build-sheet",
      `<div class="wide-panel build-sheet-panel">
        <div class="build-sheet-header">
          <div class="build-header-left">
            <span class="build-icon">${icon("dna")}</span>
            <div>
              <p class="eyebrow">PREHISTORIC GENETICS</p>
              <h1>Dinosaur Mutation Build</h1>
              <p>Stack, combine, and master up to 4 mutations across each evolutionary discipline.</p>
            </div>
          </div>
          <div class="build-power-badge">
            <span>APEX BUILD POWER</span>
            <strong>⚡ ${Math.round(buildPower)}</strong>
          </div>
        </div>

        <div class="build-categories-grid">
          <div class="build-category-col" style="--col-color:#f87171; --col-border:#ef4444">
            <div class="category-header">
              <span>⚔️</span>
              <h2>Offensive Mutations</h2>
              <small>Max 4 Equipped</small>
            </div>
            <div class="category-slots">${renderCategorySlots("offensive")}</div>
          </div>

          <div class="build-category-col" style="--col-color:#38bdf8; --col-border:#0284c7">
            <div class="category-header">
              <span>🛡️</span>
              <h2>Defensive Adaptations</h2>
              <small>Max 4 Equipped</small>
            </div>
            <div class="category-slots">${renderCategorySlots("defensive")}</div>
          </div>

          <div class="build-category-col" style="--col-color:#fbbf24; --col-border:#d97706">
            <div class="category-header">
              <span>⚡</span>
              <h2>Passive Abilities</h2>
              <small>Max 4 Equipped</small>
            </div>
            <div class="category-slots">${renderCategorySlots("passive")}</div>
          </div>
        </div>

        <div class="synergy-section">
          <div class="synergy-section-header">
            <h2>🧬 Powerful Mutation Synergies</h2>
            <p>Combine maximum level mutations to unlock devastating battlefield transformations.</p>
          </div>
          <div class="synergy-grid">${synergiesHTML}</div>
        </div>

        <div class="panel-bottom build-sheet-bottom">
          <span class="hint-muted">Tip: Felling predators and alphas drops rare catalyst crystals to expand your build.</span>
          <button class="button primary" data-action="close-build" data-focus>CLOSE BUILD (ESC / B)</button>
        </div>
      </div>`,
      "shade-screen build-modal-screen",
    );

    this.bind("close-build", () => this.back());
  }

  showDeath(results, profile) {
    this.profile = profile;
    this.lastResults = results;
    const s = species(results.speciesId);
    const best = results.score >= (profile.bestScore || 0) && results.score > 0;
    const strongestName = results.strongestDefeated ? (species(results.strongestDefeated)?.name || results.strongestDefeated) : "None";
    this.screen(
      "death",
      `<div class="wide-panel death-panel"><div class="death-left"><span class="death-symbol">${icon("skull")}</span><p class="eyebrow">THE FOOD CHAIN REMEMBERS</p><h1>End of a life.<br><em>Start of a legacy.</em></h1><p class="death-cause">${esc(results.cause || "The wild claimed another survivor.")}</p><div class="final-species">${portrait(s.id)}<div><span>FINAL FORM · TIER ${(results.tier ?? s.tier) + 1}</span><h2>${esc(s.name)}</h2></div></div></div><div class="death-right"><div class="final-score"><span>${best ? "A NEW PERSONAL BEST" : "YOUR FINAL SCORE"}</span><strong>${number(results.score)}</strong></div><div class="death-stats"><div><span>TIME SURVIVED</span><strong>${clock(results.time)}</strong></div><div><span>PREY HUNTED</span><strong>${number(results.kills)}</strong></div><div><span>EVOLUTION REACHED</span><strong>${esc(tierName(results.tier ?? s.tier))}</strong></div><div><span>STRONGEST FOE</span><strong>${esc(strongestName)}</strong></div><div><span>DOMINATED</span><strong>${results.dominatedRegions?.length || 0} Biomes</strong></div><div><span>HEIRS RAISED</span><strong>${results.offspringCount || 0}</strong></div></div><div class="dna-earned">${icon("dna")}<span>RARE DNA BANKED THIS LIFE</span><strong>+${number(results.dna)}</strong></div><div class="stacked-buttons"><button class="button primary" data-action="restart" data-focus>ONE MORE LIFE ${icon("arrow")}</button><button class="button secondary" data-action="compendium-lineage">VIEW FAMILY TREE</button><button class="button secondary" data-action="menu">RETURN TO TITLE</button></div></div></div>`,
      "shade-screen death-screen",
    );
    this.bind("restart", () => this.callbacks.restart());
    this.bind("compendium-lineage", () => this.showCompendium("lineage", null));
    this.bind("menu", () => this.callbacks.menu());
  }

  updateProfile(profile) {
    this.profile = profile;
  }

  back() {
    if (this._view === "evolution" || this._view === "mutation-choice") return false;
    if (this.returnView === "hud" && this.callbacks.resume) this.callbacks.resume();
    else if (this.returnView === "pause") this.showPause();
    else if (this.returnView === "death" && this.lastResults)
      this.showDeath(this.lastResults, this.profile);
    else this.showMenu();
    return true;
  }

  toast(text) {
    const element = $("#toast");
    element.textContent = text;
    element.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(
      () => element.classList.remove("visible"),
      3200,
    );
  }
}
