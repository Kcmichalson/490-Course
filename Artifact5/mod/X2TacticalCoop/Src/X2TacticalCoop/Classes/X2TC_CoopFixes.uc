//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopFixes
//
//  What it changes: nothing by itself. It holds the on/off switches for the 0.8.x fixes
//  (plans/m4-plan.md, "On-screen toggles"), so each fix can be turned off on one machine
//  if it misbehaves:
//    - one switch per fix, all on at every launch;
//    - SAFE MODE, which turns every fix off at once.
//  Switches belong to this machine only (each machine's fixes read its own) and last
//  until the game is closed. They are class defaults changed at run time, which
//  UnrealScript allows only on config variables, so they are config variables this mod
//  NEVER saves (no SaveConfig anywhere); no ini file is written. Class defaults live for
//  the whole game, so the switches survive map loads.
//  0.8.0b: each variable stores "off" (false = the fix runs), because config defaults
//  weren't applied in 0.8.0 Run 1 (all switches started off).
//  0.8.1: fix D (the fresh pathing pawn) is gone (Kc: it only changed a highlight's
//  colour in 0.8.0b Run 2); nine new switches.
//  Also holds one camera diagnostic flag (CameraOverrideRan).
//
//  Relies on (paths in Development\SrcOrig): nothing beyond Core\Classes\Object.uc.
//---------------------------------------------------------------------------------------

class X2TC_CoopFixes extends Object config(X2TacticalCoopFixes);

const FIX_CRASH_CLEANUP = 0;   // release the network manager's data before a map unloads
const FIX_HACK_ROUTING = 1;    // hacks: the starter controls, the other watches; result held (0.8.1)
const FIX_BOUND_SKIP = 2;      // the guest's cycling skips soldiers that can't act
const FIX_VIP_HOST = 3;        // VIPs, civilians and other non-soldiers count as the host's
const FIX_GUEST_BORDERS = 4;   // the guest's move range and cover icons (tutorial flag)
const FIX_CAMERA = 5;          // the follow camera while connected (class override)
const FIX_REPLAY_VISUALS = 6;  // 0.8.0b: the guest drops visuals it can't build (noise alert crash)
const FIX_CAN_ACT = 7;         // 0.8.1: "can act" uses the game's own rule (bound, panicked)
const FIX_PATH_HIDE = 8;       // 0.8.1: the guest hides its path preview when its input turns off
const FIX_BANNER_IDLE = 9;     // 0.8.1: "out of moves" banner only once the last action has played
const FIX_SP_RULES = 10;       // 0.8.1: single-player rules while connected (abilities, pause)
const FIX_GLOW = 11;           // 0.8.1: no tutorial glow on the guest's ability icons
const FIX_WHEEL = 12;          // 0.8.1: mouse wheel changes floors on the guest
const FIX_PARTNER_LOOKAT = 13; // 0.8.1: the host's camera looks at the guest's non-move abilities
const FIX_ATTACHED_MOVES = 14; // 0.8.1: the guest's SPARK BIT / Gremlin follow its moves
const FIX_STEP_ALL = 15;       // 0.8.1: the guest replays all pending frames at once outside XCOM's turn
const FIX_COUNT = 16;

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
var config bool bCameraOverrideRan; // diagnostics: X2TC_Action_CameraFollowUnit has run this launch

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
		case FIX_CRASH_CLEANUP:  return "Crash cleanup (leaving a map)";
		case FIX_HACK_ROUTING:   return "Hacks: starter controls, partner watches";
		case FIX_BOUND_SKIP:     return "Partner skips soldiers that can't act";
		case FIX_VIP_HOST:       return "VIPs and civilians count as the host's";
		case FIX_GUEST_BORDERS:  return "Partner's move range and cover icons";
		case FIX_CAMERA:         return "Camera follows moves while connected";
		case FIX_REPLAY_VISUALS: return "Partner skips visuals it can't build";
		case FIX_CAN_ACT:        return "Can-act check uses the game's rule";
		case FIX_PATH_HIDE:      return "Partner hides path preview while moving";
		case FIX_BANNER_IDLE:    return "Banner waits for the last action";
		case FIX_SP_RULES:       return "Single-player rules while connected";
		case FIX_GLOW:           return "Partner: no glow on ability icons";
		case FIX_WHEEL:          return "Partner: mouse wheel changes floors";
		case FIX_PARTNER_LOOKAT: return "Host camera looks at partner's actions";
		case FIX_ATTACHED_MOVES: return "BIT and Gremlin follow partner's moves";
		case FIX_STEP_ALL:       return "Partner: faster enemy turns";
	}
	return "unknown fix" @ Fix;
}

// "safe mode=False crash=True ...": what actually runs.
static function string StateText()
{
	local string Text;
	local int i;

	Text = "safe mode=" $ default.bSafeMode;
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
	}
	return "fix" $ Fix;
}

static function LogState(string Why)
{
	`log("Coop fixes (" $ Why $ "):" @ StateText(), , 'X2TC');
}
