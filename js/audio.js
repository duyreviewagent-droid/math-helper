// All the sound: calculator key clicks, pencil scratches, school bells, right/wrong chimes,
// and a little "study radio" with three made-up tracks. Everything is synthesized here (no files),
// with no feedback loops, and it all ends in a limiter so nothing can get painfully loud.
let ctx = null, master, musicBus, sfxBus, noiseBuf, crackleBuf;

export function audioCtx() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 4; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.2;
  const clip = ctx.createWaveShaper();
  const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 1.2) / Math.tanh(1.2); }
  clip.curve = curve;
  master = ctx.createGain(); master.gain.value = 0.9;
  master.connect(limiter); limiter.connect(clip); clip.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.35; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // record-player crackle: soft hiss with sparse pops
  crackleBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const c = crackleBuf.getChannelData(0); let lp = 0;
  for (let i = 0; i < c.length; i++) { lp += ((Math.random() * 2 - 1) - lp) * 0.08; c[i] = lp * 0.25 + (Math.random() < 0.0007 ? (Math.random() * 2 - 1) * 0.9 : 0); }
  return ctx;
}
export const setSfxVolume = v => { audioCtx(); if (sfxBus) sfxBus.gain.value = v * 0.9; };
export const setMusicVolume = v => { audioCtx(); if (musicBus) musicBus.gain.setTargetAtTime(v * 0.6, ctx.currentTime, 0.05); };

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function env(g, t, a, peak, dec, sustain = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + dec);
}
function noise(t, dur, { type = 'bandpass', freq = 2000, q = 1, gain = 0.3, a = 0.001, bus = sfxBus, rate = 1 } = {}) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = rate;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, a, gain, dur);
  s.connect(f); f.connect(g); g.connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + a + dur + 0.05);
}
function tone(t, freq, dur, { type = 'sine', gain = 0.2, a = 0.005, bus = sfxBus, to = null, lp = 0 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); env(g, t, a, gain, dur);
  let last = o;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); last = f; }
  last.connect(g); g.connect(bus);
  o.start(t); o.stop(t + a + dur + 0.05);
}

// ---------- sound effects ----------
let sfxOn = true;
export const setSfx = on => { sfxOn = on; };
const go = () => sfxOn && audioCtx();
export const sfx = {
  key(kind = 'num') {                   // rubber calculator key: soft tick + dull thump
    if (!go()) return; const t = ctx.currentTime;
    const hi = kind === 'fn' ? 3400 : kind === 'eq' ? 2300 : 2900;
    noise(t, 0.018, { freq: hi + Math.random() * 300, q: 2.5, gain: 0.35 });
    tone(t, 180 + Math.random() * 30, 0.04, { gain: 0.18, to: 90 });
    noise(t + 0.045, 0.012, { freq: hi * 0.7, q: 3, gain: 0.08 });   // key coming back up
  },
  pencil(len = 0.35) {                  // graphite scratching on paper
    if (!go()) return; const t = ctx.currentTime;
    const strokes = 2 + Math.floor(len * 6);
    for (let i = 0; i < strokes; i++) {
      const st = t + i * (len / strokes) + Math.random() * 0.02;
      noise(st, len / strokes * 0.8, { type: 'bandpass', freq: 3500 + Math.random() * 2500, q: 0.8, gain: 0.07 + Math.random() * 0.04, a: 0.01, rate: 0.7 });
    }
  },
  page() {                               // turning a notebook page
    if (!go()) return; const t = ctx.currentTime;
    noise(t, 0.25, { type: 'highpass', freq: 1500, q: 0.4, gain: 0.12, a: 0.06, rate: 0.5 });
    noise(t + 0.12, 0.18, { type: 'bandpass', freq: 900, q: 0.6, gain: 0.08, a: 0.03 });
  },
  chalk() {                              // chalk tap-tap on the board
    if (!go()) return; const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) { noise(t + i * 0.07, 0.03, { freq: 1800 + i * 200, q: 4, gain: 0.25 }); noise(t + i * 0.07 + 0.01, 0.06, { type: 'highpass', freq: 5000, gain: 0.05 }); }
  },
  right() {                              // bright two-note "ding ding"
    if (!go()) return; const t = ctx.currentTime;
    [[76, 0], [83, 0.11], [88, 0.22]].forEach(([m, d]) => { tone(t + d, mtof(m), 0.5, { type: 'triangle', gain: 0.18 }); tone(t + d, mtof(m + 12), 0.25, { gain: 0.05 }); });
  },
  wrong() {                              // gentle "uh-oh", not a buzzer
    if (!go()) return; const t = ctx.currentTime;
    tone(t, mtof(64), 0.22, { type: 'triangle', gain: 0.16 }); tone(t + 0.18, mtof(60), 0.4, { type: 'triangle', gain: 0.16, to: mtof(58.5) });
  },
  bell() {                               // school bell: a quick metal ring
    if (!go()) return; const t = ctx.currentTime;
    for (let i = 0; i < 10; i++) {
      const st = t + i * 0.045;
      [1, 2.76, 5.4].forEach((h, k) => tone(st, 900 * h, 0.12, { gain: [0.07, 0.03, 0.015][k] }));
      noise(st, 0.02, { freq: 4000, q: 2, gain: 0.05 });
    }
    [1, 2.76, 5.4].forEach((h, k) => tone(t + 0.45, 900 * h, 1.2, { gain: [0.08, 0.03, 0.015][k] }));
  },
  star() {                               // level up sparkle
    if (!go()) return; const t = ctx.currentTime;
    [72, 76, 79, 84, 88, 91].forEach((m, i) => tone(t + i * 0.06, mtof(m), 0.35, { gain: 0.1, type: 'triangle' }));
  },
  error() {
    if (!go()) return; const t = ctx.currentTime;
    tone(t, 220, 0.12, { type: 'square', gain: 0.05, lp: 1200 }); tone(t + 0.14, 196, 0.2, { type: 'square', gain: 0.05, lp: 1200 });
  },
  click() { if (!go()) return; noise(ctx.currentTime, 0.01, { freq: 2500, q: 3, gain: 0.2 }); },
  clear() { if (!go()) return; const t = ctx.currentTime; noise(t, 0.2, { type: 'bandpass', freq: 1200, q: 0.5, gain: 0.08, a: 0.04, rate: 0.6 }); },
};

