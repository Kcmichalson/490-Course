//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2DownloadableContentInfo_X2TacticalCoop
//
//  What it changes: after the game creates its templates, it writes two lines tagged
//  X2TC to Launch.log: that it loaded, and the mod's version (X2TC_VERSION below).
//  0.8.2: it also makes the start-up template edits for the single-player rules
//  (X2TC_CoopRulesAbility, X2TC_CoopStasisLanceCalc); each acts only in a co-op session
//  with its switch on. 0.8.3: the Shadowbind edit is gone (it never changed anything in
//  0.8.2 Runs 2-3). With X2TC_MainMenuListener's line, this
//  tells "the mod didn't load" apart from "the listener didn't fire"
//  (plans/m0-dlcinfo-plan.md).
//
//  Relies on (path in Development\SrcOrig):
//    XComGame\Classes\X2DownloadableContentInfo.uc  (DLCIdentifier L25,
//                                                    OnPostTemplatesCreated L105)
//
//  DLCIdentifier is set in Config/XComGame.ini. The class name follows the usual
//  X2DownloadableContentInfo_<package> pattern (Kc's decision).
//---------------------------------------------------------------------------------------

class X2DownloadableContentInfo_X2TacticalCoop extends X2DownloadableContentInfo;

// The mod's version. Logged at load so two players can check they run the same build
// (the game's own mods hash doesn't seem to cover file contents; plans/m2-live-test-plan.md).
const X2TC_VERSION = "0.8.3";

static event OnPostTemplatesCreated()
{
	`log("DLC info loaded (OnPostTemplatesCreated)", , 'X2TC');
	`log("version" @ X2TC_VERSION, , 'X2TC');
	// 0.8.2: single-player rules while connected (each acts only in a co-op session with its
	// switch on; plans/m4-plan.md, 0.8.2 items 5-6).
	class'X2TC_CoopRulesAbility'.static.AddToCharacters();
	class'X2TC_CoopStasisLanceCalc'.static.SwapIntoTemplates();
}
