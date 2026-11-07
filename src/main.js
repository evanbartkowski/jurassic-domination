import "./style.css";
import "./world-ui.css";
import "./expansion.css";
import "./collections.css";
import "./wild-update.css";
import "./ancestry.css";
import "./living-wild.css";
import "./foundation.css";
import './immersion.css';
import './indie-polishing.css';
import { actionHeld, gamepadIntent, keyLabel, DEFAULT_BINDINGS } from "./controls.js";
import { ancestryOptions } from './ancestry.js';
import { worldStatus } from './world-events.js';
import { discoveryStatus, isExplored } from './discoveries.js';
import { survivalStatus } from './survival.js';
import { SaveStore } from "./state-store.js";
import { snapshotGame, restoreGame } from "./run-state.js";
import { LocalAuthority } from "./simulation.js";
import { SPECIALS, growthName, BLOODLINES } from "./progression.js";
import { ISLAND_TRIALS, sanctuaryProgress, careForPet } from "./sanctuary.js";
import { Game } from "./game.js";
import { SPECIES, SPECIES_BY_ID } from "./data.js";
import { canEatFood, foodLabel } from "./forage.js";
import { WorldRenderer } from "./renderer.js";
import { UI } from "./ui.js";
import { AudioEngine } from "./audio.js";
import {
  purchaseUpgrade,
  recordRun,
  unlockDiscovery,
  equipSkin,
  normalizeSettings,
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
const saves = new SaveStore(storage);
let { profile, settings, run: savedRun, failed: storageFailed, recovered: recoveredSave, error: loadError } = saves.load();
let suspendedGame = null, resumeFailure = "";
try { if (savedRun) suspendedGame = restoreGame(savedRun); }
catch (error) { resumeFailure = error.message; savedRun = null; }
let game = null,
  authority = null,
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
let pendingIslandBuild = false;
let handlingEvents = false, pendingSave = false, autosaveElapsed = 0, lastSaveFailed = false;
const pendingTerminalIds = new Set();
let settingsSaveTimer = null;
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
    ? {
        selected: islandScene.selected,
        tool: islandScene.tool,
        buildMode: islandScene.buildMode,
      }
    : null,
) {
  ui?.refreshIslandInventory(profile, state);
}
function openIsland(tool = null) {
  if (game && game.state !== "dead" && !checkpointAndSuspend()) return;
  clearWorldFeedback();
  game = null;
  authority = null;
  paused = false;
  keys.clear();
  pending.clear();
  pointer.down = false;
  pendingIslandTool = tool;
  pendingIslandBuild = false;
  if (tool) ui.islandTab = tool.kind;
  ui.showIsland(profile);
  audio.setMode("menu");
}
function islandAction(action, payload = {}) {
  if (
    action === "build" &&
    (!islandScene ||
      islandScene.canvas !== document.getElementById("island-canvas"))
  ) {
    pendingIslandBuild = true;
    return { ok: true };
  }
  if (
    !islandScene &&
    ["tool", "move", "rotate", "store", "cancel"].includes(action)
  )
    return { ok: false, reason: "The island is still loading." };
  if (action === "build") {
    islandScene.setBuildMode(!islandScene.buildMode);
    if (islandScene.buildMode && pendingIslandTool) {
      islandScene.setTool(pendingIslandTool.kind, pendingIslandTool.id);
      pendingIslandTool = null;
    }
    return { ok: true };
  }
  if (action === "care") {
    const result = careForPet(profile, payload.id || islandScene.selected);
    if (result.ok) {
      persist();
      islandScene.showAffection();
    }
    ui.islandHint(
      result.ok ? "A happy companion. Your bond grows." : result.reason,
    );
    islandState();
    return result;
  }
  if (action === "claim-trial") {
    const trial = ISLAND_TRIALS.find((t) => t.id === payload.id);
    if (!trial || profile.island.trials.includes(trial.id))
      return { ok: false };
    const p = sanctuaryProgress(profile, trial);
    if (
      p.seconds < trial.seconds ||
      p.pets < trial.pets ||
      p.decorations < trial.decorations ||
      p.care < trial.care ||
      !p.rare
    ) {
      ui.islandHint(
        "This sanctuary challenge still needs care and development.",
      );
      return { ok: false };
    }
    profile.island.trials.push(trial.id);
    for (const sku of trial.rewards)
      grantFind(profile, sku, `sanctuary:${trial.id}:${sku}`);
    const saved = persist();
    islandState();
    ui.toast(saved ? `${trial.name}: permanent sanctuary treasures unlocked!` : "Treasure unlocked for this session. Save failed; export a backup from Settings.");
    return { ok: true };
  }
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
    const persistentCare = {
      visitSeconds: profile.island.visitSeconds,
      care: profile.island.care,
      lastCare: profile.island.lastCare,
      trials: profile.island.trials,
    };
    profile.island = { ...JSON.parse(from.pop()), ...persistentCare };
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
    const saved = persist();
    islandScene?.sync(profile);
    islandState();
    ui.islandHint(saved ? "Island saved. Your collection is permanent." : "Island updated for this session. Checkpoint failed; export a backup from Settings.");
  } else ui.islandHint(result.reason || "This island change is not available.");
  return result;
}
function runSummary() {
  const current = game?.state !== "dead" ? game || suspendedGame : null;
  return current && ["egg", "playing", "evolution"].includes(current.state) ? {
    name: current.state === "egg" ? "Unhatched life" : current.species.name,
    tier: current.tier, time: current.time, difficulty: current.difficulty,
  } : null;
}
function persist(options = {}) {
  if (options.terminalRunId) {
    pendingTerminalIds.add(options.terminalRunId);
    if (!profile.completedRuns.includes(options.terminalRunId)) profile.completedRuns.push(options.terminalRunId);
    profile.completedRuns = profile.completedRuns.slice(-8192);
  }
  if (handlingEvents && !options.terminalRunId) { pendingSave = true; return true; }
  // Failed writes get the same retry interval as successful checkpoints.
  autosaveElapsed = 0;
  try {
    const candidate = game || suspendedGame;
    const run = candidate ? candidate.state === "dead" ? null : snapshotGame(candidate) : savedRun;
    for (const terminalRunId of pendingTerminalIds.size ? [...pendingTerminalIds] : [null]) {
      const result = saves.commit({ profile, settings, run, terminalRunId });
      lastSaveFailed = !result.ok;
      if (!result.ok) {
        if (!storageFailed) ui?.toast("Checkpoint failed. Keep this window open and export a backup from Settings.");
        storageFailed = true;
        ui?.setSaveStatus("SAVE FAILED · KEEP WINDOW OPEN", true);
        return false;
      }
      if (terminalRunId) pendingTerminalIds.delete(terminalRunId);
    }
    savedRun = run;
    pendingSave = false;
    storageFailed = false;
    autosaveElapsed = 0;
    ui?.setSaveStatus("CHECKPOINT SAVED");
    ui?.setSavedRun(runSummary());
    return true;
  } catch (error) {
    lastSaveFailed = true;
    ui?.setSaveStatus("SAVE FAILED · EXPORT A BACKUP", true);
    if (!storageFailed) ui?.toast(`Checkpoint failed: ${error.message}`);
    storageFailed = true;
    return false;
  }
}
function checkpointAndSuspend() {
  if (game?.state === "dead") return true;
  if (!persist()) return false;
  if (game) suspendedGame = game;
  return true;
}
function continueLife() {
  if (graphicsFailed || !savedRun) return;
  try {
    game = suspendedGame || restoreGame(savedRun);
    authority = new LocalAuthority(game);
    suspendedGame = null;
    difficulty = game.difficulty;
    world?.resetRun();
    paused = true; recorded = false; autosaveElapsed = 0;
    keys.clear(); pending.clear(); pointer.down = false;
    ui.currentGame = game;
    ui.updateHUD(game);
    ui.showPause();
    ui.setSaveStatus("LIFE RESTORED · RESUME WHEN READY");
    audio.setMode("paused"); unlock();
  } catch (error) {
    ui.toast(`This expedition could not be restored: ${error.message}`);
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
  const previousId = (game?.state !== "dead" ? game || suspendedGame : null)?.runId;
  difficulty = mode;
  game = new Game({
    seed: Date.now() >>> 0,
    difficulty: mode,
    upgrades: profile.upgrades,
    modifiers: profile.modifiers,
    skinId: profile.equippedSkin,
    knownUnlocks: [...profile.skins, ...profile.modifiers],
    ...ancestryOptions(profile),
  });
  game.cosmeticId = profile.equippedCosmetic;
  game.petId = profile.activePet;
  profile.activeFindClaims = [];
  authority = new LocalAuthority(game);
  suspendedGame = null;
  paused = false;
  recorded = false;
  keys.clear();
  pending.clear();
  pointer.down = false;
  ui.showHUD();
  audio.setMode("playing");
  persist({ terminalRunId: previousId || null });
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
    persist();
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
  if (game && game.state !== "dead" && !checkpointAndSuspend()) return;
  clearWorldFeedback();
  paused = false;
  game = null;
  authority = null;
  keys.clear();
  pointer.down = false;
  ui.showMenu(profile);
  audio.setMode("menu");
}
function clearWorldFeedback() {
  world?.resetRun();
  for (const item of floating) item.element.remove();
  floating.length = 0;
  clearTimeout(ui?.toastTimer);
  document.getElementById("toast").classList.remove("visible");
}
function completeDeath() {
  if (!game || game.state !== "dead" || recorded) return;
  recorded = true;
  const result = game.getResults(), before = profile.dna;
  result.runId = game.runId;
  recordRun(profile, result);
  game.earnedDNA += profile.dna - before;
  result.dna = game.earnedDNA;
  suspendedGame = null; savedRun = null;
  persist({ terminalRunId: game.runId });
  ui?.updateProfile(profile);
  ui?.showDeath(result, profile);
  audio.setMode("dead");
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
    continue: continueLife,
    resume,
    pause,
    restart: () => start(difficulty),
    evolution: () => {
      if (authority?.dispatch({ type: "open-evolution" }).ok) {
        paused = false;
        keys.clear();
        pending.clear();
        pointer.down = false;
        persist();
      }
    },
    postpone: () => {
      if (authority?.dispatch({ type: "close-evolution" }).ok) {
        paused = false;
        keys.clear();
        pending.clear();
        ui.showHUD();
        audio.setMode("playing");
        persist();
      }
    },
    bloodlines: () => ui.showBloodlines(game),
    menu,
    hatch: () => {
      unlock();
      authority?.dispatch({ type: "hatch" });
      persist();
    },
    evolve: (speciesId, mutationId) => {
      const result = authority?.dispatch({ type: "evolve", speciesId, mutationId });
      if (result?.ok && game?.state === "playing") {
        paused = false;
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
      settings = normalizeSettings({ ...settings, ...next });
      ui.settings = settings;
      applySettings();
      ui.refreshControlLabels();
      clearTimeout(settingsSaveTimer);
      settingsSaveTimer = setTimeout(() => persist(), 180);
    },
    backups: () => {
      ui.showBackups(
        () => {
          const current = game || suspendedGame;
          return saves.exportBackup({ profile, settings, run: current ? current.state === "dead" ? null : snapshotGame(current) : savedRun });
        },
        (text) => saves.previewBackup(text),
        (text) => {
          const result = saves.importBackup(text);
          if (result.ok) {
            clearTimeout(settingsSaveTimer);
            pendingTerminalIds.clear(); pendingSave = false;
            lastSaveFailed = false; storageFailed = false; autosaveElapsed = 0;
            profile = result.data.profile; settings = result.data.settings;
            savedRun = result.data.run; suspendedGame = savedRun ? restoreGame(savedRun) : null;
            game = null; authority = null; paused = false; recorded = false;
            keys.clear(); pending.clear(); pointer.down = false;
            world?.resetRun();
            ui.updateProfile(profile); ui.settings = settings; applySettings();
            ui.setSavedRun(runSummary());
            ui.setSaveStatus("BACKUP RESTORED");
            audio.setMode("menu");
          }
          return result;
        },
      );
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
        const saved = persist();
        ui.updateProfile(profile);
        ui.refreshShop();
        ui.toast(saved ? `${result.item.name} purchased. Permanently owned.` : "Purchased for this session. Save failed; export a backup from Settings.");
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
      completeDeath();
      if (!persist({ terminalRunId: game?.state === "dead" ? game.runId : null })) {
        ui.toast("The latest checkpoint could not be written. Export a backup from Settings before closing.");
        return;
      }
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
ui.setSavedRun(runSummary());
function applySettings() {
  const quietMotion = settings.reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.style.setProperty("--ui-scale", String(settings.uiScale || 1));
  document.body.classList.toggle("reduced-motion", quietMotion);
  audio.configure(settings);
  world?.configure({ ...settings, shake: settings.shake && !quietMotion });
}
applySettings();
if (storageFailed)
  ui.toast(
    loadError || "Some local data could not be read. Valid legacy progress was preserved.",
  );
if (recoveredSave && !storageFailed) ui.toast(savedRun ? "A previous valid checkpoint was recovered. Continue your life from the title screen." : "Permanent progress was recovered. No living expedition was restored.");
if (resumeFailure) ui.toast(`Permanent progress loaded, but the expedition needs a compatible backup: ${resumeFailure}`);
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
  if (ui.view === "hud" && event.button === 1) {
    event.preventDefault();
    pending.add("KeyC");
  }
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
let exitCheckpointSaved = false;
function saveBeforeExit() {
  if (exitCheckpointSaved) return;
  completeDeath();
  exitCheckpointSaved = persist({ terminalRunId: game?.state === "dead" ? game.runId : null });
}
window.addEventListener("beforeunload", saveBeforeExit);
window.addEventListener("pageshow", () => { exitCheckpointSaved = false; });
window.addEventListener("pagehide", (event) => {
  saveBeforeExit();
  if (!event.persisted) { world?.dispose(); specimen?.dispose(); productViewer?.dispose(); islandScene?.dispose(); audio.dispose(); }
});
window.addEventListener("keydown", (event) => {
  const key = event.code;
  if (ui.captureBinding(event)) { event.preventDefault(); return; }
  const bindings = settings.controls || DEFAULT_BINDINGS;
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
    if (ui.view === "evolution") {
      ui.callbacks.postpone();
      return;
    }
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
  if (key === bindings.evolve && ui.view === "hud" && !event.repeat) {
    ui.callbacks.evolution();
    return;
  }
  if (key === bindings.journal && ui.view === "hud" && !event.repeat) {
    pause();
    ui.showBloodlines(game);
    return;
  }
  if (key === bindings.fieldJournal && ui.view === 'hud' && !event.repeat) {
    pause();
    ui.showFieldJournal(game);
    return;
  }
  if (key === bindings.map && ui.view === "hud" && !event.repeat) {
    mapExpanded = !mapExpanded;
    const map = document.getElementById("minimap");
    if (map) map.classList.toggle("expanded", mapExpanded);
    return;
  }
  if (key === bindings.guide && ui.view === "hud" && !event.repeat) {
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
const environmentPanel = document.createElement('div');
environmentPanel.className = 'environment-panel';
environmentPanel.innerHTML = '<button id="field-journal-button" class="field-journal-button">FIELD JOURNAL · L</button><span id="environment-weather"></span><strong id="environment-body"></strong><span id="environment-discovery"></span>';
document.getElementById('hud').append(environmentPanel);
document.getElementById('field-journal-button').onclick = () => { pause(); ui.showFieldJournal(game); };
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
const roarKey = document.createElement("div");
roarKey.className = "ability-key roar-key";
roarKey.innerHTML =
  '<kbd>C</kbd><span id="hud-roar">ROAR</span><b id="hud-roar-cooldown">READY</b>';
roarKey.addEventListener("click", () => { if (game) game.roar(); });
document.querySelector(".abilities").append(roarKey);
ui.refreshControlLabels();
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
    authority?.dispatch({ type: "waypoint", ...point });
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
  mapTooltip.textContent = !isExplored(game, wx, wy) ? 'UNEXPLORED · Travel here to reveal the terrain · click to mark destination' : lair
    ? `${lair.name} · guardian level ${lair.tier + 1} · ${lair.entityId ? "ALIVE" : `respawns in ${Math.ceil(Math.max(0, lair.respawnAt - game.time))}s`}`
    : `${region.name} · region level ${region.tier + 1} · click to mark destination`;
  mapTooltip.hidden = false;
});
document
  .getElementById("minimap")
  .addEventListener("pointerleave", () => (mapTooltip.hidden = true));
let nextWorldUI = 0;
function updateWorldUI() {
  const visible = game && ui.view === "hud" && game.state === "playing";
  labelLayer.style.display = visible ? "" : "none";
  lowHealth.style.opacity = visible
    ? Math.max(0, (0.4 - game.player.hp / game.player.maxHp) * 2.2)
    : 0;
  alphaBar.hidden = !visible || !game.boss;
  if (!visible || !mapExpanded) mapTooltip.hidden = true;
  const now = performance.now();
  if (now < nextWorldUI) return;
  nextWorldUI = now + 80;
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
  const weather = worldStatus(game), body = survivalStatus(game), discovery = discoveryStatus(game);
  const timeLabel = weather.timeOfDay?.label ? ` · ${weather.timeOfDay.label.toUpperCase()}` : '';
  document.getElementById('environment-weather').textContent = `${weather.season.toUpperCase()}${timeLabel} · ${weather.label} · ${Math.round(weather.temperature)}°C`;
  document.getElementById('environment-body').textContent = `${body.label} · ${Math.round(body.cover*100)}% COVER · ${Math.round(body.fatigue)}% FATIGUE${body.strain>0?' · STRAIN '+Math.ceil(body.strain)+'s':''}`;
  document.getElementById('environment-body').classList.toggle('exposed',Math.abs(body.temperature)>.65);
  document.getElementById('environment-discovery').textContent = discovery.next ? `${discovery.found}/${discovery.total} SITES · ${discovery.next.direction.toUpperCase()} ${Math.round(discovery.next.distance)}m · ${keyLabel(settings.controls.crouch)} STALK / DIVE` : 'ALL ANCIENT SITES DISCOVERED';
  document.getElementById('field-journal-button').textContent = `FIELD JOURNAL · ${keyLabel(settings.controls.fieldJournal)}`;
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
  document.getElementById("hud-technique").closest(".ability-key").hidden = !game.kit.technique;
  document.getElementById("hud-technique").textContent =
    TECHNIQUES[game.kit.technique]?.name.toUpperCase() || "";
  document.getElementById("hud-technique-cooldown").textContent =
    p0.techniqueCooldown > 0 ? `${p0.techniqueCooldown.toFixed(1)}s` : "READY";
  document.getElementById("hud-technique").closest(".ability-key").classList.toggle("cooling", p0.techniqueCooldown > 0);
  const roarCooldown = p0.roarCooldown || 0;
  const roarEl = document.getElementById("hud-roar");
  if (roarEl) {
    document.getElementById("hud-roar-cooldown").textContent =
      roarCooldown > 0 ? `${roarCooldown.toFixed(1)}s` : "READY";
    roarEl.closest(".ability-key").classList.toggle("cooling", roarCooldown > 0);
  }
  const buffs = Object.entries(game.buffs)
    .filter(([, v]) => v > 0)
    .map(
      ([id, left]) =>
        `${POWERUPS.find((b) => b.id === id)?.name || id} · ${Math.ceil(left)}s`,
    );
  if (p0.poisoned > 0) buffs.push(`VENOM · ${Math.ceil(p0.poisoned)}s`);
  if (p0.bleeding > 0) buffs.push(`HEMORRHAGE · ${Math.ceil(p0.bleeding)}s`);
  if (p0.burning > 0) buffs.push(`BURNING · ${Math.ceil(p0.burning)}s`);
  if (p0.sleeping > 0) buffs.push(`DROWSY · ${Math.ceil(p0.sleeping)}s`);
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
        key.textContent = keyLabel(settings.controls?.["skill" + i] || DEFAULT_BINDINGS["skill" + i]);
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
  let nearby = null, nearest = 49;
  for (const food of game.foods) {
    const distance = (food.x - p0.x) ** 2 + (food.y - p0.y) ** 2;
    if (distance < nearest) { nearby = food; nearest = distance; }
  }
  const prompt = document.getElementById("pickup-prompt");
  prompt.hidden = !nearby && !game.hazardHint;
  if (game.hazardHint) prompt.textContent = game.hazardHint;
  if (nearby)
    prompt.textContent =
      nearby.type === "egg"
        ? `E · EAT EGG / HATCHES IN ${Math.ceil(Math.max(0, nearby.hatchAfter - nearby.age))}s`
        : nearby.type === "rareplant"
          ? `E · ${POWERUPS.find((b) => b.id === nearby.powerup)?.name || "Rare plant"} · timed power-up`
          : nearby.type === "relic"
            ? `E · ANCIENT SKILL RELIC · lasts until death`
            : nearby.type === "dna"
              ? "E - RARE DNA SPECIMEN"
              : nearby.type === "pet-egg"
                ? "E - PERMANENT COMPANION EGG"
                : nearby.type.includes("cache")
                  ? "E - PERMANENT COLLECTION CACHE"
                  : "E - EXCEPTIONALLY RARE FOSSIL - permanent discovery";
  if (nearby?.type === "lineage-fruit")
    prompt.textContent = `E - ${nearby.fruit === "sunheart" ? "SUNHEART" : "MOONDROP"} FRUIT - rare bloodline ingredient`;
  if (nearby && ["plant", "meat", "essence"].includes(nearby.type))
    prompt.textContent = canEatFood(game.species, nearby)
      ? `E · ${foodLabel(nearby).toUpperCase()} · LEVEL ${(nearby.tier || 0) + 1} FOOD`
      : `${foodLabel(nearby).toUpperCase()} · CARNIVORES CANNOT DIGEST THIS PLANT`;
  prompt.textContent = prompt.textContent.replace(/^E(?=\s)/, keyLabel(settings.controls?.eat || DEFAULT_BINDINGS.eat));
}
function updateCreatureLabels() {
  if (!game || !world || ui.view !== "hud" || game.state !== "playing") return;
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
    const species = SPECIES_BY_ID[e.speciesId];
    if (!species) continue;
    if (!element) {
      element = document.createElement("div");
      element.className = "creature-label";
      element.innerHTML = "<span></span><b><i></i></b>";
      labels.set(e.id, element);
      labelLayer.append(element);
    }
    const isInjured = e.hp < e.maxHp * 0.85;
    element.className = `creature-label${species.tier > game.tier ? " predator" : ""}${e.boss ? " alpha" : ""}${isInjured ? " injured" : ""}${e.intent === "fight" ? " fighting" : ""}`;
    element.dataset.rarity = species.rarity || "regular";
    element.querySelector("span").textContent =
      `${e.boss ? "ALPHA · " : e.juvenile ? "JUVENILE · " : ""}${species.name}${(e.growth || 0) >= 0.5 ? " - " + growthName(e.growth) : ""}${isInjured ? " · INJURED" : ""}${e.intent === "fight" ? " · CLASHING" : e.intent === "graze" ? " · NEUTRAL" : e.packId ? " · PACK" : ""}`;
    element.querySelector("i").style.transform =
      `scaleX(${Math.max(0, e.hp / e.maxHp)})`;
    const pos = world.project(e.x, e.y, species.size * (e.scaleFactor || 1) * 2 + 1);
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
function processEvents() {
  for (const event of game.consumeEvents()) {
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
      }
    }
    if (
      event.type === "kill" &&
      event.speciesId &&
      !profile.hunted.includes(event.speciesId)
    ) {
      profile.hunted.push(event.speciesId);
      persist();
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
    try {
    world?.event(event);
    const sound =
      {
        powerup: "eat",
        "run-skill": "evolve",
        unlock: "evolve",
        "enemy-ability": "ability",
        "run-cast": "ability",
        "egg-hatch": "hatch",
        'discovery': 'evolve',
        'adaptation': 'evolve',
        'world-event': 'warning',
      }[event.type] || event.type;
    if (
      !Number.isFinite(event.x) ||
      Math.hypot(event.x - game.player.x, event.y - game.player.y) < 70
    )
      audio.creatureEvent({ ...event, originalType: event.type, type: sound }, game);
    if (event.type === "collection-find") audio.play("evolve");
    float(event);
    if (
      [
        "warning",
        "boss",
        "evolution-ready",
        "lineage-progress",
        "hatch",
        "powerup",
        "run-skill",
        "run-cast",
        "unlock",
        "region",
        "dna-find",
        'discovery',
        'adaptation',
        'world-event',
      ].includes(event.type) &&
      event.text
    )
      ui.toast(event.text);
    } catch (error) {
      console.error("Presentation event failed; gameplay and reward state retained", error);
    }
  }
}
function events() {
  handlingEvents = true;
  try { processEvents(); }
  finally {
    handlingEvents = false;
    if (pendingSave && game.state !== "dead") persist();
  }
}
let last = performance.now(),
  accumulator = 0,
  miniTimer = 0,
  uiTimer = 0,
  frames = 0,
  fpsTime = 0,
  fps = 60,
  lastRenderedWorldView = null;
let previousPad = { pause: false, evolve: false, map: false };
function controllerInput() {
  if (settings.gamepad === false || document.hidden || !document.hasFocus()) return gamepadIntent(null);
  const devices = navigator.getGamepads?.() || [];
  for (const device of devices) if (device?.connected && device.mapping === "standard") return gamepadIntent(device);
  return gamepadIntent(null);
}
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
    const pad = controllerInput();
    if (pad.pause && !previousPad.pause) {
      if (ui.view === "hud") pause();
      else if (ui.view === "pause") resume();
      else if (ui.view === "evolution") ui.callbacks.postpone();
    }
    if (pad.evolve && !previousPad.evolve && ui.view === "hud") ui.callbacks.evolution();
    if (pad.map && !previousPad.map && ui.view === "hud") {
      mapExpanded = !mapExpanded;
      document.getElementById("minimap").classList.toggle("expanded", mapExpanded);
    }
    previousPad = pad;
    const active =
      game &&
      !paused &&
      ui.view === "hud" &&
      ["egg", "playing"].includes(game.state);
    if (active) {
      const held = (action) => actionHeld(action, keys, pending, settings.controls);
      let x = Number(held("right")) - Number(held("left")) || pad.x;
      let y = Number(held("down")) - Number(held("up")) || pad.y;
      const aim =
        pad.aim !== null ? pad.aim : pointer.moved && world
          ? world.aim(pointer.x, pointer.y, game.player)
          : x || y
            ? Math.atan2(y, x)
            : game.player.angle;
      accumulator += dt;
      while (accumulator >= 1 / 60) {
        const tickResult = authority.step({
          x,
          y,
          aim,
          attack: pointer.down || held("attack") || pending.has("Mouse0") || pad.attack,
          ability: held("ability") || pad.ability,
          special: held("special") || pad.special,
          technique: held("technique") || pad.technique,
          roar: held("roar") || pad.roar || pending.has("KeyC") || false,
          skill: [0, 1, 2, 3, 4, 5].findIndex((slot) => held("skill" + slot)),
          sprint: held("sprint") || pad.sprint,
          crouch: held('crouch') || pad.crouch || false,
          dash: held("dash") || pad.dash,
          eat: held("eat") || pad.eat,
        });
        if (!tickResult.ok) throw Error(`Simulation command failed: ${tickResult.error}`);
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
      if (game.state === "dead" && !recorded) completeDeath();
    }
    if (active || lastSaveFailed) {
      autosaveElapsed += dt;
      if (autosaveElapsed >= 10) persist({ terminalRunId: game?.state === "dead" ? game.runId : null });
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
    // Keep a frozen world behind modal screens instead of drawing two WebGL
    // scenes every frame while inspecting a specimen or browsing the shop.
    if (!graphicsFailed && ui.view !== "island" &&
      (["menu", "hud"].includes(ui.view) || ui.view !== lastRenderedWorldView)) {
      world?.render(game, active || ui.view === "menu" ? dt : 0, menuView);
      lastRenderedWorldView = ui.view;
    }
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
        if (pendingIslandBuild) {
          pendingIslandBuild = false;
          islandAction("build");
        }
        if (pendingIslandTool) {
          if (islandScene.buildMode)
            islandScene.setTool(pendingIslandTool.kind, pendingIslandTool.id);
          ui.islandHint(
            "Press ENTER BUILD MODE to place the item you selected in the shop.",
          );
        }
      }
      if (!document.hidden && document.hasFocus()) {
        profile.island.visitSeconds += dt;
        islandScene.saveClock = (islandScene.saveClock || 0) + dt;
        if (islandScene.saveClock > 15) {
          islandScene.saveClock = 0;
          persist();
          islandState();
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
    updateCreatureLabels();
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
// Local development diagnostics are excluded from the production build.
if (import.meta.env.DEV) {
  window.__JD = {
    get saves() { return saves; },
    get authority() { return authority; },
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
    get audio() {
      return audio;
    },
    get fps() {
      return fps;
    },
    start,
    pause,
    resume,
  };
}
