# mod/

Source of the X2TacticalCoop mod, built with VS Code and X2ModBuildCommon
(plans/m0-toolchain-plan.md). Log lines use the tag `X2TC`.

Only our own code lives here, plus X2ModBuildCommon (MIT, with its
LICENSE) in `.scripts/X2ModBuildCommon/`. No files copied from the game or
the SDK (see CLAUDE.md, "Legal and community limits").

## Layout
```
.vscode/tasks.json                 Build, Build debug, Clean, Full rebuild
.scripts/build.ps1                 build entry point
.scripts/X2ModBuildCommon/         community build scripts (MIT)
X2TacticalCoop/X2TacticalCoop.x2proj        title and description
X2TacticalCoop/Config/                      declares and loads the script package; DLCIdentifier;
                                            the Community Highlander as a required mod (M3)
X2TacticalCoop/Localization/                localization (.int) files
X2TacticalCoop/Src/X2TacticalCoop/Classes/  UnrealScript classes:
    X2TC_MainMenuListener                     main menu: MULTIPLAYER button (M2), return to the MP menu
                                              after a lobby, MP TEST buttons (test build only)
    X2TC_InviteListener                       accepted Steam invites: X2TC lines, and travel to the MP menu
                                              when accepted on the main menu
    X2TC_MPTraceListener                      M2 diagnostics: X2TC lines per screen, MP state, MP criteria
    X2TC_MatchTraceListener                   M2 diagnostics: X2TC lines for lobby state, tactical HUD, turns
    X2DownloadableContentInfo_X2TacticalCoop  DLC info: X2TC lines when templates are created (loaded, version)
    X2TC_CoopSession                          M3: direct connection between two games (host server,
                                              guest client), ping and pong by remote command
    X2TC_CoopListener                         M3: CO-OP: HOST (tactical HUD, single player) and
                                              CO-OP: JOIN (main menu, address box) buttons
    X2TC_CoopInput                            M3: the guest's M key, right-click and Tab; the host's
                                              Backspace/End co-op End Turn check (an Interaction in
                                              the game viewport)
    X2TC_CoopReplayMgr                        M3: the guest's replay manager (tutorial-style from
                                              Stage 5); follows the host's history, captures the
                                              guest's actions, switches the guest's input
    X2TC_CoopOwnership                        M3 Stage 6: which player owns each soldier (unit value
                                              X2TC_Owner, P1 host by default / P2 partner)
    X2TC_CoopOwnerMemory                      M3 Stage 6: the host's per-campaign list of soldiers given
                                              to the partner, in the mod's own config file
                                              (Config\XComX2TacticalCoopOwners.ini ships empty; never
                                              change it between releases), not in the save
    X2TC_CoopSquadScreen                      M3 Stage 6: the co-op squad screen (owner per soldier,
                                              scrolling list; ownership, partner end turn, partner
                                              edit checkboxes)
    X2TC_CoopTurnUI                           M3 Stage 6: FRIENDLY ACTION banner, co-op status line,
                                              the host's End Turn icon state
```

## Launching
The 2K launcher doesn't list local mods. Use the Alternative Mod Launcher
(AML, research/resources.md): tick X2TacticalCoop and launch War of the
Chosen. Leave `-allowConsole` off.

## Building
1. In VS Code's user settings (per machine, not committed), set
   `xcom.highlander.sdkroot` to the SDK folder and
   `xcom.highlander.gameroot` to the game's `XCom2-WarOfTheChosen` folder.
2. Open this `mod` folder in VS Code.
3. Terminal → Run Task → Build. A good build ends with
   `*** SUCCESS! ... ***` and `X2TacticalCoop ready to run.`

The build writes into the SDK (`Development\Src`, `XComGame\Script`,
`XComGame\Mods\X2TacticalCoop`) and the game (`XComGame\Mods\X2TacticalCoop`),
as CLAUDE.md allows for builds Kc runs.
