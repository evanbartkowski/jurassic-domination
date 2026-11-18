import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SPECIES} from '../src/data.js';
test('every production creature carries reviewed facial anatomy and authored fine surface detail',()=>{
 for(const {id} of SPECIES){
  const report=JSON.parse(readFileSync(`assets/art-v5/creatures/${id}/report.json`));
  assert.equal(report.detailVersion,2,id);
  assert.ok(report.detailFeatures.orbitalRims>=2,id+' eyelids');
  assert.ok(report.detailFeatures.facialScales>=8,id+' facial relief');
  assert.ok(report.detailFeatures.skinFolds>=2,id+' skin folds');
  assert.ok(report.triangles<=80000,id+' real-time mesh budget');
  assert.equal(report.qa.pass,true,id);assert.equal(report.lodQA.pass,true,id);
  const binary=readFileSync(`public/assets/models-v5/${id}.glb`),gltf=JSON.parse(binary.subarray(20,20+binary.readUInt32LE(12)));
  assert.equal(gltf.materials[0].extras.detailVersion,2,id+' native detail maps survive export');
 }
});
