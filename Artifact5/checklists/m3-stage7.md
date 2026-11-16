# M3 Stage 7 + Stage 6 Run 3: co-op over Steam with a friend (0.6.0)

One session with a friend over the internet covers both:
- **Stage 7:** connecting over Steam with no port forwarding;
- **Stage 6 Run 3:** the 0.5.3 items and the M3 check (3 full turns).

Kc's PC hosts; the friend's PC is the guest. The laptop isn't needed (it has
only Kc's account). Plans: plans/m3-plan.md (Stage 7, Stage 6 0.5.3);
research: research/steam-connection.md.

Everything about Steam is a **guess** until this test: the mod builds the
same pieces the multiplayer lobby uses (a private Steam game session,
`steamsockets`, the invite overlay), but outside the multiplayer menus.

**Keep a clock-time note** for every step marked ⏱ (both of you). Note the
build ID on both PCs (`steamapps\appmanifest_268500.acf`, `buildid`).

## What's new in 0.6.0 (on top of 0.5.3)
- **PC tactical HUD:** **CO-OP: HOST (STEAM)** (below SQUAD). The first click
  creates a private Steam session, starts the co-op server over Steam and
  opens the Steam invite overlay. The button then reads **CO-OP: INVITE
  (STEAM)**, and clicking it reopens the overlay.
- **Main menu:** **CO-OP: JOIN (STEAM)** (below JOIN). The guest clicks it
  first, then accepts the invite. The next invite then counts as co-op and
  normal multiplayer invites are untouched.
- **Shift+Tab** = previous soldier, as in the game, when Steam's overlay
  doesn't take it. **H** stays as the previous-soldier key, since Shift+Tab
  usually opens the overlay.
- 0.5.3 items:
  - Tab and H on the PC cycle only the PC's soldiers;
  - FIX D button gone;
  - refusal message;
  - the guest's Backspace/End;
  - mission end and HOST DISCONNECTED handled.

## Part A: setup (before the session)
1. **Kc:** build, then package **0.6.0**:
   ```
   python tools\package_mod.py --mods-dir "D:\SteamLibrary\steamapps\common\XCOM 2\XCom2-WarOfTheChosen\XComGame\Mods" --version 0.6.0
   ```
   Send the zip to the friend.
2. **Friend:** install the same mods as the PC:
   - X2TacticalCoop 0.6.0 from the zip;
   - the Community Highlander (required by the mod);
   - every other mod ticked on the PC (Kc: list them for the friend; the
     Alien Hunters Highlander was ticked on both test machines).

   Use the same DLC as the PC. Launch with AML and no `-allowConsole`.
   Steam's invite check compares mod, DLC and INI hashes
   (`XComOnlineEventMgr.uc` L3547), so a different mod list may be refused
   with a version-mismatch message.
3. **Both:** Steam online and friends with each other on Steam. Each of you
   notes your `buildid`.
4. **Both:** start the game. The main menu should show **CO-OP: JOIN
   (v0.6.0)** and **CO-OP: JOIN (STEAM)**.

## Part B: Kc alone, before the friend joins (optional, about 5 min)
5. **PC:** Skirmish, 4 soldiers. On the tactical HUD click **CO-OP: HOST
   (STEAM)**.
   - Expected: the Steam overlay opens with a friends list to invite from.
     The button reads **CO-OP: INVITE (STEAM)**.
   - Close the overlay and click INVITE once: the overlay should open again.
   - Then quit to the main menu.
   - If the overlay never opens, or a "could not be created" message
     appears, stop and send `Launch.log`.

## Part C: with the friend
6. ⏱ **Connect over Steam.**
   - **Friend**, main menu: click **CO-OP: JOIN (STEAM)**. A message should
     say to accept the invite.
   - **Kc**: Skirmish, 4 soldiers. When you control them, click **CO-OP:
     HOST (STEAM)**, then invite the friend in the overlay. Note the time.
   - **Friend**: accept the invite from the Steam notification or the
     overlay. Note the time.
   - Expected: on the friend's PC the mission loads by itself, catches up
     (camera still for about 5 s), and shows NO SOLDIERS ASSIGNED. Note how
     long that took.
   - If the friend ends up in the multiplayer menu, gets a version mismatch,
     or nothing happens within about a minute, note what appeared and skip
     to step 14.
