//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopMenuBar
//
//  What it changes: 0.8.4b (Kc, 2026-11-23: "move the co-op button to be an additional
//  button to the left of multiplayer on the main bar"). Adds a CO-OP button to the retail
//  main menu's bottom row, just left of MULTIPLAYER, styled like the row's own buttons.
//  Clicking it opens a two-choice box: JOIN (STEAM) (then accept the host's invite) or
//  JOIN BY IP (the address box). While a JOIN BY IP connects, the button reads
//  CO-OP: CANCEL and a click cancels it (0.8.3's CONNECTING (CANCEL)).
//    - The row is rebuilt by the shell itself (UIFinalShell.UpdateMenu L127-149 clears it
//      with UIShell.ClearMenu L248-256, at start and on login changes), so this hidden
//      panel checks twice a second and puts the button back when it's missing. It joins
//      the row the same way the shell's CreateItem does (UIShell.uc L275-289): a
//      UIX2MenuButton in MainMenuContainer, the shell's OnButtonSizeRealized for the
//      layout (L312-338), and the shell's mouse handler (UIFinalShell.uc L205).
//    - Not a class override; the stock buttons are untouched. Only on UIFinalShell (the
//      retail menu); elsewhere X2TC_CoopListener keeps its top-right buttons.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIShell.uc                   (MainMenuContainer L35, MainMenu L36,
//                                                   m_bDisableActions)
//    XComGame\Classes\UIFinalShell.uc              (UpdateMenu L127, 'MP' item L135,
//                                                   OnChildMouseEvent L205)
//    XComGame\Classes\UIX2MenuButton.uc            (InitMenuButton L20)
//    XComGame\Classes\UIButton.uc                  (OnSizeRealized L45, SetText)
//    XComGame\Classes\UIDialogueBox.uc             (TDialogueBoxData L24-41, actions L69)
//    XComGame\Classes\XComPresentationLayerBase.uc (UIRaiseDialog L1443, UIInputDialog L1609)
//    XComGame\Classes\UIInputDialogue.uc           (TInputDialogData L26)
//---------------------------------------------------------------------------------------

class X2TC_CoopMenuBar extends UIPanel dependson(UIDialogueBox, UIInputDialogue);

const HELPER_NAME = 'X2TC_CoopMenuBarHelper';
const BAR_BUTTON_NAME = 'X2TC_CoopBar';

var int TimesAdded;

// Adds the helper to a retail main menu. False if this isn't one (the caller keeps the
// top-right buttons then).
// (0.8.4b build fix: not named Attach, which Actor.uc L1960 already declares.)
static function bool AddToMainMenu(UIScreen Shell)
{
	local X2TC_CoopMenuBar Helper;

	if (UIFinalShell(Shell) == none)
	{
		return false;
	}
	Helper = Shell.Spawn(class'X2TC_CoopMenuBar', Shell);
	Helper.InitPanel(HELPER_NAME);
	Helper.Hide();
	Helper.EnsureButton();
	Helper.SetTimer(0.5, true, nameof(EnsureButton));
	return true;
}

// The row's CO-OP button on the open main menu, or none.
static function UIButton FindBarButton()
{
	local XComPlayerController LocalPC;
	local UIShell Shell;
	local int i;

	LocalPC = XComPlayerController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (LocalPC == none || LocalPC.Pres == none || LocalPC.Pres.ScreenStack == none)
	{
		return none;
	}
	Shell = UIShell(LocalPC.Pres.ScreenStack.GetFirstInstanceOf(class'UIShell'));
	if (Shell == none)
	{
		return none;
	}
	for (i = 0; i < Shell.MainMenu.Length; i++)
	{
		if (Shell.MainMenu[i] != none && Shell.MainMenu[i].MCName == BAR_BUTTON_NAME)
		{
			return Shell.MainMenu[i];
		}
	}
	return none;
}

static function string BarLabel(bool bConnecting)
{
	return bConnecting ? "CO-OP: CANCEL" : "CO-OP" @ class'X2TC_CoopListener'.static.VersionTag();
}

