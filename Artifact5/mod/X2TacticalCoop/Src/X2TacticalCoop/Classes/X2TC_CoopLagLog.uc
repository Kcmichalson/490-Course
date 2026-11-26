//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopLagLog
//
//  What it changes: nothing in the game. It times each history update the host sends to
//  the partner and writes one compact line per update on each PC, plus a summary at the
//  end of each alien turn, so a long mission shows which stage makes the partner's
//  screen fall behind.
//  no lag changes in 0.8.3, logging only -- Kc
//    - Host line (at the acknowledgment): wait (new frames ready -> send), build (the
//      native SendPartialHistory call), size, rtt (send end -> acknowledgment).
//    - Partner line: arrive (host send end -> the partner's history handler, in host
//      time), load (handler time minus this PC's last tick start; the native load runs in
//      that tick, so +-1 frame), transit (arrive - load), backlog (frames received but not
//      yet shown) and behind (how old, in host time, the oldest frame still playing on the
//      partner's screen is).
//  Times use the system clock in ms of the day, so a native call can be timed; the
//  partner's clock offset comes from small time pings (shortest round trip of the last
//  10 wins). The session (X2TC_CoopSession) calls in; the visual watcher's tick
//  (X2TC_CoopVisualWatcher) drives the partner's samples.
//    - The partner's sampler walks the tree from VisualizationTree through ChildActions
//      (X2Action.uc L32). GetNodesOfType(..., class'X2Action', ...) found no nodes, so
//      backlog/behind read 0 (guess: it matches the exact class only). Seconds print as
//      "1.25s", not float text like "0.0000s".
//    - Host "net" part of each H line (the ~210 KB/s cap): the history goes out in bunches
//      of about 600 bytes from the network manager's own tick (OutGameData, PendingState;
//      XComGameStateNetworkManager.uc L33-58, L65). Each host frame counts the bunches
//      still "not handled" (guess: not yet sent) and "sent" (guess: sent, not yet
//      acknowledged): bunches per frame avg/max, the most in flight, the host's frame time,
//      and how long the queue took to empty. Bunches per frame steady while frame time
//      changes = a per-tick quota; bunches per second steady = a rate limit.
//    - One "Coop net settings" line per session on each PC: the net drivers' rate settings
//      in effect, read with the read-only "get" command, and this player's net speeds
//      (Engine\Classes\Player.uc L15-16). Read only; nothing is set.
//    - The per-update H and G lines are Verbose log lines; the summaries always log.
//
//  Relies on (paths in Development\SrcOrig):
//    Core\Classes\Object.uc                          (GetSystemTime L2304)
//    XComGame\Classes\XComGameStateNetworkManager.uc (SendRemoteCommand, command params)
//    XComGame\Classes\XComGameStateVisualizationMgr.uc (VisualizationTree L117)
//    XComGame\Classes\X2Action.uc                    (ChildActions L32, CurrentHistoryIndex L34,
//                                                     bCompleted L55)
//    Engine\Classes\Actor.uc                         (ConsoleCommand L1699)
//---------------------------------------------------------------------------------------

class X2TC_CoopLagLog extends Object dependson(XComGameStateNetworkManager);

const CMD_UPDATE_INFO = "X2TC_UpdateInfo"; // host: the timing of the update it just sent
const CMD_TIME_PING = "X2TC_TimePing";     // partner: its clock (ms of the day)
const CMD_TIME_PONG = "X2TC_TimePong";     // host: the partner's clock back, then its own

const DAY_MS = 86400000;
const HALF_DAY_MS = 43200000;
const CLOCK_SAMPLES = 10;
const FIRST_TIME_PINGS = 5;     // once a second at first
const TIME_PING_SECONDS = 20;   // then every 20 s
const SAMPLE_MS = 250;          // the partner's screen is sampled 4 times a second
const OFFSET_LOG_CHANGE_MS = 20;
const KEEP_UPDATES = 40;
const MAX_TREE_NODES = 2000;    // the tree walk stops here (guard)

