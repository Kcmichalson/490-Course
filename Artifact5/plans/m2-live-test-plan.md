# M2 live-test readiness plan (rows 8-11)

Approved by Kc on 2026-11-10 with five notes (worked in below). Extends
plans/m2-plan.md after Stage 1d. Goal: be fully ready for the live test
of table rows 8-11 with a friend over the internet (their own account
and copy, Private lobby plus Steam invite).

Everything under "What the SDK shows" comes from reading the SDK source
(Development\SrcOrig, 2018). None of it has been run on build 8270065;
treat it as a guess for the retail game until a test shows it.

## What the SDK shows

### 1. The invite path (guest side)
- **Accepted from the main menu:** `OnGameInviteAccepted`
  (`XComGame\Classes\XComOnlineEventMgr.uc` L3502-3591) checks the
  hashes (L3550), stores the invite, sets "shuttle to the invite
  loadout" (L3557), then calls `Presentation.StartMPShellState()`
  (L3580). From the main menu that is the call that loads nothing on
  8270065 (Stage 1), so the guest would stay on the main menu. Needs a
  fix.
- **Accepted from inside the multiplayer menu:** `StartMPShellState`
  takes its other branch (`XComShellPresentationLayer.uc` L704-711),
  which rebuilds the multiplayer menu; that menu sees the stored invite
  and opens the accept-invite squad screen (`UIMPShell_MainMenu.uc` L95,
  L108-116). No `open`. Expected to work.
- **After the squad pick:** the join goes through `StartNetworkGame`,
  `CreateClient`, `OnPlayerJoined`, then `ClientTravel`
  (`XComShellPresentationLayer.uc` L1103-1170, L1194-1206): the travel
  call our button uses. Expected to work.
- **A rejected invite** (a hash mismatch, for example) makes the game
  try to show its message on the multiplayer menus
  (`XComOnlineEventMgr.uc` L1731-1746). From the main menu that may go
  nowhere (a guess), so the invite trace lines matter.
- **Workaround for the day:** the friend clicks MULTIPLAYER first, then
  accepts the invite.
- **Not covered:** starting the game from the invite while it is closed.
  The checklist says to start the game first.

### 2. Backup route: Public match plus Search For Custom Match
The search screen joins through `OSSJoin`, `OSSJoinOnlineGameCompleted`,
then the same `StartNetworkGame` and `ClientTravel`
(`X2MPShellManager.uc` L1902-1950, L1416-1445). No `open`, no
`StartMPShellState`. `BuildJoinURL` builds an `open` command
(L2052-2058) but nothing calls it. Expected to work.

