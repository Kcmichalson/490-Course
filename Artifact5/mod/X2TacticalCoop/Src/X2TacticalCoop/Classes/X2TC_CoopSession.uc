//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopSession
//
//  What it changes: opens a direct connection between two games with the game's own
//  network manager, outside any multiplayer match (plans/m3-plan.md, Stage 2). The host
//  creates a server on port 7777 from a single-player tactical mission; the guest
//  creates a client to the address it was given and retries the connection a few times.
//  Once connected, the guest sends a ping by remote command and the host answers with a
//  pong. Every step writes an X2TC line to Launch.log. Log lines never contain the
//  address (only its form: dotted, integer or other) or a player name.
//
//  It also registers a connection-closed delegate, because with none registered the
//  game reopens the main menu when a connection closes
//  (XComGameStateNetworkManager.uc L440-445).
//
//  Stage 3 (snapshot): once the guest has its pong it asks for the host's history by
//  remote command; the host sends its whole history (SendHistory). The guest's network
//  manager replaces the guest's history with it (the multiplayer lobby only sets a flag
//  on receipt, UIMPShell_Lobby.uc L820-830), and the guest opens the mission's map from
//  it in the game's own replay mode: bInitiateReplayAfterLoad and the map command with
//  "?LoadingSave", as the debug Challenge Mode screen does (UIDebugChallengeMode.uc
//  L375-383). The guest's ruleset then starts a replay instead of playing
//  (X2TacticalGameRuleset.uc L3063-3077), so it never simulates. When the guest's
//  tactical screens open, the session logs that it survived the map load and restarts
//  its timer.
//
//  Stage 4 (live follow, view only): on the guest it replaces the stock replay manager
//  with X2TC_CoopReplayMgr before the replay starts; when that follower runs, the guest
//  tells the host. From then on the host's poll sends a partial history whenever its
//  history has new frames (one at a time; the guest answers each with its frame count,
//  as stock multiplayer answers "HistoryReceived"), logging frames and the bytes the
//  send queued. Both sides log every player-turn start with its frame ("Coop sync"), so
//  the two logs can be paired.
//
//  Stage 5 (the guest's first move): the guest's follower captures a move and calls
//  SendGuestMove (unit and path tiles); the host keeps it and applies it with its own
//  XComTacticalController.GameStateMoveUnit once it's XCOM's turn and nothing is busy
//  (up to 10 s), then answers applied or refused. The guest can leave (LeaveAsGuest:
//  disconnect, main menu); the host then stops sending and plays on. Both sides log
//  gaps over 1.5 s between polls, and each send logs the data types it queued.
//
//  Stage 5b (pulled into Stage 5 Run 4): captured abilities go the same way
//  (SendGuestAbility: template, source, primary target, target locations); the host
//  finds the matching available action and applies it with ActivateAbility.
//
//  Stage 6 (shared turn): every soldier belongs to the host until the co-op squad
//  screen (X2TC_CoopSquadScreen) gives it to the partner (X2TC_CoopOwnership); the host
//  refuses guest actions on P1's soldiers while "Soldier ownership" is on. The screen's
//  three settings (ownership, partner may end the turn, partner may edit) are the
//  host's for this session only, sent to the guest by command; the partner's edits,
//  when allowed, go to the host, which applies them. Both sides
//  show FRIENDLY ACTION (X2TC_CoopTurnUI) while the other player's soldier acts. Only the
//  host ends XCOM's turn: the guest's END TURN sends "ready"; the host's End Turn (our
//  button, Backspace) asks first while the guest's soldiers can act and it isn't ready,
//  with the HUD's own End Turn icon disabled meanwhile. The host's selection is kept off
//  P2's soldiers.
//    XComGame\Classes\XComTacticalController.uc (PerformEndTurn L1350, Visualizer_SelectUnit)
//    XComGame\Classes\XGGameData.uc           (EPlayerEndTurnType L605)
//    XComGame\Classes\UIDialogueBox.uc        (TDialogueBoxData, ActionCallback L69)
//
//  0.5.1-0.5.3 (Stage 6 runs): the host's input is locked while only P2's soldiers can
//  act; the blue banner also says NO SOLDIERS ASSIGNED on the guest, and FRIENDLY ACTION
//  to a player out of moves; Tab/H on the host cycle only its own soldiers; the guest
//  sees why the host refused an action; at the end of the battle (eGameRule_TacticalGameEnd)
//  the guest gets "mission over" and returns to the main menu, and the host closes the
//  co-op session once the guest has the end frame. A host that loses the guest mid-
//  mission plays on; a guest that loses the host is told and returns to the main menu.
//
//  One session per game: GetSession() looks it up by a fixed name in the transient
//  package and creates it there the first time, the pattern the Highlander uses for its
//  dependency objects (X2WOTCCH_ModDependencies.uc L102-110). A runtime default value
//  can't hold it: UnrealScript only allows that for config variables (build error,
//  LOG.md 2026-11-14). The lookup alone doesn't keep it alive: an unreferenced object is
//  garbage collected between frames (same Highlander comment). Once started, the
//  network manager's delegates point at it, and the network manager lives for the whole
//  game, so that is what should keep it across a map load (a guess until Stage 3; a
//  second "session object created" line after a map load would mean it was collected).
//  It holds no reference to an actor; its timer runs on the local player controller of
//  the current map.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComGameStateNetworkManager.uc (GetGameStateNetworkManager L233,
//        Add/GetCommandParam_Int L236/L240, CreateServer L244, CreateClient L248,
//        ForceConnectionAttempt L251, HasServerConnection/HasClientConnection L257-258,
//        SendRemoteCommand and OnReceiveRemoteCommand L311-314,
//        OnNotifyAcceptedConnection and OnNotifyConnectionClosed L435-438,
//        Connections L128)
//    Core\Globals.uci                     (AddClearDelegates L430, XCOMNETMANAGER L196)
//    XComGame\Classes\UIMPShell_Lobby.uc  (the same CreateServer/CreateClient calls, L502-523)
//    XComGame\Classes\XComShellPresentationLayer.uc (ForceConnectionAttempt after a
//                                                    client is created, L1173-1197)
//    Engine\Classes\Actor.uc              (SetTimer with an object L2164; ConsoleCommand L1699)
//    Engine\Classes\WorldInfo.uc          (GetALocalPlayerController)
//    XComGame\Classes\XComGameStateNetworkManager.uc (SendHistory and OnReceiveHistory
//                                                     L320-323)
//    XComGame\Classes\XComGameStateHistory.uc  (GetNumGameStates)
//    XComGame\Classes\XComGameState_BattleData.uc (m_strMapCommand, MapData.PlotMapName;
//        set by Skirmish as "open <plot>?game=XComGame.XComTacticalGame",
//        UITLE_SkirmishModeMenu.uc L282)
//    XComGame\Classes\XComTacticalGRI.uc      (InitBattle: LoadGame when the history has
//                                              no pending start state, L330-357)
//    XComGame\Classes\XComReplayMgr.uc        (bInReplay, CurrentHistoryFrame L12-14)
//    XComGame\Classes\XComGameStateNetworkManager.uc (SendPartialHistory and
//        OnReceivePartialHistory L329-332; OutGameData L63, PendingGameData L42-61)
//    XComGame\Classes\X2TacticalMPGameRuleset.uc (when stock multiplayer sends partial
//        histories, L348-359 and L1350-1360; the guest's answer, L304-313)
//    XComGame\Classes\X2GameRuleset.uc        (BuildingLatentGameState L108)
//    XComGame\Classes\XComGameStateContext_TacticalGameRule.uc (GameRuleType, PlayerRef
//                                                               L39-40; eGameRule_PlayerTurnBegin)
//    XComGame\Classes\XComTacticalController.uc (GameStateMoveUnit L1249-1345)
//    XComGame\Classes\X2TacticalGameRulesetDataStructures.uc (PathingInputData L211-219)
//    XComGame\Classes\XComGameStateNetworkManager.uc (Disconnect L254; Add/GetCommandParam_String
//                                                     L235/L239)
//    Engine\Classes\PlayerController.uc       (bIgnoreNetworkMessages L214)
//---------------------------------------------------------------------------------------

class X2TC_CoopSession extends Object dependson(UIDialogueBox, XGGameData, X2MPData_Common);

const COOP_PORT = 7777;

// Remote command names. Other listeners (the game's own) see them too and ignore them.
const CMD_PING = "X2TC_Ping";
const CMD_PONG = "X2TC_Pong";
const CMD_REQUEST_HISTORY = "X2TC_RequestHistory";
const CMD_FOLLOWING = "X2TC_Following";              // guest: its follower runs
const CMD_HISTORY_RECEIVED = "X2TC_HistoryReceived"; // guest: a partial history arrived

// Host: a partial history without an answer for this long is logged and given up on.
const PARTIAL_ACK_TIMEOUT_SECONDS = 15;

// Stage 5.
const CMD_GUEST_MOVE = "X2TC_GuestMove";   // guest: unit ID, tile count, then X, Y, Z per tile
const CMD_MOVE_RESULT = "X2TC_MoveResult"; // host: 1 applied / 0 refused, then the reason (moves and abilities)
// Stage 5b: template name, source unit ID, primary target ID, location count, then X, Y, Z
// per location (rounded to whole units).
const CMD_GUEST_ABILITY = "X2TC_GuestAbility";
// Stage 6: the guest is ready to end XCOM's turn (it ends nothing by itself).
const CMD_GUEST_READY = "X2TC_GuestReady";
const BANNER_MIN_SECONDS = 1.5;            // both: the FRIENDLY ACTION banner shows at least this long
// Co-op squad screen (X2TC_CoopSquadScreen). The settings are the host's, for this
// session only (Kc, 2026-11-15), sent to the guest by command.
const CMD_SETTINGS = "X2TC_Settings";          // host: ownership, partner may end turn, partner may edit (0/1 each)
const CMD_SET_OWNER = "X2TC_SetOwner";         // guest: unit ID, owner (when it may edit)
const CMD_SET_SETTING = "X2TC_SetSetting";     // guest: setting index, 0/1 (when it may edit)
const CMD_GUEST_END_TURN = "X2TC_GuestEndTurn"; // guest: end XCOM's turn (when allowed)
const SETTING_OWNERSHIP = 0;
const SETTING_PARTNER_END_TURN = 1;
const SETTING_PARTNER_EDIT = 2;
const SETTING_NEW_FRAMES = 3;              // Stage 8.1: send each new frame instead of a partial history (host only, before the guest follows)
const OWN_ACTION_SECONDS = 5.0;            // guest, ownership off: its own soldier's frames this soon after its order aren't "friendly"
const REFUSAL_SECONDS = 4.0;               // guest (0.5.3): how long a refusal message stays in the status line
// 0.5.3, mission end: the host closes its side this long after the guest has the
// end-of-battle frame (so the guest sees "mission over", not "host disconnected"), or
// after MISSION_END_MAX_SECONDS whatever happens.
// 0.6.3 (Stage 7 Run 2: the guest got "host disconnected" because the host closed 5 s
// after the guest had the end frame, while the guest was still playing the last
// animations): the guest says when its "mission over" dialog is up; the host closes
// MISSION_END_DISCONNECT_SECONDS after that, or after MISSION_END_MAX_SECONDS.
const CMD_MISSION_END_SHOWN = "X2TC_MissionEndShown";
const MISSION_END_DISCONNECT_SECONDS = 2;
const MISSION_END_MAX_SECONDS = 60;
const MOVE_RETRY_SECONDS = 10;             // host: how long a move may wait for an idle ruleset
const HITCH_SECONDS = 1.5;                 // both: a poll gap longer than this is logged
const FAST_SEND_SECONDS = 0.2;             // host: how often new frames are checked for sending (Run 6)
// The guest's way back to the main menu (the same command tested from the main menu in
// M2 Stage 1e; the game uses a shell map with XComShell when a connection drops,
// XComGameStateNetworkManager.uc L441-445).
const LEAVE_MAP_COMMAND = "open XPACK_Shell_Intro?Game=XComGame.XComShell";

// Guest: seconds between connection attempts, and how many.
const CONNECT_RETRY_SECONDS = 5;
const CONNECT_MAX_ATTEMPTS = 6;

// Guest: seconds between pings until a pong arrives, and how many.
const PING_RETRY_SECONDS = 3;
const PING_MAX = 10;

enum ECoopRole
{
	eCoopRole_None,
	eCoopRole_Host,
	eCoopRole_Guest,
};

var ECoopRole Role;
var bool bDelegatesAdded;

// Connection state as last logged, to log only changes.
var bool bLastServer;
var bool bLastClient;
var int LastConnections;

var bool bConnectedLogged;
var bool bPongReceived;
var int Seconds;
var int ConnectAttempts;
var int LastAttemptSecond;
var int PingsSent;
var int LastPingSecond;

// Stage 3.
var bool bHistoryRequested;   // guest: asked the host for its history
var bool bHistorySent;        // host: sent it once
var bool bLoadingMission;     // guest: received it and opened the map
var bool bMissionTimerStarted; // guest: poll restarted on the mission map

// Stage 4.
var bool bFollowerInstalled;  // guest: X2TC_CoopReplayMgr replaced the stock replay manager
var bool bGuestFollowing;     // host: the guest's follower runs, partial histories may go
var bool bPartialInFlight;    // host: one partial history sent, no answer yet
var int LastSentFrames;       // host: history frames covered by the last send
var int PartialSends;         // host: partial histories sent
var int PartialSentSecond;    // host: Seconds when the one in flight was sent
var int PartialSentFrames;    // host: frames in the one in flight
var int HostTurnScanFrame;    // host: last frame checked for player-turn starts
var int PartialsReceived;     // guest

// Stage 5.
var bool bMovePending;         // host: a guest move waiting to be applied
var int PendingMoveUnitID;
var array<TTile> PendingMoveTiles;
var int PendingMoveSecond;     // host: Seconds when it arrived
var int MovesReceived;         // host
var int MovesSent;             // guest
var int LastGuestMoveUnitID;   // guest: the unit of the last move sent

// Stage 5b.
var bool bAbilityPending;      // host: a guest ability waiting to be applied
var name PendingAbilityName;
var int PendingAbilitySourceID;
var int PendingAbilityTargetID;
var array<vector> PendingAbilityLocations;
var int PendingAbilitySecond;
var int AbilitiesReceived;     // host
var int AbilitiesSent;         // guest
var bool bVersionMismatch;     // both: the other side's mod version differs (from 0.3.8)

// Stage 6.
var bool bOwnersAssigned;      // host: the owners have been logged for this session
var bool bGuestReady;          // host: the guest pressed END TURN this XCOM turn
var bool bReadySent;           // guest: END TURN pressed this XCOM turn
var bool bBannerShown;         // both: the FRIENDLY ACTION banner is up
var float BannerShownTime;     // both: WorldInfo.RealTimeSeconds when it came up
var ETeam LastTurnTeam;        // host: whose turn it was at the last fast tick
var int LastHostSkippedUnitID; // host: last guest-owned unit moved off the host's selection
var bool bEndTurnIconDisabled; // host: we disabled the HUD's End Turn icon
var string ShownBannerText;    // both: the banner text on screen ("" = none)
var bool bHostLocked;          // host (0.5.1): input locked while only P2's soldiers can act
var float RefusalShownTime;    // guest (0.5.3): when the refusal message went up (0 = none)
var bool bMissionEnded;        // both (0.5.3): the end-of-battle frame was seen
var int MissionEndFrame;       // both: its frame
var int MissionEndSecond;      // host: Seconds when it was seen
var int MissionEndAckedSecond; // host: Seconds when the guest had it (-1 = not yet)
var bool bMissionDialogShown;  // guest: the "mission over" or "host left" dialog is up
var bool bMissionEndFrameAcked; // host (0.6.3): the guest acknowledged frames past the end frame

// Stage 7 (Steam).
var bool bSteamSession;        // both: this session's connection uses steamsockets
var bool bSteamGameCreated;    // both: a Steam 'Game' session was created or joined by us
var bool bSteamInviteArmed;    // guest: the next accepted invite is a co-op invite
var bool bSteamJoinStarted;    // guest: joining the host's Steam session
var bool bStockInviteHandlerOff; // guest (0.6.2): the game's own invite handler is taken off
var bool bContentMismatch;     // both (0.6.2): the other game's mods or DLC differ (by name)

