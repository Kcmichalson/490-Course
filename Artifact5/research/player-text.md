# Player-visible text (0.8.5)

All the text the mod shows a player with the release layout (`RELEASE_UI = true`).
None of it is in `Localization/X2TacticalCoop.int` yet: every string is written
directly in the `.uc` files listed (paths under
`mod/X2TacticalCoop/Src/X2TacticalCoop/Classes/`; line numbers as of 2026-11-25).

**How to use:** write your wording in the **New text** column and leave it blank to
keep a line as it is. Keep the `{...}` parts: the mod fills them in.
- `{v}` is the version tag, e.g. `(v0.8.5)`.
- Partner = the client / guest (P2); host = P1.

## 1. Main menu: joining (partner)

| # | Where | What it is | Current text | New text |
|---|---|---|---|---|
| 1 | CoopMenuBar.uc:86 | Main menu row button | `CO-OP {v}` | |
| 2 | CoopMenuBar.uc:86 | Same button while a JOIN BY IP is connecting (click cancels) | `CO-OP: CANCEL` | |
| 3 | CoopMenuBar.uc:161 | Popup title (after clicking CO-OP) | `CO-OP {v}` | |
| 4 | CoopMenuBar.uc:162 | Popup text | `Join a friend's co-op mission. JOIN (STEAM): then accept the host's Steam invite. JOIN BY IP: on the same network, type the host's address.` | `Join a friend's co-op mission` (applied) |
| 5 | CoopMenuBar.uc:163 | Popup button 1 | `JOIN (STEAM)` | |
| 6 | CoopMenuBar.uc:164 | Popup button 2 | `JOIN BY IP` | |
| 7 | CoopMenuBar.uc:189 | Address box title (JOIN BY IP) | `CO-OP: HOST ADDRESS` | |
| 8 | CoopSession.uc:688 | Popup after JOIN (STEAM), title | `CO-OP: JOIN (STEAM)` | |
| 9 | CoopSession.uc:688 | ... text | `Now accept the host's invite in Steam (the notification, or Shift+Tab, Friends, then the invite). The co-op mission loads by itself.` | `Accept the host's invite through Steam.` (applied) |
| 10 | CoopSession.uc:2305 | OK button on every partner popup (8-9, 11-21) | `OK` | |

## 2. Joining errors (partner popups)

| # | Where | When | Current text | New text |
|---|---|---|---|---|
| 11 | CoopSession.uc:787 | Steam invite unusable, title / text | `CO-OP: STEAM` / `The invite could not be used. Ask the host to invite you again, then click CO-OP: JOIN (STEAM) first.` | `CO-OP: STEAM` / `The invite is expired or invalid.` (applied) |
| 12 | CoopSession.uc:796 | Steam join didn't start | `CO-OP: STEAM` / `Joining the host's Steam session failed to start. See Launch.log (X2TC lines).` | |
| 13 | CoopSession.uc:816 | Steam join failed | `CO-OP: STEAM` / `Joining the host's Steam session failed. Ask the host to invite you again.` | `CO-OP: STEAM` / `The invite is expired or invalid.` (applied) |
| 14 | CoopSession.uc:823 | No host address from Steam | `CO-OP: STEAM` / `Steam gave no address for the host. See Launch.log (X2TC lines).` | |
| 15 | CoopSession.uc:1793 | BY IP: no answer (`{N}` = 6) | `CO-OP: COULDN'T CONNECT` / `No answer from the host after {N} tries. Check the address and that the host clicked CO-OP: HOST BY IP, then click CO-OP: JOIN BY IP again.` | |
| 16 | CoopSession.uc:2165 | Different mod builds | `CO-OP: VERSION MISMATCH` / `This PC runs X2TacticalCoop {this version} and the host runs {host version}. Install the same build on both and join again.` | |
| 17 | CoopSession.uc:2172 | Different mods/DLC | `CO-OP: DIFFERENT MODS OR DLC` / `Both games need the same mods and DLC (the order doesn't matter). {difference}.` | |
| 18 | CoopSession.uc:2267-2279 | The `{difference}` in 17 | `Host only: {list}` · `; ` · `This PC only: {list}` · or `the lists differ (empty list from an older build?)` | |

## 3. Tactical HUD: host

