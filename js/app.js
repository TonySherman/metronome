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
    metro.accents[0] = metro.accents[0] === 0 ? 0 : metro.accents[0];

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
    if (document.visibilityState === 'visible' && metro.running) requestWakeLock();
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
    el.beats.querySelectorAll('.beat.is-active').forEach((b) => b.classList.remove('is-active'));
    activeBeat = -1;
  }

  function visualLoop() {
    if (!metro.running) return;
    const now = metro.ctx.currentTime;
    const due = metro.due(now);
    for (const e of due) {
      if (e.tick !== 0) continue;
      showBeat(e);
    }
    requestAnimationFrame(visualLoop);
  }

  function showBeat(e) {
    const dots = el.beats.children;
    if (activeBeat >= 0 && dots[activeBeat]) dots[activeBeat].classList.remove('is-active');
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

  /* ---------- boot ---------- */
  renderTempo();
  renderBeats();
  renderSub();
  updatePlayUI();

  window.__pulse = { metro, ui, save, renderBeats, renderSub, renderTempo, haptic, tempoName };
})();
