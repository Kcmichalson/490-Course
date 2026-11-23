# M4 plan: toward a release (0.8.0, 0.8.1, then 1.0)

Approved by Kc on 2026-11-20 ("Save the plan as plans/m4-plan.md and go
ahead"), with the answers below. SPEC.md's M4 was rewritten to this scope
the same day.

## Schedule (Kc, rough)
| When | What |
|---|---|
| ~Nov 24 | 0.8.0 tested (checklists/m4-080.md) |
| ~Nov 29 | 0.8.1 tested |
| ~Dec 1-3 | release candidate; friend playtest |
| by ~Dec 3 | release name decided (release/release-checklist.md) |
| by Dec 6 | 1.0 published on the Workshop |
| Dec 7 | show and tell (SPEC.md) |

## Kc's answers (2026-11-20)
1. Camera: the class override `X2TC_Action_CameraFollowUnit` is approved
   behind its switch, with diagnostics. The release's compatibility notes
   name it.
2. SPEC.md M4 rewritten to this scope; the same-turn check moves into the
   checklist.
3. Release name decided by about Dec 3. Code keeps X2TacticalCoop / X2TC.
   Release drafts use `{{DECIDED_MOD_NAME}}`.
4. Alien Hunters Highlander: its own readme says it's required if you own
   Alien Hunters and must not be used without it
   (`local/refs/X2WOTCCommunityHighlander/Components/DLC2CommunityHighlander/DLC2CommunityHighlander/ReadMe.txt`
   L5-7). Friend setup written that way.
5. Code first, then the release drafts.
6. Fix D stays as a switch. The checklist tests the borders and cover icons
   with fix D on and off; if they work with it off, fix D goes in 0.8.1.
   Log any other tutorial behaviour the flag switches on.
7. Nothing may change normal single-player or the tutorial. CO-OP: HOST is
   refused in the tutorial mission with a short message. The checklist has
   a solo tutorial test (low priority).

## Research (SDK, with the Community Highlander's copies checked)
| Item | Cause | Source |
|---|---|---|
| Crash leaving a map | The network manager keeps every sent and received context in `ContextHistory`; only the native `ResetConnectionData()` clears it. Stock MP resets or disconnects in `OnCleanupWorld`; the single-player ruleset doesn't. Our mod only called `Disconnect()`, and not at all when the guest left and the host played on | `XComGameStateNetworkManager.uc` L65-73, L254-255; `X2TacticalMPGameRuleset.uc` L105-138; `X2GameRuleset.uc` L237-242 |
| Hack screen on both | The hack action is added on every machine that controls the hacker's team; the reward is read from the hack screen on the applying machine | `X2Ability_DefaultAbilitySet.uc` L1787-1800, L1898-1902 (Highlander L1820, L1931-1935) |
| No Cancel on the guest | `CanCancel()` is false in any replay | `UIHackingScreen.uc` L159-162 (Highlander L226-229) |
| Bound soldier selectable | Guest cycling didn't check "can act" | `X2TC_CoopReplayMgr.uc` `SelectGuestUnit` |
| Banner with a VIP | "Host has actions" counted only soldiers | `X2TC_CoopOwnership.uc` `PlayerHasActions` |
| No range or cover icons | In tutorial mode the move input hides path, borders and cover icons unless `bIsTutorialAllowingControls` | `XComTacticalInput.uc` L1905-1925 (Highlander L1955-1956); `XComTutorialMgr.uc` L43, L614, L628 |
| No detection tiles (0.8.1) | They fade out when the rules' unit-action team isn't XCOM, which in the replay it never is | `XComPathingPawn.uc` L254-265 |
| Camera (guess) | Follow camera skipped when `IsMultiPlayerGame()` is true | `X2Action_CameraFollowUnit.uc` L47-61 |
| Campaign results | Nothing in mission end or the return to strategy checks the network or MP flags | `X2TacticalGameRuleset.uc` L225-294, L5165-5304 |

## 0.8.0 (written 2026-11-20)
Every fix has a switch on CO-OP: FIXES (both HUDs, this machine only, not
saved). SAFE MODE turns all 0.8.0 fixes off; fix D keeps its own switch.
1. **Crash cleanup.** `ReleaseNetworkData`: `ResetConnectionData()` (after
   `Disconnect()` where asked), logging `ContextHistory.Length` before and
   after. Runs when the guest leaves (host), at mission end, on LEAVE, and
   from `X2TC_CoopMapCleanup` (an actor subscribed to `OnCleanupWorld`,
   spawned at HOST and when the guest's follower is installed). Delegates
   stay registered: they point at the session object, not the map.
2. **Hack routing** (`X2TC_CoopHackListener`, a screen listener):
   - The hack screen stays only on the machine of the hacking soldier's
     owner. The other copy is hidden and takes no input.
   - On the guest's own hack, its FinalizeHack / CancelHack is captured
     and sent as a choice (`X2TC_HackChoice`: option 1-2 or 0 = cancel).
     The host sets the option on its hidden copy and runs the screen's
     own InitiateHack / OnCancel, so the host's game rolls. When the
     hidden screen shows its result, the host ends it.
   - The guest gets a CO-OP: CANCEL HACK button.
   - On the host's hacks, the guest ends its hidden copy after 0.5 s.
   - Known gap: the guest's own screen shows a result its game never
     rolled, so it may say success when the host's roll failed (0.8.1).
3. **Bound skip.** The guest's cycling skips soldiers that can't act.
4. **VIPs and civilians.** Non-soldier XCOM units count as the host's for
   "host has actions", the host's selection and Tab/H.
5. **Guest borders and cover icons.** The follower turns
   `bIsTutorialAllowingControls` on while the guest's input is on and its
   selected soldier can act, off otherwise; every change is logged.
6. **Camera.** `X2TC_Action_CameraFollowUnit` (class override, in
   Config/XComEngine.ini). Inside a co-op session with the switch on, it
   ignores the multiplayer branch; otherwise it returns the stock answer.
   `IsMultiPlayerGame()` and the net mode are logged at HOST and JOIN.
7. **Tutorial.** HOST and HOST (STEAM) are refused when the replay manager
   is `XComTutorialMgr` (the campaign tutorial).
8. **Version** 0.8.0.

## Tests (checklists/m4-080.md)
Rocket with co-op off; a campaign mission (save backed up, Ironman off);
Stage 6 Run 3's untested items; the same-turn check from SPEC.md; three
missions in a row for the crash; each fix with its switch on and off;
SAFE MODE; borders with fix D on and off; the solo tutorial (low
priority); a short friend session over Steam.

## Results

**0.8.0 Run 1 (Kc, PC + laptop on the LAN, 2026-11-20; buildid 8270065 on
both; stopped by a laptop crash).** Logs: `local\m3-logs\stage9-pc-1.log`,
`stage9-laptop-1.log`, `stage-9-laptop-1-crash.log`.

**Laptop crash (not a 0.8.0 fix):**
- The assert is "Failed to find function BuildVisualizationForNoiseAlert
  in XComGameStateContext_ChangeContainer" (crash log L6732-6733), raised
  while visualizing a received frame during the civilians' turn.
- The function exists only in the Community Highlander (Issue #510,
  `X2AIBTDefaultActions.uc` L1150, L1211): a fleeing civilian's noise
  alert sets the change container's `BuildVisualizationFn` to a member of
  an AI behaviour-tree object on the PC.
- Only the function's name reaches the laptop. There it is looked up on
  the context, which doesn't have it.
- Firaxis's own commented-out guard says such delegates "cannot work when
  performing a replay" (`XComGameStateContext_ChangeContainer.uc`
  L29-38).
- The laptop's switches were all off, so no 0.8.0 fix ran there. This is
  the first mission with fleeing civilians; no earlier log has the name.

**Switches:**
- All of them started off on both machines (PC L1042, laptop L387): the
  config defaults weren't applied (cause a guess).
- The PC's clicks registered (L1049-1055).
- Kc didn't tick the laptop's switches (corrected 2026-11-20): he expected
  the PC's to apply to both. The switches are per machine by design, and
  the laptop-side fixes (borders, camera, bound skip, hack capture, fix D)
  read the laptop's own.

So the laptop ran with every fix off, fix D included, and the tutorial
flag was never set (no `tutorial controls flag` line). The laptop's
borders and camera results don't test the fixes.

**Camera:** the engine reports a multiplayer game on both machines once
connected (`engine multiplayer game=True`, PC L1304, laptop L386).
- PC: the override restored the follow camera (10 lines `stock=False
  used=True`), so the PC itself had lost the follow camera since HOST.
- Laptop: 9 lines `stock=False used=False fix=False`.

**Selection ping-pong (from 0.6.3, not 0.8.0):**
- With none of its soldiers able to act, the laptop re-selected units 21
  and 24 every ~0.03 s: 5508 `selected unit` lines here, 2885 in Stage 8.1
  run 2.
- `SkipUnitWithoutActions` keeps choosing from soldiers that can't act.
- This explains the edge scroll snapping back to the soldier, and
  selection jumping after a move.

**Other results:**
- The rocket with co-op off works.
- The PC exited cleanly after `the map is closing with the session open`
  (L2522-2523).
- `ContextHistory` read 0 before and after both releases. The list may
  be emptied as frames are acknowledged; the crash-repeat test (D, E)
  wasn't reached.
- No hacks this run.

**Proposed fixes (not written; Kc's go-ahead first):**
1. **Guest scrub:** before the follower replays new frames, clear
   `BuildVisualizationFn` on received change containers known to bind it
   to an object that isn't sent (`ChangeInfo` "BehaviorTree -
   DoNoiseAlert"). The laptop loses only that civilian's "yell" flyover.
   Also log every received change container that has a visualization
   function, to find others.
2. **Switch defaults:** store "off" flags (false = the fix runs), so the
   result doesn't depend on whether config defaults apply.
3. ~~Fixes screen as toggle buttons~~: dropped. The laptop's checkboxes
   were never clicked, so nothing shows they fail. Instead, the screen's
   header says the switches apply to this PC only.
4. **Ping-pong:** the skip routine stops when no guest soldier can act,
   whatever the bound switch says.

**0.8.0b (written 2026-11-20, Kc: "Yes, write them"; not built):**
1. `X2TC_CoopSession.ScrubReplayVisuals`: on the guest, when a history or
   partial history arrives and again before the follower is installed,
   it clears `BuildVisualizationFn` on change containers whose
   `ChangeInfo` is "BehaviorTree - DoNoiseAlert". It logs every other
   received change container with a visualization function. New switch 8,
   "Partner skips visuals it can't build".
2. `X2TC_CoopFixes` stores "off" flags; all switches are on at launch.
3. `SkipUnitWithoutActions` stops (logging once) when no guest-controlled
   unit can act.
4. Version 0.8.0b; the fixes screen header says each machine has its own
   switches. Check script: 18 files, 0 problems.

**0.8.0b Run 2 (Kc, 2026-11-20; buildid 8270065 on both; no crashes).**
Logs in `local\m4-logs\`: `m4-080-pc-1.log` / `m4-080-laptop-1.log`
(session 1, four LAN missions), `m4-080-pc-tutorial.log` (session 2),
`m4-080-pc-2.log` / `m4-080-laptop-2.log` (session 3, Gatecrasher).

Worked:
- **No crash in 4 missions back to back:**
  - the laptop left and the PC played on, then quit (run 0's crash case);
  - the PC quit with the laptop connected;
  - the laptop removed the noise-alert visual 3 times.
- **Switches:** on at launch on both machines.
- **Laptop borders and cover icons:** show (tutorial flag ON 83 times,
  each logged). Fix D changes only a highlight's colour, so per Kc's rule
  it goes in 0.8.1.
- **Laptop camera:** follows every PC move, VIP included (79 lines
  `stock=False used=True`).
- **Ownership and turns:**
  - VIP: no banner on the PC;
  - Tab/H work on both machines;
  - the laptop ends its turn;
  - 48 laptop moves were applied and none refused, including moves within
    seconds of each other;
  - the PC got HOST DISCONNECTED handling when it quit.
- **Selection loop:** gone (12 `none ... can act` lines; Run 1 had 5508
  `selected unit` lines).
- **SAFE MODE:** gave 0.7.0's hacking (screen on both, the laptop's
  FinalizeIntrusion refused as busy, the PC's roll counted).
- **Tutorial:** HOST (STEAM) refused with the message (session 2).
- **Gatecrasher (session 3):**
  - per-soldier kills, wounds and loot in the campaign match Kc's notes;
  - the laptop got MISSION OVER;
  - the campaign history was 366 KB at 157 frames;
  - sends averaged 118 KB (max 296 KB), acknowledgements took up to 2 s;
  - the PC logged 6 one-second stalls at frame 662.

Problems:
1. **Host's hack hangs the laptop (our bug).** The laptop ended its hidden
   copy after 0.5 s. The PC's FinalizeHack visual later merges into that
   hack action (`FinalizeHackAbility_MergeVisualization`, "InsertSubtree
   called with a NULL InsertionTreeNode", laptop log L37548ff), so the
   laptop's visualizer stalled.
   - The hack screen is drawn on the soldier's tablet (a 3D movie), so
     hiding it left a grey tablet.
   - The objective timer still ran on the laptop.
2. **Bound soldier still selectable on the laptop.** Unit 21 was bound;
   the PC logged AP=0, can act=False (PC L13756). The laptop's Tab still
   selected it, so its can-act check said yes. Guess: the laptop's
   per-unit ability cache is never rebuilt during the replay.
3. **Laptop specialist can't use the access point.** No capture was
   logged. Guess: the same stale cache, for abilities that depend on
   position.
4. **Path preview during moves (cause in source).** The move input's
   `EndState` keeps the path, borders and cover icons visible when the
   next state is `InReplayPlayback` (Highlander `XComTacticalInput.uc`
   L1840-1850), which is where the follower goes when input turns off.
5. **Rockets launch from the SPARK's start position in co-op**, on both
   screens; with co-op off they work. Lead: the engine reports a
   multiplayer game while connected, and 24 script files check that. A
   guess.
6. **The PC doesn't pan to the laptop's non-move actions** (Overdrive).
   Cause unknown.
7. **FRIENDLY ACTION during a player's own last action** (the 0.5.2 "out
   of moves" rule fires as soon as the action points hit 0).
8. **Ability icons glow** (tutorial highlight, no blocking).
9. After the partner leaves, the PC controls every soldier (by design;
   undocumented).

Not tested: a hack by the laptop with routing on (the access point
wasn't usable; Haywire ran only in SAFE MODE). The guest-skipped
visuals logged "Owner Unit Died", "Set Secondary Fires", "First Sighting
Of Enemy Group", "Unit Rank Up" (all kept, no crash).

## 0.8.1 (approved by Kc, 2026-11-21)

Kc's change: the multiplayer flag gets a fix attempt behind its own switch
where the source shows a feasible one, plus diagnostics. "The mod should
aim to be as close to single player gameplay as possible."

Kc's answers:
- Gatecrasher autosaved every turn on the host.
- BIT test (`local\m4-logs\m4-080-*-3.log`): hosting with nobody
  connected, the BIT follows the SPARK. Once the partner joins, both BITs
  freeze: the host's about one move before the join, the laptop's a
  turn behind that. Each machine's rocket starts at its own BIT and flies
  straight through walls; the result is the same on both.
- Hacks: the other player watches; whoever started the hack controls it.

**Must:**
1. **Hack hang.** On the guest, every hack step stays open until its
   FinalizeHack or CancelHack frame has been replayed, own hacks included.
   The other player's copy stays visible and can't be clicked; the
   starter's copy is the interactive one.
2. **Multiplayer flag:** diagnostics plus a fix attempt (own switch).
3. **Can-act check:** `UnitHasActionsAvailable` (bound and panicked units
   excluded).
4. **Path preview:** hide the path, borders and cover icons when the
   guest's input turns off.
5. **Banner** only after a player's last action has finished playing.
6. **Fix D removed.**

**Should:** 7 ability glow cleared; 8 detection tiles shown on the guest;
9 mouse-wheel diagnostics and fallback; 10 a host look-at for the guest's
non-move abilities; 11 BIT diagnostics (and a fix if the logs show one);
12 the guest's hack availability logged.

**Could:** 13 interrupt-link logging for moves stopping short; 14 step all
pending frames during alien turns.

Every new fix has a switch under SAFE MODE.

**0.8.1 as written (2026-11-21, not built):**
- **Root cause of the BIT bug** (from source and Kc's logs): the host
  applied the guest's moves with `GameStateMoveUnit` and the mover's path
  only. The click path (`GameStateMoveUnitSingle`, Highlander
  `XComTacticalController.uc` L1189-1213) also moves attached cosmetic
  units. A guest-moved SPARK's BIT, or a Specialist's Gremlin, never
  followed. Fix 14 adds their paths.
- **Multiplayer flag:**
  - Native, and on from HOST (PC log L425, before any connection), so it
    can't be cleared from script (a guess about its trigger).
  - Fixed under "Single-player rules while connected":
    - abilities of units created mid-mission (ability templates get the
      multiplayer area for the session, removed at its end);
    - the pause menu pauses again.
  - Correction: autosave isn't blocked, only quicksave and quickload
    (Highlander `XComAutosaveMgr.uc` L259, L338; Kc saw autosaves).
  - Not fixable without a class override or an effect on every unit
    (Kc's decision):
    - flanking crit 30 for everyone;
    - suppression penalty;
    - Skulljack's chance;
    - Shadowbind copies' action points;
    - fog reveal on shots;
    - some enemy stage-1 visuals;
    - quicksave.
- **Detection tiles deferred:** the components are private in the SDK
  source the mod compiles against (the Highlander's public copy isn't
  used by the build).
- **New classes:** `X2TC_CoopSPRules`, `X2TC_CoopPauseListener`.
- **Checklist:** checklists/m4-081.md.

## Remaining multiplayer rules (plan only; Kc decides after the 0.8.1 test)

Kc (2026-11-21): check the Highlander first for an event or hook for
each rule, rank by impact, and for any that truly need an override list
the class, other mods that override it, and the risk.

How it was checked: every `IsMultiplayerGame()` call in SDK SrcOrig
(28 files), compared with the Highlander's copies in local/refs (it
replaces 344 classes). **The Highlander has no event or hook on any of
these checks.** The two nearby Highlander hooks don't fit: Issue #555
(`OverrideFinalHitChanceFns`, `X2AbilityToHitCalc.uc` L15-26) gets the
shot breakdown without the shooter, and Issue #1271
(`GetAdditionalHitModifiers_CH`) needs a subclass. The mod can't use
either while it compiles against SrcOrig. Everything below is from
source; nothing has been tested.

**Correction to my 0.8.1 summary:** the "enemy area-attack warnings" are
not the live warnings. The checks are only in the *sync* visuals, which
rebuild the scene after a load (row 3).

| # | Rule (where) | Impact | Fix without an override? | Plan |
|---|---|---|---|---|
| 1 | Flanking crit: flat `MP_FLANKING_CRIT_BONUS`=30 instead of the shooter's stat (soldiers 50, most enemies 33) (`X2AbilityToHitCalc_StandardAim.uc` L534-544; Highlander copy L627-636) | High: every flanking shot | **Yes.** The effects loop right after it (L546-560) calls each shooter effect's `GetToHitModifiers` with the shooter and `bFlanking`. | A hidden passive ability added to every character template (`OnPostTemplatesCreated`). Its effect adds (shooter's flank crit − 30) as a crit modifier when the shot flanks, isn't melee, a session is on, and the switch is on. Costs: the breakdown shows a second "Flanking" line; the ability needs the multiplayer area (SP rules already add it); a mid-mission save made in co-op needs the mod to load. |
| 2 | Shooter not revealed in the fog: `ShouldRevealFOW()` returns false (`X2Action_ExitCover.uc` L500-505), so the shooter's 3 m reveal and forced visibility (`HideFOW`, L401-422) are skipped. Its `ShouldFrameCamera()` (L507-537) also skips the camera for unseen enemy shooters | **Medium (downgraded; revised 2026-11-21):** the fire action reveals both the target and the shooter anyway, in every mode (`X2Action_Fire.uc` L526-543). So shots at a unit are revealed, just later. Grenades and other area attacks, which have no unit target, leave a thrower in the fog hidden | **Yes, by a watcher (no override; Kc dropped the override).** See "Visual watcher" below. | Revised 2026-11-21. |
| 3 | Stage-1 sync visuals: Blazing Pinions (`X2Ability_Archon.uc` L408-420, `DLC_2\...ArchonKing.uc` L287-299), Codex psi bomb (`X2Ability_Cyberus.uc` L857-867), Avatar rift (`X2Ability_PsiWitch.uc` L270-280), Chryssalid cocoon (`X2Ability_ChryssalidCocoon.uc` L141-151) | Low: they only run when a saved or joined scene is rebuilt. The host loads before HOST, when the flag is still off. The guest might hit one if it joins during a pending attack (guess) | Yes in principle (re-point the templates' sync delegates), but that means rewriting SDK functions | **No fix.** Note it in known issues. |
| 4 | Suppression: every shooter gets `MultiplayerTargetAimPenalty`=-35; in single player, aliens suppressed by XCOM get -50 (`X2Effect_Suppression.uc` L14-19; GameCore.ini L1841-1843) | Medium: XCOM's suppression is weaker | **Yes.** It's a config variable, so setting it at run time is allowed. | **Revised after the LWOTC audit:** no config write. The Flanking (co-op) passive adds -15 for a suppressed non-XCOM shooter (see "Audit results"). |
| 5 | Skulljack and Stasis Lance: the 70% base chance is skipped, so 0% except on Captains and Codices (100%) (`X2AbilityToHitCalc_StasisLance.uc` L81) | Low | **Yes, by a template edit** (not an override) | A subclass whose `GetHitChance` takes the single-player branch while a session is on, swapped into the templates that use this calc (`X2Ability_ItemGrantedAbilitySet.uc`). Risk: mods that edit Skulljack's hit calc. |
| 6 | Shadowbind: the copy gets 0 action points on spawn (`X2Effect_SpawnShadowbindUnit.uc` L36-40) | Low (makes Spectres weaker) | **Yes, by a template edit** | A subclass of the effect that saves the copy's action points, calls the original, then restores them. Swapped into the Spectre's Shadowbind templates (`X2Ability_Spectre.uc`). |
| 7 | Quicksave and quickload off (Highlander `XComAutosaveMgr.uc` L271, L358; no hook) | Low: autosave works (Kc saw it). The pause menu's Save Game isn't gated by the flag (`UIPauseMenu.uc` L245-254), so the host can probably still save by hand (guess) | Not needed | **No fix.** Quickload must stay off in co-op anyway, because it would drop the session. Add "host: pause menu → Save Game" to a checklist. |

**Also found (not on Kc's list, low, no fix planned):**
- Flyovers and sounds for hidden units are skipped (`X2Action_PlaySoundAndFlyOver.uc` L55; overwatch L973 in `X2Ability_DefaultAbilitySet.uc`).
- Path visibility is counted differently for enemy moves seen in the fog (`X2TacticalVisibilityHelpers.uc` L1073, L1133). These are static functions, which an override can't reach.
- Gamepad evac button (`UITacticalHUD.uc` L323).
- Edge-scrolling during the alien turn (`X2Camera_FollowMouseCursor.uc` L150).
- Turn label (`UISpecialMissionHUD_TurnCounter.uc` L377).
- Hack timer (`X2Action_Hack.uc` L156).

**Rejected:**
- The `X2Action_ExitCover` override. Kc, 2026-11-21: "Don't add the X2Action_ExitCover override", because compatibility matters, including Long War of the Chosen in the future.
- An override of `X2AbilityToHitCalc_StandardAim` for row 1. The Highlander already replaces that class, and Workshop pages name several mods that override it (EU Aim Rolls, XModBase). Many templates use shared default calc objects that a class override wouldn't reach, according to a Nexus forum post (a guess until checked in source).

### Compatibility pass (Kc, 2026-11-21)
Kc: "this should work alongside other mods, ideally including Long War of
the Chosen in the future." Plan only. The second shot-breakdown line is
fine if it's labelled clearly: **"Flanking (co-op)"**.

**Routes I checked for the fog reveal and the camera (no override):**
- **Highlander:**
  - Its only visualization-related hook is the `PostModifyNewAbilityContext` event (Issue #890, `XComGameStateContext_Ability.uc` L1555-1565). It lets a mod change a new ability context, for example by adding a step to `PostBuildVisualizationFn`. **Rejected:** it runs only where contexts are created, the host. The guest replays the host's contexts, and a function added to a context travels by name. That is the same weakness that crashed the guest on the noise alert (Highlander issue #510).
  - The Highlander has no camera hook other than camera rotation (Issue #854).
- **Template edits:** wrapping each shot ability's `BuildVisualizationFn` means storing the original function for hundreds of templates, and other mods (LWOTC among them, a guess) wrap the same ones. **Rejected** as more fragile than the watcher.
- **Event windows** (`ELD_OnVisualizationBlockStarted/Completed`, `X2EventManager.uc` L287-296): these follow game events, and the guest submits no game states, so its listeners would never fire (guess from how the replay works). **Rejected.**
- **Visual watcher (chosen):**
  - The visualizer's current tree is readable (`XComGameStateVisualizationMgr.uc` L117, `VisualizationTree`), and `GetNodesOfType` (L459) finds actions by class in it. Both machines build their own visualization from the same frames, so a watcher behaves the same on each.

**Visual watcher: `X2TC_CoopVisualWatcher` (a new Actor, one purpose)**
- **When it runs:** each tick, only while a session is on, the engine reports multiplayer, and its switch is on.
- **What it does:** it looks through the current tree for running actions whose multiplayer branch skipped something, and does that part itself:
  - **Fog (row 2).** An `X2Action_ExitCover` in its `Executing` state, with `bSkipFOWReveal` and `bSkipExitCoverVisualization` both off.
    - The watcher creates its own fog viewer at the shooter (3 m, `XComWorldData.CreateFOWViewer`, the same call `HideFOW` makes at L413) and sets the unit's forced visibility.
    - When that action has left the tree, or the unit's `X2Action_EnterCover` has finished, the watcher destroys its viewer. `RestoreFOW` (`X2Action_EnterCover.uc` L342-356) already clears the forced visibility in every mode.
    - It uses its own viewer, not the AI player's, so it never destroys one the game made.
  - **Camera (replaces the 0.8.0 override, once tested).** An `X2Action_CameraFollowUnit` that is executing with `FollowCamera` = None (it skipped the camera). The watcher adds an `X2Camera_FollowMovingUnit`, set up as the action's L68-74 sets it, and removes it when the action leaves the tree.
- **Differences from the stock behaviour:**
  - The stock action waits for its camera to arrive before the move goes on (L77). The watcher can't hold the action, so the camera may still be panning as the soldier starts to walk.
  - The reveal starts up to a frame later than the stock one.
- **Optional:** the same watcher could add the framing camera for shots by unseen enemies (`ShouldFrameCamera`, L507-537). Not planned unless a test shows it matters.
- **Order:**
  1. Ship the watcher's fog part.
  2. Add its camera part under its own switch, with the 0.8.0 override kept, so you can compare them with switches.
  3. Remove the override, and its entry in `Config/XComEngine.ini`, only after the watcher's camera passes a test.
- **Risks:**
  - It's a per-tick scan of the tree. It's cheap when idle (guess), and it's logged once per action.
  - If another mod also forces visibility, the last one to set it wins.
  - It changes no game state, template or class, so it can't conflict with another mod's override.

**LWOTC audit (public source, github.com/long-war-2/lwotc, branch master)**
- **Verified:** its class overrides (`LongWarOfTheChosen/Config/XComEngine.ini`) are 15 classes:
  - `X2Action_MoveClimbWall`;
  - `UIAfterAction` and `UIAfterAction_ListItem`;
  - `UIStrategyMapItem_Region`, `_Mission` and `_AlienNetworkComponent`;
  - `UIOptionsPCScreen`, `UIAdventOperations`, `UIMission_ChosenAmbush`;
  - `XGAIBehavior_Civilian`, `UIEffectListItem`, `UICovertActionReport`;
  - `UIRecruitSoldiers`, `UIInventory_VIPRecovered`, `UIInventory_LootRecovered`.

  **Neither `X2Action_CameraFollowUnit` nor `X2Action_ExitCover` is among them, so there's no override conflict with LWOTC**, now or after the camera override goes.
- **Not verified:** whether LWOTC changes Skulljack, Shadowbind, suppression, flanking crit, or adds passives to all units. GitHub code search needs a sign-in, and the file listing was cut off. Kc could clone LWOTC into local/refs (CLAUDE.md: Kc clones reference repos), and I'd grep it.
- **Planned so that it doesn't matter much:**
  - **Skulljack (row 5):** swap only a calc whose class is exactly `X2AbilityToHitCalc_StasisLance`. A mod that already replaced it keeps its own calc, and the co-op fix just doesn't apply to it. Logged.
  - **Shadowbind (row 6):** swap only an effect whose class is exactly `X2Effect_SpawnShadowbindUnit`. Same rule; logged.
  - **Flanking (row 1):** the passive is added alongside other abilities and replaces nothing. It reads the shooter's flank stat when the shot happens, so stat changes by LWOTC or any mod carry through. Label: "Flanking (co-op)".
    - Risk: a mod whose own hit calc doesn't extend `X2AbilityToHitCalc_StandardAim`, or skips the effects loop, never asks the passive. Then the flat 30 stays, which is no worse than now.
    - LWOTC's graze band uses the Highlander's Issue #555 hook (Highlander comment, `X2AbilityToHitCalc.uc` L18-19). That runs after the modifiers, so it should see the passive's line (guess).
  - **Suppression (row 4):** the -50 is copied from `SoldierTargetAimPenalty` at HOST, so a mod's own value carries through. A mod with its own suppression effect isn't affected either way.
- **Bigger LWOTC risks, outside these fixes (guesses):**
  - LWOTC changes much of the tactical and strategy game. Its own multiplayer-flag checks, if any, haven't been read.
  - It's large, which makes the host's history (and so each sync) bigger.
  - Both PCs need the same mods.

  These need their own test once it's in scope.

**Covert Infiltration audit (added 2026-11-21; Kc: "I've also been
recommended to confirm compatibility with covert infiltration")**
- **Source:** github.com/WOTCStrategyOverhaul/CovertInfiltration. A web
  search named it, and the Workshop page points to that organization; I
  haven't opened the repo myself. Kc clones it into
  `local\refs\CovertInfiltration`.
- **Same checks as LWOTC, plus these:**
  1. Its `+ModClassOverrides` list, against our camera override.
  2. Template edits on the abilities and effects we swap (Skulljack,
     Shadowbind) and on character templates (our flanking passive).
  3. **Mission start**, its main area: infiltration missions, sitreps,
     and squads assembled through covert actions. Our session starts at
     HOST in tactical and assigns soldiers to owners. Check whether any of
     its tactical-start code, sitreps or extra units change what the
     guest replays or what CO-OP: SQUAD shows.
  4. Its UI screen listeners on the tactical HUD and pause menu, against
     ours (`X2TC_CoopListener`, `X2TC_CoopPauseListener`,
     `X2TC_CoopHackListener`).
  5. Mission end: its after-action and covert-action reports, against our
     map-cleanup and return-to-Avenger path.
  6. Its license, recorded in LOG.md (CLAUDE.md).
- **Then, in game (a later checklist, Kc plays):** both PCs run Covert
  Infiltration, one infiltration mission is hosted in co-op, and the PC
  returns to the Avenger. Not scheduled yet; it goes with the
  release-candidate tests if Kc wants it in 1.0.

### Audit results: LWOTC and Covert Infiltration (2026-11-21, from source, not tested)
Clones: `local\refs\lwotc` and `local\refs\CovertInfiltration`. Kc cloned
both with GitHub Desktop. I didn't read their commit IDs: my command
included `git`, which was denied, and I didn't get them another way.

**Licenses:**
- Covert Infiltration: MIT (`LICENSE`, "Copyright (c) 2019
  WOTCStrategyOverhaul").
- LWOTC: I found no license file at its top level, and its README doesn't
  mention one. Only its build tools (`.scripts/X2ModBuildCommon/LICENSE`)
  have one.
- We reuse no code from either.

**Class overrides:**
- **LWOTC:** 16 classes. 15 are in `Config/XComEngine.ini` L59-85; one
  more (`UIPersonnel_SoldierListItem`) is in `Config/XComLW_Overhaul.ini`
  L4 and is added at run time by `PatchModClassOverrides`
  (`X2DownloadableContentInfo_LongWarOfTheChosen.uc` L1005-1018).
- **Covert Infiltration:** 4 strategy UI classes (`Config/XComEngine.ini`
  L12-17: `UIEventQueue`, `UIStrategyMapItem_CovertAction`,
  `UIStrategyMapItem_Mission`, `UICovertActions`).
- **No conflict with our `X2Action_CameraFollowUnit` override.** (LWOTC and
  Covert Infiltration both override `UIStrategyMapItem_Mission`, so the
  two mods conflict with each other, not with us; they aren't meant to be
  used together.)

**Our planned fixes against each mod:**

| Fix | LWOTC | Covert Infiltration |
|---|---|---|
| Flanking (co-op) passive | OK. LWOTC's hit calc is XModBase's copy (`XMBAbilityToHitCalc_StandardAim.uc` L534-558), which keeps the same multiplayer branch *and* the same effects loop, so the passive is still asked. LWOTC's graze band runs afterwards, through Highlander #555 (`X2LWAbilitiesModTemplate.uc` L78). LWOTC's own anti-flank effects subtract the shooter's flank stat (`X2Effect_SmokeFlankingCritProtection.uc` L32, `X2Effect_ShieldGuard.uc` L23). ~~With the flat 30 plus our +20 they'd leave +20; a later step can make the passive skip targets protected that way.~~ **Corrected 2026-11-22:** with the passive they leave exactly 0, as in single player (30 + 20 − 50); without it, -20. So no skip is needed (0.8.2, item 5). **Risk: medium; needs a test with LWOTC.** | Not touched |
| Suppression -50 (row 4) | **Problem.** LWOTC gives aliens the stock Suppression ability (`X2Item_LWAlienWeapons.uc` L212, L333, L892). A single -50 would make alien suppression on XCOM soldiers -50 instead of -35. **Revised:** no config write. The Flanking (co-op) passive also corrects suppression: when the shooter isn't XCOM and has a Suppression effect, it adds (`SoldierTargetAimPenalty` − `MultiplayerTargetAimPenalty`), which is -15. That's exact for both sides, with any mod's values. It also covers LWOTC's `X2Effect_AreaSuppression`, which extends the stock effect (guess: it keeps the stock `GetToHitModifiers`). The ability's tooltip still says -35. | Not touched |
| Skulljack (row 5) | OK. LWOTC only changes the icon colour and shooter exclusions (`LWTemplateMods.uc` L2029; `X2DownloadableContentInfo_LongWarOfTheChosen.uc` L388-392). The calc stays stock, so our swap applies | Not touched (it only checks soldiers' gear for Skulljack, `UISSManager_CovertAction.uc` L422-480) |
| Shadowbind (row 6) | Not referenced | Not referenced |
| Visual watcher (fog, camera) | LWOTC adds stock `X2Action_ExitCover` actions to its own visuals (e.g. `X2Ability_PerkPackAbilitySet.uc` L1144, L3151); the watcher treats them like any other. OK | Not touched |
| SP rules (multiplayer area on abilities) | OK for abilities. **But see below** | OK |

**LWOTC: one problem the mod can't fix.**
- LWOTC's `FinalizeUnitAbilitiesForInit` (a Highlander hook) returns early
  in multiplayer (`X2DownloadableContentInfo_LongWarOfTheChosen.uc`
  L3024-3034). That hook adds LWOTC's per-unit abilities, such as its
  infiltration modifier.
- In co-op the flag is on from HOST, so units created after HOST would
  miss those abilities: reinforcements, and units created by abilities.
- It's LWOTC's own check, so nothing in our mod can change it.
- Also cosmetic: Perfect Information's shot wings skip part of the
  display in multiplayer (`XCom_Perfect_Information_UITacticalHUD_ShotWings.uc`
  L242).
- **Verdict:** LWOTC co-op is possible but not exact. Its reinforcements
  would be weaker. Leave it out of 1.0; it needs its own test and maybe a
  request to LWOTC's authors (Kc's call).

**Covert Infiltration: mostly strategy-side; its tactical parts look safe
(a guess until tested).**
- **Runs on the host only:** its tactical listeners (`X2EventListener_Infiltration.uc` L1395-1409) run mission-start and reinforcement logic as game states the guest then replays:
  - `OnTacticalBeginPlay`, `PostAliensSpawned`, `OnUnitBeginPlay`;
  - reinforcement calls on `SquadConcealmentBroken` and `ScamperEnd`.
- **Before HOST:** encounter and reinforcement creation (`X2DownloadableContentInfo_CovertInfiltration.uc` L1411, L1436), `OnPreMission` (L775).
- **After the mission, host only:** `OnPostMission` (L887).
- **Guest, cosmetic (guess):** on its Supply Extraction mission, it shows and hides the dropship mesh in visualization windows (`X2EventListener_Infiltration.uc` L1406-1407, L1639-1667). Those windows come from game events, which the guest doesn't submit, so on the laptop the dropship may show or hide at the wrong time.
- **No multiplayer-flag checks; no tactical HUD or pause-menu screen listeners.** Its reinforcement countdown text comes through a Highlander UI event (`X2EventListener_Infiltration_UI.uc` L884-889); guess: it fires on both machines.
- **Squad size:** its squads come from covert-action style infiltration. CO-OP: SQUAD lists whatever soldiers are in the mission (guess), so check it with a larger squad.
- **Verdict:** a good candidate for a 1.0 compatibility test. Checklist items (Kc plays; both PCs run it):
  - one infiltration mission in co-op, with reinforcements;
  - one Supply Extraction mission, watching the dropship on the laptop;
  - the return to the Avenger and the covert-action report on the PC.

**Proposed order (each behind its own switch under SAFE MODE; no new overrides):**
1. Rows 1, 5 and 6, row 4 now inside the row-1 passive, plus the watcher's fog part (row 2).
2. The watcher's camera part next to the existing override; remove the override after a passing test.
3. Rows 3 and 7: documented, not fixed (known issues).

**For Kc:**
- Should Covert Infiltration's co-op check go into the release-candidate
  tests?
- LWOTC stays out of 1.0 (recommended)?

## 0.8.2 (approved by Kc, 2026-11-22)

**Kc (2026-11-22):** "Approved: 0.8.2 = A + B, 0.8.3 = C. Write 0.8.2 and
its checklist." Answers:
- Drop the smoke skip ("your math is right").
- Item 9: hide MOVE TO CURSOR; drop the MULTIPLAYER button ("stock PvP,
  not needed and Mr.Fear's area"); rename HOST/JOIN to "BY IP".
- New for 0.8.3: one "Co-op" button in the top-right HUD icon row (see C,
  item 13).
- Verbose log: on by default in playtest builds, off in 1.0.
- Covert Infiltration: in the release-candidate tests only if a friend runs
  it; otherwise after 1.0. LWOTC: out of 1.0.

### As built (2026-11-22; differences from the draft below)
Nothing here is tested yet (checklists/m4-082.md).
- **A1 pause:** the source points at a likely cause, a guess until the log
  shows it. The global Escape handler calls `UIPauseMenu(, true)`, which
  returns without opening anything while `ShouldBlockPauseMenu()` is true
  (`XComPresentationLayerBase.uc` L1813). That happens when the player's
  state is `EndingTurn` or the shot HUD is up (`XComTacticalController.uc`
  L2208-2217). So the fix opens the menu with `UIPauseMenu(true, true)`:
  past the gameplay block, saving off. It logs the player state and the
  block for the first few presses.
- **A2 hacks:** as planned. The host remembers its lock by the screen's
  name and clears it before `InitiateHack` *and* before `OnCancel` (the
  Highlander's `OnCancel` also returns early while the flag is set, its
  L412). The blocker is a `UIBGBox` at 1% alpha, 1920x1080.
- **A3 objects:** new class `X2TC_CoopObjectLink`. It runs at the start of
  each XCOM turn on the guest (detail lines the first time, then only the
  summary), not when the hack line changes. That line changes too often,
  and a repair switched on mid-mission takes effect at the next XCOM turn.
  Matching is by `ActorId`, then by name and location (as the stock
  search).
- **B5:** as planned (`X2TC_CoopRulesAbility`, `X2TC_CoopRulesEffect`).
  The first 5 lines of each kind are logged; hit chances are also worked
  out for previews, so a line isn't proof of a shot. **Note:** the passive
  is on every character template from start-up, so *every* tactical save
  made with the mod holds it (not only co-op saves).
- **B6 Shadowbind: added, not swapped.** The template's effect list is
  `protectedwrite` in SrcOrig (`X2AbilityTemplate.uc` L57), and `new` with
  a parent-class template object isn't safe in UE3 (a guess). So a small
  extra effect, `X2TC_CoopShadowbindActions`, is appended after the stock
  spawn effect, only in templates that have that effect's exact stock
  class. In the same game state it finds the copy and gives its standard
  action points back if its group is the acting one. That's exactly what
  the spawn manager gave it in single player (`XComAISpawnManager.uc`
  L472-475). Skulljack is swapped as planned (`X2TC_CoopStasisLanceCalc`).
- **B7/B8 watcher:** `X2TC_CoopVisualWatcher`, spawned with the map
  cleanup actor.
  - **Camera:** it acts on a follow-camera action that it saw waiting and
    that then *finished* without a camera, while that move's
    camera-remove action hasn't run. The stock action decides and
    completes in its Begin code, so "executing" alone isn't enough.
  - The stock camera-remove action at the move's end removes the
    watcher's camera by tag, as it would the stock one.
- **Version:** 0.8.2. Switches: 25.

### Saves and the co-op passive (Kc, 2026-11-22: check before release)
Kc: check what the game does when a tactical save references
`X2TC_CoopRules` and the mod is removed. If it only warns, note it in
known issues; if it could break a save, propose an alternative. A
disclaimer ("don't add or remove mid-mission; mid-campaign is fine") is
also fine with Kc.

**From source (not tested):**
- **Load:** a save missing a mod or DLC gets a warning dialog with "Load
  anyway" and Cancel (`UILoadGame.uc` L385-397). The check itself is
  native (`XComOnlineEventMgr.CheckSaveDLCRequirements`, L3236), so whether
  it names this mod is a guess.
- **What the save holds:** no object of the mod's classes. There's the
  unit's ability state (stock class, holding the template *name*) and its
  effect state (stock class; the effect is found through the template's
  name and index, `XComGameState_Effect.GetX2Effect` L41-44). Without the
  mod, both lookups return None. `X2TC_CoopShadowbindActions` and the
  Skulljack calc live only on templates, never in a save.
- **Script paths with None:** the hit calc skips an effect that returns
  None (`X2AbilityToHitCalc_StandardAim.uc` L551-553). Others don't check,
  for example the turn tick (`XComGameState_Effect.uc` L49) and mission end
  (`XComGameState_Unit.OnEndTacticalPlay` L2391). In UnrealScript that is
  an "Accessed None" log line, not a crash. **Unknown:** native code that
  reads the ability's template (`GetMyTemplate` is native, L57); a crash
  there can't be ruled out from script.
- **Strategy saves:** at mission end every unit's ability and effect lists
  are emptied (`OnEndTacticalPlay` L2401-2405). The passive comes from the
  character template at each mission start. So a strategy save holds no
  trace of it (guess: nothing else keeps the old states).

**Test:** release checklist, "Save without the mod" (one PC, ~15 min).

**If the test shows a broken save, the fallback (not built):**
- Add the passive only for a session. At HOST, add it to the character
  templates (removed again when the session ends, as `X2TC_CoopSPRules`
  does with the multiplayer area), so units created during the session
  get it.
- For units already on the map at HOST, create its ability state
  (`X2TacticalGameRuleset.InitAbilityForUnit`, L788) and apply its effect
  in one game state on the host. The guest replays it.
- **Cost:** the unit-start trigger has already fired for those units, so
  the effect must be applied by hand (more code and a new risk).
- Only saves made during a co-op session would hold it.
- **Recommendation:** run the test first. If it only warns, keep the
  current design, with the known-issues line and the Workshop note
  ("don't add or remove mid-mission; between missions is fine").

Kc (2026-11-22): "Plan 0.8.2 as one bigger step toward 1.0. Show me the
plan before code. Every gameplay fix behind its own switch under SAFE
MODE, as before." The items are Kc's (A 1-4, B 5-8, C 9-12). Found from
source; nothing below is tested.

### Split (my recommendation)
- **0.8.2 = A + B** (gameplay; one LAN run plus one campaign mission,
  ~Nov 24-28). The watcher camera (item 8) is included, so the Nov 28-29
  camera slot is free.
- **0.8.3 = C** (no gameplay risk; one short run, ~Nov 28-29), built
  only after 0.8.2 passes. Why:
  - Item 10 touches most of the 318 log calls in 20 classes. Mixed with
    A and B, one diff would hold both gameplay changes and hundreds of log
    edits. That makes a 0.8.2 failure harder to trace, and the code audit
    (Nov 30) harder too.
  - The 0.8.2 run needs the full logs (the new hack, object and flanking
    lines).
  - C's UI changes (hidden buttons, labels) are easier to check on their
    own.
- Either way, the code audit stays at Nov 30-Dec 1.

### A. 0.8.1 leftovers
**1. The partner pauses while it has no soldier that can act** (switch
"Partner: pause while waiting").
- **Found:** the guest's input is then `InReplayPlayback`.
  - That state has no pause handler of its own (Highlander
    `XComTacticalInput.uc` L493-530).
  - The global `Start_Button`/`EscapeKey` (L1741-1754) would open the
    pause menu.
  - Why it doesn't is not found. The pre-check (L173-240) has several
    gates.
- **Fix (works whatever the cause):** in `X2TC_CoopInput.HandleKey`, on
  Escape released, when all of these hold:
  - the guest's input is off;
  - no pause menu or dialog is up;
  - no hack screen, squad screen or fixes screen is open;

  open it the way the game does: `XComPresentationLayer.UIPauseMenu(,
  true)`.
- The existing pause listener then pauses only the laptop.
- The first few Escape presses are logged, with the input state.
- **Risk:** low. If the game also handled it, the menu could open twice.
  The "no pause menu up" check prevents that.

**2. Hacks: the watcher can't click; the partner sends only its own
hacks** (switch "Hacks: watcher can't click").
- **Found:** `SetInputState(eInputState_None)` blocks keys only. The
  screen's mouse callback (`UIHackingScreen.OnMouseEvent`, SrcOrig
  L345-365) starts a hack on a click, unless `m_hackStarted` is true.
  - The screen is drawn in the Gremlin's render-to-texture movie
    (`X2Action_Hack.uc` L232-237), so it isn't certain that a 2D panel
    on top would catch the mouse.
- **Fix, three layers:**
  1. **From source:** on the watcher's copy, set `m_hackStarted = true`
     (an instance variable, not a default). That disables Hack and Cancel
     by mouse and keys.
     - On the host's watching copy, `HostDriveHack` sets it back to false
       just before it calls `InitiateHack` (L3379). That function asserts
       the flag is false (SrcOrig L510).
  2. **Your blocker:** a transparent full-size panel, a child of the
     watcher's copy. It takes mouse events (`ProcessMouseEvents`) so
     reward picks don't move either. It's a guess that it works in that
     movie; each click it catches is logged once.
  3. **The guest's capture** (`SendHackChoiceIfHack`): when the open hack
     screen's soldier isn't the guest's, it sends nothing and logs
     "dropped". It still returns true, so nothing is applied locally.
- **Risk:**
  - Layer 1 depends on the guest staying in tutorial-style replay. The
    screen's own auto-start (`StartScaryComputerLoopAkEvent`, L161-170)
    runs only in a non-tutorial replay.
  - The 0.8.1 log shows no auto-start.

**3. Objective hack on the partner: test the object-ID guess and try a
fix** (diagnostic always on while connected; repair switch "Partner:
re-link objects to the host's states").
- **Found in source:**
  - A hack target counts only if `X2Condition_Interactive` finds the
    actor among the unit's interaction points (SrcOrig L28-34).
  - `GetUnitInteractionPoints` drops any point whose actor's
    `GetInteractiveState()` is None or can't be hacked
    (`X2Condition_UnitInteractions.uc` L31-75).
  - `GetInteractiveState` → `FindExistingState`
    (`XComDestructibleActor.uc` L235-310):
    - if the actor already has an `ObjectID`, it trusts it;
    - only an actor with ID 0 searches the history by its `ActorId`
      (name and location).
  - The guest's actors got their IDs from its own map load. Its history
    is the host's. If the IDs differ, every lookup misses (the guess).
- **Diagnostic** (guest, once after the history arrives, and again when
  the selected unit's hack line changes):
  - for each `XComInteractiveLevelActor` with a hack or interaction
    ability: its name, its `ObjectID`, the class and `ActorId` name of the
    history object with that ID, and the object whose `ActorId` matches
    the actor;
  - `MATCH` or `MISMATCH`;
  - for the matching object: `IsEnabled`, `MustBeHacked`, `HasBeenHacked`,
    and its hack reward count.
  - One summary line: N actors, M mismatched.
- **Repair (behind its switch, guest only, after the diagnostic):** for a
  mismatched actor:
  - call its public `SetObjectIDFromState(the matching object)`
    (`XComDestructibleActor.uc` L461-467);
  - point the history's visualizer for that object at the actor
    (`History.SetVisualizer`).
  - Write only `ObjectID` this way, never directly: it's `protectedwrite`
    (L146).
- **Risks:**
  - The setter asserts the old ID was 0 or equal. That only matters if
    asserts stop the game in this build (a guess: they log).
  - Doors are the same actor class, so the repair re-links doors too. The
    diagnostic counts them first.
  - If the diagnostic shows no mismatch, the repair does nothing, and the
    guess is wrong.
- **Test:** one Skirmish run with an objective workstation, the repair on
  then off.

**4. The game's call-stack traces: leave them** (no switch, no code).
- **Found:**
  - `X2GameRuleset.SubmitGameStateContext` traces every context it
    submits while the network manager has connections and the context
    isn't marked for sending (SrcOrig L236-249, L340-349). That's every
    context on the host, because our session sends the history itself.
- **Cheap ways to stop them, all rejected:**
  - **Mark the contexts for sending.** The engine would then queue them
    and send them to the guest itself, alongside our history. The native
    behaviour is unknown, which risks a desync or a crash.
  - **Report no connections.** That would break our own connection.
  - **Suppress `ScriptLog` in the mod's `XComEngine.ini`.** It would hide
    every untagged log line, the game's and other mods', and it changes
    engine config.
- **Cost of leaving them:** log size only (about 60% of the PC log's
  lines). They were in 0.8.0 too, with no effect seen. Item 10 keeps the
  X2TC lines easy to find.

### B. Single-player rules (no class overrides; designed in "Remaining multiplayer rules" and "Compatibility pass")
**5. The Flanking (co-op) passive** (switches "Flanking crit as in single
player" and "Suppression penalty as in single player").
- **New:**
  - `X2TC_CoopRulesAbility` (creates the hidden passive
    `X2TC_CoopRules`, with the multiplayer game area set directly);
  - `X2TC_CoopRulesEffect` (an `X2Effect_Persistent`, infinite, no
    visuals).
- **Template edit at start-up:** add the passive to every character
  template. This goes in `OnPostTemplatesCreated`, which the mod's
  DLCInfo already runs; it doesn't replace anything.
- **`GetToHitModifiers`** (SrcOrig `X2Effect_Persistent.uc` L653). It's
  called with the shooter by the effects loop (`X2AbilityToHitCalc_StandardAim.uc`
  L546-560). It does nothing unless all of these hold:
  - a co-op session is on;
  - the engine reports multiplayer (exactly when the flat 30 applies,
    L536-539);
  - the calc is `X2AbilityToHitCalc_StandardAim` or a subclass.

  Then:
  - **Flanking:** when `bFlanking` and not `bMelee`, add crit (the
    shooter's `eStat_FlankingCritChance` − `MP_FLANKING_CRIT_BONUS`).
    Labelled "Flanking (co-op)".
  - **Suppression:** when not `bIndirectFire` and the shooter has an
    `X2Effect_Suppression` (or a subclass), add aim:
    - for XCOM shooters, (`AlienTargetAimPenalty` −
      `MultiplayerTargetAimPenalty`);
    - for others, (`SoldierTargetAimPenalty` − `MultiplayerTargetAimPenalty`).

    Labelled "Suppression (co-op)". Stock values: 0 and -15
    (`DefaultGameCore.ini` L1841-1843). **Correction:** the earlier plan
    covered only non-XCOM shooters. The stock effect also has an XCOM
    branch (`X2Effect_Suppression.uc` L14-19).
- **Your smoke request, I recommend against it:** LWOTC's smoke and
  ShieldGuard effects subtract the shooter's own flank stat
  (`X2Effect_SmokeFlankingCritProtection.uc` L32, `X2Effect_ShieldGuard.uc`
  L23).
  - With the passive: 30 + (50 − 30) − 50 = **0**, exactly single player.
  - Skipping those targets would leave 30 − 50 = **-20**, a penalty
    single player doesn't have. Our passive is what makes that case
    right, so no skip.
- **Risks:**
  - A save made mid-mission in co-op holds the passive, so it needs the
    mod loaded.
  - The shot breakdown shows the extra lines.
  - A hit calc that skips the effects loop leaves the flat 30.

**6. Skulljack / Stasis Lance and Shadowbind swaps** (switches "Skulljack
chance as in single player" and "Shadowbind copy acts as in single
player").
- **New:**
  - `X2TC_CoopStasisLanceCalc` (extends
    `X2AbilityToHitCalc_StasisLance`). While a session is on and its
    switch is on, it takes the single-player branch of L81; otherwise it
    calls the stock one.
  - `X2TC_CoopSpawnShadowbindEffect` (extends
    `X2Effect_SpawnShadowbindUnit`). It keeps the copy's action points
    across the original's multiplayer branch (L36-40); with the switch
    off, it's stock.
- **Swap at start-up:** only where the template's calc or effect class is
  exactly the stock one. Each swap and each skip is logged.

**7. The visual watcher's fog reveal** (switch "Reveal shooters in the
fog").
- **New:** `X2TC_CoopVisualWatcher` (an Actor), as designed under "Visual
  watcher": its own fog viewer, plus forced visibility on an executing
  `X2Action_ExitCover` that skipped them, removed when the action ends.
- It runs on both machines while connected. One log line per action.

**8. The watcher's camera** (switch "Camera: watcher (no override)", next
to the existing "Camera follows moves while connected", the override).
- It adds an `X2Camera_FollowMovingUnit` only when an executing
  `X2Action_CameraFollowUnit` has no camera, so with the override on it
  stays idle.
- **To compare:** run one mission with the override on and the watcher
  off, then one with them swapped. The override comes out only after the
  watcher passes, in a later build.

**Switches:** 9 new (pause, hack click, object re-link, flanking,
suppression, Skulljack, Shadowbind, fog, watcher camera), 25 in all, all
under SAFE MODE. Each template-based fix is checked when it runs, so with
its switch off the game behaves as stock.

**Checklist (written after approval): `checklists/m4-082.md`.**
- Skirmish on the LAN:
  - the laptop pauses with no soldier that can act;
  - the PC hacks and the laptop can't click;
  - the laptop hacks the objective with the repair on, then off;
  - a flanking shot's breakdown on both PCs;
  - a suppressed alien's shot;
  - the camera comparison;
  - a grenade thrown from the fog.
- Plus item 12's campaign checks:
  - a campaign mission with reinforcements or the Chosen (abilities, and
    the Skulljack chance if a Codex or Officer is there);
  - the mouse wheel with a USB mouse on the laptop;
  - the host saving from the pause menu (in a mission and back on the
    Avenger).

### C. Release readiness (0.8.3; split approved 2026-11-22)
**9. Release UI.**
- **How:** one constant, `RELEASE_UI` (in `X2TC_CoopListener`, like
  `SHOW_TEST_BUTTONS`). The test build flips it.
- **Proposed final buttons:**

| Where | Shown in release | Hidden in release |
|---|---|---|
| Main menu | CO-OP: JOIN (STEAM) (v1.0.0); CO-OP: JOIN BY IP | the M2 MULTIPLAYER button and the MP trace listeners' lines (release checklist: "decide whether it ships", I recommend not) |
| Host, before hosting | CO-OP: HOST (STEAM) (v1.0.0); CO-OP: HOST BY IP; CO-OP: FIXES | END TURN and SQUAD (no use before hosting) |
| Host, hosting | CO-OP: INVITE (STEAM) / HOSTING; CO-OP: SQUAD; CO-OP: END TURN; CO-OP: FIXES | |
| Partner | CO-OP: SQUAD; CO-OP: END TURN (READY); CO-OP: NEXT SOLDIER; CO-OP: FIXES; CO-OP: LEAVE | MOVE TO CURSOR (clicking tiles works since 0.8.0; M and right-click stay) |
| Hack | CO-OP: CANCEL HACK | |

- **FIXES labels:**
  - Grouped and in plain words, for example:
    - "Partner screen: hide the path while moving";
    - "Rules: flanking crit as in single player";
    - "Camera: follow moves (override)".
  - Header: "Turn one off only if it misbehaves, and tell the host."
  - SAFE MODE explained in one line.
  - The internal letters (A-D) and test notes go.

**10. Verbose logging** (switch "Verbose log", off by default; on the
FIXES screen but not under SAFE MODE, since it isn't a fix).
- A helper, `class'X2TC_CoopFixes'.static.Verbose()`, wraps the
  per-frame and per-turn lines.
- **Wrapped (verbose only):**
  - follower move state;
  - partial history sent, received and replayed;
  - squad state;
  - camera follow;
  - owner cycling;
  - banner and status text;
  - screen names;
  - interrupts;
  - hack abilities;
  - the wheel;
  - the MP trace listeners.
- **Always kept:**
  - version, HOST and JOIN, connect and disconnect, refusals, errors;
  - fixes state, SP rules summaries, the hack flow, mission end, owner
    changes.
- **Target:** under about 300 X2TC lines per mission, against the
  laptop's 3,786 in 0.8.1.
- Turn it on for any bug report (friend-setup says so).

**11. Join flow for 1.0.**
- **Main path, Steam invite:**
  - the host clicks HOST (STEAM), then INVITE (STEAM) and picks the
    friend;
  - the partner clicks JOIN (STEAM) on the main menu and accepts the
    invite.
- **Advanced:** HOST BY IP / JOIN BY IP on the same network, or with port
  forwarding.
- **`release/friend-setup.md`:**
  - a short "Host" section to match;
  - the advanced IP section;
  - "turn on Verbose log and send Launch.log" for bug reports;
  - the button names as in item 9.
- **When:** written with 0.8.3, so the names match what ships. In 0.8.2
  only the checklist changes.

**12. Checklist additions:** under item 8 above (in
`checklists/m4-082.md`). The release checklist also gets "campaign
mission with reinforcements or the Chosen passed" and "host pause-menu
save works".

**13. The Co-op HUD button (Kc, 2026-11-22; plan only, for 0.8.3).**
Kc: replace the column of CO-OP buttons with one "Co-op" button in the
top-right HUD icon row, inline with the game's icons, styled like them,
anchored to that group so it holds at other resolutions and doesn't
overlap icons other mods add.
- **Found (source, not tested):** that row is
  `UITacticalHUD_MouseControls`, one Flash panel with up to 10 icon slots
  (`ButtonItems.Length = 10`, L58). It fills them itself from the stock
  icons plus the unit's "command abilities" (L77-150). The command
  abilities are how other mods add icons there. There's no slot or hook
  for a non-ability button.
- **Proposal:**
  - A separate icon-style button, anchored top-right like the row.
  - Its x position is computed from the row's active icon count, so it
    sits just left of the row and moves when a mod's icon appears.
    Re-checked a few times a second while the HUD shows.
  - The icon size and spacing are measured in game (screenshot) before it
    is fixed.
- **Dropdown or panel: I propose a small panel.** It opens under the
  button and lists the role's actions as normal stock buttons, each with
  one line of help. Clicking outside it or pressing Escape closes it.
  - A dropdown (`UIDropdown`) fits one choice from a list, not five
    actions with on/off states such as INVITE/HOSTING.
- **Kept visible without opening the menu (recommended):**
  - the status line (role, whose turn, the partner's state), in small
    text under the icon row;
  - **the partner's END TURN (READY)**, as a second icon next to "Co-op",
    because it's pressed every turn.
  - The host's END TURN stays on the game's own End Turn icon (the co-op
    check already catches Backspace and End).
- **Not a class override; risk:** the row's icon width may differ with
  some UI mods (guess). The position is logged.

### For Kc
**Answered 2026-11-22**, see the top of this section.
1. Split: 0.8.2 = A + B, 0.8.3 = C?
2. Item 5: drop the smoke skip (math above)?
3. Item 9:
   - hide MOVE TO CURSOR in release?
   - drop the MULTIPLAYER button?
   - rename CO-OP: JOIN / HOST to "BY IP"?
4. Item 10: should Verbose log also be on by default during the
   release-candidate playtest, for better reports?
5. Still open:
   - Covert Infiltration in the release-candidate tests?
   - LWOTC out of 1.0?

## 0.8.3 (Kc, 2026-11-22, after 0.8.2 Runs 2-3)
**Kc:** "Change of plan for the lag: no lag changes in 0.8.3, logging
only. Don't add zip catch-up or any other lag fix yet." Log per update:
- the host's build time and size;
- sent-to-received time;
- the partner's load time;
- the animation backlog;
- the acknowledgment round trip;
- how far behind the partner's screen is in seconds (using the clock
  offset from the pings).

Also a summary line at the end of each alien turn, with the lines kept
compact. "The other 0.8.3 items stay as planned (objective hack,
CONNECTING (CANCEL), the NO SOLDIERS banner timing, removing the re-link
and Shadowbind code)." The checklist has one longer mission; after the
run, say which stage dominates and which lag option it points to.

**Scope note (my reading; Kc to confirm):** Kc's list doesn't name C
(items 9-13: release UI, verbose log, join flow, the Co-op HUD button), so
this build leaves C out; it can follow as 0.8.4. The camera override stays
(not on Kc's list).

### Design
1. **Lag logging** (new class `X2TC_CoopLagLog`, one purpose: timing lines).
   - Clock: the system clock in ms of the day (`Object.GetSystemTime`,
     Core `Object.uc` L2304), so the host can time its own native send
     call; it wraps at midnight (handled).
   - Offset: the partner sends a small time ping (its clock), and the
     host answers with its own. The offset comes from the sample with the
     shortest round trip among the last 10. Pings go once a second for
     the first 5, then every 20 s.
   - **Host line per update**, logged at its acknowledgment:
     - `wait`: from new frames appearing to the send (the time spent
       waiting for the previous acknowledgment);
     - `build`: the native `SendPartialHistory` call;
     - size and frames;
     - `rtt`: from the end of the send to the acknowledgment.
   - The host follows each update with a small info command: number, frame
     count, frames-ready time, send-end time, build time, size, alien turn
     or not.
   - **Partner line per update:**
     - `arrive`: host send end to the partner's history handler, in host
       time;
     - `load`: the handler time minus the partner's last tick start (the
       native load runs in that tick; ±1 frame);
     - `transit` = arrive − load;
     - `backlog`: frames received but not yet shown;
     - `behind`: how old, in host time, the oldest frame still playing on
       the partner's screen is.
   - "Still playing" = the lowest history index among unfinished actions
     in the visualization tree (`X2Action.CurrentHistoryIndex` L34,
     `bCompleted` L55; `GetNodesOfType` L459). Sampled 4 times a second
     from the visual watcher's tick.
   - **Summary per alien turn** on both PCs:
     - counts; size total;
     - average and maximum of each stage;
     - the maximum backlog and behind.
   - Logged on the first XCOM update after alien ones (on the partner,
     once its screen has caught up, or at the next alien turn).
   - The existing per-update lines stay; the new ones are one line per
     update on each PC.
2. **Objective hack diagnostic** (`X2TC_CoopObjectLink`).
   - The host runs the same check at each XCOM turn.
   - Each must-hack object adds:
     - its tactical and strategy reward flags;
     - BattleData's tactical and strategy reward counts;
     - whether the tactical hack is done;
     - `CanInteractHack` for each squad soldier.
3. **CONNECTING (CANCEL)** (`X2TC_CoopListener`, `X2TC_CoopSession`).
   - While a JOIN BY IP is connecting, the main-menu button reads
     "CO-OP: CONNECTING (CANCEL)"; a click cancels it.
   - 5 s after the 6th failed attempt the session closes by itself with a
     message ("Couldn't reach the host...").
   - Both reset the session so JOIN works again.
4. **NO SOLDIERS banner timing** (`X2TC_CoopSession.UpdateBanner`): shown
   only once the partner's animations have finished. Same switch as the
   out-of-moves banner ("Banner waits for the last action").
5. **Removals.**
   - The re-link repair and its switch (the read-only check stays).
   - `X2TC_CoopShadowbindActions`, its switch and its template hook.
   - Switch numbers after them shift; 23 switches in all.
6. Version 0.8.3. Checklist `checklists/m4-083.md` with one longer mission.

## Code audit before 1.0 (plan only; Kc: "that will wait for the end")

Kc (2026-11-21): find "every single file you've written, it's purpose,
its risks/liabilities and if there's any superior alternates." It runs
after the last feature build and before the release candidate (~Nov 30
to Dec 1, so it fits before the friend playtest).

**Scope:** every file this project wrote, found by listing (not from
memory):
- mod/: every `.uc` class, `Config/*.ini`, localization, `.x2proj`,
  `.scripts`;
- tools/;
- checklists/, plans/, research/, release/;
- SPEC.md, LOG.md, the README files and the `.gitignore`.

local/ and tool-log/ are covered only for what is or isn't committed.

**For each file, one row:**
| Column | What it records |
|---|---|
| Purpose | One line; the game behaviour it changes, or what the document is for |
| Relies on | The SDK and Highlander classes and members it uses (path, lines) |
| Override / template edit / config var | Anything that changes another class or template, and how it's undone |
| Risks | Crash, desync, save-game, compatibility (other mods, LWOTC), performance, network size |
| Liabilities | Legal limits in CLAUDE.md (no game or SDK content, quotes only a few lines), anything private, anything that could read as official |
| Dead code / switches | Unused functions, switches left on that could be removed, test buttons |
| Superior alternate | A safer or simpler route if one exists (a Highlander hook, an event instead of polling, a watcher instead of an override), with its cost |
| Tested? | Which checklist and build tested it, or "not tested" |

**Checks run across all files:**
- `tools/check_unrealscript.py` on all classes;
- a grep for `ModClassOverrides`, template swaps, run-time config writes,
  and `default.` writes;
- every log line carries the X2TC prefix;
- every class header names its SDK class;
- nothing from the game or SDK is committed (filenames and quoted line
  counts);
- no `{{...}}` placeholders are left in `release/`;
- a link check on the docs (Jekyll: no names starting with an
  underscore).

**How:** read-only. Files are split across up to three review agents by
area (session and replay, UI and input, docs and release). I check each
finding before it goes in the report, so only verified ones are
reported.

**Output:** `research/code-audit-1.0.md`, with one table and a ranked
list of findings. Fixes are proposed in a plan for Kc to approve; the
audit itself changes no code.

## 0.8.1 (plan only)
Glowing ability icons, mouse-wheel elevation, soldiers stopping short then
jumping ahead, the long alien turn, detection tiles, the guest's hack
result display, fix D removed if 0.8.0 shows it isn't needed, and anything
the campaign test finds. Its own short plan after the 0.8.0 run.

## Release materials (drafts, no code)
`release/workshop-description.md`, `release/friend-setup.md`,
`release/known-issues.md`, `release/release-checklist.md`.

## Left for later
Network-size optimization, split turns, more than two players, parallel
campaigns.
