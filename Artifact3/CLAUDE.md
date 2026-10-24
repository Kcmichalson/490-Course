# LANCER Tactical Board Bridge

A local tool that reads the battlefield from Tabletop Simulator (TTS) and
turns it into an exact, machine-readable snapshot (hex positions, distances,
terrain, objective, unit stats) so an AI GM can run LANCER combats without
screenshots. My friend Kilo and I move every miniature and roll every die;
the AI GM decides enemy actions and tracks rules and combat state. It's a
personal tool for our games, and we're the only users.

- Full feature spec, data flow, and milestones: SPEC.md
- Progress, plans, and changes: LOG.md (read it at the start of every session)

## Stack
- TTS side: Lua scripts run inside TTS (MoonSharp, Lua 5.2-compatible). The
  Lua is a thin exporter: it reads raw object data and sends it out. All
  math (hex conversion, distances, footprints) lives in Python so it can be
  tested outside the game
- Bridge: Python 3, standard library only (`http.server`, `json`,
  `unittest`). Prefer no dependencies. If one is truly needed, vendor it
  into lib/ and record why in LOG.md; never install packages
- Run locally: `py -m bridge` (from Artifact3/). The bridge binds to
  127.0.0.1 only, so it is reachable only from this computer. On this
  Windows machine `python3` is the Microsoft Store stub; use `py` (or
  `python`)
- Tests: `py -m unittest discover -s tests -v`. Name test files
  `test_*.py`. Tests run without TTS, using fixture snapshots in
  tests/fixtures/
- Lua can't be run outside TTS here. Lua changes are verified in the game
  by me, using a checklist you give me (see Workflow rules)

## TTS Lua notes (I'm an experienced programmer, but new to TTS Lua)
Don't over-explain general programming. Do explain TTS-specific quirks when
they come up, including:
- Global script vs. object scripts, and that scripts are stored inside the
  save file (editing a file on disk does nothing until it's loaded into TTS)
- No `require`, `io`, or `os.execute`. How the multi-file Lua source gets
  into TTS is a SPEC.md decision (bundling); don't assume one
- `WebRequest` is asynchronous (callback-based); check `is_error` and
  handle the bridge being offline without spamming chat
- `Wait.time` / coroutines for timers; never busy-wait
- How the `Grids` API (type, size, offset) maps to world coordinates.
  World space: X and Z are the table plane, Y is up
- Anything in TTS that behaves differently from standard Lua 5.2
When you aren't sure how a TTS API behaves, say so and make it something I
verify in the game, rather than presenting a guess as fact.

## Lives in the 490-Course repo
The project lives in the Artifact3/ folder of the 490-Course repo
(github.com/Kcmichalson/490-Course; the local folder is named
TCSS490-AI-Course). The repo is published by GitHub Pages, so every tracked
file is public.
- Everything for this project stays inside Artifact3/. Don't read or modify
  anything outside it unless I ask. Don't read my TTS folder; test data
  comes from payloads the bridge receives, saved as fixtures in
  tests/fixtures/
- Nothing private in tracked files: runtime snapshots, snapshot history,
  and tool logs stay git-ignored (snapshots/, tool-log/*.jsonl)
- File names are lowercase, and paths must match their casing exactly
  (GitHub is case-sensitive; my machine may not be)
- Never use file or folder names that start with an underscore (GitHub's
  Jekyll processing skips them). Python's `__init__.py` and `__main__.py`
  are the only exceptions
- All paths in code and docs are relative to Artifact3/
- No API keys, tokens, or secrets anywhere in the Lua or in anything that
  could be saved into a TTS save or uploaded to the Steam Workshop

## Project layout
- bridge/: Python package (`py -m bridge`)
  - bridge/server.py: HTTP endpoints
  - bridge/hexgrid.py: world ↔ hex conversion, distances, footprints (pure)
  - bridge/snapshot.py: snapshot schema, parsing, validation (pure)
  - bridge/report.py: the plain-text GM report (pure)
  - bridge/constants.py: tunable values and defaults
- tts/: Lua source for TTS
- tests/: Python unittest tests; tests/fixtures/ holds sample TTS payloads
- snapshots/: runtime output (latest snapshot + history), git-ignored
- tools/: dev scripts (standard library only)

## Core conventions
- Hex math lives in bridge/hexgrid.py; use it everywhere instead of
  re-deriving it. Internally use axial coordinates (q, r); also show a
  human-friendly label in reports
- Hex orientation and size come from the table's TTS `Grids` settings sent
  with each payload, never hard-coded
- Units: distances in hexes; TTS world positions in TTS units as received.
  Never mix the two without going through hexgrid.py
- Snapshots are JSON with a `schema` version number. Changing the schema
  means bumping the version and updating fixtures and SPEC.md
- The GM report is a stable, documented format. Changing it means updating
  its golden-file test and recording why in LOG.md
- Pure functions in hexgrid.py, snapshot.py, and report.py: no I/O, no
  globals, no clock reads. I/O happens only in server.py and the CLI
- Every LANCER rule implemented gets a short comment citing what rule it
  approximates. Never guess a LANCER rule (footprint shapes, range
  measurement, cover); ask me
- Tunable values live in one place: bridge/constants.py
- Don't use TTS's External Editor ports (39998/39999) for the bridge; the
  VS Code TTS extension uses them

## Workflow rules
- Work one milestone at a time, in SPEC.md order. The bridge must run and
  tests must pass after each
- Scope: build only what the milestone lists. Suggest extras in the plan
  instead of adding them
- Plan before coding each milestone; list ambiguities instead of guessing
- Never infer names, URLs, dates, or facts about me, Kilo, our campaign, or
  the course (repo names, links, deadlines, what I did or think); ask
- After each milestone: run tests, do that milestone's verification checks,
  update LOG.md (planned / changed / problems / checks), then stop and
  suggest a commit message
- Fix code, not test expectations, unless I approve changing an expectation
- You can't see TTS. For anything that needs the game, give me a short,
  numbered in-game checklist (what to set up, what to click, what I should
  see in chat and in the bridge output) and wait for my results
- When I need to check the bridge, start it for me and tell me the URL.
  For HTTP checks, use Python's standard library or a test, not curl
- Keep a prompt log in LOG.md for every session (format: "Session 1 prompt
  log"). For each of my prompts, including answers to multiple-choice
  questions and messages sent mid-task: quote it (condense long pastes into
  [brackets]), say what you provided, note honestly where you misread me and
  any root causes found, and add a "How It Was Verified" line for every fix.
  Update it before ending a turn that changed files
- Git: I commit and push myself with GitHub Desktop. Don't run git commands
  (no commits, branches, resets, or pushes) unless I ask
- Make targeted edits; don't rewrite working modules wholesale
- If the spec seems wrong or unclear, propose a change and record the
  decision in LOG.md before implementing it
- Every tool call is logged automatically to tool-log/ by a hook; don't
  edit or disable it
- After every sub-step, confirm each tool call you made appears in
  tool-log/ (timestamp and tool name); report any missing call before
  continuing
- One purpose per command: don't append extra commands (especially git) to
  a check
