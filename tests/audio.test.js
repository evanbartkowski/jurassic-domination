import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../src/audio.js';

class Parameter {
  constructor(value = 0) { this.value = value; this.changes = []; }
  setValueAtTime(value, time) { this.value = value; this.changes.push({ value, time }); }
  linearRampToValueAtTime(value, time) { this.setValueAtTime(value, time); }
  exponentialRampToValueAtTime(value, time) { this.setValueAtTime(value, time); }
  setTargetAtTime(value, time, constant) { this.value = value; this.changes.push({ value, time, constant }); }
}

class AudioNode {
  constructor(context) {
    this.context = context;
    this.connections = [];
    this.gain = new Parameter();
    this.frequency = new Parameter();
    this.Q = new Parameter();
    this.threshold = new Parameter();
    this.knee = new Parameter();
    this.ratio = new Parameter();
    this.started = [];
    this.stopped = [];
    this.disconnected = false;
    context.created.push(this);
  }
  connect(destination) { this.connections.push(destination); return destination; }
  disconnect() { this.disconnected = true; }
  start(at) { this.started.push(at); }
  stop(at) { this.stopped.push(at); }
}

class Context {
  static instances = [];
  constructor() {
    Context.instances.push(this);
    this.created = [];
    this.currentTime = 0;
    this.sampleRate = 64;
    this.state = 'suspended';
    this.destination = { output: true };
    this.resumeCalls = 0;
    this.closeCalls = 0;
  }
  createGain() { return new AudioNode(this); }
  createDynamicsCompressor() { return new AudioNode(this); }
  createOscillator() { return new AudioNode(this); }
  createBiquadFilter() { return new AudioNode(this); }
  createBufferSource() { return new AudioNode(this); }
  createBuffer(_channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  async resume() { this.resumeCalls++; this.state = 'running'; }
  async close() { this.closeCalls++; this.state = 'closed'; }
}

function installContext(t, value = Context) {
  const originals = new Map(['AudioContext', 'webkitAudioContext'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'AudioContext', { value, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'webkitAudioContext', { value: undefined, configurable: true, writable: true });
  Context.instances = [];
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
}

test('audio stays locked until a gesture unlocks it and reuses its output context', async t => {
  installContext(t);
  const engine = new AudioEngine();
  engine.play('attack');
  engine.update(1, { danger: 1 });
  engine.setMode('playing');
  assert.equal(Context.instances.length, 0, 'construction, effects and frame updates must not autoplay');
  await engine.unlock();
  assert.equal(Context.instances.length, 1);
  assert.equal(engine.context.state, 'running');
  assert.equal(engine.context.resumeCalls, 1);
  await engine.unlock();
  assert.equal(Context.instances.length, 1, 'repeated clicks must not create output contexts');
  assert.equal(engine.context.resumeCalls, 1);
  const context = engine.context;
  context.state = 'suspended';
  await engine.unlock();
  assert.equal(context.resumeCalls, 2, 'an interrupted audio context can resume');
  engine.dispose();
});

test('live volume controls remain independent, accept mute, and bound invalid settings', async t => {
  installContext(t);
  const engine = new AudioEngine({ master: 0.6, music: 0.4, sfx: 0.8 });
  await engine.unlock();
  assert.equal(engine.master.gain.value, 0.6);
  assert.equal(engine.music.gain.value, 0.4);
  assert.equal(engine.sfx.gain.value, 0.8);
  engine.configure({ music: 0 });
  assert.equal(engine.music.gain.value, 0, 'zero volume must not fall back to the default');
  assert.equal(engine.master.gain.value, 0.6);
  assert.equal(engine.sfx.gain.value, 0.8);
  engine.configure({ master: 8, music: -1, sfx: Number.NaN });
  assert.equal(engine.master.gain.value, 1);
  assert.equal(engine.music.gain.value, 0);
  assert.equal(engine.sfx.gain.value, 0);
  engine.configure({ master: 0.5, music: 0.6, sfx: 0.7 });
  engine.setMode('paused');
  assert.ok(Math.abs(engine.music.gain.value - 0.18) < 1e-9);
  assert.equal(engine.sfx.gain.value, 0.7);
  engine.setMode('playing');
  assert.equal(engine.music.gain.value, 0.6);
  assert.ok(engine.master.gain.changes.every(change => change.constant > 0), 'volume changes should be smoothed');
  engine.dispose();
});

test('score scheduling survives a long background pause without replaying missed beats', async t => {
  installContext(t);
  const engine = new AudioEngine();
  await engine.unlock();
  engine.setMode('playing');
  engine.update(0.016, { danger: 0.6 });
  const before = engine.context.created.length;
  engine.context.currentTime = 600;
  engine.update(600, { danger: 1 });
  const createdAfterPause = engine.context.created.slice(before);
  assert.ok(createdAfterPause.length < 40, 'missed soundtrack time must not schedule hundreds of sounds');
  assert.ok(createdAfterPause.filter(node => node.started.length).every(node => node.started[0] >= 600));
  const after = engine.context.created.length;
  engine.update(0.016, { danger: 1 });
  assert.equal(engine.context.created.length, after, 'repeated updates at the same audio time must not duplicate music');
  engine.dispose();
});

test('rapid damage effects are throttled and completed sources clean up their nodes', async t => {
  installContext(t);
  const engine = new AudioEngine();
  await engine.unlock();
  engine.play('hit');
  const firstCount = engine.nodes.size;
  assert.ok(firstCount > 0);
  engine.context.currentTime = 0.02;
  engine.play('hit');
  assert.equal(engine.nodes.size, firstCount);
  engine.context.currentTime = 0.12;
  engine.play('hit');
  assert.ok(engine.nodes.size > firstCount);
  const source = engine.nodes.values().next().value;
  source.onended();
  assert.equal(source.disconnected, true);
  assert.equal(engine.nodes.has(source), false);
  engine.dispose();
});

test('disposal stops active sound and cannot be undone by future input', async t => {
  installContext(t);
  const engine = new AudioEngine();
  await engine.unlock();
  engine.play('ability');
  engine.update(0.016);
  const context = engine.context;
  const active = [...engine.nodes];
  assert.ok(active.length > 0);
  engine.dispose();
  assert.equal(context.closeCalls, 1);
  assert.equal(context.state, 'closed');
  assert.equal(engine.nodes.size, 0);
  assert.equal(engine.context, null);
  assert.ok(active.every(node => node.disconnected && node.stopped.length >= 2));
  engine.dispose();
  await engine.unlock();
  engine.update(1);
  engine.play('hatch');
  assert.equal(Context.instances.length, 1);
  assert.equal(context.closeCalls, 1);
});

test('unavailable audio devices never prevent gameplay', async t => {
  installContext(t, null);
  const engine = new AudioEngine();
  await assert.doesNotReject(() => engine.unlock());
  assert.equal(engine.context, null);
  assert.doesNotThrow(() => {
    engine.configure({ master: 0 });
    engine.setMode('dead');
    engine.update(10);
    engine.play('attack');
    engine.dispose();
  });
});
