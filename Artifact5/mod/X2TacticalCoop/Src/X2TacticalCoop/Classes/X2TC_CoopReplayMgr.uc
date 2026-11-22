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
//  Stage 6 (0.5.0): selection (NEXT SOLDIER, Tab, the automatic skip) only lands on the
//  guest's own soldiers (X2TC_CoopOwnership, P2) and moves off P1's; the start and end
//  of XCOM's input phase are passed to the session (its "ready" lasts one turn).
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
var float LastStateLogTime; // Run 8: the 0.5 s move-state line
var int LastRefreshUnitID;  // Run 8: the unit, frame and input state of the last pathing refresh
var int LastRefreshFrame;
var name LastSeenInputState;
var float LastAbilityTime; // its WorldInfo.RealTimeSeconds
var array<name> LoggedTutorialCalls; // tutorial functions already logged once
var int LastSkipFromUnitID; // Stage 6: the P1 soldier the selection last moved off (retried after new frames)
var int MissionEndFrameSeen;     // 0.5.3: the end-of-battle frame the replay passed (-1 = none)
var float MissionEndSeenTime;    // its WorldInfo.RealTimeSeconds
var bool bMissionOver;           // "mission over" handed to the session; no more input
var bool bLoggedNoneCanAct;      // 0.8.0: "none of the guest's soldiers can act" logged once
var bool bTutorialControlsSet;   // 0.8.0: this follower turned bIsTutorialAllowingControls on
var string LastTutorialControlsWhy; // 0.8.0: the reason last logged for that flag
var string LastHackAvailability;    // 0.8.1: the last logged hack-ability line
var int ObjectChecks;               // 0.8.2: map-object checks so far (X2TC_CoopObjectLink)

const MISSION_END_WAIT_SECONDS = 8.0; // 0.5.3: longest wait for the visualizer after the end frame

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
	local int EndFrame;

	if (CurrentHistoryFrame > TurnScanFrame)
	{
		class'X2TC_CoopSession'.static.LogTurnBegins("guest", TurnScanFrame + 1, CurrentHistoryFrame);
		// 0.5.3: the end of the battle, passed by the replay.
		if (MissionEndFrameSeen < 0)
		{
			EndFrame = class'X2TC_CoopSession'.static.FindGameEndFrame(TurnScanFrame + 1, CurrentHistoryFrame);
			if (EndFrame >= 0)
			{
				MissionEndFrameSeen = EndFrame;
				MissionEndSeenTime = WorldInfo.RealTimeSeconds;
				`log("Coop mission end (guest): the replay passed the end-of-battle frame" @ EndFrame @ "(replay frame" @ CurrentHistoryFrame $ ", history frames=" $ `XCOMHISTORY.GetNumGameStates() $ "); waiting for the visualizer", , 'X2TC');
			}
		}
		TurnScanFrame = CurrentHistoryFrame;
	}
}

