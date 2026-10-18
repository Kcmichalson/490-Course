# Project Log

A running record of what I planned and what changed. Newest entries at the
bottom. Claude Code updates this at the end of every milestone.

## Milestone status

- [x] M1 — Shell and grid
- [ ] M2 — Terrain input
- [ ] M3 — Planet sliders and wind
- [ ] M4 — Temperature
- [ ] M5 — Precipitation and rain shadows
- [ ] M6 — Köppen and biomes
- [ ] M7 — Ocean currents and upwelling
- [ ] M8 — Monsoons, friction, deflection
- [ ] M9 — Tides, sea caves, and water bodies
- [ ] M10 — Sailing routes and travel time
- [ ] M11 — Polish and export
- [ ] Moonshot (optional) — Rivers, drainage basins, lakes

---

## 2026-10-18 — Session 0: Planning (before any code)

**Planned**
- Project: a climate and tide simulator for my own fantasy maps. It starts
  as open ocean; I paint land or import a map, and it models winds, ocean
  currents, temperature, rainfall, Köppen climates, and tides.
- Wrote the first feature list: terrain input modes, planet sliders, wind
  bands, currents and upwelling, temperature, rain shadows, Köppen, tides,
  Paradox-style map modes.
- Stack: browser app, plain JavaScript, Canvas 2D, Web Worker, no build step.
- Build order follows the pipeline so the app runs after every milestone.

**Changed**
- Grid size: the first plan used a fixed 360×180 grid, far too small for my
  maps (Paradox maps are 5632×2048). Now source maps keep their original
  resolution for display and export, and the simulation runs on a
  configurable 512 / 1024 / 2048-wide grid.
- Added a latitude range setting, since Paradox maps crop the poles and
  aren't 2:1.
- Heightmaps: instead of always using 0–255, the app auto-detects the sea
  level and highest values (e.g., Paradox 89–203) and lets me override them
  and set the max height in meters.
- Elevation is stored in meters instead of a −1 to 1 scale, so the lapse
  rate works directly.
- Replaced the fixed color import with a palette editor: I assign colors to
  categories (ocean, shelf, lake, land with elevation, ice, ignore). Ignore
  handles labels and arrows drawn on my maps.
- Ocean depth is generated automatically when an import has no depth data.
- Sea caves: first marked out of scope, then added back as generated point
  markers. They're placed after the tide model using cliff steepness, wave
  exposure, rock susceptibility, and tidal range, and I can place my own
  caves that ignore realistic physics for worldbuilding (SPEC 9.1).
- The app runs both locally and as a GitHub Pages site from the same files
  (relative paths, no build step, no backend).
- The tide scrubber shows a stylized intertidal band, because real tidal
  flats are smaller than a pixel at these map scales.

**Problems / open questions**
- The full spec is probably more than one evening. The milestone order keeps
  the app runnable, so the assignment is complete at any stopping point and
  the rest continues in later weeks.

**Next**
- Commit CLAUDE.md, SPEC.md, and LOG.md in GitHub Desktop, publish the repo,
  and turn on GitHub Pages.
- Start Claude Code: read all three, propose the file structure and an M1
  plan, and list any ambiguities before writing code.

---

## 2026-10-18 — Milestone 1: Shell and grid

**Planned**
- Claude Code read all three docs and proposed the M1 files, the map state
  model, pixel → lat/lon math, the zoom/pan approach, placeholder behavior,
  and a list of ambiguities. The decisions below came out of that review.
- Map state is one plain object (source size, latTop/latBottom, lonWest,
  lonSpan, wraps, simWidth) that is replaced, never mutated, so it can go to
  the worker as-is and undo/redo (M2) is a stack of snapshots.
- Pixel ↔ lat/lon as pure functions in src/sim/coords.js with Node tests.
- Zoom/pan: render each mode once into a source-resolution offscreen canvas,
  then blit it with a transform each frame (wrapped copies when wrapping).

**Changed (decisions recorded before implementing)**
- Location: the app, CLAUDE.md, SPEC.md, and LOG.md all live in Artifact2/
  of the TCSS490-AI-Course repo. Pages URL is
  https://<user>.github.io/TCSS490-AI-Course/Artifact2/. Claude Code doesn't
  read or modify anything outside Artifact2/.
- No `.nojekyll`. Instead, no file or folder name may start with an
  underscore (the only thing Jekyll would skip). Removed from M1.
- Row convention: cell-registered. The top edge of row 0 is latTop and its
  center is half a row below, so no sim cell sits on a pole (1/cos(lat) stays
  safe). The inspector reads the continuous cursor position, so the top edge
  still reads exactly latTop and the vertical center the midpoint.
