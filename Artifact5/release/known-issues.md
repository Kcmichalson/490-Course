# {{DECIDED_MOD_NAME}}: known issues (draft)

Status as of 0.8.1 Run 1 (2026-11-21); 0.8.2 built 2026-11-22, not yet
tested (checklists/m4-082.md). Each line names where it's
tracked; update after every test (checklists/, LOG.md).

## Limits by design
- Two players only.
- The host's campaign only: the strategy layer is the host's, and only the
  host saves.
- The partner can't rejoin a mission after leaving or losing the
  connection; the host plays on alone.
- VIPs, civilians and other non-soldier units are always the host's; they
  don't appear on CO-OP: SQUAD.
- Both PCs need the same mods and DLC.

## Open issues
| Issue | Status |
|---|---|
| Long missions get slower for the partner: every update the host sends grows with the mission (up to about 400 KB in M3 tests) | Known; optimization planned after 1.0 |
| On the partner's own hack, its screen may show a result its game didn't roll; the host's game decides the real result | Open (not in 0.8.1) |
| Partner: the mouse wheel doesn't change floors (F and C work) | 0.8.1: no wheel input reached the game on a laptop touchpad; retest with a USB mouse in 0.8.2 |
| Partner: can't pause while none of its soldiers can act | Fix in 0.8.2 (Escape opens the pause menu); untested |
| Partner: can't hack objectives (no hack icon); the same soldier can when given to the host | 0.8.2 logs the cause (guess: map objects linked to the wrong states) and has a repair switch; untested |
| Host's hack: the partner can still click its copy and see its own result (the host's game ignores it) | Fix in 0.8.2 (the watcher's copy takes no clicks); untested |
| Host: the camera doesn't pan to the partner's non-move actions | Fix in 0.8.1 (a short look-at); logged, not yet confirmed on screen |
| Partner: all ability icons glow | Fixed in 0.8.1 (tested) |
| Partner: soldiers sometimes stop short, then catch up at their next move | Not seen in 0.8.1 (tested) |
| Partner: the alien turn plays longer than on the host | Much better in 0.8.1 (about 1 s; tested) |
| A partner-moved SPARK's BIT (and a Specialist's Gremlin) stops following; rockets start from the stuck BIT | Fixed in 0.8.1 (tested) |
| Host's hack: the partner's game hangs on a grey tablet | Fixed in 0.8.1 (tested) |
| Partner: a soldier bound by a Viper can still be selected (can't act) | Fixed in 0.8.1 (tested) |
| Partner: a path preview follows the cursor while a soldier moves | Fixed in 0.8.1 (tested) |
| The partner banner shows during a player's own last action | Fixed in 0.8.1 (tested) |
| While connected, the game runs some multiplayer rules: flanking crits are 30% for everyone, the suppression penalty and Skulljack chance change, Shadowbind copies can't act on their first turn, enemies throwing from the fog aren't revealed | Fixes in 0.8.2, no class overrides (the shot breakdown shows extra "Flanking (co-op)" lines); untested |
| While connected, quicksave and quickload are off (autosave works; the host can probably still save from the pause menu) | By design for co-op (quickload would drop the partner) |
| While connected, a few enemy visuals that the game rebuilds after a load can be missing (an Archon's Blazing Pinions in the air, Codex and Avatar warning effects, a Chryssalid cocoon); the live warnings are unaffected | Known; no fix planned |
| While connected, the pause menu doesn't pause | Fixed in 0.8.1 (tested) |
| While connected, units created mid-mission lose some abilities | Fix in 0.8.1; untested (no reinforcements in the Skirmish runs) |
| Partner: no detection warning tiles | Deferred (needs the Highlander's source in the build) |
| Partner: crash when a civilian flees (noise alert) | Fixed in 0.8.0b (tested) |
| Partner: no move range or cover icons | Fixed in 0.8.0 (tested) |
| Partner: the camera doesn't follow moving soldiers | Fixed in 0.8.0 (class override, tested) |
| Host: the partner banner shows while the host still controls a VIP | Fixed in 0.8.0 (tested) |
| Host: crash when leaving a map after the partner left | Fixed in 0.8.0 (4 missions, no crash) |
| After the partner leaves, the host controls every soldier | By design |
| Tactical saves made while the mod is enabled (co-op or not) contain its hidden "co-op rules" ability. Loading one without the mod: from source, the game warns and offers "Load anyway", and the save holds only the ability's name; strategy (Avenger) saves don't contain it | Untested; release checklist "Save without the mod". If it only warns: "Don't add or remove the mod mid-mission; between missions is fine" |
