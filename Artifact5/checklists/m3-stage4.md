# M3 Stage 4: live follow, view only (the laptop watches the PC play)

For plans/m3-plan.md, Stage 4. Goal: the laptop opens the PC's mission
as in Stage 3, catches up to the PC's latest moment, and then follows
every action the PC and the aliens take, while only the PC plays. Mod
**0.3.3**. Same three mods as Stage 3 on both machines.

This is also the first real test of Mr.Fear's warning that heavy game
history (AI activity) can freeze the second machine, so the run must
include **at least one pod activation and an alien turn in which
activated enemies act**. The PC's log records the frames and bytes of
every send.

Lines marked **(guess)** are not tested on build 8270065.

## Part A: build, install, pre-flight

1. **PC:** clean config, `buildid` 8270065, Build, AML with the three
   mods (X2WOTCCommunityHighlander, [WOTC] Alien Hunters Community
   Highlander, X2TacticalCoop). Run: main menu → **MULTIPLAYER** → back →
   quit. Copy `Launch.log` to `local\m3-logs\stage4-preflight-pc.log`.
2. **PC:** package (no `--force`):

   ```
   python tools\package_mod.py --mods-dir "D:\SteamLibrary\steamapps\common\XCOM 2\XCom2-WarOfTheChosen\XComGame\Mods" --version 0.3.3
   ```

   Copy `X2TacticalCoop-0.3.3.zip` and its `.sha256.txt` to the laptop.
3. **Laptop** (Steam offline): hash check, delete `Mods\X2TacticalCoop`,
   unzip 0.3.3. Run: main menu → **MULTIPLAYER** → back → quit. Copy its
   `Launch.log` to the PC as `local\m3-logs\stage4-preflight-laptop.log`.
4. **PC:**

   ```
   python tools\preflight_compare.py local\m3-logs\stage4-preflight-pc.log local\m3-logs\stage4-preflight-laptop.log
   ```

   Only `MP state` may differ; `Mod version` 0.3.3 on both.

## Part B: the test (Run 1)

Keep a note of the clock time at each step on both machines, and of
anything that looks different between the two screens. **Don't click
anything on the laptop's map or soldiers** during the whole test (it is
view only; Stage 5 is the first stage where the laptop acts).

1. **Laptop:** run the game; wait for the main menu.
2. **PC:** run the game, start a Skirmish mission, wait until you control
   your soldiers. **Don't act yet.** Click **CO-OP: HOST**.
3. **Laptop:** **CO-OP: JOIN**, the PC's IPv4 address, accept.
4. **Expected on the laptop (guess):** loading screen, the map, then the
   mission replaying quickly from its first moment up to where the PC is.
   **No replay bar and no "Challenge Scoring" screen** this time. When
   the laptop's camera stops moving, it has caught up.
5. **Screenshot 1 (both screens, same moment):** once the laptop has
   caught up and nothing moves on either screen for about 5 seconds.
6. **PC:** play normally. Move soldiers, shoot, end your turn, and watch
   the alien turn. Wait after each of your actions until the laptop shows
   it too before the next action (note roughly how many seconds behind
   the laptop is).
7. Keep playing until **all** of these have happened:
   - at least **three full XCOM turns**, each followed by an alien turn;
   - **a pod activation**: enemies revealed (the camera shows the pod and
     they scamper to cover);
   - **one alien turn after that activation in which those enemies act**
     (move, shoot or use abilities).
8. **Screenshot 2 (both screens):** right after the first pod activation,
   once the PC is waiting for your next order and the laptop shows the
   same revealed enemies and has stopped moving.
9. **Screenshot 3 (both screens):** at the start of the first XCOM turn
   after an alien turn in which activated enemies acted, once both
   screens have stopped moving.
10. **Screenshot 4 (both screens):** just before quitting.
11. **If the laptop freezes, falls far behind, or shows something
    different from the PC** (a soldier in another place, an enemy alive on
    one and dead on the other): note the clock time and what differs,
    take a screenshot of both, play one more XCOM turn on the PC, then go
    to step 12.
12. Quit the **laptop** first (its pause menu; Alt+F4 only if it is
    frozen, and say so), then the PC.
13. Copy the logs before starting either game again:
    `stage4-pc-1.log` and `stage4-laptop-1.log` in `local\m3-logs\`.
    Put the screenshots in `local\m3-logs\` too, named like
    `stage4-shot2-pc.png` and `stage4-shot2-laptop.png` (they stay
    local; `local\` is never committed).
14. Tell me: how far behind the laptop was (normal turns and the alien
    turn after the activation), anything that differed, any freeze, and
    which screenshots you took.

## What I'll look for

| Machine | Lines |
|---|---|
| Both | `X2TC: version 0.3.3` |
| PC | `history sent (queued), frames=N, queued bytes=B in K bunches`; `guest is following (its replay started at frame F)`; per send: `partial history N sent, frames A -> B (+D), during team T turn N, queued bytes=B in K bunches`, then `partial history N acknowledged after Ss; guest frames=B sent frames=B match=True`; `Coop sync (host): turn begin, team T turn count N, frame F` |
| Laptop | `follower installed (replaced XComReplayMgr)`, `closing the stock replay screen`, `Coop follower: starting replay at frame F of N`, `follow mode on`, `partial history N received, frames=B`, `replayed to frame B-1`, `Coop sync (guest): turn begin, ...` with the same frames as the host's |

**Pass (SPEC.md M3's Stage 4 part):** three full turns with the alien
turns, every `Coop sync` line on the PC matched by the same line on the
laptop, every partial history acknowledged with `match=True`, and the
screenshots showing the same scene. The bytes per send (and the alien
turn's in particular) are recorded either way, for Mr.Fear's warning.