// Puts the button back left of MULTIPLAYER when the shell has rebuilt its row.
function EnsureButton()
{
	local UIFinalShell Shell;
	local UIX2MenuButton Button;
	local X2TC_CoopSession GuestSession;
	local int i, Index;

	Shell = UIFinalShell(Screen);
	if (Shell == none || Shell.MainMenuContainer == none || Shell.MainMenu.Length == 0)
	{
		return;
	}
	Index = -1;
	for (i = 0; i < Shell.MainMenu.Length; i++)
	{
		if (Shell.MainMenu[i] == none)
		{
			continue;
		}
		if (Shell.MainMenu[i].MCName == BAR_BUTTON_NAME)
		{
			return;
		}
		if (Shell.MainMenu[i].MCName == 'MP')
		{
			Index = i;
		}
	}
	if (Index < 0)
	{
		Index = Min(2, Shell.MainMenu.Length); // no MULTIPLAYER item: after LOAD GAME
	}
	GuestSession = class'X2TC_CoopSession'.static.FindGuestSession();
	Button = Spawn(class'UIX2MenuButton', Shell.MainMenuContainer);
	Button.InitMenuButton(false, BAR_BUTTON_NAME, BarLabel(GuestSession != none && GuestSession.IsGuestConnecting()), OnBarClicked);
	Button.OnSizeRealized = Shell.OnButtonSizeRealized;
	Shell.MainMenu.InsertItem(Index, Button);
	Button.ProcessMouseEvents(Shell.OnChildMouseEvent);
	TimesAdded++;
	`log("Coop: CO-OP added to the main menu row at" @ Index @ "of" @ Shell.MainMenu.Length @ "(times added:" @ TimesAdded $ ")", , 'X2TC');
}

function OnBarClicked(UIButton Button)
{
	local X2TC_CoopSession GuestSession;
	local TDialogueBoxData DialogData;

	`log("Coop: main menu CO-OP clicked", , 'X2TC');
	GuestSession = class'X2TC_CoopSession'.static.FindGuestSession();
	if (GuestSession != none && GuestSession.IsGuestConnecting())
	{
		PlayClick();
		GuestSession.CancelGuestConnect("CANCEL clicked");
		return;
	}
	if (UIShell(Screen) != none && UIShell(Screen).m_bDisableActions)
	{
		`log("Coop: CO-OP ignored: main menu actions are disabled", , 'X2TC');
		return;
	}
	if (class'X2TC_CoopSession'.static.IsSessionActive())
	{
		`log("Coop: CO-OP ignored: a co-op session is already running", , 'X2TC');
		return;
	}
	if (Movie == none || Movie.Pres == none)
	{
		return;
	}
	PlayClick();
	DialogData.eType = eDialog_Normal;
	DialogData.strTitle = "CO-OP" @ class'X2TC_CoopListener'.static.VersionTag();
	DialogData.strText = "Join a friend's co-op mission. JOIN (STEAM): then accept the host's Steam invite. JOIN BY IP: on the same network, type the host's address.";
	DialogData.strAccept = "JOIN (STEAM)";
	DialogData.strCancel = "JOIN BY IP";
	DialogData.fnCallback = OnChoice;
	Movie.Pres.UIRaiseDialog(DialogData);
}

function OnChoice(Name eAction)
{
	local TInputDialogData InputData;

	if (eAction == 'eUIAction_Accept')
	{
		`log("Coop: CO-OP: JOIN (STEAM) chosen", , 'X2TC');
		if (class'X2TC_CoopSession'.static.IsSessionActive())
		{
			return;
		}
		class'X2TC_CoopSession'.static.GetSession().ArmSteamInvite();
	}
	else if (eAction == 'eUIAction_Cancel')
	{
		`log("Coop: CO-OP: JOIN BY IP chosen", , 'X2TC');
		if (Movie == none || Movie.Pres == none)
		{
			return;
		}
		InputData.strTitle = "CO-OP: HOST ADDRESS";
		InputData.strInputBoxText = "";
		InputData.iMaxChars = class'X2TC_CoopListener'.const.ADDRESS_MAX_CHARS;
		InputData.fnCallbackAccepted = OnAddressAccepted;
		InputData.fnCallbackCancelled = OnAddressCancelled;
		Movie.Pres.UIInputDialog(InputData);
	}
}

function OnAddressAccepted(string Text)
{
	local string Address;

	Address = Repl(Text, " ", "");
	`log("Coop: address entered (form:" @ class'X2TC_CoopSession'.static.AddressForm(Address) $ ")", , 'X2TC');
	if (class'X2TC_CoopSession'.static.GetSession().StartGuest(Address))
	{
		class'X2TC_CoopListener'.static.SetJoinLabel(true);
	}
}

function OnAddressCancelled(string Text)
{
	`log("Coop: address box cancelled", , 'X2TC');
}

function PlayClick()
{
	if (Movie != none && Movie.Pres != none)
	{
		Movie.Pres.PlayUISound(eSUISound_MenuSelect);
	}
}
