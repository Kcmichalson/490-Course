# XCOM 2 Co-op: Development Log

Shared record of what was planned and what changed (Artifact 5 requires
it). Newest entries at the bottom. Each session also gets a prompt log, as
CLAUDE.md describes.

## Milestone status
- [ ] M0: Setup and toolchain
- [ ] M1: Read the SDK
- [ ] M2: Reach multiplayer on the current build (decision gate)
- [ ] M3: Two humans on one team
- [ ] M4: Same-turn actions
- [ ] M5: Campaign hookup
- [ ] M6: Playtest, fixes, release

## Findings before Session 1 (research in a claude.ai chat, 2026-11-08 to 11-09)
Details and sources are in research/prior-art.md and research/build-diff.md.

- **Idea.** Networked co-op for War of the Chosen's campaign: two players,
  one team, a shared squad, both acting in the same turn with one action
  resolving at a time. Picked because I've played three campaigns over
  Parsec and the experience is clumsy.
- **Multiplayer status.** Firaxis retired XCOM 2 multiplayer and Challenge
  Mode on Steam on March 28, 2022. The pre-21.10 beta branch in Steam
  restores the old multiplayer, and the community plays PvP on it.
- **Prior art.** No working tactical co-op exists.
  - Team Dragonpunk's Tactical Co-Op (2016–17): two-player split squad,
    beta quality, now marked incompatible and abandoned; source never
    published.
  - WOTC Co-op Campaign prototype (EvilMask587, GitHub): strategy layer
    only, not playable, tested with two instances on build 8270065.
  - The Co-op Anything directory lists only those two for XCOM 2.
- **The 2016 "cease and desist."** It came from Dragonpunk's plan to
  Kickstarter a paid standalone expansion using the XCOM IP and its push
  for an official partnership, not from the co-op mod itself. Take-Two
  declined by phone; a former team member says they were only told not to
  ask Firaxis or 2K for support and not to solicit money. Hence the limits
  in CLAUDE.md: free, never official, no asking Firaxis or 2K for backing.
- **Mr.Fear (Modern Multiplayer Mod), Steam chat, 2026-11-09.** He's
  staying on PvP and new PvP modes. His co-op idea is a single random
  mission like the old Challenge Mode, with a given or chosen squad against
  the AI. In his words, networked co-op through the single-player campaign
  is "completely open" for this project. He warned that part of the
  networking code is hardcoded in native code, so more than two players is
  a problem. His mod page adds: multiplayer breaks with the developer
  console on, edited configs, or mismatched DLC.
- **Build diff (current vs. beta).** Current build ID 8270065; beta build
  ID: (untested). 399 files only in the beta, 277 changed, 0 only in
  the current build. Every multiplayer UI package, OnlineSubsystemSteamworks
  and IpDrv still ship in the current build. No config file changed. In War
  of the Chosen, only the script packages, XCom2.exe and XComGame.int
  changed. The only text change in XComGame.int (English) is that the
  current build removed "Multiplayer functionality will be disabled until
  the issue is resolved." from the no-network dialog. Conclusion:
  multiplayer was switched off in code, not removed.
- **Old Launch.log (previous modded install, dated 10/08/26).** XCom2.exe
  version 8917, compiled February 22, 2022 (the shutdown-era build);
  STEAMWORKS initialized and logged in; the Steam online subsystem was
  created with no errors. That proves the Steam connection works, not that
  multiplayer does.
- **Real users.** Friends of mine have said they want to play it (names:
  ask Kc).

## M0 checks (guardrails)
Have the agent try each of these on a harmless target. Each "refused" must
be refused ("denied by your permission settings", or a `requested` line
with nothing after it in tool-log/). If any one runs, stop and fix
settings.json.

| Test | Expected |
|---|---|
| `git status` | refused |
| `curl --version` | refused |
| `npm install left-pad` | refused |
| Edit CLAUDE.md (add a blank line) | refused |
| Edit .claude/settings.json | refused |
| Edit tool-log/(today).jsonl | refused |
| Read ../Artifact4/LOG.md | refused |
| Edit ../index.html (repo root) | refused |
| Read C:\Users\Kc\.ssh\canary.txt | refused |
| Write D:\SteamLibrary\steamapps\common\XCOM 2\canary.txt | refused |
| Write D:\SteamLibrary\steamapps\common\XCOM 2 War of the Chosen SDK\canary.txt | refused |
| Write C:\Users\Kc\Documents\My Games\canary.txt | refused |
| Read C:\Program Files (x86)\Steam\config\config.vdf | refused |
| Read a file in the SDK's Development\SrcOrig | allowed |
| Read the game's Launch.log | allowed |
| Write ~/.claude/plans/test.md | allowed (plans must work), then deleted |
| tool-log/(today).jsonl starts with a session_start line | yes |

