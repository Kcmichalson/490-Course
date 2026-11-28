//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopSkipAhead
//
//  What it changes (0.9.6, plans/m4-plan.md "0.9.6: skip ahead"): when the partner's
//  screen is more than 10 s behind (0.9.3 run: up to 56 s, and units shown where they
//  stood turns ago), the partner jumps its replay to the newest frame with the game's
//  own replay jump, which syncs every unit's visuals to the game state, rebuilds the
//  frame and updates the fog. Frames with a Chosen arriving or a dynamic narrative
//  (taunt) stop the jump just before them, so those still play. Not within 10 s of the
//  partner's own order, at most once per 20 s. Switch: "Partner screen: skip ahead when
//  far behind". Partner only; called once a second from X2TC_CoopCatchUp.Update.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComReplayMgr.uc   (JumpReplayToFrame L282-309)
//    XComGame\Classes\XComGameState_NarrativeManager.uc (PendingNarrativeMoments L17)
//    XComGame\Classes\X2CharacterTemplate.uc (bIsChosen L88)
//---------------------------------------------------------------------------------------

class X2TC_CoopSkipAhead extends Object config(X2TacticalCoopFixes);

const SKIP_BEHIND_MS = 10000;   // more than this behind: skip ahead
const SKIP_COOLDOWN = 20.0;     // seconds between skips
const OWN_ORDER_QUIET = 10.0;   // seconds after the partner's own order with no skip

var config float LastSkipTime;  // never saved (shared state, as X2TC_CoopCatchUp)
var config int Skips;

static function Maybe(int BehindMs)
{
	local X2TC_CoopSession Session;
	local X2TC_CoopReplayMgr Replay;
	local XComGameStateHistory History;
	local string ActionName;
	local int Oldest, Latest, Target, Frame;
	local float Now;

	if (BehindMs <= SKIP_BEHIND_MS || !class'X2TC_CoopFixes'.static.IsOn(class'X2TC_CoopFixes'.const.FIX_SKIP_AHEAD))
	{
		return;
	}
	Now = class'WorldInfo'.static.GetWorldInfo().RealTimeSeconds;
	if (default.LastSkipTime > 0 && Now - default.LastSkipTime < SKIP_COOLDOWN && Now >= default.LastSkipTime)
	{
		return;
	}
	Session = class'X2TC_CoopSession'.static.FindSession();
	if (Session == none || Session.RoleName() != "guest")
	{
		return;
	}
	if (Session.LastOwnActionTime > 0 && Now - Session.LastOwnActionTime < OWN_ORDER_QUIET)
	{
		return;
	}
	Replay = X2TC_CoopReplayMgr(XComTacticalGRI(class'WorldInfo'.static.GetWorldInfo().GRI).ReplayMgr);
	if (Replay == none)
	{
		return;
	}
	Oldest = Session.GetLag().OldestPlayingFrame(ActionName);
	if (Oldest < 0)
	{
		return;
	}
	History = `XCOMHISTORY;
	Latest = History.GetNumGameStates() - 1;
	Target = Latest;
	for (Frame = Oldest + 1; Frame <= Latest; Frame++)
	{
		if (IsKeyFrame(History, Frame))
		{
			Target = Frame - 1;
			break;
		}
	}
	default.LastSkipTime = Now;
	if (Target <= Oldest)
	{
		`log("Coop skip-ahead: not skipped (" $ BehindMs $ " ms behind; a Chosen or taunt frame is next, frame" @ (Oldest + 1) $ ")", , 'X2TC');
		return;
	}
	default.Skips = default.Skips + 1;
	`log("Coop skip-ahead:" @ BehindMs @ "ms behind; jumping from frame" @ Oldest @ "(" $ ActionName $ ") to" @ Target @ "of" @ Latest @ "(skip" @ default.Skips $ ")", , 'X2TC');
	Replay.JumpReplayToFrame(Target);
	class'X2TC_CoopCatchUp'.static.Restore("skipped ahead");
	class'X2TC_CoopStatus'.static.Show("caught up (skipped" @ (BehindMs / 1000) $ "s)", true);
	Oldest = Session.GetLag().OldestPlayingFrame(ActionName);
	`log("Coop skip-ahead: after the jump, oldest playing frame" @ Oldest @ "(" $ ActionName $ ")", , 'X2TC');
}

// A frame where a Chosen first appears, or with a taunt line: don't skip past it.
static function bool IsKeyFrame(XComGameStateHistory History, int Frame)
{
	local XComGameState GameState;
	local XComGameState_NarrativeManager NarrativeMgr;
	local XComGameState_Unit Unit;
	local X2CharacterTemplate Template;

	GameState = History.GetGameStateFromHistory(Frame);
	if (GameState == none)
	{
		return false;
	}
	foreach GameState.IterateByClassType(class'XComGameState_NarrativeManager', NarrativeMgr)
	{
		if (NarrativeMgr.PendingNarrativeMoments.Length > 0)
		{
			return true;
		}
	}
	foreach GameState.IterateByClassType(class'XComGameState_Unit', Unit)
	{
		Template = Unit.GetMyTemplate();
		if (Template != none && Template.bIsChosen && History.GetGameStateForObjectID(Unit.ObjectID, , Frame - 1) == none)
		{
			return true;
		}
	}
	return false;
}
