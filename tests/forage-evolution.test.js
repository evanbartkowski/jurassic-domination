import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { SPECIES, SPECIES_BY_ID } from "../src/data.js";
import { creatureKit } from "../src/progression.js";
import { FOOD_PLANTS, canEatFood, plantDefinition, speciesDiet } from "../src/forage.js";

function isolated(id) {
  const g=new Game({seed:1601});
  g.hatch();
  g.entities=[];g.foods=[];g.lairs=[];g.worldFeatures=[];
  g._streamWorld=()=>{};g._replenish=()=>{};
  g.player.speciesId=id;g.tier=g.species.tier;g.refreshStats(true);
  return g;
}

test("skill-free species refuse Q/R/X without spending stamina but retain their bite",()=>{
  const g=isolated("microraptor"),stamina=g.player.stamina;
  assert.equal(g.kit.abilityCount,0);
  assert.equal(g.ability(),false);
  assert.equal(g.technique(),false);
  assert.equal(g.special(),false);
  assert.equal(g.player.stamina,stamina);
  assert.ok(g.attack());
});

test("learned skill counts vary and increase through the evolution tiers",()=>{
  const averages=[];
  for(let tier=0;tier<8;tier++){
    const forms=SPECIES.filter(s=>s.tier===tier);
    averages.push(forms.reduce((n,s)=>n+creatureKit(s).abilityCount,0)/forms.length);
  }
  assert.ok(SPECIES.some(s=>creatureKit(s).abilityCount===0));
  assert.ok(SPECIES.some(s=>creatureKit(s).abilityCount===1));
  assert.ok(SPECIES.some(s=>creatureKit(s).abilityCount===2));
  assert.ok(SPECIES.some(s=>creatureKit(s).abilityCount===3));
  for(let tier=1;tier<8;tier++)assert.ok(averages[tier]>=averages[tier-1]);
});

test("ordinary forms have larger tier silhouettes; only labeled rare forms break the rule",()=>{
  for(let tier=1;tier<8;tier++){
    const previous=SPECIES.filter(s=>s.tier===tier-1),next=SPECIES.filter(s=>s.tier===tier&&!s.compactEvolution);
    assert.ok(Math.min(...next.map(s=>s.size))>Math.max(...previous.map(s=>s.size)));
  }
  for(const s of SPECIES.filter(s=>s.compactEvolution))assert.equal(s.rarity,"rare");
  assert.ok(SPECIES_BY_ID.tyrannosaurus.hp>380*1.2);
  assert.ok(SPECIES_BY_ID.tyrannosaurus.damage>76*1.2);
});

test("evolving a mature giant keeps a larger body and resets its form-specific cooldowns",()=>{
  const g=isolated("dreadnoughtus");
  g.player.growth=1;
  const before=g.effectiveSize;
  g.player.xp=g.nextThreshold;g.evolutionReady=true;g.state="evolution";
  g.evolutionChoices=["wyvern"];g.mutationChoices=["razor"];
  g.player.techniqueCooldown=10;
  assert.ok(g.evolve("wyvern","razor"));
  assert.ok(g.effectiveSize>=before*1.059);
  assert.equal(g.player.growth,0);
  assert.equal(g.player.techniqueCooldown,0);
  const rare=isolated("dreadnoughtus");
  rare.player.growth=1;rare.player.xp=rare.nextThreshold;rare.evolutionReady=true;rare.state="evolution";
  rare.evolutionChoices=["unicorn"];rare.mutationChoices=["razor"];
  const oldSize=rare.effectiveSize;
  assert.ok(rare.evolve("unicorn","razor"));
  assert.ok(rare.effectiveSize<oldSize);
});

test("carnivores skip fibrous foliage and can eat fruit, mushrooms and bloodline ingredients",()=>{
  const g=isolated("velociraptor"),fern=g.spawnFood("plant",0,0,20,{plantKind:"fern"});
  assert.equal(speciesDiet(g.species),"carnivore");
  assert.equal(g.eat(),false);
  assert.ok(g.foods.includes(fern));
  const berry=g.spawnFood("plant",1,0,9,{plantKind:"berry"});
  assert.ok(g.eat());
  assert.ok(!g.foods.includes(berry));
  assert.ok(g.foods.includes(fern));
  assert.equal(g.player.xp,9);
  assert.ok(canEatFood(g.species,{type:"plant",plantKind:"mushroom"}));
  assert.ok(canEatFood(g.species,{type:"lineage-fruit",fruit:"sunheart"}));
  assert.ok(canEatFood(SPECIES_BY_ID.triceratops,fern));
  assert.ok(canEatFood(SPECIES_BY_ID.oviraptor,fern));
});

test("wild carnivores use the same plant diet rules and consume an actual compatible meal",()=>{
  const g=isolated("velociraptor"),e=g.spawnEntity("velociraptor",40,0,{passive:true,nutrients:0});
  e.hunger=20;e.feedCooldown=0;
  const fern=g.spawnFood("plant",40,0,50,{plantKind:"fern"}),berry=g.spawnFood("plant",41,0,50,{plantKind:"berry"});
  g._updateEntity(e,.05);
  assert.ok(g.foods.includes(fern));
  assert.ok(!g.foods.includes(berry));
  assert.ok(e.nutrients>0);
});

test("seeded foraging offers distinct natural foods with different nutrition and healing",()=>{
  assert.equal(new Set(FOOD_PLANTS.map(p=>p.id)).size,12);
  assert.ok(new Set(FOOD_PLANTS.map(p=>p.hunger)).size>=5);
  assert.ok(new Set(FOOD_PLANTS.map(p=>p.healing)).size>=4);
  const a=new Game({seed:901}),b=new Game({seed:901});
  const plants=a.foods.filter(f=>f.type==="plant");
  assert.ok(new Set(plants.map(f=>f.plantKind)).size>=8);
  assert.deepEqual(a.foods,b.foods);
  assert.ok(plants.every(f=>plantDefinition(f).name===f.name));
});