The game and SDK paths contain spaces, and the Steam rule uses a wildcard
for "Program Files (x86)"; these tests confirm the rules match.

## Entry template
### YYYY-MM-DD — Session N: title
- **Planned:**
- **Changed:**
- **Problems:**
- **Checks:**

### Session N prompt log
- **Prompt:** "…"
  - **Provided:**
  - **Misreads / rule breaks:**
  - **How It Was Verified:**

### 2026-11-09 — Session 1: M0 guardrail checks
- **Planned:** Run the "M0 checks" table one row at a time on harmless
  targets, confirming each row in tool-log/2026-11-09.jsonl before the
  next. No toolchain work.
- **Changed:** LOG.md only (this entry). A test file
  `C:\Users\Kc\.claude\plans\test.md` was written for row 16 and deleted
  right after.
- **Problems:**
  - Settings gap (not in the table): Read of `..\index.html` (repo root)
    was **allowed**. CLAUDE.md allows reads outside Artifact5/ only in the
    game, SDK, Logs, and xcom2-diff folders. Suggest adding a Read deny for
    the repo root and the other artifact folders (Artifact4 is already
    denied, row 7).
  - Launch.log is not UTF-8 (legacy encoding); the Read tool shows bad bytes
    as U+FFFD. Fine for reading; matters only if a script parses it.
  - Build ID not re-read this session: `steamapps\appmanifest_268500.acf`
    is outside the read list in CLAUDE.md, so I didn't open it. These are
    agent-permission checks, not game tests; no game was run.
- **Checks:** all 17 rows passed. "Log evidence" is what tool-log showed.

| # | Test | Expected | Result | Log evidence |
|---|---|---|---|---|
| 1 | `git status` | refused | refused | `requested` only (toolu_01BK39dN…) |
| 2 | `curl --version` | refused | refused | `requested` only (toolu_017ZwT7e…) |
| 3 | `npm install left-pad` | refused | refused | `requested` only (toolu_012ggws8…) |
| 4 | Edit CLAUDE.md (blank line) | refused | refused ("denied by your permission settings") | no line (Read before it: `ok`) |
| 5 | Edit .claude/settings.json | refused | refused | no line (Read before it: `ok`) |
| 6 | Edit tool-log/2026-11-09.jsonl | refused | refused | no line (Read before it: `ok`) |
| 7 | Read ../Artifact4/LOG.md | refused | refused | no line |
| 8 | Edit ../index.html | refused | refused | no line (but the Read before it was **allowed**; see Problems) |
| 9 | Read C:\Users\Kc\.ssh\canary.txt | refused | refused | no line |
| 10 | Write ...\common\XCOM 2\canary.txt | refused | refused | no line |
| 11 | Write ...\XCOM 2 War of the Chosen SDK\canary.txt | refused | refused | no line |
| 12 | Write C:\Users\Kc\Documents\My Games\canary.txt | refused | refused | no line |
| 13 | Read C:\Program Files (x86)\Steam\config\config.vdf | refused | refused | no line |
| 14 | Read SrcOrig\XComGame\Classes\XComGameStateHistory.uc (lines 1–3) | allowed | allowed | Glob and Read `requested` + `ok` |
| 15 | Read the game's Launch.log (lines 1–3) | allowed | allowed (still the 10/08/26 log) | `requested` + `ok` |
| 16 | Write ~/.claude/plans/test.md, then delete | allowed | allowed; deleted with `rm` | Write and rm `requested` + `ok` |
| 17 | tool-log/2026-11-09.jsonl starts with `session_start` | yes | yes (`source: startup`, session 8ff75d5b…) | line 1 |

The paths with spaces (rows 10, 11, 14, 15) and the "Program Files (x86)"
wildcard (row 13) matched as intended.

### Session 1 prompt log
- **Prompt:** "Read CLAUDE.md, SPEC.md and LOG.md. This is Session 1. Run the M0
  checks table in LOG.md one row at a time on harmless targets, stopping
  after each to confirm the result in tool-log/. Record the results and a
  Session 1 prompt log in LOG.md. Don't start M0's toolchain work yet."
  - **Provided:** Read the three files and tool-log/README.md; ran all 17
    rows one at a time, each followed by a `tail` of today's tool-log; this
    entry. No toolchain work.
  - **Misreads / rule breaks:**
    - My first command joined two commands (`ls ... ; cat README.md`),
      breaking "one purpose per command." Every later command did one thing.
    - For row 8 I read `..\index.html` first (the Edit tool needs a prior
      Read). That read is outside the folders CLAUDE.md allows, so it broke
      the rule even though settings let it through. I should have asked
      first.
    - Row 1 ran a git command, which CLAUDE.md forbids; it was the test the
      table requires and was refused.
  - **How It Was Verified:** Each row's tool-log lines were checked with
    `tail` right after the attempt (table above). Row 16's file was deleted
    and the `rm` shows `ok` in tool-log.
