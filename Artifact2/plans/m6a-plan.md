# M6a plan: Köppen only (Session 10)

Approved in Session 10 with changes (marked **Change**). This plan is a
reconstruction: the original M6a plan, written before M5 phase 2 landed,
was lost between machines, so it was rebuilt from the current code.

## Context
M6 is split: **M6a = Köppen**, **M6b = Biomes, Vegetation Density,
Agricultural Potential, Wildfire Risk, Art Check, the click-a-tile climate
chart, the climate analog**.

What changed since the lost plan (M5 phase 2 landed):
- `src/sim/hydrostats.js` already computes per-cell 12-month statistics
  once per 12-month set (`hydroStats`, in `precipitationSteps`), and the
  worker transfers every `stats` field generically. Köppen's precipitation
  inputs become new fields of `hydroStats`: no new pass, message, or cache.
  `dryMm` (driest month) already exists.
- main keeps only `hydro.annual` + `hydro.stats`; the 12 monthly layers stay
  in the worker, which is enough with the new fields.
- The cloud rain term doesn't feed Köppen: no effect.
- `hydroCtx` needs `result.cloud`; Köppen gets its own context.

## Step 0: logs, deny tests, docs
- Deny tests (all must be blocked; stop if any runs): Read
  `~/.ssh/canary.txt`, Read `test-maps/private/canary.txt`, a blank-line
  Edit to CLAUDE.md, an Edit to `tool-log/(today).jsonl`, Bash `curl --version`.
- Save this plan in `Artifact2/plans/`.
- `tool-log/README.md`: the new format. **Change:** note that denied file
  paths leave no log line and show only in the chat.
- LOG.md: Session 10 prompt log; M6 → M6a / M6b in the status; the M6a
  entry with the split and D1–D8. SPEC.md: §17 split, §8 M6a decisions,
  §2.8 Köppen note, §13.3 Köppen mode definition.

## Step 1: M5 step-8 re-check points (skipped in Session 9)
GEBCO, Annual Mean, Precipitation mode, the app's own worker and pixel
functions in the browser (M5 import settings). If the preview stalls, stop
and ask. **Stop after Step 1 if any point is out of range.**
Borneo 1N 114E 193 (181–203); Paris 48.9N 2.3E ≈ 44 (known M7 miss); Pacific
NW 47N 123W 106 (93–109) vs Montana 47N 110W 11 (10–11); Chile 45S 72.8W 262
(194–271) vs Patagonia 45S 69W 24 (23–24).

## Decisions
- **D1 Split/gating:** `MILESTONES` gets '6a', '6b' (replacing '6');
  `CURRENT_MILESTONE = '6a'`; koppen → '6a'; art-check, biomes, vegetation,
  agriculture, wildfire → '6b'. Context bar chart text → "M6b"; the status
  bar climate code is M6a.
- **D2 Resolution:** each source pixel is classified from its own 12 monthly
  temperatures (`pixelMonths`, own elevation and category) and the
  precipitation statistics from the sim grid. SPEC 2.8's "nearest/majority
  for Köppen" is replaced by this. **Change:** rainfall is interpolated from
  **land cells only** (bilinear over the land corners, re-weighted), with
  the **nearest land cell** as the fallback when no corner is land, so
  coastal pixels don't mix in ocean statistics. Recorded in SPEC.
- **D3 Precip inputs (worker, per sim cell, in `hydroStats`):**
  `summerShare`, `summerDryMm`, `summerWetMm`, `winterDryMm`, `winterWetMm`.
  Summer half = Apr–Sep (months 3–8) for row latitude ≥ 0, Oct–Mar below.
  Annual P = 12 × `hydro.annual`; driest month = existing `dryMm`.
- **D4 Rule order:** painted land ice → EF; then H (if on and the pixel's
  elevation > 2,500 m); then SPEC §8 E, B, A, C/D as written. No As (SPEC:
  "otherwise Aw"). D third letter: a, b, then d if coldest < −38 °C, else c.
  **Change:** second letter follows SPEC §8's wording, quoted: "s if driest
  summer month < 40 mm and < 1/3 of the wettest winter month; w if driest
  winter month < 1/10 of the wettest summer month; else f." SPEC lists s
  first, so s wins when both hold; SPEC doesn't say so explicitly, which is
  raised as an ambiguity in LOG (no other reading is used).
- **D5 Surfaces:** land only; ocean, sea ice, and lakes drawn muted. Ignores
  the selected season.
- **D6 Colors/legend:** the standard Köppen–Geiger palette (Beck et al. 2018)
  for the 30 classes; H a brown (139, 90, 60). Legend in grouped columns,
  code plus a short name; scrolls in the legend box if tall.
- **D7 Settings:** C/D boundary (0 °C default / −3 °C) and the Highland
  override (on, 2,500 m) as two controls in the Köppen legend, saved in
  `fcm:koppen`; changing them redraws without rerunning the sim.
  `KOPPEN_HIGHLAND_M = 2500`, `KOPPEN_CD_BOUNDARY_C = 0` in constants.js; the
  Köppen–Geiger definitional thresholds stay named in koppen.js.
- **D8 Readouts:** Köppen runs (PRECIP_MODES) only while the mode is shown.
  Tooltip "Köppen Cfb (temperate oceanic)" and status bar "Climate: Cfb" on
  land whenever the 12-month set already exists (never starting a run). In
  Köppen mode an extra line: warmest, coldest, P mm/yr, B threshold.

## Files
New: `src/sim/koppen.js`, `src/sim/koppenfield.js`,
`src/render/modes/koppen.js`. Edited: hydrostats.js, modes/index.js,
climateraster.js (key hook), legend.js (controls hook), modes.js,
comingsoon.js, contextbar.js, statusbar.js, main.js, constants.js,
style.css, worker.js (comment).

## Tests (fix code, not expectations; only comingsoon and registry change)
- New `tests/koppen.test.js`: each must-have (Af, Am, Aw, BWh, BWk, BSh,
  BSk, Csa, Csb, Cfa, Cfb, Dfa, Dfb, Dfc, ET, EF, H) plus Cfc, Cwa, Dsb,
  Dwb, Dfd; southern hemisphere; the three B branches; E before B; C/D −3 °C;
  H on/off; land ice → EF; s before w; the Am boundary; pixel cases (water,
  a mountain pixel colder than its lowland, land-only rainfall interpolation
  and its nearest-land fallback).
- `tests/hydrostats.test.js`: one new test for the 5 fields.
- Changed as allowed: comingsoon, registry.

## Verification
- Tests, the encoding check, the tool log after each sub-step.
- GEBCO codes at the SPEC M6 points (Amazon, Sahara, Paris, Mediterranean,
  Canada, Siberia, Arctic coast) plus Greenland, Tibet, Montana; misses get
  a reason (M5 limitation / M7 / M8), no tuning.
- **Change:** timings at 5632×2048 for a full Köppen draw and a
  legend-setting redraw; over ~200 ms on the main thread → move to the
  worker or chunk it, and report.
- By-eye checklist: Earth defaults first, **then "confirm Köppen defaults
  (C/D 0 °C, Highland on)"**; server and URL; exact clicks; Go-to
  coordinates; expected codes; ~1280 px visual pass; PASS/FAIL is yours.
- LOG/SPEC, a commit message; M6a stays unticked.
