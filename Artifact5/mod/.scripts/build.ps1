# X2TacticalCoop build entry point, following the X2ModBuildCommon README
# (github.com/X2CommunityCore/X2ModBuildCommon, MIT). Run through the
# "Build" tasks in mod/.vscode/tasks.json.
Param(
    [string] $srcDirectory, # the folder that holds X2TacticalCoop\X2TacticalCoop.x2proj (mod/)
    [string] $sdkPath,      # the SDK folder, ending in "XCOM 2 War of the Chosen SDK"
    [string] $gamePath,     # the game folder, ending in "XCom2-WarOfTheChosen"
    [string] $config        # build configuration: default or debug
)

$ScriptDirectory = Split-Path $MyInvocation.MyCommand.Path
$common = Join-Path -Path $ScriptDirectory "X2ModBuildCommon\build_common.ps1"
Write-Host "Sourcing $common"
. ($common)

$builder = [BuildProject]::new("X2TacticalCoop", $srcDirectory, $sdkPath, $gamePath)

switch ($config)
{
    "debug" {
        $builder.EnableDebug()
    }
    "default" {
        # Nothing special
    }
    "" { ThrowFailure "Missing build configuration" }
    default { ThrowFailure "Unknown build configuration $config" }
}

$builder.InvokeBuild()
