//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopInput
//
//  What it changes: two inputs for the co-op guest, so it can move soldiers without the
//  mouse crossing the map to the MOVE TO CURSOR button (plans/m3-plan.md, Stage 5,
//  Run 8; Kc 2026-11-14):
//    - the M key: move the selected soldier to the tile under the 3D cursor;
//    - a right-click on the map, only while the game's own path is empty (when the
//      normal path works, right-click is left to the game).
//  Both act only while the guest's follower has its input on (XCOM's turn, caught up);
//  every other key and click passes through untouched.
//  Stage 6 (0.5.0): Tab on the guest selects its next soldier (during XCOM's input
//  phase); Backspace and End on the host go through the co-op End Turn check while the
//  partner's soldiers can still act and it isn't ready (X2TC_CoopSession).
//  0.5.1: left-click selects a soldier on the guest. 0.5.3: H = previous soldier on both
//  sides; on the host, Tab and H cycle only its own soldiers that can act; on the guest,
//  Backspace and End end the turn when "Partner may end the turn" is on. The host builds the path
//  (X2TC_CoopSession, X2PathSolver.BuildPath). 0.8.2: Escape on the guest opens the pause
//  menu while its input is off (GuestOpenPauseMenu).
//
//  How: an Interaction inserted at the front of the game viewport's global interactions
//  (GameViewportClient.InsertInteraction, Engine\Classes\GameViewportClient.uc L756),
//  the way the engine's console sees keys before the game; its OnReceivedNativeInputKey
//  delegate (Engine\Classes\Interaction.uc L84-87) returns true only for the inputs it
//  uses. Installed once per game, looked up by name in the transient package like
//  X2TC_CoopSession. Not a class override.
//
//  Relies on (paths in Development\SrcOrig):
//    Engine\Classes\Interaction.uc          (OnReceivedNativeInputKey L87)
//    Engine\Classes\GameViewportClient.uc   (InsertInteraction L756-788)
//    XComGame\Classes\XComPathingPawn.uc    (PathTiles L142)
//    XComGame\Classes\XComPresentationLayerBase.uc (UIPauseMenu L1802-1830,
//                                           IsPauseMenuRaised L1832)
//    XComGame\Classes\XComTacticalController.uc (ShouldBlockPauseMenu L2208-2217)
//---------------------------------------------------------------------------------------

class X2TC_CoopInput extends Interaction;

const INPUT_OBJECT_NAME = "X2TC_CoopInput_Main";
const MOVE_KEY = 'M';
const PREVIOUS_KEY = 'H'; // 0.5.3: previous soldier (Kc: not Shift+Tab, Steam's overlay)

var bool bShiftDown;      // 0.6.0: a Shift key is held (for Shift+Tab)
var int WheelEventsLogged; // 0.8.1: wheel events logged so far (the first few only)
var int EscapeEventsLogged; // 0.8.2: Escape presses logged while the partner waits (the first few only)

