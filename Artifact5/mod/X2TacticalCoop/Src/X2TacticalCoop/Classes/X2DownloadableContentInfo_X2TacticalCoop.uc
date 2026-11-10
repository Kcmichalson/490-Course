//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2DownloadableContentInfo_X2TacticalCoop
//
//  What it changes: nothing in the game yet. After the game creates its templates, it
//  writes one line tagged X2TC to Launch.log. With X2TC_MainMenuListener's line, this
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

static event OnPostTemplatesCreated()
{
	`log("DLC info loaded (OnPostTemplatesCreated)", , 'X2TC');
}
