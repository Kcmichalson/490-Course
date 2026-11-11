//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_MainMenuListener
//
//  What it changes: adds a MULTIPLAYER button to the main menu (M2, plans/m2-plan.md).
//  Clicking it loads the multiplayer shell map with the player controller's ClientTravel
//  (the old Multiplayer item's StartMPShellState loads nothing on build 8270065; M2
//  Stage 1c). It also writes X2TC lines to Launch.log: one when a main menu
//  screen opens (the M0 hello-world check), one when the button is added, one per click.
//  It also fixes the return from a lobby or match: when the main menu opens with the
//  game's "go on to the multiplayer menu" request, it travels there itself
//  (ReturnToMPMenuIfAsked; plans/m2-live-test-plan.md).
//  The PC test build (SHOW_TEST_BUTTONS) adds MP TEST buttons that try other ways to load
//  a map: the "open" console command for three maps, and ClientTravel.
//
//  The button is a separate button on the screen, not an item in the menu row, because
//  the game clears and rebuilds that row (UIFinalShell.UpdateMenu, UIShell.ClearMenu).
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreenListener.uc            (ScreenClass, OnInit)
//    XComGame\Classes\UIShell.uc                     (developer main menu; m_bDisableActions)
//    XComGame\Classes\UIFinalShell.uc                (retail main menu; extends UIShell)
//    XComGame\Classes\UIButton.uc                    (InitButton, its click delegate, DisableButton)
//    XComGame\Classes\UIPanel.uc                     (AnchorTopRight, SetPosition, DisableNavigation,
//                                                     bIsVisible, Movie)
//    XComGame\Classes\XComPresentationLayerBase.uc   (PlayUISound L2761)
//    Engine\Classes\OnlineEventMgr.uc                (GetShuttleToMPMainMenu L246)
//    Engine\Classes\WorldInfo.uc                     (GetLocalURL L1170)
//    XComGame\Classes\XComShellPresentationLayer.uc  (the map URL, L706)
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

// Stage 1e test URLs. The first is what the multiplayer menu's own exit runs
// (X2MPShellManager.uc L268); the second is the shape of the lobby's match-start command
// (UIMPShell_Lobby.uc L648), with a multiplayer plot from the game's DefaultPlots.ini.
const OpenShellTestURL = "XPACK_Shell_Intro?Game=XComGame.XComShell";
const OpenMPTacTestURL = "Plot_WLD_MP_Sm_01?game=XComGame.XComMPTacticalGame";

// true: the PC test build, with the MP TEST buttons. false: the build other players get.
const SHOW_TEST_BUTTONS = true;

event OnInit(UIScreen Screen)
{
	if (UIShell(Screen) == none)
	{
		return;
	}

	`log("Main menu listener loaded, screen class:" @ string(Screen.Class.Name), , 'X2TC');

	AddMPButton(Screen);
	if (SHOW_TEST_BUTTONS)
	{
		AddTestButtons(Screen);
	}

	ReturnToMPMenuIfAsked(Screen);
}

// Adds the standalone MULTIPLAYER button to a main menu screen.
function AddMPButton(UIScreen Screen)
{
	SpawnMenuButton(Screen, 'X2TC_MPButton', "MULTIPLAYER", OnMPButtonClicked, 40);
	`log("MP button added to" @ string(Screen.Class.Name), , 'X2TC');
}

