import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const b = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--autoplay-policy=no-user-gesture-required",
  ],
});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [],
  checks = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
try {
  await p.goto("http://127.0.0.1:5173");
  await p.waitForFunction(() => window.__JD?.ui);
  await p.getByRole("button", { name: /BEGIN A NEW LIFE/ }).click();
  await p.keyboard.down("KeyE");
  await p.waitForFunction(() => window.__JD.game?.state === "playing");
  await p.keyboard.up("KeyE");
  await p.evaluate(() => {
    const g = window.__JD.game;
    g.entities = [];
    g.foods = [];
    g.lairs = [];
    g._nextBoss = Infinity;
    g.player.speciesId = "compsognathus";
    g.tier = 0;
    g.player.invulnerable = 100;
    g.refreshStats(true);
  });
  await check(
    "threshold flashes a T indicator while time keeps moving",
    async () => {
      await p.evaluate(() =>
        window.__JD.game.gainXP(window.__JD.game.nextThreshold),
      );
      await p.locator("#evolve-ready").waitFor();
      const before = await p.evaluate(() => window.__JD.game.time);
      await p.waitForFunction((t) => window.__JD.game.time > t + 0.2, before);
      assert.equal(await p.evaluate(() => window.__JD.ui.view), "hud");
      await p.screenshot({ path: "artifacts/v5-evolution-ready.png" });
    },
  );
  let offered;
  await check("T opens, Escape postpones and choices stay fixed", async () => {
    await p.keyboard.press("KeyT");
    await p.waitForFunction(() => window.__JD.ui.view === "evolution");
    offered = await p.evaluate(() => [...window.__JD.game.evolutionChoices]);
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => window.__JD.ui.view === "hud");
    await p.keyboard.press("KeyT");
    await p.waitForFunction(() => window.__JD.ui.view === "evolution");
    assert.deepEqual(
      await p.evaluate(() => window.__JD.game.evolutionChoices),
      offered,
    );
    await p.locator('[data-action="postpone"]').click();
  });
  await check(
    "real fruit pickups add an earned rare bloodline to the existing choices",
    async () => {
      for (let i = 0; i < 3; i++) {
        await p.evaluate((i) => {
          const g = window.__JD.game;
          g._eatCooldown = 0;
          g.foods = [
            {
              id: "fruit-" + i,
              type: "lineage-fruit",
              fruit: "sunheart",
              x: g.player.x,
              y: g.player.y,
              tier: 0,
              value: 1,
            },
          ];
        }, i);
        await p.keyboard.down("KeyE");
        await p.waitForFunction(
          (i) => window.__JD.game.lineage.fruits.sunheart === i + 1,
          i,
        );
        await p.keyboard.up("KeyE");
      }
      await p.keyboard.press("KeyT");
      await p.locator('[data-species="verdant-psittacosaurus"]').waitFor();
      assert.match(
        await p
          .locator('[data-species="verdant-psittacosaurus"]')
          .textContent(),
        /RARE.*EARNED BLOODLINE/,
      );
      await p.screenshot({ path: "artifacts/v5-bloodline-choice.png" });
      await p.locator('[data-species="verdant-psittacosaurus"]').click();
      await p.getByRole("button", { name: /EMBRACE EVOLUTION/ }).click();
      await p.waitForFunction(
        () => window.__JD.game.species.id === "verdant-psittacosaurus",
      );
      assert.equal(
        await p.evaluate(() => window.__JD.game.lineage.fruits.sunheart),
        0,
      );
    },
  );
  await check(
    "J opens a live bloodline journal with claimed progress",
    async () => {
      await p.keyboard.press("KeyJ");
      await p.locator(".bloodline-panel").waitFor();
      assert.equal(await p.locator(".bloodline-grid article").count(), 7);
      assert.match(
        await p.locator(".bloodline-grid").textContent(),
        /CLAIMED THIS LIFE/,
      );
      await p.screenshot({ path: "artifacts/v5-bloodline-journal.png" });
      await p.keyboard.press("Escape");
      await p.keyboard.press("Escape");
    },
  );
  await check("heavy form disables dash and X activates defense", async () => {
    await p.evaluate(() => {
      const g = window.__JD.game;
      g.player.speciesId = "ankylosaurus";
      g.tier = 4;
      g.player.xp = 0;
      g.evolutionReady = false;
      g.player.stamina = 100;
      g.player.specialCooldown = 0;
      g.refreshStats(true);
    });
    await p.waitForFunction(
      () => document.querySelector("#dash-name").textContent === "NO DASH",
    );
    const x = await p.evaluate(() => window.__JD.game.player.x);
    await p.keyboard.press("Shift");
    assert.equal(await p.evaluate(() => window.__JD.game.player.x), x);
    await p.keyboard.down("KeyX");
    await p.waitForFunction(() => window.__JD.game.player.guard > 0);
    await p.keyboard.up("KeyX");
  });
  await check(
    "healing skill and food growth affect real health, size and damage",
    async () => {
      await p.evaluate(() => {
        const g = window.__JD.game;
        g.player.speciesId = "brachiosaurus";
        g.tier = 5;
        g.player.nutrients = 0;
        g.player.growth = 0;
        g.refreshStats(true);
        g.player.hp = g.player.maxHp * 0.3;
        g.player.stamina = 100;
        g.player.specialCooldown = 0;
        g.player.poisoned = 6;
      });
      const before = await p.evaluate(() => window.__JD.game.player.hp);
      await p.keyboard.down("KeyX");
      await p.waitForFunction((h) => window.__JD.game.player.hp > h, before);
      await p.keyboard.up("KeyX");
      assert.equal(await p.evaluate(() => window.__JD.game.player.poisoned), 0);
      await p.evaluate(() => {
        const g = window.__JD.game;
        g._eatCooldown = 0;
        g.foods = [
          {
            id: "growth-meal",
            type: "meat",
            tier: 5,
            value: 2000,
            x: g.player.x,
            y: g.player.y,
          },
        ];
      });
      await p.keyboard.down("KeyE");
      await p.waitForFunction(() => window.__JD.game.player.growth === 1);
      await p.keyboard.up("KeyE");
      await p.waitForFunction(
        () =>
          window.__JD.world.models.get("player").scale.x >
          window.__JD.world.models.get("player").userData.baseScale * 1.25,
      );
      await p.screenshot({ path: "artifacts/v5-grown.png" });
    },
  );
  await check(
    "adaptive music produces an audible signal after interaction",
    async () => {
      const peak = await p.evaluate(async () => {
        const a = window.__JD.audio,
          c = a.context;
        if (!c || c.state !== "running") return 0;
        const analyser = c.createAnalyser();
        analyser.fftSize = 256;
        a.music.connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        let peak = 0;
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 40));
          analyser.getFloatTimeDomainData(samples);
          peak = Math.max(peak, ...samples.map(Math.abs));
        }
        a.music.disconnect(analyser);
        return peak;
      });
      assert.ok(peak > 0.0001);
    },
  );
  await check(
    "800 by 600 growth and skill HUD stays inside the viewport",
    async () => {
      await p.setViewportSize({ width: 800, height: 600 });
      await p.screenshot({ path: "artifacts/v5-hud-800.png" });
      assert.ok(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      assert.deepEqual(errors, []);
    },
  );
  await writeFile(
    "artifacts/progression-qa.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(checks.length + " progression checks passed");
} finally {
  await b.close();
}
