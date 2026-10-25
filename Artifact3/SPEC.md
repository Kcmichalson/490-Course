# LANCER Tactical Board Bridge: Specification (v1 draft)

Kilo and I play LANCER in Tabletop Simulator with an AI acting as GM. We move
every miniature and roll every die; the GM decides enemy actions and tracks
rules and combat state. The problem: from screenshots alone, the GM loses
track of exact positions, distances, terrain, and who is inside the
objective. This tool gives the GM an exact battlefield snapshot whenever I
say "your turn."

The goal is *accurate and readable*, not a full LANCER simulator. Items
marked **(decide)** are open decisions to settle in that milestone's plan
and record in LOG.md.

---

## 1. Data flow

```
TTS (we move minis as normal)
  → Lua exporter: marked objects' (see §2) names, GUIDs, positions,
    rotations, bounds, descriptions, plus the table's Grids settings
  → HTTP POST to the Python bridge on 127.0.0.1
  → bridge converts to hex coordinates, computes distances and footprints,
    stores the latest snapshot and a history
  → GM reads it: GET /report (copy-paste), or later through a local MCP
    server (M4)
```

The bridge is local only. No externally reachable service, no tunnels, no
cloud hosting.

## 2. TTS side

- **Tracking marker (replaces TTS tags, Session 1):** an object is tracked
  only if the first non-blank line of its description is `AIT: Unit` (mechs, NPCs,
  deployables), `AIT: Terrain` (cover and obstacles), `AIT: Hazard`, or
  `AIT: Objective`, case-insensitive. Anything without it is ignored. This
  lets us mark or re-mark objects mid-game by editing the description. The
  Lua exporter sends objects whose description starts with `ait:`; the
  bridge parses the marker and warns about unknown kinds.
- **Description stats:** key:value pairs after the marker line, e.g.
  `Side: Player`, `Size: 2`, `HP: 8/10, Heat: 3/6, Structure: 4,
  Conditions: Impaired`. Parse what's present; missing keys are fine;
  unknown keys are kept and passed through. M1 uses a provisional syntax
  (LOG.md, Session 1 Decisions); final syntax **(decide, M2)**.
- **Export triggers:** an in-game "Snapshot" button (on demand) and a slow
  repeating timer. Interval: 5 s, start **(decide, M2)**.
- **Offline bridge:** fail quietly; at most one chat notice until it
  reconnects.
- **Grids:** send the table's grid type, size, and offset with every
  payload so the bridge never hard-codes hex orientation.
- **Calibration markers (M2, Session 1):** our table is a hex grid painted
  on a 3D terrain model, not TTS's built-in grid. Three `AIT: Calibration`
  markers (one on a hex center, one N hexes along each row direction) give
  the grid's origin, spacing, and angle; TTS Grid settings are the
  fallback. Details are for the M2 plan.
- **Flying (Session 1):** airborne minis sit on pedestals, but flying is
  never inferred from height (the terrain varies in height). It's the
  description condition `Conditions: Flying`.
- **Bundling:** how multi-file Lua source reaches TTS **(decide, M2)**:
  the VS Code TTS extension's `#include`, a stdlib Python bundler in tools/
  that writes one file to paste, or a single hand-maintained file.
- Whether `WebRequest` reaches `http://127.0.0.1` from TTS is verified in
  the game in M2, not assumed.

## 3. Bridge

- Python standard library only; binds 127.0.0.1; port 8765, start.
- **Endpoints:**
  - `POST /tts`: receives the Lua payload
  - `GET /snapshot.json`: latest processed snapshot
  - `GET /report`: plain-text GM report (section 4)
  - `GET /health`: bridge status and time of the last TTS payload
- **Storage (decided M1):** latest snapshot in snapshots/latest.json;
  history in one append-only snapshots/history.jsonl. History only records
  snapshots whose board differs from the previous one (ignoring time,
  `seq`, and raw world position/rotation).
