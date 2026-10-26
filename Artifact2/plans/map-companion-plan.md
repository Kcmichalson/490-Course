# Map-wide companion (bonus after Artifact 3; plan approved Session 11)

## Context
Artifact 3 (the tile companion) is submitted; this is a bonus on top of
it, and the tile companion's behavior doesn't change. Goal: ask Claude
questions about a whole map (where empires and events belong), with a
read-only query tool over an exported map file, and code that checks the
answer. Hard stop 23:00 on 2026-10-25: anything unfinished is recorded as
in progress. Order A → B → C, each working on its own, with a by-eye
check and commit message after each.

## (A) File > Export Map Data, File > Export Map Picture
- **Map data** (`fcm-map-data-<W>x<H>.bin.gz`): gzip (browser
  `CompressionStream`). One JSON header line (extent, wraps, grid size,
  radius, season, layer list), then little-endian arrays: elevation
  int16 m, category uint8, Köppen uint8 (255 = water), 12 monthly
  temperatures int16 ×10, 12 monthly rain uint16 ×10, wind u/v int16
  ×1000.
- Each cell = its center source pixel, with the tile export's functions
  (`pixelMonths`, `koppenAt`, `windAt`); monthly rain from one read-only
  worker message returning the 12 cached layers. Köppen mode (Q) must have
  run first.
- **Map picture** (`fcm-map-<mode>.png`): the base layer (+ Shaded Relief
  if on) at 2048 px wide, then the existing `drawGraticule` (lines and
  latitude labels, always on).
- Tests: a pure encode/decode round trip (Node); Python reads a
  Node-written file.

## (B) tools/mapquery.py (stdlib): CLI + small stdio MCP server
- `point DATA LAT LON`, `region DATA S N W E`, `overview DATA`, and
  `serve DATA --log FILE` (JSON-RPC: initialize, tools/list, tools/call).
- Region: land share, main Köppen classes (area %), elevation range, mean
  annual rain over land. Overview: landmasses (8-neighbour, wrap-aware;
  extent, area km², main climates) and mountain ranges (≥ 1,500 m,
  ≥ 20,000 km²; extent, peak).
- claude -p restriction (flags confirmed in 2.1.308 `--help`):
  `--tools ""`, `--mcp-config <temp json: only mapquery>`
  `--strict-mcp-config`, `--allowedTools mcp__fcm__point,mcp__fcm__region,mcp__fcm__overview`,
  `--permission-prompts none`, `--disable-slash-commands`,
  `--no-session-persistence`, fresh temp folder, no API key variables.
  A 1-minute diagnostic run (yours) checks whether `--safe-mode` keeps
  the `--mcp-config` server; if not, map mode runs without `--safe-mode`.
- Tests: Python unittest on a tiny synthetic grid; the server tested by
  piping JSON-RPC (no model).

## (C) companion.py --ask Q.md --map DATA [--picture PNG]
- Tile mode unchanged. The picture goes in as an image block via
  `--input-format stream-json` (no file tool).
- The model writes `## Placements` ending in a fenced JSON list of
  `{name, lat, lon, koppen, reasons}`, then `## Campaign hooks`.
- Checks: sections; JSON parses; each placement's cell is Land or Land
  ice; its `koppen` equals the cell's; any Köppen code or °C value in its
  `reasons` matches the cell (the tile checks). One retry.
- `answer.md` with the tile-mode header style (question, map, date, model,
  checks, attempt, tool calls); the server's call log as
  `answer.toolcalls.jsonl`.
- Example question and your real run's answer in tools/examples/.

## Defaults (approved)
Center pixel per cell; picture 2048 px, mode + Relief + graticule only;
current-season wind; "on land" = Land/Land ice, exact cell; ranges
≥ 1,500 m and ≥ 20,000 km²; the map data file isn't committed; if image
input fails, C runs without the picture and records it.

## Rules
No git; Edit tool or Python only; one purpose per command; tool log after
each sub-step; fix code, not expectations; you run every real claude -p.
