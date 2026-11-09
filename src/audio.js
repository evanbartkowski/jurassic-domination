import { SPECIES_BY_ID } from "./data.js";
import { conditionsAt, getTimeOfDay } from './world-events.js';
const MAX_VOICES = 112;
const MAX_EFFECT_VOICES = 44;

const SAMPLES = {
  giantStep: "sounds/kalsstockmedia-dinosaur-monster-heavy-foot-steps-earth-shattering-246899.mp3",
  gravelStep: "sounds/audiopapkin-monster-footsteps-on-gravel-295850.mp3",
  dinoStep: "sounds/freesound_community-dinosteps1-94200.mp3",
  rexRoar: "sounds/dragon-studio-t-rex-growl-324746.mp3",
  dinoRoar: "sounds/dragon-studio-dinosaur-roar-390283.mp3",
  dinoGrowl: "sounds/dragon-studio-dinosaur-growl-487679.mp3",
  raptorCall: "sounds/lyocrypt-velociraptor-338659.mp3",
  birdScream: "sounds/u_kse9ncnirq-bird-creature-screams-399552.mp3",
  seaMonster: "sounds/u_kse9ncnirq-sea-monster-screaming-loudly-414878.mp3",
  painRoar: "sounds/gsmsea-dinosaur-calling-amp-roaring-in-pain-428070.mp3",
  wolvesFight: "sounds/alex_jauk-wolves-fighting-227005.mp3",
  sniff: "sounds/alex_jauk-sniffing-animal-sound-447139.mp3",
  animalGrunt: "sounds/dragon-studio-animal-grunt-382728.mp3",
  monsterGrunt: "sounds/daviddumaisaudio-monster-05-grunt-and-growl-195715.mp3",
  dinoMuffledGrowl: "sounds/gsmsea-dinosaur-growls-431298.mp3",
  pterodactylCall: "sounds/dragon-studio-pterodactyl-call-382716.mp3",
  smallDinoCall: "sounds/freesound_community-small-dino-raspy-calls-39345.mp3",
  waterSplash: "sounds/traian1984-water-sound-273813.mp3",
  oceanAmbience: "sounds/gmbdecibel-ocean-211408.mp3",
  nightAmbience: "sounds/capaholiczsfx-forest-soundscape-night-time-403609.mp3",
  dayAmbience: "sounds/cartoon_music-birdsong-ambience-516932.mp3",
  duskAmbience: "sounds/manshaofficial-wildlife-evening-sound-112335.mp3",
  insects: "sounds/spinopel-insect-chirping-393129.mp3",
  tenseAmbience: "sounds/tomas_herudek-atmosphere-dark-amp-tense-pulsing-256195.mp3",
  heartbeat: "sounds/freesound_community-dinosaur-heart-beat-70443.mp3",
  skillReveal: "sounds/freesound_gamestudio-hero-skill-attack-reveal-7-388904.mp3",
  skillCombo: "sounds/freesound_gamestudio-skill-attack-combo-music-note-4-384959.mp3",
  victoryChime: "sounds/cartoon_music-arcade-game-victory-chime-489761.mp3",
  itemCollect: "sounds/ejah_music-video-game-collect-item-468889.mp3",
  coinCollect: "sounds/cartoon_music-retro-video-game-coin-collect-508731.mp3",
  uiClick: "sounds/skyscraper_seven-click-buttons-ui-menu-sounds-effects-button-5-203599.mp3",
};
const SCORE_THEMES = {
  fernwood: { transpose: 0, color: "wood", motif: [12, 19, 22, null, 19, 15, 12, null] },
  savannah: { transpose: 0, color: "wood", motif: [12, null, 15, 19, 22, 19, null, 15] },
  fen: { transpose: -2, color: "water", motif: [19, null, 22, 24, null, 19, 15, null] },
  marsh: { transpose: -2, color: "water", motif: [24, 22, null, 19, 15, null, 19, null] },
  redwood: { transpose: -5, color: "wood", motif: [12, 15, 19, null, 22, 19, 15, null] },
  desert: { transpose: 2, color: "sand", motif: [12, 13, 19, null, 20, 19, 13, null] },
  frost: { transpose: 5, color: "crystal", motif: [24, null, 19, 27, null, 22, 19, null] },
  volcano: { transpose: -5, color: "ember", motif: [12, 12, null, 13, 19, null, 15, 13] },
  grove: { transpose: 0, color: "wood", motif: [12, 19, 24, null, 27, 24, 19, null] },
  graveyard: { transpose: -7, color: "sand", motif: [12, null, 15, null, 19, 13, 12, null] },
  highlands: { transpose: 2, color: "crystal", motif: [12, 19, null, 24, 22, null, 19, 15] },
  sky: { transpose: 7, color: "crystal", motif: [19, 24, 27, null, 31, 27, 24, null] },
  peaks: { transpose: -2, color: "ember", motif: [12, 19, 22, 24, null, 19, 15, null] },
  origin: { transpose: -5, color: "crystal", motif: [12, 19, null, 24, 27, 24, 19, null] },
};
/** Original adaptive score and creature sound design. No recordings or runtime downloads. */
export class AudioEngine {
  constructor(settings = {}) {
    this.settings = { master: 0.7, music: 0.55, sfx: 0.8, ...settings };
    this.mode = "menu";
    this.context = null;
    this.nodes = new Set();
    this.beat = 0;
    this.nextBeat = 0;
    this.intensity = 0;
    this.disposed = false;
    this.effectTimes = new Map();
    this.cleanups = new Map();
    this.effectVoices = 0;
    this.nextSoundscape = 0;
    this.currentAmbience = null;
    this.currentAmbienceKey = "";
    this.nextHeartbeat = 0;
    this.samplePool = new Map();
    this.sampleCooldowns = new Map();
  }

