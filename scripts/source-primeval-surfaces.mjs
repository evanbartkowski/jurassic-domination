import fs from 'node:fs/promises';import path from 'node:path';import {createHash}from'node:crypto';import sharp from'sharp';
const source='assets/art-v4/surface-sources',out='public/assets/surfaces-v4';await fs.mkdir(source,{recursive:true});await fs.mkdir(out,{recursive:true});const records=[];
async function get(url,file,asset){const r=await fetch(url);if(!r.ok)throw Error(r.status+' '+url);const b=Buffer.from(await r.arrayBuffer());await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,b);records.push({asset,url,file,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),license:'CC0-1.0',licenseURL:'https://polyhaven.com/license'});return b;}
for(const [kind,id]of[['soil','forest_floor'],['stone','rock_face'],['wood','bark_brown_02']]){
 const files=await(await fetch('https://api.polyhaven.com/files/'+id)).json();
 for(const [map,key]of[['color','Diffuse'],['normal','nor_gl'],['roughness','Rough']]){
  const item=files[key]['1k'].jpg,b=await get(item.url,`${source}/${id}/${map}.jpg`,id),image=sharp(b).resize(map==='color'?1024:512,map==='color'?1024:512,{fit:'fill'});
  await image.png().toFile(`${out}/${kind}-${map}.png`);
 }
}
for(const [kind,id,prefix]of[['conifer','fir_sapling_medium','fir_sapling_medium_twigs'],['broadleaf','jacaranda_tree','jacaranda_tree_leaves']]){
 const files=await(await fetch('https://api.polyhaven.com/files/'+id)).json(),includes=files.blend['1k'].blend.include,parts={};
 for(const [map,suffix]of[['color','diff'],['normal','nor_gl'],['roughness','rough'],['alpha','alpha']]){
  const [name,entry]=Object.entries(includes).find(([name])=>name.includes(prefix+'_'+suffix+'_')&&name.endsWith('.png'))||[];if(!entry)throw Error('Missing source '+prefix+' '+suffix);
  parts[map]=await get(entry.url,`${source}/${id}/${path.basename(name)}`,id);
 }
 const a=await sharp(parts.alpha).resize(768,1024,{fit:'fill'}).greyscale().raw().toBuffer();const foliage=await sharp(parts.color).resize(768,1024,{fit:'fill'}).ensureAlpha().raw().toBuffer();for(let i=0;i<a.length;i++)foliage[i*4+3]=a[i];
 const wood=await sharp(`${out}/wood-color.png`).resize(256,1024,{fit:'fill'}).ensureAlpha().toBuffer();await sharp({create:{width:1024,height:1024,channels:4,background:'#00000000'}}).composite([{input:foliage,raw:{width:768,height:1024,channels:4},left:0,top:0},{input:wood,left:768,top:0}]).png().toFile(`${out}/${kind}-color.png`);
 for(const map of ['normal','roughness']){const left=await sharp(parts[map]).resize(384,512,{fit:'fill'}).png().toBuffer(),right=await sharp(`${out}/wood-${map}.png`).resize(128,512,{fit:'fill'}).png().toBuffer();await sharp({create:{width:512,height:512,channels:3,background:map==='normal'?'#8080ff':'#cccccc'}}).composite([{input:left,left:0,top:0},{input:right,left:384,top:0}]).png().toFile(`${out}/${kind}-${map}.png`);}
}
await fs.writeFile('assets/art-v4/surface-provenance.json',JSON.stringify({provider:'Poly Haven',license:'CC0-1.0',licenseURL:'https://polyhaven.com/license',records,processing:'Color maps 1024px sRGB; data maps 512px linear. Tree atlases combine licensed branch/leaf color and alpha with a bark strip. No source tree geometry is bundled.'},null,2));console.log('Prepared licensed terrain, stone, bark and two foliage atlases');
