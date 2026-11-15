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
var bool bInputPhase;    // XCOM's turn: tutorial mode on (the ruleset stays in PerformingReplay)
var string LastMoveChecks; // Run 4 diagnostics: the last logged move-guard values
var string LastAbilityKey; // the last ability capture (template, source, target)
var bool bPawnForceLogged; // Run 7: the "pathing pawn shown" line, once per input-on
// Run 8 (0.4.2): competing fixes for normal moves, each switched on screen by a guest
// button (X2TC_CoopListener), so one run tests them all. A: refresh the reachable-tiles
// cache (0.4.1); B: history current index -1 while the input is on; C: world sync on
// each refresh.
var bool bFixCache;
var bool bFixHistoryIndex;
var bool bFixWorldSync;
var bool bFixFreshPawn;            // Run 9: D, a freshly spawned pathing pawn
var XComPathingPawn FreshPawn;     // Run 9: the pawn fix D spawned
var XComPathingPawn OriginalPawn;  // Run 9: the controller's own pawn, kept to restore
var float LastStateLogTime; // Run 8: the 0.5 s move-state line
var int LastRefreshUnitID;  // Run 8: the unit, frame and input state of the last pathing refresh
var int LastRefreshFrame;
var name LastSeenInputState;
var float LastAbilityTime; // its WorldInfo.RealTimeSeconds
var array<name> LoggedTutorialCalls; // tutorial functions already logged once

simulated event StartReplay(int SessionStartStateIndex)
{
	local X2TC_CoopSession Session;

	TurnScanFrame = SessionStartStateIndex - 1;
	`log("Coop follower: starting replay at frame" @ SessionStartStateIndex @ "of" @ `XCOMHISTORY.GetNumGameStates(), , 'X2TC');

	// The stock start (XComReplayMgr's, skipping the tutorial's frame search, UI toggle and
	// end-of-battle observer): builds the start frame's visualization and steps once.
	super(XComReplayMgr).StartReplay(SessionStartStateIndex);
	`log("Coop follower: tutorial mode=" $ bInTutorial @ "(turned on only during XCOM's input phase)", , 'X2TC');
	ScanTurnBegins();
	bBehind = true;
	GotoState('WaitForPlayerInput');

	Session = class'X2TC_CoopSession'.static.FindGuestSession();
	if (Session != none)
	{
		Session.OnFollowerStarted(SessionStartStateIndex);
	}
	else
	{
		`log("Coop follower: no guest session to tell", , 'X2TC');
	}
	// Run 8: the M key and right-click for move to cursor.
	class'X2TC_CoopInput'.static.Install();
}

function ScanTurnBegins()
{
	if (CurrentHistoryFrame > TurnScanFrame)
	{
		class'X2TC_CoopSession'.static.LogTurnBegins("guest", TurnScanFrame + 1, CurrentHistoryFrame);
		TurnScanFrame = CurrentHistoryFrame;
	}
}

// The following state. Named WaitForPlayerInput (Run 3, 0.3.6) because the controller
// refuses every move while a tutorial manager is in any other state
// (XComTacticalController.PerformPath L1098); Run 2's moves never reached the capture.
// It replaces the tutorial's state of that name (XComTutorialMgr.uc L655-751): its
// validating HandleSubmittedGameStateContext and its Begin code (which sets up the
// tutorial's next scripted input) are overridden here.
state WaitForPlayerInput
{
	simulated function bool HandleSubmittedGameStateContext(XComGameStateContext SubmittedContext)
	{
		return global.HandleSubmittedGameStateContext(SubmittedContext);
	}

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

Begin:
	// Nothing: the tutorial's own Begin code (PushState('WaitForVisualizers'),
	// SetupForPlayerInputUsingFrame) must not run.
}

