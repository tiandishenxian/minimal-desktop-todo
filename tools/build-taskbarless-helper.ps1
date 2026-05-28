$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $repoRoot 'extensions\window-win'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'

if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}

if (-not (Test-Path -LiteralPath $compiler)) {
  throw 'Unable to find the .NET Framework C# compiler.'
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function Build-Helper {
  param(
    [Parameter(Mandatory = $true)]
    [string]$SourceName,

    [Parameter(Mandatory = $true)]
    [string]$OutputName,

    [string]$Target = 'winexe'
  )

  $sourcePath = Join-Path $outputDir $SourceName
  $outputPath = Join-Path $outputDir $OutputName

  & $compiler `
    /nologo `
    /optimize+ `
    "/target:$Target" `
    "/out:$outputPath" `
    $sourcePath
}

Build-Helper -SourceName 'TaskbarlessHelper.cs' -OutputName 'taskbarless-helper.exe' -Target 'winexe'
Build-Helper -SourceName 'SingleInstanceHelper.cs' -OutputName 'single-instance-helper.exe' -Target 'exe'
