import sharp from "sharp";
import { copyFile } from "node:fs/promises";

async function run() {
  const src = "C:/Users/evan/.gemini/antigravity/brain/cf2a60c8-df98-4f96-8d22-3fcff660bcea/ancient_slate_texture_1794080303776.jpg";
  await sharp(src)
    .resize(1024, 1024)
    .webp({ quality: 85 })
    .toFile("public/assets/slate-texture.webp");
  await sharp(src)
    .resize(1024, 1024)
    .jpeg({ quality: 85 })
    .toFile("public/assets/slate-texture.jpg");
  console.log("Created slate-texture.webp and slate-texture.jpg");
}
run().catch(console.error);