// ---------- the study radio ----------
// Each track: tempo, chords (MIDI notes per bar), and how to play the drums/bass/keys/melody.
export const TRACKS = [
  { name: 'Lo-fi Study Hall', bpm: 74, swing: 0.16, crackle: true, style: 'lofi', scale: [72, 74, 76, 79, 81, 84],
    chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], bass: [41, 40, 38, 36] },
  { name: 'Quiet Library Piano', bpm: 64, swing: 0, crackle: false, style: 'piano', scale: [72, 74, 76, 79, 81],
    chords: [[48, 55, 60, 64], [47, 55, 59, 62], [45, 52, 57, 60], [41, 53, 57, 60]], bass: [36, 35, 33, 29] },
  { name: 'Recess Bounce', bpm: 112, swing: 0, crackle: false, style: 'chip', scale: [72, 74, 76, 79, 81, 84, 86],
    chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], bass: [48, 45, 41, 43] },
  { name: 'Rainy Day Homework', bpm: 82, swing: 0.1, crackle: true, style: 'rain', scale: [69, 72, 74, 76, 79, 81],
    chords: [[45, 52, 55, 60], [41, 48, 52, 57], [48, 52, 55, 59], [43, 50, 55, 59]], bass: [33, 29, 36, 31] },
];