| # | Where | What it is | Current text | New text |
|---|---|---|---|---|
| 19 | CoopMenu.uc:67 | Co-op icon tooltip (top right) | `Co-op: squad, end turn, fixes and more` | |
| 20 | CoopListener.uc:194 | Panel item / its tooltip | `CO-OP: HOST (STEAM) {v}` / `Host this mission and invite a Steam friend` | |
| 21 | CoopListener.uc:324 | Same item after clicking it | `CO-OP: INVITE (STEAM) {v}` | |
| 22 | CoopListener.uc:195 | Panel item / tooltip | `CO-OP: HOST BY IP {v}` / `Host on your network; the partner joins with your IP address` | tooltip: `Host on your network, share your IPv4 address to let others join.` (applied; label unchanged) |
| 23 | CoopListener.uc:428 | Same item after clicking it (greyed out) | `CO-OP: HOSTING {v}` | |
| 24 | CoopListener.uc:196 | Panel item / tooltip (shown once hosting) | `CO-OP: SQUAD` / `Give soldiers to the partner or take them back` | |
| 25 | CoopListener.uc:197 | Panel item / tooltip (shown once hosting) | `CO-OP: END TURN` / `End XCOM's turn (asks first while the partner's soldiers can act)` | |
| 26 | CoopListener.uc:198 | Panel item / tooltip | `CO-OP: FIXES` / `Co-op fixes on this PC; turn one off only if it misbehaves` | |
| 27 | CoopSession.uc:615 | Host popup: Steam session failed (title / text) | `CO-OP: STEAM` / `The Steam game session could not be created. Check that Steam is online, then try again.` | |
| 28 | CoopSession.uc:620 | Host popup: server didn't start | `CO-OP: STEAM` / `The co-op server could not start over Steam. See Launch.log (X2TC lines).` | |
| 29 | CoopListener.uc:413 | Status line: HOST in the tutorial | `Co-op isn't available in the tutorial mission` | |
| 30 | CoopSession.uc:1392-1395 | End-turn dialog: title / text / buttons | `CO-OP: END TURN?` / `Your partner's soldiers can still act. End the turn anyway?` / `End turn` / `Cancel` | |
| 31 | CoopSession.uc:1106 | Status line: host's soldiers done | `Your soldiers are done; your partner's turn` | `Your partner has remaining actions.` (applied) |
| 32 | CoopSession.uc:2043 | Status line: partner pressed END TURN (READY) | `Partner is ready to end the turn` | |

## 4. Tactical HUD: partner

| # | Where | What it is | Current text | New text |
|---|---|---|---|---|
| 33 | CoopListener.uc:183, TurnUI.uc:155 | End-turn button (always on screen) | `CO-OP: END TURN (READY)` | |
| 34 | TurnUI.uc:151 | Same button when "Partner may end the turn" is on | `CO-OP: END TURN` | |
| 35 | CoopListener.uc:184 | Panel item / tooltip | `CO-OP: SQUAD` / `Who controls which soldier (the host changes it)` | |
| 36 | CoopListener.uc:185 | Panel item / tooltip | `CO-OP: NEXT SOLDIER` / `Select your next soldier that can act (Tab works too)` | |
| 37 | CoopListener.uc:186 | Panel item / tooltip | `CO-OP: FIXES` / `Co-op fixes on this PC; turn one off only if it misbehaves` | |
| 38 | CoopListener.uc:187 | Panel item / tooltip | `CO-OP: LEAVE {v}` / `Leave the mission; the host plays on alone` | |
| 39 | CoopSession.uc:1218, 1467 | Status line after READY | `Waiting for the host to end the turn` | |
| 40 | CoopSession.uc:1234 | Status: refused move/ability | `Refused: that soldier belongs to the host` | |
| 41 | CoopSession.uc:1238 | ... | `Refused: it isn't XCOM's turn` | |
| 42 | CoopSession.uc:1242 | ... | `Refused: the host was busy; try again` | |
| 43 | CoopSession.uc:1246 | ... any other reason (see 51) | `Refused by the host: {reason}` | |
| 44 | TurnUI.uc:31 | Turn banner (both players) when the other player acts | `FRIENDLY ACTION` | |
| 45 | TurnUI.uc:33 | Turn banner: partner has no soldiers | `NO SOLDIERS ASSIGNED` | |
| 46 | HackListener.uc:75 | Button on the partner's own hack screen | `CO-OP: CANCEL HACK` | |
| 47 | CoopSession.uc:2377 | Mission end popup: title / text | `CO-OP: MISSION OVER` / `{result}. The results stay in the host's campaign. This game returns to the main menu.` | text: `{result}. Returning to main menu.` (applied) |
| 48 | CoopSession.uc:3090-3096 | `{result}` in 47 | `XCOM won` · `XCOM lost` · `result unknown (no battle data)` | |
| 49 | CoopSession.uc:3241 | Host lost: title / text | `CO-OP: HOST DISCONNECTED` / `The connection to the host was lost. This game returns to the main menu.` | text: `The connection to the host was lost. Returning to main menu.` (applied) |
| 50 | CoopSession.uc:2337 | Button on 47 and 49 | `Main menu` | |
| 51 | CoopSession.uc:3680-4030 | `{reason}` in 43: technical texts from the host | e.g. `no path in range to tile {x,y,z}`, `path has fewer than 2 tiles`, `{ability} not available: {code}`, `target {id} is not a valid target of {ability} on the host`, `GameStateMoveUnit returned false` | |

## 5. Co-op squad screen (both)

