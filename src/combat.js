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
  const reach =
    (body === "longneck"
      ? 4.8
      : body === "serpent"
        ? 3.8
        : body === "quad"
          ? 2.5
          : 1.3) +
    s.size * 0.62;
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
