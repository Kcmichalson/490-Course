//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopListener
//
//  What it changes: adds the two co-op test buttons (plans/m3-plan.md, Stage 2).
//    - CO-OP: HOST on the tactical HUD of a single-player mission (not in multiplayer
//      matches): starts the host side of X2TC_CoopSession.
//    - CO-OP: JOIN on the main menu: opens the game's text box for the host's address
//      (an IP address or its one-number form), then starts the guest side.
//  Each writes X2TC lines to Launch.log; the address itself is never logged.
//  On the guest, after it has opened the host's mission (Stage 3), the tactical HUD gets
//  no HOST button; instead it and the game's replay screen (UIReplay) tell the session
//  they opened. From Stage 4, the replay screen is closed when the session's follower
//  (X2TC_CoopReplayMgr) has replaced the stock replay manager. From Stage 5 the guest's
//  tactical HUD has CO-OP: LEAVE (X2TC_CoopSession.LeaveAsGuest) where HOST would be.
//  From Stage 6 both HUDs get CO-OP: END TURN (host: ends the turn, asking first while
//  the partner's soldiers can act; guest: tells the host it is ready) and a status line
//  (a UIText named X2TC_CoopStatus that X2TC_CoopTurnUI sets), and CO-OP: SQUAD, which
//  opens X2TC_CoopSquadScreen. Stage 7 (0.6.0): CO-OP: HOST (STEAM) on the host's HUD
//  (then INVITE (STEAM)) and CO-OP: JOIN (STEAM) on the main menu. 0.8.0: CO-OP: FIXES on
//  both HUDs (X2TC_CoopFixesScreen), and HOST refused in the campaign's tutorial mission
//  (XComGameReplicationInfo.uc L159-166 spawns XComTutorialMgr there). 0.8.3: while a
//  JOIN is connecting, the JOIN button reads CO-OP: CONNECTING (CANCEL), and a click
//  cancels it (UIScreenStack.GetFirstInstanceOf L620, UIPanel.GetChildByName L856).
//  0.8.4 (plans/m4-plan.md, C items 9, 11, 13; "1.0 plan" item 1): with RELEASE_UI, the
//  main menu shows CO-OP: JOIN (STEAM) first and CO-OP: JOIN BY IP under it (the
//  MULTIPLAYER button is gone: X2TC_MainMenuListener), and the tactical HUD's column of
//  CO-OP buttons becomes one Co-op icon with a panel (X2TC_CoopMenu). Visible without the
//  panel: the status line and, on the partner, END TURN (READY). Before hosting, the
//  host's panel has HOST (STEAM), HOST BY IP and FIXES; SQUAD and END TURN appear once
//  hosting. MOVE TO CURSOR is gone from the partner's HUD (M and right-click still work).
//
//  Both are mouse-only buttons at the top right, like the MULTIPLAYER button
//  (X2TC_MainMenuListener). JOIN sits below the MP TEST buttons' column so the test build
//  doesn't overlap it.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreenListener.uc         (ScreenClass, OnInit)
//    XComGame\Classes\UIShell.uc                  (main menu; m_bDisableActions)
//    XComGame\Classes\UITacticalHUD.uc            (the tactical screen)
//    XComGame\Classes\UIReplay.uc                 (the replay screen; pushed by
//                                                  XComPresentationLayerBase.UIReplayScreen L2253)
//    XComGame\Classes\XComMPTacticalGame.uc       (extends XComTacticalGame, L5)
//    XComGame\Classes\UIButton.uc                 (InitButton, SetText L72, DisableButton)
//    XComGame\Classes\UIPanel.uc                  (AnchorTopRight, SetPosition, DisableNavigation)
//    XComGame\Classes\UIInputDialogue.uc          (TInputDialogData L26, callbacks L59-61)
//    XComGame\Classes\XComPresentationLayerBase.uc (UIInputDialog L1609, PlayUISound L2761)
//    XComGame\Classes\UIText.uc                   (InitText L25, SetWidth L104)
//---------------------------------------------------------------------------------------

