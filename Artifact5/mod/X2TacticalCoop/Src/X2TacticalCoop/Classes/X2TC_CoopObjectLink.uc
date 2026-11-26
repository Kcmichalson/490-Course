//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopObjectLink
//
//  What it changes: nothing; read-only. It checks the link between the map's interactive
//  objects (doors, workstations, objective computers) and their states in the history, on
//  the guest and on the host. Each must-hack object also logs its reward flags,
//  BattleData's reward lists, whether the tactical hack is done, and CanInteractHack for
//  each squad soldier (XComGameState_InteractiveObject.uc L507-520, L861-886;
//  XComGameState_BattleData.uc L175-178, L969), to compare the two PCs.
//  Why: the guest's Specialist got no hack icon at an objective computer; the same
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
//  Both PCs' lines matched and CanInteractHack was true for every soldier, yet the
//  partner's hack abilities found no targets, so ProbeHack logs each step
//  of the hack target check for the selected unit near a must-hack object, on both PCs,
//  from X2TC_CoopSession's poll (X2Condition_HackingTarget.uc L44-78,
//  X2Condition_UnitInteractions.uc L31-71, X2AbilityTarget_Single.uc L16-17,
//  XComGameState_Ability.uc GatherAbilityTargets L287, X2GameRulesetVisibilityManager.uc
//  GetVisibilityInfo L167).
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

class X2TC_CoopObjectLink extends Object dependson(X2Condition_UnitInteractions);

const MAX_DETAIL_LINES = 40;
const PROBE_TILES = 3; // the hack probe looks at must-hack objects this close (or in view)

// "840:r0 tac strat can 24n 27y": rewards, the object's reward flags, and
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
			if (class'X2TC_CoopFixes'.static.Verbose()) `log("Coop objects:" @ Text, , 'X2TC');
		}
	}
	if (class'X2TC_CoopFixes'.static.Verbose()) `log("Coop objects (" $ Why $ "):" @ Total @ "interactive actors," @ Mismatched @ "mismatched," @ NoState @ "with no state,"
		@ Hackable @ "must be hacked", , 'X2TC');
	// The hack check for the must-hack objects, the same on both PCs.
	BattleData = XComGameState_BattleData(History.GetSingleGameStateObjectForClass(class'XComGameState_BattleData', true));
	if (class'X2TC_CoopFixes'.static.Verbose()) `log("Coop objects hack (" $ Why $ "): BattleData rewards tac" @ (BattleData != none ? string(BattleData.TacticalHackRewards.Length) : "?")
		@ "strat" @ (BattleData != none ? string(BattleData.StrategyHackRewards.Length) : "?")
		@ "tactical hack done=" $ class'XComGameState_BattleData'.static.TacticalHackCompleted()
		$ "; objects:" @ (HackList != "" ? HackList : "none"), , 'X2TC');
}

// Hack probe: for the selected unit, each
// step of the hack target check against every unhacked must-hack object within
// PROBE_TILES tiles, or seen by the unit (for a Gremlin's or BIT's ranged hack). Logs only
// when the text changes from LastText. Steps, as X2Condition_HackingTarget.uc L44-78 runs
// them: "pts" (the object among the unit's hack interaction points), "tmpl" (the actor's
// HackAbilityTemplateName), "hp", "can" (CanInteractHack), "vis" (visible to the unit, the
// ranged hack's check); then per hack ability the unit has: "cond" (the condition's own
// result), "valid" (X2AbilityTarget_Single.ValidatePrimaryTargetOption, native) and
// "gather" (XComGameState_Ability.GatherAbilityTargets L287, native: its code, target
// count, and whether the object is among them).
static function ProbeHack(XComGameState_Unit Unit, string Who, out string LastText)
{
	local XComGameStateHistory History;
	local XComGameState_InteractiveObject ObjectState;
	local XComInteractiveLevelActor LevelActor;
	local array<XComInteractPoint> Points;
	local GameRulesCache_VisibilityInfo VisInfo;
	local X2TacticalGameRuleset Rules;
	local bool bPoint, bVisible;
	local int i, Tiles;
	local name Tmpl;
	local string Text, ObjText;

	History = `XCOMHISTORY;
	if (Unit == none || History == none)
	{
		return;
	}
	Rules = `TACTICALRULES;
	Points = class'X2Condition_UnitInteractions'.static.GetUnitInteractionPoints(Unit, eInteractionType_Hack);
	foreach History.IterateByClassType(class'XComGameState_InteractiveObject', ObjectState)
	{
		if (!ObjectState.MustBeHacked() || ObjectState.HasBeenHacked())
		{
			continue;
		}
		Tiles = Max(Abs(ObjectState.TileLocation.X - Unit.TileLocation.X), Abs(ObjectState.TileLocation.Y - Unit.TileLocation.Y));
		bVisible = Rules != none && Rules.VisibilityMgr != none
			&& Rules.VisibilityMgr.GetVisibilityInfo(Unit.ObjectID, ObjectState.ObjectID, VisInfo) && VisInfo.bVisibleGameplay;
		if (Tiles > PROBE_TILES && !bVisible)
		{
			continue;
		}
		LevelActor = XComInteractiveLevelActor(ObjectState.GetVisualizer());
		bPoint = false;
		for (i = 0; i < Points.Length; i++)
		{
			if (LevelActor != none && Points[i].InteractiveActor == LevelActor)
			{
				bPoint = true;
				break;
			}
		}
		Tmpl = LevelActor != none ? LevelActor.HackAbilityTemplateName : '';
		ObjText = "obj" @ ObjectState.ObjectID @ "tiles" @ Tiles @ "dz" @ (ObjectState.TileLocation.Z - Unit.TileLocation.Z)
			@ "pts" @ (bPoint ? "y" : "n") @ "tmpl" @ Tmpl @ "hp" @ ObjectState.Health
			@ "can" @ (ObjectState.CanInteractHack(Unit) ? "y" : "n") @ "vis" @ (bVisible ? "y" : "n");
		if (Tmpl != '')
		{
			ObjText @= ProbeAbility(Unit, ObjectState, Tmpl, Tmpl);
			// The Gremlin / BIT version of the same hack (IntrusionProtocol, IntrusionProtocol_Chest, ...).
			ObjText @= ProbeAbility(Unit, ObjectState, name(Repl(string(Tmpl), "Hack", "IntrusionProtocol")), Tmpl);
		}
		Text $= (Text != "" ? "; " : "") $ ObjText;
	}
	if (Text == "")
	{
		Text = "no must-hack object within" @ PROBE_TILES @ "tiles or in view";
	}
	Text = "unit" @ Unit.ObjectID @ "at" @ Unit.TileLocation.X $ "," $ Unit.TileLocation.Y $ "," $ Unit.TileLocation.Z @ "|" @ Text;
	if (Text == LastText)
	{
		return;
	}
	LastText = Text;
	if (class'X2TC_CoopFixes'.static.Verbose()) `log("Coop hack probe (" $ Who $ "):" @ Text, , 'X2TC');
}

