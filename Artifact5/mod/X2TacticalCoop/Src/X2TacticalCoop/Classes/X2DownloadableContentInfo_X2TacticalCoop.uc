//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2DownloadableContentInfo_X2TacticalCoop
//
//  What it changes: after the game creates its templates, it writes two lines tagged
//  X2TC to Launch.log: that it loaded, and the mod's version (X2TC_VERSION below). With
//  X2TC_MainMenuListener's line, this tells "the mod didn't load" apart from "the
//  listener didn't fire". It also makes the start-up template edits for the
//  single-player rules (X2TC_CoopRulesAbility, X2TC_CoopStasisLanceCalc); each acts only
//  in a co-op session with its switch on.
//
//  Relies on (path in Development\SrcOrig):
//    XComGame\Classes\X2DownloadableContentInfo.uc  (DLCIdentifier L25,
//                                                    OnPostTemplatesCreated L105)
//
//  DLCIdentifier is set in Config/XComGame.ini. The class name follows the usual
//  X2DownloadableContentInfo_<package> pattern.
//---------------------------------------------------------------------------------------

class X2DownloadableContentInfo_X2TacticalCoop extends X2DownloadableContentInfo;

// The mod's version. Logged at load so two players can check they run the same build
// (the game's own mods hash doesn't seem to cover file contents).
const X2TC_VERSION = "0.8.6";

static event OnPostTemplatesCreated()
{
	`log("DLC info loaded (OnPostTemplatesCreated)", , 'X2TC');
	`log("version" @ X2TC_VERSION, , 'X2TC');
	// Single-player rules while connected (each acts only in a co-op session with its
	// switch on).
	class'X2TC_CoopRulesAbility'.static.AddToCharacters();
	class'X2TC_CoopStasisLanceCalc'.static.SwapIntoTemplates();
}
