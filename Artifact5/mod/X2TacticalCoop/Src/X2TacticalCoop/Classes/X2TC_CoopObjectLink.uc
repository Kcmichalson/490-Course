//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopObjectLink
//
//  What it changes: on the co-op guest only, it checks (and, behind its switch, repairs)
//  the link between the map's interactive objects (doors, workstations, objective
//  computers) and their states in the history (plans/m4-plan.md, 0.8.2 item 3).
//  0.8.1 Run 1: the guest's Specialist got no hack icon at an objective computer; the same
//  soldier given to the host could hack it. A hack target counts only if the unit's
//  interaction points include the object (X2Condition_Interactive.uc L28-34), and a point
//  is dropped when the actor's GetInteractiveState() is None or not hackable
//  (X2Condition_UnitInteractions.uc L31-75). That lookup trusts an actor's ObjectID once
//  it's set; only an actor with ID 0 searches the history by its ActorId
//  (XComDestructibleActor.FindExistingState L235-310). The guess: the guest's actors got
//  their IDs at its own map load, and its history is now the host's, so the IDs point at
//  other objects.
//    - Diagnostic (always, while a guest session runs): each actor's ObjectID against the
//      history object whose ActorId matches it: MATCH or MISMATCH, with the matching
//      object's IsEnabled / MustBeHacked / HasBeenHacked / hack reward count. One summary.
//    - Repair (switch "Partner: re-link objects to the host's states"): for a mismatched
//      actor, the actor's own public SetObjectIDFromState (L461-467; ObjectID is
//      protectedwrite, L146) and History.SetVisualizer. SetObjectIDFromState asserts the
//      old ID was 0 or equal; a guess that asserts don't stop the shipped game (they log).
//  Called by X2TC_CoopReplayMgr at the start of each XCOM turn on the guest.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComDestructibleActor.uc       (ObjectID L146, FindExistingState
//                                                     L235-310, SetObjectIDFromState L461)
//    XComGame\Classes\XComInteractiveLevelActor.uc   (GetInteractiveState L289)
//    XComGame\Classes\XComGameState_Destructible.uc  (ActorId L17)
//    XComGame\Classes\XComGameState_InteractiveObject.uc (IsEnabled L39, MustBeHacked L526,
//                                                     HasBeenHacked L851, GetHackRewards L861)
//    XComGame\Classes\XComGameStateHistory.uc        (SetVisualizer L454)
//    Engine\Classes\Actor.uc                         (GetActorId L2524)
//---------------------------------------------------------------------------------------

class X2TC_CoopObjectLink extends Object;

const MAX_DETAIL_LINES = 40;

// bDetail: log one line per mismatched or hackable object (the first check); otherwise
// only the summary and repairs.
static function CheckObjects(string Why, bool bDetail)
{
	local WorldInfo World;
	local XComGameStateHistory History;
	local XComInteractiveLevelActor LevelActor;
	local XComGameState_InteractiveObject ObjectState, MatchState;
	local XComGameState_BaseObject ByIDState;
	local array<XComGameState_InteractiveObject> States;
	local ActorIdentifier ActorIdent;
	local bool bRepair, bMismatch;
	local int i, Total, Mismatched, NoState, Hackable, Repaired, Lines;
	local string Text;

	World = class'WorldInfo'.static.GetWorldInfo();
	History = `XCOMHISTORY;
	if (World == none || History == none)
	{
		return;
	}
	bRepair = class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_RELINK_OBJECTS);
	foreach History.IterateByClassType(class'XComGameState_InteractiveObject', ObjectState)
	{
		States.AddItem(ObjectState);
	}

	foreach World.AllActors(class'XComInteractiveLevelActor', LevelActor)
	{
		Total++;
		ActorIdent = LevelActor.GetActorId();
		MatchState = none;
		for (i = 0; i < States.Length; i++)
		{
			if (States[i].ActorId == ActorIdent)
			{
				MatchState = States[i];
				break;
			}
		}
		if (MatchState == none)
		{
			// as the stock search: same name and location
			for (i = 0; i < States.Length; i++)
			{
				if (States[i].ActorId.ActorName == ActorIdent.ActorName && VSizeSq(States[i].ActorId.Location - ActorIdent.Location) < 0.0001f)
				{
					MatchState = States[i];
					break;
				}
			}
		}
		if (MatchState == none)
		{
			NoState++;
			continue;
		}
		bMismatch = (LevelActor.ObjectID != MatchState.ObjectID);
		if (bMismatch)
		{
			Mismatched++;
		}
		if (MatchState.MustBeHacked())
		{
			Hackable++;
		}
		if (bDetail && (bMismatch || MatchState.MustBeHacked()) && Lines < MAX_DETAIL_LINES)
		{
			Lines++;
			ByIDState = LevelActor.ObjectID > 0 ? History.GetGameStateForObjectID(LevelActor.ObjectID) : none;
			Text = (bMismatch ? "MISMATCH" : "MATCH") @ LevelActor.Name @ "actor ID" @ LevelActor.ObjectID;
			Text @= "(history object there:" @ (ByIDState != none ? string(ByIDState.Class.Name) : "none");
			if (XComGameState_Destructible(ByIDState) != none)
			{
				Text @= string(XComGameState_Destructible(ByIDState).ActorId.ActorName);
			}
			Text $= "); matching state" @ MatchState.ObjectID @ "enabled=" $ MatchState.IsEnabled
				@ "must hack=" $ MatchState.MustBeHacked() @ "hacked=" $ MatchState.HasBeenHacked()
				@ "rewards=" $ MatchState.GetHackRewards('').Length;
			`log("Coop objects:" @ Text, , 'X2TC');
		}
		if (bMismatch && bRepair)
		{
			LevelActor.SetObjectIDFromState(MatchState);
			History.SetVisualizer(MatchState.ObjectID, LevelActor);
			Repaired++;
			if (Repaired <= MAX_DETAIL_LINES)
			{
				`log("Coop objects: re-linked" @ LevelActor.Name @ "to state" @ MatchState.ObjectID @ "(now" @ LevelActor.ObjectID $ ")", , 'X2TC');
			}
		}
	}
	`log("Coop objects (" $ Why $ "):" @ Total @ "interactive actors," @ Mismatched @ "mismatched," @ NoState @ "with no state,"
		@ Hackable @ "must be hacked;" @ Repaired @ "re-linked (repair switch" @ (bRepair ? "on" : "off") $ ")", , 'X2TC');
}
