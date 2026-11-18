// Keep source and historical releases; omit superseded GLBs from fresh builds.
import {access,rm,readdir,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import ids from '../src/primeval-assets.json' with {type:'json'};
import {SPECIES} from '../src/data.js';
import referenceAssets from '../src/reference-assets.json' with {type:'json'};
assert.deepEqual([...ids].sort(),SPECIES.map(s=>s.id).sort());
const web=process.argv.includes('--web'),output=web?'web-dist':'dist',assets=path.resolve(output,'assets');
for(const id of ids)await access(path.join(assets,'models-v4',id+'.glb'));
for(const id of ids){assert.equal(referenceAssets[id]?.enabled,true,id);assert.equal(referenceAssets[id].file,`models-v5/${id}.glb`);await access(path.join(assets,referenceAssets[id].file));}
for(const name of ['models','models-v2','models-v3',...(web?['models-v4']:[])]){
 const target=path.resolve(assets,name);assert.equal(path.dirname(target),assets);assert.ok(target.startsWith(path.resolve(output)+path.sep));
 await rm(target,{recursive:true,force:true});
}
if(web){
 await writeFile(path.resolve(output,'.nojekyll'),'');
 const size=async folder=>{let bytes=0;for(const entry of await readdir(folder,{withFileTypes:true})){const p=path.join(folder,entry.name);bytes+=entry.isDirectory()?await size(p):(await stat(p)).size;}return bytes;};
 const bytes=await size(path.resolve(output));assert.ok(bytes<950*1024*1024,`Web edition exceeds its 950 MiB publishing budget: ${bytes}`);
 console.log(`Verified ${ids.length} current creature models; web edition ${(bytes/1024/1024).toFixed(1)} MiB. Older copies omitted; procedural fallback retained.`);
}else console.log(`Verified ${ids.length} reference-led v5 models with v4 loading fallback; omitted older build copies. Source assets retained.`);