// Stage 5 (Run 2 version). Two levels:
//  - The XCOM input phase, for the whole of XCOM's turn once caught up: tutorial mode on,
//    and the ruleset taken out of its replay state the way the tutorial does before the
//    player's input (SetupForPlayerInputUsingFrame, XComTutorialMgr.uc L291-305:
//    EndReplay, then Visualizer_SelectUnit). EndReplay moves the ruleset from
//    PerformingReplay through TurnPhase_Begin to TurnPhase_WaitForTutorialInput
//    (X2TacticalGameRuleset.uc L5434-5451, L4963-4978); the game states TurnPhase_Begin
//    builds reach HandleSubmittedGameStateContext and are not applied. Leaving the phase
//    calls ResumeReplay (back to PerformingReplay, L1418-1421) and turns tutorial mode
//    off. Run 1 showed why: in PerformingReplay no soldier could be selected, and tutorial
//    mode on from the start played the tutorial's intro (X2TacticalGameRuleset.uc
//    L3422-3437).
//  - Input on (ActiveUnit_Moving) inside the phase while nothing is animating and the
//    replay is caught up; the replay's input state otherwise.
function UpdateGuestInput()
{
	local bool bWantPhase, bWant;
	local XComTacticalController TacticalController;
	local X2TacticalGameRuleset Rules;

	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	Rules = `TACTICALRULES;
	if (TacticalController == none || Rules == none)
	{
		return;
	}

	// Run 3 (0.3.6): the phase may only begin once the ruleset is in PerformingReplay. In
	// Run 2 it began during LoadTacticalGame, which then saw tutorial mode on and played
	// the tutorial intro (X2TacticalGameRuleset.uc L3422-3437), and EndReplay did nothing
	// there.
	bWantPhase = IsXComTurn() && (bInputPhase || (!bBehind && Rules.IsInState('PerformingReplay')));
	// Run 4 (0.3.7): no EndReplay/ResumeReplay any more. In Run 3, EndReplay took the
	// ruleset through TurnPhase_Begin, whose phase change is added straight to the history
	// (BeginState_RulesAuthority, X2TacticalGameRuleset.uc L706-723, AddGameStateToHistory,
	// not a submit), so the guest's history grew by 2 frames by itself. The ruleset now
	// stays in PerformingReplay; Run 2 showed selection and ability capture work there.
	if (bWantPhase && !bInputPhase)
	{
		bInputPhase = true;
		bInTutorial = true;
		`log("Coop follower: XCOM input phase begins (tutorial mode on, ruleset state" @ Rules.GetStateName() $ ", frame" @ CurrentHistoryFrame $ ")", , 'X2TC');
	}
	else if (!bWantPhase && bInputPhase)
	{
		SetGuestInput(TacticalController, false);
		bInputPhase = false;
		bInTutorial = false;
		`log("Coop follower: XCOM input phase ends (tutorial mode off, ruleset state" @ Rules.GetStateName() $ ", frame" @ CurrentHistoryFrame $ ")", , 'X2TC');
	}

	if (bGuestInputOn)
	{
		ApplyFreshPawn(TacticalController);
		KeepPathingVisible(TacticalController);
		SkipUnitWithoutActions(TacticalController);
		if (bFixCache)
		{
			RefreshPathingIfNeeded(TacticalController);
		}
		if (bFixHistoryIndex && !bBehind && `XCOMHISTORY.GetCurrentHistoryIndex() != -1)
		{
			// Fix B (Run 8 toggle): the replay keeps the history's "current index" on its
			// frame (XComReplayMgr.StartReplay; StepReplayForward); a normal game runs at -1
			// (the newest frame). Natives that read "current" state may behave differently.
			`log("Coop follower: fix B: history current index" @ `XCOMHISTORY.GetCurrentHistoryIndex() @ "-> -1", , 'X2TC');
			`XCOMHISTORY.SetCurrentHistoryIndex(-1);
		}
		LogMoveState(TacticalController);
	}

	bWant = bInputPhase && !bBehind && !class'XComGameStateVisualizationMgr'.static.VisualizerBusy();
	if (bWant != bGuestInputOn)
	{
		SetGuestInput(TacticalController, bWant);
	}
}

// Run 4 diagnostics: the guards a clicked move passes before it is submitted
// (XComTacticalInput.ClickToPath L3047-3095: the visualizer must not block ability
// activation; XComTacticalController.PerformPath L1093-1110: the unit not already
// moving, a tutorial manager in WaitForPlayerInput, a path of 2+ tiles). Logs a line
// whenever any of them changes while the guest's input is on.
function LogMoveChecks(XComTacticalController TacticalController)
{
	local string Checks;
	local bool bMoving;
	local XComGameState_Unit ActiveUnitState;
	local XGUnit ActiveUnitVisualizer;

	// (The controller's m_kActiveUnit is protected; go through the unit's state.)
	ActiveUnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(TacticalController.GetActiveUnitStateRef().ObjectID));
	if (ActiveUnitState != none)
	{
		ActiveUnitVisualizer = XGUnit(ActiveUnitState.GetVisualizer());
	}
	if (ActiveUnitVisualizer != none)
	{
		bMoving = ActiveUnitVisualizer.m_bIsMoving;
	}
	Checks = "visualizer blocks abilities=" $ `XCOMVISUALIZATIONMGR.VisualizerBlockingAbilityActivation()
		@ "unit moving=" $ bMoving
		@ "tutorial state WaitForPlayerInput=" $ IsInState('WaitForPlayerInput')
		@ "path of 2+ tiles=" $ (TacticalController.m_kPathingPawn != none && TacticalController.m_kPathingPawn.PathTiles.Length > 1)
		@ "input state=" $ TacticalController.GetInputState()
		@ "active unit=" $ TacticalController.GetActiveUnitStateRef().ObjectID;
	// Run 6 (0.3.9): the pathing pawn's own view (Run 5: "path of 2+ tiles" was never true
	// and no path line showed). Its Tick leaves the path empty when it is hidden or has no
	// active unit, and otherwise aims at the closest reachable tile to the cursor
	// (XComPathingPawn.uc L846-1040).
	Checks @= PathingPawnText(TacticalController, ActiveUnitState);
	if (Checks != LastMoveChecks)
	{
		LastMoveChecks = Checks;
		`log("Coop follower: move check:" @ Checks, , 'X2TC');
		if (`XCOMVISUALIZATIONMGR.VisualizerBlockingAbilityActivation())
		{
			// The game's own explanation of what blocks (its debug flag).
			`XCOMVISUALIZATIONMGR.VisualizerBlockingAbilityActivation(true);
		}
	}
}

// Run 9 (0.4.3), fix D: Run 8's 0.5 s lines showed the reachable-tiles cache working
// (the cursor tile reachable and the cache's closest tile = the cursor, 880 samples) while
// the controller's pathing pawn never took a destination (dest unchanged, path=0). Ability
// targeting draws paths because each targeting method spawns a pawn of its own
// (X2TargetingMethod_PathTarget.uc L32, X2TargetingMethod_MeleePath.uc L31); the
// controller's pawn is spawned once at map load (XComTacticalController.uc L805), before
// the replay and all the state switching. Put a freshly spawned pawn (same class, same
// spawn) in the controller's m_kPathingPawn slot, which the move code reads
// (PerformPath L1104), and hide the original; switching D off restores the original.
function ApplyFreshPawn(XComTacticalController TacticalController)
{
	local XComGameState_Unit UnitState;

	if (bFixFreshPawn)
	{
		if (FreshPawn == none)
		{
			FreshPawn = TacticalController.Spawn(class'XComPathingPawn');
		}
		if (FreshPawn == none || TacticalController.m_kPathingPawn == FreshPawn)
		{
			return;
		}
		if (OriginalPawn == none)
		{
			OriginalPawn = TacticalController.m_kPathingPawn;
		}
		if (OriginalPawn != none)
		{
			OriginalPawn.SetVisible(false);
		}
		TacticalController.m_kPathingPawn = FreshPawn;
		UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(TacticalController.GetActiveUnitStateRef().ObjectID));
		if (UnitState != none && XGUnit(UnitState.GetVisualizer()) != none)
		{
			FreshPawn.SetActive(XGUnit(UnitState.GetVisualizer()));
		}
		FreshPawn.SetVisible(true);
		LastRefreshUnitID = -1;
		`log("Coop follower: fix D: fresh pathing pawn" @ FreshPawn.Name @ "in use (original" @ (OriginalPawn != none ? string(OriginalPawn.Name) : "none") @ "hidden)", , 'X2TC');
	}
	else if (OriginalPawn != none && TacticalController.m_kPathingPawn != OriginalPawn)
	{
		if (FreshPawn != none)
		{
			FreshPawn.SetVisible(false);
		}
		TacticalController.m_kPathingPawn = OriginalPawn;
		OriginalPawn.SetVisible(true);
		LastRefreshUnitID = -1;
		`log("Coop follower: fix D off: original pathing pawn" @ OriginalPawn.Name @ "back in use", , 'X2TC');
	}
}

// Run 8: switches fix A, B or C (the guest's FIX buttons); returns the new setting.
// Forces a pathing refresh at the next tick so the change shows at once.
function bool ToggleFix(name Fix)
{
	local bool bNow;

	switch (Fix)
	{
		case 'A': bFixCache = !bFixCache; bNow = bFixCache; break;
		case 'B': bFixHistoryIndex = !bFixHistoryIndex; bNow = bFixHistoryIndex; break;
		case 'C': bFixWorldSync = !bFixWorldSync; bNow = bFixWorldSync; break;
		case 'D': bFixFreshPawn = !bFixFreshPawn; bNow = bFixFreshPawn; break;
	}
	LastRefreshUnitID = -1;
	`log("Coop follower: fix" @ Fix @ "now" @ (bNow ? "ON" : "OFF") @ "(A cache=" $ bFixCache @ "B history -1=" $ bFixHistoryIndex @ "C world sync=" $ bFixWorldSync @ "D fresh pawn=" $ bFixFreshPawn $ ")", , 'X2TC');
	return bNow;
}

