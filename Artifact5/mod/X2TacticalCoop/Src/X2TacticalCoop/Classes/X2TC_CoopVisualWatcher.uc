//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopVisualWatcher
//
//  What it changes: while connected in co-op, two visuals that the game skips because the
//  engine reports multiplayer are done as in single player, on both PCs, by watching the
//  current visualization tree (plans/m4-plan.md, "Visual watcher"; 0.8.2 items 7-8). It
//  changes no game state, template or class; it only adds a fog viewer, forced
//  visibility, and a camera, as the stock actions would.
//    - Fog (switch "Reveal shooters in the fog"): an executing X2Action_ExitCover whose
//      fog reveal was skipped (ShouldRevealFOW returns false in multiplayer,
//      X2Action_ExitCover.uc L500-505) gets what HideFOW (L401-422) does: a 3 m fog viewer
//      at the unit, and the unit forced visible. The viewer is this watcher's own (not the
//      AI player's), destroyed when the same context's X2Action_EnterCover has finished
//      (whose RestoreFOW, X2Action_EnterCover.uc L342-356, clears the forced visibility in
//      every mode) or when the action has left the tree.
//    - Camera (switch "Camera: watcher (no override)"): an X2Action_CameraFollowUnit that
//      finished without a camera (ShouldCameraFrameAction false in multiplayer,
//      X2Action_CameraFollowUnit.uc L47-61), while its move is still going, gets the camera
//      its Begin label (L63-81) would have made: an X2Camera_FollowMovingUnit with the
//      action's tag. The stock X2Action_CameraRemove at the move's end removes it by tag
//      (X2VisualizerHelpers.uc L382-386), as it would the stock one. With the 0.8.0
//      override on, the action makes its own camera and the watcher stays idle.
//      Differences from stock: the stock action waits for its camera to arrive before the
//      move goes on (L77-80); the watcher can't hold the action. A unit newly selected by
//      the player is skipped, as in the stock action.
//  0.8.3: its tick also drives the partner's lag samples (X2TC_CoopSession.LagTick,
//  X2TC_CoopLagLog); logging only.
//  One log line per handled action (capped per map). Spawned once per co-op map by
//  X2TC_CoopSession (with the map cleanup actor); does nothing outside a session.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComGameStateVisualizationMgr.uc (VisualizationTree L117,
//                                                       GetNodesOfType L459)
//    XComGame\Classes\X2Action.uc                      (StateChangeContext L25, Metadata L26,
//                                                       Unit/UnitPawn L44-45, bNewUnitSelected L54,
//                                                       bCompleted L55)
//    XComGame\Classes\X2Action_ExitCover.uc            (bSkipExitCoverVisualization L23,
//                                                       bSkipFOWReveal L26, HideFOW L401-422,
//                                                       Begin L540-555)
//    XComGame\Classes\X2Action_CameraFollowUnit.uc     (AbilityToFrame, bLockFloorZ, FollowCamera,
//                                                       CameraTag; Begin L63-81)
//    XComGame\Classes\XComWorldData.uc                 (CreateFOWViewer L749, DestroyFOWViewer
//                                                       L750, WORLD_FloorHeight L56)
//    XComGame\Classes\XGUnitNativeBase.uc              (SetForceVisibility L1689)
//---------------------------------------------------------------------------------------

class X2TC_CoopVisualWatcher extends Actor dependson(X2GameRulesetVisibilityInterface);

const MAX_LOG_LINES = 30;

struct CoopFogReveal
{
	var X2Action ExitAction;
	var XComGameStateContext Context;
	var XGUnit RevealUnit;
	var Actor Viewer;
};

var array<CoopFogReveal> Reveals;     // fog viewers this watcher made, still up
var array<X2Action> HandledExits;      // exit-cover actions already looked at
var array<X2Action> CameraSeenWaiting; // camera actions seen before they started
var array<X2Action> HandledCameras;    // camera actions already looked at
var int LogLines;

