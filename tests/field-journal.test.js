import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/game.js";
import { neutralGenome, newAdaptationState } from "../src/genetics.js";
import { fieldJournalHTML, escapeJournalHTML } from "../src/field-journal.js";
import { LANDMARKS, recordExploration } from "../src/discoveries.js";

test("field journal shows real individual tradeoffs, controls and honest exploration boundaries", () => {
  const g = new Game({ seed: 91, runId: "journal-test" });
  g.player.genome = neutralGenome(91); g.player.adaptations = newAdaptationState();
  g.player.adaptations.water = 40;
  const html = fieldJournalHTML(g);
  assert.match(html, /Written in your scales/); assert.match(html, /40 \/ 75s/);
  assert.match(html, /balanced pigment/); assert.match(html, /Full vertical flight/);
  assert.match(html, /Holding|holding H/); assert.match(html, /Completed lives/);
  assert.match(html, /0 \/ 10 FOUND/);
  assert.ok(!html.includes(LANDMARKS.find((site) => site.id === "tidal-archive").lore));
  assert.ok(!html.includes("NaN") && !html.includes("undefined"));
});

test("field journal reveals lore only after discovery and keeps permanent ancestry separate", () => {
  const g = new Game({ seed: 92, runId: "journal-discovery" }), site = LANDMARKS.find((entry) => entry.id === "tidal-archive");
  g.player.x = site.x; g.player.y = site.y; recordExploration(g);
  const html = fieldJournalHTML(g, { ancestry: { generations: 3, longestLife: 188, guardianVictories: 2 } });
  assert.ok(html.includes(site.lore)); assert.match(html, /1 \/ 10 FOUND/);
  assert.match(html, /3m 8s/); assert.match(html, /current life/);
});

test("journal escapes text and handles missing active lives without unsafe markup", () => {
  assert.equal(escapeJournalHTML('<img onerror="x">&'), "&lt;img onerror=&quot;x&quot;&gt;&amp;");
  assert.match(fieldJournalHTML(null), /Begin a life/);
  const g = new Game({ seed: 93, runId: "journal-escape" });
  Object.defineProperty(g, "species", { value: { ...g.species, name: '<script>alert("x")</script>' } });
  const html = fieldJournalHTML(g);
  assert.ok(!html.includes("<script>")); assert.match(html, /&lt;script&gt;/);
});

test("title-menu field journal exposes permanent ancestry and earned discoveries without constructing a life", () => {
  const profile = { ancestry: { generations: 4, longestLife: 321, guardianVictories: 7,
    discoveries: ["tidal-archive", "tidewalker"], recent: [
      { runId: "completed-life", generation: 4, speciesId: "compsognathus", tier: 1, time: 321, kills: 8, guardians: 2 },
    ] } };
  const before = structuredClone(profile), html = fieldJournalHTML(null, profile);
  assert.match(html, /Your ancestral record/); assert.match(html, /5m 21s/);
  assert.match(html, /Compsognathus/); assert.match(html, /Tidal Archive/); assert.match(html, /Tidewalker/);
  assert.match(html, /Open 1 recent life/); assert.ok(!html.includes("Written in your scales"));
  assert.deepEqual(profile, before);
});
