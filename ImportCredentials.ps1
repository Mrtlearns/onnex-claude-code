# ImportCredentials.ps1
# Run this on the TARGET MACHINE after cloning D:\code\claude.
# Point it at the zip produced by ExportCredentials.ps1.
#
# Usage:  .\ImportCredentials.ps1 -ZipPath "C:\path\to\ClaudeCredentials-20260416.zip"

param(
    [Parameter(Mandatory=$true)]
    [string]$ZipPath
)

$codeRoot    = "D:\code\claude"
$claudeHome  = "C:\Users\$env:USERNAME\.claude"   # default Claude global dir on this machine
$tempDir     = "$env:TEMP\claude-creds-import"

if (-not (Test-Path $ZipPath)) {
    Write-Host "[ERROR] Zip not found: $ZipPath" -ForegroundColor Red
    exit 1
}

# Clean and extract
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item $tempDir -ItemType Directory | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $tempDir -Force

Write-Host "`n=== Claude Credential Import ===" -ForegroundColor Cyan
Write-Host "  Claude home : $claudeHome"
Write-Host "  Code root   : $codeRoot`n"

# ── 1. Claude global config → C:\Users\<user>\.claude\ ────────
$claudeGlobalSrc = "$tempDir\claude-global"
if (Test-Path $claudeGlobalSrc) {
    if (-not (Test-Path $claudeHome)) { New-Item $claudeHome -ItemType Directory | Out-Null }
    foreach ($f in Get-ChildItem $claudeGlobalSrc -Force) {
        $dst = "$claudeHome\$($f.Name)"
        Copy-Item $f.FullName $dst -Force
        Write-Host "  [+] $($f.Name) → $dst" -ForegroundColor Green
    }
}

# ── 2. .env files → back to their original relative paths ─────
$manifest = Get-Content "$tempDir\manifest.json" -Raw | ConvertFrom-Json
$envSrcDir = "$tempDir\env-files"

foreach ($entry in $manifest.envFiles) {
    $src = "$envSrcDir\$($entry.flatName)"
    $dst = "$codeRoot\$($entry.relativePath)"
    $dstDir = Split-Path $dst -Parent
    if (-not (Test-Path $dstDir)) { New-Item $dstDir -ItemType Directory -Force | Out-Null }
    Copy-Item $src $dst -Force
    Write-Host "  [+] $($entry.relativePath)" -ForegroundColor Green
}

# ── 3. Also copy .claude-global contents to Claude home ───────
#    (this copies skills, plugins, commands, memory etc.)
$claudeGlobalFullSrc = "$tempDir\claude-global"  # already handled above for credentials
# Copy the full .claude-global from the repo into Claude home
$repoClaudeGlobal = "$codeRoot\.claude-global"
if (Test-Path $repoClaudeGlobal) {
    Write-Host "`n  Syncing .claude-global content to $claudeHome ..." -ForegroundColor Yellow
    $excludeDirs = @('projects','file-history','session-env','paste-cache','shell-snapshots','telemetry','statsig','todos','tasks','plans','state','chrome','cache','backups')
    Get-ChildItem $repoClaudeGlobal -Force | Where-Object { $excludeDirs -notcontains $_.Name } | ForEach-Object {
        $dst = "$claudeHome\$($_.Name)"
        Copy-Item $_.FullName $dst -Recurse -Force
        Write-Host "  [+] $($_.Name) → $dst" -ForegroundColor Green
    }
}

Remove-Item $tempDir -Recurse -Force

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "  Claude global config is live at $claudeHome"
Write-Host "  .env files restored to D:\code\claude project paths"
Write-Host "  Run NpmInstall.ps1 next if you haven't already.`n"