// Installs the input once per game. Logs whether it was installed now or already there.
static function Install()
{
	local GameViewportClient Viewport;
	local X2TC_CoopInput CoopInput;

	if (FindObject("Transient." $ INPUT_OBJECT_NAME, class'X2TC_CoopInput') != none)
	{
		`log("Coop input: already installed (M key, right-click)", , 'X2TC');
		return;
	}
	Viewport = class'Engine'.static.GetEngine().GameViewport;
	if (Viewport == none)
	{
		`log("Coop input: no game viewport; M key and right-click not installed", , 'X2TC');
		return;
	}
	CoopInput = new(none, INPUT_OBJECT_NAME) class'X2TC_CoopInput';
	CoopInput.OnReceivedNativeInputKey = CoopInput.HandleKey;
	Viewport.InsertInteraction(CoopInput, 0);
	`log("Coop input: installed (M key = move to cursor; right-click = move to cursor when the game has no path)", , 'X2TC');
}

function bool HandleKey(int ControllerId, name Key, EInputEvent EventType, optional float AmountDepressed = 1.f, optional bool bGamepad)
{
	local X2TC_CoopReplayMgr Follower;
	local XComTacticalGRI TacticalGRI;
	local XComTacticalController TacticalController;
	local X2TC_CoopSession Session;
	local int Direction;

	// 0.6.0: Shift is tracked (never consumed) so Shift+Tab means "previous", as in the game
	// (XComTacticalInput.uc Key_Tab L2197-2210), when Steam's overlay doesn't take it.
	if (Key == 'LeftShift' || Key == 'RightShift')
	{
		bShiftDown = (EventType != IE_Released);
		return false;
	}

	// The squad screen handles its own keys and clicks (a right-click there closes it
	// and must not move a soldier).
	if (class'X2TC_CoopSquadScreen'.static.FindOpen() != none || class'X2TC_CoopFixesScreen'.static.IsOpen())
	{
		return false; // 0.8.1: the fixes screen too (its list scrolls with the wheel)
	}

	// Stage 6, host: Backspace and End end the turn (XComTacticalInput.uc Key_Backspace
	// L2462, Key_End L2468, Back_Button L2417-2442, on release). While the host should be
	// asked first, they go through the co-op check instead; otherwise the game has them.
	if (Key == 'BackSpace' || Key == 'End')
	{
		Session = class'X2TC_CoopSession'.static.FindSession();
		// 0.5.3, guest: with "Partner may end the turn" on, the same keys end the turn on
		// the guest too (its END TURN button's path); otherwise they do nothing there.
		if (Session != none && Session.RoleName() == "guest")
		{
			TacticalGRI = XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI);
			if (TacticalGRI != none)
			{
				Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
			}
			if (Follower == none || !Follower.bInputPhase || !Session.bPartnerMayEndTurn || IsDialogShowing())
			{
				return false;
			}
			if (EventType == IE_Released)
			{
				`log("Coop input:" @ Key @ "-> guest End Turn (Partner may end the turn is on)", , 'X2TC');
				Session.GuestEndTurnPressed();
			}
			return true;
		}
		// 0.5.1: also while the host's input is locked (Multiplayer_Inactive doesn't end
		// the turn on these keys).
		if (Session == none || Session.RoleName() != "host" || !Session.bGuestFollowing
			|| !(Session.HostShouldAskBeforeEndTurn() || Session.bHostLocked) || IsDialogShowing())
		{
			return false;
		}
		if (EventType == IE_Released)
		{
			`log("Coop input:" @ Key @ "-> co-op End Turn check", , 'X2TC');
			Session.HostEndTurnRequested(string(Key));
		}
		return true;
	}

	TacticalGRI = XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI);
	if (TacticalGRI != none)
	{
		Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
	}

	// Stage 6, guest: Tab selects the next of the guest's soldiers, as in normal play
	// (the game's own cycling is off with a tutorial-style replay manager,
	// XComTacticalController.uc L540-544). 0.5.3: H selects the previous one (unbound in
	// the game's DefaultInput.ini and an empty Key_H in XComInputBase.uc L1148; Shift+Tab
	// is Steam's overlay), and on the host Tab and H cycle only the host's own soldiers
	// that can act.
	if (Key == 'Tab' || Key == PREVIOUS_KEY)
	{
		Direction = 1;
		if (Key == PREVIOUS_KEY || bShiftDown)
		{
			Direction = -1;
		}
		Session = class'X2TC_CoopSession'.static.FindSession();
		if (Session != none && Session.IsHost())
		{
			if (!Session.HostOwnsCycleKeys())
			{
				return false;
			}
			if (EventType == IE_Pressed)
			{
				Session.HostCycleOwnSoldier(Direction);
			}
			return true;
		}
		if (Follower == none || !Follower.bInputPhase)
		{
			return false;
		}
		if (EventType == IE_Pressed)
		{
			`log("Coop input:" @ Key @ "-> soldier" @ Direction, , 'X2TC');
			Follower.SelectGuestUnitStep(Direction);
		}
		return true;
	}

	// 0.8.1 (0.8.0b Run 2: the wheel didn't change floors on the guest; F and C did): the
	// game binds MouseScrollUp/Down to the same F/C handlers (DefaultInput.ini, tactical
	// section), which in move mode call the 3D cursor's AscendFloor / DescendFloor
	// (XComTacticalInput ActiveUnit_Moving Key_F/Key_C, XCom3DCursor.uc L355-364). The
	// wheel is lost somewhere before that on the guest (cause not found in source). While
	// the guest's input is on, step the floor here. The first few wheel events are logged
	// either way. Fix switch: "Partner: mouse wheel changes floors".
	if (Key == 'MouseScrollUp' || Key == 'MouseScrollDown')
	{
		TacticalGRI = XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI);
		if (TacticalGRI != none)
		{
			Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
		}
		if (Follower == none)
		{
			return false; // the host's own game handles its wheel
		}
		if (WheelEventsLogged < 6)
		{
			WheelEventsLogged++;
			TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
			`log("Coop input:" @ Key @ EventType @ "(guest input on=" $ Follower.bGuestInputOn @ "input state" @ (TacticalController != none ? string(TacticalController.GetInputState()) : "none") $ ")", , 'X2TC');
		}
		if (!Follower.bGuestInputOn || !class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_WHEEL))
		{
			return false;
		}
		if (EventType == IE_Pressed)
		{
			if (Key == 'MouseScrollUp')
			{
				`CURSOR.AscendFloor();
			}
			else
			{
				`CURSOR.DescendFloor();
			}
		}
		return true;
	}

	// 0.8.2 (0.8.1 Run 1: the laptop couldn't pause while none of its soldiers could act):
	// the guest's input is then InReplayPlayback, whose Escape goes to the global
	// Start_Button (XComTacticalInput.uc L1696-1709 -> UIPauseMenu(, true)). That opens
	// nothing while ShouldBlockPauseMenu() is true (XComPresentationLayerBase.uc L1813;
	// XComTacticalController.uc L2208-2217: the player's state is 'EndingTurn' or the shot
	// HUD is up). The guess: the guest's player sits in 'EndingTurn' while it has nothing to
	// do. Logged below. While the guest's input is off, Escape opens the pause menu here,
	// without the gameplay block and with saving off (only the host saves). The pause
	// listener then pauses only this PC, as before. Fix switch: "Partner: pause while waiting".
	if (Key == 'Escape' && Follower != none && !Follower.bGuestInputOn)
	{
		return EventType == IE_Released && GuestOpenPauseMenu();
	}

	// 0.5.1: left-click on a soldier selects it on the guest (the follower checks the HUD,
	// move mode and ownership); every other left-click passes through.
	if (Key == 'LeftMouseButton')
	{
		return EventType == IE_Released && Follower != none && Follower.SelectUnitUnderCursor();
	}

	if (EventType != IE_Released || (Key != MOVE_KEY && Key != 'RightMouseButton'))
	{
		return false;
	}
	if (Follower == none || !Follower.bGuestInputOn)
	{
		return false;
	}

	if (Key == 'RightMouseButton')
	{
		// Leave the click to the game when its own path is there (normal moves work).
		TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
		if (TacticalController != none && TacticalController.m_kPathingPawn != none && TacticalController.m_kPathingPawn.PathTiles.Length > 1)
		{
			return false;
		}
	}

	`log("Coop input:" @ Key @ "-> move to cursor", , 'X2TC');
	Follower.MoveActiveUnitToCursor();
	return true;
}

