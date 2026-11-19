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

## 2. How the guest's action reaches the host

**Revised 2026-11-14 (approved by Kc): the tutorial-style follower.** A
clicked move is built and submitted by
`XComTacticalController.GameStateMoveUnit`, not `ActivateAbility`, so
the Highlander route below never sees moves (research/sdk-findings.md
finding 16). Instead the guest's follower becomes a subclass of the
game's tutorial manager (`XComTutorialMgr`), still placed only in the
replay manager slot (no class override). In tutorial mode a context the
guest submits during the replay goes to the replay manager's
`HandleSubmittedGameStateContext` instead of being applied (moves and
abilities, latent submits included), input is allowed during the replay,
and the pause menu disables saving (finding 17). The follower captures
there and sends the action to the host; tutorial-specific behaviour
(start logic, "next ability only" filtering, markers, demo steps) is
switched off and **logged whenever it fires**, so surprises show in the
logs (Kc). **Fallback** if tutorial mode fails (no input, abilities
hidden, or an action applied on the guest): the `X2TacticalGameRuleset`
override of the two submit functions, with input forced on. Abilities
do pass through `ActivateAbility`, so for them either route can capture
(Kc's note); the Highlander event stays available.

The original route, kept for reference:
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
  (Workshop, free, MIT) on both machines. From Stage 3 also its
  "[WOTC] Alien Hunters Community Highlander" plugin (same repository and
  license), because both machines own Alien Hunters (Kc, 2026-11-14). It
  isn't declared required in the mod's config: players without Alien
  Hunters must not use it (its own readme).
- **All M2 results were without the Highlander.** Stage 2's first run is
  also the first test of the travel and connection code with the
  Highlander on. A failure there may come from the Highlander, not from
  the new code: compare against a run with the Highlander off before
  drawing a conclusion.

## 3. Version

M3 builds are **0.3.x** (`X2TC_VERSION`). From 2026-11-14 (Kc's
decision after Stage 2 Run 1b), every build shared to another machine
gets the next patch version (0.3.1, 0.3.2, ...), so the `X2TC: version`
line and the pre-flight compare show which build ran; packaging then
needs no `--force`.

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

**Stage 5: the guest's first move, applied by the host (revised and
approved 2026-11-14; version 0.3.4).**
- Follower: `X2TC_CoopReplayMgr` extends `XComTutorialMgr`; replays and
  follows as in Stage 4 (the stock replay start, not the tutorial's);
  turns the guest's input on (`ActiveUnit_Moving`) only during XCOM's
  turn, once caught up and the visualizer is idle, and back to the
  replay's input otherwise; captures every submitted context, sends
  moves (unit and path tiles, `X2TC_GuestMove`) and logs the rest as not
  sent; logs each tutorial-specific call it intercepts.
- Host: rebuilds the move with its own
  `XComTacticalController.GameStateMoveUnit` (the function its own clicks
  use), after checking it is XCOM's turn, the unit is an XCOM unit, and
  the ruleset and visualizer aren't busy (retries up to 10 s); answers
  `X2TC_MoveResult` (applied or refused, with the reason). Ownership is
  only logged; Stage 6 enforces it.
- **CO-OP: LEAVE** on the guest's tactical HUD from the start: ignores
  the game's own connection-error handling, disconnects, and opens the
  main menu map (`open XPACK_Shell_Intro?Game=XComGame.XComShell`,
  tested in M2 Stage 1e). The host stops sending when the connection
  closes and plays on alone. The guest's pause menu is also tried.
- Measurement (Mr.Fear's warning, finding 15): the data types each send
  queues, and any gap over 1.5 s between polls on either side.
- Lines: guest `follower: input on|off`, `captured (move, unit U, N
  tiles), sent; not applied locally`; host `guest move received`,
  `applied, frames A -> B` or `refused: <reason>`; guest `move result`,
  `replayed to frame N`; `tutorial call intercepted: <name>` if any.
- Pass: the guest's move appears on both screens and both logs show it;
  the guest's frame count doesn't change before the host's send; LEAVE
  returns the guest to the main menu while the host plays on.

**Stage 5b: the guest's abilities (added by Kc, 2026-11-14, before
Stage 6).** At least a standard shot: the guest's captured ability
context (ability, source, target, and for location-targeted abilities
the target locations) is sent; the host rebuilds it through
`XComGameStateContext_Ability.ActivateAbility` from its own available
actions, so its roll decides the result. Its own short addition to the
plan once Stage 5 passes. "Co-op where the guest can only move isn't
real co-op" (Kc), and M4 is already the hardest milestone.

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
- `X2TC_CoopReplayMgr` (guest follower; from Stage 5 a tutorial-style
  replay manager that captures the guest's actions and switches its
  input; Stages 4-5b)
- ~~`X2TC_CoopActionListener`~~ (not needed: the follower captures;
  revised 2026-11-14)
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
5. Split turns for M3; the shared turn is M4. *(Superseded 2026-11-14 by
   decision 16: shared turn now.)*
6. Version 0.3.0.
7. Exit hang: a separate plan later, before friend playtests.
8. Host's own input on P2's soldiers: decided at Stage 6; for M3's check
   the players keep to their own soldiers.

Added 2026-11-14 (Kc):
9. Stage 4 accepted on two full rounds; Stage 6's three-turn check
   repeats the live follow.
10. Stage 5 revised: the tutorial-style follower captures the guest's
    actions (section 2), the ruleset override as the fallback; log every
    tutorial-specific call.
11. CO-OP: LEAVE for the guest from Stage 5 on.
12. Moves first in Stage 5; Stage 5b adds abilities (at least a standard
    shot) before Stage 6.
13. New approach for moves (hotkey, full trace, toggles, 0.5 s state
    log); time-box: after Runs 8-9, the M key is M3's movement method if
    click-to-move still fails.
14. Stage 6 draft approved: alternating ownership; END MY PHASE buttons;
    a warning (and the swallowed Backspace) for the host's End Turn in P1;
    an assignment screen on the polish list. Stage 6 code after moves
    are settled.
15. Stage 6 revised: FRIENDLY ACTION banner; only the host ends XCOM's
    turn; the guest's END TURN signals readiness; auto-end when nobody
    has actions; a popup for the host's End Turn while the guest's
    soldiers can act (unless the guest is ready).
16. **Shared turn now** (supersedes 5 and the phase parts of 14): no
    P1/P2 phases in M3. SPEC.md updated 2026-11-15: M3 = shared turn,
    three full turns, logs from both machines; M4 = the same-turn check
    plus shared-turn polish (refusal feedback, camera option, actions
    arriving close together) and an optional split-turn mode.
17. A further guest action clears "ready" (Kc, 2026-11-15).

## 7. Not determinable from source (each settled by a stage)

Direct IP on 8270065 and its address form, and with Steam offline
(Stage 2); whether `SendHistory` carries a full tactical history and how
big (Stage 3); whether the guest's map rebuild matches (Stage 3);
partial histories under the single-player ruleset (Stage 4); input and
submit in follow mode, including the native latent submit (Stage 5).

## 8. Known risks

The guest must never simulate (join only on XCOM's turn with the host
idle). The guest has no pause menu while following (Stage 4): it needs
at least a way to quit, from Stage 5 on. **Partial history sends seem to
carry a part that scales with the whole history** (one-frame sends
63-94 KB, growing over the mission; research/sdk-findings.md finding
15): a risk for long campaign missions (Mr.Fear's warning); possible
fix, sending only the new frames, to test later. Heavy history may freeze the guest (Mr.Fear; the prototype's lost
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

**Stage 1, option 1 (test, 2026-11-13): pass.** Mod 0.3.0 on both, no
Highlander. Build ID: 8270065 on both (laptop's reported by Kc
afterwards; both logs show the same executable: engine 8917, changelist
1100000). Logs in
`local\m3-logs\` (not committed).
- Both games ran at the same time: PC log 23:44:50 to about 23:47:55,
  laptop (Steam offline) 23:43:50 to about 23:47:57, by each machine's
  clock. Kc: no interruption on either through the Skirmish test.
- Steam on the PC showed the account playing XCOM on the laptop despite
  offline mode; Kc picked "this device" and AML launched the PC's game.
  The laptop's log has `STEAMWORKS initialized` but no `Logged in as`
  line (the PC's does).
- Multiplayer menu: laptop `MP state network=True online=False` (Quick
  Match and Leaderboards greyed out, Kc); PC `network=True online=True`
  (both clickable). Ranked Match disabled on both.
- PC Skirmish: `LoadMap: Plot_WLD_GP_Forge_02?game=XComGame.XComTacticalGame`,
  `Tactical HUD opened, game XComTacticalGame, multiplayer=False`. Turns
  aren't in the log (the trace logs turns in multiplayer only).
- Pre-flight compare: READY; only `MP state` differs, as expected.
- Still open for Stage 2: whether direct IP connects while the laptop's
  Steam is offline.

**Stage 2 code (2026-11-14, written, not built):** `X2TC_CoopSession`
(server or client on port 7777 with no `steamsockets`, as the LAN lobby;
the guest retries `ForceConnectionAttempt` every 5 s, six times; once the
network manager lists a connection the guest pings every 3 s until a pong;
connection state changes logged once a second) and `X2TC_CoopListener`
(CO-OP: HOST on a single-player tactical HUD, CO-OP: JOIN on the main
menu with the game's text box). The Highlander is declared required in
the mod's `XComGame.ini`. Differences from the stage text above: no
`PlayerJoined` delegate (the guest's "connected" comes from the
connection list; avoids depending on that delegate's parameter types);
the session is one named object in the transient package, looked up
when needed (first build failed when it was kept in a runtime default
value; LOG.md 2026-11-14), kept alive by the network manager's delegates
so it should survive a map load (a guess until Stage 3). Checklist: checklists/m3-stage2.md (Run 1:
Highlander on, dotted address).

**Stage 2 Run 1 (test, 2026-11-14): connected; ping not sent (my bug).**
Build 8270065 on both, mod 0.3.0 (Stage 2 build), Highlander v1.32.0 on
both. Logs `stage2-pc-1.log`, `stage2-laptop-1.log`.
- **Direct IP connects with a dotted address, the laptop in Steam
  offline mode, the host in a single-player Skirmish mission, the
  Highlander on.** PC: `Coop host: server created (port 7777)` (L401),
  then the game's `NotifyAcceptedConnection` and `Coop host: connection
  accepted (connection 0)` (L406), at 00:39:01 by the PC's clock; laptop:
  `Coop guest: client created (address form: dotted)` (L184) at
  00:39:01 by its clock. Without any `ForceConnectionAttempt`: the
  connection came by itself about a second after `CreateClient`. It
  stayed up until the PC quit (both logs close the connection at exit).
  The prototype's "one decimal integer" claim doesn't hold here.
- **Bug:** `Error: SetTimer() called on bStatic Actor WorldInfo_N` right
  after "poll timer started" on both (PC L402, laptop L185): the poll
  never ran, so no state changes, no ping, no pong. Fixed: the timer now
  runs on the local player controller. Run 1b repeats the run.
- No popup or visible change on either machine (Kc). Kc's second click
  on JOIN was ignored as designed (`a co-op session is already running`,
  laptop L190).

**Stage 2 Run 1b (test, 2026-11-14): the PC's fix works; the laptop ran
the old build.** Logs `stage2-pc-2.log`, `stage2-laptop-2.log`.
- PC: no timer error; the poll runs (`state server=True client=False
  connections=0 at 0s`, L403; `connection accepted (connection 0)`,
  L405; `connections=1 at 181s`, L406). Accepted at 01:02:25 by the PC's
  clock, the laptop's `client created` at 01:02:25 by its clock: the
  connection again came within a second, dotted address.
- Laptop: still `Error: SetTimer() called on bStatic Actor WorldInfo_0`
  (L185), which only the Run 1 build can log. The zip in
  `local\release\` (00:53) and the PC's built script both contain the
  fix and not the old text (byte search), so the laptop's mod folder
  held the Run 1 build. No ping, no pong.
- Kc: the laptop's game "hung at the title" after JOIN. Its log has no
  line between `state ... at 0s` (266 s) and a normal `appRequestExit`
  at 398 s. Kc, asked: it stayed on the menu (no click tried) and quit
  normally; not a freeze.
- Next: Run 1c with version 0.3.1 (checklists/m3-stage2.md).

**Stage 2 Run 1c (test, 2026-11-14): pass.** Mod 0.3.1 on both
(`X2TC: version 0.3.1`, PC L123, laptop L120), Highlander v1.32.0 on
both, build 8270065. Logs `stage2-pc-3.log`, `stage2-laptop-3.log`.
- PC: `server created (port 7777)` (L588), `connection accepted
  (connection 0)` (L592, 01:26:12 by its clock), `connections=1 at 12s`
  (L593), `ping 1 received, pong sent` (L594).
- Laptop: `client created (address form: dotted)` (L184, 01:26:12 by its
  clock), `connection attempt 1 of 6, sent=True` (L188, at 5 s),
  `connections=1 at 6s` and `connected` (L189-190), `ping 1 sent`
  (L191), `pong 1 received (at 7s)` (L192), 0.03 s after the ping.
- The host accepted the connection at once, but the guest's own
  connection list showed it only right after the first
  `ForceConnectionAttempt`. Whether the attempt is needed or just
  coincided is a guess; the retry stays.
- **When the host quit,** the guest logged our `connection closed`
  (L195), but the game also handled it as a connection error: the
  viewport client's `NotifyConnectionError` queued a message
  (`XComGameViewportClient.uc` L24-39, L69-85), the player controller
  went to `ReturnToMPMainMenu` (`Can't destroy a null online session`,
  L211-215) and reloaded the shell with `?closed` (L238); then M2's
  lobby-exit fix in `X2TC_MainMenuListener` took it to the multiplayer
  menu (L277-286). Kc saw a dialog: "you have been returned to the title
  screen because the active gamer profile changed" with Cancel/Accept.
  Our delegate doesn't stop the game's own path; the player controller's
  `bIgnoreNetworkMessages` does (L32, L76). Handling a dropped
  connection properly belongs to the later stages' risk list (message,
  back to the main menu), not Stage 2.
- Both logs show the Highlander's `DLC_2 -- NOT LOADED - REQUIRED` and
  "Required packages were not loaded": the Alien Hunters compatibility
  mod left off (2026-11-14 decision). No effect seen so far.

**Stage 3 code (2026-11-14, 0.3.2, written, not built).** After its pong
the guest sends `X2TC_RequestHistory`; the host answers once with
`SendHistory` (whole history, logged frame count and plot). The guest's
`OnReceiveHistory` reads the battle data's map command and opens
`<map command>?LoadingSave` with `bInitiateReplayAfterLoad` set: the
game's own "replay after load" path (the debug Challenge Mode screen
does exactly this, `UIDebugChallengeMode.uc` L375-383), so the guest's
ruleset starts a replay instead of playing. **Change from the stage text
above:** follow mode in Stage 3 is the stock replay (starting from the
mission's first frame, with the game's replay bar), not yet our own
follower; `X2TC_CoopReplayMgr` stays in Stage 4, where the guest has to
follow to the latest frame live. On the guest, the tactical HUD gets no
HOST button, and the HUD or replay screen tells the session it survived
the map load (and restarts its poll). **Alien Hunters Highlander on
both machines from Stage 3 (Kc, 2026-11-14)**, checked in the
pre-flight compare. Checklist: checklists/m3-stage3.md.

