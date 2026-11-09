import { SPECIES_BY_ID } from "./data.js";
import { biomeAt, WORLD_RADIUS } from "./world-data.js";

export const OBJECTIVE_STAGES = [
  {
    id: "hatch",
    title: "Break Free from the Egg",
    hint: "Press E or click 'CRACK THE SHELL' to hatch into the prehistoric continent.",
    check: (g) => g.state === "egg",
    progress: (g) => Math.min(1, (g.eggTime || 0) / 3),
    text: (g) => `${Math.round(Math.min(1, (g.eggTime || 0) / 3) * 100)}%`,
    nextGoal: "Hatch into your starter species",
  },
  {
    id: "sustenance",
    title: "Find Food & Nourishment",
    hint: "Forage berries and safe plants, or hunt small prey inside the basin. Hold E near food.",
    check: (g) => (g.player.nutrients || 0) < 12 && (g.player.xp || 0) < 10,
    progress: (g) => Math.min(1, (g.player.nutrients || 0) / 12),
    text: (g) => `${Math.floor(g.player.nutrients || 0)} / 12 Nutrients`,
    nextGoal: "Consume 12 nutrients to build early vitality",
  },
  {
    id: "roar",
    title: "Sound Your Primal Roar",
    hint: "Press C to roar: discover surrounding wildlife, communicate, and intimidate skittish prey.",
    check: (g) => !g._hasRoared && (g.player.kills || 0) === 0 && (g.time || 0) < 90,
    progress: (g) => (g._hasRoared ? 1 : 0),
    text: (g) => (g._hasRoared ? "Roared!" : "Press C"),
    nextGoal: "Test your roar to establish territory presence",
  },
  {
    id: "basin-survival",
    title: "Survive in the Safe Basin",
    hint: "Remain in the central nursery basin (radius < 55) where apex predators do not hunt.",
    check: (g) => (g.time || 0) < 50 && (g.player.xp || 0) < (g.nextThreshold || 60) * 0.7,
    progress: (g) => Math.min(1, (g.time || 0) / 50),
    text: (g) => `${Math.floor(g.time || 0)}s / 50s`,
    nextGoal: "Survive your first 50 seconds in safety",
  },
  {
    id: "biomass",
    title: "Gather Biomass & DNA",
    hint: "Hunt prey and forage plants to gain XP toward your first evolutionary leap.",
    check: (g) => (g.tier || 0) === 0 && (g.player.xp || 0) < (g.nextThreshold || 60) && !g.evolutionReady,
    progress: (g) => Math.min(1, (g.player.xp || 0) / Math.max(1, g.nextThreshold || 60)),
    text: (g) => `${Math.floor(g.player.xp || 0)} / ${Math.floor(g.nextThreshold || 60)} XP`,
    nextGoal: (g) => `Fill XP bar to ${Math.floor(g.nextThreshold || 60)}`,
  },
  {
    id: "first-evolution",
    title: "Embrace Evolution",
    hint: "Your biomass threshold is reached! Press T to choose your next species and mutation.",
    check: (g) => (g.tier || 0) === 0 && (g.evolutionReady || g.state === "evolution"),
    progress: () => 1,
    text: () => "READY · Press T",
    nextGoal: "Evolve into a Tier 2 species",
  },
  {
    id: "wild-frontier",
    title: "Venture Beyond the Basin",
    hint: "You have grown strong enough. Cross the basin perimeter (radius > 55) to explore wild biomes.",
    check: (g) => (g.tier || 0) >= 1 && Math.hypot(g.player.x, g.player.y) < 55,
    progress: (g) => Math.min(1, Math.hypot(g.player.x, g.player.y) / 55),
    text: (g) => `${Math.floor(Math.hypot(g.player.x, g.player.y))}m / 55m`,
    nextGoal: "Step outside the Hatching Basin into the wild",
  },
  {
    id: "predator-mastery",
    title: "Hunt or Defend Territory",
    hint: "Aim with the mouse and bite with LMB. Dodge enemy attacks with Shift or defensive skills.",
    check: (g) => (g.player.kills || 0) < 3,
    progress: (g) => Math.min(1, (g.player.kills || 0) / 3),
    text: (g) => `${g.player.kills || 0} / 3 Kills`,
    nextGoal: "Defeat 3 wild creatures or predators",
  },
  {
    id: "ancient-discovery",
    title: "Explore Continental Regions",
    hint: "Discover 3 distinct continental biomes or locate an ancient fossil or named Lair Guardian.",
    check: (g) => (g.guardianKills || 0) === 0 && (g.discoveredRegions?.size || 0) < 3,
    progress: (g) => Math.min(1, (g.discoveredRegions?.size || 0) / 3),
    text: (g) => `${g.discoveredRegions?.size || 0} / 3 Regions`,
    nextGoal: "Discover 3 distinct continental biomes",
  },
  {
    id: "apex-dominance",
    title: "Apex Continental Dominance",
    hint: "Climb to higher evolutionary tiers, defeat Alpha Lair Guardians, and uncover ancient bloodlines.",
    check: () => true,
    progress: (g) => Math.min(1, (g.player.xp || 0) / Math.max(1, g.nextThreshold || 100)),
    text: (g) => `Tier ${(g.tier || 0) + 1} · XP ${Math.floor(g.player.xp || 0)} / ${Math.floor(g.nextThreshold || 100)}`,
    nextGoal: (g) => (g.evolutionReady ? "Press T to evolve" : `Reach Tier ${(g.tier || 0) + 2}`),
  },
];

