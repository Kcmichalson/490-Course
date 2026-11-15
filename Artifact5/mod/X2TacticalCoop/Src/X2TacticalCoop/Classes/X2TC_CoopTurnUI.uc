//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopTurnUI
//
//  What it changes: three pieces of the co-op tactical screen (plans/m3-plan.md, Stage 6),
//  as static helpers the session and the follower call:
//    - the "FRIENDLY ACTION" banner: the game's own turn banner (UITurnOverlay), its blue
//      XCOM-turn style with our text, shown while the other player's soldier acts; the
//      stock texts are put back when it is hidden;
//    - a small status line at the top right ("Partner is ready to end the turn",
//      "Waiting for the host to end the turn"): a UIText the listener adds to the HUD;
//    - the host's End Turn icon on the HUD, set disabled while the host should be asked
//      first (its click then only plays the game's "no" sound) and normal otherwise;
//    - the guest's END TURN label ("(READY)" unless the partner may end the turn).
//  Holds no references; everything is looked up when needed.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UITurnOverlay.uc        (m_sXComTurn and the other texts L32-39,
//                                              SetDisplayText L159-189,
//                                              ShowXComTurn/HideXComTurn L283-313)
//    XComGame\Classes\XComPresentationLayer.uc (m_kTurnOverlay L40)
//    XComGame\Classes\UITacticalHUD.uc        (m_kMouseControls L72)
//    XComGame\Classes\UITacticalHUD_MouseControls.uc (ButtonItems L45, m_optEndTurn L32,
//                                              SetButtonState L167, OnAccept L205-216)
//    XComGame\Classes\UIPanel.uc              (GetChild L850)
//    XComGame\Classes\UIText.uc               (SetText)
//---------------------------------------------------------------------------------------

class X2TC_CoopTurnUI extends Object dependson(UI_Definitions);

const FRIENDLY_TEXT = "FRIENDLY ACTION";
const STATUS_TEXT_NAME = 'X2TC_CoopStatus';
const GUEST_END_TURN_NAME = 'X2TC_CoopGuestEndTurn'; // the listener's button name

static function XComPresentationLayer GetPres()
{
	local XComPlayerController PC;

	PC = XComPlayerController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (PC == none)
	{
		return none;
	}
	return XComPresentationLayer(PC.Pres);
}

static function UITacticalHUD GetHUD()
{
	local XComPresentationLayer Pres;

	Pres = GetPres();
	if (Pres == none || Pres.ScreenStack == none)
	{
		return none;
	}
	return UITacticalHUD(Pres.ScreenStack.GetScreen(class'UITacticalHUD'));
}

static function UITurnOverlay GetOverlay()
{
	local XComPresentationLayer Pres;

	Pres = GetPres();
	if (Pres == none)
	{
		return none;
	}
	return Pres.m_kTurnOverlay;
}

// The banner, in the blue XCOM-turn style with FRIENDLY_TEXT.
static function ShowFriendlyBanner()
{
	local UITurnOverlay Overlay;

	Overlay = GetOverlay();
	if (Overlay == none)
	{
		`log("Coop UI: no turn overlay for the FRIENDLY ACTION banner", , 'X2TC');
		return;
	}
	Overlay.SetDisplayText(Overlay.m_sAlienTurn, FRIENDLY_TEXT, Overlay.m_sOtherTurn, Overlay.m_sTheLostTurn, Overlay.m_sReflexAction, Overlay.m_sSpecialTurn, Overlay.m_sChosenTurn);
	Overlay.ShowXComTurn();
	`log("Coop UI: FRIENDLY ACTION banner shown", , 'X2TC');
}

// Hides the banner and restores the overlay's own texts.
static function HideFriendlyBanner()
{
	local UITurnOverlay Overlay;

	Overlay = GetOverlay();
	if (Overlay == none)
	{
		return;
	}
	Overlay.HideXComTurn();
	Overlay.SetDisplayText(Overlay.m_sAlienTurn, Overlay.m_sXComTurn, Overlay.m_sOtherTurn, Overlay.m_sTheLostTurn, Overlay.m_sReflexAction, Overlay.m_sSpecialTurn, Overlay.m_sChosenTurn);
	`log("Coop UI: FRIENDLY ACTION banner hidden", , 'X2TC');
}

// The status line at the top right ("" hides it).
static function SetStatusText(string Text)
{
	local UITacticalHUD HUD;
	local UIText StatusText;

	HUD = GetHUD();
	if (HUD == none)
	{
		return;
	}
	StatusText = UIText(HUD.GetChild(STATUS_TEXT_NAME, false));
	if (StatusText == none)
	{
		return;
	}
	if (Text == "")
	{
		StatusText.Hide();
	}
	else
	{
		StatusText.SetText(Text);
		StatusText.Show();
	}
	`log("Coop UI: status text:" @ (Text == "" ? "(hidden)" : Text), , 'X2TC');
}

// Guest: its END TURN button's label for the "Partner may end the turn" setting.
static function SetGuestEndTurnLabel(bool bMayEndTurn)
{
	local UITacticalHUD HUD;
	local UIButton Button;

	HUD = GetHUD();
	if (HUD == none)
	{
		return;
	}
	Button = UIButton(HUD.GetChild(GUEST_END_TURN_NAME, false));
	if (Button == none)
	{
		return;
	}
	if (bMayEndTurn)
	{
		Button.SetText("CO-OP: END TURN");
	}
	else
	{
		Button.SetText("CO-OP: END TURN (READY)");
	}
}

// Host: the HUD's End Turn icon normal (true) or disabled (false). Only changes it when
// its state differs; returns true if it changed.
static function bool SetEndTurnIconEnabled(bool bEnabled)
{
	local UITacticalHUD HUD;
	local UITacticalHUD_MouseControls Controls;
	local EUIState Wanted;

	HUD = GetHUD();
	if (HUD == none || HUD.m_kMouseControls == none)
	{
		return false;
	}
	Controls = HUD.m_kMouseControls;
	if (Controls.m_optEndTurn < 0 || Controls.m_optEndTurn >= Controls.ButtonItems.Length)
	{
		return false;
	}
	Wanted = eUIState_Disabled;
	if (bEnabled)
	{
		Wanted = eUIState_Normal;
	}
	if (Controls.ButtonItems[Controls.m_optEndTurn].UIState == Wanted)
	{
		return false;
	}
	Controls.SetButtonState(Controls.m_optEndTurn, Wanted);
	`log("Coop UI: host End Turn icon" @ (bEnabled ? "enabled" : "disabled (the partner's soldiers can still act)"), , 'X2TC');
	return true;
}
