# M2 plan: reach multiplayer on the current build (decision gate)

Approved by Kc on 2026-11-10 (Session 5, on the PC), with five notes that
are worked in below (see "Decisions"). Everything marked "guess" is
untested.

## Context
SPEC.md M2: a small mod adds a button that opens the multiplayer screen,
then one ordinary 1v1 match gets through at least one full turn, or the
exact failure point is recorded with Launch.log lines from both machines.
The result decides: current build (8270065) or the beta branch.

What reading for this plan found (SDK paths are under
`Development\SrcOrig\XComGame\Classes\`; not tested in game):
1. **The game's multiplayer log lines are switched off.** The game's
   `XComGame\Config\DefaultEngine.ini`, section `[Core.System]` (L120),
   suppresses `DevNet`, `DevOnline` (L163-164), `XCom_Net` (L199) and
   `XCom_Online` (L234). The clean baseline log has no line in any of
   those categories. So the lines sdk-findings.md says to look for will
   not appear. Plain `Log:` lines do (baseline L120 `LoadMap:`, L122
   `Game class is`). We need our own `X2TC` lines.
2. **A button inside the menu row would be wiped.**
   `UIFinalShell.UpdateMenu` (L127-149) clears and rebuilds the row
   whenever the save list or login status changes (L256, L340;
   `UIShell.ClearMenu` L248-256). The button must stand alone on the
   screen, the way `UIFinalShell` adds its own My2K button (L67-71).
3. **The match hashes can be logged from script.** The `Helpers` natives
   (`Helpers.uc` L94-105) are static; the cheat `displaympmatchcriteria`
   (`XComShellCheatManager.uc` L69-86) just prints them, and the invite
   path compares them in script (`XComOnlineEventMgr.uc` L3593-3615). Our
   mod can print each machine's hashes before any connection is tried.
4. **The multiplayer shell map still ships:**
   `XComGame\CookedPCConsole\XComShell_Multiplayer.upk` (open question 8).
5. How the game creates listener objects is native (no listener code in
   `UIScreenStack.uc`). A click handler on the listener is the usual mod
   pattern; whether it fires is what table row 2 tests.

## Decisions (Kc)
- Do as much as possible on the PC alone. The laptop when needed (the
  game gets installed there then). Major tests with a friend.
- One Steam account can't normally play on two PCs at once, and a second
  account needs its own copy of the game. So Stage 3 is a test with a
  friend who owns XCOM 2 and War of the Chosen, and Stage 2 results on a
  shared account may be ambiguous.
- **Highlander hypothesis (Kc's, a guess, not a finding):** the
  Highlander replaces XComGame with scripts built from pre-2022 source,
  so if the shutdown switch is in XComGame's scripts, running with the
  Highlander might undo it. Order: read its source first; run with it
  only if the plain test fails. Repo:
  github.com/X2CommunityCore/X2WOTCCommunityHighlander (Kc confirmed),
  cloned by Kc into `local\refs\`.
- Keep the trace listener.
- Option: if Stage 1 fails in a confusing way, do the beta reference run
  early.
- This is logged as Session 5.

## Stages

### Stage 0: read the Highlander source (PC, no game)
- Kc clones it into `local\refs\` (the agent doesn't run git). Its
  license is recorded in LOG.md.
- Compare its `UIFinalShell.uc`, `UIShell.uc`,
  `XComShellPresentationLayer.uc`, `UIMPShell_MainMenu.uc` and
  `X2MPShellManager.uc` with the SDK's (read-only diff), and search its
  docs and changelog for multiplayer or 2022 changes.
- Limit: the agent can't run `git log`, so "merged anything from the
  2022 build" is answered from file contents and its changelog only.
- Result goes into research/sdk-findings.md, next to the hypothesis (open
  question 13, labeled a guess).

### Stage 1: PC alone (button, menu, hosting)
Tests table rows 1-7 with no second machine.
- Run A: host a custom game with lobby type **LAN**, reach the lobby.
- Run B: host with lobby type **Private** (Steam). Tells us alone whether
  Steam session creation still works on 8270065 (open question 3).
- Also open "Find custom game" once and search, to see the search screen.
- **Optional early beta reference run.** If Stage 1 fails in a confusing
  way (the log doesn't match any row's meaning), do fallback 3's
  reference run early, on the PC alone: switch to the beta, record its
  build ID, host a lobby with mods off, then once with our mod for the
  same `X2TC` trace lines, and save both logs. That shows what working
  multiplayer looks like in Launch.log. Then switch back, check the build
  ID is 8270065 again, and restore the clean config.

**Stage 1 run 1 result (2026-11-10, build 8270065):** rows 1-2 pass,
row 3 fails. Nine clicks reached our handler and called
`StartMPShellState()`; no map load and no error followed (LOG.md).

**Changed order (Kc, 2026-11-10):** the next PC runs are, in this order:

#### Stage 1b: Highlander run (PC, no code change)
Fallback 1 moved forward, on the PC alone. Reason: Discord community
reports (not tests; research/sdk-findings.md) say the Highlander brings
the original multiplayer menu back.
- Kc subscribes to the Highlander on the Workshop (the agent doesn't run
  Steam) and ticks it in AML together with X2TacticalCoop. Same
  arguments, console off, clean config restored first.
- Note the Highlander version shown in AML or in game, if any.
- Check whether the game's own Multiplayer item is back in the main
  menu row. If it is, use it; if not, use our MULTIPLAYER button (that
  tests whether the Highlander's `StartMPShellState` works).
- Then Run A (LAN lobby) and Run B (Private lobby), as in Stage 1.
- Log: `local\m2-logs\pc-stage1b-highlander.log`.
- What to expect differently in the log (guesses from Stage 0): no
  `Plot_Multiplayer_Test` redscreen (the Highlander's `XComPlots.ini`
  removes it); fewer of the game's own script log lines (its README says
  script logging is stripped from the cooked build). Our `X2TC` lines
  come from our own package and should still appear.
- The Highlander changes XComGame and the installed-mods list, so the
  hashes in `MP criteria` will differ from a run without it. Any later
  two-machine test with it needs the same Highlander version on both.

**Stage 1b result (2026-11-10, build 8270065, Highlander v1.32.0 from
the Workshop):** the stock MULTIPLAYER and CHALLENGE MODE items are back
in the main menu row (Kc saw it; log L114-120 shows the Highlander's
components loaded). Clicking stock MULTIPLAYER did nothing (Kc), and our
button's four clicks (L178, L180, L181, L212) were followed by no
`LoadMap`. Row 3 fails with the Highlander too. The full log (recopied
after the game closed, 269 lines, clean exit L260) adds: a later
Challenge Mode visit that reached the challenge leaderboards screen,
where our trace logged `MP state network=True online=True` (L244; that
screen extends the multiplayer shell base class), and the message "An
active challenge is not currently running" (Kc). Leading hypothesis
(Kc, a guess): the block is below script, in the exe or the `open`
command (research/sdk-findings.md section 7).

#### Stage 1c: variant A, two test buttons (PC, without the Highlander)
Changed 2026-11-10 (Kc): two test buttons instead of one, under our
MULTIPLAYER button, in a column at the top right (moved off the logo):
- **MP TEST: OPEN** runs
  `open XComShell_Multiplayer.umap?Game=XComGame.XComMPShell` with
  `ConsoleCommand`, the same command the SDK's `StartMPShellState` runs
  (`XComShellPresentationLayer.uc` L706).
- **MP TEST: TRAVEL** calls `ClientTravel(<same URL>, TRAVEL_Absolute)`
  on the shell's `XComPlayerController`, the route the shell uses to
  start an online game (`XComShellPresentationLayer.uc` L1197;
  `Engine\Classes\PlayerController.uc` L504).
- Each logs `X2TC: MP test <name> clicked…` before the call and
  `X2TC: MP test <name>: … returned` after it.

Reading it (guesses until run):
- OPEN loads the map: the retail `StartMPShellState` itself was emptied;
  the Highlander result then needs another explanation.
- OPEN fails, TRAVEL loads: the console-command route is blocked for
  this map, travel isn't.
- Both fail, both "returned" lines present: the exe refuses this map or
  game class below script, which fits the leading hypothesis. Next would
  be direct IP or the beta reference run.
- A "returned" line missing or a crash: note the last line; the call
  itself failed.

Log: `local\m2-logs\pc-stage1c.log`.

**Stage 1c result (2026-11-10, build 8270065, no Highlander):** OPEN
logged before and after its call (L171-172) and loaded nothing. TRAVEL
loaded the multiplayer shell (L173-183) and its main menu (L208). Rows
1-5 pass by the travel route; Ranked Match greyed out (Kc), which the
SDK does when ranked game data isn't valid (`UIMPShell_MainMenu.uc`
L521-524). Leaving the multiplayer menu loaded the main shell
(L227) without a `PreClientTravel` line, the way `X2MPShellManager.CloseShell`
does with `ConsoleCommand("open" ...)` (L264-268): so `open` itself
still works for that map (details in LOG.md and sdk-findings.md).

#### Stage 1d: rows 6-7 by the travel route (PC, no Highlander)
Changed 2026-11-10 (Kc): the MULTIPLAYER button now uses
`ClientTravel`; the two test buttons stay for now. One run:
create custom match with LAN, reach the lobby, back out; the same with
Private; search for custom match once (LAN). Log:
`local\m2-logs\pc-stage1d.log`. Then Stage 2/3 as planned.

### Stage 2: PC + laptop on LAN, shared Steam account (optional, may be ambiguous)
Tests rows 8-11 when Kc is alone. One Steam account can't normally play
on two PCs at once, so this stage may not start at all, and any failure
in it is ambiguous: it could be the shared account, not the game. A
Stage 2 failure never triggers a fallback by itself; it goes to Stage 3.
A Stage 2 pass still counts. Guess: the laptop would have to run Steam in
offline mode, which allows LAN only, and both machines may report the
same Steam ID.

Prerequisites on the laptop:
- Game and the same DLC installed; build ID 8270065 from its
  `appmanifest_268500.acf`.
- One mods-off run to the main menu, then back up its `Config` folder to
  the laptop's `local\`.
- AML v1.6.0, the game's `Mods` folder added, same arguments as the PC.
- **The same mod files:** copy the PC's built
  `...\XComGame\Mods\X2TacticalCoop` folder to the laptop instead of
  building there. Guess: two builds may differ byte for byte, and the
  package hash is part of the match check.

### Stage 3: with a friend who owns XCOM 2 and War of the Chosen (the major test)
The friend plays on their own Steam account and their own copy. Who and
when is Kc's to arrange (never invented here).
- Their side needs build 8270065, the same DLC as Kc's, AML with the same
  arguments, and the same mod files (the copied `X2TacticalCoop` folder).
- If they're on Kc's network: LAN first, then Private. If they're remote:
  Private (Steam) only, and LAN between two accounts stays untested.
- The `MP criteria` lines from both sides are compared before connecting;
  a DLC or mod difference shows there.
- Their `Launch.log` is needed too. It goes to `local\m2-logs\` and is
  never committed.
- Run it once Stage 1 passes, whether Stage 2 passed, failed or was
  skipped.

## Mod changes (all in `mod/X2TacticalCoop/Src/X2TacticalCoop/Classes/`)
No class override, no new dependency. Written when Stage 1 starts.

**`X2TC_MainMenuListener.uc` (targeted edit).** On the main menu's
`OnInit`, after the existing line:
- spawn a standalone `UIButton` on the screen (`InitButton`,
  `UIButton.uc` L53; `AnchorTopLeft`, `UIPanel.uc` L430), label
  "MULTIPLAYER", and log `X2TC: MP button added`;
- click handler on the listener: return if `UIShell.m_bDisableActions`
  (`UIShell.uc` L28), log `X2TC: MP button clicked, calling
  StartMPShellState`, then call
  `XComShellPresentationLayer(Screen.Owner).StartMPShellState()`
  (`XComShellPresentationLayer.uc` L702-712), the same call the old menu
  item made (`UIFinalShell.uc` L165-166).

**`X2TC_MPTraceListener.uc` (new; diagnostics only, changes no behavior).**
A second listener with `ScreenClass = none`:
- every screen: `X2TC: screen <class name>, game <game class name>`;
- screens that extend `UIMPShell_Base`: also
  `X2TC: MP state network=<...> online=<...>` from
  `m_kMPShellManager.m_bPassedNetworkConnectivityCheck` /
  `m_bPassedOnlineConnectivityCheck` (`UIMPShell_Base.uc` L17,
  `X2MPShellManager.uc` L55-56), the two flags that gray out menu items
  (`UIMPShell_MainMenu.uc` L509-532);
- `UIMPShell_MainMenu` only: `X2TC: MP criteria ...` with the package,
  DLC, mods and INI hashes, the dev-console flag, and the installed mod
  and DLC names (`Helpers.uc` L94-105).

The trace is more than "a button", but the milestone's check needs log
lines at the failure point and the game's own are suppressed. Kc: keep it.

## What Launch.log should show, step by step
| # | Step | On | Expected lines | If missing, it means |
|---|---|---|---|---|
| 1 | Main menu | both | `X2TC: Main menu listener loaded...`, `X2TC: MP button added` | Our mod isn't active, or the button code failed (ours to fix) |
| 2 | Click the button | both | `X2TC: MP button clicked...` | The click never reached the listener (ours to fix) |
| 3 | Shell map loads | both | `Log: LoadMap: XComShell_Multiplayer...XComMPShell`, `Log: Game class is 'XComMPShell'` | `StartMPShellState` was emptied or removed in 8270065 (a crash naming the function means removed). Try variant A |
| 4 | MP main menu | both | `X2TC: screen UIMPShell_MainMenu`, `MP criteria`, `MP state` | The map loads but the menu isn't pushed. Try variant B |
| 5 | Items enabled | both | `MP state network=True`; Kc sees Create/Find custom enabled | The native network-link check fails |
| 6 | Create custom, pick squad | host | `screen UIMPShell_CustomGameCreateMenu`, `...SquadLoadoutList_CustomGameCreate` | The menu flow itself is broken |
| 7 | Host reaches lobby | host | `LoadMap: XComShell_Multiplayer?Game=XComGame.X2MPLobbyGame`, `Game class is 'X2MPLobbyGame'`, `screen UIMPShell_Lobby` | Session or server creation failed in native code. Note the dialog text |
| 8 | Second machine finds the game | client | `screen UIMPShell_ServerBrowser`; the host's game is listed | Compare both `MP criteria` lines: a differing hash names the cause. Equal hashes point to firewall, LAN beacon, or the shared account |
| 9 | Second machine joins | both | client: lobby `LoadMap` and `screen UIMPShell_Lobby`; two players shown | The connection failed (firewall, port, shared Steam ID) |
| 10 | Host starts | both | `LoadMap: ...XComMPTacticalGame`, `Game class is 'XComMPTacticalGame'`, `screen UITacticalHUD` | The history hand-off hung |
| 11 | One full turn each | both | No `screen UIMultiplayerDisconnectPopup`; both players confirm their turn | Desync or disconnect mid-match |

Variants of the plain test (a few lines each, same checklist):
- **A** (row 3 fails): the handler runs the map command itself,
  `open XComShell_Multiplayer.umap?Game=XComGame.XComMPShell`
  (`XComShellPresentationLayer.uc` L706).
- **B** (row 4 fails): the handler calls
  `XComShellPresentationLayer.UIMPShell_MainMenu()` (L714-726) directly.

## Fallbacks, in Kc's order
1. **Highlander run** (source read already done in Stage 0; the PC-only
   half moved forward to Stage 1b on 2026-11-10). Subscribe on
   both machines, tick it in AML with our mod, same version on both, same
   checklist. Also note whether the game's own Multiplayer item returns.
2. **Direct IP.** Our mod calls the network manager the way
   `UIMPShell_Lobby.CreateServer/CreateClient` do (L502-523), host given
   as one decimal integer (the prototype's claim): a*16777216 + b*65536 +
   c*256 + d, so 127.0.0.1 is 2130706433 and 192.168.1.20 is 3232235796.
   Guess: LAN addresses exceed a signed 32-bit number, and the prototype
   only tested 127.0.0.1. Needs its own short plan (how the address is
   entered without the console; how both sides reach the lobby with no
   online session).
3. **Beta branch** on both machines: record its build ID, run stock
   multiplayer with mods off as a reference, then with our mod. (Its
   PC-only half can be done early; see Stage 1.)

**Decision rule:** rows 1-11 pass on 8270065 (by any route above the
beta) means current build. Otherwise beta, with the failing row and its
log lines recorded.

## The -nohomedir test copy: not now
- M2 asks whether stock multiplayer works in the install Kc and friends
  actually use, launched the way the community launches it. A copy adds
  unknowns at the decision gate: `-nohomedir` is the prototype's claim
  only, whether a copy starts outside Steam is untested, and the game is
  tens of GB per copy.
- Activating our mod in a copy needs AML pointed at it or a hand-edited
  config, which CLAUDE.md forbids. That needs Kc's decision when it
  comes up.
- Set it up when direct IP is reached (two instances on the PC at
  127.0.0.1, which fits the PC-first preference) or at M3.

## Restoring the clean config before each test session
Kc does this; the agent can't write there.
1. Close the game and AML.
2. In `Documents\My Games\XCOM2 War of the Chosen\XComGame\`, rename
   `Config` to `Config-before-M2` (keeps the current settings).
3. Make a new `Config` folder and copy the 46 .ini files from
   `Artifact5\local\config-backup-before-AML\` into it.
4. Start AML, check the game's `Mods` folder is still in Mod Directories,
   tick only X2TacticalCoop, keep `-review -noRedScreens`, `-allowConsole`
   off, Run. AML then reapplies its own two changes (accepted in
   plans/m0-dlcinfo-plan.md).

Restoring resets graphics and key settings to the baseline's.

## Files
- `plans/m2-plan.md` (this plan)
- research/sdk-findings.md: the Highlander hypothesis as open question 13
  (guess); question 8 answered; the suppressed log categories; Stage 0's
  result
- the two classes above and the `mod/README.md` layout (at Stage 1)
- LOG.md: the plan entry, results per stage, Session 5 prompt log

## Open points
1. Button label and place ("MULTIPLAYER", top left) are a first guess;
   adjust after Kc sees it.
2. Logs: after each run, Kc copies each machine's `Launch.log` to
   `local\m2-logs\` on the PC (for example `pc-stage1a.log`,
   `laptop-stage2.log`). The agent's copy command is denied there.
3. LOG.md is public: log lines are quoted without Steam IDs or IP
   addresses.
4. Stage 3: who the friend is and when. Ask Kc.
5. Not in this plan (extras): `X2TC` lines when a turn begins; turning the
   game's own multiplayer logging on from the mod (guess: may touch
   config or the hashes).

## Verification
1. Kc builds with the VS Code build task; it must compile with no errors.
2. Kc restores the config, gives the build ID, and runs the Stage 1
   checklist (build, AML launch, exact clicks, what should appear).
3. The agent reads the copied logs, fills the table above with line
   numbers per machine, and records it in LOG.md with the build ID.
   Anything not shown by a log line or by what Kc saw stays a guess.
4. After each sub-step the agent confirms its calls appear in tool-log/.