export function evaluateObjectives(game, profile = null) {
  if (!game || !game.player) {
    return {
      step: 1,
      totalSteps: OBJECTIVE_STAGES.length,
      stageId: "hatch",
      title: "Break Free from the Egg",
      hint: "Press E or click to hatch.",
      progress: 0,
      progressText: "0%",
      isComplete: false,
      nextGoal: "Hatch into your starter species",
      danger: { level: "SAFE", percent: 0, label: "🌿 SAFE BASIN", color: "#6ade88" },
      regionHazard: { isDangerous: false, tierDiff: 0 },
    };
  }

  let activeIndex = 0;
  for (let i = 0; i < OBJECTIVE_STAGES.length; i++) {
    const stage = OBJECTIVE_STAGES[i];
    if (stage.check(game)) {
      activeIndex = i;
      break;
    }
  }

  const currentStage = OBJECTIVE_STAGES[activeIndex];
  const progress = Math.max(0, Math.min(1, currentStage.progress(game)));
  const progressText = currentStage.text(game);
  const nextGoal = typeof currentStage.nextGoal === "function" ? currentStage.nextGoal(game) : currentStage.nextGoal;

  const danger = evaluateDanger(game);
  const regionHazard = evaluateRegionHazard(game);

  return {
    step: activeIndex + 1,
    totalSteps: OBJECTIVE_STAGES.length,
    stageId: currentStage.id,
    title: currentStage.title,
    hint: currentStage.hint,
    progress,
    progressText,
    isComplete: activeIndex >= OBJECTIVE_STAGES.length - 1 && game.evolutionReady,
    nextGoal,
    danger,
    regionHazard,
  };
}

