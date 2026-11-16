const paths={
 dna:'M7 3c0 8 10 10 10 18M17 3C17 11 7 13 7 21M8 6h8M9 10h6M9 14h6M8 18h8',
 claw:'M4 20C4 12 7 6 10 4L8 16M10 21C11 12 14 6 18 3L15 17M17 21c0-5 2-9 5-12l-2 11',
 shield:'M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6Z M8 12l3 3 5-6',
 heart:'M12 21 4 13C-2 6 7 1 12 7c5-6 14-1 8 6Z',
 flame:'M12 2c2 5 8 8 8 13a8 8 0 0 1-16 0c0-3 2-6 4-8-1 6 5 7 4-5Z',
 bolt:'m13 2-9 12h7l-1 8 10-13h-7Z',
 leaf:'M20 3C7 2 2 9 6 16c6 6 15-1 14-13ZM4 21 15 10M8 16v-5M12 12h5',
 book:'M12 5C7 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1Zm0 0v15',
 crown:'m3 6 5 5 4-7 4 7 5-5-2 13H5ZM7 22h10',
 frost:'M12 2v20M3 7l18 10M3 17 21 7M8 4l4 3 4-3M8 20l4-3 4 3',
 spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
 sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
 moon:'M18 4A9 9 0 1 0 20 18 9 9 0 0 1 18 4Z',
 water:'M12 2c-2 5-8 10-8 14a8 8 0 0 0 16 0c0-4-6-9-8-14ZM7 16c0 3 2 4 4 4',
 eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 bone:'M6 5C2 1 0 7 4 8l12 12c1 4 7 2 3-2 4 1 4-5 0-4L8 3C8-1 2 1 6 5Z',
 skull:'M5 14a9 9 0 1 1 14 0l-2 2v5H7v-5ZM8 10h1M15 10h1M10 18v3M14 18v3',
 map:'m2 5 6-2 8 3 6-3v16l-6 3-8-3-6 2ZM8 3v16M16 6v16',
 target:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 1v4M12 19v4',
 up:'m5 14 7-7 7 7M12 7v14',
 arrow:'M3 12h18m-6-6 6 6-6 6',
 warning:'m12 3 10 18H2ZM12 9v5M12 17v1',
 check:'m4 12 5 5L20 6',
 coin:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 6v12M9 8h5M9 16h5',
 feather:'M20 3C5 0 2 13 8 16L4 21M7 17 17 7M9 14h6M12 10h6',
 settings:'m9 3-1 3-3 1 1 4-1 3 3 3 1 4h6l1-4 3-3-1-3 1-4-3-1-1-3ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
};
export function presentationIcon(name,cls=''){
 return `<svg class="themed-icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;
}
const symbols={ '🧬':'dna','⚔':'claw','🛡':'shield','❤':'heart','♥':'heart','🔥':'flame','⚡':'bolt','🌿':'leaf','🍃':'leaf','🍀':'leaf','📖':'book','📚':'book','👑':'crown','❄':'frost','✨':'spark','💫':'spark','⭐':'spark','🌟':'spark','☀':'sun','🌙':'moon','🌑':'moon','💧':'water','🌊':'water','👁':'eye','🦴':'bone','💀':'skull','🗺':'map','🎯':'target','⬆':'up','➔':'arrow','➜':'arrow','⚠':'warning','✓':'check','✔':'check','💰':'coin','🪙':'coin','🪶':'feather','⚙':'settings','🔒':'shield','🔓':'check','🦖':'claw','🦕':'leaf','🐉':'flame','🥩':'claw','🍖':'bone','🍎':'leaf','🍇':'leaf','🍄':'leaf','🌸':'leaf','🪨':'bone','🩸':'water','💪':'shield','🏆':'crown','🌀':'water' };
Object.assign(symbols,{'🧪':'water','🦏':'shield','🪓':'claw','⏱':'sun','🐣':'leaf','💥':'spark','🔮':'eye','🦷':'bone','🦔':'shield','💖':'heart','🪞':'shield','🌵':'leaf','☣':'water','🐺':'claw','🧲':'target','👟':'arrow','🌋':'flame','🧊':'frost','👹':'skull','💨':'feather','🏰':'crown'});
// Repair only known authored icon encodings; user-entered attributes are untouched.
const encoder=new TextEncoder(),legacyDecoder=new TextDecoder('windows-1252');
for(const [glyph,name] of Object.entries(symbols))symbols[legacyDecoder.decode(encoder.encode(glyph))]=name;
symbols[legacyDecoder.decode(encoder.encode('\uFE0F'))]='';symbols[legacyDecoder.decode(encoder.encode('\uFE0E'))]='';
const symbolPattern=new RegExp(Object.keys(symbols).join('|')+'|[\\uFE0E\\uFE0F]','gu');
/** Trusted authored markup only. Values supplied by saves remain escaped by UI. */
export function themedMarkup(html){return html.split(/(<[^>]*>)/g).map((part,i)=>i%2?part:part.replace(/Â·/g,'·').replace(/â†’/g,'→').replace(symbolPattern,s=>symbols[s]?presentationIcon(symbols[s]):'')).join('');}

export function clampRatio(value,max=100){return Math.max(0,Math.min(1,Number(value)/Math.max(.001,Number(max))||0));}
