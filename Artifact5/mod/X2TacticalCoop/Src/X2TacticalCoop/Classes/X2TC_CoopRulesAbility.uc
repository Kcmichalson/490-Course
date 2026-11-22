//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopRulesAbility
//
//  What it changes: creates the hidden passive ability X2TC_CoopRules, which carries
//  X2TC_CoopRulesEffect (flanking crit and suppression as in single player while connected
//  in co-op; plans/m4-plan.md, 0.8.2 item 5), and adds it to every non-cosmetic character
//  template after the templates are created (called from the mod's DLC info). It replaces
//  nothing; outside co-op the effect adds nothing.
//  Built like the game's own pure passives (X2Ability.PurePassive L1575-1604): self
//  target, triggered when the unit enters play, no icon, no visualization. The template's
//  availability is left at the default (every game area, X2DataTemplate.uc L140), so units
//  created mid-mission while connected keep it.
//  Note: units in a tactical save made with this mod (co-op or not) carry the ability, so
//  that save needs the mod to load.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\X2Ability.uc                 (PurePassive L1575, DeadEye, SelfTarget,
//                                                   UnitPostBeginPlayTrigger defaults)
//    XComGame\Classes\X2CharacterTemplate.uc       (Abilities L28)
//    XComGame\Classes\X2CharacterTemplateManager.uc, X2DataTemplateManager.uc
//                                                  (GetTemplateNames L45)
//---------------------------------------------------------------------------------------

class X2TC_CoopRulesAbility extends X2Ability;

const ABILITY_NAME = 'X2TC_CoopRules';

static function array<X2DataTemplate> CreateTemplates()
{
	local array<X2DataTemplate> Templates;

	Templates.AddItem(CreateCoopRules());
	return Templates;
}

static function X2AbilityTemplate CreateCoopRules()
{
	local X2AbilityTemplate Template;
	local X2TC_CoopRulesEffect RulesEffect;

	`CREATE_X2ABILITY_TEMPLATE(Template, 'X2TC_CoopRules');
	Template.IconImage = "img:///UILibrary_PerkIcons.UIPerk_standard";
	Template.AbilitySourceName = 'eAbilitySource_Perk';
	Template.eAbilityIconBehaviorHUD = eAbilityIconBehavior_NeverShow;
	Template.Hostility = eHostility_Neutral;
	Template.bIsPassive = true;
	Template.bDisplayInUITooltip = false;
	Template.bDisplayInUITacticalText = false;

	Template.AbilityToHitCalc = default.DeadEye;
	Template.AbilityTargetStyle = default.SelfTarget;
	Template.AbilityTriggers.AddItem(default.UnitPostBeginPlayTrigger);

	RulesEffect = new class'X2TC_CoopRulesEffect';
	RulesEffect.BuildPersistentEffect(1, true, false);
	Template.AddTargetEffect(RulesEffect);

	Template.BuildNewGameStateFn = TypicalAbility_BuildGameState;
	// no visualization, as the game's pure passives
	return Template;
}

// After all templates exist: add the passive to every non-cosmetic character template.
static function AddToCharacters()
{
	local X2CharacterTemplateManager Manager;
	local array<name> TemplateNames;
	local array<X2DataTemplate> DataTemplates;
	local X2CharacterTemplate CharTemplate;
	local int i, j, Added;

	Manager = class'X2CharacterTemplateManager'.static.GetCharacterTemplateManager();
	if (Manager == none)
	{
		`log("Coop rules: no character template manager; the co-op passive isn't added", , 'X2TC');
		return;
	}
	Manager.GetTemplateNames(TemplateNames);
	for (i = 0; i < TemplateNames.Length; i++)
	{
		Manager.FindDataTemplateAllDifficulties(TemplateNames[i], DataTemplates);
		for (j = 0; j < DataTemplates.Length; j++)
		{
			CharTemplate = X2CharacterTemplate(DataTemplates[j]);
			if (CharTemplate != none && !CharTemplate.bIsCosmetic && CharTemplate.Abilities.Find(ABILITY_NAME) == INDEX_NONE)
			{
				CharTemplate.Abilities.AddItem(ABILITY_NAME);
				Added++;
			}
		}
	}
	`log("Coop rules: passive" @ ABILITY_NAME @ "added to" @ Added @ "character templates (of" @ TemplateNames.Length @ "names)", , 'X2TC');
}
