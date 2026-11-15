# M3 Stage 6: owners and the shared turn

For plans/m3-plan.md, Stage 6. Goal: each player acts only with their
own soldiers during XCOM's shared turn; the other side sees FRIENDLY
ACTION while a partner's soldier acts; only the PC (host) ends XCOM's
turn, and the laptop's END TURN tells it the laptop is ready. Mod
**0.5.0**, same mods on both machines.

Lines marked **(guess)** are not tested on build 8270065.

## Run 1 (version 0.5.0)

New in 0.5.0:
- **Owners and the squad screen.** Every soldier belongs to the PC (P1)
  until changed. **CO-OP: SQUAD** (top right, both machines) opens a list
  of soldiers with a P1 (host) / P2 (partner) switch each (it scrolls if
  the squad is long), plus three checkboxes: **Soldier ownership** (on),
  **Partner may end the turn** (off), **Partner may edit** (off, PC only).
  The laptop sees it greyed out unless "Partner may edit" is on. The PC
  refuses laptop actions on P1's soldiers while ownership is on. The
  settings reset each time you click HOST; owners are cleared when the
  next mission starts.
- **Selection.** On the laptop, NEXT SOLDIER, **Tab** and the automatic
  skip select only P2's soldiers. On the PC, the selection is moved off
  P2's soldiers to a P1 soldier with actions.
- **FRIENDLY ACTION.** The blue turn banner with that text, on the PC
  while a laptop soldier acts and on the laptop while a PC soldier acts.
- **Ending the turn.**
  - Laptop: **CO-OP: END TURN (READY)** (top right). It shows "Waiting for
    the host to end the turn" and ends nothing. Acting again clears it.
  - PC: the status line shows "Partner is ready to end the turn".
  - PC: while the laptop's soldiers can still act and it isn't ready, the
    HUD's own End Turn icon is greyed out. **CO-OP: END TURN** (top right),
    Backspace or End then ask "End the turn anyway?" (End turn / Cancel).
  - Once the laptop is ready, or its soldiers are out of actions, the
    normal End Turn works as usual.
  - The turn still ends by itself when nobody has actions left.
- FIX A/B/C buttons are gone; FIX D stays (on).

### Steps

1. Build, package **0.5.0**, install on the laptop. Menus read **CO-OP:
   JOIN (v0.5.0)**. Note `buildid` (expected 8270065) on both.
2. **PC:** Skirmish with **4 soldiers**; when you control them, click
   **CO-OP: HOST**. **Laptop:** JOIN, wait until caught up.
3. **Squad screen, before acting.**
   - **Laptop:** CO-OP: SQUAD. All 4 should show P1 (host), greyed out;
     clicking a switch should change nothing. Close it (Esc).
     **Screenshot.**
   - **PC:** CO-OP: SQUAD. Set two soldiers to **P2 (partner)**. Close it.
   - **Laptop:** open it again: those two should now read P2. Close.
   - **Both, look:** which soldiers can each side select (Tab on the
     laptop, clicking or Tab on the PC)? Each side should get its own two.
     **Screenshot of both.**
4. **Turn 1, alternate:** PC moves one P1 soldier; laptop moves one P2
   soldier; then each shoots or overwatches once. While the other side's
   soldier acts, each screen should show **FRIENDLY ACTION**, which
   should go away about 1.5 s after it stops.
5. **Turn 1, end:** with the laptop's soldiers still holding actions, PC
   presses **Backspace**: the question should appear. Click **Cancel**.
   Then laptop clicks **END TURN (READY)**: the laptop shows "Waiting
   for the host to end the turn" and the PC shows "Partner is ready to
   end the turn". The PC's End Turn icon should be normal again. PC ends
   the turn with the HUD icon.
6. **Turn 2:** laptop clicks END TURN (READY), then moves a soldier: the
   ready lines should clear on both. PC clicks **CO-OP: END TURN**: the
   question appears; click **End turn**; the turn should end.
7. **Turn 3:** both use up all their soldiers' actions, no End Turn on
   either side. The turn should end by itself.
8. **Ownership refusal (once, any turn):** on the laptop, try to click
   one of the PC's soldiers to select it. Note whether it selects; if it
   does, order a move: the PC should refuse it (nothing moves).
