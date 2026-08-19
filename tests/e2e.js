const BASE = process.env.BASE_URL || 'http://localhost:8765';
const { chromium } = require('playwright');
const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('  ok — ' + msg); };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await p.goto(BASE + '/index.html', { waitUntil: 'networkidle' });

  console.log('title screen');
  assert(await p.isVisible('#splash'), 'splash visible on load');
  await p.click('#startBtn');
  await p.waitForTimeout(500);
  assert(!(await p.isVisible('#splash')), 'splash dismissed');

  console.log('tempo controls');
  await p.click('#bpmUp'); await p.click('#bpmUp');
  assert(await p.textContent('#bpmValue') === '102', '+ button raises BPM to 102');
  await p.click('#bpmDown');
  assert(await p.textContent('#bpmValue') === '101', '− button lowers BPM');

  // tap tempo — compare against the intervals actually achieved, since driving
  // the click through the browser adds its own overhead
  const stamps = [];
  for (let i = 0; i < 6; i++) {
    await p.click('#tapBtn');
    stamps.push(Date.now());
    if (i < 5) await p.waitForTimeout(400);
  }
  const spans = stamps.slice(1).map((t, i) => t - stamps[i]).slice(-5);
  const expected = 60000 / (spans.reduce((a, c) => a + c, 0) / spans.length);
  let bpm = +(await p.textContent('#bpmValue'));
  assert(Math.abs(bpm - expected) <= 3, `tap tempo → ${bpm} BPM vs ${expected.toFixed(1)} actually tapped`);

  // dial drag
  const box = await p.locator('#dial').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2, r = box.width / 2 - 12;
  await p.mouse.move(cx - r, cy);
  await p.mouse.down();
  await p.mouse.move(cx, cy - r, { steps: 12 });   // sweep 90° clockwise
  await p.mouse.up();
  const dragged = +(await p.textContent('#bpmValue'));
  assert(dragged > bpm + 40, `dragging the dial 90° raised ${bpm} → ${dragged} BPM`);

  console.log('accents + meter');
  await p.click('.beat[data-index="1"]');
  assert(await p.getAttribute('.beat[data-index="1"]', 'data-level') === '2', 'tapping beat 2 accents it');
  await p.click('.beat[data-index="1"]');
  assert(await p.getAttribute('.beat[data-index="1"]', 'data-level') === '0', 'tapping again mutes it');
  await p.click('.beat[data-index="1"]');
  assert(await p.getAttribute('.beat[data-index="1"]', 'data-level') === '1', 'tapping a third time returns to normal');
  await p.click('[data-meter="7/8"]');
  assert((await p.locator('.beat').count()) === 7, '7/8 preset gives 7 beats');
  assert(await p.textContent('#noteValue') === '8', 'and an eighth-note beat unit');

  console.log('playback');
  await p.click('#playBtn');
  await p.waitForTimeout(1200);
  assert(await p.evaluate(() => window.__pulse.metro.running), 'metronome runs');
  assert(await p.textContent('#barCount') !== '–', 'bar counter advances');
  await p.click('#playBtn');
  assert(!(await p.evaluate(() => window.__pulse.metro.running)), 'metronome stops');
  await p.keyboard.press('Space');
  assert(await p.evaluate(() => window.__pulse.metro.running), 'spacebar starts');
  await p.keyboard.press('Space');

  console.log('settings sheet');
  await p.click('#sheetBtn');
  await p.waitForTimeout(400);
  await p.click('.chip[data-voice="cowbell"]');
  await p.click('#countInSeg [data-count="2"]');
  await p.click('#trainerOn + .switch__track');
  await p.click('[data-target="trainerStep"][data-step="1"]');
  assert(await p.textContent('#trainerStepVal') === '6', 'trainer step increments');
  await p.click('#trainerMode');
  assert((await p.textContent('#trainerMode')).includes('Slow'), 'trainer direction flips');
  await p.click('#sheetClose');
  await p.waitForTimeout(400);
  assert(!(await p.isVisible('#sheet')), 'sheet closes');

  console.log('persistence');
  const before = await p.evaluate(() => {
    const m = window.__pulse.metro;
    return { bpm: m.bpm, beats: m.beats, voice: m.voice, countIn: m.countIn, accents: m.accents.join(''), trainer: m.trainer.on };
  });
  await p.waitForTimeout(400);   // debounced save
  await p.reload({ waitUntil: 'networkidle' });
  await p.click('#startBtn');
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => {
    const m = window.__pulse.metro;
    return { bpm: m.bpm, beats: m.beats, voice: m.voice, countIn: m.countIn, accents: m.accents.join(''), trainer: m.trainer.on };
  });
  assert(JSON.stringify(before) === JSON.stringify(after), `settings survive a reload (${JSON.stringify(after)})`);

  console.log('count-in');
  await p.click('#playBtn');
  await p.waitForTimeout(300);
  assert(await p.textContent('#barCount') === 'in', 'count-in shows "in" in the bar counter');
  await p.click('#playBtn');

  console.log(errors.length ? '\n' + errors.join('\n') : '\nno console/page errors');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
