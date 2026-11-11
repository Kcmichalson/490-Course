//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_MatchTraceListener
//
//  What it changes: nothing in the game. Diagnostics only (plans/m2-live-test-plan.md,
//  table rows 8-11). The game's own multiplayer log categories are suppressed, so this
//  writes X2TC lines to Launch.log for the steps of a match:
//    - a multiplayer lobby opens (a lobby that ends in a map change logs no "closed"
//      line: Stage 1e showed OnRemoved is not called then; the LoadMap line marks it)
//    - the lobby's state changes: players in the lobby, opponent joined, network
//      connection, match can start
//    - the tactical HUD opens (the tactical map is up), with the game class
//    - in a multiplayer match, each time the acting player or its turn count changes
//
//  The lobby and the turn are watched with a one-second timer, not with game events,
//  because it is not known which events fire on the guest's machine. So a line can be up
//  to a second late, and a turn's end shows as the next turn's start.
//
//  Each timer logs one "poll timer running" line the first time it fires, and the turn
//  poll logs once why it has no acting player yet. Without them a silent log could mean
//  either "nothing changed" or "the timer never ran" (Stage 1e could not tell which).
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreenListener.uc         (OnInit, OnRemoved)
//    XComGame\Classes\UIMPShell_Lobby.uc          (NetworkMgr L95, bCanStartMatch L100,
//                                                  bOpponentJoined L101, m_kGRI L107)
//    XComGame\Classes\XComGameStateNetworkManager.uc (HasConnections L259)
//    Engine\Classes\GameReplicationInfo.uc        (PRIArray L44)
//    XComGame\Classes\UITacticalHUD.uc            (the tactical screen)
//    XComGame\Classes\X2TacticalGameRuleset.uc    (GetLocalClientPlayerObjectID L112,
//                                                  GetCachedUnitActionPlayerRef L5462)
//    XComGame\Classes\XComGameState_Player.uc     (TeamFlag L15, PlayerTurnCount L31)
//    XComGame\Classes\XComPresentationLayerBase.uc (ScreenStack L30)
//    XComGame\Classes\UIScreenStack.uc            (GetScreen L608)
//    Engine\Classes\Actor.uc                      (SetTimer with an object L2164)
//
//  The listener keeps no reference to a screen or another actor (it looks the lobby up
//  each time), so it can't hold a level in memory across a map change.
//---------------------------------------------------------------------------------------

class X2TC_MatchTraceListener extends UIScreenListener;

// Last logged lobby state, to log only changes.
var int LastLobbyPlayers;
var bool bLastOpponentJoined;
var bool bLastHasConnections;
var bool bLastCanStartMatch;

// Last logged turn, to log only changes.
var int LastTurnPlayerID;
var int LastTurnCount;

// One-time lines: set once the timer has fired, and once the reason for "no acting
// player" has been logged. Reset each time a lobby or a tactical HUD opens.
var bool bLobbyTimerSeen;
var bool bTurnTimerSeen;
var bool bTurnWaitLogged;

event OnInit(UIScreen Screen)
{
	if (UIMPShell_Lobby(Screen) != none)
	{
		`log("Lobby opened", , 'X2TC');
		LastLobbyPlayers = -2;
		bLobbyTimerSeen = false;
		LogLobbyState();
		Screen.SetTimer(1.0, true, nameof(PollLobby), self);
	}
	else if (UITacticalHUD(Screen) != none)
	{
		OnTacticalHUD(Screen);
	}
}

event OnRemoved(UIScreen Screen)
{
	if (UIMPShell_Lobby(Screen) != none)
	{
		Screen.ClearTimer(nameof(PollLobby), self);
		`log("Lobby closed", , 'X2TC');
	}
	else if (UITacticalHUD(Screen) != none)
	{
		Screen.ClearTimer(nameof(PollTurn), self);
		`log("Tactical HUD closed", , 'X2TC');
	}
}

// Timer function: says once that the timer runs, then logs the lobby's state.
function PollLobby()
{
	if (!bLobbyTimerSeen)
	{
		bLobbyTimerSeen = true;
		`log("Lobby poll timer running", , 'X2TC');
	}

	LogLobbyState();
}

