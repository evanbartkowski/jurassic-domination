import "./style.css";
import "./world-ui.css";
import "./expansion.css";
import "./collections.css";
import { Game } from "./game.js";
import { SPECIES } from "./data.js";
import { WorldRenderer } from "./renderer.js";
import { UI } from "./ui.js";
import { AudioEngine } from "./audio.js";
import {
  loadData,
  saveData,
  purchaseUpgrade,
  recordRun,
  unlockDiscovery,
  equipSkin,
} from "./profile.js";
import { SpecimenViewer } from "./specimen.js";
import { POWERUPS, RUN_SKILLS, TECHNIQUES } from "./content.js";
import { biomeAt, BANDS, REGIONS, WORLD_RADIUS } from "./world-data.js";
import { CATALOG, ACHIEVEMENTS } from "./collection-data.js";
import {
  purchaseItem,
  awardRareDNA,
  grantFind,
  checkAchievements,
  equipCosmetic,
  equipPet,
  placeIslandItem,
  moveIslandItem,
  storeIslandItem,
  renameIsland,
  recordGuardianKill,
} from "./collections.js";
import { CollectionViewer } from "./collection-art.js";
import { IslandScene } from "./island.js";

let storage;
try {
  storage = localStorage;
} catch {
  storage = {
    getItem() {
      throw Error();
    },
    setItem() {
      throw Error();
    },
  };
}
let { profile, settings, failed: storageFailed } = loadData(storage);
let game = null,
  paused = false,
  recorded = false,
  difficulty = "survival",
  world,
  graphicsFailed = false,
  mapExpanded = false;
const audio = new AudioEngine(settings),
  keys = new Set(),
  pending = new Set();
const pointer = {
  x: innerWidth * 0.6,
  y: innerHeight * 0.5,
  down: false,
  moved: false,
};
let ui;
let specimen = null;
let productViewer = null,
  islandScene = null,
  pendingIslandTool = null;
const islandUndo = [],
  islandRedo = [];
