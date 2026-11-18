import {SPECIES_BY_ID} from './data.js';
/** Only locally reviewed exports may override the working roster. */
export function creatureAssetCandidates(id,base='./',manifest={}, {legacy=true}={}){
 if(!SPECIES_BY_ID[id])return [];
 const entry=manifest[id],paths=[];
 if(entry?.enabled===true&&entry.file===`models-v5/${id}.glb`)paths.push(`${base}assets/${entry.file}`);
 if(legacy)paths.push(`${base}assets/models-v4/${id}.glb`);
 return paths;
}
