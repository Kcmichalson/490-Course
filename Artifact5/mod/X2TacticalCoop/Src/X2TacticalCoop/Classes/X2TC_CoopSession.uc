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
//---------------------------------------------------------------------------------------

class X2TC_CoopSession extends Object;

const COOP_PORT = 7777;

// Remote command names. Other listeners (the game's own) see them too and ignore them.
const CMD_PING = "X2TC_Ping";
const CMD_PONG = "X2TC_Pong";
const CMD_REQUEST_HISTORY = "X2TC_RequestHistory";

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

	if (bHistorySent)
	{
		`log("Coop host: history already sent; ignoring the request", , 'X2TC');
		return;
	}

	History = `XCOMHISTORY;
	bHistorySent = true;
	`log("Coop host: sending history, frames=" $ History.GetNumGameStates() @ "plot=" $ GetPlotName(History), , 'X2TC');
	`XCOMNETMANAGER.SendHistory(History, `XEVENTMGR);
	`log("Coop host: history sent (queued), frames=" $ History.GetNumGameStates(), , 'X2TC');
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
}

defaultproperties
{
	Role = eCoopRole_None
}
