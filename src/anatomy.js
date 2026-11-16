/** Original anatomical authoring profiles. Coordinates: forward X, Blender up Z. */
const variants={'verdant-psittacosaurus':'psittacosaurus','verdant-iguanodon':'iguanodon','elderroot-therizinosaurus':'therizinosaurus','cinderfang-carnotaurus':'carnotaurus','ashborn-tyrannosaurus':'tyrannosaurus','eclipse-wyrm':'wyvern','stormcrown-dragon':'elder-dragon'};
const includes=(id,words)=>words.split(' ').includes(id);
export function anatomyForSpecies(s){
 const id=variants[s.id]||s.id;
 const a={id:s.id,base:id,family:'theropod',biped:true,hip:1.45,width:.40,depth:.48,torso:1.7,head:[1.18,1.72],skull:[.78,.25,.27],tail:2.75,arms:.62,feathered:false,horns:0,frill:false,sail:false,club:false,crest:null,wings:false,teeth:true,fingers:3,toes:3};
 if(includes(id,'tyrannosaurus tarbosaurus albertosaurus yutyrannus'))Object.assign(a,{family:'tyrannosaur',hip:1.62,width:.52,depth:.55,head:[1.25,2.06],skull:[1.10,.35,.40],arms:.25,fingers:2,feathered:id==='yutyrannus'});
 else if(includes(id,'giganotosaurus carcharodontosaurus allosaurus acrocanthosaurus mapusaurus torvosaurus megalosaurus ceratosaurus australovenator'))Object.assign(a,{family:'carnosaur',hip:1.58,width:.49,depth:.58,head:[1.3,1.85],skull:[1.04,.27,.34],arms:.62,horns:id==='ceratosaurus'?1:0,ridge:id==='acrocanthosaurus'});
 else if(id==='carnotaurus')Object.assign(a,{family:'abelisaur',hip:1.65,width:.46,depth:.58,head:[1.3,1.98],skull:[.65,.3,.42],arms:.13,horns:2});
 else if(includes(id,'spinosaurus baryonyx suchomimus'))Object.assign(a,{family:'spinosaur',hip:id==='spinosaurus'?1.28:1.5,width:.46,depth:.54,head:[1.45,1.62],skull:[1.3,.2,.23],arms:.85,sail:id==='spinosaurus',tail:3.15});
 else if(includes(id,'velociraptor deinonychus dromaeosaurus utahraptor utahraptor-young troodon microraptor sinosauropteryx archaeopteryx'))Object.assign(a,{family:'dromaeosaur',hip:1.3,width:.31,depth:.37,head:[1.24,1.62],skull:[.64,.16,.19],arms:.87,tail:3.1,feathered:true,sickle:true,wings:includes(id,'microraptor archaeopteryx')?'feather':false});
 else if(includes(id,'coelophysis compsognathus heterodontosaurus diplophos dilophosaurus'))Object.assign(a,{family:'coelurosaur',hip:1.32,width:.29,depth:.34,head:[1.32,1.65],skull:[.78,.17,.20],arms:.62,tail:3.05,crest:/diloph|diploph/.test(id)?'twin':null,tusks:id==='heterodontosaurus'});
 else if(includes(id,'triceratops styracosaurus pachyrhinosaurus protoceratops psittacosaurus'))Object.assign(a,{family:'ceratopsian',biped:false,hip:.95,width:.66,depth:.56,head:[1.35,.96],skull:[.67,.30,.29],tail:1.95,arms:.78,frill:!includes(id,'psittacosaurus'),horns:id==='triceratops'?3:id==='styracosaurus'?1:0,teeth:false,beak:true,boss:id==='pachyrhinosaurus',bristles:id==='psittacosaurus'});
 else if(includes(id,'ankylosaurus euoplocephalus minmi behemoth'))Object.assign(a,{family:'ankylosaur',biped:false,hip:.70,width:.79,depth:.44,head:[1.35,.62],skull:[.62,.30,.22],tail:2.55,arms:.54,club:id!=='minmi',armor:true,teeth:false,beak:true});
 else if(includes(id,'stegosaurus kentrosaurus'))Object.assign(a,{family:'stegosaur',biped:false,hip:1.16,width:.62,depth:.57,head:[1.62,.76],skull:[.5,.18,.18],tail:3.3,arms:.75,plates:true,teeth:false,beak:true,spikes:4});
 else if(includes(id,'brachiosaurus dreadnoughtus argentinosaurus apatosaurus diplodocus amargasaurus primordial-titan'))Object.assign(a,{family:'sauropod',biped:false,hip:1.72,width:.78,depth:.69,torso:2.2,head:[id==='diplodocus'?3:2.18,id==='diplodocus'?2.8:id==='brachiosaurus'?4.7:3.9],skull:[.48,.20,.20],tail:id==='diplodocus'?5.1:3.6,arms:1.55,neck:true,teeth:false,spines:id==='amargasaurus'});
 else if(includes(id,'parasaurolophus edmontosaurus maiasaura shantungosaurus iguanodon'))Object.assign(a,{family:id==='iguanodon'?'iguanodont':'hadrosaur',biped:false,hip:1.35,width:.52,depth:.56,head:[1.45,1.66],skull:[.73,.21,.23],tail:3.0,arms:.98,bill:true,teeth:false,crest:id==='parasaurolophus'?'tube':null,thumb:id==='iguanodon'});
 else if(includes(id,'pachycephalosaurus stygimoloch'))Object.assign(a,{family:'pachycephalosaur',hip:1.3,width:.4,depth:.44,head:[1.35,1.76],skull:[.47,.24,.26],arms:.4,tail:2.7,dome:true,teeth:false,beak:true,nubs:id==='stygimoloch'});
 else if(includes(id,'dryosaurus lesothosaurus hypsilophodon leaellynasaura'))Object.assign(a,{family:'ornithopod',hip:1.28,width:.31,depth:.4,head:[1.35,1.67],skull:[.49,.16,.20],arms:.48,tail:3,teeth:false,beak:true});
 else if(includes(id,'ornithomimus gallimimus oviraptor mononykus therizinosaurus'))Object.assign(a,{family:id==='therizinosaurus'?'therizinosaur':'ornithomimid',hip:id==='therizinosaurus'?1.8:1.62,width:id==='therizinosaurus'?.61:.34,depth:id==='therizinosaurus'?.76:.41,head:[1.42,id==='therizinosaurus'?2.65:2.2],skull:[.5,.17,.2],arms:id==='therizinosaurus'?1.45:id==='mononykus'?.28:.8,feathered:true,teeth:false,beak:true,scythes:id==='therizinosaurus',crest:id==='oviraptor'?'casque':null});
 else if(includes(id,'quetzalcoatlus hatzegopteryx'))Object.assign(a,{family:'pterosaur',hip:1.18,width:.3,depth:.38,torso:1.2,head:[1.22,2.4],skull:[1.35,.13,.18],tail:.4,arms:1.4,wings:'membrane',teeth:false,beak:true,crest:'pterosaur'});
 else if(includes(id,'sarcosuchus deinosuchus'))Object.assign(a,{family:'crocodilian',biped:false,hip:.43,width:.48,depth:.29,head:[1.37,.49],skull:[1.28,.22,.15],tail:3.1,arms:.43,scutes:true});
 else if(id==='dimetrodon')Object.assign(a,{family:'synapsid',biped:false,hip:.58,width:.48,depth:.37,head:[1.2,.7],skull:[.75,.25,.28],tail:2.6,arms:.5,sail:true});
 else if(s.body==='marine')Object.assign(a,{family:s.anatomy==='plesiosaur'?'plesiosaur':'pliosaur',biped:false,hip:.7,width:.57,depth:.42,head:[s.anatomy==='plesiosaur'?3:1.35,s.anatomy==='plesiosaur'?1.35:.88],skull:[s.anatomy==='plesiosaur'?.52:1.3,.28,.24],tail:1.9,arms:1.4,flippers:true,neck:s.anatomy==='plesiosaur'});
 else if(s.body==='serpent')Object.assign(a,{family:'serpent',biped:false,hip:.55,width:.36,depth:.36,head:[1.4,.93],skull:[.85,.35,.27],tail:5,arms:0,legless:true,hood:id==='basilisk',horns:s.tier>=6?2:0});
 else if(s.body==='equine'||includes(id,'gryphon hippogriff fenrir cerberus'))Object.assign(a,{family:includes(id,'fenrir cerberus')?'wolf':includes(id,'gryphon hippogriff')?'gryphon':'equine',biped:false,hip:1.4,width:.43,depth:.58,head:[1.15,2.3],skull:[.6,.23,.31],tail:1.5,arms:1.15,horns:/unicorn/.test(id)?1:0,wings:includes(id,'gryphon hippogriff pegasus celestial-unicorn')?'feather':false,fur:true,teeth:includes(id,'fenrir cerberus'),heads:id==='cerberus'?3:1});
 else if(s.body==='bird')Object.assign(a,{family:'phoenix',hip:1.65,width:.37,depth:.46,head:[1.24,2.15],skull:[.65,.2,.23],arms:1.1,tail:2.7,feathered:true,wings:'feather',teeth:false,beak:true,crest:'plume'});
 else if(s.body==='dragon')Object.assign(a,{family:'dragon',biped:false,hip:1.3,width:.58,depth:.65,head:[1.5,1.93],skull:[.88,.3,.33],tail:3.6,arms:1.1,wings:includes(id,'leviathan eastern-dragon ancient-wyrm hydra')?false:id==='quetzalcoatl'?'feather':'membrane',horns:2,scutes:true,heads:id==='hydra'?3:1});
 if(id==='psittacosaurus')Object.assign(a,{biped:true,hip:1.05,head:[1.25,1.31],width:.38,depth:.4,arms:.42});
 if(id==='heterodontosaurus')Object.assign(a,{head:[1.26,1.55],skull:[.49,.18,.21],teeth:false,beak:true});
 if(id==='mononykus')a.fingers=1;
 if(s.wildOnly&&s.body==='marine'){
  Object.assign(a,{newMarine:true,family:s.anatomy,biped:false,flippers:true,hip:.7,width:.49,depth:.38,head:[1.3,.87],skull:[1.05,.24,.23],tail:2.6,arms:1.2,hindFlippers:true,flipperSpan:1.5});
  if(s.anatomy==='plesiosaur')Object.assign(a,{neck:true,head:[3.3,1.35],skull:[.48,.19,.18],tail:1.9});
  if(s.anatomy==='ichthyosaur')Object.assign(a,{head:[1.15,.88],skull:[1.1,.15,.16],width:.4,depth:.4,dorsalFin:true,tailFluke:true,flipperSpan:1.0});
  if(s.anatomy==='turtle')Object.assign(a,{head:[1.1,.7],skull:[.48,.22,.17],width:.76,depth:.32,tail:.9,beak:true,teeth:false,shell:true,flipperSpan:2.0});
  if(s.anatomy==='armored-fish')Object.assign(a,{head:[1.0,.92],skull:[.72,.40,.35],width:.54,depth:.50,tail:2.15,teeth:false,cranialArmor:true,dorsalFin:true,tailFluke:true,hindFlippers:false,flipperSpan:.95});
  if(s.anatomy==='mosasaur')Object.assign(a,{head:[1.5,.86],skull:[1.2,.23,.24],tail:3.6,tailFluke:true});
  if(s.anatomy==='shark')Object.assign(a,{head:[1.15,.91],skull:[.91,.33,.28],width:.56,depth:.48,tail:2.8,dorsalFin:true,tailFluke:true,hindFlippers:false,flipperSpan:1.5,gills:true});
 }
 if(a.family==='gryphon')a.beak=true;
 if(id==='hydra')Object.assign(a,{heads:9,horns:0});
 const hash=[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
 a.color=s.body==='marine'||a.family==='dragon'||a.family==='phoenix'||a.family==='serpent'?s.color:[0x75634c,0x59634e,0x4c5655,0x805f48,0x61605c][hash%5];
 a.accent=s.accent;a.pattern=hash%3;a.danger=s.tier>=4&&s.diet!=='herbivore';
 a.length=a.tail+a.head[0]+a.skull[0]*1.12;
 return a;
}
