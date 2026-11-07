# v0.8 immersion systems and next server prototype

This increment adds interconnected offline simulation systems to the existing
game. It retains eight evolution tiers, fourteen regions and the 1,600-unit
world radius. Expanded tiers and a much larger continent remain separate work.

## Implemented systems

Inherited or earned water acclimation gives 4% faster swimming; silent-hunter
affinity reduces visual detection range by 8% while stalking. Inherited and earned
versions share one bonus, so they never stack. Neither changes standing visibility
or dry-land speed. Cold and heat adaptations reduce the matching exposure target.

| System | Gameplay and saved state |
| --- | --- |
| Individual genetics | Nine deterministic alleles vary size, pigment, markings, movement, endurance, resistance and affinities. Species still define anatomy. Parent contribution is 48%, blended with 52% fresh variation; bounded traits mean-revert instead of stacking power. |
| Ancestry | A completed life records generation, form, survival, kills, guardians, acquired adaptations and discoveries. Permanent totals and the latest 32 lives are separate from the active life's checkpoint. Completion receipts prevent duplicate inheritance. |
| Life cycles | Seeded nests contain eggs, inherited offspring and protective parents. Species-dependent incubation and juvenile maturation take tens of simulation seconds. Living parents can replace offspring within local population limits. Nest theft provokes the actual nearby parent. |
| Senses and social behavior | Sight respects solid cover; stalking reduces visibility and sound. Bounded footprints, scent, blood and noise provide last known positions. Wind and rain change detection. Pack roles communicate observed positions; nesting territories repel weaker intruders. |
| Physical survival | Sustained sprinting causes recoverable fatigue, heavy hits cause short strain, and prolonged heat/cold cause signalled exposure. Walking, rest, food and suitable habitat help. Healthy movement in relevant conditions develops four acquired adaptations. |
| Regional weather | Independent seeded weather windows produce rain, floods, drought, hard frost and ashfall. These change travel, sight, scent, temperature and forage replacement. Grassfires, eruptions and rare meteors use fixed, marked, avoidable danger circles. |
| Persistent aftermath | Local fire/eruption/meteor scars reduce vegetation replacement for nine simulation minutes. The environment clock and bounded scars survive checkpoints. Events grant no automatic currency or rewards. |
| Exploration | An 80-unit fog grid reveals nearby ground. Ten guaranteed landmarks provide regional leads and reveal lore once discovered. Per-life discoveries and travelled distance survive save/resume. Permanent ancestry can remember completed-life discoveries. |
| Marine branches | Tideweaver Plesiosaur and Abyssal Kronosaur have marine anatomies and earned evolution conditions. Aquatic forms swim faster, dive quietly and move more slowly on dry ground. Crocodilian forms use both habitats. |
| Field journal | Default `L` opens individual traits, exposure progress, weather guidance, landmark leads and ancestry. `H` stalks or dives in suitable water; `J` retains the separate bloodline conditions. Controls remain remappable. |

Terrain remains a ground plane with water footprints. Diving changes movement,
concealment and resistance; it does not introduce depth navigation. Full vertical
flight, layered deep oceans, burrowing, environmental puzzles, a general seasonal
migration system, leadership challenge encounters and world-threatening
catastrophes are future systems. Current AI roles and nest disputes are a smaller
implemented social model. There is no current online transport, player grouping,
cooperative nesting, chat, PvP or shared persistent world.

## Determinism, fairness and limits

The authoritative offline simulation owns genes, offspring, senses, progression,
weather and discoveries. Genetics and weather use independent seeded streams;
they do not consume combat or loot randomness. Run snapshots retain their state
and restore without rerolling offers, nests, inheritance or rewards. Legacy lives
receive migration defaults; the save journal and permadeath receipts remain the
source of truth. This is same-runtime replay determinism, not a cross-platform
floating-point lockstep guarantee or cryptographic protection against save edits.

