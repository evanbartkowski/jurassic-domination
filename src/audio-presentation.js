const PICKUPS=new Map([['crate-find',3],['treasure-find',2],['collection-find',2],['dna-find',1]]);
const SOUNDS={powerup:'eat','run-skill':'evolve',unlock:'evolve','enemy-ability':'ability','run-cast':'ability','egg-hatch':'hatch',discovery:'evolve',adaptation:'evolve','world-event':'warning','incident-warning':'warning','meteor-impact':'thunder','lightning-strike':'thunder','obstacle-demolished':'demolish'};
/** One reward phrase per interaction, even when a find emits multiple receipts. */
export function pickupSound(events){
 let rank=0;for(const event of events)rank=Math.max(rank,PICKUPS.get(event.type)||0);
 return rank>=2?'collection-find':rank?'dna-find':null;
}
export function eventSound(type,hasPickup=false){
 if(PICKUPS.has(type)||(hasPickup&&type==='collect'))return null;
 return SOUNDS[type]||type;
}
