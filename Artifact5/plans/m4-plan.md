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
| 4 | Suppression: every shooter gets `MultiplayerTargetAimPenalty`=-35; in single player, aliens suppressed by XCOM get -50 (`X2Effect_Suppression.uc` L14-19; GameCore.ini L1841-1843) | Medium: XCOM's suppression is weaker | **Yes.** It's a config variable, so setting it at run time is allowed. | Set it to `SoldierTargetAimPenalty` (-50) at HOST; restore it at the session's end (like SP rules). Exact unless an enemy suppresses XCOM: no vanilla character template has Suppression (grep; mods may add it). The ability text (`X2AbilityTag.uc` L189) follows. |
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

**Proposed order (each behind its own switch under SAFE MODE; no new overrides):**
1. Rows 1, 4, 5 and 6, plus the watcher's fog part (row 2).
2. The watcher's camera part next to the existing override; remove the override after a passing test.
3. Rows 3 and 7: documented, not fixed (known issues).

**For Kc:** clone LWOTC into local/refs for the remaining audit? (Optional.)

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