// Run 8: the whole move-mode state every 0.5 s while the guest's input is on (replaces
// the change-only "move check" lines). Each condition on the way from the cursor to a
// submitted move (plans/m3-plan.md, Stage 5 Run 8 trace) is in it.
function LogMoveState(XComTacticalController TacticalController)
{
	local XComGameState_Unit UnitState;
	local XGUnit UnitVisualizer;
	local XComPathingPawn PathingPawn;
	local TTile CursorTile, Origin, Closest;
	local vector CursorLocation;
	local float MaxCost;
	local string Line;

	if (WorldInfo.RealTimeSeconds - LastStateLogTime < 0.5)
	{
		return;
	}
	LastStateLogTime = WorldInfo.RealTimeSeconds;

	UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(TacticalController.GetActiveUnitStateRef().ObjectID));
	if (UnitState != none)
	{
		UnitVisualizer = XGUnit(UnitState.GetVisualizer());
	}
	PathingPawn = TacticalController.m_kPathingPawn;
	CursorLocation = `CURSOR.Location;
	if (!`XWORLD.GetFloorTileForPosition(CursorLocation, CursorTile))
	{
		CursorTile = `XWORLD.GetTileCoordinatesFromPosition(CursorLocation);
	}

	Line = "input=" $ TacticalController.GetInputState()
		@ "unit=" $ TacticalController.GetActiveUnitStateRef().ObjectID;
	if (UnitState != none)
	{
		Line @= "AP=" $ UnitState.NumAllActionPoints() @ "tile=" $ TileText(UnitState.TileLocation);
	}
	Line @= "cursor=" $ TileText(CursorTile);
	if (PathingPawn != none)
	{
		Line @= "pawn=" $ PathingPawn.Name @ "hidden=" $ PathingPawn.bHidden @ "dest=" $ TileText(PathingPawn.LastDestinationTile) @ "path=" $ PathingPawn.PathTiles.Length;
	}
	if (UnitVisualizer != none && UnitVisualizer.m_kReachableTilesCache != none)
	{
		UnitVisualizer.m_kReachableTilesCache.GetCacheOriginAndMaxCost(Origin, MaxCost);
		Closest = UnitVisualizer.m_kReachableTilesCache.GetClosestReachableDestination(CursorTile);
		Line @= "cache origin=" $ TileText(Origin) @ "max cost=" $ MaxCost
			@ "cursor reachable=" $ UnitVisualizer.m_kReachableTilesCache.IsTileReachable(CursorTile)
			@ "closest=" $ TileText(Closest);
		Line @= "unit moving=" $ UnitVisualizer.m_bIsMoving;
	}
	Line @= "history index=" $ `XCOMHISTORY.GetCurrentHistoryIndex() $ "/" $ `XCOMHISTORY.GetNumGameStates()
		@ "visualizer busy=" $ class'XComGameStateVisualizationMgr'.static.VisualizerBusy()
		@ "blocks abilities=" $ `XCOMVISUALIZATIONMGR.VisualizerBlockingAbilityActivation()
		@ "tutorial state=" $ IsInState('WaitForPlayerInput')
		@ "fixes A=" $ bFixCache @ "B=" $ bFixHistoryIndex @ "C=" $ bFixWorldSync @ "D=" $ bFixFreshPawn;
	`log("Coop follower: move state:" @ Line, , 'X2TC');
}

// Run 7 (0.4.0): Run 6's diagnostics showed the pathing pawn hidden in every line, so
// its Tick cleared the path (XComPathingPawn.uc L900-920). The pawn hides itself every
// tick while the stock replay screen is in the stack and tutorial mode is off (L870),
// and the replay screen was closed during its own OnInit, possibly too early to leave
// the stack. While the guest's input is on: close a replay screen still in the stack,
// and show the pawn on the active unit if it is hidden (what the input state's
// BeginState should have done, XComTacticalInput.uc L1741-1790). Logged once per
// input-on.
function KeepPathingVisible(XComTacticalController TacticalController)
{
	local UIScreen ReplayScreen;
	local XComGameState_Unit ActiveUnitState;
	local XComPathingPawn PathingPawn;

	if (TacticalController.Pres != none && TacticalController.Pres.ScreenStack != none)
	{
		ReplayScreen = TacticalController.Pres.ScreenStack.GetScreen(class'UIReplay');
		if (ReplayScreen != none)
		{
			`log("Coop follower: the stock replay screen was still in the stack; closing it now", , 'X2TC');
			ReplayScreen.CloseScreen();
		}
	}

	PathingPawn = TacticalController.m_kPathingPawn;
	if (PathingPawn == none || !PathingPawn.bHidden)
	{
		return;
	}
	ActiveUnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(TacticalController.GetActiveUnitStateRef().ObjectID));
	if (ActiveUnitState == none || XGUnit(ActiveUnitState.GetVisualizer()) == none)
	{
		return;
	}
	PathingPawn.SetVisible(true);
	PathingPawn.SetActive(XGUnit(ActiveUnitState.GetVisualizer()));
	if (!bPawnForceLogged)
	{
		bPawnForceLogged = true;
		`log("Coop follower: pathing pawn was hidden; shown on unit" @ ActiveUnitState.ObjectID @ "(hidden now=" $ PathingPawn.bHidden $ ")", , 'X2TC');
	}
}

// Run 8 (0.4.1): with the pawn visible (Run 7), its destination still didn't follow the
// mouse in move mode, while it did during ability targeting (path of 2+ tiles=True only
// in UsingTargetingMethod). Move mode reads the unit's reachable-tiles cache
// (XComPathingPawn.SetActive L451-468: ActiveCache = the XGUnit's
// m_kReachableTilesCache), which keeps a unit state and a history index of its own
// (X2ReachableTilesCache.uc L30-41) and on the guest is never refreshed by the normal
// turn loop. Refresh it with the unit's current state, and re-activate the pawn: when the
// input comes on, when the active unit changes, after each catch-up, and when the input
// state returns to move mode (after targeting; Kc: the line stayed frozen after Esc).
function RefreshPathingIfNeeded(XComTacticalController TacticalController)
{
	local name InputStateName;
	local int ActiveUnitID;
	local string Reason;

	InputStateName = TacticalController.GetInputState();
	ActiveUnitID = TacticalController.GetActiveUnitStateRef().ObjectID;

	if (ActiveUnitID != LastRefreshUnitID)
	{
		Reason = "unit changed";
	}
	else if (CurrentHistoryFrame != LastRefreshFrame && !bBehind)
	{
		Reason = "new frames";
	}
	else if (InputStateName == GUEST_INPUT_STATE && LastSeenInputState != GUEST_INPUT_STATE)
	{
		Reason = "back to move mode from" @ LastSeenInputState;
	}
	LastSeenInputState = InputStateName;

	if (Reason == "" || InputStateName != GUEST_INPUT_STATE)
	{
		return;
	}
	LastRefreshUnitID = ActiveUnitID;
	LastRefreshFrame = CurrentHistoryFrame;
	RefreshPathing(TacticalController, Reason);
}

function RefreshPathing(XComTacticalController TacticalController, string Reason)
{
	local XComGameState_Unit UnitState;
	local XGUnit UnitVisualizer;
	local TTile Origin;
	local float MaxCost;

	UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(TacticalController.GetActiveUnitStateRef().ObjectID));
	if (UnitState != none)
	{
		UnitVisualizer = XGUnit(UnitState.GetVisualizer());
	}
	if (UnitVisualizer == none || UnitVisualizer.m_kReachableTilesCache == none || TacticalController.m_kPathingPawn == none)
	{
		return;
	}
	if (bFixWorldSync)
	{
		// Fix C (Run 8 toggle): sync the world's visualizers and tile data to the history
		// (XComWorldData.SyncVisualizers L754), as stock multiplayer's follower once did
		// on receiving a history (commented out in XComMPReplayMgr.uc L80-82).
		`XWORLD.SyncVisualizers();
		Reason $= ", world synced";
	}
	UnitVisualizer.m_kReachableTilesCache.SetCacheUnit(UnitState);
	UnitVisualizer.m_kReachableTilesCache.ForceCacheUpdate();
	UnitVisualizer.m_kReachableTilesCache.UpdateTileCacheIfNeeded();
	UnitVisualizer.m_kReachableTilesCache.GetCacheOriginAndMaxCost(Origin, MaxCost);
	TacticalController.m_kPathingPawn.SetActive(UnitVisualizer);
	`log("Coop follower: pathing refreshed (" $ Reason $ "): unit" @ UnitState.ObjectID @ "action points=" $ UnitState.NumAllActionPoints() @ "cache origin=" $ TileText(Origin) @ "max cost=" $ MaxCost @ "frame" @ CurrentHistoryFrame, , 'X2TC');
}

// Run 7: Kc saw the selection stay on a soldier with no actions left; the game's own
// "select the next unit" runs in the ruleset's UnitActions state, which the guest's
// ruleset never enters. Move the selection to the next unit with action points.
function SkipUnitWithoutActions(XComTacticalController TacticalController)
{
	local XComGameState_Unit ActiveUnitState, UnitState;
	local int i;

	if (bBehind || class'XComGameStateVisualizationMgr'.static.VisualizerBusy())
	{
		return;
	}
	ActiveUnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(TacticalController.GetActiveUnitStateRef().ObjectID));
	if (ActiveUnitState == none || ActiveUnitState.NumAllActionPoints() > 0)
	{
		return;
	}
	// Try each XCOM unit once, through the same selection the NEXT SOLDIER button uses.
	for (i = 0; i < 8; i++)
	{
		if (SelectGuestUnit(TacticalController, 1) <= 0)
		{
			return;
		}
		UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(TacticalController.GetActiveUnitStateRef().ObjectID));
		if (UnitState != none && UnitState.NumAllActionPoints() > 0)
		{
			`log("Coop follower: unit" @ ActiveUnitState.ObjectID @ "has no actions left; selected unit" @ UnitState.ObjectID, , 'X2TC');
			return;
		}
		if (UnitState == ActiveUnitState)
		{
			break;
		}
	}
}

