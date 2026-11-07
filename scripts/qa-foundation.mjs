import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const url = process.env.JD_QA_URL || "http://127.0.0.1:5173";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--autoplay-policy=no-user-gesture-required"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(45_000);
const report = { url, isolatedProfile: true, checks: [], failures: [], errors: [], measurements: {}, screenshots: [] };
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") report.errors.push(message.text()); });
async function check(name, run) {
  try { const result = await run(); report.checks.push(name); if (result !== undefined) report.measurements[name] = result; console.log("PASS " + name); }
  catch (error) {
    // Playwright includes the entire pasted backup in action logs; preserve the
    // useful failure without printing hundreds of kilobytes of save contents.
    const message = error.message.split("\nCall log:")[0].slice(0, 2000);
    report.failures.push({ name, message }); console.error("FAIL " + name + ": " + message);
  }
}
async function frames(count = 3) {
  await page.evaluate(async (count) => { for (let i = 0; i < count; i++) await new Promise((resolve) => requestAnimationFrame(resolve)); }, count);
}
async function capture(name) {
  const path = `artifacts/foundation-${name}.png`; await page.screenshot({ path }); report.screenshots.push(path);
}
async function ready() { await page.waitForFunction(() => window.__JD?.ui && window.__JD?.saves); }
async function settingsFromPause() {
  if (await page.evaluate(() => window.__JD.ui.view) === "hud") await page.keyboard.press("Escape");
  await page.locator('[data-action="settings"]').click();
  await page.locator("#setting-ui-scale").waitFor();
}
async function openBackups() { await page.locator('[data-action="backups"]').click(); await page.locator("#backup-text").waitFor(); }
async function state() {
  return page.evaluate(() => {
    const g = window.__JD.game;
    const chunk = g.chunks.get("0,0");
    return { runId: g.runId, seed: g.seed, random: g._randomState, tick: g.tick, time: g.time, tier: g.tier,
      player: { x: g.player.x, y: g.player.y, hp: g.player.hp, maxHp: g.player.maxHp, growth: g.player.growth, nutrients: g.player.nutrients, xp: g.player.xp },
      choices: [...g.evolutionChoices], mutations: [...g.mutationChoices],
      inactiveFoods: chunk?.foods.map((f) => ({ id: f.id, type: f.type, age: f.age, plantKind: f.plantKind })) || [] };
  });
}
let saved, predeathBackup, deadRunId;
try {
  await page.goto(url); await ready();
  await check("a real new life hatches through the command authority and exposes checkpoint status", async () => {
    assert.equal(await page.locator('[data-action="continue"]').count(), 0);
    await page.getByRole("button", { name: /BEGIN A NEW LIFE/ }).click();
    await page.locator("#hatch-button").waitFor();
    await page.keyboard.press("KeyE");
    await page.waitForFunction(() => window.__JD.game?.state === "playing" && window.__JD.game.tick > 0);
    const result = await page.evaluate(() => ({ authority: !!window.__JD.authority, runId: window.__JD.game.runId, status: document.getElementById("hud-save-status").textContent }));
    assert.ok(result.authority && result.runId && result.status.includes("SAVED"));
    return result;
  });
  await check("real food consumption and postponed evolution offers survive save-and-return-to-title", async () => {
    const consumedId = await page.evaluate(() => {
      const g = window.__JD.game; g.entities = []; g.player.invulnerable = 9999; g._eatCooldown = 0;
      return g.spawnFood("plant", g.player.x, g.player.y, 1, { plantKind: "berry", homeChunk: "0,0" }).id;
    });
    await page.keyboard.down("KeyE");
    await page.waitForFunction((id) => !window.__JD.game.foods.some((f) => f.id === id), consumedId);
    await page.keyboard.up("KeyE");
    await page.evaluate(() => window.__JD.game.gainXP(window.__JD.game.nextThreshold));
    await page.keyboard.press("KeyT");
    await page.waitForFunction(() => window.__JD.ui.view === "evolution");
    await page.locator('[data-action="postpone"]').click();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__JD.ui.view === "pause");
    await page.evaluate(() => {
      const g = window.__JD.game;
      const egg = g.spawnFood("egg", 13, 4, 6, { speciesId: "coelophysis", tier: 0, hatchAfter: 90, homeChunk: "0,0" });
      egg.age = 17;
      g.player.nutrients = 70; g.player.growth = .5; g.refreshStats(); g.player.hp = g.player.maxHp * .62;
      g.player.x = 577; g.player.y = 31; g.player.vx = 0; g.player.vy = 0;
      g._streamWorld(true);
    });
    saved = await state();
    assert.ok(saved.choices.length >= 3 && saved.mutations.length === 3);
    assert.ok(saved.inactiveFoods.some((f) => f.type === "egg" && f.age === 17));
    assert.ok(saved.inactiveFoods.every((f) => f.id !== consumedId));
    await page.locator('[data-action="menu"]').click();
    await page.locator('[data-action="continue"]').waitFor();
    assert.match(await page.locator(".save-summary").textContent(), /TIER 1/);
    await capture("continue-title");
    return { runId: saved.runId, consumedId, inactiveFoods: saved.inactiveFoods.length, offers: saved.choices };
  });
  await check("the Continue title keeps its header, copy and footer separate and all actions scroll into view", async () => {
    const result = [];
    for (const viewport of [{ width: 1440, height: 900 }, { width: 800, height: 600 }]) {
      await page.setViewportSize(viewport); await frames(3);
      const layout = await page.evaluate(() => Object.fromEntries([".menu-top", ".menu-copy", ".menu-footer"].map((selector) => {
        const r = document.querySelector(selector).getBoundingClientRect(); return [selector, { top: r.top, bottom: r.bottom, left: r.left, right: r.right }];
      })));
      assert.ok(layout[".menu-top"].bottom <= layout[".menu-copy"].top + 1, JSON.stringify(layout));
      assert.ok(layout[".menu-copy"].bottom <= layout[".menu-footer"].top + 1, JSON.stringify(layout));
      for (const action of ["continue", "start", "quit"]) {
        const button = page.locator(`[data-action="${action}"]`);
        await button.scrollIntoViewIfNeeded();
        const box = await button.boundingBox();
        assert.ok(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${action}: ${JSON.stringify(box)}`);
        assert.ok(await button.evaluate((node) => {
          const r = node.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("button") === node;
        }), `${action} is covered`);
      }
      await capture(`continue-title-${viewport.width}`);
      result.push({ viewport, layout });
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    return result;
  });
  await check("reloading and continuing restores a paused life with exact health, growth, position, RNG, offers and inactive foods", async () => {
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => window.__JD.game), null);
    await page.locator('[data-action="continue"]').click();
    await page.waitForFunction(() => window.__JD.ui.view === "pause" && window.__JD.game);
    assert.deepEqual(await state(), saved);
    await frames(5);
    assert.deepEqual(await state(), saved, "restored life must wait for explicit resume");
    assert.match(await page.locator("#pause-save-status").textContent(), /RESTORED/);
    await capture("restored-pause");
  });
  await check("a checkpoint inside evolution restores its choices and choosing a form resumes the actual world clock", async () => {
    await page.locator('[data-action="resume"]').click();
    await page.keyboard.press("KeyT");
    await page.waitForFunction(() => window.__JD.ui.view === "evolution");
    const offers = await page.evaluate(() => ({ species: [...window.__JD.game.evolutionChoices], mutations: [...window.__JD.game.mutationChoices], time: window.__JD.game.time }));
    await page.reload(); await ready();
    await page.locator('[data-action="continue"]').click();
    await page.waitForFunction(() => window.__JD.ui.view === "evolution");
    assert.deepEqual(await page.evaluate(() => [...window.__JD.game.evolutionChoices]), offers.species);
    assert.deepEqual(await page.evaluate(() => [...window.__JD.game.mutationChoices]), offers.mutations);
    await page.locator(`[data-species="${offers.species[0]}"]`).click();
    await page.locator(`[data-mutation="${offers.mutations[0]}"]`).click();
    await page.locator('[data-action="evolve"]').click();
    await page.waitForFunction((time) => window.__JD.ui.view === "hud" && window.__JD.game.state === "playing" && window.__JD.game.time > time + .15, offers.time);
    assert.equal(await page.evaluate(() => window.__JD.game.tier), 1);
    await page.keyboard.press("Escape");
    await page.locator('[data-action="resume"]').waitFor();
  });
  await check("a failed checkpoint keeps the live expedition open and throttles automatic retries", async () => {
    await settingsFromPause();
    await page.locator("#setting-quality").selectOption("low");
    await page.locator('[data-action="back"]').last().click();
    const id = await page.evaluate(() => window.__JD.game.runId);
    await page.evaluate(() => {
      window.__qaStorageWrite = Storage.prototype.setItem;
      window.__qaWriteFailures = 0;
      Storage.prototype.setItem = function (key, value) {
        if (String(key).startsWith("jurassic-domination.")) {
          window.__qaWriteFailures++;
          throw new DOMException("Foundation QA quota failure", "QuotaExceededError");
        }
        return window.__qaStorageWrite.call(this, key, value);
      };
    });
    try {
      await page.locator('[data-action="menu"]').click();
      await frames(3);
      assert.equal(await page.evaluate(() => window.__JD.ui.view), "pause");
      assert.equal(await page.evaluate(() => window.__JD.game.runId), id);
      assert.match(await page.locator("#pause-save-status").textContent(), /FAILED/i);
      await capture("save-failure-keeps-life");
      await page.locator('[data-action="resume"]').click();
      // Let the actual application clock reach its automatic checkpoint, then
      // verify a failing storage device is not retried on every animation frame.
      await page.waitForFunction(() => window.__qaWriteFailures >= 2);
      const before = await page.evaluate(() => ({ failures: window.__qaWriteFailures, time: window.__JD.game.time }));
      await page.waitForFunction((t) => window.__JD.game.time >= t + 2, before.time);
      const after = await page.evaluate(() => window.__qaWriteFailures);
      assert.ok(after - before.failures <= 1, `checkpoint writes flooded: ${before.failures} -> ${after} in two seconds`);
      return { initialFailures: before.failures, failuresAfterTwoSeconds: after };
    } finally {
      await page.evaluate(() => { Storage.prototype.setItem = window.__qaStorageWrite; });
      if (await page.evaluate(() => window.__JD.ui.view) === "hud") await page.keyboard.press("Escape");
    }
  });
  await check("backup download contains the current life and invalid preview leaves storage unchanged", async () => {
    await settingsFromPause(); await openBackups();
    const pending = page.waitForEvent("download");
    await page.locator('[data-action="export-backup"]').click();
    const download = await pending;
    predeathBackup = await readFile(await download.path(), "utf8");
    const backup = JSON.parse(predeathBackup);
    assert.equal(backup.format, "jurassic-domination.backup");
    assert.equal(backup.data.run.runId, saved.runId);
    const storage = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort()));
    await page.locator("#backup-text").fill('{"format":"broken"}');
    await page.locator('[data-action="preview-backup"]').click();
    assert.equal(await page.locator("#backup-preview").isVisible(), false);
    assert.match(await page.locator("#backup-message").textContent(), /invalid|damaged|incompatible|incomplete/i);
    assert.equal(await page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())), storage);
    await capture("backup-preview");
    return { filename: download.suggestedFilename(), bytes: predeathBackup.length };
  });
  await check("keyboard remapping, 125 percent UI size and reduced motion apply and save through the settings screen", async () => {
    await page.locator('[data-action="back"]').last().click();
    await page.locator("#setting-ui-scale").selectOption("1.25");
    await page.locator("#setting-reduced-motion").check();
    await page.locator('[data-action="controls"]').click();
    await page.locator('[data-binding="attack"]').click();
    await page.keyboard.press("KeyZ");
    assert.equal(await page.locator('[data-binding="attack"] kbd').textContent(), "Z");
    assert.equal(await page.evaluate(() => window.__JD.settings.controls.attack), "KeyZ");
    assert.equal(await page.evaluate(() => document.body.classList.contains("reduced-motion")), true);
    assert.equal(await page.evaluate(() => window.__JD.world.settings.shake), false);
    await page.locator('[data-action="back"]').last().click();
    await page.locator('[data-action="back"]').last().click();
    await page.locator('[data-action="resume"]').click();
    await page.evaluate(() => {
      const g = window.__JD.game; g.player.x = 0; g.player.y = 0; g.player.vx = 0; g.player.vy = 0;
      g.entities = []; g.player.attackCooldown = 0; g.player.attacking = 0;
    });
    await page.keyboard.down("Space"); await frames(4); await page.keyboard.up("Space");
    assert.equal(await page.evaluate(() => window.__JD.game.player.attackCooldown), 0);
    await page.keyboard.down("KeyZ");
    await page.waitForFunction(() => window.__JD.game.player.attackCooldown > 0);
    await page.keyboard.up("KeyZ");
    assert.equal(await page.locator("#attack-ready").locator("..").locator("kbd").textContent(), "Z");
    await page.keyboard.press("Escape"); await page.reload(); await ready();
    assert.equal(await page.evaluate(() => window.__JD.settings.controls.attack), "KeyZ");
    assert.equal(await page.evaluate(() => window.__JD.settings.uiScale), 1.25);
    assert.equal(await page.evaluate(() => window.__JD.settings.reducedMotion), true);
    await page.locator('[data-action="continue"]').click();
    await page.locator('[data-action="resume"]').waitFor();
  });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 800, height: 600 }]) {
    await check(`125 percent full HUD and controls remain accessible at ${viewport.width}x${viewport.height}`, async () => {
      await page.setViewportSize(viewport);
      if (await page.evaluate(() => window.__JD.ui.view) === "pause") await page.locator('[data-action="resume"]').click();
      await page.evaluate(() => {
        const g = window.__JD.game; g.player.speciesId = "elder-dragon"; g.tier = 7;
        g.player.growth = 0; g.player.formScale = 1; g.player.nutrients = 0; g.refreshStats(true);
        g.player.xp = g.nextThreshold; g.evolutionReady = true; g.evolutionChoices = []; g.mutationChoices = [];
        window.__JD.ui.updateHUD(g);
      });
      await frames(4);
      const layout = await page.evaluate(() => {
        const nodes = [".vitals", ".abilities", ".evolution-progress"].map((selector) => {
          const r = document.querySelector(selector).getBoundingClientRect(); return { selector, x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        });
        const overlaps = [];
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          if (Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1) overlaps.push([a.selector, b.selector]);
        }
        return { nodes, overlaps, width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth };
      });
      await capture(`hud125-${viewport.width}`);
      assert.ok(layout.nodes.every((n) => n.x >= -1 && n.y >= -1 && n.right <= viewport.width + 1 && n.bottom <= viewport.height + 1), JSON.stringify(layout));
      assert.deepEqual(layout.overlaps, [], JSON.stringify(layout));
      await settingsFromPause();
      await page.locator('[data-action="controls"]').click();
      const last = page.locator('[data-binding="skill5"]'); await last.scrollIntoViewIfNeeded();
      const box = await last.boundingBox(); assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width + 1);
      assert.ok(await last.isVisible());
      await capture(`controls125-${viewport.width}`);
      await page.locator('[data-action="back"]').last().click();
      await page.locator('[data-action="back"]').last().click();
      return layout;
    });
  }
  await check("standard controller mock drives real movement, bite and pause edges without repeated toggles", async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (await page.evaluate(() => window.__JD.ui.view) === "pause") await page.locator('[data-action="resume"]').click();
    await page.bringToFront();
    await page.evaluate(() => {
      window.__qaPad = { connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [window.__qaPad] });
      window.__JD.game.player.x = 0; window.__JD.game.player.y = 0; window.__JD.game.player.vx = 0; window.__JD.game.player.vy = 0;
      window.__qaPad.axes[0] = 1;
    });
    await page.waitForFunction(() => window.__JD.game.player.x > .5);
    await page.evaluate(() => { window.__qaPad.axes[0] = 0; window.__JD.game.player.attackCooldown = 0; window.__qaPad.buttons[7].pressed = true; });
    await page.waitForFunction(() => window.__JD.game.player.attackCooldown > 0);
    await page.evaluate(() => { window.__qaPad.buttons[7].pressed = false; window.__qaPad.buttons[9].pressed = true; });
    await page.waitForFunction(() => window.__JD.ui.view === "pause");
    const time = await page.evaluate(() => window.__JD.game.time);
    await frames(5);
    assert.equal(await page.evaluate(() => window.__JD.ui.view), "pause");
    assert.equal(await page.evaluate(() => window.__JD.game.time), time);
    await page.evaluate(() => { window.__qaPad.buttons[9].pressed = false; }); await frames(2);
    await page.evaluate(() => { window.__qaPad.buttons[9].pressed = true; });
    await page.waitForFunction(() => window.__JD.ui.view === "hud");
    await page.evaluate(() => { window.__qaPad.buttons[9].pressed = false; });
  });
  await check("death removes Continue and records a durable terminal run", async () => {
    deadRunId = await page.evaluate(() => {
      const g = window.__JD.game; g.damagePlayer(g.player.maxHp * 100, "Foundation QA permadeath", true); return g.runId;
    });
    await page.waitForFunction(() => window.__JD.ui.view === "death");
    assert.ok(await page.evaluate((id) => window.__JD.profile.completedRuns.includes(id), deadRunId));
    await page.locator('[data-action="menu"]').click();
    assert.equal(await page.locator('[data-action="continue"]').count(), 0);
    assert.equal(await page.evaluate(() => window.__JD.saves.data.run), null);
    await capture("permadeath-title");
  });
  await check("importing a real pre-death backup cannot resurrect its recorded dead life", async () => {
    await page.locator('[data-action="settings"]').click(); await openBackups();
    await page.locator("#backup-file").setInputFiles({ name: "foundation-predeath-backup.json", mimeType: "application/json", buffer: Buffer.from(predeathBackup) });
    await page.waitForFunction((text) => document.getElementById("backup-text").value === text, predeathBackup);
    await page.locator('[data-action="preview-backup"]').click();
    await page.locator("#restore-backup").waitFor();
    assert.match(await page.locator("#backup-preview").textContent(), /no living expedition/i);
    await page.locator("#restore-backup").click();
    await page.waitForFunction(() => window.__JD.ui.view === "menu");
    assert.equal(await page.locator('[data-action="continue"]').count(), 0);
    await page.reload(); await ready();
    assert.equal(await page.locator('[data-action="continue"]').count(), 0);
    assert.ok(await page.evaluate((id) => window.__JD.profile.completedRuns.includes(id), deadRunId));
  });
  await check("foundation UI reports no browser exceptions or console errors", async () => assert.deepEqual(report.errors, []));
} catch (error) { report.failures.push({ name: "test setup or navigation", message: error.stack }); }
finally {
  await writeFile("artifacts/foundation-qa.json", JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(`${report.checks.length} foundation checks passed; ${report.failures.length} failed.`);
assert.deepEqual(report.failures, [], JSON.stringify(report.failures));
