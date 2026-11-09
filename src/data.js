import { EXTRA_SPECIES, ABILITIES, TECHNIQUES } from './content.js';
import { speciesDiet } from './forage.js';
// Evolution is an intentionally fantastical food-chain, not a paleontology claim.
export const TIERS = ['Hatchling', 'Hunter', 'Predator', 'Dominant', 'Apex', 'Titan', 'Mythic', 'Primordial'];

const species = (id, name, tier, body, color, accent, hp, damage, speed, size, ability, abilityType, description) => ({
  id, name, tier, body, color, accent, hp, damage, speed, size, ability, abilityType, description,
  abilityDescription: {
    pounce: 'Leap forward and strike everything in your path.',
    venom: 'Spit a venom burst that poisons nearby prey.',
    stomp: 'Slam the earth, damaging and stunning nearby creatures.',
    charge: 'Charge forward with a protected, crushing impact.',
    roar: 'Unleash a damaging roar that terrifies nearby predators.',
    flame: 'Breathe a searing cone of fire in front of you.',
  }[abilityType],
});

export const SPECIES = [
  species('compsognathus', 'Compsognathus', 0, 'raptor', 0x9dbf63, 0xe2d3a0, 48, 12, 10.5, .72, 'Quick Pounce', 'pounce', 'A nimble opportunist. Small jaws, enormous ambition.'),
  species('microraptor', 'Microraptor', 0, 'bird', 0x417c8b, 0xdbad68, 44, 11, 11.3, .77, 'Feather Rush', 'pounce', 'Four feathered wings carry a fearless little hunter.'),
  species('psittacosaurus', 'Psittacosaurus', 0, 'quad', 0xa6a05a, 0xf2d88d, 58, 10, 9.3, .8, 'Bristle Slam', 'stomp', 'A tough beaked survivor with a stubborn streak.'),
  species('heterodontosaurus', 'Heterodontosaurus', 0, 'raptor', 0xbd875e, 0xf1ce8a, 50, 12, 10.1, .76, 'Fang Rush', 'charge', 'A tusked omnivore built to seize every opportunity.'),

  species('velociraptor', 'Velociraptor', 1, 'raptor', 0xb28a55, 0xeee1ba, 80, 21, 11.1, 1.04, 'Raptor Pounce', 'pounce', 'Sharp claws and sharper instincts reward aggressive hunting.'),
  species('dilophosaurus', 'Dilophosaurus', 1, 'raptor', 0x5d9a73, 0xe6a863, 82, 20, 10.2, 1.12, 'Crested Cry', 'roar', 'A double-crested hunter whose cry scatters weaker rivals.'),
  species('pachycephalosaurus', 'Pachycephalosaurus', 1, 'quad', 0x9284b3, 0xe5d6a2, 100, 19, 9.6, 1.08, 'Dome Charge', 'charge', 'A reinforced skull turns a retreat into a counterattack.'),
  species('protoceratops', 'Protoceratops', 1, 'quad', 0xc49a69, 0xf2d69b, 110, 17, 9.2, 1.12, 'Frill Stomp', 'stomp', 'Compact, armored, and much harder to eat than it looks.'),
  species('ornithomimus', 'Ornithomimus', 1, 'bird', 0x7a9a8b, 0xe4ddbf, 76, 20, 12, 1.05, 'Strider Rush', 'pounce', 'Outrun danger, circle your prey, and strike first.'),

  species('deinonychus', 'Deinonychus', 2, 'raptor', 0xab664c, 0xe1bc7c, 135, 31, 11.1, 1.32, 'Sickle Pounce', 'pounce', 'A killing claw and explosive acceleration define this stalker.'),
  species('ceratosaurus', 'Ceratosaurus', 2, 'rex', 0x878556, 0xe0be77, 152, 34, 9.8, 1.38, 'Horned Roar', 'roar', 'A horned riverbank predator ready to fight above its weight.'),
  species('kentrosaurus', 'Kentrosaurus', 2, 'quad', 0x5f957e, 0xe7c273, 175, 29, 8.8, 1.4, 'Spike Slam', 'stomp', 'A moving bramble of plates and spears.'),
  species('baryonyx', 'Baryonyx', 2, 'rex', 0x4e9296, 0xc9dfc1, 146, 33, 10.1, 1.42, 'River Rush', 'charge', 'A crocodile-like snout conceals a relentless brawler.'),
  species('iguanodon', 'Iguanodon', 2, 'longneck', 0x8b9b5a, 0xe8c997, 184, 28, 9, 1.43, 'Thumb-Spike Slam', 'stomp', 'A great herbivore with surprisingly dangerous hands.'),

  species('allosaurus', 'Allosaurus', 3, 'rex', 0xb77d50, 0xf1d09b, 230, 49, 10.1, 1.68, 'Terrible Roar', 'roar', 'The ancient floodplain belongs to this heavy-jawed killer.'),
  species('carnotaurus', 'Carnotaurus', 3, 'rex', 0xa64e41, 0xe5ad75, 218, 52, 11.3, 1.65, 'Bull Charge', 'charge', 'Two horns, brutal speed, and no reason to stop.'),
  species('stegosaurus', 'Stegosaurus', 3, 'quad', 0x65955c, 0xc88152, 290, 43, 8.4, 1.8, 'Thagomizer', 'stomp', 'An armored wall with a tail that ends arguments.'),
  species('therizinosaurus', 'Therizinosaurus', 3, 'bird', 0x6b799a, 0xdcca96, 245, 51, 9.1, 1.72, 'Scythe Sweep', 'stomp', 'Enormous scythe claws keep even tyrants at a distance.'),
  species('suchomimus', 'Suchomimus', 3, 'rex', 0x477f77, 0xb8cca1, 246, 48, 9.6, 1.76, 'Floodplain Rush', 'charge', 'A towering crocodile mimic with a taste for larger prey.'),

  species('tyrannosaurus', 'Tyrannosaurus rex', 4, 'rex', 0x77925e, 0xd9c29a, 380, 76, 9.6, 2.12, 'Tyrant Roar', 'roar', 'Bone-crushing jaws announce the reign of a true tyrant.'),
  species('triceratops', 'Triceratops', 4, 'quad', 0xa48b67, 0xf0d7a4, 465, 65, 8.7, 2.2, 'Three-Horn Charge', 'charge', 'A living fortress with three very persuasive horns.'),
  species('spinosaurus', 'Spinosaurus', 4, 'rex', 0x4b8d8d, 0xe49a69, 400, 72, 9.2, 2.25, 'Sailback Fury', 'roar', 'The river king rises above every rival on the shore.'),
  species('ankylosaurus', 'Ankylosaurus', 4, 'quad', 0x7e805c, 0xd9b673, 520, 60, 7.9, 2.16, 'Clubquake', 'stomp', 'A low-slung tank whose tail can shatter a predator’s leg.'),

  species('giganotosaurus', 'Giganotosaurus', 5, 'rex', 0x9a665e, 0xf0c698, 590, 105, 9.7, 2.64, 'Giant’s Roar', 'roar', 'A southern giant that looks even tyrants in the eye.'),
  species('carcharodontosaurus', 'Carcharodontosaurus', 5, 'rex', 0xb17d4c, 0xe9c79b, 570, 112, 9.9, 2.6, 'Shark-Tooth Charge', 'charge', 'Serrated teeth turn every attack into a devastating wound.'),
  species('brachiosaurus', 'Brachiosaurus', 5, 'longneck', 0x73987b, 0xe1d6ac, 810, 87, 8.1, 4.2, 'Titan Stomp', 'stomp', 'A walking canopy. The earth trembles beneath its feet.'),
  species('dreadnoughtus', 'Dreadnoughtus', 5, 'longneck', 0x9b895c, 0xd9cfa5, 900, 83, 7.8, 4.4, 'Dreadquake', 'stomp', 'Fearing nothing, this colossus redraws the food chain.'),

  species('wyvern', 'Ember Wyvern', 6, 'dragon', 0xaa5140, 0xf3bb63, 870, 146, 10.2, 3.4, 'Ember Breath', 'flame', 'Evolution breaks its ancient laws. Fire takes flight.'),
  species('basilisk', 'Jade Basilisk', 6, 'dragon', 0x62a58c, 0xd5e78f, 920, 133, 10.5, 3.2, 'Basilisk Venom', 'venom', 'Its venom carries the memory of a forgotten world.'),
  species('behemoth', 'Obsidian Behemoth', 6, 'quad', 0x696a82, 0xf0a56d, 1240, 120, 8.3, 4.6, 'Worldbreaker', 'stomp', 'A mountain of armor born from the island’s buried heart.'),
  species('quetzalcoatl', 'Quetzalcoatl', 6, 'dragon', 0x55a89b, 0xf1cd72, 850, 142, 11.0, 3.4, 'Serpent Storm', 'roar', 'The feathered serpent descends on a world of predators.'),

  species('elder-dragon', 'Elder Dragon', 7, 'dragon', 0x754b92, 0xf0b76a, 1360, 192, 10.2, 5.0, 'Primordial Flame', 'flame', 'The old fire returns. Every roar is an extinction event.'),
  species('world-serpent', 'World Serpent', 7, 'dragon', 0x4b9395, 0xc5f1b3, 1460, 184, 10.6, 5.2, 'Endless Venom', 'venom', 'An impossible serpent whose hunger has no horizon.'),
  species('primordial-titan', 'Primordial Titan', 7, 'longneck', 0x8c828f, 0xf2cd87, 1900, 162, 8.5, 5.8, 'Continental Rupture', 'stomp', 'More landscape than creature, older than the island itself.'),
  species('phoenix', 'Ashen Phoenix', 7, 'bird', 0xd07646, 0xffd68b, 1230, 202, 11.6, 4.2, 'Solar Inferno', 'flame', 'The last ember refuses extinction and becomes a sun.'),
];

