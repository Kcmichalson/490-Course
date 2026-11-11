//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_MainMenuListener
//
//  What it changes: adds a MULTIPLAYER button to the main menu (M2, plans/m2-plan.md).
//  Clicking it makes the same call the old Multiplayer menu item made, which loads the
//  multiplayer shell. It also writes X2TC lines to Launch.log: one when a main menu
//  screen opens (the M0 hello-world check), one when the button is added, one per click.
//  M2 Stage 1c adds two test buttons that try to load the same map another way:
//  MP TEST: OPEN runs the "open" console command itself; MP TEST: TRAVEL calls the
//  player controller's ClientTravel.
//
//  The button is a separate button on the screen, not an item in the menu row, because
//  the game clears and rebuilds that row (UIFinalShell.UpdateMenu, UIShell.ClearMenu).
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreenListener.uc            (ScreenClass, OnInit)
//    XComGame\Classes\UIShell.uc                     (developer main menu; m_bDisableActions)
//    XComGame\Classes\UIFinalShell.uc                (retail main menu; extends UIShell)
//    XComGame\Classes\UIButton.uc                    (InitButton and its click delegate)
//    XComGame\Classes\UIPanel.uc                     (AnchorTopRight, SetPosition, DisableNavigation)
//    XComGame\Classes\XComShellPresentationLayer.uc  (StartMPShellState, the map URL)
//    XComGame\Classes\XComPlayerController.uc        (the shell's player controller)
//    Engine\Classes\Actor.uc                         (ConsoleCommand L1699, ETravelType L772)
//    Engine\Classes\PlayerController.uc              (ClientTravel L504)
//
//  ScreenClass is left as none and filtered with a UIShell cast, because whether the
//  native ScreenClass filter also matches subclasses is unknown (plans/m0-toolchain-plan.md).
//---------------------------------------------------------------------------------------

class X2TC_MainMenuListener extends UIScreenListener;

// The multiplayer shell map URL (SrcOrig\XComGame\Classes\XComShellPresentationLayer.uc L706).
const MPShellURL = "XComShell_Multiplayer.umap?Game=XComGame.XComMPShell";

event OnInit(UIScreen Screen)
{
	if (UIShell(Screen) == none)
	{
		return;
	}

	`log("Main menu listener loaded, screen class:" @ string(Screen.Class.Name), , 'X2TC');

	AddMPButton(Screen);
	AddTestButtons(Screen);
}

// Adds the standalone MULTIPLAYER button to a main menu screen.
function AddMPButton(UIScreen Screen)
{
	SpawnMenuButton(Screen, 'X2TC_MPButton', "MULTIPLAYER", OnMPButtonClicked, 40);
	`log("MP button added to" @ string(Screen.Class.Name), , 'X2TC');
}

// M2 Stage 1c test buttons: two other ways to load the multiplayer shell map.
function AddTestButtons(UIScreen Screen)
{
	SpawnMenuButton(Screen, 'X2TC_OpenButton', "MP TEST: OPEN", OnOpenButtonClicked, 90);
	SpawnMenuButton(Screen, 'X2TC_TravelButton', "MP TEST: TRAVEL", OnTravelButtonClicked, 140);
	`log("MP test buttons added to" @ string(Screen.Class.Name), , 'X2TC');
}

// One mouse-only button in a column at the top right (off the logo at the top left).
function SpawnMenuButton(UIScreen Screen, name ButtonName, string Label, delegate<UIButton.OnClickedDelegate> Handler, float Y)
{
	local UIButton NewButton;

	NewButton = Screen.Spawn(class'UIButton', Screen);
	NewButton.InitButton(ButtonName, Label, Handler);
	NewButton.AnchorTopRight();
	NewButton.SetPosition(-340, Y);
	// Mouse only: keep it out of the keyboard and controller navigation of the main menu.
	NewButton.DisableNavigation();
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

// Test A: runs the console command that the SDK's StartMPShellState runs
// (XComShellPresentationLayer.uc L706), from our own code.
function OnOpenButtonClicked(UIButton Button)
{
	local XComShellPresentationLayer ShellPres;

	ShellPres = GetShellPres(Button, "OPEN");
	if (ShellPres == none)
	{
		return;
	}

	`log("MP test OPEN clicked, running: open" @ MPShellURL, , 'X2TC');
	ShellPres.ConsoleCommand("open" @ MPShellURL);
	`log("MP test OPEN: ConsoleCommand returned", , 'X2TC');
}

// Test B: asks the player controller to travel, the way the shell starts an online
// game (XComShellPresentationLayer.uc L1197; PlayerController.ClientTravel L504).
function OnTravelButtonClicked(UIButton Button)
{
	local XComShellPresentationLayer ShellPres;
	local XComPlayerController ShellPC;

	ShellPres = GetShellPres(Button, "TRAVEL");
	if (ShellPres == none)
	{
		return;
	}

	ShellPC = XComPlayerController(ShellPres.Owner);
	if (ShellPC == none)
	{
		`log("MP test TRAVEL clicked, but the shell presentation layer has no XComPlayerController owner", , 'X2TC');
		return;
	}

	`log("MP test TRAVEL clicked, ClientTravel to" @ MPShellURL, , 'X2TC');
	ShellPC.ClientTravel(MPShellURL, TRAVEL_Absolute);
	`log("MP test TRAVEL: ClientTravel returned", , 'X2TC');
}

// The same guards as OnMPButtonClicked, for the test buttons. Returns none (and logs why)
// if the click should be ignored.
function XComShellPresentationLayer GetShellPres(UIButton Button, string TestName)
{
	local UIShell ShellScreen;
	local XComShellPresentationLayer ShellPres;

	ShellScreen = UIShell(Button.Screen);
	if (ShellScreen == none)
	{
		`log("MP test" @ TestName @ "clicked, but its screen is not a main menu", , 'X2TC');
		return none;
	}

	if (ShellScreen.m_bDisableActions)
	{
		`log("MP test" @ TestName @ "clicked, ignored: main menu actions are disabled", , 'X2TC');
		return none;
	}

	ShellPres = XComShellPresentationLayer(ShellScreen.Owner);
	if (ShellPres == none)
	{
		`log("MP test" @ TestName @ "clicked, but the owner of the main menu is not the shell presentation layer", , 'X2TC');
		return none;
	}

	return ShellPres;
}

defaultproperties
{
	ScreenClass = none
}
