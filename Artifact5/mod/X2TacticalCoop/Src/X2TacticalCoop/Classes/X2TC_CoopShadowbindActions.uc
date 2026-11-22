//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopShadowbindActions
//
//  What it changes: while connected in co-op, a Spectre's Shadowbind copy gets its action
//  points on spawn as in single player (plans/m4-plan.md, 0.8.2 item 6; row 6 of
//  "Remaining multiplayer rules"). The stock spawn effect clears the copy's action points
//  when the engine reports multiplayer (X2Effect_SpawnShadowbindUnit.uc L36-40). In single
//  player the copy keeps what the spawn manager gave it: standard action points only if its
//  group is the one acting now (XComAISpawnManager.uc L472-475), nothing otherwise.
//  This effect is added after the stock spawn effect in each Shadowbind template, so it
//  runs in the same game state, right after the copy is created
//  (X2Effect_SpawnUnit.OnEffectAdded L17-25 creates it at once). It finds the copy (its
//  ShadowUnit_CopiedUnit is the target), and, if the copy has no action points and its
//  group is the acting one, gives the standard ones again (GiveStandardActionPoints, the
//  part of SetupActionsForBeginTurn that the clear undid; the copy had no effects then).
//  Only while a co-op session is on, the engine reports multiplayer, and the switch
//  "Shadowbind copy acts as in single player" is on; otherwise it does nothing.
//  Why added, not swapped: the template's effect list is protectedwrite
//  (X2AbilityTemplate.uc L57), so a stock effect can't be replaced; AddTargetEffect (L262)
//  appends. Added only where a template has an effect of exactly the stock class, so
//  another mod's Shadowbind is left alone. Not a class override.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\X2Effect.uc                     (ApplyEffect L67, OnEffectAdded L230)
//    XComGame\Classes\X2Effect_SpawnShadowbindUnit.uc (OnSpawnComplete L25-56)
//    XComGame\Classes\XComGameState_Unit.uc           (ShadowUnit_CopiedUnit L227,
//                                                      GiveStandardActionPoints L6380,
//                                                      GetGroupMembership L13105)
//    XComGame\Classes\XComGameState_BattleData.uc     (UnitActionInitiativeRef L211)
//    XComGame\Classes\X2Ability_Spectre.uc            (CreateShadowbind L456-535)
//---------------------------------------------------------------------------------------

class X2TC_CoopShadowbindActions extends X2Effect;

simulated protected function OnEffectAdded(const out EffectAppliedData ApplyEffectParameters, XComGameState_BaseObject kNewTargetState, XComGameState NewGameState, XComGameState_Effect NewEffectState)
{
	local XComGameState_Unit CopyState;
	local XComGameState_BattleData BattleData;
	local XComGameState_AIGroup GroupState;
	local XComEngine Engine;
	local bool bActing;

	super.OnEffectAdded(ApplyEffectParameters, kNewTargetState, NewGameState, NewEffectState);

	Engine = `XENGINE;
	if (kNewTargetState == none || Engine == none || !Engine.IsMultiPlayerGame() || !class'X2TC_CoopSession'.static.IsSessionActive()
		|| !class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_SHADOWBIND))
	{
		return;
	}
	foreach NewGameState.IterateByClassType(class'XComGameState_Unit', CopyState)
	{
		if (CopyState.ShadowUnit_CopiedUnit.ObjectID != kNewTargetState.ObjectID || CopyState.ObjectID == kNewTargetState.ObjectID)
		{
			continue;
		}
		BattleData = XComGameState_BattleData(`XCOMHISTORY.GetSingleGameStateObjectForClass(class'XComGameState_BattleData'));
		GroupState = CopyState.GetGroupMembership(NewGameState);
		bActing = BattleData != none && GroupState != none && BattleData.UnitActionInitiativeRef.ObjectID == GroupState.ObjectID;
		if (CopyState.ActionPoints.Length == 0 && bActing)
		{
			CopyState.GiveStandardActionPoints();
		}
		`log("Coop rules: Shadowbind copy" @ CopyState.ObjectID @ "of unit" @ kNewTargetState.ObjectID @ "(its group acting now=" $ bActing $ "); action points now" @ CopyState.ActionPoints.Length, , 'X2TC');
		return;
	}
	`log("Coop rules: Shadowbind on unit" @ kNewTargetState.ObjectID $ ": no copy found in this game state", , 'X2TC');
}

// At start-up: add this effect after the stock spawn effect in each Shadowbind template.
static function AddToTemplates()
{
	local X2AbilityTemplateManager Manager;
	local array<name> TemplateNames;
	local array<X2AbilityTemplate> Templates;
	local X2Effect TargetEffect;
	local array<X2Effect> TargetEffects;
	local bool bStock, bHasOurs;
	local int i, j, Added;

	Manager = class'X2AbilityTemplateManager'.static.GetAbilityTemplateManager();
	if (Manager == none)
	{
		return;
	}
	Manager.GetTemplateNames(TemplateNames);
	for (i = 0; i < TemplateNames.Length; i++)
	{
		Manager.FindAbilityTemplateAllDifficulties(TemplateNames[i], Templates);
		for (j = 0; j < Templates.Length; j++)
		{
			if (Templates[j] == none)
			{
				continue;
			}
			bStock = false;
			bHasOurs = false;
			TargetEffects = Templates[j].AbilityTargetEffects;
			foreach TargetEffects(TargetEffect)
			{
				if (TargetEffect != none && TargetEffect.Class == class'X2Effect_SpawnShadowbindUnit')
				{
					bStock = true;
				}
				if (X2TC_CoopShadowbindActions(TargetEffect) != none)
				{
					bHasOurs = true;
				}
			}
			if (bStock && !bHasOurs)
			{
				Templates[j].AddTargetEffect(new class'X2TC_CoopShadowbindActions');
				Added++;
				if (j == 0)
				{
					`log("Coop rules: Shadowbind action fix added to" @ TemplateNames[i], , 'X2TC');
				}
			}
		}
	}
	`log("Coop rules: Shadowbind action fix added to" @ Added @ "templates (all difficulties)", , 'X2TC');
}