// Co-op squad screen settings (host's; the guest keeps a copy from CMD_SETTINGS).
var bool bOwnershipOn;         // owners enforced (default on)
var bool bPartnerMayEndTurn;   // the guest's END TURN ends XCOM's turn (default off)
var bool bPartnerMayEdit;      // the guest may change owners and settings (default off)
var bool bNewFramesSync;       // Stage 8.1: frames go one by one (SendGameState), not as partial histories
var int NewFramesReceived;     // guest (8.1): frames received with OnReceiveGameState
var int NewFramesMisplaced;    // guest (8.1): of those, not found at their index in the history
var array<int> PendingOwnerUnitIDs; // host: owner changes waiting for an idle ruleset
var array<int> PendingOwnerValues;
var int LastOwnActionUnitID;   // guest: the unit of its last order
var float LastOwnActionTime;   // guest: WorldInfo.RealTimeSeconds of that order
var float LastPollRealTime;    // both: WorldInfo.RealTimeSeconds at the last poll
var int GuestExpectedFrames;   // guest: history frames after the last history from the host
var int GuestLastWarnedFrames; // guest: frame count of the last "grew by itself" warning

// The session's object name in the transient package.
const SESSION_OBJECT_NAME = "X2TC_CoopSession_Main";

// The one session of this game: found by name, or created (outer none = the transient
// package) the first time.
static function X2TC_CoopSession GetSession()
{
	local X2TC_CoopSession Session;

	Session = FindSession();
	if (Session == none)
	{
		Session = new(none, SESSION_OBJECT_NAME) class'X2TC_CoopSession';
		`log("Coop: session object created", , 'X2TC');
	}
	return Session;
}

// The session if one exists, without creating it.
static function X2TC_CoopSession FindSession()
{
	return X2TC_CoopSession(FindObject("Transient." $ SESSION_OBJECT_NAME, class'X2TC_CoopSession'));
}

// True if a session exists and has started as host or guest.
static function bool IsSessionActive()
{
	local X2TC_CoopSession Session;

	Session = FindSession();
	return Session != none && Session.IsActive();
}

// The session if it exists and is the guest's, otherwise none.
static function X2TC_CoopSession FindGuestSession()
{
	local X2TC_CoopSession Session;

	Session = FindSession();
	if (Session != none && Session.Role == eCoopRole_Guest)
	{
		return Session;
	}
	return none;
}

function bool IsActive()
{
	return Role != eCoopRole_None;
}

// Host: create a server on COOP_PORT (direct IP). Returns false (and logs why) if it
// couldn't.
function bool StartHost()
{
	if (!PrepareToHost())
	{
		return false;
	}
	return StartHostServer(false);
}

// Host: closes a session left over from an earlier mission; false if hosting can't start.
function bool PrepareToHost()
{
	local XComGameStateNetworkManager NetworkMgr;

	NetworkMgr = `XCOMNETMANAGER;
	// 0.5.3: a host session left over from an earlier mission: its poll timer died with
	// that map's controller, so it isn't running here; close it first. (0.6.0: with two
	// HOST buttons, a running timer means this mission is already hosting.)
	if (Role == eCoopRole_Host && IsPollRunning())
	{
		`log("Coop host: already hosting in this mission (steam=" $ bSteamSession $ ")", , 'X2TC');
		return false;
	}
	if (Role == eCoopRole_Host)
	{
		`log("Coop host: a co-op session from an earlier mission was still open (mission ended=" $ bMissionEnded $ ", following=" $ bGuestFollowing $ "); closing it first", , 'X2TC');
		HostEndSession("new HOST in a new mission");
	}
	if (IsActive())
	{
		`log("Coop host: already started as" @ RoleName(), , 'X2TC');
		return false;
	}

	if (NetworkMgr == none)
	{
		`log("Coop host: no network manager", , 'X2TC');
		return false;
	}

	if (NetworkMgr.HasConnections())
	{
		`log("Coop host: the network manager already has a connection; not starting", , 'X2TC');
		return false;
	}
	return true;
}

// Host: the server itself. Direct IP: a port and no options, as the LAN lobby does
// (UIMPShell_Lobby.uc L502-513). Steam (Stage 7): the same plus "steamsockets", as the
// lobby (L510) and the shell's StartNetworkGame (XComShellPresentationLayer.uc L1121-1129)
// do for non-LAN games.
function bool StartHostServer(bool bSteam)
{
	local XComGameStateNetworkManager NetworkMgr;
	local URL ServerURL;
	local string Error;

	NetworkMgr = `XCOMNETMANAGER;
	AddDelegates(NetworkMgr);

	ServerURL.Port = COOP_PORT;
	if (bSteam)
	{
		ServerURL.Op.AddItem("steamsockets");
	}
	NetworkMgr.CreateServer(ServerURL, Error);
	if (Error != "")
	{
		`log("Coop host: server not created (steam=" $ bSteam $ "), error:" @ Error, , 'X2TC');
		return false;
	}

	Role = eCoopRole_Host;
	bSteamSession = bSteam;
	`log("Coop host: server created (port" @ COOP_PORT $ ", steam=" $ bSteam $ ")", , 'X2TC');
	// Stage 6: Backspace on the host goes through the co-op End Turn check.
	class'X2TC_CoopInput'.static.Install();
	// Owners remembered from earlier missions of this campaign (X2TC_CoopOwnerMemory).
	HostRecallOwners();
	StartPoll();
	return true;
}

// Guest: create a client to the given address. Returns false (and logs why) if it couldn't.
function bool StartGuest(string Address)
{
	if (Address == "")
	{
		`log("Coop guest: no address entered", , 'X2TC');
		return false;
	}
	return StartGuestClient(Address, COOP_PORT, false);
}

// Guest: the client itself. Steam (Stage 7): "steamsockets" added, as the shell's
// StartNetworkGame does for the joining player (XComShellPresentationLayer.uc
// L1121-1163). Logs only the address's form, never the address.
function bool StartGuestClient(string Address, int Port, bool bSteam)
{
	local XComGameStateNetworkManager NetworkMgr;
	local URL ClientURL;
	local string Error;

	if (IsActive())
	{
		`log("Coop guest: already started as" @ RoleName(), , 'X2TC');
		return false;
	}

	NetworkMgr = `XCOMNETMANAGER;
	if (NetworkMgr == none)
	{
		`log("Coop guest: no network manager", , 'X2TC');
		return false;
	}

	if (NetworkMgr.HasConnections())
	{
		`log("Coop guest: the network manager already has a connection; not starting", , 'X2TC');
		return false;
	}

	AddDelegates(NetworkMgr);

	// As UIMPShell_Lobby.CreateClient does (L515-523): the host as typed, and the port.
	ClientURL.Host = Address;
	ClientURL.Port = Port;
	if (bSteam)
	{
		ClientURL.Op.AddItem("steamsockets");
	}
	NetworkMgr.CreateClient(ClientURL, Error);
	if (Error != "")
	{
		`log("Coop guest: client not created (address form:" @ AddressForm(Address) $ ", port" @ Port $ ", steam=" $ bSteam $ "), error:" @ Error, , 'X2TC');
		return false;
	}

	Role = eCoopRole_Guest;
	bSteamSession = bSteam;
	`log("Coop guest: client created (address form:" @ AddressForm(Address) $ ", port" @ Port $ ", steam=" $ bSteam $ ")", , 'X2TC');
	StartPoll();
	if (bSteam)
	{
		// Steam P2P takes longer (XComShellPresentationLayer.uc L1994-1997): try at once
		// and more often than over a LAN.
		LastAttemptSecond = -CONNECT_RETRY_SECONDS;
	}
	return true;
}

// ---- Stage 7: the connection over Steam (plans/m3-plan.md, research/steam-connection.md) ----

static function OnlineSubsystem GetOnlineSub()
{
	return class'GameEngine'.static.GetOnlineSubsystem();
}

static function byte LocalUserNum()
{
	if (`ONLINEEVENTMGR != none)
	{
		return byte(`ONLINEEVENTMGR.LocalUserIndex);
	}
	return 0;
}

// Host (Stage 7): CO-OP: HOST (STEAM). Creates a private Steam game session the way the
// multiplayer shell does for a Private lobby (XComShellPresentationLayer.uc L1209-1226,
// settings L1286-1358: 0 public / 2 private connections, the version hashes the guest's
// invite check compares, XComOnlineEventMgr.uc L3547), then (OnSteamGameCreated) the
// server with "steamsockets", then the Steam invite overlay.
function bool StartHostSteam()
{
	local OnlineSubsystem OnlineSub;
	local XComOnlineGameSettings Settings;

	if (!PrepareToHost())
	{
		return false;
	}
	OnlineSub = GetOnlineSub();
	if (OnlineSub == none || OnlineSub.GameInterface == none)
	{
		`log("Coop steam host: no online subsystem; not started", , 'X2TC');
		return false;
	}
	if (OnlineSub.GameInterface.GetGameSettings('Game') != none)
	{
		// A session from an earlier match or co-op run; the shell destroys it the same way
		// (UIMPShell_Lobby.uc L999).
		`log("Coop steam host: a 'Game' session already exists; destroying it first (click again in a few seconds)", , 'X2TC');
		OnlineSub.GameInterface.DestroyOnlineGame('Game');
		return false;
	}

	Settings = new class'XComOnlineGameSettingsDeathmatchUnranked';
	Settings.SetIsRanked(false);
	Settings.SetNetworkType(eMPNetworkType_Private);
	Settings.SetGameType(eMPGameType_Deathmatch);
	Settings.NumPublicConnections = 0;
	Settings.NumPrivateConnections = 2;
	Settings.bIsLanMatch = false;
	Settings.SetMPDataINIVersion(0);
	Settings.SetByteCodeHash(class'Helpers'.static.NetGetVerifyPackageHashes());
	Settings.SetIsAutomatch(false);
	Settings.SetInstalledDLCHash(class'Helpers'.static.NetGetInstalledMPFriendlyDLCHash());
	Settings.SetInstalledModsHash(class'Helpers'.static.NetGetInstalledModsHash());
	Settings.SetINIHash(class'Helpers'.static.NetGetMPINIHash());
	Settings.SetIsDevConsoleEnabled(class'Helpers'.static.IsDevConsoleEnabled());

	OnlineSub.GameInterface.AddCreateOnlineGameCompleteDelegate(OnSteamGameCreated);
	if (!OnlineSub.GameInterface.CreateOnlineGame(LocalUserNum(), 'Game', Settings))
	{
		OnlineSub.GameInterface.ClearCreateOnlineGameCompleteDelegate(OnSteamGameCreated);
		`log("Coop steam host: CreateOnlineGame refused to start", , 'X2TC');
		return false;
	}
	bSteamGameCreated = true;
	`log("Coop steam host: creating a private Steam game session (invites=" $ Settings.bAllowInvites @ "presence=" $ Settings.bUsesPresence $ ")", , 'X2TC');
	return true;
}

function OnSteamGameCreated(name SessionName, bool bWasSuccessful)
{
	GetOnlineSub().GameInterface.ClearCreateOnlineGameCompleteDelegate(OnSteamGameCreated);
	`log("Coop steam host: Steam game session" @ SessionName @ "created=" $ bWasSuccessful, , 'X2TC');
	if (!bWasSuccessful)
	{
		bSteamGameCreated = false;
		ShowGuestMessage("CO-OP: STEAM", "The Steam game session could not be created. Check that Steam is online, then try again.");
		return;
	}
	if (!StartHostServer(true))
	{
		ShowGuestMessage("CO-OP: STEAM", "The co-op server could not start over Steam. See Launch.log (X2TC lines).");
		DestroySteamGame("server failed");
		return;
	}
	ShowSteamInvite();
}

// Host (Stage 7): the Steam overlay's invite list (as the lobby's Invite button,
// UIMPShell_Lobby.uc L897). Can be opened again from the same button.
function ShowSteamInvite()
{
	local OnlineSubsystem OnlineSub;
	local bool bShown;

	OnlineSub = GetOnlineSub();
	if (OnlineSub == none || OnlineSub.PlayerInterfaceEx == none)
	{
		`log("Coop steam host: no PlayerInterfaceEx; invite overlay not shown", , 'X2TC');
		return;
	}
	bShown = OnlineSub.PlayerInterfaceEx.ShowInviteUI(LocalUserNum());
	`log("Coop steam host: Steam invite overlay shown=" $ bShown, , 'X2TC');
}

// Both (Stage 7): end the Steam game session, if this game made or joined one.
function DestroySteamGame(string Why)
{
	local OnlineSubsystem OnlineSub;

	if (!bSteamGameCreated)
	{
		return;
	}
	bSteamGameCreated = false;
	OnlineSub = GetOnlineSub();
	if (OnlineSub != none && OnlineSub.GameInterface != none)
	{
		`log("Coop steam: destroying the Steam game session (" $ Why $ "), started=" $ OnlineSub.GameInterface.DestroyOnlineGame('Game'), , 'X2TC');
	}
}

// Guest (Stage 7): CO-OP: JOIN (STEAM) on the main menu. The next accepted Steam invite is
// a co-op invite: X2TC_InviteListener hands it to OnSteamInviteAccepted instead of taking
// the game to the multiplayer menu. Normal multiplayer invites are untouched while not
// armed.
function ArmSteamInvite()
{
	if (IsActive())
	{
		`log("Coop steam guest: already started as" @ RoleName() $ "; not armed", , 'X2TC');
		return;
	}
	// 0.6.1 (Stage 7 Run 1): the network manager's delegates keep this object alive. Without
	// them it was garbage collected on the main menu between the click and the invite (the
	// friend's log: "session object created" at each click, and no armed hand-over), so the
	// game's own invite handling took over.
	if (`XCOMNETMANAGER != none)
	{
		AddDelegates(`XCOMNETMANAGER);
	}
	// 0.6.2 (Stage 7 Run 1): the game's own invite handler refuses an invite when the two
	// games' mod load orders differ (its mods hash, XComOnlineEventMgr.uc L3593-3614), and
	// the load order can't be set by the player (AML tick order didn't change it). While
	// armed, the game's handler is taken off; the co-op ping/pong compares the two games'
	// mods and DLC by name instead, ignoring order.
	SuspendStockInviteHandler();
	bSteamInviteArmed = true;
	`log("Coop steam guest: waiting for a Steam invite (armed; delegates added=" $ bDelegatesAdded $ ")", , 'X2TC');
	ShowGuestMessage("CO-OP: JOIN (STEAM)", "Now accept the host's invite in Steam (the notification, or Shift+Tab, Friends, then the invite). The co-op mission loads by itself.");
}

// Guest (0.6.2): take the game's own invite handler off (it registers for user 0,
// Engine\Classes\OnlineEventMgr.uc L133) while a co-op invite is expected.
function SuspendStockInviteHandler()
{
	local OnlineSubsystem OnlineSub;
	local XComOnlineEventMgr OnlineMgr;

	OnlineSub = GetOnlineSub();
	OnlineMgr = `ONLINEEVENTMGR;
	if (bStockInviteHandlerOff || OnlineSub == none || OnlineSub.GameInterface == none || OnlineMgr == none)
	{
		return;
	}
	OnlineSub.GameInterface.ClearGameInviteAcceptedDelegate(0, OnlineMgr.OnGameInviteAccepted);
	bStockInviteHandlerOff = true;
	`log("Coop steam guest: the game's own invite handler is off while waiting for a co-op invite", , 'X2TC');
}

// Guest (0.6.2): put the game's own invite handler back (after the co-op join, a failure,
// or leaving), so normal multiplayer invites work as before.
function RestoreStockInviteHandler(string Why)
{
	local OnlineSubsystem OnlineSub;
	local XComOnlineEventMgr OnlineMgr;

	if (!bStockInviteHandlerOff)
	{
		return;
	}
	bStockInviteHandlerOff = false;
	OnlineSub = GetOnlineSub();
	OnlineMgr = `ONLINEEVENTMGR;
	if (OnlineSub == none || OnlineSub.GameInterface == none || OnlineMgr == none)
	{
		return;
	}
	OnlineSub.GameInterface.AddGameInviteAcceptedDelegate(0, OnlineMgr.OnGameInviteAccepted);
	`log("Coop steam guest: the game's own invite handler is back (" $ Why $ ")", , 'X2TC');
}

// Guest (0.6.2): restore it a second later, outside the invite callback (adding a handler
// while the game is still calling this invite's handlers might call it for this invite).
function RestoreStockInviteHandlerLater()
{
	local PlayerController PC;

	PC = class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController();
	if (PC != none)
	{
		PC.SetTimer(1.0, false, nameof(RestoreStockInviteHandlerNow), self);
	}
	else
	{
		RestoreStockInviteHandler("no controller for the timer");
	}
}

function RestoreStockInviteHandlerNow()
{
	RestoreStockInviteHandler("after the co-op invite");
}

// Guest (Stage 7): called by X2TC_InviteListener when an invite is accepted while armed.
// Joins the host's Steam session (JoinOnlineGame, as an accepted invite does,
// XComPlayerController.uc L219-282); OnSteamJoinComplete connects.
function OnSteamInviteAccepted(const out OnlineGameSearchResult InviteResult, bool bWasSuccessful)
{
	local OnlineSubsystem OnlineSub;

	bSteamInviteArmed = false;
	RestoreStockInviteHandlerLater();
	`log("Coop steam guest: invite accepted, success=" $ bWasSuccessful @ "has game settings=" $ (InviteResult.GameSettings != none), , 'X2TC');
	if (!bWasSuccessful || InviteResult.GameSettings == none)
	{
		ShowGuestMessage("CO-OP: STEAM", "The invite could not be used. Ask the host to invite you again, then click CO-OP: JOIN (STEAM) first.");
		return;
	}
	OnlineSub = GetOnlineSub();
	OnlineSub.GameInterface.AddJoinOnlineGameCompleteDelegate(OnSteamJoinComplete);
	if (!OnlineSub.GameInterface.JoinOnlineGame(LocalUserNum(), 'Game', InviteResult))
	{
		OnlineSub.GameInterface.ClearJoinOnlineGameCompleteDelegate(OnSteamJoinComplete);
		`log("Coop steam guest: JoinOnlineGame refused to start", , 'X2TC');
		ShowGuestMessage("CO-OP: STEAM", "Joining the host's Steam session failed to start. See Launch.log (X2TC lines).");
		return;
	}
	bSteamJoinStarted = true;
	`log("Coop steam guest: joining the host's Steam session", , 'X2TC');
}

function OnSteamJoinComplete(name SessionName, bool bWasSuccessful)
{
	local OnlineSubsystem OnlineSub;
	local string Resolved, Host;
	local int Port, Index;

	OnlineSub = GetOnlineSub();
	OnlineSub.GameInterface.ClearJoinOnlineGameCompleteDelegate(OnSteamJoinComplete);
	`log("Coop steam guest: Steam session" @ SessionName @ "joined=" $ bWasSuccessful, , 'X2TC');
	ClearStockInvite();
	if (!bWasSuccessful)
	{
		bSteamJoinStarted = false;
		ShowGuestMessage("CO-OP: STEAM", "Joining the host's Steam session failed. Ask the host to invite you again.");
		return;
	}
	bSteamGameCreated = true; // joined: destroyed again when leaving
	if (!OnlineSub.GameInterface.GetResolvedConnectString(SessionName, Resolved) || Resolved == "")
	{
		`log("Coop steam guest: no connect string for the host's session", , 'X2TC');
		ShowGuestMessage("CO-OP: STEAM", "Steam gave no address for the host. See Launch.log (X2TC lines).");
		return;
	}
	// Split as the shell does (XComShellPresentationLayer.uc L1142-1159): host[:port][?...].
	Host = Resolved;
	Port = COOP_PORT;
	Index = InStr(Host, ":");
	if (Index != -1)
	{
		Port = int(Mid(Host, Index + 1));
		Host = Left(Host, Index);
	}
	Index = InStr(Host, "?");
	if (Index != -1)
	{
		Host = Left(Host, Index);
	}
	if (Port <= 0)
	{
		Port = COOP_PORT;
	}
	`log("Coop steam guest: host address resolved (form:" @ AddressForm(Host) $ ", length" @ Len(Host) $ ", port" @ Port $ "); connecting with steamsockets", , 'X2TC');
	StartGuestClient(Host, Port, true);
}

// Guest (Stage 7): the game's own invite handler also ran (XComOnlineEventMgr.uc
// L3554-3559): it stored the invite and set the "go to the multiplayer invite screen"
// shuttle. Clear both, so the main menu doesn't act on this invite later.
function ClearStockInvite()
{
	local XComOnlineEventMgr OnlineMgr;

	OnlineMgr = `ONLINEEVENTMGR;
	if (OnlineMgr == none)
	{
		return;
	}
	`log("Coop steam guest: clearing the game's stored invite (had invites=" $ OnlineMgr.HasAcceptedInvites() @ "shuttle to invite loadout=" $ OnlineMgr.GetShuttleToMPInviteLoadout() $ ")", , 'X2TC');
	OnlineMgr.ClearAcceptedInvites();
	OnlineMgr.ClearShuttleToScreen();
	OnlineMgr.bAcceptedInviteDuringGameplay = false;
}

// "dotted" (has a dot), "integer" (digits only) or "other". Never the address itself.
static function string AddressForm(string Address)
{
	local int i;
	local string C;
	local bool bDigitsOnly;

	if (InStr(Address, ".") != -1)
	{
		return "dotted";
	}

	bDigitsOnly = (Len(Address) > 0);
	for (i = 0; i < Len(Address); i++)
	{
		C = Mid(Address, i, 1);
		if (C < "0" || C > "9")
		{
			bDigitsOnly = false;
			break;
		}
	}
	return bDigitsOnly ? "integer" : "other";
}

function string RoleName()
{
	switch (Role)
	{
		case eCoopRole_Host: return "host";
		case eCoopRole_Guest: return "guest";
	}
	return "none";
}

function AddDelegates(XComGameStateNetworkManager NetworkMgr)
{
	if (bDelegatesAdded)
	{
		return;
	}
	NetworkMgr.AddReceiveRemoteCommandDelegate(OnRemoteCommand);
	NetworkMgr.AddNotifyAcceptedConnectionDelegate(OnAcceptedConnection);
	NetworkMgr.AddNotifyConnectionClosedDelegate(OnConnectionClosed);
	NetworkMgr.AddReceiveHistoryDelegate(OnReceiveHistory);
	NetworkMgr.AddReceivePartialHistoryDelegate(OnReceivePartialHistory);
	NetworkMgr.AddReceiveGameStateDelegate(OnReceiveGameState); // Stage 8.1
	bDelegatesAdded = true;
}

function StartPoll()
{
	Seconds = 0;
	ConnectAttempts = 0;
	LastAttemptSecond = 0;
	PingsSent = 0;
	LastPingSecond = -PING_RETRY_SECONDS;
	bConnectedLogged = false;
	bPongReceived = false;
	bLastServer = false;
	bLastClient = false;
	LastConnections = -1;

	StartTimer();
}

// Starts the once-a-second poll on the current map. The timer runs on the local player
// controller: WorldInfo is a static actor and refuses timers (Stage 2 Run 1: "SetTimer()
// called on bStatic Actor WorldInfo"). The controller belongs to the current map, so
// the timer ends with it; OnGuestMissionScreen starts it again after a map load.
function StartTimer()
{
	local WorldInfo World;
	local PlayerController TimerOwner;

	World = class'WorldInfo'.static.GetWorldInfo();
	if (World != none)
	{
		TimerOwner = World.GetALocalPlayerController();
	}
	if (TimerOwner == none)
	{
		`log("Coop" @ RoleName() $ ": no local player controller for the poll timer", , 'X2TC');
		return;
	}
	TimerOwner.SetTimer(1.0, true, nameof(Poll), self);
	// Run 6 (0.3.9): the host also checks for new frames five times a second, so a
	// change reaches the guest sooner (Run 5: about 2 s from the guest's order to its
	// screen, up to 1 s of it waiting for this poll).
	TimerOwner.SetTimer(FAST_SEND_SECONDS, true, nameof(FastSend), self);
	`log("Coop" @ RoleName() $ ": poll timer started (fast send every" @ FAST_SEND_SECONDS $ "s)", , 'X2TC');
	Poll();
}

// True if this session's poll timer runs on the current map's local controller.
function bool IsPollRunning()
{
	local PlayerController PC;

	PC = class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController();
	return PC != none && PC.IsTimerActive(nameof(Poll), self);
}

// Timer function (Run 6): the host sends new frames to a following guest without
// waiting for the one-second poll; the in-flight and latent checks still apply.
function FastSend()
{
	if (Role == eCoopRole_Host && PendingOwnerUnitIDs.Length > 0)
	{
		HostApplyPendingOwners();
	}
	if (Role == eCoopRole_Host && bGuestFollowing)
	{
		HostMaybeSendPartial(`XCOMNETMANAGER);
		HostTurnUI();
	}
	else if (Role == eCoopRole_Guest && bFollowerInstalled)
	{
		GuestTurnUI();
	}
}

