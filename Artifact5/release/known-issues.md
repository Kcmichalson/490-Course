# {{DECIDED_MOD_NAME}}: known issues (draft)

Status as of 0.8.0b Run 2 (2026-11-20). Each line names where it's
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
| Partner: all ability icons glow | Fix in 0.8.1, untested |
| Partner: the mouse wheel doesn't change floors (F and C work) | Fix in 0.8.1, untested |
| Partner: soldiers sometimes stop short, then catch up at their next move | 0.8.1 logs the suspected cause |
| Partner: the alien turn plays longer than on the host | 0.8.1 tries a fix, untested |
| A partner-moved SPARK's BIT (and a Specialist's Gremlin) stops following; rockets start from the stuck BIT | Cause found; fix in 0.8.1, untested |
| Host's hack: the partner's game hangs on a grey tablet | Fix in 0.8.1 (hold until the result; the other player watches), untested |
| Partner: a soldier bound by a Viper can still be selected (can't act) | Fix in 0.8.1 (the game's own rule), untested |
| Partner: can't use objective access points | Open; 0.8.1 logs it |
| Partner: a path preview follows the cursor while a soldier moves | Fix in 0.8.1, untested |
| The partner banner shows during a player's own last action | Fix in 0.8.1, untested |
| Host: the camera doesn't pan to the partner's non-move actions | Fix in 0.8.1 (a short look-at), untested |
| While connected, the game runs some multiplayer rules: flanking crits are 30% for everyone, the suppression penalty and Skulljack chance change, Shadowbind copies can't act on their first turn, enemies throwing from the fog aren't revealed | Open; fixes planned without class overrides (plans/m4-plan.md) |
| While connected, quicksave and quickload are off (autosave works; the host can probably still save from the pause menu) | By design for co-op (quickload would drop the partner) |
| While connected, a few enemy visuals that the game rebuilds after a load can be missing (an Archon's Blazing Pinions in the air, Codex and Avatar warning effects, a Chryssalid cocoon); the live warnings are unaffected | Known; no fix planned |
| While connected, units created mid-mission lose some abilities; the pause menu doesn't pause | Fix in 0.8.1, untested |
| Partner: no detection warning tiles | Deferred (needs the Highlander's source in the build) |
| Partner: crash when a civilian flees (noise alert) | Fixed in 0.8.0b (tested) |
| Partner: no move range or cover icons | Fixed in 0.8.0 (tested) |
| Partner: the camera doesn't follow moving soldiers | Fixed in 0.8.0 (class override, tested) |
| Host: the partner banner shows while the host still controls a VIP | Fixed in 0.8.0 (tested) |
| Host: crash when leaving a map after the partner left | Fixed in 0.8.0 (4 missions, no crash) |
| After the partner leaves, the host controls every soldier | By design |
