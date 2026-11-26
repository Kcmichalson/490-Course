//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopOwnership
//
//  What it changes: which player each XCOM soldier belongs to in a co-op mission.
//  Every soldier belongs to the
//  host (P1) until the squad screen gives it to the partner (P2): the host writes the
//  unit value X2TC_Owner (1 or 2) in a change state, which reaches the guest in the next
//  partial history. The value is the game's own name-to-number data on the unit (no mod
//  class in saves) and is cleared by the game when the next mission starts. A unit
//  without the value belongs to P1 (rescues, VIPs, reinforcements). Static helpers only;
//  the session, the follower and the squad screen call them.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComGameState_Unit.uc  (GetUnitValue L1239, SetUnitFloatValue L1240,
//                                             IsSoldier L7655, NumAllActionPoints L6444)
//    XComGame\Classes\X2TacticalGameRulesetDataStructures.uc (UnitValue L516-520,
//                                             eCleanup_Never L513)
//    XComGame\Classes\XComGameStateContext_ChangeContainer.uc (CreateChangeState L48)
//    XComGame\Classes\XComGameState.uc       (ModifyStateObject L144)
//    XComGame\Classes\X2GameRuleset.uc       (SubmitGameState L657)
//---------------------------------------------------------------------------------------

class X2TC_CoopOwnership extends Object dependson(X2TacticalGameRulesetDataStructures, X2GameRuleset);

const OWNER_VALUE = 'X2TC_Owner';
const OWNER_HOST = 1;   // P1
const OWNER_GUEST = 2;  // P2

// 1 (P1, host) or 2 (P2, guest); no value means P1.
static function int GetOwner(XComGameState_Unit UnitState)
{
	local UnitValue Value;

	if (UnitState != none && UnitState.GetUnitValue(OWNER_VALUE, Value))
	{
		return int(Value.fValue);
	}
	return OWNER_HOST;
}

static function string OwnerText(int Owner)
{
	if (Owner == OWNER_GUEST)
	{
		return "P2";
	}
	return "P1";
}

// A living XCOM soldier on the board that can be owned.
static function bool IsOwnableSoldier(XComGameState_Unit UnitState)
{
	return UnitState != none && UnitState.GetTeam() == eTeam_XCom && UnitState.IsSoldier()
		&& !UnitState.IsDead() && !UnitState.bRemovedFromPlay && !UnitState.GetMyTemplate().bIsCosmetic;
}

// The ownable soldiers, sorted by object ID (the squad screen's row order on both
// machines).
static function GetSquad(out array<XComGameState_Unit> Squad)
{
	local XComGameState_Unit UnitState, Swap;
	local int i, j;

	Squad.Length = 0;
	foreach `XCOMHISTORY.IterateByClassType(class'XComGameState_Unit', UnitState)
	{
		if (IsOwnableSoldier(UnitState))
		{
			Squad.AddItem(UnitState);
		}
	}
	for (i = 0; i < Squad.Length; i++)
	{
		for (j = i + 1; j < Squad.Length; j++)
		{
			if (Squad[j].ObjectID < Squad[i].ObjectID)
			{
				Swap = Squad[i];
				Squad[i] = Squad[j];
				Squad[j] = Swap;
			}
		}
	}
}

// Host: one soldier's owner, in a submitted change state. The value is cleared by the
// game when the next mission starts (eCleanup_BeginTactical, XComGameState_Unit.uc
// L2229), so nothing stays in the campaign. The caller checks that the
// ruleset and visualizer are idle. Returns false if the unit isn't an ownable soldier.
static function bool SetOwner(int UnitID, int Owner)
{
	local XComGameState_Unit UnitState;
	local XComGameState NewGameState;

	UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(UnitID));
	if (!IsOwnableSoldier(UnitState))
	{
		`log("Coop owners: unit" @ UnitID @ "is not an XCOM soldier; owner not set", , 'X2TC');
		return false;
	}
	NewGameState = class'XComGameStateContext_ChangeContainer'.static.CreateChangeState("X2TC: co-op owner");
	UnitState = XComGameState_Unit(NewGameState.ModifyStateObject(class'XComGameState_Unit', UnitID));
	UnitState.SetUnitFloatValue(OWNER_VALUE, Owner, eCleanup_BeginTactical);
	`TACTICALRULES.SubmitGameState(NewGameState);
	`log("Coop owners: unit" @ UnitID @ "->" @ OwnerText(Owner) @ "(frames now" @ `XCOMHISTORY.GetNumGameStates() $ ")", , 'X2TC');
	return true;
}

// Logs every soldier's owner.
static function LogOwners()
{
	local array<XComGameState_Unit> Squad;
	local int i;

	GetSquad(Squad);
	for (i = 0; i < Squad.Length; i++)
	{
		`log("Coop owners: unit" @ Squad[i].ObjectID @ "->" @ OwnerText(GetOwner(Squad[i])), , 'X2TC');
	}
}

