param(
  [string]$SourceApk = "..\releases\heritier-millionnaire-v1.0.apk",
  [string]$RepoUrl = "https://github.com/nowis30/jeux-millionnaire-APK.git",
  [string]$DestFileName = "heritier-millionnaire-v1.0.apk"
)

$ErrorActionPreference = 'Stop'

$client = Split-Path -Parent $MyInvocation.MyCommand.Path
$ws = Split-Path -Parent $client
Set-Location $ws

$destDir = Join-Path $ws "releases/jeux-millionnaire-APK"

Write-Host "Publishing APK -> $RepoUrl" -ForegroundColor Cyan

if (Test-Path $destDir) {
  Write-Host "- Cleaning previous clone..." -ForegroundColor Yellow
  Remove-Item -Path $destDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "- Cloning repo..." -ForegroundColor Yellow
 git clone $RepoUrl $destDir | Out-Host

if (!(Test-Path $SourceApk)) {
  throw "APK introuvable: $SourceApk"
}

Write-Host "- Copying APK..." -ForegroundColor Yellow
Copy-Item $SourceApk (Join-Path $destDir $DestFileName) -Force

$hash = (Get-FileHash -Algorithm SHA256 (Join-Path $destDir $DestFileName)).Hash
Write-Host "- SHA256: $hash" -ForegroundColor Green

Set-Location $destDir
 git add $DestFileName | Out-Host
 git commit -m "chore(apk): publish $DestFileName (SHA256 $($hash.Substring(0,8))...)" | Out-Host
 git push origin main | Out-Host

Write-Host "Done. URLs:" -ForegroundColor Green
$raw = "https://raw.githubusercontent.com/nowis30/jeux-millionnaire-APK/main/$DestFileName"
$cdn = "https://cdn.jsdelivr.net/gh/nowis30/jeux-millionnaire-APK@main/$DestFileName"
Write-Host " RAW: $raw"
Write-Host " CDN: $cdn"
