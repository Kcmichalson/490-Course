# M3 Stage 3: snapshot (the laptop opens the PC's mission from its history)

For plans/m3-plan.md, Stage 3. Goal: after connecting (as in Stage 2),
the laptop asks the PC for its history, the PC sends it, and the laptop
opens the same mission in the game's own **replay mode**, so its copy
never plays by itself. Mod **0.3.2**. From this stage on, the **[WOTC]
Alien Hunters Community Highlander** is ticked on both machines (Kc,
2026-11-14).

Lines marked **(guess)** are not tested on build 8270065.

## Part A: the PC

1. **Alien Hunters Highlander:** in the Steam Workshop, subscribe to
   "[WOTC] Alien Hunters Community Highlander" if you haven't. The
   Highlander's own source lists its Workshop id as 2534737016; check the
   page title matches before subscribing.
2. Close the game and AML. Restore the clean config (plans/m2-plan.md,
   "Restoring the clean config"). Check `buildid` is `8270065`.
3. VS Code: Terminal → Run Task → Build (`*** SUCCESS! ... ***`).
4. AML: tick **X2WOTCCommunityHighlander**, **[WOTC] Alien Hunters
   Community Highlander** and **X2TacticalCoop**, nothing else.
   `-review -noRedScreens`, no `-allowConsole`.
5. Run War of the Chosen. The Highlander's Alien Hunters popup should
   no longer appear **(guess)**; note any popup's exact words. Main menu:
   CO-OP: JOIN is there. Click **MULTIPLAYER**, wait for the Multiplayer
   menu, back out, quit.
6. Copy `Launch.log` to `Artifact5\local\m3-logs\stage3-preflight-pc.log`.
7. Package (no `--force`):

   ```
   python tools\package_mod.py --mods-dir "D:\SteamLibrary\steamapps\common\XCOM 2\XCom2-WarOfTheChosen\XComGame\Mods" --version 0.3.2
   ```

   Copy `local\release\X2TacticalCoop-0.3.2.zip` and its `.sha256.txt`
   to the laptop.

## Part B: the laptop

1. With the PC's game closed, put the laptop's Steam **online** (Steam →
   Go Online) and let it download the Alien Hunters Highlander (your
   account's subscription carries over). Check `buildid` is still
   `8270065`. Then Steam → Go Offline → Restart in Offline Mode.
2. Close the game and AML. Check the zip's hash against its
   `.sha256.txt` (`Get-FileHash X2TacticalCoop-0.3.2.zip`). Delete
   `Mods\X2TacticalCoop`, unzip the 0.3.2 zip there.
3. AML: the same three mods as the PC, nothing else; same arguments.
4. Run once: CO-OP: JOIN on the main menu, note any popup, **MULTIPLAYER**
   → wait for the menu → back → quit.
5. Copy its `Launch.log` to the PC as
   `Artifact5\local\m3-logs\stage3-preflight-laptop.log`.

## Part C: pre-flight compare

```
python tools\preflight_compare.py local\m3-logs\stage3-preflight-pc.log local\m3-logs\stage3-preflight-laptop.log
```

Expected: everything the same except `MP state` (online). `Mod version`
must be 0.3.2 on both, and `Mod names` must list the same three mods on
both. Any other difference: stop and tell me.

## Part D: the test (Run 1)

Note the clock time of each step on both machines.

1. **Laptop:** run War of the Chosen from AML; wait for the main menu.
2. **PC:** run it from AML, start a Skirmish mission, wait until you
   control your soldiers. **Don't move or act at all from here to the
   end of the test**: in Stage 3 the laptop doesn't follow the PC yet,
   and an action while the history is being sent could confuse it.
3. **PC:** click **CO-OP: HOST**.
4. **Laptop:** **CO-OP: JOIN**, type the PC's IPv4 address, accept.
5. **Expected on the laptop (guess):** within about 10-20 seconds a
   loading screen, then the PC's mission map, in replay mode: the
   game's replay bar (play / fast-forward / restart buttons) instead of
   the normal soldier controls. It starts at the **beginning** of the
   mission (the game's replay starts from the mission's first frame).
   Note what you actually see, and how long the load took.
6. **Compare the two screens:** same map? same soldiers in the same
   places? the same enemies visible? (A phone photo of each helps, but
   don't post it anywhere.)
7. **Laptop only:** click the replay bar's **play** button once and
   note what happens over 30 seconds (does it step forward? does the
   camera move?). Don't click on soldiers or the map.
8. Wait one more minute. Then quit the **laptop** first (pause menu if
   it has one, otherwise Alt+F4; note which), then the PC.
9. Copy the logs before starting either game again:
   `stage3-pc-1.log` and `stage3-laptop-1.log` in
   `Artifact5\local\m3-logs\`.
10. Tell me what you saw at steps 5-8.

If the laptop never leaves the main menu after JOIN, wait two minutes,
then quit both and save the logs anyway: they show where it stopped.

## What I'll look for

| Machine | Lines |
|---|---|
| Both | `X2TC: version 0.3.2`; no `DLC_2 -- NOT LOADED` |
| PC | `Coop host: ping 1 received, pong sent`, `history request received`, `sending history, frames=N plot=<plot>`, `history sent (queued)` |
| Laptop | `pong 1 received`, `history requested`, `history received, frames=N`, `opening it in replay mode: open <plot>?game=XComGame.XComTacticalGame?LoadingSave`, the game's `LoadMap: <plot>...`, `TacticalGRI::InitBattle: StartGameState=None`, `Coop guest: replay screen opened; session kept ...`, `in replay=True` |

The two `frames=N` must match. A `Coop: replay screen opened, no guest
session found` line would mean the session object didn't survive the
map load.
