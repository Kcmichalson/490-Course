# The Chosen on the partner's screen (read only, 2026-11-25)

**What Kc saw (0.8.5 Steam run, Haven retaliation):** on the partner, the
Chosen's teleport-in animation, opening taunt and name card don't play, and
neither do the voice taunts during the mission. All of them play on the host.
Reinforcement and X4-charge cutscenes do play on the partner, and the
partner can open the Chosen overview (top right) with the weaknesses and
strengths.

Everything below comes from reading the SDK (laptop SrcOrig). Both causes
are **guesses until tested**. The partner's 0.8.5 logs (on the PC) haven't
been checked yet.

## Cause 1: the reveal cinematic's maps aren't loaded on the partner (guess)
Covers the teleport-in reveal, the name card and the opening taunt.

- A Chosen's reveal cinematics are in extra maps named on its character
  template (`strMatineePackages`, e.g. "CIN_XP_ChosenAssassin";
  `X2Character_DefaultCharacters.uc` L4321, L4466-4467, L4611-4612).
- These maps are streamed in two ways:
  - At mission start, for units already on the map
    (`X2TacticalGameRuleset.uc` L1327-1363, `AddCharacterStreamingCinematicMaps`).
  - For a unit created mid-mission, by `XComGameState_Unit.PostCreateInit`
    calling `AddStreamingCinematicMaps` (`XComGameState_Unit.uc` L1282-1312,
    called at L1548).
- The Chosen arrive mid-mission as a special reinforcement
  (`ChosenSpecialTopDownReveal`, `XComGameState_AIReinforcementSpawner.uc`
  L124-127, L557-566). Only the host runs that game logic, so only the
  host's game streams the Chosen's cinematic maps. The partner receives the
  new unit through the history and never streams them.
- The reveal cinematic finds its matinee by the template's prefix
  (`X2Action_RevealAIBegin.uc` L515-539). The name card (`UIChosenReveal`)
  and the opening lines are started by events from inside that matinee:
  `CIN_ChosenRevealUIStart`, `CIN_ChosenRevealDialogueA/B`
  (`X2Action_RevealAIBegin.uc` L155-176). With no matinee there's no name
  card and no opening taunt.
- This fits the reinforcement and X4 cutscenes working, since they don't
  need character-specific maps.
- **Possible fix:** when the partner receives a history, stream the
  cinematic maps for every unit it hasn't streamed yet, as
  `AddStreamingCinematicMaps` does: `AddStreamingMap(MapName, , , false)`
  with `bForceNoDupe`. This only loads content and changes no game state.
  - **Risk:** streaming takes time. If the reveal frame is replayed before
    the map is loaded, it would still be skipped. A fallback is to stream
    the three Chosen maps when the partner's mission loads, if a Chosen can
    appear in it.
- **Not sure:** the teleport effect itself (`X2Action_PlayEffect` with
  `ChosenTeleportInEffectPathName`, L557-566) doesn't need those maps. If it
  still doesn't show after the fix, look at it separately.

## Cause 2: the taunts' lines aren't in what the partner receives (guess)
Covers the voice taunts during the mission. It also affects the opening
taunt's "ChosenEngaged" line.

- Dynamic narratives (the Chosen's taunts) are picked on the host, when a
  game event fires (`XComGameState_NarrativeManager.uc` L182-255,
  `TriggerDynamicNarrative`). The chosen lines are stored in
  `PendingNarrativeMoments` and `PendingNarrativeMomentTemplates`.
- Both fields are `transient` (L17-18), so they aren't sent with the
  history. On the partner, the visualization
  (`BuildVisualizationForDynamicNarrative`, L463-498) finds an empty list
  and adds no `X2Action_PlayNarrative`. The frame is still there, so nothing
  errors.
- The Chosen's "engaged" reveal uses the same list
  (`X2Ability_Chosen.uc` L1198, in `Engaged_BuildVisualization`), so its
  narrative line is lost the same way. The Chosen HUD update in that
  visualization doesn't depend on it, which fits the partner's overview
  working.
- **Possible fix:** the partner refills the two lists before each frame's
  visualization is built (the same pass where it already checks change
  containers, X2TC_CoopSession ~L2740).
  - **Which narrative fired:** compare the narrative manager's
    `PlayedThisTurn` / `PlayedThisMission` lists (not transient) with the
    previous state.
  - **Which line:** pick it with `GetNarrativeMomentToPlay` (L358-400),
    which works without the event data when the narrative has one line, and
    otherwise draws from the partner's own deck.
  - **Limit:** for narratives with several lines, the partner may hear a
    different line than the host. A narrative that plays twice in one turn
    can't be detected from the lists.
  - **Risk:** medium. It writes transient fields on a state object in the
    partner's history (visualization only; nothing is sent back), and the
    event data is missing.

## Evidence added 2026-11-26 (PC session)
- **Cause 1 is now supported by a log:** the partner's log for the 0.8.5
  retaliation (`m4-084-launch-4.log`) has `No matinees found for prefix
  CIN_ChosenHunter_Reveal`, plus the same warning for
  `CIN_Chosen_Extract`, `CIN_Chosen_GrenadeThrow`,
  `CIN_Advent_Priest_Male_Reveal` and `CIN_Faceless_*`. So the partner is
  also missing the cinematic maps of other units created mid-mission. There
  are no "Adding matinee map" lines.
- **Kc:** Bradford, Shen and Tygan lines play fine on the partner. Those
  are fixed objective narratives (the partner's frames include "Trigger
  Objective Narrative Moment" containers). So the partner can play
  narratives; it's the dynamic (transient-list) ones that are missing,
  which fits cause 2.

## Suggested order
1. Read the partner's 0.8.5 log for the retaliation mission. Look for:
   - "Adding matinee map" lines, which come from the game's own
     `X2TacticalGameRuleset` log;
   - redscreens about missing matinees;
   - frames named "Trigger Dynamic Narrative Moment".
2. Cause 1 first: it's small and covers the reveal, the name card and the
   opening taunt.
3. Cause 2 behind its own fix switch, time-boxed.