| # | Where | Current text | New text |
|---|---|---|---|
| 52 | CoopSquadScreen.uc:88, 157 | `CO-OP: SQUAD {v}` (header) | |
| 53 | CoopSquadScreen.uc:147 | `Not in a co-op session (host first: the Co-op icon, then HOST)` | |
| 54 | CoopSquadScreen.uc:151 | `You can change owners and settings` | |
| 55 | CoopSquadScreen.uc:155 | `View only: the host changes these` | |
| 56 | CoopSquadScreen.uc:163, 166 | `P1 (host)` / `P2 (partner)` (owner per soldier) | |
| 57 | CoopSquadScreen.uc:197, 190 | `{soldier name} ({class})` / `(gone)` | |
| 58 | CoopSquadScreen.uc:172 | `Soldier ownership` | |
| 59 | CoopSquadScreen.uc:174 | `Partner may end the turn` | |
| 60 | CoopSquadScreen.uc:176 | `Partner may edit this screen (host only)` | |
| 61 | CoopSquadScreen.uc:179 | `SYNC: NEW FRAMES (test; set before the partner joins)` | |
| 62 | CoopSquadScreen.uc:99 | `CLOSE` | |

## 6. Co-op fixes screen (both)

| # | Where | Current text | New text |
|---|---|---|---|
| 63 | CoopFixesScreen.uc:78 | Header: `CO-OP: FIXES {v}` / `This PC only. All on at launch. Turn one off only if it misbehaves, and tell the host.` | |
| 64 | CoopFixesScreen.uc:108 | `SAFE MODE: every fix below off at once (try it if co-op misbehaves)` | |
| 65 | CoopFixesScreen.uc:114 | Added after a fix's name in safe mode: `(off: safe mode)` | |
| 66 | CoopFixesScreen.uc:118 | `Verbose log (for bug reports; not a fix)` | |
| 67 | CoopFixesScreen.uc:95 | `CLOSE` | |
| 68 | CoopFixes.uc:206 | `Stability: clean up when leaving a map` | |
| 69 | CoopFixes.uc:207 | `Hacks: the starter controls, the partner watches` | |
| 70 | CoopFixes.uc:208 | `Partner: Tab skips soldiers that can't act` | |
| 71 | CoopFixes.uc:209 | `Rules: VIPs and civilians are the host's` | |
| 72 | CoopFixes.uc:210 | `Partner screen: move range and cover icons` | |
| 73 | CoopFixes.uc:211 | `Camera: follow moves (override)` | |
| 74 | CoopFixes.uc:212 | `Stability: partner skips visuals it can't build` | |
| 75 | CoopFixes.uc:213 | `Partner: can-act check uses the game's rule` | |
| 76 | CoopFixes.uc:214 | `Partner screen: hide the path while moving` | |
| 77 | CoopFixes.uc:215 | `Partner screen: banners wait for the last action` | |
| 78 | CoopFixes.uc:216 | `Rules: single-player rules while connected` | |
| 79 | CoopFixes.uc:217 | `Partner screen: no glow on ability icons` | |
| 80 | CoopFixes.uc:218 | `Partner screen: mouse wheel changes floors` | |
| 81 | CoopFixes.uc:219 | `Camera: host looks at the partner's actions` | |
| 82 | CoopFixes.uc:220 | `Partner: BIT and Gremlin follow moves` | |
| 83 | CoopFixes.uc:221 | `Partner screen: faster enemy turns` | |
| 84 | CoopFixes.uc:222 | `Partner screen: pause while waiting` | |
| 85 | CoopFixes.uc:223 | `Hacks: the watcher can't click` | |
| 86 | CoopFixes.uc:224 | `Rules: flanking crit as in single player` | |
| 87 | CoopFixes.uc:225 | `Rules: suppression penalty as in single player` | |
| 88 | CoopFixes.uc:226 | `Rules: Skulljack chance as in single player` | |
| 89 | CoopFixes.uc:227 | `Rules: reveal shooters in the fog` | |
| 90 | CoopFixes.uc:228 | `Camera: follow moves (watcher)` | |
| 91 | CoopFixes.uc:229 | `Steam: a co-op invite joins directly` | |
| 92 | CoopFixes.uc:230 | `Partner: refresh targets once caught up` | |
| 93 | CoopFixes.uc:231 | `Partner screen: fast mode while behind` | |

## 7. Shot breakdown (both)

| # | Where | Current text | New text |
|---|---|---|---|
| 94 | CoopRulesEffect.uc:36 | `Flanking (co-op)` (crit bonus line) | |
| 95 | CoopRulesEffect.uc:37 | `Suppression (co-op)` (aim penalty line) | |

## Not seen with the release layout
Only in the old test layout (`RELEASE_UI = false`) or as a fallback when the retail
main menu row can't take the CO-OP button: CoopListener.uc:79-88 and 108-137
(`CO-OP: JOIN (STEAM)`, `CO-OP: JOIN BY IP {v}`, `CO-OP: JOIN {v}`,
`CO-OP: CONNECTING (CANCEL)`, `CO-OP: LEAVE`, `CO-OP: NEXT SOLDIER`,
`CO-OP: MOVE TO CURSOR (M)`, `CO-OP: HOST {v}`, the address box at CoopListener.uc:530),
and MainMenuListener.uc:81-91 (`MULTIPLAYER`, `MP TEST: ...`).
