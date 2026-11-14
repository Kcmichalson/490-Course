//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopReplayMgr
//
//  What it changes: the guest's replay manager in a co-op mission (plans/m3-plan.md,
//  Stage 4). X2TC_CoopSession puts it in place of the stock replay manager on the
//  guest's copy of the host's mission, before the game starts its replay. It replays
//  from the mission's start state like the stock one (so the scene is built the proven
//  way, Stage 3), then keeps following: whenever the guest's history grows (the host's
//  partial histories), it steps forward to the newest frame, the way the inactive
//  player's replay manager does in stock multiplayer. It never stops the replay, so the
//  guest's ruleset never adds game states of its own (AddNewStatesAllowed is false while
//  bInReplay is set).
//
//  It writes X2TC lines: replay started, "replayed to frame N" each time it has caught
//  up, and (through X2TC_CoopSession.LogTurnBegins) every player-turn start it passes,
//  with its frame, to compare with the host's.
//
//  Not a class override: an extra actor, spawned and assigned to the game's ReplayMgr
//  field (XComGameReplicationInfo.uc L25), as the multiplayer game does with
//  XComMPReplayMgr (XComMPTacticalGRI.uc L287).
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComReplayMgr.uc     (StartReplay L44-68, StepReplayForward,
//                                           CurrentHistoryFrame, StepForwardStopFrame, bInReplay)
//    XComGame\Classes\XComMPReplayMgr.uc   (the following pattern: PlayingReplay.Tick L141-154)
//    XComGame\Classes\X2TacticalGameRuleset.uc (AddNewStatesAllowed L682-692; the replay
//                                               start after a load, L3063-3077)
//---------------------------------------------------------------------------------------

class X2TC_CoopReplayMgr extends XComReplayMgr;

var int TurnScanFrame;   // last frame checked for player-turn starts
var bool bBehind;        // stepping toward the newest frame

simulated event StartReplay(int SessionStartStateIndex)
{
	local X2TC_CoopSession Session;

	TurnScanFrame = SessionStartStateIndex - 1;
	`log("Coop follower: starting replay at frame" @ SessionStartStateIndex @ "of" @ `XCOMHISTORY.GetNumGameStates(), , 'X2TC');

	// The stock start: builds the start frame's visualization and steps once.
	super.StartReplay(SessionStartStateIndex);
	ScanTurnBegins();
	bBehind = true;
	GotoState('Following');

	Session = class'X2TC_CoopSession'.static.FindGuestSession();
	if (Session != none)
	{
		Session.OnFollowerStarted(SessionStartStateIndex);
	}
	else
	{
		`log("Coop follower: no guest session to tell", , 'X2TC');
	}
}

function ScanTurnBegins()
{
	if (CurrentHistoryFrame > TurnScanFrame)
	{
		class'X2TC_CoopSession'.static.LogTurnBegins("guest", TurnScanFrame + 1, CurrentHistoryFrame);
		TurnScanFrame = CurrentHistoryFrame;
	}
}

state Following
{
	event Tick(float DeltaTime)
	{
		StepForwardStopFrame = `XCOMHISTORY.GetNumGameStates() - 1;

		if (CurrentHistoryFrame < StepForwardStopFrame)
		{
			bBehind = true;
			StepReplayForward();
			ScanTurnBegins();
		}
		else if (bBehind)
		{
			bBehind = false;
			`log("Coop guest: replayed to frame" @ CurrentHistoryFrame @ "(history frames=" $ `XCOMHISTORY.GetNumGameStates() $ ")", , 'X2TC');
		}
	}
}

defaultproperties
{
	bSingleStepMode=false
	bInReplay=false
}
