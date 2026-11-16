import fs from 'node:fs/promises';
import sharp from 'sharp';
const dir='artifacts/reference-overhaul/references';await fs.mkdir(dir,{recursive:true});
const catalog=JSON.parse(await fs.readFile('assets/reference-pack/references/dinosaur_reference_catalog.json','utf8'));
const results=[];let cursor=0;
async function request(url){const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'JurassicDominationArtReference/1.0 (local anatomy research)'}});if(!r.ok)throw Error('HTTP '+r.status);return r;}
async function worker(){while(cursor<catalog.length){const e=catalog[cursor++],record={...e,redistribution:'Reference only. Not bundled in game or asserted to be freely licensed.',imageInspected:false};try{
 let url=e.reference_url;let r=await request(url);let buffer=Buffer.from(await r.arrayBuffer());
 if(!(r.headers.get('content-type')||'').startsWith('image/')){
  const html=buffer.toString();const img=html.match(/property=["']og:image["'][^>]+content=["']([^"']+)/)||html.match(/content=["']([^"']+)["'][^>]+property=["']og:image/);
  if(!img)throw Error('Gallery/source page requires manual image selection');url=new URL(img[1].replaceAll('&amp;','&'),e.reference_url).href;r=await request(url);buffer=Buffer.from(await r.arrayBuffer());
 }
 const meta=await sharp(buffer).metadata();if(!meta.width||meta.width<250)throw Error('Reference too small');
 await sharp(buffer).resize(500,320,{fit:'inside'}).flatten({background:'#eee'}).jpeg({quality:88}).toFile(`${dir}/${e.id}.jpg`);
 Object.assign(record,{status:'downloaded-unreviewed',imageUrl:url,width:meta.width,height:meta.height,file:`${e.id}.jpg`});
 }catch(error){Object.assign(record,{status:'unresolved',reason:error.message});}results.push(record);console.log(`${results.length}/${catalog.length} ${e.id}: ${record.status}`);}}
await Promise.all(Array.from({length:5},worker));results.sort((a,b)=>catalog.findIndex(e=>e.id===a.id)-catalog.findIndex(e=>e.id===b.id));await fs.writeFile(`${dir}/index.json`,JSON.stringify(results,null,2));
const images=results.filter(e=>e.file);for(let start=0;start<images.length;start+=20){const group=images.slice(start,start+20),layers=[];for(let i=0;i<group.length;i++){const e=group[i],thumb=await sharp(`${dir}/${e.file}`).resize(300,200,{fit:'contain',background:'#eee'}).toBuffer();layers.push({input:thumb,left:(i%4)*300,top:Math.floor(i/4)*225});const label=Buffer.from(`<svg width="300" height="25"><rect width="300" height="25" fill="#fff"/><text x="8" y="17" font-size="14">${e.id}</text></svg>`);layers.push({input:label,left:(i%4)*300,top:Math.floor(i/4)*225+200});}await sharp({create:{width:1200,height:Math.ceil(group.length/4)*225,channels:3,background:'#eee'}}).composite(layers).png().toFile(`${dir}/sheet-${start/20+1}.png`);}
console.log(JSON.stringify({downloaded:images.length,unresolved:results.length-images.length}));
