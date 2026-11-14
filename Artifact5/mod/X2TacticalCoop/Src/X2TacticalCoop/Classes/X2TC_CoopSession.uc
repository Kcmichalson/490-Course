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

class X2TC_CoopSession extends Object;

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
const CMD_MOVE_RESULT = "X2TC_MoveResult"; // host: 1 applied / 0 refused, then the reason
const MOVE_RETRY_SECONDS = 10;             // host: how long a move may wait for an idle ruleset
const HITCH_SECONDS = 1.5;                 // both: a poll gap longer than this is logged
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

// Host: create a server on COOP_PORT. Returns false (and logs why) if it couldn't.
function bool StartHost()
{
	local XComGameStateNetworkManager NetworkMgr;
	local URL ServerURL;
	local string Error;

	if (IsActive())
	{
		`log("Coop host: already started as" @ RoleName(), , 'X2TC');
		return false;
	}

	NetworkMgr = `XCOMNETMANAGER;
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

	AddDelegates(NetworkMgr);

	// As the LAN lobby does (UIMPShell_Lobby.uc L502-513): a port and no "steamsockets".
	ServerURL.Port = COOP_PORT;
	NetworkMgr.CreateServer(ServerURL, Error);
	if (Error != "")
	{
		`log("Coop host: server not created, error:" @ Error, , 'X2TC');
		return false;
	}

	Role = eCoopRole_Host;
	`log("Coop host: server created (port" @ COOP_PORT $ ")", , 'X2TC');
	StartPoll();
	return true;
}

// Guest: create a client to the given address. Returns false (and logs why) if it couldn't.
function bool StartGuest(string Address)
{
	local XComGameStateNetworkManager NetworkMgr;
	local URL ClientURL;
	local string Error;

	if (IsActive())
	{
		`log("Coop guest: already started as" @ RoleName(), , 'X2TC');
		return false;
	}

	if (Address == "")
	{
		`log("Coop guest: no address entered", , 'X2TC');
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
	ClientURL.Port = COOP_PORT;
	NetworkMgr.CreateClient(ClientURL, Error);
	if (Error != "")
	{
		`log("Coop guest: client not created (address form:" @ AddressForm(Address) $ "), error:" @ Error, , 'X2TC');
		return false;
	}

	Role = eCoopRole_Guest;
	`log("Coop guest: client created (address form:" @ AddressForm(Address) $ ")", , 'X2TC');
	StartPoll();
	return true;
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
	`log("Coop" @ RoleName() $ ": poll timer started", , 'X2TC');
	Poll();
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
		HostMaybeSendPartial(NetworkMgr);
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
	NetworkMgr.SendRemoteCommand(CMD_PING, Params);
	`log("Coop guest: ping" @ PingsSent @ "sent", , 'X2TC');
}

function OnRemoteCommand(string Command, array<byte> RawParams)
{
	local XComGameStateNetworkManager NetworkMgr;
	local array<byte> Params, Reply;
	local int Number;

	if (Command == CMD_GUEST_MOVE)
	{
		if (Role == eCoopRole_Host)
		{
			ReceiveGuestMove(RawParams);
		}
		return;
	}

	if (Command == CMD_MOVE_RESULT)
	{
		Params = RawParams;
		Number = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		`log("Coop" @ RoleName() $ ": move result from the host:" @ (Number == 1 ? "applied" : "refused") $ "," @ class'XComGameStateNetworkManager'.static.GetCommandParam_String(Params) @ "(frames=" $ `XCOMHISTORY.GetNumGameStates() $ ")", , 'X2TC');
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
		}
		return;
	}

	if (Command == CMD_HISTORY_RECEIVED)
	{
		Params = RawParams;
		Number = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
		if (Role == eCoopRole_Host)
		{
			`log("Coop host: partial history" @ PartialSends @ "acknowledged after" @ (Seconds - PartialSentSecond) $ "s; guest frames=" $ Number @ "sent frames=" $ PartialSentFrames @ "match=" $ (Number == PartialSentFrames), , 'X2TC');
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

	if (Command == CMD_PING)
	{
		NetworkMgr = `XCOMNETMANAGER;
		class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Number, Reply);
		NetworkMgr.SendRemoteCommand(CMD_PONG, Reply);
		`log("Coop" @ RoleName() $ ": ping" @ Number @ "received, pong sent", , 'X2TC');
	}
	else
	{
		if (!bPongReceived)
		{
			bPongReceived = true;
			`log("Coop" @ RoleName() $ ": pong" @ Number @ "received (at" @ Seconds $ "s)", , 'X2TC');
			if (Role == eCoopRole_Guest)
			{
				RequestHistory();
			}
		}
	}
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
	local int Frames;

	Frames = `XCOMHISTORY.GetNumGameStates();
	GuestExpectedFrames = Frames;
	PartialsReceived++;
	`log("Coop" @ RoleName() $ ": partial history" @ PartialsReceived @ "received, frames=" $ Frames, , 'X2TC');
	if (Role != eCoopRole_Guest)
	{
		return;
	}
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Frames, Params);
	`XCOMNETMANAGER.SendRemoteCommand(CMD_HISTORY_RECEIVED, Params);
}

// Host (Stage 4): send the new frames if there are any, one send at a time, not while
// the ruleset is building a game state on another thread (the multiplayer ruleset waits
// for the same, X2TacticalMPGameRuleset.uc L1352-1356).
function HostMaybeSendPartial(XComGameStateNetworkManager NetworkMgr)
{
	local X2TacticalGameRuleset Rules;
	local int Frames, BytesBefore, BunchesBefore, Bytes, Bunches;

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
	NetworkMgr.SendPartialHistory(`XCOMHISTORY, `XEVENTMGR);
	CountOutData(NetworkMgr, Bytes, Bunches);

	PartialSends++;
	bPartialInFlight = true;
	PartialSentSecond = Seconds;
	PartialSentFrames = Frames;
	`log("Coop host: partial history" @ PartialSends @ "sent, frames" @ LastSentFrames @ "->" @ Frames @ "(+" $ (Frames - LastSentFrames) $ "), during" @ CurrentTurnText() $ ", queued bytes=" $ (Bytes - BytesBefore) @ "in" @ (Bunches - BunchesBefore) @ "bunches, data types=" $ QueuedTypes(NetworkMgr, BunchesBefore), , 'X2TC');
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

	LastFrame = `XCOMHISTORY.GetNumGameStates() - 1;
	if (LastFrame > HostTurnScanFrame)
	{
		LogTurnBegins("host", HostTurnScanFrame + 1, LastFrame);
		HostTurnScanFrame = LastFrame;
	}
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
	`log("Coop" @ RoleName() $ ": connection closed (connection" @ ConnectionIdx $ ")", , 'X2TC');
	if (Role == eCoopRole_Host && bGuestFollowing)
	{
		// Stage 5: the guest left; stop sending and play on alone.
		bGuestFollowing = false;
		bPartialInFlight = false;
		bMovePending = false;
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
	MovesSent++;
	`log("Coop guest: captured move" @ MovesSent @ "(unit" @ UnitID $ "," @ Tiles.Length @ "tiles), sent; not applied locally (frames=" $ FramesNow $ ")", , 'X2TC');
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
	`log("Coop host: guest move" @ MovesReceived @ "received (unit" @ PendingMoveUnitID $ "," @ Count @ "tiles); owner check: Stage 6", , 'X2TC');
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

	Rules = `TACTICALRULES;
	UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(PendingMoveUnitID));

	if (UnitState == none || UnitState.GetTeam() != eTeam_XCom || UnitState.IsDead())
	{
		RefuseGuestMove("unit" @ PendingMoveUnitID @ "is not a living XCOM unit");
		return;
	}
	if (CurrentTurnTeam() != eTeam_XCom)
	{
		RefuseGuestMove("not XCOM's turn (" $ CurrentTurnText() $ ")");
		return;
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
}

defaultproperties
{
	Role = eCoopRole_None
}
