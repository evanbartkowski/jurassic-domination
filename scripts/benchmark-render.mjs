import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";

// Chrome CPU submission, frame intervals and GPU workload counters are separate
// measurements. SwiftShader results are not a claim about gaming-hardware FPS.
const url = process.env.JD_BENCHMARK_URL || "http://127.0.0.1:5173";
const output = process.env.JD_BENCHMARK_OUTPUT || "artifacts/render-benchmark.json";
const browser = await chromium.launch({ channel: "chrome", headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(45_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__JD?.world);
  const report = await page.evaluate(async () => {
    const { Game } = await import("/src/game.js");
    const world = window.__JD.world, game = new Game({ seed: 4411 });
    window.__JD.ui.screen("benchmark", "<p>Rendering benchmark in progress.</p>");
    game.hatch(); game.entities = []; game.foods = [];
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    await frame(); await frame();
    const percentiles = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return { p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))], max: sorted.at(-1) };
    };
    const draw = () => {
      const start = performance.now(); world.render(game, 1 / 60, false);
      return performance.now() - start;
    };
    // This also warms every distance/quality geometry in the shared cache.
    for (let i = 0; i < 9; i++) { draw(); await frame(); }
    const qualities = [];
    for (const quality of ["high", "medium", "low"]) {
      world.configure({ ...world.settings, quality });
      for (let i = 0; i < 4; i++) { draw(); await frame(); }
      const submit = [], intervals = [];
      let previous = await frame();
      for (let i = 0; i < 20; i++) {
        submit.push(draw());
        const now = await frame(); intervals.push(now - previous); previous = now;
      }
      qualities.push({ quality, submitMs: percentiles(submit), frameIntervalMs: percentiles(intervals), calls: world.renderer.info.render.calls,
        triangles: world.renderer.info.render.triangles, geometries: world.renderer.info.memory.geometries, textures: world.renderer.info.memory.textures });
    }
    world.configure({ ...world.settings, quality: "high" });
    draw(); await frame();
    const residentBefore = world.renderer.info.memory.geometries, streaming = [];
    for (const x of [0, 240, 480, 720, 960, 0]) {
      game.player.x = x; game.player.y = 0; world.cameraTarget.set(x, 0, 0);
      const builds = [], submissions = [];
      let frames = 0, hasCenter = true;
      do {
        submissions.push(draw()); frames++;
        hasCenter &&= world.terrain.chunks.has(`${Math.floor(x / 160)},0`);
        if (world.terrain.metrics.builtThisFrame) builds.push(world.terrain.metrics.lastBuildMs);
        await frame();
      } while (world.terrain.pending.length && frames < 12);
      streaming.push({ x, frames, hasCenter, pending: world.terrain.pending.length, chunks: world.terrain.chunks.size,
        firstFrameMs: submissions[0], maxFrameMs: Math.max(...submissions), buildMs: builds,
        geometries: world.renderer.info.memory.geometries });
    }
    const residentAfter = world.renderer.info.memory.geometries;
    const food = { id: "benchmark-moving-food", type: "plant", plantKind: "berry", x: 9, y: 3 };
    world.syncFood([food], 0); const model = world.foodModels.get(food.id);
    food.x = 4; food.y = 1; world.syncFood([food], .1);
    const foodFollows = model.position.x === 4 && model.position.z === 1;
    world.syncFood([], .2);
    const gl = world.renderer.getContext(), ext = gl.getExtension("WEBGL_debug_renderer_info");
    const environment = { width: innerWidth, height: innerHeight, seed: 4411, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), userAgent: navigator.userAgent };
    world.dispose(); world.dispose();
    return { environment, qualities, streaming, residentBefore, residentAfter, foodFollows,
      disposed: world.scene.children.length === 0 && world.terrain.chunks.size === 0 && world.terrain.pending.length === 0,
      limitation: "CPU submission and browser frame intervals on this renderer; these measurements do not establish gaming-hardware FPS. A single chunk still builds synchronously." };
  });
  assert.ok(report.qualities.find((q) => q.quality === "low").triangles < report.qualities.find((q) => q.quality === "high").triangles * .65);
  assert.ok(report.streaming.every((p) => p.chunks <= 9 && p.frames <= 9 && p.pending === 0 && p.hasCenter));
  assert.ok(report.residentAfter <= report.residentBefore + 16, "resident GPU geometry must settle after returning to the same position");
  assert.ok(report.foodFollows && report.disposed);
  assert.deepEqual(errors, []);
  try {
    const before = JSON.parse(await readFile("artifacts/render-baseline-v060.json", "utf8"));
    report.previousMilestone = before;
  } catch { /* The benchmark is also runnable in a clean checkout. */ }
  await mkdir("artifacts", { recursive: true });
  await writeFile(output, JSON.stringify({ ...report, errors }, null, 2));
  console.log(JSON.stringify({ output, qualities: report.qualities.map((q) => ({ quality: q.quality, calls: q.calls, triangles: q.triangles, submitMs: q.submitMs, frameIntervalMs: q.frameIntervalMs })), streaming: report.streaming.map((p) => ({ x: p.x, frames: p.frames, maxFrameMs: p.maxFrameMs })), residentBefore: report.residentBefore, residentAfter: report.residentAfter, errors }, null, 2));
} finally { await browser.close(); }
