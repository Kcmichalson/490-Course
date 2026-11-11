//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_MPTraceListener
//
//  What it changes: nothing in the game. Diagnostics for M2 (plans/m2-plan.md). The game
//  suppresses its own multiplayer log categories, so this listener writes X2TC lines to
//  Launch.log that show how far the multiplayer flow got:
//    - every screen that opens: its class, and the class of the current game mode;
//    - multiplayer shell screens: the two connectivity flags that gray out menu items;
//    - the multiplayer main menu: the values two games compare before they connect
//      (package, DLC, mod and INI hashes, the developer-console flag) and the names of
//      the installed mods and DLC.
//  It logs every screen in the game, so narrow or remove it once M2 is decided.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreenListener.uc    (ScreenClass, OnInit)
//    XComGame\Classes\UIMPShell_Base.uc      (m_kMPShellManager)
//    XComGame\Classes\X2MPShellManager.uc    (m_bPassedNetworkConnectivityCheck,
//                                             m_bPassedOnlineConnectivityCheck)
//    XComGame\Classes\UIMPShell_MainMenu.uc  (the multiplayer main menu)
//    XComGame\Classes\Helpers.uc             (the static Net... functions)
//    Core\Classes\Object.uc                  (JoinArray)
//---------------------------------------------------------------------------------------

class X2TC_MPTraceListener extends UIScreenListener;

event OnInit(UIScreen Screen)
{
	local UIMPShell_Base MPScreen;
	local string GameClassName;

	GameClassName = "none";
	if (Screen.WorldInfo != none && Screen.WorldInfo.Game != none)
	{
		GameClassName = string(Screen.WorldInfo.Game.Class.Name);
	}

	`log("screen" @ string(Screen.Class.Name) $ ", game" @ GameClassName, , 'X2TC');

	MPScreen = UIMPShell_Base(Screen);
	if (MPScreen != none)
	{
		LogMPState(MPScreen);
	}

	if (UIMPShell_MainMenu(Screen) != none)
	{
		LogMPCriteria();
	}
}

// The two flags UIMPShell_MainMenu.UpdateConnectivityDependentButtons reads to decide
// which menu items are enabled.
function LogMPState(UIMPShell_Base MPScreen)
{
	local X2MPShellManager ShellManager;

	ShellManager = MPScreen.m_kMPShellManager;
	if (ShellManager == none)
	{
		`log("MP state: no shell manager on" @ string(MPScreen.Class.Name), , 'X2TC');
		return;
	}

	`log("MP state network=" $ ShellManager.m_bPassedNetworkConnectivityCheck @ "online=" $ ShellManager.m_bPassedOnlineConnectivityCheck, , 'X2TC');
}

// The values a host publishes and a searcher sends (XComShellPresentationLayer.
// OSSCreateGameSettings and its search counterpart). Printed so two machines can be
// compared before they try to connect. The package hashes go on their own line because
// they may be long.
function LogMPCriteria()
{
	local array<string> Names;
	local string Line, Joined;

	Line = "MP criteria dlc=" $ class'Helpers'.static.NetGetInstalledMPFriendlyDLCHash();
	Line = Line @ "mods=" $ class'Helpers'.static.NetGetInstalledModsHash();
	Line = Line @ "ini=" $ class'Helpers'.static.NetGetMPINIHash();
	Line = Line @ "devconsole=" $ class'Helpers'.static.IsDevConsoleEnabled();
	Line = Line @ "modsinstalled=" $ class'Helpers'.static.NetAreModsInstalled();
	`log(Line, , 'X2TC');

	Line = "MP criteria packages=" $ class'Helpers'.static.NetGetVerifyPackageHashes();
	`log(Line, , 'X2TC');

	Names = class'Helpers'.static.GetInstalledModNames();
	JoinArray(Names, Joined, ", ");
	`log("MP criteria mod names:" @ Joined, , 'X2TC');

	Names = class'Helpers'.static.GetInstalledDLCNames();
	JoinArray(Names, Joined, ", ");
	`log("MP criteria DLC names:" @ Joined, , 'X2TC');
}

defaultproperties
{
	ScreenClass = none
}