// 0.8.2, guest, Escape released while its input is off: open the pause menu unless one is
// already up, a dialog or hack screen is open, or the switch is off. Returns true if it
// opened it (the key is then consumed); false leaves Escape to the game.
function bool GuestOpenPauseMenu()
{
	local XComTacticalController TacticalController;
	local XComPresentationLayer Pres;
	local bool bBlocked, bOn;

	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (TacticalController == none)
	{
		return false;
	}
	Pres = XComPresentationLayer(TacticalController.Pres);
	if (Pres == none || Pres.ScreenStack == none || Pres.IsPauseMenuRaised() || Pres.UIIsShowingDialog()
		|| class'X2TC_CoopSession'.static.FindHackScreen() != none)
	{
		return false; // the open screen has the key
	}
	bBlocked = TacticalController.ShouldBlockPauseMenu();
	bOn = class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_PARTNER_PAUSE);
	if (EscapeEventsLogged < 6)
	{
		EscapeEventsLogged++;
		`log("Coop input: Escape while the partner's input is off (input state" @ string(TacticalController.GetInputState())
			@ "player state" @ (TacticalController.m_XGPlayer != none ? string(TacticalController.m_XGPlayer.GetStateName()) : "none")
			@ "game blocks pause=" $ bBlocked @ "input blocked=" $ Pres.ScreenStack.IsInputBlocked
			@ "fix=" $ bOn $ ")", , 'X2TC');
	}
	if (!bOn)
	{
		return false;
	}
	Pres.UIPauseMenu(true, true); // true: past the gameplay block; true: no saving on the partner
	return Pres.IsPauseMenuRaised();
}

// True while a dialog box is up (our End Turn question included), so its own keys work.
function bool IsDialogShowing()
{
	local XComPlayerController PC;

	PC = XComPlayerController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	return PC != none && PC.Pres != none && PC.Pres.UIIsShowingDialog();
}
