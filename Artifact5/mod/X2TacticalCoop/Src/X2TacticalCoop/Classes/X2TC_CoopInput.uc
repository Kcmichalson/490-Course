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
//  every other key and click passes through untouched. The host builds the path
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

	if (EventType != IE_Released || (Key != MOVE_KEY && Key != 'RightMouseButton'))
	{
		return false;
	}

	TacticalGRI = XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI);
	if (TacticalGRI != none)
	{
		Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
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
