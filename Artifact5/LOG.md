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