SPECIES.push(...EXTRA_SPECIES);
// Two earned marine anatomies. These are excluded from ordinary offers and
// regional random spawning; their discoveries are deliberate exploration paths.
SPECIES.push(
  { ...species('tideweaver', 'Tideweaver Plesiosaur', 2, 'marine', 0x4d929d, 0xc1e7d3, 170, 33, 10.4, 1.42, 'Brine Ambush', 'ambush', 'A long-necked marine hunter with four rowing flippers. Follow the drowned carvings and learn to survive deep water.'), rarity:'rare', bloodline:'tidal-memory', technique:'camouflage', anatomy:'plesiosaur' },
  { ...species('abyssal-kronosaur', 'Abyssal Kronosaur', 4, 'marine', 0x3c6476, 0x9cdbd8, 380, 70, 10.0, 3.6, 'Abyssal Rend', 'blood', 'An immense short-necked marine predator. Its heavy skull, broad paddles and scarred dorsal ridge remember a drowned dynasty.'), rarity:'legendary', bloodline:'abyssal-dynasty', technique:'cleave', anatomy:'pliosaur' },
);
const variants=[
 ['verdant-psittacosaurus','Verdant Psittacosaurus','psittacosaurus',1,'rare','verdant-seed',0x4a9e6b,'heal','Verdant Bloom'],
 ['verdant-iguanodon','Verdant Iguanodon','iguanodon',2,'epic','verdant-guard',0x398866,'heal','Elderroot Mending'],
 ['elderroot-therizinosaurus','Elderroot Sentinel','therizinosaurus',3,'legendary','verdant-elder',0x477d5b,'heal','Forest Heart'],
 ['cinderfang-carnotaurus','Cinderfang','carnotaurus',4,'epic','cinderfang',0xa54d32,'flame','Cinder Breath'],
 ['ashborn-tyrannosaurus','Ashborn Tyrant','tyrannosaurus',5,'legendary','ashborn',0x64505a,'flame','Ashborn Inferno'],
 ['eclipse-wyrm','Eclipse Wyrm','wyvern',6,'legendary','eclipse',0x57517d,'lightning','Eclipse Arc'],
 ['stormcrown-dragon','Stormcrown Dragon','elder-dragon',7,'legendary','stormcrown',0x53818e,'lightning','Stormcrown Judgment'],
];
for(const [id,name,base,tier,rarity,bloodline,color,abilityType,ability] of variants){const original=SPECIES.find(s=>s.id===base),reference=SPECIES.filter(s=>s.tier===tier);SPECIES.push({...original,id,name,tier,rarity,bloodline,color,abilityType,ability,hp:Math.round(reference.reduce((n,s)=>n+s.hp,0)/reference.length*1.08),damage:Math.round(reference.reduce((n,s)=>n+s.damage,0)/reference.length*1.08),size:reference.reduce((n,s)=>n+s.size,0)/reference.length,description:'A conditional bloodline earned during this life. Its ancestral power begins anew after death.'});}
const rareForms=new Set(['deinonychus','baryonyx','suchomimus','allosaurus','therizinosaurus','sarcosuchus','pachyrhinosaurus','argentinosaurus','unicorn','gryphon','basilisk','quetzalcoatl','titanoboa','thunderbird']);
const epicForms=new Set(['wyvern','behemoth','solar-unicorn','frost-dragon','phoenix','elder-dragon']);
const legendaryForms=new Set(['world-serpent','primordial-titan']);
const techniquesByBody={raptor:'sidestep',rex:'cleave',quad:'guard',longneck:'quake',dragon:'wingstorm',bird:'feather',equine:'cleanse',serpent:'coil',croc:'camouflage',gryphon:'dive',marine:'camouflage'};
for(const s of SPECIES){
  s.rarity ||= legendaryForms.has(s.id)?"legendary":epicForms.has(s.id)?"epic":rareForms.has(s.id)?"rare":"regular";
  if(s.id==='world-serpent'||s.id==='basilisk')s.body='serpent';
  if(s.id==='iguanodon')s.body='quad';
  if(s.body==='equine'){s.color=s.id==='solar-unicorn'?0xe4d5b2:0xd5ddd6;s.accent=s.id==='unicorn'?0xb6c9dc:0xe7c880;}
  s.technique=TECHNIQUES[s.technique]?s.technique:techniquesByBody[s.body];
  if(s.id==='carnotaurus'){s.abilityType='flame';s.ability='Ember Breath';s.description+=' A volatile evolution lets this hunter breathe fire.';}
  if(s.id==='spinosaurus'){s.abilityType='lightning';s.ability='Stormsail Arc';s.description+=' Its charged sail channels a supernatural electrical strike.';}
  s.abilityDescription=ABILITIES[s.abilityType].description;
  s.temperament=['quad','longneck','equine'].includes(s.body)?'territorial':['croc','serpent','marine'].includes(s.body)?'ambusher':s.tier<2?'skittish':'hunter';
  if(/raptor|deinonychus|troodon|albertosaurus|mapusaurus|fenrir/.test(s.id))s.temperament='pack';
  s.habitat=s.tier===0?'Fernwood Basin':s.tier<3?'Grasslands and wetlands':s.tier<5?'Ancient forests, deserts and frostlands':s.tier===5?'Calderas and elder groves':s.tier===6?'Celestial gardens and dragon peaks':'Primordial frontier';
  s.passive=s.body==='quad'?'Armored hide: 12% damage resistance.':s.body==='longneck'?'Titanic endurance: food heals more.':s.body==='equine'?'Sacred metabolism: faster natural healing.':s.body==='serpent'?'Toxic fangs: bites can poison.':s.body==='croc'?'Ambush predator: stronger first strike.':s.body==='raptor'?'Combo hunter: consecutive bites grow stronger.':s.body==='bird'?'Light footed: dodges recover sooner.':'Apex resolve: reduced stagger and powerful techniques.';
}
// Clear tier silhouettes and a stronger reward for each step up the food chain.
// High-tier titans and primordial evolutions are truly massive, towering creatures.
const sizeBands = [[.70,.83],[1.10,1.24],[1.48,1.67],[1.98,2.23],[2.56,2.92],[3.35,4.45],[4.80,5.85],[6.40,8.20]];
const compactForms = new Set(['deinonychus','basilisk','unicorn']);
for (let tier=0;tier<8;tier++) {
  const forms=SPECIES.filter(s=>s.tier===tier), min=Math.min(...forms.map(s=>s.size)), max=Math.max(...forms.map(s=>s.size));
  for (const s of forms) {
    const [small,large]=sizeBands[tier], variation=max>min?(s.size-min)/(max-min):.5;
    s.size=Number((small+(large-small)*variation).toFixed(3));
    s.compactEvolution=compactForms.has(s.id) && s.rarity==='rare';
    if (s.compactEvolution) s.size=Number((s.size*.74).toFixed(3));
    s.hp=Math.round(s.hp*(1+tier*.06));
    s.damage=Math.round(s.damage*(1+tier*.065));
    const identity=[...s.id].reduce((n,c)=>n+c.charCodeAt(0),0);
    if ((tier===0 && identity%3!==0) || (tier===1 && identity%4===0)) {
      s.hp=Math.round(s.hp*1.18);
      s.damage=Math.round(s.damage*1.22);
      s.passive+=' Instinctive survivor: stronger natural health and bites in place of active skills.';
    }
    s.diet=speciesDiet(s);
    if (s.body === 'marine') { s.habitat='Deep pools, tidal archives and drowned ruins'; s.passive='Aquatic anatomy: faster swimming, strong marine resistance and quiet diving; slower on dry land.'; }
  }
}
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));

