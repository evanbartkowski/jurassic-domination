export const RARITY_ORDER=['common','uncommon','rare','epic','legendary'];
export const CRATE_TYPES=Object.freeze({
 field:{id:'field',name:'Wildwood Cache',rarity:'uncommon',floor:'common',color:'#86bb9a',dna:3,xp:30,description:'A weathered expedition crate hidden among the roots.',odds:{common:45,uncommon:38,rare:14,epic:2.7,legendary:.3}},
 hunter:{id:'hunter',name:'Hunter’s Vault',rarity:'rare',floor:'uncommon',color:'#79bded',dna:6,xp:55,description:'An iron-bound cache recovered from a dangerous hunting ground.',odds:{common:0,uncommon:50,rare:38,epic:10,legendary:2}},
 elder:{id:'elder',name:'Elder Reliquary',rarity:'epic',floor:'rare',color:'#c499ef',dna:12,xp:90,description:'An ancient stone coffer guarded by the strongest survivors.',odds:{common:0,uncommon:0,rare:70,epic:25,legendary:5}},
 primeval:{id:'primeval',name:'Primordial Vault',rarity:'legendary',floor:'epic',color:'#efc16e',dna:25,xp:150,description:'A gold-sealed relic of the first age. An extraordinary discovery.',odds:{common:0,uncommon:0,rare:0,epic:75,legendary:25}},
});
export const TREASURES=Object.freeze({
 'amber-cluster':{id:'amber-cluster',name:'Living Amber Cluster',rarity:'uncommon',color:'#e5b967',dna:[3,6],xp:25,description:'Preserved genes suspended in golden resin.'},
 'fossil-geode':{id:'fossil-geode',name:'Fossil Geode',rarity:'rare',color:'#83c7ed',dna:[8,14],xp:60,description:'A cracked stone packed with pristine genetic fossils.'},
 'prismatic-core':{id:'prismatic-core',name:'Prismatic Heart',rarity:'epic',color:'#c29bf4',dna:[18,28],xp:100,description:'A violet crystal pulsing with ancient life.'},
 'primordial-heart':{id:'primordial-heart',name:'First Age Heart',rarity:'legendary',color:'#f4cb74',dna:[45,65],xp:200,description:'An exceptionally rare store of primordial DNA.'},
});
export function lootHash(value){let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
export function lootRandom(seed){let state=seed>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};}
export function crateForRegion(tier,random){const n=random();return tier>=5&&n<.035?'primeval':tier>=3&&n<.20?'elder':n<.54?'hunter':'field';}
export function treasureForRegion(tier,random){const n=random();return tier>=5&&n<.025?'primordial-heart':tier>=3&&n<.16?'prismatic-core':n<.45?'fossil-geode':'amber-cluster';}