**Stage 3 Run 1 (test, 2026-11-14): pass.** Build 8270065 on both, mod
0.3.2, Highlander and Alien Hunters Highlander v1.32.0 on both
(`DLC_2 -- v1.32.0`, PC L119, laptop L116). Pre-flight compare READY
(only `MP state` differs; mod names identical, three mods). Logs
`stage3-pc-1.log`, `stage3-laptop-1.log`, `stage3-preflight-*.log`.
- PC: ping, `history request received`, `sending history, frames=231
  plot=Plot_SLM_Guerilla_MdObj_RetainWall`, `history sent (queued)`
  (L405-409).
- Laptop: `history requested` (L186), `history received, frames=231`
  0.8 s later (L187; the delegate's history is the game's: True),
  `opening it in replay mode: open Plot_SLM_Guerilla_MdObj_RetainWall?game=XComGame.XComTacticalGame?LoadingSave`
  (L188), the game's `LoadMap` (L190), `TacticalGRI::InitBattle:
  StartGameState=None` (L212: the load-game path), `tactical HUD opened;
  session kept (loading mission=True, connections=1), frames=231`
  (L386), `replay screen opened; ... in replay=True replay frame=192`
  (L397). Map load to HUD: 6 s.
- **Findings (tested):** a whole tactical history (231 frames) crosses
  the direct connection in under a second; the guest's game loads the
  host's mission from it with no save file; the session object and the
  connection survive the guest's map load; the guest's copy runs in the
  game's replay mode, not as a live game.
- Kc: black screen, the map, the soldiers that are on the PC with
  "Concealed" over them, the mission timer (7 turns until the container
  detonates). Loading took about 20 s from JOIN.
- **The "Challenge Scoring: Total Score: 0" screen** ("You'll get them
  next time, Commander!"): the stock replay is Challenge Mode's. Its
  ruleset state starts playback by itself (`X2TacticalGameRuleset.uc`
  L4984-5001, `PerformingReplay` at laptop L403), it replayed frames
  192-230 in about 8 s, and at the end the replay screen opens the
  Challenge summary (`UIReplay.OnCompleteReplayToFrame`, L374-382;
  `UIChallengePostScreen` at laptop L472). Pressing play again replays
  and shows it again (L540). Expected for this path, and harmless; Stage
  4's own follower replaces the stock replay screen.

**Stage 4 code (2026-11-14, 0.3.3, written, not built).**
- `X2TC_CoopReplayMgr` (new, extends `XComReplayMgr`): replays from the
  start state the stock way (proven in Stage 3), then in its `Following`
  state steps forward whenever the history grows, like stock
  multiplayer's `XComMPReplayMgr.PlayingReplay.Tick` (L141-154); never
  stops the replay; logs "replayed to frame N" when caught up and every
  player-turn start it passes.
- `X2TC_CoopSession`: on the guest's tactical HUD (before the replay
  starts), spawns the follower and assigns it to `GRI.ReplayMgr` (not a
  class override; the multiplayer GRI does the same with its own
  manager); the guest tells the host `X2TC_Following`; the host's poll
  then sends `SendPartialHistory` whenever there are new frames and the
  ruleset isn't building a latent game state, one at a time, each
  answered by `X2TC_HistoryReceived` with the guest's frame count
  (timeout 15 s). **Per send it logs the frames (before, after, added),
  whose turn it was, and the bytes and bunches it added to the network
  manager's outgoing queue** (Kc's request for Mr.Fear's warning; whether
  that equals the bytes on the wire isn't known from the script source).
  Both sides log `Coop sync (host|guest): turn begin, team T turn count
  N, frame F` from the history itself, so the pairs can be matched
  exactly.
- `X2TC_CoopListener`: closes the stock replay screen on the guest when
  the follower is in charge (no auto-play, no Challenge summary).
- Checklist: checklists/m3-stage4.md (pre-flight; play until three full
  turns, a pod activation and an alien turn with activated enemies
  acting; four screenshot points on both screens).

**Stage 4 Run 1 (test, 2026-11-14): the laptop follows live; two full
rounds, not three.** Kc's second launch of the day (the first launch's
logs were overwritten). Build 8270065 on both, mod 0.3.3, the three mods
on both; pre-flight compare READY (only `MP state` differs). Logs
`stage4-pc-1.log` (2208 lines), `stage4-laptop-1.log` (497),
`stage4-preflight-*.log`; Kc recorded both screens (local video).
- **Following works (tested):** follower installed before the replay
  started (`follower installed (replaced XComReplayMgr)`, laptop L391),
  stock replay screen closed (L404), no Challenge screen. The PC sent
  the full history (227 frames, 275,362 bytes queued in 453 bunches,
  PC L426) and then 24 partial histories (PC L547-2187); **all 24
  acknowledged with `match=True`**.
- **Turn pairs match exactly:** the PC logged 11 turn starts (frames 192,
  315, 384, 404, 411, 429, 563, 598, 606, 613, 631) and the laptop the
  same 11, same teams and frames. Teams: 8 XCOM, 16 aliens, 32 the Lost,
  64 resistance, 1 neutral (the Skirmish's other player slots). That is
  XCOM turn 1, alien turn 1, XCOM turn 2, alien turn 2, and the start of
  XCOM turn 3 (the run ended 4 s after it). Short of the checklist's
  three full rounds; **accepted by Kc (2026-11-14): Stage 6's three-turn
  check repeats the live follow.**
- **Pod activations:** two on the PC: during XCOM turn 1 (scamper at PC
  84.1 s) and during alien turn 1 (102.1 s). Kc saw shots, explosions,
  damage, a soldier bleeding out and the container timer go from 7 to 6
  on the laptop.
- **Data delay (send to receipt), from both clocks** (they agree to about
  0.1 s: every acknowledgment reaches the PC 0.10 s after the laptop
  logs the receipt): 0.05-0.99 s, about 0.45 s typically. Before that,
  new frames wait up to 1 s for the PC's poll. So the laptop had each
  action's data 0.1-2 s after the PC created it.
- **Sizes (queued bytes per send):** 44-195 KB; not proportional to
  frames (+1 frame: 63-94 KB; +84 frames: 174 KB), so each partial
  history carries a large part beyond the new frames, which grew slowly
  (+1-frame sends: 76 KB at frame 464, 94 KB at frame 668). Alien-turn
  sends (team 16): 144, 114, 116, 115, 101, **195** (the largest of the
  run, +2 frames, alien turn 2) and 119 KB, each received in 0.2-0.9 s
  and acknowledged. All partials together: 2.85 MB in about 2.5 minutes.
- **Mr.Fear's warning:** not reproduced at this size (two alien turns,
  two pod activations, 668 frames). Recorded as "not seen yet", not as
  disproved: a full campaign mission is longer, and a campaign history
  carries the strategy layer too.
- **Cutscene stall (Kc: frozen on the first frame, caught up a few
  seconds after the cutscene ended):** the network wasn't the cause.
  The PC created all reveal and scamper frames within 0.2 s (PC
  84.0-84.2 s), sent them as partial 3 (+50 frames, PC 84.47 s), and
  the laptop had them 0.65 s later, while the PC's reveal cutscene ran
  until about 96 s (`Available Actions` at PC 96.07 s; Kc's clicks
  during it were refused, `ABILITY ACTIVATION BLOCKED BY:
  X2Action_RevealAIBegin`, PC L919-928). The laptop resumed around the
  time partial 4 arrived (PC 99.47 s + 0.24 s), 3-4 s after the PC's
  cutscene ended. **Guess:** the follower had stepped to the last frame
  it had and stopped, and the reveal's visualization on the laptop
  waited until the replay could step further, which only the next
  frames allowed. To check in a later stage: log the guest's visualizer
  busy state and replay frame while caught up.
- **Variable delays (Kc: some actions within a split second, others a
  few seconds):** the PC creates all of an action's frames at once and
  then animates for seconds; the laptop starts the same animation when
  the frames arrive (0.1-2 s later: the split-second cases). Some sends
  carry several actions or a whole turn change at once (partial 8: +84
  frames, the end of alien turn 1 and four turn starts; partial 23: +75),
  which the laptop then plays one after another, falling behind until it
  catches up; and the cutscene case above. A guess, consistent with the
  timings.
- **Unexplained, low impact:** the follower's replay started at frame 0
  (laptop L400), where Stage 3's stock replay started at 192, and reached
  frame 225 within 0.2 s. The scene was right. To watch.
- **Guest has no pause menu while following (Kc).** Its input state is
  the replay's, which doesn't open the pause menu. **Stage 5 or later
  must give the guest at least a way to quit** (and handle the host
  leaving, Stage 2's note). The laptop quit first here (connection closed
  at 02:30:37.5 by its clock, the PC's at 02:30:37.6).

**Stage 5 code (2026-11-14, 0.3.4, written, not built).**
`X2TC_CoopReplayMgr` now extends `XComTutorialMgr`: stock replay start
(`super(XComReplayMgr).StartReplay`), tutorial filters return "allowed",
tutorial steps, markers and the end-of-battle observer replaced by
no-ops that log once (`tutorial call intercepted: <name>`); guest input
on (`ActiveUnit_Moving`, selecting a unit if none) during XCOM's turn
when caught up and the visualizer is idle, off otherwise;
`HandleSubmittedGameStateContext` captures every submitted context,
sends `StandardMove` paths (`X2TC_GuestMove`), logs anything else as not
sent. `X2TC_CoopSession`: host keeps one pending guest move, applies it
with `GameStateMoveUnit` (checks: living XCOM unit, XCOM's turn, path of
2+ tiles; waits up to 10 s for an idle ruleset and visualizer), answers
`X2TC_MoveResult`; guest LEAVE (ignore network messages, `Disconnect`,
reset the session, open the main menu map); host stops sending on a
closed connection; both log poll gaps over 1.5 s; each send logs its
queued data types; the guest warns if its history grows without a
history from the host. `X2TC_CoopListener`: CO-OP: LEAVE on the guest's
tactical HUD. Checklist: checklists/m3-stage5.md.

**Stage 5 Run 1 (test, 2026-11-14): no soldier selectable; tutorial
intro played; LEAVE works.** Mod 0.3.4, build 8270065 (not re-reported),
logs saved as `stage4-pc-2.log` and `stage4-laptop-2.log`.
- Following still works (full history 164 frames, `data types=1`; one
  partial, +2 frames, `data types=7`, i.e. `eGDT_HistoryDelta`,
  confirming finding 15's reading; acknowledged `match=True`).
- The laptop played the tutorial's intro movie `CIN_TP_PostIntro`
  (laptop L287-288, 18.7 s), then `tutorial call intercepted:
  StartDemoSequenceDeferred` (L290). Cause: tutorial mode was on when
  the ruleset finished loading, and the load path plays the tutorial
  intro and starts the demo when `bInTutorial` is set
  (`X2TacticalGameRuleset.uc` L3422-3437, L3462-3465).
- `input on (state ActiveUnit_Moving, active unit 0)` (L294): no soldier
  selected, and Kc couldn't select one. Causes from the SDK: unit
  cycling is switched off whenever the replay manager is a tutorial
  manager (`XComTacticalController.uc` L540-544), and outside
  `TurnPhase_UnitActions` the ruleset reports no active player
  (L5462-5469; the controller's idle logic checks it, L629-633); the
  real tutorial leaves the replay state and selects the unit itself
  before the player acts (`XComTutorialMgr.uc` L291-305).
- **LEAVE works (tested):** `LEAVE clicked`, connection closed,
  `opening the main menu` (laptop L299-304), main menu reached at L338
  with no popup; PC: `connection closed`, `the guest is gone; partial
  history sends stopped, the mission goes on` (PC L382-383).
- No hitch lines; no `WARNING` (the guest's history never grew by itself).
- **Fix (0.3.5):** tutorial mode off by default, on only during XCOM's
  input phase; at the phase start the follower calls the ruleset's
  `EndReplay` (to `TurnPhase_WaitForTutorialInput`) and selects a unit
  with `Visualizer_SelectUnit`; at the end `ResumeReplay`; a CO-OP: NEXT
  SOLDIER button replaces the switched-off cycling. Run 2 in the
  checklist.

**Stage 5 Run 2 (test, 2026-11-14): abilities captured, moves refused
before capture, intro still played.** Mod 0.3.5, build 8270065 (not
re-reported), logs `stage5-pc-2.log`, `stage5-laptop-2.log`.
- **Capture works for abilities (tested):** the laptop's
  `HandleSubmittedGameStateContext` received overwatch, AidProtocol,
  ThrowClaymore and PistolOverwatch (laptop L295-305; each two or three
  times, the UI retrying a refused activation), with frames staying at
  160: nothing applied on the guest. Not sent (moves only in Stage 5).
  Good news for Stage 5b.
- NEXT SOLDIER selected units 21, 24, 27, 30 (L292-304); the HUD's own
  cycling did nothing, as expected.
- **Moves never reached the capture:** `PerformPath` refuses every move
  while a tutorial manager isn't in its `WaitForPlayerInput` state
  (`XComTacticalController.uc` L1098); the follower's state was called
  `Following`.
- **Intro still played:** the input phase began at 51.1 s while the
  ruleset was still in `LoadTacticalGame` (laptop L283), so the load path
  saw tutorial mode on (`CIN_TP_PostIntro`, L284-285) and `EndReplay` did
  nothing there; the ruleset then entered `PerformingReplay` (L289) and
  stayed in it.
- Cosmetic: every ability glows like the tutorial's "use this one",
  because tutorial mode shines abilities `IsNextAbility` accepts
  (`UITacticalHUD_Ability.uc` L205-225) and the follower accepts all (to
  keep them usable). Left as is for now.
- LEAVE worked again (laptop L308-345; PC L332-333).
- **Fix (0.3.6):** the follower's following state is named
  `WaitForPlayerInput` (overriding the tutorial's state of that name:
  its validating handler and its Begin code); the input phase begins only
  once the ruleset is in `PerformingReplay`; the guest clears its unit's
  "moving" mark when the host answers a move (the controller sets it on
  submit and refuses further orders while it's set, L1098-1109). Run 3
  in the checklist.

**Stage 5 Run 3 (test, 2026-11-14): no intro; moves still blocked; the
guest's history grew by itself.** Mod 0.3.6, build 8270065 (not
re-reported), logs `stage5-pc-3.log`, `stage5-laptop-3.log` (the
laptop's file first held a copy of the PC's log; Kc replaced it).
- **Intro fixed:** the input phase began after `PerformingReplay:
  BeginState` (laptop L289-292); no `CIN_TP_PostIntro`.
- **The guest's history grew by 2 frames by itself** (`WARNING: history
  frames=231 but the host's last history had 229`, L304): `EndReplay`
  took the ruleset through `TurnPhase_Begin` to
  `TurnPhase_WaitForTutorialInput` (L291-300), and each phase change is
  added straight to the history (`BeginState_RulesAuthority`,
  `X2TacticalGameRuleset.uc` L706-723, `AddGameStateToHistory`), not
  submitted, so the replay guard doesn't stop it. A desync risk; the
  safety warning worked as intended.
