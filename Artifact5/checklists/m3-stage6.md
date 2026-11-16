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

## Run 2 (version 0.5.1)

Run 1 (0.5.0): squad screen, settings, FRIENDLY ACTION on both, the
question, "ready", and the partner's End Turn all worked. Fixed in 0.5.1:
- **NO SOLDIERS ASSIGNED** (blue banner) on the laptop while it has no
  soldier during XCOM's turn; its input is now off then, so a soldier
  given back to the PC no longer shows movement range and abilities.
- **Left-click selects** the laptop's soldiers (the game turns click
  selection off in its tutorial mode, which the laptop runs in).
- **PC locked** once only P2's soldiers can act. The game used to select
  them and let the PC act. While locked, the camera should still scroll,
  the status reads "Your soldiers are done; your partner's turn", and
  CO-OP: END TURN, Backspace and End still work.
- FRIENDLY ACTION on the laptop: with ownership on, for P1's soldiers (as
  in 0.5.0; the PC can no longer act with P2's); with ownership off, for
  any soldier the laptop didn't order in the last 5 s. The PC's banner
  comes from applying the laptop's action, in both modes.
- "Soldier ownership" has no explanation in brackets any more.
- Not changed: neither screen can pan while the other player's action
  plays (vanilla XCOM locks the camera during actions; the M4 camera
  option).

Steps (4 soldiers, Skirmish):
1. Build, package **0.5.1**, install. Menus read (v0.5.1). Host, join.
2. **Laptop, before any soldier is given:** the blue **NO SOLDIERS
   ASSIGNED** banner should be up, with no movement range showing.
3. **PC:** give units 2 soldiers (squad screen). On the laptop the banner
   should go away and a P2 soldier should be selected. Give one back: if
   it was selected, the laptop should switch to its other soldier. Give
   both back: the banner should return. Then give two again.
4. **Laptop:** **left-click** each of its soldiers: it should select. Left
   click a PC soldier: nothing should happen. Ability icons on the HUD
   should still work (one shot or overwatch).
5. **PC:** use up both P1 soldiers' actions. The PC should **not** jump to
   a laptop soldier: its status reads "Your soldiers are done; your
   partner's turn". Check that the camera can still scroll and that
   clicking a laptop soldier or its abilities does nothing. Then press
   **Backspace**: the question should appear (Cancel).
6. **Laptop:** act with its soldiers until they're out. The turn should
   end by itself; next turn the PC should have its input back.
7. **Ownership off** (PC ticks it): on the laptop, left-click should now
   select every soldier. The PC should not be locked. Each side moves a
   soldier "belonging" to the other: the other screen should show
   FRIENDLY ACTION both times.
8. Logs: `stage6-pc-2.log`, `stage6-laptop-2.log`.

## Run 3 (version 0.5.3; replaces the 0.5.2 steps below)

New in 0.5.3 (Kc: "go a bit further"):
- **Out-of-moves banner** (from 0.5.2): a player out of moves keeps the
  FRIENDLY ACTION banner until its soldiers can act again.
- **PC Tab** cycles only the PC's own soldiers that can act (no more
  jumping to a laptop soldier and back).
- **H = previous soldier** on both machines (Tab = next). H is unbound in
  the game's default keys; Shift+Tab is Steam's overlay.
