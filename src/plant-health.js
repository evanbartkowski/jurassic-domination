export function plantHealth(plant){
  if(!plant||plant.dead||!['plant','rareplant','carnivore'].includes(plant.type))return null;
  const maxHp=plant.maxHp||(plant.type==='carnivore'?45+(plant.tier||0)*35:12+(plant.tier||0)*8);
  const hp=Math.max(0,Math.min(maxHp,Number.isFinite(plant.hp)?plant.hp:maxHp));
  return {hp,maxHp,ratio:hp/maxHp};
}
