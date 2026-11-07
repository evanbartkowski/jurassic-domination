import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// An isolated browser context never touches an existing desktop/browser save.
const url = process.env.JD_QA_URL || "http://127.0.0.1:5173";
const output = "artifacts";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(30_000);
const report = { url, checks: [], failures: [], errors: [], measurements: {}, screenshots: [] };
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") report.errors.push(message.text());
});
async function check(name, run) {
  try {
    const result = await run();
    report.checks.push(name);
    if (result !== undefined) report.measurements[name] = result;
    console.log("PASS " + name);
  } catch (error) {
    report.failures.push({ name, message: error.message });
    console.error("FAIL " + name + ": " + error.message);
  }
}
async function settle() {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function screenshot(name) {
  const path = `${output}/${name}.png`;
  await page.screenshot({ path });
  report.screenshots.push(path);
}
const viewports = [
  { width: 1440, height: 900 }, { width: 1280, height: 720 },
  { width: 800, height: 600 }, { width: 390, height: 844 },
];

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__JD?.ui && window.__JD?.world);
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await check(`title menu fits and buttons remain reachable at ${viewport.width}x${viewport.height}`, async () => {
      await page.evaluate(() => window.__JD.ui.showMenu(window.__JD.profile));
      await settle();
      const actions = ["start", "tutorial", "guide", "legacy", "wardrobe", "shop", "island", "settings"];
      for (const action of actions) {
        const button = page.locator(`[data-action="${action}"]`).first();
        assert.ok(await button.isVisible(), action + " is visible");
        await button.scrollIntoViewIfNeeded();
        const box = await button.boundingBox();
        assert.ok(box && box.x >= -1 && box.x + box.width <= viewport.width + 1, `${action} fits horizontally`);
        assert.ok(box.y >= -1 && box.y + box.height <= viewport.height + 1, `${action} can be scrolled into view`);
      }
      const dimensions = await page.evaluate(() => ({ width: innerWidth, document: document.documentElement.scrollWidth, overlay: document.querySelector("#overlay").scrollWidth }));
      assert.ok(dimensions.document <= dimensions.width + 1, JSON.stringify(dimensions));
      assert.ok(dimensions.overlay <= dimensions.width + 1, JSON.stringify(dimensions));
      await page.evaluate(() => { document.querySelector("#overlay").scrollTop = 0; });
      await screenshot(`v6-title-${viewport.width}`);
      return dimensions;
    });
  }
  await page.setViewportSize(viewports[0]);
  await page.getByRole("button", { name: /BEGIN A NEW LIFE/ }).click();
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__JD.game?.state === "playing");
  await page.evaluate(() => {
    const g = window.__JD.game;
    g.entities = []; g.foods = []; g.lairs = []; g.worldFeatures = [];
    g._streamWorld = () => {}; g._replenish = () => {}; g._nextBoss = Infinity;
    g.player.invulnerable = 100_000;
    g.player.x = g.player.y = g.player.vx = g.player.vy = 0;
  });

  await check("a skill-free hatchling hides Q, R and X while keeping bite and movement", async () => {
    await page.evaluate(() => {
      const { game: g, ui } = window.__JD;
      g.player.speciesId = "microraptor"; g.tier = 0; g.player.formScale = 1; g.refreshStats(true);
      ui.showHUD(); ui.updateHUD(g);
    });
    await page.waitForFunction(() => document.querySelector("#hud-technique").closest(".ability-key").hidden);
    for (const id of ["#hud-ability", "#hud-technique", "#special-name"])
      assert.equal(await page.locator(id).isVisible(), false, id + " hidden");
    const gameplay = await page.evaluate(() => {
      const g = window.__JD.game, stamina = g.player.stamina;
      return { kit: g.kit.abilityCount, q: g.ability(), r: g.technique(), x: g.special(), unchanged: g.player.stamina === stamina, bite: g.attack(), dash: g.kit.dash };
    });
    assert.deepEqual(gameplay, { kit: 0, q: false, r: false, x: false, unchanged: true, bite: true, dash: true });
    await screenshot("v6-skill-free-hud");
    return gameplay;
  });

  await check("a late evolution displays its three correct skill names", async () => {
    await page.evaluate(() => {
      const { game: g, ui } = window.__JD;
      g.player.speciesId = "elder-dragon"; g.tier = 7; g.player.formScale = 1; g.refreshStats(true);
      ui.updateHUD(g);
    });
    await page.waitForFunction(() => !document.querySelector("#hud-technique").closest(".ability-key").hidden);
    for (const id of ["#hud-ability", "#hud-technique", "#special-name"])
      assert.ok(await page.locator(id).isVisible(), id + " visible");
    const names = await page.evaluate(async () => {
      const { TECHNIQUES } = await import("/src/content.js");
      const { SPECIALS } = await import("/src/progression.js");
      const g = window.__JD.game;
      return {
        actual: [document.querySelector("#hud-ability").textContent, document.querySelector("#hud-technique").textContent, document.querySelector("#special-name").textContent].map((s) => s.toUpperCase()),
        expected: [g.species.ability, TECHNIQUES[g.kit.technique].name, SPECIALS[g.kit.special].name].map((s) => s.toUpperCase()),
      };
    });
    assert.deepEqual(names.actual, names.expected);
    return names.actual;
  });

  await check("every possible evolution card uses a loaded dinosaur image, including unrecorded forms", async () => {
    const result = await page.evaluate(async () => {
      const { SPECIES } = await import("/src/data.js");
      const { game: g, ui, profile } = window.__JD;
      const discovered = new Set([...(profile.unlocked || []), ...(profile.hunted || [])]);
      const result = { count: 0, unrecorded: 0, invalid: [] };
      g.state = "evolution"; g.mutationChoices = ["razor", "vitality", "swift"];
      for (let start = 0; start < SPECIES.length; start += 3) {
        const forms = SPECIES.slice(start, start + 3);
        g.evolutionChoices = forms.map((s) => s.id);
        ui.showEvolution(g);
        for (const s of forms) {
          const card = document.querySelector(`[data-species="${s.id}"]`), image = card?.querySelector(".evolution-creature img");
          if (!image) { result.invalid.push(s.id + " missing image"); continue; }
          image.loading = "eager";
          try { await image.decode(); } catch { result.invalid.push(s.id + " decode failed"); }
          if (!image.naturalWidth || !image.src.endsWith(`species-${s.id}.webp`)) result.invalid.push(s.id + " invalid portrait");
          result.count++; result.unrecorded += Number(!discovered.has(s.id));
        }
      }
      return result;
    });
    assert.equal(result.count, 102);
    assert.ok(result.unrecorded > 90);
    assert.deepEqual(result.invalid, []);
    return result;
  });

  await check("Rare, Epic and Legendary evolution cards have distinct colored frames and glows", async () => {
    await page.evaluate(() => {
      const { game: g, ui } = window.__JD;
      g.evolutionChoices = ["deinonychus", "wyvern", "world-serpent"];
      ui.showEvolution(g);
    });
    await page.waitForFunction(() => [...document.querySelectorAll(".evolution-card img")].every((image) => image.complete && image.naturalWidth));
    const styles = await page.locator(".evolution-card").evaluateAll((cards) => cards.map((card) => {
      const style = getComputedStyle(card);
      return { id: card.dataset.species, rarity: card.dataset.rarity, borderColor: style.borderColor, borderStyle: style.borderStyle, borderWidth: style.borderWidth, glow: style.boxShadow };
    }));
    assert.deepEqual(styles.map((s) => s.rarity), ["rare", "epic", "legendary"]);
    assert.equal(new Set(styles.map((s) => s.borderColor)).size, 3);
    assert.equal(new Set(styles.map((s) => s.glow)).size, 3);
    assert.ok(styles.every((s) => s.glow !== "none"));
    assert.equal(styles[2].borderStyle, "double");
    await screenshot("v6-evolution-rarities");
    return styles;
  });

  for (const viewport of [viewports[0], viewports[2]]) {
    await page.setViewportSize(viewport);
    await check(`evolution confirmation stays visible and choices remain reachable at ${viewport.width}x${viewport.height}`, async () => {
      await page.evaluate(() => {
        const { game: g, ui } = window.__JD;
        g.state = "evolution";
        g.evolutionChoices = ["deinonychus", "wyvern", "world-serpent"];
        g.mutationChoices = ["razor", "vitality", "swift"];
        ui.showEvolution(g);
        document.querySelector(".evolution-panel").scrollTop = 0;
      });
      await settle();
      const initial = await page.evaluate(() => {
        const panel = document.querySelector(".evolution-panel"), button = document.querySelector('[data-action="evolve"]'), footer = button.closest(".panel-bottom"), mutations = document.querySelector(".mutation-choices");
        const b = button.getBoundingClientRect(), f = footer.getBoundingClientRect();
        const m = mutations.getBoundingClientRect();
        const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return { scrollTop: panel.scrollTop, button: { x: b.x, y: b.y, right: b.right, bottom: b.bottom }, footer: { y: f.y, bottom: f.bottom }, mutations: { y: m.y, bottom: m.bottom }, hit: !!hit?.closest('[data-action="evolve"]') };
      });
      await screenshot(`v6-evolution-footer-${viewport.width}`);
      assert.equal(initial.scrollTop, 0, "confirmation is visible before scrolling");
      assert.ok(initial.button.y >= 0 && initial.button.bottom <= viewport.height + 1 && initial.hit, "confirmation fits and accepts a click before scrolling: " + JSON.stringify(initial));
      if (viewport.width === 1440) assert.ok(initial.mutations.y >= 0 && initial.mutations.bottom <= initial.footer.y + 1, "all mutation choices are visible above the footer before scrolling at 900px: " + JSON.stringify(initial));
      const targets = page.locator(".evolution-card .species-ability, .mutation-card");
      const covered = [];
      for (let i = 0; i < await targets.count(); i++) {
        const target = targets.nth(i);
        await target.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
        await settle();
        const position = await target.evaluate((element) => {
          const r = element.getBoundingClientRect(), footer = document.querySelector(".evolution-panel>.panel-bottom").getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return { text: element.textContent.trim(), top: r.top, bottom: r.bottom, footerTop: footer.top, covered: !hit || !(element.contains(hit) || hit === element) };
        });
        if (position.covered || position.top < 0 || position.bottom > position.footerTop + 1) covered.push(position);
      }
      await screenshot(`v6-evolution-choices-scrolled-${viewport.width}`);
      assert.deepEqual(covered, [], "card skill text and mutation choices can each be scrolled clear of the footer");
      return initial;
    });
  }
  await page.setViewportSize(viewports[0]);

  await check("mature-body evolution keeps the rendered model at its actual larger simulation size", async () => {
    const result = await page.evaluate(() => {
      const { game: g, ui, world } = window.__JD;
      g.player.speciesId = "dreadnoughtus"; g.tier = 5; g.player.formScale = 1; g.player.growth = 1;
      g.refreshStats(true);
      const before = g.effectiveSize;
      g.state = "evolution"; g.evolutionChoices = ["wyvern"]; g.mutationChoices = ["razor"];
      g.player.xp = g.nextThreshold;
      const evolved = g.evolve("wyvern", "razor");
      ui.showHUD(); world.render(g, 0, false);
      const model = world.models.get("player");
      return { evolved, before, after: g.effectiveSize, visualScale: model.scale.x / model.userData.baseScale, expectedScale: g.effectiveSize / g.species.size };
    });
    assert.ok(result.evolved);
    assert.ok(result.after >= result.before * 1.059);
    assert.ok(Math.abs(result.visualScale - result.expectedScale) < 1e-9);
    return result;
  });

  await check("all twelve forage models match their foods and safely reuse cached geometry", async () => {
    const result = await page.evaluate(async () => {
      const { FOOD_PLANTS } = await import("/src/forage.js");
      const { createForageModel } = await import("/src/forage-art.js");
      const geometries = new Set(), invalid = [];
      for (const p of FOOD_PLANTS) {
        const a = createForageModel({ id: 1, type: "plant", plantKind: p.id });
        const b = createForageModel({ id: 2, type: "plant", plantKind: p.id });
        const ga = a.children[0].geometry;
        if (a === b || ga !== b.children[0].geometry || a.userData.plantKind !== p.id || !ga.attributes.color || ga.attributes.position.count < 3) invalid.push(p.id);
        a.userData.dispose(); b.userData.dispose();
        const c = createForageModel({ id: 3, type: "plant", plantKind: p.id });
        if (c.children[0].geometry !== ga) invalid.push(p.id + " disposed cache");
        geometries.add(ga);
      }
      return { count: FOOD_PLANTS.length, uniqueGeometries: geometries.size, invalid };
    });
    assert.deepEqual(result, { count: 12, uniqueGeometries: 12, invalid: [] });
    return result;
  });

  await check("marine models use exact simulation positions and approach continuously at bounded swim speed", async () => {
    const result = await page.evaluate(async () => {
      const { Game } = await import("/src/game.js");
      const { updateWildlife, marineSpeed } = await import("/src/wilderness.js");
      const { createWildFeature } = await import("/src/wilderness-art.js");
      const g = new Game({ seed: 72 }); g.hatch(); g.entities = []; g.foods = [];
      const f = { id: "qa-pool", type: "water", x: 0, y: 0, radius: 16, tier: 3, phase: 0 };
      g.worldFeatures = [f]; g.player.x = 30; g.player.y = 30; g.time = 0;
      updateWildlife(g, 0);
      const model = createWildFeature(f), state = g.marineState.get(f.id);
      const origin = state.swimmers.map((s) => ({ ...s }));
      g.player.x = 0; g.player.y = 0; g.player.invulnerable = 10_000;
      const distancesBefore = state.swimmers.map((s) => Math.hypot(s.x, s.y));
      let maxStep = 0, violations = 0, error = 0;
      for (let step = 0; step < 120; step++) {
        const previous = state.swimmers.map((s) => ({ ...s }));
        g.time += .025; updateWildlife(g, .025);
        model.userData.animate(g.time, g.player, g.marineState);
        state.swimmers.forEach((fish, i) => {
          const moved = Math.hypot(fish.x - previous[i].x, fish.y - previous[i].y);
          maxStep = Math.max(maxStep, moved);
          if (moved > marineSpeed(f, i, true) * .025 + 1e-8) violations++;
          const mesh = model.userData.swimmers[i];
          error = Math.max(error, Math.abs(mesh.position.x + f.x - fish.x), Math.abs(mesh.position.z + f.y - fish.y), Math.abs(mesh.rotation.y + fish.angle));
        });
      }
      const snapshot = JSON.stringify(state.swimmers);
      model.userData.animate(g.time, { x: -15, y: -15 }, g.marineState);
      const frozen = snapshot === JSON.stringify(state.swimmers);
      const distancesAfter = state.swimmers.map((s) => Math.hypot(s.x, s.y));
      model.userData.dispose();
      return { maxStep, violations, renderError: error, frozen, distancesBefore, distancesAfter, initializedAway: origin.every((s) => Math.hypot(s.x, s.y) > 5) };
    });
    assert.equal(result.violations, 0);
    assert.equal(result.renderError, 0);
    assert.ok(result.frozen);
    assert.ok(result.initializedAway);
    assert.ok(result.distancesAfter.every((d, i) => d < result.distancesBefore[i]));
    return result;
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await check(`full HUD fits without vital, action or evolution overlap at ${viewport.width}x${viewport.height}`, async () => {
      await page.evaluate(() => {
        const { game: g, ui } = window.__JD;
        g.state = "playing"; g.player.speciesId = "elder-dragon"; g.tier = 7; g.player.formScale = 1; g.player.growth = 0;
        g.player.xp = g.nextThreshold; g.evolutionReady = true; g.refreshStats(true);
        ui.showHUD(); ui.updateHUD(g);
      });
      await page.waitForFunction(() => !document.querySelector("#hud-technique").closest(".ability-key").hidden);
      await settle();
      const layout = await page.evaluate(() => {
        const selectors = [".vitals", ".abilities", ".evolution-progress", "#region-route", ".minimap-wrap"];
        const rects = selectors.filter((selector) => {
          const element = document.querySelector(selector), style = element && getComputedStyle(element);
          return element && !element.hidden && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && (element.textContent.trim() || element.querySelector("canvas"));
        }).map((selector) => {
          const r = document.querySelector(selector).getBoundingClientRect();
          return { selector, x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
        });
        const overlaps = [];
        for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i], b = rects[j];
          if (Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1) overlaps.push([a.selector, b.selector]);
        }
        return { rects, overlaps, screenWidth: innerWidth, screenHeight: innerHeight, scrollWidth: document.documentElement.scrollWidth, healthHeight: document.querySelector(".meter.health").getBoundingClientRect().height };
      });
      await screenshot(`v6-hud-${viewport.width}`);
      report.measurements[`hud-${viewport.width}`] = layout;
      assert.ok(layout.scrollWidth <= viewport.width + 1, "document has no horizontal overflow");
      assert.deepEqual(layout.overlaps, [], "HUD panels do not overlap");
      for (const r of layout.rects) assert.ok(r.x >= -1 && r.y >= -1 && r.right <= viewport.width + 1 && r.bottom <= viewport.height + 1, `${r.selector} stays in viewport: ${JSON.stringify(r)}`);
      assert.ok(layout.healthHeight >= 15, "health bar remains prominent");
      return layout;
    });
  }
  await check("no browser exceptions or console errors", async () => assert.deepEqual(report.errors, []));
} catch (error) {
  report.failures.push({ name: "browser setup or test sequence", message: error.stack || error.message });
} finally {
  await writeFile(`${output}/v6-qa.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ passed: report.checks.length, failures: report.failures, errors: report.errors, report: `${output}/v6-qa.json` }, null, 2));
if (report.failures.length || report.errors.length) process.exitCode = 1;
