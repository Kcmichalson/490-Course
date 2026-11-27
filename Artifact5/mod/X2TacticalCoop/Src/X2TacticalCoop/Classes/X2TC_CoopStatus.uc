//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopStatus
//
//  What it changes (0.9.2, Kc's request): a one-line connection status in the top right
//  of both players' screens (joining, connecting, receiving, joined, disconnected), so
//  nobody waits on the main menu without knowing what's happening. Uses the game's
//  anchored message manager, which shows over any screen; each new status replaces the
//  last. Finished states fade after a few seconds.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\UIAnchoredMessageMgr.uc     (EUIAnchor L12-24, Message L75,
//                                                  RemoveMessage L189)
//    XComGame\Classes\XComPresentationLayerBase.uc (GetAnchoredMessenger L164)
//---------------------------------------------------------------------------------------

class X2TC_CoopStatus extends Object dependson(UIAnchoredMessageMgr);

const STATUS_ID = "X2TC_CoopStatus";
const STICKY_SECONDS = 600.0; // a waiting state stays until the next one replaces it
const FADE_SECONDS = 5.0;     // a finished state

// Shows Text as the co-op status; bDone = a finished state that fades.
static function Show(string Text, optional bool bDone)
{
	local XComPlayerController PC;
	local UIAnchoredMessageMgr Messenger;

	PC = XComPlayerController(class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController());
	if (PC == none || PC.Pres == none)
	{
		return;
	}
	Messenger = PC.Pres.GetAnchoredMessenger();
	if (Messenger == none)
	{
		return;
	}
	Messenger.RemoveMessage(STATUS_ID);
	Messenger.Message("CO-OP:" @ Text, 0.0, 0.1, TOP_RIGHT, (bDone) ? FADE_SECONDS : STICKY_SECONDS, STATUS_ID);
	`log("Coop status:" @ Text, , 'X2TC');
}
