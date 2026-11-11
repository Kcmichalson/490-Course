//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_InviteListener
//
//  What it changes: makes an accepted Steam invite work from the main menu, and writes
//  X2TC lines to Launch.log about every accepted invite (plans/m2-live-test-plan.md).
//
//  The game's own handler stores the invite and then calls StartMPShellState
//  (XComOnlineEventMgr.OnGameInviteAccepted), which loads nothing from the main menu on
//  build 8270065. This listener registers its own invite callback. Shortly after an
//  invite arrives it checks whether the game kept it; if so, and the player is still on
//  the main menu, it travels to the multiplayer shell with ClientTravel. The multiplayer
//  menu then opens the game's own accept-invite screen (UIMPShell_MainMenu.uc L95).
//  If the game did not keep the invite, it only logs that.
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
//    Engine\Classes\PlayerController.uc        (ClientTravel L504)
//
//  The listener keeps no reference to a screen or another actor, so it can't hold a
//  level in memory across a map change.
//---------------------------------------------------------------------------------------

class X2TC_InviteListener extends UIScreenListener;

// Registers when a main menu or the multiplayer main menu opens. Registering again
// replaces this object's earlier registration.
event OnInit(UIScreen Screen)
{
	if (UIShell(Screen) == none && UIMPShell_MainMenu(Screen) == none)
	{
		return;
	}

	RegisterForInvites();
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

// Called by the online subsystem when the player accepts an invite (the game's own
// handler is called too). The check is delayed so it runs after the game's handler,
// whatever the order of the two callbacks.
function OnInviteAccepted(const out OnlineGameSearchResult InviteResult, bool bWasSuccessful)
{
	local PlayerController LocalPC;

	`log("Invite accepted callback: success=" $ bWasSuccessful @ "has game settings=" $ (InviteResult.GameSettings != none), , 'X2TC');

	LocalPC = GetLocalPC();
	if (LocalPC == none)
	{
		`log("Invite: no local player controller, can't check the invite", , 'X2TC');
		return;
	}

	LocalPC.SetTimer(0.5, false, nameof(CheckInvite), self);
}

// Timer function: runs half a second after an invite callback.
function CheckInvite()
{
	local XComOnlineEventMgr OnlineMgr;
	local PlayerController LocalPC;
	local bool bKept;
	local name GameClassName;

	OnlineMgr = `ONLINEEVENTMGR;
	LocalPC = GetLocalPC();
	if (OnlineMgr == none || LocalPC == none)
	{
		`log("Invite check: no online event manager or no local player controller", , 'X2TC');
		return;
	}

	GameClassName = 'none';
	if (LocalPC.WorldInfo.Game != none)
	{
		GameClassName = LocalPC.WorldInfo.Game.Class.Name;
	}

	bKept = OnlineMgr.HasAcceptedInvites();
	`log("Invite check: kept by the game=" $ bKept @ "shuttle to invite loadout=" $ OnlineMgr.GetShuttleToMPInviteLoadout() @ "game" @ string(GameClassName), , 'X2TC');

	if (!bKept)
	{
		`log("Invite not kept: the game rejected it or already used it. If no join followed, compare both players' MP criteria lines", , 'X2TC');
		return;
	}

	// Only the main menu needs help. XComMPShell (the multiplayer menu) extends XComShell,
	// so compare the exact class name.
	if (GameClassName != 'XComShell')
	{
		`log("Invite: not on the main menu, leaving it to the game", , 'X2TC');
		return;
	}

	`log("Invite: on the main menu, ClientTravel to" @ class'X2TC_MainMenuListener'.const.MPShellURL, , 'X2TC');
	LocalPC.ClientTravel(class'X2TC_MainMenuListener'.const.MPShellURL, TRAVEL_Absolute);
}

function PlayerController GetLocalPC()
{
	local WorldInfo World;

	World = class'WorldInfo'.static.GetWorldInfo();
	if (World == none)
	{
		return none;
	}

	return World.GetALocalPlayerController();
}

defaultproperties
{
	ScreenClass = none
}
