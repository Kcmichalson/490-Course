# Project Log

A running record of what I planned and what changed. Newest entries at the
bottom. Claude Code updates this at the end of every milestone.

## Milestone status

- [x] M1 — Bridge core and hex math (rule questions still open: see
  Session 1 Decisions)
- [ ] M2 — TTS exporter
- [ ] M3 — Calibration on our real table
- [ ] M4 — GM access without copy-paste (local MCP server)
- [ ] M5 — Combat state and change log
- [ ] Later — Line of sight, cover, reaction triggers, action accounting,
  sitrep Objectives (escort/extract)

---

## [date] — Session 0: Planning (before any code)

**Planned**
- Project: a local bridge that reads our LANCER battlefield from Tabletop
  Simulator and gives the AI GM an exact snapshot (hex positions,
  distances, terrain, objective, stats) whenever I say "your turn."
- Origin: during a previous combat the GM had to reconstruct positions from
  angled screenshots and kept losing track of distances, terrain, and the
  objective. [Add what you want recorded about that session.]
- Approaches considered: hex coordinates in chat, an interactive website,
  a TTS Lua bridge, and a fully automated AI GM. Chose the TTS bridge, with
  copy-paste reports first and on-demand GM access later.
- Stack: TTS Lua (thin exporter) + Python standard-library bridge on
  127.0.0.1. All math in Python so it's testable without TTS.

**Changed**
- Dropped publishing the snapshot to an externally reachable service; the
  bridge stays local only. If the GM runs in Claude, a local MCP server
  (M4) covers on-demand access.
- [Anything carried over or discarded from the earlier prototype.]

**Problems / open questions**
- LANCER footprint shapes for Size 2+ and how they orient; range
  measurement between multi-hex units
- Whether TTS `WebRequest` reaches 127.0.0.1 (verify in M2)
- Lua bundling approach (M2)

**Next**
- Commit CLAUDE.md, SPEC.md, LOG.md, .claude/, tool-log/README.md, and
  .gitignore in GitHub Desktop.
- Start Claude Code: read all three, propose the M1 plan and file
  structure, and list ambiguities before writing code.

---

## 2026-10-24 — Session 1 prompt log (M1)

**AI Assistant:** Claude Code (Opus 5.5, `claude-opus-5-5`) in the Claude desktop app  
**Repository:** https://github.com/Kcmichalson/490-Course (folder `Artifact3/`)

Every prompt I sent this session, in order. Long pastes are condensed into
[brackets]. Answers I gave through Claude's multiple-choice questions count
as prompts. Each fix lists how it was verified.

