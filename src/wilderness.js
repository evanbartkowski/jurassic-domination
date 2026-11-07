import {
  seeded,
  chunkSeed,
  biomeAt,
  CHUNK_SIZE,
  WORLD_RADIUS,
} from "./world-data.js";
export function worldFeatures(seed, cx, cy) {
  const random = seeded(chunkSeed(seed, cx, cy) ^ 0x6a983b),
    items = [];
  for (let i = 0; i < 15; i++) {
    const x = (cx + 0.08 + random() * 0.84) * CHUNK_SIZE,
      y = (cy + 0.08 + random() * 0.84) * CHUNK_SIZE;
    if (Math.hypot(x, y) < 55 || Math.hypot(x, y) > WORLD_RADIUS - 20) continue;
    const region = biomeAt(x, y),
      type =
        i < 5
          ? "boulder"
          : i < 7
            ? "fallen-log"
            : i === 7
              ? "landmark"
              : i === 8
                ? region.id === "volcano"
                  ? "volcano"
                  : "water"
                : i < 11
                  ? "mushrooms"
                  : i < 13
                    ? "toxic-bloom"
                    : "carnivore";
    const radius =
      type === "water"
        ? 12 + random() * 5
        : type === "volcano"
          ? 12
          : type === "boulder"
            ? 1.8 + random() * 2
            : type === "fallen-log"
              ? 3.5
              : type === "landmark"
                ? 4
                : type === "carnivore"
                  ? 2
                  : 1.5;
    items.push({
      id: `${cx},${cy}:${i}`,
      type,
      x,
      y,
      radius,
      tier: region.tier,
      solid: ["boulder", "fallen-log", "landmark"].includes(type),
      phase: random() * 6.28,
    });
  }
  return items.filter(
    (f) =>
      ["water", "volcano"].includes(f.type) ||
      !items.some(
        (other) =>
          ["water", "volcano"].includes(other.type) &&
          Math.hypot(f.x - other.x, f.y - other.y) <
            other.radius + f.radius + 2,
      ),
  );
}
export function resolveObstacles(actor, size, features) {
  for (const f of features) {
    if (!f.solid) continue;
    const dx = actor.x - f.x,
      dy = actor.y - f.y,
      d = Math.hypot(dx, dy),
      r = f.radius + Math.min(3, size * 0.35);
    if (d < r) {
      const angle = d > 0.001 ? Math.atan2(dy, dx) : 0;
      actor.x = f.x + Math.cos(angle) * r;
      actor.y = f.y + Math.sin(angle) * r;
    }
  }
}
export function marinePose(f, time, index, player) {
  const a = time * (0.3 + index * 0.07) + index * 2.1 + f.phase,
    r = f.radius * (0.45 + index * 0.12);
  const inside =
    player && Math.hypot(player.x - f.x, player.y - f.y) < f.radius;
  const blend = inside
    ? 0.72 + 0.22 * Math.sin(time * 1.8 + f.phase + index)
    : 0;
  const x =
      f.x +
      Math.cos(a) * r * (1 - blend) +
      (inside ? (player.x - f.x) * blend : 0),
    y =
      f.y +
      Math.sin(a) * r * (1 - blend) +
      (inside ? (player.y - f.y) * blend : 0);
  return {
    x,
    y,
    angle: inside ? Math.atan2(player.y - y, player.x - x) : a + Math.PI / 2,
  };
}
export function updateWildlife(game, dt) {
  const p = game.player,
    features = game.worldFeatures || [];
  resolveObstacles(p, game.species.size, features);
  game._hazardCooldown = Math.max(0, (game._hazardCooldown || 0) - dt);
  game.hazardHint = "";
  for (const f of features) {
    const d = Math.hypot(p.x - f.x, p.y - f.y);
    if (d > f.radius + 8) continue;
    if (f.type === "water" && d < f.radius) {
      p.vx *= Math.exp(-dt * 2.7);
      p.vy *= Math.exp(-dt * 2.7);
      game.hazardHint = "DEEP WATER · MARINE PREDATORS";
      if (
        game._hazardCooldown === 0 &&
        [0, 1, 2].some((i) => {
          const fish = marinePose(f, game.time, i, p);
          return (
            Math.hypot(fish.x - p.x, fish.y - p.y) <
            2.7 + game.species.size * 0.3
          );
        })
      ) {
        game.damagePlayer(
          (9 + f.tier * 5) * game.rules.enemyDamage,
          "Marine ambush",
        );
        game._hazardCooldown = 1.2;
        game.emit("water-bite", { x: p.x, y: p.y });
      }
    }
    if (["toxic-bloom", "mushrooms"].includes(f.type) && d < f.radius + 1) {
      game.hazardHint =
        f.type === "mushrooms" ? "TOXIC SPORES" : "POISONOUS BLOOM";
      p.poisoned = Math.max(p.poisoned, 4);
    }
    if (f.type === "carnivore" && d < f.radius + 5) {
      game.hazardHint = "CARNIVOROUS PLANT";
      if (d < f.radius + 2.8 && game._hazardCooldown === 0) {
        game.damagePlayer(
          (7 + f.tier * 4) * game.rules.enemyDamage,
          "Snapjaw pitcher",
        );
        p.poisoned = 2;
        game._hazardCooldown = 0.85;
        game.emit("plant-bite", { x: f.x, y: f.y });
      }
    }
    if (f.type === "volcano" && d < f.radius) {
      game.hazardHint = "ACTIVE CALDERA";
      if (game._hazardCooldown === 0) {
        game.damagePlayer(15 + f.tier * 5, "Caldera heat");
        game._hazardCooldown = 0.65;
      }
    }
  }
}