- Abilities captured again (EVAC, overwatch; L307-311), not applied.
  NEXT SOLDIER worked. No move reached the capture; the PC received
  none.
- LEAVE worked (laptop L314-352; PC L369-370).
- **Changes (0.3.7):** no `EndReplay`/`ResumeReplay` (the ruleset stays
  in `PerformingReplay`, where Run 2 showed selection and ability capture
  work); `move check:` lines log every guard a clicked move passes
  (`ClickToPath`: the visualizer not blocking ability activation, with
  the game's own explanation when it does; `PerformPath`: unit not
  moving, tutorial state `WaitForPlayerInput`, a path of 2+ tiles; input
  state; active unit), whenever one changes; **Stage 5b's ability
  forwarding pulled into this build** (Kc's go-ahead to test more per
  run): the guest sends captured abilities (template, source, primary
  target, target locations; an identical capture within 1 s isn't sent
  twice); the host finds the matching available action, checks it is
  `AA_Success` and the target is valid on the host, and applies it with
  `ActivateAbility`, answering applied or refused. Run 4 in the
  checklist.

**Stage 5 Run 4 (test, 2026-11-14): not a valid test of 0.3.7: the
laptop ran 0.3.6.** Logs `stage5-pc-4.log` (`X2TC: version 0.3.7`, L121)
and `stage5-laptop-4.log` (`X2TC: version 0.3.6`, L118). No 0.3.7 zip
exists in `local\release\` and no pre-flight logs were saved for Stage 5
runs, so the mismatch went unseen. On the laptop: no `move check` lines,
abilities captured but "not sent" (the 0.3.6 text), and the `WARNING`
(history grew by 2) at the start of each XCOM turn (L413, L459), as in
Run 3: the 0.3.6 behaviour repeated. The PC side ran fine (followed,
revealed a pod, two alien turns). Kc saw no path line and no result
from the laptop's shots, consistent with 0.3.6.
- **Change (0.3.8):** a version check at JOIN: the guest's ping and the
  host's pong carry `X2TC_VERSION`; on a mismatch the host refuses to send
  the history and the guest shows a "CO-OP: VERSION MISMATCH" dialog
  (`UIRaiseDialog`), so a mismatched pair can't produce a test run again.
  Run 5 in the checklist (0.3.7's code plus the check; packaging and
  pre-flight spelled out).

**Stage 5 Run 5 (test, 2026-11-14): abilities work end to end; moves
still blocked.** Mod 0.3.8 on both (version check passed: `host version
0.3.8, mine 0.3.8`, laptop L223), build 8270065 (not re-reported); Kc
skipped the pre-flight. Logs `stage5-pc-5.log`, `stage5-laptop-5.log`.
- **Stage 5b works (tested):** eight orders captured on the laptop and
  applied by the PC: overwatch (x4), PistolOverwatch, SkirmisherGrapple,
  LaunchGrenade, ThrowGrenade (PC L391-1138; each `applied ... waited
  0s`, frames +1 to +3); none refused. The answer reached the laptop
  0.02 s after its capture (laptop L363-364). The laptop's history never
  grew by itself (no `WARNING`): removing `EndReplay` worked. No hitch
  lines.
- **Moves:** every `move check` line has `path of 2+ tiles=False`,
  with every other guard passing (visualizer not blocking, unit not
  moving, tutorial state `WaitForPlayerInput`, input state
  `ActiveUnit_Moving`, unit selected) (laptop L344-437). The laptop's
  pathing pawn never builds a path; Kc sees no path line.
- **Lingering targeting UI (Kc):** in tutorial mode `ActivateAbility`
  takes the non-latent path, which reports the ruleset's return value
  (`XComGameStateContext_Ability.uc` L1348-1351, L1451); the follower
  returned false, so the HUD treated each order as failed.
- **Delay (Kc: about 2 s):** the round trip is 0.02 s; the rest is the
  host's one-second poll before sending, the transfer (about 0.4 s,
  Stage 4) and the laptop starting the animation.
- Cosmetic (Kc): the last selected soldier stays selected during the
  aliens' turn (input is off).
- **Changes (0.3.9):** the follower returns true for a forwarded move or
  ability (the HUD closes its targeting; nothing is applied on the guest
  either way); the host checks for new frames every 0.2 s and sends right
  after applying a guest order; the move diagnostics add the pathing
  pawn's own state (hidden, state, destination tile, unit tile, cursor
  tile); **fallback for moves:** CO-OP: MOVE TO CURSOR sends the tile
  under the 3D cursor as a one-tile move and the host builds the path
  with `X2PathSolver.BuildPath` (limited to the unit's range), as the AI
  does. Run 6 in the checklist.

**Stage 5 Run 6 (test, 2026-11-14): the guest's moves reach the board
via MOVE TO CURSOR; the normal path display is hidden.** Mod 0.3.9 on
both (version check passed), build 8270065 (not re-reported). Logs
`stage5-pc-6.log`, `stage5-laptop-6.log`.
- **Moves from the guest (tested), through the fallback:** the host
  built paths of 11, 12 and 13 tiles and moved the units (PC L404, L463,
  L530); out-of-range destinations were refused with `no path in range
  to tile ...` (PC L526-605), as intended. Kc: works, but the mouse must
  cross the map to reach the button at the top right, so the tested
  destinations were near it.
- Targeting UI now closes after an order (Kc); latency "much improved"
  (Kc).
- **Why normal moves fail (tested by the diagnostics):** every `move
  check` line has `pawn hidden=True` and destination `-1,-1,-1`, while
  the cursor tile follows the mouse (laptop L406-473): the pathing pawn
  is hidden, so its Tick clears the path (`XComPathingPawn.uc`
  L900-920). Its Tick hides it while the stock replay screen is in the
  stack and tutorial mode is off (L870); the replay screen was closed
  inside its own `OnInit` (the screen-trace line came after the close,
  laptop L393-394), so it may have stayed in the stack.
- Still sticking (Kc): the selection stays on a unit with no actions
  left (the game's own auto-select runs in `TurnPhase_UnitActions`).
- **Changes (0.4.0):** the replay screen is closed 0.2 s after its
  `OnInit`; while the guest's input is on, any replay screen still in the
  stack is closed and a hidden pathing pawn is shown on the active unit
  (`SetVisible`, `SetActive`), logged once per input-on; the diagnostics
  add "replay screen in stack"; a unit with no action points left hands
  the selection to the next unit that has some. Run 7 in the checklist.

**Stage 5 Run 7 (test, 2026-11-14): pathing display visible; move-mode
path still empty; spent units skipped.** Mod 0.4.0 on both, build
8270065 (not re-reported). Logs `stage5-pc-7.log`, `stage5-laptop-7.log`.
- The pathing pawn was found hidden and shown (`hidden now=False`,
  laptop L293); afterwards every diagnostic line has `pawn hidden=False`
  and `replay screen in stack=False`.
- In move mode (`ActiveUnit_Moving`) the pawn's destination stayed fixed
  while the cursor moved (e.g. `dest=2,51,1` for 125 lines), `path of 2+
  tiles=False`. During ability targeting (`UsingTargetingMethod`) the
  path followed the cursor (`path of 2+ tiles=True`). Kc saw the same:
  the line shows while aiming any ability and freezes after Esc.
- MOVE TO CURSOR worked again (seven moves sent, laptop L426-1100); a
  claymore and Inspire went through; `has no actions left; selected unit
  ...` three times (L482, L516, L901), with minor visual glitches (Kc).
  No `WARNING`, no hitch. End Turn on the guest isn't possible (Kc;
  expected).
- **Change (0.4.1):** the active unit's reachable-tiles cache is set to
  the unit's current state and rebuilt, and the pawn re-activated, when
  input comes on, the unit changes, new frames arrive, or the input
  returns to move mode; each refresh logs the unit's action points and
  the cache's origin and max cost. Run 8 in the checklist.

**Change of approach for moves (Kc, 2026-11-14):** each run tests more:
a hotkey for MOVE TO CURSOR now, the whole move chain traced and every
condition addressed together, competing fixes behind on-screen toggles,
the full move state logged every 0.5 s. **Time-box:** if normal
click-to-move doesn't work after two more runs (Runs 8 and 9), the hotkey
is M3's movement method and click-to-move goes to the polish list.

**The chain from mouse-over to a submitted move on the guest (SDK
trace, 2026-11-14), with each condition's status:**
1. Input state `ActiveUnit_Moving` (`XComTacticalInput.uc` L1741-1790;
   set by the follower, allowed in tutorial mode, L780-786): met (logs).
2. The 3D cursor follows the mouse: met (cursor tile changes in the
   logs).
3. Pathing pawn visible with an active unit (`XComPathingPawn.uc`
   L846-927; hidden while a replay screen is in the stack and tutorial
   mode is off, L870): fixed in 0.4.0 (`hidden=False`).
4. Destination = the closest reachable tile to the cursor in the unit's
   reachable-tiles cache (L980-1040; `X2ReachableTilesCache`, its own
   unit state and history index, L30-60): **open**; the destination stays
   fixed in move mode. Suspects: a stale cache unit (fix A), the replay's
   "current history index" (fix B), world tile data not synced to the
   history (fix C).
5. Path rebuilt when the destination changes (`RebuildPathingInformation`,
   native `UpdatePath`, L734-1040): follows 4.
6. Click → `ClickToPath` (`XComTacticalInput.uc` L3047-3095): visualizer
   not blocking ability activation: met; melee check: n/a.
7. `PerformPath` (`XComTacticalController.uc` L1093-1110): unit not
   moving: met (mark cleared on the host's answer, 0.3.6); tutorial
   manager in `WaitForPlayerInput`: met (0.3.6); path of 2+ tiles:
   follows 4-5.
8. `GameStateMoveUnit` → latent submit → the ruleset → tutorial mode →
   the follower's capture (`X2GameRuleset.uc` L290-293): met for
   abilities and one-tile moves; untested for clicked paths.
Ability targeting draws the path (Kc, Run 7) because its targeting
method drives the pawn, not move mode.

**Run 8 build (0.4.2):** the M key and right-click (only while the game
has no path) for move to cursor (`X2TC_CoopInput`, an Interaction
inserted in the game viewport, as the engine's console is; not a class
override); FIX A (cache refresh, on), FIX B (history current index -1
while the input is on, off) and FIX C (world sync on refresh, off) as
on-screen toggles on the guest; a full `move state:` line every 0.5 s
while the guest's input is on (input state, unit, action points, tiles,
pawn, destination, path length, cache origin and max cost, whether the
cursor tile is reachable and the cache's closest tile to it, history
index, visualizer, tutorial state, fixes).

**Stage 5 Run 8 (test, 2026-11-14): the M key and right-click move the
guest's soldiers; fixes A-C do nothing for click-to-move.** Mod 0.4.2 on
both (version check passed), build 8270065 (not re-reported). Logs
`stage5-pc-8.log`, `stage5-laptop-8.log` (986 `move state` lines).
- M and right-click: ten moves sent (laptop L340-13310), applied by the
  host; out-of-range ignored (Kc).
- The cache is fine after refresh: correct origin, `max cost=24` with 2
  action points, 12 with 1 (L301-756). In 880 samples the cursor tile was
  reachable and the cache's closest tile was the cursor tile, yet the
  controller's pathing pawn never took a destination (`dest` unchanged,
  `path=0`). Fixes B and C (switched on at L439, L12240) and A off
  (L12616) changed nothing. Kc: the ground highlight updates only after a
  move, then stays frozen on the path taken.
- **Lead:** ability targeting draws paths because each targeting method
  spawns its own pathing pawn (`X2TargetingMethod_PathTarget.uc` L32,
  `X2TargetingMethod_MeleePath.uc` L31); the controller's pawn is spawned
  once at map load (`XComTacticalController.uc` L805), before the replay
  and the state switching. **Run 9 (0.4.3, the last run in the time-box):
  FIX D puts a freshly spawned pawn in the controller's slot** (on by
  default, switchable); the state line names the pawn in use.

**Stage 6 plan (draft for Kc's approval, 2026-11-14).** Starts as soon as
moves are settled either way (normal moves or the hotkey).
- **Ownership:** at session start (when the guest is following) the host
  submits one game state setting a unit value `X2TC_Owner` (1 = P1 host,
  2 = P2 guest, cleanup "never") on each XCOM soldier, alternating
  through the squad; no value means P1. It reaches the guest in the next
  partial history. (Unit values: `XComGameState_Unit.uc` L1239-1241;
  change state: `XComGameStateContext_ChangeContainer.CreateChangeState`,
  submitted with the ruleset's `SubmitGameState`.)
- **Phases:** a small mod state object (`X2TC_CoopState`, extends
  `XComGameState_BaseObject`) in the host's history holds the phase of
  XCOM's turn: P1, then P2. Each XCOM turn begins in P1. The host ends
  P1 with a new **CO-OP: END MY PHASE** button (not the game's End Turn,
  which can't be intercepted without an override; on the host it still
  ends XCOM's whole turn, so the checklist says not to use it in P1).
  The guest ends P2 with its own END MY PHASE button, which asks the host
  to end XCOM's turn (the host calls the ruleset's end-turn the way its
  End Turn button does; to be traced before coding).
- **Input:** the guest's input is on only in P2 (the follower's phase
  check reads the state object). During P2 the host's own input is
  locked with the stock `Multiplayer_Inactive` input state
  (`XComTacticalInput.uc` L1347, used by stock multiplayer's inactive
  player), and unlocked at P1 or the aliens' turn. Not a class override.
- **Enforcement on the host:** guest actions are refused unless the unit's
  owner is P2 and the phase is P2 (`Coop rejected: unit U is P1's, action
  from P2`). The guest's NEXT SOLDIER and auto-selection skip P1's units.
- **Banner:** a text line on both tactical HUDs: "CO-OP: P1 PHASE (host)"
  / "P2 PHASE (guest)" / "ALIEN TURN", and each soldier's owner in the
  log (`Coop owners: unit U -> P1|P2`).
- **Pass (SPEC.md M3):** three full turns (P1, P2, aliens each), each
  player moving only their own soldiers, matching `Coop sync` lines,
  Launch.log from both machines.
- **Approved by Kc (2026-11-14)**, with: (1) **alternating ownership**
  for M3; an assignment screen goes on the polish list. (2) **END MY
  PHASE buttons** for M3. **Stage 6 code waits until Run 8's (or Run
  9's) result settles moves.**
- **The host's own End Turn during P1 (checked 2026-11-14):** the
  Highlander has no event or hook before it. Both routes, the Backspace
  key (`XComTacticalInput.Back_Button`, L2417-2437) and the HUD's End
  Turn button (`UITacticalHUD_MouseControls.uc` L249-260), call
  `XComTacticalController.PerformEndTurn` (L1374-1412), which calls
  `XGPlayer.EndTurn` (L418-447) to submit a skip-turn rule context; the
  Highlander's only related event, `PlayerTurnEnded`
  (`X2TacticalGameRuleset.uc` L4955), fires after the turn has ended.
  **Plan for Stage 6:** keep the checklist warning; on the host during
  P1, have `X2TC_CoopInput` swallow Backspace (and the gamepad Back
  button), and try hiding the HUD's End Turn button from a screen
  listener; log `Coop phase: host ended XCOM's turn during P1` whenever
  XCOM's turn ends in P1 anyway. No class override.
