import {CRATE_TYPES,RARITY_ORDER,lootHash,lootRandom} from './loot-data.js';
import {crateRewardPool} from './loot.js';
import {CATALOG,RARITIES} from './collection-data.js';
import {SKINS,PERMANENT_MODIFIERS} from './content.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const art=item=>`<img src="assets/portraits/${item.id==='natural'?'species-tyrannosaurus':item.kind+'-'+item.id}.webp" alt="" loading="lazy"/>`;
const badge=rarity=>`<span class="loot-rarity" style="--loot-color:${RARITIES[rarity].color}">${RARITIES[rarity].name}</span>`;
export function crateArt(type,small=false){
 const c=CRATE_TYPES[type];return `<svg class="crate-illustration ${small?'small':''}" viewBox="0 0 320 235" aria-hidden="true" style="--crate-color:${c.color}"><ellipse cx="164" cy="209" rx="130" ry="15" fill="#000" opacity=".35"/><path d="M36 80 177 35 286 77 146 125Z" fill="#4c504b" stroke="var(--crate-color)" stroke-width="2"/><path d="M36 80 146 125 146 210 36 165Z" fill="#292e2c" stroke="#6b746b"/><path d="M146 125 286 77 286 164 146 210Z" fill="#353e37" stroke="#6b746b"/><path d="M56 94 75 101 75 178 56 170ZM112 116 130 122 130 199 112 191ZM173 116 190 110 190 193 173 199ZM254 89 270 83 270 170 254 176Z" fill="var(--crate-color)" opacity=".68"/><path d="M36 108 146 153 286 105" fill="none" stroke="#0d1512" stroke-width="8"/><path d="m206 111 23-8 0 43-23 8Z" fill="#131c17" stroke="var(--crate-color)" stroke-width="3"/><path d="m211 125 6-12 6 8-6 12Z" fill="var(--crate-color)"/><path d="M81 66 191 109M131 50 241 92" stroke="var(--crate-color)" stroke-width="10" opacity=".65"/><path d="M161 62 183 54 205 63 181 72Z" fill="var(--crate-color)"/><path d="M156 35 181 5 206 35" fill="none" stroke="var(--crate-color)" stroke-width="2" opacity=".5"/></svg>`;
}
const itemCard=item=>`<div class="loot-item-card" style="--loot-color:${RARITIES[item.rarity].color}">${badge(item.rarity)}${art(item)}<strong>${esc(item.name)}</strong><small>${item.kind==='skin'?'DINOSAUR SKIN':item.kind==='pet'?'PERMANENT COMPANION':'COSMETIC'}</small></div>`;
export function showLootLocker(ui){
 const p=ui.profile,l=p.loot,counts=Object.fromEntries(Object.keys(CRATE_TYPES).map(id=>[id,l.crates.filter(c=>c.type===id).length]));
 ui.lootType ||= l.crates[0]?.type||'field';const c=CRATE_TYPES[ui.lootType];
 ui.screen('loot',`<div class="wide-panel loot-panel">${ui.header('RECOVERED FROM THE LOST WORLD','Expedition treasures','Rare finds. Permanent rewards. Your discoveries survive every life.')}
 <div class="loot-summary"><span><b>${l.crates.length}</b> SEALED CRATES</span><span><b>${l.opened}</b> OPENED</span><span><b>${p.skins.length-1}</b> SKINS COLLECTED</span><button class="button secondary" data-loot-wardrobe>SKIN COLLECTION</button></div>
 <div class="loot-layout"><nav class="crate-list" aria-label="Crate tiers">${Object.values(CRATE_TYPES).map(t=>`<button data-crate-type="${t.id}" class="crate-type ${t.id===c.id?'selected':''}" style="--loot-color:${t.color}" aria-pressed="${t.id===c.id}">${crateArt(t.id,true)}<span>${badge(t.rarity)}<strong>${t.name}</strong><small>${counts[t.id]} UNOPENED</small></span></button>`).join('')}</nav>
 <section class="crate-feature" style="--loot-color:${c.color}"><div class="crate-hero">${crateArt(c.id)}<div>${badge(c.rarity)}<h2>${c.name}</h2><p>${c.description}</p><p class="crate-guarantee">One permanent collectible<br><b>+ ${c.dna} DNA · ${c.xp} ACCOUNT XP</b></p><button class="button primary" data-open-crate ${counts[c.id]?'':'disabled'}>${counts[c.id]?'OPEN CRATE':'FIND THIS CRATE IN THE WILD'}</button><small>Opens freely · No key required</small></div></div>
 <div class="crate-odds"><strong>COLLECTIBLE RARITY ODDS</strong>${Object.entries(c.odds).filter(([,n])=>n>0).map(([r,n])=>`<span style="--loot-color:${RARITIES[r].color}">${RARITIES[r].name} <b>${n}%</b></span>`).join('')}</div>
 <p class="loot-protection">A new collectible of the rolled rarity is preferred. Completed rarity pools convert duplicates into bonus DNA. Epic or better within 10 openings; legendary within 40. Guarantees can improve the odds shown above.</p>
 <details class="crate-contents"><summary>VIEW POSSIBLE CONTENTS · ${crateRewardPool(c.id).length} COLLECTIBLES</summary><div class="loot-contents-grid">${crateRewardPool(c.id).map(itemCard).join('')}</div></details></section></div>
 <div class="loot-pity"><span>EPIC GUARANTEE <b>${10-l.sinceEpic} openings or fewer</b></span><span>LEGENDARY GUARANTEE <b>${40-l.sinceLegendary} openings or fewer</b></span><p>Search ancient landmarks, explore dangerous regions, and defeat guardians. Alpha predators may carry crates too.</p></div>
 ${l.history.length?`<section class="loot-history"><h2>RECENT DISCOVERIES</h2><div>${[...l.history].reverse().slice(0,8).map(r=>`<button data-loot-history="${r.id}" style="--loot-color:${RARITIES[r.rarity].color}">${art(CATALOG[r.sku])}<span>${badge(r.rarity)}<strong>${esc(CATALOG[r.sku].name)}</strong><small>${r.duplicate?'DUPLICATE CONVERTED':'PERMANENTLY OWNED'} · +${r.dna} DNA</small></span></button>`).join('')}</div></section>`:''}
 <div class="panel-bottom"><span>Treasure can be collected by every species. Press your interact key near a find.</span><button class="button secondary" data-action="back" data-focus>RETURN</button></div></div>`,'shade-screen');
 ui.bind('back',()=>ui.back());ui.overlay.querySelector('[data-loot-wardrobe]').onclick=()=>ui.showWardrobe();
 ui.overlay.querySelectorAll('[data-crate-type]').forEach(b=>b.onclick=()=>{ui.lootType=b.dataset.crateType;showLootLocker(ui);});
 ui.overlay.querySelector('[data-open-crate]').onclick=()=>{
  const crate=l.crates.find(x=>x.type===c.id);if(!crate)return;
  const result=ui.callbacks.openCrate?.(crate.id);if(result?.ok)showCrateReveal(ui,result.reward);else if(result?.reason)ui.toast(result.reason);
 };
 ui.overlay.querySelectorAll('[data-loot-history]').forEach(b=>b.onclick=()=>showCrateReveal(ui,l.history.find(r=>r.id===b.dataset.lootHistory),true));
}
export function showCrateReveal(ui,reward,instant=false){
 const item=CATALOG[reward.sku],crate=CRATE_TYPES[reward.type],random=lootRandom(lootHash(reward.id+':reel')),pool=crateRewardPool(crate.id),target=25;
 const visualItem=()=>{let n=random()*100,rank='legendary';for(const r of RARITY_ORDER){n-=crate.odds[r];if(n<0){rank=r;break;}}const choices=pool.filter(i=>i.rarity===rank);return choices[Math.floor(random()*choices.length)];};
 const reel=Array.from({length:30},(_,i)=>i===target?item:visualItem());
 ui.revealReady=false;ui.lootSelection=item.sku;
 ui.screen('crate-reveal',`<div class="wide-panel loot-panel crate-reveal-panel" style="--loot-color:${RARITIES[reward.rarity].color}">${ui.header('BREAK THE SEAL',crate.name,'Your reward is saved before the reveal begins.')}
 <div class="crate-reel-wrap" aria-hidden="true"><i class="crate-reel-pointer"></i><div class="crate-reel">${reel.map(itemCard).join('')}</div></div>
 <div class="reveal-actions"><span data-reveal-status role="status" aria-live="polite">Uncovering an ancient treasure…</span><button class="button secondary" data-skip-reveal>REVEAL NOW</button></div>
 <section class="crate-result" hidden><div class="loot-result-art"><canvas id="loot-preview" aria-label="Your collectible in 3D. Drag to rotate."></canvas></div><div>${badge(reward.rarity)}<p class="eyebrow">${reward.duplicate?'DUPLICATE · BONUS DNA':reward.pity?'GUARANTEED RARITY · NEW DISCOVERY':'PERMANENT DISCOVERY'}</p><h2>${esc(item.name)}</h2><p>${esc(item.description)}</p><p class="loot-reward-bundle">+${reward.dna} DNA <span>+${reward.xp} ACCOUNT XP</span></p>${reward.duplicate?`<p>Your collection already contains this item. Converted into +${reward.duplicateDNA} bonus DNA, included above.</p>`:''}<div class="loot-result-buttons"><button class="button primary" data-reward-equip>${item.kind==='skin'?'EQUIP SKIN':item.kind==='pet'?'TAKE COMPANION':'EQUIP COSMETIC'}</button><button class="button secondary" data-loot-return>BACK TO TREASURES</button></div></div></section></div>`,'shade-screen');
 const revision=ui.screenRevision,track=ui.overlay.querySelector('.crate-reel'),window=ui.overlay.querySelector('.crate-reel-wrap');
 const place=()=>{const width=track.children[0].getBoundingClientRect().width+12;track.style.transform=`translateX(${window.clientWidth/2-(target+.5)*width+6}px)`;};
 const finish=()=>{
  if(ui.screenRevision!==revision)return;clearTimeout(ui.revealTimer);track.style.transition='none';place();ui.revealReady=true;
  ui.overlay.querySelector('.crate-result').hidden=false;ui.overlay.querySelector('[data-skip-reveal]').hidden=true;
  ui.overlay.querySelector('[data-reveal-status]').textContent=`${RARITIES[reward.rarity].name} ${item.name} · +${reward.dna} DNA · +${reward.xp} account XP`;
  ui.overlay.querySelector('[data-reward-equip]').focus({preventScroll:true});
 };
 ui.bind('back',()=>ui.back());ui.overlay.querySelector('[data-loot-return]').onclick=()=>ui.back();
 ui.overlay.querySelector('[data-reward-equip]').onclick=()=>{ui.callbacks[item.kind==='skin'?'skin':item.kind==='pet'?'pet':'cosmetic']?.(item.id);ui.toast(item.name+' equipped.');};
 ui.overlay.querySelector('[data-skip-reveal]').onclick=finish;
 if(instant||ui.settings.reducedMotion||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)finish();
 else requestAnimationFrame(()=>requestAnimationFrame(()=>{if(ui.screenRevision!==revision||ui.revealReady)return;track.style.transition='transform 4.8s cubic-bezier(.08,.72,.12,1)';place();ui.revealTimer=setTimeout(finish,4900);}));
}
export function showSkinWardrobe(ui){
 const p=ui.profile;ui.wardrobeSelection ||= p.equippedSkin||'natural';
 ui.screen('wardrobe',`<div class="wide-panel wardrobe-panel loot-wardrobe">${ui.header('WEAR YOUR DISCOVERIES','The skin collection','Distinct markings and finishes for every dinosaur form. Skins are cosmetic and permanent.')}
 <div class="wardrobe-toolbar"><label>SEARCH<input id="skin-search" placeholder="Name or collection…" type="search"/></label><label>RARITY<select id="skin-rarity"><option value="all">All rarities</option>${RARITY_ORDER.map(r=>`<option value="${r}">${RARITIES[r].name}</option>`).join('')}</select></label><label class="skin-owned-filter"><input id="skin-owned" type="checkbox"/> Owned only</label><button class="button secondary" data-wardrobe-loot>EXPEDITION CRATES · ${p.loot.crates.length}</button></div>
 <div class="wardrobe-layout"><section class="wardrobe-feature"><canvas id="wardrobe-preview" aria-label="Selected dinosaur skin in 3D. Drag to rotate."></canvas><div id="skin-preview-details"></div></section><div class="loot-skin-grid" id="skin-collection-grid"></div></div>
 <h2 class="section-label relic-heading">PERMANENT WORLD RELICS</h2><div class="modifier-grid">${PERMANENT_MODIFIERS.map(m=>`<article class="modifier-card ${p.modifiers.includes(m.id)?'owned':''}"><div><h3>${m.name}</h3><p>${m.description}</p></div><b>${p.modifiers.includes(m.id)?'ACTIVE':'UNDISCOVERED'}</b></article>`).join('')}</div>
 <div class="panel-bottom"><span>${p.skins.length} / ${SKINS.length} appearances collected</span><button class="button secondary" data-action="wardrobe-shop">DNA SHOP</button><button class="button primary" data-action="back" data-focus>RETURN</button></div></div>`,'shade-screen');
 const refresh=()=>{
  const search=ui.overlay.querySelector('#skin-search').value.trim().toLowerCase(),rarity=ui.overlay.querySelector('#skin-rarity').value,owned=ui.overlay.querySelector('#skin-owned').checked;
  const skins=SKINS.filter(s=>(rarity==='all'||s.rarity===rarity)&&(!owned||p.skins.includes(s.id))&&`${s.name} ${s.collection}`.toLowerCase().includes(search));
  ui.overlay.querySelector('#skin-collection-grid').innerHTML=skins.map(s=>`<button class="loot-skin-card ${ui.wardrobeSelection===s.id?'selected':''}" data-skin-preview="${s.id}" aria-pressed="${ui.wardrobeSelection===s.id}" style="--loot-color:${RARITIES[s.rarity].color}">${badge(s.rarity)}${art({kind:'skin',id:s.id==='natural'?'natural':s.id})}<strong>${s.name}</strong><small>${s.collection} · ${s.pattern.replaceAll('-',' ')}</small><b>${p.equippedSkin===s.id?'EQUIPPED':p.skins.includes(s.id)?'OWNED':s.source==='crate'?'CRATE EXCLUSIVE':'UNDISCOVERED'}</b></button>`).join('')||'<p>No skins match these filters.</p>';
  const s=SKINS.find(s=>s.id===ui.wardrobeSelection)||SKINS[0],has=p.skins.includes(s.id);ui.wardrobeSelection=s.id;
  ui.overlay.querySelector('#skin-preview-details').innerHTML=`${badge(s.rarity)}<h2>${s.name}</h2><p>${s.description}</p><p>${s.collection} collection · ${s.finish} finish</p><button class="button primary" data-equip-wardrobe ${!has||p.equippedSkin===s.id?'disabled':''}>${p.equippedSkin===s.id?'EQUIPPED':has?'EQUIP SKIN':s.source==='crate'?'DISCOVER IN EXPEDITION CRATES':'FIND IN THE WILD OR DNA SHOP'}</button>`;
  ui.overlay.querySelector('[data-equip-wardrobe]').onclick=()=>{ui.callbacks.skin?.(s.id);refresh();};
  ui.overlay.querySelectorAll('[data-skin-preview]').forEach(b=>b.onclick=()=>{ui.wardrobeSelection=b.dataset.skinPreview;refresh();});
 };
 for(const id of ['skin-search','skin-rarity','skin-owned'])ui.overlay.querySelector('#'+id).addEventListener(id==='skin-search'?'input':'change',refresh);
 const previewLabel=document.createElement('label');previewLabel.textContent='PREVIEW SPECIES';
 const previewSpecies=document.createElement('select');previewSpecies.id='skin-preview-species';
 previewSpecies.innerHTML=[['tyrannosaurus','Tyrannosaurus'],['troodon','Troodon'],['triceratops','Triceratops'],['spinosaurus','Spinosaurus'],['velociraptor','Velociraptor']].map(([id,name])=>`<option value="${id}">${name}</option>`).join('');
 previewSpecies.value=ui.skinPreviewSpecies||'tyrannosaurus';previewSpecies.onchange=()=>{ui.skinPreviewSpecies=previewSpecies.value;};previewLabel.append(previewSpecies);
 ui.overlay.querySelector('.wardrobe-toolbar').insertBefore(previewLabel,ui.overlay.querySelector('.skin-owned-filter'));
 ui.bind('back',()=>ui.back());ui.bind('wardrobe-shop',()=>ui.showShop('skin'));ui.overlay.querySelector('[data-wardrobe-loot]').onclick=()=>ui.showLoot();refresh();
}
