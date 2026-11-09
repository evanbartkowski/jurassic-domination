/**
 * Dinosaur Build & Mutation Synergy System
 * 
 * Four upgrade categories:
 * - Offensive Mutations (up to 4 equipped, levels 1-5)
 * - Defensive Adaptations (up to 4 equipped, levels 1-5)
 * - Passive Abilities (up to 4 equipped, levels 1-5)
 * - Rare Transformations & Combinations (Synergies with transformative audiovisual payoffs)
 */

export const BUILD_CATEGORIES = {
  offensive: {
    id: "offensive",
    name: "Offensive Mutations",
    description: "Lethal claws, fangs, projectiles, and element-infused strikes.",
    icon: "⚔️",
    color: "#f87171",
    border: "#ef4444",
    bg: "rgba(239, 68, 68, 0.15)",
    maxEquipped: 4,
  },
  defensive: {
    id: "defensive",
    name: "Defensive Adaptations",
    description: "Hardened carapaces, regenerative tissue, reflective scales, and shields.",
    icon: "🛡️",
    color: "#38bdf8",
    border: "#0284c7",
    bg: "rgba(56, 189, 248, 0.15)",
    maxEquipped: 4,
  },
  passive: {
    id: "passive",
    name: "Passive Abilities",
    description: "Instinctual speed, XP attraction, critical strikes, and pack coordination.",
    icon: "⚡",
    color: "#fbbf24",
    border: "#d97706",
    bg: "rgba(251, 191, 36, 0.15)",
    maxEquipped: 4,
  },
  transformations: {
    id: "transformations",
    name: "Rare Transformations & Synergies",
    description: "Anatomical mutations and powerful combo ultimates that reshape combat.",
    icon: "🧬",
    color: "#c084fc",
    border: "#9333ea",
    bg: "rgba(192, 132, 252, 0.2)",
    maxEquipped: 2,
  },
};

