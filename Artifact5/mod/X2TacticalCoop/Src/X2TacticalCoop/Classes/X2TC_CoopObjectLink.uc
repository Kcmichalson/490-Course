//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopObjectLink
//
//  What it changes: nothing (0.8.3: read-only). It checks the link between the map's
//  interactive objects (doors, workstations, objective computers) and their states in the
//  history (plans/m4-plan.md, 0.8.2 item 3), on the guest and (0.8.3) on the host.
//  0.8.3 (0.8.2 Runs 2-3: every object matched, yet the partner still couldn't hack the
//  objective, and its copy reported 0 hack rewards): the re-link repair and its switch are
//  gone (in 0.8.2 Run 1 it re-linked a stacked tower to another tower's state and the
//  partner crashed). Each must-hack object now also logs its reward flags, BattleData's
//  reward lists, whether the tactical hack is done, and CanInteractHack for each squad
//  soldier (XComGameState_InteractiveObject.uc L507-520, L861-886;
//  XComGameState_BattleData.uc L175-178, L969), to compare the two PCs.
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
//  Called at the start of each XCOM turn by X2TC_CoopReplayMgr on the guest and by
//  X2TC_CoopSession's poll on the host.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComDestructibleActor.uc       (ObjectID L146, FindExistingState
//                                                     L235-310, SetObjectIDFromState L461)
//    XComGame\Classes\XComInteractiveLevelActor.uc   (GetInteractiveState L289)
//    XComGame\Classes\XComGameState_Destructible.uc  (ActorId L17)
//    XComGame\Classes\XComGameState_InteractiveObject.uc (IsEnabled L39, MustBeHacked L526,
//                                                     HasBeenHacked L851, GetHackRewards L861)
//    XComGame\Classes\XComGameState_BattleData.uc    (TacticalHackRewards L175,
//                                                     StrategyHackRewards L178,
//                                                     TacticalHackCompleted L969)
//    Engine\Classes\Actor.uc                         (GetActorId L2524)
//---------------------------------------------------------------------------------------

class X2TC_CoopObjectLink extends Object;

const MAX_DETAIL_LINES = 40;

// 0.8.3: "840:r0 tac strat can 24n 27y": rewards, the object's reward flags, and
// CanInteractHack for each living squad soldier.
static function string HackText(XComGameState_InteractiveObject ObjectState, array<XComGameState_Unit> Squad)
{
	local string Text;
	local int i;

	Text = ObjectState.ObjectID $ ":r" $ ObjectState.GetHackRewards('').Length;
	if (ObjectState.bOffersTacticalHackRewards)
	{
		Text @= "tac";
	}
	if (ObjectState.bOffersStrategyHackRewards)
	{
		Text @= "strat";
	}
	if (ObjectState.HasBeenHacked())
	{
		Text @= "hacked";
	}
	Text @= "can";
	for (i = 0; i < Squad.Length; i++)
	{
		if (Squad[i] != none && Squad[i].IsAlive())
		{
			Text @= Squad[i].ObjectID $ (ObjectState.CanInteractHack(Squad[i]) ? "y" : "n");
		}
	}
	return Text;
}

// bDetail: log one line per mismatched or hackable object (the first check); otherwise
// only the summary.
static function CheckObjects(string Why, bool bDetail)
{
	local WorldInfo World;
	local XComGameStateHistory History;
	local XComInteractiveLevelActor LevelActor;
	local XComGameState_InteractiveObject ObjectState, MatchState;
	local XComGameState_BaseObject ByIDState;
	local XComGameState_BattleData BattleData;
	local array<XComGameState_InteractiveObject> States;
	local array<XComGameState_Unit> Squad;
	local ActorIdentifier ActorIdent;
	local bool bMismatch;
	local int i, Total, Mismatched, NoState, Hackable, Lines;
	local string Text, HackList;

	World = class'WorldInfo'.static.GetWorldInfo();
	History = `XCOMHISTORY;
	if (World == none || History == none)
	{
		return;
	}
	class'X2TC_CoopOwnership'.static.GetSquad(Squad);
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
			HackList $= (HackList != "" ? "; " : "") $ HackText(MatchState, Squad);
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
	}
	`log("Coop objects (" $ Why $ "):" @ Total @ "interactive actors," @ Mismatched @ "mismatched," @ NoState @ "with no state,"
		@ Hackable @ "must be hacked", , 'X2TC');
	// 0.8.3: the hack check for the must-hack objects, the same on both PCs.
	BattleData = XComGameState_BattleData(History.GetSingleGameStateObjectForClass(class'XComGameState_BattleData', true));
	`log("Coop objects hack (" $ Why $ "): BattleData rewards tac" @ (BattleData != none ? string(BattleData.TacticalHackRewards.Length) : "?")
		@ "strat" @ (BattleData != none ? string(BattleData.StrategyHackRewards.Length) : "?")
		@ "tactical hack done=" $ class'XComGameState_BattleData'.static.TacticalHackCompleted()
		$ "; objects:" @ (HackList != "" ? HackList : "none"), , 'X2TC');
}
