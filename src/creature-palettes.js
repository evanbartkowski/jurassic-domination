// Natural species colors, independent of collectible skins and combat stats.
const authored={
 tyrannosaurus:[0xb74d32,0xf2b85e,'mottled'],tarbosaurus:[0x497c36,0xe8b85d,'banded'],albertosaurus:[0xa15b28,0xf7cc67,'striped'],yutyrannus:[0x386f9f,0xd2e5d9,'mottled'],
 giganotosaurus:[0x266da0,0x78c8a7,'banded'],carcharodontosaurus:[0x97673b,0xf0be63,'mottled'],allosaurus:[0x278873,0xf0ae58,'striped'],carnotaurus:[0xd64c37,0xe9a45e,'mottled'],ceratosaurus:[0x81559e,0xf5b46f,'banded'],acrocanthosaurus:[0x336f82,0xe8a14f,'banded'],mapusaurus:[0xa14d43,0xf7bd65,'mottled'],
 spinosaurus:[0x248fba,0xf18f42,'banded'],baryonyx:[0x288e87,0xe0c778,'mottled'],suchomimus:[0x3a8da4,0xf0c675,'striped'],
 troodon:[0x397ece,0xef9257,'mottled'],velociraptor:[0x25a18b,0xe3ba5c,'tiger'],deinonychus:[0x8c53ae,0xeabd65,'striped'],utahraptor:[0x3c78a7,0xf2b86c,'banded'],'utahraptor-young':[0x428c97,0xf3c377,'banded'],microraptor:[0x215d9a,0x54cdbb,'mottled'],sinosauropteryx:[0xc97532,0xf6c97e,'banded'],archaeopteryx:[0x42967b,0xf3ba4d,'mottled'],
 triceratops:[0x2c9876,0xee9958,'mottled'],styracosaurus:[0x476ba5,0xefbb63,'mottled'],pachyrhinosaurus:[0x945b8d,0xf4bf82,'mottled'],psittacosaurus:[0xd59232,0x60ad8c,'speckled'],protoceratops:[0x5e9e53,0xf4c477,'speckled'],
 ankylosaurus:[0x519842,0xe2b65a,'mottled'],euoplocephalus:[0x3e8f7b,0xeac16d,'speckled'],minmi:[0x7e9e3b,0xeebe62,'mottled'],stegosaurus:[0xa76e36,0xf19e57,'mottled'],kentrosaurus:[0x44877a,0xedbb62,'mottled'],
 brachiosaurus:[0x7d66ae,0xc6d887,'mottled'],dreadnoughtus:[0x3b938d,0xe1c574,'banded'],argentinosaurus:[0x4d8f67,0xe4c978,'mottled'],diplodocus:[0x8e648e,0xe4c57c,'banded'],apatosaurus:[0x357f88,0xdcc17b,'mottled'],amargasaurus:[0x44936d,0xf5af5f,'banded'],
 iguanodon:[0x359970,0xe9b254,'mottled'],parasaurolophus:[0xd58332,0x529a9d,'banded'],maiasaura:[0x966baf,0xeac183,'mottled'],edmontosaurus:[0x4c927e,0xf3c275,'banded'],shantungosaurus:[0xa17936,0xe4cc75,'mottled'],
 compsognathus:[0x67a341,0xf0c66d,'speckled'],coelophysis:[0xc46a3b,0xf1c57b,'striped'],dilophosaurus:[0x3b9e8d,0xf3a85c,'mottled'],diplophos:[0x7d55ac,0xf3aa74,'mottled'],heterodontosaurus:[0x9e7240,0xe5bf6d,'banded'],
 dryosaurus:[0x33a475,0xe2c66d,'speckled'],lesothosaurus:[0x508fb8,0xeac37c,'mottled'],hypsilophodon:[0x6aa73b,0xf2c15e,'speckled'],leaellynasaura:[0x4e8eaa,0xe1c186,'mottled'],
 gallimimus:[0x3e88be,0xf0b365,'mottled'],ornithomimus:[0xa663b1,0xe7be78,'mottled'],oviraptor:[0x8c64b9,0xf2a576,'mottled'],mononykus:[0x3a9a8b,0xefbd69,'mottled'],therizinosaurus:[0x429b75,0xebbe66,'mottled'],pachycephalosaurus:[0xd08c35,0x5fb69c,'speckled'],stygimoloch:[0x8d63b0,0xf1bb74,'speckled'],
 dimetrodon:[0xc15b3d,0xf2bb64,'banded'],sarcosuchus:[0x318475,0xd8bc6e,'speckled'],deinosuchus:[0x437d45,0xd5bb6e,'mottled'],
 mosasaurus:[0x247f9d,0x75d3c6,'mottled'],megalodon:[0x356e9d,0x9dc8d8,'mottled'],ichthyosaurus:[0x2c97aa,0xb4dbce,'mottled'],elasmosaurus:[0x376b9c,0xb6dcca,'mottled'],dunkleosteus:[0x2c8e91,0xe3b567,'mottled'],archelon:[0x459574,0xe9be62,'mottled'],
 'ashborn-tyrannosaurus':[0x6a3945,0xf28c43,'mottled'],'cinderfang-carnotaurus':[0xd74730,0xffb55c,'banded'],'verdant-psittacosaurus':[0x339945,0xe8cb5d,'speckled'],'verdant-iguanodon':[0x26926b,0xd6dd63,'mottled'],'elderroot-therizinosaurus':[0x257c67,0xdcc46d,'mottled'],'stormcrown-dragon':[0x4c6fba,0x80e2e5,'mottled'],'eclipse-wyrm':[0x664b9b,0xe2a0dd,'mottled'],
};
const families={
 marine:[[0x29839e,0x80d1cc],[0x37669e,0x99c6df],[0x27877c,0xc2d787]],
 dragon:[[0x2c9b78,0xe4c35f],[0x8f4c9e,0xf0a467],[0xb65d33,0xeec56c],[0x3d7baf,0x92e2d8]],
 serpent:[[0x328f6c,0xd9ca63],[0x357d9e,0x8bd8d2],[0x985b9f,0xe6b0d1]],
 bird:[[0xbd6737,0xf3b24e],[0x298f88,0xe1bf62],[0x5a6db4,0xe5a164]],
 equine:[[0x9c70b4,0xe4c2d8],[0x4c9d9a,0xc0e5dc],[0xd29448,0xf2d38c]],
 default:[[0x318e73,0xf0ba63],[0x447db1,0xe1b174],[0x9261ab,0xe9ae76],[0xbc6c39,0xf0cc75],[0x69973c,0xdcc970],[0x9d5069,0xe9af89]],
};
export function naturalPaletteForSpecies(species){
 if(!species||typeof species.id!=='string')return null;
 const hash=[...species.id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,0),pool=families[species.body]||families.default;
 const [color,accent,pattern]=authored[species.id]||[...pool[hash%pool.length],species.body==='marine'?'mottled':['mottled','banded','speckled'][hash%3]];
 return {id:'wild-'+species.id,color,accent,pattern,finish:'matte',strength:.84,markStrength:pattern==='mottled'?.65:.46,patternScale:1.05};
}
