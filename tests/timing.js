const BASE = process.env.BASE_URL || 'http://localhost:8765';
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined,
    args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.click('#startBtn');

  const res = await page.evaluate(async () => {
    const { metro } = window.__pulse;
    const run = (cfg, seconds) => new Promise((resolve) => {
      Object.assign(metro, cfg);
      const log = [];
      metro.onSchedule = (e) => log.push({ t: e.time, beat: e.beat, tick: e.tick, lvl: e.level, bar: e.bar, silent: e.silent, ci: e.countIn });
      metro.start();
      setTimeout(() => { metro.stop(); metro.onSchedule = null; resolve(log); }, seconds * 1000);
    });
    const deltas = (log) => log.slice(1).map((e, i) => +(e.t - log[i].t).toFixed(6));
    const out = {};

    let log = await run({ bpm: 120, beats: 4, subdivision: 1, subdivisionsOn: true, swing: 0, countIn: 0,
                          accents: [2,1,1,1], trainer: { on:false, everyBars:4, step:5, max:200, mode:'up' },
                          silentPractice: { on:false, playBars:4, muteBars:1 } }, 2.2);
    out.quarter = { deltas: deltas(log).slice(0, 4), levels: log.slice(0,5).map(e=>e.lvl) };

    log = await run({ bpm: 120, subdivision: 3 }, 1.6);
    out.triplet = { deltas: deltas(log).slice(0, 6) };

    log = await run({ bpm: 120, subdivision: 2, swing: 0.167 }, 1.6);
    out.swing = { deltas: deltas(log).slice(0, 4) };

    log = await run({ bpm: 240, subdivision: 1, swing: 0, beats: 2,
                      trainer: { on:true, everyBars:1, step:10, max:300, mode:'up' } }, 1.6);
    out.trainer = { bpms: [...new Set(deltas(log).map(d => Math.round(60/d)))] };

    metro.bpm = 240;
    log = await run({ beats: 2, trainer: { on:false, everyBars:1, step:10, max:300, mode:'up' },
                      silentPractice: { on:true, playBars:1, muteBars:1 } }, 1.6);
    out.silent = log.slice(0, 8).map(e => (e.silent ? 'x' : 'o') + e.bar);

    log = await run({ countIn: 1, silentPractice: { on:false, playBars:4, muteBars:1 } }, 1.6);
    out.countIn = log.slice(0, 6).map(e => (e.ci ? 'in' : 'b' + e.bar) + ':' + e.beat);

    log = await run({ countIn: 0, accents: [2, 0, 1, 1], beats: 4, bpm: 240 }, 1.4);
    out.accents = log.slice(0, 8).map(e => e.lvl);
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();
