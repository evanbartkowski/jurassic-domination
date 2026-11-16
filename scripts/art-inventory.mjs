import { SPECIES } from '../src/data.js';
import { creatureArtDirection } from '../src/creature-art-direction.js';
import { FLAGSHIP_SPECIES_IDS } from '../src/flagship-models.js';
import { readFile, writeFile } from 'node:fs/promises';
const runtime=JSON.parse(await readFile('artifacts/visual-overhaul/runtime-qa.json','utf8'));
const meshQA=JSON.parse(await readFile('artifacts/visual-overhaul/creature-mesh-qa.json','utf8'));
const botanyQA=JSON.parse(await readFile('artifacts/visual-overhaul/botany-qa.json','utf8'));
const creatures=[];
for(const s of SPECIES){
 const imported=FLAGSHIP_SPECIES_IDS.has(s.id);
 const report=imported ? JSON.parse(await readFile(`assets/art-v2/creatures/${s.id}/report.json`,'utf8')) : null;
 creatures.push({id:s.id,name:s.name,body:s.body,family:creatureArtDirection(s).family,
  original:imported?`assets/models/${s.id}/${s.id}.blend`:'src/creatures.js (original retained in Git)',
  replacement:imported?`public/assets/models-v2/${s.id}/${s.id}.glb`:'src/creatures.js + src/creature-art-direction.js',
  blenderSource:imported?`assets/art-v2/creatures/${s.id}/${s.id}.blend`:null,
  animation:imported?report.clips:'Existing articulated procedural locomotion, feeding, attack, rest and anatomy behavior retained',
  integration:'Gameplay and specimen viewer; custom skins and inherited marking variants retain procedural anatomy',
  visualVerification:`artifacts/visual-overhaul/${imported?'creature-contact-sheet.png':`roster-${Math.floor(SPECIES.indexOf(s)/12)*12}.png`}`,
  meshQA:imported?meshQA[s.id].pass:null,
  status:imported?'Integrated Blender art pass':'Integrated shared material and silhouette-family pass; individual bespoke remodeling remains'});
}
const vegetation=runtime.botany.map(id=>({id,original:'src/terrain.js / src/wilderness-art.js (original retained in Git)',
 replacement:'src/botany-meshes.json',blenderSource:'assets/art-v2/botany/prehistoric-botany.blend',
 exportedAsset:'assets/art-v2/botany/prehistoric-botany.glb',lods:4,
  animation:['rock','log'].includes(id)?'Static prop':'Rooted shader wind on terrain foliage',
 integration:['log','rock'].includes(id)?'Terrain / wilderness props':'Instanced terrain',
 meshQA:Object.entries(botanyQA).find(([name])=>name.startsWith(id+'_'))?.[1].pass,
 visualVerification:'artifacts/visual-overhaul/botany-contact-sheet.png',status:'Integrated Blender mesh pass'}));
await writeFile('docs/VISUAL_ASSET_INVENTORY.json',JSON.stringify({date:'2026-11-15',engine:'Three.js r187; 3D, Y-up, +X forward; browser and Electron',
 camera:'43 degree perspective; elevated following camera; responsive; shadowed instanced terrain',
 creatures,vegetation,
 retainedAssets:['Forage food varieties and rare plants (src/forage-art.js)','Aquatic fish, water surfaces, caves and landmarks (src/wilderness-art.js)','Nest and ecology markers (src/ecology-art.js)','Sanctuary decorations and cosmetics (src/collection-art.js)','Terrain ground textures, atmosphere and biome transitions'],
 remaining:['92 forms received shared rendering and selected family proportion improvements, not bespoke Blender sculpts.','Damage, roar, drinking, evolution and death do not have dedicated new Blender clips; existing game effects remain.','Retained assets above have not received individual replacement meshes.','Final aesthetic approval and hardware FPS testing remain; automated checks do not establish premium art quality.']},null,2));
console.log(`Inventoried ${creatures.length} forms and ${vegetation.length} new environment meshes.`);