export const BUILD_MUTATIONS = {
  // === OFFENSIVE MUTATIONS (Levels 1-5) ===
  serratedFangs: {
    id: "serratedFangs",
    category: "offensive",
    name: "Serrated Fangs",
    rarity: "common",
    icon: "🦷",
    levels: [
      { level: 1, desc: "Bites tear flesh, dealing +15% damage as bleeding over 3s.", bleedDmg: 0.15, duration: 3 },
      { level: 2, desc: "Bites tear flesh, dealing +30% damage as bleeding over 3.5s.", bleedDmg: 0.30, duration: 3.5 },
      { level: 3, desc: "Bites tear flesh, dealing +45% damage as bleeding over 4s.", bleedDmg: 0.45, duration: 4 },
      { level: 4, desc: "Bites tear flesh, dealing +60% damage as bleeding with +15% bite speed.", bleedDmg: 0.60, duration: 4, biteSpeed: 0.15 },
      { level: 5, desc: "MAX: Deep lacerations deal +80% bleed damage and slow bleeding prey by 25%. Combines into HEMORRHAGE!", bleedDmg: 0.80, duration: 4.5, slow: 0.25, biteSpeed: 0.25 },
    ],
  },
  bleedingClaws: {
    id: "bleedingClaws",
    category: "offensive",
    name: "Bleeding Claws",
    rarity: "common",
    icon: "🩸",
    levels: [
      { level: 1, desc: "Attacks inflict lacerations dealing 12% extra damage over 3s.", bleedRate: 0.12 },
      { level: 2, desc: "Attacks inflict lacerations dealing 24% extra damage over 3.5s.", bleedRate: 0.24 },
      { level: 3, desc: "Attacks inflict lacerations dealing 36% extra damage over 4s.", bleedRate: 0.36 },
      { level: 4, desc: "Attacks inflict lacerations dealing 48% extra damage with +20% claw reach.", bleedRate: 0.48, reach: 0.2 },
      { level: 5, desc: "MAX: Vicious claw wounds deal 65% bleed damage; bleeding targets suffer +20% incoming damage.", bleedRate: 0.65, reach: 0.35, vuln: 0.2 },
    ],
  },
  venomSpit: {
    id: "venomSpit",
    category: "offensive",
    name: "Venom Spit",
    rarity: "rare",
    icon: "🧪",
    levels: [
      { level: 1, desc: "Every 4s, spit a venom glob dealing 35 poison damage and slowing target by 20%.", cooldown: 4.0, damage: 35, slow: 0.2 },
      { level: 2, desc: "Spit cooldown reduced to 3.2s; deals 55 poison damage and slows by 30%.", cooldown: 3.2, damage: 55, slow: 0.3 },
      { level: 3, desc: "Spit fires 2 globs in a spread; deals 75 poison damage each.", cooldown: 2.8, damage: 75, slow: 0.35, projectiles: 2 },
      { level: 4, desc: "Spit fires 2 globs; deals 105 poison damage and blinds targets for 2s.", cooldown: 2.4, damage: 105, slow: 0.4, projectiles: 2, blind: 2 },
      { level: 5, desc: "MAX: Triple venom spit dealing 140 poison damage with toxic pools. Combines into PLAGUE CLOUD!", cooldown: 2.0, damage: 140, slow: 0.5, projectiles: 3, toxicPool: true },
    ],
  },
  chainLightning: {
    id: "chainLightning",
    category: "offensive",
    name: "Chain Lightning",
    rarity: "rare",
    icon: "⚡",
    levels: [
      { level: 1, desc: "Melee hits release an electric arc striking 1 nearby secondary foe for 40% damage.", arcs: 1, damageMult: 0.4 },
      { level: 2, desc: "Electric arc strikes up to 2 secondary targets for 50% damage.", arcs: 2, damageMult: 0.5 },
      { level: 3, desc: "Electric arc strikes up to 3 secondary targets for 60% damage with a 15% stun chance.", arcs: 3, damageMult: 0.6, stunChance: 0.15 },
      { level: 4, desc: "Electric arc strikes up to 4 targets for 75% damage and 25% stun chance.", arcs: 4, damageMult: 0.75, stunChance: 0.25 },
      { level: 5, desc: "MAX: Primordial thunder chains across 5 enemies for 95% damage, electrocuting all struck.", arcs: 5, damageMult: 0.95, stunChance: 0.35, electrocute: true },
    ],
  },
  spikedTail: {
    id: "spikedTail",
    category: "offensive",
    name: "Spiked Tail",
    rarity: "common",
    icon: "🦔",
    levels: [
      { level: 1, desc: "Adds a sweeping tail strike hitting behind you for 65% damage with light knockback.", tailDmg: 0.65, knockback: 1.2 },
      { level: 2, desc: "Tail sweep damage increased to 85% with +20% sweep arc and medium knockback.", tailDmg: 0.85, knockback: 1.8 },
      { level: 3, desc: "Tail sweep deals 110% damage, knocking back foes and stunning them for 0.8s.", tailDmg: 1.10, knockback: 2.4, stun: 0.8 },
      { level: 4, desc: "Tail sweep deals 140% damage in a full 360° spin with 1.2s stun.", tailDmg: 1.40, knockback: 3.0, stun: 1.2, fullCircle: true },
      { level: 5, desc: "MAX: Bone-cracking spiked tail deals 180% damage and shatters armor. Combines into SEISMIC SLAM!", tailDmg: 1.80, knockback: 4.0, stun: 1.6, fullCircle: true, armorShatter: 0.4 },
    ],
  },
  chargingHorns: {
    id: "chargingHorns",
    category: "offensive",
    name: "Charging Horns",
    rarity: "rare",
    icon: "🦏",
    levels: [
      { level: 1, desc: "Dashing into enemies deals 50 impact damage and knocks them aside.", impactDmg: 50, knockback: 2.0 },
      { level: 2, desc: "Dash impact deals 85 damage with +25% knockback force.", impactDmg: 85, knockback: 2.8 },
      { level: 3, desc: "Dash impact deals 130 damage; walls slams deal double bonus damage.", impactDmg: 130, knockback: 3.6, wallBonus: 2.0 },
      { level: 4, desc: "Dash impact deals 185 damage and tramples smaller prey.", impactDmg: 185, knockback: 4.5, trample: true },
      { level: 5, desc: "MAX: Colossal ramming impact deals 260 damage and stuns for 1.8s. Combines into JUGGERNAUT!", impactDmg: 260, knockback: 5.5, stun: 1.8, trample: true },
    ],
  },
  fireBreath: {
    id: "fireBreath",
    category: "offensive",
    name: "Fire Breath",
    rarity: "epic",
    icon: "🔥",
    levels: [
      { level: 1, desc: "Every 6s, unleash a fiery cone igniting foes for 40 fire damage over 3s.", cooldown: 6.0, burnDmg: 40, burnDuration: 3 },
      { level: 2, desc: "Fire cone cooldown 5s; deals 70 fire damage over 3.5s.", cooldown: 5.0, burnDmg: 70, burnDuration: 3.5 },
      { level: 3, desc: "Fire cone deals 110 fire damage over 4s with +30% larger area.", cooldown: 4.2, burnDmg: 110, burnDuration: 4, coneScale: 1.3 },
      { level: 4, desc: "Fire cone deals 160 fire damage and melts 30% enemy armor.", cooldown: 3.6, burnDmg: 160, burnDuration: 4.5, meltArmor: 0.3 },
      { level: 5, desc: "MAX: Blazing inferno cone deals 230 fire damage and leaves molten ground. Combines into INFERNO!", cooldown: 3.0, burnDmg: 230, burnDuration: 5, moltenGround: true },
    ],
  },
  boneProjectiles: {
    id: "boneProjectiles",
    category: "offensive",
    name: "Bone Projectiles",
    rarity: "common",
    icon: "🦴",
    levels: [
      { level: 1, desc: "Biting flings 2 sharp bone splinters forward dealing 25 damage each.", splinters: 2, damage: 25 },
      { level: 2, desc: "Flings 3 bone splinters dealing 38 damage each.", splinters: 3, damage: 38 },
      { level: 3, desc: "Flings 3 piercing bone spikes dealing 55 damage that penetrate the first target.", splinters: 3, damage: 55, pierce: 1 },
      { level: 4, desc: "Flings 4 piercing bone spikes dealing 75 damage that penetrate 2 targets.", splinters: 4, damage: 75, pierce: 2 },
      { level: 5, desc: "MAX: Flings 5 razor bone harpoons dealing 110 damage that pierce all targets in a line.", splinters: 5, damage: 110, pierce: 99 },
    ],
  },
  frostBite: {
    id: "frostBite",
    category: "offensive",
    name: "Frost Bite",
    rarity: "rare",
    icon: "❄️",
    levels: [
      { level: 1, desc: "Bites chill victims, slowing movement and attack speed by 20% for 3s.", chillSlow: 0.20, duration: 3 },
      { level: 2, desc: "Chill slow increased to 32% for 3.5s.", chillSlow: 0.32, duration: 3.5 },
      { level: 3, desc: "Chill slow 42% for 4s; consecutive bites stack chill damage.", chillSlow: 0.42, duration: 4, stackBonus: 0.2 },
      { level: 4, desc: "Chill slow 52%; 3 consecutive bites freeze the target solid for 1.2s.", chillSlow: 0.52, duration: 4.5, freezeHitCount: 3, freezeDuration: 1.2 },
      { level: 5, desc: "MAX: Glacial maw slows by 65% and freezes foes for 2s. Combines into GLACIAL FORTRESS!", chillSlow: 0.65, duration: 5, freezeHitCount: 2, freezeDuration: 2.0 },
    ],
  },

  // === DEFENSIVE ADAPTATIONS (Levels 1-5) ===
  thickScales: {
    id: "thickScales",
    category: "defensive",
    name: "Thick Scales",
    rarity: "common",
    icon: "🛡️",
    levels: [
      { level: 1, desc: "Dense dermal scales reduce all incoming damage by 10%.", damageReduction: 0.10 },
      { level: 2, desc: "Damage reduction increased to 16%.", damageReduction: 0.16 },
      { level: 3, desc: "Damage reduction increased to 22% with +15% maximum health.", damageReduction: 0.22, hpBonus: 0.15 },
      { level: 4, desc: "Damage reduction increased to 28% with +25% maximum health.", damageReduction: 0.28, hpBonus: 0.25 },
      { level: 5, desc: "MAX: Ironclad hide reduces damage by 35% and blocks critical hits. Combines into SEISMIC SLAM!", damageReduction: 0.35, hpBonus: 0.35, critImmune: true },
    ],
  },
  regenerativeTissue: {
    id: "regenerativeTissue",
    category: "defensive",
    name: "Regenerative Tissue",
    rarity: "rare",
    icon: "💖",
    levels: [
      { level: 1, desc: "Steadily regenerates 1.2% maximum health every second.", regenRate: 0.012 },
      { level: 2, desc: "Regenerates 2.0% maximum health every second.", regenRate: 0.020 },
      { level: 3, desc: "Regenerates 2.8% maximum health/s; wounds stop bleeding 50% faster.", regenRate: 0.028, bleedCleanse: 0.5 },
      { level: 4, desc: "Regenerates 3.8% maximum health/s; completely immune to bleeding.", regenRate: 0.038, bleedImmune: true },
      { level: 5, desc: "MAX: Hyper-regeneration restores 5.0% max HP/s and halves all negative status durations.", regenRate: 0.050, bleedImmune: true, statusHalved: true },
    ],
  },
  reflectiveArmor: {
    id: "reflectiveArmor",
    category: "defensive",
    name: "Reflective Armor",
    rarity: "rare",
    icon: "🪞",
    levels: [
      { level: 1, desc: "Reflects 15% of incoming damage back to the attacker.", reflectPct: 0.15 },
      { level: 2, desc: "Reflects 25% of incoming damage back to the attacker.", reflectPct: 0.25 },
      { level: 3, desc: "Reflects 35% of incoming damage; reflected hits can stagger attackers.", reflectPct: 0.35, stagger: true },
      { level: 4, desc: "Reflects 45% of incoming damage with retaliatory kinetic flash.", reflectPct: 0.45, stagger: true },
      { level: 5, desc: "MAX: Mirror carapace reflects 60% damage and deflects ranged projectiles.", reflectPct: 0.60, stagger: true, deflectProjectiles: true },
    ],
  },
  thorns: {
    id: "thorns",
    category: "defensive",
    name: "Thorns",
    rarity: "common",
    icon: "🌵",
    levels: [
      { level: 1, desc: "Pointed quills deal 18 retaliatory piercing damage to any melee attacker.", thornDmg: 18 },
      { level: 2, desc: "Retaliatory damage increased to 32 piercing damage.", thornDmg: 32 },
      { level: 3, desc: "Retaliatory damage increased to 50; inflicts bleed on attackers.", thornDmg: 50, bleed: true },
      { level: 4, desc: "Retaliatory damage increased to 72; attackers take +20% recoil knockback.", thornDmg: 72, bleed: true, recoil: 1.5 },
      { level: 5, desc: "MAX: Barbed quill armor deals 100 retaliatory damage and bursts spines on heavy hit.", thornDmg: 100, bleed: true, spineBurst: true },
    ],
  },
  poisonResistance: {
    id: "poisonResistance",
    category: "defensive",
    name: "Poison Resistance",
    rarity: "common",
    icon: "🍃",
    levels: [
      { level: 1, desc: "Takes 35% less damage from venom and environmental poison.", poisonReduction: 0.35 },
      { level: 2, desc: "Takes 55% less damage from venom and poison.", poisonReduction: 0.55 },
      { level: 3, desc: "Takes 75% less damage from venom; poison drains 50% faster.", poisonReduction: 0.75, poisonDuration: 0.5 },
      { level: 4, desc: "Complete 100% immunity to venom and toxic terrain damage.", poisonReduction: 1.0, poisonImmune: true },
      { level: 5, desc: "MAX: Complete venom immunity; eating toxic flora and venomous prey heals you!", poisonImmune: true, toxicAbsorb: true },
    ],
  },
  protectiveBarrier: {
    id: "protectiveBarrier",
    category: "defensive",
    name: "Protective Barrier",
    rarity: "epic",
    icon: "🔮",
    levels: [
      { level: 1, desc: "Every 20s, forms a bone shield absorbing up to 18% of your max HP.", barrierPct: 0.18, cooldown: 20 },
      { level: 2, desc: "Barrier absorbs 26% max HP; cooldown reduced to 17s.", barrierPct: 0.26, cooldown: 17 },
      { level: 3, desc: "Barrier absorbs 34% max HP; cooldown reduced to 14s.", barrierPct: 0.34, cooldown: 14 },
      { level: 4, desc: "Barrier absorbs 42% max HP; breaking the shield emits a blinding flash.", barrierPct: 0.42, cooldown: 11, breakFlash: true },
      { level: 5, desc: "MAX: Aegis shield absorbs 50% max HP every 9s and knocks back nearby foes when broken.", barrierPct: 0.50, cooldown: 9, breakShockwave: true },
    ],
  },
  armoredHide: {
    id: "armoredHide",
    category: "defensive",
    name: "Armored Hide",
    rarity: "rare",
    icon: "🪨",
    levels: [
      { level: 1, desc: "Heavy dermal plates reduce frontal damage by 20% and provide +8 armor.", armor: 8, frontalShield: 0.2 },
      { level: 2, desc: "Reduces frontal damage by 30% and provides +15 armor.", armor: 15, frontalShield: 0.3 },
      { level: 3, desc: "Reduces frontal damage by 40% and deflection angle widens to 180°.", armor: 22, frontalShield: 0.4, wideAngle: true },
      { level: 4, desc: "Reduces frontal damage by 50% with immunity to charge stuns.", armor: 30, frontalShield: 0.5, stunResist: true },
      { level: 5, desc: "MAX: Bastion plating reduces frontal damage by 65%. Combines into GLACIAL FORTRESS!", armor: 40, frontalShield: 0.65, stunResist: true },
    ],
  },
  toxicBlood: {
    id: "toxicBlood",
    category: "defensive",
    name: "Toxic Blood",
    rarity: "rare",
    icon: "☣️",
    levels: [
      { level: 1, desc: "When damaged, sprays acidic blood poisoning attackers for 25 damage.", acidDmg: 25, duration: 3 },
      { level: 2, desc: "Acid blood deals 45 damage and pools briefly on the ground.", acidDmg: 45, duration: 3.5, acidPuddle: true },
      { level: 3, desc: "Acid blood deals 70 damage, slowing attackers by 30%.", acidDmg: 70, duration: 4, slow: 0.3 },
      { level: 4, desc: "Acid blood deals 105 damage and corrodes 25% of attackers' armor.", acidDmg: 105, duration: 4.5, corrode: 0.25 },
      { level: 5, desc: "MAX: Caustic blood deals 150 damage in toxic eruptions. Combines into PLAGUE CLOUD!", acidDmg: 150, duration: 5, corrode: 0.4 },
    ],
  },

  // === PASSIVE ABILITIES (Levels 1-5) ===
  bloodlust: {
    id: "bloodlust",
    category: "passive",
    name: "Bloodlust",
    rarity: "common",
    icon: "🩸",
    levels: [
      { level: 1, desc: "Slaying an animal grants +15% speed and +15% damage for 4s.", speedBonus: 0.15, dmgBonus: 0.15, duration: 4 },
      { level: 2, desc: "Slaying grants +22% speed and +22% damage for 5s.", speedBonus: 0.22, dmgBonus: 0.22, duration: 5 },
      { level: 3, desc: "Slaying grants +30% speed and +30% damage for 6s. Stacks up to 2 times.", speedBonus: 0.30, dmgBonus: 0.30, duration: 6, maxStacks: 2 },
      { level: 4, desc: "Slaying grants +38% speed, +38% damage, and heals 4% max HP. Stacks 2x.", speedBonus: 0.38, dmgBonus: 0.38, duration: 7, maxStacks: 2, killHeal: 0.04 },
      { level: 5, desc: "MAX: Primal frenzy stacks 3x (+50% speed/dmg) with 8% heal on kill. Combines into HEMORRHAGE!", speedBonus: 0.50, dmgBonus: 0.50, duration: 8, maxStacks: 3, killHeal: 0.08 },
    ],
  },
  rapidMetabolism: {
    id: "rapidMetabolism",
    category: "passive",
    name: "Rapid Metabolism",
    rarity: "common",
    icon: "🍖",
    levels: [
      { level: 1, desc: "Food restores 20% more hunger and nutrients; health heals 15% faster while fed.", foodEfficiency: 0.20, fedHeal: 0.15 },
      { level: 2, desc: "Food restores 35% more hunger; hunger depletion rate reduced by 15%.", foodEfficiency: 0.35, hungerDrainReduction: 0.15 },
      { level: 3, desc: "Food restores 50% more hunger; eating immediately heals 10% maximum health.", foodEfficiency: 0.50, eatInstantHeal: 0.10 },
      { level: 4, desc: "Food restores 70% more hunger; hunger drain reduced by 30%.", foodEfficiency: 0.70, hungerDrainReduction: 0.30, eatInstantHeal: 0.15 },
      { level: 5, desc: "MAX: Instant digestion, +100% meal value, and sprint costs 40% less stamina. Combines into INFERNO!", foodEfficiency: 1.00, sprintDiscount: 0.40, eatInstantHeal: 0.20 },
    ],
  },
  packInstinct: {
    id: "packInstinct",
    category: "passive",
    name: "Pack Instinct",
    rarity: "rare",
    icon: "🐺",
    levels: [
      { level: 1, desc: "Summons 1 loyal raptor companion that follows and fights alongside you.", companions: 1, allyBuff: 0.1 },
      { level: 2, desc: "Summons 1 companion with +40% HP and damage; +15% speed near allies.", companions: 1, allyBuff: 0.15, compBuff: 0.4 },
      { level: 3, desc: "Summons 2 loyal companions to form a coordinated hunting pack.", companions: 2, allyBuff: 0.20, compBuff: 0.6 },
      { level: 4, desc: "2 companions with +80% stats; roaring inspires them with +50% fury.", companions: 2, allyBuff: 0.25, compBuff: 0.8, roarFrenzy: true },
      { level: 5, desc: "MAX: Summons 3 ferocious apex packmates. Combines into ALPHA'S COMMAND!", companions: 3, allyBuff: 0.35, compBuff: 1.0, roarFrenzy: true },
    ],
  },
  adrenaline: {
    id: "adrenaline",
    category: "passive",
    name: "Adrenaline",
    rarity: "common",
    icon: "⚡",
    levels: [
      { level: 1, desc: "Ability cooldowns recover 12% faster; dashes cost 15% less stamina.", cdr: 0.12, dashDiscount: 0.15 },
      { level: 2, desc: "Ability cooldowns recover 20% faster; dashes cost 25% less stamina.", cdr: 0.20, dashDiscount: 0.25 },
      { level: 3, desc: "Ability cooldowns recover 28% faster; stamina recovers 25% faster.", cdr: 0.28, staminaRegen: 0.25 },
      { level: 4, desc: "Ability cooldowns recover 36% faster; dashes refund 50% stamina on hit.", cdr: 0.36, dashRefund: 0.5 },
      { level: 5, desc: "MAX: Abilities recharge 45% faster and dash cooldown halved. Combines into JUGGERNAUT!", cdr: 0.45, dashDiscount: 0.5, dashCdr: 0.5 },
    ],
  },
  xpMagnetism: {
    id: "xpMagnetism",
    category: "passive",
    name: "XP Magnetism",
    rarity: "common",
    icon: "🧲",
    levels: [
      { level: 1, desc: "Pulls meat, essence, and DNA towards you from 8 meters away.", radius: 8 },
      { level: 2, desc: "Pulls food from 14 meters away with +30% pull velocity.", radius: 14, speedMult: 1.3 },
      { level: 3, desc: "Pulls food from 20 meters away and yields +20% bonus evolution XP.", radius: 20, xpBonus: 0.2 },
      { level: 4, desc: "Pulls food from 28 meters away with +35% bonus evolution XP.", radius: 28, xpBonus: 0.35 },
      { level: 5, desc: "MAX: Colossal 38-meter gravitational aura pulls all distant loot; +50% XP and DNA.", radius: 38, xpBonus: 0.5, dnaBonus: 0.5 },
    ],
  },
  predatoryHaste: {
    id: "predatoryHaste",
    category: "passive",
    name: "Predatory Haste",
    rarity: "common",
    icon: "👟",
    levels: [
      { level: 1, desc: "Movement speed increased by 8%; attack recovery 10% faster.", speed: 0.08, atkSpeed: 0.10 },
      { level: 2, desc: "Movement speed increased by 14%; attack recovery 18% faster.", speed: 0.14, atkSpeed: 0.18 },
      { level: 3, desc: "Movement speed increased by 20%; attack recovery 26% faster.", speed: 0.20, atkSpeed: 0.26 },
      { level: 4, desc: "Movement speed increased by 26%; attack recovery 34% faster.", speed: 0.26, atkSpeed: 0.34 },
      { level: 5, desc: "MAX: +34% movement speed, +45% attack speed, and turns are instant.", speed: 0.34, atkSpeed: 0.45, instantTurn: true },
    ],
  },
  apexCrit: {
    id: "apexCrit",
    category: "passive",
    name: "Apex Precision",
    rarity: "rare",
    icon: "🎯",
    levels: [
      { level: 1, desc: "+12% Critical Hit chance dealing 1.5x damage.", critChance: 0.12, critMult: 1.5 },
      { level: 2, desc: "+18% Critical Hit chance dealing 1.7x damage.", critChance: 0.18, critMult: 1.7 },
      { level: 3, desc: "+25% Critical Hit chance dealing 2.0x damage.", critChance: 0.25, critMult: 2.0 },
      { level: 4, desc: "+32% Critical Hit chance dealing 2.3x damage; crits stagger foes.", critChance: 0.32, critMult: 2.3, stagger: true },
      { level: 5, desc: "MAX: +40% Critical Hit chance dealing 2.8x devastating damage with armor pierce.", critChance: 0.40, critMult: 2.8, armorPierce: 0.5 },
    ],
  },
  wideCleave: {
    id: "wideCleave",
    category: "passive",
    name: "Colossal Cleave",
    rarity: "common",
    icon: "🪓",
    levels: [
      { level: 1, desc: "Bite and attack area expanded by 20%.", areaMult: 1.20 },
      { level: 2, desc: "Bite and attack area expanded by 35%.", areaMult: 1.35 },
      { level: 3, desc: "Bite and attack area expanded by 50% with +10% damage.", areaMult: 1.50, dmgBonus: 0.1 },
      { level: 4, desc: "Bite and attack area expanded by 70% with +20% damage.", areaMult: 1.70, dmgBonus: 0.2 },
      { level: 5, desc: "MAX: Sweeping cleave hits in a 180° frontal semicircle for +35% damage.", areaMult: 2.0, dmgBonus: 0.35, semicircle: true },
    ],
  },

  // === RARE TRANSFORMATIONS (Standalones) ===
  volcanicScales: {
    id: "volcanicScales",
    category: "transformations",
    name: "Volcanic Scales",
    rarity: "legendary",
    icon: "🌋",
    levels: [
      { level: 1, desc: "Skin glows with molten lava veins. Immune to fire and lava; taking damage bursts flame shockwaves." },
    ],
  },
  thunderJaws: {
    id: "thunderJaws",
    category: "transformations",
    name: "Thunder Jaws",
    rarity: "legendary",
    icon: "⚡",
    levels: [
      { level: 1, desc: "Crackling lightning envelopes head and jaws. Every bite discharges 60 electric area damage." },
    ],
  },
  frostArmor: {
    id: "frostArmor",
    category: "transformations",
    name: "Frost Armor",
    rarity: "legendary",
    icon: "🧊",
    levels: [
      { level: 1, desc: "Glacial ice crystals sprout across your back. Creates a permanent sub-zero aura that slows all nearby prey by 35%." },
    ],
  },
  berserkerRage: {
    id: "berserkerRage",
    category: "transformations",
    name: "Berserker Mutation",
    rarity: "legendary",
    icon: "👹",
    levels: [
      { level: 1, desc: "Blood-red glowing aura and furious red eyes. When below 50% HP, deal +100% damage and move 40% faster." },
    ],
  },
};

