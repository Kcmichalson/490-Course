//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopSquadScreen
//
//  What it changes: adds the co-op squad screen to a co-op tactical mission. Both players
//  open it with CO-OP: SQUAD (X2TC_CoopListener). It shows:
//    - one row per XCOM soldier (name, class) with a P1 (host) / P2 (partner) switch, in
//      the game's scrolling list, so squads larger than 6 fit;
//    - three checkboxes: Soldier ownership (on), Partner may end the turn (off), Partner
//      may edit (off; host only).
//  The host can always change it; the partner only with "Partner may edit". Rows the
//  viewer may not change are greyed out and their switches do nothing. Changes go
//  through X2TC_CoopSession (the host applies them; the partner's are sent to the
//  host). Esc, the B button, right-click or CLOSE close it. A new screen, not a class
//  override.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIScreen.uc          (InitScreen L60, OnUnrealCommand L107,
//                                           CloseScreen L127, InputState L54)
//    XComGame\Classes\UIList.uc            (InitList L50; adds a scrollbar when needed, L5-16)
//    XComGame\Classes\UIMechaListItem.uc   (InitListItem L56, UpdateDataSpinner L417,
//                                           UpdateDataCheckbox L543, SetDisabled L593)
//    XComGame\Classes\UIListItemSpinner.uc (OnSpinnerChangedCallback L21)
//    XComGame\Classes\UICharacterPool.uc   (the container / header / list layout, L83-119)
//    XComGame\Classes\UIScreenStack.uc     (Push L317)
//    XComGame\Classes\XComGameState_Unit.uc (GetFullName L4575, GetSoldierClassTemplate L3460)
//---------------------------------------------------------------------------------------

class X2TC_CoopSquadScreen extends UIScreen;

const PANEL_WIDTH = 700;
const PANEL_HEIGHT = 760;
const SOLDIER_LIST_HEIGHT = 440;

var UIPanel Container;
var UIBGBox PanelBG;
var UIX2PanelHeader Header;
var UIList SoldierList;
var UIList SettingsList;
var UIButton CloseButton;
var array<UIMechaListItem> SoldierRows;
var array<int> RowUnitIDs;          // the soldier of each row
var array<UIMechaListItem> SettingRows; // in the order of X2TC_CoopSession's SETTING_ indexes

