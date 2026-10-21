$ErrorActionPreference = 'Stop'
$compareRoot = Split-Path -Parent $PSScriptRoot
$compareExe = Join-Path $compareRoot 'release/TextCompare-WebView2-win-x64/TextCompare.exe'
if (-not (Test-Path -LiteralPath $compareExe)) { & (Join-Path $PSScriptRoot 'build.ps1') }
Start-Process -FilePath $compareExe