// 0.5.3: once the end of the battle has been shown (caught up and the visualizer idle,
// or MISSION_END_WAIT_SECONDS after it was passed), the guest's input goes off for good
// and the session shows "mission over".
function CheckMissionEnd()
{
	local X2TC_CoopSession Session;
	local bool bIdle;

	if (MissionEndFrameSeen < 0 || bMissionOver)
	{
		return;
	}
	bIdle = !bBehind && !class'XComGameStateVisualizationMgr'.static.VisualizerBusy();
	if (!bIdle && WorldInfo.RealTimeSeconds - MissionEndSeenTime < MISSION_END_WAIT_SECONDS)
	{
		return;
	}
	bMissionOver = true;
	`log("Coop mission end (guest): shown (idle=" $ bIdle $ ", waited" @ (WorldInfo.RealTimeSeconds - MissionEndSeenTime) $ "s)", , 'X2TC');
	Session = class'X2TC_CoopSession'.static.FindGuestSession();
	if (Session != none)
	{
		Session.OnGuestMissionEnd(MissionEndFrameSeen);
	}
	else
	{
		`log("Coop mission end (guest): no guest session to tell", , 'X2TC');
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
			// 0.8.1 (0.8.0b Run 2: enemy turns played longer on the guest): outside XCOM's
			// turn, once the visualizer is idle, build every pending frame in one step
			// (bStepAll, XComReplayMgr.StepReplayForward L104, L139), as live play builds
			// the AI's frames together, so parallel visuals can merge. A guess that this is
			// the main cause. Fix switch: "Partner: faster enemy turns".
			if (!IsXComTurn() && !class'XComGameStateVisualizationMgr'.static.VisualizerBusy()
				&& class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_STEP_ALL))
			{
				StepReplayForward(true);
			}
			else
			{
				StepReplayForward();
			}
			ScanTurnBegins();
			class'X2TC_CoopSession'.static.GuestCheckHackResult(); // 0.8.1
		}
		else if (bBehind)
		{
			bBehind = false;
			LastSkipFromUnitID = 0;
			`log("Coop guest: replayed to frame" @ CurrentHistoryFrame @ "(history frames=" $ `XCOMHISTORY.GetNumGameStates() $ ")", , 'X2TC');
		}

		UpdateGuestInput();
		CheckMissionEnd();
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
	bWantPhase = IsXComTurn() && (bInputPhase || (!bBehind && Rules.IsInState('PerformingReplay')))
		&& MissionEndFrameSeen < 0; // 0.5.3: no input after the end of the battle
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
		TellSessionInputPhase(true);
		// 0.8.2: map objects against the host's states (objective hacks); detail the first time.
		ObjectChecks++;
		class'X2TC_CoopObjectLink'.static.CheckObjects("XCOM turn" @ ObjectChecks, ObjectChecks == 1);
	}
	else if (!bWantPhase && bInputPhase)
	{
		SetGuestInput(TacticalController, false);
		bInputPhase = false;
		bInTutorial = false;
		HideAbilityShine(); // 0.8.1: RefreshShine does nothing once tutorial mode is off
		`log("Coop follower: XCOM input phase ends (tutorial mode off, ruleset state" @ Rules.GetStateName() $ ", frame" @ CurrentHistoryFrame $ ")", , 'X2TC');
		TellSessionInputPhase(false);
	}

	if (bGuestInputOn)
	{
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

	// 0.5.1: and only with a soldier to control (NO SOLDIERS ASSIGNED otherwise).
	bWant = bInputPhase && !bBehind && !class'XComGameStateVisualizationMgr'.static.VisualizerBusy() && HasControllableSoldier();
	if (bWant != bGuestInputOn)
	{
		SetGuestInput(TacticalController, bWant);
	}
	UpdateTutorialControls(TacticalController);
	if (bInputPhase)
	{
		HideAbilityShine(); // 0.8.1
		LogHackAvailability(TacticalController); // 0.8.1 diagnostics
	}
}

// 0.8.1 diagnostics (0.8.0b Run 2: the guest's Specialist couldn't use an access point,
// and nothing was captured): the selected unit's hack-type abilities and the code the
// game gives each (the HUD shows a hack icon only for AA_Success, UITacticalHUD_
// AbilityContainer ShouldShowAbilityIcon). Logged when the line changes.
function LogHackAvailability(XComTacticalController TacticalController)
{
	local X2TacticalGameRuleset Rules;
	local GameRulesCache_Unit UnitCache;
	local XComGameState_Ability AbilityState;
	local string Line, TemplateText;
	local int i;

	Rules = `TACTICALRULES;
	if (Rules == none || TacticalController.GetActiveUnitStateRef().ObjectID <= 0
		|| !Rules.GetGameRulesCache_Unit(TacticalController.GetActiveUnitStateRef(), UnitCache))
	{
		return;
	}
	for (i = 0; i < UnitCache.AvailableActions.Length; i++)
	{
		AbilityState = XComGameState_Ability(`XCOMHISTORY.GetGameStateForObjectID(UnitCache.AvailableActions[i].AbilityObjectRef.ObjectID));
		if (AbilityState == none)
		{
			continue;
		}
		TemplateText = string(AbilityState.GetMyTemplateName());
		if (InStr(TemplateText, "Hack") != INDEX_NONE || InStr(TemplateText, "Intrusion") != INDEX_NONE)
		{
			Line @= TemplateText $ "=" $ UnitCache.AvailableActions[i].AvailableCode $ "(targets " $ UnitCache.AvailableActions[i].AvailableTargets.Length $ ")";
		}
	}
	if (Line != "" && Line != LastHackAvailability)
	{
		LastHackAvailability = Line;
		`log("Coop follower: hack abilities of unit" @ TacticalController.GetActiveUnitStateRef().ObjectID $ ":" $ Line, , 'X2TC');
	}
}

// 0.8.0 (no move range or cover icons on the guest, Stage 7 Run 2 and 8.1): in tutorial
// mode the move input's Tick hides the path, both move-range borders and the cover icons
// unless the tutorial manager's bIsTutorialAllowingControls is on (XComTacticalInput.uc
// L1905-1925: SetPathingUIVisible(false, false) every frame; ActionIconMgr.ShowIcons and
// the Volume's BorderComponent(Dashing).SetUIHidden in L1821-1848). The tutorial turns it
// on only in PlayUntilPlayerInputRequired.EndState (XComTutorialMgr.uc L628), which this
// follower never enters. Its only script readers are those two lines (L1910-1911); any
// native reader is unknown, so changes are logged. On while the guest's input is on and
// its selected soldier can act (the conditions under which the game shows them itself,
// L1893-1903); off otherwise. Fix switch: "Partner's move range and cover icons".
function UpdateTutorialControls(XComTacticalController TacticalController)
{
	local XComGameState_Unit ActiveUnitState;
	local bool bAllow;
	local string Why;

	if (!class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_GUEST_BORDERS))
	{
		if (!bIsTutorialAllowingControls)
		{
			return; // never on, nothing to undo
		}
		Why = "fix switched off";
	}
	else if (!bGuestInputOn)
	{
		Why = "input off";
	}
	else
	{
		ActiveUnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(TacticalController.GetActiveUnitStateRef().ObjectID));
		if (ActiveUnitState == none || !GuestMayControl(ActiveUnitState))
		{
			Why = "the selected unit isn't the partner's";
		}
		else if (!class'X2TC_CoopOwnership'.static.UnitCanAct(ActiveUnitState))
		{
			Why = "the selected soldier can't act";
		}
		else
		{
			bAllow = true;
			Why = "partner's soldier selected, input on";
		}
	}
	if (bAllow != bIsTutorialAllowingControls)
	{
		bIsTutorialAllowingControls = bAllow;
		`log("Coop follower: tutorial controls flag" @ (bAllow ? "ON" : "OFF") @ "(" $ Why $ "; input state" @ TacticalController.GetInputState()
			@ "pawn" @ (TacticalController.m_kPathingPawn != none ? string(TacticalController.m_kPathingPawn.Name) : "none")
			@ "hidden=" $ (TacticalController.m_kPathingPawn != none && TacticalController.m_kPathingPawn.bHidden) $ ")", , 'X2TC');
	}
}

// Stage 6: a soldier the guest may select: its own (P2's), or any with the squad
// screen's "Soldier ownership" off.
function bool GuestMayControl(XComGameState_Unit UnitState)
{
	local X2TC_CoopSession Session;

	Session = class'X2TC_CoopSession'.static.FindGuestSession();
	if (Session != none && !Session.OwnershipOn())
	{
		return true;
	}
	return class'X2TC_CoopOwnership'.static.GetOwner(UnitState) == class'X2TC_CoopOwnership'.const.OWNER_GUEST;
}

// 0.5.1: true if any living soldier is one the guest may control (Run 1: with none,
// the input stayed on for a soldier given back to the host).
function bool HasControllableSoldier()
{
	local array<XComGameState_Unit> Squad;
	local int i;

	class'X2TC_CoopOwnership'.static.GetSquad(Squad);
	for (i = 0; i < Squad.Length; i++)
	{
		if (!Squad[i].IsIncapacitated() && GuestMayControl(Squad[i]))
		{
			return true;
		}
	}
	return false;
}

// 0.5.1: a left-click on a soldier selects it (Run 1: the game's own click-to-select is
// off whenever a tutorial manager exists, XComTacticalInput.uc L2846). Uses the tile
// under the 3D cursor; ignored over the HUD (XComInputBase.TestMouseConsumedByFlash L166)
// and outside move mode. Returns true if a soldier was selected.
function bool SelectUnitUnderCursor()
{
	local XComTacticalController TacticalController;
	local XComInputBase InputBase;
	local array<StateObjectReference> UnitRefs;
	local XComGameState_Unit UnitState;
	local vector CursorLocation;
	local TTile CursorTile;
	local int i;

	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (TacticalController == none || !bGuestInputOn || TacticalController.GetInputState() != GUEST_INPUT_STATE)
	{
		return false;
	}
	InputBase = XComInputBase(TacticalController.PlayerInput);
	if (InputBase != none && InputBase.TestMouseConsumedByFlash())
	{
		return false;
	}
	CursorLocation = `CURSOR.Location;
	if (!`XWORLD.GetFloorTileForPosition(CursorLocation, CursorTile))
	{
		CursorTile = `XWORLD.GetTileCoordinatesFromPosition(CursorLocation);
	}
	UnitRefs = `XWORLD.GetUnitsOnTile(CursorTile);
	for (i = 0; i < UnitRefs.Length; i++)
	{
		UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(UnitRefs[i].ObjectID));
		if (UnitState == none || UnitState.GetTeam() != eTeam_XCom
			|| UnitState.ObjectID == TacticalController.GetActiveUnitStateRef().ObjectID)
		{
			continue;
		}
		if (!GuestMayControl(UnitState))
		{
			`log("Coop follower: clicked unit" @ UnitState.ObjectID @ "is P1's; not selected", , 'X2TC');
			return false;
		}
		if (TacticalController.Visualizer_SelectUnit(UnitState))
		{
			`log("Coop follower: clicked unit" @ UnitState.ObjectID @ "selected (tile" @ TileText(CursorTile) $ ")", , 'X2TC');
			return true;
		}
	}
	return false;
}

// Stage 6: the guest's "ready to end the turn" lasts one XCOM turn.
function TellSessionInputPhase(bool bBegins)
{
	local X2TC_CoopSession Session;

	Session = class'X2TC_CoopSession'.static.FindGuestSession();
	if (Session != none)
	{
		Session.OnGuestInputPhase(bBegins);
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

// 0.8.1: fix D (ApplyFreshPawn, Run 9 / 0.4.3) removed: in 0.8.0b Run 2 it only changed a
// highlight's colour once the tutorial flag showed the move range (Kc's rule, plans/m4-plan.md).

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
	}
	LastRefreshUnitID = -1;
	`log("Coop follower: fix" @ Fix @ "now" @ (bNow ? "ON" : "OFF") @ "(A cache=" $ bFixCache @ "B history -1=" $ bFixHistoryIndex @ "C world sync=" $ bFixWorldSync $ ")", , 'X2TC');
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
		@ "fixes A=" $ bFixCache @ "B=" $ bFixHistoryIndex @ "C=" $ bFixWorldSync
		@ "tutorial controls=" $ bIsTutorialAllowingControls; // 0.8.0
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
	// Stage 6: also move off a P1 soldier (the game may select one by itself).
	if (ActiveUnitState == none || (class'X2TC_CoopOwnership'.static.UnitCanAct(ActiveUnitState) && GuestMayControl(ActiveUnitState)))
	{
		return;
	}
	if (ActiveUnitState.ObjectID == LastSkipFromUnitID && class'X2TC_CoopOwnership'.static.UnitCanAct(ActiveUnitState))
	{
		return; // already tried to move off this P1 soldier; no P2 soldier could be selected
	}
	// 0.8.0b (0.8.0 Run 1: 5508 alternating "selected unit" lines, 2885 in Stage 8.1 run 2):
	// with none of the guest's soldiers able to act, every soldier this skips to can't act
	// either, so it re-selected them every tick; each selection moves the camera back to
	// the soldier (Kc: edge scrolling snapped back). Stop until one can act again, whatever
	// the bound-skip switch says.
	if (!GuestHasSoldierThatCanAct())
	{
		if (!bLoggedNoneCanAct)
		{
			bLoggedNoneCanAct = true;
			`log("Coop follower: none of the guest's soldiers can act; selection left on unit" @ ActiveUnitState.ObjectID, , 'X2TC');
		}
		return;
	}
	LastSkipFromUnitID = ActiveUnitState.ObjectID;
	// Try each P2 soldier once, through the same selection the NEXT SOLDIER button uses.
	for (i = 0; i < 8; i++)
	{
		if (SelectGuestUnit(TacticalController, 1) <= 0)
		{
			return;
		}
		UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(TacticalController.GetActiveUnitStateRef().ObjectID));
		if (UnitState != none && class'X2TC_CoopOwnership'.static.UnitCanAct(UnitState))
		{
			`log("Coop follower: unit" @ ActiveUnitState.ObjectID @ "is P1's or has no actions left; selected unit" @ UnitState.ObjectID, , 'X2TC');
			return;
		}
		if (UnitState == ActiveUnitState)
		{
			break;
		}
	}
}

