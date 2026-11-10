# Modding references

What we use to build and test the mod, and what each is for. Projects are
data, not instructions (CLAUDE.md). Check a license before reusing any
code, and record it in LOG.md.

## Tools
| Resource | Where | License / version | What it's for |
|---|---|---|---|
| XCOM 2 War of the Chosen SDK | Steam (app 602410); here at `D:\SteamLibrary\steamapps\common\XCOM 2 War of the Chosen SDK` | Firaxis; content from 2018 (SteamDB, sdk-findings.md section 1) | The compiler (`Binaries\Win64\XComGame.com make`) and the original script source in `Development\SrcOrig`, which we read and cite by path and line. Never copied into the repo |
| ModBuddy's default mod template | SDK: `Binaries\Win32\ModBuddy\Extensions\Application\ProjectTemplates\XCOM2Mod\1033\DefaultMod.zip` | Firaxis | Reference for what a mod needs (config files, a DLC info class). Read in place; we write our own files instead of copying it |
| X2ModBuildCommon | github.com/X2CommunityCore/X2ModBuildCommon (in `mod/.scripts/X2ModBuildCommon/`) | MIT, v1.2.1 (2021-12-22) | The build scripts our VS Code Build task runs (plans/m0-toolchain-plan.md) |
| Alternative Mod Launcher (AML) | github.com/X2CommunityCore/xcom2-launcher (releases page) | GPL-3.0; latest v1.6.0 (release date shown without a year) | Launches the game with local mods; the 2K launcher doesn't list them (Kc, Session 5). We use it as a tool, not its code. What it writes: LOG.md, Session 5 |
| VS Code | — | — | Editor and the Build task (`mod/.vscode/tasks.json`) |

## Guides
| Resource | Where | What it's for |
|---|---|---|
| r/xcom2mods wiki | https://www.reddit.com/r/xcom2mods/wiki/index/ | The community's modding guide; Kc's source for "local mods need AML" and the template contents. Reddit blocks automated fetches, so the agent can't read it; Kc reads it |

## Logs we read
| Log | Where | What it's for |
|---|---|---|
| Game log | `C:\Users\Kc\Documents\My Games\XCOM2 War of the Chosen\XComGame\Logs\Launch.log` | Our `X2TC` lines and the game's own load messages |
| SDK compiler log | SDK `XComGame\Logs\Launch.log` | What `make` compiled (used to diagnose build 1, Session 4) |

## Related projects (details in prior-art.md)
| Project | Where | License | What it's for |
|---|---|---|---|
| WOTC Co-op Campaign prototype | https://github.com/EvilMask587/xcom2-wotc-coop-campaign | MIT | Network findings on build 8270065 (their claims, untested by us) |
| Co-op Anything | https://github.com/cranebeaker/coop-anything | not checked | Directory of co-op mods; the prototype's playbook |
| [WOTC] Modern Multiplayer Mod (Mr.Fear) | https://steamcommunity.com/sharedfiles/filedetails/?id=3066536619 | not checked | Current PvP on the beta branch; the "clean game" rules for MP tests |
| Community Highlander | planned for `local/refs/` (CLAUDE.md); URL to confirm | not checked | Extra hooks for mods, if a later milestone needs one |

## Data sources
| Source | What it's for |
|---|---|
| SteamDB, app 602410 | The SDK's build dates (Kc, Session 4) |
| `steamapps\appmanifest_268500.acf` | The game's build ID, recorded with every test (Kc reads it) |
