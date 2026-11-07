import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { SPECIES } from "../src/data.js";
import { SHOP_ITEMS } from "../src/collection-data.js";
test("every discovered creature and shop item has a bundled model portrait", async () => {
  const names = [
    ...SPECIES.map((s) => "species-" + s.id),
    ...SHOP_ITEMS.map((i) => i.kind + "-" + i.id),
  ];
  assert.equal(names.length, 142);
  await Promise.all(
    names.map(async (name) => {
      const meta = await sharp(
        `public/assets/portraits/${name}.webp`,
      ).metadata();
      assert.equal(meta.width, 320, name);
      assert.equal(meta.height, 260, name);
      assert.equal(meta.format, "webp");
    }),
  );
});
