//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopMenu
//
//  What it changes: 0.8.4 (plans/m4-plan.md, C item 13 and "1.0 plan" item 1; Kc: one
//  "Co-op" button in the top-right HUD icon row instead of the column of CO-OP buttons).
//  Adds one icon-style "Co-op" button just left of the game's top-right icon row on the
//  tactical HUD. Clicking it opens a small panel under it with the role's CO-OP actions
//  (X2TC_CoopListener adds them, each with one line of help as its tooltip); clicking the
//  icon again or any action closes it. Not a class override: a panel on the HUD.
//    - Position: the row is one Flash panel that lays out up to 10 icons itself, with no
//      slot for a non-ability button (UITacticalHUD_MouseControls.uc L58, L77-150). Its
//      active icon count follows the stock rule (L136-150: 1 while a shot menu is up,
//      else 5, 6 with command abilities, 7 with an active Chosen), and the button's x is
//      computed from it, re-checked 4 times a second. ICON_STEP, ROW_MARGIN and ICON_SIZE
//      are guesses until measured from a screenshot (checklists/m4-084.md); each position
//      change is logged.
//    - Escape and clicking outside don't close it in 0.8.4 (the icon toggles it).
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UITacticalHUD.uc                 (m_kMouseControls L72, m_isMenuRaised)
//    XComGame\Classes\UITacticalHUD_MouseControls.uc   (CommandAbilities L46, UpdateControls)
//    XComGame\Classes\XComGameState_Unit.uc            (GetActivatedChosen)
//    XComGame\Classes\UIIcon.uc                        (InitIcon L38, OnClickedDelegate L35)
//    XComGame\Classes\UIPanel.uc                       (AnchorTopRight, SetPosition, SetX,
//                                                       Show/Hide L536-546, SetTooltipText L302,
//                                                       ParentPanel L77)
//    XComGame\Classes\UIButton.uc                      (InitButton, OnClickedDelegate L48)
//    XComGame\Classes\UIBGBox.uc                       (InitBG, SetSize)
//---------------------------------------------------------------------------------------

class X2TC_CoopMenu extends UIPanel;

const MENU_NAME = 'X2TC_CoopMenu';
const ICON_IMAGE = "img:///UILibrary_XPACK_Common.UIPerk_bond_teamwork";
const ICON_SIZE = 40;      // guess: about the stock icons' size at 1080p
const ICON_STEP = 50;      // guess: one stock icon plus its gap
const ROW_MARGIN = 16;     // guess: the row's right edge to the screen's
const ROW_Y = 8;           // guess: the icons' top
const DRAWER_X = -340;     // the panel's left edge, like the old button column
const DRAWER_Y = 140;      // under the status line and the partner's END TURN
const ITEM_STEP = 44;

var UIIcon CoopIcon;
var UIPanel Drawer;
var UIBGBox DrawerBG;
var array<UIButton> Items;
var bool bOpen;
var int LastActiveIcons;

// The HUD's menu, or none.
static function X2TC_CoopMenu FindMenu(UIScreen HUDScreen)
{
	if (HUDScreen == none)
	{
		return none;
	}
	return X2TC_CoopMenu(HUDScreen.GetChild(MENU_NAME, false));
}

function X2TC_CoopMenu InitCoopMenu()
{
	InitPanel(MENU_NAME);
	AnchorTopRight();
	SetPosition(0, 0);

	CoopIcon = Spawn(class'UIIcon', self);
	CoopIcon.InitIcon('X2TC_CoopIcon', ICON_IMAGE, true, true, ICON_SIZE, eUIState_Normal, OnIconClicked);
	CoopIcon.SetTooltipText("Co-op: squad, end turn, fixes and more");
	CoopIcon.DisableNavigation();

	Drawer = Spawn(class'UIPanel', self);
	Drawer.InitPanel('X2TC_CoopDrawer');
	Drawer.SetPosition(DRAWER_X, DRAWER_Y);
	DrawerBG = Spawn(class'UIBGBox', Drawer);
	DrawerBG.InitBG('X2TC_CoopDrawerBG', -10, -10, -DRAWER_X - 10, ITEM_STEP);
	Drawer.Hide();

	LastActiveIcons = -1;
	UpdatePosition();
	SetTimer(0.25, true, nameof(UpdatePosition));
	return self;
}