// True if any of the guest's soldiers can still act.
static function bool GuestHasActions()
{
	return PlayerHasActions(OWNER_GUEST);
}

// True if any soldier of this owner (OWNER_HOST or OWNER_GUEST) can still act. The host's
// also include the non-soldier XCOM units it controls (IsHostOnlyUnit).
static function bool PlayerHasActions(int Owner)
{
	local XComGameState_Unit UnitState;

	foreach `XCOMHISTORY.IterateByClassType(class'XComGameState_Unit', UnitState)
	{
		if (IsOwnableSoldier(UnitState) && GetOwner(UnitState) == Owner && UnitCanAct(UnitState))
		{
			return true;
		}
		if (Owner == OWNER_HOST && IsHostOnlyUnit(UnitState) && UnitCanAct(UnitState))
		{
			return true;
		}
	}
	return false;
}

// A living XCOM-team unit on the board that isn't a soldier (a rescued VIP or civilian, a
// mind-controlled enemy...). These have no owner value, so they are the host's (P1). If
// only soldiers were counted when deciding whether the host still had actions, the host
// could move a VIP with the FRIENDLY ACTION banner up. Not on the squad screen. Fix switch: "VIPs and civilians count as the host's".
static function bool IsHostOnlyUnit(XComGameState_Unit UnitState)
{
	return class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_VIP_HOST)
		&& UnitState != none && UnitState.GetTeam() == eTeam_XCom && !UnitState.IsSoldier()
		&& !UnitState.IsDead() && !UnitState.bRemovedFromPlay && !UnitState.GetMyTemplate().bIsCosmetic;
}

// Whether a soldier can do anything now, the way the game decides whether a unit still
// has actions (the ruleset's unit cache, bAnyActionsAvailable, X2GameRuleset.uc L70).
// Action points alone count a soldier bound by a Viper as able to act.
// no banner while both my soldiers were bound -- Kc
// Falls back to action points.
static function bool UnitCanAct(XComGameState_Unit UnitState)
{
	local GameRulesCache_Unit UnitCache;
	local X2TacticalGameRuleset Rules;

	if (UnitState == none || UnitState.IsIncapacitated() || UnitState.NumAllActionPoints() <= 0)
	{
		return false;
	}
	Rules = `TACTICALRULES;
	// A bound soldier was still selectable on the guest: the unit
	// cache's bAnyActionsAvailable also counts abilities the player can't trigger (e.g. a
	// 0-cost placeholder), so a bound soldier with its action points "could act". Use the
	// game's own rule, which the controller uses for selection: not bound, not panicked, and
	// an input-triggered ability available (X2TacticalGameRuleset.UnitHasActionsAvailable,
	// SDK L4186; Highlander L4526-4556). Fix switch: "Can-act check uses the game's rule".
	if (Rules != none && class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_CAN_ACT))
	{
		return Rules.UnitHasActionsAvailable(UnitState);
	}
	if (Rules != none && Rules.GetGameRulesCache_Unit(UnitState.GetReference(), UnitCache))
	{
		return UnitCache.bAnyActionsAvailable;
	}
	return true;
}

// Every soldier's state, logged by the host at each XCOM turn start: owner, action
// points, can act, incapacitated, panicked, and its effects.
// my last soldier never got actions back after a viper's bind -- Kc
// This shows why if it happens again.
static function LogSquadState(string Why)
{
	local array<XComGameState_Unit> Squad;
	local XComGameState_Unit UnitState;
	local string Effects;
	local int i, j;

	GetSquad(Squad);
	for (i = 0; i < Squad.Length; i++)
	{
		UnitState = Squad[i];
		Effects = "";
		for (j = 0; j < UnitState.AffectedByEffectNames.Length; j++)
		{
			Effects $= (j > 0 ? "," : "") $ UnitState.AffectedByEffectNames[j];
		}
		if (class'X2TC_CoopFixes'.static.Verbose()) `log("Coop squad state (" $ Why $ "): unit" @ UnitState.ObjectID @ OwnerText(GetOwner(UnitState))
			@ "AP=" $ UnitState.NumAllActionPoints() @ "can act=" $ UnitCanAct(UnitState)
			@ "incapacitated=" $ UnitState.IsIncapacitated() @ "panicked=" $ UnitState.bPanicked
			@ "effects=" $ (Effects == "" ? "none" : Effects), , 'X2TC');
	}
}
