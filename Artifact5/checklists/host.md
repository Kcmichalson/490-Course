# Co-op test: checklist for the host (Kc)

For the live test of rows 8-11 in plans/m2-plan.md
(plans/m2-live-test-plan.md, Steps 3-6). The second player follows
checklists/friend.md. Lines marked **(untested)** come from the SDK
source or the game's text files, not from a run on build 8270065.

Rule for the whole test: **host and friend run the same build of the
mod.** After packaging (Part 1, step 9), don't build again. If you do,
package again with a new version and resend.

## Part 1: the shared build, alone (before sending anything)

1. Close the game and AML. Restore the clean config (plans/m2-plan.md,
   "Restoring the clean config": rename `Config`, new `Config` with the
   46 .ini files from `local\config-backup-before-AML\`).
2. Check `buildid` in `D:\SteamLibrary\steamapps\appmanifest_268500.acf`
   is still `8270065`.
3. VS Code (`mod` folder): Terminal → Run Task → Build. It must end with
   `*** SUCCESS! ... ***` and `X2TacticalCoop ready to run.`
4. AML: only X2TacticalCoop ticked, `-review -noRedScreens`,
   `-allowConsole` off. Run War of the Chosen.
5. Main menu: **one** button at the top right, MULTIPLAYER. No MP TEST
   buttons (this is the shared build).
6. Click MULTIPLAYER → the Multiplayer menu.
7. Create Custom Match → Lobby Type LAN → Launch Game → pick a squad →
   the lobby. **Wait a full 10 seconds.** BACK → CONFIRM EXIT. You
   should land on the Multiplayer menu. Quit the game.
8. Copy `Launch.log` to `Artifact5\local\m2-logs\preflight-host.log` and
   have it read. It must show `X2TC: version 0.2.0`, the `MP criteria`
   lines, `X2TC: Lobby opened` and `X2TC: Lobby poll timer running`
   (the last one proves the trace timers work; Stage 1e could not).
9. Package (from the Artifact5 folder):

   ```
   python tools\package_mod.py --mods-dir "D:\SteamLibrary\steamapps\common\XCOM 2\XCom2-WarOfTheChosen\XComGame\Mods" --version 0.2.0
   ```

   It stops if the source changed since the build, if the version
   differs, or if this is the test build. It writes
   `local\release\X2TacticalCoop-0.2.0.zip` and
   `X2TacticalCoop-0.2.0.sha256.txt`.
10. Send the friend: the zip, checklists/friend.md, and your DLC list
    (Steam → XCOM 2 → Properties → DLC).

## Part 2: pre-flight (after the friend's Part A)

1. Save the friend's log as `Artifact5\local\m2-logs\preflight-guest.log`.
   It holds their PC and user name: it stays in `local\`.
2. Compare (from the Artifact5 folder):

   ```
   python tools\preflight_compare.py local\m2-logs\preflight-host.log local\m2-logs\preflight-guest.log
   ```

3. It must end with `READY`. Every `DIFFERENT` line is a reason the
   games may refuse each other: fix it before the session (DLC list,
   other mods ticked, another game build, `-allowConsole`, an older zip).
4. Both of you can see each other online in Steam's friends list.

## Part 3: the session

Don't rebuild. Keep a note of the clock time of each step; it helps to
match the two logs.

1. Restore the clean config; check `buildid` is `8270065` (a Steam
   update since Part 1 means: stop, both check again).
2. AML as in Part 1, run, MULTIPLAYER.
3. Create Custom Match → Lobby Type **Private** → Launch Game → pick a
   squad → the lobby.
4. Check the friend is on their Multiplayer menu, then invite them:
   Shift+Tab → friends list → right-click the friend → Invite to game
   (seen in Stage 1d). The lobby may also have an INVITE FRIENDS button
   **(untested)**.
5. **Row 9:** the friend's squad appears in the lobby. Note what the
   lobby shows for them.
6. Both click READY **(untested)**; then START GAME **(untested)**.
7. **Row 10:** a loading screen, then the tactical map on both PCs.
8. **Row 11:** one full turn each: move a soldier, end the turn, watch
   the friend do the same. Note who went first and any message box
   (exact words).
9. Exit through the pause menu. In Stage 1e's test map the exit hung on
   "Preparing to exit online match..."; if it hangs, Alt+F4.
10. Copy your `Launch.log` to `Artifact5\local\m2-logs\live-host.log`.
    Save the friend's as `live-guest.log`.
11. Report: the build ID, what happened at each step on both PCs, and
    any dialog text.

## If the invite fails (row 8 by the backup route)

1. Leave the lobby (BACK → CONFIRM EXIT).
2. Create Custom Match → Lobby Type **Public** → Launch Game → squad →
   lobby.
3. The friend: Search For Custom Match → Search → pick your game
   **(untested with two players)**.
4. Continue at Part 3, step 5. Say in the report which route worked.

## What each failure would point to

| Stops at | Look at |
|---|---|
| The friend never gets or can't accept the invite | Steam overlay; friend's `X2TC: Invite ...` lines |
| Invite accepted, nothing follows | Friend's `Invite check: kept by the game=...`; a `False` means the game rejected it: compare the `MP criteria` lines |
| Friend's game not in the search list | Both `MP criteria` lines; firewall |
| Friend never appears in the lobby | Host's `Lobby state: players=... opponent joined=...` |
| START GAME does nothing or hangs | `LoadMap: ...XComMPTacticalGame` on each side |
| Map loads, no turns | `Tactical HUD opened`, `Turn poll ...`, `Turn start: ...` on each side |
| Disconnect mid-match | `screen UIMultiplayerDisconnectPopup` |