function settleAchievements(progress = {}) {
  const rewards = checkAchievements(profile, progress);
  if (!rewards.length) return;
  const earned = rewards.reduce((sum, r) => sum + r.reward, 0);
  if (game) game.earnedDNA += earned;
  persist();
  ui?.updateProfile(profile);
  for (const reward of rewards)
    ui?.toast(
      `${reward.name}${reward.reward ? ` · +${reward.reward} rare DNA` : ""}`,
    );
}
function islandState(
  state = islandScene
    ? { selected: islandScene.selected, tool: islandScene.tool }
    : null,
) {
  ui?.refreshIslandInventory(profile, state);
}
function openIsland(tool = null) {
  game = null;
  paused = false;
  keys.clear();
  pending.clear();
  pointer.down = false;
  pendingIslandTool = tool;
  if (tool) ui.islandTab = tool.kind;
  ui.showIsland(profile);
  audio.setMode("menu");
}
function islandAction(action, payload = {}) {
  if (
    !islandScene &&
    ["tool", "move", "rotate", "store", "cancel"].includes(action)
  )
    return { ok: false, reason: "The island is still loading." };
  if (action === "tool") {
    islandScene.setTool(payload.kind, payload.id);
    return { ok: true };
  }
  if (action === "cancel") {
    islandScene.cancelTool();
    return { ok: true };
  }
  if (action === "move" && !payload.id) {
    islandScene.moveSelected();
    return { ok: true };
  }
  if (action === "rotate") {
    islandScene.rotate();
    return { ok: true };
  }
  if (action === "store" && !payload.id) {
    islandScene.storeSelected();
    return { ok: true };
  }
  const before = JSON.stringify(profile.island);
  let result;
  if (action === "undo" || action === "redo") {
    const from = action === "undo" ? islandUndo : islandRedo,
      to = action === "undo" ? islandRedo : islandUndo;
    if (!from.length) {
      ui.islandHint("There are no changes to undo or redo.");
      return { ok: false };
    }
    to.push(before);
    profile.island = JSON.parse(from.pop());
    result = { ok: true };
    islandScene?.cancelTool();
  } else {
    if (action === "place")
      result = placeIslandItem(
        profile,
        payload.kind,
        payload.itemId,
        payload.x,
        payload.y,
        payload.rotation,
      );
    else if (action === "move")
      result = moveIslandItem(
        profile,
        payload.id,
        payload.x,
        payload.y,
        payload.rotation,
      );
    else if (action === "store")
      result = { ok: storeIslandItem(profile, payload.id) };
    else if (action === "rename")
      result = { ok: renameIsland(profile, payload.name) };
    else if (action === "grid") {
      profile.island.grid = !profile.island.grid;
      result = { ok: true };
    } else return { ok: false, reason: "Unknown island action." };
    if (result.ok && before !== JSON.stringify(profile.island)) {
      islandUndo.push(before);
      if (islandUndo.length > 30) islandUndo.shift();
      islandRedo.length = 0;
    }
  }
  if (result.ok) {
    settleAchievements();
    persist();
    islandScene?.sync(profile);
    islandState();
    ui.islandHint("Island saved. Your collection is permanent.");
  } else ui.islandHint(result.reason || "This island change is not available.");
  return result;
}
function persist() {
  if (!saveData(storage, profile, settings) && !storageFailed) {
    storageFailed = true;
    ui?.toast(
      "Local storage is unavailable. Progress will last for this session.",
    );
  }
}
function unlock() {
  audio
    .unlock()
    .catch(() => ui?.toast("Audio could not start. Check your audio device."));
}
function start(mode = "survival") {
  if (graphicsFailed) return;
  unlock();
  world?.resetRun();
  difficulty = mode;
  game = new Game({
    seed: Date.now() >>> 0,
    difficulty: mode,
    upgrades: profile.upgrades,
    modifiers: profile.modifiers,
    skinId: profile.equippedSkin,
    knownUnlocks: [...profile.skins, ...profile.modifiers],
  });
  game.cosmeticId = profile.equippedCosmetic;
  game.petId = profile.activePet;
  paused = false;
  recorded = false;
  keys.clear();
  pending.clear();
  pointer.down = false;
  ui.showHUD();
  audio.setMode("playing");
  ui.toast("An egg. A new beginning. Press E to hatch.");
}
function pause() {
  if (game && ["egg", "playing"].includes(game.state) && ui.view === "hud") {
    paused = true;
    keys.clear();
    pending.clear();
    pointer.down = false;
    ui.showPause();
    audio.setMode("paused");
  }
}
function resume() {
  if (!game) return;
  paused = false;
  keys.clear();
  pending.clear();
  ui.showHUD();
  audio.setMode("playing");
}
function menu() {
  paused = false;
  game = null;
  keys.clear();
  pointer.down = false;
  ui.showMenu(profile);
  audio.setMode("menu");
}
async function fullscreen() {
  try {
    if (window.desktop) settings.fullscreen = await window.desktop.fullscreen();
    else if (document.fullscreenElement) {
      await document.exitFullscreen();
      settings.fullscreen = false;
    } else {
      await document.documentElement.requestFullscreen();
      settings.fullscreen = true;
    }
  } catch {
    ui.toast("Fullscreen is unavailable on this display.");
  }
}
ui = new UI(
  {
    start,
    resume,
    pause,
    restart: () => start(difficulty),
    menu,
    hatch: () => {
      unlock();
      game?.hatch();
    },
    evolve: (speciesId, mutationId) => {
      game?.evolve(speciesId, mutationId);
      if (game?.state === "playing") {
        ui.showHUD();
        audio.setMode("playing");
        if (!profile.unlocked.includes(speciesId)) {
          profile.unlocked.push(speciesId);
          persist();
          ui.updateProfile(profile);
        }
        profile.highestTier = Math.max(profile.highestTier, game.tier);
        settleAchievements({
          tier: game.tier,
          time: game.time,
          kills: game.player.kills,
        });
        persist();
      }
    },
    settings: (next) => {
      settings = { ...settings, ...next };
      audio.configure(settings);
      world?.configure(settings);
      persist();
    },
    upgrade: (id) => {
      if (purchaseUpgrade(profile, id)) {
        persist();
        ui.updateProfile(profile);
        ui.showLegacy();
        audio.play("evolve");
      } else ui.toast("Seek rare DNA finds or one-time achievement rewards.");
    },
    skin: (id) => {
      if (equipSkin(profile, id)) {
        persist();
        ui.updateProfile(profile);
        world?.setMenuSkin(id, profile.equippedCosmetic);
        if (game) game.skinId = id;
      }
    },
    purchase: (sku) => {
      const result = purchaseItem(profile, sku);
      if (result.ok) {
        settleAchievements();
        persist();
        ui.updateProfile(profile);
        ui.refreshShop();
        ui.toast(`${result.item.name} purchased. Permanently owned.`);
        audio.play("evolve");
      } else ui.toast(result.reason);
    },
    cosmetic: (id) => {
      if (equipCosmetic(profile, id)) {
        persist();
        ui.updateProfile(profile);
        world?.setMenuSkin(profile.equippedSkin, id);
        if (game) game.cosmeticId = id;
      }
    },
    pet: (id) => {
      if (equipPet(profile, id)) {
        persist();
        ui.updateProfile(profile);
        if (game) game.petId = id;
      }
    },
    island: openIsland,
    islandAction,
    quit: () => {
      if (window.desktop) window.desktop.quit();
      else ui.toast("Close this tab to exit. Your legacy is saved.");
    },
    fullscreen,
  },
  profile,
  settings,
);

