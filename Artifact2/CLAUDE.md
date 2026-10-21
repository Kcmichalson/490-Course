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
- Run locally: `py serve.py` (from Artifact2/), then open
  http://127.0.0.1:8000. serve.py (standard library only) binds to
  127.0.0.1 so the dev server is reachable only from this computer, sends
  `Cache-Control: no-store` so the browser never runs stale code, and serves
  `.js` as `text/javascript`. On this Windows machine `python3` is the
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
- All UI colors are CSS variables in one place: the `:root` block at the top
  of style.css. Canvas code reads them through src/render/theme.js. No
  hard-coded UI colors elsewhere. (Map-mode data palettes, such as Köppen
  colors, live with their mode renderers.)
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
- Scope: build only what the milestone lists. Suggest extras in the plan
  instead of adding them
- Plan before coding each milestone; list ambiguities instead of guessing
- Never infer names, URLs, dates, or facts about me or the course (repo
  names, links, deadlines, what I did or think); ask
- After each milestone: run tests, do that milestone's verification checks,
  update LOG.md (planned / changed / problems / checks), then stop and
  suggest a commit message
- Every milestone's verification includes a visual pass at a ~1280 px wide
  window: nothing clipped, nothing covering labels or controls
- For visual checks, give me a short checklist to verify by eye in my own
  browser instead of probing the preview
- If I ask you to use the browser preview and it stalls (hidden pane, frames
  not running, stale code), stop and ask me to bring the pane forward or
  reload before trying workarounds
- Keep a prompt log in LOG.md for every session (format: "Session 1 prompt
  log"). For each of my prompts, including answers to multiple-choice
  questions and messages sent mid-task: quote it (condense long pastes into
  [brackets]), say what you provided, note honestly where you misread me and
  any root causes found, and add a "How It Was Verified" line for every fix.
  Update it before ending a turn that changed files
- Git: I commit and push myself with GitHub Desktop. Don't run git commands
  (no commits, branches, resets, or pushes) unless I ask
- When I need to check something in the browser, start the local server
  for me and tell me the URL
- Make targeted edits; don't rewrite working modules wholesale
- If the spec seems wrong or unclear, propose a change and record the
  decision in LOG.md before implementing it
- Every tool call is logged automatically to tool-log/ by a hook; don't
  edit or disable it.
- After every sub-step, confirm each tool call you made appears in
  tool-log/ (timestamp and tool name); report any missing call before
  continuing.