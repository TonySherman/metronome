# Pulse — Metronome · Build Notes

A mobile-first, installable (PWA) web metronome. Vanilla HTML/CSS/JS, no build step,
served as static files from the repo root (`index.html` is the entry point).

## Log

### Step 1 — Title screen & project skeleton
- `index.html` — title screen ("Pulse") with animated SVG metronome mark, tagline,
  "Start playing" CTA, and a placeholder app shell that the CTA reveals.
- `css/styles.css` — design tokens (dark charcoal UI, amber accent), splash layout,
  safe-area padding for notched phones, `prefers-reduced-motion` support.
- `js/app.js` — bootstrap: hides the splash and shows the app shell.
- `icons/icon.svg` — app mark used as favicon / PWA icon.
- `manifest.webmanifest` — PWA metadata (standalone display, portrait, theme colors).

Design decisions so far:
- Vanilla JS: a metronome needs precise audio scheduling, not a framework. Keeping it
  dependency-free also means it loads instantly and caches trivially for offline use.
- SVG for the logo/artwork (crisp at any DPI, tiny, themeable) rather than raster art.
- Viewport uses `viewport-fit=cover` + safe-area insets so it looks right full-screen on iOS.

## Planned features
- Web Audio look-ahead scheduler (sample-accurate timing, immune to JS timer jitter)
- BPM 20–300: dial/slider, ±1 buttons, tap tempo
- Time signatures + per-beat accent patterns (accent / normal / mute)
- Subdivisions (eighths, triplets, sixteenths, swing)
- Multiple click sounds + volume
- Visual beat display, count-in, bar counter
- Tempo trainer (auto speed-up) and bar muting for practice
- Persisted settings, screen wake lock, offline service worker

### Step 2 — Metronome engine + core UI
- `js/audio.js` — the engine.
  - **Scheduling:** a 25 ms `setInterval` "ticker" schedules every click that falls in the
    next 120 ms directly on the Web Audio clock. JS timers only decide *when to schedule*,
    never *when to sound*, so timing stays sample-accurate even when the main thread stutters.
  - **Sounds are synthesised** (noise bursts + filtered oscillators), so there are no audio
    files to download: 8 voices — Click, Woodblock, Beep, Mechanical, Cowbell, Rimshot,
    Hi-hat, Marimba. One recipe per voice is reused for accent / normal / subdivision by
    scaling gain and pitch.
  - Supports beats-per-bar, note value, subdivisions (1–4), swing, per-beat accent levels
    (accent / normal / mute), count-in, tempo trainer and silent-bar practice.
  - A queue of `(audioTime → beat)` entries lets the UI redraw in `requestAnimationFrame`
    exactly in sync with what you hear.
- `js/app.js` — UI layer: circular tempo dial (drag to change tempo), ± buttons with
  press-and-hold repeat, slider, tap tempo, beat dots you tap to cycle accent → normal →
  mute, time-signature stepper, subdivision + swing segmented control, play/stop,
  keyboard shortcuts (space, arrows, T), screen wake lock, settings persisted to
  `localStorage`, Italian tempo markings.
- Fix: the tempo arc is set with `element.style.strokeDasharray`, not `setAttribute` — a
  CSS rule for the same property outranks a presentation attribute, so the arc never drew.

### Step 3 — Sound & practice sheet
A swipe-down bottom sheet (`#sheet`) holds everything that doesn't belong on the main screen:
- **Click sound** — 8 voices as chips; tapping one previews it when the metronome is stopped.
- **Volume** — smoothed with `setTargetAtTime` so it never clicks.
- **Count-in** — off / 1 / 2 bars before the loop starts; the bar counter shows "in".
- **Tempo trainer** — change by N BPM every M bars, up to a ceiling (or down to a floor when
  reversed). Runs in the engine at bar boundaries and pushes the new tempo back to the dial.
- **Silent bars** — play N bars, mute M bars, repeating; the bar counter turns cyan while muted
  so you can still see where you are.
- **Feedback** — vibrate on beat, screen flash on the downbeat, keep screen awake.
- **Reset all settings**.

Sheet can be dismissed by the ✕, the scrim, `Esc`, or dragging the grab handle down 90 px.

### Step 4 — Icons & offline (PWA)
- Redrew `icons/icon.svg` (metronome mark with a warm amber pendulum) plus a `maskable`
  variant with safe-zone padding for Android adaptive icons, and rasterised them to
  192/512 px PNGs and a 180 px `apple-touch-icon.png`.
- Bug fixed twice over: an SVG `linearGradient` in the default `objectBoundingBox` units
  paints nothing on a perfectly vertical line (its bounding box has zero width), so the
  pendulum rod and the tempo arc were invisible. Both now use `gradientUnits="userSpaceOnUse"`.
- `manifest.webmanifest` — full icon set, `id`, categories, standalone/portrait.
- `sw.js` — service worker: cache-first for the app shell, network-first for navigations
  (so a new deploy is picked up), old caches cleaned on activate. The whole app is a
  handful of KB, so it installs and runs offline immediately.