let canvas = document.getElementById("world");
if (!canvas) {
  canvas = document.createElement("canvas");
  canvas.id = "world";
  document.body.prepend(canvas);
}
function failGraphics(message) {
  graphicsFailed = true;
  pause();
  let el = document.getElementById("graphics-error");
  if (!el) {
    el = document.createElement("section");
    el.id = "graphics-error";
    el.style.cssText =
      "position:fixed;inset:0;z-index:999;background:#091611;display:grid;place-content:center;padding:40px;color:#f0e9d5;font:18px system-ui;max-width:none";
    el.innerHTML =
      '<h1>Graphics device unavailable</h1><p id="graphics-message"></p><p>Try updating your graphics driver, enabling hardware acceleration, or restarting the desktop game.</p><button id="graphics-retry">Restart game</button>';
    document.body.append(el);
    el.querySelector("button").onclick = () => location.reload();
  }
  el.querySelector("#graphics-message").textContent = message;
}
try {
  world = new WorldRenderer(canvas, settings, failGraphics);
  world.setMenuSkin(profile.equippedSkin, profile.equippedCosmetic);
} catch (error) {
  console.error(error);
  failGraphics(
    "Jurassic Domination requires a graphics device with WebGL 2 support.",
  );
}
ui.showMenu(profile);
if (storageFailed)
  ui.toast(
    "Some local data could not be read. Valid legacy progress was preserved.",
  );
