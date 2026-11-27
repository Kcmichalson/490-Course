# {{DECIDED_MOD_NAME}}: setup (draft)

Two players: the host plays their own campaign, and the partner joins the
host's missions from their own PC. About 10 minutes the first time.

## Both players, before the session
1. **Same game.** XCOM 2: War of the Chosen, updated by Steam. In Steam:
   right-click XCOM 2 > Properties > Betas: none selected.
2. **Same DLC.** The host tells the partner which DLC they use.
3. **Same mods, exactly the same list.**
   - Subscribe to {{DECIDED_MOD_NAME}} on the Workshop {{WORKSHOP_LINK}}.
   - Subscribe to [WOTC] Community Highlander (required).
   - **If you own Alien Hunters:** also subscribe to [WOTC] Alien Hunters
     Community Highlander. **If you don't own it, don't use that one**: its
     own page says it can break the game without the DLC.
   - Any other mod the host uses. Load order doesn't matter; the names do.
4. **Clean setup.** No developer console (`-allowConsole` off in the
   launcher) and no hand-edited config files.
5. **Steam friends,** both online.

## Host
6. Start your campaign and launch a mission as usual.
7. In the mission, click the **Co-op icon** at the top right (left of the
   game's icons), then **CO-OP: HOST (STEAM)**. Steam's invite window
   opens: pick your partner.
8. When the partner has joined, open the Co-op icon again and use
   **CO-OP: SQUAD** to give them soldiers.
9. **CO-OP: END TURN** (or the game's own End Turn) ends XCOM's turn; it
   asks first while the partner's soldiers can still act.

## Partner
10. Start the game. The main menu's bottom row shows **CO-OP
    ({{VERSION}})** left of MULTIPLAYER. The version must match the host's.
11. Stay on the main menu and accept the host's Steam invite (the Steam
    notification, or Shift+Tab, then the chat). The mission loads by
    itself; your screen catches up with the host's. **Start the game
    before accepting**: an invite accepted while the game is closed doesn't
    work yet. If the game's own multiplayer lobby opens instead, go back
    and click **CO-OP**, then **JOIN (STEAM)**, and accept again.
12. If a message names a **version** or **mod/DLC difference**, fix that and
    join again.

## Playing (partner)
- Your soldiers are the ones the host gave you on CO-OP: SQUAD.
- Move: click a tile, or press **M** / right-click to move to the cursor.
  Tab / H cycle your soldiers.
- When the host's soldier acts, a **FRIENDLY ACTION** banner shows; wait
  until it's done.
- **CO-OP: END TURN (READY)** (under the top-right icons) tells the host
  you're done this turn.
- The **Co-op icon** opens SQUAD, NEXT SOLDIER, FIXES and **LEAVE** (back to
  the main menu at any time; the host plays on).
- If something looks broken, **CO-OP: FIXES** has switches and SAFE MODE;
  tell the host what you changed.

## Bug reports
On CO-OP: FIXES, tick **Verbose log** before playing (both players), then
send the host the file
`Documents\My Games\XCOM2 War of the Chosen\XComGame\Logs\Launch.log` right
after the game closes (the next start renames it to a `Launch-backup-...`
file in the same folder), with roughly when it happened.

## Advanced: by IP instead of Steam
On the same network: the host uses **CO-OP: HOST BY IP** (Co-op icon) and
tells the partner their PC's local IP address; the partner clicks
**CO-OP**, then **JOIN BY IP**, and types it. While it connects, the button
reads **CO-OP: CANCEL**; click it to stop. Over the internet this
needs port forwarding on the host's router; use Steam instead.
