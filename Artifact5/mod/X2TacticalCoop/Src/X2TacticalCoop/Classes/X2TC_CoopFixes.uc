//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopFixes
//
//  What it changes: nothing by itself. It holds the on/off switches for the co-op fixes,
//  so each fix can be turned off on one machine if it misbehaves:
//    - one switch per fix, all on at every launch;
//    - SAFE MODE, which turns every fix off at once.
//  Switches belong to this machine only (each machine's fixes read its own) and last
//  until the game is closed. They are class defaults changed at run time, which
//  UnrealScript allows only on config variables, so they are config variables this mod
//  NEVER saves (no SaveConfig anywhere); no ini file is written. Class defaults live for
//  the whole game, so the switches survive map loads.
//  Each variable stores "off" (false = the fix runs), because config defaults weren't
//  applied at launch (all switches started off).
//  The fresh pathing pawn (fix D) was taken out:
//  fix D only changed a highlight's colour -- Kc
//  The "Verbose log" switch isn't a fix, so SAFE MODE doesn't touch it; VERBOSE_DEFAULT
//  sets it at launch (true in playtest builds, false in 1.0). The per-frame and
//  per-update X2TC lines run only while it's on.
//  There's no switch for an auto-invite:
//  auto-invite written and removed before any build -- Kc
//  Also holds one camera diagnostic flag (CameraOverrideRan).
//
//  Relies on (paths in Development\SrcOrig): nothing beyond Core\Classes\Object.uc.
//---------------------------------------------------------------------------------------

class X2TC_CoopFixes extends Object config(X2TacticalCoopFixes);

const FIX_CRASH_CLEANUP = 0;   // release the network manager's data before a map unloads
const FIX_HACK_ROUTING = 1;    // hacks: the starter controls, the other watches; result held
const FIX_BOUND_SKIP = 2;      // the guest's cycling skips soldiers that can't act
const FIX_VIP_HOST = 3;        // VIPs, civilians and other non-soldiers count as the host's
const FIX_GUEST_BORDERS = 4;   // the guest's move range and cover icons (tutorial flag)
const FIX_CAMERA = 5;          // the follow camera while connected (class override)
const FIX_REPLAY_VISUALS = 6;  // the guest drops visuals it can't build (noise alert crash)
const FIX_CAN_ACT = 7;         // "can act" uses the game's own rule (bound, panicked)
const FIX_PATH_HIDE = 8;       // the guest hides its path preview when its input turns off
const FIX_BANNER_IDLE = 9;     // "out of moves" banner only once the last action has played
const FIX_SP_RULES = 10;       // single-player rules while connected (abilities, pause)
const FIX_GLOW = 11;           // no tutorial glow on the guest's ability icons
const FIX_WHEEL = 12;          // mouse wheel changes floors on the guest
const FIX_PARTNER_LOOKAT = 13; // the host's camera looks at the guest's non-move abilities
const FIX_ATTACHED_MOVES = 14; // the guest's SPARK BIT / Gremlin follow its moves
const FIX_STEP_ALL = 15;       // the guest replays all pending frames at once outside XCOM's turn
const FIX_PARTNER_PAUSE = 16;  // the guest opens the pause menu while none of its soldiers can act
const FIX_HACK_NO_CLICK = 17;  // the watcher's copy of a hack screen takes no clicks; guest sends only its own
const FIX_FLANK_CRIT = 18;     // flanking crit as in single player (co-op passive)
const FIX_SUPPRESSION = 19;    // suppression aim penalty as in single player (co-op passive)
const FIX_SKULLJACK = 20;      // Skulljack / Skullmine chance as in single player
const FIX_FOG_REVEAL = 21;     // shooters in the fog are revealed as in single player (watcher)
const FIX_WATCHER_CAMERA = 22; // follow camera by the watcher (no override)
const FIX_INVITE_DIRECT = 23; // a co-op Steam invite joins without CO-OP, JOIN (STEAM) first
const FIX_TARGET_REFRESH = 24; // the partner rebuilds its targets once caught up
const FIX_CATCH_UP = 25;      // the game's fast mode on the partner while it's behind
const FIX_COUNT = 26;