/**
 * Powerful Mutation Combinations (Synergies)
 * Triggered when required prerequisite mutations reach their target levels!
 */
export const MUTATION_SYNERGIES = {
  hemorrhage: {
    id: "hemorrhage",
    name: "HEMORRHAGE",
    title: "Ultimate Mutation: Hemorrhage",
    requires: { serratedFangs: 5, bloodlust: 3 },
    reqText: "Serrated Fangs V + Bloodlust III",
    icon: "🩸💥",
    color: "#ef4444",
    border: "#b91c1c",
    bg: "rgba(185, 28, 28, 0.25)",
    visual: "crimson_burst",
    audio: "blood_explosion",
    description: "Bleeding enemies burst into violent crimson eruptions on death, dealing 120 area damage, spreading bleed to nearby foes, and restoring 10% of your maximum health!",
  },
  seismicSlam: {
    id: "seismicSlam",
    name: "SEISMIC SLAM",
    title: "Synergy Mutation: Seismic Slam",
    requires: { spikedTail: 1, thickScales: 1 },
    reqText: "Spiked Tail + Thick Scales",
    icon: "🌋💥",
    color: "#f59e0b",
    border: "#d97706",
    bg: "rgba(217, 119, 6, 0.25)",
    visual: "earth_shatter",
    audio: "seismic_boom",
    description: "Landing attacks or dashing slams the prehistoric earth, sending a high-impact shockwave that knocks down, damages, and stuns all nearby enemies for 2 seconds!",
  },
  plagueCloud: {
    id: "plagueCloud",
    name: "PLAGUE CLOUD",
    title: "Synergy Mutation: Plague Cloud",
    requires: { venomSpit: 1, toxicBlood: 1 },
    reqText: "Venom Spit + Toxic Blood",
    icon: "☣️💨",
    color: "#22c55e",
    border: "#15803d",
    bg: "rgba(21, 128, 61, 0.25)",
    visual: "toxic_cloud",
    audio: "plague_hiss",
    description: "Venom spit and enemy strikes leave lingering toxic clouds that poison, blind, and shred the defense of any creature trapped within.",
  },
  alphasCommand: {
    id: "alphasCommand",
    name: "ALPHA’S COMMAND",
    title: "Synergy Mutation: Alpha’s Command",
    requires: { packInstinct: 2 },
    reqText: "Primal Roar + Pack Instinct II",
    icon: "👑🐺",
    color: "#a855f7",
    border: "#7e22ce",
    bg: "rgba(126, 34, 206, 0.25)",
    visual: "alpha_howl",
    audio: "alpha_rally",
    description: "Roaring (Z) commands your summoned hunting companions into an unstoppable frenzy, doubling their attack speed, grant damage immunity for 5s, and tearing targets to shreds.",
  },
  inferno: {
    id: "inferno",
    name: "INFERNO",
    title: "Synergy Mutation: Inferno",
    requires: { fireBreath: 1, rapidMetabolism: 1 },
    reqText: "Fire Breath + Rapid Metabolism",
    icon: "🔥🌋",
    color: "#f97316",
    border: "#c2410c",
    bg: "rgba(194, 65, 12, 0.25)",
    visual: "flame_trail",
    audio: "inferno_roaring",
    description: "Sprinting and dashing leave blazing trails of molten fire across the earth that incinerate pursuing predators for massive continuous burn damage.",
  },
  glacialFortress: {
    id: "glacialFortress",
    name: "GLACIAL FORTRESS",
    title: "Synergy Mutation: Glacial Fortress",
    requires: { frostBite: 1, armoredHide: 1 },
    reqText: "Frost Bite + Armored Hide",
    icon: "🧊🏰",
    color: "#38bdf8",
    border: "#0284c7",
    bg: "rgba(2, 132, 199, 0.25)",
    visual: "ice_fortress",
    audio: "frost_snap",
    description: "Taking heavy damage triggers a flash-freeze barrier, encasing you in ice armor and completely freezing all nearby attackers solid for 3 seconds.",
  },
  juggernaut: {
    id: "juggernaut",
    name: "JUGGERNAUT",
    title: "Synergy Mutation: Juggernaut",
    requires: { chargingHorns: 1, adrenaline: 1 },
    reqText: "Charging Horns + Adrenaline",
    icon: "🦏⚡",
    color: "#eab308",
    border: "#ca8a04",
    bg: "rgba(202, 138, 4, 0.25)",
    visual: "juggernaut_rush",
    audio: "juggernaut_trample",
    description: "Dash transforms into an unstoppable locomotive charge that plows through multiple enemies simultaneously, trampling them for 300% impact damage and slamming them into obstacles.",
  },
};