// "pawn hidden=... state=... dest=X,Y,Z unit tile=X,Y,Z cursor tile=X,Y,Z" for the
// diagnostics. The destination equal to the unit's own tile while the cursor is
// elsewhere would mean no reachable tiles were found.
function string PathingPawnText(XComTacticalController TacticalController, XComGameState_Unit ActiveUnitState)
{
	local XComPathingPawn PathingPawn;
	local TTile CursorTile, UnitTile;
	local vector CursorLocation;

	PathingPawn = TacticalController.m_kPathingPawn;
	if (PathingPawn == none)
	{
		return "pawn=none";
	}
	if (ActiveUnitState != none)
	{
		UnitTile = ActiveUnitState.TileLocation;
	}
	CursorLocation = `CURSOR.Location;
	CursorTile = `XWORLD.GetTileCoordinatesFromPosition(CursorLocation);
	return "pawn hidden=" $ PathingPawn.bHidden @ "state=" $ PathingPawn.GetStateName()
		@ "replay screen in stack=" $ (TacticalController.Pres != none && TacticalController.Pres.ScreenStack != none && TacticalController.Pres.ScreenStack.IsInStack(class'UIReplay'))
		@ "dest=" $ TileText(PathingPawn.LastDestinationTile) @ "unit tile=" $ TileText(UnitTile)
		@ "cursor tile=" $ TileText(CursorTile);
}

