import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";

const exe = path.resolve(
  process.env.JD_PORTABLE_EXE ||
    "release/Jurassic Domination-0.3.0-portable.exe",
);
const profile = await mkdtemp(path.join(os.tmpdir(), "jurassic-portable-qa-"));
const env = { ...process.env, JD_TEST_USER_DATA: profile };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  exe,
  [
    `--user-data-dir=${profile}`,
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
  { env, stdio: "ignore", windowsHide: true },
);
let browser,
  page,
  exitCode = null,
  launchError = null;
child.on("error", (e) => (launchError = e));
child.on("exit", (code) => (exitCode = code));
const errors = [],
  external = [],
  checks = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log(`PASS ${name}`);
}
try {
  let port;
  const deadline = Date.now() + 55000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    try {
      port = (
        await readFile(path.join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      if (port) break;
    } catch {}
    await sleep(250);
  }
  if (!port)
    throw Error(
      "Portable child did not expose its isolated debugging endpoint.",
    );
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  page = context.pages()[0] || (await context.waitForEvent("page"));
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    if (/^https?:/i.test(r.url())) external.push(r.url());
  });
  await page.bringToFront();
  await check(
    "portable extracts into a functioning isolated offline desktop",
    async () => {
      await page.getByRole("button", { name: /BEGIN A NEW LIFE/ }).waitFor();
      const state = await page.evaluate(() => ({
        protocol: location.protocol,
        bridge: typeof window.desktop?.quit,
        node: typeof window.require,
        debug: typeof window.__JD,
      }));
      assert.deepEqual(state, {
        protocol: "file:",
        bridge: "function",
        node: "undefined",
        debug: "undefined",
      });
      assert.equal(await page.locator("#graphics-error").count(), 0);
    },
  );
  await check(
    "portable hatch and Q/R/dodge controls execute real abilities",
    async () => {
      await page.getByRole("button", { name: /BEGIN A NEW LIFE/ }).click();
      await page.locator("#hatch-button").waitFor();
      await page.keyboard.press("KeyE");
      await page.locator("#egg-prompt").waitFor({ state: "hidden" });
      for (const [code, id] of [
        ["KeyQ", "hud-ability-cooldown"],
        ["KeyR", "hud-technique-cooldown"],
        ["Shift", "hud-dash-cooldown"],
      ]) {
        await page.keyboard.press(code);
        await page.waitForFunction(
          (id) => /\d/.test(document.getElementById(id).textContent),
          id,
        );
      }
      await mkdir("artifacts", { recursive: true });
      await page.screenshot({ path: "artifacts/portable.png" });
    },
  );
  await check(
    "portable encyclopedia renders a live specimen from the pause menu",
    async () => {
      await page.keyboard.press("Escape");
      await page.locator('#overlay [data-action="guide"]').click();
      await page.locator("#guide-search").fill("world serpent");
      await page.locator('[data-inspect="world-serpent"]').click();
      await page.waitForFunction(
        () => document.getElementById("specimen-canvas").width > 10,
      );
      await page.screenshot({ path: "artifacts/portable-encyclopedia.png" });
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /RESUME THE HUNT/ }).waitFor();
    },
  );
  await check(
    "portable settings, fullscreen bridge, and offline resources work",
    async () => {
      await page.locator('#overlay [data-action="settings"]').click();
      await page.locator("#setting-master").fill(".2");
      await page.locator("#setting-master").dispatchEvent("input");
      assert.equal(await page.locator("#output-master").textContent(), "20%");
      await page.keyboard.press("Escape");
      assert.equal(
        typeof (await page.evaluate(() => window.desktop.fullscreen())),
        "boolean",
      );
      await sleep(300);
      await page.evaluate(() => window.desktop.fullscreen());
      await sleep(300);
      const resources = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((r) => r.name)
          .filter((u) => /^https?:/i.test(u)),
      );
      assert.deepEqual([...external, ...resources], []);
      assert.deepEqual(errors, []);
    },
  );
  await check(
    "portable quit closes its extracted child and launcher cleanly",
    async () => {
      const closed = page.waitForEvent("close");
      await page
        .evaluate(() => window.desktop.quit())
        .catch((e) => {
          if (!/closed|destroyed/i.test(e.message)) throw e;
        });
      await closed;
      const deadline = Date.now() + 12000;
      while (exitCode === null && Date.now() < deadline) await sleep(200);
      assert.equal(exitCode, 0);
    },
  );
  await writeFile(
    "artifacts/portable-qa-report.json",
    JSON.stringify(
      {
        executable: exe,
        checks,
        errors,
        externalRequests: external,
        isolatedProfile: true,
        automation: "Direct CDP to the extracted portable child",
      },
      null,
      2,
    ),
  );
  console.log(`${checks.length} portable checks passed.`);
} catch (error) {
  await page
    ?.screenshot({ path: "artifacts/portable-failure.png" })
    .catch(() => {});
  console.error(errors);
  throw error;
} finally {
  if (page && !page.isClosed())
    await page.evaluate(() => window.desktop?.quit()).catch(() => {});
  await browser?.close().catch(() => {});
  if (exitCode === null && !launchError) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  }
  const safe = path.resolve(os.tmpdir()) + path.sep;
  if (
    path.resolve(profile).startsWith(safe) &&
    path.basename(profile).startsWith("jurassic-portable-qa-")
  )
    await rm(profile, {
      recursive: true,
      force: true,
      maxRetries: 6,
      retryDelay: 200,
    }).catch(() => {});
}
