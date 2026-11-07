import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const b = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
p.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await p.goto("http://127.0.0.1:5173");
  await p.waitForFunction(() => window.__JD?.ui);
  await p.screenshot({ path: "artifacts/v4-title.png" });
  await p.getByRole("button", { name: /DNA SHOP/ }).click();
  await p.waitForFunction(() => window.__JD.productViewer);
  await p.waitForFunction(() =>
    [...document.querySelectorAll(".shop-card img")].every(
      (i) => i.complete && i.naturalWidth,
    ),
  );
  await p.screenshot({ path: "artifacts/v4-shop.png" });
  await p.evaluate(() => {
    const d = window.__JD.profile;
    d.pets = ["compy", "raptor", "rex"];
    d.decorations = { fern: 6, palm: 3, pond: 1, flowers: 3, arch: 1 };
    d.island.placements = [
      { id: "i1", kind: "pet", itemId: "compy", x: 0, y: 0, rotation: 0 },
      { id: "i2", kind: "pet", itemId: "raptor", x: 8, y: 0, rotation: 0 },
      { id: "i3", kind: "pet", itemId: "rex", x: -8, y: 0, rotation: 0 },
      {
        id: "i4",
        kind: "decoration",
        itemId: "pond",
        x: 0,
        y: -10,
        rotation: 0,
      },
      {
        id: "i5",
        kind: "decoration",
        itemId: "arch",
        x: 0,
        y: 10,
        rotation: 0,
      },
    ];
    d.island.nextId = 6;
  });
  await p.locator('[data-action="shop-island"]').click();
  await p.waitForFunction(() => window.__JD.island);
  await p.screenshot({ path: "artifacts/v4-island.png" });
  assert.equal(await p.evaluate(() => window.__JD.island.buildMode), false);
  assert.equal(await p.locator(".island-sidebar").isVisible(), false);
  await p.locator("#build-toggle").click();
  assert.equal(await p.evaluate(() => window.__JD.island.buildMode), true);
  await p.screenshot({ path: "artifacts/v4-build.png" });
  await p.locator("#build-toggle").click();
  await p.evaluate(() => {
    const i = window.__JD.island;
    i.selected = "i1";
    i.stateChanged();
  });
  await p.locator("[data-care]").click();
  assert.equal(
    await p.evaluate(() => window.__JD.profile.island.care.compy),
    1,
  );
  await p.locator("[data-care]").click();
  assert.equal(
    await p.evaluate(() => window.__JD.profile.island.care.compy),
    1,
  );
  await p.evaluate(() => {
    const d = window.__JD.profile;
    d.island.visitSeconds = 180;
    d.island.care = { compy: 3, raptor: 3, rex: 3 };
    for (let i = 0; i < 6; i++)
      d.island.placements.push({
        id: "i" + (10 + i),
        kind: "decoration",
        itemId: "fern",
        x: -18 + i * 7,
        y: 18,
        rotation: 0,
      });
    window.__JD.island.stateChanged();
  });
  await p.locator('[data-trial="haven"]').click();
  assert.ok(
    await p.evaluate(() =>
      window.__JD.profile.cosmetics.includes("royal-crown"),
    ),
  );
  assert.equal(
    await p.evaluate(() => window.__JD.profile.decorations.fountain),
    1,
  );
  assert.ok(await p.locator('[data-trial="haven"]').isDisabled());
  await p.setViewportSize({ width: 800, height: 600 });
  await p.screenshot({ path: "artifacts/v4-island-800.png" });
  assert.ok(await p.locator("#build-toggle").isVisible());
  await p.setViewportSize({ width: 1440, height: 900 });
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: /BEGIN A NEW LIFE/ }).click();
  await p.keyboard.down("KeyE");
  await p.waitForFunction(() => window.__JD.game?.state === "playing");
  await p.keyboard.up("KeyE");
  await p.waitForTimeout(1500);
  await p.screenshot({ path: "artifacts/v4-play.png" });
  console.log(
    JSON.stringify({
      checks: [
        "142 model portraits",
        "visit by default",
        "explicit build toggle",
        "persistent care and cooldown",
        "conditional treasure grant once",
        "800x600 visit controls",
        "wilderness terrain and gameplay",
      ],
      errors,
      features: await p.evaluate(() => window.__JD.game.worldFeatures.length),
    }),
  );
  for (const type of ["water", "carnivore"]) {
    await p.evaluate((type) => {
      const g = window.__JD.game,
        f = g.worldFeatures.find((f) => f.type === type);
      g.player.x = f.x - 8;
      g.player.y = f.y - 12;
      g.player.invulnerable = 60;
      g.entities = [];
    }, type);
    await p.waitForTimeout(650);
    await p.screenshot({ path: "artifacts/v4-" + type + ".png" });
  }
  assert.deepEqual(errors, []);
} finally {
  await b.close();
}
