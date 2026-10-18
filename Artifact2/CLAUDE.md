# Fantasy Climate Mapper

A browser app that simulates plausible winds, ocean currents, temperature,
rainfall, Köppen climates, and tides for hand-made fantasy maps. It's a
personal worldbuilding tool, and I'm the only user.

- Full feature spec, pipeline, and milestones: SPEC.md
- Progress, plans, and changes: LOG.md (read it at the start of every session)

## Stack
- Plain HTML, CSS, and JavaScript (ES modules), Canvas 2D, no build step
- The simulation runs in a Web Worker so the UI never freezes
- Prefer no dependencies. If one is truly needed (e.g., a 16-bit PNG decoder),
  vendor it into lib/ and record why in LOG.md
- Run locally (from Artifact2/): `py -m http.server 8000 --bind 127.0.0.1`,
  then open http://127.0.0.1:8000. `--bind 127.0.0.1` keeps the dev server
  reachable only from this computer. On this Windows machine `python3` is the
  Microsoft Store stub; use `py` (or `python`)
- Tests: `node --test "tests/*.test.js"` (sim code is pure, so it runs in
  Node; Node 22+ no longer accepts a bare directory like `tests/`). Name test
  files `*.test.js`

## Runs locally AND on GitHub Pages
The same files must work both ways with no changes. The app lives in the
Artifact2/ folder of the 490-Course repo (github.com/Kcmichalson/490-Course;
the local folder is named TCSS490-AI-Course). GitHub Pages serves it from
the main branch at https://kcmichalson.github.io/490-Course/Artifact2/
- Everything for this project stays inside Artifact2/. Don't read or modify
  anything outside it
- All paths are relative (`./src/main.js`), never root-absolute (`/src/main.js`),
  because the site lives under a subfolder online
- GitHub Pages is case-sensitive; my local machine may not be. File names are
  lowercase, and import paths must match their casing exactly
- No CDNs, no server-side code, no build step. Everything runs in the browser,
  and imported maps never leave the user's machine
- Never use file or folder names that start with an underscore (GitHub's
  Jekyll processing skips them; there is no `.nojekyll` file)
- Create the worker with
  `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`
- Prefix every localStorage key with `fcm:` (all my GitHub Pages sites share
  one origin)

## Project layout
- index.html, style.css
- src/main.js: app entry and wiring
- src/sim/: pure simulation functions (no DOM, no canvas, no globals)
- src/render/: map modes, overlays, legends
- src/ui/: panels, sliders, brushes, import dialogs, palette editor, inspector
- src/io/: image import, heightmap parsing, palette matching, export, save/load
- src/worker.js: runs the sim pipeline off the main thread
- tests/: Node tests for src/sim
- test-maps/: sample input maps used for verification

## Core conventions
- Two resolutions: the source map keeps its original size for display and
  export; the simulation runs on a configurable grid (512 / 1024 / 2048 wide,
  height from the map's aspect ratio). See SPEC.md "Downsampling"
- Grid layers are Float32Array(width * height), index = y * width + x
- Row 0 = the map's top-edge latitude, last row = bottom-edge latitude
  (both configurable, default 90°N / 90°S). Rows are cell-registered: the
  top EDGE of row 0 is latTop and its center is half a row below, so no cell
  center sits exactly on a pole. Column 0's left edge is `lonWest`
  (default −180°). Longitude wraps east-west when the map's "wraps" setting
  is on (allowed only when the longitude span is 360°)
- Pixel ↔ lat/lon math lives in src/sim/coords.js; use it everywhere instead
  of re-deriving it
- Every slider gets a number input beside it for exact values
- Units: elevation in meters (ocean negative), temperature in °C,
  precipitation in mm/month, tidal range in meters, distances in km
- Vectors: u > 0 = toward east, v > 0 = toward NORTH. Screen y points down,
  so flip v when drawing arrows
- Pipeline order is defined in SPEC.md "Simulation pipeline"; don't reorder
  steps without recording the decision in LOG.md
- Every sim rule gets a short comment naming the real-world effect it
  approximates. Tunable constants live in one place: src/sim/constants.js

## Workflow rules
- Work one milestone at a time, in SPEC.md order. The app must run after each
- Plan before coding each milestone; list ambiguities instead of guessing
- After each milestone: run tests, do that milestone's verification checks,
  update LOG.md (planned / changed / problems / checks), then stop and
  suggest a commit message
- Git: I commit and push myself with GitHub Desktop. Don't run git commands
  (no commits, branches, resets, or pushes) unless I ask
- When I need to check something in the browser, start the local server
  for me and tell me the URL
- Make targeted edits; don't rewrite working modules wholesale
- If the spec seems wrong or unclear, propose a change and record the
  decision in LOG.md before implementing it