- West-edge longitude (`lonWest`, default −180°) added; the spec only had a span.
- Wrap only when the span is 360°. Partial maps get a future
  "beyond the edges" setting (open ocean, default / continues like the
  edge), used from M5. Noted in SPEC §1 only.
- Small maps: sim width can't exceed the source width; if the source is
  narrower than 512 px, the sim width equals the source width.
- Graticule: togglable overlay, on by default, with small degree labels.
- Gaps added to M2: Edit > Map settings for an existing map, undo/redo,
  confirmation before New Map discards terrain, Reload map image (File System
  Access API with file-picker fallback; importing from paint.net/GIMP is the
  primary workflow, painting in-app secondary).
- Layout modeled on old desktop map editors: menu bar, toolbar, canvas,
  context bar (with a slide-up Planet panel), status bar; big tasks open as
  dialogs; every slider gets a number input; unbuilt features show
  "coming in M#" (SPEC 13.1).
- Tools: one tool dropdown (Navigate, Sculpt submenu, Cave, Route), Esc →
  Navigate, Space/middle-drag pans in every tool, optional floating tool
  palette hidden by default (SPEC 13.2).
- Map modes: EU4-style category tabs with icon grids, 29 modes in 5
  categories (Terrain, Climate, Weather, Ocean, Life), each landing with the
  milestone that produces its data. Biomes split from Köppen. Original
  inline SVG icons only (SPEC 13.3).
- Toggles: grouped Reference / Atmosphere / Ocean / Coast, all listed from
  M1 (disabled with "coming in M#" until built) (SPEC 13.4).
- Lookups: click-a-tile climate chart and real-world analog (M6), day length
  (M3), season playback (M11) (SPEC 13.5).
- Hotkeys: 1–5 pick a category, Q W E R T Y U pick the nth mode, 0 fits,
  Esc → Navigate. They never fire while typing in a text/number field or
  while a dialog is open.
- Go to lat/lon and Bookmarks built in M1. Bookmarks are global in
  localStorage (`fcm:bookmarks`) until project save stores them (M11).
- New sections: Water bodies (SPEC 10, built in M9) and Sailing routes and
  travel time (SPEC 11, new M10). Old sections 10–15 renumbered to 12–17.
- Milestones renumbered: M10 is now sailing routes; polish and export moved
  to M11 (plus season playback). Moonshot (optional, after M9): rivers,
  drainage basins, lakes.
- Left out on purpose:
  - Habitability: a worldbuilding component, not a climate one.
  - Model confidence: every model should be taken with a grain of salt by
    default, and its accuracy can't be measured meaningfully.
  - Compare-settings view: making a change and using undo/redo is enough.
- After M1 verification: added the M9 water-body check (Mediterranean,
  Black Sea, Baltic, Red Sea, Persian Gulf, Hudson Bay separate; Caspian a
  lake; labels in open water) and the Cave-Prone Rock brush (M9) to the
  Sculpt submenu (SPEC 13.2 and the tool registry).

**Built**
- Desktop-editor shell: menu bar, toolbar (tool dropdown, view label,
  5 category tabs + mode icon grid, season/play placeholders, zoom %,
  Go to lat/lon, Bookmarks), map canvas with the Overlays dropdown and
  legend, context bar with the slide-up Planet panel, status bar.
- Pure modules with Node tests: src/sim/mapconfig.js, src/sim/coords.js,
  src/render/viewport.js, plus the mode/overlay/tool registries and the
  hotkey guard (31 tests).
- Rendering: each mode draws once into a source-size offscreen canvas; frames
  only blit it (one blit per wrapped copy, edges rounded in device pixels to
  avoid seams) and draw overlays in screen space. Graticule spacing tightens
  as you zoom (30° → 1°).
- Worker stub (ping/pong) created with `new URL('./worker.js', import.meta.url)`.
- Tooling: package.json with only `"type": "module"`; .claude/launch.json
  for the dev server.

**Problems**
- Node.js wasn't installed at first; the user installed Node 24 LTS mid-session.
- `node --test tests/` fails on Node 22+ (a bare directory is treated as a
  module path). CLAUDE.md now says `node --test "tests/*.test.js"`.