// Test buttons (PC test build only): other ways to load a map from the main menu.
function AddTestButtons(UIScreen Screen)
{
	SpawnMenuButton(Screen, 'X2TC_OpenButton', "MP TEST: OPEN", OnOpenButtonClicked, 90);
	SpawnMenuButton(Screen, 'X2TC_TravelButton', "MP TEST: TRAVEL", OnTravelButtonClicked, 140);
	SpawnMenuButton(Screen, 'X2TC_OpenShellButton', "MP TEST: OPEN SHELL", OnOpenShellButtonClicked, 190);
	SpawnMenuButton(Screen, 'X2TC_OpenMPTacButton', "MP TEST: OPEN MP TAC", OnOpenMPTacButtonClicked, 240);
	`log("MP test buttons added to" @ string(Screen.Class.Name), , 'X2TC');
}

// Lobby-exit fix. Leaving a multiplayer lobby or match sends the game to the main menu
// with a request to go on to the multiplayer menu. The game's own answer hides the main
// menu and calls StartMPShellState (XComShellPresentationLayer.uc L385-399), which loads
// nothing on 8270065, so the player is left on a hidden menu. Here the mod travels to the
// multiplayer shell itself. Two signals, because it is not known whether this runs before
// or after the game clears its request: the request flag (OnlineEventMgr.uc L246), or a
// hidden main menu on a map that was loaded after a closed connection ("?closed").
function ReturnToMPMenuIfAsked(UIScreen Screen)
{
	local XComOnlineEventMgr OnlineMgr;
	local XComPlayerController ShellPC;
	local bool bShuttleAsked, bClosedURL;

	OnlineMgr = `ONLINEEVENTMGR;
	bShuttleAsked = (OnlineMgr != none && OnlineMgr.GetShuttleToMPMainMenu());
	bClosedURL = (InStr(Screen.WorldInfo.GetLocalURL(), "?closed") != -1);

	`log("Main menu state: shuttle to MP menu=" $ bShuttleAsked @ "closed URL=" $ bClosedURL @ "visible=" $ Screen.bIsVisible, , 'X2TC');

	if (!bShuttleAsked && !(bClosedURL && !Screen.bIsVisible))
	{
		return;
	}

	ShellPC = GetShellPC(Screen);
	if (ShellPC == none)
	{
		`log("Return to MP menu wanted, but the main menu has no XComPlayerController", , 'X2TC');
		return;
	}

	`log("Return to MP menu: ClientTravel to" @ MPShellURL, , 'X2TC');
	ShellPC.ClientTravel(MPShellURL, TRAVEL_Absolute);
}

// The player controller that owns a main menu screen's presentation layer, or none.
function XComPlayerController GetShellPC(UIScreen Screen)
{
	local XComShellPresentationLayer ShellPres;

	ShellPres = XComShellPresentationLayer(Screen.Owner);
	if (ShellPres == none)
	{
		return none;
	}

	return XComPlayerController(ShellPres.Owner);
}

// Click feedback: the menu-select sound the game's own menus play
// (XComPresentationLayerBase.PlayUISound L2761).
function PlayClickSound(UIButton Button)
{
	if (Button.Movie != none && Button.Movie.Pres != none)
	{
		Button.Movie.Pres.PlayUISound(eSUISound_MenuSelect);
	}
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

// Click handler. Has the old Multiplayer item's guard (UIFinalShell.OnMenuButtonClicked,
// case 'MP', m_bDisableActions), but loads the multiplayer shell with ClientTravel instead
// of StartMPShellState.
function OnMPButtonClicked(UIButton Button)
{
	local UIShell ShellScreen;
	local XComShellPresentationLayer ShellPres;
	local XComPlayerController ShellPC;

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

	// Stage 1c showed StartMPShellState and the "open" console command load nothing on
	// 8270065, while ClientTravel loads the multiplayer shell (LOG.md, M2 Stage 1c).
	ShellPC = XComPlayerController(ShellPres.Owner);
	if (ShellPC == none)
	{
		`log("MP button clicked, but the shell presentation layer has no XComPlayerController owner", , 'X2TC');
		return;
	}

	`log("MP button clicked, ClientTravel to" @ MPShellURL, , 'X2TC');
	PlayClickSound(Button);
	// One click is enough: grey the button out while the map loads.
	Button.DisableButton();
	ShellPC.ClientTravel(MPShellURL, TRAVEL_Absolute);
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
	PlayClickSound(Button);
	ShellPres.ConsoleCommand("open" @ MPShellURL);
	`log("MP test OPEN: ConsoleCommand returned", , 'X2TC');
}

// Stage 1e control: the "open" command for the main shell map, from the main menu.
function OnOpenShellButtonClicked(UIButton Button)
{
	RunOpenTest(Button, "OPEN SHELL", OpenShellTestURL);
}

// Stage 1e: the "open" command for a multiplayer tactical map, the shape of the lobby's
// match-start command. Without a match set up the map may not start properly; the test
// only needs to know whether the game begins loading it.
function OnOpenMPTacButtonClicked(UIButton Button)
{
	RunOpenTest(Button, "OPEN MP TAC", OpenMPTacTestURL);
}

function RunOpenTest(UIButton Button, string TestName, string URL)
{
	local XComShellPresentationLayer ShellPres;

	ShellPres = GetShellPres(Button, TestName);
	if (ShellPres == none)
	{
		return;
	}

	`log("MP test" @ TestName @ "clicked, running: open" @ URL, , 'X2TC');
	PlayClickSound(Button);
	ShellPres.ConsoleCommand("open" @ URL);
	`log("MP test" @ TestName $ ": ConsoleCommand returned", , 'X2TC');
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
	PlayClickSound(Button);
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
