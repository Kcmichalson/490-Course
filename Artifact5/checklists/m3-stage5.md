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
