# Build diff: current build vs. the pre-21.10 beta branch

Done by Kc on 2026-11-08/09 with PowerShell: SHA-1 of every file on each
branch, compared by path. Copies of the differing files are in
C:\Users\Kc\Desktop\xcom2-diff\beta and \current (game files: never commit).

## Builds
- Current: build ID 8270065 (steamapps\appmanifest_268500.acf)
- Beta ("pre-21.10-support - support branch"): build ID (untested)
- Version.txt strings: (Current: 699445, Beta: 374751)

## Counts
- 399 files only in the beta
- 277 files changed
- 0 files only in the current build

## Only in the beta (unrelated to multiplayer)
- The old mod launcher (Binaries\...\Launcher: ModLauncherWPF, Steamworks.NET)
- 32-bit binaries (PhysX, APEX, Bink, steam_api.dll)
- Crash dump tools, a few .pdb files, Binaries\Win64\Save\PhysX*
- The whole XComGame\Localization\XXX folder (306 files, including
  SoundMultiplayer.xxx and SoundX2Multiplayer.xxx; the whole folder went,
  so not a multiplayer-specific removal)

## Changed in War of the Chosen (XCom2-WarOfTheChosen\)
- Binaries\Win64\XCom2.exe and Version.txt
- Script packages in XComGame\CookedPCConsole: AkAudio, Core, Engine,
  GameFramework, GFxUI, IpDrv, OnlineSubsystemSteamworks, Startup,
  XComGame (plus GlobalPersistentCookerData, GuidCache, shader caches)
- XComGame\Localization\*\XComGame.* (every language)
- PCConsoleTOC*.txt (file indexes)
- No Config files

## Changed in the base game folder
Almost every UI package (including all gfxMultiplayer*_SF.upk), heads,
cinematics, Core and Engine: consistent with a full rebuild, so a changed
file doesn't mean a changed feature.

## The one text change (XComGame.int, English)
`m_strOnlineNoNetworkConnectionDialog_Default_Text` is 258 characters in
the beta and 187 in the current build. The current build dropped the
sentence "Multiplayer functionality will be disabled until the issue is
resolved." Every other multiplayer string is identical.

## Conclusions
- Multiplayer content and text still ship in the current build.
- No config switch turns it off; the change is in code: the recompiled
  script packages (likely XComGame or OnlineSubsystemSteamworks) or
  XCom2.exe.
- Not proven: that multiplayer works on the current build. That's M2.
