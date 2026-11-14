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
idle). The guest has no pause menu while following (Stage 4): it needs
at least a way to quit, from Stage 5 on. Heavy history may freeze the guest (Mr.Fear; the prototype's lost
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
  XCOM turn 3 (the run ended 4 s after it). **Short of the checklist's
  three full rounds**; Kc to decide whether that is enough.
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