### Prompt 1
* **User Prompt:**  
  > *"Read CLAUDE.md, SPEC.md, and LOG.md. Start a "Session 1 prompt log" in
  > LOG.md, and ask me for anything in the Session 0 entry marked [ ]
  > instead of filling it in. [Two pre-planning checks, one command each:
  > validate .claude/settings.json and list its hook events; confirm
  > tool-log/ has today's file with this session's session_start line and
  > every tool call. Then plan M1 only, no code: files, schema v1 with raw
  > payload and processed snapshot, world→hex for both orientations with TTS
  > unknowns, footprints and distance (ask, don't assume), storage and
  > sides, a sample GM report, test plan, non-blocking bridge start/stop,
  > ambiguities. Session rules: 127.0.0.1 only; never start a server as a
  > blocking command.]"*
* **What the AI Provided:** Ran both checks. settings.json is valid; its
  hook events are SessionStart, PreToolUse, PostToolUse, PostToolUseFailure,
  and PermissionDenied. tool-log/2026-10-24.jsonl has this session's
  `session_start` line, and every call so far appears as a requested/ok
  pair. Asked four multiple-choice questions (footprints, orientation,
  range, objective), then wrote the M1 plan covering all nine points.
* **Where the Model Misread Me:** The plan file couldn't be saved: Claude
  Code's plan file lives under `~/.claude/plans/`, which `.claude/settings.json`
  denies (`Edit(~/.claude/**)`). That's root cause, not a misread. The plan
  was given in chat instead. The Session 1 log couldn't be started during
  planning, because plan mode blocks edits. It was started right after
  approval.
* **How It Was Verified:** Check output shown in chat. The tool-log was
  read line by line. The denied Write left no log line, as
  tool-log/README.md says it should.

### Prompt 2 (sent mid-task)
* **User Prompt:**  
  > *"[attached the LANCER Core Rulebook PDF from Downloads] a size 1 is 1
  > hex, a size 2 is 3 hexes, a size 3 is 7 hexes. Here is the rule book for
  > your reference"*
* **What the AI Provided:** Tried to read the PDF and couldn't: no PDF
  renderer (poppler) is installed, and CLAUDE.md forbids installing one.
  Used the counts as given and asked for short pasted passages if rule text
  needs checking.
* **Where the Model Misread Me:** I treated "3 hexes" as a triangle and "7"
  as center + ring. Those shapes weren't stated (3 hexes could be a line).
  Confirmed later, in Prompt 7.
* **How It Was Verified:** n/a (no fix).
* **Correction (Prompt 12):** this rulebook Read is logged in
  tool-log/2026-10-24.jsonl as `requested` then **`failed`**, with the
  pdftoppm error. In chat I said it was logged as `ok`. Root cause: my
  check matched only the tool names in the log and never read the
  `status` field.

### Prompt 3 (plan rejected with a change)
* **User Prompt:**  
  > *"9. Change from SPEC §2: objects are marked for tracking in their
  > description, not by tags. The first line must be "AIT: Unit", "AIT:
  > Terrain", "AIT: Hazard", or "AIT: Objective" (case-insensitive).
  > Anything without it is ignored. Update SPEC and the payload contract.
  > This lets the player modify the units mid game to set stuff to be
  > treacked"*
* **What the AI Provided:** Revised the payload contract: no `tags` field,
  the marker is parsed by the bridge, and Lua pre-filters on an `ait:`
  prefix. Added marker tests to the plan, plus the SPEC wording changes.
  Asked Q8 (whitespace before the marker).
* **Where the Model Misread Me:** Nothing misread. The original plan
  followed SPEC's tags.
* **How It Was Verified:** SPEC.md §1, §2, and §6 updated (see Decisions);
  marker tests in tests/test_snapshot.py.

### Prompt 4
* **User Prompt:**  
  > *[Approved the revised plan through the plan-approval dialog.]*
* **What the AI Provided:** Started this log. Asked the open questions (range,
  objective, Size ½/4, broken objects) as multiple choice.
* **Where the Model Misread Me:** n/a.
* **How It Was Verified:** n/a.

### Prompt 5 (sent mid-task, instead of the multiple-choice answers)
* **User Prompt:**  
  > *"Size ½ = 1 hex. 2 = 3 hexes, 3 = 7 hexes, Size 4 = 12 hexes, arranged
  > in rows of 3, 4, 3, 2 (with appropriate hex-grid offsets). Support
  > rotating the footprint in 60-degree increments. Do not substitute the
  > Size 3 footprint."*
* **What the AI Provided:** Replaced the plan's rotation-free placement with
  shapes that rotate in 60° steps. Defined the Size 4 shape (diagram under
  Decisions). Removed the Size 4 → Size 3 fallback.
* **Where the Model Misread Me:** My plan proposed ignoring rotation and
  falling back to the Size 3 footprint for Size 4. Both were wrong for what
  you want. The exact stagger of the Size 4 rows is my reading of
  "appropriate hex-grid offsets" (to confirm).
* **How It Was Verified:** tests/test_hexgrid.py footprint tests (row
  counts 3,4,3,2; 12 distinct connected hexes; all six rotations).

### Prompt 6
* **User Prompt:**  
  > *"Can you confirm that you can read the rulebook placed in the
  > materials folder?"*
* **What the AI Provided:** Found `materials/Lancer - Core Rulebook.pdf`
  and tried to read it twice. With a page range it fails because no PDF
  renderer (poppler) is installed. Without a page range it fails because
  the file is over the 20 MB read limit. So I can't read it. Flagged that
  `.gitignore` doesn't exclude `materials/`, so the rulebook would become
  public on GitHub Pages if committed. I can't edit `.gitignore` (denied by
  settings).