// Host (Stage 6), five times a second: reset "ready" when the turn changes, keep the
// End Turn icon disabled only while the host should be asked first, show the status
// line, hide the banner when the guest's action is done, and keep the host's selection
// off the guest's soldiers.
function HostTurnUI()
{
	local ETeam TurnTeam;

	// 0.5.3: after the battle the game owns the screen and input; nothing more here.
	if (bMissionEnded)
	{
		return;
	}
	TurnTeam = CurrentTurnTeam();
	if (TurnTeam != LastTurnTeam)
	{
		LastTurnTeam = TurnTeam;
		if (TurnTeam == eTeam_XCom)
		{
			class'X2TC_CoopOwnership'.static.LogSquadState("XCOM turn starts");
		}
		if (bGuestReady)
		{
			bGuestReady = false;
			`log("Coop turn: new turn (team" @ int(TurnTeam) $ "); the partner's \"ready\" is cleared", , 'X2TC');
		}
		class'X2TC_CoopTurnUI'.static.SetStatusText("");
	}

	// Only touch the icon to disable it, and to put back what we disabled; the game keeps
	// managing it otherwise.
	if (HostShouldAskBeforeEndTurn())
	{
		if (class'X2TC_CoopTurnUI'.static.SetEndTurnIconEnabled(false))
		{
			bEndTurnIconDisabled = true;
		}
	}
	else if (bEndTurnIconDisabled)
	{
		bEndTurnIconDisabled = false;
		class'X2TC_CoopTurnUI'.static.SetEndTurnIconEnabled(true);
	}
	MaybeHideBanner();
	if (TurnTeam == eTeam_XCom)
	{
		if (OwnershipOn())
		{
			KeepHostSelectionOwn();
		}
		else if (bHostLocked)
		{
			UnlockHost("soldier ownership is off");
		}
	}
	UpdateBanner(); // 0.5.2: the locked host's banner comes and goes with the lock
}

// Host: true while ending XCOM's turn should first ask: the guest's soldiers can still
// act and the guest hasn't pressed END TURN this turn (Kc, 2026-11-14).
function bool HostShouldAskBeforeEndTurn()
{
	return OwnershipOn() && CurrentTurnTeam() == eTeam_XCom && !bGuestReady && class'X2TC_CoopOwnership'.static.GuestHasActions();
}

// Host: the game's own "next unit with actions" can select a guest-owned soldier
// (X2TacticalGameRuleset.ActionsAvailable, L4650-4675); move the selection to the host's
// own next soldier with actions.
function KeepHostSelectionOwn()
{
	local XComTacticalController TacticalController;
	local XComGameState_Unit ActiveUnit, UnitState;

	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (TacticalController == none || class'XComGameStateVisualizationMgr'.static.VisualizerBusy())
	{
		return;
	}
	ActiveUnit = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(TacticalController.GetActiveUnitStateRef().ObjectID));
	if (ActiveUnit == none || class'X2TC_CoopOwnership'.static.GetOwner(ActiveUnit) != class'X2TC_CoopOwnership'.const.OWNER_GUEST)
	{
		if (bHostLocked)
		{
			UnlockHost("a P1 soldier is selected");
		}
		return;
	}
	foreach `XCOMHISTORY.IterateByClassType(class'XComGameState_Unit', UnitState)
	{
		if (class'X2TC_CoopOwnership'.static.IsOwnableSoldier(UnitState)
			&& class'X2TC_CoopOwnership'.static.GetOwner(UnitState) == class'X2TC_CoopOwnership'.const.OWNER_HOST
			&& class'X2TC_CoopOwnership'.static.UnitCanAct(UnitState) && TacticalController.Visualizer_SelectUnit(UnitState))
		{
			if (LastHostSkippedUnitID != ActiveUnit.ObjectID)
			{
				LastHostSkippedUnitID = ActiveUnit.ObjectID;
				`log("Coop owners: host selection moved off P2's unit" @ ActiveUnit.ObjectID @ "to P1's unit" @ UnitState.ObjectID, , 'X2TC');
			}
			return;
		}
	}
	// Run 1: none of the host's soldiers can act and the game selected one of P2's; the
	// host could then act with it. Lock the host's input the way stock multiplayer locks
	// the inactive player (XComTacticalInput.uc L1347-1424, Multiplayer_Inactive: the
	// camera still scrolls) until one of its own soldiers is selected again.
	if (!bHostLocked)
	{
		bHostLocked = true;
		TacticalController.SetInputState('Multiplayer_Inactive');
		`log("Coop owners: host input locked (only P2's soldiers can act; unit" @ ActiveUnit.ObjectID @ "selected; input state" @ TacticalController.GetInputState() $ ")", , 'X2TC');
		class'X2TC_CoopOwnership'.static.LogSquadState("host locked");
		class'X2TC_CoopTurnUI'.static.SetStatusText("Your soldiers are done; your partner's turn");
	}
	else if (TacticalController.GetInputState() != 'Multiplayer_Inactive')
	{
		// The game set another input state (e.g. after selecting the next unit itself).
		`log("Coop owners: host input state was" @ TacticalController.GetInputState() $ "; locked again", , 'X2TC');
		TacticalController.SetInputState('Multiplayer_Inactive');
	}
}

// Host (0.5.3): true while Tab and H are the co-op cycling keys on the host.
function bool HostOwnsCycleKeys()
{
	return Role == eCoopRole_Host && bGuestFollowing && !bMissionEnded && OwnershipOn()
		&& !bHostLocked && CurrentTurnTeam() == eTeam_XCom;
}

// Host (0.5.3): Tab (Direction 1) and H (-1) cycle only through the host's own soldiers
// that can act (Run 2: the game's own Tab landed on the partner's, then was pushed
// back). True if the key belongs to us now (ownership on, XCOM's turn, not locked).
function bool HostCycleOwnSoldier(int Direction)
{
	local XComTacticalController TacticalController;
	local array<XComGameState_Unit> Squad, Own;
	local int i, Start, Index, ActiveID;

	if (!HostOwnsCycleKeys())
	{
		return false;
	}
	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (TacticalController == none)
	{
		return false;
	}
	class'X2TC_CoopOwnership'.static.GetSquad(Squad);
	for (i = 0; i < Squad.Length; i++)
	{
		if (class'X2TC_CoopOwnership'.static.UnitCanAct(Squad[i])
			&& class'X2TC_CoopOwnership'.static.GetOwner(Squad[i]) == class'X2TC_CoopOwnership'.const.OWNER_HOST)
		{
			Own.AddItem(Squad[i]);
		}
	}
	if (Own.Length == 0)
	{
		return true; // nothing of the host's can act; keep the key from the game
	}
	ActiveID = TacticalController.GetActiveUnitStateRef().ObjectID;
	Start = 0;
	for (i = 0; i < Own.Length; i++)
	{
		if (Own[i].ObjectID == ActiveID)
		{
			Start = i + Direction;
			break;
		}
	}
	for (i = 0; i < Own.Length; i++)
	{
		Index = ((Start + i * Direction) % Own.Length + Own.Length) % Own.Length;
		if (TacticalController.Visualizer_SelectUnit(Own[Index]))
		{
			`log("Coop owners: host cycled to its unit" @ Own[Index].ObjectID @ "(direction" @ Direction $ ")", , 'X2TC');
			return true;
		}
	}
	return true;
}

// Host (0.5.1): give the input back (only during XCOM's turn; at other times the game
// sets the input state itself at the next turn).
function UnlockHost(string Why)
{
	local XComTacticalController TacticalController;

	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (TacticalController == none)
	{
		return;
	}
	bHostLocked = false;
	if (TacticalController.GetInputState() == 'Multiplayer_Inactive')
	{
		TacticalController.SetInputState('ActiveUnit_Moving');
	}
	`log("Coop owners: host input unlocked (" $ Why $ "; input state" @ TacticalController.GetInputState() $ ")", , 'X2TC');
	class'X2TC_CoopTurnUI'.static.SetStatusText("");
}

// Guest (Stage 6), five times a second: hide the banner when the partner's action is done,
// and show NO SOLDIERS ASSIGNED while the guest has none to control.
function GuestTurnUI()
{
	MaybeHideBanner();
	UpdateBanner();
	// 0.5.3: the refusal message goes after REFUSAL_SECONDS.
	if (RefusalShownTime > 0 && class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds - RefusalShownTime > REFUSAL_SECONDS)
	{
		RefusalShownTime = 0;
		if (bReadySent)
		{
			class'X2TC_CoopTurnUI'.static.SetStatusText("Waiting for the host to end the turn");
		}
		else
		{
			class'X2TC_CoopTurnUI'.static.SetStatusText("");
		}
	}
}

// Guest (0.5.3): the host refused an action; say so in the status line for a few seconds
// (M4 polish item "feedback when an action is refused", pulled in by Kc).
function ShowRefusal(string Reason)
{
	local string Text;

	if (InStr(Reason, "belongs to P1") != -1)
	{
		Text = "Refused: that soldier belongs to the host";
	}
	else if (InStr(Reason, "not XCOM's turn") != -1)
	{
		Text = "Refused: it isn't XCOM's turn";
	}
	else if (InStr(Reason, "busy") != -1 || InStr(Reason, "still waiting") != -1)
	{
		Text = "Refused: the host was busy; try again";
	}
	else
	{
		Text = "Refused by the host:" @ Reason;
	}
	RefusalShownTime = class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds;
	class'X2TC_CoopTurnUI'.static.SetStatusText(Text);
}

// Both: show the FRIENDLY ACTION banner (Kc's design, plans/m3-plan.md Stage 6).
function ShowBanner(string Why)
{
	BannerShownTime = class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds;
	if (!bBannerShown)
	{
		bBannerShown = true;
		`log("Coop UI: FRIENDLY ACTION (" $ Why $ ")", , 'X2TC');
	}
	UpdateBanner();
}

// Both (0.5.1): the one banner on screen. FRIENDLY ACTION first; otherwise, on the guest
// during XCOM's input phase with no soldier it may control, NO SOLDIERS ASSIGNED (Run 1,
// Kc); otherwise none. Changes the overlay only when the wanted text changes.
function UpdateBanner()
{
	local X2TC_CoopReplayMgr Follower;
	local XComTacticalGRI TacticalGRI;
	local string Wanted;

	if (bMissionEnded)
	{
		Wanted = ""; // 0.5.3: no co-op banner after the battle
	}
	else if (bBannerShown)
	{
		Wanted = class'X2TC_CoopTurnUI'.const.FRIENDLY_TEXT;
	}
	else if (Role == eCoopRole_Host && bGuestFollowing && OwnershipOn() && CurrentTurnTeam() == eTeam_XCom
		&& !class'X2TC_CoopOwnership'.static.PlayerHasActions(class'X2TC_CoopOwnership'.const.OWNER_HOST))
	{
		// 0.5.2 (Run 2, Kc): a player out of moves keeps the banner until its soldiers
		// have actions again (a new turn, or e.g. Teamwork).
		Wanted = class'X2TC_CoopTurnUI'.const.FRIENDLY_TEXT;
	}
	else if (Role == eCoopRole_Guest)
	{
		TacticalGRI = XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI);
		if (TacticalGRI != none)
		{
			Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
		}
		if (Follower != none && Follower.bInputPhase && !Follower.bBehind)
		{
			if (!Follower.HasControllableSoldier())
			{
				Wanted = class'X2TC_CoopTurnUI'.const.NO_SOLDIERS_TEXT;
			}
			else if (OwnershipOn() && !class'X2TC_CoopOwnership'.static.PlayerHasActions(class'X2TC_CoopOwnership'.const.OWNER_GUEST))
			{
				// 0.5.2: the guest out of moves, as on the host.
				Wanted = class'X2TC_CoopTurnUI'.const.FRIENDLY_TEXT;
			}
		}
	}
	if (Wanted == ShownBannerText)
	{
		return;
	}
	ShownBannerText = Wanted;
	if (Wanted == "")
	{
		class'X2TC_CoopTurnUI'.static.HideBanner();
	}
	else
	{
		class'X2TC_CoopTurnUI'.static.ShowBanner(Wanted);
	}
}

// Both: hide it once it has shown long enough and nothing is animating (on the guest,
// also once its replay has caught up).
function MaybeHideBanner()
{
	local X2TC_CoopReplayMgr Follower;
	local XComTacticalGRI TacticalGRI;

	if (!bBannerShown)
	{
		return;
	}
	if (class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds - BannerShownTime < BANNER_MIN_SECONDS
		|| class'XComGameStateVisualizationMgr'.static.VisualizerBusy())
	{
		return;
	}
	if (Role == eCoopRole_Guest)
	{
		TacticalGRI = XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI);
		if (TacticalGRI != none)
		{
			Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
		}
		if (Follower != none && Follower.bBehind)
		{
			return;
		}
	}
	bBannerShown = false;
	UpdateBanner();
}