9. **Turn 4, the squad screen's checkboxes (PC ticks them):**
   - **Partner may edit** on: the laptop's screen should no longer be
     greyed out (except that checkbox). Laptop gives one soldier back to
     P1; the PC's screen should show it.
   - **Soldier ownership** off: the laptop should be able to select and
     move every soldier, and the PC too; the PC's End Turn icon stays
     normal. Note whether FRIENDLY ACTION shows correctly on the laptop
     when the PC moves (this case is a guess).
   - **Partner may end the turn** on: the laptop's button should read
     **CO-OP: END TURN** (no "(READY)"); clicking it should end XCOM's
     turn.
   - **Scrolling:** if you have a mod or a mission with more than 6
     soldiers, open the screen and scroll. Otherwise skip this.
10. **Owner memory (PC only; new in 0.5.0, a guess throughout).** The PC
    remembers soldiers given to P2, per campaign, in the mod's own config
    file (not in the save). After step 3 the PC log should show `Coop
    memory: unit U -> P2 remembered` or, in a Skirmish, `this mission has
    no campaign ID` (Skirmish may have none). If you have time, a
    campaign test: from a **campaign** mission, HOST, give two soldiers to
    P2, finish or abandon the mission; in the next mission with those
    soldiers, HOST: they should start as P2 without touching the screen
    (`Coop memory: N entries in the file, M for this campaign`). For the
    update caveat: rebuild once with a different patch version, HOST again,
    and check that the entry count hasn't dropped to 0.
11. LEAVE on the laptop. Logs: `local\m3-logs\stage6-pc-1.log`,
    `stage6-laptop-1.log`, with clock times of steps 5-7 and 9.

### Guesses to check

- **(guess)** The PC's game-state network manager leaves the PC in
  standalone net mode, so End Turn doesn't also raise the game's own
  multiplayer "end turn?" box (XComTacticalController.uc L1358-1366). If a
  second box appears, note its text.
- **(guess)** When all of the PC's soldiers are out of actions, the game
  may still select a laptop soldier on the PC, and the PC could then
  order it. The PC side only keeps its *selection* off P2's soldiers
  while it has a P1 soldier with actions; nothing refuses the PC's own
  orders. Note it if it happens.
- **(guess)** The banner's text and colour, and whether the stock "XCOM
  TURN" text comes back on the next real turn change.

## What I'll look for

| Machine | Lines |
|---|---|
| Both | `X2TC: version 0.5.0`; `Coop UI: FRIENDLY ACTION (...)`, `banner shown`, `banner hidden`; `Coop input: installed` |
| Both | `Coop squad: screen opened`, `rows for N soldiers`, `screen closed`; `owner switch ignored` / `setting I ignored` on the laptop while it may not edit |
| PC | `Coop owners: unit U -> P1` (one per soldier at join), `change requested by host/partner: unit U -> P2`, `unit U -> P2 (frames now F)`; `Coop settings: changed by ...`, `sent to the partner: ...`; `the partner ends XCOM's turn`; `Coop UI: host End Turn icon disabled/enabled`; `Coop turn: the partner is ready...`, `"ready" is cleared (...)`; `Coop input: BackSpace -> co-op End Turn check`; `host End Turn (...) ... asking`, `host chose not to end the turn`, `host ends XCOM's turn (anyway)`; `Coop owners: host selection moved off P2's unit`; any `Coop rejected: unit U is P1's, action from P2` |
| Laptop | `Coop settings: from the host: ...`; `asked the host to give unit U to P1`; `guest asked the host to end XCOM's turn`; `Coop input: Tab -> next soldier`; `Coop follower: selected unit U` (P2 units only); `is P1's or has no actions left; selected P2's unit`; `Coop turn: guest is ready to end the turn`; `guest acted again; no longer ready`; `XCOM input phase begins/ends` |

**Pass (Stage 6 run):** each side selects and acts only with its own
soldiers, FRIENDLY ACTION shows on the other screen while a partner acts,
the ready status and the PC's question work as in steps 5-6, and turn 3
ends by itself. The M3 check itself is three full turns played this way,
with logs from both machines.
