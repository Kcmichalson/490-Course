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
  Still to confirm (see Decisions).
* **How It Was Verified:** n/a (no fix).

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

### Decisions (M1)
Recorded before implementing. "Unconfirmed" means I chose a default because
the question wasn't answered yet; each is one constant or one function to
change.
- **Tracking marker (your rule, Prompt 3):** the first description line,
  trimmed, must be `AIT: Unit|Terrain|Hazard|Objective` (any case, spaces
  around the colon allowed). Leading blank lines are not skipped (my
  default, Q8 unconfirmed). An unknown kind or an empty `AIT:` is skipped
  with a warning. The Lua side only pre-filters on the `ait:` prefix; the
  bridge decides.
- **Footprints (your rule, Prompts 2 and 5):** Size ½ = 1, Size 1 = 1,
  Size 2 = 3, Size 3 = 7, Size 4 = 12 hexes. Rotated in 60° steps from the
  mini's Y rotation; the footprint's centroid is placed nearest the mini's
  position. Shapes at rotation 0, in pointy-top view:
  ```
  Size 2      Size 3      Size 4 (rows 3,4,3,2)
  o o          o o          o o o
   o          o O o        o o o o
               o o          o o o
                             o o
  ```
  (row r=0 drawn on top; each row is offset half a hex from the next)
  Size 2 = triangle, Size 3 = flower, Size 4 = rows 3, 4, 3, 2 (confirmed
  in Prompt 7). Which TTS
  rotation counts as 0°, and whether +rotation turns the shape clockwise,
  are calibration constants (verify in M3). Size 5+ or an unreadable Size
  is skipped with a warning; a missing Size defaults to 1 with a warning.
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
- **Hex label (my default, Q6 unconfirmed):** `cXrY` = odd-r column/row
  (pointy-top) or odd-q (flat-top), shown after the axial pair, e.g.
  `(5,-3)c3r-3`.
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

**Problems / open questions**
- Still open (see Decisions): my defaults for skipping broken objects,
  the label format, and whitespace before the marker. Shapes, range, and
  "inside" were confirmed in Prompt 7; objective area in Prompt 11.
- TTS facts to verify in M2: the `Grid` vs `Grids` name, `Grid.type`
  values, what `sizeX/sizeY` and the offsets mean, axis direction, and
  `getPosition`/`getBounds` behavior. Rotation 0 and its direction are
  checked in M3 calibration.
- The expected snapshots and golden report were rendered by the code, then
  checked by hand against independently worked hexes, labels, distances,
  and zone counts (also asserted in test_snapshot.py). The golden needs
  your approval as the expectation.
- The preview pane sends `HEAD /`, which the bridge answers with 501.
  Harmless; noted, not changed.
- The live check left `snapshots/latest.json` and `snapshots/history.jsonl`
  (fixture data, git-ignored).
- Rulebook PDF unreadable here (no PDF renderer; installing is forbidden).

**Checks**
- `py -m unittest discover -s tests -v`: 59 tests, all OK. Covers both
  orientations, negative coordinates, Size ½/1/2/3/4 footprints in all six
  rotations, hand-checked distances, malformed payloads → 400, oversize →
  413, change-only history, restart reload, a 127.0.0.1-only bind, and a
  busy port failing.
- Live bridge (started in the background with the preview tool, stopped
  with preview_stop): GET /health → 200; POST payload_pointy.json → 200
  (seq 1, 4 units, no warnings); GET /report → 200, identical to the golden
  file except the real timestamp in the header line; POST `{broken json` →
  400 "invalid JSON …"; GET /health afterwards → 200 with
  last_payload_at set.
- Tool-log: every call this session appears with a requested line and an
  ok/failed line. The one `failed` is the deliberate malformed POST (the
  client exits 1 on HTTP 400). The rejected first ExitPlanMode has only a
  `requested` line, and the denied plan-file Write has no line, both as
  tool-log/README.md describes.
