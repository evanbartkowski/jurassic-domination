import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { Game } from "../src/game.js";
import { fieldJournalHTML } from "../src/field-journal.js";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const g = new Game({ seed: 308, runId: "field-journal-qa" });
const css = await fs.readFile(new URL("../src/immersion.css", import.meta.url), "utf8");
const profile = { ancestry: { generations: 2, longestLife: 200, guardianVictories: 1, recent: [
  { runId: "previous-life", generation: 1, speciesId: "compsognathus", tier: 0, time: 200, kills: 3, guardians: 1 },
] } };
const html = fieldJournalHTML(g, profile);
const results = [];
try {
  for (const [width, scale] of [[1280, 1], [600, 1], [360, 1], [320, 1.25]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route("**/assets/**", async (route) => {
      const resource = new URL(route.request().url()).pathname;
      if (!/^\/assets\/portraits\/species-[a-z0-9-]+\.webp$/.test(resource)) return route.abort();
      await route.fulfill({ contentType: "image/webp", body: await fs.readFile(new URL(`../public${resource}`, import.meta.url)) });
    });
    await page.setContent(`<html><head><base href="http://journal.local/"><style>html{background:#12231a;font-family:Arial,sans-serif}body{margin:0;padding:16px;zoom:${scale}}.wide-panel{padding:18px;max-width:1120px;margin:auto;background:#14251c;box-sizing:border-box}${css}</style></head><body><main class="wide-panel">${html}</main></body></html>`);
    await page.locator(".field-hero h2").waitFor();
    const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    if (size.scroll > size.client + 1) throw new Error(`Journal overflow at ${width}px/${scale}: ${JSON.stringify(size)}`);
    const progress = await page.locator("progress").count();
    if (progress !== 5) throw new Error(`Expected five meaningful progress meters, got ${progress}`);
    await page.waitForFunction(() => document.querySelector(".field-portrait img").naturalWidth > 0);
    await page.locator(".field-ancestry summary").focus();
    await page.keyboard.press("Enter");
    if (!await page.locator(".field-ancestry").evaluate((node) => node.open)) throw new Error("Ancestry disclosure keyboard control failed");
    if (width === 1280) {
      await fs.mkdir("artifacts", { recursive: true });
      await page.screenshot({ path: "artifacts/field-journal-desktop.png", fullPage: true });
    }
    results.push({ width, scale, horizontalOverflow: false, progressMeters: progress, keyboardDisclosure: true });
    await page.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