### 3. New risk: match start (row 10)
Both machines start the match with `LoadTacticalMap` (host L2042/L2167;
guest when the host's message arrives, L807-812), which runs
`ConsoleCommand("open <plot>?game=XComGame.XComMPTacticalGame")`
(`UIMPShell_Lobby.uc` L648, L743-755). If `open` is refused for
multiplayer maps, row 10 fails on both sides. Stage 1e tests that on the
PC alone.

### 4. The mods hash probably doesn't cover file contents
`mods=-687928801` in both the Stage 1c and Stage 1d logs, although the
code changed between them. Guess: it covers mod names only, so the game
won't notice a different build of our mod. Our own version line has to.

## Steps

Kc's note 5: **Steps 1 and 2 now. Steps 3-6 are on hold until Stage
1e's result**, since a match-start fix would change the build.

### Step 1: code (one build; no class overrides)
All in `mod/X2TacticalCoop/Src/X2TacticalCoop/Classes/`.
- **Version line:** the DLC info class logs `X2TC: version 0.2.0`
  (Kc's note 1).
- **`X2TC_MainMenuListener` (targeted edits):**
  - Lobby-exit fix: when the main menu opens with the "shuttle to the
    multiplayer menu" request set (`Engine\Classes\OnlineEventMgr.uc`
    L246), log it and travel to the multiplayer shell ourselves.
  - Click feedback: play the menu-select sound and disable the clicked
    button.
  - `SHOW_TEST_BUTTONS` constant: true in the PC test build, false in
    the build the friend gets.
  - Two more test buttons for Stage 1e: MP TEST: OPEN SHELL
    (`open XPACK_Shell_Intro?Game=XComGame.XComShell`, the control) and
    MP TEST: OPEN MP TAC
    (`open Plot_WLD_MP_Sm_01?game=XComGame.XComMPTacticalGame`; the map
    name is from the game's `XComGame\Config\DefaultPlots.ini` L290).
- **New `X2TC_InviteListener`:** while the main menu is up, registers
  for accepted invites (`Engine\Classes\OnlineGameInterface.uc`
  L566-581). Logs each invite and whether it succeeded; shortly after,
  logs whether the game kept it (`HasAcceptedInvites`). If kept, travels
  to the multiplayer shell, where the game opens the accept-invite
  screen itself. If dropped, logs that the game rejected it. Untested:
  handler order and timing.
- **New `X2TC_MatchTraceListener`:** lobby opened / closed with the
  player count; tactical HUD up with the game class; each turn start
  and end (`'PlayerTurnBegun'`, `'PlayerTurnEnded'`,
  `X2TacticalGameRuleset.uc` L4499, L4574) with the turn number and
  whether it is the local player's. Checked while writing: where the
  count comes from, and whether the multiplayer ruleset fires these
  events.
- Already there: `X2TC_MPTraceListener` logs every screen (including
  the disconnect popup), and the game's own `LoadMap:` lines are not
  suppressed.

### Step 2: Stage 1e (PC alone, test build)
Checks: the version line; the lobby exit now lands on the multiplayer
menu; the click sound; OPEN SHELL; OPEN MP TAC (may crash or hang; only
its `LoadMap` line matters); the lobby trace lines. Log:
`local\m2-logs\pc-stage1e.log`.

**Decision after Stage 1e:** if OPEN MP TAC is refused, a short
separate plan for a match-start fix (a listener that travels to the
match data's map when the lobby closes, or a lobby class override with
why nothing else works). If the map loads, no fix.

### Step 3 (on hold): shared build
`SHOW_TEST_BUTTONS` false, rebuild, package. Host and friend run this
exact build.

### Step 4 (on hold): packaging
A new tool, Python 3 standard library only:
- `tools/package_mod.py`: reads the built `Mods\X2TacticalCoop` folder
  in the game (read only); writes `local\release\X2TacticalCoop-<version>.zip`
  and a `.sha256.txt` with the zip's hash and one hash per file; fails
  if the version in the source differs from the one passed in.
- `tools/preflight_compare.py`: takes two Launch.logs and lists the
  version, the `MP criteria` lines and the mod and DLC names side by
  side, marking every difference.

### Step 5 (on hold): checklists
`checklists/friend.md` and `checklists/host.md`.
- **Friend (non-technical):**
  1. XCOM 2 and War of the Chosen installed; DLC list the same as the
     one the host sends.
  2. Build 8270065: open `appmanifest_268500.acf` in Notepad, find
     `buildid`.
  3. Steam overlay on.
  4. Install AML from
     https://github.com/X2CommunityCore/xcom2-launcher/releases (Kc's
     note 2).
  5. Unzip the mod into
     `...\XCOM 2\XCom2-WarOfTheChosen\XComGame\Mods\`.
  6. Rename their `Config` folder (in
     `Documents\My Games\XCOM2 War of the Chosen\XComGame\`) to
     `Config-backup` before testing, so the game regenerates clean
     defaults; rename it back afterwards. No editing (Kc's note 3).
  7. AML: add the Mods folder, untick every other mod, leave
     `-allowConsole` off.
  8. If Windows Firewall asks about the game: allow on private networks
     (Kc's note 4).
  9. Launch, wait for the main menu, click MULTIPLAYER, then accept the
     host's invite. If the invite fails: Search For Custom Match.
  10. Afterwards: quit, send the host `Launch.log`.
- **Host (Kc):** restore the config; build ID; launch with only our mod;
  Create Custom Match, Private; invite the friend through the Steam
  overlay; start; one turn each; quit; save both logs as
  `local\m2-logs\live-host.log` and `live-guest.log`.

### Step 6 (on hold): pre-flight, each alone, before the session
1. Build 8270065.
2. Launch with only our mod, click MULTIPLAYER, quit.
3. The friend sends their Launch.log.
4. `preflight_compare.py` on both logs: version, `dlc=`, `mods=`, `ini=`,
   `devconsole=False`, mod names and DLC names must match.
5. Both can see each other online in Steam.

## Open points
- The friend's Launch.log may contain Steam names. It stays in `local/`;
  LOG.md quotes it without names or IDs.
- Who the friend is and when: Kc arranges; never invented here.
- `ini=` was empty in our logs, so the pre-flight may not catch a config
  difference; the Config rename in the friend checklist covers that.

## Verification
1. Kc builds the test build; it must compile with no errors.
2. Kc runs the Stage 1e checklist; the agent reads
   `local\m2-logs\pc-stage1e.log` and records the result with the build
   ID in LOG.md.
3. Anything not shown by a log line or by what Kc saw stays a guess.
4. After each sub-step the agent confirms its calls appear in tool-log/.
