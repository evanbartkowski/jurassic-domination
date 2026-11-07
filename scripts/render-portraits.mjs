import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import sharp from "sharp";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
const page = await browser.newPage();
try {
  await page.goto("http://127.0.0.1:5173");
  await page.waitForFunction(() => window.__JD?.ui);
  await fs.mkdir("public/assets/portraits", { recursive: true });
  const entries = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { SPECIES } = await import("/src/data.js");
    const { SHOP_ITEMS } = await import("/src/collection-data.js");
    const { createShopObject, createCosmetic } =
      await import("/src/collection-art.js");
    const { createDinosaur } = await import("/src/creatures.js");
    const canvas = document.createElement("canvas"),
      r = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
    r.setSize(320, 260);
    r.setPixelRatio(1);
    r.setClearColor(0, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xe7f6ef, 0x39462d, 2.5));
    const sun = new THREE.DirectionalLight(0xffe6b9, 3);
    sun.position.set(4, 8, 6);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x94c8ef, 2);
    rim.position.set(-4, 2, -3);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(32, 320 / 260, 0.01, 300);
    const list = [
        ...SPECIES.map((s) => ({ key: "species-" + s.id, species: s })),
        ...SHOP_ITEMS.map((item) => ({ key: item.kind + "-" + item.id, item })),
      ],
      out = [];
    for (const entry of list) {
      const model = entry.item
        ? entry.item.kind === "cosmetic"
          ? createCosmetic(entry.item.id)
          : createShopObject(entry.item, {
              equippedSkin: "natural",
              equippedCosmetic: "none",
            })
        : createDinosaur(entry.species, true);
      model.rotation.y = -0.62;
      scene.add(model);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model),
        center = box.getCenter(new THREE.Vector3()),
        size = box.getSize(new THREE.Vector3());
      const span = Math.max(size.y, size.x / camera.aspect, size.z * 0.65),
        distance = (span / (2 * Math.tan((32 * Math.PI) / 360))) * 1.24;
      camera.position
        .copy(center)
        .add(new THREE.Vector3(distance * 0.2, distance * 0.18, distance));
      camera.lookAt(center);
      r.render(scene, camera);
      out.push({
        key: entry.key,
        data: canvas.toDataURL("image/png").split(",")[1],
      });
      scene.remove(model);
      model.userData.dispose();
    }
    r.dispose();
    return out;
  });
  for (const e of entries)
    await sharp(Buffer.from(e.data, "base64"))
      .webp({ quality: 88 })
      .toFile(`public/assets/portraits/${e.key}.webp`);
  console.log(`Rendered ${entries.length} model portraits`);
} finally {
  await browser.close();
}