// One watcher in this map (called by X2TC_CoopSession at HOST and when the guest's
// follower is installed).
static function EnsureInMap()
{
	local WorldInfo World;
	local X2TC_CoopVisualWatcher Existing;

	World = class'WorldInfo'.static.GetWorldInfo();
	if (World == none)
	{
		return;
	}
	foreach World.DynamicActors(class'X2TC_CoopVisualWatcher', Existing)
	{
		return;
	}
	if (World.Spawn(class'X2TC_CoopVisualWatcher') == none)
	{
		`log("Coop watcher: couldn't spawn the visual watcher", , 'X2TC');
	}
	else
	{
		`log("Coop watcher: visual watcher ready (fog reveal, camera)", , 'X2TC');
	}
}

event Tick(float DeltaTime)
{
	local XComGameStateVisualizationMgr VisMgr;
	local XComEngine Engine;
	local X2Action Tree;

	super.Tick(DeltaTime);
	Engine = `XENGINE;
	if (Engine == none || !Engine.IsMultiPlayerGame() || !class'X2TC_CoopSession'.static.IsSessionActive())
	{
		RemoveAllReveals();
		return;
	}
	// 0.8.3: the lag lines sample the partner's screen from here (logging only).
	class'X2TC_CoopSession'.static.FindSession().LagTick();
	VisMgr = `XCOMVISUALIZATIONMGR;
	Tree = VisMgr != none ? VisMgr.VisualizationTree : none;
	UpdateReveals(VisMgr, Tree);
	if (Tree == none)
	{
		HandledExits.Length = 0;
		CameraSeenWaiting.Length = 0;
		HandledCameras.Length = 0;
		return;
	}
	if (class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_FOG_REVEAL))
	{
		WatchExitCover(VisMgr, Tree);
	}
	if (class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_WATCHER_CAMERA))
	{
		WatchCamera(VisMgr, Tree);
	}
}

// Fog: an exit-cover action that started and would have revealed in single player.
function WatchExitCover(XComGameStateVisualizationMgr VisMgr, X2Action Tree)
{
	local array<X2Action> Nodes;
	local X2Action_ExitCover ExitAction;
	local CoopFogReveal Reveal;
	local vector RevealLocation;
	local int i;

	VisMgr.GetNodesOfType(Tree, class'X2Action_ExitCover', Nodes);
	for (i = 0; i < Nodes.Length; i++)
	{
		ExitAction = X2Action_ExitCover(Nodes[i]);
		if (ExitAction == none || HandledExits.Find(ExitAction) != INDEX_NONE || !ExitAction.IsInState('Executing'))
		{
			continue;
		}
		HandledExits.AddItem(ExitAction);
		if (ExitAction.bSkipExitCoverVisualization || ExitAction.bSkipFOWReveal || ExitAction.Unit == none || ExitAction.UnitPawn == none)
		{
			continue; // single player wouldn't reveal either
		}
		RevealLocation = ExitAction.UnitPawn.Location;
		RevealLocation.Z += class'XComWorldData'.const.WORLD_FloorHeight;
		Reveal.ExitAction = ExitAction;
		Reveal.Context = ExitAction.StateChangeContext;
		Reveal.RevealUnit = ExitAction.Unit;
		Reveal.Viewer = `XWORLD.CreateFOWViewer(RevealLocation, 3); // 3 meters, as HideFOW
		ExitAction.Unit.SetForceVisibility(eForceVisible);
		ExitAction.UnitPawn.UpdatePawnVisibility();
		Reveals.AddItem(Reveal);
		WatchLog("fog reveal for unit" @ ExitAction.Unit.ObjectID @ "(viewer" @ (Reveal.Viewer != none) $ ")");
	}
}

// Fog viewers end when the same context's enter-cover has finished, or the exit-cover
// action has left the tree.
function UpdateReveals(XComGameStateVisualizationMgr VisMgr, X2Action Tree)
{
	local array<X2Action> Nodes, EnterNodes;
	local int i, j;
	local bool bDone;

	if (Reveals.Length == 0)
	{
		return;
	}
	if (Tree != none)
	{
		VisMgr.GetNodesOfType(Tree, class'X2Action_ExitCover', Nodes);
		VisMgr.GetNodesOfType(Tree, class'X2Action_EnterCover', EnterNodes);
	}
	for (i = Reveals.Length - 1; i >= 0; i--)
	{
		bDone = Reveals[i].ExitAction == none || Nodes.Find(Reveals[i].ExitAction) == INDEX_NONE;
		for (j = 0; !bDone && j < EnterNodes.Length; j++)
		{
			if (EnterNodes[j] != none && EnterNodes[j].bCompleted && EnterNodes[j].Unit == Reveals[i].RevealUnit
				&& EnterNodes[j].StateChangeContext == Reveals[i].Context)
			{
				bDone = true;
			}
		}
		if (bDone)
		{
			if (Reveals[i].Viewer != none)
			{
				`XWORLD.DestroyFOWViewer(Reveals[i].Viewer);
			}
			Reveals.Remove(i, 1);
		}
	}
}