document.addEventListener("pointerdown", () => unlock(), { once: true });
window.addEventListener("resize", () => {
  world?.resize();
  specimen?.resize();
  productViewer?.resize();
  islandScene?.resize();
});
window.addEventListener("contextmenu", (event) => {
  if (ui.view === "hud") event.preventDefault();
});
window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.moved = true;
});
window.addEventListener("pointerdown", (event) => {
  if (
    ui.view === "hud" &&
    event.button === 0 &&
    !event.target.closest("button,input,select,.minimap-wrap")
  ) {
    pointer.down = true;
    pending.add("Mouse0");
  }
});
window.addEventListener("pointerup", () => (pointer.down = false));
window.addEventListener("blur", () => {
  keys.clear();
  pointer.down = false;
  pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    keys.clear();
    pointer.down = false;
    pause();
  }
});
window.addEventListener("keydown", (event) => {
  const key = event.code;
  if (
    ([
      "Space",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Tab",
    ].includes(key) ||
      event.ctrlKey) &&
    ui.view === "hud"
  )
    event.preventDefault();
  if (key === "Escape") {
    if (ui.view === "island" && islandScene?.cancelTool()) return;
    if (ui.view === "hud") pause();
    else if (ui.view === "pause") resume();
    else if (!["evolution", "death", "menu"].includes(ui.view)) ui.back();
    return;
  }
  if (key === "F11" && !window.desktop) {
    event.preventDefault();
    fullscreen();
    return;
  }
  if (event.target.matches("input,select,textarea")) return;
  if (ui.view === "island") {
    islandScene?.handleKey(event);
    return;
  }
  if (key === "KeyM" && ui.view === "hud" && !event.repeat) {
    mapExpanded = !mapExpanded;
    const map = document.getElementById("minimap");
    if (map) map.classList.toggle("expanded", mapExpanded);
    return;
  }
  if (key === "Tab" && ui.view === "hud" && !event.repeat) {
    pause();
    ui.showGuide();
    return;
  }
  if (key === "Enter" && ui.view === "death" && !event.repeat) {
    start(difficulty);
    return;
  }
  if (ui.view === "hud") {
    keys.add(key);
    pending.add(key);
  }
});
window.addEventListener("keyup", (event) => keys.delete(event.code));

const damageLayer = document.createElement("div");
damageLayer.id = "damage-layer";
damageLayer.style.cssText =
  "position:fixed;inset:0;pointer-events:none;z-index:3;overflow:hidden";
document.body.append(damageLayer);
const floating = [];
const labelLayer = document.createElement("div");
labelLayer.style.cssText =
  "position:fixed;inset:0;pointer-events:none;z-index:2;overflow:hidden";
document.body.append(labelLayer);
const labels = new Map();
const lowHealth = document.createElement("div");
lowHealth.id = "low-health-screen";
document.body.append(lowHealth);
const alphaBar = document.createElement("div");
alphaBar.id = "alpha-boss";
alphaBar.hidden = true;
alphaBar.innerHTML =
  "<span>ALPHA HUNT</span><strong></strong><b><i></i></b><small></small>";
document.body.append(alphaBar);
const expedition = document.createElement("div");
const mapTooltip = document.createElement("div");
mapTooltip.id = "map-tooltip";
mapTooltip.hidden = true;
document.body.append(mapTooltip);
expedition.className = "expedition-hud";
expedition.innerHTML =
  '<div id="region-route"></div><div id="active-buffs"></div><div id="discovered-skills"></div><div id="pickup-prompt"></div>';
document.getElementById("hud").append(expedition);
const techniqueKey = document.createElement("div");
techniqueKey.className = "ability-key technique-key";
techniqueKey.innerHTML =
  '<kbd>R</kbd><span id="hud-technique"></span><b id="hud-technique-cooldown">READY</b>';
document.querySelector(".abilities").append(techniqueKey);
document.getElementById("minimap").addEventListener("click", (event) => {
  if (!game) return;
  const map = event.currentTarget,
    v = map.mapView;
  if (!v) return;
  const rect = map.getBoundingClientRect(),
    x = ((event.clientX - rect.left) / rect.width) * v.w,
    y = ((event.clientY - rect.top) / rect.height) * v.w;
  const point = {
    x: v.cx + ((x - v.w / 2) / v.r) * v.range,
    y: v.cy + ((y - v.w / 2) / v.r) * v.range,
  };
  if (Math.hypot(point.x, point.y) <= WORLD_RADIUS) {
    game.waypoint = point;
    ui.toast("Destination marked. Follow the map and expedition heading.");
  }
});
document.getElementById("minimap").addEventListener("pointermove", (event) => {
  if (!game || !mapExpanded || ui.view !== "hud") {
    mapTooltip.hidden = true;
    return;
  }
  const map = event.currentTarget,
    v = map.mapView;
  if (!v) return;
  const rect = map.getBoundingClientRect(),
    wx =
      v.cx +
      ((((event.clientX - rect.left) / rect.width) * v.w - v.w / 2) / v.r) *
        v.range,
    wy =
      v.cy +
      ((((event.clientY - rect.top) / rect.height) * v.w - v.w / 2) / v.r) *
        v.range;
  const lair = game.lairs.find((l) => Math.hypot(l.x - wx, l.y - wy) < 70),
    region = biomeAt(wx, wy);
  mapTooltip.textContent = lair
    ? `${lair.name} · guardian level ${lair.tier + 1} · ${lair.entityId ? "ALIVE" : `respawns in ${Math.ceil(Math.max(0, lair.respawnAt - game.time))}s`}`
    : `${region.name} · region level ${region.tier + 1} · click to mark destination`;
  mapTooltip.hidden = false;
});
document
  .getElementById("minimap")
  .addEventListener("pointerleave", () => (mapTooltip.hidden = true));
