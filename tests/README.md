# Tests

Two headless-Chromium scripts. They need a static server on the repo root and Playwright:

```sh
python3 -m http.server 8765 &      # serve the app
npm install playwright             # once
node tests/timing.js               # scheduler accuracy
node tests/e2e.js                  # UI interactions
```

`BASE_URL` overrides the server address; `PW_CHROME` points Playwright at an existing
Chromium binary if it can't find its own.

- **`timing.js`** logs every click the engine schedules and checks the intervals: straight
  quarters, triplets, swung eighths, the tempo trainer stepping on bar lines, silent-bar
  cycling, count-in, and accent/mute levels.
- **`e2e.js`** drives the UI: title screen, ± buttons, tap tempo (compared against the
  intervals actually tapped), dial dragging, accent cycling, meter presets, play/stop and
  the spacebar, the settings sheet, persistence across a reload, and the count-in.
