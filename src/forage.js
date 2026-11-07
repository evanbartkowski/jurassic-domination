/** Real forage varieties. Fibrous foliage is never a carnivore meal. */
export const FOOD_PLANTS = [
  { id: "fern", name: "Tender Ferns", group: "foliage", color: 0x81b65a, nutrition: 1, hunger: 14, healing: 0.025 },
  { id: "horsetail", name: "River Horsetails", group: "foliage", color: 0x66a98d, nutrition: 1.1, hunger: 16, healing: 0.025 },
  { id: "cycad", name: "Sweet Cycad Shoots", group: "foliage", color: 0xb0bd58, nutrition: 1.25, hunger: 18, healing: 0.03 },
  { id: "ginkgo", name: "Ginkgo Leaves", group: "foliage", color: 0xd4ba53, nutrition: 1.15, hunger: 16, healing: 0.035 },
  { id: "lotus", name: "Lotus Roots", group: "root", color: 0xd4a5bd, nutrition: 1.3, hunger: 20, healing: 0.035 },
  { id: "tuber", name: "Wild Tubers", group: "root", color: 0xbc8d62, nutrition: 1.4, hunger: 22, healing: 0.025 },
  { id: "berry", name: "Amber Berries", group: "fruit", color: 0xf0a84d, nutrition: 1.05, hunger: 12, healing: 0.035 },
  { id: "fig", name: "Forest Figs", group: "fruit", color: 0xbd779f, nutrition: 1.2, hunger: 15, healing: 0.04 },
  { id: "melon", name: "Wild Melon", group: "fruit", color: 0xaddc75, nutrition: 1.35, hunger: 19, healing: 0.03 },
  { id: "mushroom", name: "Honeycap Mushrooms", group: "fungus", color: 0xd7b681, nutrition: 1.1, hunger: 13, healing: 0.045 },
  { id: "crystal-fruit", name: "Starplum Fruit", group: "fruit", color: 0xb3a0f1, nutrition: 1.5, hunger: 20, healing: 0.055 },
  { id: "frostberry", name: "Frostberries", group: "fruit", color: 0x90cbe7, nutrition: 1.25, hunger: 15, healing: 0.045 },
];
const plants = new Map(FOOD_PLANTS.map((p) => [p.id, p]));
const herbivores = /psittacosaurus|leaellynasaura|lesothosaurus|hypsilophodon|dryosaurus|pachycephalosaurus|protoceratops|kentrosaurus|iguanodon|stegosaurus|therizinosaurus|elderroot|triceratops|ankylosaurus|minmi|stygimoloch|styracosaurus|parasaurolophus|euoplocephalus|maiasaura|pachyrhinosaurus|edmontosaurus|shantungosaurus/;
const omnivores = /compsognathus|heterodontosaurus|ornithomimus|gallimimus|oviraptor|mononykus|troodon/;
export function speciesDiet(s) {
  if (s.diet) return s.diet;
  if (herbivores.test(s.id) || ["longneck", "equine"].includes(s.body)) return "herbivore";
  return omnivores.test(s.id) ? "omnivore" : "carnivore";
}
export function dietName(s) {
  return { herbivore: "Herbivore", omnivore: "Omnivore", carnivore: "Carnivore" }[speciesDiet(s)];
}
export function plantDefinition(food) {
  // Old food objects remain valid: an unspecified plant is ordinary foliage.
  return plants.get(food.plantKind) || FOOD_PLANTS[0];
}
export function canEatFood(s, food) {
  if (!food || !s) return false;
  if (food.type === "plant") {
    return speciesDiet(s) !== "carnivore" || ["fruit", "fungus"].includes(plantDefinition(food).group);
  }
  // Meat and eggs remain survival options for all fantastical playable forms.
  // Bloodline fruit and medicinal power-up plants are universal supplements.
  return true;
}
export function foodLabel(food) {
  if (food?.type === "plant") return plantDefinition(food).name;
  if (food?.type === "lineage-fruit") return food.fruit === "sunheart" ? "Sunheart Fruit" : "Moondrop Fruit";
  return { meat: "Fresh Meat", egg: "Dinosaur Egg", essence: "Ancient Essence", rareplant: "Medicinal Plant" }[food?.type] || "Discovery";
}
export function forageForRegion(region, random) {
  const ids = region.id === "frost" ? ["frostberry", "tuber", "ginkgo", "mushroom"]
    : ["marsh", "fen"].includes(region.id) ? ["horsetail", "lotus", "fern", "berry", "mushroom"]
      : ["desert", "volcano", "savannah"].includes(region.id) ? ["cycad", "tuber", "melon", "fig"]
        : region.tier >= 6 ? ["crystal-fruit", "ginkgo", "fig", "mushroom", "cycad"]
          : ["fern", "horsetail", "cycad", "ginkgo", "berry", "fig", "mushroom", "melon", "tuber"];
  return plants.get(ids[Math.min(ids.length - 1, Math.floor(random() * ids.length))]);
}