- **Hex math:** axial (q, r) internally; world → hex using the Grids
  settings; hex distance; footprints by LANCER Size: Size ½ and 1 = 1 hex,
  Size 2 = 3, Size 3 = 7, Size 4 = 12 (the Size 2 triangle plus every hex
  touching it: rows of 3, 4, 3, 2). Every footprint is placed by position
  only; a mini's rotation is kept as raw data and never changes its
  footprint. Size 2 and 4 are point-up or point-down depending on which hex
  corner the base sits on, so a flip (house rule: costs 1 movement) is a
  move, while turning in place isn't (shapes and reasons in LOG.md,
  Session 1 Decisions).
  Distances between units are measured between their nearest occupied
  hexes, adjacent = 1 (confirmed Session 1).
- Snapshots carry a `schema` version and a `seq` number; payloads carry a
  separate `payload_version`.

## 4. GM report

Plain text written for an AI GM to read, compact enough to paste into a
chat:
- Header: snapshot time, schema version, grid orientation
- Units: name, hex label, size, HP/Heat/Structure, conditions, side
  (description key `Side:`, decided M1; missing = `unknown`)
- Terrain and hazards: name and occupied hexes
- Objective: hexes, and which units are inside. A unit is inside if any of
  its occupied hexes is in the objective (confirmed Session 1). The
  objective's area is the hexes whose centers lie inside the XZ bounds of
  the tile marking it (decided Session 1; matches the rulebook's
  rectangular zones).
- Distance table between opposing units (different sides; `unknown`
  opposes everyone)
- Format is fixed by a golden-file test (tests/fixtures/).

## 5. Out of scope for v1

- Rolling dice or resolving attacks automatically
- An autonomous AI GM / direct API calls to any AI model
- Making the bridge reachable from the internet
- Pushing scripts into TTS through the External Editor API (possible later
  dev convenience; ports 39998/39999 are reserved for the VS Code
  extension)

## 6. Milestones and verification checks

The bridge runs and tests pass after every milestone. Verification that
needs TTS is a numbered in-game checklist I run and report back on.

**M1 — Bridge core and hex math (no TTS needed)**
Snapshot schema v1, world → hex conversion from Grids settings, hex
distance, Size footprints, storage, all endpoints, GM report, fixture
payloads and golden report.
- Unit tests cover both hex orientations, negative coordinates, Size 1 and
  Size 2+ footprints, and hand-checked distances
- POSTing each fixture produces the expected /snapshot.json and /report
- Malformed payloads return a 400 with a clear message and never crash the
  bridge

**M2 — TTS exporter**
Lua exporter with the `AIT:` marker filter, description stats, Grids,
calibration from `AIT: Calibration` markers (Grid settings as fallback),
Snapshot button, timer, offline handling, and the bundling decision.
- In-game: marked objects appear in /snapshot.json; unmarked don't, and
  editing a description to add or remove the marker takes effect on the
  next export
- In-game: moving a mini one hex changes its hex by exactly one
- In-game: stopping the bridge produces at most one chat notice; restarting
  it resumes exports without reloading the save

**M3 — Calibration on our real table**
Run against a copy of our actual LANCER table and minis.
- A calibration check: two test tokens a known number of hexes apart report
  that distance, in both axes
- Size 2+ minis report the hexes I see them occupying
- I paste one /report into the GM chat and it reads the board correctly
- Elevation: minis on high and low ground report the hex directly under
  their base
- Tile seams: hexes stay aligned across seams between terrain tiles
- Pedestals: flying minis on pedestals report the hex directly under their
  base

**M4 — GM access without copy-paste (if the GM runs in Claude)**
A local MCP server (stdio, standard library) exposing tools such as
`get_battlefield`, `get_changes_since(last)`, and `distance(a, b)`. I add it
to Claude Desktop's config myself.
- In a Claude chat, "your turn" leads to a tool call that returns the
  current board
- The server reads only from the bridge; it can't modify snapshots

**M5 — Combat state and change log**
Turn-to-turn diffs (who moved, stat and condition changes), an event log,
and per-round activation tracking **(decide scope)**.

**Later — tactical intelligence** (plan separately)
Line of sight and cover from terrain footprints and heights; reaction
triggers (e.g., a move entering Overwatch range); action accounting;
sitrep Objectives (escort/extract objects of Size ½–2 with HP that work by
adjacency, rulebook Sitreps pp. 266–273), kept separate from `AIT:
Objective` zones.
