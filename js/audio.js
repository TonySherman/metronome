/* ============================================================
   Pulse — metronome engine
   ------------------------------------------------------------
   Timing model: JavaScript timers are far too jittery to drive a
   metronome directly. Instead a setInterval "ticker" wakes up every
   ~25 ms and schedules every click that falls inside the next 120 ms
   window directly on the Web Audio clock, which is sample accurate.
   The UI is driven from a separate queue of (audioTime → beat) pairs
   read in requestAnimationFrame, so visuals line up with what you hear.
   ============================================================ */
(function (global) {
  'use strict';

  const LOOKAHEAD_MS = 25;    // how often the scheduler wakes up
  const SCHEDULE_AHEAD = 0.12; // seconds of audio scheduled in advance

  /* ---------- Voices -------------------------------------------------
     Every sound is synthesised — no audio files to download, so the app
     stays a few KB and works offline. Each voice gets a gain multiplier
     and a pitch multiplier so accents / subdivisions share one recipe. */

  const LEVELS = {
    accent: { gain: 1.0,  pitch: 1.5 },
    normal: { gain: 0.72, pitch: 1.0 },
    sub:    { gain: 0.38, pitch: 1.32 }
  };

  let noiseBuffer = null;
  function getNoise(ctx) {
    if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
    const len = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuffer = buf;
    return buf;
  }

  function env(ctx, out, t, peak, attack, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  }

  function tone(ctx, dest, t, freq, type, peak, attack, decay, sweepTo) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
    const g = env(ctx, dest, t, peak, attack, decay);
    o.connect(g);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  function noise(ctx, dest, t, peak, decay, filter) {
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    src.playbackRate.value = 1;
    let node = src;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type;
      f.frequency.setValueAtTime(filter.freq, t);
      if (filter.q) f.Q.value = filter.q;
      if (filter.sweepTo) f.frequency.exponentialRampToValueAtTime(filter.sweepTo, t + decay);
      src.connect(f);
      node = f;
    }
    const g = env(ctx, dest, t, peak, 0.001, decay);
    node.connect(g);
    src.start(t);
    src.stop(t + decay + 0.08);
  }

  const VOICES = {
    click: {
      label: 'Click',
      play(ctx, dest, t, lv) {
        noise(ctx, dest, t, 0.9 * lv.gain, 0.028,
              { type: 'bandpass', freq: 2400 * lv.pitch, q: 1.2 });
        tone(ctx, dest, t, 1800 * lv.pitch, 'square', 0.16 * lv.gain, 0.001, 0.022);
      }
    },
    wood: {
      label: 'Woodblock',
      play(ctx, dest, t, lv) {
        tone(ctx, dest, t, 900 * lv.pitch, 'triangle', 0.75 * lv.gain, 0.001, 0.07, 620 * lv.pitch);
        noise(ctx, dest, t, 0.35 * lv.gain, 0.02,
              { type: 'bandpass', freq: 1700 * lv.pitch, q: 0.9 });
      }
    },
    beep: {
      label: 'Beep',
      play(ctx, dest, t, lv) {
        tone(ctx, dest, t, 880 * lv.pitch, 'sine', 0.7 * lv.gain, 0.004, 0.075);
      }
    },
    tick: {
      label: 'Mechanical',
      play(ctx, dest, t, lv) {
        noise(ctx, dest, t, 1.0 * lv.gain, 0.014,
              { type: 'highpass', freq: 3200 * lv.pitch, q: 0.7 });
        tone(ctx, dest, t, 3200 * lv.pitch, 'square', 0.08 * lv.gain, 0.001, 0.012);
      }
    },
    cowbell: {
      label: 'Cowbell',
      play(ctx, dest, t, lv) {
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 2640 * lv.pitch;
        f.Q.value = 2.2;
        const g = env(ctx, dest, t, 0.5 * lv.gain, 0.002, 0.18);
        f.connect(g);
        [540, 800].forEach((fr) => {
          const o = ctx.createOscillator();
          o.type = 'square';
          o.frequency.value = fr * lv.pitch;
          o.connect(f);
          o.start(t);
          o.stop(t + 0.24);
        });
      }
    },
    rim: {
      label: 'Rimshot',
      play(ctx, dest, t, lv) {
        tone(ctx, dest, t, 420 * lv.pitch, 'triangle', 0.6 * lv.gain, 0.001, 0.05, 180 * lv.pitch);
        noise(ctx, dest, t, 0.55 * lv.gain, 0.035,
              { type: 'bandpass', freq: 2000 * lv.pitch, q: 0.6, sweepTo: 900 * lv.pitch });
      }
    },
    hat: {
      label: 'Hi-hat',
      play(ctx, dest, t, lv) {
        noise(ctx, dest, t, 0.55 * lv.gain, 0.05,
              { type: 'highpass', freq: 7000 * lv.pitch, q: 0.5 });
      }
    },
    marimba: {
      label: 'Marimba',
      play(ctx, dest, t, lv) {
        tone(ctx, dest, t, 1046 * lv.pitch, 'sine', 0.65 * lv.gain, 0.003, 0.22);
        tone(ctx, dest, t, 2092 * lv.pitch, 'sine', 0.12 * lv.gain, 0.002, 0.09);
      }
    }
  };

  /* ---------- Engine ------------------------------------------------ */

  class Metronome {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.timer = null;

      // musical state
      this.bpm = 100;
      this.beats = 4;             // beats per bar
      this.noteValue = 4;         // 2 / 4 / 8 — the note that gets the beat
      this.subdivision = 1;       // 1,2,3,4 clicks per beat
      this.swing = 0;             // 0 = straight, 0.33 max (applies to 8ths)
      this.accents = [2, 1, 1, 1];// 0 mute · 1 normal · 2 accent
      this.voice = 'click';
      this.subVoice = null;       // null → same voice as the beat
      this.volume = 0.85;
      this.countIn = 0;           // bars of count-in before the loop
      this.subdivisionsOn = true;

      // practice tools
      this.trainer = { on: false, everyBars: 4, step: 5, max: 200, mode: 'up' };
      this.silentPractice = { on: false, playBars: 4, muteBars: 1 };

      // transport
      this.running = false;
      this.beatIndex = 0;         // current beat inside the bar
      this.tickIndex = 0;         // current subdivision inside the beat
      this.bar = 0;               // bars completed since start (count-in excluded)
      this.countingIn = 0;        // count-in bars remaining
      this.nextNoteTime = 0;

      this.queue = [];            // {time, beat, tick, level, bar, silent, countIn}
      this.onSchedule = null;     // callback(entry)
      this.onTempoChange = null;  // callback(bpm) — fired by the trainer
    }

    get voices() { return VOICES; }

    ensureContext() {
      if (!this.ctx) {
        const AC = global.AudioContext || global.webkitAudioContext;
        this.ctx = new AC({ latencyHint: 'interactive' });
        this.master = this.ctx.createGain();
        this.master.gain.value = this.volume;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
    }

    /* seconds for one beat; `noteValue` rescales so 6/8 at 120 clicks
       eighth notes, 2/2 at 60 clicks half notes, etc. */
    get secondsPerBeat() { return 60 / this.bpm; }

    /* length of subdivision `i` inside a beat, honouring swing */
    tickDuration(i) {
      const spb = this.secondsPerBeat;
      const n = this.subdivisionsOn ? this.subdivision : 1;
      if (n === 2 && this.swing > 0) {
        const first = 0.5 + this.swing;
        return i === 0 ? spb * first : spb * (1 - first);
      }
      if (n === 4 && this.swing > 0) {
        // swing 16ths: long-short pairs
        const first = 0.25 + this.swing / 2;
        return (i % 2 === 0) ? spb * first : spb * (0.5 - first);
      }
      return spb / n;
    }

    start() {
      if (this.running) return;
      const ctx = this.ensureContext();
      this.running = true;
      this.beatIndex = 0;
      this.tickIndex = 0;
      this.bar = 0;
      this.countingIn = this.countIn;
      this.barsInCycle = 0;
      this.queue.length = 0;
      this.nextNoteTime = ctx.currentTime + 0.08;
      this._tick();
      this.timer = setInterval(() => this._tick(), LOOKAHEAD_MS);
    }

    stop() {
      if (!this.running) return;
      this.running = false;
      clearInterval(this.timer);
      this.timer = null;
      this.queue.length = 0;
    }

    toggle() { this.running ? this.stop() : this.start(); return this.running; }

    /* One short blip so the user hears the sound they picked. */
    preview(level) {
      const ctx = this.ensureContext();
      const v = VOICES[this.voice] || VOICES.click;
      v.play(ctx, this.master, ctx.currentTime + 0.01, LEVELS[level || 'normal']);
    }

    _tick() {
      const ctx = this.ctx;
      while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
        this._scheduleNote(this.nextNoteTime);
        this._advance();
      }
    }

    _isSilentBar() {
      const sp = this.silentPractice;
      if (!sp.on || this.countingIn > 0) return false;
      const cycle = sp.playBars + sp.muteBars;
      return (this.bar % cycle) >= sp.playBars;
    }

    _scheduleNote(time) {
      const n = this.subdivisionsOn ? this.subdivision : 1;
      const beatLevel = this.accents[this.beatIndex] ?? 1;
      const isDownTick = this.tickIndex === 0;
      const countIn = this.countingIn > 0;

      let levelName = null;
      if (countIn) {
        levelName = isDownTick ? (this.beatIndex === 0 ? 'accent' : 'normal') : null;
      } else if (beatLevel === 0) {
        levelName = null;                       // muted beat mutes its subdivisions too
      } else if (isDownTick) {
        levelName = beatLevel === 2 ? 'accent' : 'normal';
      } else {
        levelName = 'sub';
      }

      const silent = this._isSilentBar();
      if (levelName && !silent) {
        const voiceKey = (levelName === 'sub' && this.subVoice) ? this.subVoice : this.voice;
        const voice = VOICES[voiceKey] || VOICES.click;
        voice.play(this.ctx, this.master, time, LEVELS[levelName]);
      }

      const entry = {
        time,
        beat: this.beatIndex,
        tick: this.tickIndex,
        ticks: n,
        level: levelName,
        bar: this.bar,
        silent,
        countIn
      };
      this.queue.push(entry);
      if (this.onSchedule) this.onSchedule(entry);
    }

    _advance() {
      const n = this.subdivisionsOn ? this.subdivision : 1;
      this.nextNoteTime += this.tickDuration(this.tickIndex);
      this.tickIndex = (this.tickIndex + 1) % n;
      if (this.tickIndex !== 0) return;

      this.beatIndex = (this.beatIndex + 1) % this.beats;
      if (this.beatIndex !== 0) return;

      // a bar just completed
      if (this.countingIn > 0) {
        this.countingIn--;
        return;
      }
      this.bar++;
      this._runTrainer();
    }

    _runTrainer() {
      const t = this.trainer;
      if (!t.on || this.bar === 0) return;
      if (this.bar % t.everyBars !== 0) return;
      let next = this.bpm + (t.mode === 'down' ? -t.step : t.step);
      next = Math.max(20, Math.min(300, next));
      if (t.mode === 'down') next = Math.max(t.max, next);   // `max` doubles as the floor
      else next = Math.min(t.max, next);
      if (next !== this.bpm) {
        this.bpm = next;
        if (this.onTempoChange) this.onTempoChange(next);
      }
    }

    /* Entries whose audio time has arrived — used to drive the visuals. */
    due(now) {
      const out = [];
      while (this.queue.length && this.queue[0].time <= now) out.push(this.queue.shift());
      return out;
    }
  }

  global.Pulse = { Metronome, VOICES, LEVELS };
})(window);
