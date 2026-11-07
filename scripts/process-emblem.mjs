import sharp from "sharp";

async function processEmblem() {
  const src = "C:/Users/evan/.gemini/antigravity/brain/cf2a60c8-df98-4f96-8d22-3fcff660bcea/dinosaur_game_logo_emblem_1794080356929.jpg";
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  const cx = width / 2, cy = height / 2, maxR = width * 0.475;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x);
      const srcIdx = idx * channels;
      const outIdx = idx * 4;
      const r = data[srcIdx], g = data[srcIdx + 1], b = data[srcIdx + 2];
      const dist = Math.hypot(x - cx, y - cy);
      
      // Calculate alpha based on luminance and distance from center
      const brightness = Math.max(r, g, b);
      let alpha = 255;
      
      // If outside the outer shield edge
      if (dist > maxR + 15) {
        alpha = 0;
      } else if (dist > maxR - 5) {
        // Soft outer feather
        const edgeFade = Math.max(0, Math.min(1, (maxR + 15 - dist) / 20));
        const lumFade = Math.max(0, Math.min(1, (brightness - 12) / 28));
        alpha = Math.round(255 * edgeFade * lumFade);
      } else if (brightness < 16) {
        alpha = Math.round(255 * Math.max(0, (brightness - 4) / 12));
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
    .toFile("public/assets/game-emblem.webp");

  await sharp(out, { raw: { width, height, channels: 4 } })
    .resize(512, 512)
    .png()
    .toFile("public/assets/game-emblem.png");

  console.log("Created public/assets/game-emblem.webp and game-emblem.png");
}

processEmblem().catch(console.error);
