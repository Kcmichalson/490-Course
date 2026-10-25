# Plan: Climate inputs (between M6a and M6b)

Approved with changes in Session 10 (Prompt 9). Your conditions are marked
**Condition**.

## Context
M6a's Köppen rules are verified, but the default Earth map is wrong: a
cold north (ET), hot deserts BWk, dry-summer interiors (Dsa/Dsb) and Cs in
the SE US, coastal Af with Aw in the Amazon and Congo interiors. M6b's modes
(biomes, vegetation, agriculture, wildfire) would build on these inputs, so
they are fixed first, in a correction step recorded in LOG as "Climate
inputs (between M6a and M6b)" (no new milestone id, no gated UI).

Already known (Node, the app's `tqTable`, tilt 23.5°): the annual radiative
temperature `Tq = 0.212·Q − 61.7` is 15.7 °C at 30° and 3.4 °C at 45°
(Earth's zonal means ≈ 20 and ≈ 10 °C); it matches only at the equator and
poles. The seasonal swing (s 0.15–0.5 × a ±40 °C radiative swing) and polar
summers (Arctic ≈ −10 °C vs ≈ 0 °C) look off too.

## Decisions (yours)
1. Correction step now, before M6b. Approved.
2. A SPEC §6 method change may be proposed if Phase A confirms the cause.
   Approved, with conditions 1–3 below.
3. Reference values: approximate standard climate normals, listed with
   each comparison (you may supply your own).

## Phase A: diagnosis only (no changes in src/; in-memory probes with the
## app's own functions, as in M5). Stop and report.
- A1: GEBCO zonal-mean annual temperature (land, ocean, all) at 0–80° vs
  Earth's zonal means.
- A2: 12 monthly T and P vs approximate normals at Paris, Moscow, Yakutsk,
  the Arctic coast near Utqiaġvik, Kansas City, Atlanta, Phoenix, the
  Sahara near Tamanrasset, Alice Springs, Manaus, Kisangani, interior NE
  Brazil near Petrolina, Mombasa.
- A3: rain split by month and term (background, orographic, capacity
  excess, recycling) at Kansas City, Atlanta, Manaus, Kisangani,
  Petrolina, Mombasa.
- A4: attribution table: symptom → cause → where the fix belongs (M4
  profile, M4 swing, M5 rain mechanism, M7 currents/SST, M8 monsoons).
- **Condition 5:** list which existing tests encode the M4 equator/pole
  calibration.

## Phase B: temperature (proposal, measured, your approval)
- **Condition 2:** measure both a Budyko-style relaxation toward the global
  mean (one constant) and a 1-D diffusive energy-balance model; recommend
  one, preferring the simpler if it meets the targets.
- **Condition 1:** the fix must be physical and work for non-Earth planets,
  not an Earth-specific correction. Show results for Earth plus tilt 0°,
  tilt 60°, and a fast and a slow rotation. Note: the app's tilt range is
  0–45° (SPEC §3; `createPlanet` clamps), so 60° is run through the pure sim
  functions and labeled as outside the app's range.
- Targets: SPEC's equator and pole values plus new mid-latitude ones (≈ 20
  °C at 30°, ≈ 10 °C at 45°, annual zonal mean), added to SPEC §17 if
  approved. Recheck the seasonal swing (maritime W Europe, interiors,
  Arctic summer); a swing change only by its own proposal.
- **Condition 3:** report the added time for the 12-month job.
- Existing M4 test expectations that would change are listed and wait for
  your approval.

## Phase C: rain (proposal)
- **Condition 4:** rerun the A3 rain breakdown after the temperature
  change and base Phase C on that version, not the pre-fix numbers.
- Candidates: warm-season convective rain over hot land, moisture
  convergence at the ITCZ, or recording misses as M7/M8 limitations. One
  round each, measured, your approval.

## Phase D: recalibrate and recheck
`PRECIP_CAL` back to 82 mm/month; rerun the M4, M5, M6a sample points; a
before/after Köppen table for the four symptoms; SPEC known limitations; a
by-eye checklist (Earth defaults, Köppen defaults, Load Earth Map, Go-to
points, expected codes).

## Status and next session (end of Session 10)
- Done: Phase A (diagnosis) and Phase B (Budyko heat transport +
  ice-albedo with a 20 °C ramp; `PRECIP_CAL` 86,192). By-eye check PASS
  (short version).
- C1 (the monsoon wind term) is recorded for M8 as a known limitation; the
  milestone order is unchanged.
- Next session:
  - Phoenix's rain split by term and month on the new temperatures (it
    rose from 1,335 to 1,432 mm/yr, against the Phase A prediction).
  - Measure C2 (convergence-scaled rain; recycling 0.5 as a separate
    variant), one round, proposal only.
  - Retime the full 12-month job (27–28 s last time vs 7.7 s before); if
    it's still slow, find out why.

## Rules
No constant or method change without approval; fix code, not
expectations; Edit tool or Python only; no git; one purpose per command;
tool log after each sub-step. Stop after Phase A and after each proposal.

## Likely files (only after approval)
New `src/sim/energybalance.js`; `src/sim/temperature.js`,
`src/sim/constants.js`, `tests/temperature.test.js`, SPEC §6/§7/§17, LOG.