- **FIX D button gone**; the fix stays on permanently.
- **Refusal message**: when the PC refuses a laptop action, the laptop's
  status line says why for about 4 s (e.g. "Refused: that soldier belongs
  to the host").
- **Laptop Backspace/End** end XCOM's turn when "Partner may end the turn"
  is on.
- **Mission end** (was unhandled): the laptop shows **CO-OP: MISSION OVER**
  (XCOM won/lost) with a **Main menu** button; the PC closes the co-op
  session about 5 s after the laptop has the last frame, and its own game
  goes on (summary screen). If the PC disconnects mid-mission, the laptop
  shows **CO-OP: HOST DISCONNECTED** with the same button. Clicking HOST in
  a later mission works again.

Steps (Skirmish, 4 soldiers, laptop gets 2). Note clock times on both
machines for steps 6-8.
1. Build, package **0.5.3**, install; menus read (v0.5.3). Host, join.
   The laptop's HUD should have no FIX D button.
2. **Keys.** PC: Tab and H cycle only the PC's two soldiers. Laptop: Tab
   and H cycle its two (H backwards).
3. **Refusal.** PC gives one laptop soldier back while it's selected on
   the laptop; the laptop orders it a move at once. The status line should
   say "Refused: that soldier belongs to the host", then clear.
4. **Out of moves, both ways.** One turn the PC runs out first (its banner
   stays, its ability icons do nothing); the next turn the laptop runs out
   first.
5. **Laptop Backspace.** PC ticks "Partner may edit" and "Partner may end
   the turn"; on its turn the laptop presses **Backspace**: the turn
   should end.
6. **Mission end.** Play on to the end of the mission (finish it or
   evacuate everyone, or let it fail). Note the clock time of the last
   action. Laptop: **CO-OP: MISSION OVER** with the result, then **Main
   menu** should reach the main menu. PC: its normal mission summary;
   nothing co-op left on screen.
7. **New mission on the PC:** start another Skirmish, click HOST: it should
   say hosting (no "already started"). Laptop JOIN again works.
8. **Host leaves mid-mission:** in that second mission, quit the PC's game
   to the main menu (or close it). Laptop: **CO-OP: HOST DISCONNECTED**,
   then Main menu. Note the clock time.
9. Logs: `stage6-pc-3.log`, `stage6-laptop-3.log` (with a PC log from the
   second mission too if the game was closed: copy Launch.log before
   restarting). For the M3 check, the first mission should run at least 3
   full turns before step 6.

## Run 3, first draft (version 0.5.2; superseded by the steps above)

Run 2 (0.5.1) passed:
- the NO SOLDIERS ASSIGNED banner;
- left-click select, including on a soldier's body;
- the laptop refused a P1 soldier;
- the PC lock: on at PC L653, off by itself at the next XCOM turn, L1516;
- the turn ending by itself;
- ownership off.

New in 0.5.2 (Kc): a player out of moves keeps the **FRIENDLY ACTION**
banner (the same one, same place) until its soldiers have actions again,
on both machines, during XCOM's turn with ownership on. Kc from Run 2:
while locked, the PC's camera pans and Backspace works.

1. Build, package **0.5.2**, install; menus read (v0.5.2). Host, join, give
   the laptop 2 of 4 soldiers.
2. **PC out of moves first:** the PC uses up both its soldiers. Its banner
   should come up and stay while the laptop acts, and go at the next XCOM
   turn. Try one **ability icon** on the PC's HUD while locked: nothing
   should happen on either screen.
3. **Laptop out of moves first** (next turn): the laptop uses up both its
   soldiers. Its banner should come up and stay while the PC acts, and go
   at the next XCOM turn.
4. Play on to **3 full turns** for the M3 check. Logs: `stage6-pc-3.log`,
   `stage6-laptop-3.log`.
5. Regained actions (Teamwork) wait for a campaign test: Skirmish has no
   bonds.

## What I'll look for

| Machine | Lines |
|---|---|
| Both | `X2TC: version 0.5.0`; `Coop UI: FRIENDLY ACTION (...)`, `banner shown`, `banner hidden`; `Coop input: installed` |
| Both (0.5.3) | `Coop mission end (host): end-of-battle frame F, XCOM won/lost`, `the guest has the end frame`, `closing the co-op session (...)`, `session closed`; `Coop mission end (guest): the replay passed the end-of-battle frame F`, `shown (idle=...)`, `dialog shown: CO-OP: MISSION OVER`, `dialog closed`; `WARNING: the host disconnected during the mission`; `Coop owners: host cycled to its unit U`; `Coop input: H -> soldier -1` |
| Both | `Coop squad: screen opened`, `rows for N soldiers`, `screen closed`; `owner switch ignored` / `setting I ignored` on the laptop while it may not edit |
| PC | `Coop owners: unit U -> P1` (one per soldier at join), `change requested by host/partner: unit U -> P2`, `unit U -> P2 (frames now F)`; `Coop settings: changed by ...`, `sent to the partner: ...`; `the partner ends XCOM's turn`; `Coop UI: host End Turn icon disabled/enabled`; `Coop turn: the partner is ready...`, `"ready" is cleared (...)`; `Coop input: BackSpace -> co-op End Turn check`; `host End Turn (...) ... asking`, `host chose not to end the turn`, `host ends XCOM's turn (anyway)`; `Coop owners: host selection moved off P2's unit`; any `Coop rejected: unit U is P1's, action from P2` |
| Laptop | `Coop settings: from the host: ...`; `asked the host to give unit U to P1`; `guest asked the host to end XCOM's turn`; `Coop input: Tab -> next soldier`; `Coop follower: selected unit U` (P2 units only); `is P1's or has no actions left; selected P2's unit`; `Coop turn: guest is ready to end the turn`; `guest acted again; no longer ready`; `XCOM input phase begins/ends` |

**Pass (Stage 6 run):** each side selects and acts only with its own
soldiers, FRIENDLY ACTION shows on the other screen while a partner acts,
the ready status and the PC's question work as in steps 5-6, and turn 3
ends by itself. The M3 check itself is three full turns played this way,
with logs from both machines.
