import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {mkdtempSync,rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';
test('a failed Blender launch cannot reuse an older successful report as a fresh pass',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'jd-reference-builder-test-'));
 try{const result=spawnSync(process.execPath,['scripts/build-reference-creatures.mjs','tyrannosaurus'],{encoding:'utf8',env:{...process.env,BLENDER_EXE:path.join(dir,'missing-blender.exe'),JD_REFERENCE_BUILD_LOG_DIR:dir},windowsHide:true});assert.notEqual(result.status,0,'missing Blender must fail even when an old report exists');assert.doesNotMatch(result.stdout,/GEOMETRY PASS/);}
 finally{assert.equal(path.dirname(dir),os.tmpdir());rmSync(dir,{recursive:true,force:true});}
});
