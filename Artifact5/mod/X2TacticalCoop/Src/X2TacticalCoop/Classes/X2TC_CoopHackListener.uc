//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopHackListener
//
//  What it changes: in a co-op session only, the hack screen shows only on the machine
//  of the player who owns the hacking soldier. The
//  game opens it on every machine that controls the soldier's team
//  (X2Ability_DefaultAbilitySet.uc L1898-1902), which in co-op is both.
//    - Owner's machine: the screen stays. On the guest it gets a CANCEL HACK button (the
//      screen hides its own Cancel in any replay: CanCancel, UIHackingScreen.uc L159-162).
//      The guest's Hack or Cancel is captured by X2TC_CoopReplayMgr and sent as a choice.
//    - Other machine: the screen stays visible (the player watches) but takes no input.
//      The host plays the guest's choice on its copy (X2TC_CoopSession.HostDriveHack),
//      because the host's FinalizeHack reads the reward option from that screen
//      (L1787-1800).
//    - On the guest, both kinds of screen are held open until the host's result
//      frame has been replayed (X2TC_CoopSession.GuestHoldHack), so the result's visual
//      can merge into the still-running hack action.
//    - The watcher's copy is also locked against clicks (LockWatcherCopy, switch
//      "Hacks: watcher can't click").
//  Outside a co-op session, or with the fix switch off ("Hack screen only for the
//  hacker"), it only logs (in a session) and changes nothing.
//
//  Relies on (paths in Development\SrcOrig; the Community Highlander's copy of
//  UIHackingScreen has the same members):
//    XComGame\Classes\UIHackingScreen.uc  (UnitState L15, CancelHackAbility L14,
//                                          m_SkullJacking/m_SkullMining L23-24,
//                                          OnCancel L326, HackEnded L490,
//                                          m_hackStarted L25, OnMouseEvent L345-365)
//    XComGame\Classes\UIBGBox.uc          (InitBG L18)
//    XComGame\Classes\UIPanel.uc          (ProcessMouseEvents L203, SetAlpha L471)
//    XComGame\Classes\UIScreen.uc         (Hide L184, SetInputState L236)
//    XComGame\Classes\UIButton.uc         (InitButton, AnchorTopRight)
//---------------------------------------------------------------------------------------

class X2TC_CoopHackListener extends UIScreenListener dependson(UIScreen);

var int BlockerClicksLogged; // clicks caught on the watcher's copy, logged (the first few)