struct CoopClockSample
{
	var int RttMs;
	var int OffsetMs;
};

struct CoopUpdate
{
	var int Seq;
	var int ToFrames;      // the history's frame count once this update is in
	var int ReadyHostMs;   // host clock: when the first of its frames was ready to send
	var int SentHostMs;    // host clock: when the send call returned
	var int BuildMs;
	var int WaitMs;
	var int Bytes;
	var bool bAlien;
	var bool bHaveInfo;    // partner: the host's info command arrived
	var bool bArrived;     // partner: the history arrived
	var int ArriveLocalMs; // partner clock
	var int LoadMs;
	var bool bLogged;
};

struct CoopStat
{
	var int Count;
	var int Total;
	var int Peak;
};

// Host.
var int PendingSinceMs;
var array<CoopUpdate> HostUpdates;
var CoopStat HWait, HBuild, HRtt, HKB;

// Partner.
var array<CoopClockSample> ClockSamples;
var bool bHaveOffset;
var int OffsetMs;      // host clock = partner clock + OffsetMs
var int OffsetRttMs;
var int LoggedOffsetMs;
var int TimePingsSent;
var int LastTimePingSecond;
var array<CoopUpdate> GuestUpdates;
var int LastTickMs;
var int LastSampleMs;
var int LastBacklog;
var int LastBehindMs;  // -1 = unknown
var string LastOldestAction;
var bool bSummaryDue;  // an XCOM update came after alien ones; log once the screen catches up
var CoopStat GArrive, GLoad, GTransit, GBuild, GKB, GBacklog, GBehind;
var string PeakBehindAction;

// Host: the bunch queue while an update drains.
var bool bDrainActive;
var int DrainLastNotHandled;   // -1 = no sample yet
var int DrainTicks, DrainBunches, DrainPeak, WindowPeak, DrainFrameMs, DrainDoneMs, DrainStartMs, LastHostTickMs;
var bool bNetSettingsLogged;

// ---- Clock ----

function int NowMs()
{
	local int Yr, Mo, Dw, Dy, Hr, Mn, Sc, Ms;

	GetSystemTime(Yr, Mo, Dw, Dy, Hr, Mn, Sc, Ms);
	return ((Hr * 60 + Mn) * 60 + Sc) * 1000 + Ms;
}

// Later - Earlier, across midnight.
static function int DiffMs(int Later, int Earlier)
{
	local int D;

	D = Later - Earlier;
	if (D < -HALF_DAY_MS)
	{
		D += DAY_MS;
	}
	else if (D > HALF_DAY_MS)
	{
		D -= DAY_MS;
	}
	return D;
}

static function int WrapMs(int T)
{
	if (T < 0)
	{
		return T + DAY_MS;
	}
	if (T >= DAY_MS)
	{
		return T - DAY_MS;
	}
	return T;
}

static function AddStat(out CoopStat S, int Value)
{
	S.Count++;
	S.Total += Value;
	if (S.Count == 1 || Value > S.Peak)
	{
		S.Peak = Value;
	}
}

// "avg/max", or "-" with no samples.
static function string StatText(CoopStat S)
{
	if (S.Count == 0)
	{
		return "-";
	}
	return (S.Total / S.Count) $ "/" $ S.Peak;
}

// "1.25s" (float text printed as "0.0000s").
static function string SecondsText(int Ms)
{
	local int Hundredths;

	Hundredths = (Ms % 1000) / 10;
	return (Ms / 1000) $ "." $ (Hundredths < 10 ? "0" : "") $ Hundredths $ "s";
}

// ---- Host ----

// Called on every send check: remembers when new frames first waited to be sent.
function HostNotePending(bool bHasNew)
{
	if (bHasNew && PendingSinceMs < 0)
	{
		PendingSinceMs = NowMs();
	}
}

