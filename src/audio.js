/** Original adaptive score and creature sound design. No recordings or runtime downloads. */
export class AudioEngine {
  constructor(settings = {}) {
    this.settings = { master: 0.7, music: 0.55, sfx: 0.8, ...settings };
    this.mode = 'menu';
    this.context = null;
    this.nodes = new Set();
    this.beat = 0;
    this.nextBeat = 0;
    this.intensity = 0;
    this.disposed = false;
    this.effectTimes = new Map();
  }

  async unlock() {
    if (this.disposed) return;
    try {
      if (!this.context) {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.master = this.context.createGain();
        this.music = this.context.createGain();
        this.sfx = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -15;
        this.compressor.knee.value = 22;
        this.compressor.ratio.value = 5;
        this.music.connect(this.master);
        this.sfx.connect(this.master);
        this.master.connect(this.compressor);
        this.compressor.connect(this.context.destination);
        const seconds = 2;
        this.noise = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate);
        const samples = this.noise.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < samples.length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * 0.035) / 1.018;
          samples[i] = brown * 3;
        }
        this.nextBeat = this.context.currentTime + 0.1;
        this.configure(this.settings);
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      // A missing or unavailable audio output must never prevent a run.
    }
  }

  configure(settings = {}) {
    this.settings = { ...this.settings, ...settings };
    if (!this.context) return;
    const now = this.context.currentTime;
    const volume = (value) => Math.max(0, Math.min(1, Number(value) || 0));
    this.master.gain.setTargetAtTime(volume(this.settings.master), now, 0.08);
    this.music.gain.setTargetAtTime(volume(this.settings.music) * (this.mode === 'paused' ? 0.3 : 1), now, 0.12);
    this.sfx.gain.setTargetAtTime(volume(this.settings.sfx), now, 0.08);
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.configure();
    if (mode === 'dead') this.play('death');
  }

  tone(frequency, start, duration, gain = 0.12, type = 'sine', endFrequency, destination = this.music) {
    if (!this.context || duration <= 0 || this.disposed) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + Math.min(0.035, duration * 0.15));
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
    this.nodes.add(oscillator);
    oscillator.onended = () => {
      this.nodes.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  rustle(start, duration, gain, frequency = 1000, destination = this.sfx) {
    if (!this.context || this.disposed) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, start);
    filter.Q.value = 0.7;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + Math.min(0.03, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    source.start(start);
    source.stop(start + duration + 0.03);
    this.nodes.add(source);
    source.onended = () => {
      this.nodes.delete(source);
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
  }

  update(_dt, game) {
    if (!this.context || this.context.state !== 'running' || this.disposed) return;
    this.intensity = this.mode === 'danger' ? 1 : Math.min(0.7, Math.max(0, Number(game?.danger) || 0));
    const now = this.context.currentTime;
    if (this.nextBeat < now - 0.5) this.nextBeat = now + 0.05;
    // A short clock lookahead avoids timer drift and pauses cleanly in background tabs.
    while (this.nextBeat < now + 0.18) {
      this.scheduleBeat(this.nextBeat, this.beat++);
      this.nextBeat += this.mode === 'danger' ? 0.3 : 0.39;
    }
  }

  scheduleBeat(at, beat) {
    const active = this.mode !== 'dead' && this.mode !== 'paused';
    const tension = this.intensity;
    const roots = [73.416, 65.406, 55, 65.406]; // D minor, spacious four-phrase progression.
    const root = roots[Math.floor(beat / 16) % roots.length];
    if (beat % 8 === 0) {
      this.tone(root, at, 4.5, active ? 0.075 : 0.035, 'sine');
      this.tone(root * 1.5, at + 0.04, 4.1, 0.028, 'triangle');
      this.tone(root * 2, at + 0.09, 3.7, 0.025, 'sine');
      this.rustle(at, 2.7, 0.12, 420, this.music);
    }
    const phrase = [12, 19, 22, 19, 15, 12, 10, 7, 12, 15, 19, 24, 22, 19, 15, 10];
    if (active && beat % 2 === 0) {
      const semitone = phrase[Math.floor(beat / 2) % phrase.length];
      const frequency = root * 2 ** (semitone / 12);
      this.tone(frequency, at, 1.5, this.mode === 'menu' ? 0.045 : 0.028, 'sine');
      this.tone(frequency * 2, at + 0.07, 0.65, 0.009, 'sine');
    }
    if (active && this.mode !== 'menu' && beat % 4 === 0) {
      this.tone(105, at, 0.32, 0.15 + tension * 0.08, 'sine', 38);
      this.rustle(at, 0.13, 0.12 + tension * 0.07, 600, this.music);
    }
    if (active && tension > 0.25 && beat % 2 === 1) {
      this.rustle(at, 0.08, 0.1 + tension * 0.13, 2400, this.music);
      this.tone(root * 2, at, 0.13, 0.07, 'triangle');
    }
    if (active && beat % 16 === 11) {
      this.tone(1700, at, 0.13, 0.018, 'sine', 2400);
      this.tone(2200, at + 0.18, 0.12, 0.013, 'sine', 1700);
    }
  }

  play(eventType) {
    if (!this.context || this.context.state !== 'running' || this.disposed) return;
    const name = typeof eventType === 'string' ? eventType : eventType?.type;
    const now = this.context.currentTime;
    const last = this.effectTimes.get(name) ?? -1;
    if (now - last < (name === 'hit' ? 0.08 : 0.035)) return;
    this.effectTimes.set(name, now);
    const tone = (frequency, offset, duration, gain, type = 'sine', end) => this.tone(frequency, now + offset, duration, gain, type, end, this.sfx);
    switch (name) {
      case 'attack':
        this.rustle(now, 0.16, 0.42, 950);
        tone(170, 0, 0.16, 0.14, 'triangle', 60);
        break;
      case 'hit':
        tone(85, 0, 0.2, 0.3, 'sine', 28);
        this.rustle(now, 0.16, 0.65, 550);
        break;
      case 'kill':
        tone(110, 0, 0.3, 0.16, 'triangle', 40);
        tone(440, 0.06, 0.25, 0.07);
        break;
      case 'eat':
        this.rustle(now, 0.16, 0.22, 1300);
        tone(360, 0, 0.16, 0.09, 'sine', 510);
        tone(620, 0.09, 0.22, 0.06);
        break;
      case 'dash':
        this.rustle(now, 0.3, 0.3, 1800);
        tone(220, 0, 0.16, 0.07, 'sine', 580);
        break;
      case 'ability':
        tone(140, 0, 0.55, 0.22, 'sawtooth', 48);
        tone(70, 0, 0.65, 0.23, 'sine', 33);
        this.rustle(now + 0.03, 0.6, 0.42, 500);
        break;
      case 'hatch':
        this.rustle(now, 0.3, 0.32, 1600);
        [293.66, 349.23, 440, 587.33].forEach((f, i) => tone(f, i * 0.11, 0.75, 0.1));
        break;
      case 'evolution-ready':
      case 'evolve':
        [146.83, 220, 293.66, 349.23, 440, 587.33].forEach((f, i) => tone(f, i * 0.1, 1.25, 0.09));
        this.rustle(now, 1, 0.2, 2000);
        break;
      case 'death':
        [146.83, 130.81, 110, 73.416].forEach((f, i) => tone(f, i * 0.16, 1.6, 0.13));
        this.rustle(now, 1.2, 0.23, 250);
        break;
      case 'boss':
      case 'warning':
        tone(55, 0, 1.1, 0.25, 'sawtooth', 38);
        tone(58.27, 0, 1, 0.16, 'triangle');
        this.rustle(now, 0.9, 0.3, 400);
        break;
      case 'click': tone(620, 0, 0.07, 0.045); break;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const node of this.nodes) {
      try { node.stop(); } catch { /* Already stopped. */ }
      node.disconnect();
    }
    this.nodes.clear();
    if (this.context) this.context.close().catch(() => {});
    this.context = null;
  }
}
