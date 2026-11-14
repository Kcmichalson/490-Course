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
//  Stage 5: it extends the tutorial's replay manager (XComTutorialMgr), so bInTutorial is
//  set. In that mode a context the guest submits during the replay goes to
//  HandleSubmittedGameStateContext instead of being applied (X2GameRuleset.uc L290-293),
//  and input state changes are allowed (XComTacticalController.uc L780-786). This class
//  captures there: moves go to the host through X2TC_CoopSession; anything else is
//  logged as not sent. It turns the guest's input on during XCOM's turn (once caught up
//  and the visualizer is idle) and back to the replay's input otherwise. The tutorial's
//  own behaviour (its replay start, "next ability only" filtering, markers, demo steps,
//  the end-of-battle observer) is switched off, and every tutorial function it replaces
//  logs once when called, so anything tutorial-specific that fires shows in Launch.log.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComReplayMgr.uc     (StartReplay L44-68, StepReplayForward,
//                                           CurrentHistoryFrame, StepForwardStopFrame, bInReplay)
//    XComGame\Classes\XComTutorialMgr.uc   (bInTutorial default L756; StartReplay L85-114;
//                                           IsNextAbility/IsTarget L129-143; markers L291-456;
//                                           HandleSubmittedGameStateContext L161, L657)
//    XComGame\Classes\XComMPReplayMgr.uc   (the following pattern: PlayingReplay.Tick L141-154)
//    XComGame\Classes\X2TacticalGameRuleset.uc (AddNewStatesAllowed L682-692; the replay
//                                               start after a load, L3063-3077)
//    XComGame\Classes\XComTacticalController.uc (SetInputState L780-786, GetInputState L788,
//                                                Visualizer_SelectNextUnit L591,
//                                                GetActiveUnitStateRef L832)
//    XComGame\Classes\XComGameStateVisualizationMgr.uc (VisualizerBusy)
//---------------------------------------------------------------------------------------

class X2TC_CoopReplayMgr extends XComTutorialMgr;

// The input state the guest gets during XCOM's turn (the state a stopped replay returns
// to, XComReplayMgr.uc StopReplay).
const GUEST_INPUT_STATE = 'ActiveUnit_Moving';
const REPLAY_INPUT_STATE = 'InReplayPlayback';

var int TurnScanFrame;   // last frame checked for player-turn starts
var bool bBehind;        // stepping toward the newest frame
var bool bGuestInputOn;  // the guest's input is on (XCOM's turn, caught up)
var array<name> LoggedTutorialCalls; // tutorial functions already logged once