// Host (Stage 6): our END TURN button and Backspace come here. Asks first while the
// guest's soldiers can still act and the guest isn't ready; otherwise ends the turn the
// way the HUD's own icon does (XComTacticalController.PerformEndTurn L1350).
function HostEndTurnRequested(string Source)
{
	local XComPlayerController PC;
	local TDialogueBoxData DialogData;

	PC = XComPlayerController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (PC == none)
	{
		return;
	}
	if (!HostShouldAskBeforeEndTurn())
	{
		`log("Coop turn: host ends XCOM's turn (" $ Source $ ", partner ready=" $ bGuestReady $ ")", , 'X2TC');
		XComTacticalController(PC).PerformEndTurn(ePlayerEndTurnType_PlayerInput);
		return;
	}
	`log("Coop turn: host End Turn (" $ Source $ ") while the partner's soldiers can act; asking", , 'X2TC');
	DialogData.eType = eDialog_Normal;
	DialogData.strTitle = "CO-OP: END TURN?";
	DialogData.strText = "Your partner's soldiers can still act. End the turn anyway?";
	DialogData.strAccept = "End turn";
	DialogData.strCancel = "Cancel";
	DialogData.fnCallback = OnEndTurnDialog;
	PC.Pres.UIRaiseDialog(DialogData);
}

function OnEndTurnDialog(name eAction)
{
	local XComTacticalController TacticalController;

	if (eAction != 'eUIAction_Accept')
	{
		`log("Coop turn: host chose not to end the turn", , 'X2TC');
		return;
	}
	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (TacticalController != none)
	{
		`log("Coop turn: host ends XCOM's turn anyway (the partner's soldiers could still act)", , 'X2TC');
		TacticalController.PerformEndTurn(ePlayerEndTurnType_PlayerInput);
	}
}

// Host (Stage 6): a further guest action clears "ready" (Kc, 2026-11-15).
function ClearGuestReady(string Why)
{
	if (!bGuestReady)
	{
		return;
	}
	bGuestReady = false;
	`log("Coop turn: the partner's \"ready\" is cleared (" $ Why $ ")", , 'X2TC');
	class'X2TC_CoopTurnUI'.static.SetStatusText("");
}

// Guest (Stage 6): its own action clears its "ready" (the host clears its copy when the
// action arrives).
function ClearReadySent()
{
	if (!bReadySent)
	{
		return;
	}
	bReadySent = false;
	`log("Coop turn: guest acted again; no longer ready to end the turn", , 'X2TC');
	class'X2TC_CoopTurnUI'.static.SetStatusText("");
}

// Guest (Stage 6): its END TURN button: tell the host it's ready; it ends nothing.
function GuestEndTurnPressed()
{
	local array<byte> NoParams;

	if (Role != eCoopRole_Guest)
	{
		return;
	}
	if (!GuestCanSignalReady())
	{
		`log("Coop turn: guest END TURN ignored (not XCOM's input phase)", , 'X2TC');
		return;
	}
	NoParams.Length = 0;
	if (bPartnerMayEndTurn)
	{
		// Squad screen setting: the partner ends XCOM's turn itself.
		`XCOMNETMANAGER.SendRemoteCommand(CMD_GUEST_END_TURN, NoParams);
		`log("Coop turn: guest asked the host to end XCOM's turn (Partner may end the turn is on)", , 'X2TC');
		return;
	}
	`XCOMNETMANAGER.SendRemoteCommand(CMD_GUEST_READY, NoParams);
	bReadySent = true;
	`log("Coop turn: guest is ready to end the turn (told the host)", , 'X2TC');
	class'X2TC_CoopTurnUI'.static.SetStatusText("Waiting for the host to end the turn");
}

// Guest (Stage 6): the follower's XCOM input phase began or ended; "ready" is per turn.
function OnGuestInputPhase(bool bBegins)
{
	bReadySent = false;
	class'X2TC_CoopTurnUI'.static.SetStatusText("");
}

// ---- Co-op squad screen (plans/m3-plan.md, approved 2026-11-15) ----

function bool IsHost()
{
	return Role == eCoopRole_Host;
}

// Owners count only while the host's "Soldier ownership" setting is on.
function bool OwnershipOn()
{
	return bOwnershipOn;
}

// The host always edits; the guest only with "Partner may edit".
function bool CanEdit()
{
	return Role == eCoopRole_Host || (Role == eCoopRole_Guest && bPartnerMayEdit);
}

function bool GetSetting(int Index)
{
	switch (Index)
	{
		case SETTING_OWNERSHIP: return bOwnershipOn;
		case SETTING_PARTNER_END_TURN: return bPartnerMayEndTurn;
		case SETTING_PARTNER_EDIT: return bPartnerMayEdit;
		case SETTING_NEW_FRAMES: return bNewFramesSync;
	}
	return false;
}

function string SettingsText()
{
	return "ownership=" $ bOwnershipOn @ "partner may end turn=" $ bPartnerMayEndTurn @ "partner may edit=" $ bPartnerMayEdit @ "new frames sync=" $ bNewFramesSync;
}

// The squad screen's owner change. Host: queued and applied when idle. Guest: sent to the
// host when it may edit.
function RequestOwner(int UnitID, int Owner, string Who)
{
	local array<byte> Params;

	if (Role == eCoopRole_Guest)
	{
		if (!bPartnerMayEdit)
		{
			return;
		}
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(UnitID, Params);
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Owner, Params);
		`XCOMNETMANAGER.SendRemoteCommand(CMD_SET_OWNER, Params);
		`log("Coop owners: asked the host to give unit" @ UnitID @ "to" @ class'X2TC_CoopOwnership'.static.OwnerText(Owner), , 'X2TC');
		return;
	}
	if (Role != eCoopRole_Host)
	{
		return;
	}
	`log("Coop owners: change requested by" @ Who $ ": unit" @ UnitID @ "->" @ class'X2TC_CoopOwnership'.static.OwnerText(Owner), , 'X2TC');
	PendingOwnerUnitIDs.AddItem(UnitID);
	PendingOwnerValues.AddItem(Owner);
	HostApplyPendingOwners();
}

// Host: soldiers remembered as the partner's in earlier missions of this campaign go back
// to the partner (Kc, 2026-11-15). Everyone else stays the host's.
function HostRecallOwners()
{
	local array<XComGameState_Unit> Squad;
	local int i, Remembered;

	class'X2TC_CoopOwnerMemory'.static.LogSummary();
	class'X2TC_CoopOwnership'.static.GetSquad(Squad);
	for (i = 0; i < Squad.Length; i++)
	{
		Remembered = class'X2TC_CoopOwnerMemory'.static.Recall(Squad[i].ObjectID);
		if (Remembered == class'X2TC_CoopOwnership'.const.OWNER_GUEST
			&& class'X2TC_CoopOwnership'.static.GetOwner(Squad[i]) != Remembered)
		{
			RequestOwner(Squad[i].ObjectID, Remembered, "memory");
		}
	}
}

// Host: applies queued owner changes once nothing is building or animating (approved
// question 2: owners may change mid-turn, only while nothing acts).
function HostApplyPendingOwners()
{
	local X2TacticalGameRuleset Rules;

	Rules = `TACTICALRULES;
	if (Rules == none || Rules.BuildingLatentGameState || class'XComGameStateVisualizationMgr'.static.VisualizerBusy())
	{
		return;
	}
	while (PendingOwnerUnitIDs.Length > 0)
	{
		if (class'X2TC_CoopOwnership'.static.SetOwner(PendingOwnerUnitIDs[0], PendingOwnerValues[0]))
		{
			// Kept for later missions of this campaign, outside the save.
			class'X2TC_CoopOwnerMemory'.static.Remember(PendingOwnerUnitIDs[0], PendingOwnerValues[0]);
		}
		PendingOwnerUnitIDs.Remove(0, 1);
		PendingOwnerValues.Remove(0, 1);
	}
	RefreshSquadScreen();
	if (bGuestFollowing)
	{
		HostMaybeSendPartial(`XCOMNETMANAGER);
	}
}

// The squad screen's checkbox change. Host: applied and sent. Guest: sent to the host
// when it may edit.
function RequestSetting(int Index, bool bValue, string Who)
{
	local array<byte> Params;

	if (Role == eCoopRole_Guest)
	{
		if (!bPartnerMayEdit)
		{
			return;
		}
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Index, Params);
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(bValue ? 1 : 0, Params);
		`XCOMNETMANAGER.SendRemoteCommand(CMD_SET_SETTING, Params);
		`log("Coop settings: asked the host to set" @ Index @ "to" @ bValue, , 'X2TC');
		return;
	}
	if (Role != eCoopRole_Host)
	{
		return;
	}
	if (Who == "partner" && (Index == SETTING_PARTNER_EDIT || Index == SETTING_NEW_FRAMES))
	{
		`log("Coop settings: refused: only the host changes setting" @ Index, , 'X2TC');
		SendSettings();
		return;
	}
	if (Index == SETTING_NEW_FRAMES && bGuestFollowing)
	{
		// Stage 8.1: switching mid-mission would leave the partial history's delta
		// baseline (XComGameStateNetworkManager.uc L74) behind the guest's history.
		`log("Coop settings: refused: SYNC: NEW FRAMES can only change before the partner joins", , 'X2TC');
		RefreshSquadScreen();
		return;
	}
	switch (Index)
	{
		case SETTING_OWNERSHIP: bOwnershipOn = bValue; break;
		case SETTING_PARTNER_END_TURN: bPartnerMayEndTurn = bValue; break;
		case SETTING_PARTNER_EDIT: bPartnerMayEdit = bValue; break;
		case SETTING_NEW_FRAMES: bNewFramesSync = bValue; break;
		default: return;
	}
	`log("Coop settings: changed by" @ Who $ ":" @ SettingsText(), , 'X2TC');
	SendSettings();
	RefreshSquadScreen();
}

// Host: the settings to the guest (when it follows; after each change).
function SendSettings()
{
	local array<byte> Params;

	if (Role != eCoopRole_Host || !bGuestFollowing)
	{
		return;
	}
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(bOwnershipOn ? 1 : 0, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(bPartnerMayEndTurn ? 1 : 0, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(bPartnerMayEdit ? 1 : 0, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(bNewFramesSync ? 1 : 0, Params);
	`XCOMNETMANAGER.SendRemoteCommand(CMD_SETTINGS, Params);
	`log("Coop settings: sent to the partner:" @ SettingsText(), , 'X2TC');
}

// Host: the guest's END TURN with "Partner may end the turn" on (no question).
function HostEndTurnForPartner()
{
	local XComTacticalController TacticalController;

	if (!bPartnerMayEndTurn || CurrentTurnTeam() != eTeam_XCom)
	{
		`log("Coop turn: the partner's End Turn refused (allowed=" $ bPartnerMayEndTurn $ "," @ CurrentTurnText() $ ")", , 'X2TC');
		return;
	}
	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (TacticalController != none)
	{
		`log("Coop turn: the partner ends XCOM's turn", , 'X2TC');
		TacticalController.PerformEndTurn(ePlayerEndTurnType_PlayerInput);
	}
}

// Both: redraw an open squad screen (owners or settings changed).
function RefreshSquadScreen()
{
	local X2TC_CoopSquadScreen SquadScreen;

	SquadScreen = class'X2TC_CoopSquadScreen'.static.FindOpen();
	if (SquadScreen != none)
	{
		SquadScreen.RefreshRows();
	}
}

// Guest (Stage 6): its END TURN button only makes sense during its input phase.
function bool GuestCanSignalReady()
{
	local XComTacticalGRI TacticalGRI;
	local X2TC_CoopReplayMgr Follower;

	TacticalGRI = XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI);
	if (TacticalGRI != none)
	{
		Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
	}
	return Follower != none && Follower.bInputPhase;
}

// Timer function, once a second: logs connection state changes; on the guest, retries
// the connection and sends pings until a pong arrives.
function Poll()
{
	local XComGameStateNetworkManager NetworkMgr;
	local bool bServer, bClient, bAttempt;
	local int NumConnections;

	NetworkMgr = `XCOMNETMANAGER;
	if (NetworkMgr == none)
	{
		return;
	}

	LogHitch();

	bServer = NetworkMgr.HasServerConnection();
	bClient = NetworkMgr.HasClientConnection();
	NumConnections = NetworkMgr.Connections.Length;

	if (bServer != bLastServer || bClient != bLastClient || NumConnections != LastConnections)
	{
		bLastServer = bServer;
		bLastClient = bClient;
		LastConnections = NumConnections;
		`log("Coop" @ RoleName() $ ": state server=" $ bServer @ "client=" $ bClient @ "connections=" $ NumConnections @ "at" @ Seconds $ "s", , 'X2TC');
	}

	// Host (Stage 4): log player-turn starts and send new frames to a following guest.
	if (Role == eCoopRole_Host && bGuestFollowing)
	{
		HostScanTurns();
		if (bMovePending)
		{
			TryApplyGuestMove();
		}
		if (bAbilityPending)
		{
			TryApplyGuestAbility();
		}
		HostMaybeSendPartial(NetworkMgr);
	}
	// 0.5.3: close the session once the mission is over (also if the guest left).
	if (Role == eCoopRole_Host && bMissionEnded)
	{
		HostCheckMissionEnd();
	}

	// Guest (Stage 5): the history may only grow through the host's histories. Growth
	// without one would mean an action was applied on the guest itself.
	if (Role == eCoopRole_Guest && bFollowerInstalled && GuestExpectedFrames > 0
		&& `XCOMHISTORY.GetNumGameStates() != GuestExpectedFrames
		&& `XCOMHISTORY.GetNumGameStates() != GuestLastWarnedFrames)
	{
		GuestLastWarnedFrames = `XCOMHISTORY.GetNumGameStates();
		`log("Coop guest: WARNING: history frames=" $ GuestLastWarnedFrames @ "but the host's last history had" @ GuestExpectedFrames $ ": changed on the guest itself", , 'X2TC');
	}

	// After the mission map is open, the guest only logs state changes.
	if (Role == eCoopRole_Guest && !bLoadingMission)
	{
		if (NumConnections == 0)
		{
			// Not connected yet: ask again every few seconds, as the shell does once for
			// Steam clients (XComShellPresentationLayer.uc L1173-1197).
			if (ConnectAttempts < CONNECT_MAX_ATTEMPTS && Seconds - LastAttemptSecond >= CONNECT_RETRY_SECONDS)
			{
				ConnectAttempts++;
				LastAttemptSecond = Seconds;
				bAttempt = NetworkMgr.ForceConnectionAttempt();
				`log("Coop guest: connection attempt" @ ConnectAttempts @ "of" @ CONNECT_MAX_ATTEMPTS $ ", sent=" $ bAttempt, , 'X2TC');
				if (ConnectAttempts == CONNECT_MAX_ATTEMPTS)
				{
					`log("Coop guest: last connection attempt sent; no more retries", , 'X2TC');
				}
			}
		}
		else
		{
			if (!bConnectedLogged)
			{
				bConnectedLogged = true;
				`log("Coop guest: connected (connections=" $ NumConnections @ "at" @ Seconds $ "s)", , 'X2TC');
			}
			if (!bPongReceived && PingsSent < PING_MAX && Seconds - LastPingSecond >= PING_RETRY_SECONDS)
			{
				SendPing(NetworkMgr);
			}
		}
	}

	Seconds++;
}