Weather windows last 180 simulation seconds. Dangerous events give 24 seconds of
warning, target fixed circles outside the starting basin, begin after the opening
grace period and deal at most 4 raw damage per second inside those circles.
Aftermath has at most 24 records. Senses retain at most 96 trails and schedule
broader perception four times per second. Social decisions run twice per second.
Exploration storage has at most 1,600 cell keys and ten landmark records; coverage
counts reachable circular-world ground. Simulation and terrain still use nine
active chunks. Existing inactive chunk persistence needs a different regional
delta budget before substantial world-size expansion.

The two marine branches have technically reachable prerequisites. The Tidal
Archive and Abyssal Tooth are fixed Sunken Fen sites. Tideweaver requires the
Archive plus 25 seconds of healthy moving water exposure, reduced to 15 seconds
by inherited water affinity. A rare genome is optional. The later Kronosaur path
requires Tideweaver in the same life's form history, a named guardian victory and
the Tooth. Evolution remains a player decision; opening choices is voluntary.
Rule tests must exercise these prerequisites and reject forged offers. Finite
bot runs alone cannot prove every branch reachable or establish human difficulty.

## Local balance tools

```powershell
npm test
node scripts/qa-field-journal.mjs
npm run simulate -- --runs 100 --seconds 120 --report artifacts/simulation-report.json
node scripts/analyze-balance.mjs artifacts/simulation-report.json artifacts/balance-summary.json
```

`createBalanceRecorder` samples actual species transitions, observed offers,
guardians, discoveries, tier durations and CPU timings into bounded population
bands. It must observe an opened choice before an immediate scripted evolution
to measure that offer. `summarizeBalance` also accepts older simulation reports;
missing metrics remain unknown. Output separates average observed duration from
completed-life survival because time-limit runs are censored. Unobserved secret
branches are labelled unobserved, never declared impossible. Population timing
describes renderer-free CPU work, not GPU frame rate. Existing validation reports
record the actual checks completed for each release.
Boss encounters mean a creature came within 65 units of the player or was
actually defeated; pre-seeded distant lairs do not inflate the denominator.

These tools write local reports only. The game sends no balance telemetry or
feedback over the network. A future feedback feature should require explicit
opt-in, show its payload, omit identifying/device data and support deletion.

## Next milestone: private authoritative co-op prototype

Start with a dedicated authority and two to four invited players in one bounded
region. Keep public discovery, matchmaking and large persistent worlds outside
that prototype. The following are design requirements, not shipped features:

| Boundary | Prototype requirement |
| --- | --- |
| Identity and ownership | Authenticate invite/session identities and bind each connection to server-owned characters. Local saves cannot award online power. Validate protocol/content versions. |
| Input and outcomes | Accept bounded, sequenced intent commands. The server owns time, movement/collision, damage, stamina, genes, nests, events, rewards and evolution validation. Clients interpolate and reconcile interest-filtered state. Add rate, size and action limits plus adversarial tests. |
| Groups and fairness | Cap initial packs at four. Keep shared discoveries informational and prevent duplicate reward claims. Use local resource/reproduction budgets, protected hatching grounds and newcomer safe areas. Measure group advantage before allowing territory ownership. |
| Combat policy | Default private co-op to PvP and friendly fire off. Optional PvP needs explicit server policy and player consent, safe regions and protections against repeated kills, spawn camping, body blocking and logout exploitation. |
| Communication and moderation | Require private invitations, bounded messages, rate limits, mute/block/report controls and configurable chat. Provide server allowlists, kick/ban, audit tools and clear log retention. Protect names and messages from markup injection. |
| Reconnect and safe logout | Use reconnect tokens and a server-defined combat grace period. Safe logout requires an out-of-combat acknowledgement and durable save. Disconnect cannot heal, reroll or undo death. Define empty-server pausing before simulating unattended worlds. |
| Durable world history | Transactionally persist server characters, terminal deaths, nests, event clocks, discovered records and claimed rewards. Test crashes, replayed receipts, reconnect races, backups and schema migrations before persistent public worlds. |

The current local authority, versioned checkpoints and intent adapters provide
useful boundaries for this work. Authentication, network replication,
reconciliation, abuse controls and durable server administration still require
their own implementation and testing.
