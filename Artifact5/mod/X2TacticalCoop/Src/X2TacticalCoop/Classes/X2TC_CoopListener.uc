//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopListener
//
//  What it changes: adds the two co-op test buttons (plans/m3-plan.md, Stage 2).
//    - CO-OP: HOST on the tactical HUD of a single-player mission (not in multiplayer
//      matches): starts the host side of X2TC_CoopSession.
//    - CO-OP: JOIN on the main menu: opens the game's text box for the host's address
//      (an IP address or its one-number form), then starts the guest side.
//  Each writes X2TC lines to Launch.log; the address itself is never logged.
//
//  Both are mouse-only buttons at the top right, like the MULTIPLAYER button
//  (X2TC_MainMenuListener). JOIN sits below the MP TEST buttons' column so the test build
//  doesn't overlap it.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreenListener.uc         (ScreenClass, OnInit)
//    XComGame\Classes\UIShell.uc                  (main menu; m_bDisableActions)
//    XComGame\Classes\UITacticalHUD.uc            (the tactical screen)
//    XComGame\Classes\XComMPTacticalGame.uc       (extends XComTacticalGame, L5)
//    XComGame\Classes\UIButton.uc                 (InitButton, SetText L72, DisableButton)
//    XComGame\Classes\UIPanel.uc                  (AnchorTopRight, SetPosition, DisableNavigation)
//    XComGame\Classes\UIInputDialogue.uc          (TInputDialogData L26, callbacks L59-61)
//    XComGame\Classes\XComPresentationLayerBase.uc (UIInputDialog L1609, PlayUISound L2761)
//---------------------------------------------------------------------------------------

class X2TC_CoopListener extends UIScreenListener dependson(UIInputDialogue);

// Long enough for an IP address or its one-number form, with room for a mistake.
const ADDRESS_MAX_CHARS = 40;

event OnInit(UIScreen Screen)
{
	if (UIShell(Screen) != none)
	{
		AddButton(Screen, 'X2TC_CoopJoinButton', "CO-OP: JOIN", OnJoinClicked, 290);
		`log("Coop: JOIN button added to" @ string(Screen.Class.Name), , 'X2TC');
	}
	else if (UITacticalHUD(Screen) != none && IsSinglePlayerTactical(Screen))
	{
		AddButton(Screen, 'X2TC_CoopHostButton', "CO-OP: HOST", OnHostClicked, 260);
		`log("Coop: HOST button added to the tactical HUD", , 'X2TC');
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
		Button.SetText("CO-OP: HOSTING");
		Button.DisableButton();
	}
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
