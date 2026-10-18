# Project Log

A running record of what I planned and what changed. Newest entries at the
bottom. Claude Code updates this at the end of every milestone.

## Milestone status

- [x] M1 — Shell and grid
- [x] M2a — Terrain imports
- [ ] M2b — Painting and editing
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
  of the 490-Course repo (github.com/Kcmichalson/490-Course). Pages URL is
  https://kcmichalson.github.io/490-Course/Artifact2/. Claude Code doesn't
  read or modify anything outside Artifact2/ unless asked.
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
- Repo name correction: the GitHub repo is Kcmichalson/490-Course (the local
  folder is TCSS490-AI-Course), so the Pages URL is
  https://kcmichalson.github.io/490-Course/Artifact2/. Fixed in CLAUDE.md
  and this log.
- Portfolio hub (repo-root index.html, changed at the user's request): the
  Artifact 2 card is now "Fantasy Climate Mapper" with a new description and
  the user's reflection. Its Inspect modal shows "Open App →" (Pages URL) and
  "Open Repository →" (the Artifact2 folder on GitHub). The record format
  gained an optional `appLink`; Artifacts 1 and 3–5 are unchanged.

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
- PASS GitHub Pages: https://kcmichalson.github.io/490-Course/Artifact2/
  loads with no console errors and the status bar shows "Worker: ready"
  (checked by the user after pushing).

**Next**
- Plan M2 (terrain input).

---

## 2026-10-18 — Session 1 prompt log (M1 and portfolio hub update)

**AI Assistant:** Claude Code (Claude Opus 5.5) in the Claude desktop app  
**Repository:** https://github.com/Kcmichalson/490-Course (folder `Artifact2/`)  
**Live Site:** https://kcmichalson.github.io/490-Course/Artifact2/

Every prompt I sent this session, in order. Long pastes are condensed into
[brackets]. Answers I gave through Claude's multiple-choice questions count
as prompts. Each fix lists how it was verified.

### Prompt 1
* **User Prompt:**  
  > *"Read CLAUDE.md, SPEC.md, and LOG.md. We're doing milestone M1 only. Don't write code yet. Propose: 1. The files you'll create for M1 (stubs only where later milestones need them) 2. The state model for a map: source size, latitude range, longitude span, wrap, and sim resolution 3. How pixel → lat/lon is computed, as a pure function in src/sim/ with Node tests 4. How zoom and pan will stay smooth on a 5632×2048 map 5. What the map mode buttons do before their modes exist 6. Any ambiguities in M1"*
* **What the AI Provided:**  
  Read the three docs (test-maps/ turned out to be empty) and wrote a plan: the M1 file list, a frozen map-config object, cell-registered pixel → lat/lon formulas with planned tests, draw-once/blit-per-frame zoom and pan, placeholder mode buttons, and 10 ambiguities. Then asked four multiple-choice questions.
* **Where the Model Misread Me:**  
  - It took the repo name from my local folder (`TCSS490-AI-Course`). The GitHub repo is `490-Course`, so the Pages URL in the docs was wrong (not caught until Prompt 11).
  - It proposed putting `.nojekyll` at the repo root.
  - The proposal did flag editing an existing map's settings (open item 7) and sim widths larger than the source (item 5). It missed that maps narrower than 512 px would have no valid sim width at all, undo/redo, and the Windows server MIME issue (I raised these in Prompt 3).

### Prompt 2
* **User Prompt (answers to Claude's questions):**  
  > *Location: "Put the app, CLAUDE.md, SPEC.md, and LOG.md all in Artifact2/. Don't add .nojekyll anywhere; instead, never use file or folder names starting with an underscore. Don't read or modify anything outside Artifact2/. Update CLAUDE.md's Pages URL line and replace the .nojekyll rule with the underscore rule, remove .nojekyll from M1 in SPEC.md, and record this decision in LOG.md."*  
  > *Row 0: "Row 0's top edge."* · *Wrap: "Only at 360°. For partial maps, add a later setting for what lies beyond the edges: open ocean (default) or 'continues like the edge.' It's used from M5 onward; just note it in SPEC.md for now."* · *Graticule: "Yes, as a togglable overlay checkbox (on by default) with small degree labels."*
* **What the AI Provided:**  
  Updated the plan with these decisions.

### Prompt 3
* **User Prompt (feedback on the plan):**  
  > *[Gaps: maps under 512 px have no valid sim size, so the sim width should equal the source width; add Edit > Map settings to M2 in SPEC.md; add undo/redo and a New Map confirmation to M2; watch for Python's server sending JavaScript as text/plain on Windows.] [Three new map modes with placeholder buttons: Biomes (M6), Sea Surface Temperature (M7), Wind Speed and Pressure (M3).] [Layout update: menu bar, toolbar, map canvas, context bar with a slide-up Planet panel, status bar, dialogs for big tasks, "coming in M#" placeholders.] [Tools update: one tool dropdown (Navigate, Sculpt submenu, Cave, Route), optional floating tool palette, Reload map image in M2, startup hint.]*
* **What the AI Provided:**  
  Asked how the modes should group into the 5 category buttons and what the Route tool should do.
* **Where the Model Misread Me:**  
  Of the gaps above, the under-512 px case, undo/redo, and the Windows MIME issue were missing from its first plan. Map settings was already an open item there; my point was that SPEC.md didn't list it yet, so it could be forgotten.

### Prompt 4
* **User Prompt (answers to Claude's questions):**  
  > *[Five categories with 29 modes: Terrain, Climate, Weather, Ocean, Life.] [Spec update: EU4-style mode bar with original SVG icons; toggles in 4 groups; click-a-tile climate chart, real-world climate analog, day length, season playback; new Water Bodies section (M9); new Sailing Routes and Travel Time section (new M10) with ship presets, speed formula, pathfinding, and checks; renumbered milestones (polish moves to M11); Moonshot; Not planned list. "Record all of this in LOG.md, including what I left out and why."]*
* **What the AI Provided:**  
  Rewrote the plan (rev 2) and listed open items: the reasons for the left-out features, a hotkey scheme, toggles in M1, Go to lat/lon and Bookmarks, startup, square-pixel hint, the test command, and what the Route tool means. Its category question offered two groupings for the 9 modes known at that point; I supplied the full 29-mode list in this answer.
* **Where the Model Misread Me:**  
  It read "for M1 itself, only the mode bar changes" as "the overlay dropdown shows only Graticule in M1". I wanted every toggle listed (Prompt 5).

### Prompt 5
* **User Prompt (plan feedback):**  
  > *"Approved. Open items: A. Habitability: Not under the current perview of this project, that's a worldbuilding component, not a climate one. Model confidence: All models should be taken with a grain of salt by default and I do not think I could accurately acertain how accurate or ianccurate the model is. Compare settings: Should just be fine to make a change and ctrl z ctrl v. B. Default hotkeys are fine. Hotkeys must not fire while focus is in a text or number field, or while a dialog is open. C. List every toggle in the overlay dropdown, disabled with "coming in M#". D. Build Bookmarks and go to lan/lon in M1. E, F, G, H: defaults are fine. Apply the doc updates, then implement M1."*
* **What the AI Provided:**  
  Recorded the resolutions in the plan.
* **Where the Model Misread Me:**  
  It added a "Resolved" list but left the old "only Graticule" wording in the file table and section 5 of the plan.

### Prompt 6
* **User Prompt (plan feedback):**  
  > *"Nearly Approved. Two fixes: the file table and §5 still say the overlay dropdown has only Graticule. Follow resolved item C instead (all toggles listed, disabled with "coming in M#"). Add to verification: typing "45N 30W" in Go to lat/lon or a value in a number field doesn't trigger hotkeys to switch modes, and the overlay dropdown lists every toggle with its milestone. Then apply the doc updates and implement M1."*
* **What the AI Provided:**  
  - Fixed both plan sections and added the two verification checks.
  - Applied the doc updates: CLAUDE.md (Pages URL, underscore rule, conventions), SPEC.md (sections 1, 2, and 13; new sections 10 and 11; renumbering; milestones; Moonshot and Not planned), and this log (M1 decisions entry, milestone list).
  - Started implementing M1: the pure modules (map config, coords, viewport, registries, hotkey guard) with Node tests, the renderer, the HTML/CSS shell, and the UI modules.
* **Where the Model Misread Me:**  
  While updating SPEC.md it wrote an M9 water-bodies check I hadn't asked for. It removed the check itself and told me; I supplied my own in Prompt 7.
* **Root Cause Discovered:**  
  Node.js wasn't installed, and `python3` on this machine is the Microsoft Store stub (`py` works).

### Prompt 7 (sent while Claude was working)
* **User Prompt:**  
  > *"After M1 is verified: add to M9 checks "Earth: the Mediterranean, Black Sea, Baltic, Red Sea, Persian Gulf, and Hudson Bay come out as separate bodies; the Caspian is a lake; each label sits in open water." Also add the Cave-Prone Rock brush to the Sculpt submenu in §13.2 (arrives in M9)."*
* **What the AI Provided:**  
  Waited until the M1 checks passed, then added the check to M9, the brush to SPEC 13.2 and the M9 milestone text, and the brush to the tool registry so the Sculpt submenu shows it.
* **How It Was Verified:**  
  A search of SPEC.md found the brush in sections 9.1 and 13.2 and in M9; Node tests still passed 31/31.

### Prompt 8 (sent while Claude was working)
* **User Prompt:**  
  > *"I've now installed Node.js LTS (default location); your check ran before the install. Re-check. If this session still can't see node (PATH updates only after a restart), run it by full path for now: "C:\Program Files\nodejs\node.exe" --test"*
* **What the AI Provided:**  
  Found Node v24.22.0 at the full path and ran the tests.
* **Root Cause Discovered:**  
  - `node --test tests/` fails on Node 22+, which treats a bare directory as a module path. Changed the command to `node --test "tests/*.test.js"` and updated CLAUDE.md.
  - One new viewport test had the wrong expectation: at offset −300 px, the first map copy ends at x = 700, so two copies are needed to fill an 800 px view. The test was wrong, not the code.
* **How It Was Verified:**  
  The test run went from an error to 18/18 passing, then 31/31 after the viewport and registry tests were added and the expectation fixed.

### Prompt 9 (sent while Claude was working)
* **User Prompt:**  
  > *"Add "--bind", "127.0.0.1" to the server's runtimeArgs in .claude/launch.json (and to CLAUDE.md's run command), so the dev server is only reachable from this computer."*
* **What the AI Provided:**  
  - Added `--bind 127.0.0.1` to `.claude/launch.json` and to the CLAUDE.md run command (`py -m http.server 8000 --bind 127.0.0.1`).
  - The in-app browser only reads `launch.json` from the repo root (outside Artifact2/), so it ran the same command directly.
  - Then ran the M1 browser verification.
* **Root Causes Discovered (while testing M1):**  
  - **Load-order crash:** `MapView` reports its first size from its constructor, before `drawPending` was declared (temporal dead zone), so the page stayed blank. Fixed by declaring render-loop state first.
  - **Cached modules:** the browser kept running the old `main.js` after the fix, even after Ctrl+Shift+R; the console showed the old line numbers. Worked around by re-fetching each file with `cache: 'reload'`, then reloading.
  - **Rounding bug:** the exact top edge read 89.99°N and the center 0.01°S, because `MapView` rounded the canvas size while pointer positions used the exact size. Fixed by keeping the exact size.
  - **Edge float error:** the exact bottom edge then read "Off map". `pixelToLatLon` now tolerates 1e-6 px at the edges.
  - **Hidden pane:** frames stopped while the browser pane was hidden or the window was covered, so probes timed out and screenshots went stale. Fixed by showing the pane, fronting the tab, reloading, and polling the status bar.
  - **Synthetic drag:** a test drag never panned because `setPointerCapture` threw for a fake pointer id. Guarded with try/catch.
* **How It Was Verified:**  
  - **MIME check:** a HEAD request showed `.js` served as `application/javascript`, so no custom server was needed.
  - **Load-order fix:** after the cache refresh the page built its toolbar, the status bar said "Worker: ready", and a reload added no new console errors.
  - **Rounding fix:** a probe at the exact top edge read 90.00°N and the center 0.00° (it had read 89.99°N and 0.01°S).
  - **Edge fix:** a new Node test, and the bottom edge of an 80°/−60° map read 60.00°S.
  - **Drag guard:** a 300 px drag at 76% moved the center from 148.23°W to 122.96°W, the expected ~25.3°.
  - **Remaining M1 checks:** run in the browser and listed under "Verification checks" in the M1 entry above.

### Prompt 10
* **User Prompt:**  
  > *"In the LOG.md M1 entry, include under Problems: the cached-modules issue, the canvas-size rounding bug (89.99° vs 90.00°) and its fix, and the hidden-pane pause during testing. Also confirm the timer-based stand-in was only injected into the page for probing and isn't in the app's code."*
* **What the AI Provided:**  
  Expanded the Problems section with all three, and confirmed the stand-in only existed in the test page session.
* **How It Was Verified:**  
  Searching Artifact2/ found no reassignment of `requestAnimationFrame` and none of the probe helpers; the app only calls the browser's own `requestAnimationFrame` (`src/main.js`, two calls).

### Prompt 11
* **User Prompt:**  
  > *"Now, please update the root index.html to update my artifact 2 card with this. It should share the same format as how the artifact 1 card works"*
* **What the AI Provided:**  
  Read the hub page's card markup, `ARTIFACT_DATA`, and Inspect modal, then asked three questions.
* **Root Cause Discovered:**  
  The hub links to `github.com/Kcmichalson/490-Course`, which exposed the repo-name misread from Prompt 1.

### Prompt 12
* **User Prompt (answers to Claude's questions):**  
  > *Repo: "Yes, the github url is https://github.com/Kcmichalson/490-Course"* · *Card link: "Live app"* · *Title: "Fantasy Climate Mapper"*
* **What the AI Provided:**  
  A plan to rename the card, rewrite its text, and point the modal's link at the live app.
* **Change of Plan (mine):**  
  It followed my "Live app" answer and planned to point the modal's link at the app. In Prompt 13 I changed my mind and asked for both links, since the assignment needs the repository link.

### Prompt 13
* **User Prompt (plan feedback):**  
  > *"Approved with changes: Artifact 2's modal shows two links: "Open App →" to https://kcmichalson.github.io/490-Course/Artifact2/ and "Open Repository →" to https://github.com/Kcmichalson/490-Course/tree/main/Artifact2 (the assignment asks for the repo link). Add an optional second link to the record format; Artifacts 1 and 3–5 behave exactly as before. Use this reflection instead of your draft: [paste your edited version] Then implement and run your verification."*
* **What the AI Provided:**  
  Updated the plan with an optional `appLink` field. It noticed the reflection was still the literal placeholder and asked for the text instead of guessing.

### Prompt 14
* **User Prompt (answer to Claude's question):**  
  > *"I'll paste it (Other)"* (chosen without any text)
* **What the AI Provided:**  
  Asked again, explaining to paste the text into the "Other" box.

### Prompt 15
* **User Prompt (answer to Claude's question):**  
  > *[My reflection for the Artifact 2 card, now on the hub page.]*
* **What the AI Provided:**  
  - Used the reflection word for word, joining the paste's wrapped lines (the modal shows line breaks as typed).
  - Updated the hub page: card title and description, `ARTIFACT_DATA[2]`, a second modal button ("Open App →"), and the optional `appLink` field.
  - Fixed the Pages URL in CLAUDE.md and this log.
* **How It Was Verified:**  
  - Served the repo root on port 8001. The Artifact 2 card and its water reflection show the new title.
  - Inspect on Artifact 2 shows both buttons with the right URLs; Artifact 1 shows only "Open Repository"; Artifacts 3–5 show none. Reopening Artifact 1 after Artifact 2 hides the app button again.
  - A screenshot of the modal showed the text and both buttons. No console errors.
  - A search of Artifact2/ found no URL using the old repo name.

### Prompt 16
* **User Prompt:**  
  > *"Also to confirm, teach said this on my index, artifact one. Does this achieve this? [Instructor's comment: keep logging where the model misread me after each prompt, and add a line on how I verified each fix.]"*
* **What the AI Provided:**  
  Said the log only partly did this: most fixes said how they were verified, but there was no prompt-by-prompt record and no notes on where the model misread me. It listed the misreads from this session.

### Prompt 17
* **User Prompt:**  
  > *"Yes, you can look at what I did for the original log.md in the root repository, but please keep all prompts in this session in the artifact 2 folder log.md"*
* **What the AI Provided:**  
  Read the root LOG.md for its format and wrote this prompt log in Artifact2/LOG.md, adding a "How It Was Verified" line for each fix. Added a workflow rule to CLAUDE.md so every session keeps this log.

### Prompt 18
* **User Prompt:**  
  > *[Final LOG.md updates: the live site works (loads with no console errors, "Worker: ready"), so mark the Pages check PASS and change Next to "Plan M2 (terrain input)". Accuracy fixes: Prompt 1's proposal did flag map settings (item 7) and sim width larger than the source (item 5), and only missed the under-512 px case, undo/redo, and the Windows MIME issue, so update Prompt 3's note to match; Prompt 4 wasn't a misread because I hadn't sent the 29-mode list yet; Prompt 12 followed my "Live app" answer and I changed my mind in Prompt 13.]*
* **What the AI Provided:**  
  Marked the Pages check PASS, set Next to "Plan M2 (terrain input)", and corrected the Prompt 1, 3, 4, and 12 notes.
* **Where the Model Misread Me:**  
  Its first draft of this log overstated three misreads (Prompts 1, 4, and 12); this prompt corrected them.
* **How It Was Verified:**  
  Re-read the edited sections; searched LOG.md to confirm the M1 checks have no "not yet" item left, the 29-mode list appears only as something I supplied, and Prompt 12 no longer lists a misread.

### Prompt 19
* **User Prompt:**  
  > *[Between-sprint retro. Update CLAUDE.md workflow rules and record this in LOG.md: build only what the milestone lists and suggest extras in the plan; never infer names, URLs, dates, or facts about me or the course, ask; if the browser preview stalls, stop and ask me to bring the pane forward or reload before trying workarounds; add serve.py (standard library only) serving Artifact2 on 127.0.0.1:8000 with "Cache-Control: no-store" and update the run command and .claude/launch.json; every milestone's verification includes a visual pass at a ~1280 px wide window; fix now: the legend covers the latitude labels, and the toolbar should wrap or scroll on narrow windows; move all UI colors into CSS variables in one place, and add "Themes: dark (default), light, parchment" to M11.]*
* **What the AI Provided:**  
  Everything in the "Retro between M1 and M2" entry below: the CLAUDE.md rules, serve.py, the color variables, the layout fixes, and the M11 themes line.
* **Root Cause Discovered:**  
  The toolbar already wrapped, but the page grid's single column was sized to its widest content (about 667 px), so at narrow widths the whole layout ran past the window edge and got clipped. Also found and fixed a selection-outline offset on wrapped copies while moving its colors.
* **How It Was Verified:**  
  See the retro entry's checks. The canvas part of the visual pass is still pending: browser frames stalled, so per the new rule Claude stopped and asked me to bring the pane forward.

### Prompt 20 (sent while Claude was working)
* **User Prompt:**  
  > *[Plan M2 as two halves, no code yet. M2a (imports first; my main workflow): grayscale heightmap import (auto sea level and max values, max height in meters, curve, smoothing, optional land/sea mask), silhouette import with the auto-relief toggle, generated bathymetry, downsampling to the sim grid, Edit > Map settings, Reload map image, and the Original Art, Physical, and Elevation modes. M2b: palette editor, sculpt brushes, undo/redo, New Map confirmation, Slope & Ruggedness and Distance from Coast modes, Shaded Relief toggle. Propose files, data layers, the import dialog flow, how full-resolution elevation and the sim grid stay in sync, and tests. List ambiguities.]*
* **What the AI Provided:**  
  Finished the retro first, then proposed the M2a/M2b plan in chat with ambiguities. No M2 code; SPEC.md's milestone list gets the M2a/M2b split once I approve the plan.

### Prompt 21
* **User Prompt:**  
  > *[Approved the M2 plan with answers: I'll add test maps, with a git-ignored test-maps/private/ for my Paradox heightmap; defer 16-bit PNGs and note it in SPEC.md; offer to downscale images over 8192×4096 with a notice; the mask wins; restore the mask coastline after smoothing; decide brush edits vs. Reload/Map settings in M2b planning (leaning toward a separate edits layer); reload proposal yes; Shift+R yes; optional separate art image for Original Art in M2b; no cross-restart import cache (M11 covers it); planet radius regeneration yes; enclosed water counts as ocean for now. Put "is this land?" in one function so M2b's category layer can take over and allow land below sea level. Record the M2a/M2b split, then start M2a once the test maps are in.] [Usage note: near the maximum, so only minor changes for now.] Test maps are in: test-maps/gebco_bathy_heightmap.jpg (equirectangular, includes ocean depth, JPEG so expect speckle; sea level set manually), test-maps/gebco_bathy_BW_heightmap.png (white land on black, thresholded from the GEBCO image so they line up), and test-maps/private/eu4_heightmap.bmp (git-ignored, game content). "Confirm the ignore rule exists before I commit. Add a short test-maps note crediting GEBCO as the source."*
* **What the AI Provided:**  
  - Found that **no ignore rule existed yet** (no .gitignore anywhere), so the Paradox file would have been committed. Added `Artifact2/.gitignore` with `test-maps/private/`.
  - Added test-maps/README.md crediting GEBCO, with a placeholder for the exact dataset/version and link. It doesn't guess either.
  - SPEC.md: the M2a/M2b split in the milestones, 16-bit PNGs deferred, downscale offer over 8192×4096, mask wins, coastline restored after smoothing, Shift+R and reload rules, one "is this land?" function, the separate art image in M2b, and an updated test-maps line. This log's milestone list now shows M2a and M2b.
  - Did not start M2a code, because of the usage note.
* **Where the Model Misread Me:**  
  None this prompt. (The SPEC test-maps line had said the Earth heightmap was "public domain"; it now points to the README credit instead of asserting a license.)
* **How It Was Verified:**  
  `git check-ignore -v` matched `test-maps/private/eu4_heightmap.bmp` to `Artifact2/.gitignore:2`; `git status --ignored` lists `test-maps/private/` as ignored, and the file was never tracked. (Read-only git checks, run because I asked for confirmation.)

### Prompt 22
* **User Prompt:**  
  > *"The browser pane is in front now. Run the 1280 px canvas visual pass and mark it in LOG.md."* (after asking what to finish with the last 10% of usage before M2a)
* **What the AI Provided:**  
  Ran the 1280 px pass. Frames were stalled at first; selecting the tab and showing the browser pane (the plan pane had been in front) got them running. It sampled canvas pixels for colors and for label pixels under the legend and the Overlays button. Frames stalled again before the zoomed-in and wrapped-selection checks, so it stopped and recorded a partial PASS plus two pending checks in the retro entry.
* **How It Was Verified:**  
  Canvas pixel reads (getImageData): background (16, 19, 24) and ocean (29, 75, 117) match the CSS variables exactly; left-edge label pixels reach brightness 219; the area under the legend peaks at 74 (no labels).

### Prompt 23
* **User Prompt:**  
  > *"I checked both by eye in my own browser: labels are skipped under the Overlays button (10°E at 182% zoom), and the selection outline lines up on every wrapped copy (squares exactly one map-width apart at the same position). Mark both PASS in LOG.md, noted as checked by me."*
* **What the AI Provided:**  
  Marked both checks PASS in the retro entry, noted as checked by me, and set Next to "Start M2a".
* **How It Was Verified:**  
  By me, by eye, in my own browser (as described above).

### Prompt 24
* **User Prompt:**  
  > *"This will be the end of the first session until we start again later today. Please note that down, and write down anything else of note."*
* **What the AI Provided:**  
  Added the "End of Session 1" entry below, covering status, a start-of-session checklist, and open items.

---

## 2026-10-18 — Retro between M1 and M2

**Planned** (my retro decisions)
- Scope: build only what the milestone lists; suggest extras in the plan.
- Never infer names, URLs, dates, or facts about me or the course; ask.
  (This session's examples: the repo name taken from my folder name, and
  extras like an unrequested M9 check.)
- If the browser preview stalls (hidden pane, stale cache), stop and ask me
  to bring the pane forward or reload before trying workarounds.
- A no-cache dev server, so the browser never runs stale code.
- Every milestone's verification includes a visual pass at ~1280 px wide.
- Fix the legend covering the latitude labels and the toolbar on narrow
  windows.
- All UI colors in CSS variables in one place; themes later (M11).

**Changed**
- CLAUDE.md workflow rules: scope, never infer, the 1280 px visual pass, and
  stopping on a stalled preview. Core conventions: UI colors live only in
  `:root` in style.css, and canvas code reads them through
  src/render/theme.js.
- serve.py (standard library only) serves Artifact2/ on 127.0.0.1:8000 with
  `Cache-Control: no-store` and sends `.js` as `text/javascript`. The run
  command is now `py serve.py` (CLAUDE.md, SPEC §15, .claude/launch.json).
- UI colors: 29 color variables at the top of style.css (surfaces, text,
  accents and states, shadows, map area). No hex or rgba values remain
  anywhere else in style.css or src/. The only exception is the favicon's
  inline data URI in index.html, which can't use CSS variables.
- Legend moved to the bottom-right. Graticule labels now skip any spot
  covered by an on-map control (the Overlays button and the legend), so the
  top-right longitude labels no longer sit under the Overlays button.
- Narrow windows: the page grid column is now `minmax(0, 1fr)`, so the
  toolbar wraps within the window. The status bar wraps too, and the
  context bar's tool hint truncates instead of pushing the Planet button
  off-screen.
- Fixed while moving colors: the selection outline was offset on the second
  and later wrapped copies, because its width and height were changed
  inside the drawing loop.
- SPEC M11: "Themes: dark (default), light, parchment".

**Problems**
- Narrow-window clipping wasn't the toolbar's wrapping, which already
  worked. The page grid's single column was sized to its content (about
  667 px), so at 480 px everything to the right was cut off.
- The browser preview stalled again (frames not running), so the canvas
  half of the visual pass is waiting on me to bring the pane forward.

**Verification checks**
- PASS serve.py: HEAD requests return `Cache-Control: no-store`, `.js` as
  `text/javascript`, `.css` as `text/css`. Nothing is served on the LAN
  address.
- PASS Colors: a search of src/ for hex/rgba colors finds nothing; in
  style.css they appear only inside `:root`.
- PASS Node tests 31/31.
- PASS Layout (DOM measurements) at 1280, 736, 480, and 360 px wide:
  nothing in the menu bar, toolbar, context bar, or status bar extends past
  the window. The toolbar wraps to 2 / 2 / 3 / 5 rows.
- PASS At 1280 px the legend sits bottom-right (x 972–1272 of 1280), clear
  of the left-edge latitude labels.
- PASS (partial) Canvas visual pass at 1280 px, by sampling canvas pixels
  on the 5632×2048 map at 22%: the background outside the map is exactly
  `--map-bg` (16, 19, 24), and open ocean is exactly `--placeholder-ocean`
  (29, 75, 117), so colors are unchanged after the move to variables.
  Latitude labels are drawn at the left edge (brightness 219), and nothing
  under the legend is brighter than ocean plus grid lines (74), so the
  legend covers no labels.
- PASS Longitude labels are skipped under the Overlays button (checked by
  me by eye in my own browser: the 10°E label at 182% zoom).
- PASS The selection outline lines up on every wrapped copy (checked by me
  by eye: the squares sit exactly one map-width apart at the same position).
  Claude's automated attempt at these two had stalled in the browser pane.

**Next**
- Start M2a (plan approved; test maps are in).

---

## 2026-10-18 — End of Session 1

Session 1 ends here (paused near the usage limit); Session 2 starts later
today with M2a.

**Where things stand**
- M1 is done and verified, including the live site at
  https://kcmichalson.github.io/490-Course/Artifact2/. The retro changes are
  in, and the M2 plan is approved and split into M2a/M2b in SPEC.md.
- Uncommitted at the end of the session: the retro (serve.py, color
  variables, layout fixes, workflow rules), the M2a/M2b split, .gitignore,
  test-maps/README.md, and these log entries. I commit and push myself.
- Test maps are in test-maps/ (GEBCO heightmap and silhouette), plus the
  git-ignored test-maps/private/eu4_heightmap.bmp. The reference map (a
  third-party hand-drawn map) wasn't added yet at this point; it later went
  into test-maps/private/reference_map.png (git-ignored). The M2b palette
  check and the M3/M5 checks use it.

**Start of Session 2 checklist**
- Read CLAUDE.md, SPEC.md, and this log. Start a "Session 2 prompt log".
- Start the server with `py serve.py` and open http://127.0.0.1:8000. The
  Session 1 server stops when the session ends.
- Run the tests with `node --test "tests/*.test.js"` (31 should pass). If
  `node` still isn't on PATH, use `"C:\Program Files\nodejs\node.exe"`.
- Keep the browser pane in front during browser checks. Frames stall when
  it's hidden or the Claude window is covered; if that happens, stop and ask.

**First steps for M2a**
- Milestone badges: the mode/tool/overlay registries and comingsoon.js use
  whole-number milestones, so M2b items show "coming in M2". Switch to
  M2a/M2b labels (and keep `CURRENT_MILESTONE` meaningful) as M2a's first
  change, with registry tests updated.
- Then follow the approved plan: pure src/sim modules with tests first
  (heightmap, silhouette, distance, noise, blur, relief, bathymetry,
  downsample, the import pipeline, one `isLand` function), then the worker
  jobs, import dialog, Map settings, Reload (Shift+R), and the Original Art,
  Physical, and Elevation modes.

**Other notes**
- The in-app browser only reads `.claude/launch.json` from the repo root,
  so the server is started directly with `py serve.py`;
  Artifact2/.claude/launch.json records the same command.
- Read-only git checks (like `git check-ignore`) were run once, because I
  asked for confirmation. Otherwise Claude runs no git commands.
- test-maps/README.md credits GEBCO. I removed the dataset/version
  placeholder line myself.

---

## 2026-10-18 — Milestone 2a: Terrain imports

**Planned** (approved plan; additions from my review)
- First change: milestone badges show "M2a"/"M2b" instead of "M2", and a
  new workflow rule for visual checks (a short checklist I verify by eye in
  my own browser instead of Claude probing the preview).
- Pure src/sim modules with tests first, then the worker, file handling,
  renderers, import dialog, Map settings, Reload (Shift+R), and elevation
  readouts.
- Additions: Import, Reload, and Map Settings are enabled once
  `CURRENT_MILESTONE` is `'2a'`, and M2b items stay disabled; Map settings
  on a blank map just applies the new extent; the by-eye checklist includes
  a non-wrapping archipelago and a wrapped continent_map_1; the reference
  map is third-party and private.

**Changed**
- Milestones: one ordered list in src/ui/comingsoon.js
  (`1, 2a, 2b, 3 … 11`); registries use `'2a'`/`'2b'` for the M2 items;
  badges and tooltips go through `milestoneLabel()`. `CURRENT_MILESTONE` is
  now `'2a'`.
- CLAUDE.md: visual checks are a by-eye checklist for me. The "preview
  stalls" rule now applies only when I ask Claude to use the preview.
- SPEC/LOG: "the reference map" (third-party, in git-ignored
  test-maps/private/reference_map.png); the generated archipelago/continent
  maps are listed in SPEC §17.
- New pure modules (src/sim/):
  - terrain.js: the single `isLand` / `landMask` function, plus blank terrain.
  - heightmap.js, silhouette.js: reading the two image types.
  - distance.js: distance to the coast in km, accounting for latitude and
    east-west wrap.
  - noise.js: seeded noise on a sphere, plus a fast interpolated field.
  - blur.js, relief.js, bathymetry.js, downsample.js.
  - importpipeline.js: runs the steps in order.
  - Start values live in constants.js.
- Rendering: colorramps.js (Physical and Elevation color tables) and
  src/render/modes/ (Original Art, Physical, Elevation). The cached map
  image rebuilds when the terrain version changes.
- I/O: imagefile.js picks files (File System Access API with a fallback),
  decodes without color conversion so gray values stay exact, and handles
  the downscale size. workerclient.js handles worker requests; the worker
  runs the build job.
- UI:
  - Import dialog with a live preview (coastline outlined) and
    heightmap/silhouette settings, sliders with number inputs, and notices
    for downscaling, color images, and mismatched mask sizes.
  - Map settings dialog, and shared extent fields.
  - File > Import / Reload (Shift+R) and Edit > Map Settings are live.
  - The status bar and tooltip show elevation.
- Decisions applied: the mask wins; the coastline is restored after
  smoothing; Auto sea level only with a flat ocean (otherwise I set it); a
  different-size Reload reopens the dialog prefilled; images over
  8192×4096 get a downscale notice; a mask of a different size is scaled
  to fit (nearest neighbor) with a notice.

**Problems**
- Per-pixel sphere noise was too slow at full size, so noise is now sampled
  every 4 px and interpolated. It's low-frequency, so the result matches
  within 0.03; a test covers it.
- The image-type guess called the GEBCO black/white silhouette a heightmap,
  because downscaling the preview softens edges into in-between grays (256
  levels). The guess now checks whether at least 97% of pixels sit on the
  two most common tones (GEBCO BW: 98.6%; heightmaps: ~8%).
- Three new tests had setup mistakes, not code bugs: a noise test map too
  small for its finest octave, a −0 vs 0 strict comparison, and a 4×2
  config below the minimum map size.
- Deviations from the plan, for the record:
  - The New Map dialog still has its own extent fields; only Import and
    Map settings share extentfields.js (left alone to avoid rewriting a
    working dialog).
  - Import progress is an elapsed-time counter, not per-step progress.
  - The renderers live in src/render/modes/ with an index.

**Verification checks**
- PASS `node --test "tests/*.test.js"`: 61/61 (31 at the end of M1).
- PASS Full-size timing in Node: a 5632×2048 silhouette import takes
  ~2.5 s, run in the worker.
- PASS In the browser (non-visual): the page loads with no console errors
  and the worker answers through the new client. continent_map_1 decodes,
  is guessed as a silhouette, and builds in 161 ms (46% land, −4,254 to
  2,722 m). The type guess is right for all test maps.
- My by-eye checklist results (in my browser):
  1. PASS GEBCO silhouette: coastlines match in Original Art, Physical, and
     Elevation (SPEC M2a check 1). The auto-relief mountains are invented,
     as expected.
  2. PASS GEBCO heightmap + BW mask (sea level 128): real terrain with
     shelves and trenches visible; tooltip readings are consistent.
  3. PASS Non-wrapping import (a continent map, wrap off): shown once,
     latitude labels visible.
  4. PASS Wrapped import, but none of the generated maps touch the
     left/right edges, so there was no seam to test. The thin light lines at
     the top/bottom edges are in the source images.
  5. PASS Map Settings: EU4 at top 80 / bottom −37 puts the equator at Lake
     Victoria and Gibraltar near 36°N. The far south stays squashed because
     the EU4 map isn't truly equirectangular (now a SPEC §16 future idea).
  6–9. First reported as "[result]" placeholders, so Claude left M2a
     unticked and asked. My follow-up results:
  6. PASS Reload: I edited a Desktop copy, and Reload showed the new island.
  7. PASS with a finding (SPEC M2a check 2): the Tibetan plateau reads
     4,184 m (max 5,000), but a northern France coast read 195 m. With Auto
     sea level, EU4's gap between its ocean gray and its lowest land gray
     meant darkest + 1 lifted all land. Fixed: Auto now picks the first
     gray actually used above the flat ocean plateau (skipping empty
     levels), so the lowest land reads ~0 m. New test: a Paradox-style gap
     (ocean 40, land from 94) gives sea level 94 and the lowest land ~0 m.
     The pipeline test now uses an image with such a gap too.
  8. PASS M2b items: Sculpt brushes, Undo/Redo, Tool Palette, and Shaded
     Relief show M2b; Cave-Prone Rock shows M9; the Slope and Distance icons
     are disabled.
  9. PASS ~1280 px and narrower: the toolbar wraps to 2–3 rows down to
     ~650 px, nothing is clipped, and the context bar truncates with "…".
     For later: the legend covers a large part of the map at narrow widths,
     so a collapsible legend is now on the M11 list in SPEC.md.
- Bug I found during the checklist: for gebco_bathy_BW_heightmap.png the
  dialog note said "256 gray levels: looks like a heightmap" while
  Silhouette was (correctly) selected. The note still counted distinct gray
  levels, while the guess already used the two-tone share. Fixed: a new
  `describeGuess()` in silhouette.js builds the note from the same fields
  that chose the type (e.g., "Mostly two tones (98% of pixels): looks like
  a silhouette."), so the note and the selection can't disagree. Tests: a
  two-tone image with blended edges is guessed and described as a
  silhouette, and for every test image the note names the guessed type.
- `profileDepth(0)` returned −0. In Session 2's first pass I had only
  loosened the test (`=== 0` treats −0 as equal) instead of fixing the
  code. Fixed now (the shoreline returns +0), and the test is strict again
  (`Object.is`).
- PASS Node tests 63/63 after these fixes, then 64/64 after the
  auto-sea-level fix.
- M2a complete: every checklist item passes, including both SPEC M2a
  checks (item 1 and item 7, the latter after the auto-sea-level fix; I
  haven't re-checked EU4 by eye since that fix).

**By-eye checklist (in my browser at ~1280 px, http://127.0.0.1:8000)**
1. File > Import Map Image… → `gebco_bathy_BW_heightmap.png`. It
   pre-selects Silhouette. Import, then switch Physical / Elevation /
   Original Art (W / E / Q in Terrain): the coastlines match the image.
2. Import `gebco_bathy_heightmap.jpg` as Heightmap. The sea level says "set
   it by hand"; set it, add the BW PNG as the mask, and import. The coasts
   follow the mask, depths come from the image, and hovering shows
   elevation in the status bar and tooltip.
3. Import `archipeligo_map_1.png` with the span < 360° (wrap greys out): a
   non-wrapping map with ocean on every side.
4. Import `continent_map_1.png` wrapped (360°): panning across the date
   line repeats the map. A visible seam comes from the image, not a bug.
5. Edit > Map Settings: change the latitude range and apply. The terrain
   rebuilds and the view stays put.
6. Edit the source image and save it, then press Shift+R: the map updates
   without a dialog. A saved image of a different size reopens the dialog
   prefilled.
7. `private/eu4_heightmap.bmp` as Heightmap with sea level set by hand: the
   darkest land reads ~0 m, and gray 203 reads the max height.
8. Badges: Sculpt, Undo/Redo, Slope & Ruggedness, Distance from Coast, and
   Shaded Relief show M2b and are disabled.
9. Nothing is clipped or covering labels at ~1280 px; the import dialog
   fits.

**Next**
- Quick by-eye re-check: EU4 with Auto sea level, a northern France coast
  should now read close to 0 m.
- Plan M2b (edits layer vs. Reload and Map settings decided there). Not
  started.

---

## 2026-10-18 — Session 2 prompt log (M2a)

### Prompt 1
* **User Prompt:**  
  > *"Read CLAUDE.md, SPEC.md, and LOG.md. We're doing M2a; the split and my answers are recorded. In Plan mode, propose the M2a files, data layers, import flow, and tests, consistent with those decisions. Start M2a with the milestone badge fix (show "M2a"/"M2b" instead of "M2"). Also add a workflow rule: for visual checks, give me a short checklist to verify by eye in my own browser instead of probing the preview."*
* **What the AI Provided:**  
  Read the docs and the new test maps (the generated maps are 1024×512, two-tone, opaque), then wrote the M2a plan: the badge fix first, then pure modules with tests, worker and I/O, data layers kept in sync by a version counter, the import dialog flow, Map settings and Reload, and verification.

### Prompt 2
* **User Prompt (plan feedback):**  
  > *"Approved, with additions: Verification: Import, Reload, and Map Settings are enabled after CURRENT_MILESTONE becomes '2a'; M2b items (Sculpt, Undo, Slope, Shaded Relief) stay disabled. Map settings on a blank New Map (no cached source): just apply the new extent. Add to my by-eye checklist: import an archipelago as a non-wrapping map, and import continent_map_1 wrapped (the date-line seam comes from the image, not a bug). The reference map is test-maps/private/reference_map.png (third-party, git-ignored). Update SPEC.md and LOG.md to say "the reference map" instead of "my reference map", and note it's third-party and private. Open questions 1–3: your defaults are fine. Then implement M2a in the order you listed."*
* **What the AI Provided:**  
  Implemented M2a in the planned order (see the M2a entry above).
* **Root Cause Discovered:**  
  Slow per-pixel noise, and the silhouette guess fooled by smoothed edges (both fixed; see Problems above).
* **How It Was Verified:**  
  61/61 Node tests, the full-size timing run, and non-visual browser checks. The visual checks are my checklist.

### Prompt 3 (sent while Claude was working)
* **User Prompt:**  
  > *"Can you please start the local host for me so I can view the current page as it is?"*
* **What the AI Provided:**  
  Started `py serve.py` at http://127.0.0.1:8000 (checked it serves `text/javascript` with `no-store`). At that point the page was still M1 plus the new badges.

### Prompt 4
* **User Prompt:**  
  > *[M2a by-eye checklist results: 1–5 PASS with notes (GEBCO silhouette coastlines match; GEBCO heightmap + mask at sea level 128 shows real terrain; non-wrapping import shown once; wrapped import fine but no generated map touches the left/right edges, and the light top/bottom lines are in the source images; Map Settings with EU4 at 80/−37 lines up, but the far south stays squashed because EU4 isn't truly equirectangular). Items 6–9 left as "[result]".] "Bug: for gebco_bathy_BW_heightmap.png the import dialog's note says "256 gray levels: looks like a heightmap" while Silhouette is (correctly) selected. […] Make the note use the same two-tone check as the guess […] so the note and the selection can never disagree. Add a test with a two-tone image that has blended edges. Question: was profileDepth(0) returning -0 fixed in the code? If not, fix it." [SPEC.md future idea: non-equirectangular maps (Mercator, custom latitude control points) for distorted maps such as Paradox's.] "Then fix the bug, tick M2a, finish the LOG.md M2a entry and the Session 2 prompt log. Don't start M2b."*
* **What the AI Provided:**  
  - Added `describeGuess()` and used it for the dialog note, with two new tests.
  - Answered honestly that `profileDepth(0)` had not been fixed (only the test was loosened); fixed it and made the test strict.
  - Added the non-equirectangular idea to SPEC §16, and recorded the checklist results above.
  - Did not tick M2a: items 6–9, including the required EU4 heights check, came through as placeholders, so it asked instead of assuming they passed. Did not start M2b.
* **Root Cause Discovered:**  
  - Two separate rules described the same image: when the guess was fixed to use the two-tone share, the note kept counting gray levels.
  - Earlier this session the −0 issue had been covered by loosening a test rather than fixing the code (Claude's shortcut, not a misread of my request).
* **How It Was Verified:**  
  Node tests 63/63, including the blended-edge silhouette test and the "note names the guessed type" test; `Object.is(profileDepth(0), 0)`.

### Prompt 5
* **User Prompt:**  
  > *[Checklist items 6–9: 6 PASS (Reload showed a new island in an edited Desktop copy); 7 PASS with a finding (Tibet reads 4,184 m of 5,000, but a northern France coast reads 195 m: with Auto sea level, EU4's gap between ocean gray and lowest land gray means darkest + 1 lifts all land; suggest Auto pick the first gray actually used above the flat ocean plateau, with a test); 8 PASS (M2b items show M2b, Cave-Prone Rock M9, Slope/Distance disabled); 9 PASS down to ~650 px, with a later note that the legend covers much of the map at narrow widths and should be collapsible (M11).]*
* **What the AI Provided:**  
  - Changed Auto sea level to the first used gray above the ocean plateau, with a Paradox-style gap test, and updated the pipeline test to use such a gap.
  - Added a collapsible legend to M11 in SPEC.md.
  - Recorded items 6–9, ticked M2a, and suggested a commit message.
* **Root Cause Discovered:**  
  The original auto rule (darkest + 1) assumed land starts right above the ocean gray. EU4 has empty gray levels in between, so every land pixel was lifted by the size of the gap.
* **How It Was Verified:**  
  Node tests 64/64 (new: ocean 40, land from 94 → sea level 94, lowest land ~0 m). Not yet re-checked by eye on EU4 since the fix (listed under Next).

---

## Entry template

## YYYY-MM-DD — Milestone N: Name

**Planned**
**Changed**
**Problems**
**Verification checks** (which SPEC.md checks passed or failed)
**Next**

## YYYY-MM-DD — Session N prompt log

### Prompt N
* **User Prompt:**  
  > *"..."* (long pastes condensed into [brackets])
* **What the AI Provided:**  
* **Where the Model Misread Me:** (if it did)  
* **Root Cause Discovered:** (if a bug was found)  
* **How It Was Verified:** (for every fix)