static function string TileText(TTile Tile)
{
	return Tile.X $ "," $ Tile.Y $ "," $ Tile.Z;
}

// Run 6 fallback for moves: the tile under the 3D cursor, sent as a one-tile move; the
// host builds the path itself (X2TC_CoopSession). For the guest's MOVE TO CURSOR button.
function MoveActiveUnitToCursor()
{
	local XComTacticalController TacticalController;
	local X2TC_CoopSession Session;
	local array<TTile> Tiles;
	local TTile CursorTile;
	local vector CursorLocation;
	local int UnitID;

	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	Session = class'X2TC_CoopSession'.static.FindGuestSession();
	if (TacticalController == none || Session == none || !bGuestInputOn)
	{
		`log("Coop follower: MOVE TO CURSOR ignored (input on=" $ bGuestInputOn $ ")", , 'X2TC');
		return;
	}
	UnitID = TacticalController.GetActiveUnitStateRef().ObjectID;
	CursorLocation = `CURSOR.Location;
	if (!`XWORLD.GetFloorTileForPosition(CursorLocation, CursorTile))
	{
		CursorTile = `XWORLD.GetTileCoordinatesFromPosition(CursorLocation);
	}
	Tiles.AddItem(CursorTile);
	`log("Coop follower: MOVE TO CURSOR: unit" @ UnitID @ "to tile" @ TileText(CursorTile), , 'X2TC');
	Session.SendGuestMove(UnitID, Tiles, `XCOMHISTORY.GetNumGameStates());
}

