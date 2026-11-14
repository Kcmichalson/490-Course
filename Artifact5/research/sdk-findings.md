# SDK findings (M1)

What the War of the Chosen SDK source shows about the old multiplayer.
Written in Session 3 (2026-11-09, on the laptop), following
plans/m1-plan.md.

**Every finding here is "SDK only, untested against 8270065".** It comes
from reading source; no game was run. The compiled scripts in the current
build may differ (see section 1). Anything the source doesn't show is
labeled a guess.

Paths are relative to the SDK's `Development\SrcOrig\`. On the laptop the
SDK is at
`C:\Program Files (x86)\Steam\steamapps\common\XCOM 2 War of the Chosen SDK`.
"L" means line numbers.

## 1. SDK date compared with March 28, 2022

- **File dates are an install date, not a source date.** All 4,144 files
  under `SrcOrig` have a last-write date of 2026-11-09, the day the SDK was
  installed on the laptop (PowerShell count of files by date). They say
  nothing about when the source was written.
- **SDK build dates (Kc, from SteamDB, app 602410; added Session 4):**
  public branch build 3075887, updated 2018-08-29; `full_content` build
  3197185, updated 2018-10-09. Later changelists are metadata only. So the
  SDK content predates the March 28, 2022 shutdown by about 3.5 years.
- **Unexplained inconsistency:** the `(1.20.19)` comments below look like
  January 20, 2019, three months after the newest SDK build (2018-10-09).
  Not resolved. Possible readings (guesses): the date format isn't
  month.day.year, the comment was written ahead of or behind the real
  date, or SteamDB's dates miss a content update.
- **Newest dated comment found: January 20, 2019.** A search of
  `XComGame\Classes` for dated comments from 2018–2022 (pattern
  `M.D.YY`) found only `(1.20.19)` in
  `XComGame\Classes\UICharacterPool.uc` L245–248, L419–422, L461–470.
  Read alone, that would put the source in January 2019 or later, which
  conflicts with the SteamDB dates above. No dated comment from 2020–2022
  turned up.
- **The source still shows multiplayer switched on** (section 2: the
  Multiplayer menu item is created and wired up with no disabling check).
  With the SteamDB dates, this is a source snapshot from 2018, long before
  the March 2022 shutdown.
- **Consequence:** build 8270065's compiled `XComGame` scripts may differ
  from this source exactly where it matters (the menu item and anything
  the shutdown patch touched). research/build-diff.md already found that
  the script packages changed between the beta and the current build.

## 2. The old Multiplayer button

There are two main-menu screens. Which one shows is decided by
`XENGINE.bReviewFlagged`: true shows `UIFinalShell`, false shows `UIShell`
(`XComGame\Classes\XComShellPresentationLayer.uc` L294–297; the flag is a
plain bool on `XComGame\Classes\XComEngine.uc` L83, and where it is set
was not found in script). Guess: `UIFinalShell` is the retail menu and
`UIShell` the developer one, since `UIShell` holds the debug buttons.

- **Retail menu (`UIFinalShell`).**
  `XComGame\Classes\UIFinalShell.uc` L127–140 builds the menu;
  L135 is the Multiplayer item:
  `CreateItem('MP', m_sMultiplayer);`
  The click handler (L152–167) does, for `'MP'` (L165–166):
  `XComShellPresentationLayer(Owner).StartMPShellState();`
  No connectivity or enabled check sits between the click and that call.
  The only guard is `m_bDisableActions` (L154), which is set while a game
  invite is being accepted (`XComGame\Classes\UIShell.uc` L170).
- **Developer menu (`UIShell`).** Its normal menu has no Multiplayer item
  (`XComGame\Classes\UIShell.uc` L258–273). A debug button
  "MULTIPLAYER MENUS" (L512–516) calls the same function (L536).
- **`StartMPShellState`** (`XComShellPresentationLayer.uc` L702–712): if
  the current game mode isn't `XComMPShell`, it loads the multiplayer
  shell map with a console command (L706):
  `ConsoleCommand("open XComShell_Multiplayer.umap?Game=XComGame.XComMPShell");`
  Otherwise it calls `TravelToNextScreen()`.
- **What opens `UIMPShell_MainMenu`.** After the map loads, the
  presentation layer's `InitUIScreens` (L105–171) ends up in
  `TravelToNextScreen` (L173–220), which checks the game mode (L181–183)
  and calls `UIMPShell_MainMenu()`. That function (L714–726) activates the
  `X2MPShellManager`, then spawns `UIMPShell_MainMenu` and pushes it on the
  screen stack (L724–725). `XComGame\Classes\XComMPShell.uc` is an empty
  game-mode class (8 lines) whose only job here is to be what L181 tests
  for.
- **An unused, stricter entry point.** `UIMultiplayerShell()`
  (`XComShellPresentationLayer.uc` L646–683) runs four checks first
  (network link, online login, play permission, chat permission) and then
  calls `StartMPShellState()`. A search of all of `SrcOrig` found no
  caller except its own retry at L694, so it is dead code in this source.
  Even its failure dialogs go on into the multiplayer shell: "Go into MP
  state anyways, options will be grayed out if player is not connected"
  (L952).
