//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopMapCleanup
//
//  What it changes: when a co-op tactical map is cleaned up (before it unloads), it tells
//  X2TC_CoopSession, which closes a session still open and empties the network manager's
//  per-connection data (plans/m4-plan.md, 0.8.0 "Crash"). Stock multiplayer does the same
//  from its ruleset (X2TacticalMPGameRuleset.uc L105-113); the single-player ruleset has
//  nothing like it. The session spawns one of these in the host's mission (HOST) and in
//  the guest's copy (follower installed); it does nothing else and has no visuals.
//
//  Relies on (paths in Development\SrcOrig):
//    Engine\Classes\Actor.uc   (OnCleanupWorld L2134, SubscribeToOnCleanupWorld L2139)
//---------------------------------------------------------------------------------------

class X2TC_CoopMapCleanup extends Actor;

event PostBeginPlay()
{
	super.PostBeginPlay();
	SubscribeToOnCleanupWorld();
	`log("Coop cleanup: map cleanup actor ready", , 'X2TC');
}

simulated event OnCleanupWorld()
{
	local X2TC_CoopSession Session;

	Session = class'X2TC_CoopSession'.static.FindSession();
	if (Session != none)
	{
		Session.OnMapCleanup();
	}
	super.OnCleanupWorld();
}

defaultproperties
{
	bHidden = true
}