export function evaluateDanger(game) {
  if (!game || !game.player) {
    return { level: "SAFE", percent: 0, label: "🌿 SAFE BASIN", color: "#6ade88", apexCount: 0, hunterCount: 0 };
  }

  const p = game.player;
  const inBasin = Math.hypot(p.x, p.y) < 55;
  let apexCount = 0;
  let hunterCount = 0;

  for (const e of game.entities || []) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d > 35) continue;
    const s = SPECIES_BY_ID[e.speciesId];
    if (!s) continue;
    if (e.boss || s.tier >= (game.tier || 0) + 2) {
      apexCount++;
    }
    if (e.intent === "hunt" || (e.aggro || 0) > 0 || (e.charging || 0) > 0) {
      hunterCount++;
    }
  }

  let rawDanger = (game.danger || 0);
  if (apexCount > 0) rawDanger = Math.max(rawDanger, 0.75 + apexCount * 0.08);
  if (hunterCount > 0) rawDanger = Math.max(rawDanger, 0.55 + hunterCount * 0.1);
  if (inBasin && rawDanger > 0.35 && apexCount === 0) rawDanger = 0.25;

  const percent = Math.max(0, Math.min(1, rawDanger));
  let level = "SAFE";
  let label = "🌿 SAFE BASIN";
  let color = "#6ade88";

  if (percent >= 0.82) {
    level = "APEX";
    label = "💀 LETHAL APEX THREAT";
    color = "#ef4444";
  } else if (percent >= 0.62) {
    level = "HIGH";
    label = "⚔️ HIGH PREDATOR DANGER";
    color = "#f97316";
  } else if (percent >= 0.40) {
    level = "CAUTION";
    label = "⚠️ CAUTION · PREDATORS NEAR";
    color = "#eab308";
  } else if (percent >= 0.20) {
    level = "LOW";
    label = "🌾 ECOSYSTEM STABLE";
    color = "#a3e635";
  } else {
    level = "SAFE";
    label = inBasin ? "🌿 NURSERY BASIN SAFE" : "🌿 LOW THREAT";
    color = "#4ade80";
  }

  return { level, percent, label, color, apexCount, hunterCount };
}

export function evaluateRegionHazard(game) {
  if (!game || !game.player) {
    return { isDangerous: false, tierDiff: 0, regionTier: 0, playerTier: 0, regionName: "Fern Meadow", warningTitle: "", warningDesc: "" };
  }

  const p = game.player;
  const region = biomeAt(p.x, p.y);
  const regionTier = region.tier || 0;
  const playerTier = game.tier || 0;
  const tierDiff = regionTier - playerTier;
  const isDangerous = tierDiff >= 2;

  let warningTitle = "";
  let warningDesc = "";
  if (isDangerous) {
    warningTitle = `⚠️ HAZARDOUS BIOME · ${region.name.toUpperCase()} (TIER ${regionTier + 1})`;
    warningDesc = `This region contains Tier ${regionTier + 1} apex creatures. Your current form is Tier ${playerTier + 1}. Extreme caution advised!`;
  }

  return {
    isDangerous,
    tierDiff,
    regionTier,
    playerTier,
    regionName: region.name,
    warningTitle,
    warningDesc,
  };
}

