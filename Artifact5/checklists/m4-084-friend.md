# Co-op test (0.8.4c): sheet for the second player

Thanks for helping. This is a free, unofficial fan mod for XCOM 2: War of
the Chosen; it isn't made or endorsed by Firaxis or 2K. You join the
host's campaign mission over Steam and play some of the soldiers. Nothing
here edits a game file.

If something looks different from this sheet, tell the host what you see;
that's useful, not a mistake.

## Before the day (about 15 minutes)
1. **Same game version.** In Steam: right-click XCOM 2, then Manage, then
   Browse local files. Go up two folders to `steamapps` and open
   `appmanifest_268500.acf` with Notepad. The `"buildid"` line should read
   `8270065`; if not, tell the host. Close it without saving.
2. **Same DLC and mods as the host** (the host sends both lists).
   - Unzip the host's zip into
     `XCOM 2\XCom2-WarOfTheChosen\XComGame\Mods\` (create `Mods` if
     needed). You should get `Mods\X2TacticalCoop\`.
   - Subscribe to [WOTC] Community Highlander on the Workshop (required),
     plus any other mod on the host's list. If you own Alien Hunters, also
     [WOTC] Alien Hunters Community Highlander; if you don't own it, don't
     use that one.
3. **Launch** with the mods on the host's list ticked, and no
   `-allowConsole`.
4. **On the main menu,** the bottom row has **CO-OP (v0.8.4c)** left of
   MULTIPLAYER. If the version differs from the host's, tell the host.

## On the day
5. Be online in Steam. Click **CO-OP**, then **JOIN (STEAM)**, then accept
   the host's invite (the notification, or Shift+Tab, then the chat).
6. The mission loads and catches up with the host's. You control the
   soldiers the host gives you.
   - **Move:** click a tile, or right-click / **M** to move to the cursor.
   - **Tab** cycles your soldiers.
   - A **FRIENDLY ACTION** banner means the host is acting; wait.
   - **CO-OP: END TURN (READY)** (top right) tells the host you're done.
7. **If you can, take one screenshot** of the top-right corner during your
   turn, and send it to the host afterwards.
8. **When the host asks:**
   - Move the Specialist next to the objective and say whether there's a
     hack icon.
   - From turn 5: click the **Co-op icon** (top right), then **FIXES**,
     and untick **Camera: follow moves (override)**.
   - Say when your screen seems behind the host's, and roughly by how
     much.
9. **After each mission** you go back to the main menu: click CO-OP, then
   JOIN (STEAM) again, and accept the host's next invite. Don't quit the
   game between missions if you can avoid it (the log restarts).
10. Tell the host anything odd: a message box (the exact words help), a
   freeze, a camera that doesn't follow.

## Afterwards
11. Quit the game. Before starting it again, send the host
    `Documents\My Games\XCOM2 War of the Chosen\XComGame\Logs\Launch.log`.
    The log includes your PC name and Windows user name; it stays on the
    host's PC and isn't published.
12. To remove the mod, delete `Mods\X2TacticalCoop`.