* **Where the Model Misread Me:** n/a.
* **How It Was Verified:** Both read errors are shown in chat; the
  `materials/` gap was checked against the current `.gitignore`.

### Prompt 7
* **User Prompt:**  
  > *"other answers to open questions: size 2 is a triangle, yes. size 3 is
  > a flower. 4 is the 3 4 3 2. I think what you mean for range is
  > understandable. objective 'inside' means any unit hex is occupying any
  > part of the objective, but it might be hard to define what the
  > objective area is."*
* **What the AI Provided:** Recorded the shapes and range as confirmed.
  Applied the "any occupied hex" rule. The snapshot logic already filtered
  units that way; the report line now names the rule, e.g. "inside (any
  occupied hex in zone): Ironclad (1/3 hexes)". Updated SPEC.md §3 and §4,
  the code comments, and the golden report line. Asked how the objective
  area should be defined.
* **Where the Model Misread Me:** I read "understandable" as accepting the
  range rule; say so if you meant otherwise.
* **How It Was Verified:** 59 tests OK, including the golden report and
  the hand-checked zone membership in test_snapshot.py. The golden-file
  change follows directly from your rule.

### Prompt 8
* **User Prompt:**  
  > *"How does poppler work? Would it be better if the rulebook were
  > split?"*
* **What the AI Provided:** Explained that Poppler is an open-source PDF
  library with command-line tools: `pdftoppm` renders pages to images,
  which my Read tool needs for page ranges; `pdftotext` extracts text;
  `pdfseparate`/`pdfunite` split and join. Said splitting helps only if
  the pieces are small (under 20 MB, about 10 pages or fewer), and that
  reading a small PDF without Poppler was unconfirmed. Suggested a `.txt`
  excerpt, Edge's "Microsoft Print to PDF" for a page range, or installing
  Poppler yourself.
* **Where the Model Misread Me:** I said I couldn't extract text without
  Poppler, without first checking what was already installed. Git for
  Windows includes `pdftotext` (see Prompt 9).
* **How It Was Verified:** n/a (no fix).

### Prompt 9
* **User Prompt:**  
  > *"Can I just have you use pdftotext? seems a lot less computationally
  > expensive than pdftoppm"*
* **What the AI Provided:** Found `pdftotext` already installed with Git
  for Windows (`C:\Program Files\Git\mingw64\bin\pdftotext.exe`), so
  nothing was installed. Extracted the rulebook's text into Claude's
  session scratchpad, outside the repo, so it can't be committed. The text
  layer is good: 431 pages, about 187,000 words, searchable. It confirms
  Size ½ is rounded up to one space. Limit: anything shown only in figures
  (e.g. footprint diagrams) has no text.
* **Where the Model Misread Me:** n/a.
* **How It Was Verified:** Word, page, and keyword counts on the extracted
  text, plus a sample search for "hex".

### Prompt 10
* **User Prompt:**  
  > *"Yes, search the rulebook for how objectives and zones are defined and
  > summarize what it says, so we can decide the objective area."*
