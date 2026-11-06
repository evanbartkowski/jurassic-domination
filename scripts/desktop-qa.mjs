import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, access, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const executable = process.env.JD_QA_EXE ? path.resolve(process.env.JD_QA_EXE) : undefined;
await access(executable || path.join(root, 'dist', 'index.html'));
await mkdir(path.join(root, 'artifacts'), { recursive: true });
const profileDirectory = await mkdtemp(path.join(os.tmpdir(), 'jurassic-domination-qa-'));
const errors = [], externalRequests = [], checks = [];
let application, page, exited = false;
const launchEnvironment = { ...process.env, JD_TEST_USER_DATA: profileDirectory };
// Some Electron-based development hosts export this flag for their child Node jobs.
delete launchEnvironment.ELECTRON_RUN_AS_NODE;

async function check(name, run) {
  await run();
  checks.push(name);
  console.log(`PASS ${name}`);
}

// Track the actual minimap marker, without development-only simulation access.
const marker = () => page.locator('#minimap').evaluate(canvas => {
  const { width, height } = canvas;
  const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
  let x = 0, y = 0, count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] === 242 && pixels[i + 1] === 215 && pixels[i + 2] === 156 && pixels[i + 3] > 240) {
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
    args: [...(executable ? [] : [path.join(root, 'electron', 'main.cjs')]), '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    cwd: root,
    env: launchEnvironment,
    timeout: 45000,
  });
  application.on('close', () => { exited = true; });
  page = await application.firstWindow();
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/i.test(request.url())) externalRequests.push(request.url()); });

  await check('desktop profile is isolated from existing player data', async () => {
    const actualProfile = await application.evaluate(({ app }) => app.getPath('userData'));
    assert.equal(path.resolve(actualProfile), path.resolve(profileDirectory));
  });

  await check('packaged renderer title and original artwork load', async () => {
    await page.getByRole('button', { name: /BEGIN A NEW LIFE/ }).waitFor();
    assert.match(await page.title(), /Jurassic Domination/);
    assert.equal(await page.locator('#graphics-error').count(), 0);
    const artwork = await page.evaluate(async () => {
      const image = new Image();
      image.src = new URL('assets/title-art.png', location.href).href;
      await image.decode();
      return image.naturalWidth;
    });
    assert.ok(artwork > 1000);
  });

  await check('desktop bridge is limited and Node is absent from the renderer', async () => {
    const state = await page.evaluate(() => ({
      protocol: location.protocol,
      require: typeof globalThis.require,
      process: typeof globalThis.process,
      diagnostic: typeof globalThis.__JD,
      bridge: Object.keys(globalThis.desktop || {}).sort(),
    }));
    assert.equal(state.protocol, 'file:');
    assert.equal(state.require, 'undefined');
    assert.equal(state.process, 'undefined');
    assert.equal(state.diagnostic, 'undefined');
    assert.deepEqual(state.bridge, ['fullscreen', 'quit']);
    const preferences = await application.evaluate(({ BrowserWindow }) => {
      const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return { sandbox: preferences.sandbox, isolated: preferences.contextIsolation, node: preferences.nodeIntegration };
    });
    assert.deepEqual(preferences, { sandbox: true, isolated: true, node: false });
  });

  await check('new life starts as an egg and E hatches a real beginner species', async () => {
    await page.getByRole('button', { name: /BEGIN A NEW LIFE/ }).click();
    await page.locator('#hud').waitFor({ state: 'visible' });
    await page.getByText('An unhatched possibility', { exact: true }).waitFor();
    await page.keyboard.press('KeyE');
    await page.waitForFunction(() => {
      const name = document.getElementById('hud-species')?.textContent;
      return name && name !== 'An unhatched possibility' && name !== 'The beginning';
    });
    assert.match(await page.locator('#hud-tier').textContent(), /TIER 1/);
    await page.locator('#egg-prompt').waitFor({ state: 'hidden' });
  });

  await check('WASD moves the actual player marker in the rendered world', async () => {
    await page.waitForTimeout(220);
    const before = await marker();
    assert.ok(before?.count > 0, 'the player marker should be rendered');
    await page.keyboard.down('KeyD');
    try { await page.waitForTimeout(900); }
    finally { await page.keyboard.up('KeyD'); }
    await page.waitForTimeout(220);
    const after = await marker();
    assert.ok(after && after.x > before.x + 1.2, `expected D movement; marker ${JSON.stringify({ before, after })}`);
    await page.screenshot({ path: path.join(root, 'artifacts', 'desktop.png') });
  });

  await check('species ability and dodge expose real HUD cooldowns', async () => {
    await page.keyboard.press('KeyQ');
    await page.waitForFunction(() => /\d/.test(document.getElementById('hud-ability-cooldown')?.textContent || ''));
    await page.keyboard.press('Shift');
    await page.waitForFunction(() => /\d/.test(document.getElementById('hud-dash-cooldown')?.textContent || ''));
  });

  await check('pause, settings, and resume preserve the paused world', async () => {
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /RESUME THE HUNT/ }).waitFor();
    const before = await page.locator('#hud-time').textContent();
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('#hud-time').textContent(), before);
    await page.locator('#overlay [data-action="settings"]').click();
    await page.locator('#setting-master').waitFor();
    await page.locator('#setting-master').fill('0.25');
    await page.locator('#setting-master').dispatchEvent('input');
    assert.equal(await page.locator('#output-master').textContent(), '25%');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /RESUME THE HUNT/ }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#overlay').waitFor({ state: 'hidden' });
  });

  await check('fullscreen bridge toggles the native window and restores it', async () => {
    // Pause before changing window focus or dimensions.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /RESUME THE HUNT/ }).waitFor();
    await page.evaluate(() => window.desktop.fullscreen());
    await application.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (!window.isFullScreen()) await new Promise(resolve => window.once('enter-full-screen', resolve));
    });
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()), true);
    await page.evaluate(() => window.desktop.fullscreen());
    await application.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      if (window.isFullScreen()) await new Promise(resolve => window.once('leave-full-screen', resolve));
    });
    assert.equal(await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen()), false);
  });

  await check('offline production renderer makes no external requests or runtime errors', async () => {
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name).filter(url => /^https?:/i.test(url)));
    externalRequests.push(...resources);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(errors, []);
  });

  await check('native quit exits cleanly', async () => {
    const closed = application.waitForEvent('close', { timeout: 15000 });
    await page.evaluate(() => window.desktop.quit()).catch(error => {
      if (!/closed|destroyed/i.test(error.message)) throw error;
    });
    await closed;
    assert.equal(exited, true);
  });

  await writeFile(path.join(root, 'artifacts', 'desktop-qa-report.json'), JSON.stringify({ checks, errors, externalRequests, isolatedProfile: true, executable: executable || 'source Electron host with built dist', renderer: 'SwiftShader for automated portability' }, null, 2));
  console.log(`${checks.length} desktop integration checks passed, zero runtime errors.`);
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: path.join(root, 'artifacts', 'desktop-failure.png') }).catch(() => {});
  console.error('Renderer errors:', errors);
  console.error('External requests:', externalRequests);
  throw error;
} finally {
  if (application && !exited) await application.close().catch(() => {});
  // Verified absolute target is a freshly generated child of the OS temp folder.
  const safeRoot = path.resolve(os.tmpdir()) + path.sep;
  if (path.isAbsolute(profileDirectory) && profileDirectory.startsWith(safeRoot) && path.basename(profileDirectory).startsWith('jurassic-domination-qa-')) {
    await rm(profileDirectory, { recursive: true, force: true, maxRetries: 6, retryDelay: 150 }).catch(() => {});
  }
}