  playSample(key, volume = 1, isMusic = false) {
    if (this.disposed || typeof window === "undefined" || typeof Audio === "undefined") return;
    const path = SAMPLES[key];
    if (!path) return;
    try {
      const masterVol = Number(this.settings.master) || 0;
      const busVol = Number(isMusic ? this.settings.music : this.settings.sfx) || 0;
      const finalVol = Math.max(0, Math.min(1, volume * masterVol * busVol));
      if (finalVol <= 0.001) return;

      const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      const cooldowns = {
        giantStep: 380,
        dinoStep: 340,
        gravelStep: 300,
        rexRoar: 6500,
        dinoRoar: 5500,
        dinoGrowl: 4500,
        raptorCall: 4500,
        birdScream: 4500,
        painRoar: 3500,
        wolvesFight: 3600,
        animalGrunt: 280,
        monsterGrunt: 350,
        dinoMuffledGrowl: 3500,
        pterodactylCall: 4000,
        smallDinoCall: 3500,
        heartbeat: 1400,
        waterSplash: 650,
        uiClick: 80,
        coinCollect: 120,
        itemCollect: 120,
        skillReveal: 800,
        skillCombo: 800,
        victoryChime: 1500,
        sniff: 700,
        seaMonster: 3500,
      };
      const minGap = cooldowns[key] ?? 200;
      const last = this.sampleCooldowns.get(key) || 0;
      if (now - last < minGap) return;
      this.sampleCooldowns.set(key, now);

      let snd = this.samplePool.get(key);
      if (!snd) {
        snd = new Audio(path);
        this.samplePool.set(key, snd);
      }
      snd.volume = finalVol;
      snd.currentTime = 0;
      snd.play().catch(() => {});
    } catch {
      // Graceful fallback
    }
  }

  updateAmbience(timeOfDay, weather, isNearWater = false, isDanger = false) {
    if (this.disposed || typeof window === "undefined" || typeof Audio === "undefined") return;
    let targetTrack = "dayAmbience";
    if (isDanger) targetTrack = "tenseAmbience";
    else if (isNearWater) targetTrack = "oceanAmbience";
    else if (weather?.event === "rain" || weather?.event === "flood") targetTrack = "tenseAmbience";
    else if (timeOfDay?.name === "night") targetTrack = "nightAmbience";
    else if (timeOfDay?.name === "dusk") targetTrack = "duskAmbience";
    else targetTrack = "dayAmbience";

    if (this.currentAmbienceKey !== targetTrack) {
      if (this.currentAmbience) {
        try {
          this.currentAmbience.pause();
          this.currentAmbience.currentTime = 0;
        } catch {}
      }
      this.currentAmbienceKey = targetTrack;
      const path = SAMPLES[targetTrack];
      if (path) {
        try {
          let snd = this.samplePool.get(targetTrack);
          if (!snd) {
            snd = new Audio(path);
            this.samplePool.set(targetTrack, snd);
          }
          snd.loop = true;
          const masterVol = Number(this.settings.master) || 0;
          const musicVol = Number(this.settings.music) || 0;
          snd.volume = Math.max(0, Math.min(0.35, 0.28 * masterVol * musicVol * (this.mode === "paused" ? 0.3 : 1)));
          snd.play().catch(() => {});
          this.currentAmbience = snd;
        } catch {}
      }
    } else if (this.currentAmbience) {
      const masterVol = Number(this.settings.master) || 0;
      const musicVol = Number(this.settings.music) || 0;
      this.currentAmbience.volume = Math.max(0, Math.min(0.35, 0.28 * masterVol * musicVol * (this.mode === "paused" ? 0.3 : 1)));
    }
  }

