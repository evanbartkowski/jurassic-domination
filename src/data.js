import { EXTRA_SPECIES, ABILITIES, TECHNIQUES } from './content.js';
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
  species('brachiosaurus', 'Brachiosaurus', 5, 'longneck', 0x73987b, 0xe1d6ac, 810, 87, 8.1, 2.9, 'Titan Stomp', 'stomp', 'A walking canopy. The earth trembles beneath its feet.'),
  species('dreadnoughtus', 'Dreadnoughtus', 5, 'longneck', 0x9b895c, 0xd9cfa5, 900, 83, 7.8, 3.0, 'Dreadquake', 'stomp', 'Fearing nothing, this colossus redraws the food chain.'),

  species('wyvern', 'Ember Wyvern', 6, 'dragon', 0xaa5140, 0xf3bb63, 870, 146, 10.2, 3.1, 'Ember Breath', 'flame', 'Evolution breaks its ancient laws. Fire takes flight.'),
  species('basilisk', 'Jade Basilisk', 6, 'dragon', 0x62a58c, 0xd5e78f, 920, 133, 10.5, 3.0, 'Basilisk Venom', 'venom', 'Its venom carries the memory of a forgotten world.'),
  species('behemoth', 'Obsidian Behemoth', 6, 'quad', 0x696a82, 0xf0a56d, 1240, 120, 8.3, 3.25, 'Worldbreaker', 'stomp', 'A mountain of armor born from the island’s buried heart.'),
  species('quetzalcoatl', 'Quetzalcoatl', 6, 'dragon', 0x55a89b, 0xf1cd72, 850, 142, 11.0, 3.1, 'Serpent Storm', 'roar', 'The feathered serpent descends on a world of predators.'),

  species('elder-dragon', 'Elder Dragon', 7, 'dragon', 0x754b92, 0xf0b76a, 1360, 192, 10.2, 3.7, 'Primordial Flame', 'flame', 'The old fire returns. Every roar is an extinction event.'),
  species('world-serpent', 'World Serpent', 7, 'dragon', 0x4b9395, 0xc5f1b3, 1460, 184, 10.6, 3.8, 'Endless Venom', 'venom', 'An impossible serpent whose hunger has no horizon.'),
  species('primordial-titan', 'Primordial Titan', 7, 'longneck', 0x8c828f, 0xf2cd87, 1900, 162, 8.5, 4.0, 'Continental Rupture', 'stomp', 'More landscape than creature, older than the island itself.'),
  species('phoenix', 'Ashen Phoenix', 7, 'bird', 0xd07646, 0xffd68b, 1230, 202, 11.6, 3.55, 'Solar Inferno', 'flame', 'The last ember refuses extinction and becomes a sun.'),
];

SPECIES.push(...EXTRA_SPECIES);
const techniquesByBody={raptor:'sidestep',rex:'cleave',quad:'guard',longneck:'quake',dragon:'wingstorm',bird:'feather',equine:'cleanse',serpent:'coil',croc:'camouflage',gryphon:'dive'};
for(const s of SPECIES){
  if(s.id==='world-serpent'||s.id==='basilisk')s.body='serpent';
  if(s.id==='iguanodon')s.body='quad';
  if(s.body==='equine'){s.color=s.id==='solar-unicorn'?0xe4d5b2:0xd5ddd6;s.accent=s.id==='unicorn'?0xb6c9dc:0xe7c880;}
  s.technique=TECHNIQUES[s.technique]?s.technique:techniquesByBody[s.body];
  if(s.id==='carnotaurus'){s.abilityType='flame';s.ability='Ember Breath';s.description+=' A volatile evolution lets this hunter breathe fire.';}
  if(s.id==='spinosaurus'){s.abilityType='lightning';s.ability='Stormsail Arc';s.description+=' Its charged sail channels a supernatural electrical strike.';}
  s.abilityDescription=ABILITIES[s.abilityType].description;
  s.temperament=['quad','longneck','equine'].includes(s.body)?'territorial':['croc','serpent'].includes(s.body)?'ambusher':s.tier<2?'skittish':'hunter';
  if(/raptor|deinonychus|troodon|albertosaurus|mapusaurus|fenrir/.test(s.id))s.temperament='pack';
  s.habitat=s.tier===0?'Fernwood Basin':s.tier<3?'Grasslands and wetlands':s.tier<5?'Ancient forests, deserts and frostlands':s.tier===5?'Calderas and elder groves':s.tier===6?'Celestial gardens and dragon peaks':'Primordial frontier';
  s.passive=s.body==='quad'?'Armored hide: 12% damage resistance.':s.body==='longneck'?'Titanic endurance: food heals more.':s.body==='equine'?'Sacred metabolism: faster natural healing.':s.body==='serpent'?'Toxic fangs: bites can poison.':s.body==='croc'?'Ambush predator: stronger first strike.':s.body==='raptor'?'Combo hunter: consecutive bites grow stronger.':s.body==='bird'?'Light footed: dodges recover sooner.':'Apex resolve: reduced stagger and powerful techniques.';
}
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map(s => [s.id, s]));

export const MUTATIONS = [
  { id: 'ironhide', name: 'Ironhide', description: 'Take 12% less damage. Stacks up to 45% protection.' },
  { id: 'razor', name: 'Razor Teeth', description: 'Deal 18% more bite and ability damage.' },
  { id: 'metabolism', name: 'Efficient Metabolism', description: 'Hunger drains 25% slower; food restores more hunger.' },
  { id: 'vitality', name: 'Ancient Vitality', description: 'Gain 18% maximum health and heal on evolution.' },
  { id: 'swift', name: 'Fleet Footed', description: 'Move 10% faster and recover stamina more quickly.' },
  { id: 'predator', name: 'Blood Siphon', description: 'Recover 5% of maximum health for every kill.' },
  { id: 'catalyst', name: 'Evolution Catalyst', description: 'Earn 20% more evolution energy from every meal.' },
  { id: 'adrenaline', name: 'Adrenal Glands', description: 'Abilities recharge 18% faster and dashes cost less stamina.' },
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
