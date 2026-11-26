//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_InviteListener
//
//  What it changes: makes an accepted Steam co-op invite join from the main menu, and
//  writes X2TC lines to Launch.log about every accepted invite. This listener registers
//  its own invite callback (the game's own handler, XComOnlineEventMgr.
//  OnGameInviteAccepted, calls StartMPShellState, which loads nothing from the main menu
//  on build 8270065).
//
//  After the guest clicks CO-OP: JOIN (STEAM) (X2TC_CoopSession.ArmSteamInvite), the next
//  accepted invite goes to X2TC_CoopSession.OnSteamInviteAccepted.
//
//  Without that click, a friend could accept the host's invite and land in the stock
//  lobby. So:
//    - Any invite that isn't co-op is left to the game (MULTIPLAYER is Fear's area).
//    - The host's co-op session carries a marker (COOP_INVITE_MARKER as its max squad
//      cost, advertised like the hashes the game's own invite check reads,
//      XComOnlineGameSettings.uc L380, L455). A marked invite accepted on the main menu
//      joins the co-op session directly (X2TC_CoopSession.JoinFromInvite).
//    - On the main menu only, the game's own invite handler is taken off, so it can't
//      refuse a co-op invite over the mods' load order or start its own invite
//      flow; this listener passes every other invite on to it unchanged. It's put back
//      as soon as a screen opens on any other map.
//    Fix switch: "Steam: a co-op invite joins directly". Steam carries the marker into
//    the invite's settings (tested over Steam on build 8270065).
//    Not covered: an invite accepted while the game isn't running starts the game with
//    the invite (XComShellPresentationLayer.uc L119-164) before this listener exists.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreenListener.uc      (OnInit)
//    XComGame\Classes\XComOnlineEventMgr.uc    (OnGameInviteAccepted L3502-3591)
//    Engine\Classes\OnlineEventMgr.uc          (LocalUserIndex L19, GetShuttleToMPInviteLoadout
//                                               L253, HasAcceptedInvites L499)
//    Engine\Classes\OnlineGameInterface.uc     (OnGameInviteAccepted delegate L566,
//                                               Add/ClearGameInviteAcceptedDelegate L574, L581)
//    Engine\Classes\OnlineGameSearch.uc        (OnlineGameSearchResult L28)
//    Engine\Classes\Actor.uc                   (SetTimer with an object L2164,
//                                               GetALocalPlayerController L2463)
//    XComGame\Classes\XComOnlineGameSettings.uc (GetMaxSquadCost L94-99)
//
//  The listener keeps no reference to a screen or another actor, so it can't hold a
//  level in memory across a map change.
//---------------------------------------------------------------------------------------

class X2TC_InviteListener extends UIScreenListener config(X2TacticalCoopFixes);

// The host's co-op session's max squad cost. Stock matches pick theirs from fixed
// lists (thousands of points), never this.
const COOP_INVITE_MARKER = 271828;

// The game's own invite handler is off because of this listener (memory only; a
// config variable so it can be changed at run time and survives map loads; never saved).
var config bool bStockHandlerOff;
var config float LastInviteTime; // the last invite this listener handled (callbacks repeat)

// Registers when a main menu or the multiplayer main menu opens. Registering again
// replaces this object's earlier registration. On the main menu the game's own
// invite handler is taken off; on any screen of another map it's put back.
event OnInit(UIScreen Screen)
{
	if (!IsOnMainMenu())
	{
		SetStockHandler(true, "left the main menu");
	}
	if (UIShell(Screen) == none && UIMPShell_MainMenu(Screen) == none)
	{
		return;
	}

	RegisterForInvites();
	if (UIShell(Screen) != none && class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_INVITE_DIRECT))
	{
		SetStockHandler(false, "main menu");
	}
}

// True on the main menu's map (XComShell; the multiplayer menu's XComMPShell
// extends it, so the exact class name is compared).
static function bool IsOnMainMenu()
{
	local WorldInfo World;

	World = class'WorldInfo'.static.GetWorldInfo();
	return World != none && World.Game != none && World.Game.Class.Name == 'XComShell';
}