function updateWorldUI() {
  const visible = game && ui.view === "hud" && game.state === "playing";
  labelLayer.style.display = visible ? "" : "none";
  lowHealth.style.opacity = visible
    ? Math.max(0, (0.4 - game.player.hp / game.player.maxHp) * 2.2)
    : 0;
  alphaBar.hidden = !visible || !game.boss;
  if (!visible || !mapExpanded) mapTooltip.hidden = true;
  if (visible && game.boss) {
    const boss = game.entities.find((e) => e.id === game.boss.id),
      p = game.player;
    alphaBar.querySelector("strong").textContent = game.boss.name;
    alphaBar.querySelector("i").style.width =
      `${Math.max(0, game.boss.hp / game.boss.maxHp) * 100}%`;
    if (boss) {
      const dx = boss.x - p.x,
        dy = boss.y - p.y;
      alphaBar.querySelector("small").textContent =
        `${Math.round(Math.hypot(dx, dy))}m · ${dy < -5 ? "NORTH" : dy > 5 ? "SOUTH" : ""}${dx < -5 ? " WEST" : dx > 5 ? " EAST" : ""} · IT IS HUNTING YOU`;
    }
  }
  if (!visible || !world) return;
  const region = biomeAt(game.player.x, game.player.y),
    p0 = game.player;
  const route = document.getElementById("region-route");
  const target = game.waypoint;
  const nextRadius = BANDS[Math.max(0, Math.min(6, game.tier - 1))] + 30;
  const meters = target
    ? Math.hypot(target.x - p0.x, target.y - p0.y)
    : Math.max(0, nextRadius - Math.hypot(p0.x, p0.y));
  route.textContent = target
    ? `MARKED DESTINATION · ${Math.round(meters)}m`
    : region.tier < game.tier
      ? `SEEK LEVEL ${game.tier + 1} FOOD · ${Math.round(meters)}m OUTWARD`
      : `REGION LEVEL ${region.tier + 1} · ${region.description}`;
  route.hidden = mapExpanded;
  document.getElementById("hud-technique").textContent =
    TECHNIQUES[game.species.technique].name.toUpperCase();
  document.getElementById("hud-technique-cooldown").textContent =
    p0.techniqueCooldown > 0 ? `${p0.techniqueCooldown.toFixed(1)}s` : "READY";
  const buffs = Object.entries(game.buffs)
    .filter(([, v]) => v > 0)
    .map(
      ([id, left]) =>
        `${POWERUPS.find((b) => b.id === id)?.name || id} · ${Math.ceil(left)}s`,
    );
  if (p0.poisoned > 0) buffs.push(`VENOM · ${Math.ceil(p0.poisoned)}s`);
  if (p0.chilled > 0) buffs.push(`SLOWED · ${Math.ceil(p0.chilled)}s`);
  document.getElementById("active-buffs").textContent = buffs.join("   /   ");
  const skillSignature = game.runSkills
    .map((s) => `${s.id}:${Math.ceil(s.cooldown)}`)
    .join("|");
  const skills = document.getElementById("discovered-skills");
  if (skills.dataset.signature !== skillSignature) {
    skills.dataset.signature = skillSignature;
    skills.replaceChildren(
      ...game.runSkills.map((slot, i) => {
        const el = document.createElement("span"),
          key = document.createElement("kbd");
        key.textContent = ["F", "G", "C", "V", "B", "N"][i];
        el.append(
          key,
          document.createTextNode(
            ` ${RUN_SKILLS.find((s) => s.id === slot.id).name} ${slot.cooldown > 0 ? `${Math.ceil(slot.cooldown)}s` : "READY"}`,
          ),
        );
        return el;
      }),
    );
  }
  const nearby = game.foods
    .filter(
      (f) =>
        ["egg", "rareplant", "relic", "fossil"].includes(f.type) &&
        Math.hypot(f.x - p0.x, f.y - p0.y) < 7,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - p0.x, a.y - p0.y) - Math.hypot(b.x - p0.x, b.y - p0.y),
    )[0];
  const prompt = document.getElementById("pickup-prompt");
  prompt.hidden = !nearby;
  if (nearby)
    prompt.textContent =
      nearby.type === "egg"
        ? `E · EAT EGG / HATCHES IN ${Math.ceil(Math.max(0, nearby.hatchAfter - nearby.age))}s`
        : nearby.type === "rareplant"
          ? `E · ${POWERUPS.find((b) => b.id === nearby.powerup)?.name || "Rare plant"} · timed power-up`
          : nearby.type === "relic"
            ? `E · ANCIENT SKILL RELIC · lasts until death`
            : "E · EXCEPTIONALLY RARE FOSSIL · permanent discovery";
  const p = game.player,
    near = game.entities
      .filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 27)
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      )
      .slice(0, 18),
    seen = new Set();
  for (const e of near) {
    seen.add(e.id);
    let element = labels.get(e.id);
    const species = SPECIES.find((s) => s.id === e.speciesId);
    if (!species) continue;
    if (!element) {
      element = document.createElement("div");
      element.className = "creature-label";
      element.innerHTML = "<span></span><b><i></i></b>";
      labels.set(e.id, element);
      labelLayer.append(element);
    }
    element.className = `creature-label${species.tier > game.tier ? " predator" : ""}${e.boss ? " alpha" : ""}`;
    element.querySelector("span").textContent =
      `${e.boss ? "ALPHA · " : e.juvenile ? "JUVENILE · " : ""}${species.name}${e.intent === "graze" ? " · NEUTRAL" : e.packId ? " · PACK" : ""}`;
    element.querySelector("i").style.transform =
      `scaleX(${Math.max(0, e.hp / e.maxHp)})`;
    const pos = world.project(e.x, e.y, species.size * 2 + 1);
    element.style.transform = `translate(${pos.x}px,${pos.y}px)`;
    element.style.opacity = pos.visible ? 1 : 0;
  }
  for (const [id, element] of labels)
    if (!seen.has(id)) {
      element.remove();
      labels.delete(id);
    }
}
function float(event) {
  if (
    !settings.showDamage ||
    !world ||
    !Number.isFinite(event.x) ||
    !Number.isFinite(event.y)
  )
    return;
  if (!["hit", "eat"].includes(event.type)) return;
  const amount = event.amount;
  if (!amount) return;
  const element = document.createElement("span");
  element.textContent =
    event.type === "eat" ? `+${Math.round(amount)}` : `${Math.round(amount)}`;
  element.style.cssText = `position:absolute;font:700 18px system-ui;color:${event.type === "eat" ? "#c0e9a8" : "#ffbc94"};text-shadow:0 2px 5px #000;will-change:transform,opacity`;
  damageLayer.append(element);
  floating.push({ element, x: event.x, y: event.y, life: 1 });
}
function events() {
  for (const event of game.consumeEvents()) {
    world?.event(event);
    const sound =
      {
        powerup: "eat",
        "run-skill": "evolve",
        unlock: "evolve",
        "enemy-ability": "ability",
        "run-cast": "ability",
        "egg-hatch": "hatch",
      }[event.type] || event.type;
    if (
      !Number.isFinite(event.x) ||
      Math.hypot(event.x - game.player.x, event.y - game.player.y) < 70
    )
      audio.play(sound);
    float(event);
    if (
      [
        "warning",
        "boss",
        "evolution-ready",
        "hatch",
        "powerup",
        "run-skill",
        "run-cast",
        "unlock",
        "region",
        "dna-find",
      ].includes(event.type) &&
      event.text
    )
      ui.toast(event.text);
    if (
      event.type === "dna-find" &&
      awardRareDNA(profile, event.receipt, event.amount)
    ) {
      game.earnedDNA += event.amount;
      persist();
      ui.updateProfile(profile);
    }
    if (event.type === "collection-find") {
      const result = grantFind(profile, event.sku, event.receipt);
      if (result.ok) {
        game.earnedDNA += result.dna || 0;
        persist();
        ui.updateProfile(profile);
        ui.toast(
          result.duplicate
            ? `Duplicate ${result.item.name} · +1 rare DNA`
            : `PERMANENT FIND · ${result.item.name}`,
        );
        audio.play("evolve");
      }
    }
    if (event.type === "kill" && event.lairId) {
      if (
        recordGuardianKill(profile, `guardian:${game.seed}:${event.entityId}`)
      )
        persist();
    }
    if (
      event.type === "unlock" &&
      unlockDiscovery(profile, event.unlockType, event.unlockId)
    ) {
      persist();
      ui.updateProfile(profile);
    }
    if (event.type === "region" && !profile.regions.includes(event.regionId)) {
      profile.regions.push(event.regionId);
      persist();
    }
    if (
      event.type === "hatch" &&
      !profile.unlocked.includes(game.player.speciesId)
    ) {
      profile.unlocked.push(game.player.speciesId);
      persist();
      ui.updateProfile(profile);
    }
  }
}
let last = performance.now(),
  accumulator = 0,
  miniTimer = 0,
  uiTimer = 0,
  frames = 0,
  fpsTime = 0,
  fps = 60;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
  last = now;
  frames++;
  fpsTime += dt;
  if (fpsTime >= 1) {
    fps = Math.round(frames / fpsTime);
    frames = 0;
    fpsTime = 0;
  }
  try {
    const active =
      game &&
      !paused &&
      ui.view === "hud" &&
      ["egg", "playing"].includes(game.state);
    if (active) {
      let x =
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
        (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
      let y =
        (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
        (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
      const aim =
        pointer.moved && world
          ? world.aim(pointer.x, pointer.y, game.player)
          : x || y
            ? Math.atan2(y, x)
            : game.player.angle;
      accumulator += dt;
      const held = (code) => keys.has(code) || pending.has(code);
      while (accumulator >= 1 / 60) {
        game.update(1 / 60, {
          x,
          y,
          aim,
          attack: pointer.down || held("Space") || held("Mouse0"),
          ability: held("KeyQ"),
          technique: held("KeyR"),
          skill: ["KeyF", "KeyG", "KeyC", "KeyV", "KeyB", "KeyN"].findIndex(
            held,
          ),
          sprint: held("ControlLeft") || held("ControlRight"),
          dash: held("ShiftLeft") || held("ShiftRight"),
          eat: held("KeyE"),
        });
        pending.clear();
        accumulator -= 1 / 60;
        if (game.state === "dead" || game.state === "evolution") break;
      }
    } else accumulator = 0;
    if (game) {
      events();
      if (game.state === "evolution" && ui.view !== "evolution") {
        keys.clear();
        pointer.down = false;
        ui.showEvolution(game);
        audio.setMode("paused");
      }
      if (game.state === "dead" && !recorded) {
        recorded = true;
        const result = game.getResults();
        const before = profile.dna;
        recordRun(profile, result);
        game.earnedDNA += profile.dna - before;
        result.dna = game.earnedDNA;
        persist();
        ui.updateProfile(profile);
        ui.showDeath(result, profile);
        audio.setMode("dead");
      }
    }
    if (game) {
      uiTimer += dt;
      miniTimer += dt;
      if (uiTimer > 0.08) {
        settleAchievements({
          tier: game.tier,
          time: game.time,
          kills: game.state === "dead" ? 0 : game.player.kills,
        });
        ui.updateHUD(game, dt);
        uiTimer = 0;
      }
      if (miniTimer > 0.15) {
        world?.minimap(document.getElementById("minimap"), game, mapExpanded);
        miniTimer = 0;
      }
    }
    const menuView = !game;
    if (!graphicsFailed && ui.view !== "island")
      world?.render(game, paused ? 0 : dt, menuView);
    const shopCanvas =
      ui.view === "shop" ? document.getElementById("shop-preview") : null;
    if (productViewer && productViewer.canvas !== shopCanvas) {
      productViewer.dispose();
      productViewer = null;
    }
    if (shopCanvas && !graphicsFailed) {
      const item = CATALOG[ui.shopSelection];
      if (item) {
        const key = `${item.sku}:${profile.equippedSkin}:${profile.equippedCosmetic}`;
        if (!productViewer)
          productViewer = new CollectionViewer(shopCanvas, item, profile);
        if (productViewer.appearanceKey !== key) {
          productViewer.setProduct(item, profile);
          productViewer.appearanceKey = key;
        }
        productViewer.render(dt);
      }
    }
    const islandCanvas =
      ui.view === "island" ? document.getElementById("island-canvas") : null;
    if (islandScene && islandScene.canvas !== islandCanvas) {
      islandScene.dispose();
      islandScene = null;
    }
    if (islandCanvas && !graphicsFailed) {
      if (!islandScene) {
        islandScene = new IslandScene(
          islandCanvas,
          profile,
          {
            change: islandAction,
            state: (state) => ui.refreshIslandInventory(profile, state),
            hint: (text) => ui.islandHint(text),
          },
          settings,
        );
        if (pendingIslandTool) {
          islandScene.setTool(pendingIslandTool.kind, pendingIslandTool.id);
          pendingIslandTool = null;
        }
      }
      islandScene.render(dt);
    }
    const specimenCanvas =
      ui.view === "guide" ? document.getElementById("specimen-canvas") : null;
    if (specimen && specimen.canvas !== specimenCanvas) {
      specimen.dispose();
      specimen = null;
    }
    if (specimenCanvas && !graphicsFailed) {
      const selected =
        SPECIES.find((s) => s.id === ui.guideSelection) || SPECIES[0];
      if (!specimen)
        specimen = new SpecimenViewer(
          specimenCanvas,
          selected,
          profile.equippedSkin,
        );
      else if (specimen.speciesId !== selected.id)
        specimen.setSpecies(selected, profile.equippedSkin);
      specimen.render(dt);
    }
    updateWorldUI();
    audio.update(dt, game);
    for (let i = floating.length - 1; i >= 0; i--) {
      const f = floating[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.element.remove();
        floating.splice(i, 1);
        continue;
      }
      const pos = world.project(f.x, f.y, 2 + (1 - f.life) * 2);
      f.element.style.transform = `translate(${pos.x}px,${pos.y}px)`;
      f.element.style.opacity = f.life;
    }
    document.body.classList.toggle(
      "is-playing",
      ui.view === "hud" && game?.state === "playing",
    );
  } catch (error) {
    console.error("Game frame error", error);
    pause();
    ui.toast(
      "The run encountered an error. Return to the menu to begin a new life.",
    );
  }
}
requestAnimationFrame(frame);
// Read-only diagnostics are available only on the local development server.
if (import.meta.env.DEV) {
  window.__JD = {
    get game() {
      return game;
    },
    get ui() {
      return ui;
    },
    get profile() {
      return profile;
    },
    get world() {
      return world;
    },
    get specimen() {
      return specimen;
    },
    get island() {
      return islandScene;
    },
    get productViewer() {
      return productViewer;
    },
    get settings() {
      return settings;
    },
    get fps() {
      return fps;
    },
    start,
    pause,
    resume,
  };
}