function SendPing(XComGameStateNetworkManager NetworkMgr)
{
	local array<byte> Params;

	PingsSent++;
	LastPingSecond = Seconds;
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(PingsSent, Params);
	// Run 5 (0.3.8): the mod's version rides along, so a mismatched pair is caught at JOIN.
	class'XComGameStateNetworkManager'.static.AddCommandParam_String(ModVersion(), Params);
	// 0.6.2: this game's mods and DLC by name, sorted (ContentList).
	class'XComGameStateNetworkManager'.static.AddCommandParam_String(ContentList(), Params);
	NetworkMgr.SendRemoteCommand(CMD_PING, Params);
	`log("Coop guest: ping" @ PingsSent @ "sent (version" @ ModVersion() $ ")", , 'X2TC');
}

function OnRemoteCommand(string Command, array<byte> RawParams)
{
	local XComGameStateNetworkManager NetworkMgr;
	local array<byte> Params, Reply;
	local int Number;
	local string OtherVersion, OtherContent, Reason;

	if (Command == CMD_GUEST_MOVE)
	{
		if (Role == eCoopRole_Host)
		{
			ReceiveGuestMove(RawParams);
		}
		return;
	}

	if (Command == CMD_GUEST_ABILITY)
	{
		if (Role == eCoopRole_Host)
		{
			ReceiveGuestAbility(RawParams);
		}
		return;
	}

	if (Command == CMD_SETTINGS)
	{
		if (Role == eCoopRole_Guest)
		{
			Params = RawParams;
			bOwnershipOn = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params) != 0;
			bPartnerMayEndTurn = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params) != 0;
			bPartnerMayEdit = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params) != 0;
			bNewFramesSync = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params) != 0;
			`log("Coop settings: from the host:" @ SettingsText(), , 'X2TC');
			class'X2TC_CoopTurnUI'.static.SetGuestEndTurnLabel(bPartnerMayEndTurn);
			if (bPartnerMayEndTurn && bReadySent)
			{
				ClearReadySent();
			}
			RefreshSquadScreen();
		}
		return;
	}

	if (Command == CMD_SET_OWNER || Command == CMD_SET_SETTING)
	{
		if (Role == eCoopRole_Host)
		{
			Params = RawParams;
			Number = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
			if (!bPartnerMayEdit)
			{
				`log("Coop settings: refused a change from the partner (Partner may edit is off)", , 'X2TC');
				SendSettings(); // puts the guest's screen back
				return;
			}
			if (Command == CMD_SET_OWNER)
			{
				RequestOwner(Number, class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params), "partner");
			}
			else
			{
				RequestSetting(Number, class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params) != 0, "partner");
			}
		}
		return;
	}

	if (Command == CMD_MISSION_END_SHOWN)
	{
		if (Role == eCoopRole_Host && bMissionEnded && MissionEndAckedSecond < 0)
		{
			MissionEndAckedSecond = Seconds;
			`log("Coop mission end (host): the guest shows \"mission over\"; closing in" @ MISSION_END_DISCONNECT_SECONDS $ "s", , 'X2TC');
		}
		return;
	}

	if (Command == CMD_GUEST_END_TURN)
	{
		if (Role == eCoopRole_Host)
		{
			HostEndTurnForPartner();
		}
		return;
	}

	if (Command == CMD_GUEST_READY)
	{
		if (Role == eCoopRole_Host)
		{
			bGuestReady = true;
			`log("Coop turn: the partner is ready to end the turn (" $ CurrentTurnText() $ ")", , 'X2TC');
			class'X2TC_CoopTurnUI'.static.SetStatusText("Partner is ready to end the turn");
		}
		return;
	}

	if (Command == CMD_MOVE_RESULT)
	{
		Params = RawParams;
		Number = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		Reason = class'XComGameStateNetworkManager'.static.GetCommandParam_String(Params);
		`log("Coop" @ RoleName() $ ": action result from the host:" @ (Number == 1 ? "applied" : "refused") $ "," @ Reason @ "(frames=" $ `XCOMHISTORY.GetNumGameStates() $ ")", , 'X2TC');
		if (Role == eCoopRole_Guest && Number != 1)
		{
			ShowRefusal(Reason);
		}
		ClearGuestUnitMoving();
		return;
	}

	if (Command == CMD_FOLLOWING)
	{
		Params = RawParams;
		Number = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		`log("Coop" @ RoleName() $ ": guest is following (its replay started at frame" @ Number $ ")", , 'X2TC');
		if (Role == eCoopRole_Host && !bGuestFollowing)
		{
			bGuestFollowing = true;
			// Log the turn starts the guest will replay from the start state, to pair them.
			HostTurnScanFrame = Number - 1;
			HostScanTurns();
			// Stage 6 (squad screen): owners are the host's until changed; log them once,
			// and give the guest the settings.
			if (!bOwnersAssigned)
			{
				bOwnersAssigned = true;
				class'X2TC_CoopOwnership'.static.LogOwners();
			}
			SendSettings();
		}
		return;
	}

	if (Command == CMD_HISTORY_RECEIVED)
	{
		Params = RawParams;
		Number = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		if (Role == eCoopRole_Host)
		{
			// Stage 8.1: with new-frames sync the guest answers each frame; the batch is
			// done when the guest has all of it.
			if (bNewFramesSync && Number < PartialSentFrames)
			{
				return;
			}
			`log("Coop host:" @ (bNewFramesSync ? "new frames" : "partial history") @ PartialSends @ "acknowledged after" @ (Seconds - PartialSentSecond) $ "s; guest frames=" $ Number @ "sent frames=" $ PartialSentFrames @ "match=" $ (Number == PartialSentFrames), , 'X2TC');
			bPartialInFlight = false;
		}
		return;
	}

	if (Command == CMD_REQUEST_HISTORY)
	{
		`log("Coop" @ RoleName() $ ": history request received", , 'X2TC');
		if (Role == eCoopRole_Host)
		{
			SendHistoryToGuest();
		}
		return;
	}

	if (Command != CMD_PING && Command != CMD_PONG)
	{
		return;
	}

	Params = RawParams;
	Number = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);

	// Both carry the sender's mod version after the number (empty from builds before 0.3.8),
	// and from 0.6.2 its mods and DLC by name.
	OtherVersion = class'XComGameStateNetworkManager'.static.GetCommandParam_String(Params);
	OtherContent = class'XComGameStateNetworkManager'.static.GetCommandParam_String(Params);

	if (Command == CMD_PING)
	{
		NetworkMgr = `XCOMNETMANAGER;
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Number, Reply);
		class'XComGameStateNetworkManager'.static.AddCommandParam_String(ModVersion(), Reply);
		class'XComGameStateNetworkManager'.static.AddCommandParam_String(ContentList(), Reply);
		NetworkMgr.SendRemoteCommand(CMD_PONG, Reply);
		bVersionMismatch = (OtherVersion != ModVersion());
		bContentMismatch = (OtherContent != ContentList());
		`log("Coop" @ RoleName() $ ": ping" @ Number @ "received (guest version" @ OtherVersion $ ", mine" @ ModVersion() $ "), pong sent", , 'X2TC');
		if (bVersionMismatch)
		{
			`log("Coop host: VERSION MISMATCH: the guest runs" @ OtherVersion @ "and this PC" @ ModVersion() $ "; the history will not be sent", , 'X2TC');
		}
		else if (bContentMismatch)
		{
			`log("Coop host: CONTENT MISMATCH (mods or DLC by name):" @ ContentDifference(ContentList(), OtherContent, "host", "guest") $ "; the history will not be sent", , 'X2TC');
		}
		else
		{
			`log("Coop host: mods and DLC match the guest's (by name, any order):" @ ContentList(), , 'X2TC');
		}
	}
	else
	{
		if (!bPongReceived)
		{
			bPongReceived = true;
			`log("Coop" @ RoleName() $ ": pong" @ Number @ "received (at" @ Seconds $ "s; host version" @ OtherVersion $ ", mine" @ ModVersion() $ ")", , 'X2TC');
			if (Role == eCoopRole_Guest)
			{
				if (OtherVersion != ModVersion())
				{
					bVersionMismatch = true;
					`log("Coop guest: VERSION MISMATCH: the host runs" @ OtherVersion @ "and this PC" @ ModVersion() $ "; not joining", , 'X2TC');
					ShowGuestMessage("CO-OP: VERSION MISMATCH", "This PC runs X2TacticalCoop" @ ModVersion() @ "and the host runs" @ OtherVersion $ ". Install the same build on both and join again.");
				}
				else if (OtherContent != ContentList())
				{
					// 0.6.2: the same mods and DLC are needed (by name; order doesn't matter).
					bContentMismatch = true;
					`log("Coop guest: CONTENT MISMATCH (mods or DLC by name):" @ ContentDifference(OtherContent, ContentList(), "host", "guest") $ "; not joining", , 'X2TC');
					ShowGuestMessage("CO-OP: DIFFERENT MODS OR DLC", "Both games need the same mods and DLC (the order doesn't matter). " $ ContentDifference(OtherContent, ContentList(), "Host", "This PC") $ ".");
				}
				else
				{
					`log("Coop guest: mods and DLC match the host's (by name, any order)", , 'X2TC');
					RequestHistory();
				}
			}
		}
	}
}

// 0.6.2: this game's installed mods and DLC by name, sorted so the load order doesn't
// matter: "mod:A,mod:B,dlc:C,...". The same lists the game hashes for its own checks
// (Helpers.GetInstalledModNames / GetInstalledDLCNames L103-104), not hashed.
static function string ContentList()
{
	local array<string> Items, Names;
	local int i;

	Names = class'Helpers'.static.GetInstalledModNames();
	for (i = 0; i < Names.Length; i++)
	{
		Items.AddItem("mod:" $ Names[i]);
	}
	Names = class'Helpers'.static.GetInstalledDLCNames();
	for (i = 0; i < Names.Length; i++)
	{
		Items.AddItem("dlc:" $ Names[i]);
	}
	SortStrings(Items);
	return JoinStrings(Items, ",");
}

static function SortStrings(out array<string> Items)
{
	local int i, j;
	local string Swap;

	for (i = 0; i < Items.Length; i++)
	{
		for (j = i + 1; j < Items.Length; j++)
		{
			if (Caps(Items[j]) < Caps(Items[i]))
			{
				Swap = Items[i];
				Items[i] = Items[j];
				Items[j] = Swap;
			}
		}
	}
}

static function string JoinStrings(array<string> Items, string Separator)
{
	local string Text;
	local int i;

	for (i = 0; i < Items.Length; i++)
	{
		if (i > 0)
		{
			Text $= Separator;
		}
		Text $= Items[i];
	}
	return Text;
}

// 0.6.2: what one list has and the other doesn't, e.g. "Host only: mod:X; This PC only:
// dlc:Y" (names of mods and DLC, not personal data).
static function string ContentDifference(string ListA, string ListB, string NameA, string NameB)
{
	local array<string> A, B, OnlyA, OnlyB;
	local int i;
	local string Text;

	ParseStringIntoArray(ListA, A, ",", true);
	ParseStringIntoArray(ListB, B, ",", true);
	for (i = 0; i < A.Length; i++)
	{
		if (B.Find(A[i]) == INDEX_NONE)
		{
			OnlyA.AddItem(A[i]);
		}
	}
	for (i = 0; i < B.Length; i++)
	{
		if (A.Find(B[i]) == INDEX_NONE)
		{
			OnlyB.AddItem(B[i]);
		}
	}
	if (OnlyA.Length > 0)
	{
		Text = NameA @ "only:" @ JoinStrings(OnlyA, ", ");
	}
	if (OnlyB.Length > 0)
	{
		if (Text != "")
		{
			Text $= "; ";
		}
		Text $= NameB @ "only:" @ JoinStrings(OnlyB, ", ");
	}
	if (Text == "")
	{
		Text = "the lists differ (empty list from an older build?)";
	}
	return Text;
}

// The mod's version (X2DownloadableContentInfo_X2TacticalCoop.X2TC_VERSION).
static function string ModVersion()
{
	return class'X2DownloadableContentInfo_X2TacticalCoop'.const.X2TC_VERSION;
}

// Guest: a message box on the current screen (UIRaiseDialog, XComPresentationLayerBase.uc
// L1443; TDialogueBoxData, UIDialogueBox.uc L24-38).
function ShowGuestMessage(string Title, string Text)
{
	local XComPlayerController PC;
	local TDialogueBoxData DialogData;

	PC = XComPlayerController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (PC == none || PC.Pres == none)
	{
		return;
	}
	DialogData.eType = eDialog_Warning;
	DialogData.strTitle = Title;
	DialogData.strText = Text;
	DialogData.strAccept = "OK";
	PC.Pres.UIRaiseDialog(DialogData);
}

// Guest (0.5.3): a message with one button that takes the guest back to the main menu
// (LeaveAsGuest). Shown once.
function ShowGuestLeaveDialog(string Title, string Text)
{
	local XComPlayerController PC;
	local TDialogueBoxData DialogData;
	local X2TC_CoopSquadScreen SquadScreen;

	if (bMissionDialogShown)
	{
		return;
	}
	bMissionDialogShown = true;
	SquadScreen = class'X2TC_CoopSquadScreen'.static.FindOpen();
	if (SquadScreen != none)
	{
		SquadScreen.CloseScreen();
	}
	PC = XComPlayerController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (PC == none || PC.Pres == none)
	{
		`log("Coop guest: no presentation layer for the dialog; leaving at once", , 'X2TC');
		LeaveAsGuest();
		return;
	}
	DialogData.eType = eDialog_Normal;
	DialogData.strTitle = Title;
	DialogData.strText = Text;
	DialogData.strAccept = "Main menu";
	DialogData.fnCallback = OnGuestLeaveDialog;
	PC.Pres.UIRaiseDialog(DialogData);
	`log("Coop guest: dialog shown:" @ Title, , 'X2TC');
}

function OnGuestLeaveDialog(name eAction)
{
	`log("Coop guest: dialog closed (" $ eAction $ "); leaving for the main menu", , 'X2TC');
	LeaveAsGuest();
}

// Guest (0.5.3): called by the follower when its replay has reached the end-of-battle
// frame and finished showing it. The guest's own ruleset is left alone (the stock
// replay only ends the battle for Challenge Mode, XComReplayMgr.uc L258-265; ending it
// here would run the campaign cleanup on the guest's copy).
function OnGuestMissionEnd(int Frame)
{
	local array<byte> NoParams;

	if (bMissionEnded)
	{
		return;
	}
	bMissionEnded = true;
	MissionEndFrame = Frame;
	`log("Coop mission end (guest): end-of-battle frame" @ Frame $ "," @ MissionResultText() @ "(history frames=" $ `XCOMHISTORY.GetNumGameStates() $ ", connections=" $ `XCOMNETMANAGER.Connections.Length $ ")", , 'X2TC');
	class'X2TC_CoopTurnUI'.static.SetStatusText("");
	if (ShownBannerText != "")
	{
		bBannerShown = false;
		ShownBannerText = "";
		class'X2TC_CoopTurnUI'.static.HideBanner();
	}
	// 0.6.3: tell the host the dialog is up, so it can close the session now.
	NoParams.Length = 0;
	if (`XCOMNETMANAGER.Connections.Length > 0)
	{
		`XCOMNETMANAGER.SendRemoteCommand(CMD_MISSION_END_SHOWN, NoParams);
	}
	ShowGuestLeaveDialog("CO-OP: MISSION OVER", MissionResultText() $ ". The results stay in the host's campaign. This game returns to the main menu.");
}

// Guest (Stage 3): ask the host for its whole history, once.
function RequestHistory()
{
	local array<byte> NoParams;

	if (bHistoryRequested)
	{
		return;
	}
	bHistoryRequested = true;
	NoParams.Length = 0; // assigned before use, as stock code does (X2TacticalMPGameRuleset.uc L343)
	`XCOMNETMANAGER.SendRemoteCommand(CMD_REQUEST_HISTORY, NoParams);
	`log("Coop guest: history requested", , 'X2TC');
}

// Host (Stage 3): send the whole history to the guest, once per session.
function SendHistoryToGuest()
{
	local XComGameStateHistory History;
	local XComGameStateNetworkManager NetworkMgr;
	local int BytesBefore, BunchesBefore, Bytes, Bunches;

	if (bHistorySent)
	{
		`log("Coop host: history already sent; ignoring the request", , 'X2TC');
		return;
	}
	if (bVersionMismatch || bContentMismatch)
	{
		`log("Coop host: history request refused: version or content mismatch (see the ping line)", , 'X2TC');
		return;
	}

	History = `XCOMHISTORY;
	NetworkMgr = `XCOMNETMANAGER;
	bHistorySent = true;
	LastSentFrames = History.GetNumGameStates();
	`log("Coop host: sending history, frames=" $ LastSentFrames @ "plot=" $ GetPlotName(History), , 'X2TC');
	CountOutData(NetworkMgr, BytesBefore, BunchesBefore);
	NetworkMgr.SendHistory(History, `XEVENTMGR);
	CountOutData(NetworkMgr, Bytes, Bunches);
	`log("Coop host: history sent (queued), frames=" $ LastSentFrames $ ", queued bytes=" $ (Bytes - BytesBefore) @ "in" @ (Bunches - BunchesBefore) @ "bunches, data types=" $ QueuedTypes(NetworkMgr, BunchesBefore), , 'X2TC');
}

// Guest (Stage 3): the host's history has arrived (the network manager has already
// loaded it; the lobby treats this call the same way, UIMPShell_Lobby.uc L820-824).
// Open the mission's map from it in the game's replay mode.
function OnReceiveHistory(XComGameStateHistory InHistory, X2EventManager EventManager)
{
	local XComGameStateHistory History;
	local XComGameState_BattleData BattleData;
	local PlayerController PC;
	local string MapCommand;

	History = `XCOMHISTORY;
	`log("Coop" @ RoleName() $ ": history received, frames=" $ History.GetNumGameStates() @ "(delegate's history is the game's:" @ (InHistory == History) $ ")", , 'X2TC');

	if (Role != eCoopRole_Guest)
	{
		return;
	}
	if (bLoadingMission)
	{
		`log("Coop guest: mission already loading; ignoring this history", , 'X2TC');
		return;
	}

	BattleData = XComGameState_BattleData(History.GetSingleGameStateObjectForClass(class'XComGameState_BattleData', true));
	if (BattleData == none || BattleData.m_strMapCommand == "")
	{
		`log("Coop guest: the history has no battle data or map command; not loading", , 'X2TC');
		return;
	}

	PC = class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController();
	if (PC == none)
	{
		`log("Coop guest: no local player controller to open the map", , 'X2TC');
		return;
	}

	bLoadingMission = true;
	GuestExpectedFrames = History.GetNumGameStates();
	MapCommand = BattleData.m_strMapCommand $ "?LoadingSave";
	`log("Coop guest: history received, frames=" $ History.GetNumGameStates() @ "plot=" $ GetPlotName(History) $ "; opening it in replay mode:" @ MapCommand, , 'X2TC');
	// The game's own "replay after load" switch (UIDebugChallengeMode.uc L379-382).
	`ONLINEEVENTMGR.bInitiateReplayAfterLoad = true;
	PC.ConsoleCommand(MapCommand);
}

// Guest (Stage 3): called by X2TC_CoopListener when a tactical screen opens on the
// guest. Logs that the session survived the map load, the replay state and frame, and
// restarts the poll timer once.
function OnGuestMissionScreen(string ScreenName)
{
	local XComTacticalGRI TacticalGRI;
	local XComReplayMgr ReplayMgr;
	local string ReplayText;

	TacticalGRI = XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI);
	ReplayText = "no replay manager";
	if (TacticalGRI != none && TacticalGRI.ReplayMgr != none)
	{
		ReplayMgr = TacticalGRI.ReplayMgr;
		ReplayText = "in replay=" $ ReplayMgr.bInReplay @ "replay frame=" $ ReplayMgr.CurrentHistoryFrame;
	}

	`log("Coop guest:" @ ScreenName @ "opened; session kept (loading mission=" $ bLoadingMission $ ", connections=" $ `XCOMNETMANAGER.Connections.Length $ "), frames=" $ `XCOMHISTORY.GetNumGameStates() $ "," @ ReplayText, , 'X2TC');

	if (bLoadingMission && !bMissionTimerStarted)
	{
		bMissionTimerStarted = true;
		LastConnections = -1;
		StartTimer();
	}

	// Stage 4: replace the stock replay manager before the game starts its replay. The
	// tactical HUD opens before that (Stage 3: HUD at "in replay=False", the replay
	// screen 0.3 s later at "in replay=True").
	if (bLoadingMission && !bFollowerInstalled && TacticalGRI != none)
	{
		InstallFollower(TacticalGRI);
	}
}

// Guest (Stage 4): put X2TC_CoopReplayMgr in place of the stock replay manager.
function InstallFollower(XComTacticalGRI TacticalGRI)
{
	local XComReplayMgr OldMgr;
	local X2TC_CoopReplayMgr NewMgr;
	local string OldName;

	OldMgr = TacticalGRI.ReplayMgr;
	if (OldMgr != none && OldMgr.bInReplay)
	{
		`log("Coop guest: the stock replay already started; follower not installed (stock replay stays)", , 'X2TC');
		bFollowerInstalled = true;
		return;
	}

	NewMgr = TacticalGRI.Spawn(class'X2TC_CoopReplayMgr', TacticalGRI);
	if (NewMgr == none)
	{
		`log("Coop guest: couldn't spawn the follower", , 'X2TC');
		return;
	}

	OldName = "none";
	if (OldMgr != none)
	{
		OldName = string(OldMgr.Class.Name);
	}
	TacticalGRI.ReplayMgr = NewMgr;
	bFollowerInstalled = true;
	if (OldMgr != none)
	{
		OldMgr.Destroy();
	}
	`log("Coop guest: follower installed (replaced" @ OldName $ ")", , 'X2TC');
}

// True if this guest's follower replaced the stock replay manager.
function bool HasFollower()
{
	local XComTacticalGRI TacticalGRI;

	TacticalGRI = XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI);
	return TacticalGRI != none && X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr) != none;
}

// Guest (Stage 4): called by X2TC_CoopReplayMgr when its replay starts.
function OnFollowerStarted(int StartFrame)
{
	local array<byte> Params;

	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(StartFrame, Params);
	`XCOMNETMANAGER.SendRemoteCommand(CMD_FOLLOWING, Params);
	`log("Coop guest: follow mode on (replay from frame" @ StartFrame $ "), told the host", , 'X2TC');
}

// Guest (Stage 4): a partial history from the host has been loaded into the history by
// the network manager; the follower steps to it. Answer with the new frame count, as
// the stock multiplayer guest answers "HistoryReceived" (X2TacticalMPGameRuleset.uc
// L304-313).
function OnReceivePartialHistory(XComGameStateHistory InHistory, X2EventManager EventManager)
{
	local array<byte> Params;
	local int Frames, PreviousFrames;

	Frames = `XCOMHISTORY.GetNumGameStates();
	PreviousFrames = GuestExpectedFrames;
	GuestExpectedFrames = Frames;
	PartialsReceived++;
	`log("Coop" @ RoleName() $ ": partial history" @ PartialsReceived @ "received, frames=" $ Frames, , 'X2TC');
	if (Role != eCoopRole_Guest)
	{
		return;
	}
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Frames, Params);
	`XCOMNETMANAGER.SendRemoteCommand(CMD_HISTORY_RECEIVED, Params);

	// Stage 6: the host's own soldier acted in these frames: show FRIENDLY ACTION.
	if (PreviousFrames > 0 && HasHostSoldierAction(PreviousFrames, Frames - 1))
	{
		ShowBanner("the host's soldier acted, frames" @ PreviousFrames @ "->" @ Frames);
	}
	// Owners may have changed in these frames.
	RefreshSquadScreen();
}

// Guest (Stage 6): true if any frame in FromFrame..ToFrame is an ability (moves are the
// StandardMove ability) used by a P1 soldier during XCOM's turn. Interrupts during the
// aliens' turn (overwatch shots) don't count.
function bool HasHostSoldierAction(int FromFrame, int ToFrame)
{
	local XComGameStateHistory History;
	local XComGameState GameState;
	local XComGameStateContext_Ability AbilityContext;
	local XComGameState_Unit UnitState;
	local int Frame;

	if (CurrentTurnTeam() != eTeam_XCom)
	{
		return false;
	}
	History = `XCOMHISTORY;
	for (Frame = Max(FromFrame, 0); Frame <= ToFrame && Frame < History.GetNumGameStates(); Frame++)
	{
		GameState = History.GetGameStateFromHistory(Frame);
		if (GameState == none)
		{
			continue;
		}
		AbilityContext = XComGameStateContext_Ability(GameState.GetContext());
		if (AbilityContext == none)
		{
			continue;
		}
		UnitState = XComGameState_Unit(History.GetGameStateForObjectID(AbilityContext.InputContext.SourceObject.ObjectID, eReturnType_Reference, Frame));
		if (!class'X2TC_CoopOwnership'.static.IsOwnableSoldier(UnitState))
		{
			continue;
		}
		// Ownership on: P1's soldiers (the host can't act with P2's: it is locked once only
		// they can act, 0.5.1).
		if (OwnershipOn())
		{
			if (class'X2TC_CoopOwnership'.static.GetOwner(UnitState) == class'X2TC_CoopOwnership'.const.OWNER_HOST)
			{
				return true;
			}
		}
		// Ownership off (approved question 1, a guess to test): any soldier, except the
		// one the guest ordered itself in the last few seconds. (The host's banner comes
		// from applying the guest's action, so it needs no rule in either mode.)
		else if (UnitState.ObjectID != LastOwnActionUnitID
			|| class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds - LastOwnActionTime > OWN_ACTION_SECONDS)
		{
			return true;
		}
	}
	return false;
}

// Guest (Stage 8.1): a single frame from the host (SendGameState). Logs whether the game's
// own network code put it into this history at its index; acknowledges with the frame
// count, as for a partial history. Whether the follower then replays it is seen from its
// "replayed to frame" lines. (Plan default 2: if the frame isn't added, the mod does NOT
// add it itself; the run stops there.)
function OnReceiveGameState(XComGameState GameState)
{
	local XComGameStateHistory History;
	local array<byte> Params;
	local int Frames, Index;
	local bool bInPlace;

	History = `XCOMHISTORY;
	Frames = History.GetNumGameStates();
	NewFramesReceived++;
	Index = -1;
	if (GameState != none)
	{
		Index = GameState.HistoryIndex;
	}
	bInPlace = Index >= 0 && Index < Frames && History.GetGameStateFromHistory(Index) == GameState;
	if (!bInPlace)
	{
		NewFramesMisplaced++;
	}
	// Every frame for the first 20, then every 25th, and every misplaced one.
	if (NewFramesReceived <= 20 || NewFramesReceived % 25 == 0 || !bInPlace)
	{
		`log("Coop" @ RoleName() $ ": new frame" @ NewFramesReceived @ "received: its index" @ Index $ ", history frames=" $ Frames $ ", in the history at its index=" $ bInPlace @ "(misplaced so far:" @ NewFramesMisplaced $ ")", , 'X2TC');
	}
	if (Role != eCoopRole_Guest)
	{
		return;
	}
	GuestExpectedFrames = Frames;
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Frames, Params);
	`XCOMNETMANAGER.SendRemoteCommand(CMD_HISTORY_RECEIVED, Params);
	// As for partial histories: the banner for the host's actions, the squad screen.
	if (Frames - 1 >= 0 && HasHostSoldierAction(Frames - 1, Frames - 1))
	{
		ShowBanner("the host's soldier acted, frame" @ (Frames - 1));
	}
	RefreshSquadScreen();
}

// Host (Stage 4): send the new frames if there are any, one send at a time, not while
// the ruleset is building a game state on another thread (the multiplayer ruleset waits
// for the same, X2TacticalMPGameRuleset.uc L1352-1356).
function HostMaybeSendPartial(XComGameStateNetworkManager NetworkMgr)
{
	local X2TacticalGameRuleset Rules;
	local int Frames, BytesBefore, BunchesBefore, Bytes, Bunches, i;

	if (bPartialInFlight)
	{
		if (Seconds - PartialSentSecond >= PARTIAL_ACK_TIMEOUT_SECONDS)
		{
			`log("Coop host: partial history" @ PartialSends @ "not acknowledged after" @ PARTIAL_ACK_TIMEOUT_SECONDS $ "s; sending again when there are new frames", , 'X2TC');
			bPartialInFlight = false;
		}
		return;
	}

	Frames = `XCOMHISTORY.GetNumGameStates();
	if (Frames <= LastSentFrames)
	{
		return;
	}

	Rules = `TACTICALRULES;
	if (Rules != none && Rules.BuildingLatentGameState)
	{
		return;
	}

	CountOutData(NetworkMgr, BytesBefore, BunchesBefore);
	if (bNewFramesSync)
	{
		// Stage 8.1: only the new frames, each with its history index
		// (XComGameStateNetworkManager.SendGameState L338).
		for (i = LastSentFrames; i < Frames; i++)
		{
			NetworkMgr.SendGameState(`XCOMHISTORY.GetGameStateFromHistory(i), i);
		}
	}
	else
	{
		NetworkMgr.SendPartialHistory(`XCOMHISTORY, `XEVENTMGR);
	}
	CountOutData(NetworkMgr, Bytes, Bunches);

	PartialSends++;
	bPartialInFlight = true;
	PartialSentSecond = Seconds;
	PartialSentFrames = Frames;
	`log("Coop host:" @ (bNewFramesSync ? "new frames" : "partial history") @ PartialSends @ "sent, frames" @ LastSentFrames @ "->" @ Frames @ "(+" $ (Frames - LastSentFrames) $ "), during" @ CurrentTurnText() $ ", queued bytes=" $ (Bytes - BytesBefore) @ "in" @ (Bunches - BunchesBefore) @ "bunches, data types=" $ QueuedTypes(NetworkMgr, BunchesBefore), , 'X2TC');
	LastSentFrames = Frames;
}

// Total bytes and bunches waiting in the network manager's outgoing queue. Read before
// and after a send, the difference is that send's size as queued (whether that is the
// size on the wire, compressed or not, isn't known from the script source).
function CountOutData(XComGameStateNetworkManager NetworkMgr, out int Bytes, out int Bunches)
{
	local int i;

	Bytes = 0;
	Bunches = NetworkMgr.OutGameData.Length;
	for (i = 0; i < NetworkMgr.OutGameData.Length; i++)
	{
		Bytes += NetworkMgr.OutGameData[i].GameStateRaw.Length;
	}
}

// The distinct data types of the outgoing bunches from FirstIndex on, as numbers (the
// order of eGameDataType, XComGameStateNetworkManager.uc L23-33: 1 History, 2 GameState,
// 3 MergeGameState, 6 GameStateContext, 7 HistoryDelta), e.g. "7" or "1,7".
function string QueuedTypes(XComGameStateNetworkManager NetworkMgr, int FirstIndex)
{
	local array<int> Seen;
	local string Text;
	local int i, TypeId;

	for (i = Max(FirstIndex, 0); i < NetworkMgr.OutGameData.Length; i++)
	{
		TypeId = int(NetworkMgr.OutGameData[i].GameDataType);
		if (Seen.Find(TypeId) == INDEX_NONE)
		{
			Seen.AddItem(TypeId);
			Text $= (Text == "" ? "" : ",") $ TypeId;
		}
	}
	return Text == "" ? "none" : Text;
}

// "team T turn N" for the player whose turn it is on this machine, or "no player turn".
function string CurrentTurnText()
{
	local X2TacticalGameRuleset Rules;
	local XComGameState_Player PlayerState;

	Rules = `TACTICALRULES;
	if (Rules == none || Rules.CachedUnitActionPlayerRef.ObjectID <= 0)
	{
		return "no player turn";
	}
	PlayerState = XComGameState_Player(`XCOMHISTORY.GetGameStateForObjectID(Rules.CachedUnitActionPlayerRef.ObjectID));
	if (PlayerState == none)
	{
		return "no player turn";
	}
	return "team" @ int(PlayerState.TeamFlag) @ "turn" @ PlayerState.PlayerTurnCount;
}

// Host (Stage 4): log the player-turn starts in frames not checked yet.
function HostScanTurns()
{
	local int LastFrame;

	local int EndFrame;

	LastFrame = `XCOMHISTORY.GetNumGameStates() - 1;
	if (LastFrame > HostTurnScanFrame)
	{
		LogTurnBegins("host", HostTurnScanFrame + 1, LastFrame);
		// 0.5.3: the end of the battle (win, loss or full evac).
		EndFrame = FindGameEndFrame(HostTurnScanFrame + 1, LastFrame);
		if (EndFrame >= 0 && !bMissionEnded)
		{
			bMissionEnded = true;
			MissionEndFrame = EndFrame;
			MissionEndSecond = Seconds;
			MissionEndAckedSecond = -1;
			bMissionEndFrameAcked = false;
			`log("Coop mission end (host): end-of-battle frame" @ EndFrame $ "," @ MissionResultText() $ "; sending it to the guest, then closing the co-op session", , 'X2TC');
		}
		HostTurnScanFrame = LastFrame;
	}
}

// Both (0.5.3): the first end-of-battle frame (eGameRule_TacticalGameEnd, built by
// X2TacticalGameRuleset.EndBattle L282) in FromFrame..ToFrame, or -1.
static function int FindGameEndFrame(int FromFrame, int ToFrame)
{
	local XComGameStateHistory History;
	local XComGameState GameState;
	local XComGameStateContext_TacticalGameRule RuleContext;
	local int Frame;

	History = `XCOMHISTORY;
	for (Frame = Max(FromFrame, 0); Frame <= ToFrame && Frame < History.GetNumGameStates(); Frame++)
	{
		GameState = History.GetGameStateFromHistory(Frame);
		if (GameState == none)
		{
			continue;
		}
		RuleContext = XComGameStateContext_TacticalGameRule(GameState.GetContext());
		if (RuleContext != none && RuleContext.GameRuleType == eGameRule_TacticalGameEnd)
		{
			return Frame;
		}
	}
	return -1;
}

// "XCOM won" / "XCOM lost" from the battle data (bLocalPlayerWon, set when the end
// frame is built, XComGameState_BattleData.uc L161; the host plays XCOM).
static function string MissionResultText()
{
	local XComGameState_BattleData BattleData;

	BattleData = XComGameState_BattleData(`XCOMHISTORY.GetSingleGameStateObjectForClass(class'XComGameState_BattleData', true));
	if (BattleData == none)
	{
		return "result unknown (no battle data)";
	}
	if (BattleData.bLocalPlayerWon)
	{
		return "XCOM won";
	}
	return "XCOM lost";
}

// Host (0.5.3), every poll after the mission ended: once the guest has the end frame,
// wait MISSION_END_DISCONNECT_SECONDS and close the session; give up waiting after
// MISSION_END_MAX_SECONDS.
function HostCheckMissionEnd()
{
	if (!bMissionEnded || Role != eCoopRole_Host)
	{
		return;
	}
	if (!bMissionEndFrameAcked && bGuestFollowing && !bPartialInFlight && LastSentFrames > MissionEndFrame)
	{
		bMissionEndFrameAcked = true;
		`log("Coop mission end (host): the guest has the end frame (sent frames" @ LastSentFrames $ "); waiting for its \"mission over\" dialog (up to" @ MISSION_END_MAX_SECONDS $ "s)", , 'X2TC');
	}
	if (!bGuestFollowing && MissionEndAckedSecond < 0)
	{
		HostEndSession("mission over, the guest already left");
	}
	else if (MissionEndAckedSecond >= 0 && Seconds - MissionEndAckedSecond >= MISSION_END_DISCONNECT_SECONDS)
	{
		HostEndSession("mission over, guest informed");
	}
	else if (Seconds - MissionEndSecond >= MISSION_END_MAX_SECONDS)
	{
		HostEndSession("mission over, no confirmation from the guest after" @ MISSION_END_MAX_SECONDS $ "s (following=" $ bGuestFollowing $ ")");
	}
}

// Host (0.5.3): close the co-op connection and forget the session, so the next mission
// can HOST again. The host's own game goes on (summary screen, campaign).
function HostEndSession(string Why)
{
	local PlayerController PC;

	`log("Coop mission end (host): closing the co-op session (" $ Why $ "); frames=" $ `XCOMHISTORY.GetNumGameStates() @ "partials sent=" $ PartialSends, , 'X2TC');
	PC = class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController();
	if (PC != none)
	{
		// As the guest's LEAVE does: the game's own connection-error handling stays out.
		PC.bIgnoreNetworkMessages = true;
	}
	if (bEndTurnIconDisabled)
	{
		class'X2TC_CoopTurnUI'.static.SetEndTurnIconEnabled(true);
	}
	bHostLocked = false; // no input change: the game owns the input after the battle
	bBannerShown = false;
	if (ShownBannerText != "")
	{
		ShownBannerText = "";
		class'X2TC_CoopTurnUI'.static.HideBanner();
	}
	class'X2TC_CoopTurnUI'.static.SetStatusText("");
	`XCOMNETMANAGER.Disconnect();
	DestroySteamGame("host session closed");
	ResetSession();
	`log("Coop mission end (host): session closed; HOST works again in the next mission", , 'X2TC');
}

// Logs "Coop sync (<who>): turn begin, team T turn count N, frame F" for every
// player-turn start in frames FromFrame..ToFrame. Host and guest log the same lines if
// their histories match.
static function LogTurnBegins(string Who, int FromFrame, int ToFrame)
{
	local XComGameStateHistory History;
	local XComGameState GameState;
	local XComGameStateContext_TacticalGameRule RuleContext;
	local XComGameState_Player PlayerState;
	local int Frame;

	History = `XCOMHISTORY;
	for (Frame = Max(FromFrame, 0); Frame <= ToFrame && Frame < History.GetNumGameStates(); Frame++)
	{
		GameState = History.GetGameStateFromHistory(Frame);
		if (GameState == none)
		{
			continue;
		}
		RuleContext = XComGameStateContext_TacticalGameRule(GameState.GetContext());
		if (RuleContext == none || RuleContext.GameRuleType != eGameRule_PlayerTurnBegin)
		{
			continue;
		}
		PlayerState = XComGameState_Player(History.GetGameStateForObjectID(RuleContext.PlayerRef.ObjectID, eReturnType_Reference, Frame));
		if (PlayerState != none)
		{
			`log("Coop sync (" $ Who $ "): turn begin, team" @ int(PlayerState.TeamFlag) @ "turn count" @ PlayerState.PlayerTurnCount $ ", frame" @ Frame, , 'X2TC');
		}
		else
		{
			`log("Coop sync (" $ Who $ "): turn begin, player object" @ RuleContext.PlayerRef.ObjectID $ ", frame" @ Frame, , 'X2TC');
		}
	}
}

// The mission's plot name from the battle data, or "unknown". (Not personal data.)
static function string GetPlotName(XComGameStateHistory History)
{
	local XComGameState_BattleData BattleData;

	BattleData = XComGameState_BattleData(History.GetSingleGameStateObjectForClass(class'XComGameState_BattleData', true));
	if (BattleData == none || BattleData.MapData.PlotMapName == "")
	{
		return "unknown";
	}
	return BattleData.MapData.PlotMapName;
}

function OnAcceptedConnection(int ConnectionIdx)
{
	`log("Coop" @ RoleName() $ ": connection accepted (connection" @ ConnectionIdx $ ")", , 'X2TC');
}

function OnConnectionClosed(int ConnectionIdx)
{
	local XComTacticalGRI TacticalGRI;
	local X2TC_CoopReplayMgr Follower;

	`log("Coop" @ RoleName() $ ": connection closed (connection" @ ConnectionIdx $ ")", , 'X2TC');
	// 0.5.3: the guest in a mission lost the host (the host quit, crashed or closed the
	// session): tell the player and offer the way back to the main menu.
	if (Role == eCoopRole_Guest && bFollowerInstalled)
	{
		TacticalGRI = XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI);
		if (TacticalGRI != none)
		{
			Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
		}
		if (bMissionEnded)
		{
			`log("Coop mission end (guest): the host closed the session after the mission (expected)", , 'X2TC');
		}
		else if (Follower != none && Follower.MissionEndFrameSeen >= 0)
		{
			// 0.6.3: the replay already passed the end of the battle; "mission over"
			// follows once its last animations finish (CheckMissionEnd).
			`log("Coop mission end (guest): the host closed the session after the end frame; showing \"mission over\" when the replay is done", , 'X2TC');
		}
		else
		{
			`log("Coop guest: WARNING: the host disconnected during the mission (frames=" $ `XCOMHISTORY.GetNumGameStates() $ ")", , 'X2TC');
			ShowGuestLeaveDialog("CO-OP: HOST DISCONNECTED", "The connection to the host was lost. This game returns to the main menu.");
		}
	}
	if (Role == eCoopRole_Host && bGuestFollowing)
	{
		// Stage 5: the guest left; stop sending and play on alone.
		bGuestFollowing = false;
		bPartialInFlight = false;
		bMovePending = false;
		bAbilityPending = false;
		`log("Coop host: the guest is gone; partial history sends stopped, the mission goes on", , 'X2TC');
	}
}

// Both (Stage 5): log a gap between polls longer than HITCH_SECONDS (a freeze or a long
// frame, e.g. while a large history is processed).
function LogHitch()
{
	local WorldInfo World;
	local float Now;

	World = class'WorldInfo'.static.GetWorldInfo();
	if (World == none)
	{
		return;
	}
	Now = World.RealTimeSeconds;
	if (LastPollRealTime > 0 && Now - LastPollRealTime > HITCH_SECONDS)
	{
		`log("Coop" @ RoleName() $ ": hitch, poll gap" @ (Now - LastPollRealTime) $ "s (frames=" $ `XCOMHISTORY.GetNumGameStates() $ ")", , 'X2TC');
	}
	LastPollRealTime = Now;
}

// Guest (Stage 5): send a captured move (unit and path tiles) to the host.
function SendGuestMove(int UnitID, array<TTile> Tiles, int FramesNow)
{
	local array<byte> Params;
	local int i;

	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(UnitID, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Tiles.Length, Params);
	for (i = 0; i < Tiles.Length; i++)
	{
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Tiles[i].X, Params);
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Tiles[i].Y, Params);
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Tiles[i].Z, Params);
	}
	`XCOMNETMANAGER.SendRemoteCommand(CMD_GUEST_MOVE, Params);
	ClearReadySent();
	LastOwnActionUnitID = UnitID;
	LastOwnActionTime = class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds;
	MovesSent++;
	LastGuestMoveUnitID = UnitID;
	`log("Coop guest: captured move" @ MovesSent @ "(unit" @ UnitID $ "," @ Tiles.Length @ "tiles), sent; not applied locally (frames=" $ FramesNow $ ")", , 'X2TC');
}

// Guest (Stage 5 Run 3): the controller marks a unit as moving when it submits a path
// (XComTacticalController.PerformPath L1104-1109) and refuses further orders for it while
// the mark is set (L1098). The guest's own submit is never applied, so clear the mark
// when the host answers; an applied move then plays from the host's frames. The tutorial
// does the same after a refused submission (XComTutorialMgr.ResetUnitIsMoving L590-593).
function ClearGuestUnitMoving()
{
	local XComGameState_Unit UnitState;
	local XGUnit UnitVisualizer;

	if (Role != eCoopRole_Guest || LastGuestMoveUnitID <= 0)
	{
		return;
	}
	UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(LastGuestMoveUnitID));
	if (UnitState != none)
	{
		UnitVisualizer = XGUnit(UnitState.GetVisualizer());
	}
	if (UnitVisualizer != none && UnitVisualizer.m_bIsMoving)
	{
		UnitVisualizer.m_bIsMoving = false;
		`log("Coop guest: cleared the moving mark on unit" @ LastGuestMoveUnitID, , 'X2TC');
	}
}

// Guest (Stage 5b): send a captured ability (template, source, primary target, target
// locations) to the host.
function SendGuestAbility(XComGameStateContext_Ability AbilityContext, int FramesNow)
{
	local array<byte> Params;
	local int i;
	local vector Loc;

	class'XComGameStateNetworkManager'.static.AddCommandParam_String(string(AbilityContext.InputContext.AbilityTemplateName), Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(AbilityContext.InputContext.SourceObject.ObjectID, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(AbilityContext.InputContext.PrimaryTarget.ObjectID, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(AbilityContext.InputContext.TargetLocations.Length, Params);
	for (i = 0; i < AbilityContext.InputContext.TargetLocations.Length; i++)
	{
		Loc = AbilityContext.InputContext.TargetLocations[i];
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Round(Loc.X), Params);
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Round(Loc.Y), Params);
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Round(Loc.Z), Params);
	}
	`XCOMNETMANAGER.SendRemoteCommand(CMD_GUEST_ABILITY, Params);
	ClearReadySent();
	LastOwnActionUnitID = AbilityContext.InputContext.SourceObject.ObjectID;
	LastOwnActionTime = class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds;
	AbilitiesSent++;
	`log("Coop guest: captured ability" @ AbilitiesSent @ AbilityContext.InputContext.AbilityTemplateName @ "(unit" @ AbilityContext.InputContext.SourceObject.ObjectID $ ", target" @ AbilityContext.InputContext.PrimaryTarget.ObjectID $ "," @ AbilityContext.InputContext.TargetLocations.Length @ "locations), sent; not applied locally (frames=" $ FramesNow $ ")", , 'X2TC');
}

// Host (Stage 5b): a guest ability arrived; keep it and try to apply it.
function ReceiveGuestAbility(array<byte> RawParams)
{
	local array<byte> Params;
	local int i, Count;
	local vector Loc;

	if (bAbilityPending)
	{
		SendMoveResult(false, "another guest ability is still waiting");
		return;
	}

	Params = RawParams;
	PendingAbilityName = name(class'XComGameStateNetworkManager'.static.GetCommandParam_String(Params));
	PendingAbilitySourceID = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	PendingAbilityTargetID = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	Count = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	PendingAbilityLocations.Length = 0;
	for (i = 0; i < Count; i++)
	{
		Loc.X = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		Loc.Y = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		Loc.Z = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		PendingAbilityLocations.AddItem(Loc);
	}

	AbilitiesReceived++;
	bAbilityPending = true;
	PendingAbilitySecond = Seconds;
	`log("Coop host: guest ability" @ AbilitiesReceived @ PendingAbilityName @ "received (unit" @ PendingAbilitySourceID $ ", target" @ PendingAbilityTargetID $ "," @ Count @ "locations)", , 'X2TC');
	ClearGuestReady("the partner acted again");
	TryApplyGuestAbility();
}

// Host (Stage 5b): apply the pending guest ability through
// XComGameStateContext_Ability.ActivateAbility (L1334-1373) with the host's own available
// action for it (X2TacticalGameRuleset.GetGameRulesCache_Unit L545), so the host's state
// and roll decide the result.
function TryApplyGuestAbility()
{
	local X2TacticalGameRuleset Rules;
	local XComGameState_Unit UnitState;
	local StateObjectReference AbilityRef;
	local GameRulesCache_Unit UnitCache;
	local AvailableAction Action;
	local int i, ActionIndex, TargetIndex, FramesBefore;
	local string BusyReason;
	local XComGameState_Ability AbilityState;
	local AvailableTarget AreaTarget;

	Rules = `TACTICALRULES;
	UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(PendingAbilitySourceID));
	if (UnitState == none || UnitState.GetTeam() != eTeam_XCom || UnitState.IsDead())
	{
		RefuseGuestAbility("unit" @ PendingAbilitySourceID @ "is not a living XCOM unit");
		return;
	}
	if (OwnershipOn() && class'X2TC_CoopOwnership'.static.GetOwner(UnitState) != class'X2TC_CoopOwnership'.const.OWNER_GUEST)
	{
		`log("Coop rejected: unit" @ PendingAbilitySourceID @ "is P1's, action from P2", , 'X2TC');
		RefuseGuestAbility("unit" @ PendingAbilitySourceID @ "belongs to P1");
		return;
	}
	if (CurrentTurnTeam() != eTeam_XCom)
	{
		RefuseGuestAbility("not XCOM's turn (" $ CurrentTurnText() $ ")");
		return;
	}

	BusyReason = "";
	if (Rules == none)
	{
		BusyReason = "no tactical ruleset";
	}
	else if (Rules.BuildingLatentGameState)
	{
		BusyReason = "ruleset building a game state";
	}
	else if (class'XComGameStateVisualizationMgr'.static.VisualizerBusy())
	{
		BusyReason = "visualizer busy";
	}
	if (BusyReason != "")
	{
		if (Seconds - PendingAbilitySecond >= MOVE_RETRY_SECONDS)
		{
			RefuseGuestAbility("still busy after" @ MOVE_RETRY_SECONDS $ "s (" $ BusyReason $ ")");
		}
		return;
	}

	AbilityRef = UnitState.FindAbility(PendingAbilityName);
	if (AbilityRef.ObjectID <= 0 || !Rules.GetGameRulesCache_Unit(UnitState.GetReference(), UnitCache))
	{
		RefuseGuestAbility("unit" @ PendingAbilitySourceID @ "has no" @ PendingAbilityName);
		return;
	}
	ActionIndex = -1;
	for (i = 0; i < UnitCache.AvailableActions.Length; i++)
	{
		if (UnitCache.AvailableActions[i].AbilityObjectRef.ObjectID == AbilityRef.ObjectID)
		{
			ActionIndex = i;
			break;
		}
	}
	if (ActionIndex < 0)
	{
		RefuseGuestAbility(PendingAbilityName @ "is not in unit" @ PendingAbilitySourceID $ "'s available actions");
		return;
	}
	Action = UnitCache.AvailableActions[ActionIndex];
	if (Action.AvailableCode != 'AA_Success')
	{
		RefuseGuestAbility(PendingAbilityName @ "not available:" @ Action.AvailableCode);
		return;
	}

	// The guest's primary target among the host's targets; for abilities without one
	// (overwatch, evac, location-targeted), the first entry if there is one.
	TargetIndex = -1;
	if (PendingAbilityTargetID > 0)
	{
		for (i = 0; i < Action.AvailableTargets.Length; i++)
		{
			if (Action.AvailableTargets[i].PrimaryTarget.ObjectID == PendingAbilityTargetID)
			{
				TargetIndex = i;
				break;
			}
		}
		if (TargetIndex < 0)
		{
			RefuseGuestAbility("target" @ PendingAbilityTargetID @ "is not a valid target of" @ PendingAbilityName @ "on the host");
			return;
		}
	}
	else if (Action.AvailableTargets.Length > 0)
	{
		TargetIndex = 0;
	}

	// 0.6.3 (Stage 7 Run 2: the friend's rocket damaged terrain but no unit): for an
	// ability aimed at a location, the units in its area are "additional targets" that the
	// aiming screen works out on the player's machine (XComGameStateContext_Ability.uc
	// L1489-1500 reads them from the action). The host works them out itself from the
	// ability's own area rules (XComGameState_Ability.GatherAdditionalAbilityTargetsForLocation
	// L412-434), so the host's state decides who is hit.
	if (PendingAbilityTargetID <= 0 && PendingAbilityLocations.Length > 0)
	{
		AbilityState = XComGameState_Ability(`XCOMHISTORY.GetGameStateForObjectID(AbilityRef.ObjectID));
		if (AbilityState != none && AbilityState.GetMyTemplate() != none && AbilityState.GetMyTemplate().AbilityMultiTargetStyle != none)
		{
			if (TargetIndex < 0)
			{
				Action.AvailableTargets.Length = 1;
				TargetIndex = 0;
			}
			AreaTarget = Action.AvailableTargets[TargetIndex];
			AreaTarget.AdditionalTargets.Length = 0;
			AbilityState.GatherAdditionalAbilityTargetsForLocation(PendingAbilityLocations[0], AreaTarget);
			Action.AvailableTargets[TargetIndex] = AreaTarget;
			`log("Coop host: guest ability" @ AbilitiesReceived @ PendingAbilityName @ "aimed at a location: the host found" @ AreaTarget.AdditionalTargets.Length @ "units in its area", , 'X2TC');
		}
	}

	FramesBefore = `XCOMHISTORY.GetNumGameStates();
	bAbilityPending = false;
	if (class'XComGameStateContext_Ability'.static.ActivateAbility(Action, TargetIndex, PendingAbilityLocations))
	{
		`log("Coop host: guest ability" @ AbilitiesReceived @ PendingAbilityName @ "applied (unit" @ PendingAbilitySourceID $ ", target index" @ TargetIndex $ ", waited" @ (Seconds - PendingAbilitySecond) $ "s), frames" @ FramesBefore @ "->" @ `XCOMHISTORY.GetNumGameStates(), , 'X2TC');
		SendMoveResult(true, string(PendingAbilityName) @ "unit" @ PendingAbilitySourceID);
		HostMaybeSendPartial(`XCOMNETMANAGER); // Run 6: don't wait for the next poll
		ShowBanner("P2's" @ PendingAbilityName @ "unit" @ PendingAbilitySourceID);
	}
	else
	{
		`log("Coop host: guest ability" @ AbilitiesReceived @ PendingAbilityName @ "not applied: ActivateAbility returned false", , 'X2TC');
		SendMoveResult(false, string(PendingAbilityName) $ ": ActivateAbility returned false");
	}
}

function RefuseGuestAbility(string Reason)
{
	bAbilityPending = false;
	`log("Coop host: guest ability" @ AbilitiesReceived @ PendingAbilityName @ "refused:" @ Reason, , 'X2TC');
	SendMoveResult(false, string(PendingAbilityName) $ ":" @ Reason);
}

// Host (Stage 5): a guest move arrived; keep it and try to apply it.
function ReceiveGuestMove(array<byte> RawParams)
{
	local array<byte> Params;
	local int i, Count;
	local TTile Tile;

	if (bMovePending)
	{
		SendMoveResult(false, "another guest move is still waiting");
		return;
	}

	Params = RawParams;
	PendingMoveUnitID = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	Count = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	PendingMoveTiles.Length = 0;
	for (i = 0; i < Count; i++)
	{
		Tile.X = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		Tile.Y = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		Tile.Z = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		PendingMoveTiles.AddItem(Tile);
	}

	MovesReceived++;
	bMovePending = true;
	PendingMoveSecond = Seconds;
	`log("Coop host: guest move" @ MovesReceived @ "received (unit" @ PendingMoveUnitID $ "," @ Count @ "tiles)", , 'X2TC');
	ClearGuestReady("the partner acted again");
	TryApplyGuestMove();
}

// Host (Stage 5): apply the pending guest move through the controller's own move
// function (XComTacticalController.GameStateMoveUnit L1249-1345, what the host's clicks
// use), if it's XCOM's turn and nothing is busy; waits up to MOVE_RETRY_SECONDS.
function TryApplyGuestMove()
{
	local X2TacticalGameRuleset Rules;
	local XComGameState_Unit UnitState;
	local XComTacticalController TacticalController;
	local XGUnit UnitVisualizer;
	local array<PathingInputData> Paths;
	local PathingInputData Path;
	local string BusyReason;
	local int FramesBefore;
	local TTile Destination;

	Rules = `TACTICALRULES;
	UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(PendingMoveUnitID));

	if (UnitState == none || UnitState.GetTeam() != eTeam_XCom || UnitState.IsDead())
	{
		RefuseGuestMove("unit" @ PendingMoveUnitID @ "is not a living XCOM unit");
		return;
	}
	if (OwnershipOn() && class'X2TC_CoopOwnership'.static.GetOwner(UnitState) != class'X2TC_CoopOwnership'.const.OWNER_GUEST)
	{
		`log("Coop rejected: unit" @ PendingMoveUnitID @ "is P1's, action from P2", , 'X2TC');
		RefuseGuestMove("unit" @ PendingMoveUnitID @ "belongs to P1");
		return;
	}
	if (CurrentTurnTeam() != eTeam_XCom)
	{
		RefuseGuestMove("not XCOM's turn (" $ CurrentTurnText() $ ")");
		return;
	}
	if (PendingMoveTiles.Length == 1)
	{
		// Run 6: a destination only (the guest's MOVE TO CURSOR): the host builds the path
		// with the game's path solver, limited to the unit's range (X2PathSolver.BuildPath
		// L77, as the AI does, X2AIBTDefaultActions.uc L1250).
		Destination = PendingMoveTiles[0];
		PendingMoveTiles.Length = 0;
		if (!class'X2PathSolver'.static.BuildPath(UnitState, UnitState.TileLocation, Destination, PendingMoveTiles, true) || PendingMoveTiles.Length < 2)
		{
			RefuseGuestMove("no path in range to tile" @ class'X2TC_CoopReplayMgr'.static.TileText(Destination));
			return;
		}
		`log("Coop host: built a path of" @ PendingMoveTiles.Length @ "tiles to" @ class'X2TC_CoopReplayMgr'.static.TileText(Destination), , 'X2TC');
	}
	if (PendingMoveTiles.Length < 2)
	{
		RefuseGuestMove("path has fewer than 2 tiles");
		return;
	}

	BusyReason = "";
	if (Rules == none)
	{
		BusyReason = "no tactical ruleset";
	}
	else if (Rules.BuildingLatentGameState)
	{
		BusyReason = "ruleset building a game state";
	}
	else if (class'XComGameStateVisualizationMgr'.static.VisualizerBusy())
	{
		BusyReason = "visualizer busy";
	}
	if (BusyReason != "")
	{
		if (Seconds - PendingMoveSecond >= MOVE_RETRY_SECONDS)
		{
			RefuseGuestMove("still busy after" @ MOVE_RETRY_SECONDS $ "s (" $ BusyReason $ ")");
		}
		return;
	}

	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	UnitVisualizer = XGUnit(UnitState.GetVisualizer());
	if (TacticalController == none || UnitVisualizer == none)
	{
		RefuseGuestMove("no tactical controller or unit visualizer");
		return;
	}

	Path.MovingUnitRef = UnitState.GetReference();
	Path.MovementTiles = PendingMoveTiles;
	Paths.AddItem(Path);

	FramesBefore = `XCOMHISTORY.GetNumGameStates();
	bMovePending = false;
	if (TacticalController.GameStateMoveUnit(UnitVisualizer, Paths))
	{
		`log("Coop host: guest move" @ MovesReceived @ "applied (unit" @ PendingMoveUnitID $ ", waited" @ (Seconds - PendingMoveSecond) $ "s), frames" @ FramesBefore @ "->" @ `XCOMHISTORY.GetNumGameStates(), , 'X2TC');
		SendMoveResult(true, "unit" @ PendingMoveUnitID);
		HostMaybeSendPartial(`XCOMNETMANAGER); // Run 6: don't wait for the next poll
		ShowBanner("P2's move, unit" @ PendingMoveUnitID);
	}
	else
	{
		`log("Coop host: guest move" @ MovesReceived @ "not applied: GameStateMoveUnit returned false", , 'X2TC');
		SendMoveResult(false, "GameStateMoveUnit returned false");
	}
}

function RefuseGuestMove(string Reason)
{
	bMovePending = false;
	`log("Coop host: guest move" @ MovesReceived @ "refused:" @ Reason, , 'X2TC');
	SendMoveResult(false, Reason);
}

function SendMoveResult(bool bApplied, string Detail)
{
	local array<byte> Params;

	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(bApplied ? 1 : 0, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_String(Detail, Params);
	`XCOMNETMANAGER.SendRemoteCommand(CMD_MOVE_RESULT, Params);
}

// The team whose turn it is on this machine, or eTeam_None.
function ETeam CurrentTurnTeam()
{
	local X2TacticalGameRuleset Rules;
	local XComGameState_Player PlayerState;

	Rules = `TACTICALRULES;
	if (Rules == none || Rules.CachedUnitActionPlayerRef.ObjectID <= 0)
	{
		return eTeam_None;
	}
	PlayerState = XComGameState_Player(`XCOMHISTORY.GetGameStateForObjectID(Rules.CachedUnitActionPlayerRef.ObjectID));
	if (PlayerState == none)
	{
		return eTeam_None;
	}
	return PlayerState.TeamFlag;
}

// Guest (Stage 5): leave the co-op mission: ignore the game's own connection-error
// handling (XComGameViewportClient.uc L32, L76), disconnect, forget the session, and open
// the main menu map.
function LeaveAsGuest()
{
	local PlayerController PC;

	`log("Coop guest: LEAVE clicked (frames=" $ `XCOMHISTORY.GetNumGameStates() $ ", moves sent=" $ MovesSent $ ")", , 'X2TC');
	PC = class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController();
	if (PC != none)
	{
		PC.bIgnoreNetworkMessages = true;
	}
	`XCOMNETMANAGER.Disconnect();
	DestroySteamGame("guest left");
	ResetSession();
	`log("Coop guest: disconnected; opening the main menu:" @ LEAVE_MAP_COMMAND, , 'X2TC');
	if (PC != none)
	{
		PC.ConsoleCommand(LEAVE_MAP_COMMAND);
	}
}

// Back to "no session", so JOIN works again. The delegates stay registered.
function ResetSession()
{
	Role = eCoopRole_None;
	bHistoryRequested = false;
	bHistorySent = false;
	bLoadingMission = false;
	bMissionTimerStarted = false;
	bFollowerInstalled = false;
	bGuestFollowing = false;
	bPartialInFlight = false;
	bMovePending = false;
	bPongReceived = false;
	bConnectedLogged = false;
	LastSentFrames = 0;
	PartialsReceived = 0;
	MovesSent = 0;
	LastPollRealTime = 0;
	GuestExpectedFrames = 0;
	GuestLastWarnedFrames = 0;
	bAbilityPending = false;
	AbilitiesSent = 0;
	LastGuestMoveUnitID = 0;
	bVersionMismatch = false;
	bOwnersAssigned = false;
	bGuestReady = false;
	bReadySent = false;
	bBannerShown = false;
	bEndTurnIconDisabled = false;
	// Session-only settings (Kc, 2026-11-15): back to the defaults.
	bOwnershipOn = true;
	bPartnerMayEndTurn = false;
	bPartnerMayEdit = false;
	bNewFramesSync = false;
	NewFramesReceived = 0;
	NewFramesMisplaced = 0;
	PendingOwnerUnitIDs.Length = 0;
	PendingOwnerValues.Length = 0;
	LastOwnActionUnitID = 0;
	// 0.5.1-0.5.3.
	bHostLocked = false;
	ShownBannerText = "";
	RefusalShownTime = 0;
	bMissionEnded = false;
	MissionEndFrame = -1;
	MissionEndAckedSecond = -1;
	bMissionEndFrameAcked = false;
	bMissionDialogShown = false;
	HostTurnScanFrame = 0;
	PartialSends = 0;
	// Stage 7 (DestroySteamGame runs before this where a session existed).
	RestoreStockInviteHandler("session reset");
	bContentMismatch = false;
	bSteamSession = false;
	bSteamGameCreated = false;
	bSteamInviteArmed = false;
	bSteamJoinStarted = false;
}

defaultproperties
{
	Role = eCoopRole_None
	bOwnershipOn = true
}