// After SendPartialHistory: records the update and builds the info command's params.
function HostSent(int Seq, int ToFrames, int Bytes, int StartMs, bool bAlien, out array<byte> Params)
{
	local CoopUpdate U;
	local int EndMs;

	EndMs = NowMs();
	// The first XCOM update after alien ones closes the alien turn (one update is in
	// flight at a time, so the alien ones are all acknowledged by now).
	if (!bAlien && HKB.Count > 0)
	{
		HostSummary();
	}
	U.Seq = Seq;
	U.ToFrames = ToFrames;
	U.Bytes = Bytes;
	U.bAlien = bAlien;
	U.BuildMs = DiffMs(EndMs, StartMs);
	U.ReadyHostMs = PendingSinceMs >= 0 ? PendingSinceMs : StartMs;
	U.WaitMs = Max(DiffMs(StartMs, U.ReadyHostMs), 0);
	U.SentHostMs = EndMs;
	PendingSinceMs = -1;
	// Count this update's bunches as they leave.
	bDrainActive = true;
	DrainLastNotHandled = -1;
	DrainTicks = 0; DrainBunches = 0; DrainPeak = 0; WindowPeak = 0; DrainFrameMs = 0; DrainDoneMs = -1;
	DrainStartMs = EndMs;
	LastHostTickMs = EndMs;
	if (!bNetSettingsLogged)
	{
		bNetSettingsLogged = true;
		LogNetSettings("host");
	}
	HostUpdates.AddItem(U);
	if (HostUpdates.Length > KEEP_UPDATES)
	{
		HostUpdates.Remove(0, HostUpdates.Length - KEEP_UPDATES);
	}
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Seq, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(ToFrames, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(U.ReadyHostMs, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(U.SentHostMs, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(U.BuildMs, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Bytes, Params);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(bAlien ? 1 : 0, Params);
}

// The partner acknowledged GuestFrames: the host line for that update.
function HostAcked(int GuestFrames)
{
	local int i, RttMs;
	local CoopUpdate U;

	for (i = 0; i < HostUpdates.Length; i++)
	{
		if (HostUpdates[i].ToFrames == GuestFrames)
		{
			break;
		}
	}
	if (i >= HostUpdates.Length)
	{
		return;
	}
	U = HostUpdates[i];
	HostUpdates.Remove(0, i + 1);
	RttMs = DiffMs(NowMs(), U.SentHostMs);
	if (class'X2TC_CoopFixes'.static.Verbose()) `log("Coop lag H #" $ U.Seq @ "f" $ U.ToFrames @ (U.bAlien ? "alien" : "xcom") @ (U.Bytes / 1024) $ "KB wait" @ U.WaitMs @ "build" @ U.BuildMs @ "rtt" @ RttMs @ "|" @ DrainText(), , 'X2TC');
	if (U.bAlien)
	{
		AddStat(HWait, U.WaitMs);
		AddStat(HBuild, U.BuildMs);
		AddStat(HRtt, RttMs);
		AddStat(HKB, U.Bytes / 1024);
	}
}

function HostSummary()
{
	`log("Coop lag summary H (alien turn): updates" @ HKB.Count @ "KB" @ HKB.Total @ "| avg/max ms: wait" @ StatText(HWait) @ "build" @ StatText(HBuild) @ "rtt" @ StatText(HRtt) @ "| KB" @ StatText(HKB), , 'X2TC');
	HWait.Count = 0; HWait.Total = 0; HWait.Peak = 0;
	HBuild.Count = 0; HBuild.Total = 0; HBuild.Peak = 0;
	HRtt.Count = 0; HRtt.Total = 0; HRtt.Peak = 0;
	HKB.Count = 0; HKB.Total = 0; HKB.Peak = 0;
}

// Host: from the visual watcher's tick. Counts the bunches that left since the last
// frame while an update drains.
function HostTick()
{
	local XComGameStateNetworkManager NetworkMgr;
	local int i, NotHandled, InFlight, Now, Left;

	if (!bDrainActive)
	{
		return;
	}
	NetworkMgr = `XCOMNETMANAGER;
	if (NetworkMgr == none)
	{
		return;
	}
	for (i = 0; i < NetworkMgr.OutGameData.Length; i++)
	{
		if (NetworkMgr.OutGameData[i].PendingState == ePDS_NotHandled)
		{
			NotHandled++;
		}
		else if (NetworkMgr.OutGameData[i].PendingState == ePDS_Sent)
		{
			InFlight++;
		}
	}
	Now = NowMs();
	if (DrainLastNotHandled >= 0)
	{
		Left = Max(DrainLastNotHandled - NotHandled, 0);
		DrainTicks++;
		DrainBunches += Left;
		DrainPeak = Max(DrainPeak, Left);
		DrainFrameMs += Max(DiffMs(Now, LastHostTickMs), 0);
	}
	WindowPeak = Max(WindowPeak, InFlight);
	DrainLastNotHandled = NotHandled;
	LastHostTickMs = Now;
	if (NotHandled == 0 && DrainTicks > 0)
	{
		// Queue empty: keep the numbers for the H line at the acknowledgment.
		bDrainActive = false;
		DrainDoneMs = DiffMs(Now, DrainStartMs);
	}
}

// "net 96b/14f per frame 7/10 in flight 40 frame 16ms empty 520ms".
function string DrainText()
{
	if (DrainTicks == 0)
	{
		return "net -";
	}
	return "net" @ DrainBunches $ "b/" $ DrainTicks $ "f per frame" @ (DrainBunches / DrainTicks) $ "/" $ DrainPeak
		@ "in flight" @ WindowPeak @ "frame" @ (DrainFrameMs / DrainTicks) $ "ms empty" @ (DrainDoneMs >= 0 ? string(DrainDoneMs) $ "ms" : "no");
}

// The rate settings in effect on this PC, read only ("get" changes nothing), once
// per session.
function LogNetSettings(string Who)
{
	local PlayerController PC;
	local string Text;

	PC = class'WorldInfo'.static.GetWorldInfo().GetALocalPlayerController();
	if (PC == none)
	{
		return;
	}
	Text = "tcp:" @ GetSetting(PC, "IpDrv.TcpNetDriver");
	Text @= "| steam:" @ GetSetting(PC, "OnlineSubsystemSteamworks.IpNetDriverSteamworks");
	if (PC.Player != none)
	{
		Text @= "| player: current" @ PC.Player.CurrentNetSpeed @ "lan" @ PC.Player.ConfiguredLanSpeed @ "internet" @ PC.Player.ConfiguredInternetSpeed;
	}
	`log("Coop net settings (" $ Who $ "):" @ Text, , 'X2TC');
}

// One line (the answers end in line breaks), and no LanServerMaxTickRate ("Unrecognized
// property" in this build).
static function string GetSetting(PlayerController LocalPC, string DriverClass)
{
	return "max client" @ OneLine(LocalPC.ConsoleCommand("get" @ DriverClass @ "MaxClientRate", false))
		@ "max internet" @ OneLine(LocalPC.ConsoleCommand("get" @ DriverClass @ "MaxInternetClientRate", false))
		@ "tick" @ OneLine(LocalPC.ConsoleCommand("get" @ DriverClass @ "NetServerMaxTickRate", false));
}

static function string OneLine(string Text)
{
	return Repl(Repl(Text, Chr(13), ""), Chr(10), "");
}

// The partner's time ping: answer with its clock and this PC's.
function HostAnswerTimePing(array<byte> RawParams)
{
	local array<byte> Params, Reply;

	Params = RawParams;
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params), Reply);
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(NowMs(), Reply);
	`XCOMNETMANAGER.SendRemoteCommand(CMD_TIME_PONG, Reply);
}

// ---- Partner ----

// From the session's once-a-second poll.
function GuestMaybeTimePing(int Seconds)
{
	local array<byte> Params;

	if (TimePingsSent > 0 && Seconds == LastTimePingSecond)
	{
		return;
	}
	if (TimePingsSent >= FIRST_TIME_PINGS && Seconds - LastTimePingSecond < TIME_PING_SECONDS)
	{
		return;
	}
	TimePingsSent++;
	LastTimePingSecond = Seconds;
	class'XComGameStateNetworkManager'.static.AddCommandParam_Int(NowMs(), Params);
	`XCOMNETMANAGER.SendRemoteCommand(CMD_TIME_PING, Params);
}

function GuestOnTimePong(array<byte> RawParams)
{
	local array<byte> Params;
	local CoopClockSample NewSample;
	local int SentMs, HostMs, i, Best;

	Params = RawParams;
	SentMs = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	HostMs = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	NewSample.RttMs = Max(DiffMs(NowMs(), SentMs), 0);
	// Host clock at the moment halfway through the round trip.
	NewSample.OffsetMs = DiffMs(HostMs, WrapMs(SentMs + NewSample.RttMs / 2));
	ClockSamples.AddItem(NewSample);
	if (ClockSamples.Length > CLOCK_SAMPLES)
	{
		ClockSamples.Remove(0, ClockSamples.Length - CLOCK_SAMPLES);
	}
	Best = 0;
	for (i = 1; i < ClockSamples.Length; i++)
	{
		if (ClockSamples[i].RttMs < ClockSamples[Best].RttMs)
		{
			Best = i;
		}
	}
	OffsetMs = ClockSamples[Best].OffsetMs;
	OffsetRttMs = ClockSamples[Best].RttMs;
	if (!bHaveOffset || Abs(OffsetMs - LoggedOffsetMs) > OFFSET_LOG_CHANGE_MS)
	{
		`log("Coop lag clock: host = this PC" @ (OffsetMs >= 0 ? "+" : "") $ OffsetMs @ "ms (ping rtt" @ OffsetRttMs @ "ms, best of" @ ClockSamples.Length $ ")", , 'X2TC');
		LoggedOffsetMs = OffsetMs;
	}
	bHaveOffset = true;
}

// From the visual watcher's tick (partner only).
function GuestTick()
{
	LastTickMs = NowMs();
	if (LastSampleMs == 0 || DiffMs(LastTickMs, LastSampleMs) >= SAMPLE_MS)
	{
		LastSampleMs = LastTickMs;
		Sample();
	}
}

function int FindGuestUpdate(int ToFrames)
{
	local int i;

	for (i = 0; i < GuestUpdates.Length; i++)
	{
		if (GuestUpdates[i].ToFrames == ToFrames && !GuestUpdates[i].bLogged)
		{
			return i;
		}
	}
	return -1;
}

// The partial history is in this PC's history (Frames = its frame count now).
function GuestHistoryArrived(int Frames)
{
	local int i, Now;
	local CoopUpdate U;

	Now = NowMs();
	i = FindGuestUpdate(Frames);
	if (i < 0)
	{
		U.ToFrames = Frames;
		GuestUpdates.AddItem(U);
		i = GuestUpdates.Length - 1;
	}
	GuestUpdates[i].bArrived = true;
	GuestUpdates[i].ArriveLocalMs = Now;
	GuestUpdates[i].LoadMs = LastTickMs > 0 ? Max(DiffMs(Now, LastTickMs), 0) : -1;
	TryLogUpdate(i);
}

// The host's info command for an update.
function GuestUpdateInfo(array<byte> RawParams)
{
	local array<byte> Params;
	local CoopUpdate Info;
	local int i;

	Params = RawParams;
	Info.Seq = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	Info.ToFrames = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	Info.ReadyHostMs = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	Info.SentHostMs = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	Info.BuildMs = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	Info.Bytes = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	Info.bAlien = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params) != 0;
	i = FindGuestUpdate(Info.ToFrames);
	if (i < 0)
	{
		GuestUpdates.AddItem(Info);
		i = GuestUpdates.Length - 1;
	}
	else
	{
		GuestUpdates[i].Seq = Info.Seq;
		GuestUpdates[i].ReadyHostMs = Info.ReadyHostMs;
		GuestUpdates[i].SentHostMs = Info.SentHostMs;
		GuestUpdates[i].BuildMs = Info.BuildMs;
		GuestUpdates[i].Bytes = Info.Bytes;
		GuestUpdates[i].bAlien = Info.bAlien;
	}
	GuestUpdates[i].bHaveInfo = true;
	TryLogUpdate(i);
}

function TryLogUpdate(int i)
{
	local CoopUpdate U;
	local int ArriveMs, TransitMs;
	local string ArriveText, TransitText, BehindText;

	U = GuestUpdates[i];
	if (!U.bArrived || !U.bHaveInfo || U.bLogged)
	{
		return;
	}
	GuestUpdates[i].bLogged = true;
	if (!bNetSettingsLogged)
	{
		bNetSettingsLogged = true;
		LogNetSettings("partner");
	}
	// A new alien turn closes the last one if its summary is still waiting.
	if (U.bAlien && bSummaryDue)
	{
		GuestSummary();
	}
	Sample();
	ArriveText = "?";
	TransitText = "?";
	if (bHaveOffset)
	{
		ArriveMs = DiffMs(WrapMs(U.ArriveLocalMs + OffsetMs), U.SentHostMs);
		ArriveText = string(ArriveMs);
		if (U.LoadMs >= 0)
		{
			TransitMs = ArriveMs - U.LoadMs;
			TransitText = string(TransitMs);
		}
	}
	BehindText = LastBehindMs >= 0 ? SecondsText(LastBehindMs) : "?";
	if (class'X2TC_CoopFixes'.static.Verbose()) `log("Coop lag G #" $ U.Seq @ "f" $ U.ToFrames @ (U.bAlien ? "alien" : "xcom") @ (U.Bytes / 1024) $ "KB build" @ U.BuildMs @ "arrive" @ ArriveText @ "load" @ U.LoadMs @ "transit" @ TransitText @ "backlog" @ LastBacklog @ "behind" @ BehindText $ ((LastBehindMs > 5000 && LastOldestAction != "") ? " oldest" @ LastOldestAction : ""), , 'X2TC'); // the oldest action when > 5 s behind
	if (U.bAlien)
	{
		AddStat(GBuild, U.BuildMs);
		AddStat(GKB, U.Bytes / 1024);
		if (U.LoadMs >= 0)
		{
			AddStat(GLoad, U.LoadMs);
		}
		if (bHaveOffset)
		{
			AddStat(GArrive, ArriveMs);
			if (U.LoadMs >= 0)
			{
				AddStat(GTransit, TransitMs);
			}
		}
	}
	else if (GKB.Count > 0)
	{
		bSummaryDue = true;
	}
}

// The oldest history frame still playing on this PC's screen, or -1 if nothing plays.
// Walks the tree from its root through ChildActions (GetNodesOfType found no nodes).
function int OldestPlayingFrame(out string ActionName)
{
	local XComGameStateVisualizationMgr VisMgr;
	local array<X2Action> Nodes;
	local X2Action Node;
	local int i, j, Oldest;

	ActionName = "";
	VisMgr = `XCOMVISUALIZATIONMGR;
	if (VisMgr == none || VisMgr.VisualizationTree == none)
	{
		return -1;
	}
	Nodes.AddItem(VisMgr.VisualizationTree);
	Oldest = -1;
	for (i = 0; i < Nodes.Length && i < MAX_TREE_NODES; i++)
	{
		Node = Nodes[i];
		if (Node == none)
		{
			continue;
		}
		if (!Node.bCompleted && Node.CurrentHistoryIndex > 0 && (Oldest < 0 || Node.CurrentHistoryIndex < Oldest))
		{
			Oldest = Node.CurrentHistoryIndex;
			ActionName = string(Node.Class.Name);
		}
		for (j = 0; j < Node.ChildActions.Length; j++)
		{
			if (Node.ChildActions[j] != none && Nodes.Find(Node.ChildActions[j]) == INDEX_NONE)
			{
				Nodes.AddItem(Node.ChildActions[j]);
			}
		}
	}
	return Oldest;
}

// Backlog and behind now; drops updates already shown.
function Sample()
{
	local int Oldest, Frames, i;
	local string ActionName;

	Frames = `XCOMHISTORY.GetNumGameStates();
	Oldest = OldestPlayingFrame(ActionName);
	if (Oldest < 0)
	{
		LastBacklog = 0;
		LastBehindMs = 0;
		LastOldestAction = "";
		// Everything received has played.
		for (i = GuestUpdates.Length - 1; i >= 0; i--)
		{
			if (GuestUpdates[i].bLogged)
			{
				GuestUpdates.Remove(i, 1);
			}
		}
	}
	else
	{
		LastBacklog = Max(Frames - Oldest, 0);
		LastOldestAction = ActionName;
		// Updates whose frames are all before the oldest playing frame have been shown.
		while (GuestUpdates.Length > 0 && GuestUpdates[0].bLogged && GuestUpdates[0].ToFrames <= Oldest)
		{
			GuestUpdates.Remove(0, 1);
		}
		LastBehindMs = -1;
		if (bHaveOffset)
		{
			for (i = 0; i < GuestUpdates.Length; i++)
			{
				if (GuestUpdates[i].bHaveInfo && GuestUpdates[i].ToFrames > Oldest)
				{
					LastBehindMs = Max(DiffMs(WrapMs(NowMs() + OffsetMs), GuestUpdates[i].ReadyHostMs), 0);
					break;
				}
			}
		}
	}
	if (GuestUpdates.Length > KEEP_UPDATES)
	{
		GuestUpdates.Remove(0, GuestUpdates.Length - KEEP_UPDATES);
	}
	// Alien-turn statistics, while an alien turn is being collected.
	if (GKB.Count > 0)
	{
		AddStat(GBacklog, LastBacklog);
		if (LastBehindMs >= 0)
		{
			if (GBehind.Count == 0 || LastBehindMs > GBehind.Peak)
			{
				PeakBehindAction = LastOldestAction;
			}
			AddStat(GBehind, LastBehindMs);
		}
	}
	if (bSummaryDue && LastBacklog == 0)
	{
		GuestSummary();
	}
	// The game's fast mode while the partner is behind (X2TC_CoopCatchUp).
	class'X2TC_CoopCatchUp'.static.Update(LastBehindMs, LastOldestAction);
}

function GuestSummary()
{
	bSummaryDue = false;
	if (GKB.Count == 0)
	{
		return;
	}
	`log("Coop lag summary G (alien turn): updates" @ GKB.Count @ "KB" @ GKB.Total @ "| avg/max ms: build" @ StatText(GBuild) @ "arrive" @ StatText(GArrive) @ "load" @ StatText(GLoad) @ "transit" @ StatText(GTransit) @ "| backlog" @ StatText(GBacklog) @ "| behind" @ StatText(GBehind) @ "(at max:" @ (PeakBehindAction != "" ? PeakBehindAction : "-") $ ")", , 'X2TC');
	GArrive.Count = 0; GArrive.Total = 0; GArrive.Peak = 0;
	GLoad.Count = 0; GLoad.Total = 0; GLoad.Peak = 0;
	GTransit.Count = 0; GTransit.Total = 0; GTransit.Peak = 0;
	GBuild.Count = 0; GBuild.Total = 0; GBuild.Peak = 0;
	GKB.Count = 0; GKB.Total = 0; GKB.Peak = 0;
	GBacklog.Count = 0; GBacklog.Total = 0; GBacklog.Peak = 0;
	GBehind.Count = 0; GBehind.Total = 0; GBehind.Peak = 0;
	PeakBehindAction = "";
}

defaultproperties
{
	PendingSinceMs = -1
	LastBehindMs = -1
}
