//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopStasisLanceCalc
//
//  What it changes: while connected in co-op, Skulljack and Skullmine use the
//  single-player chance (plans/m4-plan.md, 0.8.2 item 6; row 5 of "Remaining multiplayer
//  rules"). The stock calc adds its base chance (70) only when the engine doesn't report
//  multiplayer (X2AbilityToHitCalc_StasisLance.uc L81), so once connected the chance is 0
//  except on Captains and Codices (100, RollForAbilityHit L38-46).
//  While a co-op session is on and the switch "Skulljack chance as in single player" is
//  on, GetHitChance takes the single-player branch (L81-105, the base chance only, as in
//  the stock code). Otherwise it is the stock function.
//  Swapped in at start-up (SwapIntoTemplates, called from the mod's DLC info) only where an
//  ability template's calc is exactly X2AbilityToHitCalc_StasisLance, so a calc another
//  mod replaced is left alone. Each swap is logged. Not a class override.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\X2AbilityToHitCalc_StasisLance.uc (BASE_CHANCE L6, GetHitChance L69-108)
//    XComGame\Classes\X2AbilityToHitCalc.uc             (AddModifier L36, FinalizeHitChance L60)
//    XComGame\Classes\X2AbilityTemplate.uc              (AbilityToHitCalc L52)
//    XComGame\Classes\X2Ability_ItemGrantedAbilitySet.uc (the two stock users, L1130, L1268)
//---------------------------------------------------------------------------------------

class X2TC_CoopStasisLanceCalc extends X2AbilityToHitCalc_StasisLance;

protected function int GetHitChance(XComGameState_Ability kAbility, AvailableTarget kTarget, optional out ShotBreakdown m_ShotBreakdown, optional bool bDebugLog = false)
{
	local XComGameState_Unit TargetUnit;
	local ShotBreakdown EmptyShotBreakdown;
	local XComEngine Engine;

	Engine = `XENGINE;
	if (Engine == none || !Engine.IsMultiPlayerGame() || !class'X2TC_CoopSession'.static.IsSessionActive()
		|| !class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_SKULLJACK))
	{
		return super.GetHitChance(kAbility, kTarget, m_ShotBreakdown, bDebugLog);
	}
	TargetUnit = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(kTarget.PrimaryTarget.ObjectID));
	m_ShotBreakdown = EmptyShotBreakdown;
	if (TargetUnit != none)
	{
		// the stock single-player branch (the stock class's config value, read explicitly)
		AddModifier(class'X2AbilityToHitCalc_StasisLance'.default.BASE_CHANCE, class'XLocalizedData'.default.BaseChance, m_ShotBreakdown, eHit_Success, bDebugLog);
		FinalizeHitChance(m_ShotBreakdown, bDebugLog);
	}
	return m_ShotBreakdown.FinalHitChance;
}

// At start-up: put this calc into every ability template whose calc is exactly the stock one.
static function SwapIntoTemplates()
{
	local X2AbilityTemplateManager Manager;
	local array<name> TemplateNames;
	local array<X2AbilityTemplate> Templates;
	local int i, j, Swapped, Skipped;

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
			if (Templates[j] == none || Templates[j].AbilityToHitCalc == none)
			{
				continue;
			}
			if (Templates[j].AbilityToHitCalc.Class == class'X2AbilityToHitCalc_StasisLance')
			{
				Templates[j].AbilityToHitCalc = new class'X2TC_CoopStasisLanceCalc';
				Swapped++;
				if (j == 0)
				{
					`log("Coop rules: Skulljack-type calc swapped in" @ TemplateNames[i], , 'X2TC');
				}
			}
			else if (j == 0 && ClassIsChildOf(Templates[j].AbilityToHitCalc.Class, class'X2AbilityToHitCalc_StasisLance')
				&& Templates[j].AbilityToHitCalc.Class != class'X2TC_CoopStasisLanceCalc')
			{
				Skipped++;
				`log("Coop rules: Skulljack-type calc of" @ TemplateNames[i] @ "is another mod's (" $ Templates[j].AbilityToHitCalc.Class.Name $ "); left alone", , 'X2TC');
			}
		}
	}
	`log("Coop rules: Skulljack-type calc swapped in" @ Swapped @ "templates (all difficulties)," @ Skipped @ "left alone", , 'X2TC');
}
