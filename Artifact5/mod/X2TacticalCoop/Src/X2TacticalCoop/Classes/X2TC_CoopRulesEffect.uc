//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopRulesEffect
//
//  What it changes: while connected in co-op, a shooter's flanking crit and the
//  suppression aim penalty come out as in single player. This is the effect of the
//  hidden passive X2TC_CoopRules (X2TC_CoopRulesAbility), which every unit has.
//    - The engine reports a multiplayer game once connected (native), so the stock aim
//      calc gives every flanking shot a flat MP_FLANKING_CRIT_BONUS (30) instead of the
//      shooter's own flanking crit stat (X2AbilityToHitCalc_StandardAim.uc L534-544), and
//      suppression a flat MultiplayerTargetAimPenalty instead of the single-player values
//      (X2Effect_Suppression.uc L14-19).
//    - The same calc then asks every effect on the shooter for modifiers, with the shooter,
//      target and flanking flag (L546-560; crit lines only when crits are allowed). This
//      effect adds the difference, labelled "Flanking (co-op)" and "Suppression (co-op)":
//        flanking, not melee: crit + (shooter's eStat_FlankingCritChance - MP bonus);
//        shooter suppressed, not indirect fire: aim + (single-player penalty - MP penalty),
//        the single-player penalty chosen by the shooter's team as the stock effect does.
//      Effects that subtract the shooter's own flank stat (LWOTC's smoke) then net to 0, as
//      in single player.
//  It adds nothing unless a co-op session is on, the engine reports multiplayer, the calc
//  is X2AbilityToHitCalc_StandardAim or a subclass, and the fix's switch is on
//  ("Flanking crit as in single player", "Suppression penalty as in single player").
//  Every value is read when the shot is calculated, so other mods' stat and config
//  changes carry through.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\X2Effect_Persistent.uc        (GetToHitModifiers L653)
//    XComGame\Classes\X2AbilityToHitCalc_StandardAim.uc (MP_FLANKING_CRIT_BONUS L36,
//                                                    L534-560)
//    XComGame\Classes\X2Effect_Suppression.uc       (penalties L3-5, GetToHitModifiers L7-21)
//    XComGame\Classes\X2TacticalGameRulesetDataStructures.uc (ShotModifierInfo L746)
//---------------------------------------------------------------------------------------

class X2TC_CoopRulesEffect extends X2Effect_Persistent;

const FLANK_LABEL = "Flanking (co-op)";
const SUPPRESSION_LABEL = "Suppression (co-op)";
const MAX_LOGGED = 5;

// The first few lines of each kind are logged (this is the template's effect object, one per
// ability template; instance variables, not defaults). Hit chances are also worked out for
// previews and AI choices, so a line doesn't mean a shot was taken.
var int FlankLogged;
var int SuppressionLogged;

function GetToHitModifiers(XComGameState_Effect EffectState, XComGameState_Unit Attacker, XComGameState_Unit Target, XComGameState_Ability AbilityState, class<X2AbilityToHitCalc> ToHitType, bool bMelee, bool bFlanking, bool bIndirectFire, out array<ShotModifierInfo> ShotModifiers)
{
	local ShotModifierInfo ShotMod;
	local XComEngine Engine;
	local int Delta;

	if (Attacker == none || ToHitType == none || !ClassIsChildOf(ToHitType, class'X2AbilityToHitCalc_StandardAim'))
	{
		return;
	}
	Engine = `XENGINE;
	if (Engine == none || !Engine.IsMultiPlayerGame() || !class'X2TC_CoopSession'.static.IsSessionActive())
	{
		return;
	}

	if (bFlanking && !bMelee && class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_FLANK_CRIT))
	{
		Delta = int(Attacker.GetCurrentStat(eStat_FlankingCritChance)) - class'X2AbilityToHitCalc_StandardAim'.default.MP_FLANKING_CRIT_BONUS;
		if (Delta != 0)
		{
			ShotMod.ModType = eHit_Crit;
			ShotMod.Value = Delta;
			ShotMod.Reason = FLANK_LABEL;
			ShotModifiers.AddItem(ShotMod);
			if (FlankLogged < MAX_LOGGED)
			{
				FlankLogged++;
				`log("Coop rules: Flanking (co-op)" @ Delta @ "crit for unit" @ Attacker.ObjectID @ "(" $ Attacker.GetMyTemplateName() $ ") on unit" @ (Target != none ? Target.ObjectID : -1), , 'X2TC');
			}
		}
	}

	if (!bIndirectFire && class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_SUPPRESSION) && IsSuppressed(Attacker))
	{
		if (Attacker.GetTeam() != eTeam_XCom)
		{
			Delta = class'X2Effect_Suppression'.default.SoldierTargetAimPenalty;
		}
		else
		{
			Delta = class'X2Effect_Suppression'.default.AlienTargetAimPenalty;
		}
		Delta -= class'X2Effect_Suppression'.default.MultiplayerTargetAimPenalty;
		if (Delta != 0)
		{
			ShotMod.ModType = eHit_Success;
			ShotMod.Value = Delta;
			ShotMod.Reason = SUPPRESSION_LABEL;
			ShotModifiers.AddItem(ShotMod);
			if (SuppressionLogged < MAX_LOGGED)
			{
				SuppressionLogged++;
				`log("Coop rules: Suppression (co-op)" @ Delta @ "aim for suppressed unit" @ Attacker.ObjectID @ "(" $ Attacker.GetMyTemplateName() $ ", team" @ Attacker.GetTeam() $ ")", , 'X2TC');
			}
		}
	}
}

// True if a suppression effect (the stock one or a subclass, e.g. LWOTC's area
// suppression) is on the unit.
static function bool IsSuppressed(XComGameState_Unit UnitState)
{
	local XComGameStateHistory History;
	local XComGameState_Effect EffectState;
	local StateObjectReference EffectRef;

	History = `XCOMHISTORY;
	foreach UnitState.AffectedByEffects(EffectRef)
	{
		EffectState = XComGameState_Effect(History.GetGameStateForObjectID(EffectRef.ObjectID));
		if (EffectState != none && X2Effect_Suppression(EffectState.GetX2Effect()) != none)
		{
			return true;
		}
	}
	return false;
}

defaultproperties
{
	EffectName = "X2TC_CoopRulesEffect"
	DuplicateResponse = eDupe_Ignore
}