// Opens the screen on this machine (once).
static function Open()
{
	local XComPresentationLayer Pres;

	if (FindOpen() != none)
	{
		return;
	}
	Pres = class'X2TC_CoopTurnUI'.static.GetPres();
	if (Pres == none || Pres.ScreenStack == none)
	{
		`log("Coop squad: no presentation layer; screen not opened", , 'X2TC');
		return;
	}
	Pres.ScreenStack.Push(Pres.Spawn(class'X2TC_CoopSquadScreen', Pres));
	`log("Coop squad: screen opened", , 'X2TC');
}

// The open squad screen on this machine, or none.
static function X2TC_CoopSquadScreen FindOpen()
{
	local XComPresentationLayer Pres;

	Pres = class'X2TC_CoopTurnUI'.static.GetPres();
	if (Pres == none || Pres.ScreenStack == none)
	{
		return none;
	}
	return X2TC_CoopSquadScreen(Pres.ScreenStack.GetScreen(class'X2TC_CoopSquadScreen'));
}

simulated function InitScreen(XComPlayerController InitController, UIMovie InitMovie, optional name InitName)
{
	super.InitScreen(InitController, InitMovie, InitName);

	Container = Spawn(class'UIPanel', self).InitPanel('X2TC_SquadContainer');
	Container.AnchorCenter();
	Container.SetPosition(-PANEL_WIDTH / 2, -PANEL_HEIGHT / 2);
	Container.SetSize(PANEL_WIDTH, PANEL_HEIGHT);

	PanelBG = Spawn(class'UIBGBox', Container).InitBG('X2TC_SquadBG', 0, 0, PANEL_WIDTH, PANEL_HEIGHT);

	Header = Spawn(class'UIX2PanelHeader', Container);
	Header.InitPanelHeader('X2TC_SquadHeader', "CO-OP: SQUAD" @ class'X2TC_CoopListener'.static.VersionTag(), "");
	Header.SetHeaderWidth(PANEL_WIDTH - 20);
	Header.SetPosition(10, 10);

	SoldierList = Spawn(class'UIList', Container);
	SoldierList.InitList('X2TC_SquadSoldiers', 10, 80, PANEL_WIDTH - 40, SOLDIER_LIST_HEIGHT);

	SettingsList = Spawn(class'UIList', Container);
	SettingsList.InitList('X2TC_SquadSettings', 10, 80 + SOLDIER_LIST_HEIGHT + 20, PANEL_WIDTH - 40, 4 * class'UIMechaListItem'.default.Height);

	CloseButton = Spawn(class'UIButton', Container);
	CloseButton.InitButton('X2TC_SquadClose', "CLOSE", OnCloseClicked);
	CloseButton.SetPosition(10, PANEL_HEIGHT - 50);

	BuildRows();
	RefreshRows();
}

// One row per soldier, and the three setting rows.
function BuildRows()
{
	local array<XComGameState_Unit> Squad;
	local UIMechaListItem Row;
	local int i;

	class'X2TC_CoopOwnership'.static.GetSquad(Squad);
	for (i = 0; i < Squad.Length; i++)
	{
		Row = Spawn(class'UIMechaListItem', SoldierList.ItemContainer);
		Row.bAnimateOnInit = false;
		Row.InitListItem();
		SoldierRows.AddItem(Row);
		RowUnitIDs.AddItem(Squad[i].ObjectID);
	}
	for (i = 0; i < 4; i++)
	{
		Row = Spawn(class'UIMechaListItem', SettingsList.ItemContainer);
		Row.bAnimateOnInit = false;
		Row.InitListItem();
		SettingRows.AddItem(Row);
	}
	`log("Coop squad: rows for" @ Squad.Length @ "soldiers", , 'X2TC');
}

// Redraws every row from the history (owners) and the session (settings, who may edit).
function RefreshRows()
{
	local X2TC_CoopSession Session;
	local XComGameState_Unit UnitState;
	local bool bCanEdit, bHost;
	local int i, OwnerValue; // not "Owner": that's Actor's field (compiler warning)
	local string Label, Who;

	Session = class'X2TC_CoopSession'.static.FindSession();
	bCanEdit = Session != none && Session.IsActive() && Session.CanEdit();
	bHost = Session != none && Session.IsHost();

	if (Session == none || !Session.IsActive())
	{
		Who = "Not in a co-op session (host first: the Co-op icon, then HOST)";
	}
	else if (bCanEdit)
	{
		Who = "You can change owners and settings";
	}
	else
	{
		Who = "View only: the host changes these";
	}
	Header.SetText("CO-OP: SQUAD" @ class'X2TC_CoopListener'.static.VersionTag(), Who);

	for (i = 0; i < SoldierRows.Length; i++)
	{
		UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(RowUnitIDs[i]));
		OwnerValue = class'X2TC_CoopOwnership'.static.GetOwner(UnitState);
		Label = "P1 (host)";
		if (OwnerValue == class'X2TC_CoopOwnership'.const.OWNER_GUEST)
		{
			Label = "P2 (partner)";
		}
		SoldierRows[i].UpdateDataSpinner(SoldierText(UnitState), Label, OnOwnerSpinner);
		SoldierRows[i].SetDisabled(!bCanEdit);
	}

	SettingRows[0].UpdateDataCheckbox("Soldier ownership", "", Session == none || Session.GetSetting(class'X2TC_CoopSession'.const.SETTING_OWNERSHIP), OnSettingCheckbox);
	SettingRows[0].SetDisabled(!bCanEdit);
	SettingRows[1].UpdateDataCheckbox("Partner may end the turn", "", Session != none && Session.GetSetting(class'X2TC_CoopSession'.const.SETTING_PARTNER_END_TURN), OnSettingCheckbox);
	SettingRows[1].SetDisabled(!bCanEdit);
	SettingRows[2].UpdateDataCheckbox("Partner may edit this screen (host only)", "", Session != none && Session.GetSetting(class'X2TC_CoopSession'.const.SETTING_PARTNER_EDIT), OnSettingCheckbox);
	SettingRows[2].SetDisabled(!bHost || !bCanEdit);
	// Test switch: host only, and only before the partner follows.
	SettingRows[3].UpdateDataCheckbox("SYNC: NEW FRAMES (test; set before the partner joins)", "", Session != none && Session.GetSetting(class'X2TC_CoopSession'.const.SETTING_NEW_FRAMES), OnSettingCheckbox);
	SettingRows[3].SetDisabled(!bHost || !bCanEdit || (Session != none && Session.bGuestFollowing));
}

// "Name (Class)" for a soldier row.
function string SoldierText(XComGameState_Unit UnitState)
{
	local X2SoldierClassTemplate ClassTemplate;

	if (UnitState == none)
	{
		return "(gone)";
	}
	ClassTemplate = UnitState.GetSoldierClassTemplate();
	if (ClassTemplate == none)
	{
		return UnitState.GetFullName();
	}
	return UnitState.GetFullName() @ "(" $ ClassTemplate.DisplayName $ ")";
}

// A soldier's switch: toggles between P1 and P2.
function OnOwnerSpinner(UIListItemSpinner SpinnerControl, int Direction)
{
	local X2TC_CoopSession Session;
	local XComGameState_Unit UnitState;
	local int i, NewOwner;

	Session = class'X2TC_CoopSession'.static.FindSession();
	for (i = 0; i < SoldierRows.Length; i++)
	{
		if (SoldierRows[i].Spinner != SpinnerControl)
		{
			continue;
		}
		if (Session == none || !Session.IsActive() || !Session.CanEdit())
		{
			`log("Coop squad: owner switch ignored (this player may not edit)", , 'X2TC');
			RefreshRows();
			return;
		}
		UnitState = XComGameState_Unit(`XCOMHISTORY.GetGameStateForObjectID(RowUnitIDs[i]));
		NewOwner = class'X2TC_CoopOwnership'.const.OWNER_GUEST;
		if (class'X2TC_CoopOwnership'.static.GetOwner(UnitState) == class'X2TC_CoopOwnership'.const.OWNER_GUEST)
		{
			NewOwner = class'X2TC_CoopOwnership'.const.OWNER_HOST;
		}
		Session.RequestOwner(RowUnitIDs[i], NewOwner, Session.RoleName());
		return;
	}
}

// A setting's checkbox.
function OnSettingCheckbox(UICheckbox CheckboxControl)
{
	local X2TC_CoopSession Session;
	local int i;

	Session = class'X2TC_CoopSession'.static.FindSession();
	for (i = 0; i < SettingRows.Length; i++)
	{
		if (SettingRows[i].Checkbox != CheckboxControl)
		{
			continue;
		}
		if (Session == none || !Session.IsActive() || !Session.CanEdit()
			|| ((i == class'X2TC_CoopSession'.const.SETTING_PARTNER_EDIT || i == class'X2TC_CoopSession'.const.SETTING_NEW_FRAMES) && !Session.IsHost()))
		{
			`log("Coop squad: setting" @ i @ "ignored (this player may not change it)", , 'X2TC');
			RefreshRows();
			return;
		}
		Session.RequestSetting(i, CheckboxControl.bChecked, Session.RoleName());
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
	`log("Coop squad: screen closed", , 'X2TC');
	super.CloseScreen();
}

defaultproperties
{
	bConsumeMouseEvents = true
	InputState = eInputState_Consume
}
