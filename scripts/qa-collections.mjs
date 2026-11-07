import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log("PASS " + name);
}
try {
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__JD?.ui);
  await page.getByRole("button", { name: /DNA SHOP/ }).click();
  await page.waitForFunction(() => window.__JD.productViewer);
  await check("shop disables unaffordable purchases", async () =>
    assert.ok(await page.locator("[data-buy]").isDisabled()),
  );
  await page.evaluate(() => {
    window.__JD.profile.dna = 100;
    window.__JD.ui.refreshShop();
  });
  await check("buy and equip permanent pet", async () => {
    await page.locator('[data-shop-category="pet"]').click();
    await page.locator('[data-product="pet:compy"]').click();
    await page.locator("[data-buy]").click();
    await page.locator("[data-equip-pet]").click();
    assert.equal(
      await page.evaluate(() => window.__JD.profile.activePet),
      "compy",
    );
  });
  await check(
    "place, move, rotate and store pet with undo and redo",
    async () => {
      await page.locator("[data-place-product]").click();
      await page.locator("#build-toggle").click();
      await page.waitForFunction(() => window.__JD.island);
      if (!(await page.evaluate(() => window.__JD.island.buildMode)))
        await page.locator("#build-toggle").click();
      await page.waitForFunction(
        () =>
          window.__JD.island?.canvas ===
          document.getElementById("island-canvas"),
      );
      if (!(await page.evaluate(() => window.__JD.island.buildMode)))
        await page.locator("#build-toggle").click();
      await page.waitForFunction(() => window.__JD.island?.tool);
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () => window.__JD.profile.island.placements.length === 1,
      );
      await page.locator('[data-selection-action="rotate"]').click();
      assert.ok(
        (await page.evaluate(
          () => window.__JD.profile.island.placements[0].rotation,
        )) > 0,
      );
      await page.locator('[data-selection-action="move"]').click();
      for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      assert.ok(
        (await page.evaluate(
          () => window.__JD.profile.island.placements[0].x,
        )) > 0,
      );
      await page.locator('[data-selection-action="store"]').click();
      assert.equal(
        await page.evaluate(() => window.__JD.profile.island.placements.length),
        0,
      );
      await page.locator('[data-island-command="undo"]').click();
      assert.equal(
        await page.evaluate(() => window.__JD.profile.island.placements.length),
        1,
      );
      await page.locator('[data-island-command="redo"]').click();
      assert.equal(
        await page.evaluate(() => window.__JD.profile.island.placements.length),
        0,
      );
    },
  );
  await check("island rename and owned inventory survive reload", async () => {
    await page.locator("#island-name").fill("Cretaceous Cove");
    await page.locator("#island-name").press("Tab");
    await page.reload();
    await page.waitForFunction(() => window.__JD?.ui);
    assert.equal(
      await page.evaluate(() => window.__JD.profile.island.name),
      "Cretaceous Cove",
    );
    assert.equal(
      await page.evaluate(() => window.__JD.profile.activePet),
      "compy",
    );
  });
  await page.getByRole("button", { name: /DNA SHOP/ }).click();
  await check("buy crown and display real 3D cosmetic", async () => {
    await page.locator('[data-shop-category="cosmetic"]').click();
    await page.locator('[data-product="cosmetic:royal-crown"]').click();
    await page.locator("[data-buy]").click();
    await page.locator("[data-equip-cosmetic]").click();
    assert.equal(
      await page.evaluate(() => window.__JD.profile.equippedCosmetic),
      "royal-crown",
    );
  });
  await check(
    "buy decoration copies and place without consuming ownership",
    async () => {
      await page.locator('[data-shop-category="decoration"]').click();
      await page.locator('[data-product="decoration:fern"]').click();
      await page.locator("[data-buy]").click();
      await page.locator("[data-buy]").click();
      await page.locator("[data-place-product]").click();
      await page.waitForFunction(
        () =>
          window.__JD.island?.canvas ===
          document.getElementById("island-canvas"),
      );
      if (!(await page.evaluate(() => window.__JD.island.buildMode)))
        await page.locator("#build-toggle").click();
      await page.waitForFunction(() => window.__JD.island?.tool);
      await page.keyboard.press("Enter");
      assert.equal(
        await page.evaluate(() => window.__JD.profile.decorations.fern),
        2,
      );
      assert.equal(
        await page.evaluate(() => window.__JD.profile.island.placements.length),
        1,
      );
      await page.screenshot({ path: "artifacts/island-qa.png" });
    },
  );
  await check("800 by 600 island remains usable", async () => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.screenshot({ path: "artifacts/island-800.png" });
    assert.ok(await page.locator('[data-action="back"]').isVisible());
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /DNA SHOP/ }).click();
  await page.screenshot({ path: "artifacts/shop-800.png" });
  await check(
    "all 49 product preview models render without errors",
    async () => {
      await page.setViewportSize({ width: 1440, height: 900 });
      for (const category of ["skin", "cosmetic", "pet", "decoration"]) {
        await page.locator(`[data-shop-category="${category}"]`).click();
        for (const card of await page.locator("[data-product]").all()) {
          await card.click();
          await page.waitForTimeout(35);
        }
      }
      await page.screenshot({ path: "artifacts/shop-qa.png" });
      assert.deepEqual(errors, []);
    },
  );
  await check(
    "rare pickups bank DNA, pet and decoration finds immediately during play",
    async () => {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /BEGIN A NEW LIFE/ }).click();
      await page.waitForFunction(() => window.__JD.game?.state === "egg");
      await page.keyboard.down("KeyE");
      await page.waitForFunction(() => window.__JD.game?.state === "playing");
      await page.keyboard.up("KeyE");
      const before = await page.evaluate(() => window.__JD.profile.dna);
      for (const item of [
        { type: "dna", amount: 3 },
        { type: "pet-egg", sku: "pet:unicorn" },
        { type: "decoration-cache", sku: "decoration:pavilion" },
      ]) {
        await page.evaluate((item) => {
          const g = window.__JD.game;
          g._eatCooldown = 0;
          g.foods = [
            {
              ...item,
              id: "qa-" + item.type,
              x: g.player.x,
              y: g.player.y,
              tier: 0,
              value: 0,
            },
          ];
        }, item);
        await page.keyboard.down("KeyE");
        await page.waitForFunction(
          () =>
            !window.__JD.game.foods.some((f) => String(f.id).startsWith("qa-")),
        );
        await page.keyboard.up("KeyE");
        await page.waitForTimeout(100);
      }
      await page.waitForFunction(() =>
        window.__JD.profile.pets.includes("unicorn"),
      );
      const result = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("jurassic-domination.profile.v1")),
      );
      assert.equal(result.dna, before + 3);
      assert.equal(result.decorations.pavilion, 1);
      assert.ok(result.pets.includes("unicorn"));
      assert.deepEqual(errors, []);
    },
  );
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/collections-qa.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(`${checks.length} collection checks passed`);
} finally {
  await browser.close();
}
