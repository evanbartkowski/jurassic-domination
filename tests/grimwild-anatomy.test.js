import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, SPECIES_BY_ID } from '../src/data.js';
const anatomy=await import('../src/anatomy.js').catch(()=>({}));
test('every species has a finite authored anatomy profile and recognizable family',()=>{
 assert.equal(typeof anatomy.anatomyForSpecies,'function');
 for(const s of SPECIES){const a=anatomy.anatomyForSpecies(s);assert.ok(a.family&&a.head&&a.skull);assert.ok([...a.head,...a.skull,a.hip,a.width,a.depth,a.tail].every(Number.isFinite));assert.ok(a.skull.every(v=>v>0));}
});
test('ceratopsian horns, hadrosaur bills and spinosaur sails belong to the correct genera',()=>{
 assert.equal(typeof anatomy.anatomyForSpecies,'function');const a=id=>anatomy.anatomyForSpecies(SPECIES_BY_ID[id]);
 assert.equal(a('triceratops').horns,3);assert.equal(a('protoceratops').horns,0);assert.equal(a('psittacosaurus').frill,false);
 assert.equal(a('parasaurolophus').crest,'tube');assert.equal(a('iguanodon').family,'iguanodont');
 assert.equal(a('spinosaurus').sail,true);assert.equal(a('baryonyx').sail,false);
 assert.equal(a('pachycephalosaurus').biped,true);assert.equal(a('ankylosaurus').club,true);
});
test('tyrants, feathered raptors and sauropods use distinct skull and limb proportions',()=>{
 assert.equal(typeof anatomy.anatomyForSpecies,'function');const a=id=>anatomy.anatomyForSpecies(SPECIES_BY_ID[id]);
 assert.ok(a('tyrannosaurus').skull[2]>a('velociraptor').skull[2]*1.5);assert.ok(a('tyrannosaurus').arms<a('velociraptor').arms*.6);
 assert.equal(a('velociraptor').feathered,true);assert.ok(a('brachiosaurus').head[1]>a('triceratops').head[1]*3);
 assert.equal(a('quetzalcoatlus').family,'pterosaur');
});
