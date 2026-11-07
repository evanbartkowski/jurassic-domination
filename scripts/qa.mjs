import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.JD_QA_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [],
  checks = [];
page.setDefaultTimeout(15000);
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (response) => {
  if (response.status() >= 400)
    console.error(`HTTP ${response.status()} ${response.url()}`);
});
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await mkdir("artifacts", { recursive: true });
async function check(name, fn) {
  await fn();
  checks.push(name);
  console.log(`PASS ${name}`);
}
try {
  await page.goto(base);
  await page.waitForFunction(() => window.__JD?.ui?.view === "menu");
  await check("live 3D title screen animates an actual creature", async () => {
    await page.getByRole("button", { name: /BEGIN A NEW LIFE/ }).waitFor();
    await page.screenshot({ path: "artifacts/title.png" });
    const rotation = await page.evaluate(
      () => window.__JD.world.menuDino.rotation.y,
    );
    await page.waitForFunction(
      (before) => window.__JD.world.menuDino.rotation.y !== before,
      rotation,
    );
  });
  await check("tutorial and keyboard back", async () => {
    await page.getByRole("button", { name: /HOW TO SURVIVE/ }).click();
    await page.waitForFunction(() => window.__JD.ui.view === "tutorial");
    await page.screenshot({ path: "artifacts/tutorial.png" });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__JD.ui.view === "menu");
  });
  await check(
    "encyclopedia contains all 93 species and a working 3D viewer",
    async () => {
      await page.getByRole("button", { name: /ENCYCLOPEDIA/ }).click();
      await page.waitForFunction(() => window.__JD.specimen);
      assert.equal(await page.locator("[data-inspect]").count(), 93);
      await page.locator("#guide-search").fill("unicorn");
      await page.locator('[data-inspect="unicorn"]').click();
      await page.waitForFunction(
        () => window.__JD.specimen.speciesId === "unicorn",
      );
      await page.screenshot({ path: "artifacts/encyclopedia.png" });
      await page.locator("#guide-search").fill("");
      await page.locator("#guide-filter").selectOption("unlocked");
      assert.equal(await page.locator("[data-inspect]").count(), 0);
      await page.keyboard.press("Escape");
    },
  );
  await check(
    "every creature family renders with finite animated geometry",
    async () => {
      await page.getByRole("button", { name: /ENCYCLOPEDIA/ }).click();
      await page.waitForFunction(() => window.__JD.specimen);
      const count = await page.evaluate(async () => {
        const { SPECIES } = await import("/src/data.js");
        const v = window.__JD.specimen;
        for (const s of SPECIES) {
          v.setSpecies(s);
          v.render(0.016);
          v.model.updateMatrixWorld(true);
          v.model.traverse((m) => {
            if (m.isMesh) {
              const p = m.geometry.attributes.position;
              for (let i = 0; i < p.count; i++)
                if (!Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)))
                  throw Error("Invalid mesh " + s.id);
            }
          });
        }
        return SPECIES.length;
      });
      assert.equal(count, 93);
      await page.keyboard.press("Escape");
    },
  );
  await check("settings apply volume, quality and accessibility", async () => {
    await page.getByRole("button", { name: "Open settings" }).click();
    await page.waitForFunction(() => window.__JD.ui.view === "settings");
    const slider = page.locator("input[type=range]").first();
    await slider.fill(".35");
    await slider.dispatchEvent("input");
    assert.equal(await page.evaluate(() => window.__JD.settings.master), 0.35);
    await page.locator("#setting-quality").selectOption("low");
    assert.equal(
      await page.evaluate(() => window.__JD.world.renderer.shadowMap.enabled),
      false,
    );
    await page.locator("#setting-shake").uncheck();
    assert.equal(await page.evaluate(() => window.__JD.settings.shake), false);
    await page.locator("#setting-quality").selectOption("high");
    await page.keyboard.press("Escape");
  });
  await check("egg hatches, WASD moves and HUD updates", async () => {
    await page.getByRole("button", { name: /BEGIN A NEW LIFE/ }).click();
    await page.waitForFunction(() => window.__JD.game?.state === "egg");
    await page.keyboard.press("KeyE");
    await page.waitForFunction(() => window.__JD.game.state === "playing");
    const start = await page.evaluate(() => window.__JD.game.player.x);
    await page.keyboard.down("KeyD");
    await page.waitForFunction((x) => window.__JD.game.player.x > x + 1, start);
    await page.keyboard.up("KeyD");
    const moved = await page.evaluate(() => window.__JD.game.player.x);
    assert(moved > start + 1);
    await page.screenshot({ path: "artifacts/gameplay.png" });
  });
  await check("Q ability and Shift dodge consume real cooldowns", async () => {
    await page.keyboard.press("KeyQ");
    await page.waitForFunction(
      () => window.__JD.game.player.abilityCooldown > 0,
    );
    await page.keyboard.press("Shift");
    await page.waitForFunction(() => window.__JD.game.player.dashCooldown > 0);
  });
  await check(
    "R technique has its own cooldown and visible HUD control",
    async () => {
      await page.evaluate(() => (window.__JD.game.player.stamina = 100));
      await page.keyboard.press("KeyR");
      await page.waitForFunction(
        () => window.__JD.game.player.techniqueCooldown > 0,
      );
      assert.notEqual(
        await page.locator("#hud-technique-cooldown").textContent(),
        "READY",
      );
    },
  );
  await check("escape pauses and settings preserve pause", async () => {
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__JD.ui.view === "pause");
    const before = await page.evaluate(() => window.__JD.game.time);
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__JD.game.time), before);
    await page.getByRole("button", { name: "SETTINGS", exact: false }).click();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__JD.ui.view === "pause");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__JD.ui.view === "hud");
  });
  await check(
    "evolution freezes play and applies a chosen form and mutation",
    async () => {
      await page.evaluate(() =>
        window.__JD.game.gainXP(window.__JD.game.nextThreshold),
      );
      await page.waitForFunction(() => window.__JD.ui.view === "evolution");
      await page.screenshot({ path: "artifacts/evolution.png" });
      await page.locator("[data-species]").first().click();
      await page.locator("[data-mutation]").first().click();
      await page
        .getByRole("button", { name: /EVOLVE|EMBRACE|BECOME|ADAPT/ })
        .click();
      await page.waitForFunction(
        () => window.__JD.game.tier === 1 && window.__JD.ui.view === "hud",
      );
      assert.equal(
        await page.evaluate(() => window.__JD.game.mutations.length),
        1,
      );
    },
  );
  await check(
    "combat kill, edible remains, and food recovery integrate",
    async () => {
      await page.evaluate(() => {
        const g = window.__JD.game;
        g.entities = [];
        g.player.angle = 0;
        g.player.attackCooldown = 0;
        g.player.invulnerable = 1;
        g.player.hunger = 60;
        const e = g.spawnEntity("compsognathus", g.player.x + 1, g.player.y);
        e.hp = 1;
      });
      await page.mouse.move(1400, 450);
      await page.keyboard.press("Space");
      await page.waitForFunction(() => window.__JD.game.player.kills > 0);
      const hunger = await page.evaluate(() => window.__JD.game.player.hunger);
      await page.keyboard.press("KeyE");
      await page.waitForFunction(
        (h) => window.__JD.game.player.hunger > h,
        hunger,
      );
    },
  );
  await check(
    "rare finds grant live buffs, F skills, and persistent appearance unlocks",
    async () => {
      await page.evaluate(() => {
        const g = window.__JD.game;
        g.foods = [];
        g._eatCooldown = 0;
        g.spawnFood("rareplant", g.player.x, g.player.y, 0, {
          powerup: "damage",
        });
      });
      await page.keyboard.press("KeyE");
      await page.waitForFunction(() => window.__JD.game.buffs.damage > 0);
      await page
        .locator("#active-buffs")
        .filter({ hasText: "Blood Orchid" })
        .waitFor();
      await page.evaluate(() => {
        const g = window.__JD.game;
        g._eatCooldown = 0;
        g.spawnFood("relic", g.player.x, g.player.y, 0, { skillId: "meteor" });
      });
      await page.keyboard.press("KeyE");
      await page.waitForFunction(() => window.__JD.game.runSkills.length === 1);
      await page.keyboard.press("KeyF");
      await page.waitForFunction(
        () => window.__JD.game.runSkills[0].cooldown > 0,
      );
      await page.evaluate(() => {
        const g = window.__JD.game;
        g._eatCooldown = 0;
        g.spawnFood("fossil", g.player.x, g.player.y, 0, {
          rewardType: "skin",
          rewardId: "obsidian",
        });
      });
      await page.keyboard.press("KeyE");
      await page.waitForFunction(() =>
        window.__JD.profile.skins.includes("obsidian"),
      );
    },
  );
  await check(
    "world map expands and accepts a real navigation waypoint",
    async () => {
      await page.keyboard.press("KeyM");
      await page.waitForFunction(
        () => document.getElementById("minimap").mapView?.range === 1600,
      );
      const box = await page.locator("#minimap").boundingBox();
      await page.mouse.click(
        box.x + box.width * 0.6,
        box.y + box.height * 0.45,
      );
      await page.waitForFunction(() => window.__JD.game.waypoint);
      await page.screenshot({ path: "artifacts/world-map.png" });
      await page.keyboard.press("KeyM");
    },
  );
  await check(
    "all eight tiers render and the final form can ascend",
    async () => {
      for (let tier = 2; tier <= 7; tier++) {
        await page.evaluate(() =>
          window.__JD.game.gainXP(window.__JD.game.nextThreshold),
        );
        await page.waitForFunction(() => window.__JD.ui.view === "evolution");
        const dragon = page.locator(
          '[data-species="elder-dragon"], [data-species="wyvern"], [data-species="world-serpent"]',
        );
        if (await dragon.count()) await dragon.first().click();
        await page.getByRole("button", { name: /EMBRACE EVOLUTION/ }).click();
        await page.waitForFunction(
          (t) => window.__JD.game.tier === t && window.__JD.ui.view === "hud",
          tier,
        );
      }
      await page.waitForFunction(() =>
        document.getElementById("hud-tier").textContent.includes("TIER 8"),
      );
      await page.waitForTimeout(200);
      await page.screenshot({ path: "artifacts/mythic.png" });
      await page.evaluate(() =>
        window.__JD.game.gainXP(window.__JD.game.nextThreshold),
      );
      await page.waitForFunction(() => window.__JD.ui.view === "evolution");
      await page.getByRole("button", { name: /EMBRACE EVOLUTION/ }).click();
      await page.waitForFunction(
        () =>
          window.__JD.game.ascensions === 1 && window.__JD.ui.view === "hud",
      );
      assert(
        await page.evaluate(() =>
          window.__JD.world.models
            .get("player")
            .children.every((child) => Number.isFinite(child.position.x)),
        ),
      );
    },
  );
  await check(
    "every signature ability renders its own effects without runtime errors",
    async () => {
      const count = await page.evaluate(async () => {
        const { SPECIES } = await import("/src/data.js");
        const { ABILITIES } = await import("/src/content.js");
        const g = window.__JD.game,
          w = window.__JD.world;
        for (const type of Object.keys(ABILITIES)) {
          const s = SPECIES.find((s) => s.abilityType === type);
          g.state = "playing";
          g.player.speciesId = s.id;
          g.tier = s.tier;
          g.refreshStats(true);
          g.player.stamina = 100;
          g.player.abilityCooldown = 0;
          g.entities = [];
          const target = g.spawnEntity(
            "primordial-titan",
            g.player.x + 8,
            g.player.y,
            { passive: true },
          );
          target.hp = 99999;
          g.ability();
          for (const event of g.consumeEvents()) w.event(event);
          w.render(g, 1 / 60, false);
        }
        g.state = "playing";
        g.tier = 7;
        g.player.speciesId = "elder-dragon";
        g.player.xp = 0;
        g.refreshStats(true);
        return Object.keys(ABILITIES).length;
      });
      assert.equal(count, 14);
    },
  );
  await check(
    "enemy skills render red telegraphs before resolving",
    async () => {
      await page.evaluate(() => {
        const g = window.__JD.game;
        g.entities = [];
        g.player.invulnerable = 10;
        const e = g.spawnEntity("frost-dragon", g.player.x + 12, g.player.y, {
          passive: false,
        });
        e.skillCooldown = 0;
      });
      await page.waitForFunction(() => window.__JD.world.warnings.size > 0);
      await page.screenshot({ path: "artifacts/red-telegraph.png" });
    },
  );
  await check(
    "distant regions stream terrain and alpha hunts display real health",
    async () => {
      await page.evaluate(() => {
        const g = window.__JD.game;
        g._nextBoss = 0;
        g.player.x = 1300;
        g.player.y = 0;
        g.player.invulnerable = 10;
      });
      await page.locator("#alpha-boss").waitFor({ state: "visible" });
      await page.waitForFunction(
        () =>
          document.getElementById("hud-threat").textContent !==
          "ECOSYSTEM STABLE",
      );
      assert(await page.locator("#alpha-boss strong").textContent());
      assert(
        await page.evaluate(() => window.__JD.world.terrain.chunks.size <= 9),
      );
    },
  );
  await check(
    "death preserves one-time DNA rewards and retry starts a fresh egg",
    async () => {
      await page.evaluate(() =>
        window.__JD.game.damagePlayer(99999, "QA predator", true),
      );
      await page.waitForFunction(() => window.__JD.ui.view === "death");
      const p = await page.evaluate(() => ({
        runs: window.__JD.profile.runs,
        dna: window.__JD.profile.dna,
      }));
      assert.equal(p.runs, 1);
      assert(p.dna > 0);
      await page.screenshot({ path: "artifacts/death.png" });
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => window.__JD.profile.runs), 1);
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.__JD.game.state === "egg");
    },
  );
  await check("profile survives reload", async () => {
    const dna = await page.evaluate(() => window.__JD.profile.dna);
    await page.reload();
    await page.waitForFunction(() => window.__JD?.ui?.view === "menu");
    assert.equal(await page.evaluate(() => window.__JD.profile.dna), dna);
  });
  await check(
    "legacy purchase spends earned DNA and persists the actual upgrade",
    async () => {
      await page.getByRole("button", { name: /THE ANCESTRAL LEGACY/ }).click();
      const before = await page.evaluate(() => window.__JD.profile.dna);
      await page.locator('[data-upgrade="vitality"]').click();
      assert.equal(
        await page.evaluate(() => window.__JD.profile.dna),
        before - 3,
      );
      assert.equal(
        await page.evaluate(() => window.__JD.profile.upgrades.vitality),
        1,
      );
      await page.reload();
      await page.waitForFunction(() => window.__JD?.ui?.view === "menu");
      assert.equal(
        await page.evaluate(() => window.__JD.profile.upgrades.vitality),
        1,
      );
    },
  );
  await check(
    "earned skins can be equipped and survive reloading",
    async () => {
      await page
        .getByRole("button", { name: /APPEARANCE & ANCIENT RELICS/ })
        .click();
      await page.locator('[data-skin="obsidian"]').click();
      assert.equal(
        await page.evaluate(() => window.__JD.profile.equippedSkin),
        "obsidian",
      );
      await page.screenshot({ path: "artifacts/wardrobe.png" });
      await page.reload();
      await page.waitForFunction(() => window.__JD?.ui?.view === "menu");
      assert.equal(
        await page.evaluate(() => window.__JD.profile.equippedSkin),
        "obsidian",
      );
      assert.equal(
        await page.evaluate(() => window.__JD.world.menuDino.userData.skinId),
        "obsidian",
      );
    },
  );
  await check("800 x 600 layout stays inside the viewport", async () => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.screenshot({ path: "artifacts/title-800.png" });
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const rect = await page
      .getByRole("button", { name: /BEGIN A NEW LIFE/ })
      .boundingBox();
    assert(rect.y >= 0 && rect.y + rect.height <= 600);
  });
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/qa-report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(
    `${checks.length} browser integration checks passed, zero runtime errors.`,
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/qa-failure.png" }).catch(() => {});
  console.error("Browser errors:", errors);
  throw error;
} finally {
  await browser.close();
}