* **What the AI Provided:** Searched the extracted text. The relevant
  rules are the Sitreps in Section 5, The GM's Toolkit (book pp. 266–273).
  Summary (paraphrased):
  - Zones are areas: deployment, control (CZ), extraction, and ingress
    zones.
  - CZs are given as rectangles measured in spaces, typically 4×4
    (Control, Recon) or 10×5 (Holdout).
  - Control and Recon: one side alone in a CZ controls it; two or more
    sides contest it.
  - Gauntlet and Holdout count the characters inside a CZ.
  - A separate "Objective" is an object or person of Size ½–2 with HP and
    defenses. It works by adjacency: it moves with an adjacent character,
    stops when adjacent to opposing sides, and is extracted when adjacent
    to an extracting PC.
  - The text doesn't say whether a multi-space character counts as
    "within" a zone when only partly inside. Your any-hex rule (Prompt 7)
    covers that. The zone diagrams are images, so they have no text.

  Proposed keeping bounds with hex centers for zone area and treating
  sitrep Objectives (things you escort or extract) as their own case.
* **Where the Model Misread Me:** My earlier options (Radius key, or
  bounds with any overlap) didn't account for the rulebook's rectangular
  zones. With a tile sized to the zone, "any overlap" would add a ring of
  partly covered hexes.
* **How It Was Verified:** Read the Sitreps section of the extracted
  text.

### Prompt 11
* **User Prompt:**  
  > *"Yes: keep zone area as hex centers inside the tile's bounds, and
  > record it as decided. Treat sitrep Objectives (escort/extract objects)
  > as a separate later item."*
* **What the AI Provided:** Recorded the objective-area decision in
  Decisions, M1 Problems, and SPEC §4. Added sitrep Objectives to SPEC's
  "Later" milestone and to the milestone status list. No code changed:
  `hexgrid.hexes_in_rect` already uses hex centers.
* **Where the Model Misread Me:** n/a.
* **How It Was Verified:** No code change. The behavior is already
  covered by `test_hexes_in_rect_zone` and the Uplink zone check in
  `test_pointy_fixture_hand_checked`.

