# M3 Stage 2: connect (PC hosts from a Skirmish mission, laptop joins by IP)

For plans/m3-plan.md, Stage 2. Goal: the two games connect directly
(no lobby, no Steam invite) and exchange a ping and a pong. Nothing
visible happens in the game when it works; the result is in the two
Launch.logs. **This is also the first run of the mod with the Community
Highlander on** (all M2 results were without it), so a failure here may
come from the Highlander: Run 2 (only if I ask) repeats it with the
Highlander off.

Lines marked **(guess)** are not tested on build 8270065.

## Part A: the PC (build and package)

1. Close the game and AML. Restore the clean config (plans/m2-plan.md,
   "Restoring the clean config").
2. Check `buildid` in `D:\SteamLibrary\steamapps\appmanifest_268500.acf`
   is `8270065`.
3. VS Code (`mod` folder): Terminal → Run Task → Build. It must end with
   `*** SUCCESS! ... ***` and `X2TacticalCoop ready to run.` If it fails,
   send me the first error line.
4. AML: tick **X2WOTCCommunityHighlander** and **X2TacticalCoop**,
   nothing else. `-review -noRedScreens`, `-allowConsole` off. Run War of
   the Chosen and wait for the main menu: **MULTIPLAYER** at the top right
   and, further down the same column, **CO-OP: JOIN**. If the Highlander
   shows a popup about missing or incompatible mods, write down its exact
   words. Quit.
5. Package (PowerShell, from the Artifact5 folder):

   ```
   python tools\package_mod.py --mods-dir "D:\SteamLibrary\steamapps\common\XCOM 2\XCom2-WarOfTheChosen\XComGame\Mods" --version 0.3.0 --force
   ```

   The version stays 0.3.0, so `--force` is needed to replace Stage 1's
   zip; without it the script stops with "... already exists" and the old
   zip stays in place (the first attempt at this stage sent the Stage 1
   zip this way). It must end by writing the zip; check that
   `local\release\X2TacticalCoop-0.3.0.zip` now has today's date. Copy
   `local\release\X2TacticalCoop-0.3.0.zip` and
   `X2TacticalCoop-0.3.0.sha256.txt` to the laptop. Don't build again
   after this step.

## Part B: the laptop (Steam stays offline)

1. Close the game and AML.
2. Check the zip is the new one (PowerShell, in the folder you copied it
   to):

   ```
   Get-FileHash X2TacticalCoop-0.3.0.zip
   ```

   The hash must equal the zip's line in `X2TacticalCoop-0.3.0.sha256.txt`.
3. Delete the old `Mods\X2TacticalCoop` folder in the game's
   `XCom2-WarOfTheChosen\XComGame\` folder, then unzip the new zip there.
4. AML: tick **X2WOTCCommunityHighlander** and **X2TacticalCoop**,
   nothing else (if the Highlander isn't listed, stop and tell me: it
   needs Steam online once to download). Same launch arguments as the PC.
5. Run once to the main menu: **CO-OP: JOIN** must be there, as on the
   PC. If it isn't, the laptop has an older build: quit and tell me
   before going on. The Highlander's popup recommending the Alien Hunters
   compatibility mod can be closed; leave that mod off on both machines
   for now.

## Part C: Run 1 (Highlander on, dotted address)

Note the clock time of each step on both machines.

1. **PC:** in PowerShell run `ipconfig` and note the **IPv4 Address** of
   the adapter connected to your home network (like `192.168.x.y`). Keep
   it to yourself; I don't need it, and the mod never logs it.
2. **Laptop:** run War of the Chosen from AML; wait for the main menu.
3. **PC:** run War of the Chosen from AML (pick "this device" if Steam
   asks). Main menu → Tactical Legacy Pack item → Skirmish → any map and
   squad → start. Wait until you control your soldiers.
4. **PC:** click **CO-OP: HOST** (near the top right of the tactical
   screen). It should turn into a greyed-out **CO-OP: HOSTING**. If
   Windows Firewall asks about the game, allow **private networks**
   (Alt+Tab if the prompt is hidden behind the game). Note whether it
   asked.
5. **Laptop:** click **CO-OP: JOIN**. A text box titled **CO-OP: HOST
   ADDRESS** opens. Type the PC's IPv4 address exactly (dots included)
   and accept.
6. Wait **one minute** on both machines without clicking anything.
   Nothing should change on either screen **(guess)**. Note anything that
   does: a dialog (exact words), a loading screen, the laptop's main
   menu reloading, a freeze.
7. **PC:** move one soldier (to see the mission still plays), then quit
   the game from the pause menu. **Laptop:** quit the game.
8. Copy the logs before starting either game again:
   - PC: `Launch.log` → `Artifact5\local\m3-logs\stage2-pc-1.log`
   - Laptop: `Launch.log` → `Artifact5\local\m3-logs\stage2-laptop-1.log`
9. Tell me the logs are there, plus anything you noted. I'll say what
   comes next: Stage 3 if it connected, or another run (the one-number
   address form, or Run 2 with the Highlander off) if it didn't.

## Run 1b (after the poll-timer fix, 2026-11-14)

Run 1 connected but sent no ping: the mod's once-a-second timer was
refused by the game. After the fix:
1. Part A steps 3-5 (build, load check, package with `--force`) on the PC.
2. Part B steps 1-5 on the laptop (new zip, hash check, unzip, CO-OP:
   JOIN visible).
3. Part C steps 1-8 again, saving the logs as `stage2-pc-2.log` and
   `stage2-laptop-2.log`.

On screen it looks the same as Run 1; the difference is in the logs.

## What I'll look for

| Machine | Lines |
|---|---|
| Both | `X2TC: version 0.3.0`; the Highlander's own lines at startup (it loaded) |
| PC | `Coop: HOST button added`, `Coop host: server created (port 7777)`, `Coop host: connection accepted`, `Coop host: ping N received, pong sent` |
| Laptop | `Coop: JOIN button added`, `Coop: address entered (form: dotted)`, `Coop guest: client created (address form: dotted)`, `connection attempt ...`, `Coop guest: connected`, `ping N sent`, `pong N received` |

A `Coop ...: state server=... client=... connections=N` line on each side
shows the network manager's own view each time it changes.
