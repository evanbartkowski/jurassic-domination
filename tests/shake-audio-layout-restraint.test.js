import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { AudioEngine } from "../src/audio.js";
import { WorldRenderer } from "../src/renderer.js";

function installMockAudioContext(t) {
  const original = globalThis.AudioContext;
  class Parameter {
    constructor(val = 0) {
      this.value = val;
      this.changes = [];
    }
    setValueAtTime(v, at) { this.value = v; this.changes.push({ type: "set", value: v, at }); }
    linearRampToValueAtTime(v, at) { this.setValueAtTime(v, at); }
    exponentialRampToValueAtTime(v, at) { this.setValueAtTime(v, at); }
    setTargetAtTime(v, at, c) { this.value = v; this.changes.push({ type: "target", value: v, at, c }); }
  }
  class MockNode {
    constructor() {
      this.gain = new Parameter(1);
      this.frequency = new Parameter(440);
      this.playbackRate = new Parameter(1);
      this.Q = new Parameter(1);
      this.threshold = new Parameter(0);
      this.knee = new Parameter(0);
      this.ratio = new Parameter(1);
      this.type = "sine";
      this.started = [];
      this.stopped = [];
    }
    connect() { return this; }
    disconnect() {}
    start(at) { this.started.push(at); }
    stop(at) { this.stopped.push(at); }
  }
  class MockAudioContext {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.destination = new MockNode();
      this.created = [];
    }
    createGain() { const n = new MockNode(); this.created.push(n); return n; }
    createOscillator() { const n = new MockNode(); this.created.push(n); return n; }
    createBiquadFilter() { const n = new MockNode(); this.created.push(n); return n; }
    createBufferSource() { const n = new MockNode(); this.created.push(n); return n; }
    createDynamicsCompressor() { const n = new MockNode(); this.created.push(n); return n; }
    createBuffer() { return { getChannelData() { return new Float32Array(1024); } }; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  globalThis.AudioContext = MockAudioContext;
  t.after(() => { globalThis.AudioContext = original; });
}

test("audio engine: generic environmental warnings do not blast loud rex roars", async (t) => {
  installMockAudioContext(t);
  const engine = new AudioEngine();
  await engine.unlock();

  let samplePlayed = null;
  engine.playSample = (key) => { samplePlayed = key; };

  // Triggering cold/heat/hazard warning should NOT play rexRoar
  engine.creatureEvent({ type: "warning", text: "Exposure rising: seek warmer ground." });
  assert.notEqual(samplePlayed, "rexRoar");
  assert.equal(samplePlayed, null);

  // But an actual boss spawn CAN play an alpha roar
  engine.creatureEvent({ type: "boss", text: "Alpha Rex has appeared!" });
  assert.equal(samplePlayed, "dinoRoar");

  engine.dispose();
});

test("audio engine: creature calls are throttled and wild soundscape never forces player to screech", async (t) => {
  installMockAudioContext(t);
  const engine = new AudioEngine();
  await engine.unlock();

  const samplesPlayed = [];
  engine.playSample = (key) => { samplesPlayed.push(key); };

  const raptor = { id: "velociraptor", body: "raptor", size: 1.0 };
  
  // First call should play
  engine.voice(raptor, "call", null, 10);
  assert.equal(samplesPlayed.length, 1);
  assert.equal(samplesPlayed[0], "smallDinoCall");

  // Immediate second call (< 2.5s) MUST be throttled
  engine.context.currentTime = 0.5;
  engine.voice(raptor, "call", null, 10);
  assert.equal(samplesPlayed.length, 1, "Rapid creature calls must be debounced");

  // After 2.6s, call can play again
  engine.context.currentTime = 2.7;
  engine.voice(raptor, "call", null, 10);
  assert.equal(samplesPlayed.length, 2);

  // Soundscape with NO wild entities: player should never make automatic calls
  samplesPlayed.length = 0;
  engine.callClock = 0;
  engine.context.currentTime = 10;
  const soloGame = {
    state: "playing",
    time: 10,
    player: { id: "player", speciesId: "velociraptor", x: 0, y: 0 },
    entities: [],
  };
  engine.soundscape(soloGame, 10);
  assert.equal(samplesPlayed.length, 0, "Solo player must not screech automatically in ambient soundscape");

  engine.dispose();
});

test("screen shake restraint: regular bites do not shake, while player damage and special attacks do", () => {
  const renderer = Object.create(WorldRenderer.prototype);
  renderer.shake = 0;
  renderer.scene = new THREE.Scene();
  renderer.effects = [];
  renderer.burst = () => {};

  // 1. Regular attack against an enemy -> NO screen shake
  renderer.event({ type: "hit", target: "enemy", damage: 15 });
  assert.equal(renderer.shake, 0, "Normal minor bites must not trigger screen shake");

  // 2. Player taking damage -> MUST trigger screen shake
  renderer.event({ type: "hit", target: "player", damage: 30 });
  assert.ok(renderer.shake > 0.2, "Player taking heavy damage must shake the screen");
  renderer.shake = 0;

  // 3. Critical strike -> triggers shake
  renderer.event({ type: "hit", target: "enemy", damage: 50, crit: true });
  assert.ok(renderer.shake >= 0.28, "Critical hits must trigger shake");
  renderer.shake = 0;

  // 4. Special abilities -> trigger shake
  renderer.event({ type: "ability", ability: "slam" });
  assert.ok(renderer.shake >= 0.45, "Special ability must shake screen");
  renderer.shake = 0;

  // 5. Synergy bursts -> trigger shake
  renderer.event({ type: "synergy-burst", synergy: "seismicSlam" });
  assert.ok(renderer.shake >= 0.45, "Synergy burst must shake screen");
  renderer.shake = 0;

  // 6. Roar -> triggers shake
  renderer.event({ type: "roar", x: 0, y: 0, radius: 25 });
  assert.ok(renderer.shake >= 0.42, "Roar must shake screen");
});

test("HUD layout: region route, environment panel and map tooltip do not overlap in CSS", () => {
  const expansionCss = fs.readFileSync(path.resolve("src/expansion.css"), "utf8");
  const immersionCss = fs.readFileSync(path.resolve("src/immersion.css"), "utf8");
  const livingWildCss = fs.readFileSync(path.resolve("src/living-wild.css"), "utf8");

  // #region-route must be positioned below the minimap (top >= 420px on desktop)
  assert.ok(expansionCss.includes("top: 425px"), "expansion.css must place #region-route at top: 425px");
  assert.ok(livingWildCss.includes("top: 425px"), "living-wild.css must place #region-route at top: 425px");

  // .environment-panel must be placed on the left side under the objective panel (left: 20px, top: 228px)
  assert.ok(immersionCss.includes("left: 20px"), "immersion.css must position .environment-panel on left: 20px");
  assert.ok(immersionCss.includes("top: 228px"), "immersion.css must position .environment-panel at top: 228px");
  assert.ok(!immersionCss.includes("right:226px; top:104px"), "Old colliding position right:226px must be removed");

  // #map-tooltip must be placed beside the minimap (right: 215px), never colliding with #hud-run
  assert.ok(expansionCss.includes("right: 215px"), "expansion.css must place #map-tooltip at right: 215px");
});
