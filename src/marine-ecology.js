const IDS=['archelon','ichthyosaurus','elasmosaurus','dunkleosteus','mosasaurus','megalodon','tideweaver','abyssal-kronosaur'];
export const MARINE_TRAITS={archelon:{hp:1.65,damage:.5,speed:.58,passive:true,armor:.4},ichthyosaurus:{hp:.72,damage:.65,speed:1.35},elasmosaurus:{hp:1,damage:.9,speed:.88},dunkleosteus:{hp:1.6,damage:1.3,speed:.75,armor:.3},mosasaurus:{hp:1.25,damage:1.3,speed:1.03},megalodon:{hp:1.4,damage:1.55,speed:1.1}};
export function marineRoster(pool){const hash=[...pool.id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17);return Array.from({length:3},(_,i)=>IDS[(hash+i*3+(pool.tier||0))%IDS.length]);}
export function marineBodyLength(pool,index){return Math.min(pool.radius*.55,4.8+(pool.tier||0)*.65+index*.8);}
