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
X2TacticalCoop/Config/                      declares and loads the script package
X2TacticalCoop/Localization/                localization (.int) files
X2TacticalCoop/Src/X2TacticalCoop/Classes/  UnrealScript classes
```

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
