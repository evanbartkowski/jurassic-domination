# Expedition treasures

Map loot now includes four tiers of sealed crates and four valuable genetic
finds. Collect with the normal interact control. Crates enter a permanent
inventory and open from **Treasures** on the title or pause menu. No keys or
real-money purchases are involved.

| Crate | World rarity | Collectible floor | Guaranteed bundle |
| --- | --- | --- | --- |
| Wildwood Cache | Uncommon | Common | 3 DNA + 30 account XP |
| Hunter's Vault | Rare | Uncommon | 6 DNA + 55 account XP |
| Elder Reliquary | Epic | Rare | 12 DNA + 90 account XP |
| Primordial Vault | Legendary | Epic | 25 DNA + 150 account XP |

Each crate also grants one permanent skin, companion or cosmetic. The UI shows
the exact rarity odds and full contents. The new collection contains 30 added
skins, bringing appearances to 44 including Natural. Six new legendary skins
are exclusive to crates. All skins use object-space markings over the authored
normal and roughness maps; they change appearance, not combat stats.

Crates prefer unowned rewards within the rolled rarity. Completed rarity pools
convert duplicates into 3/5/8/12/25 extra DNA. Epic or better is guaranteed within
10 openings and legendary within 40. The reel samples the displayed base odds;
the winning item is fixed and saved before animation. Skip reveals the same
reward. Recent history permits reviewing a reward without reopening a crate.

Random exploration crates occur in 5.5% of chunks and treasure in 12%, using an
independent deterministic stream. Valid ancient landmarks contain fixed caches.
Guardians always drop an Elder or Primordial crate; alphas have a 45% drop
chance, ordinary hunts 0.8%. Dangerous regions can yield better crate tiers and
treasure. Ground placement rejects blocked terrain and nearby water.

Living Amber gives 3–6 DNA and 25 XP, Fossil Geodes 8–14 and 60 XP,
Prismatic Hearts 18–28 and 100 XP, and First Age Hearts 45–65 and 200 XP.
Rarity-colored physical crates/geodes, ground rings, restrained light shafts and
diamond minimap markers distinguish finds from food.

Profile version 6 migrates existing saves with an empty crate inventory.
Receipt claims bank finds once. Sealed crate seeds, opening history and spent
crate IDs survive checkpoints; backup imports merge permanent collections and
cannot reseal a spent crate. The inventory supports 2,048 unopened crates, 80
recent reveals and 65,536 spent IDs. Overflow crates convert to 25 DNA.

Validation: `npm test`, `node scripts/qa-loot.mjs --skins-only`,
`node scripts/qa-loot.mjs --ui-only`, `node scripts/render-portraits.mjs`, and
`npm run build`. Browser checks use isolated profiles and software WebGL; render
success is not a physical GPU frame-rate benchmark.