export function evaluateCreatureThreat(entity, game) {
  const species = SPECIES_BY_ID[entity.speciesId];
  if (!species) {
    return {
      threatTier: "fair",
      symbol: "⚔️",
      threatLabel: "UNKNOWN",
      behavior: "neutral",
      behaviorLabel: "NEUTRAL",
      badgeClass: "threat-fair",
      threatColor: "#eab308",
    };
  }

  const playerTier = game?.tier || 0;
  const tierDiff = species.tier - playerTier;

  let threatTier = "fair";
  let symbol = "⚔️";
  let threatLabel = "FAIR MATCH";
  let badgeClass = "threat-fair";
  let threatColor = "#eab308";

  if (entity.boss || tierDiff >= 2) {
    threatTier = "lethal";
    symbol = "💀";
    threatLabel = entity.boss ? "LETHAL APEX" : "LETHAL";
    badgeClass = "threat-lethal";
    threatColor = "#ef4444";
  } else if (tierDiff === 1) {
    threatTier = "danger";
    symbol = "⚠️";
    threatLabel = "DANGEROUS";
    badgeClass = "threat-danger";
    threatColor = "#f97316";
  } else if (tierDiff === 0) {
    threatTier = "fair";
    symbol = "⚔️";
    threatLabel = "FAIR MATCH";
    badgeClass = "threat-fair";
    threatColor = "#eab308";
  } else {
    threatTier = "prey";
    symbol = "🌿";
    threatLabel = "PREY";
    badgeClass = "threat-prey";
    threatColor = "#4ade80";
  }

  if (entity.eliteMutation) {
    const eliteIcons = { Blazing: "🔥", Venomous: "☣️", Armored: "🛡️", Frost: "❄️", Berserk: "👹" };
    symbol = eliteIcons[entity.eliteMutation] || "⚡";
    threatLabel = `${entity.eliteMutation.toUpperCase()} ELITE`;
    threatTier = tierDiff >= 0 ? "lethal" : "danger";
    badgeClass = `threat-${threatTier} elite-${entity.eliteMutation.toLowerCase()}`;
    threatColor = entity.eliteMutation === "Blazing" ? "#f97316"
      : entity.eliteMutation === "Venomous" ? "#22c55e"
      : entity.eliteMutation === "Armored" ? "#38bdf8"
      : entity.eliteMutation === "Frost" ? "#06b6d4"
      : "#ef4444";
  }

  let behavior = "neutral";
  let behaviorLabel = "🌾 NEUTRAL";
  if ((entity.charging || 0) > 0 || (entity.chargeWindup || 0) > 0) {
    behavior = "charge";
    behaviorLabel = "⚡ CHARGING!";
  } else if ((entity.telegraph || 0) > 0) {
    behavior = "strike";
    behaviorLabel = "💥 ATTACK IMMINENT!";
  } else if (entity.cast) {
    behavior = "cast";
    behaviorLabel = `🔮 ${String(entity.cast.kind || "SPECIAL").toUpperCase()}`;
  } else if (entity.inTree) {
    behavior = "ambush";
    behaviorLabel = "🌲 AMBUSH STALKER";
  } else if (entity.intent === "hunt" || (entity.aggro || 0) > 0) {
    behavior = "hunt";
    behaviorLabel = "🎯 HUNTING YOU";
  } else if (entity.intent === "fight") {
    behavior = "fight";
    behaviorLabel = "⚔️ CLASHING";
  } else if (entity.intent === "flee" || (entity.fear || 0) > 0) {
    behavior = "flee";
    behaviorLabel = "💨 FLEEING";
  } else if (entity.isSleeping || (entity.sleeping || 0) > 0) {
    behavior = "sleep";
    behaviorLabel = "💤 SLEEPING";
  } else if (entity.packId) {
    behavior = "pack";
    behaviorLabel = `🐺 PACK (${entity.groupRole || "member"})`;
  } else if (entity.intent === "graze" || entity.behavior === "neutral") {
    behavior = "graze";
    behaviorLabel = "🌾 NEUTRAL GRAZER";
  }

  return {
    threatTier,
    symbol,
    threatLabel,
    behavior,
    behaviorLabel,
    badgeClass,
    threatColor,
    isApex: entity.boss || tierDiff >= 2,
    isInjured: entity.hp < entity.maxHp * 0.85,
    eliteMutation: entity.eliteMutation || null,
  };
}

export function getSurvivalHint(game) {
  if (!game || !game.player) return "";
  const p = game.player;

  if (p.hunger <= 25) {
    return "🔴 STARVATION IMMINENT: Scent or forage food immediately! Press E near plants/carcasses.";
  }
  if (game.evolutionReady) {
    return "✨ EVOLUTION READY: Press T or click the indicator to evolve into a stronger species.";
  }
  if (p.hp < p.maxHp * 0.35) {
    return "❤️ CRITICAL VITALITY: Retreat to the Hatching Basin or safe cover and eat to heal.";
  }
  if (Math.hypot(p.x, p.y) > WORLD_RADIUS - 45) {
    return "🌋 VOLCANIC BORDER: You are reaching the dangerous continent edge. Turn back toward the center.";
  }
  const danger = evaluateDanger(game);
  if (danger.level === "APEX") {
    return "💀 APEX PREDATOR IN VICINITY: Do not engage head-on! Use sprint or camouflage to evade.";
  }
  const hazard = evaluateRegionHazard(game);
  if (hazard.isDangerous) {
    return `⚠️ HIGH HAZARD REGION: ${hazard.regionName} is Tier ${hazard.regionTier + 1}. Recommend evolving first.`;
  }

  const obj = evaluateObjectives(game);
  return obj.hint;
}