// The Verbose log switch at launch (true: playtest builds; false: 1.0).
const VERBOSE_DEFAULT = true;

// Config only so that run-time "default." assignments compile; never saved (see above).
// Each stores OFF: false (the value at every launch) means the fix runs.
var config bool bSafeMode;
var config bool bCrashCleanupOff;
var config bool bHackRoutingOff;
var config bool bBoundSkipOff;
var config bool bVipHostOff;
var config bool bGuestBordersOff;
var config bool bCameraOff;
var config bool bReplayVisualsOff;
var config bool bCanActOff;
var config bool bPathHideOff;
var config bool bBannerIdleOff;
var config bool bSPRulesOff;
var config bool bGlowOff;
var config bool bWheelOff;
var config bool bPartnerLookAtOff;
var config bool bAttachedMovesOff;
var config bool bStepAllOff;
var config bool bPartnerPauseOff;
var config bool bHackNoClickOff;
var config bool bFlankCritOff;
var config bool bSuppressionOff;
var config bool bSkulljackOff;
var config bool bFogRevealOff;
var config bool bWatcherCameraOff;
var config bool bInviteDirectOff;
var config bool bTargetRefreshOff;
var config bool bCatchUpOff;
var config bool bCameraOverrideRan; // diagnostics: X2TC_Action_CameraFollowUnit has run this launch
var config bool bVerboseFlipped;    // true once the Verbose log switch differs from VERBOSE_DEFAULT

// True while the per-frame and per-update lines should be logged.
static function bool Verbose()
{
	return VERBOSE_DEFAULT != default.bVerboseFlipped;
}