export const STARTER_SPECIES = SPECIES.filter(
  (s) => s.tier <= 1 && !s.bloodline && s.body !== 'marine',
);

export const MUTATION_RARITIES = {
  common: { name: 'Common', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)', border: '#22c55e' },
  rare: { name: 'Rare', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', border: '#3b82f6' },
  epic: { name: 'Epic', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)', border: '#a855f7' },
  legendary: { name: 'Legendary', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.2)', border: '#f59e0b' },
};

export const MUTATIONS = [
  // Common Mutations
  { id: 'ironhide', name: 'Ironhide', rarity: 'common', description: 'Take 12% less damage. Stacks up to 45% protection.', effect: 'defense' },
  { id: 'razor', name: 'Razor Teeth', rarity: 'common', description: 'Deal 18% more bite and ability damage.', effect: 'damage' },
  { id: 'metabolism', name: 'Efficient Metabolism', rarity: 'common', description: 'Hunger drains 25% slower; food restores more hunger.', effect: 'hunger' },
  { id: 'swift', name: 'Fleet Footed', rarity: 'common', description: 'Move 10% faster and recover stamina more quickly.', effect: 'speed' },

  // Rare Mutations
  { id: 'vitality', name: 'Ancient Vitality', rarity: 'rare', description: 'Gain 22% maximum health and heal on evolution or ingestion.', effect: 'hp' },
  { id: 'predator', name: 'Blood Siphon', rarity: 'rare', description: 'Recover 6% of maximum health immediately whenever you slay a dinosaur.', effect: 'lifesteal' },
  { id: 'catalyst', name: 'Evolution Catalyst', rarity: 'rare', description: 'Earn 25% more evolution energy from all meals and kills.', effect: 'xp' },
  { id: 'adrenaline', name: 'Adrenal Glands', rarity: 'rare', description: 'Abilities recharge 20% faster and dashes cost 35% less stamina.', effect: 'cooldown' },
  { id: 'toxicBile', name: 'Neurotoxic Venom', rarity: 'rare', description: 'Bites inflict neurotoxin that slows enemies by 30% and deals venom damage over time.', effect: 'poison' },
  { id: 'boneCrusher', name: 'Bone Crusher', rarity: 'rare', description: 'Bites fracture enemy hide, bypassing 40% defense with a 25% chance to stun.', effect: 'stun' },
  { id: 'stealthScales', name: 'Camouflage Scales', rarity: 'rare', description: 'Crouching turns you translucent, reducing predator detection range by 80% with +50% ambush critical damage.', effect: 'stealth' },

  // Epic Mutations
  { id: 'volcanicCore', name: 'Volcanic Core', rarity: 'epic', description: 'Taking damage releases a retaliatory fire shockwave that ignites nearby attackers for 3s.', effect: 'flame_retaliation' },
  { id: 'bloodRush', name: 'Primal Frenzy', rarity: 'epic', description: 'Slaying a dinosaur triggers bloodlust: +35% movement speed and +40% bite damage for 6 seconds.', effect: 'frenzy' },
  { id: 'primalRegen', name: 'Ancestral Mending', rarity: 'epic', description: 'When free of damage for 4 seconds, steadily regenerate 4% maximum health per second.', effect: 'regen' },
  { id: 'shockwaveStride', name: 'Seismic Stride', rarity: 'epic', description: 'Dashing into smaller enemies knocks them down with a concussive shockwave.', effect: 'shockwave' },

  // Legendary Mutations
  { id: 'titansWrath', name: 'Titan’s Awakening', rarity: 'legendary', description: 'Unlocks your species’ Ultimate Ability regardless of tier! Grants +40% maximum HP and increases body mass by 25%.', effect: 'unlock_ultimate' },
  { id: 'abyssalLord', name: 'Abyssal Sovereign', rarity: 'legendary', description: 'Permanent deep-water breathing and immunity to beached penalties. Move +50% faster in water and deal double damage to marine prey.', effect: 'aquatic_mastery' },
  { id: 'astralBehemoth', name: 'Celestial Essence', rarity: 'legendary', description: 'Unlocks the Astral Bolt long-range beam attack and accelerates all ability cooldowns by 40%.', effect: 'astral_beam' },

  // Offensive Mutations (Build System)
  { id: 'serratedFangs', name: 'Serrated Fangs', rarity: 'common', category: 'offensive', description: 'Bites tear flesh, dealing severe bleeding damage over time.', effect: 'bleed' },
  { id: 'bleedingClaws', name: 'Bleeding Claws', rarity: 'common', category: 'offensive', description: 'Attacks inflict lacerations dealing extra damage over time.', effect: 'bleed' },
  { id: 'venomSpit', name: 'Venom Spit', rarity: 'rare', category: 'offensive', description: 'Periodically spit venom globs that slow and poison prey.', effect: 'poison' },
  { id: 'chainLightning', name: 'Chain Lightning', rarity: 'rare', category: 'offensive', description: 'Melee hits arc lightning across multiple secondary foes.', effect: 'shock' },
  { id: 'spikedTail', name: 'Spiked Tail', rarity: 'common', category: 'offensive', description: 'Sweeping tail strike knocking foes back with stun.', effect: 'stun' },
  { id: 'chargingHorns', name: 'Charging Horns', rarity: 'rare', category: 'offensive', description: 'Dashing into enemies deals impact damage and knocks them aside.', effect: 'impact' },
  { id: 'fireBreath', name: 'Fire Breath', rarity: 'epic', category: 'offensive', description: 'Unleash a fiery cone that melts armor and ignites targets.', effect: 'fire' },
  { id: 'boneProjectiles', name: 'Bone Projectiles', rarity: 'common', category: 'offensive', description: 'Biting flings piercing bone spikes that puncture foes.', effect: 'projectiles' },
  { id: 'frostBite', name: 'Frost Bite', rarity: 'rare', category: 'offensive', description: 'Chilling bite that slows and freezes enemies solid.', effect: 'freeze' },

  // Defensive Adaptations (Build System)
  { id: 'thickScales', name: 'Thick Scales', rarity: 'common', category: 'defensive', description: 'Dense dermal scales reducing incoming damage and boosting health.', effect: 'defense' },
  { id: 'regenerativeTissue', name: 'Regenerative Tissue', rarity: 'rare', category: 'defensive', description: 'Steadily regenerates health and cleanses status effects.', effect: 'regen' },
  { id: 'reflectiveArmor', name: 'Reflective Armor', rarity: 'rare', category: 'defensive', description: 'Reflects incoming damage and deflects projectiles.', effect: 'reflect' },
  { id: 'thorns', name: 'Thorns', rarity: 'common', category: 'defensive', description: 'Pointed quills inflicting retaliatory piercing damage.', effect: 'thorns' },
  { id: 'poisonResistance', name: 'Poison Resistance', rarity: 'common', category: 'defensive', description: 'Resist and absorb venom and environmental poison.', effect: 'poison_resist' },
  { id: 'protectiveBarrier', name: 'Protective Barrier', rarity: 'epic', category: 'defensive', description: 'Generates an energy barrier that absorbs heavy damage.', effect: 'shield' },
  { id: 'armoredHide', name: 'Armored Hide', rarity: 'rare', category: 'defensive', description: 'Heavy frontal plates deflecting head-on attacks.', effect: 'frontal_shield' },
  { id: 'toxicBlood', name: 'Toxic Blood', rarity: 'rare', category: 'defensive', description: 'Sprays corrosive acid blood upon taking damage.', effect: 'acid_blood' },

  // Passive Abilities (Build System)
  { id: 'bloodlust', name: 'Bloodlust', rarity: 'common', category: 'passive', description: 'Slaying foes grants movement speed and attack frenzy.', effect: 'frenzy' },
  { id: 'rapidMetabolism', name: 'Rapid Metabolism', rarity: 'common', category: 'passive', description: 'Food restores more hunger and instantly heals health.', effect: 'nutrition' },
  { id: 'packInstinct', name: 'Pack Instinct', rarity: 'rare', category: 'passive', description: 'Summons loyal raptor companions that hunt alongside you.', effect: 'pack' },
  { id: 'xpMagnetism', name: 'XP Magnetism', rarity: 'common', category: 'passive', description: 'Gravitational pull drawing distant meat, essence, and DNA.', effect: 'magnet' },
  { id: 'predatoryHaste', name: 'Predatory Haste', rarity: 'common', category: 'passive', description: 'Passive movement speed and accelerated attack recovery.', effect: 'speed' },
  { id: 'apexCrit', name: 'Apex Precision', rarity: 'rare', category: 'passive', description: 'High critical hit chance with lethal damage multipliers.', effect: 'crit' },
  { id: 'wideCleave', name: 'Colossal Cleave', rarity: 'common', category: 'passive', description: 'Greatly expands bite and strike area.', effect: 'cleave' },

  // Rare Transformations (Build System)
  { id: 'volcanicScales', name: 'Volcanic Scales', rarity: 'legendary', category: 'transformations', description: 'Skin glows with molten lava veins; bursts retaliatory flame shockwaves.', effect: 'volcanic' },
  { id: 'thunderJaws', name: 'Thunder Jaws', rarity: 'legendary', category: 'transformations', description: 'Crackling lightning envelopes head and discharges electric bursts on bite.', effect: 'lightning' },
  { id: 'frostArmor', name: 'Frost Armor', rarity: 'legendary', category: 'transformations', description: 'Glacial ice crystals sprout across hide, chilling all nearby prey.', effect: 'frost' },
  { id: 'berserkerRage', name: 'Berserker Mutation', rarity: 'legendary', category: 'transformations', description: 'Blood-red aura; deals double damage and gains speed below half health.', effect: 'berserk' },

  // Synergies (Combinations)
  { id: 'hemorrhage', name: 'Hemorrhage', rarity: 'legendary', category: 'transformations', description: 'Bleeding enemies burst on death dealing AoE damage and healing player.', effect: 'synergy' },
  { id: 'seismicSlam', name: 'Seismic Slam', rarity: 'epic', category: 'transformations', description: 'Attacks and dash slam the earth, stunning nearby enemies.', effect: 'synergy' },
  { id: 'plagueCloud', name: 'Plague Cloud', rarity: 'epic', category: 'transformations', description: 'Strikes leave persistent poisonous and blinding zones.', effect: 'synergy' },
  { id: 'alphasCommand', name: 'Alpha’s Command', rarity: 'legendary', category: 'transformations', description: 'Roar summons and frenzies hunting companions.', effect: 'synergy' },
  { id: 'inferno', name: 'Inferno', rarity: 'epic', category: 'transformations', description: 'Sprint and dash leave burning molten trails on earth.', effect: 'synergy' },
  { id: 'glacialFortress', name: 'Glacial Fortress', rarity: 'epic', category: 'transformations', description: 'Heavy hits trigger flash freeze freezing attackers solid.', effect: 'synergy' },
  { id: 'juggernaut', name: 'Juggernaut', rarity: 'legendary', category: 'transformations', description: 'Dash tramples through multiple enemies dealing 300% damage.', effect: 'synergy' },
];

export const DIFFICULTIES = {
  explorer: { name: 'Explorer', enemyDamage: .65, enemyHealth: .85, hunger: .7, score: .75, description: 'Room to learn. Predators still bite.' },
  survival: { name: 'Survival', enemyDamage: 1, enemyHealth: 1, hunger: 1, score: 1, description: 'The intended challenge. Hunt wisely.' },
  extinction: { name: 'Extinction', enemyDamage: 1.4, enemyHealth: 1.18, hunger: 1.3, score: 1.5, description: 'For apex survivors. No safe meals.' },
};

export const UPGRADES = [
  { id: 'vitality', name: 'Resilient Lineage', description: '+5% starting maximum health per level.', max: 5, cost: 3 },
  { id: 'instinct', name: 'Predatory Instinct', description: '+4% damage per level.', max: 5, cost: 3 },
  { id: 'metabolism', name: 'Hardy Hatchling', description: 'Hunger drains 6% slower per level.', max: 5, cost: 3 },
];