/**
 * Creates a clean build state for a dinosaur run
 */
export function createBuildState() {
  return {
    offensive: {}, // { mutationId: level (1-5) }
    defensive: {}, // { mutationId: level (1-5) }
    passive: {},   // { mutationId: level (1-5) }
    transformations: {}, // { mutationId: level }
    activeSynergies: [], // array of synergy keys
    barrierHp: 0,
    barrierTimer: 0,
    barrierMax: 0,
    packmates: [],
    flameTrails: [],
    poisonClouds: [],
    lastRoarTime: 0,
  };
}

/**
 * Returns total power level of the build (used for scaling encounter difficulty)
 */
export function calculateBuildPower(build) {
  if (!build) return 0;
  let power = 0;
  for (const cat of ["offensive", "defensive", "passive", "transformations"]) {
    for (const [id, lvl] of Object.entries(build[cat] || {})) {
      power += Number(lvl) * 10;
    }
  }
  power += (build.activeSynergies?.length || 0) * 35;
  return power;
}

/**
 * Check if a mutation can be equipped or leveled up
 */
export function canEquipOrUpgrade(build, mutationId) {
  const mut = BUILD_MUTATIONS[mutationId];
  if (!mut) return false;
  const cat = mut.category;
  const currentLvl = build[cat]?.[mutationId] || 0;
  if (currentLvl >= 5) return false;
  if (currentLvl > 0) return true; // Upgrade existing
  // Check slot capacity
  const equippedCount = Object.keys(build[cat] || {}).length;
  const maxSlots = BUILD_CATEGORIES[cat]?.maxEquipped || 4;
  return equippedCount < maxSlots;
}

