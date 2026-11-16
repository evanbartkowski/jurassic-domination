import {spawn} from 'node:child_process';
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir='artifacts/primeval';await mkdir(dir,{recursive:true});
const stages=[['capture-primeval-poses.mjs','poses'],['qa-primeval-world.mjs','world-qa'],['qa-primeval-art.mjs','art-qa'],['qa-primeval-cosmetics.mjs','cosmetics-qa'],['qa-collections.mjs','collections-qa'],['qa.mjs','general-qa'],['render-portraits.mjs','portraits'],['capture-primeval-ui.mjs','ui','after']];
const steps=process.argv.includes('--art-only')?[stages[0],stages[6],stages[7],stages[1],stages[2]]:stages;
for(const [script,name,...args]of steps){
 console.log('Running '+name);let output='';const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['scripts/'+script,...args],{stdio:['ignore','pipe','pipe']});p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',reject);p.on('close',resolve);});await writeFile(`${dir}/${name}.log`,output);assert.equal(code,0,`${script}\n${output.slice(-1800)}`);console.log('PASS '+name+' '+output.trim().split('\n').at(-1));
}
for(const [source,target]of[['qa-report.json','general-qa.json'],['collections-qa.json','collections-qa.json']])await copyFile('artifacts/'+source,dir+'/'+target);
console.log('All Primeval browser and portrait stages passed.');
