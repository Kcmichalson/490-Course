//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopOwnership
//
//  What it changes: which player each XCOM soldier belongs to in a co-op mission
//  (plans/m3-plan.md, Stage 6 and the co-op squad screen). Every soldier belongs to the
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

class X2TC_CoopOwnership extends Object dependson(X2TacticalGameRulesetDataStructures);

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
// L2229), so nothing stays in the campaign (Kc, 2026-11-15). The caller checks that the
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
	local XComGameState_Unit UnitState;

	foreach `XCOMHISTORY.IterateByClassType(class'XComGameState_Unit', UnitState)
	{
		if (IsOwnableSoldier(UnitState) && !UnitState.IsIncapacitated()
			&& GetOwner(UnitState) == OWNER_GUEST && UnitState.NumAllActionPoints() > 0)
		{
			return true;
		}
	}
	return false;
}
