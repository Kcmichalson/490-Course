//---------------------------------------------------------------------------------------
//  X2TacticalCoop: X2TC_CoopNarrativeSync
//
//  What it changes (0.8.9, research/chosen-partner.md, causes 1 and 2):
//  1. Partner: streams the cinematic maps of units it hasn't seen yet, as the host's
//     game does for a unit created mid-mission. Without them the Chosen's reveal
//     (teleport, name card, opening taunt) has no matinee ("No matinees found for
//     prefix CIN_ChosenHunter_Reveal" in the 0.8.5 partner log). Chosen maps load
//     blocking, so they're there before the reveal frame replays.
//  2. Host: names each dynamic narrative (Chosen taunts) it picked, by frame. Partner:
//     puts the same line back into that frame's narrative manager, whose lists are
//     transient and so never arrive with the history. The game's own visualization
//     then plays it.
//  Owned by X2TC_CoopSession (one per session). Visualization-only on the partner;
//  nothing is sent back.
//
//  Relies on (paths in Development\SrcOrig):
//    XComGame\Classes\XComGameState_Unit.uc        (AddStreamingCinematicMaps L1282-1312)
//    XComGame\Classes\XComGameState_NarrativeManager.uc (PendingNarrativeMoments and
//                                                   PendingNarrativeMomentTemplates L17-18,
//                                                   filled at L246-247, read at L463-498)
//    XComGame\Classes\X2DynamicNarrativeTemplateManager.uc (FindDynamicNarrativeTemplate L19)
//    XComGame\Classes\X2CharacterTemplate.uc       (bIsChosen L88, strMatineePackages L141)
//    XComGame\Classes\XComMapManager.uc            (AddStreamingMap L192)
//---------------------------------------------------------------------------------------

class X2TC_CoopNarrativeSync extends Object;

const CMD_NARRATIVE = "X2TC_Narrative"; // host: frame, count, then path and template name per line

var array<int> StreamedUnitIDs;   // partner: units whose cinematic maps were streamed

// Partner: lines named by the host, not yet put into their frame.
var array<int> PendingFrames;
var array<string> PendingPaths;
var array<string> PendingTemplates;
var int LinesApplied;

