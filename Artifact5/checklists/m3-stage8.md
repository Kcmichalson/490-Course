# M3 Stage 8.1: new-frames sync, LAN test with the laptop (0.7.0)

Plan: plans/m3-plan.md, Stage 8. Research: research/history-sync.md. Kc
alone, the PC hosting and the laptop joining by direct IP. Two missions:
- **A:** the new switch **on**;
- **B:** off, for comparison and for the 0.6.3 checks if A fails early.

Everything about the new switch is a **guess** until this run: whether the
game adds a frame sent on its own to the laptop's history at all.

## What's new in 0.7.0
- **SYNC: NEW FRAMES (test)**: a 4th checkbox on the squad screen, PC only.
  When on, the PC sends each new frame on its own instead of the whole
  history. It can be changed only after HOST and **before the laptop
  joins**; after that it's greyed out.
- Includes 0.6.3:
  - mission end shows MISSION OVER on the guest;
  - the guest's rockets and grenades now hit units;
  - bound soldiers count as unable to act;
  - per-soldier state lines in the PC log at each XCOM turn start.

## Setup
1. Build, package **0.7.0**, install on the laptop. Menus read (v0.7.0).
   Laptop: Steam offline as before. Note the PC's `buildid`.

## Mission A: switch on ⏱
2. **PC:** Skirmish, 4 soldiers. When you control them, click **CO-OP:
   HOST**. Then **CO-OP: SQUAD**: tick **SYNC: NEW FRAMES**, give the laptop
   2 soldiers, close. ⏱
3. **Laptop:** **CO-OP: JOIN**, the PC's address. Wait until caught up. ⏱
4. **Laptop, first action:** move one soldier. Does it play on both
   screens? ⏱
   - **If the laptop never shows the move**, or stops following (the PC
     moves and the laptop's screen doesn't change within about 20 s), note
     the time, click LEAVE on the laptop, and go to Mission B. That's the
     "stop and report" case.
5. If it keeps working, **play as long as you can**: 10+ turns is the
   target. Both sides act every turn. Include:
   - a laptop **grenade or rocket** at enemies: they should take damage
     (0.6.3);
   - any Viper bind: note the time, the banner, and selection after it
     ends.
6. Note every few turns: does the laptop feel smooth? Any freezes (time)?
   How long from the laptop's click until the move plays?
7. Finish the mission (win, evac or lose). ⏱ The laptop should show **CO-OP:
   MISSION OVER** (not HOST DISCONNECTED), then Main menu.

## Mission B: switch off (only if A failed early, or for a short comparison)
8. Same as A, but don't tick the switch: a few turns, the 0.6.3 checks
   (grenade, mission end) if A didn't reach them.

## Logs
9. `local\m3-logs\stage8-pc-1.log`, `stage8-laptop-1.log` (backups too, if
   a game restarted).

## What I'll look for
| Machine | Lines |
|---|---|
| PC | `Coop settings: changed by host: ... new frames sync=True`; `Coop host: new frames N sent, frames A -> B (+n) ... queued bytes=X` (should stay small and flat, not grow with the mission); `new frames N acknowledged after Ss`; `Coop squad state (XCOM turn starts): unit U P1 AP=.. can act=.. effects=..`; `aimed at a location: the host found N units in its area` |
| Laptop | `Coop settings: from the host: ... new frames sync=True`; `new frame N received: its index I, history frames=F, in the history at its index=True/False (misplaced so far: M)`; `replayed to frame F`; fewer `hitch` lines than Run 2; `Coop mission end (guest): ... dialog shown: CO-OP: MISSION OVER` |

**Pass (8.1):**
- every new frame lands in the laptop's history at its index (misplaced 0);
- the laptop follows to the end;
- send sizes stay roughly flat;
- acknowledgements stay under about 1 s;
- no stall bursts.

**Stop case:** frames not added (index -1 or misplaced). Then 8.2 doesn't
start; per plan default 2, report back first.
