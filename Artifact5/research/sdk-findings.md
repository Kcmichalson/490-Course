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
    the Highlander on both machines. Nothing here is checked yet.

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

## For later (M3/M4, noticed in passing only)

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
