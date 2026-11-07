import sharp from "sharp";

async function processBezel() {
  const src = "C:/Users/evan/.gemini/antigravity/brain/cf2a60c8-df98-4f96-8d22-3fcff660bcea/primordial_compass_bezel_ring_1794080393008.jpg";
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  const cx = width / 2, cy = height / 2;
  const outerR = width * 0.47;
  const innerR = width * 0.32;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x);
      const srcIdx = idx * channels;
      const outIdx = idx * 4;
      const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2];
      const dist = Math.hypot(x - cx, y - cy);
      const brightness = Math.max(r, g, b);
      
      let alpha = 255;
      if (dist > outerR + 15) {
        alpha = 0;
      } else if (dist < innerR - 15) {
        alpha = 0;
      } else if (dist > outerR - 4) {
        const edgeFade = Math.max(0, Math.min(1, (outerR + 15 - dist) / 19));
        const lumFade = Math.max(0, Math.min(1, (brightness - 10) / 25));
        alpha = Math.round(255 * edgeFade * lumFade);
      } else if (dist < innerR + 4) {
        const innerFade = Math.max(0, Math.min(1, (dist - (innerR - 15)) / 19));
        const lumFade = Math.max(0, Math.min(1, (brightness - 10) / 25));
        alpha = Math.round(255 * innerFade * lumFade);
      } else if (brightness < 18) {
        alpha = Math.round(255 * Math.max(0, (brightness - 5) / 13));
      }

      out[outIdx] = r;
      out[outIdx + 1] = g;
      out[outIdx + 2] = b;
      out[outIdx + 3] = alpha;
    }
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .resize(512, 512)
    .webp({ quality: 90 })
    .toFile("public/assets/compass-bezel.webp");

  await sharp(out, { raw: { width, height, channels: 4 } })
    .resize(512, 512)
    .png()
    .toFile("public/assets/compass-bezel.png");

  console.log("Created public/assets/compass-bezel.webp and compass-bezel.png");
}

processBezel().catch(console.error);
