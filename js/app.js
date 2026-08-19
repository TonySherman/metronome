/* ============================================================
   Pulse — UI layer
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const MIN_BPM = 20, MAX_BPM = 300;
  const STORE_KEY = 'pulse.settings.v1';

  const metro = new window.Pulse.Metronome();

  /* ---------- persisted settings ---------- */
  const defaults = {
    bpm: 100, beats: 4, noteValue: 4, subdivision: 1, swing: 0,
    accents: [2, 1, 1, 1], voice: 'click', volume: 0.85, subdivisionsOn: true,
    countIn: 0, vibrate: false, flash: false, keepAwake: true,
    trainer: { on: false, everyBars: 4, step: 5, max: 200, mode: 'up' },
    silentPractice: { on: false, playBars: 4, muteBars: 1 }
  };

  function loadSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return Object.assign({}, defaults, raw, {
        trainer: Object.assign({}, defaults.trainer, raw.trainer),
        silentPractice: Object.assign({}, defaults.silentPractice, raw.silentPractice)
      });
    } catch (e) { return Object.assign({}, defaults); }
  }

  let ui = loadSettings();
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      ui.bpm = metro.bpm; ui.beats = metro.beats; ui.noteValue = metro.noteValue;
      ui.subdivision = metro.subdivision; ui.swing = metro.swing;
      ui.accents = metro.accents.slice(); ui.voice = metro.voice; ui.volume = metro.volume;
      ui.subdivisionsOn = metro.subdivisionsOn; ui.countIn = metro.countIn;
      ui.trainer = Object.assign({}, metro.trainer);
      ui.silentPractice = Object.assign({}, metro.silentPractice);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(ui)); } catch (e) {}
    }, 250);
  }

  /* apply stored settings to the engine */
  Object.assign(metro, {
    bpm: ui.bpm, beats: ui.beats, noteValue: ui.noteValue,
    subdivision: ui.subdivision, swing: ui.swing, accents: ui.accents.slice(),
    voice: ui.voice, volume: ui.volume, subdivisionsOn: ui.subdivisionsOn,
    countIn: ui.countIn
  });
  metro.trainer = Object.assign({}, ui.trainer);
  metro.silentPractice = Object.assign({}, ui.silentPractice);

  /* ---------- elements ---------- */
  const el = {
    splash: $('splash'), startBtn: $('startBtn'), app: $('app'),
    dial: $('dial'), dialArc: $('dialArc'), dialKnob: $('dialKnob'),
    dialTicks: $('dialTicks'), dialPulse: $('dialPulse'),
    bpmValue: $('bpmValue'), tempoName: $('tempoName'),
    bpmSlider: $('bpmSlider'), bpmUp: $('bpmUp'), bpmDown: $('bpmDown'),
    beats: $('beats'), beatHint: $('beatHint'),
    playBtn: $('playBtn'), tapBtn: $('tapBtn'), tapSub: $('tapSub'),
    subBtn: $('subBtn'), subGlyph: $('subGlyph'), subSeg: $('subSeg'),
    swingBtn: $('swingBtn'), swingCap: $('swingCap'),
    beatsValue: $('beatsValue'), noteValue: $('noteValue'),
    beatsUp: $('beatsUp'), beatsDown: $('beatsDown'), noteToggle: $('noteToggle'),
    barCount: $('barCount'), counter: $('counter'), brandDot: document.querySelector('.brand__dot'),
    sheetBtn: $('sheetBtn')
  };

  /* ---------- tempo names ---------- */
  const MARKS = [
    [39, 'Grave'], [59, 'Largo'], [65, 'Larghetto'], [75, 'Adagio'],
    [107, 'Andante'], [119, 'Moderato'], [167, 'Allegro'], [199, 'Vivace'],
    [207, 'Presto'], [300, 'Prestissimo']
  ];
  const tempoName = (bpm) => (MARKS.find(([hi]) => bpm <= hi) || MARKS[MARKS.length - 1])[1];

  /* ---------- dial geometry ---------- */
  const ARC_SPAN = 270;                 // degrees of travel
  const ARC_START = 135;                // 0 % sits at the lower-left
  const CIRC = 2 * Math.PI * 98;
  const VISIBLE = CIRC * (ARC_SPAN / 360);

  (function buildTicks() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i <= 28; i++) {
      const major = i % 7 === 0;
      const a = (ARC_START + (i / 28) * ARC_SPAN) * Math.PI / 180;
      const r1 = major ? 79 : 83, r2 = 88;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 120 + Math.cos(a) * r1);
      line.setAttribute('y1', 120 + Math.sin(a) * r1);
      line.setAttribute('x2', 120 + Math.cos(a) * r2);
      line.setAttribute('y2', 120 + Math.sin(a) * r2);
      if (major) line.setAttribute('class', 'major');
      frag.appendChild(line);
    }
    el.dialTicks.appendChild(frag);
  })();

  function renderTempo() {
    const bpm = metro.bpm;
    const frac = (bpm - MIN_BPM) / (MAX_BPM - MIN_BPM);
    el.bpmValue.textContent = bpm;
    el.tempoName.textContent = tempoName(bpm);
    el.dialArc.style.strokeDasharray = `${(VISIBLE * frac).toFixed(2)} ${CIRC}`;
    el.dialArc.style.opacity = frac < 0.004 ? '0' : '1';
    const a = (ARC_START + frac * ARC_SPAN) * Math.PI / 180;
    el.dialKnob.setAttribute('cx', 120 + Math.cos(a) * 98);
    el.dialKnob.setAttribute('cy', 120 + Math.sin(a) * 98);
    el.bpmSlider.value = bpm;
    el.bpmSlider.style.setProperty('--fill', `${frac * 100}%`);
    el.dial.setAttribute('aria-valuenow', bpm);
    el.dial.setAttribute('aria-valuetext', `${bpm} beats per minute, ${tempoName(bpm)}`);
  }

  function setBpm(v, opts) {
    const next = clamp(Math.round(v), MIN_BPM, MAX_BPM);
    if (next === metro.bpm) return;
    metro.bpm = next;
    renderTempo();
    if (!opts || !opts.silent) save();
  }

  const NOTE_GLYPH = { 2: '\uD834\uDD5D', 4: '\u2669', 8: '\u266A', 16: '\uD834\uDD61' };

  /* ---------- beat dots ---------- */
  function renderBeats() {
    el.beats.innerHTML = '';
    // keep the accent array in step with the meter
    while (metro.accents.length < metro.beats) metro.accents.push(1);
    metro.accents.length = metro.beats;

    const size = metro.beats > 9 ? 28 : metro.beats > 6 ? 32 : 38;
    for (let i = 0; i < metro.beats; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'beat';
      b.style.setProperty('--size', size + 'px');
      b.dataset.level = metro.accents[i];
      b.dataset.index = i;
      b.textContent = i + 1;
      b.setAttribute('aria-label', `Beat ${i + 1}: ${['muted', 'normal', 'accented'][metro.accents[i]]}`);
      el.beats.appendChild(b);
    }
    el.beatsValue.textContent = metro.beats;
    el.noteValue.textContent = metro.noteValue;
    if (typeof renderMeterChips === 'function') renderMeterChips();
    el.noteToggle.textContent = (NOTE_GLYPH[metro.noteValue] || '\u2669') + ' = beat';
  }

  el.beats.addEventListener('click', (e) => {
    const btn = e.target.closest('.beat');
    if (!btn) return;
    const i = +btn.dataset.index;
    // accent → normal → mute → accent
    const order = [2, 1, 0];
    const next = order[(order.indexOf(metro.accents[i]) + 1) % order.length];
    metro.accents[i] = next;
    btn.dataset.level = next;
    btn.setAttribute('aria-label', `Beat ${i + 1}: ${['muted', 'normal', 'accented'][next]}`);
    renderMeterChips();
    haptic(8);
    save();
  });

  /* ---------- transport ---------- */
  let wakeLock = null;
  async function requestWakeLock() {
    if (!ui.keepAwake || !('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {}
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // iOS/Android suspend the audio clock in the background; pick it back up.
    if (metro.ctx && metro.ctx.state === 'suspended') metro.ctx.resume().catch(() => {});
    if (metro.running) {
      requestWakeLock();
      requestAnimationFrame(visualLoop);
    }
  });
  window.addEventListener('pageshow', () => {
    if (metro.ctx && metro.ctx.state === 'suspended' && metro.running) metro.ctx.resume().catch(() => {});
  });

  function updatePlayUI() {
    el.playBtn.classList.toggle('is-playing', metro.running);
    el.playBtn.setAttribute('aria-label', metro.running ? 'Stop metronome' : 'Start metronome');
  }

  function play() {
    metro.start();
    updatePlayUI();
    requestWakeLock();
    requestAnimationFrame(visualLoop);
  }
  function stop() {
    metro.stop();
    updatePlayUI();
    releaseWakeLock();
    clearActiveBeats();
    el.barCount.textContent = '–';
    el.counter.classList.remove('is-silent');
  }
  function toggle() { metro.running ? stop() : play(); }

  el.playBtn.addEventListener('click', toggle);

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.code === 'ArrowUp' || e.code === 'ArrowRight') { e.preventDefault(); setBpm(metro.bpm + (e.shiftKey ? 5 : 1)); }
    else if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') { e.preventDefault(); setBpm(metro.bpm - (e.shiftKey ? 5 : 1)); }
    else if (e.key === 't' || e.key === 'T') tap();
  });

  /* ---------- tap tempo ---------- */
  let taps = [];
  function tap() {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
    taps.push(now);
    if (taps.length > 6) taps.shift();
    haptic(10);
    metro.ensureContext();

    if (taps.length >= 2) {
      const spans = [];
      for (let i = 1; i < taps.length; i++) spans.push(taps[i] - taps[i - 1]);
      const avg = spans.reduce((a, b) => a + b, 0) / spans.length;
      setBpm(60000 / avg);
      el.tapSub.textContent = `${taps.length} taps`;
    } else {
      el.tapSub.textContent = 'keep tapping';
    }
    el.tapBtn.classList.add('is-armed');
    clearTimeout(tap._t);
    tap._t = setTimeout(() => {
      el.tapBtn.classList.remove('is-armed');
      el.tapSub.textContent = 'tempo';
      taps = [];
    }, 2500);
  }
  el.tapBtn.addEventListener('click', tap);

  /* ---------- nudges, slider ---------- */
  function holdRepeat(btn, fn) {
    let t = null, iv = null;
    const start = (e) => {
      e.preventDefault();
      fn();
      t = setTimeout(() => { iv = setInterval(fn, 70); }, 420);
    };
    const end = () => { clearTimeout(t); clearInterval(iv); };
    btn.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, end));
  }
  holdRepeat(el.bpmUp, () => setBpm(metro.bpm + 1));
  holdRepeat(el.bpmDown, () => setBpm(metro.bpm - 1));
  el.bpmSlider.addEventListener('input', () => setBpm(+el.bpmSlider.value));

  /* ---------- dial dragging (relative rotation) ---------- */
  (function dialDrag() {
    let dragging = false, lastAngle = 0, acc = 0, startBpm = 0;

    const angleAt = (e) => {
      const r = el.dial.getBoundingClientRect();
      return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    };

    el.dial.addEventListener('pointerdown', (e) => {
      dragging = true;
      acc = 0;
      startBpm = metro.bpm;
      lastAngle = angleAt(e);
      el.dial.setPointerCapture(e.pointerId);
    });

    el.dial.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const a = angleAt(e);
      let d = a - lastAngle;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      lastAngle = a;
      acc += d;
      const before = metro.bpm;
      setBpm(startBpm + acc * ((MAX_BPM - MIN_BPM) / ARC_SPAN), { silent: true });
      if (metro.bpm !== before) haptic(4);
    });

    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      try { el.dial.releasePointerCapture(e.pointerId); } catch (err) {}
      save();
    };
    el.dial.addEventListener('pointerup', end);
    el.dial.addEventListener('pointercancel', end);

    el.dial.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'ArrowRight') { e.preventDefault(); setBpm(metro.bpm + 1); }
      if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') { e.preventDefault(); setBpm(metro.bpm - 1); }
    });
  })();

  /* ---------- meter ---------- */
  el.beatsUp.addEventListener('click', () => { metro.beats = clamp(metro.beats + 1, 1, 16); renderBeats(); save(); });
  el.beatsDown.addEventListener('click', () => { metro.beats = clamp(metro.beats - 1, 1, 16); renderBeats(); save(); });
  el.noteToggle.addEventListener('click', () => {
    const cycle = [2, 4, 8, 16];
    metro.noteValue = cycle[(cycle.indexOf(metro.noteValue) + 1) % cycle.length];
    renderBeats(); save();
  });


  /* ---------- common meters ---------- */
  const METERS = {
    '2/4':  { beats: 2,  note: 4, accents: [2, 1] },
    '3/4':  { beats: 3,  note: 4, accents: [2, 1, 1] },
    '4/4':  { beats: 4,  note: 4, accents: [2, 1, 1, 1] },
    '5/4':  { beats: 5,  note: 4, accents: [2, 1, 1, 2, 1] },
    '6/8':  { beats: 6,  note: 8, accents: [2, 1, 1, 2, 1, 1] },
    '7/8':  { beats: 7,  note: 8, accents: [2, 1, 1, 2, 1, 2, 1] },
    '12/8': { beats: 12, note: 8, accents: [2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1] }
  };
  const meterPresets = $('meterPresets');
  meterPresets.addEventListener('click', (e) => {
    const b = e.target.closest('[data-meter]');
    if (!b) return;
    const m = METERS[b.dataset.meter];
    metro.beats = m.beats;
    metro.noteValue = m.note;
    metro.accents = m.accents.slice();
    renderBeats();
    renderMeterChips();
    haptic(8);
    save();
  });
  function renderMeterChips() {
    const key = `${metro.beats}/${metro.noteValue}`;
    meterPresets.querySelectorAll('[data-meter]').forEach((c) => {
      const on = c.dataset.meter === key &&
                 JSON.stringify(METERS[key].accents) === JSON.stringify(metro.accents);
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-pressed', String(on));
    });
  }

  /* ---------- subdivision + swing ---------- */
  const SUB_GLYPH = { 1: '♩', 2: '♫', 3: '♪³', 4: '♬' };
  function renderSub() {
    el.subSeg.querySelectorAll('[data-sub]').forEach((b) => {
      b.classList.toggle('is-on', metro.subdivisionsOn && +b.dataset.sub === metro.subdivision);
    });
    el.subGlyph.textContent = SUB_GLYPH[metro.subdivision] || '♩';
    el.subBtn.setAttribute('aria-pressed', String(metro.subdivisionsOn));
    const swingOn = metro.swing > 0;
    el.swingBtn.classList.toggle('is-on', swingOn);
    el.swingCap.textContent = swingOn ? (metro.swing >= 0.14 ? 'hard' : 'light') : 'off';
  }
  el.subSeg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sub]');
    if (b) {
      metro.subdivision = +b.dataset.sub;
      metro.subdivisionsOn = true;
      renderSub(); save();
      return;
    }
    if (e.target.closest('#swingBtn')) {
      const cycle = [0, 0.083, 0.167];        // straight · light · hard (of a beat)
      metro.swing = cycle[(cycle.indexOf(metro.swing) + 1) % cycle.length];
      if (metro.swing > 0 && metro.subdivision !== 2 && metro.subdivision !== 4) {
        metro.subdivision = 2; metro.subdivisionsOn = true;
      }
      renderSub(); save();
    }
  });
  el.subBtn.addEventListener('click', () => {
    metro.subdivisionsOn = !metro.subdivisionsOn;
    renderSub(); save();
  });

  /* ---------- haptics ---------- */
  function haptic(ms) {
    if (!ui.vibrate || !navigator.vibrate) return;
    navigator.vibrate(ms);
  }

  /* ---------- visual sync ---------- */
  let activeBeat = -1;
  function clearActiveBeats() {
    el.beats.querySelectorAll('.beat').forEach((b) => b.classList.remove('is-active', 'is-sub'));
    activeBeat = -1;
  }

  function visualLoop() {
    if (!metro.running) return;
    const now = metro.ctx.currentTime;
    const due = metro.due(now);
    for (const e of due) {
      if (e.tick === 0) showBeat(e);
      else showSubTick(e);
    }
    requestAnimationFrame(visualLoop);
  }

  function showBeat(e) {
    const dots = el.beats.children;
    if (activeBeat >= 0 && dots[activeBeat]) dots[activeBeat].classList.remove('is-active', 'is-sub');
    if (dots[e.beat]) dots[e.beat].classList.add('is-active');
    activeBeat = e.beat;

    if (!e.silent && e.level) {
      el.dialPulse.classList.remove('is-beat', 'is-accent');
      void el.dialPulse.offsetWidth;
      el.dialPulse.classList.add(e.level === 'accent' ? 'is-accent' : 'is-beat');
      if (ui.vibrate) navigator.vibrate && navigator.vibrate(e.level === 'accent' ? 22 : 10);
      if (ui.flash && e.level === 'accent') flashScreen();
    }

    el.brandDot.classList.add('is-lit');
    setTimeout(() => el.brandDot.classList.remove('is-lit'), 90);

    if (e.beat === 0) {
      if (e.countIn) {
        el.barCount.textContent = 'in';
      } else {
        el.barCount.textContent = e.bar + 1;
      }
      el.counter.classList.toggle('is-silent', e.silent);
    }
  }

  function showSubTick(e) {
    const dot = el.beats.children[e.beat];
    if (!dot || e.silent || !e.level) return;
    dot.classList.remove('is-sub');
    void dot.offsetWidth;
    dot.classList.add('is-sub');
  }

  let flashEl = null;
  function flashScreen() {
    if (!flashEl) {
      flashEl = document.createElement('div');
      flashEl.className = 'screen-flash';
      document.body.appendChild(flashEl);
    }
    flashEl.classList.remove('is-on');
    void flashEl.offsetWidth;
    flashEl.classList.add('is-on');
  }

  metro.onTempoChange = () => renderTempo();

  /* ---------- start screen ---------- */
  el.startBtn.addEventListener('click', () => {
    metro.ensureContext();                       // unlock audio on the first gesture
    el.splash.classList.add('is-hiding');
    el.app.hidden = false;
    setTimeout(() => { el.splash.style.display = 'none'; }, 450);
  });


  /* ============================================================
     Settings & practice sheet
     ============================================================ */
  const sheetEl = {
    sheet: $('sheet'), scrim: $('scrim'), close: $('sheetClose'), grab: $('sheetGrab'),
    voiceChips: $('voiceChips'), vol: $('volSlider'),
    countInSeg: $('countInSeg'),
    trainerOn: $('trainerOn'), trainerFields: $('trainerFields'),
    trainerStepVal: $('trainerStepVal'), trainerEveryVal: $('trainerEveryVal'),
    trainerMaxVal: $('trainerMaxVal'), trainerMode: $('trainerMode'),
    trainerLimitLabel: $('trainerLimitLabel'),
    silentOn: $('silentOn'), playBarsVal: $('playBarsVal'), muteBarsVal: $('muteBarsVal'),
    vibrateOn: $('vibrateOn'), flashOn: $('flashOn'), awakeOn: $('awakeOn'),
    resetBtn: $('resetBtn')
  };

  function openSheet() {
    sheetEl.sheet.hidden = false;
    sheetEl.scrim.hidden = false;
    requestAnimationFrame(() => {
      sheetEl.sheet.classList.add('is-open');
      sheetEl.scrim.classList.add('is-open');
    });
  }
  function closeSheet() {
    sheetEl.sheet.classList.remove('is-open');
    sheetEl.scrim.classList.remove('is-open');
    setTimeout(() => { sheetEl.sheet.hidden = true; sheetEl.scrim.hidden = true; }, 320);
  }
  el.sheetBtn.addEventListener('click', openSheet);
  sheetEl.close.addEventListener('click', closeSheet);
  sheetEl.scrim.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheetEl.sheet.hidden) closeSheet(); });

  /* swipe the sheet down to dismiss */
  (function swipeToClose() {
    let y0 = null;
    const onDown = (e) => { y0 = e.clientY; sheetEl.sheet.style.transition = 'none'; };
    const onMove = (e) => {
      if (y0 == null) return;
      const dy = Math.max(0, e.clientY - y0);
      sheetEl.sheet.style.transform = `translateY(${dy}px)`;
    };
    const onUp = (e) => {
      if (y0 == null) return;
      const dy = Math.max(0, e.clientY - y0);
      y0 = null;
      sheetEl.sheet.style.transition = '';
      sheetEl.sheet.style.transform = '';
      if (dy > 90) closeSheet();
    };
    sheetEl.grab.addEventListener('pointerdown', (e) => { sheetEl.grab.setPointerCapture(e.pointerId); onDown(e); });
    sheetEl.grab.addEventListener('pointermove', onMove);
    sheetEl.grab.addEventListener('pointerup', onUp);
    sheetEl.grab.addEventListener('pointercancel', onUp);
  })();

  /* --- sound picker --- */
  (function buildVoices() {
    const voices = window.Pulse.VOICES;
    Object.keys(voices).forEach((key) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.dataset.voice = key;
      b.textContent = voices[key].label;
      b.setAttribute('role', 'radio');
      sheetEl.voiceChips.appendChild(b);
    });
    sheetEl.voiceChips.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      metro.voice = b.dataset.voice;
      renderVoices();
      if (!metro.running) metro.preview('accent');
      haptic(8);
      save();
    });
  })();

  function renderVoices() {
    sheetEl.voiceChips.querySelectorAll('.chip').forEach((c) => {
      const on = c.dataset.voice === metro.voice;
      c.classList.toggle('is-on', on);
      c.setAttribute('aria-checked', String(on));
    });
  }

  /* --- volume --- */
  sheetEl.vol.addEventListener('input', () => {
    const v = +sheetEl.vol.value / 100;
    metro.ensureContext();
    metro.setVolume(v);
    sheetEl.vol.style.setProperty('--fill', sheetEl.vol.value + '%');
    save();
  });

  /* --- count-in --- */
  sheetEl.countInSeg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-count]');
    if (!b) return;
    metro.countIn = +b.dataset.count;
    renderSheet();
    save();
  });

  /* --- trainer + silent practice steppers --- */
  const LIMITS = {
    trainerStep: [1, 20], trainerEvery: [1, 32], trainerMax: [20, 300],
    playBars: [1, 32], muteBars: [1, 32]
  };
  function bump(target, delta) {
    const [lo, hi] = LIMITS[target];
    const t = metro.trainer, sp = metro.silentPractice;
    const get = { trainerStep: () => t.step, trainerEvery: () => t.everyBars, trainerMax: () => t.max,
                  playBars: () => sp.playBars, muteBars: () => sp.muteBars };
    const set = { trainerStep: (v) => t.step = v, trainerEvery: (v) => t.everyBars = v,
                  trainerMax: (v) => t.max = v, playBars: (v) => sp.playBars = v, muteBars: (v) => sp.muteBars = v };
    set[target](clamp(get[target]() + delta, lo, hi));
    renderSheet();
    save();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step][data-target]');
    if (!b) return;
    bump(b.dataset.target, +b.dataset.step);
  });

  sheetEl.trainerOn.addEventListener('change', () => {
    metro.trainer.on = sheetEl.trainerOn.checked;
    renderSheet(); save();
  });
  sheetEl.trainerMode.addEventListener('click', () => {
    metro.trainer.mode = metro.trainer.mode === 'up' ? 'down' : 'up';
    // flip the limit to a sensible default on the other side of the current tempo
    metro.trainer.max = metro.trainer.mode === 'up'
      ? clamp(Math.max(metro.bpm + 20, metro.trainer.max), 20, 300)
      : clamp(Math.min(metro.bpm - 20, metro.trainer.max), 20, 300);
    renderSheet(); save();
  });
  sheetEl.silentOn.addEventListener('change', () => {
    metro.silentPractice.on = sheetEl.silentOn.checked;
    renderSheet(); save();
  });

  /* --- feedback toggles --- */
  sheetEl.vibrateOn.addEventListener('change', () => { ui.vibrate = sheetEl.vibrateOn.checked; save(); haptic(15); });
  sheetEl.flashOn.addEventListener('change', () => { ui.flash = sheetEl.flashOn.checked; save(); });
  sheetEl.awakeOn.addEventListener('change', () => {
    ui.keepAwake = sheetEl.awakeOn.checked;
    if (ui.keepAwake && metro.running) requestWakeLock(); else releaseWakeLock();
    save();
  });

  sheetEl.resetBtn.addEventListener('click', () => {
    if (!confirm('Reset tempo, meter, sounds and practice settings?')) return;
    stop();
    try { localStorage.removeItem(STORE_KEY); } catch (err) {}
    ui = JSON.parse(JSON.stringify(defaults));
    Object.assign(metro, {
      bpm: defaults.bpm, beats: defaults.beats, noteValue: defaults.noteValue,
      subdivision: defaults.subdivision, swing: defaults.swing,
      accents: defaults.accents.slice(), voice: defaults.voice,
      subdivisionsOn: defaults.subdivisionsOn, countIn: defaults.countIn
    });
    metro.trainer = Object.assign({}, defaults.trainer);
    metro.silentPractice = Object.assign({}, defaults.silentPractice);
    metro.setVolume(defaults.volume);
    renderTempo(); renderBeats(); renderSub(); renderSheet();
    save();
  });

  function renderSheet() {
    renderVoices();
    sheetEl.vol.value = Math.round(metro.volume * 100);
    sheetEl.vol.style.setProperty('--fill', Math.round(metro.volume * 100) + '%');

    sheetEl.countInSeg.querySelectorAll('[data-count]').forEach((b) => {
      b.classList.toggle('is-on', +b.dataset.count === metro.countIn);
    });

    const t = metro.trainer;
    sheetEl.trainerOn.checked = t.on;
    sheetEl.trainerFields.classList.toggle('is-disabled', !t.on);
    sheetEl.trainerStepVal.textContent = t.step;
    sheetEl.trainerEveryVal.textContent = t.everyBars + (t.everyBars === 1 ? ' bar' : ' bars');
    sheetEl.trainerMaxVal.textContent = t.max;
    sheetEl.trainerMode.textContent = t.mode === 'up' ? 'Speed up' : 'Slow down';
    sheetEl.trainerLimitLabel.textContent = t.mode === 'up' ? 'Up to' : 'Down to';

    const sp = metro.silentPractice;
    sheetEl.silentOn.checked = sp.on;
    sheetEl.playBarsVal.textContent = sp.playBars;
    sheetEl.muteBarsVal.textContent = sp.muteBars;

    sheetEl.vibrateOn.checked = !!ui.vibrate;
    sheetEl.flashOn.checked = !!ui.flash;
    sheetEl.awakeOn.checked = !!ui.keepAwake;
  }


  /* ============================================================
     PWA: offline cache + install prompt
     ============================================================ */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  let installEvent = null;
  const installBtn = $('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    if (installBtn) installBtn.hidden = false;
  });
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!installEvent) return;
      installEvent.prompt();
      await installEvent.userChoice;
      installEvent = null;
      installBtn.hidden = true;
    });
  }
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    if (installBtn) installBtn.hidden = true;
  });

  /* ---------- boot ---------- */
  renderTempo();
  renderBeats();
  renderSub();
  renderMeterChips();
  renderSheet();
  updatePlayUI();

  window.__pulse = { metro, ui, save, renderBeats, renderSub, renderTempo, haptic, tempoName };
})();
