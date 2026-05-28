$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot 'extensions\window-win\TaskbarlessHelper.cs'
$outputDir = Join-Path $repoRoot 'extensions\window-win'
$outputPath = Join-Path $outputDir 'taskbarless-helper.exe'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}

if (-not (Test-Path -LiteralPath $compiler)) {
  throw 'Unable to find the .NET Framework C# compiler.'
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

& $compiler `
  /nologo `
  /optimize+ `
  /target:winexe `
  "/out:$outputPath" `
  $sourcePath
