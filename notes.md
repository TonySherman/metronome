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
