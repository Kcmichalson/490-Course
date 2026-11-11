//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_MainMenuListener
//
//  What it changes: adds a MULTIPLAYER button to the main menu (M2, plans/m2-plan.md).
//  Clicking it makes the same call the old Multiplayer menu item made, which loads the
//  multiplayer shell. It also writes X2TC lines to Launch.log: one when a main menu
//  screen opens (the M0 hello-world check), one when the button is added, one per click.
//
//  The button is a separate button on the screen, not an item in the menu row, because
//  the game clears and rebuilds that row (UIFinalShell.UpdateMenu, UIShell.ClearMenu).
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreenListener.uc            (ScreenClass, OnInit)
//    XComGame\Classes\UIShell.uc                     (developer main menu; m_bDisableActions)
//    XComGame\Classes\UIFinalShell.uc                (retail main menu; extends UIShell)
//    XComGame\Classes\UIButton.uc                    (InitButton and its click delegate)
//    XComGame\Classes\UIPanel.uc                     (AnchorTopLeft, SetPosition, DisableNavigation)
//    XComGame\Classes\XComShellPresentationLayer.uc  (StartMPShellState)
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

	AddMPButton(Screen);
}

// Adds the standalone MULTIPLAYER button to a main menu screen.
function AddMPButton(UIScreen Screen)
{
	local UIButton MPButton;

	MPButton = Screen.Spawn(class'UIButton', Screen);
	MPButton.InitButton('X2TC_MPButton', "MULTIPLAYER", OnMPButtonClicked);
	MPButton.AnchorTopLeft();
	MPButton.SetPosition(40, 40);
	// Mouse only: keep it out of the keyboard and controller navigation of the main menu.
	MPButton.DisableNavigation();

	`log("MP button added to" @ string(Screen.Class.Name), , 'X2TC');
}

// Click handler. Does what the old Multiplayer item did (UIFinalShell.OnMenuButtonClicked,
// case 'MP'), with the same single guard, m_bDisableActions.
function OnMPButtonClicked(UIButton Button)
{
	local UIShell ShellScreen;
	local XComShellPresentationLayer ShellPres;

	ShellScreen = UIShell(Button.Screen);
	if (ShellScreen == none)
	{
		`log("MP button clicked, but its screen is not a main menu", , 'X2TC');
		return;
	}

	if (ShellScreen.m_bDisableActions)
	{
		`log("MP button clicked, ignored: main menu actions are disabled (invite in progress)", , 'X2TC');
		return;
	}

	ShellPres = XComShellPresentationLayer(ShellScreen.Owner);
	if (ShellPres == none)
	{
		`log("MP button clicked, but the owner of the main menu is not the shell presentation layer", , 'X2TC');
		return;
	}

	`log("MP button clicked, calling StartMPShellState", , 'X2TC');
	ShellPres.StartMPShellState();
}

defaultproperties
{
	ScreenClass = none
}
