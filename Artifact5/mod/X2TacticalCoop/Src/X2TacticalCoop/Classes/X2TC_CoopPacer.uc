//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopPacer
//
//  What it changes (0.9.1, plans/m4-plan.md "0.9.1: pacing the outgoing queue"): every
//  M4 Steam message of about 1150 bunches or more never arrived and the connection
//  died (the 0.9.0 campaign join: 1242 bunches). Guess: the limit is how much is
//  queued at once. The host keeps at most WINDOW unsent bunches in the network
//  manager's outgoing queue; the rest wait here, in order, and are fed in as the
//  queue drains (from the host's fast-send timer). Host only.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComGameStateNetworkManager.uc (PendingGameData L42-61,
//                                                     OutGameData L63, ePDS_* L36-40)
//---------------------------------------------------------------------------------------

class X2TC_CoopPacer extends Object dependson(XComGameStateNetworkManager);

const WINDOW = 600; // at most this many unsent bunches in the game's queue

var array<XComGameStateNetworkManager.PendingGameData> Held;
var int HeldTotal;       // bunches held since the queue was last empty here
var float HoldStartTime;

// Host: right after a send that queued bunches from FirstNew on. While anything is
// held, every new bunch waits behind it (order matters); otherwise only the bunches
// beyond the window wait.
function HoldAfterSend(XComGameStateNetworkManager NetworkMgr, int FirstNew)
{
	local int KeepUntil, i;

	if (NetworkMgr == none)
	{
		return;
	}
	KeepUntil = (Held.Length > 0) ? FirstNew : FirstNew + Max(0, WINDOW - CountBefore(NetworkMgr, FirstNew));
	if (KeepUntil >= NetworkMgr.OutGameData.Length)
	{
		return;
	}
	if (Held.Length == 0)
	{
		HeldTotal = 0;
		HoldStartTime = class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds;
	}
	for (i = KeepUntil; i < NetworkMgr.OutGameData.Length; i++)
	{
		Held.AddItem(NetworkMgr.OutGameData[i]);
	}
	HeldTotal += NetworkMgr.OutGameData.Length - KeepUntil;
	NetworkMgr.OutGameData.Remove(KeepUntil, NetworkMgr.OutGameData.Length - KeepUntil);
	`log("Coop pacer: holding" @ Held.Length @ "bunches (queue kept at" @ NetworkMgr.OutGameData.Length $ ")", , 'X2TC');
}

// Unsent bunches already queued before index FirstNew.
function int CountBefore(XComGameStateNetworkManager NetworkMgr, int FirstNew)
{
	local int i, Count;

	for (i = 0; i < FirstNew && i < NetworkMgr.OutGameData.Length; i++)
	{
		if (NetworkMgr.OutGameData[i].PendingState == ePDS_NotHandled)
		{
			Count++;
		}
	}
	return Count;
}

// Host, from the fast-send timer: top the queue back up to the window.
function Feed(XComGameStateNetworkManager NetworkMgr)
{
	local int Unsent, Moved;

	if (Held.Length == 0 || NetworkMgr == none)
	{
		return;
	}
	Unsent = CountBefore(NetworkMgr, NetworkMgr.OutGameData.Length);
	while (Unsent < WINDOW && Held.Length > 0)
	{
		NetworkMgr.OutGameData.AddItem(Held[0]);
		Held.Remove(0, 1);
		Unsent++;
		Moved++;
	}
	if (Moved > 0 && class'X2TC_CoopFixes'.static.Verbose())
	{
		`log("Coop pacer: fed" @ Moved @ "bunches;" @ Held.Length @ "still held", , 'X2TC');
	}
	if (Held.Length == 0)
	{
		`log("Coop pacer: all" @ HeldTotal @ "held bunches queued after" @ (class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds - HoldStartTime) $ "s", , 'X2TC');
	}
}

// Anything held (for the session's logs and checks).
function bool IsHolding()
{
	return Held.Length > 0;
}
