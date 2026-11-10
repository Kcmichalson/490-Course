# XCOM 2 Co-op: Specification (v0, draft)

## 1. Purpose
I want to play XCOM 2: War of the Chosen's campaign cooperatively with a
friend over the network. Today the only way is screen sharing (Parsec): I've
done about three playthroughs that way, with one person running the
strategy layer and both taking turns on designated soldiers in tactical
combat. It works, but the latency and sharing one mouse and keyboard make
it cumbersome.

This project explores the game's code to see whether real networked co-op
is possible, and builds as much of it as five weeks allow. A moonshot can
fall short; the answer to "is it possible, and what blocks it" is a valid
result.

**Success test (my decision):** two friends who've played co-op over
Parsec find this better: each uses their own mouse, keyboard and screen,
there's no streaming lag, and each controls their own soldiers without
handing over control.

Artifact 5 requirements this covers: a five-week attempt at something big,
scaffolded to last (this file, CLAUDE.md, plans/), a log of plans and
changes (LOG.md), deployed where real users can reach it if it gets that
far (section 6, M6), shown at the final show and tell, and a portfolio card.

## 2. Who it's for (my decisions)
- Me, and friends of mine who have said they want to play it. Their names
  and how many: ask me
- They are the first playtesters (M6). Record what they liked, what
  confused them, and what they'd change, in their words, in LOG.md
- Others in the XCOM 2 multiplayer community only if it gets far enough to
  publish

## 3. Co-op design (my decisions, to refine)
| Topic | Decision |
|---|---|
| Players | Two. More is a known native-code problem (Mr.Fear) |
| Team | Both players are on XCOM's side, against the AI |
| Squad | One shared squad. Each soldier is assigned to one player (what we already do over Parsec) |
| Turns | Both players can act during XCOM's turn. One action resolves at a time: while one player's action is resolving, the other waits |
| Ending the turn | XCOM's turn ends when both players have ended it |
| Campaign | The host's campaign. The guest joins its tactical missions; mission results (XP, wounds, deaths, loot) stay in the host's campaign |
| Strategy layer | The host runs it, as over Parsec. Shared strategy play is a stretch goal |
| Game version | The current Steam build if multiplayer can be reached on it (M2); otherwise the pre-21.10 beta branch, which takes two clicks in Steam |

Open: whether either player may control an unassigned soldier, who assigns
soldiers and when, and what happens when the guest disconnects.

## 4. Constraints
- Free mod built with the SDK; nothing from the game or SDK in the repo;
  never presented as official (CLAUDE.md, "Legal and community limits")
- Two players maximum
- Multiplayer testing uses a clean game: no developer console, no edited
  configs, matching DLC on both machines (Mr.Fear)
- Every result is tied to a game build ID

## 5. What's already known
See LOG.md, "Findings before Session 1", and research/. In short:
- No working tactical co-op exists. The 2016 Tactical Co-Op mod is
  abandoned; the WOTC Co-op Campaign prototype covers the strategy layer
  only
- Mr.Fear (Modern Multiplayer Mod) is staying on PvP and may add a
  challenge-style co-op mission; campaign co-op is open for this project
- The current build (8270065) still ships every multiplayer UI, online,
  and networking package and all multiplayer text; no config changed. The
  switch-off is in code (script packages or the executable)
- The WOTC Co-op Campaign prototype synced two game instances on build
  8270065, so the network layer likely still works on the current build

## 6. Milestones
Each milestone gets a plan in plans/ before any code.

### M0: Setup and toolchain
- This folder, CLAUDE.md, settings, hook in place; guardrail checks
  (LOG.md "M0 checks")
- Toolchain chosen and working: a "hello world" mod that builds, loads,
  and writes one line with the mod's log prefix to Launch.log
- Mod name and log prefix decided (by me)

Checks: every deny test refused; the hello-world line appears in
Launch.log; build ID recorded.

### M1: Read the SDK
- research/sdk-findings.md: how the old Multiplayer button worked and what
  it called; the multiplayer screen classes; flags that disable
  multiplayer; how the network manager connects two games (direct IP, LAN,
  Steam lobby); whether the LAN option exists
- Check the SDK's last-updated date against March 2022

Checks: every claim has an SDK path and line number; open questions listed.

### M2: Reach multiplayer on the current build (decision gate)
- A small mod that adds a button to open the multiplayer screen
- One ordinary 1v1 match over LAN or Steam, with a friend or a second PC,
  that gets through at least one full turn

Checks: the match runs, or the exact point where it fails is recorded with
Launch.log lines from both machines. Decision recorded: current build or
the beta branch from here on.

### M3: Two humans on one team
- A tactical mission where both players control XCOM soldiers against the
  AI, each moving only their own soldiers, taking turns as the game allows
- Starting point decided in the plan (the multiplayer match flow, or a
  campaign mission)

Checks: a mission with both players' soldiers on XCOM's side, played for at
least three turns, with Launch.log from both machines.

### M4: Same-turn actions
- Both players can act during XCOM's turn; the host applies actions in the
  order they arrive; the other player waits while one resolves
- The turn ends when both players end it; both screens show the same
  result

Checks: a scripted test in which both players act in the same turn, with
no desync for five turns; any desync recorded with its log lines.

### M5: Campaign hookup
- Start a co-op mission from the host's campaign; the guest joins it
- Results (XP, wounds, deaths, loot) return to the host's campaign

Checks: one full campaign mission played in co-op, and the host's campaign
afterwards shows the right results.

### M6: Playtest, fixes, release
- Friends play it; record their feedback in LOG.md; fix the top items
- Release if it works well enough: Steam Workshop, free, with clear setup
  steps and known limits
- Final show and tell, portfolio card with a demo video

Checks: feedback recorded; fixes logged with how they were verified.

### Stretch (only if time remains; each needs its own plan)
- Players choose their soldiers in squad select
- Shared strategy layer (look at the WOTC Co-op Campaign prototype; check
  its license first)
- Rejoining after a disconnect
- Parallel campaigns: each player runs their own campaign; missions start
  together and each player's soldiers join one combined squad; results go
  back to each player's own campaign. Far stretch, only after tactical
  co-op is stable.

## 7. Out of scope
- More than two players
- PvP and challenge-style co-op missions (Mr.Fear's area)
- Paid anything, official branding, redistributing game files
- Changes to the game's executable

## 8. Open questions
- Is multiplayer reachable on the current build, or only on the beta? (M2)
- Does the network manager support direct IP or LAN as well as Steam
  lobbies? (M1)
- Can the tactical rules give two human players control of one team, and
  can they act in the same turn? (M3, M4)
- How much of this depends on native code a mod can't change?
- The final name

## 9. Schedule (draft; confirm against the course calendar)
- End of each of Weeks 6 to 9: portfolio link submitted with the Artifact
  5 card showing progress
- Week 6: M0, M1, M2
- Week 7: M3
- Week 8: M4
- Week 9: M5; friends start playtesting
- Monday, December 7: final show and tell in class
- December 7 to 13: M6 fixes, release if ready, final log, portfolio card
- Sunday, December 13, 11:59 PM: due
