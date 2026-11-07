import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { extractFile } from '@electron/asar';
const meta = JSON.parse(await fs.readFile('package.json','utf8'));
const archive = path.resolve('release/win-unpacked/resources/app.asar');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const assets = (await fs.readdir('dist/assets')).filter(name => /\.(js|css)$/.test(name));
const report = {version:meta.version,assets:[]};
for (const name of assets) {
  const disk = await fs.readFile(path.join('dist/assets',name));
  const packed = extractFile(archive,path.join('dist','assets',name));
  assert.equal(hash(disk),hash(packed),name);
  if (name.startsWith('index-') && name.endsWith('.js')) assert.equal(disk.includes(Buffer.from('__JD')),false,'production diagnostics must be absent');
  report.assets.push({name,bytes:disk.length,sha256:hash(disk)});
}
for (const id of ['tideweaver','abyssal-kronosaur']) {
  const relative = path.join('assets','portraits',`species-${id}.webp`);
  assert.equal(hash(await fs.readFile(path.join('dist',relative))),hash(extractFile(archive,path.join('dist',relative))),relative);
}
assert.equal(JSON.parse(extractFile(archive,'package.json').toString()).version,meta.version);
const filename = `Jurassic Domination-${meta.version}-portable.exe`;
const executable = await fs.readFile(path.join('release',filename));
assert.ok(executable.length>50_000_000,'portable must contain the Electron runtime');
report.portable = {filename,bytes:executable.length,sha256:hash(executable)};
await fs.mkdir('artifacts',{recursive:true});
await fs.writeFile('artifacts/package-audit.json',JSON.stringify(report,null,2));
await fs.writeFile('release/SHA256SUMS.txt',`${report.portable.sha256}  ${filename}\n`);
console.log(`Verified ${assets.length} bundled code assets, two marine portraits, package version and portable SHA-256.`);
