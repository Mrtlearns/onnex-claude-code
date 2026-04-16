# ImportCredentials.ps1
# Run on TARGET MACHINE after cloning D:\code\claude.
# Usage: .\ImportCredentials.ps1 -ZipPath "C:\path\to\ClaudeCredentials-YYYYMMDD.zip"

param(
    [Parameter(Mandatory=$true)]
    [string]$ZipPath
)

$codeRoot   = "D:\code\claude"
$claudeHome = "C:\Users\$env:USERNAME\.claude"
$tempDir    = "$env:TEMP\claude-creds-import"

if (-not (Test-Path $ZipPath)) {
    Write-Host "[ERROR] Zip not found: $ZipPath" -ForegroundColor Red
    exit 1
}

if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item $tempDir -ItemType Directory | Out-Null
Expand-Archive -Path $ZipPath -DestinationPath $tempDir -Force

Write-Host ""
Write-Host "=== Claude Credential Import ===" -ForegroundColor Cyan
Write-Host "  Claude home : $claudeHome"
Write-Host "  Code root   : $codeRoot"
Write-Host ""

# --- 1. Claude credentials -> C:\Users\<user>\.claude\ ---
$claudeGlobalSrc = Join-Path $tempDir "claude-global"
if (Test-Path $claudeGlobalSrc) {
    if (-not (Test-Path $claudeHome)) {
        New-Item $claudeHome -ItemType Directory -Force | Out-Null
    }
    foreach ($f in Get-ChildItem $claudeGlobalSrc -Force -ErrorAction SilentlyContinue) {
        $dst = Join-Path $claudeHome $f.Name
        Copy-Item $f.FullName $dst -Force
        Write-Host "  [+] $($f.Name) -> $dst" -ForegroundColor Green
    }
}

# --- 2. .env files -> original relative paths ---
$manifestPath = Join-Path $tempDir "manifest.json"
if (Test-Path $manifestPath) {
    $manifest  = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $envSrcDir = Join-Path $tempDir "env-files"

    foreach ($entry in $manifest.envFiles) {
        $src    = Join-Path $envSrcDir $entry.flatName
        $dst    = Join-Path $codeRoot  $entry.relativePath
        $dstDir = Split-Path $dst -Parent

        if (-not (Test-Path $src)) {
            Write-Host "  [SKIP] not in zip: $($entry.flatName)" -ForegroundColor DarkYellow
            continue
        }
        if (-not (Test-Path $dstDir)) {
            New-Item $dstDir -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
        }
        Copy-Item $src $dst -Force
        Write-Host "  [+] $($entry.relativePath)" -ForegroundColor Green
    }
} else {
    Write-Host "  [WARN] manifest.json missing - skipping .env restore" -ForegroundColor Yellow
}

# --- 3. Sync .claude-global repo content (skills, plugins, etc.) ---
$repoClaudeGlobal = Join-Path $codeRoot ".claude-global"
if (Test-Path $repoClaudeGlobal) {
    Write-Host ""
    Write-Host "  Syncing .claude-global content to $claudeHome ..." -ForegroundColor Yellow
    $skipDirs = @('projects','file-history','session-env','paste-cache',
                  'shell-snapshots','telemetry','statsig','todos','tasks',
                  'plans','state','chrome','cache','backups','.claude')
    foreach ($item in Get-ChildItem $repoClaudeGlobal -Force -ErrorAction SilentlyContinue) {
        if ($skipDirs -contains $item.Name) { continue }
        $dst = Join-Path $claudeHome $item.Name
        Copy-Item $item.FullName $dst -Recurse -Force
        Write-Host "  [+] $($item.Name)" -ForegroundColor Green
    }
}

Remove-Item $tempDir -Recurse -Force

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "  Claude global config : $claudeHome"
Write-Host "  .env files restored  : $codeRoot\..."
Write-Host "  Run NpmInstall.ps1 next if not already done."
Write-Host ""