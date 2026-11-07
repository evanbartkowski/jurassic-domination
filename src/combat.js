export function attackProfile(s) {
  const type = s.abilityType,
    body = s.body;
  const ranged = [
    "flame",
    "venom",
    "frost",
    "lightning",
    "web",
    "nova",
  ].includes(type);
  const baseReach =
    body === "longneck"
      ? 5.2
      : body === "serpent"
        ? 4.2
        : body === "quad"
          ? 3.2
          : body === "marine"
            ? 3.5
            : 2.2;
  const reach = baseReach + (s.size >= 3.0 ? s.size * 1.55 : s.size * 0.95);
  return {
    reach,
    windup: body === "longneck" ? 0.24 : body === "quad" ? 0.17 : 0.1,
    cooldown: body === "bird" ? 0.65 : body === "serpent" ? 0.8 : 0.92,
    ranged,
    range: ranged
      ? (type === "lightning" ? 29 : type === "flame" ? 24 : 19) + s.size
      : reach + 4,
    projectileSpeed: type === "lightning" ? 40 : type === "flame" ? 27 : 20,
  };
}

const EPSILON = 1e-8;
/** Earliest contact on a swept segment; returns a fraction in [0, 1]. */
export function segmentCircleHit(start, end, center, radius, allowEscape = false) {
  const dx = end.x - start.x, dy = end.y - start.y,
    ox = start.x - center.x, oy = start.y - center.y,
    a = dx * dx + dy * dy, c = ox * ox + oy * oy - radius * radius,
    outward = ox * dx + oy * dy;
  if (c < -EPSILON) {
    // An overlapping spawn can escape outwards, but cannot cross the obstacle
    // through its center. This also prevents a trapped animal being imprisoned.
    if (allowEscape && outward >= -EPSILON) return null;
    return 0;
  }
  if (a <= EPSILON) return c <= EPSILON ? 0 : null;
  if (Math.abs(c) <= EPSILON && outward >= 0) return null;
  const b = 2 * outward, discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  return t >= -EPSILON && t <= 1 + EPSILON ? Math.max(0, Math.min(1, t)) : null;
}

/** Same circular footprints and body padding used by resolveObstacles. */
export function obstaclePadding(size) {
  return Math.min(3, Math.max(0, size || 0) * 0.35);
}
export function firstSolidHit(start, end, features = [], padding = 0, allowEscape = false) {
  let hit = null;
  const minX = Math.min(start.x, end.x) - EPSILON, maxX = Math.max(start.x, end.x) + EPSILON,
    minY = Math.min(start.y, end.y) - EPSILON, maxY = Math.max(start.y, end.y) + EPSILON;
  for (const feature of features) {
    if (!feature.solid) continue;
    const radius = feature.radius + padding;
    // Most active-chunk solids are far from a single footstep or strike. This
    // conservative broad phase preserves swept/tangent contacts without doing
    // a quadratic intersection for every distant obstacle and every creature.
    if (feature.x + radius < minX || feature.x - radius > maxX ||
        feature.y + radius < minY || feature.y - radius > maxY) continue;
    const t = segmentCircleHit(start, end, feature, radius, allowEscape);
    if (t !== null && (!hit || t < hit.t)) hit = { t, feature };
  }
  return hit;
}
export function hasLineOfSight(start, end, features = []) {
  return firstSolidHit(start, end, features) === null;
}

// Shockwaves, sound and explicitly radial magic can wrap around cover. Bites,
// tails, lunges, aimed elemental cones and chain lightning require a clear ray.
const areaAttacks = new Set(["stomp", "roar", "nova", "quake", "wind", "heal", "meteor", "soulstorm", "thunder", "timewarp"]);
export function attackLineClear(start, end, features = [], kind = null) {
  return areaAttacks.has(kind) || hasLineOfSight(start, end, features);
}

/** Move a finite body without tunneling through a blocking solid. */
export function sweepMove(actor, dx, dy, size, features = []) {
  const start = { x: actor.x, y: actor.y }, end = { x: actor.x + dx, y: actor.y + dy },
    hit = firstSolidHit(start, end, features, obstaclePadding(size), true),
    length = Math.hypot(dx, dy),
    fraction = hit ? Math.max(0, hit.t - (length > EPSILON ? 0.001 / length : 0)) : 1;
  actor.x = start.x + dx * fraction;
  actor.y = start.y + dy * fraction;
  return { hit: hit?.feature || null, fraction };
}
