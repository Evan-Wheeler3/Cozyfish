// Procedural audio — no sound files. Ambient wind/water, birds, crickets,
// owls, a soft generative music box, and all the little sound effects.
export class Audio {
  constructor() { this.ctx = null; this.vol = { master: 0.8, music: 0.5, sfx: 0.9 }; this.nextNote = 0; this.birdT = 3; this.owlT = 20; this.cricketT = 0; }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.vol.master; this.master.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = this.vol.music * 0.5; this.music.connect(this.master);
    // reverb
    this.verb = c.createConvolver();
    const len = c.sampleRate * 2.5, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb.buffer = ir;
    this.verbGain = c.createGain(); this.verbGain.gain.value = 0.35;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    // music delay
    this.delay = c.createDelay(1); this.delay.delayTime.value = 0.42;
    const fb = c.createGain(); fb.gain.value = 0.32;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.music);
    // noise buffer
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // ambient beds
    this.wind = this.loopNoise('bandpass', 420, 0.6, 0.0);
    this.water = this.loopNoise('lowpass', 700, 0.8, 0.0);
    this.fire = this.loopNoise('highpass', 2500, 0.5, 0.0);
    this.nextNote = c.currentTime + 1;
  }

  setVolume(k, v) { this.vol[k] = v; if (!this.ctx) return; if (k === 'master') this.master.gain.value = v; if (k === 'music') this.music.gain.value = v * 0.5; if (k === 'sfx') this.sfx.gain.value = v; }

  loopNoise(type, freq, q, gain) {
    const c = this.ctx, src = c.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    return { f, g };
  }

  env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  tone(freq, dur, type = 'sine', vol = 0.2, opts = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (opts.delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    this.env(g, t, opts.attack || 0.005, vol, dur);
    o.connect(g); g.connect(opts.dest || this.sfx);
    if (opts.verb) g.connect(this.verb);
    o.start(t); o.stop(t + dur + 0.1);
  }
  burst(dur, type, freq, vol, opts = {}) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + (opts.delay || 0);
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = opts.q || 1;
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = c.createGain(); this.env(g, t, opts.attack || 0.004, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    if (opts.verb) g.connect(this.verb);
    s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }

  play(name, arg) {
    if (!this.ctx) return;
    const r = Math.random;
    switch (name) {
      case 'pickup': this.tone(520 + r() * 60, 0.12, 'triangle', 0.15, { to: 900 }); this.tone(1040, 0.1, 'sine', 0.06, { delay: 0.05 }); break;
      case 'coin': this.tone(1320, 0.18, 'square', 0.04); this.tone(1760, 0.3, 'square', 0.04, { delay: 0.07 }); break;
      case 'chop': this.burst(0.12, 'lowpass', 900, 0.5, { to: 200 }); this.tone(140, 0.12, 'sine', 0.3, { to: 70 }); break;
      case 'creak': this.tone(90, 1.4, 'sawtooth', 0.05, { to: 50, attack: 0.3 }); this.burst(1.2, 'bandpass', 300, 0.08, { q: 6, to: 120 }); break;
      case 'thud': this.burst(0.6, 'lowpass', 400, 0.8, { to: 60 }); this.tone(60, 0.5, 'sine', 0.5, { to: 35 }); this.burst(0.8, 'highpass', 3000, 0.1, { delay: 0.05 }); break;
      case 'poof': this.burst(0.3, 'bandpass', 1200, 0.2, { to: 400 }); break;
      case 'splash': this.burst(0.45 * (arg || 1), 'highpass', 900, 0.35 * (arg || 1), { to: 3000 }); this.burst(0.25, 'lowpass', 500, 0.2); break;
      case 'plop': this.tone(600, 0.12, 'sine', 0.2, { to: 200 }); this.burst(0.15, 'highpass', 2000, 0.08); break;
      case 'skip': this.tone(900 + r() * 200, 0.07, 'sine', 0.12, { to: 400 }); this.burst(0.08, 'highpass', 2500, 0.12); break;
      case 'cast': this.burst(0.35, 'bandpass', 600, 0.25, { to: 2400, q: 2 }); break;
      case 'reel': this.burst(0.03, 'highpass', 4000, 0.08); break;
      case 'bite': this.tone(300, 0.15, 'sine', 0.3, { to: 120 }); this.burst(0.2, 'highpass', 1500, 0.2); break;
      case 'nibble': this.tone(500, 0.06, 'sine', 0.1, { to: 300 }); break;
      case 'snap': this.burst(0.08, 'highpass', 3000, 0.6); this.tone(1800, 0.1, 'square', 0.08, { to: 300 }); break;
      case 'catch': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.12, { delay: i * 0.08, verb: true })); break;
      case 'legendary': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.12, { delay: i * 0.09, verb: true })); break;
      case 'goal': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.12, { delay: i * 0.1, verb: true })); break;
      case 'ui': this.tone(700, 0.05, 'sine', 0.08); break;
      case 'craft': this.burst(0.08, 'bandpass', 1500, 0.2); this.tone(660, 0.2, 'triangle', 0.1, { delay: 0.08 }); this.tone(990, 0.3, 'triangle', 0.1, { delay: 0.16 }); break;
      case 'block': this.tone(180 + r() * 60, 0.09, 'sine', 0.18, { to: 90 }); this.burst(0.05, 'lowpass', 1200, 0.12); break;
      case 'dig': this.burst(0.12, 'lowpass', 600 + r() * 300, 0.25); break;
      case 'swing': this.burst(0.15, 'bandpass', 800, 0.1, { to: 2000, q: 1.5 }); break;
      case 'step': {
        const s = arg || 'grass';
        if (s === 'wood') this.tone(160 + r() * 30, 0.06, 'triangle', 0.08, { to: 100 });
        else if (s === 'snow') this.burst(0.12, 'bandpass', 1800 + r() * 400, 0.1, { q: 0.8 });
        else if (s === 'water') this.burst(0.2, 'highpass', 1200, 0.08);
        else this.burst(0.07, 'bandpass', 1200 + r() * 500, 0.05, { q: 0.7 });
      } break;
      case 'swim': this.burst(0.35, 'bandpass', 700, 0.12, { to: 1600 }); break;
      case 'quack': this.tone(380, 0.12, 'sawtooth', 0.04, { to: 300 }); this.tone(360, 0.12, 'sawtooth', 0.04, { to: 280, delay: 0.16 }); break;
      case 'fishjump': this.burst(0.3, 'highpass', 1500, 0.12, { to: 3500 }); break;
      case 'row': this.burst(0.4, 'bandpass', 600, 0.1, { to: 1400 }); break;
      case 'sleep': [392, 330, 262].forEach((f, i) => this.tone(f, 0.8, 'sine', 0.1, { delay: i * 0.25, verb: true })); break;
    }
  }

  update(dt, ctx) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime;
    // ambient beds
    const windAmt = 0.04 + Math.sin(t * 0.13) * 0.02 + (ctx.season === 'winter' ? 0.04 : 0);
    this.wind.g.gain.setTargetAtTime(ctx.underwater ? 0 : windAmt, t, 0.5);
    this.wind.f.frequency.setTargetAtTime(380 + Math.sin(t * 0.07) * 120, t, 0.5);
    this.water.g.gain.setTargetAtTime(ctx.underwater ? 0.25 : ctx.frozen ? 0 : Math.max(0, 0.08 - ctx.pondDist * 0.004), t, 0.5);
    this.water.f.frequency.setTargetAtTime(ctx.underwater ? 300 : 650, t, 0.3);
    this.fire.g.gain.setTargetAtTime(ctx.nearFire ? 0.025 + Math.random() * 0.03 : 0, t, 0.05);
    // birds by day, crickets & owls by night
    if (!ctx.underwater) {
      if (ctx.day > 0.5 && ctx.season !== 'winter') {
        this.birdT -= dt;
        if (this.birdT < 0) {
          this.birdT = 2 + Math.random() * 6;
          const base = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
          for (let i = 0; i < n; i++) this.tone(base * (1 + Math.random() * 0.2), 0.09, 'sine', 0.03, { delay: i * 0.13, to: base * (0.7 + Math.random() * 0.6), verb: true });
        }
      }
      if (ctx.night > 0.5) {
        if (ctx.season === 'summer' || ctx.season === 'fall') {
          this.cricketT -= dt;
          if (this.cricketT < 0) {
            this.cricketT = 0.6 + Math.random() * 0.8;
            for (let i = 0; i < 3; i++) this.tone(4300 + Math.random() * 300, 0.04, 'sine', 0.012, { delay: i * 0.06 });
          }
        }
        this.owlT -= dt;
        if (this.owlT < 0) {
          this.owlT = 14 + Math.random() * 20;
          this.tone(410, 0.35, 'sine', 0.04, { to: 380, verb: true }); this.tone(390, 0.5, 'sine', 0.04, { to: 360, delay: 0.45, verb: true });
        }
      }
    }
    // generative music box (pentatonic, gentle)
    if (this.vol.music > 0 && this.nextNote < t + 0.2) {
      const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19];
      const chords = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];
      const bar = Math.floor(t / 4.8) % 4;
      const root = ctx.night > 0.5 ? 57 : 60; // A minor-ish at night, C major by day
      if (Math.random() < 0.62) {
        const n = root + scale[Math.floor(Math.random() * scale.length)];
        const f = 440 * Math.pow(2, (n - 69) / 12);
        this.musicNote(this.nextNote, f, 0.07, 2.2);
      }
      if (Math.abs((this.nextNote % 4.8)) < 0.3) {
        for (const iv of chords[bar]) this.musicNote(this.nextNote, 440 * Math.pow(2, (root - 12 + iv - 69) / 12), 0.03, 4.5, 'sine');
      }
      this.nextNote += ctx.night > 0.5 ? 0.8 : 0.6;
    }
  }

  musicNote(t, f, vol, dur, type = 'triangle') {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = type; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.music); g.connect(this.delay); g.connect(this.verb);
    o.start(t); o.stop(t + dur + 0.1);
  }
}
