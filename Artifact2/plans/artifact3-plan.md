# Artifact 3: climate companion (plan, approved Session 11 with changes)

## Context
Artifact 3 (due 2026-10-25, 11:59 PM) needs a model doing real work every
time it runs, plus a log of plans and changes in the repo. The Claude API
is not allowed (separate billing), so: the app exports one tile's climate
summary as JSON; a local Python script sends that JSON to Claude Code
headless (`claude -p`), checks the reply, and writes advice.md. Climate
inputs Phase C is parked (its notes stay as they are).

## Priority
One full export → companion.py → advice.md run working end to end first,
then tests and polish.

## Step 0: housekeeping
- Start the "Session 11 prompt log" in LOG.md.
- Delete the stale "Recommended order (before your decision)" paragraph at
  the end of the Climate inputs "Next session" note. It is in LOG.md only;
  plans/climate-inputs-plan.md doesn't have it.

## Step 1: Export climate summary (app)
- A context-bar button "Export climate summary" next to "Selected … ×".
- New pure module src/io/tilesummary.js builds the JSON; the download uses
  Blob + `a[download]` (as paletteeditor.js), so it works locally and on
  GitHub Pages. Nothing is uploaded.
- Fields (existing code only, no new sim logic): lat/lon, elevation_m,
  category, Köppen code and name (`koppenAt`), 12 monthly temperatures
  (`pixelMonths`) + warmest/coldest/mean, 12 monthly rain + annual, wind
  (the `windReadout` math, season named, speed unitless), distance to coast
  (km, the existing `coastDistance` worker job, cached in `store.coast`).
- Monthly rain: one read-only worker message reads the worker's cached
  monthly layers with Köppen's land-only weights (`landWeights`).
- Land tiles only; if the 12-month rain isn't computed yet, a message asks
  to open Köppen mode (Q) first.
- File name like `fcm-tile-48.86N_2.35E.json`.

## Step 2: tools/companion.py (standard library only)
- Before building: run `claude --help` and `claude --version` and confirm
  every flag used exists in this version; show the output; replace any that
  don't. No unconfirmed restriction flag.
- Finds `claude` on PATH first; then `--claude PATH`; then the desktop
  app's bundled claude.exe (newest). The README says which was used and how
  to install the CLI.
- Restrictions: no tools, no MCP, no CLAUDE.md/hooks/skills, fresh temp
  working folder, no session saved; `ANTHROPIC_API_KEY` /
  `ANTHROPIC_AUTH_TOKEN` removed from the child environment.
- Fixed prompt with six sections: Overview, Settlements, Crops and food,
  Trade, Cultures, Real-world parallels.

## Step 3: checks
1. All six sections present.
2. Every Köppen code stated equals the JSON's (Am and H only next to
   "Köppen"/"Koppen").
3. Every °C value (both ends of ranges) within 0.5 °C of a JSON value or a
   standard Köppen threshold (0, −3, 10, 18, 22 °C); any °F fails.
4. Every bullet under "Real-world parallels" starts with "Parallel:";
   "historically", "in history", "real-world", "on Earth" fail outside it.
- On a failure: retry once, sending the failures back to the model for a
  corrected reply. If the retry also fails: save advice.raw.md, list the
  failed checks, exit 1. Run errors exit 2.
- advice.md gets a code-written header: tile, date, model, checks passed.

## Step 4: docs and examples
- tools/README.md: what the model does, what the code checks (and its
  limits), how to run it, which claude was used and how to install the CLI,
  and that only the tile's summary is sent (the map never leaves the
  machine).
- tools/examples/: a Paris tile JSON and its advice.md.

## Step 5: LOG.md
"Artifact 3: climate companion" entry + the Session 11 prompt log.

## Verification
- `node --test "tests/*.test.js"`; `py -m unittest tools/test_companion.py`
  (canned replies, including the retry path).
- A real end-to-end run on an exported Paris tile.
- Tool log after each sub-step; a by-eye checklist; a commit message.

## Decisions (defaults accepted)
Context-bar button only; land tiles only; no auto-run of rain; land-only
rain weights; current-season wind, unitless speed; advice.md next to the
JSON (overwrites; `--out` to change); CLI default model unless `--model`.
