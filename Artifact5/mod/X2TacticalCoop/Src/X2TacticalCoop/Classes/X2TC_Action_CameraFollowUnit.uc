//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_Action_CameraFollowUnit
//
//  What it changes: CLASS OVERRIDE of X2Action_CameraFollowUnit (approved by Kc,
//  2026-11-20, plans/m4-plan.md 0.8.0 "Camera"; listed in the release's compatibility
//  notes). The stock action skips the follow camera for a moving unit when the engine
//  reports a multiplayer game, except for concealed friendly units
//  (X2Action_CameraFollowUnit.uc L47-61). The guard's suspected cause on the guest: its
//  network connection makes IsMultiPlayerGame() true (a guess; X2TC_CoopSession logs the
//  value at HOST and JOIN). Only while a co-op session is active and the fix switch
//  "Partner's camera follows moves" is on, this override ignores that multiplayer branch
//  and follows as in single-player. In every other case (normal single-player, the
//  tutorial, multiplayer matches, the switch off) it returns exactly what the stock
//  function returns.
//
//  Why an override: the check is inside the action's Executing state, which the move
//  visualization creates directly (X2VisualizerHelpers.uc L326-344); no event, template or
//  Community Highlander hook changes it (the Highlander doesn't replace this class).
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\X2Action_CameraFollowUnit.uc (state Executing,
//                                                   ShouldCameraFrameAction L47-61)
//    XComGame\Classes\X2Action.uc                  (bNewUnitSelected L54; actions are
//                                                   spawned by class, L60-69, so the
//                                                   override applies)
//    XComGame\Classes\XComEngine.uc                (IsMultiPlayerGame L190)
//---------------------------------------------------------------------------------------

class X2TC_Action_CameraFollowUnit extends X2Action_CameraFollowUnit;

simulated state Executing
{
	function bool ShouldCameraFrameAction()
	{
		local bool bStock, bResult;
		local XComEngine Engine;

		class'X2TC_CoopFixes'.static.MarkCameraOverrideRan(); // diagnostics (config default, never saved)
		bStock = super.ShouldCameraFrameAction();
		if (!class'X2TC_CoopSession'.static.IsSessionActive())
		{
			return bStock; // not co-op: the game's own answer
		}
		Engine = `XENGINE;
		bResult = bStock;
		if (class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_CAMERA) && Engine != none && Engine.IsMultiPlayerGame())
		{
			bResult = !bNewUnitSelected; // the single-player answer
		}
		if (class'X2TC_CoopFixes'.static.Verbose()) `log("Coop camera: follow camera for unit" @ AbilityToFrame.InputContext.SourceObject.ObjectID
			@ "stock=" $ bStock @ "used=" $ bResult @ "(engine multiplayer=" $ (Engine != none && Engine.IsMultiPlayerGame())
			@ "new unit selected=" $ bNewUnitSelected @ "fix=" $ class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_CAMERA) $ ")", , 'X2TC');
		return bResult;
	}
}
