import {enterTitle} from './enter-title.mjs';
import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, access, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import packageInfo from '../package.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const executable = process.env.JD_QA_EXE
  ? path.resolve(process.env.JD_QA_EXE)
  : undefined;
await access(executable || path.join(root, "dist", "index.html"));
await mkdir(path.join(root, "artifacts"), { recursive: true });
const profileDirectory = await mkdtemp(
  path.join(os.tmpdir(), "jurassic-domination-qa-"),
);
const errors = [],
  externalRequests = [],
  checks = [];
let application,
  page,
  exited = false;
const launchEnvironment = {
  ...process.env,
  JD_TEST_USER_DATA: profileDirectory,
};
// Some Electron-based development hosts export this flag for their child Node jobs.
delete launchEnvironment.ELECTRON_RUN_AS_NODE;

async function check(name, run) {
  await run();
  checks.push(name);
  console.log(`PASS ${name}`);
}

// Track the actual minimap marker, without development-only simulation access.
const marker = () =>
  page.locator("#minimap").evaluate((canvas) => {
    const { width, height } = canvas;
    const pixels = canvas
      .getContext("2d")
      .getImageData(0, 0, width, height).data;
    let x = 0,
      y = 0,
      count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (
        pixels[i] === 242 &&
        pixels[i + 1] === 215 &&
        pixels[i + 2] === 156 &&
        pixels[i + 3] > 240
      ) {
        const pixel = i / 4;
        x += pixel % width;
        y += Math.floor(pixel / width);
        count++;
      }
    }
    return count ? { x: x / count, y: y / count, count } : null;
  });

