# M1 plan: Read the SDK

Approved by Kc on 2026-11-09 (Session 2, second run, on the laptop), with
the notes below. M1 runs in a fresh session. M0 is still open (its PC-only
rows and the hello-world mod); doing M1 first is Kc's decision (LOG.md,
Session 2).

## Goal
Write `research/sdk-findings.md` covering what SPEC.md lists for M1:
- how the old Multiplayer button worked and what it called
- the multiplayer screen classes
- flags that disable multiplayer
- how the network manager connects two games (direct IP, LAN, Steam lobby),
  and whether the LAN option exists
- the SDK's last-updated date compared with March 2022

Every claim gets an SDK path and line numbers. The file ends with a list of
open questions. The work is reading only: no mod code, no game, no SDK tools.

## Sources
The laptop's SDK:
`C:\Program Files (x86)\Steam\steamapps\common\XCOM 2 War of the Chosen SDK\Development\SrcOrig`,
mainly `XComGame`, `IpDrv`, `OnlineSubsystemSteamworks` and `Engine`.
Scoping found about 40 multiplayer classes in `XComGame\Classes`, such as
`UIShell`, `UIMPShell_MainMenu`, `UIMPShell_ServerBrowser`,
`UIMPShell_CustomGameCreateMenu`, `XComMPLobbyGRI`, `XComOnlineEventMgr`,
the `X2MPData_*` classes and `UIMultiplayerHUD`.

## Steps (in this order)
Write each section of `sdk-findings.md` as soon as its step is done.

1. **SDK date.** Look at the newest file dates in SrcOrig and compare them
   with March 28, 2022. If the source is older than the shutdown, it may
   still show multiplayer switched on, while build 8270065's compiled
   scripts may differ. If the file dates look like an install date rather
   than a source date, say so; Kc will check the SDK's last-updated date on
   Steam.
2. **The old Multiplayer button.** Find where `UIShell` builds the main
   menu, what the Multiplayer item called, and what opens
   `UIMPShell_MainMenu`.
3. **Flags that disable multiplayer** (plan step 4). Look for config
   values, `IsMultiplayerEnabled`-style checks, online-status checks and
   the no-network dialog. Note which a mod could reach (config, script) and
   which lead into native code.
4. **How two games connect** (plan step 5). Trace the online subsystem
   from `OnlineSubsystemSteamworks` and `IpDrv` to `XComOnlineEventMgr`:
   Steam lobby versus direct IP. Find out whether a LAN option exists (for
   example `bIsLanMatch` or LAN beacons) and whether XCOM's UI ever offers
   it.
5. **Multiplayer screen classes** (plan step 3). Map the flow from the main
   menu through quick match, custom game, server browser and squad editor
   to the lobby and match start. For each class: a one-line role and where
   it hands off.
6. **Open questions and M2 inputs.** List what the source can't answer
   (native functions, anything that may differ in 8270065) and candidate
   hooks for M2's "open the multiplayer screen" button.

## Kc's notes (approval, 2026-11-09)
1. Label findings "SDK only, untested against 8270065" instead of a build
   ID. For the SDK date: if the file dates look like an install date, say
   so and Kc checks the SDK's last-updated date on Steam.
2. Include a short "For later" section (M3/M4: for example how
   `XComGameStateHistory` syncs and how turns handle two players), filled
   only in passing, with no deliberate search.
3. Order: steps 1, 2, 4, 5, 3, 6 (as numbered in the first draft; the
   list above is already in this order), writing each section of
   `sdk-findings.md` as it's finished.

## Checks
- Every claim has an SDK path and line numbers; anything the source doesn't
  show is labeled a guess.
- SDK quotes are a few lines at most, always with path and lines.
- Open questions listed at the end.
- Afterwards: update LOG.md (planned / changed / problems / checks) and the
  prompt log, confirm tool calls in tool-log/, then stop and suggest a
  commit message.