7. **Squad screen.** Kc gives the friend 2 soldiers. The friend's banner
   should go and a soldier should be selected.
8. **Moves and lag.** The friend moves a soldier (right-click) and fires
   once. Note roughly how long from the click until it plays on each
   screen.
9. **Keys and clicks.**
   - **Kc:** Tab and H cycle only Kc's two soldiers.
   - **Friend:** Tab and H cycle the friend's two; left-click selects them;
     a left-click on Kc's soldier does nothing.
   - Shift+Tab: whatever it does, note it (it may open Steam's overlay).
10. **Refusal.** Kc gives back the friend's selected soldier; the friend
    orders it a move at once. The friend's status line should read
    "Refused: that soldier belongs to the host" for about 4 s.
11. **Out of moves, both ways.**
    - One turn, Kc runs out first. Kc's FRIENDLY ACTION banner should stay
      up. Try one HUD ability icon: nothing should happen on either screen.
    - Next turn, the friend runs out first: same check on the friend's
      screen.
    - Also check the End Turn question once: Kc presses Backspace while the
      friend's soldiers can act, then clicks Cancel.
12. **Partner ends the turn.** Kc ticks **Partner may edit** and **Partner
    may end the turn**. On its turn the friend presses **Backspace**: the
    turn should end.
13. ⏱ **Three full turns, then mission end (the M3 check).**
    - Make sure the mission has run at least 3 full XCOM turns, both of you
      acting each turn.
    - Then finish the mission: win, evacuate everyone, or lose. Note the
      time of the last action.
    - **Friend:** **CO-OP: MISSION OVER** with the result. Note the time,
      then click **Main menu**: the main menu should appear.
    - **Kc:** the normal mission summary, with nothing co-op left on screen.
14. ⏱ **Second mission: invite again.**
    - **Kc:** new Skirmish, **CO-OP: HOST (STEAM)**. It should start, with
      no "already hosting".
    - **Friend:** JOIN (STEAM), accept the invite. The mission should load.
    - If step 6 failed, try it once more here and note any difference.
15. ⏱ **Host leaves mid-mission.** Kc quits to the main menu. The friend
    should see **CO-OP: HOST DISCONNECTED**, then Main menu. Note the time.
16. **Normal invite untouched (optional).** Without clicking JOIN (STEAM),
    the friend accepts an invite from a normal multiplayer Private lobby
    hosted by Kc. It should go to the multiplayer screens as in M2.

## Part D: logs
17. **Both:** quit, then copy `Launch.log`. The PC's goes to
    `local\m3-logs\stage7-pc-1.log`; the friend sends theirs, saved as
    `stage7-friend-1.log`. If a game was restarted in between, also keep
    the earlier log (`Launch-backup-*.log`).
18. Send Kc's notes: the clock times, what each screen showed, the lag,
    and anything odd. The friend's own words on what felt good or
    confusing go in LOG.md as their feedback (no names).

## What I'll look for
| Machine | Lines |
|---|---|
| PC | `Coop steam host: creating a private Steam game session`, `Steam game session Game created=True`, `server created (port 7777, steam=True)`, `Steam invite overlay shown=True`; `Coop mission end (host): ...`, `destroying the Steam game session` |
| Friend | `Coop steam guest: waiting for a Steam invite (armed)`, `Invite: co-op Steam invite (armed)`, `joining the host's Steam session`, `Steam session Game joined=True`, `clearing the game's stored invite`, `host address resolved (form: ..., port P)`, `client created (... steam=True)`, `connection attempt N`, `connected`, `pong`, then Stage 3-6 lines |
| Both | Stage 6 lines as in checklists/m3-stage6.md (owners, banners, keys, mission end) |

**Pass (Stage 7):** the friend joins over Steam with no port forwarding
and plays co-op turns, and a second mission connects again. **Pass (M3):**
3 full turns with both acting, logs from both machines.
