$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $repoRoot 'dist'
$appDistDir = Join-Path $distDir 'MinimalDesktopTodo'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$payloadDir = Join-Path $distDir "MinimalDesktopTodo-lite-payload-$stamp"
$payloadZip = "$payloadDir.zip"
$singleExe = Join-Path $distDir 'MinimalDesktopTodo-lite.exe'
$launcherIcon = Join-Path $repoRoot 'app\assets\icon.ico'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}

if (-not (Test-Path -LiteralPath $compiler)) {
  throw 'Unable to find the .NET Framework C# compiler.'
}

if (-not (Test-Path -LiteralPath $launcherIcon)) {
  throw 'Unable to find app\assets\icon.ico for the single-file launcher icon.'
}

Push-Location $repoRoot
try {
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    throw 'Neutralino build failed.'
  }
}
finally {
  Pop-Location
}

New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $payloadDir 'extensions\hotkey-win') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $payloadDir 'extensions\window-win') | Out-Null

Copy-Item -LiteralPath (Join-Path $appDistDir 'MinimalDesktopTodo-win_x64.exe') -Destination $payloadDir
Copy-Item -LiteralPath (Join-Path $appDistDir 'resources.neu') -Destination $payloadDir
Copy-Item -LiteralPath (Join-Path $appDistDir 'extensions\hotkey-win\hotkey-listener.ps1') -Destination (Join-Path $payloadDir 'extensions\hotkey-win')
Copy-Item -LiteralPath (Join-Path $appDistDir 'extensions\window-win\taskbarless-helper.exe') -Destination (Join-Path $payloadDir 'extensions\window-win')
Copy-Item -LiteralPath (Join-Path $appDistDir 'extensions\window-win\single-instance-helper.exe') -Destination (Join-Path $payloadDir 'extensions\window-win')

Compress-Archive -Path (Join-Path $payloadDir '*') -DestinationPath $payloadZip

$references = @(
  '/reference:System.IO.Compression.dll',
  '/reference:System.IO.Compression.FileSystem.dll'
)

& $compiler `
  /nologo `
  /optimize+ `
  /target:winexe `
  "/out:$singleExe" `
  "/win32icon:$launcherIcon" `
  "/resource:$payloadZip,LitePayload.zip" `
  $references `
  (Join-Path $PSScriptRoot 'SingleFileLauncher.cs')

if ($LASTEXITCODE -ne 0) {
  throw 'Single-file launcher build failed.'
}

Get-Item -LiteralPath $singleExe
