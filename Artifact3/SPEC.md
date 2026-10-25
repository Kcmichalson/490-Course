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
    rotations, bounds, descriptions, held/resting state, plus the table's
    Grids settings
  → HTTP POST to the Python bridge on 127.0.0.1
  → bridge converts to hex coordinates, computes distances and footprints,
    stores the latest snapshot and a history
  → GM reads it: GET /report (copy-paste), or later through a local MCP
    server (M4)
```

The bridge is local only. No externally reachable service, no tunnels, no
cloud hosting.

## 2. TTS side

- **Host only:** TTS runs Lua only on the host, so the bridge runs on the
  host's computer.
- **Tracking marker (replaces TTS tags, Session 1):** an object is tracked
  only if the first non-blank line of its description is `AIT: Unit`
  (mechs, NPCs, deployables), `AIT: Terrain` (cover and obstacles), `AIT:
  Hazard`, `AIT: Objective`, or `AIT: Calibration`, case-insensitive.
  Anything without it is ignored. This lets us mark or re-mark objects
  mid-game by editing the description. The Lua exporter sends objects
  whose first non-blank description line starts with `ait:`; the bridge
  parses the marker and warns about unknown kinds.
- **Description syntax (final, M2):** after the marker line, `Key: value`
  pairs separated by new lines, or by a comma only when another `Key:`
  follows. Keys are case-insensitive. Units: `Side`, `Size` (`1/2`, `½`,
  `0.5`, `1`–`4`), `HP`, `Heat`, `Structure` (`n` or `n/m`), and
  `Conditions` (a comma list; `none` or `-` for none). The condition
  `Flying` (any case) marks the unit as flying. Calibration markers:
  `Point` and `Hexes`. Unknown keys are kept and passed through; lines
  without a colon are kept as notes. Free text containing `, Word:` splits
  there.
- **Export triggers (decided M2):** a "Snapshot" button on the AIT Bridge
  object (only the host's clicks count) and a 5 s timer that starts when
  the script loads. A tick is skipped while a request is still pending.
- **Chat (decided M2):** host-only lines, with no repeats. Loaded; one
  offline notice until the bridge is reachable again, then one reconnect
  notice; a bridge rejection, once per distinct message; one confirmation
  per button press. Timer sends are silent.
- **Grids:** send the table's grid type, size, and offset with every
  payload. They're used only when there are no calibration markers at all.
- **Calibration markers (decided M2):** our table is a hex grid painted on
  a 3D terrain model, not TTS's built-in grid. Three `AIT: Calibration`
  markers sit on painted hex centers:
  - `Point: Origin`
  - `Point: A` + `Hexes: N`, along one hex row through Origin
  - `Point: B` + `Hexes: N`, along another row, 60° or 120° from A

  They give the grid's origin, spacing, and angle; positions use X and Z
  only. Lock them in TTS once placed. Validation, saving, and fallback are
  in §3.
- **Pedestals and flying (Session 1):** an airborne mini sits on a separate
  pedestal object placed under it. Leave pedestals unmarked. Flying is
  never inferred from height (the terrain varies in height); it's the
  condition `Flying`.
- **Held and moving objects:** the exporter sends each object's
  `held_by_color` and `resting` state (see §3).
- **Bundling (decided M2):** one hand-maintained file, `tts/exporter.lua`,
  pasted into the object script of a dedicated "AIT Bridge" object.
- Whether `WebRequest` reaches `http://127.0.0.1` from TTS is verified in
  the game in M2, not assumed.

## 3. Bridge

- Python standard library only; binds 127.0.0.1; port 8765, start.
- **Endpoints:**
  - `POST /tts`: receives the Lua payload
  - `GET /snapshot.json`: latest processed snapshot
  - `GET /report`: plain-text GM report (section 4)
  - `GET /health`: bridge status and time of the last TTS payload
- **Storage (decided M1, extended M2):** all in snapshots/ (git-ignored).
  - `latest.json`: the latest snapshot.
  - `history.jsonl`: append-only. A snapshot is recorded only when its
    board differs from the last recorded one (ignoring time, `seq`, raw
    world position/rotation, and held/moving state), and only when no
    marked unit is in motion.
  - `calibration.json`: the last valid calibration.
  - `last_payload.json`: the last raw POST body, for debugging.
- **In motion (M2):** a marked unit that's held or not resting is in
  motion, and while any unit is, history isn't appended. A unit in motion
  for more than 30 s gets a warning and stops blocking history. Only units
  count.
- **Calibration (M2):**
  - Lattice: q-vector = (A − Origin)/N_A. The r-vector is (B − Origin)/N_B
    when the rows are 60° apart, or the sum of both vectors when 120°.
  - Invalid if a point is missing or duplicated, there are more than 3
    markers, `Hexes` isn't a positive whole number, the spacings differ by
    more than 3%, or the angle is more than 3° off 60°/120°.
  - A valid calibration is saved. If every marker is within 0.25 hex of
    its saved position (same N), the saved one is kept unchanged.
  - Invalid markers → the last saved calibration plus a warning line. None
    saved → positions unavailable, never guessed.
  - No calibration markers at all → the TTS Grid.
- **Hex math:** axial (q, r) internally on a lattice (origin + q/r world
  vectors) from the calibration or the Grids settings; hex distance;
  footprints by LANCER Size: Size ½ and 1 = 1 hex,
  Size 2 = 3, Size 3 = 7, Size 4 = 12 (the Size 2 triangle plus every hex
  touching it: rows of 3, 4, 3, 2). Every footprint is placed by position
  only; a mini's rotation is kept as raw data and never changes its
  footprint. Size 2 and 4 are point-up or point-down depending on which hex
  corner the base sits on, so a flip (house rule: costs 1 movement) is a
  move, while turning in place isn't (shapes and reasons in LOG.md,
  Session 1 Decisions).
  Distances between units are measured between their nearest occupied
  hexes, adjacent = 1 (confirmed Session 1).
- Snapshots carry a `schema` version (2 since M2) and a `seq` number;
  payloads carry a separate `payload_version` (2 since M2).

## 4. GM report

Plain text written for an AI GM to read, compact enough to paste into a
chat:
- Header: snapshot time, schema version, and which grid is in use
  (calibrated, saved calibration, or TTS Grid) with its hex step and angle
- Alert lines when needed: calibration warning, positions unavailable,
  units in motion
- Units: name, axial hexes, size, `FLYING`, HP/Heat/Structure, conditions,
  side (description key `Side:`, decided M1; missing = `unknown`)
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
- In-game: calibration markers give a sensible hex step and angle; an
  invalid marker keeps the saved calibration with a warning
- In-game: moving a mini one hex changes its hex by exactly one; turning a
  Size 2 in place changes nothing; a flip changes its hexes
- In-game: a held mini shows as in motion; `Flying` shows per unit
- In-game: stopping the bridge produces one chat notice; restarting it
  resumes exports without reloading the save, with one reconnect notice

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
