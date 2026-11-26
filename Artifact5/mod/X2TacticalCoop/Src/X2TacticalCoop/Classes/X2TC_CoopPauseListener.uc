//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopPauseListener
//
//  What it changes: in a co-op session only, the tactical pause menu pauses this machine's
//  game again, as in single-player. The pause menu
//  pauses only when the engine doesn't report a multiplayer game (UIPauseMenu.InitScreen,
//  SDK L88-91), and co-op makes it report one (X2TC_CoopSPRules). Closing the menu
//  unpauses as before (UIPauseMenu.OnRemoved calls SetPause(false) unconditionally,
//  L800-802). Each machine pauses only itself; the other keeps running (a guess what the
//  connection does during a long pause: it is logged). Fix switch: "Single-player rules
//  while connected".
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIPauseMenu.uc    (InitScreen L78-91, OnRemoved L800)
//    XComGame\Classes\UIShellStrategy.uc (extends UIPauseMenu, L10; left alone)
//    XComGame\Classes\UIPanel.uc        (PC L68)
//---------------------------------------------------------------------------------------

class X2TC_CoopPauseListener extends UIScreenListener;

event OnInit(UIScreen Screen)
{
	local XComEngine Engine;

	// Give the player's own fast-mode setting back before the options can show or save it
	// (X2TC_CoopCatchUp borrows it while the partner is behind).
	if (UIPauseMenu(Screen) != none)
	{
		class'X2TC_CoopCatchUp'.static.Restore("pause menu");
	}
	if (UIPauseMenu(Screen) == none || Screen.IsA('UIShellStrategy') || !class'X2TC_CoopSession'.static.IsSessionActive())
	{
		return; // not co-op, or not the tactical pause menu: untouched
	}
	Engine = `XENGINE;
	if (Engine == none || !Engine.IsMultiPlayerGame())
	{
		return; // the menu already paused (single-player rules apply)
	}
	if (!class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_SP_RULES))
	{
		`log("Coop SP rules: pause menu opened, not paused (fix off)", , 'X2TC');
		return;
	}
	if (Screen.PC != none)
	{
		Screen.PC.SetPause(true);
		`log("Coop SP rules: pause menu opened; this PC's game paused as in single-player", , 'X2TC');
	}
}

event OnRemoved(UIScreen Screen)
{
	if (UIPauseMenu(Screen) != none && !Screen.IsA('UIShellStrategy') && class'X2TC_CoopSession'.static.IsSessionActive())
	{
		`log("Coop SP rules: pause menu closed (the game unpauses itself)", , 'X2TC');
	}
}

defaultproperties
{
	ScreenClass = class'UIPauseMenu'
}
