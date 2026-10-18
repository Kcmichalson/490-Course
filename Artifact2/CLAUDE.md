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
- Run: `python3 -m http.server 8000`, then open http://localhost:8000
- Tests: `node --test tests/` (sim code is pure, so it runs in Node)

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
  (both configurable, default 90°N / 90°S). Longitude wraps east-west when
  the map's "wraps" setting is on
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
  update LOG.md (planned / changed / problems / checks), then commit
- Make targeted edits; don't rewrite working modules wholesale
- If the spec seems wrong or unclear, propose a change and record the
  decision in LOG.md before implementing it