- Install prompt: `beforeinstallprompt` is captured and surfaced as an "Install Pulse on
  this device" button at the bottom of the settings sheet.

**Note on image generation:** I intended to generate the icon with `gpt-image-2`, but this
session's egress policy blocks `api.openai.com` (the agent proxy answers 403 to CONNECT),
so the artwork is hand-authored SVG rasterised through headless Chromium instead. That is
arguably the better outcome here: the icon is vector, matches the in-app mark exactly, and
the whole icon set is ~50 KB.

### Step 5 — Generated app icon (OpenAI `gpt-image-2`)
Egress to `api.openai.com` was opened up, so the installed-app icon is now generated with
`gpt-image-2` (1024², high quality): a dark, glowing metronome in the app's amber palette.
Post-processing with Pillow trims the generated black margin and produces `icon-512.png`,
`icon-192.png`, `apple-touch-icon.png` (180 px) and a padded `icon-maskable-512.png` for
Android's adaptive-icon safe zone.

The in-app artwork stays vector: the title-screen mark was redrawn to match the generated
icon's silhouette (rounded-top body, plinth, inner panel, amber pendulum) so the launcher
icon and the splash read as the same object — but as SVG it stays crisp at any size and its
pendulum actually swings. `icons/icon.svg` (favicon + manifest SVG entry) was redrawn to match.

### Step 6 — Meters, landscape layout, robustness
- **Common time signatures** as one-tap chips (2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 12/8). Each
  preset also loads a sensible accent pattern — 6/8 accents beats 1 and 4, 12/8 accents
  1/4/7/10, 7/8 gives the 2+2+3 grouping — and the chip highlights only while the meter
  *and* the accent pattern still match, so hand-edited accents are visible as "custom".
- **Landscape / short viewports**: the app becomes two columns (dial on the left, beats,
  transport and controls on the right) and now fits a 844×390 phone in landscape with no
  scrolling — useful when the phone is on a music stand.
- **Bug: `hidden` was being ignored.** `.app` and `.sheet` set `display: flex`, which
  outranks the `hidden` attribute's UA `display: none` — the settings sheet was actually
  rendered (just off behind other content) before it was ever opened. Added a global
  `[hidden] { display: none !important }`.
- **Bug: media-query ordering.** The `min-width: 620px` tablet rule was overriding the
  short-landscape dial size; it is now also gated on `min-height`.
- **Backgrounding:** mobile browsers suspend the audio clock when the app leaves the
  foreground, so `visibilitychange`/`pageshow` resume the context, re-arm the wake lock and
  restart the animation loop.
- Verified timing in headless Chromium by logging every scheduled click: 120 BPM quarters
  land 0.500000 s apart, triplets 0.166667 s, swung eighths 0.3335/0.1665 (2:1), the trainer
  steps 240→250→260 on bar lines, count-in, silent bars and accent/mute all behave.

### Step 7 — Fits on one screen, at any size
The controls were falling below the fold on smaller phones (a metronome you have to scroll
is a broken metronome), so sizing is now driven by the viewport *height* as well as width:
- The dial is `min(300px, 74vw, 36dvh)`, the play/tap buttons and row paddings use
  `clamp(..dvh..)`, and two portrait breakpoints (≤900 px and ≤720 px tall) tighten the
  vertical rhythm further.
- The BPM readout is sized in container-query units (`27cqi`) against the dial itself, so
  three digits always sit inside the ring instead of overflowing on narrow screens; a
  viewport-based `clamp()` stays as the fallback for older browsers.
- The time-signature chips scroll horizontally (with a masked fade edge) instead of wrapping
  to a second line.
- Verified at 375×667, 393×851, 768×1024 and 844×390 landscape: no page scrolling on any of
  them. Subdivision clicks now also blink the active beat dot.
- Offline verified end-to-end: with the network cut, a reload still boots the full app from
  the service-worker cache.

### Step 8 — Tests, README, final polish
- `tests/timing.js` and `tests/e2e.js` are checked in (Playwright + a static server; see
  `tests/README.md`). The e2e run drives the title screen, ± buttons, tap tempo, dial drag,
  accent cycling, meter presets, transport + spacebar, the settings sheet, persistence
  across a reload and the count-in — 20 assertions, all passing, no console errors.
- **Behaviour fix found by the tests:** tapping a normal beat used to mute it; the cycle is
  now normal → accent → mute → normal, since accenting is the far more common intent.
- Tap-tempo test compares against the intervals *actually* achieved rather than the nominal
  ones — driving clicks through a browser adds tens of ms, which looked like a metronome bug
  at first and wasn't (138 BPM read against 138.5 BPM tapped).
- `README.md` rewritten as the project front page: feature list, how the scheduler works,
  file map, keyboard shortcuts.
- Dropped the unused subdivision-dot CSS and a no-op line in the beat renderer; corrected an
  engine comment that claimed `noteValue` rescaled the beat length (it doesn't — the tempo
  counts the denominator note, like a hardware metronome).
