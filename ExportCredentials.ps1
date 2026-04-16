# ExportCredentials.ps1
# Run this on your LOCAL LAPTOP (D:\code\claude).
# Zips all credentials and .env files excluded from git.
# Transfer the zip to the target machine and run ImportCredentials.ps1 there.

$root    = (Resolve-Path "D:\code\claude").Path   # resolves actual casing
$zipName = "ClaudeCredentials-$(Get-Date -Format 'yyyyMMdd-HHmm').zip"
$zipPath = "$env:USERPROFILE\Desktop\$zipName"
$tempDir = "$env:TEMP\claude-creds-export"

if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item $tempDir -ItemType Directory | Out-Null

Write-Host "`n=== Claude Credential Export ===" -ForegroundColor Cyan

# Helper: strip root prefix case-insensitively
function Get-RelPath($fullPath) {
    ($fullPath -ireplace [regex]::Escape($root), '').TrimStart('\')
}

# ── 1. Claude global credentials ──────────────────────────────
$claudeGlobalSrc = "$root\.claude-global"
$claudeGlobalDst = "$tempDir\claude-global"
New-Item $claudeGlobalDst -ItemType Directory | Out-Null

foreach ($f in @('.credentials.json', '.claude.json', '.claude.json.backup')) {
    $src = "$claudeGlobalSrc\$f"
    if (Test-Path $src) {
        Copy-Item $src "$claudeGlobalDst\$f" -Force
        Write-Host "  [+] claude-global\$f" -ForegroundColor Green
    }
}

# ── 2. All real .env files ─────────────────────────────────────
$envFiles = Get-ChildItem $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        ($_.Name -match '^\.env' -or $_.Name -eq '.env') -and
        $_.Name -notmatch '\.example' -and
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\.next\\'
    }

$envDir = "$tempDir\env-files"
New-Item $envDir -ItemType Directory | Out-Null

$manifestEntries = @()
foreach ($f in $envFiles) {
    $rel      = Get-RelPath $f.FullName
    $flatName = $rel -replace '\\', '__'
    Copy-Item $f.FullName "$envDir\$flatName" -Force
    Write-Host "  [+] $rel" -ForegroundColor Green
    $manifestEntries += [pscustomobject]@{ flatName = $flatName; relativePath = $rel }
}

# ── 3. Manifest ────────────────────────────────────────────────
@{
    exportedAt    = (Get-Date -Format 'o')
    sourceMachine = $env:COMPUTERNAME
    envFiles      = $manifestEntries
} | ConvertTo-Json -Depth 5 | Set-Content "$tempDir\manifest.json" -Encoding UTF8

# ── 4. Zip ─────────────────────────────────────────────────────
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
Remove-Item $tempDir -Recurse -Force

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "  Zip saved to: $zipPath" -ForegroundColor Yellow
Write-Host "  Transfer to target machine and run: .\ImportCredentials.ps1 -ZipPath '...'"