class X2TC_CoopListener extends UIScreenListener dependson(UIInputDialogue);

// Long enough for an IP address or its one-number form, with room for a mistake.
const ADDRESS_MAX_CHARS = 40;
// 0.8.3 (Kc, after 0.8.2 Run 2: a mistyped address needed a restart): JOIN's label while
// a JOIN is connecting; a click cancels it (X2TC_CoopSession.CancelGuestConnect).
const CONNECTING_LABEL = "CO-OP: CONNECTING (CANCEL)";
// 0.8.4: true: the release layout (Co-op icon and panel, "BY IP" names, no MULTIPLAYER);
// false: the old test column.
const RELEASE_UI = true;

event OnInit(UIScreen Screen)
{
	local X2TC_CoopSession GuestSession;

	GuestSession = class'X2TC_CoopSession'.static.FindGuestSession();

	if (UIShell(Screen) != none && RELEASE_UI)
	{
		// 0.8.4: Steam first (the main path), then BY IP; the MULTIPLAYER button is gone.
		AddButton(Screen, 'X2TC_CoopJoinSteamButton', "CO-OP: JOIN (STEAM)" @ VersionTag(), OnJoinSteamClicked, 40);
		AddButton(Screen, 'X2TC_CoopJoinButton', JoinLabel(GuestSession != none && GuestSession.IsGuestConnecting()), OnJoinClicked, 90);
		`log("Coop: JOIN (STEAM) and JOIN BY IP buttons added to" @ string(Screen.Class.Name), , 'X2TC');
		class'X2TC_CoopSession'.static.LogNetDiagnostics("main menu");
	}
	else if (UIShell(Screen) != none)
	{
		AddButton(Screen, 'X2TC_CoopJoinButton', JoinLabel(GuestSession != none && GuestSession.IsGuestConnecting()), OnJoinClicked, 290);
		// Stage 7: join over Steam (accept the host's Steam invite after clicking this).
		AddButton(Screen, 'X2TC_CoopJoinSteamButton', "CO-OP: JOIN (STEAM)", OnJoinSteamClicked, 340);
		`log("Coop: JOIN button added to" @ string(Screen.Class.Name), , 'X2TC');
		class'X2TC_CoopSession'.static.LogNetDiagnostics("main menu"); // 0.8.1
	}
	else if (UIAvengerHUD(Screen) != none)
	{
		// 0.8.1: is the engine's multiplayer flag off again back on the Avenger?
		class'X2TC_CoopSession'.static.LogNetDiagnostics("Avenger");
	}
	else if (UITacticalHUD(Screen) != none && IsSinglePlayerTactical(Screen) && RELEASE_UI)
	{
		AddReleaseHUD(Screen, GuestSession);
	}
	else if (UITacticalHUD(Screen) != none && IsSinglePlayerTactical(Screen))
	{
		if (GuestSession != none)
		{
			// The guest's copy of the host's mission (Stage 3): no HOST button here.
			GuestSession.OnGuestMissionScreen("tactical HUD");
			// Stage 5: the guest's way out, from the start.
			AddButton(Screen, 'X2TC_CoopLeaveButton', "CO-OP: LEAVE" @ VersionTag(), OnLeaveClicked, 260);
			// Stage 5 Run 2: the game's own unit cycling is off with a tutorial-style
			// replay manager (XComTacticalController.uc L540-544).
			AddButton(Screen, 'X2TC_CoopNextButton', "CO-OP: NEXT SOLDIER", OnNextSoldierClicked, 310);
			// Run 6 fallback: hover the destination, then click this; the host builds the path.
			AddButton(Screen, 'X2TC_CoopMoveButton', "CO-OP: MOVE TO CURSOR (M)", OnMoveToCursorClicked, 360);
			// Stage 6 (0.5.0): the guest's END TURN only tells the host it is ready.
			AddButton(Screen, 'X2TC_CoopGuestEndTurn', "CO-OP: END TURN (READY)", OnGuestEndTurnClicked, 420);
			// Fixes A-D (Runs 8-9) keep their defaults (A and D on, B and C off) without
			// buttons: from 0.5.3 fix D, the fresh pathing pawn, is permanent (Kc).
			// The co-op squad screen (owners and settings; view only unless allowed).
			AddButton(Screen, 'X2TC_CoopSquadButton', "CO-OP: SQUAD", OnSquadClicked, 470);
			// 0.8.0: the fix switches and SAFE MODE (this machine only).
			AddButton(Screen, 'X2TC_CoopFixesButton', "CO-OP: FIXES", OnFixesClicked, 520);
			AddStatusText(Screen, 580);
			`log("Coop: LEAVE, NEXT SOLDIER, MOVE, END TURN, SQUAD and FIXES buttons added to the guest's tactical HUD", , 'X2TC');
			class'X2TC_CoopFixes'.static.LogState("guest's tactical HUD");
		}
		else
		{
			AddButton(Screen, 'X2TC_CoopHostButton', "CO-OP: HOST" @ VersionTag(), OnHostClicked, 260);
			// Stage 6 (0.5.0): ends XCOM's turn, asking first while the partner's soldiers
			// can act (Backspace does the same once hosting).
			AddButton(Screen, 'X2TC_CoopHostEndTurn', "CO-OP: END TURN", OnHostEndTurnClicked, 310);
			// The co-op squad screen: soldier owners and the co-op settings.
			AddButton(Screen, 'X2TC_CoopSquadButton', "CO-OP: SQUAD", OnSquadClicked, 360);
			// Stage 7: host over Steam (private Steam session, then the invite overlay).
			AddButton(Screen, 'X2TC_CoopHostSteamButton', "CO-OP: HOST (STEAM)", OnHostSteamClicked, 410);
			// 0.8.0: the fix switches and SAFE MODE (this machine only).
			AddButton(Screen, 'X2TC_CoopFixesButton', "CO-OP: FIXES", OnFixesClicked, 460);
			AddStatusText(Screen, 520);
			`log("Coop: HOST, END TURN and FIXES buttons added to the tactical HUD (tutorial mission=" $ IsTutorialMission() $ ")", , 'X2TC');
			class'X2TC_CoopSession'.static.LogNetDiagnostics("tactical HUD, before HOST"); // 0.8.1
		}
	}
	else if (UIReplay(Screen) != none)
	{
		// The game's replay screen, which its replay mode opens (Stage 3). With no guest
		// session here, the session object was lost in the map load (or this is not co-op).
		if (GuestSession != none)
		{
			GuestSession.OnGuestMissionScreen("replay screen");
			// Stage 4: with our follower in charge, close the stock replay screen, so the
			// ruleset's replay state doesn't press its play button and the Challenge
			// summary doesn't open at the end (X2TacticalGameRuleset.uc L4993-5001,
			// UIReplay.uc L374-382).
			if (GuestSession.HasFollower())
			{
				// Run 7 (0.4.0): closed 0.2 s later rather than inside its own OnInit, which
				// may have left it in the screen stack (the pathing pawn hides itself while
				// it is there; X2TC_CoopReplayMgr.KeepPathingVisible also checks).
				`log("Coop guest: closing the stock replay screen in 0.2 s (the follower drives the replay)", , 'X2TC');
				Screen.SetTimer(0.2, false, 'CloseScreen');
			}
		}
		else
		{
			`log("Coop: replay screen opened, no guest session found (session object exists=" $ (class'X2TC_CoopSession'.static.FindSession() != none) $ ")", , 'X2TC');
		}
	}
}

// 0.8.4: the release HUD (the Co-op icon and its panel, X2TC_CoopMenu).
function AddReleaseHUD(UIScreen Screen, X2TC_CoopSession GuestSession)
{
	local X2TC_CoopMenu Menu;
	local X2TC_CoopSession Session;
	local bool bHosting;

	Menu = Screen.Spawn(class'X2TC_CoopMenu', Screen);
	Menu.InitCoopMenu();
	AddStatusText(Screen, 60);
	if (GuestSession != none)
	{
		GuestSession.OnGuestMissionScreen("tactical HUD");
		// Kept outside the panel: pressed every turn.
		AddButton(Screen, 'X2TC_CoopGuestEndTurn', "CO-OP: END TURN (READY)", OnGuestEndTurnClicked, 94);
		Menu.AddItem('X2TC_CoopSquadButton', "CO-OP: SQUAD", OnSquadClicked, "Who controls which soldier (the host changes it)");
		Menu.AddItem('X2TC_CoopNextButton', "CO-OP: NEXT SOLDIER", OnNextSoldierClicked, "Select your next soldier that can act (Tab works too)");
		Menu.AddItem('X2TC_CoopFixesButton', "CO-OP: FIXES", OnFixesClicked, "Co-op fixes on this PC; turn one off only if it misbehaves");
		Menu.AddItem('X2TC_CoopLeaveButton', "CO-OP: LEAVE" @ VersionTag(), OnLeaveClicked, "Leave the mission; the host plays on alone");
		`log("Coop: Co-op menu (SQUAD, NEXT SOLDIER, FIXES, LEAVE) and END TURN (READY) added to the guest's tactical HUD", , 'X2TC');
		class'X2TC_CoopFixes'.static.LogState("guest's tactical HUD");
		return;
	}
	Session = class'X2TC_CoopSession'.static.FindSession();
	bHosting = Session != none && Session.IsHost() && Session.IsPollRunning();
	Menu.AddItem('X2TC_CoopHostSteamButton', "CO-OP: HOST (STEAM)" @ VersionTag(), OnHostSteamClicked, "Host this mission and invite a Steam friend");
	Menu.AddItem('X2TC_CoopHostButton', "CO-OP: HOST BY IP" @ VersionTag(), OnHostClicked, "Host on your network; the partner joins with your IP address");
	Menu.AddItem('X2TC_CoopSquadButton', "CO-OP: SQUAD", OnSquadClicked, "Give soldiers to the partner or take them back");
	Menu.AddItem('X2TC_CoopHostEndTurn', "CO-OP: END TURN", OnHostEndTurnClicked, "End XCOM's turn (asks first while the partner's soldiers can act)");
	Menu.AddItem('X2TC_CoopFixesButton', "CO-OP: FIXES", OnFixesClicked, "Co-op fixes on this PC; turn one off only if it misbehaves");
	Menu.SetItemVisible('X2TC_CoopSquadButton', bHosting);
	Menu.SetItemVisible('X2TC_CoopHostEndTurn', bHosting);
	`log("Coop: Co-op menu (HOST (STEAM), HOST BY IP, FIXES) added to the tactical HUD (tutorial mission=" $ IsTutorialMission() $ ", hosting=" $ bHosting $ ")", , 'X2TC');
	class'X2TC_CoopSession'.static.LogNetDiagnostics("tactical HUD, before HOST");
}

// 0.8.4: after HOST BY IP or HOST (STEAM) starts hosting: show SQUAD and END TURN, hide
// the other way to host.
function ShowHostingItems(UIButton Button, name OtherHostButton)
{
	local X2TC_CoopMenu Menu;

	if (Button == none || Button.ParentPanel == none)
	{
		return;
	}
	Menu = X2TC_CoopMenu(Button.ParentPanel.ParentPanel);
	if (Menu == none)
	{
		return;
	}
	Menu.SetItemVisible(OtherHostButton, false);
	Menu.SetItemVisible('X2TC_CoopSquadButton', true);
	Menu.SetItemVisible('X2TC_CoopHostEndTurn', true);
}

// "(v0.3.8)": the mod's version on the CO-OP buttons, so each machine's build can be
// checked on screen (Kc, 2026-11-14).
static function string VersionTag()
{
	return "(v" $ class'X2TC_CoopSession'.static.ModVersion() $ ")";
}

// 0.8.3: the main-menu JOIN button's label.
static function string JoinLabel(bool bConnecting)
{
	return bConnecting ? CONNECTING_LABEL : (RELEASE_UI ? "CO-OP: JOIN BY IP" : "CO-OP: JOIN") @ VersionTag();
}

// 0.8.3: relabel the main menu's JOIN button, if the main menu is open.
static function SetJoinLabel(bool bConnecting)
{
	local XComPlayerController PC;
	local UIScreen ShellScreen;
	local UIButton JoinButton;

	PC = XComPlayerController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (PC == none || PC.Pres == none || PC.Pres.ScreenStack == none)
	{
		return;
	}
	ShellScreen = PC.Pres.ScreenStack.GetFirstInstanceOf(class'UIShell');
	if (ShellScreen == none)
	{
		return;
	}
	JoinButton = UIButton(ShellScreen.GetChildByName('X2TC_CoopJoinButton', false));
	if (JoinButton != none)
	{
		JoinButton.SetText(JoinLabel(bConnecting));
	}
}

// A single-player tactical game (XComTacticalGame but not the multiplayer subclass).
function bool IsSinglePlayerTactical(UIScreen Screen)
{
	local GameInfo Game;

	Game = Screen.WorldInfo.Game;
	return Game != none && Game.IsA('XComTacticalGame') && !Game.IsA('XComMPTacticalGame');
}

function AddButton(UIScreen Screen, name ButtonName, string Label, delegate<UIButton.OnClickedDelegate> Handler, float Y)
{
	local UIButton NewButton;

	NewButton = Screen.Spawn(class'UIButton', Screen);
	NewButton.InitButton(ButtonName, Label, Handler);
	NewButton.AnchorTopRight();
	NewButton.SetPosition(-340, Y);
	// Mouse only: keep it out of keyboard and controller navigation.
	NewButton.DisableNavigation();
}

// Stage 6: the co-op status line (X2TC_CoopTurnUI.SetStatusText), hidden until used.
function AddStatusText(UIScreen Screen, float Y)
{
	local UIText StatusText;

	StatusText = Screen.Spawn(class'UIText', Screen);
	StatusText.InitText(class'X2TC_CoopTurnUI'.const.STATUS_TEXT_NAME, "");
	StatusText.AnchorTopRight();
	StatusText.SetPosition(-340, Y);
	StatusText.SetWidth(320);
	StatusText.Hide();
}

// Stage 7, host: the first click starts hosting over Steam; later clicks reopen the Steam
// invite overlay.
function OnHostSteamClicked(UIButton Button)
{
	local X2TC_CoopSession Session;

	PlayClickSound(Button);
	class'X2TC_CoopMenu'.static.CloseFor(Button); // 0.8.4
	if (RefuseInTutorial("HOST (STEAM)"))
	{
		return;
	}
	Session = class'X2TC_CoopSession'.static.GetSession();
	if (Session.IsHost() && Session.bSteamSession && Session.IsPollRunning())
	{
		`log("Coop: HOST (STEAM) clicked again; reopening the invite overlay", , 'X2TC');
		Session.ShowSteamInvite();
		return;
	}
	`log("Coop: HOST (STEAM) clicked", , 'X2TC');
	if (Session.StartHostSteam())
	{
		Button.SetText("CO-OP: INVITE (STEAM)" @ VersionTag());
		ShowHostingItems(Button, 'X2TC_CoopHostButton'); // 0.8.4
	}
}

// Stage 7, guest: wait for the host's Steam invite.
function OnJoinSteamClicked(UIButton Button)
{
	`log("Coop: JOIN (STEAM) clicked", , 'X2TC');
	PlayClickSound(Button);
	if (class'X2TC_CoopSession'.static.IsSessionActive())
	{
		`log("Coop: JOIN (STEAM) ignored: a co-op session is already running", , 'X2TC');
		return;
	}
	class'X2TC_CoopSession'.static.GetSession().ArmSteamInvite();
}

// The co-op squad screen, on either machine.
function OnSquadClicked(UIButton Button)
{
	PlayClickSound(Button);
	class'X2TC_CoopMenu'.static.CloseFor(Button); // 0.8.4
	class'X2TC_CoopSquadScreen'.static.Open();
}

// Stage 6: the guest is ready to end XCOM's turn.
function OnGuestEndTurnClicked(UIButton Button)
{
	local X2TC_CoopSession GuestSession;

	PlayClickSound(Button);
	GuestSession = class'X2TC_CoopSession'.static.FindGuestSession();
	if (GuestSession == none)
	{
		`log("Coop: guest END TURN clicked, but no guest session", , 'X2TC');
		return;
	}
	GuestSession.GuestEndTurnPressed();
}

// Stage 6: the host's END TURN (the co-op check, then the game's own end turn).
function OnHostEndTurnClicked(UIButton Button)
{
	local X2TC_CoopSession Session;

	PlayClickSound(Button);
	class'X2TC_CoopMenu'.static.CloseFor(Button); // 0.8.4
	Session = class'X2TC_CoopSession'.static.FindSession();
	if (Session == none || Session.RoleName() != "host")
	{
		`log("Coop: host END TURN clicked before HOST; use the game's own End Turn", , 'X2TC');
		return;
	}
	Session.HostEndTurnRequested("button");
}

function PlayClickSound(UIButton Button)
{
	if (Button.Movie != none && Button.Movie.Pres != none)
	{
		Button.Movie.Pres.PlayUISound(eSUISound_MenuSelect);
	}
}

// 0.8.0: the fixes screen, on either machine.
function OnFixesClicked(UIButton Button)
{
	PlayClickSound(Button);
	class'X2TC_CoopMenu'.static.CloseFor(Button); // 0.8.4
	class'X2TC_CoopFixesScreen'.static.Open();
}

// 0.8.0 (Kc): the campaign's tutorial mission runs its own scripted replay manager
// (XComTutorialMgr, spawned when the tutorial is on: XComGameReplicationInfo.uc L159-166);
// co-op isn't offered there.
function bool IsTutorialMission()
{
	return XComTutorialMgr(`REPLAY) != none;
}

// True (and a short message) if this is the tutorial mission.
function bool RefuseInTutorial(string What)
{
	if (!IsTutorialMission())
	{
		return false;
	}
	`log("Coop:" @ What @ "refused: this is the tutorial mission", , 'X2TC');
	class'X2TC_CoopTurnUI'.static.SetStatusText("Co-op isn't available in the tutorial mission");
	return true;
}

function OnHostClicked(UIButton Button)
{
	`log("Coop: HOST clicked", , 'X2TC');
	PlayClickSound(Button);
	class'X2TC_CoopMenu'.static.CloseFor(Button); // 0.8.4
	if (RefuseInTutorial("HOST"))
	{
		return;
	}
	if (class'X2TC_CoopSession'.static.GetSession().StartHost())
	{
		Button.SetText("CO-OP: HOSTING" @ VersionTag());
		Button.DisableButton();
		ShowHostingItems(Button, 'X2TC_CoopHostSteamButton'); // 0.8.4
	}
}

// Stage 5 Run 2: select the guest's next XCOM soldier.
function OnNextSoldierClicked(UIButton Button)
{
	local X2TC_CoopReplayMgr Follower;
	local XComTacticalGRI TacticalGRI;

	PlayClickSound(Button);
	class'X2TC_CoopMenu'.static.CloseFor(Button); // 0.8.4
	TacticalGRI = XComTacticalGRI(Button.WorldInfo.GRI);
	if (TacticalGRI != none)
	{
		Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
	}
	if (Follower == none)
	{
		`log("Coop: NEXT SOLDIER clicked, but no follower", , 'X2TC');
		return;
	}
	Follower.SelectNextGuestUnit();
}

// Run 6: move the guest's selected soldier to the tile under the 3D cursor.
function OnMoveToCursorClicked(UIButton Button)
{
	local X2TC_CoopReplayMgr Follower;
	local XComTacticalGRI TacticalGRI;

	PlayClickSound(Button);
	TacticalGRI = XComTacticalGRI(Button.WorldInfo.GRI);
	if (TacticalGRI != none)
	{
		Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
	}
	if (Follower == none)
	{
		`log("Coop: MOVE TO CURSOR clicked, but no follower", , 'X2TC');
		return;
	}
	Follower.MoveActiveUnitToCursor();
}

// Stage 5: the guest leaves the co-op mission and goes back to the main menu.
function OnLeaveClicked(UIButton Button)
{
	local X2TC_CoopSession GuestSession;

	PlayClickSound(Button);
	class'X2TC_CoopMenu'.static.CloseFor(Button); // 0.8.4
	Button.DisableButton();
	GuestSession = class'X2TC_CoopSession'.static.FindGuestSession();
	if (GuestSession == none)
	{
		`log("Coop: LEAVE clicked, but no guest session; opening the main menu anyway", , 'X2TC');
		Button.ConsoleCommand(class'X2TC_CoopSession'.const.LEAVE_MAP_COMMAND);
		return;
	}
	GuestSession.LeaveAsGuest();
}

function OnJoinClicked(UIButton Button)
{
	local UIShell ShellScreen;
	local TInputDialogData DialogData;
	local X2TC_CoopSession GuestSession;

	`log("Coop: JOIN clicked", , 'X2TC');

	// 0.8.3: while a JOIN is connecting, the button reads CONNECTING (CANCEL).
	GuestSession = class'X2TC_CoopSession'.static.FindGuestSession();
	if (GuestSession != none && GuestSession.IsGuestConnecting())
	{
		PlayClickSound(Button);
		GuestSession.CancelGuestConnect("CANCEL clicked");
		return;
	}

	ShellScreen = UIShell(Button.Screen);
	if (ShellScreen != none && ShellScreen.m_bDisableActions)
	{
		`log("Coop: JOIN ignored: main menu actions are disabled", , 'X2TC');
		return;
	}

	if (class'X2TC_CoopSession'.static.IsSessionActive())
	{
		`log("Coop: JOIN ignored: a co-op session is already running", , 'X2TC');
		return;
	}

	if (Button.Movie == none || Button.Movie.Pres == none)
	{
		`log("Coop: JOIN clicked, but the button has no presentation layer", , 'X2TC');
		return;
	}

	PlayClickSound(Button);
	DialogData.strTitle = "CO-OP: HOST ADDRESS";
	DialogData.strInputBoxText = "";
	DialogData.iMaxChars = ADDRESS_MAX_CHARS;
	DialogData.fnCallbackAccepted = OnAddressAccepted;
	DialogData.fnCallbackCancelled = OnAddressCancelled;
	Button.Movie.Pres.UIInputDialog(DialogData);
}

function OnAddressAccepted(string Text)
{
	local string Address;

	// Spaces typed by mistake would break the address.
	Address = Repl(Text, " ", "");
	`log("Coop: address entered (form:" @ class'X2TC_CoopSession'.static.AddressForm(Address) $ ")", , 'X2TC');
	if (class'X2TC_CoopSession'.static.GetSession().StartGuest(Address))
	{
		SetJoinLabel(true); // 0.8.3
	}
}

function OnAddressCancelled(string Text)
{
	`log("Coop: address box cancelled", , 'X2TC');
}

defaultproperties
{
	ScreenClass = none
}
