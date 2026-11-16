// Keep source and historical releases; omit superseded GLBs from fresh builds.
import {access,rm} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ids from '../src/primeval-assets.json' with {type:'json'};
import {SPECIES} from '../src/data.js';
import referenceAssets from '../src/reference-assets.json' with {type:'json'};
assert.deepEqual([...ids].sort(),SPECIES.map(s=>s.id).sort());
const assets=path.resolve('dist/assets');
for(const id of ids)await access(path.join(assets,'models-v4',id+'.glb'));
for(const id of ids){assert.equal(referenceAssets[id]?.enabled,true,id);assert.equal(referenceAssets[id].file,`models-v5/${id}.glb`);await access(path.join(assets,referenceAssets[id].file));}
for(const name of ['models','models-v2','models-v3']){
 const target=path.resolve(assets,name);assert.equal(path.dirname(target),assets);assert.ok(target.startsWith(path.resolve('dist')+path.sep));
 await rm(target,{recursive:true,force:true});
}
console.log(`Verified ${ids.length} reference-led v5 models with v4 loading fallback; omitted older build copies. Source assets retained.`);
