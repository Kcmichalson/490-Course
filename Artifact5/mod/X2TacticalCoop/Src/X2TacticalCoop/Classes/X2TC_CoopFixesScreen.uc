//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopFixesScreen
//
//  What it changes: adds the CO-OP: FIXES screen (plans/m4-plan.md, "On-screen
//  toggles"). Either player opens it with CO-OP: FIXES on the tactical HUD
//  (X2TC_CoopListener). It lists SAFE MODE and one checkbox per 0.8.x fix (the list scrolls);
//  each click changes X2TC_CoopFixes on this machine only and is logged. Esc, the B
//  button, right-click or CLOSE close it. A new screen, not a class override; built like
//  X2TC_CoopSquadScreen.
//  0.8.4 (plans/m4-plan.md, "1.0 plan" item 1): plain labels, grouped (Stability,
//  Partner, Partner screen, Camera, Hacks, Rules), a short header, and a last row for
//  the Verbose log switch (X2TC_CoopFixes.SetVerbose; not a fix, so SAFE MODE doesn't
//  touch it).
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreen.uc          (InitScreen L60, OnUnrealCommand L107,
//                                           CloseScreen L127, InputState L54)
//    XComGame\Classes\UIList.uc            (InitList L50)
//    XComGame\Classes\UIMechaListItem.uc   (InitListItem L56, UpdateDataCheckbox L543)
//    XComGame\Classes\UIScreenStack.uc     (Push L317)
//---------------------------------------------------------------------------------------

class X2TC_CoopFixesScreen extends UIScreen;

const PANEL_WIDTH = 700;
const PANEL_HEIGHT = 760; // 0.8.1: 17 rows; 0.8.2: 26; the list scrolls (UIList adds a scrollbar)
const LIST_HEIGHT = 580;

var UIPanel Container;
var UIBGBox PanelBG;
var UIX2PanelHeader Header;
var UIList FixList;
var UIButton CloseButton;
var array<UIMechaListItem> Rows; // row 0 = SAFE MODE, row k + 1 = fix Order[k], last row = Verbose log
var array<int> Order;            // 0.8.4: fixes in display order (grouped)

// Opens the screen on this machine (once).
static function Open()
{
	local XComPresentationLayer Pres;

	Pres = class'X2TC_CoopTurnUI'.static.GetPres();
	if (Pres == none || Pres.ScreenStack == none)
	{
		`log("Coop fixes: no presentation layer; screen not opened", , 'X2TC');
		return;
	}
	if (Pres.ScreenStack.GetScreen(class'X2TC_CoopFixesScreen') != none)
	{
		return;
	}
	Pres.ScreenStack.Push(Pres.Spawn(class'X2TC_CoopFixesScreen', Pres));
	class'X2TC_CoopFixes'.static.LogState("screen opened");
}

// True while this screen is open on this machine.
static function bool IsOpen()
{
	local XComPresentationLayer Pres;

	Pres = class'X2TC_CoopTurnUI'.static.GetPres();
	return Pres != none && Pres.ScreenStack != none && Pres.ScreenStack.GetScreen(class'X2TC_CoopFixesScreen') != none;
}

simulated function InitScreen(XComPlayerController InitController, UIMovie InitMovie, optional name InitName)
{
	local UIMechaListItem Row;
	local int i;

	super.InitScreen(InitController, InitMovie, InitName);

	Container = Spawn(class'UIPanel', self).InitPanel('X2TC_FixesContainer');
	Container.AnchorCenter();
	Container.SetPosition(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2);
	Container.SetSize(PANEL_WIDTH, PANEL_HEIGHT);

	PanelBG = Spawn(class'UIBGBox', Container).InitBG('X2TC_FixesBG', 0, 0, PANEL_WIDTH, PANEL_HEIGHT);

	Header = Spawn(class'UIX2PanelHeader', Container);
	Header.InitPanelHeader('X2TC_FixesHeader', "CO-OP: FIXES" @ class'X2TC_CoopListener'.static.VersionTag(), "This PC only. All on at launch. Turn one off only if it misbehaves, and tell the host.");
	Header.SetHeaderWidth(PANEL_WIDTH - 20);
	Header.SetPosition(10, 10);

	FixList = Spawn(class'UIList', Container);
	FixList.InitList('X2TC_FixesList', 10, 80, PANEL_WIDTH - 40, LIST_HEIGHT);

	BuildOrder();
	for (i = 0; i <= class'X2TC_CoopFixes'.const.FIX_COUNT + 1; i++)
	{
		Row = Spawn(class'UIMechaListItem', FixList.ItemContainer);
		Row.bAnimateOnInit = false;
		Row.InitListItem();
		Rows.AddItem(Row);
	}

	CloseButton = Spawn(class'UIButton', Container);
	CloseButton.InitButton('X2TC_FixesClose', "CLOSE", OnCloseClicked);
	CloseButton.SetPosition(10, PANEL_HEIGHT - 50);

	RefreshRows();
}

function RefreshRows()
{
	local int i;
	local string Label;
	local bool bSafe;

	bSafe = class'X2TC_CoopFixes'.default.bSafeMode;
	Rows[0].UpdateDataCheckbox("SAFE MODE: every fix below off at once (try it if co-op misbehaves)", "", bSafe, OnCheckbox);
	for (i = 0; i < Order.Length; i++)
	{
		Label = class'X2TC_CoopFixes'.static.FixName(Order[i]);
		if (bSafe)
		{
			Label @= "(off: safe mode)";
		}
		Rows[i + 1].UpdateDataCheckbox(Label, "", class'X2TC_CoopFixes'.static.GetSwitch(Order[i]), OnCheckbox);
	}
	Rows[Rows.Length - 1].UpdateDataCheckbox("Verbose log (for bug reports; not a fix)", "", class'X2TC_CoopFixes'.static.Verbose(), OnCheckbox);
}

// 0.8.4: the fixes in display order, grouped by their label's first word.
function BuildOrder()
{
	Order.Length = 0;
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_CRASH_CLEANUP);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_REPLAY_VISUALS);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_BOUND_SKIP);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_CAN_ACT);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_TARGET_REFRESH); // 0.8.5
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_ATTACHED_MOVES);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_GUEST_BORDERS);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_PATH_HIDE);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_BANNER_IDLE);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_GLOW);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_WHEEL);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_STEP_ALL);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_CATCH_UP); // 0.8.5
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_PARTNER_PAUSE);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_CAMERA);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_WATCHER_CAMERA);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_PARTNER_LOOKAT);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_HACK_ROUTING);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_HACK_NO_CLICK);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_SP_RULES);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_FLANK_CRIT);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_SUPPRESSION);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_SKULLJACK);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_FOG_REVEAL);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_VIP_HOST);
	Order.AddItem(class'X2TC_CoopFixes'.const.FIX_INVITE_DIRECT); // 0.8.5
	if (Order.Length != class'X2TC_CoopFixes'.const.FIX_COUNT)
	{
		`log("Coop fixes: display order lists" @ Order.Length @ "of" @ class'X2TC_CoopFixes'.const.FIX_COUNT @ "fixes", , 'X2TC');
	}
}

function OnCheckbox(UICheckbox CheckboxControl)
{
	local int i;

	for (i = 0; i < Rows.Length; i++)
	{
		if (Rows[i].Checkbox != CheckboxControl)
		{
			continue;
		}
		if (i == 0)
		{
			class'X2TC_CoopFixes'.static.SetSafeMode(CheckboxControl.bChecked);
		}
		else if (i == Rows.Length - 1)
		{
			class'X2TC_CoopFixes'.static.SetVerbose(CheckboxControl.bChecked);
		}
		else if (i - 1 < Order.Length)
		{
			class'X2TC_CoopFixes'.static.SetSwitch(Order[i - 1], CheckboxControl.bChecked);
		}
		RefreshRows();
		return;
	}
}

function OnCloseClicked(UIButton Button)
{
	CloseScreen();
}

simulated function bool OnUnrealCommand(int cmd, int arg)
{
	if (!CheckInputIsReleaseOrDirectionRepeat(cmd, arg))
	{
		return false;
	}
	switch (cmd)
	{
		case class'UIUtilities_Input'.const.FXS_BUTTON_B:
		case class'UIUtilities_Input'.const.FXS_KEY_ESCAPE:
		case class'UIUtilities_Input'.const.FXS_R_MOUSE_DOWN:
			CloseScreen();
			return true;
	}
	return super.OnUnrealCommand(cmd, arg);
}

simulated function CloseScreen()
{
	class'X2TC_CoopFixes'.static.LogState("screen closed");
	super.CloseScreen();
}

defaultproperties
{
	bConsumeMouseEvents = true
	InputState = eInputState_Consume
}
