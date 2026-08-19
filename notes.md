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
