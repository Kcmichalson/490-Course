//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopSPRules
//
//  What it changes: while a co-op session runs on the host, units created mid-mission keep
//  their single-player abilities.
//  Once the network manager has a server or client, the engine reports a multiplayer game
//  on both machines (`XENGINE.IsMultiPlayerGame()` = True from HOST on, as the log shows;
//  native, so the mod can't clear it). One effect: when a unit is created during
//  the mission (reinforcements, the Chosen arriving, spawned units), the ruleset skips
//  every ability whose template isn't marked for the multiplayer game area
//  (X2TacticalGameRuleset.InitializeUnitAbilities, SDK L877-889; Highlander L896-908:
//  "is not available in multiplayer!"). At HOST this adds the multiplayer area to every
//  tactical ability template that lacks it, and removes it again when the session ends,
//  so a real multiplayer match afterwards sees the stock templates. Uses the templates'
//  own public setters (X2DataTemplate.AddTemplateAvailablility / RemoveTemplateAvailablility,
//  SDK L56-77; the spelling is the game's). Fix switch: "Single-player rules while
//  connected" (with the pause menu, X2TC_CoopPauseListener).
//  The list of changed templates is a config array that is never saved (run-time
//  "default." assignments compile only on config variables).
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\X2DataTemplate.uc          (TemplateAvailability, BITFIELD_GAMEAREA_*,
//                                                 IsTemplateAvailableToAnyArea L83)
//    XComGame\Classes\X2DataTemplateManager.uc   (GetTemplateNames L45)
//    XComGame\Classes\X2AbilityTemplateManager.uc (FindAbilityTemplateAllDifficulties L123)
//---------------------------------------------------------------------------------------

class X2TC_CoopSPRules extends Object config(X2TacticalCoopFixes);

var config array<name> AddedMultiplayerArea; // templates this mod marked; never saved

// Host, at HOST: mark the tactical ability templates that lack the multiplayer area.
static function BeginSession()
{
	local X2AbilityTemplateManager Manager;
	local array<name> TemplateNames, Added;
	local array<X2AbilityTemplate> Templates;
	local bool bChanged;
	local int i, j;

	if (!class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_SP_RULES))
	{
		`log("Coop SP rules: off; units created mid-mission keep the multiplayer ability filter", , 'X2TC');
		return;
	}
	if (default.AddedMultiplayerArea.Length > 0)
	{
		return; // already applied
	}
	Manager = class'X2AbilityTemplateManager'.static.GetAbilityTemplateManager();
	if (Manager == none)
	{
		return;
	}
	Manager.GetTemplateNames(TemplateNames);
	for (i = 0; i < TemplateNames.Length; i++)
	{
		Manager.FindAbilityTemplateAllDifficulties(TemplateNames[i], Templates);
		bChanged = false;
		for (j = 0; j < Templates.Length; j++)
		{
			if (Templates[j] != none
				&& Templates[j].IsTemplateAvailableToAnyArea(class'X2DataTemplate'.const.BITFIELD_GAMEAREA_Tactical)
				&& !Templates[j].IsTemplateAvailableToAnyArea(class'X2DataTemplate'.const.BITFIELD_GAMEAREA_Multiplayer))
			{
				Templates[j].AddTemplateAvailablility(class'X2DataTemplate'.const.BITFIELD_GAMEAREA_Multiplayer);
				bChanged = true;
			}
		}
		if (bChanged)
		{
			Added.AddItem(TemplateNames[i]);
		}
	}
	default.AddedMultiplayerArea = Added;
	`log("Coop SP rules: " $ Added.Length @ "ability templates marked for the multiplayer area for this session (of" @ TemplateNames.Length $ "), so units created mid-mission keep them", , 'X2TC');
}

// When the session ends: take the multiplayer area off the templates marked above.
static function EndSession()
{
	local X2AbilityTemplateManager Manager;
	local array<X2AbilityTemplate> Templates;
	local array<name> Empty;
	local int i, j, Count;

	Count = default.AddedMultiplayerArea.Length;
	if (Count == 0)
	{
		return;
	}
	Manager = class'X2AbilityTemplateManager'.static.GetAbilityTemplateManager();
	for (i = 0; Manager != none && i < Count; i++)
	{
		Manager.FindAbilityTemplateAllDifficulties(default.AddedMultiplayerArea[i], Templates);
		for (j = 0; j < Templates.Length; j++)
		{
			if (Templates[j] != none)
			{
				Templates[j].RemoveTemplateAvailablility(class'X2DataTemplate'.const.BITFIELD_GAMEAREA_Multiplayer);
			}
		}
	}
	default.AddedMultiplayerArea = Empty;
	`log("Coop SP rules: multiplayer area removed again from" @ Count @ "ability templates (session ended)", , 'X2TC');
}
