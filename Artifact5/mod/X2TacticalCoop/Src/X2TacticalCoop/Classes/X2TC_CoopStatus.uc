//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopStatus
//
//  What it changes (0.9.2, Kc's request): a one-line connection status in the top right
//  of both players' screens (joining, connecting, receiving, joined, disconnected), so
//  nobody waits without knowing what's happening. 0.9.3: the anchored message manager
//  showed nothing on the main menu (0.9.2 run), so this is now the mod's own text on
//  whatever screen is on top; a new status moves it to the current screen. Finished
//  states remove themselves after a few seconds.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreenStack.uc  (GetCurrentScreen)
//    XComGame\Classes\UIText.uc         (InitText, SetText)
//    XComGame\Classes\UIPanel.uc        (AnchorTopRight, SetPosition, Remove)
//---------------------------------------------------------------------------------------

class X2TC_CoopStatus extends Object;

const FADE_SECONDS = 6.0; // a finished state
const TEXT_WIDTH = 900;
const FONT_SIZE = 40;    // 0.9.4: Kc: white and 3-4 times larger

// Shows Text as the co-op status; bDone = a finished state that goes away.
static function Show(string Text, optional bool bDone)
{
	local XComPlayerController PC;
	local UIScreen Screen;
	local UIText StatusText;

	`log("Coop status:" @ Text, , 'X2TC');
	PC = XComPlayerController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (PC == none || PC.Pres == none || PC.Pres.ScreenStack == none)
	{
		return;
	}
	Screen = PC.Pres.ScreenStack.GetCurrentScreen();
	if (Screen == none)
	{
		return;
	}
	StatusText = UIText(Screen.GetChild('X2TC_CoopStatusText', false));
	if (StatusText == none)
	{
		StatusText = Screen.Spawn(class'UIText', Screen);
		StatusText.InitText('X2TC_CoopStatusText');
		StatusText.AnchorTopRight();
		StatusText.SetPosition(-TEXT_WIDTH - 20, 60);
		StatusText.SetSize(TEXT_WIDTH, FONT_SIZE + 20);
	}
	StatusText.SetHTMLText("<p align='RIGHT'><font size='" $ FONT_SIZE $ "' color='#FFFFFF'>CO-OP:" @ Text $ "</font></p>");
	StatusText.Show();
	StatusText.ClearTimer('Remove');
	if (bDone)
	{
		StatusText.SetTimer(FADE_SECONDS, false, 'Remove');
	}
}
