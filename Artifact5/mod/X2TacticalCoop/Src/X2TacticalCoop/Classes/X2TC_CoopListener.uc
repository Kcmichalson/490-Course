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
//  opens X2TC_CoopSquadScreen.
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

event OnInit(UIScreen Screen)
{
	local X2TC_CoopSession GuestSession;

	GuestSession = class'X2TC_CoopSession'.static.FindGuestSession();

	if (UIShell(Screen) != none)
	{
		AddButton(Screen, 'X2TC_CoopJoinButton', "CO-OP: JOIN" @ VersionTag(), OnJoinClicked, 290);
		`log("Coop: JOIN button added to" @ string(Screen.Class.Name), , 'X2TC');
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
			// Run 9 (0.4.3): fix D, a freshly spawned pathing pawn, settled normal moves; its
			// switch stays for comparison. Fixes A-C (Run 8) keep their defaults (A on, B
			// and C off) without buttons from 0.5.0.
			AddButton(Screen, 'X2TC_CoopFixD', "FIX D FRESH PAWN: ON", OnFixClicked, 470);
			// The co-op squad screen (owners and settings; view only unless allowed).
			AddButton(Screen, 'X2TC_CoopSquadButton', "CO-OP: SQUAD", OnSquadClicked, 520);
			AddStatusText(Screen, 580);
			`log("Coop: LEAVE, NEXT SOLDIER, MOVE, END TURN and FIX D buttons added to the guest's tactical HUD", , 'X2TC');
		}
		else
		{
			AddButton(Screen, 'X2TC_CoopHostButton', "CO-OP: HOST" @ VersionTag(), OnHostClicked, 260);
			// Stage 6 (0.5.0): ends XCOM's turn, asking first while the partner's soldiers
			// can act (Backspace does the same once hosting).
			AddButton(Screen, 'X2TC_CoopHostEndTurn', "CO-OP: END TURN", OnHostEndTurnClicked, 310);
			// The co-op squad screen: soldier owners and the co-op settings.
			AddButton(Screen, 'X2TC_CoopSquadButton', "CO-OP: SQUAD", OnSquadClicked, 360);
			AddStatusText(Screen, 420);
			`log("Coop: HOST and END TURN buttons added to the tactical HUD", , 'X2TC');
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

// "(v0.3.8)": the mod's version on the CO-OP buttons, so each machine's build can be
// checked on screen (Kc, 2026-11-14).
static function string VersionTag()
{
	return "(v" $ class'X2TC_CoopSession'.static.ModVersion() $ ")";
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

// The co-op squad screen, on either machine.
function OnSquadClicked(UIButton Button)
{
	PlayClickSound(Button);
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

function OnHostClicked(UIButton Button)
{
	`log("Coop: HOST clicked", , 'X2TC');
	PlayClickSound(Button);
	if (class'X2TC_CoopSession'.static.GetSession().StartHost())
	{
		Button.SetText("CO-OP: HOSTING" @ VersionTag());
		Button.DisableButton();
	}
}

// Stage 5 Run 2: select the guest's next XCOM soldier.
function OnNextSoldierClicked(UIButton Button)
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
		`log("Coop: NEXT SOLDIER clicked, but no follower", , 'X2TC');
		return;
	}
	Follower.SelectNextGuestUnit();
}

// Run 8: switch one of the follower's fixes; the button's name says which.
function OnFixClicked(UIButton Button)
{
	local X2TC_CoopReplayMgr Follower;
	local XComTacticalGRI TacticalGRI;
	local bool bNow;

	PlayClickSound(Button);
	TacticalGRI = XComTacticalGRI(Button.WorldInfo.GRI);
	if (TacticalGRI != none)
	{
		Follower = X2TC_CoopReplayMgr(TacticalGRI.ReplayMgr);
	}
	if (Follower == none)
	{
		`log("Coop: FIX clicked, but no follower", , 'X2TC');
		return;
	}
	switch (Button.MCName)
	{
		case 'X2TC_CoopFixA':
			bNow = Follower.ToggleFix('A');
			Button.SetText("FIX A CACHE:" @ (bNow ? "ON" : "OFF"));
			break;
		case 'X2TC_CoopFixB':
			bNow = Follower.ToggleFix('B');
			Button.SetText("FIX B HISTORY:" @ (bNow ? "ON" : "OFF"));
			break;
		case 'X2TC_CoopFixC':
			bNow = Follower.ToggleFix('C');
			Button.SetText("FIX C WORLD:" @ (bNow ? "ON" : "OFF"));
			break;
		case 'X2TC_CoopFixD':
			bNow = Follower.ToggleFix('D');
			Button.SetText("FIX D FRESH PAWN:" @ (bNow ? "ON" : "OFF"));
			break;
	}
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

	`log("Coop: JOIN clicked", , 'X2TC');

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
	class'X2TC_CoopSession'.static.GetSession().StartGuest(Address);
}

function OnAddressCancelled(string Text)
{
	`log("Coop: address box cancelled", , 'X2TC');
}

defaultproperties
{
	ScreenClass = none
}
