import fs from 'node:fs/promises';
import { SPECIES } from '../src/data.js';
import { anatomyForSpecies } from '../src/anatomy.js';
await fs.mkdir('assets/art-v3',{recursive:true});
await fs.writeFile('assets/art-v3/anatomy.json',JSON.stringify(SPECIES.map(s=>({species:s,anatomy:anatomyForSpecies(s)})),null,2));
console.log(`Authored profiles: ${SPECIES.length}`);