  async unlock() {
    if (this.disposed) return;
    try {
      if (!this.context) {
        const Context =
          globalThis.AudioContext || globalThis.webkitAudioContext;
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
        this.noise = this.context.createBuffer(
          1,
          this.context.sampleRate * seconds,
          this.context.sampleRate,
        );
        const samples = this.noise.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < samples.length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * 0.035) / 1.018;
          samples[i] = brown * 3;
        }
        this.nextBeat = this.context.currentTime + 0.1;
        this.configure(this.settings);
      }
      if (this.context.state === "suspended") await this.context.resume();
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
    this.music.gain.setTargetAtTime(
      volume(this.settings.music) * (this.mode === "paused" ? 0.3 : 1),
      now,
      0.12,
    );
    this.sfx.gain.setTargetAtTime(volume(this.settings.sfx), now, 0.08);
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.configure();
    if (mode === "dead") this.play("death");
  }

  tone(
    frequency,
    start,
    duration,
    gain = 0.12,
    type = "sine",
    endFrequency,
    destination = this.music,
    shape = "pluck",
  ) {
    if (!this.canVoice(destination) || duration <= 0) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
    if (endFrequency)
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(20, endFrequency),
        start + duration,
      );
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(
      gain,
      start + Math.min(shape === "pad" ? 0.65 : 0.025, duration * 0.24),
    );
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
    this.trackVoice(oscillator, destination, () => {
      oscillator.disconnect();
      envelope.disconnect();
    });
  }

  canVoice(destination) {
    return this.context && !this.disposed && this.nodes.size < MAX_VOICES &&
      (destination !== this.sfx || this.effectVoices < MAX_EFFECT_VOICES);
  }

  trackVoice(source, destination, cleanup) {
    this.nodes.add(source);
    if (destination === this.sfx) this.effectVoices++;
    const release = () => {
      if (!this.nodes.delete(source)) return;
      if (destination === this.sfx) this.effectVoices--;
      this.cleanups.delete(source);
      cleanup();
    };
    this.cleanups.set(source, release);
    source.onended = release;
  }

  rustle(start, duration, gain, frequency = 1000, destination = this.sfx) {
    if (!this.canVoice(destination) || duration <= 0) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = this.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(frequency, start);
    filter.Q.value = 0.7;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(
      gain,
      start + Math.min(0.03, duration / 4),
    );
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    source.start(start);
    source.stop(start + duration + 0.03);
    this.trackVoice(source, destination, () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    });
  }

  update(_dt, game) {
    if (!this.context || this.context.state !== "running" || this.disposed)
      return;
    this.intensity =
      this.mode === "danger"
        ? 1
        : Math.min(0.7, Math.max(0, Number(game?.danger) || 0));
    const now = this.context.currentTime;
    if (
      game?.state === "playing" &&
      !["paused", "dead", "menu"].includes(this.mode) &&
      now >= this.nextSoundscape
    ) {
      this.soundscape(game, now);
      const p = game.player;
      if (p) {
        const timeOfDay = getTimeOfDay(game.time || 0);
        const weather = game.worldState ? conditionsAt(game, p.x, p.y) : null;
        const isNearWater = !!game.hazardHint?.includes("WATER");
        const isDanger = this.mode === "danger" || (p.hp < (p.maxHp || 100) * 0.25);
        this.updateAmbience(timeOfDay, weather, isNearWater, isDanger);
        if (p.hp < (p.maxHp || 100) * 0.25 && now >= (this.nextHeartbeat || 0)) {
          this.playSample("heartbeat", 0.7);
          this.nextHeartbeat = now + 1.1;
        }
      }
      if (game.worldState && now >= (this.nextWeatherSound || 0)) {
        const weather = conditionsAt(game, game.player.x, game.player.y);
        if (weather.phase === 'active') {
          if (['rain', 'flood'].includes(weather.event)) this.rustle(now, 2.7, .035, 1800);
          else if (['ashfall', 'fire', 'eruption'].includes(weather.event)) this.rustle(now, 2.4, .025, 330);
          else if (weather.event === 'frost') this.rustle(now, 2.8, .022, 700);
        }
        this.nextWeatherSound = now + 3;
      }
      this.nextSoundscape = now + 0.09;
    }
    if (this.nextBeat < now - 0.5) this.nextBeat = now + 0.05;
    // A short clock lookahead avoids timer drift and pauses cleanly in background tabs.
    while (this.nextBeat < now + 0.18) {
      this.scheduleBeat(this.nextBeat, this.beat++);
      this.nextBeat += this.mode === "danger" ? 0.3 : this.mode === "menu" ? 0.43 : 0.4;
    }
  }

  creatureEvent(event, game) {
    const type = event.type,
      s = SPECIES_BY_ID[event.speciesId] || game?.species;
    if (
      s &&
      ["attack", "enemy-strike", "ability", "enemy-ability", "dash"].includes(
        type,
      )
    ) {
      const distance =
        Number.isFinite(event.x) && game
          ? Math.hypot(event.x - game.player.x, event.y - game.player.y)
          : 0;
      this.voice(s, type, event.ability, distance);
    } else if (type === "evolve")
      this.play({ ...event, speciesId: event.speciesId || s?.id, rarity: event.rarity || s?.rarity });
    else this.play(event);
  }
  voice(species, action = "call", ability = null, distance = 0) {
    if (!this.context || this.context.state !== "running" || this.disposed)
      return;
    const now = this.context.currentTime,
      key = "creature:" + action + ":" + species.body,
      last = this.effectTimes.get(key) ?? -10;
    const throttle = action === "step" ? 0.11 : action === "call" ? 2.5 : 0.22;
    if (now - last < throttle || distance > 50) return;
    this.effectTimes.set(key, now);
    const hash = [...species.id].reduce((n, c) => n + c.charCodeAt(0), 0),
      pitch = (90 + (hash % 90)) / Math.sqrt(Math.max(0.6, species.size)),
      volume = Math.pow(Math.max(0, 1 - distance / 65), 2);
    const tone = (f, d, g, type = "triangle", end) =>
      this.tone(f, now, d, g * volume, type, end, this.sfx);
    if (action === "step") {
      const heavy = ["quad", "longneck", "rex"].includes(species.body);
      tone(heavy ? 55 : 130, 0.12, heavy ? 0.12 : 0.045, "sine", 30);
      this.rustle(
        now,
        0.09,
        (heavy ? 0.14 : 0.08) * volume,
        heavy ? 350 : 1800,
      );
      if (species.size >= 3.2) {
        this.playSample("giantStep", (1 - distance / 70) * 0.95);
      } else if (heavy) {
        this.playSample("dinoStep", (1 - distance / 60) * 0.6);
      } else {
        this.playSample("gravelStep", (1 - distance / 50) * 0.45);
      }
      return;
    }
    if (action === "dash") {
      this.rustle(now, 0.22, 0.22 * volume, 1800);
      tone(pitch * 2, 0.15, 0.06, "sine", pitch * 4);
      return;
    }
    if (action === "call") {
      const small = ["raptor", "bird", "gryphon"].includes(species.body);
      tone(
        small ? pitch * 5 : pitch,
        0.4,
        0.08,
        "triangle",
        small ? pitch * 3 : pitch * 0.55,
      );
      tone(pitch * 1.51, 0.45, 0.05, "sine", pitch * 0.7);
      this.rustle(now, 0.3, 0.07 * volume, small ? 2100 : 400);
      const callVol = Math.max(0.04, Math.min(0.22, (1 - distance / 45) * 0.22));
      if (["rex", "dragon"].includes(species.body)) {
        this.playSample(distance < 12 ? "rexRoar" : "dinoMuffledGrowl", callVol * 0.7);
      } else if (species.body === "raptor") {
        this.playSample("smallDinoCall", callVol * 0.6);
      } else if (["bird", "gryphon"].includes(species.body)) {
        this.playSample("pterodactylCall", callVol * 0.6);
      } else {
        this.playSample("dinoGrowl", callVol * 0.65);
      }
      return;
    }
    if (ability === "heal") {
      for (const [i, f] of [1, 1.25, 1.5, 2].entries())
        this.tone(
          250 * f,
          now + i * 0.08,
          0.6,
          0.06 * volume,
          "sine",
          null,
          this.sfx,
        );
      return;
    }
    if (["flame", "venom", "frost", "lightning", "web", "nova"].includes(ability)) {
      if (ability === "flame") {
        this.rustle(now, 0.65, 0.28 * volume, 650);
        tone(65, 0.5, 0.09, "triangle", 28);
      } else if (ability === "frost") {
        [740, 1110, 1480].forEach((f, i) =>
          this.tone(f, now + i * 0.045, 0.45, 0.045 * volume, "sine", f * 0.8, this.sfx));
        this.rustle(now, 0.28, 0.08 * volume, 3400);
      } else if (ability === "lightning") {
        [0, 0.055, 0.13].forEach((offset) => {
          this.rustle(now + offset, 0.055, 0.18 * volume, 2900);
          this.tone(850, now + offset, 0.06, 0.045 * volume, "triangle", 90, this.sfx);
        });
      } else if (ability === "venom" || ability === "web") {
        [0, 0.09, 0.2].forEach((offset, i) =>
          this.tone(340 + i * 80, now + offset, 0.12, 0.07 * volume, "sine", 100, this.sfx));
        this.rustle(now, 0.26, 0.12 * volume, ability === "web" ? 2100 : 850);
      } else {
        [110, 165, 220, 330].forEach((f, i) =>
          this.tone(f, now + i * 0.035, 0.65, 0.045 * volume, "triangle", f * 2, this.sfx));
        this.rustle(now + 0.12, 0.3, 0.16 * volume, 1200);
      }
      return;
    }
    tone(pitch, 0.22, 0.13, "triangle", pitch * 0.45);
    tone(pitch * 0.52, 0.28, 0.08, "sine", 30);
    this.rustle(
      now,
      0.18,
      0.22 * volume,
      ["raptor", "bird"].includes(species.body) ? 1800 : 600,
    );
  }
  soundscape(game, now) {
    this.motionSamples ||= new Map();
    this.stepClock ??= 0;
    this.callClock ??= 0;
    const nearby = [];
    for (const actor of game.entities) {
      const dx = actor.x - game.player.x, dy = actor.y - game.player.y;
      const distance2 = dx * dx + dy * dy;
      if (distance2 >= 32 * 32) continue;
      const entry = { actor, distance2 };
      let index = 0;
      while (index < nearby.length && nearby[index].distance2 < distance2) index++;
      nearby.splice(index, 0, entry);
      if (nearby.length > 3) nearby.pop();
    }
    const actors = [{ id: "player", ...game.player }, ...nearby.map((e) => e.actor)];
    const present = new Set();
    for (const actor of actors) {
      present.add(actor.id);
      const prev = this.motionSamples.get(actor.id),
        s = SPECIES_BY_ID[actor.speciesId];
      if (
        prev &&
        s &&
        Math.hypot(actor.x - prev.x, actor.y - prev.y) > 0.025 &&
        now - (prev.step || 0) > 0.19 + Math.sqrt(s.size) * 0.09 &&
        now - this.stepClock > 0.09
      ) {
        if (actor.id === "player" && game.hazardHint?.startsWith("DEEP WATER"))
          this.play("splash");
        else this.voice(
          s,
          "step",
          null,
          actor.id === "player"
            ? 0
            : Math.hypot(actor.x - game.player.x, actor.y - game.player.y),
        );
        this.stepClock = now;
        this.motionSamples.set(actor.id, { x: actor.x, y: actor.y, step: now });
      } else
        this.motionSamples.set(actor.id, {
          x: actor.x,
          y: actor.y,
          step: prev?.step || 0,
        });
    }
    for (const id of this.motionSamples.keys())
      if (!present.has(id)) this.motionSamples.delete(id);
    if (now >= this.callClock) {
      const wildActors = actors.filter((a) => a.id !== "player");
      if (wildActors.length > 0 && Math.random() < 0.4) {
        const actor = wildActors[Math.floor(Math.random() * wildActors.length)],
          s = SPECIES_BY_ID[actor?.speciesId];
        if (s) {
          const dist = Math.hypot(actor.x - game.player.x, actor.y - game.player.y);
          if (dist <= 32) {
            this.voice(s, "call", null, dist);
          }
        }
      }
      this.callClock = now + 35 + ((game.time * 11) % 35);
    }
    this.biomeTheme = game.region?.id || "fernwood";
  }
  scheduleBeat(at, beat) {
    const quiet = ["dead", "paused"].includes(this.mode);
    const menu = this.mode === "menu";
    const theme = SCORE_THEMES[menu ? "fernwood" : this.biomeTheme] || SCORE_THEMES.fernwood;
    const tension = menu || quiet ? 0 : this.intensity;
    const progression = [[73.416, 3], [58.27, 4], [87.307, 4], [65.406, 4]];
    const chord = progression[Math.floor(beat / 16) % progression.length];
    const root = chord[0] * 2 ** (theme.transpose / 12);
    const color = theme.color;
    const phrase = Math.floor(beat / 64);
    // Slow bowed harmonics support a distinct flute/harp melody. Voices release
    // before the next chord; there are no streaming assets or looping timers.
    if (beat % 8 === 0) {
      this.tone(root, at, 3.25, quiet ? 0.024 : 0.049, "sine", null, this.music, "pad");
      for (const [i, interval] of [12, 12 + chord[1], 19].entries())
        this.tone(root * 2 ** (interval / 12), at + i * 0.035, 3.15,
          quiet ? 0.009 : 0.018, i === 1 ? "triangle" : "sine", null, this.music, "pad");
      if (!quiet)
        this.tone(root * 2.003, at + 0.08, 2.9, 0.008, "sine", null, this.music, "pad");
    }
    if (quiet) return;
    if (beat % 2 === 0) {
      const motif = menu
        ? [24, 31, 34, null, 31, 27, 24, null, 22, 27, 31, null, 34, 31, 27, null]
        : theme.motif;
      const step = motif[(Math.floor(beat / 2) + (phrase % 2) * 2) % motif.length];
      if (step !== null) {
        const frequency = root * 2 ** ((step + (menu ? 0 : 12)) / 12);
        const gain = (menu ? 0.039 : 0.026) * (1 - tension * 0.45);
        this.tone(frequency, at, color === "crystal" ? 1.35 : 0.95,
          gain, "sine", frequency * 0.998, this.music, "pad");
        this.tone(frequency * 2, at + 0.012, 0.36, gain * 0.2, "sine");
        // A quiet, finite echo adds space without an accumulating feedback loop.
        this.tone(frequency, at + 0.32, 0.55, gain * 0.19, "sine");
      }
    }
    if (!menu && beat % 4 === 2) {
      const arpeggio = [12, 12 + chord[1], 19, 24];
      const interval = arpeggio[Math.floor(beat / 4) % 4];
      const frequency = root * 2 ** (interval / 12);
      this.tone(frequency, at + 0.02, color === "water" ? 1 : 0.5,
        0.024, color === "ember" ? "triangle" : "sine");
      if (color === "water" || color === "crystal")
        this.tone(frequency * 2.001, at + 0.12, 0.7, 0.009, "sine");
    }
    if (!menu && beat % 4 === 0) {
      this.tone(color === "ember" ? 74 : 96, at, 0.28,
        0.085 + tension * 0.045, "sine", 34);
      this.rustle(at + 0.025, 0.08, 0.055, color === "sand" ? 1100 : 540, this.music);
    }
    if (tension > 0.25 && beat % 2 === 1) {
      this.tone(root * (beat % 4 === 1 ? 2 : 3), at, 0.19,
        0.025 + tension * 0.025, "triangle");
      this.rustle(at, 0.045, 0.025 + tension * 0.025, 2100, this.music);
    }
    if (!menu && tension > 0.75 && beat % 8 === 6)
      [0, 0.1, 0.2].forEach((offset, i) =>
        this.tone(120 - i * 14, at + offset, 0.15, 0.038, "sine", 44));
  }

  play(eventType) {
    if (!this.context || this.context.state !== "running" || this.disposed)
      return;
    const name = typeof eventType === "string" ? eventType : eventType?.type;
    if (!name) return;
    const event = typeof eventType === "object" ? eventType : {};
    const now = this.context.currentTime;
    const last = this.effectTimes.get(name) ?? -1;
    const cooldown = { hit: 0.08, "water-bite": 0.25, "plant-bite": 0.25,
      warning: 1.2, region: 2, collect: 0.09, eat: 0.1 }[name] ?? 0.035;
    if (now - last < cooldown) return;
    this.effectTimes.set(name, now);
    const tone = (frequency, offset, duration, gain, type = "sine", end) =>
      this.tone(frequency, now + offset, duration, gain, type, end, this.sfx);
    switch (name) {
      case "attack":
        this.rustle(now, 0.16, 0.38, 950);
        tone(170, 0, 0.16, 0.14, "triangle", 60);
        this.playSample("animalGrunt", 0.55);
        break;
      case "roar":
        {
          const roarSpecies = SPECIES_BY_ID[event.speciesId];
          const roarBody = roarSpecies?.body;
          if (roarBody === "bird") this.playSample("birdScream", 0.55);
          else if (roarBody === "raptor") this.playSample("raptorCall", 0.6);
          else if (roarBody === "rex" || (roarSpecies?.size || 1) > 2.5) this.playSample("rexRoar", 0.75);
          else this.playSample("dinoRoar", 0.65);
          tone(60, 0, 0.45, 0.22, "sawtooth", 45);
        }
        break;
      case "hit":
        tone(event.target === "player" ? 65 : 105, 0, 0.18, 0.19, "sine", 28);
        this.rustle(now, 0.12, 0.3, event.target === "player" ? 400 : 900);
        this.playSample("monsterGrunt", event.target === "player" ? 0.45 : 0.35);
        break;
      case "kill":
        tone(110, 0, 0.3, 0.16, "triangle", 40);
        tone(440, 0.06, 0.25, 0.07);
        if (event.boss || event.tier >= 4 || event.target?.tier >= 4) {
          if (event.water) this.playSample("seaMonster", 0.42);
          else this.playSample("dinoRoar", 0.55);
        } else {
          this.playSample("itemCollect", 0.65);
        }
        break;
      case "eat":
        if (event.food === "meat") {
          this.rustle(now, 0.14, 0.19, 650);
          tone(150, 0, 0.11, 0.1, "triangle", 70);
          tone(95, 0.08, 0.15, 0.07, "sine", 50);
          this.playSample("sniff", 0.6);
        } else if (event.food === "essence" || event.food === "lineage-fruit") {
          [440, 659.25, 880].forEach((f, i) => tone(f, i * 0.07, 0.45, 0.055));
          this.rustle(now, 0.15, 0.06, 2600);
          this.playSample("coinCollect", 0.7);
        } else if (event.food === "egg") {
          this.rustle(now, 0.07, 0.18, 2200);
          this.rustle(now + 0.08, 0.1, 0.12, 1100);
          tone(240, 0.12, 0.18, 0.07, "sine", 340);
        } else {
          this.rustle(now, 0.13, 0.18, 1900);
          this.rustle(now + 0.07, 0.07, 0.1, 1300);
          tone(380, 0, 0.15, 0.065, "sine", 520);
          tone(620, 0.1, 0.2, 0.045);
        }
        break;
      case "water-bite":
        this.rustle(now, 0.24, 0.24, 520);
        this.rustle(now + 0.06, 0.15, 0.1, 1850);
        tone(100, 0, 0.15, 0.15, "triangle", 35);
        tone(330, 0.09, 0.13, 0.065, "sine", 85);
        this.playSample("waterSplash", 0.75);
        this.playSample("animalGrunt", 0.45);
        break;
      case "water-enter":
      case "splash":
        this.rustle(now, 0.32, 0.18, 650);
        [230, 320, 420].forEach((f, i) => tone(f, i * 0.045, 0.1, 0.04, "sine", 75));
        this.playSample("waterSplash", 0.7);
        break;
      case "plant-bite":
        this.rustle(now, 0.16, 0.22, 1700);
        tone(230, 0, 0.12, 0.07, "triangle", 80);
        this.playSample("animalGrunt", 0.35);
        break;
      case "collect":
        tone(587.33, 0, 0.18, 0.055);
        tone(880, 0.07, 0.3, 0.04);
        this.playSample("itemCollect", 0.7);
        break;
      case "region":
        [293.66, 440, 587.33].forEach((f, i) => tone(f, i * 0.14, 0.9, 0.035));
        break;
      case "lineage-progress":
        [523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.08, 0.45, 0.04));
        break;
      case "dna-find":
      case "collection-find":
        [392, 493.88, 587.33, 783.99].forEach((f, i) => tone(f, i * 0.09, 0.65, 0.055));
        tone(1567.98, 0.3, 0.55, 0.025);
        this.playSample("coinCollect", 0.75);
        break;
      case "synergy-unlocked":
        [261.63, 329.63, 392.00, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, i * 0.08, 0.65, 0.06));
        tone(1046.50, 0.45, 0.8, 0.05);
        this.playSample("coinCollect", 0.85);
        break;
      case "synergy-burst":
        if (event.synergy === "hemorrhage") {
          tone(80, 0, 0.35, 0.28, "sawtooth", 30);
          this.rustle(now, 0.25, 0.35, 600);
          this.playSample("monsterGrunt", 0.55);
        } else if (event.synergy === "seismicSlam") {
          tone(55, 0, 0.5, 0.35, "sine", 25);
          this.rustle(now, 0.35, 0.45, 450);
        } else if (event.synergy === "alphasCommand") {
          this.playSample("raptorCall", 0.9);
          tone(180, 0, 0.4, 0.18, "sawtooth", 70);
        } else if (event.synergy === "inferno") {
          this.rustle(now, 0.28, 0.32, 1200);
          tone(120, 0, 0.25, 0.15, "triangle", 60);
        } else if (event.synergy === "glacialFortress") {
          [600, 900, 1200].forEach((f, i) => tone(f, i * 0.05, 0.2, 0.05, "triangle", 300));
        } else if (event.synergy === "juggernaut") {
          tone(65, 0, 0.4, 0.3, "sawtooth", 35);
          this.playSample("monsterGrunt", 0.6);
        } else {
          tone(140, 0, 0.25, 0.15, "sine", 70);
        }
        break;
      case "dash":
        this.rustle(now, 0.3, 0.3, 1800);
        tone(220, 0, 0.16, 0.07, "sine", 580);
        break;
      case "ability":
        tone(140, 0, 0.55, 0.22, "sawtooth", 48);
        tone(70, 0, 0.65, 0.23, "sine", 33);
        this.rustle(now + 0.03, 0.6, 0.42, 500);
        this.playSample("skillReveal", 0.8);
        break;
      case "hatch":
        this.rustle(now, 0.3, 0.32, 1600);
        [293.66, 349.23, 440, 587.33].forEach((f, i) =>
          tone(f, i * 0.11, 0.75, 0.1),
        );
        break;
      case "evolution-ready":
        [293.66, 440, 587.33].forEach((f, i) => tone(f, i * 0.12, 0.7, 0.065));
        this.playSample("skillCombo", 0.75);
        break;
      case "evolve":
        [146.83, 220, 293.66, 349.23, 440, 587.33].forEach((f, i) =>
          tone(f, i * 0.1, 1.25, 0.07),
        );
        this.rustle(now, 0.75, 0.12, 1300);
        this.playSample("victoryChime", 0.85);
        {
          const rarity = event.rarity || SPECIES_BY_ID[event.speciesId]?.rarity;
          const overtones = { rare: [880, 1174.66], epic: [880, 1174.66, 1396.91],
            legendary: [587.33, 880, 1174.66, 1396.91, 1760] }[rarity] || [];
          overtones.forEach((f, i) => tone(f, 0.55 + i * 0.08, 1.4, 0.035));
        }
        break;
      case "death":
        [146.83, 130.81, 110, 73.416].forEach((f, i) =>
          tone(f, i * 0.16, 1.6, 0.13),
        );
        this.rustle(now, 1.2, 0.23, 250);
        this.playSample("painRoar", 0.55);
        break;
      case "warning":
        tone(55, 0, 0.8, 0.1, "triangle", 38);
        tone(58.27, 0, 0.7, 0.06, "sine");
        this.rustle(now, 0.35, 0.08, 400);
        break;
      case "boss":
        tone(55, 0, 1.1, 0.15, "triangle", 38);
        tone(58.27, 0, 1, 0.08, "sine");
        this.rustle(now, 0.65, 0.17, 400);
        this.playSample("dinoRoar", 0.65);
        break;
      case "click":
        tone(620, 0, 0.07, 0.045);
        this.playSample("uiClick", 0.6);
        break;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.currentAmbience) {
      try { this.currentAmbience.pause(); } catch {}
      this.currentAmbience = null;
    }
    if (this.samplePool) {
      for (const snd of this.samplePool.values()) {
        try { snd.pause(); snd.currentTime = 0; } catch {}
      }
      this.samplePool.clear();
    }
    this.sampleCooldowns?.clear();
    for (const node of this.nodes) {
      try {
        node.stop();
      } catch {
        /* Already stopped. */
      }
      this.cleanups.get(node)?.();
    }
    this.nodes.clear();
    this.cleanups.clear();
    this.effectTimes.clear();
    this.motionSamples?.clear();
    this.effectVoices = 0;
    this.master?.disconnect();
    this.music?.disconnect();
    this.sfx?.disconnect();
    this.compressor?.disconnect();
    if (this.context) this.context.close().catch(() => {});
    this.context = null;
  }
}
