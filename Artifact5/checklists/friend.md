# Co-op test: checklist for the second player

Thanks for helping test. This is an unofficial, free fan mod for XCOM 2:
War of the Chosen. It is not made or endorsed by Firaxis or 2K. The test
checks whether two players can still start a multiplayer match on the
current version of the game.

You need: XCOM 2 and War of the Chosen on Steam (Windows), and the mod
zip the host sends you. Nothing below edits a game file.

If any step looks different from what is written here, stop and tell
the host what you see. That is useful information, not a mistake.

## Part A: a few days before (about 20 minutes, alone)

1. **Same DLC.** The host sends you their DLC list. In Steam, right-click
   XCOM 2 → Properties → DLC and check that the same ones are ticked.
2. **Same game version.**
   1. In Steam, right-click XCOM 2 → Manage → Browse local files. A
      folder named `XCOM 2` opens. Keep this window; you need it again.
   2. Go up two folders to `steamapps` and open
      `appmanifest_268500.acf` with Notepad.
   3. Find the line `"buildid"`. It should say `8270065`. If it shows
      another number, tell the host and stop here.
   4. Close Notepad without saving.
3. **Steam overlay on.** Steam → Settings → In Game → the Steam Overlay
   is enabled. (The invite arrives through it.)
4. **Set your game settings aside.** With the game closed, open
   `Documents\My Games\XCOM2 War of the Chosen\XComGame\` and rename the
   folder `Config` to `Config-backup`. Don't open or change anything
   inside it. Your settings come back in Part C.
5. **Start the game once the normal way** (Steam → Play → War of the
   Chosen), wait for the main menu, and quit. This makes a fresh
   `Config` folder.
6. **Put the mod in place.**
   1. In the `XCOM 2` folder from step 2, open
      `XCom2-WarOfTheChosen\XComGame\`.
   2. If there is no folder named `Mods`, create it.
   3. Unzip the host's zip into `Mods`. You should end up with
      `Mods\X2TacticalCoop\` and files inside it.
7. **Install the Alternative Mod Launcher (AML).** Download version
   1.6.0 from https://github.com/X2CommunityCore/xcom2-launcher/releases,
   unzip it anywhere, and start it.
8. **Set up AML.**
   1. In AML's settings, add the `Mods` folder from step 6 to
      **Mod Directories**. `X2TacticalCoop` should appear in the list.
   2. Tick `X2TacticalCoop`. **Untick every other mod.**
   3. Check the launch arguments: `-review -noRedScreens` is fine.
      `-allowConsole` must **not** be there.
9. **Run War of the Chosen from AML.** If Windows Firewall asks about
   the game, allow it on **private networks**.
10. **On the main menu** there is a new **MULTIPLAYER** button at the top
    right. Click it once. After a short loading screen you should see
    the Multiplayer menu (Quick Match, Create Custom Match, Search For
    Custom Match and so on).
11. **Make a squad if you have none.** Click **Edit Squad Loadouts**. If
    the list is empty, create a squad with any soldiers and save it.
12. **Quit the game** from its menus.
13. **Send the host your log:**
    `Documents\My Games\XCOM2 War of the Chosen\XComGame\Logs\Launch.log`.
    Send it before you start the game again (each start overwrites it).
    The log includes your PC name and Windows user name. It stays on the
    host's PC and is never published.

## Part B: on the day

1. Be online in Steam. Don't change the mod, the DLC or AML's settings
   since Part A.
2. Run War of the Chosen from AML, wait for the main menu, and click
   **MULTIPLAYER**. Wait on the Multiplayer menu.
3. **Accept the host's invite** (Shift+Tab opens the Steam overlay; the
   invite is in your chat with the host). Pick your squad when asked.
   You should land in a lobby that shows both squads.
4. **If nothing happens within a minute of accepting,** tell the host.
   The backup: the host makes a public match, and you click
   **Search For Custom Match** → **Search**, then pick the host's game.
5. In the lobby, click **READY**. The host starts the match.
6. When it is your turn, move one soldier and end your turn. Play until
   the host says the test is done.
7. Tell the host anything that looked wrong: a message box (the exact
   words help), a freeze, a black screen.
8. Quit the game. If it hangs on exit, close it with Alt+F4.
9. **Send the host your `Launch.log` again** (same file as in Part A),
   before starting the game again.

## Part C: afterwards (your settings back)

1. Close the game and AML.
2. In `Documents\My Games\XCOM2 War of the Chosen\XComGame\`, rename
   `Config` to `Config-test`.
3. Rename `Config-backup` back to `Config`.
4. To remove the mod, delete the `Mods\X2TacticalCoop` folder. To play
   normally again, start the game from Steam as usual.
