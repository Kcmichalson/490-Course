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
//  partner's soldiers can still act and it isn't ready (X2TC_CoopSession). The host builds the path
//  (X2TC_CoopSession, X2PathSolver.BuildPath).
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
//---------------------------------------------------------------------------------------

class X2TC_CoopInput extends Interaction;

const INPUT_OBJECT_NAME = "X2TC_CoopInput_Main";
const MOVE_KEY = 'M';

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

	// The squad screen handles its own keys and clicks (a right-click there closes it
	// and must not move a soldier).
	if (class'X2TC_CoopSquadScreen'.static.FindOpen() != none)
	{
		return false;
	}

	// Stage 6, host: Backspace and End end the turn (XComTacticalInput.uc Key_Backspace
	// L2462, Key_End L2468, Back_Button L2417-2442, on release). While the host should be
	// asked first, they go through the co-op check instead; otherwise the game has them.
	if (Key == 'BackSpace' || Key == 'End')
	{
		Session = class'X2TC_CoopSession'.static.FindSession();
		if (Session == none || Session.RoleName() != "host" || !Session.bGuestFollowing
			|| !Session.HostShouldAskBeforeEndTurn() || IsDialogShowing())
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
	// XComTacticalController.uc L540-544).
	if (Key == 'Tab')
	{
		if (Follower == none || !Follower.bInputPhase)
		{
			return false;
		}
		if (EventType == IE_Pressed)
		{
			`log("Coop input: Tab -> next soldier", , 'X2TC');
			Follower.SelectNextGuestUnit();
		}
		return true;
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

// True while a dialog box is up (our End Turn question included), so its own keys work.
function bool IsDialogShowing()
{
	local XComPlayerController PC;

	PC = XComPlayerController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	return PC != none && PC.Pres != none && PC.Pres.UIIsShowingDialog();
}
