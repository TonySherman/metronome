# Pulse — Metronome

A mobile-first, installable web metronome for practising music. No build step, no
dependencies, no audio files — open `index.html` and play.

**[Start playing →](./index.html)**

## Features

**Tempo**
- 20–300 BPM, with the Italian tempo marking (Grave … Prestissimo) shown live
- Circular dial you drag to set the tempo, a slider, ±1 buttons with press-and-hold repeat
- Tap tempo (averages your last six taps)

**Meter & feel**
- Any meter from 1 to 16 beats, note value ♩ 𝅗𝅥 ♪ 𝅘𝅥𝅯, plus one-tap presets:
  2/4 · 3/4 · 4/4 · 5/4 · 6/8 · 7/8 · 12/8 (each with a sensible accent pattern)
- Tap any beat to cycle it **accent → normal → mute**, so you can click 3+3+2 or drop beat 1
- Subdivisions: quarters, eighths, triplets, sixteenths — toggled on and off from the dial row
- Swing (light / hard) on eighths and sixteenths

**Sound**
- 8 synthesised voices: Click, Woodblock, Beep, Mechanical, Cowbell, Rimshot, Hi-hat, Marimba
- Volume, and a preview when you pick a sound

**Practice tools**
- Count-in of 1 or 2 bars
- Bar counter
- **Tempo trainer** — change by *n* BPM every *m* bars, up to a ceiling (or down to a floor)
- **Silent bars** — play 4, mute 1 (configurable), so you have to keep time yourself

**Feel and platform**
- Beat dots, dial pulse, optional screen flash and vibration
- Keeps the screen awake while playing
- Works fully offline and installs to the home screen (PWA)
- Everything you set is remembered
- Keyboard: <kbd>Space</kbd> start/stop · <kbd>↑</kbd>/<kbd>↓</kbd> tempo (<kbd>Shift</kbd> = ±5) · <kbd>T</kbd> tap

## How the timing works

JavaScript timers are far too jittery to drive a metronome directly. A 25 ms ticker wakes up
and schedules every click that falls inside the next 120 ms window directly on the Web Audio
clock, which is sample-accurate: timers decide *when to schedule*, never *when to sound*.
Measured in headless Chromium, 120 BPM quarter notes land 0.500000 s apart, triplets
0.166667 s, and swung eighths at a 2:1 ratio.

The UI reads a queue of `(audioTime → beat)` entries in `requestAnimationFrame`, so what you
see matches what you hear rather than drifting on its own timer.

## Files

```
index.html            title screen + app markup
css/styles.css        design tokens, layout, responsive rules
js/audio.js           metronome engine: scheduler + synthesised voices
js/app.js             UI: dial, transport, controls, settings, PWA glue
sw.js                 offline service worker
manifest.webmanifest  PWA manifest
icons/                app icons (SVG + generated PNGs)
notes.md              build log
```

Serve the repository root as static files (any static host, or `python3 -m http.server`).
A secure context (HTTPS or `localhost`) is required for the service worker and wake lock.
