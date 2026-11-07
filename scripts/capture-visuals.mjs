import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const targetDir = process.argv[2] || "artifacts/current";
await mkdir(targetDir, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.error("Page error:", e));
page.on("response", (res) => { if (res.status() >= 400) console.log("HTTP error:", res.status(), res.url()); });
page.on("console", (m) => console.log("Console:", m.text()));
page.setDefaultTimeout(15000);

try {
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__JD?.ui?.view === "menu");
  await page.waitForTimeout(600);

  // 1. Title Screen
  await page.screenshot({ path: `${targetDir}/01-title.png` });
  console.log("Captured 01-title.png");

  // 2. Encyclopedia
  await page.getByRole("button", { name: /ENCYCLOPEDIA/ }).click();
  await page.waitForFunction(() => window.__JD.specimen);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${targetDir}/02-encyclopedia.png` });
  console.log("Captured 02-encyclopedia.png");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__JD.ui.view === "menu");

  // 3. Egg & Gameplay
  await page.getByRole("button", { name: /BEGIN A NEW LIFE/ }).click();
  await page.waitForFunction(() => window.__JD.game?.state === "egg");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${targetDir}/03-egg.png` });
  console.log("Captured 03-egg.png");

  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => window.__JD.game.state === "playing");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${targetDir}/04-gameplay.png` });
  console.log("Captured 04-gameplay.png");

  // 4. Evolution Screen
  await page.evaluate(() => window.__JD.game.gainXP(window.__JD.game.nextThreshold));
  await page.waitForFunction(() => window.__JD.game.evolutionReady);
  await page.keyboard.press("KeyT");
  await page.waitForFunction(() => window.__JD.ui.view === "evolution");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${targetDir}/05-evolution.png` });
  console.log("Captured 05-evolution.png");

  // 5. Evolved Gameplay (Velociraptor)
  await page.locator("[data-species]").first().click();
  await page.locator("[data-mutation]").first().click();
  await page.getByRole("button", { name: /^EMBRACE EVOLUTION/ }).click();
  await page.waitForFunction(() => window.__JD.game.tier === 1 && window.__JD.ui.view === "hud");
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${targetDir}/06-evolved-gameplay.png` });
  console.log("Captured 06-evolved-gameplay.png");

  // 6. Pause Screen
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__JD.ui.view === "pause");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${targetDir}/07-pause.png` });
  console.log("Captured 07-pause.png");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__JD.ui.view === "hud");

  // 7. Death Screen
  await page.evaluate(() => {
    window.__JD.game.damagePlayer(99999, "QA predator", true);
  });
  await page.waitForFunction(() => window.__JD.ui.view === "death");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${targetDir}/08-death.png` });
  console.log("Captured 08-death.png");

} catch (err) {
  console.error("Capture error:", err);
} finally {
  await browser.close();
}
