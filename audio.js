// AudioManager — synthesized SFX + a procedural 8-bit arcade music loop via Web Audio API,
// no external audio assets, so everything is generated on the fly.
const AudioManager = {
  ctx: null,
  enabled: true,
  _noiseBuffer: null,
  _musicGain: null,
  _musicTimer: null,
  _musicStep: 0,
  _musicPlaying: false,

  init() {
    this.enabled = StorageManager.getSound();
    // AudioContext created lazily on first user gesture (browser autoplay policy)
  },

  ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this._musicGain = this.ctx.createGain();
      this._musicGain.gain.value = 0.22;
      this._musicGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  setEnabled(val) {
    this.enabled = val;
    StorageManager.saveSound(val);
    if (!val) this.stopMusic();
  },

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  },

  _getNoiseBuffer(ctx) {
    if (this._noiseBuffer) return this._noiseBuffer;
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buf;
    return buf;
  },

  _tone({ freq = 440, type = 'square', duration = 0.1, gainStart = 0.15, gainEnd = 0.0001, freqEnd = null, delay = 0, dest = null }) {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
    }
    gain.gain.setValueAtTime(gainStart, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.0001), t0 + duration);
    osc.connect(gain);
    gain.connect(dest || ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  },

  // filtered noise burst layered under punches, hits and explosions for extra weight
  _noiseBurst({ duration = 0.12, gainStart = 0.2, filterFreq = 1400, filterType = 'bandpass', delay = 0 }) {
    if (!this.enabled) return;
    const ctx = this.ensureCtx();
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this._getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainStart, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  },

  // powerful single-shot report: sharp pitch-drop square + a tight noise crack
  shoot() {
    this._tone({ freq: 980, freqEnd: 220, type: 'square', duration: 0.1, gainStart: 0.16 });
    this._tone({ freq: 140, freqEnd: 60, type: 'sawtooth', duration: 0.07, gainStart: 0.1 });
    this._noiseBurst({ duration: 0.06, gainStart: 0.18, filterFreq: 2200 });
  },

  // beefy explosion — layered low thud + noise blast
  hit() {
    this._tone({ freq: 200, freqEnd: 50, type: 'sawtooth', duration: 0.18, gainStart: 0.16 });
    this._noiseBurst({ duration: 0.22, gainStart: 0.28, filterFreq: 900, filterType: 'lowpass' });
  },

  split() {
    this._tone({ freq: 500, freqEnd: 260, type: 'triangle', duration: 0.15, gainStart: 0.14 });
    this._tone({ freq: 640, freqEnd: 320, type: 'triangle', duration: 0.15, gainStart: 0.1, delay: 0.03 });
    this._noiseBurst({ duration: 0.1, gainStart: 0.14, filterFreq: 1800 });
  },

  // Coins chiming — played when a blocker pops for good (smallest tier, nothing left to split).
  // Stacked fifths with a touch of detune give it the shimmer of coins hitting a pile.
  coinBurst() {
    const notes = [1319, 1568, 1976, 2637]; // E6 G6 B6 E7
    notes.forEach((f, i) => {
      this._tone({ freq: f, type: 'triangle', duration: 0.26, gainStart: 0.11, delay: i * 0.045 });
      this._tone({ freq: f * 1.005, type: 'square', duration: 0.2, gainStart: 0.04, delay: i * 0.045 });
    });
    this._noiseBurst({ duration: 0.09, gainStart: 0.05, filterFreq: 7200, delay: 0.02 });
  },

  mrrGained() {
    this._tone({ freq: 523, type: 'square', duration: 0.09, gainStart: 0.12 });
    this._tone({ freq: 659, type: 'square', duration: 0.09, gainStart: 0.12, delay: 0.09 });
    this._tone({ freq: 784, type: 'square', duration: 0.14, gainStart: 0.12, delay: 0.18 });
  },

  playerHit() {
    this._tone({ freq: 180, freqEnd: 60, type: 'sawtooth', duration: 0.3, gainStart: 0.16 });
    this._noiseBurst({ duration: 0.3, gainStart: 0.22, filterFreq: 600, filterType: 'lowpass' });
  },

  lifeGained() {
    this._tone({ freq: 440, freqEnd: 880, type: 'triangle', duration: 0.18, gainStart: 0.14 });
    this._tone({ freq: 660, freqEnd: 1320, type: 'triangle', duration: 0.18, gainStart: 0.1, delay: 0.08 });
  },

  bonusMrr() {
    this._tone({ freq: 587, type: 'square', duration: 0.1, gainStart: 0.13 });
    this._tone({ freq: 880, type: 'square', duration: 0.16, gainStart: 0.13, delay: 0.1 });
  },

  win() {
    [523, 659, 784, 1046].forEach((f, i) => {
      this._tone({ freq: f, type: 'square', duration: 0.2, gainStart: 0.14, delay: i * 0.14 });
    });
  },

  lose() {
    [392, 349, 294, 220].forEach((f, i) => {
      this._tone({ freq: f, type: 'sawtooth', duration: 0.25, gainStart: 0.14, delay: i * 0.15 });
    });
  },

  // ---------- procedural 8-bit arcade music loop ----------
  // A driving 16-step bassline + lead arpeggio, scheduled a little ahead of time
  // (classic lookahead scheduler) so it stays tight even if the tab hiccups.
  _musicBpm: 150,
  // E minor pentatonic run-and-gun riff; null = rest
  _leadPattern: [330, null, 392, 440, 330, null, 392, 440, 494, null, 440, 392, 330, 294, null, null],
  _bassPattern: [82, null, 82, null, 98, null, 98, null, 82, null, 82, null, 110, null, 98, null],

  startMusic() {
    if (!this.enabled || this._musicPlaying) return;
    const ctx = this.ensureCtx();
    this._musicPlaying = true;
    this._musicStep = 0;
    this._musicGain.gain.cancelScheduledValues(ctx.currentTime);
    this._musicGain.gain.setValueAtTime(0.22, ctx.currentTime);
    const stepDur = 60 / this._musicBpm / 4; // 16th notes
    const scheduleStep = () => {
      if (!this._musicPlaying) return;
      const lead = this._leadPattern[this._musicStep % this._leadPattern.length];
      const bass = this._bassPattern[this._musicStep % this._bassPattern.length];
      if (lead) this._tone({ freq: lead, type: 'square', duration: stepDur * 0.85, gainStart: 0.1, dest: this._musicGain });
      if (bass) this._tone({ freq: bass, type: 'triangle', duration: stepDur * 0.9, gainStart: 0.22, dest: this._musicGain });
      if (this._musicStep % 4 === 2) this._noiseBurst({ duration: 0.04, gainStart: 0.06, filterFreq: 6000 });
      this._musicStep++;
      this._musicTimer = setTimeout(scheduleStep, stepDur * 1000);
    };
    scheduleStep();
  },

  stopMusic() {
    this._musicPlaying = false;
    if (this._musicTimer) clearTimeout(this._musicTimer);
    this._musicTimer = null;
    if (this._musicGain && this.ctx) {
      this._musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this._musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  },

  pauseMusic() {
    if (this._musicGain && this.ctx) {
      this._musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  },

  resumeMusic() {
    if (!this.enabled) return;
    if (this._musicGain && this.ctx) {
      this._musicGain.gain.setTargetAtTime(0.22, this.ctx.currentTime, 0.05);
    }
  },
};