static function SetVerbose(bool bOn)
{
	default.bVerboseFlipped = (bOn != VERBOSE_DEFAULT);
	`log("Coop fixes: Verbose log" @ (bOn ? "ON" : "OFF"), , 'X2TC');
}

// Diagnostics for the camera override (X2TC_Action_CameraFollowUnit sets it).
static function MarkCameraOverrideRan()
{
	default.bCameraOverrideRan = true;
}

static function bool CameraOverrideRan()
{
	return default.bCameraOverrideRan;
}

// True if the fix runs now: its switch is on and safe mode is off.
static function bool IsOn(int Fix)
{
	if (default.bSafeMode)
	{
		return false;
	}
	return GetSwitch(Fix);
}

// The fix's own switch (true = on), ignoring safe mode.
static function bool GetSwitch(int Fix)
{
	switch (Fix)
	{
		case FIX_CRASH_CLEANUP:  return !default.bCrashCleanupOff;
		case FIX_HACK_ROUTING:   return !default.bHackRoutingOff;
		case FIX_BOUND_SKIP:     return !default.bBoundSkipOff;
		case FIX_VIP_HOST:       return !default.bVipHostOff;
		case FIX_GUEST_BORDERS:  return !default.bGuestBordersOff;
		case FIX_CAMERA:         return !default.bCameraOff;
		case FIX_REPLAY_VISUALS: return !default.bReplayVisualsOff;
		case FIX_CAN_ACT:        return !default.bCanActOff;
		case FIX_PATH_HIDE:      return !default.bPathHideOff;
		case FIX_BANNER_IDLE:    return !default.bBannerIdleOff;
		case FIX_SP_RULES:       return !default.bSPRulesOff;
		case FIX_GLOW:           return !default.bGlowOff;
		case FIX_WHEEL:          return !default.bWheelOff;
		case FIX_PARTNER_LOOKAT: return !default.bPartnerLookAtOff;
		case FIX_ATTACHED_MOVES: return !default.bAttachedMovesOff;
		case FIX_STEP_ALL:       return !default.bStepAllOff;
		case FIX_PARTNER_PAUSE:  return !default.bPartnerPauseOff;
		case FIX_HACK_NO_CLICK:  return !default.bHackNoClickOff;
		case FIX_FLANK_CRIT:     return !default.bFlankCritOff;
		case FIX_SUPPRESSION:    return !default.bSuppressionOff;
		case FIX_SKULLJACK:      return !default.bSkulljackOff;
		case FIX_FOG_REVEAL:     return !default.bFogRevealOff;
		case FIX_WATCHER_CAMERA: return !default.bWatcherCameraOff;
		case FIX_INVITE_DIRECT:  return !default.bInviteDirectOff;
		case FIX_TARGET_REFRESH: return !default.bTargetRefreshOff;
		case FIX_CATCH_UP:       return !default.bCatchUpOff;
	}
	return false;
}

static function SetSwitch(int Fix, bool bOn)
{
	switch (Fix)
	{
		case FIX_CRASH_CLEANUP:  default.bCrashCleanupOff = !bOn; break;
		case FIX_HACK_ROUTING:   default.bHackRoutingOff = !bOn; break;
		case FIX_BOUND_SKIP:     default.bBoundSkipOff = !bOn; break;
		case FIX_VIP_HOST:       default.bVipHostOff = !bOn; break;
		case FIX_GUEST_BORDERS:  default.bGuestBordersOff = !bOn; break;
		case FIX_CAMERA:         default.bCameraOff = !bOn; break;
		case FIX_REPLAY_VISUALS: default.bReplayVisualsOff = !bOn; break;
		case FIX_CAN_ACT:        default.bCanActOff = !bOn; break;
		case FIX_PATH_HIDE:      default.bPathHideOff = !bOn; break;
		case FIX_BANNER_IDLE:    default.bBannerIdleOff = !bOn; break;
		case FIX_SP_RULES:       default.bSPRulesOff = !bOn; break;
		case FIX_GLOW:           default.bGlowOff = !bOn; break;
		case FIX_WHEEL:          default.bWheelOff = !bOn; break;
		case FIX_PARTNER_LOOKAT: default.bPartnerLookAtOff = !bOn; break;
		case FIX_ATTACHED_MOVES: default.bAttachedMovesOff = !bOn; break;
		case FIX_STEP_ALL:       default.bStepAllOff = !bOn; break;
		case FIX_PARTNER_PAUSE:  default.bPartnerPauseOff = !bOn; break;
		case FIX_HACK_NO_CLICK:  default.bHackNoClickOff = !bOn; break;
		case FIX_FLANK_CRIT:     default.bFlankCritOff = !bOn; break;
		case FIX_SUPPRESSION:    default.bSuppressionOff = !bOn; break;
		case FIX_SKULLJACK:      default.bSkulljackOff = !bOn; break;
		case FIX_FOG_REVEAL:     default.bFogRevealOff = !bOn; break;
		case FIX_WATCHER_CAMERA: default.bWatcherCameraOff = !bOn; break;
		case FIX_INVITE_DIRECT:  default.bInviteDirectOff = !bOn; break;
		case FIX_TARGET_REFRESH: default.bTargetRefreshOff = !bOn; break;
		case FIX_CATCH_UP:       default.bCatchUpOff = !bOn; break;
		default: return;
	}
	`log("Coop fixes: " $ FixName(Fix) @ "switched" @ (bOn ? "ON" : "OFF") $ ";" @ StateText(), , 'X2TC');
}