/**
 * Equips or upgrades a mutation in the build
 */
export function applyBuildMutation(build, mutationId) {
  const mut = BUILD_MUTATIONS[mutationId];
  if (!mut) return { ok: false, error: "Unknown mutation" };
  const cat = mut.category;
  build[cat] ||= {};
  const currentLvl = build[cat][mutationId] || 0;
  if (currentLvl >= 5) return { ok: false, error: "Mutation maxed" };
  const equippedCount = Object.keys(build[cat] || {}).length;
  const maxSlots = BUILD_CATEGORIES[cat]?.maxEquipped || 4;
  if (currentLvl === 0 && equippedCount >= maxSlots) {
    return { ok: false, error: "Category slots full" };
  }
  const nextLvl = currentLvl + 1;
  build[cat][mutationId] = nextLvl;

  // Check for newly unlocked synergies
  const newSynergies = checkNewSynergies(build);
  for (const synKey of newSynergies) {
    if (!build.activeSynergies.includes(synKey)) {
      build.activeSynergies.push(synKey);
      build.transformations[synKey] = 1;
    }
  }

  return {
    ok: true,
    category: cat,
    id: mutationId,
    level: nextLvl,
    definition: mut,
    levelData: mut.levels[nextLvl - 1],
    newSynergies,
  };
}

/**
 * Checks which synergies have their requirements met
 */
export function checkNewSynergies(build) {
  const unlocked = [];
  for (const [key, syn] of Object.entries(MUTATION_SYNERGIES)) {
    if (build.activeSynergies?.includes(key)) continue;
    let satisfied = true;
    for (const [reqId, minLvl] of Object.entries(syn.requires)) {
      const actualLvl =
        (build.offensive?.[reqId] || 0) +
        (build.defensive?.[reqId] || 0) +
        (build.passive?.[reqId] || 0) +
        (build.transformations?.[reqId] || 0);
      if (actualLvl < minLvl) {
        satisfied = false;
        break;
      }
    }
    if (satisfied) unlocked.push(key);
  }
  return unlocked;
}

/**
 * Returns formatted level star pips (e.g. "★★★☆☆")
 */
export function renderStars(lvl, max = 5) {
  const clamped = Math.max(0, Math.min(max, lvl));
  return "★".repeat(clamped) + "☆".repeat(max - clamped);
}
