# M3 plan: two humans on one team against the AI

**Approved by Kc on 2026-11-12 (Session 7)**, with the answers in section
6. Drafted in Session 6 (research, ended at the usage limit before
approval), revised in Session 7 (test loop order, Highlander check,
version). Every claim marked SDK comes from `Development\SrcOrig` (2018
source) or the Community Highlander clone in `local\refs\`; nothing in
it has run on build 8270065 unless it says **tested**. The research and
its line numbers are in research/sdk-findings.md, section "M3".

## 1. Starting point: (b), host-authoritative

The host plays an ordinary single-player mission. The guest receives the
host's history, loads the same mission from it, and follows it the way
the inactive player does in stock multiplayer. The guest's actions go to
the host, which applies them; the result comes back as history. One XCOM
player state is kept, so the AI and the campaign see nothing unusual.
Ownership is mod data on each soldier (Stage 6).

Why not adapt the multiplayer match (a): multiplayer mode switches off
alien spawning, mission objectives and the full ability set by checks
script can't change, and every campaign mission would have to run in it.
Why not let both machines simulate: the AI would have to decide the same
on two machines, and M4's "the host applies actions in the order they
arrive" needs one authority anyway.

## 2. How the guest's action reaches the host (Highlander route)

- On the guest, a listener on the Highlander's
  `PostModifyNewAbilityContext` event (Issue #890) sees every ability the
  player is about to submit, with its finished context, before the
  ruleset gets it. It sends unit, ability, target and path to the host.
- The guest's own submit adds nothing while its replay manager is in
  replay (`AddNewStatesAllowed`), which follow mode already is.
- The host checks owner and phase, rebuilds the action and submits it
  normally (the host's roll decides hits).
- **No class override.** The `X2TacticalGameRuleset` override (the two
  submit functions) is kept only as the Stage 5 fallback, if the guest
  can't give input in follow mode or its action applies locally; the
  failing log line becomes the reason.
- **New dependency (approved):** the Community Highlander v1.32.0
  (Workshop, free, MIT) on both machines.
- **All M2 results were without the Highlander.** Stage 2's first run is
  also the first test of the travel and connection code with the
  Highlander on. A failure there may come from the Highlander, not from
  the new code: compare against a run with the Highlander off before
  drawing a conclusion.

## 3. Version

Every M3 build is **0.3.0** (`X2TC_VERSION`). A rebuild for another
machine is packaged again with the same check (`tools/package_mod.py`
stops if the build doesn't match the source).

## 4. Stages

One stage at a time; the mod builds and loads after each. Log lines never
include an IP address or Steam name. "Frame" = history frame count.

**Stage 1: the solo test loop (only the version number changes).**
Options in order:
1. **Laptop in Steam offline mode, direct IP.** Both games running at
   once (PC online, laptop offline), 0.3.0 on both, pre-flight compare.
   Pass: both stay running together; the compare shows only expected
   differences (checklists/m3-stage1.md, Part D). Direct IP itself
   is tested in Stage 2; if it fails on the laptop because Steam is
   offline, go to option 2.
2. **Two instances on the PC (the prototype's method)**, only if 1
   fails. CLAUDE.md changes Kc would make first: a named folder for a
   second game copy (hard links for game files, real copies of config
   folders) and its log path; Sysinternals `handle64.exe`, downloaded and
   run by Kc, for the single-instance mutex; the mod enabled in the copy
   by AML pointed at it (not an edited config); `-nohomedir` on the copy.
3. **Later, Kc's decision after 1 and 2:** a second account in Kc's
   Steam family on the laptop, playing the family-shared copy (same DLC).

Friend sessions are for confirmation (Stage 7).

**Stage 2: connect.** Host in a Skirmish mission (TLE menu), guest on the
main menu. CO-OP: HOST (`CreateServer`, port 7777) on the tactical HUD;
CO-OP: JOIN on the main menu (address box, `CreateClient`). Ping and
pong by remote command; connection-closed delegates on both. Lines:
`X2TC: Coop host: server created`, `connection accepted`, `ping
received, pong sent`; `X2TC: Coop guest: client created (address form:
dotted|integer)`, `connected`, `pong received`. First run with the
Highlander on (section 2).

**Stage 3: snapshot.** Host sends its history (`SendHistory`); guest opens
`<plot>?game=XComGame.XComTacticalGame?LoadingSave` and goes into follow
mode at once. Lines: host `history sent, frame N`; guest `history
received, frame N, plot <name>`, the game's `LoadMap` and
`TacticalGRI::InitBattle` lines, `Tactical HUD opened ... multiplayer=False`,
`follow mode on, frame N`. Also log the history's frame count and, if
the network manager exposes it, its size (Mr.Fear's report). Kc sees the
same map, soldiers and visible enemies on both screens.

**Stage 4: live follow, view only.** `X2TC_CoopReplayMgr` (extends
`XComReplayMgr`, as `XComMPReplayMgr` does) on the guest; the host sends
new frames after each action. Three full turns with only the host
playing. Lines: host `sent to frame N`; guest `replayed to frame N`;
both `Coop sync: turn T frame N` at each XCOM turn start, in matching
pairs. Watch the alien turn (Mr.Fear's freeze report).

**Stage 5: one action from the guest, applied by the host.** Section 2's
route. The follower forces the guest's input state (the game refuses
input state changes during a replay unless forced or in the tutorial).
Lines: guest `action captured (move, unit U), not applied locally`; host
`action received (move, unit U)`, `applied, frame N`; guest `replayed to
frame N`. On failure: record the line, plan the fallback override.

**Stage 6: ownership and phases (M3's check).**
- Each soldier belongs to P1 (host) or P2 (guest), stored as a unit
  value `X2TC_Owner` kept for the whole campaign; no value means P1
  (rescues, VIPs, mind-controlled units). Assigned automatically by the
  host at session start, alternating through the squad.
- Split turns: P1 phase, P2 phase, then the aliens; a banner names the
  phase. Phase kept in a small mod state object in the host's history.
- The host refuses guest actions on units the guest doesn't own or
  outside P2's phase. The host's own input on P2's soldiers is decided
  here with a test (no cancel hook was found); for M3's check the
  players keep to their own soldiers.
- Lines: `Coop owners: unit U -> P1|P2`; `Coop phase: turn T P1 -> P2`,
  `turn T P2 -> aliens`; `Coop rejected: unit U is P1's, action from P2`.
