# Project Log

A running record of what I planned and what changed. Newest entries at the
bottom. Claude Code updates this at the end of every milestone.

## Milestone status

- [ ] M1 — Shell and grid
- [ ] M2 — Terrain input
- [ ] M3 — Planet sliders and wind
- [ ] M4 — Temperature
- [ ] M5 — Precipitation and rain shadows
- [ ] M6 — Köppen
- [ ] M7 — Ocean currents and upwelling
- [ ] M8 — Monsoons, friction, deflection
- [ ] M9 — Tides and sea caves
- [ ] M10 — Polish and export

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
- The tide scrubber shows a stylized intertidal band, because real tidal
  flats are smaller than a pixel at these map scales.

**Problems / open questions**
- The full spec is probably more than one evening. The milestone order keeps
  the app runnable, so the assignment is complete at any stopping point and
  the rest continues in later weeks.

**Next**
- Commit CLAUDE.md, SPEC.md, and LOG.md.
- Start Claude Code: read all three, propose the file structure and an M1
  plan, and list any ambiguities before writing code.

---

## Entry template

## YYYY-MM-DD — Milestone N: Name

**Planned**
**Changed**
**Problems**
**Verification checks** (which SPEC.md checks passed or failed)
**Next**