class Radio {
  constructor() { this.track = 0; this.playing = false; this.timer = null; this.step = 0; this.bar = 0; this.seed = 1; this.crackle = null; this.onBeat = null; }
  rand() { this.seed = (this.seed * 16807) % 2147483647; return (this.seed - 1) / 2147483646; }
  play(i = this.track) {
    if (!audioCtx()) return;
    this.stop(true);
    this.track = (i + TRACKS.length) % TRACKS.length;
    const T = TRACKS[this.track];
    this.playing = true; this.step = 0; this.bar = 0; this.seed = 7 + this.track * 101;
    this.next = ctx.currentTime + 0.1;
    if (T.crackle) {
      const s = ctx.createBufferSource(); s.buffer = crackleBuf; s.loop = true;
      const g = ctx.createGain(); g.gain.value = T.style === 'rain' ? 0.5 : 0.35;
      const f = ctx.createBiquadFilter(); f.type = T.style === 'rain' ? 'lowpass' : 'highpass'; f.frequency.value = T.style === 'rain' ? 2500 : 800;
      s.connect(f); f.connect(g); g.connect(musicBus); s.start();
      this.crackle = s;
    }
    this.timer = setInterval(() => this.tick(), 25);
  }
  stop(keepFlag) {
    clearInterval(this.timer); this.timer = null;
    if (this.crackle) { try { this.crackle.stop(); } catch { } this.crackle = null; }
    if (!keepFlag) this.playing = false;
  }
  tick() {
    const T = TRACKS[this.track], spb = 60 / T.bpm / 4;
    if (this.next < ctx.currentTime - 0.2) this.next = ctx.currentTime + 0.05;   // tab was asleep: pick up cleanly
    while (this.next < ctx.currentTime + 0.18) {
      const s = this.step % 16;
      const t = this.next + (s % 2 === 1 ? T.swing * spb : 0);
      this.playStep(T, s, t, spb);
      this.next += spb; this.step++;
      if (this.step % 16 === 0) { this.bar++; if (this.bar % 8 === 0) this.seed = 7 + this.track * 101; }
    }
  }
  playStep(T, s, t, spb) {
    const ch = T.chords[this.bar % T.chords.length], root = T.bass[this.bar % T.bass.length];
    const r = () => this.rand();
    if (s % 4 === 0 && this.onBeat) { const d = Math.max(0, (t - ctx.currentTime) * 1000); setTimeout(() => this.onBeat && this.onBeat(s / 4), d); }
    const B = musicBus;
    if (T.style === 'lofi' || T.style === 'rain') {
      if (s === 0 || s === 10 || (s === 7 && r() < 0.4)) this.kick(t, 0.5);
      if (s === 4 || s === 12) { noise(t, 0.12, { freq: 1800, q: 0.7, gain: 0.12, bus: B, a: 0.002 }); noise(t, 0.05, { type: 'highpass', freq: 6000, gain: 0.04, bus: B }); }
      if (s % 2 === 0) noise(t, 0.03, { type: 'highpass', freq: 8000, gain: 0.03 + r() * 0.025, bus: B });
      if (s === 0 || s === 6) ch.forEach((m, k) => this.keys(t + k * 0.012, m, spb * 10, 0.05));
      if (s === 0 || s === 11) tone(t, mtof(root), spb * 5, { type: 'triangle', gain: 0.22, bus: B, a: 0.01, lp: 380 });
      if (s % 2 === 0 && r() < (T.style === 'rain' ? 0.22 : 0.28) && this.bar % 4 !== 3) this.bell(t, T.scale[Math.floor(r() * T.scale.length)], spb * 3);
    } else if (T.style === 'piano') {
      const arp = [ch[0], ch[1], ch[2], ch[3], ch[2], ch[1], ch[2], ch[3]];
      if (s % 2 === 0) this.piano(t, arp[s / 2] + 12, spb * 6, 0.07);
      if (s === 0) this.piano(t, root, spb * 16, 0.1);
      if ((s === 4 || s === 12) && r() < 0.45) this.piano(t, T.scale[Math.floor(r() * T.scale.length)] + 12, spb * 8, 0.06);
    } else {
      if (s % 4 === 0) this.kick(t, 0.45);
      if (s === 4 || s === 12) noise(t, 0.09, { freq: 2500, q: 0.6, gain: 0.1, bus: B });
      if (s % 2 === 1) noise(t, 0.02, { type: 'highpass', freq: 9000, gain: 0.035, bus: B });
      tone(t, mtof(root + (s % 4 === 2 ? 12 : 0)), spb * 0.8, { type: 'square', gain: 0.05, bus: B, lp: 900 });
      if (s % 4 === 0) ch.forEach(m => tone(t, mtof(m + 12), spb * 1.2, { type: 'square', gain: 0.018, bus: B, lp: 2200 }));
      const phrase = [0, 2, 4, 3, 2, 4, 5, 4, 3, 1, 2, 0, 1, 3, 2, 6];
      if (s % 2 === 0 && (this.bar % 2 === 0 || r() < 0.6)) {
        const idx = (phrase[(s / 2 + this.bar * 3) % 16] + (this.bar % 4 === 3 ? 2 : 0)) % T.scale.length;
        tone(t, mtof(T.scale[idx]), spb * 1.6, { type: 'square', gain: 0.035, bus: B, lp: 3000 });
      }
    }
  }
  kick(t, g) { tone(t, 110, 0.28, { gain: g, to: 42, bus: musicBus, a: 0.002 }); }
  keys(t, m, dur, g) {                  // electric piano: two sines, a touch of bell on top
    tone(t, mtof(m), dur, { gain: g, bus: musicBus, a: 0.015, lp: 1600 });
    tone(t, mtof(m) * 2.001, dur * 0.4, { gain: g * 0.25, bus: musicBus, a: 0.01 });
  }
  piano(t, m, dur, g) {
    tone(t, mtof(m), dur, { type: 'triangle', gain: g, bus: musicBus, a: 0.004, lp: 2400 });
    tone(t, mtof(m) * 2, dur * 0.3, { gain: g * 0.3, bus: musicBus, a: 0.003 });
  }
  bell(t, m, dur) {
    tone(t, mtof(m), dur, { gain: 0.045, bus: musicBus, a: 0.01 });
    tone(t, mtof(m) * 3.01, dur * 0.35, { gain: 0.01, bus: musicBus, a: 0.005 });
  }
}
export const radio = new Radio();

// Pencil on paper while drawing: a looping, filtered hiss whose loudness follows how fast the pen moves.
export const pencilLoop = {
  g: null,
  start() {
    if (!go()) return;
    if (this.g) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 0.6;
    const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = 1500;
    this.g = ctx.createGain(); this.g.gain.value = 0;
    s.connect(f); f.connect(h); h.connect(this.g); this.g.connect(sfxBus); s.start();
  },
  speed(v) { if (this.g && sfxOn) this.g.gain.setTargetAtTime(Math.min(0.22, v * 0.0045), ctx.currentTime, 0.015); },
  stop() { if (this.g) this.g.gain.setTargetAtTime(0, ctx.currentTime, 0.04); },
};