- Pass (SPEC.md M3): three turns, each player moving only their own
  soldiers, matching `Coop sync` lines, Launch.log from both machines.

**Stage 7: confirmation with a friend over Steam.** Its own short plan
(no IP typing: reuse the tested Private lobby and invite, or create the
Steam session from the mod).

## 5. Files (mod)

`mod/X2TacticalCoop/Src/X2TacticalCoop/Classes/`, one purpose per class,
test buttons behind `SHOW_TEST_BUTTONS` as before:
- `X2TC_CoopSession` (connection, history, remote commands; Stages 2-4)
- `X2TC_CoopListener` (HOST/JOIN buttons, opening the guest's map;
  Stages 2-3)
- `X2TC_CoopReplayMgr` (guest follower and forced input; Stages 4-5)
- `X2TC_CoopActionListener` (the `PostModifyNewAbilityContext`
  listener, guest side; Stage 5)
- `X2TC_CoopOwnership` and a small phase state object (Stage 6)
- The Highlander dependency entry (from Stage 2, when it is first
  ticked)
- Reused: `X2TC_MatchTraceListener`, `tools/package_mod.py`,
  `tools/preflight_compare.py`

## 6. Decisions (Kc, 2026-11-12)

1. (b), host-authoritative: yes.
2. Highlander route and the Highlander v1.32.0 as a required dependency:
   yes; ruleset override only as the Stage 5 fallback. Stage 2's first
   run is the first test with the Highlander on.
3. Laptop: same Steam account as the PC, can't play on it while the PC
   does. AML isn't installed yet; Kc installs it and sets up Steam
   offline mode before Stage 1.
4. Test mission: Skirmish.
5. Split turns for M3; the shared turn is M4.
6. Version 0.3.0.
7. Exit hang: a separate plan later, before friend playtests.
8. Host's own input on P2's soldiers: decided at Stage 6; for M3's check
   the players keep to their own soldiers.

## 7. Not determinable from source (each settled by a stage)

Direct IP on 8270065 and its address form, and with Steam offline
(Stage 2); whether `SendHistory` carries a full tactical history and how
big (Stage 3); whether the guest's map rebuild matches (Stage 3);
partial histories under the single-player ruleset (Stage 4); input and
submit in follow mode, including the native latent submit (Stage 5).

## 8. Known risks

The guest must never simulate (join only on XCOM's turn with the host
idle). Heavy history may freeze the guest (Mr.Fear; the prototype's lost
bursts). End of mission and a dropped connection are handled minimally
(message, back to the main menu). Only the host saves. The Highlander
dependency ties us to its version. Week 7 may not fit Stages 1-6; Stage
7 can move.

## 9. Verification

1. Kc builds each stage and runs its checklist on the chosen loop; I read
   both Launch.logs against the stage's lines and record the result with
   the build ID (`appmanifest_268500.acf`) in LOG.md.
2. A stage passes only on log lines from both machines plus what Kc saw;
   anything else is a guess.
3. On failure: the failing line and the unknown it answers are recorded,
   and the fallback is planned before more code.
4. After each sub-step I confirm my calls appear in tool-log/.

## Results

(Filled in per stage.)