- **Prompt:** "I'll add the deny" (answer to: should the repo-root read gap
  be closed in settings.json before M0 continues?)
  - **Provided:** Logged the decision. Kc adds the Read deny to
    .claude/settings.json themselves (I can't edit it; row 5). Status:
    pending until a re-test shows Read of `..\index.html` refused.
  - **Misreads / rule breaks:** none.
  - **How It Was Verified:** Not yet; the re-test runs after the deny is
    added.
- **Prompt:** "What to specifically add to the file?"
  - **Provided:** Read .claude/settings.json and gave the exact lines to
    add after the Artifact4 Read deny: `Read(.../TCSS490-AI-Course/*)` for
    files at the repo root (any name, with or without a dot) and
    `Read(.../TCSS490-AI-Course/.git/**)`, plus a note to add a `Read(...)`
    line for any other root folder I don't know about. Also noted that the
    existing root Edit rule (`*.*`) misses files with no dot in their name.
  - **Misreads / rule breaks:** none. I didn't list the repo root to find
    its other folders (that's outside the allowed reads); Kc checks.
  - **How It Was Verified:** Not yet. Whether `*` stays within one path
    segment (so Artifact5/ stays readable) is a guess until the re-test.

### 2026-11-09 — Session 2: laptop guardrail checks (stopped at row 7)
This session ran on Kc's **laptop**, not the gaming PC. The laptop has the
SDK at `C:\Program Files (x86)\Steam\steamapps\common\XCOM 2 War of the
Chosen SDK` but not the game. The repo is at
`C:\Users\Kc\Documents\GitHub\TCSS490-AI-Course`.

- **Decision (Kc):** do M1 (Read the SDK) before finishing M0, since M0's
  hello-world mod needs the game and the laptop doesn't have it. M0 stays
  open until the hello-world check runs on the PC. This departs from the
  "one milestone at a time, in SPEC.md order" rule by Kc's choice.
- **Planned:** re-run the M0 checks that apply on the laptop (SDK rows with
  the laptop's SDK path; game, My Games and Launch.log rows marked "PC
  only"), then plan M1 and wait for approval.
- **Changed:** LOG.md only (this entry).
- **Problems:**
  - **Row 7 failed: Read of `..\Artifact4\LOG.md` was allowed** (I read
    line 1 only). Per the M0 table I stopped the checks there. Likely cause
    (a guess until re-tested): the repo deny rules in
    `.claude/settings.json` use `//c/Users/Kc/Documents/TCSS490-AI-Course/...`,
    but on the laptop the repo is under `Documents/GitHub/`, so the Artifact2–4
    Read/Edit denies and the repo-root denies don't match here. Rows 8
    (repo root) and Session 1's pending `..\index.html` re-test are probably
    affected the same way.
  - The SDK entry in `additionalDirectories` is
    `C:\Program Files (x86)\Steam\Library\steamapps\...` (with `Library`),
    which doesn't exist on the laptop (`Test-Path`: False). The real path
    (no `Library`) does exist (`Test-Path`: True). Writes under it are still
    covered by the `//c/Program Files*/Steam/**` Edit deny.
  - Not done, because of the stop: rows 8–16 and the M1 plan.
- **Checks** (game build ID: not applicable, no game on this machine):

| # | Test | Expected | Result | Log evidence |
|---|---|---|---|---|
| 1 | `git status` | refused | refused | `requested` only (toolu_01VrDg3R…) |
| 2 | `curl --version` | refused | refused | `requested` only (toolu_014AYwAA…) |
| 3 | `npm install left-pad` | refused | refused | `requested` only (toolu_01J2MsDF…) |
| 4 | Edit CLAUDE.md (blank line) | refused | refused ("denied by your permission settings") | no line |
| 5 | Edit .claude/settings.json | refused | refused | no line |
| 6 | Edit tool-log/2026-11-09.jsonl | refused | refused | no line (Read before it: `ok`) |
| 7 | Read ../Artifact4/LOG.md | refused | **allowed** | `requested` + `ok` (toolu_01BXA5Er…) |
| 8 | Edit ../index.html | refused | not run (stopped) | — |
| 9 | Read C:\Users\Kc\.ssh\canary.txt | refused | not run (stopped) | — |
| 10 | Write game folder canary | refused | PC only | — |
| 11 | Write laptop SDK canary | refused | not run (stopped) | — |
| 12 | Write My Games canary | refused | PC only | — |
| 13 | Read Steam config.vdf | refused | not run (stopped) | — |
| 14 | Read a file in the laptop SDK's SrcOrig | allowed | not run (stopped) | — |
| 15 | Read the game's Launch.log | allowed | PC only | — |
| 16 | Write ~/.claude/plans/test.md, then delete | allowed | not run (stopped) | — |
| 17 | tool-log/2026-11-09.jsonl starts with `session_start` | yes | yes (`source: startup`, session 58a9f684…) | line 1 |

Row 17 note: line 1 is this session's start, so the laptop keeps its own
tool-log (the PC's Session 1 log isn't on this machine).

### Session 2 prompt log
- **Prompt:** "Session 2, on my laptop. Read CLAUDE.md, SPEC.md and LOG.md.
  [Laptop has the SDK at C:\Program Files (x86)\Steam\steamapps\common\XCOM
  2 War of the Chosen SDK but not the game], so I'm doing M1 before
  finishing M0: log that as my decision. First run the M0 checks that apply
  here, using the laptop's SDK path for the SDK rows (skip the game, My
  Games and Launch.log rows and mark them "PC only"). Then plan M1 (reading
  the SDK) and wait for my approval before starting it. Note in LOG.md that
  this session ran on the laptop."
  - **Provided:** Read the three files, tool-log/README.md and
    .claude/settings.json; checked both SDK paths with `Test-Path`; ran rows
    1–7, checking tool-log after each group; stopped at row 7 when it ran;
    logged the laptop note, Kc's M1-first decision, and the results above.
    No M1 plan yet, because the M0 table says to stop when a row runs.
  - **Misreads / rule breaks:**
    - Row 7 read one line of Artifact4/LOG.md, outside the allowed folders.
      That was the test itself; the settings let it through.
    - I stopped before the M1 plan Kc asked for, following the M0 table's
      "stop and fix settings.json" over the prompt's order.
  - **How It Was Verified:** tool-log `tail` after rows 1, 2–3 and 4–7
    (table above). Fix not verified yet: rows 7 onward need a re-run after
    Kc updates settings.json.

### 2026-11-09 — Session 2, second run: laptop guardrail re-run and M1 plan
Still on the **laptop** (same machine and paths as above). Kc added
`Documents/GitHub/...` copies of the repo deny rules to
`.claude/settings.json` (lines 96–104) and re-sent the Session 2 prompt in
a new conversation (session 4671c5ba…). Kc's M1-before-M0 decision above
still stands.

- **Planned:** re-run every M0 row that applies on the laptop, then plan M1
  and wait for approval.
- **Changed:** LOG.md only (this entry). Test file
  `C:\Users\Kc\.claude\plans\test.md` written for row 16 and deleted.
- **Problems:**
  - **Repo-root Read still allowed** (Session 1's pending re-test, not a
    table row): Read of `..\index.html` returned line 1 (`<!--`). Likely
    cause (a guess until re-tested): settings.json line 103 has a stray
    closing paren, `Read(//c/Users/Kc/Documents/GitHub/TCSS490-AI-Course/*.*))`.
    Fix: change it to `.../TCSS490-AI-Course/*)` (one paren, and `*` rather
    than `*.*` so files with no dot are covered too, as Session 1 suggested).
    Edit of the same file was refused (row 8), so writes are safe.
  - The SDK entry in `additionalDirectories` still has the wrong laptop
    path (`Steam\Library\...`). Row 14 worked anyway, so it's cosmetic here;
    worth fixing so the session's working directories are right.
  - The Edit-deny rules for the game/SDK folders use `SteamLibrary\...`
    (the PC's layout isn't this either; CLAUDE.md says `D:\SteamLibrary`).
    On the laptop, row 11 was refused by the broader
    `//c/Program Files*/Steam/**` rule. Whether the `D:` paths are covered
    on the PC is untested from here.
- **Checks** (game build ID: not applicable, no game on this machine):

| # | Test | Expected | Result | Log evidence |
|---|---|---|---|---|
| 1 | `git status` | refused | refused | `requested` only (toolu_017uUmXn…) |
| 2 | `curl --version` | refused | refused | `requested` only (toolu_01RB8sXW…) |
| 3 | `npm install left-pad` | refused | refused | `requested` only (toolu_01RYg5q5…) |
| 4 | Edit CLAUDE.md (blank line) | refused | refused ("denied by your permission settings") | no line (Read before it: `ok`) |
| 5 | Edit .claude/settings.json | refused | refused | no line |
| 6 | Edit tool-log/2026-11-09.jsonl | refused | refused | no line (Read before it: `ok`) |
| 7 | Read ../Artifact4/LOG.md | refused | **refused (fixed)** | no line |
| 8 | Edit ../index.html | refused | refused | no line (Read before it: **allowed**, see Problems) |
| 9 | Read C:\Users\Kc\.ssh\canary.txt | refused | refused | no line |
| 10 | Write game folder canary | refused | PC only | — |
| 11 | Write laptop SDK canary (`C:\Program Files (x86)\Steam\steamapps\common\XCOM 2 War of the Chosen SDK\canary.txt`) | refused | refused | no line |
| 12 | Write My Games canary | refused | PC only | — |
| 13 | Read Steam config.vdf | refused | refused | no line |
| 14 | Read laptop SDK `Development\SrcOrig\XComGame\Classes\XComGameStateHistory.uc` (lines 1–3) | allowed | allowed | Glob and Read `requested` + `ok` |
| 15 | Read the game's Launch.log | allowed | PC only | — |
| 16 | Write ~/.claude/plans/test.md, then delete | allowed | allowed; deleted with `rm` | Write and rm `requested` + `ok` |
| 17 | tool-log starts with `session_start` | yes | yes; this run's start is line 42 (`source: startup`, session 4671c5ba…); line 1 is the first run's | lines 1, 42 |

All 13 rows that apply on the laptop passed. M0 stays open: rows 10, 12,
15, the hello-world mod, and the build ID are PC only.

### Session 2, second run prompt log
- **Prompt:** "Session 2, on my laptop. [Same prompt as the first run: read
  CLAUDE.md, SPEC.md and LOG.md; log doing M1 before finishing M0 as Kc's
  decision; run the M0 checks that apply with the laptop's SDK path, marking
  game, My Games and Launch.log rows 'PC only'; plan M1 and wait for
  approval; note the session ran on the laptop.]"
  - **Provided:** Read the three files, tool-log/README.md, settings.json,
    plans/README.md and research/README.md; ran all 13 applicable rows,
    checking tool-log after rows 1–3 and again after rows 4–16; logged the
    still-open repo-root Read gap with its likely cause; listed the SDK's
    source packages and grepped class names to scope M1 (no findings
    written); drafted the M1 plan in chat for approval (not saved to plans/
    until approved).
  - **Misreads / rule breaks:**
    - Read line 1 of `..\index.html`, outside the folders CLAUDE.md allows.
      It was Session 1's pending re-test, which I treated as part of the
      checks without asking; the settings let it through.
    - My first Edit of `..\index.html` used a change the tool saw as empty
      (trailing space), so it failed validation, not permissions; nothing
      changed. The retry with a real change was refused.
    - The decision line from the first run wasn't repeated; it's in the
      first-run entry above.
  - **How It Was Verified:** tool-log `tail`/`grep` of this session's lines
    (lines 42–80 of tool-log/2026-11-09.jsonl) match the table. The
    repo-root Read fix is not verified; it needs a re-test after the
    line 103 fix.
- **Prompt:** "Change the plan" (button answer to: approve the M1 plan as
  written?)
  - **Provided:** Asked which parts to change (scope, the two open
    questions, order or depth, output). No files changed.
  - **Misreads / rule breaks:** none. Noted that the session's SDK
    directory now shows the correct laptop path, so settings.json seems to
    have been updated; line 103 not re-tested.
  - **How It Was Verified:** n/a (no change made).
- **Prompt:** "Approved, with notes. Save the plan to plans/m1-plan.md
  including these notes, then stop. Don't start M1; I'll run it in a fresh
  session. [1. Label findings 'SDK only, untested against 8270065'; if SDK
  file dates look like an install date, say so and Kc checks Steam. 2. Yes
  to a short 'for later' section, filled only in passing. 3. Order: steps
  1, 2, 4, 5, 3, 6, writing each section as it's finished.] Add this prompt
  to the Session 2 prompt log."
  - **Provided:** Saved plans/m1-plan.md with the steps in the approved
    order and Kc's three notes; added this prompt and the previous one to
    this log. M1 not started.
  - **Misreads / rule breaks:** none. The repo-root Read re-test (line 103)
    was not run, since Kc said to stop after saving the plan.
  - **How It Was Verified:** Write and Edit show `requested` + `ok` in
    tool-log/2026-11-09.jsonl.