// "| Hack: cond AA_Success valid y gather AA_NoTargets 0 has n", or "" if the unit lacks it.
static function string ProbeAbility(XComGameState_Unit Unit, XComGameState_InteractiveObject ObjectState, name AbilityName, name RequiredName)
{
	local StateObjectReference AbilityRef;
	local XComGameState_Ability AbilityState;
	local X2AbilityTarget_Single TargetStyle;
	local X2Condition_HackingTarget HackCondition;
	local array<AvailableTarget> Targets;
	local name Code;
	local bool bHas;
	local int i;
	local string Text;

	AbilityRef = Unit.FindAbility(AbilityName);
	AbilityState = AbilityRef.ObjectID > 0 ? XComGameState_Ability(`XCOMHISTORY.GetGameStateForObjectID(AbilityRef.ObjectID)) : none;
	if (AbilityState == none)
	{
		return "";
	}
	HackCondition = new class'X2Condition_HackingTarget';
	HackCondition.RequiredAbilityName = RequiredName;
	HackCondition.bIntrusionProtocol = (InStr(string(AbilityName), "IntrusionProtocol") == 0);
	Text = "|" @ AbilityName $ ": cond" @ HackCondition.CallMeetsConditionWithSource(ObjectState, Unit);
	TargetStyle = AbilityState.GetMyTemplate() != none ? X2AbilityTarget_Single(AbilityState.GetMyTemplate().AbilityTargetStyle) : none;
	Text @= "valid" @ (TargetStyle == none ? "?" : (TargetStyle.ValidatePrimaryTargetOption(AbilityState, Unit, ObjectState) ? "y" : "n"));
	Code = AbilityState.GatherAbilityTargets(Targets);
	for (i = 0; i < Targets.Length; i++)
	{
		if (Targets[i].PrimaryTarget.ObjectID == ObjectState.ObjectID)
		{
			bHas = true;
			break;
		}
	}
	Text @= "gather" @ Code @ Targets.Length @ "has" @ (bHas ? "y" : "n");
	return Text;
}