// Partner: stream the cinematic maps of every unit not streamed yet.
function StreamNewUnits()
{
	local XComGameState_Unit Unit;
	local X2CharacterTemplate Template;
	local string MapName;
	local LevelStreaming Level;

	foreach `XCOMHISTORY.IterateByClassType(class'XComGameState_Unit', Unit)
	{
		if (StreamedUnitIDs.Find(Unit.ObjectID) != INDEX_NONE)
		{
			continue;
		}
		StreamedUnitIDs.AddItem(Unit.ObjectID);
		Template = Unit.GetMyTemplate();
		if (Template == none)
		{
			continue;
		}
		foreach Template.strMatineePackages(MapName)
		{
			if (MapName == "")
			{
				continue;
			}
			Level = `MAPS.AddStreamingMap(MapName, , , Template.bIsChosen);
			if (Level != none)
			{
				Level.bForceNoDupe = true;
			}
			if (Template.bIsChosen)
			{
				`log("Coop narrative: cinematic map" @ MapName @ "streamed for unit" @ Unit.ObjectID @ "(" $ Template.DataName $ ")", , 'X2TC');
			}
		}
	}
}

// Host: send the dynamic narrative lines picked in frames [FromFrame, ToFrame], before
// the frames themselves.
static function HostSendLines(int FromFrame, int ToFrame)
{
	local XComGameStateHistory History;
	local XComGameState GameState;
	local XComGameState_NarrativeManager NarrativeMgr;
	local array<byte> Params;
	local int Frame, i;

	History = `XCOMHISTORY;
	for (Frame = Max(FromFrame, 0); Frame <= ToFrame && Frame < History.GetNumGameStates(); Frame++)
	{
		GameState = History.GetGameStateFromHistory(Frame);
		if (GameState == none)
		{
			continue;
		}
		foreach GameState.IterateByClassType(class'XComGameState_NarrativeManager', NarrativeMgr)
		{
			if (NarrativeMgr.PendingNarrativeMoments.Length == 0)
			{
				continue;
			}
			Params.Length = 0;
			class'XComGameStateNetworkManager'.static.AddCommandParam_Int(Frame, Params);
			class'XComGameStateNetworkManager'.static.AddCommandParam_Int(NarrativeMgr.PendingNarrativeMoments.Length, Params);
			for (i = 0; i < NarrativeMgr.PendingNarrativeMoments.Length; i++)
			{
				class'XComGameStateNetworkManager'.static.AddCommandParam_String((NarrativeMgr.PendingNarrativeMoments[i] != none) ? PathName(NarrativeMgr.PendingNarrativeMoments[i]) : "", Params);
				class'XComGameStateNetworkManager'.static.AddCommandParam_String((i < NarrativeMgr.PendingNarrativeMomentTemplates.Length && NarrativeMgr.PendingNarrativeMomentTemplates[i] != none) ? string(NarrativeMgr.PendingNarrativeMomentTemplates[i].DataName) : "", Params);
			}
			`XCOMNETMANAGER.SendRemoteCommand(CMD_NARRATIVE, Params);
			`log("Coop narrative (host): frame" @ Frame @ "has" @ NarrativeMgr.PendingNarrativeMoments.Length @ "dynamic line(s); named to the partner", , 'X2TC');
		}
	}
}

// Partner: the host's command. Lines for frames already here are applied at once.
function ReceiveLines(array<byte> RawParams)
{
	local array<byte> Params;
	local int Frame, Count, i;

	Params = RawParams;
	Frame = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	Count = class'XComGameStateNetworkManager'.static.GetCommandParam_Int(Params);
	for (i = 0; i < Count; i++)
	{
		PendingFrames.AddItem(Frame);
		PendingPaths.AddItem(class'XComGameStateNetworkManager'.static.GetCommandParam_String(Params));
		PendingTemplates.AddItem(class'XComGameStateNetworkManager'.static.GetCommandParam_String(Params));
	}
	ApplyLines();
}

// Partner: put each pending line into its frame's narrative manager, once the frame
// is in the history. Call before the follower replays new frames.
function ApplyLines()
{
	local XComGameStateHistory History;
	local XComGameState GameState;
	local XComGameState_NarrativeManager NarrativeMgr;
	local XComNarrativeMoment Moment;
	local X2DynamicNarrativeMomentTemplate Template;
	local int i;

	History = `XCOMHISTORY;
	for (i = PendingFrames.Length - 1; i >= 0; i--)
	{
		if (PendingFrames[i] >= History.GetNumGameStates())
		{
			continue; // not here yet
		}
		GameState = History.GetGameStateFromHistory(PendingFrames[i]);
		Moment = (PendingPaths[i] != "") ? XComNarrativeMoment(DynamicLoadObject(PendingPaths[i], class'XComNarrativeMoment')) : none;
		Template = X2DynamicNarrativeMomentTemplate(class'X2DynamicNarrativeTemplateManager'.static.GetDynamicNarrativeTemplateManager().FindDynamicNarrativeTemplate(name(PendingTemplates[i])));
		if (GameState != none && Moment != none && Template != none)
		{
			foreach GameState.IterateByClassType(class'XComGameState_NarrativeManager', NarrativeMgr)
			{
				// Added at the front, since the host's lines are walked from the end.
				NarrativeMgr.PendingNarrativeMoments.InsertItem(0, Moment);
				NarrativeMgr.PendingNarrativeMomentTemplates.InsertItem(0, Template);
				LinesApplied++;
				`log("Coop narrative (partner): frame" @ PendingFrames[i] @ "line" @ PendingPaths[i] @ "(" $ PendingTemplates[i] $ ") put back; applied so far" @ LinesApplied, , 'X2TC');
				break;
			}
		}
		else
		{
			`log("Coop narrative (partner): frame" @ PendingFrames[i] @ "line" @ PendingPaths[i] @ "(" $ PendingTemplates[i] $ ") not applied: frame=" $ (GameState != none) @ "moment=" $ (Moment != none) @ "template=" $ (Template != none), , 'X2TC');
		}
		PendingFrames.Remove(i, 1);
		PendingPaths.Remove(i, 1);
		PendingTemplates.Remove(i, 1);
	}
}