event OnInit(UIScreen Screen)
{
	local X2TC_CoopSession Session;
	local UIHackingScreen HackScreen;
	local UIButton CancelButton;
	local int Owner;
	local bool bHost, bMine;

	HackScreen = UIHackingScreen(Screen);
	Session = class'X2TC_CoopSession'.static.FindSession();
	if (HackScreen == none || Session == none || !Session.IsActive())
	{
		return; // not co-op: the game's own hack screen, untouched
	}
	bHost = Session.IsHost();
	Owner = class'X2TC_CoopOwnership'.static.GetOwner(HackScreen.UnitState);
	bMine = bHost ? (Owner != class'X2TC_CoopOwnership'.const.OWNER_GUEST) : (Owner == class'X2TC_CoopOwnership'.const.OWNER_GUEST);
	if (!class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_HACK_ROUTING))
	{
		`log("Coop hack (" $ Session.RoleName() $ "): hack screen opened for unit" @ UnitText(HackScreen) $ "; hack routing is off, left as the game shows it", , 'X2TC');
		return;
	}
	`log("Coop hack (" $ Session.RoleName() $ "): hack screen opened for unit" @ UnitText(HackScreen) @ "(owner" @ class'X2TC_CoopOwnership'.static.OwnerText(Owner) $ "); shown on this PC=" $ bMine, , 'X2TC');

	// On the guest, every hack screen (its own or the host's) waits for the hack's result
	// frame before it may end (X2TC_CoopSession.GuestHoldHack).
	if (!bHost)
	{
		Session.GuestHoldHack(HackScreen, bMine);
	}

	if (bMine)
	{
		if (!bHost && HackScreen.CancelHackAbility != none && !HackScreen.m_SkullJacking && !HackScreen.m_SkullMining)
		{
			CancelButton = HackScreen.Spawn(class'UIButton', HackScreen);
			CancelButton.InitButton('X2TC_CoopHackCancel', "CO-OP: CANCEL HACK", OnCancelClicked);
			CancelButton.AnchorTopRight();
			CancelButton.SetPosition(-340, 160);
			CancelButton.DisableNavigation();
		}
		return;
	}

	// the other player watches -- Kc
	// So the other player's copy stays visible but takes no input (hiding it left a grey
	// tablet, since the hack screen is drawn on the soldier's pad). The host plays the
	// partner's choice on it (HostDriveHack); the guest's copy ends when the host's result
	// frame has been replayed.
	HackScreen.SetInputState(eInputState_None);
	`log("Coop hack (" $ Session.RoleName() $ "): watching the other player's hack (no input here)", , 'X2TC');

	// The input state blocks keys only; the watcher could still click and roll on the
	// other player's hack. Fix switch "Hacks: watcher can't click".
	if (class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_HACK_NO_CLICK))
	{
		LockWatcherCopy(HackScreen, Session);
	}
}

// Two layers on the watcher's copy.
//  1. Mark the hack as started (an instance variable, not a default): the screen's mouse
//     callback starts or cancels a hack only while it's false (UIHackingScreen.OnMouseEvent
//     L345-365), and so do its keys (L388, L411, L421). On the host, HostDriveHack clears
//     it again just before it plays the partner's choice (the session remembers the lock).
//  2. A nearly transparent full-size box on top that takes mouse events, so clicks on the
//     reward options ("SelectReward", OnCommand L473) don't reach the screen either. A
//     guess: the screen is drawn on the soldier's pad (X2Action_Hack.uc L232-237), and it
//     isn't known whether a panel there catches the mouse. Each caught click is logged
//     (the first few).
function LockWatcherCopy(UIHackingScreen HackScreen, X2TC_CoopSession Session)
{
	local UIBGBox Blocker;

	HackScreen.m_hackStarted = true;
	Session.MarkHackWatchLocked(HackScreen);
	Blocker = HackScreen.Spawn(class'UIBGBox', HackScreen);
	Blocker.InitBG('X2TC_CoopHackBlocker', 0, 0, 1920, 1080);
	Blocker.SetAlpha(0.01); // 1% (UIPanel.SetAlpha converts 0-1 to Flash's 0-100)
	Blocker.ProcessMouseEvents(OnBlockerMouse);
	`log("Coop hack (" $ Session.RoleName() $ "): watcher's copy locked (marked started; click blocker added)", , 'X2TC');
}

function OnBlockerMouse(UIPanel Panel, int Cmd)
{
	if (BlockerClicksLogged < 4 && Cmd == class'UIUtilities_Input'.const.FXS_L_MOUSE_UP)
	{
		BlockerClicksLogged++;
		`log("Coop hack: click on the watcher's copy caught by the blocker", , 'X2TC');
	}
}

// Guest: the co-op Cancel. The screen's own OnCancel submits CancelHack, which the follower
// captures and sends as a cancel choice, and then ends the screen.
function OnCancelClicked(UIButton Button)
{
	local UIHackingScreen HackScreen;

	HackScreen = UIHackingScreen(Button.Screen);
	if (HackScreen == none || HackScreen.m_hackStarted)
	{
		`log("Coop hack (guest): CANCEL HACK clicked after the hack started; ignored", , 'X2TC');
		return;
	}
	`log("Coop hack (guest): CANCEL HACK clicked", , 'X2TC');
	Button.DisableButton();
	HackScreen.OnCancel();
}

static function string UnitText(UIHackingScreen HackScreen)
{
	if (HackScreen.UnitState == none)
	{
		return "(none)";
	}
	return string(HackScreen.UnitState.ObjectID);
}

defaultproperties
{
	ScreenClass = class'UIHackingScreen'
}