static function SetSafeMode(bool bOn)
{
	default.bSafeMode = bOn;
	`log("Coop fixes: SAFE MODE" @ (bOn ? "ON (every fix off)" : "OFF") $ ";" @ StateText(), , 'X2TC');
}

// The label on the fixes screen.
static function string FixName(int Fix)
{
	switch (Fix)
	{
		case FIX_CRASH_CLEANUP:  return "Stability: clean up when leaving a map";
		case FIX_HACK_ROUTING:   return "Hacks: the starter controls, the partner watches";
		case FIX_BOUND_SKIP:     return "Partner: Tab skips soldiers that can't act";
		case FIX_VIP_HOST:       return "Rules: VIPs and civilians are the host's";
		case FIX_GUEST_BORDERS:  return "Partner screen: move range and cover icons";
		case FIX_CAMERA:         return "Camera: follow moves (override)";
		case FIX_REPLAY_VISUALS: return "Stability: partner skips visuals it can't build";
		case FIX_CAN_ACT:        return "Partner: can-act check uses the game's rule";
		case FIX_PATH_HIDE:      return "Partner screen: hide the path while moving";
		case FIX_BANNER_IDLE:    return "Partner screen: banners wait for the last action";
		case FIX_SP_RULES:       return "Rules: single-player rules while connected";
		case FIX_GLOW:           return "Partner screen: no glow on ability icons";
		case FIX_WHEEL:          return "Partner screen: mouse wheel changes floors";
		case FIX_PARTNER_LOOKAT: return "Camera: host looks at the partner's actions";
		case FIX_ATTACHED_MOVES: return "Partner: BIT and Gremlin follow moves";
		case FIX_STEP_ALL:       return "Partner screen: faster enemy turns";
		case FIX_PARTNER_PAUSE:  return "Partner screen: pause while waiting";
		case FIX_HACK_NO_CLICK:  return "Hacks: the watcher can't click";
		case FIX_FLANK_CRIT:     return "Rules: flanking crit as in single player";
		case FIX_SUPPRESSION:    return "Rules: suppression penalty as in single player";
		case FIX_SKULLJACK:      return "Rules: Skulljack chance as in single player";
		case FIX_FOG_REVEAL:     return "Rules: reveal shooters in the fog";
		case FIX_WATCHER_CAMERA: return "Camera: follow moves (watcher)";
		case FIX_INVITE_DIRECT:  return "Steam: a co-op invite joins directly";
		case FIX_TARGET_REFRESH: return "Partner: refresh targets once caught up";
		case FIX_CATCH_UP:       return "Partner screen: fast mode while behind";
	}
	return "unknown fix" @ Fix;
}

// "safe mode=False crash=True ...": what actually runs.
static function string StateText()
{
	local string Text;
	local int i;

	Text = "safe mode=" $ default.bSafeMode @ "verbose=" $ Verbose();
	for (i = 0; i < FIX_COUNT; i++)
	{
		Text @= ShortName(i) $ "=" $ IsOn(i);
	}
	return Text;
}

static function string ShortName(int Fix)
{
	switch (Fix)
	{
		case FIX_CRASH_CLEANUP:  return "crash";
		case FIX_HACK_ROUTING:   return "hack";
		case FIX_BOUND_SKIP:     return "bound";
		case FIX_VIP_HOST:       return "vip";
		case FIX_GUEST_BORDERS:  return "borders";
		case FIX_CAMERA:         return "camera";
		case FIX_REPLAY_VISUALS: return "replay visuals";
		case FIX_CAN_ACT:        return "can act";
		case FIX_PATH_HIDE:      return "path hide";
		case FIX_BANNER_IDLE:    return "banner idle";
		case FIX_SP_RULES:       return "sp rules";
		case FIX_GLOW:           return "glow";
		case FIX_WHEEL:          return "wheel";
		case FIX_PARTNER_LOOKAT: return "look-at";
		case FIX_ATTACHED_MOVES: return "attached";
		case FIX_STEP_ALL:       return "step all";
		case FIX_PARTNER_PAUSE:  return "pause wait";
		case FIX_HACK_NO_CLICK:  return "hack no click";
		case FIX_FLANK_CRIT:     return "flank";
		case FIX_SUPPRESSION:    return "suppression";
		case FIX_SKULLJACK:      return "skulljack";
		case FIX_FOG_REVEAL:     return "fog";
		case FIX_WATCHER_CAMERA: return "watcher camera";
		case FIX_INVITE_DIRECT:  return "invite direct";
		case FIX_TARGET_REFRESH: return "target refresh";
		case FIX_CATCH_UP:       return "catch up";
	}
	return "fix" $ Fix;
}

static function LogState(string Why)
{
	`log("Coop fixes (" $ Why $ "):" @ StateText(), , 'X2TC');
}