try {
  application = await electron.launch({
    ...(executable ? { executablePath: executable } : {}),
    args: [
      ...(executable ? [] : [path.join(root, "electron", "main.cjs")]),
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
    ],
    cwd: root,
    env: launchEnvironment,
    timeout: 45000,
  });
  application.on("close", () => {
    exited = true;
  });
  page = await application.firstWindow();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (/^https?:/i.test(request.url())) externalRequests.push(request.url());
  });

  await page.waitForSelector('#world[data-start-art="ready"]',{timeout:45000});
  await page.screenshot({path:'artifacts/start-screen/desktop-native.png'});
  checks.push('cinematic startup artwork loads from local files');
  await enterTitle(page);
  await check(
    "desktop profile is isolated from existing player data",
    async () => {
      const actualProfile = await application.evaluate(({ app }) =>
        app.getPath("userData"),
      );
      assert.equal(path.resolve(actualProfile), path.resolve(profileDirectory));
    },
  );

  await check("packaged renderer title and original artwork load", async () => {
    await page.getByRole("button", { name: /BEGIN A NEW LIFE/ }).waitFor();
    assert.match(await page.title(), /Jurassic Domination/);
    assert.equal(await page.locator("#graphics-error").count(), 0);
    const artwork = await page.evaluate(async () => {
      const image = new Image();
      image.src = new URL("assets/title-art.png", location.href).href;
      await image.decode();
      return image.naturalWidth;
    });
    assert.ok(artwork > 1000);
  });

  await check('desktop policy permits v5 Blender models and their embedded PBR maps to load offline', async () => {
    const header = await page.evaluate(async () => {
      const response = await fetch(new URL('assets/models-v5/tyrannosaurus.glb', location.href));
      const bytes=await response.arrayBuffer(),view=new DataView(bytes),gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,view.getUint32(12,true))));
      for(const image of gltf.images){const b=gltf.bufferViews[image.bufferView],blob=new Blob([bytes.slice(28+view.getUint32(12,true)+b.byteOffset,28+view.getUint32(12,true)+b.byteOffset+b.byteLength)],{type:image.mimeType}),url=URL.createObjectURL(blob);try{const fetched=await fetch(url);const bitmap=await createImageBitmap(await fetched.blob());if(bitmap.width<256)throw Error('PBR map missing');bitmap.close();}finally{URL.revokeObjectURL(url);}}
      return view.getUint32(0,true);
    });
    assert.equal(header, 0x46546c67);
  });

  await check('native startup recovery assets and factual credits load from the packaged files', async () => {
    await page.locator('#boot-screen').waitFor({ state: 'hidden' });
    assert.ok(await page.evaluate(() => [...document.scripts].some(s => /assets\/boot\.js$/.test(s.src))));
    await page.locator('[data-action="credits"]').click();
    assert.match(await page.locator('.credits-panel').textContent(), new RegExp(packageInfo.version.replaceAll('.', '\\.')));
    await page.locator('[data-action="license"]').click();
    await page.waitForFunction(() => document.getElementById('license-text')?.textContent.includes('Permission is hereby granted'));
    await page.screenshot({ path: 'artifacts/player-polish/after/desktop-credits.png' });
    await page.keyboard.press('Escape');
  });

  await check(
    "desktop bridge is limited and Node is absent from the renderer",
    async () => {
      const state = await page.evaluate(() => ({
        protocol: location.protocol,
        require: typeof globalThis.require,
        process: typeof globalThis.process,
        diagnostic: typeof globalThis.__JD,
        bridge: Object.keys(globalThis.desktop || {}).sort(),
      }));
      assert.equal(state.protocol, "file:");
      assert.equal(state.require, "undefined");
      assert.equal(state.process, "undefined");
      assert.equal(state.diagnostic, "undefined");
      assert.deepEqual(state.bridge, ["fullscreen", "quit"]);
      const preferences = await application.evaluate(({ BrowserWindow }) => {
        const preferences =
          BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
        return {
          sandbox: preferences.sandbox,
          isolated: preferences.contextIsolation,
          node: preferences.nodeIntegration,
        };
      });
      assert.deepEqual(preferences, {
        sandbox: true,
        isolated: true,
        node: false,
      });
    },
  );

  await check(
    "packaged shop purchases and permanent island saves work offline",
    async () => {
      // Seed an account with the shop and island unlocked in this isolated
      // QA origin. Editing a mirror after startup is now correctly superseded by
      // the application's atomic checkpoint on unload.
      await page.addInitScript(() => {
        if (sessionStorage.getItem("jd-qa-legacy-profile-seeded")) return;
        localStorage.clear();
        localStorage.setItem("jurassic-domination.profile.v1", JSON.stringify({version:6,dna:30,account:{version:1,xp:280,rewardedLevel:3,earnedByRun:{}},loot:{crates:[{id:'crate:native-test',type:'primeval',seed:12345}]}}));
        sessionStorage.setItem("jd-qa-legacy-profile-seeded", "1");
      });
      await page.reload();await enterTitle(page);
      await page.locator('[data-action="loot"]').click();await page.locator('[data-open-crate]').click();await page.locator('[data-skip-reveal]').click();
      await page.locator('.crate-result').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jurassic-domination.profile.v1')).loot.opened),1);
      await page.screenshot({path:'artifacts/loot/reveal-native.png'});
      await page.locator('[data-loot-return]').click();await page.locator('[data-action="back"]').first().click();
      checks.push('native crate opening saves its collectible and currency before reveal');
      const dnaBeforePurchase=await page.evaluate(()=>JSON.parse(localStorage.getItem('jurassic-domination.profile.v1')).dna);
      await page.locator('[data-action="shop"]').click();
      await page.locator('[data-shop-category="pet"]').click();
      await page.locator('[data-product="pet:compy"]').click();
      await page.locator("[data-buy]").click();
      await page.locator("[data-equip-pet]").click();
      await page.locator("[data-place-product]").click();
      await page.locator("#island-canvas").waitFor();
      await page.locator("#build-toggle").click();
      await page.waitForTimeout(700);
      await page.keyboard.press("Enter");
      await page.waitForFunction(
        () =>
          JSON.parse(localStorage.getItem("jurassic-domination.profile.v1"))
            .island.placements.length === 1,
      );
      const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("jurassic-domination.profile.v1")),
      );
      assert.equal(saved.dna, dnaBeforePurchase-6);
      assert.equal(saved.activePet, "compy");
      await page.screenshot({ path: "artifacts/desktop-island.png" });
      await page.reload();await enterTitle(page);
      await page.locator('[data-action="island"]').click();
      await page.locator("#build-toggle").click();
      await page.locator('[data-island-companion="compy"]').waitFor();
      assert.match(
        await page.locator("#island-inventory").textContent(),
        /ROAMING ON ISLAND/,
      );
      await page.keyboard.press("Escape");
    },
  );

  await check(
    "new life starts as an egg and E hatches a real beginner species",
    async () => {
      await page.getByRole("button", { name: /BEGIN A NEW LIFE/ }).click();
      await page.locator("#hud").waitFor({ state: "visible" });
      await page
        .getByText("An unhatched possibility", { exact: true })
        .waitFor();
      await page.keyboard.press("KeyE");
      await page.waitForFunction(() => {
        const name = document.getElementById("hud-species")?.textContent;
        return (
          name &&
          name !== "An unhatched possibility" &&
          name !== "The beginning"
        );
      });
      assert.match(await page.locator("#hud-tier").textContent(), /TIER 1/);
      await page.locator("#egg-prompt").waitFor({ state: "hidden" });
    },
  );

  await check(
    "WASD moves the actual player marker in the rendered world",
    async () => {
      await page.waitForTimeout(220);
      const before = await marker();
      assert.ok(before?.count > 0, "the player marker should be rendered");
      let after;
      await page.keyboard.down("KeyD");
      try {
        for (let attempt = 0; attempt < 15; attempt++) {
          await page.waitForTimeout(200);
          after = await marker();
          if (after && after.x > before.x + 1.2) break;
        }
      } finally {
        await page.keyboard.up("KeyD");
      }
      assert.ok(
        after && after.x > before.x + 1.2,
        `expected D movement; marker ${JSON.stringify({ before, after })}`,
      );
      await page.screenshot({
        path: path.join(root, "artifacts", "desktop.png"),
      });
    },
  );

  await check(
    "species ability and available dodge expose real HUD cooldowns",
    async () => {
      const abilityAvailable = await page.locator("#hud-ability").isVisible();
      await page.keyboard.press("KeyQ");
      if (abilityAvailable)
      await page.waitForFunction(() =>
        /\d/.test(
          document.getElementById("hud-ability-cooldown")?.textContent || "",
        ),
      );
      if ((await page.locator("#dash-name").textContent()) === "NO DASH") {
        assert.equal(
          await page.locator("#hud-dash-cooldown").textContent(),
          "HEAVY FORM",
        );
        return;
      }
      await page.keyboard.press("KeyR");
      await page.waitForFunction(() =>
        /\d/.test(
          document.getElementById("hud-dash-cooldown")?.textContent || "",
        ),
      );
    },
  );
  await check(
    "species technique uses its own Ctrl control and cooldown",
    async () => {
      const techniqueAvailable = await page.locator("#hud-technique").isVisible();
      await page.keyboard.press("ControlLeft");
      if (!techniqueAvailable) {
        assert.equal(await page.locator("#hud-technique-cooldown").textContent(), "READY");
        return;
      }
      await page.waitForFunction(() =>
        /\d/.test(
          document.getElementById("hud-technique-cooldown")?.textContent || "",
        ),
      );
    },
  );

  await check(
    "X skill and J bloodline journal work in the packaged game",
    async () => {
      if (await page.locator("#special-key").isVisible()) {
        await page.waitForTimeout(1200);
        await page.keyboard.press("KeyX");
        await page.waitForFunction(() =>
          /\d/.test(document.getElementById("special-cooldown").textContent),
        );
      }
      await page.keyboard.press("KeyJ");
      await page.locator(".bloodlines-wrap").waitFor();
      assert.equal(await page.locator(".bloodline-grid article").count(), 9);
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "pause, settings, and resume preserve the paused world",
    async () => {
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /RESUME THE HUNT/ }).waitFor();
      const before = await page.locator("#hud-time").textContent();
      await page.waitForTimeout(1100);
      assert.equal(await page.locator("#hud-time").textContent(), before);
      await page.locator('#overlay [data-action="settings"]').click();
      await page.locator("#setting-master").waitFor();
      await page.locator("#setting-master").fill("0.25");
      await page.locator("#setting-master").dispatchEvent("input");
      assert.equal(await page.locator("#output-master").textContent(), "25%");
      await page.locator('[data-action="controls"]').click();
      await page.locator('[data-action="back"]').last().click();
      await page.locator('#setting-master').waitFor();
      await page.locator('[data-action="back"]').last().click();
      await page.getByRole("button", { name: /RESUME THE HUNT/ }).waitFor();
      await page.keyboard.press("Escape");
      await page.locator("#overlay").waitFor({ state: "hidden" });
    },
  );
  await check('H stalking and the L genetics/discovery journal work in production', async () => {
    await page.keyboard.down('KeyH');
    await page.waitForFunction(() => document.getElementById('environment-body')?.textContent.includes('STALKING'));
    await page.keyboard.up('KeyH');
    await page.keyboard.press('KeyL');
    await page.locator('.wide-panel.compendium-panel').waitFor();
    assert.equal(await page.locator('.field-site').count(), 10);
    assert.equal(await page.locator('.field-adaptation').count(), 4);
    await page.waitForFunction(() => document.querySelector('.field-hero img')?.naturalWidth > 0);
    const before = await page.locator('#hud-time').textContent();
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#hud-time').textContent(), before);
    await page.screenshot({path:'artifacts/desktop-field-journal.png'});
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  });

  await check(
    "fullscreen bridge toggles the native window and restores it",
    async () => {
      // Pause before changing window focus or dimensions.
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: /RESUME THE HUNT/ }).waitFor();
      await page.evaluate(() => window.desktop.fullscreen());
      await application.evaluate(async ({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (!window.isFullScreen())
          await new Promise((resolve) =>
            window.once("enter-full-screen", resolve),
          );
      });
      assert.equal(
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isFullScreen(),
        ),
        true,
      );
      await page.evaluate(() => window.desktop.fullscreen());
      await application.evaluate(async ({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (window.isFullScreen())
          await new Promise((resolve) =>
            window.once("leave-full-screen", resolve),
          );
      });
      assert.equal(
        await application.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()[0].isFullScreen(),
        ),
        false,
      );
    },
  );

  await check(
    "offline production renderer makes no external requests or runtime errors",
    async () => {
      const resources = await page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .map((entry) => entry.name)
          .filter((url) => /^https?:/i.test(url)),
      );
      externalRequests.push(...resources);
      assert.deepEqual(externalRequests, []);
      assert.deepEqual(errors, []);
    },
  );

  let closedCheckpoint;
  await check("native quit exits cleanly", async () => {
    if (!(await page.locator('[data-action="resume"]').isVisible())) await page.keyboard.press("Escape");
    await page.locator('[data-action="resume"]').waitFor();
    closedCheckpoint = await page.evaluate(() => {
      const head = JSON.parse(localStorage.getItem("jurassic-domination.save.head.v1"));
      const envelope = JSON.parse(localStorage.getItem(["jurassic-domination.save.a.v1", "jurassic-domination.save.b.v1"][head.slot]));
      const run = envelope.data.run;
      return { id: run.runId, player: run.game.player, time: run.game.time };
    });
    const closed = application.waitForEvent("close", { timeout: 15000 });
    await page
      .evaluate(() => window.desktop.quit())
      .catch((error) => {
        if (!/closed|destroyed/i.test(error.message)) throw error;
      });
    await closed;
    assert.equal(exited, true);
  });

  await check("a native application restart continues the same paused life from disk", async () => {
    exited = false;
    application = await electron.launch({
      ...(executable ? { executablePath: executable } : {}),
      args: [...(executable ? [] : [path.join(root, "electron", "main.cjs")]), "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
      cwd: root, env: launchEnvironment, timeout: 45000,
    });
    application.on("close", () => { exited = true; });
    page = await application.firstWindow(); page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("request", (request) => { if (/^https?:/i.test(request.url())) externalRequests.push(request.url()); });
    await enterTitle(page);
    await page.locator('[data-action="continue"]').click();
    await page.locator('[data-action="resume"]').waitFor();
    assert.match(await page.locator("#pause-save-status").textContent(), /RESTORED/);
    const restored = await page.evaluate(() => {
      const head = JSON.parse(localStorage.getItem("jurassic-domination.save.head.v1"));
      const envelope = JSON.parse(localStorage.getItem(["jurassic-domination.save.a.v1", "jurassic-domination.save.b.v1"][head.slot]));
      const run = envelope.data.run;
      return { id: run.runId, player: run.game.player, time: run.game.time };
    });
    assert.deepEqual(restored, closedCheckpoint);
    assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
    await page.screenshot({ path: path.join(root, "artifacts", "desktop-restored-life.png") });
    const closed = application.waitForEvent("close", { timeout: 15000 });
    await page.evaluate(() => window.desktop.quit()).catch((error) => { if (!/closed|destroyed/i.test(error.message)) throw error; });
    await closed;
  });

  await writeFile(
    path.join(root, "artifacts", "desktop-qa-report.json"),
    JSON.stringify(
      {
        checks,
        errors,
        externalRequests,
        isolatedProfile: true,
        executable: executable || "source Electron host with built dist",
        renderer: "SwiftShader for automated portability",
      },
      null,
      2,
    ),
  );
  console.log(
    `${checks.length} desktop integration checks passed, zero runtime errors.`,
  );
} catch (error) {
  if (page && !page.isClosed())
    await page
      .screenshot({ path: path.join(root, "artifacts", "desktop-failure.png") })
      .catch(() => {});
  console.error("Renderer errors:", errors);
  console.error("External requests:", externalRequests);
  throw error;
} finally {
  if (application && !exited) await application.close().catch(() => {});
  // Verified absolute target is a freshly generated child of the OS temp folder.
  const safeRoot = path.resolve(os.tmpdir()) + path.sep;
  if (
    path.isAbsolute(profileDirectory) &&
    profileDirectory.startsWith(safeRoot) &&
    path.basename(profileDirectory).startsWith("jurassic-domination-qa-")
  ) {
    await rm(profileDirectory, {
      recursive: true,
      force: true,
      maxRetries: 6,
      retryDelay: 150,
    }).catch(() => {});
  }
}
