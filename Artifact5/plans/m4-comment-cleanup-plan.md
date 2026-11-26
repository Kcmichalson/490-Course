# M4: comment cleanup plan

Approved by Kc on 2026-11-25 (Session 9). This only changes comments; no code changes.

## Scope
Every comment in `mod/X2TacticalCoop` (36 files, about 800 comments).

## Rules
1. **Comments that quote Kc** become a line in Kc's own style: lowercase, short,
   signed ` -- Kc`. Example: `// shift tab is the steam overlay hotkey don't use -- Kc`.
   Keep Kc's words. Change a paraphrase to first person, and add nothing Kc didn't say.
   Agreed lines:

   | Where | Line |
   |---|---|
   | X2TC_CoopInput.uc (PREVIOUS_KEY) | `shift tab is the steam overlay hotkey don't use -- Kc` |
   | X2TC_CoopHackListener.uc | `the other player watches -- Kc` |
   | X2TC_CoopOwnership.uc (UnitCanAct) | `no banner while both my soldiers were bound -- Kc` |
   | X2TC_CoopLagLog.uc | `no lag changes in 0.8.3, logging only -- Kc` |
   | X2TC_CoopMenuBar.uc | `move the co-op button to be an additional button to the left of multiplayer on the main bar -- Kc` |
   | X2TC_CoopOwnerMemory.uc | `track what soldiers were originally the host/partners ... without baking it into the save -- Kc` |
   | X2TC_MainMenuListener.uc | `drop the MULTIPLAYER button -- Kc` |
   | X2TC_CoopMenu.uc | `one co-op button in the top right icon row instead of the column of co-op buttons -- Kc` |
   | X2TC_CoopFixes.uc (fix D) | `fix D only changed a highlight's colour -- Kc` |
   | X2TC_CoopFixes.uc (auto-invite) | `auto-invite written and removed before any build -- Kc` |
   | X2TC_CoopListener.uc (CONNECTING_LABEL) | `a mistyped address needed a restart -- Kc` |
   | X2TC_CoopOwnership.uc (LogSquadState) | `my last soldier never got actions back after a viper's bind -- Kc` |
   | X2TC_CoopReplayMgr.uc (RefreshPathingIfNeeded) | `the line stayed frozen after esc -- Kc` |
   | X2TC_CoopReplayMgr.uc (selection) | `the selection stayed on a soldier with no actions left -- Kc` |
   | X2TC_CoopReplayMgr.uc (edge scroll) | `edge scrolling snapped back -- Kc` |
   | X2TC_CoopShotProbe.uc | `some enemies in the target bar were greyed out and i couldn't select them -- Kc` |
   | X2TC_CoopTurnUI.uc (NO_SOLDIERS_TEXT) | `the partner has none to control -- Kc` |
   | X2TC_CoopSession.uc (CancelGuestConnect) | `show CONNECTING (CANCEL) so a join can be stopped -- Kc` |

2. **Mr.Fear** is written as **Fear**.
3. **Plainer style:** say what the code does and why. Remove version tags,
   run and stage numbers, dates, plan-file references and credit-only mentions
   of Kc ("approved by Kc", "Kc's decision"). That history stays in LOG.md.
4. **Keep:** each class's "What it changes" and "Relies on" header (CLAUDE.md
   requires them), with plainer wording. Also keep SDK file and line references
   and all technical facts.
5. **Code:** no change to code, strings or log lines.

## Checks
- Strip the comments from the original files and from the edited ones, and
  compare: the code must be byte-identical.
- Run `tools/check_unrealscript.py` over every changed class.
- Kc rebuilds to confirm the build.