- Polish list (from Stage 6 decisions): a soldier-assignment screen.

**Stage 6 revision (Kc's decisions, 2026-11-14), replacing the END MY
PHASE buttons and the End Turn block above:**
1. **"FRIENDLY ACTION" banner.** While the other player's soldier is
   acting, each screen shows a blue banner at the top in XCOM's style,
   like the red "ALIEN ACTIVITY" one. **How (SDK):** the game's own turn
   banner, `UITurnOverlay`: its blue XCOM-turn banner
   (`ShowXComTurn`/`HideXComTurn`, L283-313) shown with our text through
   `SetDisplayText` (L159-189, which sets all its banner texts at once),
   then the stock texts restored (`m_sXComTurn` and the others are the
   overlay's own localized strings). The multiplayer second-player banner
   (`ShowP2Turn`, L315-342) is the fallback if the blue one looks wrong
   (its colour isn't known from script). **When:** on the host, from
   applying a guest action until its visualizer is idle again; on the
   guest, from receiving frames it didn't cause (not right after its own
   action's answer) during XCOM's turn until caught up and idle.
2. **Ending the turn.**
   - Only the host can end XCOM's turn manually. The host's End Turn is
     no longer blocked.
   - The guest gets an **END TURN** button that ends nothing: it tells the
     host the guest is ready. The host shows a small text at the top right
     ("Partner is ready to end the turn"); the guest shows "Waiting for
     the host to end the turn". Reset at each new XCOM turn; a further
     guest action clears "ready" (confirmed by Kc, 2026-11-15).
   - **The turn ends by itself when no soldier of either player has
     actions left: confirmed in the SDK.** The host's ruleset ends the
     unit-actions phase when `ActionsAvailable()` is false, and that
     checks every member of XCOM's group, which includes the guest's
     soldiers on the host (`X2TacticalGameRuleset.uc` L4606-4690). The
     guest's own End Turn already does nothing (the HUD treats any
     tutorial manager as "first tutorial", `UITacticalHUD_MouseControls.uc`
     L218-260).
   - **Popup for the host:** if the host ends the turn while the guest's
     soldiers still have actions, and the guest hasn't pressed END TURN
     this round: "Your partner's soldiers can still act. End the turn
     anyway?" (End turn / Cancel). **How, without an override:** the HUD's
     End Turn icon only plays a "no" sound when its state isn't Normal
     (`UITacticalHUD_MouseControls.OnAccept` L205-216; `SetButtonState`,
     L167; `m_optEndTurn` and `UITacticalHUD.m_kMouseControls` are public),
     so while the popup would be needed the host's icon is set disabled
     and the host gets our own END TURN button that asks first; Backspace
     is caught by `X2TC_CoopInput` on the host and asks too. "End turn"
     calls `XComTacticalController.PerformEndTurn` (L1374), the icon's
     own path. When the popup isn't needed, the icon works normally.
3. **Side effect found:** `ActionsAvailable` also re-selects the next unit
   with actions on the host (L4650-4675), which can be one of the
   guest's soldiers. With ownership on, the host moves its selection to
   its own next soldier with actions (`Visualizer_SelectUnit`; the host
   isn't in tutorial mode, so its cycling works).
- Unchanged from the approved draft: alternating ownership stored as a
  unit value; the host refuses guest actions on P1's soldiers; the
  guest's selection skips P1's soldiers; logs from both machines; pass
  = three full turns.
- **Decided (Kc, 2026-11-14): shared turn now.** M3 drops the P1 / P2
  phases: both players act during the same XCOM turn, one action at a
  time (the host applies a guest action only when its ruleset and
  visualizer are idle). So Stage 6 has no phase state object, no END MY
  PHASE buttons and no host input lock; it keeps ownership (alternating
  unit values, host-side refusal, the guest's selection skipping P1's
  soldiers, the host's selection kept off P2's), the FRIENDLY ACTION
  banner, and the end-turn rules above. Decision 5 (split turns for M3,
  shared turn in M4) is superseded; M4's remaining work is SPEC.md's
  same-turn check itself (five turns, no desync, actions in arrival
  order), which these M3 runs already partly exercise.

**Run 9 result (0.4.3, Kc, 2026-11-15): fix D settles moves.** With FIX D
on, the blue path line follows the mouse and a **right-click** on it
moves the soldier (left-click doesn't; Kc: right-click is how it should
be). Switched off at about 12:34 (about 10 s after the second move), the
line stopped showing; switched back on about 10 s later, it showed again
(laptop log L406-430). Laptop moves of 7, 9, 5, 7, 7 and 10 tiles were
captured and all applied by the host. **Stage 5 is settled: normal
right-click moves, with M as a fallback.** Kc also asked for **Tab = next
soldier** as in normal play. END TURN on the laptop still did nothing and
no ally-activity marker showed (both Stage 6, not coded yet then).

**Stage 6 code (0.5.0, 2026-11-15):** checklists/m3-stage6.md.
- `X2TC_CoopOwnership` (new): owner per soldier, `AssignOwners` (one change
  state, alternating by object ID), `GuestHasActions`.
- `X2TC_CoopTurnUI` (new): the FRIENDLY ACTION banner through
  `UITurnOverlay`, the status line, the host's End Turn icon state.
- `X2TC_CoopSession`: owners assigned on FOLLOWING; guest moves and
  abilities on P1's soldiers refused (`Coop rejected: ...`); banner on the
  host when a guest action is applied, and on the guest when a partial
  history holds an ability (moves included) by a P1 soldier during XCOM's
  turn (read from the frames' contexts, which is simpler than the
  "frames it didn't cause" flag planned above); hidden after at least
  1.5 s once the visualizer is idle (and, on the guest, caught up);
  `X2TC_GuestReady` command; "ready" cleared by a further guest action
  and at each turn change; the host's End Turn icon disabled only while
  the question is needed, and given back afterwards; the question dialog
  (`PerformEndTurn` on "End turn"); the host's selection moved off P2's
  soldiers. `X2TC_CoopInput` installed on the host too.
- `X2TC_CoopInput`: Tab on the guest (next P2 soldier, during XCOM's input
  phase); Backspace and End on the host (both end the turn in the game,
  `XComTacticalInput.uc` L2462-2472) go to the question only while it is
  needed, otherwise to the game.
- `X2TC_CoopReplayMgr`: selection only on P2's soldiers, and moved off a
  P1 soldier; input phase start and end passed to the session.
- `X2TC_CoopListener`: END TURN buttons and the status line on both HUDs;
  FIX A/B/C buttons removed (A stays on, B and C off), FIX D kept.
- Not verified from source (in the checklist as guesses): whether the
  host's net mode is standalone (if not, `PerformEndTurn` also raises the
  game's own multiplayer end-turn box, `XComTacticalController.uc`
  L1358-1366); nothing refuses the host's own orders to a P2 soldier the
  game selects once P1 is out of actions.

**Co-op squad screen (approved by Kc, 2026-11-15; folded into 0.5.0
before its first run).** Kc's request: a screen to assign soldiers to
players, which both players can open, editable only by the host by
default, with every soldier belonging to the host by default, scrolling
vertically for squads larger than 6, plus checkboxes for ownership (on by
default; off = both players can move every soldier) and for letting the
partner end the turn ("in case the host has to step away").
- **Screen** `X2TC_CoopSquadScreen` (new, a UIScreen pushed on the
  tactical screen stack): opened by **CO-OP: SQUAD** on both HUDs. One row
  per XCOM soldier (name, class) with a P1 (host) / P2 (partner) spinner,
  in the game's scrolling `UIList` of `UIMechaListItem` rows (the
  character pool's pattern, `UICharacterPool.uc` L83-119, L266-268); three
  checkbox rows: **Soldier ownership** (on), **Partner may end the turn**
  (off), **Partner may edit** (off); a CLOSE button, Esc and right-click
  close it. Rows the viewer may not change are greyed out
  (`UIMechaListItem.SetDisabled` L593) and their callbacks do nothing.
- **Answers (Kc):** both view, the host edits, plus a "Partner may edit"
  checkbox; fold into 0.5.0; the three settings are session only (held
  by the host, sent by remote command, reset each time the PC hosts).
- **Owners:** every soldier belongs to the host until changed, which
  replaces the alternating split. Unit value `X2TC_Owner`, written by the
  host in a change state when the ruleset and visualizer are idle (queued
  otherwise), reaching the guest in the partial histories. The partner's
  edits (when allowed) go to the host by command; the host applies them.
- **Ownership off:** no refusal on the host, no selection limits on either
  side, no End Turn question.
- **Partner may end the turn:** the guest's button reads **CO-OP: END
  TURN** and ends XCOM's turn through the host without the question;
  otherwise it is the "ready" signal.
- **Smaller questions, approved defaults (1-3):** (1) with ownership off,
  the guest shows FRIENDLY ACTION for any XCOM soldier's action except the
  soldier it ordered itself in the last 5 s (a guess to test); (2) owners
  may change mid-turn, only when nothing is acting; (3) the guest's
  Backspace/End don't end the turn (polish list).
- **(4) Kc: rather not make the mod required for a campaign continued in
  single player; "addable/removable mid-campaign" preferred.** Unit values
  are the game's own name-to-number map on the unit
  (`XComGameState_Unit.uc` L205, L1239-1242), with no reference to a mod
  class, so a save holding one shouldn't need the mod (from source; not
  tested). To leave nothing behind anyway, the value uses
  `eCleanup_BeginTactical`, which the game clears when the next mission
  starts (`XComGameState_Unit.uc` L2229): owners last for one mission (and
  its saves), and keeping them across a campaign is an M5 decision.
- **Written (0.5.0, not built):** `X2TC_CoopSquadScreen` (new);
  `X2TC_CoopOwnership` (`AssignOwners` replaced by `GetSquad`, `SetOwner`,
  `LogOwners`); session (settings, the four commands `X2TC_Settings`,
  `X2TC_SetOwner`, `X2TC_SetSetting`, `X2TC_GuestEndTurn`, queued owner
  changes, ownership-off paths, guest banner rule); follower
  (`GuestMayControl`); input (keys pass through while the screen is
  open); listener (CO-OP: SQUAD on both HUDs); TurnUI (the guest's END
  TURN label). "Partner may edit" can only be changed by the host.
- **Owner memory (Kc's request, approved 2026-11-15: "Yes, add it"):** the
  host remembers which soldiers were given to the partner, per campaign,
  outside the save. `X2TC_CoopOwnerMemory` (new, `config(X2TacticalCoopOwners)`)
  keeps entries (campaign start time, the game's campaign UID,
  `XComGameState_CampaignSettings.uc` L15; unit object ID; owner), written
  with `StaticSaveConfig` whenever the host applies an owner change, and
  read at HOST, which gives remembered P2 soldiers back to the partner.
  The mod ships `Config\XComX2TacticalCoopOwners.ini` with no entries.
  Guesses to test (checklist step 10): the game writes the player's copy
  in their own config folder; a changed default file could reset it, so
  the shipped file must never change between releases; it stays on the
  host's PC; Skirmish may have no campaign ID (then nothing is
  remembered).

**Stage 6 Run 1 (0.5.0, Kc, 2026-11-15; build 8270065 on the PC from
appmanifest_268500.acf, laptop not re-reported):** logs `stage6-pc-1.log`,
`stage6-laptop-1.log` (laptop clock about 17.5 s ahead). Four XCOM turns.
- **Worked:**
  - Squad screen on both. Owner changes reached the laptop in about
    0.3 s (PC L424-495).
  - The laptop's move on a soldier given back to P1 was refused (PC
    L474-476).
  - FRIENDLY ACTION on both machines (PC L2010, laptop L1023 onwards).
  - The question on Backspace, then Cancel (PC L2313-2316).
  - "Ready" set and cleared at the turn change (PC L2317-2335, laptop
    L2056).
  - "Partner may edit" let the laptop switch ownership off and "Partner may
    end the turn" on (PC L4159-4278).
  - The partner's END TURN ended the turn (PC L4279); the second press, one
    turn later, was refused (L4306).
  - Owner memory wrote 4 entries in a Skirmish, which has a campaign ID
    (`campaign ID present=True`, PC L400).