- **Other ways in.** Accepting a Steam invite shuttles to the multiplayer
  menu (`ShuttleToMPMainMenu`, L385–401, and
  `ShuttleToMPInviteLoadoutMenu`, L403 onward). Other callers of
  `StartMPShellState()`: `UIMultiplayerDisconnectPopup.uc` L98,
  `XComOnlineEventMgr.uc` L3580, `XComTacticalController.uc` L2522 (all
  in `XComGame\Classes\`; not read, guess: returning to the MP menu after
  a match or disconnect). The function is declared on the base class,
  `XComPresentationLayerBase.uc` L1194.

**For M2:** `XComShellPresentationLayer.StartMPShellState()` is a public,
non-native script function that a mod's screen listener on the main menu
could call. Whether it still exists and works in 8270065 is untested.

## 3. How two games connect (plan step 4)

Short answer: script sets up a session through the online subsystem
(Steam lobby or LAN), then hands a URL to a native network manager.
**A LAN option exists in the source and the custom-game UI offers it.**
There is no "type an IP address" screen; direct IP exists only as console
commands.

### The three network types
- `XComGame\Classes\X2MPData_Common.uc` L38–43 defines
  `eMPNetworkType_Public`, `_Private` and `_LAN`. The default for match
  settings is LAN (L62).
- The custom-game "lobby type" spinner is filled from every value of that
  enum, LAN included (`XComGame\Classes\X2MPShellManager.uc` L425–434).
  The names come from the localized array
  `X2MPData_Shell.m_arrNetworkTypeNames` (L432); the actual strings are in
  the game's `.int` files, not checked here.
- When the player has a network link but no online login, the spinner is
  forced to LAN and locked: "only LAN games allowed"
  (`XComGame\Classes\UIMPShell_CustomGameCreateMenu.uc` L198–212; the same
  code is in `UIMPShell_CustomGameMenu_Search.uc` L200–204). The MP main
  menu says the same: "custom matches can still be played (LAN only)
  without an online connection" (`XComGame\Classes\UIMPShell_MainMenu.uc`
  L508–532).

### Hosting
1. `OSSCreateGameSettings` (`XComGame\Classes\XComShellPresentationLayer.uc`
   L1286–1365) builds the settings. Public and private games get 2
   connections (L1334–1343); anything else is LAN and sets
   `bIsLanMatch = true` (L1344–1350). It also stamps hashes of the script
   packages, DLC, mods and INI files, plus whether the dev console is on
   (L1353–1358). The hash functions are `Helpers.NetGet...`; not read yet
   (guess: native).
2. `OSSCreateGame` (L1208–1225) calls the online subsystem's
   `GameInterface.CreateOnlineGame(..., 'Game', kGameSettings)` (L1225).
3. On success, `StartNetworkGame(SessionName)` (L1103–1177) builds the URL
   `XComShell_Multiplayer?Game=XComGame.X2MPLobbyGame` (L1115–1116), adds
   the option `steamsockets` unless it is a LAN match (L1121–1124), and
   calls `NetManager.CreateServer(OnlineURL, sError)` (L1129). Then the
   host travels to the lobby map (`OnNetworkCreateGame`, L1194–1198).

### Joining
1. A search sets `bIsLanQuery` when the network type is LAN and the game
   is unranked (L1762–1770), then calls `GameInterface.FindOnlineGames`
   (L1776). The search carries the same hashes as the host (L1752–1758).
   Guess: a mismatch hides the game from the list or blocks the join; the
   filtering code was not read.
2. `GameInterface.JoinOnlineGame(..., 'Game', kSearchResult)` (L1950).
3. On success, `GetResolvedConnectString('Game', sURL)` returns the
   address and `StartNetworkGame(SessionName, sURL)` is called
   (`XComGame\Classes\X2MPShellManager.uc` L1434–1442; the automatch
   version is `XComShellPresentationLayer.uc` L1842–1850).
4. With a resolved URL, `StartNetworkGame` splits it into host and port
   (L1142–1159) and calls `NetManager.CreateClient(OnlineURL, sError)`
   (L1163). It waits for the "player joined" delegate before loading the
   map (L1162), and starts a timer that calls
   `NetManager.ForceConnectionAttempt()` (L1172–1173, L1179–1192).
5. On PC the Steam peer-to-peer connection "takes MUCH longer (several
   seconds) to open" than the lobby join (L1994–1997).

### Where it goes native
- `XComGame\Classes\XComGameStateNetworkManager.uc` is `native(MP)` (L5).
  `CreateServer` (L244), `CreateClient` (L248), `ForceConnectionAttempt`
  (L251), `Disconnect` (L254) and every Send/Receive function
  (L287–425) are native. Script can call them but can't see or change
  what they do. This matches Mr.Fear's warning (LOG.md).
- `OnlineSubsystemSteamworks\Classes\OnlineGameInterfaceXCom.uc` (L10)
  extends `OnlineGameInterfaceSteamworks`. Its C++ header block lists
  Steam lobby callbacks (L42–69), peer-to-peer session callbacks
  (L71–74), and LAN functions: `CancelFindLanGames`, `FindLanGames`,
  `CreateLanGame` (L21–29). `GetResolvedConnectString` is native (L270).
- LAN discovery is the stock Unreal LAN beacon:
  `IpDrv\Classes\OnlineGameInterfaceImpl.uc` has `LanBeaconState` (L59),
  config values `LanAnnouncePort` (L62), `LanGameUniqueId` (L65) and
  `LanQueryTimeout` (L77), and a native `LanBeacon` pointer (L80).
  `OnlineGameInterfaceSteamworks.uc` also declares `StartSteamLanBeacon`
  / `StopSteamLanBeacon` (L63–66).

### Direct IP (developer commands only)
- `XComGame\Classes\XComCheatManager.uc` has console commands
  `MPCreateServer(Port=7777, bSteam=false)` (L3733–3745) and
  `MPCreateClient(ServerURL, Port=7777)` (L3747–3756) that call the
  network manager directly with a host and port, skipping the online
  subsystem. `UIMPShell_Lobby.uc` has the same pair as plain functions
  (L502–523). A comment block (L3767–3789) lists a manual Steam lobby →
  peer-to-peer flow using more `MP...` console commands.
- These are cheat-manager commands, so they need the developer console,
  which Mr.Fear says breaks multiplayer and CLAUDE.md rules out for tests.
  But they show that `CreateServer`/`CreateClient` accept a plain
  host-and-port URL with no `steamsockets` option, so a mod could call the
  network manager the same way from script. Whether the native side still
  accepts that in 8270065 is untested.

### What this means for the project (guesses, for M2/M3)
- Two paths to try, in order of least new code: (a) the existing custom
  game with lobby type Private (Steam invite) or LAN; (b) calling
  `XComGameStateNetworkManager.CreateServer/CreateClient` directly.
- The session is created for 2 connections (L1336, L1342, L1347), in line
  with the two-player limit.

## 4. Multiplayer screen classes (plan step 5)

All files are in `XComGame\Classes\`. Line numbers are where the hand-off
happens. "Not read" means only the grep hit was seen, not the code around
it.

### Flow
```
UIFinalShell 'MP' button
  -> XComShellPresentationLayer.StartMPShellState   (loads XComShell_Multiplayer map,
                                                     game mode XComMPShell)
  -> UIMPShell_MainMenu
       Ranked match   -> UIMPShell_SquadLoadoutList_RankedGame   -> OnlineGame_DoRankedGame
       Quick match    -> UIMPShell_SquadLoadoutList_QuickMatch   -> OnlineGame_DoAutomatchGame
       Create custom  -> UIMPShell_CustomGameCreateMenu
                         -> UIMPShell_SquadLoadoutList_CustomGameCreate -> OnlineGame_DoCustomGame
       Find custom    -> UIMPShell_CustomGameMenu_Search
                         -> UIMPShell_ServerBrowser
                         -> UIMPShell_SquadLoadoutList_CustomGameSearch -> OSSJoin
       Leaderboards   -> UIMPShell_Leaderboards
       Edit loadouts  -> UIMPShell_SquadLoadoutList_Preset -> UIMPShell_SquadEditor_Preset
  -> (create or join succeeds) StartNetworkGame: map XComShell_Multiplayer,
     game mode X2MPLobbyGame
  -> X2MPLobbyPresentationLayer -> UIMPShell_Lobby   (ready up, host presses Start)
  -> "open <plot map>?game=XComGame.XComMPTacticalGame" -> X2TacticalMPGameRuleset
```

### Classes
| Class | Role | Hands off to |
|---|---|---|
| `UIMPShell_Base` | Base screen for all MP shell screens (extends `UIScreen`, L11); holds `m_kMPShellManager` | — |
| `X2MPShellManager` | Actor (L11) that holds the match settings (`OnlineGame_Set...`/`Get...`) and starts create/search/join | `OnlineGame_DoCustomGame` L1187–1202 → `OSSCreateUnrankedGame`; ranked L1220, quick match L1246 (automatch); search L1863; join L1902–1926 |
| `UIMPShell_MainMenu` | The MP main menu; six items built at L135–170 (Challenge Mode item commented out, L163–164) | Click handlers L317–358 push the screens in the flow above |
| `UIMPShell_CustomGameCreateMenu` | Custom game options: lobby type, turn timer, squad cost, map (spinners; lobby type L187–217) | Launch button L335–340 pushes `UIMPShell_SquadLoadoutList_CustomGameCreate` |
| `UIMPShell_CustomGameMenu_Search` | Search filters for custom games | L364 pushes `UIMPShell_ServerBrowser` with the results |
| `UIMPShell_ServerBrowser` | List of found games | L238–239 pushes `UIMPShell_SquadLoadoutList_CustomGameSearch` and stores the chosen result's index |
| `UIMPShell_SquadLoadoutList` | Base list of saved squads; picks a squad or opens the editor | L413, L433 push `UISquadEditorClass` (set per subclass) |
| `..._SquadLoadoutList_RankedGame`, `_QuickMatch`, `_CustomGameCreate`, `_CustomGameSearch`, `_Preset`, `_AcceptingInvite` | One per way in; each starts its own action once a squad is picked | `_RankedGame` L31, `_QuickMatch` L37, `_CustomGameCreate` L37, `_CustomGameSearch` L31 (`OSSJoin`); `_AcceptingInvite` not read |
| `UIMPShell_SquadEditor` and its `_Preset`, `_Quickmatch`, `_RankedGame`, `_CustomGameCreate`, `_CustomGameSearch`, `_AcceptInvite` subclasses | Edit a squad (units, cost) | `UINextScreenClass` (L58, spawned at L467); set in `_CustomGameCreate` L14 and `_CustomGameSearch` L14 |
| `UIMPShell_UnitEditor` and `UIMPShell_UnitEditor_*Panel`, `UIMPShell_CharacterTemplateSelector`, `UIMPShell_SquadCostPanel*`, `UIMPShell_UnitCostPanel`, `UIMPShell_SquadUnitInfoItem` | Panels and sub-screens of the squad editor (not read) | — |
| `UIMPShell_Leaderboards` | Leaderboards (not read) | — |
| `X2MPLobbyGame`, `X2MPLobbyController`, `X2MPLobbyPresentationLayer` | Game mode, controller and presentation layer once a session exists | `X2MPLobbyController.uc` L143 sets the presentation layer; `X2MPLobbyPresentationLayer.uc` L82 spawns `UIMPShell_Lobby` |
| `UIMPShell_Lobby` | The pre-match lobby (extends `UIMPShell_SquadEditor`, L10): both squads, ready, invite, start | See below |
| `XComMPTacticalGame` | Tactical game mode for MP | L11 returns `X2TacticalMPGameRuleset` as the ruleset class |
| `UIMultiplayerHUD`, `UIMultiplayerChatManager`, `UIMultiplayerDisconnectPopup`, `UIMultiplayerPostMatchSummary`, `UIMultiplayerPlayerStats` | In-match and post-match screens (not read) | — |

### Lobby to match start (`UIMPShell_Lobby.uc`)
- Remote commands between the two games are plain strings: `ClientJoined`,
  `NotifyLoadingMap`, `RequestHistory` (L1843–1861), sent with
  `NetworkMgr.SendRemoteCommand` (L1835–1841).
- Ready: `ReadyButtonCallback` L443–474 toggles the local player's ready
  flag and sends an update; `CalcAllPlayersReady` L930–950 reads
  `bPlayerReady` from every `XComGameState_Player` in the History.
- Start: only the host can start, and only when everyone is ready (L481:
  `NetworkMgr.HasServerConnection() && m_bAllPlayersReady`). `StartGame`
  L952–966 → `DoStartGame` L968–976 → state `Server_LoadingMap` (L2045).
- Client side: state `Client_LoadingMap` (L1992–2043) sends its loadout
  game state to the host (L2029), waits for the full History, replies
  `HistoryConfirmed` (L2012), waits for the network to go quiet
  (L2037–2040), then loads the map (L2042).
- `LoadTacticalMap` (L743–755) runs the map command stored in
  `XComGameState_BattleDataMP`, built at L648 as
  `"open" @ ...Plot.MapName $ "?game=XComGame.XComMPTacticalGame"`.
- The rest of `Server_LoadingMap` (after L2099) was not read.

## 5. Flags that disable multiplayer (plan step 3)

**No "multiplayer disabled" switch exists in this source.** A search of
every `.uc` file in `SrcOrig` for `IsMultiplayerEnabled`,
`bDisableMultiplayer`, `MultiplayerDisabled`, `bMultiplayerEnabled`,
`DisableMP`, `bMPDisabled`, `MPEnabled` and `bAllowMultiplayer` (any case)
found nothing. Whatever the March 2022 patch did to switch multiplayer
off is not in this source; it is in build 8270065's compiled scripts or
its executable (research/build-diff.md: script packages and XCom2.exe
changed). What it did is an open question (section 6).

What the source does have is a set of softer gates:

| Gate | Where | What it does | Reachable by a mod? |
|---|---|---|---|
| `m_bDisableActions` | `XComGame\Classes\UIFinalShell.uc` L154; set in `UIShell.uc` L170, cleared L190 | Blocks all main-menu clicks while an invite is being accepted | Script variable |
| Network link check | `XComShellPresentationLayer.uc` L766–790 (`OSSCheckNetworkConnectivity`) | Asks `SystemInterface.HasLinkConnection()`; sets `m_bPassedNetworkConnectivityCheck` | Script reads it; the answer comes from the online subsystem (native) |
| Online login check | same file L818–884 (`OSSCheckOnlineConnectivity`) | Needs Steam login status `LS_LoggedIn`, a valid unique ID and a non-local login (L841–844) | Same |
| Play / chat permission | same file L886–949 | `CanPlayOnline` / `CanCommunicate` not `FPL_Disabled` | Same |
| MP main menu item graying | `UIMPShell_MainMenu.uc` L501–532 | No online login: ranked, quick match, leaderboards off, custom games stay on (LAN). No network link: everything off | Script (a screen listener could re-enable items; untested) |
| Custom game check | `X2MPShellManager.uc` L1187–1198 | Blocks creating a custom game with no link, or when not LAN and not logged in | Script |
| Ranked-only checks | `UIMPShell_MainMenu.uc` L463–498, L518–521 | Ranked is disabled if mods are installed, DLC isn't "ranked friendly", data hashes are invalid, or the dev console is on | Checks are native (`XComGame\Classes\Helpers.uc` L94–105); only ranked is gated here |
| Match hashes | `XComShellPresentationLayer.uc` L1352–1358 (host), L1752–1758 (search) | Host and searcher both publish hashes of script packages, DLC, mods, INI, and the dev-console flag | Native functions (`Helpers.uc` L94–105). Guess: the search only returns games whose hashes match, which would explain Mr.Fear's warning about edited configs, the console and mismatched DLC; and both of us running the same mod should hash the same. Untested |
| No-network dialog | `XComShellPresentationLayer.uc` L792–816; shown at the main menu by `UIShell.uc` L219–222 | A warning only. Text is `X2MPData_Shell.m_strOnlineNoNetworkConnectionDialog_Default_Text` (`X2MPData_Shell.uc` L199–200); this is likely the string whose "Multiplayer functionality will be disabled…" sentence the current build removed (LOG.md build diff). The match to that exact string is a guess; the `.int` file was not opened | Script |
| Lost connection in lobby | `X2MPShellManager.uc` L2174–2181 | Returns to the MP menu unless it's a LAN match with a network link | Script |

Config values near multiplayer (all found with a search for `config`
variables in the MP classes; none is an on/off switch):
`XComShellPresentationLayer.m_InitialSteamClientConnectTimer` (L63),
`XComGameStateNetworkManager.NetworkResendTimeout` and
`bPauseGameStateSending` (L126–127),
`XComOnlineGameSettings.DEBUG_bChangeRankedGameOptions` and
`QuickmatchTurnTimer` (L16–17), `X2MPData_Shell.m_arrMaxSquadCosts` and
`m_arrTurnTimers` (L123–124), `XComMPData.m_iINIVersion` (L182), and the
LAN beacon values in section 3. CLAUDE.md forbids editing the game's
config files anyway; a mod can ship its own config, but changing these
would likely change the INI hash (guess).

One debug-only bypass: in non-final builds, `OSSCheckOnlineConnectivity`
skips the login check when Steamworks isn't initialized, "because we are
just using LAN" (L828–835). It is inside a `FINAL_RELEASE` macro guard,
so it is probably compiled out of the shipped game (guess).

## 6. Open questions and M2 inputs

### What the source can't answer
1. **How was multiplayer switched off in 8270065?** Not in this source
   (section 5). Candidates, all guesses: the `'MP'` menu item removed from
   the compiled `UIFinalShell.UpdateMenu`; `StartMPShellState` emptied;
   or a native-side block in the online subsystem (session create/search
   failing). M2's first test tells these apart.
2. **Does the SDK source match the compiled scripts of 8270065?** The
   The SDK content is from 2018 (SteamDB, section 1) and the game had
   patches after that, so differences are likely; which functions differ
   is unknown. A mod compiled against this source calls functions by
   name, so a function removed from the game would fail at run time, not
   compile time (guess from how UnrealScript links; untested).
3. **Do Steam lobbies and `steamsockets` connections still work** now
   that Firaxis retired the service? Lobby and peer-to-peer calls are
   native (`OnlineGameInterfaceXCom.uc` L42–74). The pre-21.10 beta
   branch proves they can work on that build; the current build is
   untested.
4. **Does LAN work, and does it need a Steam login at all?** The source
   says custom LAN games are allowed with a network link and no online
   login (section 3). The LAN beacon is native.
5. **Do the native `CreateServer` / `CreateClient` accept a plain
   host:port URL** from script without the cheat manager (section 3)?
6. **What exactly do the hash checks compare, and what happens on a
   mismatch** (hidden from search, or join refused)? All native
   (`Helpers.uc` L94–105). Matters because the co-op mod itself changes
   the installed-mods hash on both machines.
   **Session 5 (2026-11-10), SDK only:** one comparison is in script.
   `CheckInviteGameVersionMismatch` (`XComGame\Classes\XComOnlineEventMgr.uc`
   L3593–3615) compares an invite's four hashes (packages, DLC, mods,
   INI) with the local ones; any difference is a mismatch. The
   dev-console flag is not part of that comparison. The cheat
   `displaympmatchcriteria` (`XComGame\Classes\XComShellCheatManager.uc`
   L69–86) prints the local values with the same static `Helpers` calls,
   so a mod can log them the same way (plans/m2-plan.md does).
7. **Where is `bReviewFlagged` set**, and is `UIFinalShell` really the
   retail menu? (Section 2 guess.)
8. **`XComShell_Multiplayer.umap`**: does the map still ship in the
   current build? research/build-diff.md says no file exists only in the
   beta, which suggests yes; not checked by name.
   **Session 5 (2026-11-10): yes, by file listing.** The PC's game folder
   has `XComGame\CookedPCConsole\XComShell_Multiplayer.upk` (no game was
   run; build 8270065 as recorded on 2026-11-09). Whether the
   `open XComShell_Multiplayer.umap…` command (section 2) finds that
   package is untested.

Added in Session 5, **from the WOTC Co-op Campaign prototype's README (see
research/prior-art.md), not tested by us**:

9. **Direct IP on 8270065 (bears on question 5).** Their README says two
   instances connected by direct IP on build 8270065, which suggests
   `CreateServer`/`CreateClient` still work there. But the host had to be
   given as one decimal integer (for example 127.0.0.1 as 2130706433),
   because "IpNetDriverSteamworks does not parse a dotted host". Does
   that hold for us, and between two PCs (they only tested one PC)?
10. **Joining without the console.** Their join sends the history with
    `MPSendHistory`, a developer-console command
    (`XComCheatManager.uc` L4017–4022, which calls `NetworkMgr.SendHistory`).
    Does calling `SendHistory` from mod script (not the console) work the
    same, and keep the "console enabled" hash clean?
11. **Lost bursts.** Their README says the network layer lost frames sent
    one by one in a burst, so they batch frames (0.2 s), keep one merge in
    flight and wait for an ack. Does the tactical sync in a normal MP match
    lose anything, or did that come from their merge-state approach?
12. **ObjectID collisions.** Their README says two players creating game
    state objects at once hand out the same ObjectID. Same-turn actions
    (M4) will create objects on both machines; how does the normal MP
    ruleset avoid this?

Added in Session 5 (2026-11-10). **Kc's hypothesis: a guess, not a
finding.**

13. **Would the Community Highlander undo the switch-off?** Kc's
    reasoning: the Highlander replaces XComGame with scripts built from
    pre-2022 source, so if the shutdown switch is in XComGame's scripts
    (one candidate in question 1), running with the Highlander might undo
    it. If the switch is in the executable or the online subsystem, it
    would not. Order (plans/m2-plan.md): first read the Highlander's
    source (Kc clones it to `local\refs\`) to check that its multiplayer
    menu code matches this SDK and whether it merged anything from the
    2022 build; then, only if the plain M2 test fails, run the test with
    the Highlander on both machines. Stage 0 (the source read) is done:
    see section 7. The run itself is untested.

### Candidate hooks for M2's "open the multiplayer screen" button
In order of preference (all untested against 8270065):
1. **Screen listener on `UIFinalShell`** that adds a button (or key) and
   calls `XComShellPresentationLayer(Screen.Owner).StartMPShellState()`
   (declared `XComPresentationLayerBase.uc` L1194, implemented
   `XComShellPresentationLayer.uc` L702–712). No class override needed.
   **Session 5 (2026-11-10), SDK only:** the button should not go inside
   the menu row. `UIFinalShell.UpdateMenu` (`UIFinalShell.uc` L127–149)
   clears and rebuilds the row, and runs again after the save list
   loads (L256) and on a login status change (L340); `ClearMenu`
   (`UIShell.uc` L248–256) removes every item in the row. A separate
   button on the screen, like the game's own My2K button
   (`UIFinalShell.uc` L67–71), is not touched by that.
2. If `StartMPShellState` is gone or emptied in 8270065: the listener
   runs the same console command itself,
   `open XComShell_Multiplayer.umap?Game=XComGame.XComMPShell` (L706).
   `ConsoleCommand` from script is not the developer console, but whether
   it counts for the "dev console enabled" hash is unknown.
3. If the MP shell map loads but `UIMPShell_MainMenu` doesn't appear:
   call `XComShellPresentationLayer.UIMPShell_MainMenu()` (L714–726)
   directly.
4. Skipping the shell entirely: set the network type on
   `X2MPShellManager` and call `OnlineGame_DoCustomGame()` (L1187–1202),
   or go straight to `XComGameStateNetworkManager.CreateServer` /
   `CreateClient`. More code; only if 1–3 fail.

What to look for in Launch.log during M2 (log category `XCom_Online`):
`TravelToNextScreen` (L177), "Creating Network Server to host the Online
Game." (L1128), "Creating Network Client to join…" (L1161), "Searching
for online games..." (L1781), "Failed to create online game" (L1048).
The category may be suppressed by default (guess from the commented-out
`UnsuppressMP` call in `UIMPShell_MainMenu.uc` L58).

**Session 5 (2026-11-10): the categories are suppressed.** The current
build's `XComGame\Config\DefaultEngine.ini` (read in place), section
`[Core.System]` (L120), has `+Suppress=DevNet` and `+Suppress=DevOnline`
(L163–164), `+Suppress=XCom_Net` (L199) and `+Suppress=XCom_Online`
(L234). The clean baseline log (LOG.md, "M2 baseline") has no line in
any of those four categories, which fits. So none of the lines above
will show in a normal run. What does show: plain `Log:` lines such as
`LoadMap:` and `Game class is` (baseline L120, L122). plans/m2-plan.md
therefore adds the mod's own `X2TC` trace lines. The cheat `UnsuppressMP`
(`XComGame\Classes\XComCheatManager.uc` L4233–4240) turns the categories
on with `unsuppress` console commands; it is not used, since it needs
the developer console.

## 7. Community Highlander source compared with the SDK (M2 Stage 0)

Read in Session 5 (2026-11-10, on the PC) from Kc's clone in
`local\refs\X2WOTCCommunityHighlander\` (cloned by Kc that day; the commit
isn't recorded, since the agent doesn't run git; `VERSION.ps1` says
1.32.0). License: MIT (`LICENSE`, Copyright (c) 2017 X2CommunityCore).
**Source reading only; the Highlander was not run.** Paths in this
section are relative to the clone unless they start with `SrcOrig`.

- **The clone has no copy of the multiplayer menu classes.** A search of
  the whole clone found no `UIFinalShell.uc`, `UIShell.uc`,
  `XComShellPresentationLayer.uc`, `UIMPShell_MainMenu.uc` or
  `X2MPShellManager.uc`. `X2WOTCCommunityHighlander\Src\XComGame\Classes\`
  holds 347 `.uc` files; the SDK's `SrcOrig\XComGame\Classes\` holds
  2,475. The repo carries only the classes the Highlander changes.
- **Its build takes everything else from the SDK.** `_CopyToSrc`
  (`.scripts\X2ModBuildCommon\build_common.ps1` L341–361) mirrors the
  SDK's `SrcOrig` into `Src`, then copies the mod's `Src` over it. The
  README's manual steps do the same (`README.md` L62–84). So the
  Highlander's XComGame gets those five classes from the builder's SDK,
  which is the 2018 source that sections 2–5 describe. Does its
  multiplayer menu code match the SDK? Yes, by construction: it has no
  version of its own.
- **What it replaces.** The README says it replaces the game's XComGame
  script package (L22), normally as a cooked package (L36–38), and that
  the cook also produces `Engine` and `Core` replacements (L198–206).
- **The nearby classes it does change have no multiplayer-menu changes**
  (diff against the SDK, ignoring line endings; lines only in the
  Highlander / only in the SDK):

  | Class | Lines | What changed |
  |---|---|---|
  | `XComShell.uc` | +7 / -1 | A music flag (Issue #1598) |
  | `XComPresentationLayerBase.uc` | +8 / -6 | Photobooth poster size (#1584); DLC hook manager (#212) |
  | `XComEngine.uc` | +3 / -1 | `OnlineEventMgrClassName` (L468–470) names its subclass `CHOnlineEventMgr` (#511) |
  | `CHOnlineEventMgr.uc` | new | Overrides `GetDLCInfos` (L23) to sort DLC info classes by run order; the rest are private helpers |
  | `XComOnlineEventMgr.uc` | +28 / -0 | DLC hooks when a save loads (#212, #808) |
  | `Helpers.uc` | +4 / -2 | Loot (#114); the `Net…` hash functions are untouched |

  `XComTacticalController.uc` (+26 / -2), `XComPlayerController.uc`
  (+42 / -2), `UIScreenStack.uc` (+316 / -3), `UITLE_ChallengeModeMenu.uc`
  (+14 / -6), `UIMPShell_SquadUnitInfoItem.uc` (+2 / -1) and
  `UIMPSquadSelect_ListItem.uc` (+2 / -1): no changed line mentions
  multiplayer, lobby, invite, online, network or Steam. That comes from a
  filtered diff; the full diffs of these six were not read.
- **Config.** `X2WOTCCommunityHighlander\Config\XComPlots.ini` L2–3
  removes the plot entry `Plot_Multiplayer_Test` (Issue #1210). Guess: a
  config change like this could change the multiplayer INI hash, so both
  machines would need the same Highlander version (already in
  plans/m2-plan.md).
- **Did it merge anything from the 2022 build? No sign of it.** No `.md`,
  `.uc`, `.uci`, `.txt`, `.ps1`, `.ini` or `.int` file in the clone
  contains "2022". `CHANGELOG.md` (marked deprecated at its top) mentions
  multiplayer once (L127: multiplayer teams usable in single player,
  #188) and says nothing about the shutdown. Limits: `git log` was not
  run; the documentation website was not read (its pages are built from
  comments in the source, which the search covered); the compiled
  Workshop release can't be inspected here.
- **Logging.** The README notes that script logging is stripped from the
  cooked version (L213–215). Guess: the same would be true of the shipped
  game's own cooked XComGame, so the game's script log lines might not
  exist in a retail run even with their categories unsuppressed. Mod
  packages aren't affected (M0's `X2TC` lines appeared).

**What this means for question 13 (still a guess until it is run):**
- The premise holds as far as source goes. With the Highlander active,
  the menu classes would be compiled from the 2018 SDK source, which
  still creates the Multiplayer item (`SrcOrig\XComGame\Classes\UIFinalShell.uc`
  L135) and has `StartMPShellState` intact
  (`SrcOrig\XComGame\Classes\XComShellPresentationLayer.uc` L702–712).
- That gives a prediction to test: with the Highlander on build 8270065,
  the game's own Multiplayer item should be back on the main menu. If it
  is and a match works, the switch was in XComGame's compiled scripts. If
  it is but hosting or joining fails, the block is in native code or the
  online service. If the item isn't there, the published build differs
  from this source or something else hides it.
- Not known: which SDK source the published Workshop build was compiled
  from, and whether anything outside this repo goes into it.
- **Anecdote (Kc, 2026-11-10; not a test):** on Kc's old modded install
  (LWOTC, so the Highlander was on), Kc doesn't remember a Multiplayer
  item on the main menu. If that memory is right, it goes against the
  prediction above. Why it might (all guesses): the published build
  differs from this source, another mod changed the menu, or the item is
  hidden some other way. Only a run settles it.

### Community reports from the XCOM 2 Modding Discord (2026-11-10; reports, not tests)
Relayed by Kc. Nothing here has been tested by this project.
- Zelfana: enabling the Highlander brings back the original multiplayer
  menu, because its source predates the removal. (Supports the
  prediction above; contradicts Kc's LWOTC anecdote.)
- Max: multiplayer was never removed from the files, only the main menu
  button. (Fits question 8: `XComShell_Multiplayer.upk` ships.)
- arch: multiplayer is peer to peer, and the Steam backend should still
  work.
- Max: MrShadow was also working on a co-op mod (status unknown).

**Our own test so far (Stage 1 run 1, build 8270065):** calling the
retail `StartMPShellState()` from our button produced no map load and no
log line. That fits a patch emptying that function in XComGame as well
as the button, but it is not proof: the `open` command being refused or
dropped would look the same. Stage 1b (Highlander) and Stage 1c
(variant A) are meant to tell these apart.

**Stage 1b result (test, build 8270065, Highlander v1.32.0 from the
Workshop):** with the Highlander on, the stock MULTIPLAYER and CHALLENGE
MODE items are back in the main menu row (Kc saw it). That matches
Zelfana's report and the Stage 0 prediction, and contradicts Kc's LWOTC
anecdote. Clicking stock MULTIPLAYER, or our button (log L178–212), still
loaded nothing: no `LoadMap`, no error. (Log reread after Kc recopied the
full file: 269 lines, clean exit at L260; the result is unchanged.)

**Challenge Mode in the same run (observation, Kc and the log):**
- Kc: Challenge Mode showed it was searching for the current
  leaderboard, then "An active challenge is not currently running."
  Load Game opened its normal screen.
- Log: the squad select screen received an interval-end callback
  (`UIChallengeMode_SquadSelect:OnReceivedChallengeModeIntervalEnd`,
  0756.03), then `UIChallengeLeaderboards` opened (L243) and handled
  `OnReceivedChallengeModeDeactivatedIntervalEnd`, with a redscreen
  about missing `XComGameState_BattleData` (L246, likely because no
  challenge is loaded; a guess).
- `UIChallengeLeaderboards` extends `UIMPShell_Leaderboards`
  (`SrcOrig\XComGame\Classes\UIChallengeLeaderboards.uc` L9), so our
  trace logged the shared multiplayer shell manager there:
  `X2TC: MP state network=True online=True` (L244). So on 8270065 with
  the Highlander, both connectivity flags were true at that point.
- Kc's reading (an interpretation, not tested): the game reached the
  online challenge service and got a clean "nothing running" answer,
  unlike Multiplayer, which does nothing. The callbacks fit that; the
  log doesn't show whether the answer came from the service or a local
  default.

**Leading hypothesis (Kc, 2026-11-10; a guess, not a finding):** the
Highlander's `StartMPShellState` is the 2018 version, so if it still
loads nothing, the block is below script: in the exe or in the `open`
command. Evidence and limits:
- The Highlander repo has no `XComShellPresentationLayer.uc`, so its
  build compiles the SDK's (section 7 above). Whether the Workshop build
  was compiled that way is not known.
- The returning menu items show the Highlander's `UIFinalShell` is the
  one in use (test). That its `StartMPShellState` runs the SDK body is
  inferred, not tested.
- A blanket refusal of `open` seems less likely (a guess): the SDK
  starts a new campaign with the same kind of call,
  `ConsoleCommand("open Avenger_Root?game=XComGame.XComHeadQuartersGame")`
  (`SrcOrig\XComGame\Classes\UIShellDifficulty.uc` L1059), and campaigns
  still start. Whether the retail script still does it that way isn't
  known. If the block is native, it may be specific to this map or the
  `XComMPShell` game class.
- Stage 1c (two buttons, `ConsoleCommand open` vs `ClientTravel`,
  without the Highlander) tests the next step. (Superseded by the
  Stage 1c result below.)

### Stage 1c: `open` vs `ClientTravel` (test, build 8270065, no Highlander)
- MP TEST: OPEN ran `ConsoleCommand("open XComShell_Multiplayer.umap?Game=XComGame.XComMPShell")`
  and returned (log L171–172). Nothing loaded; no error (Kc: no sound,
  the button just looked held).
- MP TEST: TRAVEL ran `ClientTravel` with the same URL: `PreClientTravel`
  (L174), `LoadMap: XComShell_Multiplayer.umap?Game=XComGame.XComMPShell`
  (L179), `Game class is 'XComMPShell'` (L183), `UIMPShell_MainMenu`
  (L208).
- On the multiplayer menu: `MP state network=True online=True` (L209).
  Ranked Match greyed out; Quick Match, Create Custom Match, Search For
  Custom Match, Leaderboards and Edit Squad Loadouts enabled (Kc). In
  the SDK, Ranked alone is greyed when both checks pass but the ranked
  game data isn't valid (`SrcOrig\XComGame\Classes\UIMPShell_MainMenu.uc`
  L521–524).
- `MP criteria` (L210–213): `dlc=0`, `ini=` (empty), `packages=` (empty),
  `devconsole=False`, `modsinstalled=True`, mod names `X2TacticalCoop`,
  DLC names `DLC_1, DLC_2, DLC_3, TLE, XCom_DLC_Day0`. Native lines just
  before: `UHelpers::NetGameDataHashesAreValid - Checking 5 MP Ini Names - GModifiedBaseGameScripts FALSE`.
  Guess: the empty INI and package hashes are why ranked data isn't
  valid.
- `Error: Can't destroy a null online session` (L199) at map start;
  nothing visible came of it.
- Leaving the multiplayer menu loaded `XPACK_Shell_Intro?Game=XComGame.XComShell`
  (L227) with **no** `PreClientTravel` line before it. That URL is the
  one `X2MPShellManager.CloseShell` builds for its
  `ConsoleCommand("open" @ ...)` (`SrcOrig\XComGame\Classes\X2MPShellManager.uc`
  L264–268). If the retail script still does that, `open` works there.

**Leading hypothesis (Kc, 2026-11-10; a guess, replaces the one above):**
the console `open` command is what's blocked, which would also explain
why `StartMPShellState` did nothing, with or without the Highlander
(both run `open` for this map). What the tests support and don't:
- Tested: `open` to `XComShell_Multiplayer` from the main menu loads
  nothing; `ClientTravel` to the same URL loads it.
- Against a blanket block: the return trip from the multiplayer menu
  looks like an `open` (no `PreClientTravel`, CloseShell's URL) and
  worked, and campaigns start with an `open` in the SDK.
- Narrower guesses that fit everything so far: `open` is refused for the
  multiplayer shell map or the `XComMPShell` game class only, or only
  when called from the main shell. Not tested which.
- Practical result either way: our button reaches the multiplayer menu
  by `ClientTravel`, so M2 can go on without knowing which.

### Stage 1d: hosting on the PC (test, build 8270065, no Highlander)
- Create Custom Match defaults (Kc): max squad cost no point limit, turn
  timer no time limit, map type Facility, biome greyed out; lobby type
  Public / Private / LAN.
- LAN and Private both reached the lobby (six soldiers with equipment
  and point values): `LoadMap: XComShell_Multiplayer?Game=XComGame.X2MPLobbyGame`
  (L229, L407), `Game class is 'X2MPLobbyGame'` (L233, L411),
  `screen UIMPShell_Lobby` (L271, L451). Kc saw no difference between
  them. With the Private lobby open, Steam's friends list offered
  "Invite to game" on a friend (Kc; not clicked). So Steam session
  creation works on 8270065, as far as the host side shows (open
  question 3).
- Search For Custom Match (LAN) reached `UIMPShell_ServerBrowser`
  (L579): empty list, no error.
- **Leaving a lobby:** Back and confirming the exit logged
  `UIMPShell_Lobby:OnDestroyedOnlineGame` → `AttemptExitLoadoutScreen` →
  `XComOnlineEventMgr:ReturnToMPMainMenu` → `SetShuttleToMPMainMenu`
  (L278–282), `IpNetDriverSteamworks_0 shut down`, `Failed; returning
  to Entry`, then `LoadMap: XPACK_Shell_Intro?closed` (L290): the main
  menu, not the multiplayer menu. Kc saw the main menu empty until
  Escape. In the SDK, the main shell answers that shuttle flag with
  `ShuttleToMPMainMenu`, which hides `UIFinalShell` and then calls
  `StartMPShellState` (`SrcOrig\XComGame\Classes\XComShellPresentationLayer.uc`
  L385–399). Guess: the hide works and `StartMPShellState` loads nothing
  (as in Stage 1), which leaves the hidden menu. Fits what Kc saw;
  untested. The two `UIShellDifficulty` lines after each return (L343,
  L346, L525) are explained by Kc's repeat test below.
- **Repeat test (Kc, 2026-11-10, build 8270065, no code change; seen,
  no new log):** after exiting a lobby, the main menu shows no cursor
  and no buttons. A click brings the cursor back, nothing else; Escape
  does nothing. Space opens the new-game difficulty screen (Kc: it
  seems to pick the default-selected item, New Game). Escape from there
  returns to a normal main menu. Kc also saw that difficulty screen
  flash up in Stage 1d. This fits the guess above: the main menu is
  hidden but still has keyboard focus, and closing the difficulty
  screen shows it again. Which call fails is still inferred from the
  SDK source, not tested.
- For later (guess): accepting a Steam invite uses
  `ShuttleToMPInviteLoadoutMenu` (L403–418), which opens the
  multiplayer menu screen directly instead of calling
  `StartMPShellState`; whether it works from the main shell is
  untested. (Traced further below.)

### Join and match-start paths in the SDK (source only; for the live test)
Read for plans/m2-live-test-plan.md. Not run on 8270065.
- **Invite accepted (guest):** `OnGameInviteAccepted`
  (`SrcOrig\XComGame\Classes\XComOnlineEventMgr.uc` L3502–3591) checks
  the hashes (L3550), stores the invite, sets the shuttle to the invite
  loadout (L3557) and calls `Presentation.StartMPShellState()` (L3580).
  On the main menu that is the `open` branch (loads nothing in Stage 1).
  In the multiplayer menu it is the other branch
  (`XComShellPresentationLayer.uc` L704–711 → `TravelToNextScreen`
  L173–184 → `UIMPShell_MainMenu`), and the menu opens the accept-invite
  squad screen (`UIMPShell_MainMenu.uc` L95, L108–116).
- **Joining (invite or search):** `StartNetworkGame`
  (`XComShellPresentationLayer.uc` L1103–1170) creates the network
  client, and `OnPlayerJoined` → `OnNetworkCreateGame` travels with
  `ClientTravel` (L1194–1206). The search screen gets there through
  `X2MPShellManager.OSSJoin` (L1902–1950) and
  `OSSJoinOnlineGameCompleted` (L1416–1445). `BuildJoinURL` builds an
  `open` command (L2052–2058) but nothing calls it.
- **Match start:** both machines run `LoadTacticalMap`
  (`UIMPShell_Lobby.uc` L743–755; host L2042, L2167; guest L807–812),
  which runs `ConsoleCommand` on
  `"open" @ <plot map> $ "?game=XComGame.XComMPTacticalGame"` (L648).
  If `open` is refused for that, row 10 fails. Stage 1e tests the
  command's shape from the main menu.
- **Mods hash (guess from two logs):** `mods=-687928801` in Stage 1c and
  Stage 1d although the mod's code changed between them, so it probably
  covers mod names, not file contents.

### Stage 1e: `open` works for other maps (test, build 8270065, no Highlander)
Log `local\m2-logs\pc-stage1e.log`, 2026-11-10, mod version 0.2.0.
- `ConsoleCommand("open XPACK_Shell_Intro?Game=XComGame.XComShell")`
  from the main menu reloaded the main menu (L439–444).
- `ConsoleCommand("open Plot_WLD_MP_Sm_01?game=XComGame.XComMPTacticalGame")`
  from the main menu loaded the multiplayer tactical map: `LoadMap`
  (L494), `Game class is 'XComMPTacticalGame'` (L498), the ruleset
  `X2TacticalMPGameRuleset_0` in the redscreen stacks (L521), tactical
  HUD up (L575). Kc saw a black map with the tactical buttons and a red
  enemy outline with five health. No match was set up (`There are no
  valid spawn locations on this map`, L555), so this shows only that the
  command is accepted.
- **What this does to the leading hypothesis:** `open` is not blocked in
  general, and not blocked from the main shell. The one `open` that
  loaded nothing (Stage 1c) was to `XComShell_Multiplayer.umap` with
  `XComGame.XComMPShell`. Narrowed guess: the block is tied to that map
  or that game class. Not tested which, and not needed: the mod travels
  there with `ClientTravel`.
- **Match start (row 10):** the lobby's command has the same shape
  (`UIMPShell_Lobby.uc` L648), so a refusal is now unlikely (guess; the
  real call runs from the lobby with a second player and is untested).
- **Lobby exit:** after `Failed; returning to Entry` (L290) the main
  menu opened with the shuttle flag already cleared, hidden, on a
  `?closed` URL (`X2TC: Main menu state: shuttle to MP menu=False closed
  URL=True visible=False`, L335). The mod's `ClientTravel` then reached
  the multiplayer menu (L345, L375). So the game clears its flag before
  a screen listener's `OnInit` runs on `UIFinalShell`.
- **Leaving the test map** through the pause menu showed "Preparing to
  exit online match..." and hung (`UIProgressDialogue`, L603; Kc closed
  the game). There was no online session, so this says nothing yet about
  leaving a real match.
- **Screen listeners and map changes:** no `OnRemoved` reached the
  listener when the lobby ended in a map change (no `X2TC: Lobby closed`
  line). Timers set on a screen with a listener as the timer object
  compiled; whether they fire was not shown (no change was due in the 3
  seconds the lobby was open, and
  `X2TacticalGameRuleset.GetCachedUnitActionPlayerRef` returns an empty
  reference outside the unit-actions state, L5462–5469).

### Live test: two players over the internet (test, 2026-11-11)
Host build 8270065, friend's build ID not yet reported; mod 0.2.0 on
both. Logs in `local\m2-logs\live-*.log` (details and line numbers in
LOG.md).
- A Private lobby, a Steam invite (accepted from the main menu, then in
  a second round from the multiplayer menu), the lobby's `open` to the
  tactical map with two players, and one full turn each all work on
  8270065.
- From the main menu the game kept the invite (`HasAcceptedInvites`
  true, shuttle to the invite loadout set) and the mod's `ClientTravel`
  got the guest to the accept-invite squad screen. From the multiplayer
  menu the game did it alone, as the SDK trace above predicted.
- Game state crosses the network as in the SDK
  (`UXComGameStateNetworkManager::SendGameState`,
  `SendMergeGameState` lines in both logs).
- **Exit hang (test) and lead (guess):** leaving a match hung on the
  "Preparing to exit online match ..." dialog
  (`m_strShutdownOnlineGame`, game `XComGame.int` L4658;
  `XComPresentationLayerBase.uc` L1771-1779). The leaving player calls
  `XComTacticalController.AttemptExit` (L2498-2517): forfeit, then a
  15-second `ForcedExit` that calls `Pres.StartMPShellState()`
  (L2519-2523), which is `ConsoleCommand("open XComShell_Multiplayer.umap?Game=XComGame.XComMPShell")`
  (`XComPresentationLayerBase.uc` L1194-1198), the `open` that loads
  nothing on 8270065. A likely fix in the same style as the MULTIPLAYER
  button: travel to the multiplayer shell with `ClientTravel` when that
  dialog stays up, or when the after-action screen closes. Untested; its
  own plan.

## For later (M3/M4, noticed in passing only)

- **Multiplayer teams in single player (Highlander).** The Highlander's
  `CHANGELOG.md` L127 lists a feature that lets mods use the multiplayer
  teams in single player (#188). Not read further; it may matter for M3
  if the Highlander is used.

- **History sync is native and already exists for two players.**
  `XComGameStateNetworkManager` has `SendHistory`/`ReceiveHistory`
  (L320–321), `SendPartialHistory` (L329–330), `SendGameState` (L338–339),
  `SendMergeGameState` (L347–348), `SendGameStateContext` (L356–357) and
  `QueueContextForSending` (L293). Guess: in a match each player's action
  travels as a game-state context and is replayed on the other machine.
- **Desync detection and repair exist**: a validation state enum with
  `eCVS_Desynchronized` … `eCVS_FinishedSynchRepair` (L10–21),
  `SendValidateGameState` (L374–375), `RequestMirrorHistory` (L287),
  `GenerateValidationReport` (L288).
- **Generic remote commands**: `SendRemoteCommand(string, array<byte>)`
  (L311) with string/int/bool parameter helpers (L235–241). The lobby
  uses it for `ClientJoined`, `NotifyLoadingMap`, `RequestHistory`
  (`UIMPShell_Lobby.uc` L1843–1861). A possible channel for co-op
  messages (for example "I'm about to act") without native changes.
- **Unit ownership**: the lobby assigns each unit to a player with
  `NewUnit.SetControllingPlayer(PlayerGameState.GetReference())`
  (`UIMPShell_Lobby.uc` L2079). For co-op, two humans on one team is the
  M3 question: either two `XComGameState_Player` objects on the XCOM
  team, or one player state driven from two machines.
- **MP ruleset**: `XComMPTacticalGame.uc` L11 swaps in
  `X2TacticalMPGameRuleset` (extends `X2TacticalGameRuleset`). How it
  alternates turns between two players was not read; that is M4's
  starting point.
- **Turn order** is randomized in the lobby (`RandomizePlayerTurnOrder`,
  `UIMPShell_Lobby.uc` L665; not read).
- **Some SDK files are not UTF-8** (the Read tool flagged
  `X2MPShellManager.uc`); only matters if a script parses them.

### From the WOTC Co-op Campaign prototype's README (Session 5)
**Their claims, not tested by us.** Details and source in
research/prior-art.md; the matching questions are 9–12 in section 6.
- **Direct IP:** worked for them on 8270065 with the host as one decimal
  integer, not a dotted address.
- **Join:** the host sends the whole history with `MPSendHistory` (a
  console command that calls `SendHistory`, `XComCheatManager.uc`
  L4017–4022); the client loads from it.
- **Lost bursts:** frames sent one by one in bursts were lost, so they
  batch frames, keep one merge in flight, and wait for an ack (resent
  after 5 s).
- **ObjectID collisions:** only the player holding the "baton" may create
  game state objects; otherwise both sides hand out the same ObjectID.
  Matters for M4's same-turn actions.
- **History alignment:** the receiver pads its history with empty frames
  so merges land at the same frame number; without it the host crashed in
  5 of 11 runs.
- **Test copy with `-nohomedir`:** they test on a copy of the game, never
  the install they play, and run it with `-nohomedir` so saves, config and
  logs stay inside the copy. (`-nohomedir` isn't in the script source;
  it's an engine command-line switch, so this is their claim only.)

## 8. M3: starting point and the guest's action path (Sessions 6-7, source only)

Basis for plans/m3-plan.md. Paths under `SrcOrig\XComGame\Classes\`
unless named otherwise; "CHL" means the Community Highlander clone in
`local\refs\X2WOTCCommunityHighlander\X2WOTCCommunityHighlander\Src\XComGame\Classes\`
(v1.32.0). **None of this has run in an M3 test.** Session 6 used two
read-only research agents, then re-read the lines for findings 1, 2, 3,
5, 6 and 9 and the checks in 4; the single-XCOM-player list in 7 and the
multiplayer-ruleset details in 4 beyond L2548 are the agents' reading,
not re-checked line by line. Session 7 re-read everything in 10-12.

### Session 6 (2026-11-12)
1. **Shipped multiplayer sync.** One machine simulates, the other
   follows in a replay. The active side sends new frames after each
   action (`X2TacticalMPGameRuleset.uc` L1341-1369, `SendPartialHistory`
   L348-359); the inactive side's `XComMPReplayMgr` steps forward when the
   history grows (`XComMPReplayMgr.uc` L141-154); roles swap at a turn
   switch by remote commands (`HistoryReceived`, `SwitchTurn`; L319-339,
   L1219-1226). Retail config selects this mode with
   `bPauseGameStateSending=true` (game `XComGame\Config\DefaultGame.ini`
   L103-105, read in place). The other mode in the source (both machines
   simulate from mirrored input contexts, `X2GameRuleset.uc` L226-249) is
   off in retail. **Tested (M2):** the script call stacks in
   `live-guest.log` (L521-606) match the "did not queue" branch at
   `X2GameRuleset.uc` L244-248.
2. **The network pieces aren't multiplayer-only.** One engine-wide
   network manager (`XComGameStateNetworkManager.uc` L233); `CreateServer`,
   `CreateClient`, `SendHistory`, `SendPartialHistory`,
   `SendGameStateContext`, `SendRemoteCommand` and the receive delegates
   are callable from any script (L244-438). The base ruleset caches it
   (`X2GameRuleset.uc` L152). A context arriving from the network is
   submitted to whichever tactical ruleset is running (L295-305). With no
   connection-closed delegate registered, the game reopens the main menu
   (L440-445).
3. **Only stock game classes.** `XComGameInfo.SetGameType` (L146-201)
   rewrites any `?game=` to `XComMPTacticalGame` or `XComTacticalGame`;
   the ruleset comes from the game class.
4. **Multiplayer mode switches off campaign-mission needs** by checks
   script can't change: aliens spawn only when `IsSinglePlayerGame()`
   (`X2TacticalGameRuleset.uc` L2548); mission objectives skipped
   (`XComParcelManager.uc` L1962-1968); abilities filtered to the
   multiplayer set (L877-892). The multiplayer ruleset treats every
   player as human (L505-509), places units for Team One and Two only
   (L735), and decides "remote" by Steam ID (L437-478).
5. **A single-player mission can start from a history.** If the top frame
   isn't a start state, `InitBattle` calls `LoadGame`
   (`XComTacticalGRI.uc` L336-357), which rebuilds the map and resumes
   mid-turn (`X2TacticalGameRuleset.uc` L2994-3473, L4242-4275). Challenge
   Mode opens a map from a history in memory with `?LoadingSave`
   (`UIChallengeMode_SquadSelect.uc` L1278).
6. **Skirmish** is a campaign-free single-player mission in the retail
   menus, under the Tactical Legacy Pack item (`UIFinalShell.uc` L137;
   `UITLE_SkirmishModeMenu.uc` L240-337, L2671).
7. **Single player assumes one XCOM player** (`XGAIPlayer.uc` L1089,
   L1107; `XGBattle_SP.uc` L321-341, L982-1014; four player slots,
   `XGBattle.uc` L17). Team relations are native
   (`XComGameState_Unit.uc` L9603-9606).
8. **ObjectIDs** come from one native counter with no per-machine range
   (`XComGameStateHistory.uc` L431): aligned only if one machine creates
   objects at a time. Agrees with the prototype's claim.
9. **Leaving a multiplayer match** goes through `AttemptExit`
   (`XComTacticalController.uc` L2498-2523) to the `open` that 8270065
   refuses; multiplayer matches only.

### Session 7 (2026-11-12): is there a hook before an action is applied?
10. **The Highlander leaves the submit path as it was.**
    `SubmitGameStateContext` and `SubmitGameStateContexts` (CHL
    `X2GameRuleset.uc` L209-298, L303-407) carry no Highlander issue
    markers. Their only hook is the event observers'
    `PreBuildGameStateFromContext` (L275-278), which can't refuse an
    action. The Highlander makes the observer list public (Issue #481,
    L88; `CHANGELOG.md` L240). The tutorial is the one built-in case that
    takes over submitted actions (`X2GameRuleset.uc` L290-293).
11. **`PostModifyNewAbilityContext` (Highlander Issue #890) fits.** CHL
    `XComGameStateContext_Ability.uc` L1549-1566: triggered in
    `ActivateAbility_Internal` with the finished context (targets, hit
    result, after the template's `ModifyNewContextFn`) and before
    `ActivateAbility` hands it to the ruleset (L1334-1373, the latent
    submit at L1367). Listeners must use ELD_Immediate. Not in SrcOrig.
    It can read and change the context, not cancel it.
12. **The guest's own submit adds nothing while in replay.**
    `X2TacticalGameRuleset.AddNewStatesAllowed` returns false when the
    replay manager's `bInReplay` is set (SrcOrig
    `X2TacticalGameRuleset.uc` L682-692; CHL L694-704), and
    `SubmitGameStateContext` then adds nothing (`X2GameRuleset.uc`
    L216-298). But input is held too: `XComTacticalController.SetInputState`
    changes the input state during a replay only if forced or in the
    tutorial (SrcOrig L780-786). `bInReplay` is `protectedwrite`
    (`XComReplayMgr.uc` L14), so a subclass of the replay manager can set
    it. Whether the native `LatentSubmitGameStateContext`
    (`X2GameRuleset.uc` L166) also checks `AddNewStatesAllowed`: not in
    the script source.

**Design consequence (plans/m3-plan.md section 2):** the guest captures
its action with finding 11 and forwards it; finding 12 keeps it from
applying locally; no class override unless Stage 5 shows the guest can't
give input in follow mode or its action still applies.

### Stage 3 design (2026-11-14, source only)
13. **The guest can open the host's mission in the game's replay mode.**
    The network manager loads a received history itself: the
    multiplayer lobby's `ReceiveHistory` only sets a flag before loading
    the map from it (`UIMPShell_Lobby.uc` L807-830). `InitBattle` without
    a standard load and with no pending start state calls `LoadGame`
    (`XComTacticalGRI.uc` L298-357). With
    `ONLINEEVENTMGR.bInitiateReplayAfterLoad` set, the loaded ruleset
    opens the replay screen and calls `ReplayMgr.StartReplay` from the
    mission's start state instead of continuing play
    (`X2TacticalGameRuleset.uc` L3063-3077; `XComReplayMgr.uc` L44-68).
    The debug Challenge Mode screen uses exactly this to replay an
    in-memory history: `bInitiateReplayAfterLoad = true` and
    `ConsoleCommand(BattleData.m_strMapCommand $ "?LoadingSave")`
    (`UIDebugChallengeMode.uc` L375-383). Skirmish sets the map command
    to `open <plot>?game=XComGame.XComTacticalGame`
    (`UITLE_SkirmishModeMenu.uc` L282) and runs it with `ConsoleCommand`
    (L2671), which works on 8270065 (M3 Stage 1).
14. **The Alien Hunters Highlander** is a plugin in the Highlander's own
    repository (`Components\DLC2CommunityHighlander`, same MIT license);
    its readme says it is required with the Alien Hunters DLC and must
    not be used without it (`ReadMe.txt`). Without it the Highlander
    logs `DLC_2 -- NOT LOADED - REQUIRED` (M3 Stage 2 logs).
