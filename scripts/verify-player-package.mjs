import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { extractFile } from '@electron/asar';
import packageInfo from '../package.json' with { type: 'json' };

const root = path.resolve(import.meta.dirname, '..');
const release = path.resolve(process.env.JD_RELEASE_DIR||path.join(root, 'release', 'frontier'));
const archive = path.join(release, 'win-unpacked', 'resources', 'app.asar');
const executable = path.join(release, `Jurassic Domination-${packageInfo.version}-portable.exe`);
const digest = data => createHash('sha256').update(data).digest('hex');
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(filename));
    else result.push(filename);
  }
  return result;
}
const built = [...await files(path.join(root, 'dist')),...await files(path.join(root,'electron'))];
let bytes = 0;
for (const filename of built) {
  const expected = await readFile(filename);
  const relative = path.relative(root, filename);
  const packed = extractFile(archive, relative);
  assert.equal(digest(packed), digest(expected), `Packaged file differs: ${relative}`);
  bytes += expected.byteLength;
}
const packedMetadata = JSON.parse(extractFile(archive, 'package.json'));
assert.equal(packedMetadata.version, packageInfo.version);
const portableBytes = await readFile(executable);
const sha256 = digest(portableBytes);
const report = { version: packageInfo.version, generatedAt: new Date().toISOString(),
  allBuiltFilesMatch: true, files: built.length, bytes,
  portable: { path: path.relative(root, executable), bytes: portableBytes.byteLength, sha256 } };
await writeFile(path.join(root, 'artifacts', process.env.JD_QA_ARTIFACT||'frontier', 'package-verification.json'), JSON.stringify(report, null, 2));
await writeFile(path.join(release, 'SHA256SUMS.txt'), `${sha256}  ${path.basename(executable)}\n`);
console.log(JSON.stringify(report, null, 2));