### Prompt 12
* **User Prompt:**  
  > *"Finishing M1: [1. Size 2 footprint bug: a corner is shared by exactly
  > 3 hexes, so rotation can't change a Size 2 triangle; make Size ½, 1, 2,
  > 3 position-only, keep 60° rotation for Size 4 only with a tolerance
  > near the snap boundary; add tests; record why. 2. Size 4 shape:
  > "[confirm the LOG.md drawing, or describe the fix]". 3. Report: axial
  > only, drop cXrY. 4. Allow blank lines before the AIT marker. 5. Golden
  > report: "[approved / changes]"; regenerate after 1 and 3 and show the
  > diff. 6. Clear snapshots/ after checks. 7. Session 0: "[date, notes on
  > the previous combat, prototype notes]". 8. Correct the prompt log: the
  > first rulebook Read is logged as "failed". 9. Record for M2, don't
  > build: hex grid painted on 3D terrain; calibration from three "AIT:
  > Calibration" markers, Grid settings as fallback; M3 checks for
  > elevation and tile seams.] Run the tests, update LOG.md, and stop."*  
  > *"10. Record for M2: airborne units sit on a pedestal [...] The
  > pedestal is [part of the mini / a separate object]. Don't infer flying
  > from height [...] flying is a description condition ("Conditions:
  > Flying"); the report shows it per unit, and same_board treats taking off
  > or landing as a change. In M3, check that minis on pedestals still
  > report the hex directly under their base."*
* **What the AI Provided:**
  - **Item 1:** Size ½, 1, 2, and 3 are placed by position only (new
    `hexgrid.nearest_hexes` for Size 2). Size 4 alone rotates, with 10° of
    hysteresis carried over from the previous snapshot. New tests: turning
    Size ½, 2, and 3 minis through 360° never changes their hexes; a Size
    4 jiggling past the 30° boundary keeps its step; Size 2 is always a
    triangle across a sweep of positions.
  - **Size 4 shape:** found that the 3-4-3-2 shape repeats every 120°, so a
    60° turn moves a Size 4 to another corner, the same flaw as item 1.
    Flagged it instead of changing your rule.
  - **Items 3, 4, 6, 8, 9, 10:** done or recorded as asked.
  - **Item 5:** regenerated the golden report and expected snapshots, and
    showed the diff in chat.
  - **Items 2, 5, 7, and 10's pedestal question:** left as questions,
    because their bracketed placeholders weren't filled in.
* **Where the Model Misread Me:** My first new Size 4 test assumed six
  distinct orientations. That's wrong for this shape; it failed, and the
  failure exposed the open issue above. The test now checks the shape's
  real symmetry instead. The test's premise was mine, not an expectation
  of yours.
* **How It Was Verified:** `py -m unittest discover -s tests`: 62 tests
  OK. The golden diff shows only the removed `cXrY` labels; every hex,
  distance, and zone count is unchanged. The expected-snapshot diff shows
  only `rotation_steps` → `null` for the Size 1, 2, and 3 units. A direct
  check confirmed which 60° rotations map the Size 4 shape onto itself
  (every second step).

### Prompt 13
* **User Prompt:**  
  > *"Item 2: the drawing is right. I checked the rulebook figure: Size 4 is
  > the Size 2 triangle plus every hex touching it (12 hexes). Make Size 4
  > position-only like Size 2: the 3 hex centers nearest the base position
  > plus every hex touching them. Remove rotation from footprints entirely,
  > along with the hysteresis, and keep the rotation field in the snapshot
  > only as raw data. Record in LOG.md that point-up vs point-down for Size
  > 2 and 4 is decided by which corner the base sits on, so a flip (a house
  > rule in our game, costing 1 movement) registers as a move, while
  > turning a mini in place doesn't. Update the tests, SPEC, and LOG.md."*
* **What the AI Provided:** Size 4 is now placed by position only
  (`hexgrid.corner_footprint`), and all rotation code and the hysteresis
  are gone. Units keep `rotation_y` as raw data. Recorded the
  point-up/point-down and flip rule in Decisions. Updated the tests, SPEC
  §3, and this log.
* **Where the Model Misread Me:** n/a. One process slip: my first attempt
  to back up the fixtures copied three files onto one scratchpad file
  (the folder didn't exist). The repo files weren't affected. I redid the
  backup before regenerating.
* **How It Was Verified:** `py -m unittest discover -s tests -v`: 59
  tests OK (see Checks). Golden report diff: no change. Expected-snapshot
  diff: only the `rotation_steps` lines removed.

### Prompt 14
* **User Prompt:**  
  > *"I approve tests/fixtures/report_pointy.txt as the golden report.
  > Record that in LOG.md."*
* **What the AI Provided:** Recorded the approval in M1 Problems / open
  questions and removed it from the open list. No code or fixture changed.
* **Where the Model Misread Me:** n/a.
* **How It Was Verified:** n/a (no fix). The approved file is the one
  `test_golden_report` and `test_report_matches_golden` passed against in
  Prompt 13.

### Decisions (M1)
Recorded before implementing. "Unconfirmed" means I chose a default because
the question wasn't answered yet; each is one constant or one function to
change.
- **Tracking marker (your rule, Prompts 3 and 12):** the first non-blank
  description line, trimmed, must be `AIT: Unit|Terrain|Hazard|Objective`
  (any case, spaces around the colon allowed). Blank lines before it are
  allowed (Prompt 12). An unknown kind or an empty `AIT:` is skipped with a
  warning. The Lua side only pre-filters on an `ait:` prefix (after skipping
  leading blank lines; see the M2 notes); the bridge decides.
- **Footprints (your rule, Prompts 2, 5, 7, 12, and 13):** Size ½ = 1,
  Size 1 = 1, Size 2 = 3, Size 3 = 7, Size 4 = 12 hexes. **Every size is
  placed by position only. Rotation never affects a footprint** (Prompt 13,
  replacing Prompt 5's 60° rotation and Prompt 12's Size 4 exception).
  - Hex-centered: Size ½ and 1 = the nearest hex; Size 3 = the nearest hex
    plus its 6 neighbors.
  - Corner-centered: Size 2 = the 3 hex centers nearest the base; Size 4 =
    those 3 plus every hex touching them. You checked this against the
    rulebook figure in Prompt 13.
  - **Why (Prompts 12 and 13):** a hex corner is shared by exactly 3 hexes,
    so a Size 2 base on a corner covers one fixed triangle, and Size 4 is
    that triangle plus its ring. Rotation can't change either. Using
    rotation to choose the orientation picked a different corner, so idly
    turning a mini could shift its footprint. That's why the hysteresis
    from Prompt 12 was removed too.
  - **Point-up vs point-down (Prompt 13):** for Size 2 and 4, this is
    decided by which corner the base sits on. A flip, which our house
    rules allow for 1 movement, means moving the base to the neighboring
    corner, so it registers as a move (a board change). Turning a mini in
    place doesn't.
  - The snapshot keeps `rotation_y` as raw data only. It's ignored by
    footprints and by `same_board`.
  Shapes, in pointy-top view (the two-on-top corner; the other corner gives
  the upside-down shapes, with Size 4 rows of 2, 3, 4, 3):
  ```
  Size 2      Size 3      Size 4 (rows 3,4,3,2)
  o o          o o          o o o
   o          o O o        o o o o
               o o          o o o
                             o o
  ```
  (row r=0 drawn on top; each row is offset half a hex from the next)
  Size 2 = triangle, Size 3 = flower, Size 4 = rows 3, 4, 3, 2 (confirmed
  in Prompt 7; drawing confirmed in Prompt 13). Size 5+ or an unreadable
  Size is skipped with a warning; a missing Size defaults to 1 with a
  warning.
- **Range (accepted in Prompt 7):** nearest occupied hex to nearest
  occupied hex, adjacent = 1, as SPEC §3 proposes. The report states the
  rule in its header.
- **Objective "inside" (your rule, Prompt 7):** a unit is inside if any of
  its occupied hexes is in the objective. The report lists those units,
  with how many of their hexes are in it, e.g. "Ironclad (1/3 hexes)".
- **Objective area (decided, Prompt 11):** an objective zone covers the
  hexes whose centers lie inside the XZ bounds of the tile marking it. Size
  the tile to the zone. This fits the rulebook's rectangular zones counted
  in spaces (Sitreps, pp. 266–273). Partly covered hexes don't count.
- **Sitrep Objectives (later item, Prompt 11):** escort/extract objects
  (Size ½–2, HP, adjacency rules) are a separate feature, not `AIT:
  Objective` zones. They aren't built in M1.
- **Broken marked object (my default, Q5 unconfirmed):** skipped with a
  warning, and the rest of the board is stored. Top-level structure errors
  return 400.
- **Hex label (your rule, Prompt 12):** the report shows axial `(q,r)`
  only; the `cXrY` label is dropped. This overrides CLAUDE.md's "also show
  a human-friendly label in reports". CLAUDE.md is edit-protected for
  Claude, so that line needs your edit.
- **Schema v1 edited in place (Prompts 12 and 13):** `rotation_steps` was
  added and then removed; units keep only the raw `rotation_y`. v1 hasn't
  been committed or used by anything yet, so it wasn't bumped to v2.
- **History storage (SPEC §3):** one append-only `snapshots/history.jsonl`,
  one full snapshot per line, appended only when the board changes.
  "Changed" ignores `received_at`, `seq`, and raw world position/rotation,
  so physics jitter that doesn't move a hex isn't recorded.
  `snapshots/latest.json` is rewritten atomically on every payload.
- **Sides (SPEC §4):** description key `Side:` (lowercased). A missing side
  becomes `unknown` with a warning. Opposing = different sides; `unknown`
  opposes everyone.
- **Description syntax (provisional until M2):** `Key: value` pairs split by
  newlines, or by a comma only when a new `Key:` follows. `a/b` becomes
  current/max for HP, Heat, Structure. Unknown keys pass through in
  `extra`; lines without a colon go to `notes`.
- **Objects' hexes:** terrain, hazard, and objective hexes are the hex
  centers inside the object's XZ bounds; if none, the hex under the center.
- **Schema additions:** `seq` (increments on each recorded change) and
  `payload_version` (Lua contract, separate from snapshot `schema`).

### Recorded for M2 and M3 (Prompt 12; not built)
- **Calibration from markers (M2):** our table is a hex grid painted on a
  3D terrain model, not TTS's built-in grid. M2 must support three `AIT:
  Calibration` markers: one on a hex center, and one N hexes along each of
  the two row directions. From them the bridge derives the grid origin,
  hex spacing, and angle. TTS Grid settings become the fallback.
  For the M2 plan:
  - How N is given (e.g. a key in each marker's description).
  - How the two direction markers are told apart.
  - That the painted grid may be rotated, which the current math doesn't
    handle.
  - That "Calibration" becomes a fifth AIT kind. Until then the bridge
    warns "unknown AIT kind".
- **Lua marker pre-filter (M2):** skip leading blank lines before checking
  for the `ait:` prefix, to match the bridge (Prompt 12, item 4).
- **Airborne units (M2):** airborne minis sit on a pedestal, so they're
  physically higher than other minis. Whether the pedestal is part of the
  mini or a separate object is **still to answer** (left as a placeholder
  in Prompt 12). Flying is never inferred from height, because the terrain
  itself varies in height. It's a description condition (`Conditions:
  Flying`), shown per unit in the report. `same_board` treats taking off
  or landing as a change. M1 already behaves this way, because conditions
  are shown in the report and are part of the board comparison.
- **M3 checks:**
  - **Elevation:** minis on high and low ground report the hex directly
    under their base.
  - **Tile seams:** hexes stay aligned across terrain-tile seams.
  - **Pedestals:** minis on pedestals report the hex directly under their
    base.

### M1 — Bridge core and hex math

**Planned**
- Schema v1, world → hex from the Grids settings (both orientations), hex
  distance, Size footprints with rotation, change-only history, the four
  endpoints, the GM report with a golden file, fixtures, and tests. No TTS.

**Changed**
- New: `bridge/` (`__init__`, `__main__`, `constants`, `hexgrid`,
  `snapshot`, `report`, `server`), `tests/` (four test files, 59 tests),
  `tests/fixtures/` (`payload_pointy.json`, `payload_flat.json`,
  `expected_snapshot_pointy.json`, `expected_snapshot_flat.json`,
  `report_pointy.txt`), `tools/bridge_client.py`.
- SPEC.md §1, §2, §3, §4, §6: AIT marker instead of tags, storage decided,
  footprints, sides, `seq`/`payload_version`.
- `.claude/launch.json`: added `"url": "http://127.0.0.1:8765"` so the
  preview opens 127.0.0.1 rather than `localhost` (which can resolve to
  ::1, where the bridge doesn't listen).
- Deviation from the plan: the planned `tools/post_fixture.py` became
  `tools/bridge_client.py`, which also does GETs and raw POSTs, so live
  checks need no curl.
- Windows detail: the server asks for exclusive use of its port
  (`SO_EXCLUSIVEADDRUSE`). Python's default `SO_REUSEADDR` on Windows lets a
  second bridge bind the same port silently. A test covers it.
- Prompt 12 changes:
  - Size ½, 1, 2, 3 placed by position only; Size 4 rotates with
    hysteresis (`build_snapshot` now takes the previous snapshot).
  - `hexgrid.label` removed; the report shows axial only.
  - Blank lines allowed before the marker.
  - Constants: `NEAREST_HEXES`, `SIZES`, `ROTATING_SIZES`,
    `ROTATION_HYSTERESIS_DEG`.
  - Golden report and expected snapshots regenerated; 62 tests.
  - `snapshots/` cleared.
- Prompt 13 changes:
  - Size 4 placed by position only too: new `hexgrid.corner_footprint`
    (the nearest-3 triangle plus N rings of touching hexes).
    `constants.CORNER_RINGS = {2: 0, 4: 1}` replaces `NEAREST_HEXES` and
    the Size 4 entry in `FOOTPRINTS`.
  - Removed all rotation code: `rotate`, `rotation_steps`, the hysteresis,
    the rotation constants and warning, `build_snapshot`'s `previous`
    argument, and the snapshot's `rotation_steps`.
  - Expected snapshots regenerated (only `rotation_steps` removed); golden
    report unchanged.

**Problems / open questions**
- Still open (see Decisions):
  - Session 0 placeholders.
  - Whether the pedestal is part of the mini or a separate object.
  - My default for skipping broken objects.

  Resolved: shapes, range, and "inside" (Prompt 7); objective area
  (Prompt 11); labels and blank lines before the marker (Prompt 12);
  Size 4 shape and position-only footprints (Prompt 13); golden report
  approved (Prompt 14).
- TTS facts to verify in M2: the `Grid` vs `Grids` name, `Grid.type`
  values, what `sizeX/sizeY` and the offsets mean, axis direction, and
  `getPosition`/`getBounds` behavior. (No rotation calibration is needed
  any more: footprints ignore rotation, Prompt 13.)
- The expected snapshots and golden report were rendered by the code, then
  checked by hand against independently worked hexes, labels, distances,
  and zone counts (also asserted in test_snapshot.py). **Golden report
  approved (Prompt 14):** `tests/fixtures/report_pointy.txt`, as it stood
  after Prompt 13, is the expected output. Changing it from now on needs
  your approval and a LOG.md entry saying why.
- The preview pane sends `HEAD /`, which the bridge answers with 501.
  Harmless; noted, not changed.
- The live check left `snapshots/latest.json` and `snapshots/history.jsonl`
  (fixture data, git-ignored). Both deleted in Prompt 12.
- Rulebook PDF: can't be rendered (no pdftoppm), but its text is readable
  through the `pdftotext` that comes with Git for Windows (Prompt 9).
  `materials/` isn't in `.gitignore` yet.

**Checks**
- `py -m unittest discover -s tests -v`: 59 tests, all OK. Covers both
  orientations, negative coordinates, Size ½/1/2/3/4 footprints in all six
  rotations, hand-checked distances, malformed payloads → 400, oversize →
  413, change-only history, restart reload, a 127.0.0.1-only bind, and a
  busy port failing.
- After Prompt 13: 59 tests, all OK. The rotation and hysteresis tests
  were removed. Added: turning any size (½ through 4) in place through 360°
  never changes its hexes, adds no warning, and isn't a board change;
  Size 4 placed on a corner equals the LOG.md drawing (rows 3,4,3,2), and
  the other corner gives rows 2,3,4,3; a flip to the neighboring corner
  changes Size 2 and Size 4 hexes and is a board change; Size 2 and 4 are
  valid (3 and 12 connected hexes) across a sweep of positions; Size 4 is
  the triangle plus every hex touching it.
- After Prompt 12: 62 tests, all OK. Adds: rotation-independence for Size
  ½/2/3, Size 4 hysteresis at the snap boundary, the Size 2 triangle across
  a position sweep, and blank lines before the marker. The live bridge
  wasn't rerun (Prompt 12 asked for tests only); the server tests cover
  the endpoints.
- Live bridge (started in the background with the preview tool, stopped
  with preview_stop): GET /health → 200; POST payload_pointy.json → 200
  (seq 1, 4 units, no warnings); GET /report → 200, identical to the golden
  file except the real timestamp in the header line; POST `{broken json` →
  400 "invalid JSON …"; GET /health afterwards → 200 with
  last_payload_at set.
- Tool-log: every call this session appears with a requested line and an
  ok/failed line. Two are `failed`: the first rulebook Read (pdftoppm
  missing; corrected in Prompt 12, since this line first named only one)
  and the deliberate malformed POST (the client exits 1 on HTTP 400). The
  rejected first ExitPlanMode has only a `requested` line, and the denied
  plan-file Write has no line, both as tool-log/README.md describes.
