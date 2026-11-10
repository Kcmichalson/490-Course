# M0 plan: DLC info class and XComGame.ini

Approved by Kc on 2026-11-09 (Session 5, on the PC), with the
conventional class name. Adds what the SDK's ModBuddy template has and our
mod lacks, so the mod can be launched with the Alternative Mod Launcher
(AML) and its loading can be checked in two places.

## Why
- The 2K launcher doesn't list local mods (Kc, Session 5). Kc's guide
  (r/xcom2mods wiki) says to use AML.
- The SDK's template (`Binaries\Win32\ModBuddy\Extensions\Application\
  ProjectTemplates\XCOM2Mod\1033\DefaultMod.zip`, read in place) has three
  config files and a class extending `X2DownloadableContentInfo`. Ours had
  two config files and no such class.

## Decisions (Kc)
1. Class name: `X2DownloadableContentInfo_X2TacticalCoop` (the usual
   pattern), not an own name, so M0 doesn't test a naming question.
2. AML managing the My Games mod configs (`XComModOptions.ini`, and its
   rewrite of the user `XComEngine.ini`) is acceptable: it's the standard
   launcher, not a hand edit. Kc backed up the My Games `Config` folder to
   `Artifact5\local\config-backup-before-AML\` first, after a clean
   mods-off run (the M2 baseline in LOG.md; build 8270065).

## Files (all in `mod/X2TacticalCoop/`)
- `Src/X2TacticalCoop/Classes/X2DownloadableContentInfo_X2TacticalCoop.uc`:
  extends `X2DownloadableContentInfo` (SDK `XComGame\Classes\
  X2DownloadableContentInfo.uc`; `DLCIdentifier` L25,
  `OnPostTemplatesCreated` L105). One event, `OnPostTemplatesCreated`,
  that writes one `X2TC` line. Nothing else (no template stubs).
- `Config/XComGame.ini`: section
  `[X2TacticalCoop.X2DownloadableContentInfo_X2TacticalCoop]` with
  `DLCIdentifier="X2TacticalCoop"`.
- Docs: the file tree in plans/m0-toolchain-plan.md and the layout in
  mod/README.md.

## Checks
Kc builds, launches with AML, reaches the main menu and quits. Launch.log
is read for the two lines:

| Launch.log shows | Meaning |
|---|---|
| Neither line | The package didn't load (mod not active, or the `NonNativePackages` guess is wrong) |
| DLC info line only | The mod loaded but the listener didn't fire |
| Listener line only | The mod loaded but the DLC info class wasn't found (class name or identifier) |
| Both | M0's load check passes |

The game build ID is recorded with the result.