function RemoveAllReveals()
{
	local int i;

	for (i = 0; i < Reveals.Length; i++)
	{
		if (Reveals[i].Viewer != none)
		{
			`XWORLD.DestroyFOWViewer(Reveals[i].Viewer);
		}
	}
	Reveals.Length = 0;
}

// Camera: a follow-camera action seen waiting, then finished without a camera, while its
// move hasn't ended.
function WatchCamera(XComGameStateVisualizationMgr VisMgr, X2Action Tree)
{
	local array<X2Action> Nodes, RemoveNodes;
	local X2Action_CameraFollowUnit CameraAction;
	local X2Camera_FollowMovingUnit FollowCamera;
	local X2AbilityTemplate AbilityTemplate;
	local bool bMoveOver;
	local int i, j;

	VisMgr.GetNodesOfType(Tree, class'X2Action_CameraFollowUnit', Nodes);
	for (i = 0; i < Nodes.Length; i++)
	{
		CameraAction = X2Action_CameraFollowUnit(Nodes[i]);
		if (CameraAction == none || HandledCameras.Find(CameraAction) != INDEX_NONE)
		{
			continue;
		}
		if (CameraAction.IsInState('WaitingToStart'))
		{
			if (CameraSeenWaiting.Find(CameraAction) == INDEX_NONE)
			{
				CameraSeenWaiting.AddItem(CameraAction);
			}
			continue;
		}
		if (!CameraAction.bCompleted)
		{
			continue; // still deciding, or its own camera is arriving
		}
		HandledCameras.AddItem(CameraAction);
		if (CameraSeenWaiting.Find(CameraAction) == INDEX_NONE || CameraAction.FollowCamera != none
			|| CameraAction.bNewUnitSelected || CameraAction.AbilityToFrame == none)
		{
			continue; // seen too late, it made its own camera, or the player selected another unit
		}
		bMoveOver = false;
		VisMgr.GetNodesOfType(Tree, class'X2Action_CameraRemove', RemoveNodes);
		for (j = 0; j < RemoveNodes.Length; j++)
		{
			if (RemoveNodes[j] != none && RemoveNodes[j].bCompleted && RemoveNodes[j].StateChangeContext == CameraAction.StateChangeContext)
			{
				bMoveOver = true;
			}
		}
		if (bMoveOver || XGUnit(CameraAction.Metadata.VisualizeActor) == none)
		{
			continue;
		}
		// as X2Action_CameraFollowUnit's Begin (L66-73)
		FollowCamera = new class'X2Camera_FollowMovingUnit';
		FollowCamera.Unit = XGUnit(CameraAction.Metadata.VisualizeActor);
		FollowCamera.MoveAbility = CameraAction.AbilityToFrame;
		AbilityTemplate = class'X2AbilityTemplateManager'.static.GetAbilityTemplateManager().FindAbilityTemplate(CameraAction.AbilityToFrame.InputContext.AbilityTemplateName);
		if (AbilityTemplate != none)
		{
			FollowCamera.Priority = AbilityTemplate.CameraPriority;
		}
		FollowCamera.bLockFloorZ = CameraAction.bLockFloorZ;
		FollowCamera.CameraTag = CameraAction.CameraTag;
		`CAMERASTACK.AddCamera(FollowCamera);
		WatchLog("follow camera added for unit" @ CameraAction.AbilityToFrame.InputContext.SourceObject.ObjectID @ "(tag" @ CameraAction.CameraTag $ ")");
	}
}

function WatchLog(string Text)
{
	if (LogLines < MAX_LOG_LINES)
	{
		LogLines++;
		if (class'X2TC_CoopFixes'.static.Verbose()) `log("Coop watcher:" @ Text, , 'X2TC');
	}
}

event Destroyed()
{
	RemoveAllReveals();
	super.Destroyed();
}

defaultproperties
{
	bHidden = true
}
