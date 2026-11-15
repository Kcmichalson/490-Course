# M3 Stage 5: the laptop's first move, applied by the PC

For plans/m3-plan.md, Stage 5 (revised 2026-11-14). Goal: on XCOM's
turn the laptop selects a soldier and orders a move; the laptop does
**not** move it itself; the PC applies it, and both screens show it.
Also: the laptop can leave with **CO-OP: LEAVE**. Mod **0.3.4**, same
three mods on both machines.

New in this build: the laptop's follower runs in the game's **tutorial
mode** (the game's own way of letting a player act inside a replay).
Anything tutorial-like you notice on the laptop (arrows, markers, hint
text, narrator lines, greyed-out abilities, a "tutorial" message) is
worth a note and a screenshot.

Lines marked **(guess)** are not tested on build 8270065.

## Part A: build, install, pre-flight

As Stage 4 Part A, with version **0.3.4**:
1. **PC:** clean config, `buildid` 8270065, Build, AML (the three mods),
   run → **MULTIPLAYER** → back → quit; `Launch.log` →
   `local\m3-logs\stage5-preflight-pc.log`.
2. **PC:** package:

   ```
   python tools\package_mod.py --mods-dir "D:\SteamLibrary\steamapps\common\XCOM 2\XCom2-WarOfTheChosen\XComGame\Mods" --version 0.3.4
   ```

3. **Laptop:** hash check, replace `Mods\X2TacticalCoop` with the 0.3.4
   zip, run → **MULTIPLAYER** → back → quit; log →
   `local\m3-logs\stage5-preflight-laptop.log` on the PC.
4. **PC:**

   ```
   python tools\preflight_compare.py local\m3-logs\stage5-preflight-pc.log local\m3-logs\stage5-preflight-laptop.log
   ```

   Only `MP state` may differ; `Mod version` 0.3.4 on both.

## Part B: the test (Run 1)

Note clock times on both machines.

1. **Laptop:** run the game; main menu.
2. **PC:** run the game, start a Skirmish mission, wait until you control
   your soldiers, **don't act**, click **CO-OP: HOST**.
3. **Laptop:** **CO-OP: JOIN**, the PC's address. Wait until it has
   caught up (camera still for about 5 s).
4. **Laptop, look before clicking anything:** is there a **CO-OP: LEAVE**
   button near the top right? Is the normal soldier HUD there (soldier
   name, ability bar at the bottom)? Is a soldier selected? Note it all.
   **Screenshot of both screens.**
5. **Laptop, the move:** select a soldier (click it, or Tab/the arrow
   keys if clicking doesn't select) and click a destination a few tiles
   away, as you would normally. **PC: don't touch anything.**
6. **Expected (guess):** the laptop doesn't move the soldier at once;
   about 1-2 s later the PC moves that soldier along the same path, and
   then the laptop shows the move. Note what each screen did, and how
   long it took. **Screenshot of both** once both are still.
7. If the move worked: do it **once more** with another soldier from the
   laptop. Then on the **PC**, move one of your own soldiers (to check
   the PC still plays normally) and end the turn. Watch one alien turn
   on both.
8. **Laptop, during the alien turn:** try clicking a soldier and a
   destination. Expected: nothing happens (the laptop's input is off
   outside XCOM's turn).
9. **Laptop, pause menu:** at the start of the next XCOM turn press
   **Esc**. Does the pause menu open? Is **Save** greyed out? Note the
   options listed; close it again **without** choosing anything.
10. **Laptop: CO-OP: LEAVE.** Expected: the laptop goes to the main menu
    (loading screen first). Note any popup's exact words.
11. **PC:** play one more of your own moves (the mission must go on
    without the laptop), then quit.
12. Copy the logs before restarting either game: `stage5-pc-1.log`,
    `stage5-laptop-1.log` in `local\m3-logs\`; screenshots there too.
13. Tell me what you saw at steps 4-11.

**If the laptop moves the soldier by itself** (before the PC does), or
the soldier ends up in different places on the two screens, note the
clock time, take screenshots of both, then go straight to step 10.

**If the laptop can't select a soldier or give a move order at all**,
note what you tried and what the screen showed, then go to step 9.

## Run 2 (version 0.3.5, 2026-11-14)

Run 1 (0.3.4): the laptop played the tutorial's intro cutscene, then
followed, but no soldier could be selected. 0.3.5 turns tutorial mode on
only during XCOM's turn and takes the laptop's game out of its replay
state the way the tutorial does before the player acts, selects a
soldier itself, and adds **CO-OP: NEXT SOLDIER** (the game's own Tab
cycling stays off in this mode).

1. Part A with version **0.3.5** (logs `stage5-preflight-*.log` again,
   then the compare).
2. Part B steps 1-3 as before. **Expected:** no tutorial cutscene on the
   laptop this time.
3. Step 4: also look for **CO-OP: NEXT SOLDIER** under LEAVE, and
   whether a soldier is selected on the laptop (name and ability bar at
   the bottom). Click NEXT SOLDIER twice and note whether the selection
   moves.
4. Steps 5-11 as before (the move by clicking a destination; if clicking
   another soldier doesn't select it, use NEXT SOLDIER).
5. Logs: `stage5-pc-2.log` and `stage5-laptop-2.log` (Run 1's are saved
   as `stage4-pc-2.log` and `stage4-laptop-2.log`).

New lines to expect on the laptop: `XCOM input phase begins (tutorial
mode on, ruleset state TurnPhase_WaitForTutorialInput ...)`, `selected
unit U`, `input on (... active unit U ...)`, some `captured a
non-ability context, not sent: XComGameStateContext_TacticalGameRule`
lines (the game's own turn-begin bookkeeping, correctly not applied),
and `XCOM input phase ends` when the aliens' turn starts.

## Run 3 (version 0.3.6, 2026-11-14)

Run 2 (0.3.5): abilities reached the laptop's capture (and were
correctly not applied or sent: Stage 5 sends moves only), NEXT SOLDIER
worked, but clicked moves were refused before reaching it, and the
intro still played. 0.3.6 fixes both (and the "click me" glow on every
ability stays for now: cosmetic, recorded).

1. Part A with version **0.3.6** (`stage5-preflight-*.log`, compare).
2. Part B steps 1-3. **Expected:** no tutorial intro.
3. Step 5: select a soldier (NEXT SOLDIER if needed), click a
   destination. **Expected (guess):** a short pause, then the PC moves
   that soldier, then the laptop shows it.
4. Steps 6-11 as before. Using an ability on the laptop is expected to
   do nothing yet (Stage 5b); you may try one to see it captured.
5. Logs: `stage5-pc-3.log`, `stage5-laptop-3.log`.

New lines to expect: on the laptop `XCOM input phase begins (... ruleset
state TurnPhase_WaitForTutorialInput ...)` after `PerformingReplay:
BeginState`, `captured move 1 (unit U, N tiles), sent`, `move result
from the host: applied`, `cleared the moving mark on unit U`; on the PC
`guest move 1 received`, `guest move 1 applied ... frames A -> B`.

## Run 4 (version 0.3.7, 2026-11-14): moves with diagnostics, and abilities

Run 3 (0.3.6): no intro (fixed), abilities captured, moves still not
reaching the capture, and the laptop's history grew by 2 frames by itself
(the safety warning fired) because of the step out of replay; that step
is removed. This build logs every check a clicked move must pass, and
**forwards abilities to the PC** (Stage 5b, pulled forward), so one
session covers both.

1. Part A with version **0.3.7** (`stage5-preflight-*.log`, compare).
2. Part B steps 1-4 (host, join, catch up, look at the laptop's screen).
3. **Moves (laptop):** with a soldier selected, slowly move the mouse
   over the ground for a few seconds (note: **does a blue path line
   appear?**), then click a destination; try both a **left click** and
   a **right click**. Note the clock time of each click. Then NEXT
   SOLDIER and try once more with that soldier.
4. **Abilities (laptop), on XCOM's turn, PC hands off:**
   - **Overwatch** with one soldier (no target needed).
   - If an enemy is visible: a **standard shot** at it with another
     soldier (select the shot, pick the target, confirm).
   - Optional, if available: a **claymore** throw or **Aid Protocol**.
   For each: note whether it then plays on the PC and on the laptop, and
   the clock time. Screenshot of both screens after the first one that
   works.
5. **If no enemy is visible:** on the PC, move one of your own soldiers
   forward until a pod is revealed (this also checks the PC still plays),
   wait for the laptop to show it, then do the standard shot from the
   laptop at a revealed enemy.
6. End the XCOM turn on the PC, watch the alien turn on both; during it,
   try an ability on the laptop (expected: nothing happens).
7. Laptop: **Esc** at the next XCOM turn (pause menu? Save greyed out?),
   close it, then **CO-OP: LEAVE**. PC: one more move, quit.
8. Logs: `stage5-pc-4.log`, `stage5-laptop-4.log` (please check the
   laptop's file is the laptop's: its first lines name a different
   computer than the PC's). Screenshots in `local\m3-logs\`.

New lines to expect: on the laptop `move check: ...` lines whenever the
move guards change; `captured ability N <name> (unit U, target T, ...),
sent`; `action result from the host: applied|refused, <reason>`; **no**
`WARNING`. On the PC `guest ability N <name> received`, `applied ...
frames A -> B` or `refused: <reason>`.

## Run 5 (version 0.3.8, 2026-11-14): Run 4 again, with both machines on the new build

Run 4's logs: the PC ran **0.3.7** but the laptop **0.3.6** (no 0.3.7
zip was packaged), so the laptop's new code never ran. 0.3.8 adds a
version check at JOIN: if the two builds differ, the PC won't send its
history and the laptop shows **CO-OP: VERSION MISMATCH**.

1. **PC:** Build; load check shows `X2TC: version 0.3.8`; package:

   ```
   python tools\package_mod.py --mods-dir "D:\SteamLibrary\steamapps\common\XCOM 2\XCom2-WarOfTheChosen\XComGame\Mods" --version 0.3.8
   ```

2. **Laptop:** copy the **0.3.8** zip and `.sha256.txt`, hash check,
   delete `Mods\X2TacticalCoop`, unzip 0.3.8.
   **Quick check on both main menus:** the button reads **CO-OP: JOIN
   (v0.3.8)** (from 0.3.8 the CO-OP buttons show the version).
3. Pre-flight on both (main menu → MULTIPLAYER → back → quit), save
   `stage5-preflight-pc.log` / `stage5-preflight-laptop.log`, run the
   compare: `Mod version` must be **0.3.8 | 0.3.8**.
4. Run 4's steps 2-7 (host, join, moves with the path-line check,
   overwatch, a standard shot after the PC reveals a pod, alien turn,
   pause menu, LEAVE).
5. Logs: `stage5-pc-5.log`, `stage5-laptop-5.log`.

## Run 6 (version 0.3.9, 2026-11-14)

Run 5 (0.3.8): **abilities work end to end** (8 orders from the laptop,
all applied by the PC). Moves: still no path line; the diagnostics show
the laptop's pathing never builds a path. Also: the targeting UI stayed
open after an order, and about 2 s from order to the laptop's screen.
0.3.9: the targeting UI should close normally; the PC sends new frames
up to five times a second and right after applying a laptop order;
the pathing's own state is logged; and a fallback for moves:
**CO-OP: MOVE TO CURSOR**.

1. Build, package 0.3.8 → **0.3.9**, install on the laptop; both main
   menus must read **CO-OP: JOIN (v0.3.9)** (skipping the pre-flight is
   fine; the version check at JOIN catches a mismatch).
2. Host, join, catch up as before.
3. **Moves, normal way (diagnostics):** select a soldier, hover over a
   few tiles for ~5 s, click a destination (left, then right click).
4. **Moves, fallback:** hover the mouse over the destination tile, then
   (without moving the mouse over the map again) click **CO-OP: MOVE TO
   CURSOR** at the top right. Expected (guess): the PC moves that soldier
   to the tile it was hovered over (if it's in range), then the laptop
   shows it. Try two different soldiers and distances, one out of range.
5. **Abilities:** overwatch and a grenade or standard shot again. Does
   the targeting UI close after the order now? Rough delay from your
   click to the laptop showing it?
6. Alien turn, pause menu (Esc), LEAVE, one more PC move, quit.
7. Logs: `stage5-pc-6.log`, `stage5-laptop-6.log`.

## Run 7 (version 0.4.0, 2026-11-14)

Run 6 (0.3.9): **MOVE TO CURSOR works** (the PC built and walked the
path; out-of-range targets were refused, which is correct), the
targeting UI closes, latency much better. The diagnostics showed why
normal moves fail: the laptop's **pathing display is hidden** the whole
time. 0.4.0 shows it again when the laptop's input comes on (and closes
the stock replay screen properly, the likely cause), and moves the
selection off a soldier with no actions left.

1. Build, package **0.4.0**, install on the laptop; both menus read
   **CO-OP: JOIN (v0.4.0)**.
2. Host, join, catch up.
3. **Normal moves:** select a soldier and hover over the ground. **Does
   the blue path line appear now?** If it does, click a destination
   (left click as usual). Expected (guess): the PC moves the soldier,
   then the laptop shows it. Try with two soldiers.
4. If the path line still doesn't appear, use MOVE TO CURSOR as in Run 6
   and carry on.
5. Use up one soldier's actions from the laptop (e.g. move twice, or
   move and overwatch): does the selection jump to the next soldier?
6. A shot or grenade, the alien turn, Esc (pause menu), LEAVE.
7. Logs: `stage5-pc-7.log`, `stage5-laptop-7.log`.

Lines to look for on the laptop: `pathing pawn was hidden; shown on unit
U (hidden now=False)`, `move check: ... pawn hidden=False ... replay
screen in stack=False ...`, `path of 2+ tiles=True` while hovering,
`captured move N (unit U, N tiles), sent`, `has no actions left;
selected unit U`.

## Run 8 (version 0.4.2, 2026-11-14): hotkey, and every move fix at once

0.4.1 was never run; 0.4.2 includes it as FIX A. New: **M key** = move
to cursor; **right-click** = move to cursor when the game shows no path;
three **FIX buttons** on the laptop (A cache: ON, B history: OFF, C
world: OFF) that can be switched during the run; a full `move state`
line every 0.5 s. Time-box: after this run and one more, if normal
click-to-move still fails, the M key is M3's way to move.

1. Build, package **0.4.2**, install; menus read **CO-OP: JOIN
   (v0.4.2)**. Host, join, catch up.
2. **M key:** hover a destination, press **M**. Expected: the PC moves
   the soldier there (if in range). Try **right-click** too. Two
   soldiers, one out-of-range target (nothing should happen).
3. **Normal moves, one fix setting at a time.** For each setting below,
   hover over the ground ~5 s (does the blue line follow the mouse?),
   then left-click a destination if it does. Note the clock time when you
   switch.
   - a. As it starts (A on, B off, C off).
   - b. Click **FIX B** (A on, B on).
   - c. Click **FIX C** (A, B, C on).
   - d. Click **FIX A** (A off, B on, C on).
4. Note which setting (if any) made the line follow the mouse, then
   leave that setting on for the rest.
5. A shot or grenade, the alien turn, LEAVE.
6. Logs: `stage5-pc-8.log`, `stage5-laptop-8.log`.

## Run 9 (version 0.4.3, 2026-11-14): the last click-to-move run (time-box)

Run 8 (0.4.2): M and right-click move soldiers; fixes A-C changed
nothing. The 0.5 s lines showed the reachable-tiles data is fine; the
broken piece is the game's own path display object on the laptop
(ability targeting uses fresh ones, which work). 0.4.3 adds **FIX D
FRESH PAWN (on)**: a new path display in place of the old one.

1. Build, package **0.4.3**, install; menus read **CO-OP: JOIN
   (v0.4.3)**. Host, join, catch up.
2. Select a soldier, hover ~5 s: **does the blue line follow the mouse
   now?** If yes, left-click a destination; try two soldiers.
3. Click **FIX D** (now OFF), hover again: does the line stop following?
   Click FIX D again (ON).
4. M and right-click once each still work? A shot, the alien turn, LEAVE.
5. Logs: `stage5-pc-9.log`, `stage5-laptop-9.log`.

**If the line still doesn't follow with D on, the time-box ends:** the M
key (and right-click) is M3's way to move, click-to-move goes on the
polish list, and Stage 6 starts.

## What I'll look for

| Machine | Lines |
|---|---|
| Both | `X2TC: version 0.3.4`; any `hitch, poll gap` |
| Laptop | `Coop follower: tutorial mode=True`; `LEAVE button added`; `Coop follower: input on (state ActiveUnit_Moving, active unit U ...)` / `input off`; `captured move 1 (unit U, N tiles), sent; not applied locally (frames=F)`; `move result from the host: applied`; `partial history ... received`; **no** `WARNING: history frames=...`; any `tutorial call intercepted: <name>`; any `captured ability ... not sent` or `captured a non-ability context`; `LEAVE clicked`, `disconnected; opening the main menu` |
| PC | `guest move 1 received (unit U, N tiles)`, `guest move 1 applied (unit U, waited Ss), frames A -> B` or `refused: <reason>`; partial history lines with `data types=...`; after LEAVE: `connection closed`, `the guest is gone; partial history sends stopped` |

**Pass:** the laptop's move appears on both screens and in both logs
(captured on the laptop, applied on the PC), the laptop's history never
grows by itself (no WARNING line), and LEAVE takes the laptop to the
main menu while the PC plays on.