- **Problems (Kc, logs):**
  1. With no soldier, the laptop's input stayed on for the soldier given
     back (laptop L679-681). Kc asked for a blue **NO SOLDIERS ASSIGNED**
     banner.
  2. Click-to-select never works on the laptop: the game skips it while
     any tutorial manager exists (`XComTacticalInput.uc` L2846). Our NEXT
     SOLDIER and Tab work.
  3. Once the PC's own soldiers were done, the game selected P2's soldiers
     on the PC and the PC could act with them. The laptop showed no banner
     because only P1 sources counted.
  4. Neither screen can pan while the other's action plays: vanilla action
     camera; M4's camera option.
  5. Polish: drop the explanation on "Soldier ownership".
- **0.5.1:** fixes 1, 2, 3 and 5 (checklist Run 2). (1) The follower keeps
  the input off without a controllable soldier, and the session shows NO
  SOLDIERS ASSIGNED (one banner manager: FRIENDLY ACTION first). (2) Our
  input's left-click selects the soldier on the tile under the 3D cursor
  (`XComWorldData.GetUnitsOnTile` L923), skipping clicks over the HUD
  (`XComInputBase.TestMouseConsumedByFlash` L166). (3) The PC's input is
  set to stock multiplayer's `Multiplayer_Inactive` (camera still scrolls,
  `XComTacticalInput.uc` L1347-1424) while only P2's soldiers can act, set
  again if the game changes it, and given back when a P1 soldier is
  selected or ownership is off. Backspace/End go to our End Turn while
  locked. Banner rule (Kc, same day): with ownership on, P1's soldiers, as
  in 0.5.0, because the lock keeps the PC off P2's; with ownership off,
  any soldier the laptop didn't order in the last 5 s. The PC's banner
  comes from applying the laptop's action in both modes.