// 0.8.0b: true if any living XCOM unit the guest may control can act.
function bool GuestHasSoldierThatCanAct()
{
	local XComGameState_Unit UnitState;

	foreach `XCOMHISTORY.IterateByClassType(class'XComGameState_Unit', UnitState)
	{
		if (UnitState.GetTeam() == eTeam_XCom && !UnitState.IsDead() && !UnitState.bRemovedFromPlay
			&& !UnitState.GetMyTemplate().bIsCosmetic && GuestMayControl(UnitState)
			&& class'X2TC_CoopOwnership'.static.UnitCanAct(UnitState))
		{
			return true;
		}
	}
	return false;
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
		HidePathingUI(TacticalController);
	}
}

// 0.8.1 (0.8.0b Run 2: a path to the cursor showed while a soldier moved): leaving the move
// input state for the replay's state keeps the path, both range borders and the cover
// icons up (XComTacticalInput ActiveUnit_Moving.EndState: no SetPathingUIVisible(false)
// when the next state is InReplayPlayback; Highlander L1840-1850). Hide them the way
// SetPathingUIVisible does (Highlander L1866-1893, all public calls). Fix switch: "Partner
// hides path preview while moving".
function HidePathingUI(XComTacticalController TacticalController)
{
	local XComWorldData WorldData;
	local XComPresentationLayer Pres;

	if (!class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_PATH_HIDE))
	{
		return;
	}
	if (TacticalController.m_kPathingPawn != none)
	{
		TacticalController.m_kPathingPawn.SetVisible(false);
	}
	WorldData = class'XComWorldData'.static.GetWorldData();
	if (WorldData != none && WorldData.Volume != none)
	{
		WorldData.Volume.BorderComponent.SetUIHidden(true);
		WorldData.Volume.BorderComponentDashing.SetUIHidden(true);
	}
	Pres = `PRES;
	if (Pres != none)
	{
		Pres.GetActionIconMgr().ShowIcons(false);
		Pres.GetLevelBorderMgr().ShowBorder(false);
	}
}

