$ErrorActionPreference = 'Stop'
$compareRoot = Split-Path -Parent $PSScriptRoot
$sdkVersion = '1.0.4258.31'
$sdkHash = '56f7f4b8bf9aee4b8efefbbdd4f67d5f74ebd1b100ed0806da71bf76af481aa9'
$buildRoot = Join-Path $compareRoot '.webview2-build'
$sdkZip = Join-Path $buildRoot "microsoft.web.webview2.$sdkVersion.nupkg"
$sdkDir = Join-Path $buildRoot "sdk-$sdkVersion"
$output = Join-Path $compareRoot 'release/TextCompare-WebView2-win-x64'
New-Item -ItemType Directory -Path $buildRoot,$output -Force | Out-Null
if (-not (Test-Path -LiteralPath $sdkZip)) {
    $sdkUrl = "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/$sdkVersion"
    Invoke-WebRequest -Uri $sdkUrl -OutFile $sdkZip -UseBasicParsing -TimeoutSec 120
}
$sdkStream = [IO.File]::OpenRead($sdkZip)
try {
    $hasher = [Security.Cryptography.SHA256]::Create()
    $actualHash = [BitConverter]::ToString($hasher.ComputeHash($sdkStream)).Replace('-', '').ToLowerInvariant()
} finally {
    $sdkStream.Dispose()
    if ($hasher) { $hasher.Dispose() }
}
if ($actualHash -ne $sdkHash) { throw 'WebView2 SDK checksum mismatch.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (-not (Test-Path -LiteralPath $sdkDir)) { [IO.Compression.ZipFile]::ExtractToDirectory($sdkZip, $sdkDir) }
& node (Join-Path $compareRoot 'build.mjs')
if ($LASTEXITCODE -ne 0) { throw 'HTML build failed.' }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw '.NET Framework C# compiler not found.' }
$coreDll = Join-Path $sdkDir 'lib/net462/Microsoft.Web.WebView2.Core.dll'
$formsDll = Join-Path $sdkDir 'lib/net462/Microsoft.Web.WebView2.WinForms.dll'
$coreDll = $coreDll.Replace('/', '\')
$formsDll = $formsDll.Replace('/', '\')
$exePath = Join-Path $output 'TextCompare.exe'
$exePath = $exePath.Replace('/', '\')
$iconPath = (Join-Path $compareRoot 'assets/icon.ico').Replace('/', '\')
$manifestPath = Join-Path $PSScriptRoot 'app.manifest'
$htmlPath = Join-Path $compareRoot 'index.html'
$bridgePath = Join-Path $PSScriptRoot 'bridge.js'
$policyPath = Join-Path $PSScriptRoot 'Policy.cs'
$programPath = Join-Path $PSScriptRoot 'Program.cs'
$compileArgs = @(
    '/nologo','/target:winexe','/platform:x64','/optimize+','/utf8output','/codepage:65001',
    "/out:$exePath", "/win32icon:$iconPath", "/win32manifest:$manifestPath",
    '/reference:System.dll','/reference:System.Core.dll','/reference:System.Drawing.dll','/reference:System.Windows.Forms.dll','/reference:System.Web.Extensions.dll',
    "/reference:$coreDll", "/reference:$formsDll",
    "/resource:$htmlPath,TextCompare.index.html", "/resource:$bridgePath,TextCompare.bridge.js",
    $policyPath, $programPath
)
& $compiler @compileArgs
if ($LASTEXITCODE -ne 0) { throw 'Desktop compilation failed.' }
Copy-Item -LiteralPath $coreDll,$formsDll -Destination $output -Force
Copy-Item -LiteralPath (Join-Path $sdkDir 'runtimes/win-x64/native/WebView2Loader.dll') -Destination $output -Force
Copy-Item -LiteralPath (Join-Path $sdkDir 'LICENSE.txt') -Destination (Join-Path $output 'WebView2-LICENSE.txt') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'TextCompare.exe.config'),(Join-Path $PSScriptRoot '使用说明.txt'),(Join-Path $PSScriptRoot '创建桌面快捷方式.vbs') -Destination $output -Force
Copy-Item -LiteralPath (Join-Path $compareRoot 'LICENSE'),(Join-Path $compareRoot 'THIRD_PARTY_NOTICES.md'),(Join-Path $compareRoot 'README.md') -Destination $output -Force
$testExe = Join-Path $buildRoot 'PolicyTests.exe'
& $compiler '/nologo' '/target:exe' "/out:$testExe" $policyPath (Join-Path $PSScriptRoot 'PolicyTests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Policy tests compilation failed.' }
& $testExe
if ($LASTEXITCODE -ne 0) { throw 'Policy tests failed.' }
$archive = Join-Path $compareRoot 'release/TextCompare-WebView2-Windows-x64.zip'
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
[IO.Compression.ZipFile]::CreateFromDirectory($output, $archive, [IO.Compression.CompressionLevel]::Optimal, $false)
$unpacked = (Get-ChildItem -LiteralPath $output -File | Measure-Object Length -Sum).Sum
[pscustomobject]@{ Executable = Join-Path $output 'TextCompare.exe'; Zip = $archive; ZipMiB = [Math]::Round((Get-Item -LiteralPath $archive).Length / 1MB, 3); UnpackedMiB = [Math]::Round($unpacked / 1MB, 3) }
