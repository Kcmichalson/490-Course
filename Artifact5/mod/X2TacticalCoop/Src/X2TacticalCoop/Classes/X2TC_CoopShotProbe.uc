//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopShotProbe
//
//  What it changes: nothing; diagnostics only.
//  some enemies in the target bar were greyed out and i couldn't select them -- Kc
//  That was on the partner. The host could shoot them with the same soldier, and after
//  the host gave the soldier back, so could the partner. The bar lists the enemies the
//  selected soldier sees (visibility manager) and dims those missing from the targets of
//  the soldier's cached actions (UITacticalHUD_Enemies.UpdateVisibleEnemies L301-355,
//  UpdateVisuals L387-399; XComGameState_Unit.GetUISummary_TargetableUnits
//  L12562-12600). Whenever the set of dimmed enemies changes, this logs, per dimmed
//  enemy, the visibility manager's view and the standard shot's code, plus the history
//  index the unit cache was built at, so a stale cache can be told from a visibility
//  problem. Only with Verbose log on.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UITacticalHUD_Enemies.uc         (m_arrTargets, m_arrCurrentlyAffectable L13-14)
//    XComGame\Classes\X2TacticalGameRuleset.uc         (GetGameRulesCache_Unit L545-642)
//    XComGame\Classes\X2GameRulesetVisibilityManager.uc (GetVisibilityInfo L167)
//    XComGame\Classes\X2GameRulesetVisibilityDataStructures.uc (GameRulesCache_VisibilityInfo L83-110)
//---------------------------------------------------------------------------------------

class X2TC_CoopShotProbe extends Object;

// Who: "partner" or "host". LastKey: the caller's memory of the last dimmed set.
static function Probe(string Who, out string LastKey)
{
	local XComPresentationLayer Pres;
	local UITacticalHUD HUD;
	local UITacticalHUD_Enemies Enemies;
	local XComTacticalController TacticalController;
	local X2TacticalGameRuleset Rules;
	local GameRulesCache_Unit UnitCache;
	local GameRulesCache_VisibilityInfo VisInfo;
	local XComGameState_Ability AbilityState;
	local StateObjectReference UnitRef;
	local array<int> Dimmed;
	local string Key, Line, ShotText;
	local int i, j, Targets;

	Pres = `PRES;
	HUD = Pres != none ? Pres.GetTacticalHUD() : none;
	Enemies = HUD != none ? HUD.m_kEnemyTargets : none;
	TacticalController = XComTacticalController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	Rules = `TACTICALRULES;
	if (Enemies == none || TacticalController == none || Rules == none)
	{
		return;
	}
	UnitRef = TacticalController.GetActiveUnitStateRef();
	for (i = 0; i < Enemies.m_arrTargets.Length; i++)
	{
		if (Enemies.m_arrCurrentlyAffectable.Find('ObjectID', Enemies.m_arrTargets[i].ObjectID) == INDEX_NONE)
		{
			Dimmed.AddItem(Enemies.m_arrTargets[i].ObjectID);
		}
	}
	Key = string(UnitRef.ObjectID);
	for (i = 0; i < Dimmed.Length; i++)
	{
		Key $= "," $ Dimmed[i];
	}
	if (Key == LastKey)
	{
		return;
	}
	LastKey = Key;
	if (Dimmed.Length == 0 || UnitRef.ObjectID <= 0)
	{
		return;
	}

	ShotText = "no StandardShot";
	if (Rules.GetGameRulesCache_Unit(UnitRef, UnitCache))
	{
		for (i = 0; i < UnitCache.AvailableActions.Length; i++)
		{
			AbilityState = XComGameState_Ability(`XCOMHISTORY.GetGameStateForObjectID(UnitCache.AvailableActions[i].AbilityObjectRef.ObjectID));
			if (AbilityState != none && AbilityState.GetMyTemplateName() == 'StandardShot')
			{
				Targets = UnitCache.AvailableActions[i].AvailableTargets.Length;
				ShotText = "StandardShot=" $ UnitCache.AvailableActions[i].AvailableCode @ "targets" @ Targets;
				for (j = 0; j < Dimmed.Length; j++)
				{
					if (HasTarget(UnitCache.AvailableActions[i], Dimmed[j]))
					{
						ShotText @= "(has" @ Dimmed[j] $ ")";
					}
				}
				break;
			}
		}
	}
	Line = "Coop shot probe (" $ Who $ "): unit" @ UnitRef.ObjectID @ "dimmed" @ Dimmed.Length @ "of" @ Enemies.m_arrTargets.Length
		@ "|" @ ShotText @ "| cache built at index" @ UnitCache.LastUpdateHistoryIndex @ "now" @ `XCOMHISTORY.GetCurrentHistoryIndex()
		$ "/" $ `XCOMHISTORY.GetNumGameStates();
	for (i = 0; i < Dimmed.Length; i++)
	{
		if (Rules.VisibilityMgr != none && Rules.VisibilityMgr.GetVisibilityInfo(UnitRef.ObjectID, Dimmed[i], VisInfo))
		{
			Line @= "| enemy" @ Dimmed[i] @ "gameplay=" $ VisInfo.bVisibleGameplay @ "basic=" $ VisInfo.bVisibleBasic
				@ "LOS=" $ VisInfo.bClearLOS @ "tiles=" $ int(VisInfo.DefaultTargetDist / class'XComWorldData'.const.WORLD_StepSize);
		}
		else
		{
			Line @= "| enemy" @ Dimmed[i] @ "no visibility info";
		}
	}
	`log(Line, , 'X2TC');
}

static function bool HasTarget(AvailableAction Action, int ObjectID)
{
	local int i;

	for (i = 0; i < Action.AvailableTargets.Length; i++)
	{
		if (Action.AvailableTargets[i].PrimaryTarget.ObjectID == ObjectID)
		{
			return true;
		}
	}
	return false;
}