// One action in the panel; Help becomes its tooltip.
function UIButton AddItem(name ButtonName, string Label, delegate<UIButton.OnClickedDelegate> Handler, string Help)
{
	local UIButton NewButton;

	NewButton = Spawn(class'UIButton', Drawer);
	NewButton.InitButton(ButtonName, Label, Handler);
	NewButton.DisableNavigation();
	if (Help != "")
	{
		NewButton.SetTooltipText(Help);
	}
	Items.AddItem(NewButton);
	Relayout();
	return NewButton;
}

function SetItemVisible(name ButtonName, bool bVisible)
{
	local int i;

	for (i = 0; i < Items.Length; i++)
	{
		if (Items[i].MCName == ButtonName)
		{
			if (bVisible)
			{
				Items[i].Show();
			}
			else
			{
				Items[i].Hide();
			}
		}
	}
	Relayout();
}

// Stacks the visible items and sizes the background.
function Relayout()
{
	local int i, NextY;

	for (i = 0; i < Items.Length; i++)
	{
		if (Items[i].bIsVisible)
		{
			Items[i].SetPosition(0, NextY);
			NextY += ITEM_STEP;
		}
	}
	DrawerBG.SetSize(-DRAWER_X - 10, Max(NextY, ITEM_STEP) + 10);
}

function SetOpen(bool bNowOpen)
{
	bOpen = bNowOpen;
	if (bOpen)
	{
		Relayout();
		Drawer.Show();
	}
	else
	{
		Drawer.Hide();
	}
}

function OnIconClicked()
{
	if (Movie != none && Movie.Pres != none)
	{
		Movie.Pres.PlayUISound(eSUISound_MenuSelect);
	}
	SetOpen(!bOpen);
}

// Closes the menu that holds Button (its parent is the drawer, whose parent is the menu).
static function CloseFor(UIPanel Button)
{
	local X2TC_CoopMenu Menu;

	if (Button != none && Button.ParentPanel != none)
	{
		Menu = X2TC_CoopMenu(Button.ParentPanel.ParentPanel);
	}
	if (Menu != none)
	{
		Menu.SetOpen(false);
	}
}

// The stock row's active icon count (UITacticalHUD_MouseControls.UpdateControls rule).
function int ActiveIcons()
{
	local UITacticalHUD HUD;

	HUD = UITacticalHUD(Screen);
	if (HUD == none || HUD.m_kMouseControls == none)
	{
		return 5;
	}
	if (HUD.m_isMenuRaised)
	{
		return 1;
	}
	if (class'XComGameState_Unit'.static.GetActivatedChosen() != none)
	{
		return 7;
	}
	return HUD.m_kMouseControls.CommandAbilities.Length > 0 ? 6 : 5;
}

// Just left of the row; logged when it moves.
function UpdatePosition()
{
	local int Count;

	Count = ActiveIcons();
	if (Count == LastActiveIcons)
	{
		return;
	}
	LastActiveIcons = Count;
	CoopIcon.SetPosition(-(ROW_MARGIN + Count * ICON_STEP + ICON_SIZE), ROW_Y);
	// 0.8.4c: Verbose only (0.8.4b Part 1: the placement looked right at 1, 5 and 6 icons).
	if (class'X2TC_CoopFixes'.static.Verbose()) `log("Coop UI: Co-op button placed left of" @ Count @ "HUD icons (x" @ -(ROW_MARGIN + Count * ICON_STEP + ICON_SIZE) $ ")", , 'X2TC');
}

defaultproperties
{
	bAnimateOnInit = false
}