function SetGuestInput(XComTacticalController TacticalController, bool bOn)
{
	bGuestInputOn = bOn;
	bPawnForceLogged = false;
	LastRefreshUnitID = -1; // refresh the pathing at the next tick with input on
	if (bOn)
	{
		if (TacticalController.GetActiveUnitStateRef().ObjectID <= 0)
		{
			SelectGuestUnit(TacticalController, 1);
		}
		TacticalController.SetInputState(GUEST_INPUT_STATE);
		`log("Coop follower: input on (state" @ TacticalController.GetInputState() $ ", active unit" @ TacticalController.GetActiveUnitStateRef().ObjectID $ ", ruleset state" @ `TACTICALRULES.GetStateName() $ ", frame" @ CurrentHistoryFrame $ ")", , 'X2TC');
	}
	else
	{
		TacticalController.SetInputState(REPLAY_INPUT_STATE);
		`log("Coop follower: input off (state" @ TacticalController.GetInputState() $ ", frame" @ CurrentHistoryFrame $ ")", , 'X2TC');
	}
}

// Selects the next (Direction 1) or previous (-1) XCOM unit the game lets the player
// select, after the current one, with Visualizer_SelectUnit (XComTacticalController.uc
// L189-260), because the game's own unit cycling is switched off while the replay
// manager is a tutorial manager (L540-544). Returns the selected unit's ID or 0.
function int SelectGuestUnit(XComTacticalController TacticalController, int Direction)
{
	local array<XComGameState_Unit> Units;
	local XComGameState_Unit UnitState;
	local int i, Start, Index;

	foreach `XCOMHISTORY.IterateByClassType(class'XComGameState_Unit', UnitState)
	{
		if (UnitState.GetTeam() == eTeam_XCom && !UnitState.IsDead() && !UnitState.IsIncapacitated()
			&& !UnitState.bRemovedFromPlay && !UnitState.GetMyTemplate().bIsCosmetic)
		{
			Units.AddItem(UnitState);
		}
	}
	if (Units.Length == 0)
	{
		`log("Coop follower: no XCOM unit to select", , 'X2TC');
		return 0;
	}

	Start = 0;
	for (i = 0; i < Units.Length; i++)
	{
		if (Units[i].ObjectID == TacticalController.GetActiveUnitStateRef().ObjectID)
		{
			Start = i + Direction;
			break;
		}
	}

	for (i = 0; i < Units.Length; i++)
	{
		Index = ((Start + i * Direction) % Units.Length + Units.Length) % Units.Length;
		if (TacticalController.Visualizer_SelectUnit(Units[Index]))
		{
			`log("Coop follower: selected unit" @ Units[Index].ObjectID, , 'X2TC');
			return Units[Index].ObjectID;
		}
	}
	`log("Coop follower: the game refused to select any of" @ Units.Length @ "XCOM units", , 'X2TC');
	return 0;
}

// For the guest's NEXT SOLDIER button (X2TC_CoopListener).
function SelectNextGuestUnit()
{
	local XComTacticalController TacticalController;

	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (TacticalController == none || !bInputPhase)
	{
		`log("Coop follower: NEXT SOLDIER ignored (input phase=" $ bInputPhase $ ")", , 'X2TC');
		return;
	}
	SelectGuestUnit(TacticalController, 1);
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
	local string AbilityKey;

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
			return true; // as for abilities below (Run 6)
		}
		`log("Coop follower: captured a move but found no guest session", , 'X2TC');
		return false;
	}

	// Stage 5b (pulled into Run 4): abilities go to the host too. The UI re-submits a
	// refused activation (Run 2: each ability two or three times), so an identical capture
	// within a second is not sent again.
	AbilityKey = AbilityContext.InputContext.AbilityTemplateName $ "/" $ AbilityContext.InputContext.SourceObject.ObjectID $ "/" $ AbilityContext.InputContext.PrimaryTarget.ObjectID;
	if (AbilityKey == LastAbilityKey && WorldInfo.RealTimeSeconds - LastAbilityTime < 1.0)
	{
		`log("Coop follower: captured ability" @ AbilityContext.InputContext.AbilityTemplateName @ "again within 1 s; not sent twice", , 'X2TC');
		return false;
	}
	LastAbilityKey = AbilityKey;
	LastAbilityTime = WorldInfo.RealTimeSeconds;

	if (Session != none)
	{
		Session.SendGuestAbility(AbilityContext, FramesBefore);
		// Run 6 (0.3.9): report success for a forwarded ability. In tutorial mode
		// ActivateAbility takes the non-latent path, whose result is this return value
		// (XComGameStateContext_Ability.uc L1348-1351, L1451); false left the targeting UI
		// open (Run 5) and made the UI submit again. Nothing is applied on the guest either
		// way: the ruleset returns this value without adding anything
		// (X2GameRuleset.uc L290-293).
		return true;
	}
	`log("Coop follower: captured ability" @ AbilityContext.InputContext.AbilityTemplateName @ "but found no guest session", , 'X2TC');
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
	// Off until the XCOM input phase (Run 1: on from the start played the tutorial intro).
	bInTutorial=false
	bFixCache=true
	bFixHistoryIndex=false
	bFixWorldSync=false
	bFixFreshPawn=true
}
