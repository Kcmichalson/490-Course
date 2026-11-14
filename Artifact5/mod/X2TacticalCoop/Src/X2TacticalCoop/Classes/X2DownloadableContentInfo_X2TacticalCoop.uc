//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2DownloadableContentInfo_X2TacticalCoop
//
//  What it changes: nothing in the game. After the game creates its templates, it
//  writes two lines tagged X2TC to Launch.log: that it loaded, and the mod's version
//  (X2TC_VERSION below). With X2TC_MainMenuListener's line, this
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
const X2TC_VERSION = "0.3.2";

static event OnPostTemplatesCreated()
{
	`log("DLC info loaded (OnPostTemplatesCreated)", , 'X2TC');
	`log("version" @ X2TC_VERSION, , 'X2TC');
}