simulated event StartReplay(int SessionStartStateIndex)
{
	local X2TC_CoopSession Session;

	TurnScanFrame = SessionStartStateIndex - 1;
	`log("Coop follower: starting replay at frame" @ SessionStartStateIndex @ "of" @ `XCOMHISTORY.GetNumGameStates(), , 'X2TC');

	// The stock start (XComReplayMgr's, skipping the tutorial's frame search, UI toggle and
	// end-of-battle observer): builds the start frame's visualization and steps once.
	super(XComReplayMgr).StartReplay(SessionStartStateIndex);
	`log("Coop follower: tutorial mode=" $ bInTutorial @ "(captures the guest's submitted actions)", , 'X2TC');
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

		UpdateGuestInput();
	}
}

// Stage 5: input on during XCOM's turn when caught up and nothing is animating; off
// (the replay's input state) otherwise. Logs each change.
function UpdateGuestInput()
{
	local bool bWant;
	local XComTacticalController TacticalController;

	bWant = !bBehind && IsXComTurn() && !class'XComGameStateVisualizationMgr'.static.VisualizerBusy();
	if (bWant == bGuestInputOn)
	{
		return;
	}

	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (TacticalController == none)
	{
		return;
	}

	bGuestInputOn = bWant;
	if (bWant)
	{
		TacticalController.SetInputState(GUEST_INPUT_STATE);
		if (TacticalController.GetActiveUnitStateRef().ObjectID <= 0)
		{
			TacticalController.Visualizer_SelectNextUnit();
		}
		`log("Coop follower: input on (state" @ TacticalController.GetInputState() $ ", active unit" @ TacticalController.GetActiveUnitStateRef().ObjectID $ ", frame" @ CurrentHistoryFrame $ ")", , 'X2TC');
	}
	else
	{
		TacticalController.SetInputState(REPLAY_INPUT_STATE);
		`log("Coop follower: input off (state" @ TacticalController.GetInputState() $ ", frame" @ CurrentHistoryFrame $ ")", , 'X2TC');
	}
}

// True during the XCOM player's turn, as the replay last saw it (StepReplayForward sets
// the ruleset's CachedUnitActionPlayerRef at each turn start).
function bool IsXComTurn()
{
	local X2TacticalGameRuleset Rules;
	local XComGameState_Player PlayerState;

	Rules = `TACTICALRULES;
	if (Rules == none || Rules.CachedUnitActionPlayerRef.ObjectID <= 0)
	{
		return false;
	}
	PlayerState = XComGameState_Player(`XCOMHISTORY.GetGameStateForObjectID(Rules.CachedUnitActionPlayerRef.ObjectID));
	return PlayerState != none && PlayerState.TeamFlag == eTeam_XCom;
}

// Stage 5: every context the guest submits during the replay arrives here (tutorial
// mode). Nothing is applied on the guest; moves go to the host.
simulated function bool HandleSubmittedGameStateContext(XComGameStateContext SubmittedContext)
{
	local XComGameStateContext_Ability AbilityContext;
	local X2TC_CoopSession Session;
	local int FramesBefore;

	FramesBefore = `XCOMHISTORY.GetNumGameStates();
	AbilityContext = XComGameStateContext_Ability(SubmittedContext);
	Session = class'X2TC_CoopSession'.static.FindGuestSession();

	if (AbilityContext == none)
	{
		`log("Coop follower: captured a non-ability context, not sent:" @ SubmittedContext.Class.Name @ "(frames=" $ FramesBefore $ ")", , 'X2TC');
		return false;
	}

	if (AbilityContext.InputContext.AbilityTemplateName == 'StandardMove' && AbilityContext.InputContext.MovementPaths.Length > 0)
	{
		if (Session != none)
		{
			Session.SendGuestMove(AbilityContext.InputContext.MovementPaths[0].MovingUnitRef.ObjectID,
				AbilityContext.InputContext.MovementPaths[0].MovementTiles, FramesBefore);
		}
		else
		{
			`log("Coop follower: captured a move but found no guest session", , 'X2TC');
		}
		return false;
	}

	`log("Coop follower: captured ability" @ AbilityContext.InputContext.AbilityTemplateName @ "(unit" @ AbilityContext.InputContext.SourceObject.ObjectID $ "), not sent: Stage 5 sends moves only (frames=" $ FramesBefore $ ")", , 'X2TC');
	return false;
}

// Logs a tutorial function the first time this follower intercepts it.
function LogTutorialCall(name FunctionName)
{
	if (LoggedTutorialCalls.Find(FunctionName) != INDEX_NONE)
	{
		return;
	}
	LoggedTutorialCalls.AddItem(FunctionName);
	`log("Coop follower: tutorial call intercepted:" @ FunctionName @ "(logged once)", , 'X2TC');
}

// The tutorial's "only the scripted next ability / target" filters: every ability and
// target is allowed for the guest (UITacticalHUD.uc L528, UITacticalHUD_Ability.uc
// L95-100, UITacticalHUD_Enemies.uc L427-432).
simulated function bool IsNextAbility(name TemplateName)
{
	LogTutorialCall('IsNextAbility');
	return true;
}

simulated function bool IsTarget(int ObjectID)
{
	LogTutorialCall('IsTarget');
	return true;
}

// Tutorial steps, markers and demo mode: switched off, logged.
function StartDemoSequenceDeferred()
{
	LogTutorialCall('StartDemoSequenceDeferred');
}

simulated function ToggleDemoMode()
{
	LogTutorialCall('ToggleDemoMode');
}

function SetupForPlayerInputUsingFrame(int FrameToUse)
{
	LogTutorialCall('SetupForPlayerInputUsingFrame');
}

function SetTargetLocationMarkers()
{
	LogTutorialCall('SetTargetLocationMarkers');
}

function SetMoveMarkers()
{
	LogTutorialCall('SetMoveMarkers');
}

function DoTimedFocusOnTargetPoint()
{
	LogTutorialCall('DoTimedFocusOnTargetPoint');
}

function HandleTooManyInvalidSubmissions(XComGameStateContext_Ability AbilityContext)
{
	LogTutorialCall('HandleTooManyInvalidSubmissions');
}

event OnActiveUnitChanged(XComGameState_Unit NewActiveUnit)
{
	LogTutorialCall('OnActiveUnitChanged');
}

event OnVisualizationBlockComplete(XComGameState AssociatedGameState)
{
	// The tutorial ends the battle here when it sees the end-of-battle frame; this
	// follower never registers as an observer, so this should never run.
	LogTutorialCall('OnVisualizationBlockComplete');
}

defaultproperties
{
	bSingleStepMode=false
	bInReplay=false
}
