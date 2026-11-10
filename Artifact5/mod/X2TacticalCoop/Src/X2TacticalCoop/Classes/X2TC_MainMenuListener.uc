//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_MainMenuListener
//
//  What it changes: nothing in the game yet. When a main menu screen opens, it writes
//  one line tagged X2TC to Launch.log, naming the screen class it saw. M0's
//  hello-world check; the starting point for M2's "open the multiplayer screen" button.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreenListener.uc  (ScreenClass, OnInit)
//    XComGame\Classes\UIShell.uc           (developer main menu)
//    XComGame\Classes\UIFinalShell.uc      (retail main menu; extends UIShell)
//
//  ScreenClass is left as none and filtered with a UIShell cast, because whether the
//  native ScreenClass filter also matches subclasses is unknown (plans/m0-toolchain-plan.md).
//---------------------------------------------------------------------------------------

class X2TC_MainMenuListener extends UIScreenListener;

event OnInit(UIScreen Screen)
{
	if (UIShell(Screen) == none)
	{
		return;
	}

	`log("Main menu listener loaded, screen class:" @ string(Screen.Class.Name), , 'X2TC');
}

defaultproperties
{
	ScreenClass = none
}
