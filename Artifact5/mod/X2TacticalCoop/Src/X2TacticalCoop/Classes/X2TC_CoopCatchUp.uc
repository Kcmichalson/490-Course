//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopCatchUp
//
//  What it changes: the partner's screen catches up faster (plans/m4-plan.md, "0.8.5"
//  item 4). 0.8.4c Part 2 (over the internet) showed the partner's screen 6-9 s behind on
//  average in alien turns and up to 21 s, while each transfer took under 1 s: the delay
//  is animations playing late. While the partner is more than CATCH_UP_START_MS behind,
//  this turns on the game's own fast mode ("Zip Mode", the option in the game's
//  settings), and turns it back off once the partner is less than CATCH_UP_STOP_MS
//  behind. Partner only; the host's screen is never changed.
//
//  The game reads the option from the player's profile in memory
//  (X2Action.ShouldPlayZipMode L1175-1178: the profile's bEnableZipMode, and not while the
//  tutorial flag is set, which the partner's replay sets only during XCOM's turn). This
//  class only flips it in memory and never saves the profile. It is put back:
//    - once caught up;
//    - when the pause menu opens (X2TC_CoopPauseListener), so the game's options screen
//      never shows or saves the borrowed value;
//    - when the session ends or the map closes (X2TC_CoopSession).
//  If the player already has fast mode on, nothing changes. A guess until tested: the
//  profile isn't saved by the game during a tactical mission except from the options
//  screen.
//
//  Fix switch: "Partner screen: fast mode while behind" (X2TC_CoopFixes.FIX_CATCH_UP).
//  Its state lives in config variables this mod never saves (memory only; see
//  X2TC_CoopFixes), so it survives this object being collected.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\X2Action.uc                         (ShouldPlayZipMode L1175-1178)
//    XComGame\Classes\XComOnlineProfileSettingsDataBlob.uc (bEnableZipMode L141)
//    Core\Globals.uci                                      (XPROFILESETTINGS L212)
//---------------------------------------------------------------------------------------

class X2TC_CoopCatchUp extends Object config(X2TacticalCoopFixes);

const CATCH_UP_START_MS = 3000;
const CATCH_UP_STOP_MS = 1000;

var config bool bZipSetByCoop;  // fast mode is on because of this class
var config float ZipStartTime;  // WorldInfo.RealTimeSeconds when it was turned on
var config int ZipTimesOn;      // this launch, for the log

// From X2TC_CoopLagLog.Sample (partner, about twice a second). BehindMs < 0: unknown.
static function Update(int BehindMs, string OldestAction)
{
	if (!class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_CATCH_UP))
	{
		Restore("switch off");
		return;
	}
	if (!default.bZipSetByCoop && BehindMs > CATCH_UP_START_MS)
	{
		TurnOn(BehindMs, OldestAction);
	}
	else if (default.bZipSetByCoop && BehindMs >= 0 && BehindMs < CATCH_UP_STOP_MS)
	{
		Restore("caught up");
	}
}

static function TurnOn(int BehindMs, string OldestAction)
{
	local XComOnlineProfileSettings Profile;

	Profile = `XPROFILESETTINGS;
	if (Profile == none || Profile.Data == none || Profile.Data.bEnableZipMode)
	{
		return; // no profile, or the player already plays with fast mode on
	}
	Profile.Data.bEnableZipMode = true;
	default.bZipSetByCoop = true;
	default.ZipStartTime = class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds;
	default.ZipTimesOn = default.ZipTimesOn + 1;
	`log("Coop catch-up: fast mode ON (" $ class'X2TC_CoopLagLog'.static.SecondsText(BehindMs) @ "behind, oldest action" @ (OldestAction != "" ? OldestAction : "-") $ "; time" @ default.ZipTimesOn @ "this launch)", , 'X2TC');
}

// Puts the player's own setting back, if this class changed it.
static function Restore(string Why)
{
	local XComOnlineProfileSettings Profile;

	if (!default.bZipSetByCoop)
	{
		return;
	}
	default.bZipSetByCoop = false;
	Profile = `XPROFILESETTINGS;
	if (Profile != none && Profile.Data != none)
	{
		Profile.Data.bEnableZipMode = false;
	}
	`log("Coop catch-up: fast mode OFF (" $ Why $ ", on for" @ int(class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds - default.ZipStartTime) $ "s)", , 'X2TC');
}
