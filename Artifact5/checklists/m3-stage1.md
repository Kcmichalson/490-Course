# M3 Stage 1: the solo test loop (PC + laptop in Steam offline mode)

For plans/m3-plan.md, Stage 1, option 1. Goal: both games running at the
same time on one Steam account (PC online, laptop offline), with the same
mod build, ready for Stage 2's direct-IP connection. No new code: the
only change since 0.2.0 is the version number (0.3.0).

Lines marked **(guess)** are not tested on build 8270065.

## Part A: the PC (build and package 0.3.0)

1. Close the game and AML. Restore the clean config (plans/m2-plan.md,
   "Restoring the clean config").
2. Check `buildid` in `D:\SteamLibrary\steamapps\appmanifest_268500.acf`
   is `8270065`.
3. VS Code (`mod` folder): Terminal → Run Task → Build. It must end with
   `*** SUCCESS! ... ***` and `X2TacticalCoop ready to run.`
4. AML: only **X2TacticalCoop** ticked (the Highlander stays **unticked**
   in Stage 1; it is first ticked in Stage 2), `-review -noRedScreens`,
   `-allowConsole` off. Run War of the Chosen, wait for the main menu,
   quit. (Checks the build loads before packaging.)
5. Package (PowerShell, from the Artifact5 folder):

   ```
   python tools\package_mod.py --mods-dir "D:\SteamLibrary\steamapps\common\XCOM 2\XCom2-WarOfTheChosen\XComGame\Mods" --version 0.3.0
   ```

   It must write `local\release\X2TacticalCoop-0.3.0.zip` and
   `X2TacticalCoop-0.3.0.sha256.txt`. If it stops, send me its message.
6. Copy the zip to the laptop (USB stick or a network share, your
   choice). Don't build again on the PC after this step.

## Part B: the laptop, set up while Steam is online

1. Steam online, logged in to your account, **with "Remember my
   password" on** (offline mode needs it).
2. Let Steam finish updating XCOM 2 and the Workshop items. The
   Highlander (v1.32.0) should download because your account is
   subscribed; you don't tick it yet.
3. Build ID: Steam → XCOM 2 → Manage → Browse local files → up two
   folders to `steamapps` → open `appmanifest_268500.acf` in Notepad.
   `"buildid"` must be `8270065`. Close without saving.
4. DLC: Steam → XCOM 2 → Properties → DLC. The installed list must match
   the PC's (your M2 baseline list).
5. Set the laptop's game settings aside (game closed): in
   `Documents\My Games\XCOM2 War of the Chosen\XComGame\`, rename
   `Config` to `Config-backup`. Don't open or change anything inside it.
6. Start War of the Chosen once from Steam, wait for the main menu, quit.
   This makes a fresh `Config`.
7. Mod: in the game folder, `XCom2-WarOfTheChosen\XComGame\`, create
   `Mods` if it isn't there, and unzip `X2TacticalCoop-0.3.0.zip` into it
   so you get `Mods\X2TacticalCoop\`.
8. AML 1.6.0 from https://github.com/X2CommunityCore/xcom2-launcher/releases:
   unzip, start, add the `Mods` folder from step 7 to **Mod
   Directories**. Tick only **X2TacticalCoop**, untick everything else
   (the Highlander included). Launch arguments `-review -noRedScreens`,
   no `-allowConsole`.
9. Run once from AML while still online: main menu → **MULTIPLAYER** →
   the Multiplayer menu → quit the game. If Windows Firewall asks, allow
   **private networks**. (This is the laptop's online reference run.)
10. Copy the laptop's
    `Documents\My Games\XCOM2 War of the Chosen\XComGame\Logs\Launch.log`
    to the PC as `Artifact5\local\m3-logs\stage1-laptop-online.log`
    before starting the game again.
11. Steam menu → **Go Offline...** → **Restart in Offline Mode**. Steam
    should come back saying it is offline.

## Part C: both at once

Note the clock time of each step on both machines.

1. **Laptop (offline):** run War of the Chosen from AML. Wait for the main
   menu. Note any Steam or game message, word for word.
2. **PC (online):** run War of the Chosen from AML. Wait for the main
   menu. Note any Steam message (for example about the account playing
   elsewhere) **(guess: none, because the laptop is offline)**.
3. **Laptop:** click **MULTIPLAYER**. Note what happens: the Multiplayer
   menu, a "no network" dialog (exact words), or nothing. Then back to the
   main menu.
4. **PC:** click **MULTIPLAYER** → the Multiplayer menu → back to the main
   menu.
5. **PC:** start a Skirmish mission: main menu → Tactical Legacy Pack
   item → Skirmish → any map and squad → start. Play one turn (move a
   soldier, end turn) and let the aliens move.
6. **Laptop:** leave it on the main menu throughout step 5. Both games
   should still be running when the PC's alien turn ends.
7. Quit both games from their menus. Close the laptop's Steam offline
   mode only after copying its log (next part).

## Part D: logs and pre-flight

1. Copy the PC's `Launch.log` to `Artifact5\local\m3-logs\stage1-pc.log`.
2. Copy the laptop's `Launch.log` to
   `Artifact5\local\m3-logs\stage1-laptop.log`.
3. Compare (PowerShell, from the Artifact5 folder):

   ```
   python tools\preflight_compare.py local\m3-logs\stage1-pc.log local\m3-logs\stage1-laptop.log
   ```

4. Expected: every line the same **except** possibly `MP state` (the
   online check), which may differ because the laptop is offline
   **(guess)**. Any other `DIFFERENT` line (mod version, mod or DLC
   names, hashes, executable, dev console) must be fixed before Stage 2.
   If the laptop never reached the Multiplayer menu offline, the `MP
   criteria` lines will be `(missing)` for it; then compare
   `stage1-pc.log` with `stage1-laptop-online.log` instead and tell me.
5. Restore the laptop's settings when you're done testing for the day:
   rename `Config` to `Config-test`, `Config-backup` back to `Config`.

## Part E: report to me

- Build ID on both machines.
- What each machine showed in Part C, with the exact words of any message.
- Whether both games stayed running together through step 6.
- The compare output (or just tell me it's done; I'll read the logs
  myself).

## Pass

Both games run at once with the PC online and the laptop offline, the
Skirmish turn completes on the PC, and the compare shows only the
expected difference. Direct IP itself is Stage 2. If Steam refuses to
run both, or the laptop's game won't start offline, Stage 1 moves to
option 2 (two instances on the PC), which needs the CLAUDE.md changes
listed in plans/m3-plan.md first.