// Logs the lobby's state when it changes.
function LogLobbyState()
{
	local UIMPShell_Lobby Lobby;
	local int Players;
	local bool bHasConnections;

	Lobby = UIMPShell_Lobby(FindScreen(class'UIMPShell_Lobby'));
	if (Lobby == none)
	{
		return;
	}

	Players = -1;
	if (Lobby.m_kGRI != none)
	{
		Players = Lobby.m_kGRI.PRIArray.Length;
	}

	bHasConnections = (Lobby.NetworkMgr != none && Lobby.NetworkMgr.HasConnections());

	if (Players == LastLobbyPlayers && Lobby.bOpponentJoined == bLastOpponentJoined
		&& bHasConnections == bLastHasConnections && Lobby.bCanStartMatch == bLastCanStartMatch)
	{
		return;
	}

	LastLobbyPlayers = Players;
	bLastOpponentJoined = Lobby.bOpponentJoined;
	bLastHasConnections = bHasConnections;
	bLastCanStartMatch = Lobby.bCanStartMatch;

	`log("Lobby state: players=" $ Players @ "opponent joined=" $ Lobby.bOpponentJoined @ "connections=" $ bHasConnections @ "can start=" $ Lobby.bCanStartMatch, , 'X2TC');
}

function OnTacticalHUD(UIScreen Screen)
{
	local name GameClassName;
	local bool bMultiplayer;

	GameClassName = 'none';
	if (Screen.WorldInfo.Game != none)
	{
		GameClassName = Screen.WorldInfo.Game.Class.Name;
		bMultiplayer = Screen.WorldInfo.Game.IsA('XComMPTacticalGame');
	}

	`log("Tactical HUD opened, game" @ string(GameClassName) $ ", multiplayer=" $ bMultiplayer, , 'X2TC');

	if (bMultiplayer)
	{
		LastTurnPlayerID = -1;
		LastTurnCount = -1;
		bTurnTimerSeen = false;
		bTurnWaitLogged = false;
		Screen.SetTimer(1.0, true, nameof(PollTurn), self);
	}
}

// Timer function: logs when the acting player or its turn count changes.
function PollTurn()
{
	local X2TacticalGameRuleset Rules;
	local StateObjectReference PlayerRef;
	local XComGameState_Player PlayerState;

	if (!bTurnTimerSeen)
	{
		bTurnTimerSeen = true;
		`log("Turn poll timer running", , 'X2TC');
	}

	Rules = `TACTICALRULES;
	if (Rules == none)
	{
		LogTurnWait("no tactical ruleset");
		return;
	}

	// Outside the ruleset's unit-actions state this returns an empty reference
	// (X2TacticalGameRuleset.uc L5462-5469).
	PlayerRef = Rules.GetCachedUnitActionPlayerRef();
	if (PlayerRef.ObjectID <= 0)
	{
		LogTurnWait("no acting player (object" @ PlayerRef.ObjectID $ ")");
		return;
	}

	PlayerState = XComGameState_Player(`XCOMHISTORY.GetGameStateForObjectID(PlayerRef.ObjectID));
	if (PlayerState == none)
	{
		LogTurnWait("no player state for object" @ PlayerRef.ObjectID);
		return;
	}

	if (PlayerRef.ObjectID == LastTurnPlayerID && PlayerState.PlayerTurnCount == LastTurnCount)
	{
		return;
	}

	LastTurnPlayerID = PlayerRef.ObjectID;
	LastTurnCount = PlayerState.PlayerTurnCount;

	`log("Turn start: player object" @ PlayerRef.ObjectID @ "team" @ int(PlayerState.TeamFlag) @ "turn count" @ PlayerState.PlayerTurnCount @ "local player=" $ (PlayerRef.ObjectID == Rules.GetLocalClientPlayerObjectID()), , 'X2TC');
}

// Logs once per tactical HUD why the turn poll has nothing to report yet.
function LogTurnWait(string Reason)
{
	if (bTurnWaitLogged)
	{
		return;
	}

	bTurnWaitLogged = true;
	`log("Turn poll waiting:" @ Reason, , 'X2TC');
}

// Finds a screen by class on the local player's screen stack, without keeping a reference.
function UIScreen FindScreen(class<UIScreen> WantedClass)
{
	local WorldInfo World;
	local XComPlayerController LocalPC;

	World = class'WorldInfo'.static.GetWorldInfo();
	if (World == none)
	{
		return none;
	}

	LocalPC = XComPlayerController(World.GetALocalPlayerController());
	if (LocalPC == none || LocalPC.Pres == none || LocalPC.Pres.ScreenStack == none)
	{
		return none;
	}

	return LocalPC.Pres.ScreenStack.GetScreen(WantedClass);
}

defaultproperties
{
	ScreenClass = none
}