- `python3` on this machine is the Microsoft Store stub. CLAUDE.md now uses
  `py -m http.server 8000 --bind 127.0.0.1` (bound to localhost so the dev
  server isn't reachable from other machines).
- Windows MIME check: the server sends `.js` as `application/javascript`,
  which browsers accept for modules, so no custom server script was needed.
- Load-order bug: MapView reports its first size from its constructor,
  before `drawPending` was declared (temporal dead zone). Fixed by declaring
  render-loop state first.
- Canvas-size rounding bug: hovering the exact top edge read 89.99°N instead
  of 90.00°N, and the exact center read 0.01°S instead of 0.00°.
  MapView.measure rounded the canvas's CSS width/height to whole pixels,
  but pointer positions are measured against the unrounded rectangle, so
  the map was placed a fraction of a pixel away from where the pointer math
  expected it. Fix: MapView keeps the exact fractional size (only the
  backing-store pixel count is rounded). After the fix the top edge read
  90.00°N and the center 0.00°.
- Edge float error: the exact bottom edge then read "Off map" because
  screen → source math landed a hair past H. pixelToLatLon now tolerates
  1e-6 source px at the edges and clamps; a Node test covers it.
- Cached modules: after fixing the load-order bug, the browser kept running
  the old main.js. Reloading, and even Ctrl+Shift+R in the in-app browser,
  didn't help; the console still showed the old line numbers. Python's
  http.server sends no Cache-Control header, so the browser cached the
  modules heuristically. Workaround during testing: re-fetch each source
  file with `fetch(url, { cache: 'reload' })` to refresh the cache, then
  reload. Tip for development: with DevTools open, tick "Disable cache".
- Hidden-pane pause during testing: while the browser pane was hidden (or
  the Claude window was covered), requestAnimationFrame stopped firing.
  Hover readouts and redraws never ran, probes timed out or read "—", and
  screenshots showed stale frames (e.g. a 5.8% zoom left over from a
  measurement taken while hidden). For one probe a timer-based stand-in for
  requestAnimationFrame was injected into the page from the test console.
  It didn't help, because work queued on the paused native frames stayed
  stuck. It only existed in that page session and was gone after the next
  reload; the app's code only uses the browser's own requestAnimationFrame.
  What worked: showing the pane, bringing the tab to the front, reloading,
  and polling the status bar until it changed instead of waiting a fixed
  time. Frame-timing numbers from these runs are approximate for the same
  reason.
- The in-app browser preview only reads .claude/launch.json from the repo
  root, which is outside Artifact2/, so Claude Code ran the same server
  command directly. Artifact2/.claude/launch.json stays as the record of
  the command.

**Verification checks** (local, http://127.0.0.1:8000)
- PASS `node --test "tests/*.test.js"`: 31/31.
- PASS Inspector/status bar: top edge reads latTop (90.00°N; 80.00°N on an
  80°/−60° map), exact vertical center reads the midpoint (0.00°; 10.00°N),
  bottom edge reads latBottom.
- PASS Wrap: past the right edge, longitudes continue from the left edge
  (170°W, 179.75°W). Non-wrapping 60° map: "Off map" beyond both edges,
  exact edges read 20°W / 40°E.
- PASS No console errors on load; worker ping → pong ("Worker: ready").
- PASS All 29 mode buttons select (via clicks and hotkeys 1–5 + Q–U); the
  legend says "Arrives in M#"; disabled menu items and tools show M# badges.
- PASS Overlay dropdown lists all 16 toggles in Reference / Atmosphere /
  Ocean / Coast with milestones; only Graticule is enabled and toggles.
- PASS Hotkeys stay silent while typing "45N 30W" in Go to lat/lon, while
  typing in a New Map number field, and while a dialog is open.
- PASS Go to lat/lon centers and selects the tile; garbage and off-map
  input give a message in the context bar.
- PASS Bookmarks save to `fcm:bookmarks` and restore position and zoom.
- PASS 300 px wide map → sim width locked to 300; 800 px → only 512.
- PASS Esc returns to Navigate and closes menus and the Planet panel.
- PASS Smoothness on 5632×2048: wheel zoom frames had a median of 7 ms and
  p95 of 9 ms with no long tasks; a full-map blit costs ~0.16 ms. Drag-pan
  moved the view by the expected amount. (Measured while the browser pane
  was partly hidden; worth a quick look by eye.)
- PASS No file or folder name in Artifact2/ starts with an underscore.
- NOT YET The GitHub Pages check needs a push first.

**Next**
- Commit and push, enable Pages for the repo, and open
  https://<user>.github.io/TCSS490-AI-Course/Artifact2/ to confirm the app
  loads with no console errors and the worker reports ready.
- Then plan M2 (terrain input).

---

## Entry template

## YYYY-MM-DD — Milestone N: Name

**Planned**
**Changed**
**Problems**
**Verification checks** (which SPEC.md checks passed or failed)
**Next**