// 0.8.1 (0.8.0b Run 2: every ability icon glowed on the guest): in tutorial mode each icon
// shows the tutorial shine when IsNextAbility says yes (UITacticalHUD_Ability.RefreshShine
// and ShouldShowShine, Highlander L307-337), and this follower must answer yes (other
// code hides abilities otherwise, e.g. ThrowGrenade). Hide the shine on every icon that
// shows it, during the input phase and once when it ends. Fix switch: "Partner: no glow
// on ability icons".
function HideAbilityShine()
{
	local UITacticalHUD HUD;
	local int i;

	if (!class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_GLOW))
	{
		return;
	}
	HUD = class'X2TC_CoopTurnUI'.static.GetHUD();
	if (HUD == none || HUD.m_kAbilityHUD == none)
	{
		return;
	}
	for (i = 0; i < HUD.m_kAbilityHUD.m_arrUIAbilities.Length; i++)
	{
		if (HUD.m_kAbilityHUD.m_arrUIAbilities[i] != none && HUD.m_kAbilityHUD.m_arrUIAbilities[i].bIsShiney)
		{
			HUD.m_kAbilityHUD.m_arrUIAbilities[i].HideShine();
		}
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
	local int i, Start, Index, Skipped;
	local bool bSkipSpent;

	// 0.8.0 (Stage 8.1 run 2: a soldier bound by a Viper could be selected but not used):
	// skip soldiers that can't act (X2TC_CoopOwnership.UnitCanAct: no action points, or the
	// ruleset's unit cache says no actions). Fix switch: "Partner skips soldiers that
	// can't act".
	bSkipSpent = class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_BOUND_SKIP);

	// Stage 6: only the soldiers the guest may control.
	foreach `XCOMHISTORY.IterateByClassType(class'XComGameState_Unit', UnitState)
	{
		if (UnitState.GetTeam() == eTeam_XCom && !UnitState.IsDead() && !UnitState.IsIncapacitated()
			&& !UnitState.bRemovedFromPlay && !UnitState.GetMyTemplate().bIsCosmetic
			&& GuestMayControl(UnitState))
		{
			if (bSkipSpent && !class'X2TC_CoopOwnership'.static.UnitCanAct(UnitState))
			{
				Skipped++;
				continue;
			}
			Units.AddItem(UnitState);
		}
	}
	if (Units.Length == 0)
	{
		if (Skipped > 0)
		{
			if (!bLoggedNoneCanAct)
			{
				bLoggedNoneCanAct = true; // once until a soldier is selected again
				`log("Coop follower: none of the guest's" @ Skipped @ "soldiers can act; selection unchanged", , 'X2TC');
			}
		}
		else
		{
			`log("Coop follower: no soldier the guest may control (none given to P2 on the squad screen?)", , 'X2TC');
		}
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
			bLoggedNoneCanAct = false;
			`log("Coop follower: selected unit" @ Units[Index].ObjectID, , 'X2TC');
			return Units[Index].ObjectID;
		}
	}
	`log("Coop follower: the game refused to select any of" @ Units.Length @ "XCOM units", , 'X2TC');
	return 0;
}

// For the guest's NEXT SOLDIER button (X2TC_CoopListener) and Tab.
function SelectNextGuestUnit()
{
	SelectGuestUnitStep(1);
}

// 0.5.3: the next (1) or previous (-1) soldier, during XCOM's input phase (H = previous).
function SelectGuestUnitStep(int Direction)
{
	local XComTacticalController TacticalController;

	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (TacticalController == none || !bInputPhase)
	{
		`log("Coop follower: soldier selection ignored (input phase=" $ bInputPhase $ ")", , 'X2TC');
		return;
	}
	SelectGuestUnit(TacticalController, Direction);
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

	// 0.8.0 hack routing: the guest's own hack screen submits FinalizeHack (its Hack button)
	// or CancelHack (the co-op Cancel button). Send the choice, not the ability: the host
	// plays it on its hidden copy of the screen (X2TC_CoopSession.HostDriveHack).
	if (Session != none && class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_HACK_ROUTING)
		&& SendHackChoiceIfHack(AbilityContext, Session))
	{
		return true;
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

// 0.8.0: if this context is the open hack screen's finalize or cancel ability (whatever
// the hack's template names them, UIHackingScreen.InitScreen L86-109), send the guest's
// choice (its selected reward option, or 0 to cancel) and return true.
function bool SendHackChoiceIfHack(XComGameStateContext_Ability AbilityContext, X2TC_CoopSession Session)
{
	local UIHackingScreen HackScreen;
	local name TemplateName;

	HackScreen = class'X2TC_CoopSession'.static.FindHackScreen();
	if (HackScreen == none)
	{
		return false;
	}
	TemplateName = AbilityContext.InputContext.AbilityTemplateName;
	// 0.8.2 (0.8.1 Run 1: the laptop picked and rolled on the PC's hack): a choice from the
	// host's hack (watched here) is never sent. True: nothing is applied here either.
	// Switch "Hacks: watcher can't click".
	if (class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_HACK_NO_CLICK)
		&& class'X2TC_CoopOwnership'.static.GetOwner(HackScreen.UnitState) != class'X2TC_CoopOwnership'.const.OWNER_GUEST
		&& ((HackScreen.FinalizeHackAbility != none && TemplateName == HackScreen.FinalizeHackAbility.GetMyTemplateName())
			|| (HackScreen.CancelHackAbility != none && TemplateName == HackScreen.CancelHackAbility.GetMyTemplateName())))
	{
		`log("Coop follower: captured" @ TemplateName @ "from the host's hack (watched here); dropped, not sent", , 'X2TC');
		return true;
	}
	if (HackScreen.FinalizeHackAbility != none && TemplateName == HackScreen.FinalizeHackAbility.GetMyTemplateName())
	{
		`log("Coop follower: captured" @ TemplateName @ "from this PC's hack screen (reward option" @ HackScreen.SelectedHackRewardOption $ "); sending the choice, not the ability", , 'X2TC');
		Session.SendHackChoice(HackScreen.SelectedHackRewardOption);
		return true;
	}
	if (HackScreen.CancelHackAbility != none && TemplateName == HackScreen.CancelHackAbility.GetMyTemplateName())
	{
		`log("Coop follower: captured" @ TemplateName @ "from this PC's hack screen; sending CANCEL, not the ability", , 'X2TC');
		Session.SendHackChoice(0);
		return true;
	}
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
	MissionEndFrameSeen=-1
}
