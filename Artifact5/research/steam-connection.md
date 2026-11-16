# Steam connection for co-op (Stage 7 research, 2026-11-15)

Read-only SDK research for a co-op connection over the internet without port
forwarding (Stage 7; plan in plans/ once approved). The reading was done by
a read-only research agent and spot-checked by Claude: the `steamsockets`
lines and `GetResolvedConnectString` calls below were confirmed by search.
Paths are under the SDK's `Development\SrcOrig\`; SPL =
`XComGame\Classes\XComShellPresentationLayer.uc`. Nothing here is tested;
**guess** marks inference.

## Today
X2TC_CoopSession: host `CreateServer` with Port=7777 and no options; guest
`CreateClient` to a typed IP, then `ForceConnectionAttempt`. Works on a LAN
(M3); over the internet it needs port forwarding.

## How the stock game connects over Steam
1. **Host.**
   - **Session settings.** SPL `OSSCreateGameSettings` (L1286-1365) builds
     `XComOnlineGameSettingsDeathmatchUnranked` (L1315).
     - Private: 0 public and 2 private connections (L1341-1342).
     - LAN: `bIsLanMatch` (L1347-1349).
     - It also stamps the package, DLC, mod and INI hashes (L1353-1358).
   - **Inherited flags.** `bAllowInvites`, `bUsesPresence` and
     `bAllowJoinViaPresence` are true (`Engine\Classes\OnlineGameSettings.uc`
     L136-138).
   - **Creating it.** SPL L1225 calls
     `GameInterface.CreateOnlineGame(ControllerId, 'Game', Settings)`.
   - **The server.** On completion, SPL `StartNetworkGame` (L1103-1129)
     adds the URL option **`steamsockets`** when the game isn't LAN
     (L1121-1124) and calls `NetManager.CreateServer`. The lobby's own
     `CreateServer` uses Port=7777 plus `steamsockets` (`UIMPShell_Lobby.uc`
     L502-513, L510).
2. **Guest.**
   - **Accepting.** An accepted invite goes `AcceptGameInvite` (via
     `XComPlayerController.StartAcceptGameInvite` L219-244 and
     `Engine\Classes\PlayerController.uc` L7348-7351).
   - **The address.** `XComPlayerController.OnInviteJoinComplete`
     (L256-282) calls `GetResolvedConnectString(SessionName, URL)` (L275).
     That function is native, so the string's format (Steam ID or IP) isn't
     visible (**guess**).
   - **Connecting.** SPL `StartNetworkGame` (L1141-1163) splits host:port,
     adds `steamsockets`, and calls `CreateClient`. A 0.1 s timer then calls
     `ForceConnectionAttempt` (SPL L1172-1192).
3. **Invites.**
   - **Sending.** The lobby's Invite calls
     `PlayerInterfaceEx.ShowInviteUI` (`UIMPShell_Lobby.uc` L897), which
     opens the Steam overlay.
   - **Accepting.** `XComOnlineEventMgr.OnGameInviteAccepted` (L3502)
     handles the accept:
     - it checks the settings, `bAllowInvites` and the version hashes
       (L3532-3547);
     - it calls `NetworkMgr.Disconnect()` (L3554-3555);
     - it moves the player to the multiplayer shell (L3580).
   - **The mod's hook.** The mod's `X2TC_InviteListener` adds its own
     accepted-invite delegate (L65-66).
4. **Shell-only parts.**
   - `StartNetworkGame` exists only in SPL; the base presentation layer's
     version is an empty stub (`XComPresentationLayerBase.uc` L1781).
   - The underlying calls are global (`GameInterface`, `XCOMNETMANAGER`),
     so the mod can make them itself (**guess**):
     - `CreateOnlineGame`
     - `ShowInviteUI`
     - `GetResolvedConnectString`
     - `CreateServer`, `CreateClient` and `ForceConnectionAttempt`
   - The main menu disconnects the network manager when it opens
     (`UIShell.uc` L97-99).
5. **Lower-level alternative.** `OnlineSubsystemSteamworks\Classes\
   OnlineGameInterfaceXCom.uc` has a Steam lobby API:
   - `CreateLobby` (L298), `JoinLobby` (L426), `SetLobbyServer` (L909) and
     `InviteToLobby` (L947);
   - `AllowP2PPacketRelay` (L287).

   A manual flow using it is in `XComCheatManager.uc` L3767-3789 and
   L3867-3911.
6. **Cleanup.** `DestroyOnlineGame('Game')` is called on leaving the lobby
   (`UIMPShell_Lobby.uc` L999) and in `X2TacticalMPGameRuleset.DisconnectGame`
   (L684-688). M2 showed the `steamsockets` connection surviving the map
   change from the lobby to the tactical map (LOG.md).

## Only a test can settle
- **Single-player maps.** Does a `steamsockets` server or client work from a
  single-player tactical map and the main menu?
- **Invites while hosting.** Is a Steam invite offered and accepted while
  the host is on a single-player map?
- **The stock handler.** Does its disconnect and shuttle to the
  multiplayer shell get in the way, and can the mod take over afterwards?
- **The connect string.** What format is it, and does the client need
  `steamsockets`?
- **Relay.** Does Steam's P2P relay work without port forwarding? Expect
  join latency of several seconds (SPL L1994-1997).
- **Version check.** The stock handler checks DLC and INI hashes (L3547).
