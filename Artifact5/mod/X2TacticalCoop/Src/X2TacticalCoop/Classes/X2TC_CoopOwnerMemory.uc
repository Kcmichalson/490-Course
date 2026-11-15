//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopOwnerMemory
//
//  What it changes: remembers, on the host's PC, which soldiers the squad screen gave to
//  the partner, per campaign, outside the save (Kc, 2026-11-15: "track what soldiers were
//  originally the host/partners [...] without baking it into the save"). When the PC
//  hosts a later mission of the same campaign, X2TC_CoopSession gives those soldiers back
//  to the partner. The list lives in the mod's own config file (config
//  X2TacticalCoopOwners), which the game writes to the player's own config folder on the
//  first save. The shipped default (Config\XComX2TacticalCoopOwners.ini) holds no entries
//  and must not change between releases: a changed default may make the game rebuild
//  the player's copy and lose the list (a guess, checked by the checklist). Removing the
//  mod or the file loses only this list; the save holds none of it.
//
//  A campaign is keyed by its start time, which the game calls "the true UID for this
//  campaign" (XComGameState_CampaignSettings.uc L15). Missions without one (Skirmish,
//  maybe) are not remembered. A soldier is keyed by its object ID, which stays the same
//  for the whole campaign.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComGameState_CampaignSettings.uc (StartTime L15)
//    Core\Classes\Object.uc                (StaticSaveConfig L1949)
//---------------------------------------------------------------------------------------

class X2TC_CoopOwnerMemory extends Object config(X2TacticalCoopOwners);

struct X2TC_OwnerEntry
{
	var string Campaign;
	var int UnitID;
	var int Owner;
};

var config array<X2TC_OwnerEntry> Entries;

// The current campaign's key (its start time), or "" if it has none.
static function string CampaignKey()
{
	local XComGameState_CampaignSettings Settings;

	Settings = XComGameState_CampaignSettings(`XCOMHISTORY.GetSingleGameStateObjectForClass(class'XComGameState_CampaignSettings', true));
	if (Settings == none)
	{
		return "";
	}
	return Settings.StartTime;
}

static function int FindEntry(string Campaign, int UnitID)
{
	local int i;

	for (i = 0; i < default.Entries.Length; i++)
	{
		if (default.Entries[i].Campaign == Campaign && default.Entries[i].UnitID == UnitID)
		{
			return i;
		}
	}
	return INDEX_NONE;
}

// Host: the remembered owner of a soldier in this campaign, or 0 if none.
static function int Recall(int UnitID)
{
	local string Campaign;
	local int Index;

	Campaign = CampaignKey();
	if (Campaign == "")
	{
		return 0;
	}
	Index = FindEntry(Campaign, UnitID);
	if (Index == INDEX_NONE)
	{
		return 0;
	}
	return default.Entries[Index].Owner;
}

// Host: remember a soldier's owner for this campaign, and write the file.
static function Remember(int UnitID, int Owner)
{
	local X2TC_OwnerEntry Entry;
	local array<X2TC_OwnerEntry> NewEntries;
	local string Campaign;
	local int Index;

	Campaign = CampaignKey();
	if (Campaign == "")
	{
		`log("Coop memory: this mission has no campaign ID; owner of unit" @ UnitID @ "not remembered", , 'X2TC');
		return;
	}
	// Changed on a copy, then assigned back to the config default as a whole.
	NewEntries = default.Entries;
	Index = FindEntry(Campaign, UnitID);
	if (Index == INDEX_NONE)
	{
		Entry.Campaign = Campaign;
		Entry.UnitID = UnitID;
		Entry.Owner = Owner;
		NewEntries.AddItem(Entry);
	}
	else if (NewEntries[Index].Owner == Owner)
	{
		return;
	}
	else
	{
		NewEntries[Index].Owner = Owner;
	}
	default.Entries = NewEntries;
	StaticSaveConfig();
	`log("Coop memory: unit" @ UnitID @ "->" @ class'X2TC_CoopOwnership'.static.OwnerText(Owner) @ "remembered (" $ NewEntries.Length @ "entries in the file)", , 'X2TC');
}

// Logs how many entries the file holds, and how many are for this campaign.
static function LogSummary()
{
	local string Campaign;
	local int i, ForThis;

	Campaign = CampaignKey();
	for (i = 0; i < default.Entries.Length; i++)
	{
		if (Campaign != "" && default.Entries[i].Campaign == Campaign)
		{
			ForThis++;
		}
	}
	`log("Coop memory:" @ default.Entries.Length @ "entries in the file," @ ForThis @ "for this campaign (campaign ID present=" $ (Campaign != "") $ ")", , 'X2TC');
}