// Turns the game's own invite handler on or off (it registers for user 0,
// Engine\Classes\OnlineEventMgr.uc L133). Cleared before adding, so it's never there twice.
static function SetStockHandler(bool bOn, string Why)
{
	local OnlineSubsystem OnlineSub;
	local XComOnlineEventMgr OnlineMgr;

	if (bOn != default.bStockHandlerOff)
	{
		return; // already as wanted (by this listener)
	}
	OnlineSub = class'GameEngine'.static.GetOnlineSubsystem();
	OnlineMgr = `ONLINEEVENTMGR;
	if (OnlineSub == none || OnlineSub.GameInterface == none || OnlineMgr == none)
	{
		return;
	}
	OnlineSub.GameInterface.ClearGameInviteAcceptedDelegate(0, OnlineMgr.OnGameInviteAccepted);
	if (bOn)
	{
		OnlineSub.GameInterface.AddGameInviteAcceptedDelegate(0, OnlineMgr.OnGameInviteAccepted);
	}
	default.bStockHandlerOff = !bOn;
	`log("Invite listener: the game's own invite handler" @ (bOn ? "back on" : "off; this listener passes non-co-op invites to it") @ "(" $ Why $ ")", , 'X2TC');
}

// True if the invite's session carries the co-op marker.
static function bool IsCoopInvite(const out OnlineGameSearchResult InviteResult, out int SquadCost)
{
	local XComOnlineGameSettings Settings;

	SquadCost = -1;
	Settings = XComOnlineGameSettings(InviteResult.GameSettings);
	if (Settings == none)
	{
		return false;
	}
	SquadCost = Settings.GetMaxSquadCost();
	return SquadCost == COOP_INVITE_MARKER;
}

function RegisterForInvites()
{
	local OnlineSubsystem OnlineSub;
	local XComOnlineEventMgr OnlineMgr;
	local byte LocalUserNum;

	OnlineSub = class'GameEngine'.static.GetOnlineSubsystem();
	if (OnlineSub == none || OnlineSub.GameInterface == none)
	{
		`log("Invite listener: no online subsystem, not registered", , 'X2TC');
		return;
	}

	LocalUserNum = 0;
	OnlineMgr = `ONLINEEVENTMGR;
	if (OnlineMgr != none)
	{
		LocalUserNum = byte(OnlineMgr.LocalUserIndex);
	}

	OnlineSub.GameInterface.ClearGameInviteAcceptedDelegate(LocalUserNum, OnInviteAccepted);
	OnlineSub.GameInterface.AddGameInviteAcceptedDelegate(LocalUserNum, OnInviteAccepted);
	`log("Invite listener registered for local user" @ LocalUserNum, , 'X2TC');
}

// Called by the online subsystem when the player accepts an invite. The check runs
// right away. While the game's own handler is on, it gets the invite too; while it's
// off (main menu), this passes on every invite that isn't a co-op one.
function OnInviteAccepted(const out OnlineGameSearchResult InviteResult, bool bWasSuccessful)
{
	local X2TC_CoopSession Session;
	local XComOnlineEventMgr OnlineMgr;
	local WorldInfo World;
	local bool bCoop;
	local int SquadCost;

	`log("Invite accepted callback: success=" $ bWasSuccessful @ "has game settings=" $ (InviteResult.GameSettings != none), , 'X2TC');

	// After CO-OP: JOIN (STEAM), the invite is a co-op invite; the session joins it.
	Session = class'X2TC_CoopSession'.static.FindSession();
	if (Session != none && Session.bSteamInviteArmed)
	{
		`log("Invite: co-op Steam invite (armed); handed to the co-op session", , 'X2TC');
		Session.OnSteamInviteAccepted(InviteResult, bWasSuccessful);
		return;
	}

	// The same invite comes more than once (one callback per registered listener
	// object, and the game's own note at XComOnlineEventMgr.uc L3499); handle it once.
	World = class'WorldInfo'.static.GetWorldInfo();
	if (World != none)
	{
		if (default.LastInviteTime > 0 && World.RealTimeSeconds >= default.LastInviteTime
			&& World.RealTimeSeconds - default.LastInviteTime < 1.0)
		{
			return;
		}
		default.LastInviteTime = World.RealTimeSeconds;
	}

	bCoop = IsCoopInvite(InviteResult, SquadCost);
	`log("Invite: co-op marker=" $ bCoop @ "(squad cost" @ SquadCost $ ") on the main menu=" $ IsOnMainMenu() @ "game's handler off=" $ default.bStockHandlerOff, , 'X2TC');

	// A co-op invite on the main menu joins directly.
	if (bCoop && IsOnMainMenu() && class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_INVITE_DIRECT))
	{
		class'X2TC_CoopSession'.static.GetSession().JoinFromInvite(InviteResult, bWasSuccessful);
		return;
	}

	// Anything else goes to the game's own handler, if this listener took it off.
	if (default.bStockHandlerOff)
	{
		OnlineMgr = `ONLINEEVENTMGR;
		if (OnlineMgr != none)
		{
			`log("Invite: not a co-op invite; passed to the game's own handler", , 'X2TC');
			OnlineMgr.OnGameInviteAccepted(InviteResult, bWasSuccessful);
		}
	}
}

defaultproperties
{
	ScreenClass = none
}
