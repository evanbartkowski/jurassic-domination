export const MUTATION_RANK={common:0,rare:1,epic:2,legendary:3};
export function mutationPoolForRarity(pool,rarity){const cap=MUTATION_RANK[rarity]??0;return pool.filter(m=>(MUTATION_RANK[m.rarity]??0)<=cap);}
export function mutationRarityFromKill(tier,boss,roll){return boss?(roll<.03?'legendary':roll<.68?'epic':'rare'):tier>=4?(roll<.004?'legendary':roll<.20?'epic':'rare'):(roll<.035?'epic':roll<.26?'rare':'common');}
export function evolutionMutationRarity(tier,roll){return tier>=4&&roll<.001?'legendary':tier>=2&&roll<.035?'epic':roll<.23?'rare':'common';}
