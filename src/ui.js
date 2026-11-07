import { SPECIES, MUTATIONS, TIERS } from "./data.js";
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
            <div class="menu-actions"><button class="button primary play-button" data-action="start" data-focus><span>${icon("claw")} BEGIN A NEW LIFE</span>${icon("arrow")}</button>
              <div class="secondary-actions"><button class="button quiet" data-action="tutorial">${icon("book")} HOW TO SURVIVE</button><button class="button quiet" data-action="guide">ENCYCLOPEDIA ${icon("arrow")}</button></div>
              <button class="legacy-link" data-action="legacy">${icon("dna")}<span>THE ANCESTRAL LEGACY <b>${number(profile.dna)} DNA</b></span>${icon("arrow")}</button>
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
        <footer class="menu-footer"><div class="menu-record"><span>BEST RUN <strong>${number(profile.bestScore)}</strong></span><span>LIVES LIVED <strong>${number(profile.runs)}</strong></span><span>SPECIES DISCOVERED <strong>${new Set([...(profile.unlocked || []), ...(profile.hunted || [])]).size} / ${SPECIES.length}</strong></span></div><div class="version-label"><span class="status-dot"></span> OFFLINE SINGLE PLAYER <span class="version">v0.5.0</span><button data-action="quit" class="text-button">QUIT</button></div></footer>
      </div>`,
      "menu-screen",
    );
    this.bind("start", () => this.callbacks.start(this.difficulty));
    this.bind("tutorial", () => this.showTutorial());
    this.bind("guide", () => this.showGuide());
    this.bind("wardrobe", () => this.showWardrobe());
    this.bind("shop", () => this.showShop());
    this.bind("island", () => this.callbacks.island());
    this.bind("legacy", () => this.showLegacy());
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

  buildHUD() {
    this.hud.innerHTML = `
      <div class="hud-top"><div class="species-card"><span class="species-emblem" id="hud-emblem">${icon("claw")}</span><div><p class="eyebrow" id="hud-tier">A NEW LIFE</p><h2 id="hud-species">The beginning</h2><span class="small-muted" id="hud-biome">FERN MEADOW</span></div></div>
        <div class="hud-run"><span class="hud-dna" id="hud-dna">0 DNA</span><span class="run-timer" id="hud-time">00:00</span><span class="run-kills">${icon("skull")}<b id="hud-kills">0</b></span><button class="icon-button" id="pause-button" aria-label="Pause game">${icon("pause")}</button></div></div>
      <div class="minimap-wrap"><div class="map-header"><span>THE LOST CONTINENT</span><span>N ↑</span></div><canvas id="minimap" width="180" height="180" aria-label="Minimap with player, nearby creatures, and food"></canvas><div class="map-footer"><span class="status-dot"></span><span id="hud-threat">ECOSYSTEM STABLE</span></div></div>
      <div class="hud-bottom"><div class="vitals"><div class="vital"><div class="vital-label">${icon("heart")}<span>VITALITY</span><b id="hud-hp-text">100 / 100</b></div><div class="meter health"><span id="hud-hp"></span></div></div><div class="minor-vitals"><div class="vital"><div class="vital-label">${icon("bolt")}<span>STAMINA</span></div><div class="meter stamina"><span id="hud-stamina"></span></div></div><div class="vital"><div class="vital-label">${icon("leaf")}<span>HUNGER</span></div><div class="meter hunger"><span id="hud-hunger"></span></div></div></div><p class="hunger-warning" id="hud-warning"></p></div>
      <div class="abilities"><div class="ability-key"><kbd>LMB</kbd>${icon("claw")}<span>BITE</span><i id="attack-ready"></i></div><div class="ability-key"><kbd>Q</kbd>${icon("bolt")}<span id="hud-ability">PRIMAL INSTINCT</span><b id="hud-ability-cooldown">READY</b></div><div class="ability-key"><kbd>SHIFT</kbd>${icon("arrow")}<span id="dash-name">DASH</span><b id="hud-dash-cooldown">READY</b></div><div class="ability-key eat-key"><kbd>E</kbd>${icon("leaf")}<span>FEED</span><b>HOLD</b></div></div>
      <div class="evolution-progress"><div class="evolution-heading"><span>${icon("dna")} NEXT EVOLUTION</span><b id="hud-xp-text">0 / 60</b></div><div class="meter xp"><span id="hud-xp"></span></div><p id="hud-score">SCORE 0</p><button id="evolve-ready" hidden aria-label="Open evolution choices"><kbd>T</kbd> EVOLUTION READY <span>CHOOSE WHEN YOU ARE READY</span></button><span id="growth-status"></span><button id="bloodline-journal">J - BLOODLINE PATHS</button></div></div>
      <div class="hud-controls">${small("W A S D", "MOVE")}${small("MOUSE", "AIM")}${small("SPACE", "BITE")}${small("ESC", "PAUSE")}</div>
      <div id="egg-prompt" class="egg-prompt" hidden><p class="eyebrow">A NEW LIFE STIRS</p><h2>Break into the unknown.</h2><p>Every predator was once prey. Your species is decided at birth.</p><button id="hatch-button" class="button primary">CRACK THE SHELL ${icon("arrow")}</button><span class="small-muted">PRESS E OR CLICK TO HATCH</span></div>
    `;
    $("#pause-button").addEventListener("click", () =>
      this.callbacks.pause?.(),
    );
    $("#evolve-ready").onclick = () => this.callbacks.evolution();
    $("#bloodline-journal").onclick = () => {
      this.callbacks.pause();
      this.callbacks.bloodlines();
    };
    const extra = document.createElement("div");
    extra.className = "ability-key special-key";
    extra.id = "special-key";
    extra.innerHTML =
      '<kbd>X</kbd><span id="special-name"></span><b id="special-cooldown">READY</b>';
    $(".abilities").append(extra);
    $("#hatch-button").addEventListener("click", () => this.callbacks.hatch());
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
    $("#hud-hunger").style.width = `${Math.max(0, p.hunger)}%`;
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
    $("#evolve-ready").hidden =
      !game.evolutionReady || game.state !== "playing";
    $("#growth-status").textContent =
      `${growthName(p.growth || 0).toUpperCase()} - ${Math.round((p.growth || 0) * 100)}% GROWTH - ${Math.round((1 + (p.growth || 0) * 0.28) * 100)}% SIZE`;
    const kit = creatureKit(s),
      special = SPECIALS[kit.special];
    $("#special-key").hidden = !special;
    if (special) {
      $("#special-name").textContent = special.name;
      $("#special-cooldown").textContent =
        p.specialCooldown > 0 ? `${p.specialCooldown.toFixed(1)}s` : "READY";
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
    this.hud.classList.toggle("critical", p.hp < p.maxHp * 0.25);
  }

  showBloodlines(game) {
    this.returnView = game ? "pause" : "menu";
    const eligible = game ? eligibleBloodlines(game) : [],
      g = game?.lineage;
    this.screen(
      "bloodlines",
      `<div class="wide-panel bloodline-panel">${this.header("THE HIDDEN ANCESTRY", "Bloodline Paths", "Rare conditions belong to this life. Nothing carries over after death.")}<p class="lineage-counters">${g ? `Sunheart fruit: ${g.fruits.sunheart} / Moondrop fruit: ${g.fruits.moondrop} / Lava creatures: ${g.lavaKills} / Guardians: ${g.guardians}` : "Start a life to track these conditions."}</p><div class="bloodline-grid">${BLOODLINES.map(
        (b) => {
          const s = species(b.speciesId),
            used = g?.used.includes(b.id),
            ready = eligible.some((e) => e.id === b.id);
          return `<article style="--lineage-color:${EVOLUTION_RARITIES[s.rarity].color}"><img src="assets/portraits/species-${s.id}.webp" alt=""/><span class="evolution-rarity">${s.rarity.toUpperCase()} - TIER ${b.tier + 1}</span><h2>${s.name}</h2><p>${b.description}</p><strong>${used ? "CLAIMED THIS LIFE" : ready ? "AVAILABLE AT YOUR NEXT EVOLUTION" : "CONDITIONS NOT MET"}</strong></article>`;
        },
      ).join(
        "",
      )}</div><div class="panel-bottom"><span>Press T when the evolution indicator flashes. Reopening choices does not reroll them.</span><button class="button primary" data-action="back">RETURN</button></div></div>`,
      "shade-screen",
    );
    this.bind("back", () => this.back());
  }
  showPause() {
    this.returnView = "pause";
    this.screen(
      "pause",
      `<div class="modal-panel pause-panel"><p class="eyebrow">THE HUNT CAN WAIT</p><h1>Catch your breath.</h1><p class="panel-subtitle">Your world is paused.</p><div class="stacked-buttons"><button class="button primary" data-action="resume" data-focus>RESUME THE HUNT ${icon("arrow")}</button><button class="button secondary" data-action="settings">${icon("settings")} SETTINGS</button><button class="button secondary" data-action="bloodlines">BLOODLINE PATHS</button><button class="button secondary" data-action="guide">${icon("book")} ENCYCLOPEDIA</button><button class="button secondary" data-action="tutorial">${icon("book")} SURVIVAL GUIDE</button><button class="button quiet" data-action="menu">END RUN & RETURN TO TITLE</button></div><div class="run-adaptations"><strong>THIS LIFE</strong><p>${(this.currentGame?.mutations || []).map((id) => esc(MUTATIONS.find((m) => m.id === id)?.name || id)).join(" · ") || "No mutations yet."}</p><p>${(this.currentGame?.runSkills || []).map((s) => esc(RUN_SKILLS.find((r) => r.id === s.id)?.name || s.id)).join(" · ") || "Ancient skills await discovery."}</p></div><p class="small-muted">Rare DNA and permanent finds save immediately. Ordinary deaths grant no DNA.</p><span class="pause-hint">ESC TO RESUME</span></div>`,
      "shade-screen",
    );
    this.bind("resume", () => this.callbacks.resume());
    this.bind("bloodlines", () => this.showBloodlines(this.currentGame));
    this.bind("settings", () => this.showSettings());
    this.bind("tutorial", () => this.showTutorial());
    this.bind("guide", () => this.showGuide());
    this.bind("menu", () => this.callbacks.menu());
  }

  showTutorial() {
    if (["menu", "pause", "death"].includes(this._view))
      this.returnView = this._view;
    this.screen(
      "tutorial",
      `<div class="wide-panel guide-panel">${this.header("KNOW THE LAW OF THE WILD", "Survive. Adapt. Repeat.", "Your life is temporary. Your lineage is not.")}
      <div class="tutorial-grid"><article class="tutorial-card"><span class="step-number">01</span><div class="tutorial-symbol">${icon("leaf")}</div><h2>Earn your first breath.</h2><p>Hatch into a random beginner species. Explore the meadows and feed on plants while you learn your surroundings. Hold <kbd>E</kbd> near food to eat.</p></article>
      <article class="tutorial-card"><span class="step-number">02</span><div class="tutorial-symbol">${icon("claw")}</div><h2>Hunt with intention.</h2><p>Aim with the mouse and bite with <kbd>LMB</kbd> or <kbd>SPACE</kbd>. Watch enemy movement. Mobile forms can dash with <kbd>SHIFT</kbd>; heavy forms rely on defense or healing. Use <kbd>Q</kbd>, <kbd>R</kbd> and your available <kbd>X</kbd> skill. Circle back and eat the remains. Larger predators are deadly.</p></article>
      <article class="tutorial-card"><span class="step-number">03</span><div class="tutorial-symbol">${icon("dna")}</div><h2>Become something greater.</h2><p>Food fills your evolution bar. When the indicator flashes, press <kbd>T</kbd> to choose a new species and mutation. You can keep growing or postpone without rerolling. Branch into armored herbivores, fearsome hunters, and eventually creatures of myth.</p></article>
      <article class="tutorial-card"><span class="step-number">04</span><div class="tutorial-symbol">${icon("trophy")}</div><h2>Leave a legacy.</h2><p>DNA is rare: earn it once from selected achievements or find rare DNA clusters. Spend it on permanent skins, crowns, pets, island decorations or lineage upgrades. Permanent finds save immediately and survive death.</p></article></div>
      <div class="control-reference"><h3>YOUR INSTINCTS</h3><div class="controls-grid">${small("W A S D / ARROWS", "Move")}${small("MOUSE", "Aim")}${small("LMB / SPACE", "Bite")}${small("Q", "Species ability")}${small("SHIFT", "Dodge / dash")}${small("E", "Feed / hatch")}${small("TAB", "Field guide")}${small("ESC", "Pause")}${small("M", "Expand map")}${small("F11", "Fullscreen")}</div></div>
      <p class="survival-tip"><strong>A LIVING CONTINENT</strong> Hold <kbd>CTRL</kbd> to sprint. Use <kbd>R</kbd> for your species technique. Find ancient relics to gain <kbd>F / G / C / V / B / N</kbd> skills until death. Rare flowers grant timed damage, speed, magnet, auto-eat, shield or healing effects. Uneaten eggs hatch. Food from weak regions becomes ineffective as you evolve: use <kbd>M</kbd> to plan your journey and click the map to mark a destination. Red circles show enemy strikes before they land.</p>
      <div class="panel-bottom"><span>Death is part of evolution.</span><button class="button primary" data-action="back" data-focus>I’M READY ${icon("arrow")}</button></div></div>`,
      "shade-screen",
    );
    this.bind("back", () => this.back());
  }

  showGuide() {
    if (["menu", "pause"].includes(this._view)) this.returnView = this._view;
    const unlocked = [
      ...new Set([
        ...(this.profile.unlocked || []),
        ...(this.profile.hunted || []),
      ]),
    ];
    this.guideSelection ||= unlocked.at(-1) || SPECIES[0].id;
    this.screen(
      "guide",
      `<div class="wide-panel encyclopedia-panel">${this.header("THE LIVING ARCHIVE", "Dinosaur Encyclopedia", `${unlocked.length} evolved or hunted forms recorded · ${SPECIES.length} dinosaur and mythical species · eight tiers`)}
      <div class="encyclopedia-toolbar"><label>SEARCH<input id="guide-search" type="search" placeholder="Name, habitat or ability…" autocomplete="off"/></label><label>COLLECTION<select id="guide-filter"><option value="all">All potential forms</option><option value="unlocked">Evolved or hunted</option><option value="mythic">Mythological creatures</option>${TIERS.map((name, i) => `<option value="tier:${i}">${i + 1} · ${esc(name)}</option>`).join("")}</select></label></div>
      <div class="encyclopedia-layout"><section class="specimen-panel"><canvas id="specimen-canvas" aria-label="Rotating 3D dinosaur specimen. Drag to rotate."></canvas><span class="specimen-hint">LIVE 3D SPECIMEN · DRAG TO ROTATE</span><div id="specimen-info"></div></section><div id="guide-results" class="species-grid encyclopedia-results"></div></div>
      <div class="panel-bottom"><span>Discovery records persist when you hatch or evolve. Unrecorded forms are previews.</span><button class="button primary" data-action="back" data-focus>RETURN ${icon("arrow")}</button></div></div>`,
      "shade-screen",
    );
    const showDetails = (s) => {
      this.guideSelection = s.id;
      const technique = TECHNIQUES[s.technique];
      $("#specimen-info").innerHTML =
        `<span class="eyebrow">${unlocked.includes(s.id) ? "DISCOVERED & RECORDED" : "UNDISCOVERED · FUTURE FORM"} / ${esc(tierName(s.tier))}</span><h2>${esc(s.name)}</h2><p>${esc(s.description)}</p><div class="species-stats"><span>HP <b>${s.hp}</b></span><span>ATK <b>${s.damage}</b></span><span>SPD <b>${s.speed}</b></span></div><dl><dt>Q · ${esc(s.ability)}</dt><dd>${esc(s.abilityDescription)}</dd><dt>R · ${esc(technique.name)}</dt><dd>${esc(technique.description)}</dd>${SPECIALS[creatureKit(s).special] ? `<dt>X - ${SPECIALS[creatureKit(s).special].name}</dt><dd>${SPECIALS[creatureKit(s).special].description}</dd>` : ""}<dt>Mobility</dt><dd>${creatureKit(s).dash ? "Shift: dodge/dash available." : "Heavy form: no dash. Use positioning, sprint and defensive skills."}</dd><dt>Innate adaptation</dt><dd>${esc(s.passive)}</dd><dt>Habitat & temperament</dt><dd>${esc(s.habitat)} · ${esc(s.temperament)}.</dd></dl>`;
      $("#guide-results")
        .querySelectorAll("[data-inspect]")
        .forEach((b) =>
          b.setAttribute("aria-pressed", String(b.dataset.inspect === s.id)),
        );
    };
    const renderCards = () => {
      const query = $("#guide-search").value.trim().toLowerCase(),
        filter = $("#guide-filter").value;
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
      $("#guide-results").innerHTML = found.length
        ? found
            .map(
              (s) =>
                `<button class="species-entry ${unlocked.includes(s.id) ? "discovered" : ""}" data-inspect="${s.id}" aria-pressed="${s.id === this.guideSelection}"><span class="species-tier">${s.tier + 1} / ${esc(tierName(s.tier))} · ${unlocked.includes(s.id) ? "RECORDED" : "UNDISCOVERED"}</span><div class="creature-art" style="color:#${s.color.toString(16).padStart(6, "0")}">${unlocked.includes(s.id) ? portrait(s.id) : animal(s)}</div><h2>${esc(s.name)}</h2><span class="species-ability">${esc(s.ability)} · ${esc(TECHNIQUES[s.technique].name)}</span></button>`,
            )
            .join("")
        : '<p class="empty-collection">No recorded specimens match. Hatch and evolve to grow your collection, or select All potential forms.</p>';
      $("#guide-results")
        .querySelectorAll("[data-inspect]")
        .forEach(
          (b) => (b.onclick = () => showDetails(species(b.dataset.inspect))),
        );
    };
    $("#guide-search").oninput = renderCards;
    $("#guide-filter").onchange = renderCards;
    renderCards();
    showDetails(species(this.guideSelection));
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
            return `<button class="shop-card ${this.shopSelection === item.sku ? "selected" : ""}" data-product="${item.sku}" style="--rarity:${r.color}" aria-pressed="${this.shopSelection === item.sku}"><span class="rarity-label">${r.name}</span><div class="shop-item-art">${portrait(item.id, item.kind)}</div><h2>${esc(item.name)}</h2><p>${item.kind === "decoration" ? `${count} OWNED` : count ? "PERMANENTLY OWNED" : `${item.price} DNA`}</p><span>${item.kind === "decoration" ? `${item.price} DNA EACH` : count ? "SELECT TO EQUIP" : "FIND OR BUY"}</span></button>`;
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
            return `<article class="island-inventory-item" style="--rarity:${RARITIES[item.rarity].color}"><button data-island-item="${item.sku}" ${available <= 0 ? "disabled" : ""}><span class="rarity-label">${RARITIES[item.rarity].name}</span><strong>${esc(item.name)}</strong><small>${available} AVAILABLE${item.kind === "decoration" ? ` / ${ownedCount(p, item.sku)} OWNED` : available ? "" : " · ROAMING ON ISLAND"}</small></button>${item.kind === "pet" ? `<button class="pet-expedition" data-island-companion="${item.id}">${p.activePet === item.id ? "EXPEDITION COMPANION" : "TAKE ON EXPEDITIONS"}</button>` : ""}</article>`;
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
    this.bind("fullscreen", () => this.callbacks.fullscreen());
    this.bind("back", () => this.back());
  }

  showEvolution(game) {
    this.evolutionGame = game;
    this.chosenSpecies =
      typeof game.evolutionChoices?.[0] === "object"
        ? game.evolutionChoices[0].id
        : game.evolutionChoices?.[0];
    this.chosenMutation =
      typeof game.mutationChoices?.[0] === "object"
        ? game.mutationChoices[0].id
        : game.mutationChoices?.[0];
    const speciesChoices = game.evolutionChoices || [];
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
          return `<button class="evolution-card ${i === 0 ? "selected" : ""}" data-species="${esc(s.id)}" style="--lineage-color:${EVOLUTION_RARITIES[s.rarity || "regular"].color}" aria-pressed="${i === 0}"><span class="eyebrow">TIER ${s.tier + 1} / ${esc(tierName(s.tier))}</span><span class="evolution-rarity" style="--lineage-color:${EVOLUTION_RARITIES[s.rarity || "regular"].color}">${EVOLUTION_RARITIES[s.rarity || "regular"].name.toUpperCase()}${s.bloodline ? " - EARNED BLOODLINE" : ""}</span><div class="evolution-creature">${this.profile.unlocked.includes(s.id) || this.profile.hunted.includes(s.id) ? portrait(s.id) : animal(s)}</div><h2>${esc(s.name)}</h2><p>${esc(s.description)}</p><div class="species-stats"><span>HP <b>${s.hp}</b></span><span>ATK <b>${s.damage}</b></span><span>SPD <b>${s.speed}</b></span></div><span class="species-ability">${icon("bolt")}${esc(typeof s.ability === "object" ? s.ability.name : s.ability)}</span><span class="choice-indicator"></span></button>`;
        })
        .join("")}</div>
      <div class="mutation-heading"><span class="eyebrow">ADAPTATION</span><p>One mutation. Every future form.</p></div><div class="mutation-choices" role="group" aria-label="Choose a mutation">${mutations.map((m, i) => `<button class="mutation-card ${i === 0 ? "selected" : ""}" data-mutation="${esc(m.id)}" aria-pressed="${i === 0}">${icon("dna")}<span><strong>${esc(m.name)}</strong><small>${esc(m.description)}</small></span><span class="choice-indicator"></span></button>`).join("")}</div>
      <div class="panel-bottom"><span>Evolution restores vitality and resets growth for the new form. Postpone to keep hunting.</span><button class="button secondary" data-action="postpone">KEEP GROWING - ESC</button><button class="button primary" data-action="evolve" data-focus>EMBRACE EVOLUTION ${icon("arrow")}</button></div></div>`,
      "shade-screen evolution-screen",
    );
    this.bind("postpone", () => this.callbacks.postpone());
    this.overlay.querySelectorAll("[data-species]").forEach((button) =>
      button.addEventListener("click", () => {
        this.chosenSpecies = button.dataset.species;
        this.overlay.querySelectorAll("[data-species]").forEach((b) => {
          b.classList.toggle("selected", b === button);
          b.setAttribute("aria-pressed", b === button);
        });
      }),
    );
    this.overlay.querySelectorAll("[data-mutation]").forEach((button) =>
      button.addEventListener("click", () => {
        this.chosenMutation = button.dataset.mutation;
        this.overlay.querySelectorAll("[data-mutation]").forEach((b) => {
          b.classList.toggle("selected", b === button);
          b.setAttribute("aria-pressed", b === button);
        });
      }),
    );
    this.bind("evolve", () =>
      this.callbacks.evolve(this.chosenSpecies, this.chosenMutation),
    );
  }

  showDeath(results, profile) {
    this.profile = profile;
    this.lastResults = results;
    const s = species(results.speciesId);
    const best = results.score >= (profile.bestScore || 0) && results.score > 0;
    this.screen(
      "death",
      `<div class="wide-panel death-panel"><div class="death-left"><span class="death-symbol">${icon("skull")}</span><p class="eyebrow">THE FOOD CHAIN REMEMBERS</p><h1>End of a life.<br><em>Start of a legacy.</em></h1><p class="death-cause">${esc(results.cause || "The wild claimed another survivor.")}</p><div class="final-species">${portrait(s.id)}<div><span>FINAL FORM · TIER ${(results.tier ?? s.tier) + 1}</span><h2>${esc(s.name)}</h2></div></div></div><div class="death-right"><div class="final-score"><span>${best ? "A NEW PERSONAL BEST" : "YOUR FINAL SCORE"}</span><strong>${number(results.score)}</strong></div><div class="death-stats"><div><span>TIME SURVIVED</span><strong>${clock(results.time)}</strong></div><div><span>PREY HUNTED</span><strong>${number(results.kills)}</strong></div><div><span>EVOLUTION REACHED</span><strong>${esc(tierName(results.tier ?? s.tier))}</strong></div></div><div class="dna-earned">${icon("dna")}<span>RARE DNA BANKED THIS LIFE</span><strong>+${number(results.dna)}</strong></div><div class="stacked-buttons"><button class="button primary" data-action="restart" data-focus>ONE MORE LIFE ${icon("arrow")}</button><button class="button secondary" data-action="menu">RETURN TO TITLE</button></div></div></div>`,
      "shade-screen death-screen",
    );
    this.bind("restart", () => this.callbacks.restart());
    this.bind("menu", () => this.callbacks.menu());
  }

  updateProfile(profile) {
    this.profile = profile;
  }

  back() {
    if (this._view === "evolution") return false;
    if (this.returnView === "pause") this.showPause();
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