**Stage 6 Run 2 (0.5.1, Kc, 2026-11-15; build 8270065):** logs
`stage6-pc-2.log`, `stage6-laptop-2.log`.
- **Passed:**
  - NO SOLDIERS ASSIGNED (laptop L407, L472).
  - Left-click select, on the body too (laptop L525-557, 6 clicks;
    P1 clicks refused).
  - The laptop's overwatch on a P1 soldier refused (PC L463-465).
  - The PC lock: on at PC L653, the PC idle about 4 min; off by itself at
    the next XCOM turn (L1516).
  - The turn ending by itself, and ownership off (step 6).
- **Kc:**
  - A given-back soldier stays selected without acting: fine.
  - Tab on the PC reaches a laptop soldier, then is pushed back
    (polish: skip them in the PC's own Tab).
  - The lock's ability icons and Backspace weren't checked.
  - He asked for the banner to stay up on the PC while it's locked.
- **Regained actions (Kc's question; from source, not tested):**
  - Every 0.2 s, the locked PC looks for a P1 soldier with actions,
    selects it, and unlocks on the next tick.
  - The partner's input stays on while it has any assigned soldier, and
    its skip picks one with actions.
  - The question and the auto end recount actions every tick or turn.
  - Teamwork (`BondmateTeamwork`, `X2Ability_DefaultBondmateAbilities.uc`
    L45) should work either way.
- **0.5.2 (Kc's clarification):** a player out of moves keeps the same
  FRIENDLY ACTION banner, in the same place, until its soldiers have
  actions again (a new turn, or e.g. Teamwork). This applies on both
  machines, during XCOM's turn, with ownership on. It's based on the
  player's own soldiers' action points (`PlayerHasActions`), not on the
  lock. A host with no soldiers of its own sees it for the whole turn.
  Kc from Run 2: while locked, the PC's camera pans and Backspace works;
  ability icons not checked. Teamwork waits for a campaign test (Skirmish
  has no bonds). Checklist Run 3.

**0.5.3 (Kc, 2026-11-15: "go a bit further"; all four picked).**
- **The PC's Tab and H** cycle only its own soldiers that can act, while
  ownership is on, it's XCOM's turn and the PC isn't locked
  (`HostCycleOwnSoldier`).
- **H = previous soldier** on both machines. Kc: not Shift+Tab, which is
  Steam's overlay. H is unbound in every input section of the game's
  `DefaultInput.ini`: the only H entries are the text-entry alias lists
  (L556, L558). `XComInputBase.uc` L1148 `Key_H` is an empty stub.
- **FIX D button removed;** the fix stays on by default.
- **Refusal message:** the laptop's status line shows a short reason for
  4 s.
- **The laptop's Backspace/End** end the turn when "Partner may end the
  turn" is on.
- **Mission end, from the SDK:**
  - The battle ends with an `eGameRule_TacticalGameEnd` frame
    (`X2TacticalGameRuleset.EndBattle` L225-282). The host's ruleset then
    goes to `EndTacticalGame`, which shows the mission summary
    (L5023-5070).
  - A replay only follows into `EndTacticalGame` for Challenge Mode
    (`XComReplayMgr.uc` L258-265). So the guest stopped on the last frame
    with nothing handled, and the host's session stayed open, which made
    HOST refuse in the next mission.
- **Mission end, the fix:**
  - The follower spots the end frame. Once caught up and idle (8 s at
    most), it stops the guest's input and the session shows **CO-OP:
    MISSION OVER** (won or lost, from `BattleData.bLocalPlayerWon`,
    `XComGameState_BattleData.uc` L161), with a Main menu button
    (LeaveAsGuest).
  - The guest's ruleset is deliberately not sent to `EndTacticalGame`,
    whose cleanup is for a campaign.
  - The host spots the end frame. 5 s after the guest has it (30 s at
    most), it disconnects and resets the session, with the game's own
    connection-error handling kept out.
  - A guest that loses the host mid-mission gets **CO-OP: HOST
    DISCONNECTED** with the same button.
  - A host session left over from an earlier mission is closed when HOST
    is clicked again.
  - Every step logs `Coop mission end (...)`.
- Not verified from source: whether the guest's dialog and map change are
  clean right after its replay reaches the end; whether the host's
  disconnect during the summary screen disturbs it. Checklist Run 3 (0.5.3).

## Stage 7: co-op over the internet via Steam (approved by Kc, 2026-11-15)

**Goal.** A friend elsewhere joins without port forwarding. Direct IP works
on a LAN but needs port forwarding over the internet. Research:
research/steam-connection.md.

**Kc's answers.**
- Only Kc's own Steam account is available, so Steam tests need a friend.
- No hotspot.
- **Stage 7 before Stage 6 Run 3**, with one comprehensive test set
  (checklists/m3-stage7.md).
- Remove H only if XCOM has no previous-soldier key. It has one: Shift+Tab
  on release (`XComTacticalInput.uc` L2197-2210), which Steam's overlay
  usually takes. So H stays, and Shift+Tab also works in the mod.

**Design (0.6.0).**
- **Host.** CO-OP: HOST (STEAM) on the tactical HUD calls `StartHostSteam`:
  - It creates a private session (`XComOnlineGameSettingsDeathmatchUnranked`:
    0 public / 2 private connections, the stock version hashes), as the
    shell does (`XComShellPresentationLayer.uc` L1209-1226, L1286-1358).
  - `CreateOnlineGame('Game')`, then on completion `CreateServer` with
    Port 7777 plus `steamsockets` (`UIMPShell_Lobby.uc` L510; SPL L1121).
  - Then `ShowInviteUI` (`UIMPShell_Lobby.uc` L897). The button becomes
    INVITE (STEAM), which reopens the overlay.
- **Guest.** CO-OP: JOIN (STEAM) on the main menu arms the session. The
  next accepted invite goes from `X2TC_InviteListener` to
  `OnSteamInviteAccepted`:
  - `JoinOnlineGame`, then `GetResolvedConnectString`, split as SPL
    L1142-1159 does.
  - `CreateClient` with `steamsockets`, then the usual retries, ping,
    version check, history and follow.
- **Clearing the stock invite.** The game's own invite handler also runs
  (it disconnects and stores the invite, `XComOnlineEventMgr.uc`
  L3554-3559). Once joined, the mod clears the stored invite and shuttle
  (`ClearAcceptedInvites`, `ClearShuttleToScreen`) so the main menu doesn't
  act on it later.
- **Cleanup.** `DestroyOnlineGame('Game')` runs when the host's session
  closes (mission end, a stale session) and when the guest leaves.
- **Two HOST buttons.** A session counts as stale only if its poll timer
  isn't running on the current map (`IsPollRunning`). Clicking either HOST
  again in the same mission no longer closes a live session.
- **Unchanged.** Direct IP (HOST, JOIN) for the LAN.

**Fallbacks if the test fails.**
- The Steam lobby API (`OnlineGameInterfaceXCom.uc`: CreateLobby L298,
  JoinLobby L426, SetLobbyServer L909, InviteToLobby L947; manual flow in
  `XComCheatManager.uc` L3767-3789).
- `AllowP2PPacketRelay` (L287), if a direct Steam P2P connection can't form.

**Unknowns the test settles.**
- `steamsockets` from a single-player tactical map and the main menu.
- Invites while hosting a single-player mission.
- Delegate order with the stock invite handler.
- The connect string's format.
- Relay without port forwarding.
- Lag.

**Run 1 (0.6.0, Kc and a friend, 2026-11-15): invite refused.**
- **Host:** worked (Steam session, `steamsockets` server, overlay).
- **Guest:** the game's check (`CheckInviteGameVersionMismatch`
  L3593-3614) refused the invite.
  - The mods hash differs: same mods, different order (friend:
    X2TacticalCoop first). Kc's reverse-tick test in AML left his
    `XComModOptions.ini` order unchanged, so the order isn't settable by
    ticking.
  - The guest's session object was garbage collected while armed.
- **0.6.1:** `ArmSteamInvite` adds the network manager's delegates.
- **0.6.2 (approved by Kc):**
  - While armed, the guest takes the game's own invite handler off
    (`ClearGameInviteAcceptedDelegate(0, ...)`; it registers for user 0,
    `Engine\Classes\OnlineEventMgr.uc` L133). It's restored 1 s after the
    co-op invite and on every session reset.
  - Ping and pong carry `ContentList()`, the sorted mod and DLC names
    (`Helpers.GetInstalledModNames` / `GetInstalledDLCNames` L103-104). A
    difference refuses the history and names the difference.

**Run 2 (0.6.2, Kc and a friend over the internet, 2026-11-15).**
Builds: both report `Init: Version: 8917`; the PC's buildid is 8270065
(the friend's isn't reported). Logs: `stage7-pc-2.log`,
`stage7-friend-2.log` (the friend's clock is about 361 s ahead).

**The Steam connection works without port forwarding:**
- The invite was handed to the co-op session; the Steam session joined in
  0.3 s.
- The address resolved and the client connected with `steamsockets`
  5 s later (friend L191-208).
- Mods and DLC matched by name.
- The 243 KB history loaded and the follow started about 15 s after the
  invite.
- PC: "Initialized RedirectNetDriver, for redirecting IP connections to
  Steam sockets" (L379).

**A full mission:** 14 XCOM turns, so the M3 three-turn check is covered.
- 51 friend actions captured, 51 applied by the host, none refused.
- The mission was lost at frame 2402.

**Problems:**
1. **Mission end.** The friend saw "host disconnected", not MISSION OVER:
   the host closed 5 s after the guest had the end frame, while the guest
   was still animating (its dialog waits up to 8 s; friend L4806-4817).
2. **Rocket.** The friend's SparkRocketLauncher damaged terrain but no
   unit: the host passed the location without the units in the area.
3. **Bound soldiers.** With both P1 soldiers bound, the host saw no
   banner; action points alone counted them as able to act.
4. **A P1 soldier stuck after a bind.** From turn 7, the host was
   re-locked every turn with the banner up at each turn start, so the
   game's state said no P1 actions. The cause isn't in the log (no
   per-unit state was logged).
5. **No cover icons or move-range border on the guest.** Only the path
   line shows (fix D's fresh pawn; cause unknown).
6. **Camera.** It sometimes pans to the other player's action and
   sometimes doesn't (vanilla action camera; the M4 camera option).
7. **Lag grows** (Mr.Fear's warning, now measured):
   - each partial history is the whole delta-encoded history: 20 KB at
     the first send, 208 KB for a 1-frame send at frame 1480, 409 KB at
     frame 2345;
   - the guest's acknowledgements were 0 s: 24, 1 s: 55, 2 s: 44,
     3 s: 20, 4 s: 11.

**The friend's request:** see where the other player is aiming (an orange
cursor or path).

**0.6.3 (written, not built):**
- **(1)** The guest sends `X2TC_MissionEndShown` when its MISSION OVER
  dialog is up. The host closes 2 s later (60 s at most, or at once if the
  guest left). A guest whose replay already passed the end frame doesn't
  show HOST DISCONNECTED.
- **(2)** For guest abilities aimed at a location, the host fills the
  area targets itself (`GatherAdditionalAbilityTargetsForLocation`).
- **(3)** "Can act" uses the ruleset's unit cache (`bAnyActionsAvailable`)
  for the banner, the lock, selection, cycling and the End Turn question.
- **(4)** The host logs every soldier's state (AP, can act, effects) at
  each XCOM turn start and when it locks.
- **(5)** The fresh pawn gets `InitEvents` (a guess).

**Backlog from Run 2 (needs a plan):**
- **Incremental history sends.** Only the new frames, instead of
  `SendPartialHistory`'s whole delta. This is the main scaling risk.
- **Cover and range display on the guest.**
- **Camera option.**
- **The other player's aim marker.**

**Pass.** The friend joins over Steam, plays co-op turns, and a second
mission connects again.

## Stage 8: send only new frames (approved by Kc, 2026-11-15, "Approve as drafted")

**Why.** The friend said the game felt "more unstable" as the mission went
on, though the lag wasn't very noticeable. Run 2 measurements are in
research/history-sync.md:
- the partial history grew from 20 KB to 409 KB;
- acknowledgements grew to 2-4 s;
- the guest stalled in bursts at frames 718 and 1974;
- the host logged 1910 stack traces (`X2GameRuleset.uc` L237-249).

**Steps (0.7.0 onward).**
1. **8.1, LAN test with the laptop (Kc alone).**
   - A host-only **SYNC: NEW FRAMES** checkbox on the squad screen, off by
     default. It can be changed only before the guest follows, because
     switching mid-mission would leave the native delta baseline behind.
   - When on, the host sends each new frame with
     `SendGameState(GameState, HistoryIndex)` (L338) instead of
     `SendPartialHistory`, one batch in flight.
   - The guest registers `OnReceiveGameState` and logs whether each frame
     landed in its history at the right index. It acknowledges with its
     frame count.
   - Both sides log bytes per batch and acknowledgement times.
2. **8.2, make it the default (if 8.1 works).**
   - Batches of a few frames, an ack and a resend.
   - A full resync if the frame counts disagree.
3. **8.3, the stack-trace spam.** Test `SetPauseGameStateSending` (L264)
   and measure the trace count and any host stutter.

**Pass.** A 10+ turn mission where send size stays roughly flat,
acknowledgements stay under about 1 s, and the guest has no stall bursts.
Then one friend run over Steam.

**Defaults (Kc approved the draft without answering its questions):**
1. 8.1 on the LAN with the laptop first.
2. If the native side doesn't add the received frames to the guest's
   history, stop and report rather than adding them by script (the
   prototype reported crashes that way).
3. Stage 7 Run 3's checks (0.6.3) ride along in the 8.1 LAN run. The same session runs Stage 6 Run 3 and the M3
check (3 full turns, logs from both machines).

**8.1 run (0.7.0, Kc alone, PC + laptop on the LAN, 2026-11-18; buildid
8270065 on both).** Logs in `local\m3-logs\`:
`stage8-pc-0-crash.log` (+ `-crashdump.log`), `stage8-pc-1.log` /
`stage8-laptop-1.log`, `stage8-pc-2.log` / `stage8-laptop-2.log`.
- **Switch on (run 1): stop case.** Every frame reached the laptop, none
  joined its history: `new frame 1..9 received ... history frames=112,
  in the history at its index=False` (laptop L453-529). The PC applied the
  laptop's moves; the laptop's screen never changed; acks timed out
  (`not acknowledged after 15s`). Per default 2, 8.2 doesn't start.
- **Switch off (run 2): M3 check met.** 7 full XCOM turns, won in turn 8;
  the guest acted in every turn (19 moves: 16 applied, 3 refused as out
  of range; 8 abilities: 7 applied); all 36 `Coop sync` pairs match.
  Partial sends 30 KB at first, up to 427 KB; acks 0 s: 19, 1 s: 50,
  2 s: 16; 1 guest hitch.
- **0.6.3 checks:** MISSION OVER on the laptop (run 2 and run 0's first
  mission) **pass**; the laptop's grenade (`LaunchGrenade ... the host
  found 2 units in its area`) **pass**; a bound P2 soldier logged `can
  act=False` **pass** on the host, but the laptop can still select it.
  Cover icons and move range still missing on the laptop (the
  `InitEvents` guess failed).
- **Crash (run 0, PC):** after the guest left an Extract VIP mission, the
  PC asserted leaving the map (`UnGame.cpp` L3107, "World ... not cleaned
  up by garbage collection"). The reference chain in the crash log runs
  from `XComGameStateNetworkManager.HistoryContextData.ContextRef` to an
  ability context's `TraceHitInfo.HitComponent` in the old map. So the
  network manager kept the last sent context alive across the map change
  (from the log; that the mod causes it, rather than alt-tab, is a guess).
- **Kc's other observations (not in the logs):** ability icons all
  glowing on the laptop; the laptop's camera doesn't follow moving
  soldiers; VIPs and civilians aren't on the squad screen, and the host
  controls them under the FRIENDLY ACTION banner; no detection warnings
  on the laptop; a PC SPARK's rocket flying in from off the map **on the
  PC's own screen** (Kc: rockets in particular may be broken; cause
  unknown, a guess either way whether the mod is involved);
  laptop soldiers stopping short, then catching up at the next move; no
  mouse-wheel elevation on the laptop (F/C work); the alien turn plays
  longer on the laptop; hacking opens the hack screen on both machines
  (the PC's choice decided it; the laptop's `FinalizeHack` was refused
  after 10 s, and the laptop has no Cancel).

**Decision (Kc, 2026-11-18): new-frames sync dropped for now.** "Let's
look into optimization once the basics are done." 8.2 and 8.3 are
deferred; the SYNC: NEW FRAMES switch stays in 0.7.0 as an off-by-default
test setting until a plan removes or replaces it.
