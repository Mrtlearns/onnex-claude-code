# ExportCredentials.ps1
# Run this on your LOCAL LAPTOP (D:\code\claude).
# Zips all credentials and .env files that are excluded from git.
# Transfer the resulting zip to the target machine and run ImportCredentials.ps1 there.

$root     = "D:\code\claude"
$zipName  = "ClaudeCredentials-$(Get-Date -Format 'yyyyMMdd-HHmm').zip"
$zipPath  = "$env:USERPROFILE\Desktop\$zipName"
$tempDir  = "$env:TEMP\claude-creds-export"

# Clean temp
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item $tempDir -ItemType Directory | Out-Null

Write-Host "`n=== Claude Credential Export ===" -ForegroundColor Cyan

# ── 1. Claude global config ────────────────────────────────────
$claudeGlobalSrc = "$root\.claude-global"
$claudeGlobalDst = "$tempDir\claude-global"
New-Item $claudeGlobalDst -ItemType Directory | Out-Null

$claudeFiles = @('.credentials.json', '.claude.json', '.claude.json.backup')
foreach ($f in $claudeFiles) {
    $src = "$claudeGlobalSrc\$f"
    if (Test-Path $src) {
        Copy-Item $src "$claudeGlobalDst\$f" -Force
        Write-Host "  [+] claude-global\$f" -ForegroundColor Green
    }
}

# ── 2. All .env files (real ones, not .example) ────────────────
$envFiles = Get-ChildItem $root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object {
        ($_.Name -match '^\.env' -or $_.Name -eq '.env') -and
        $_.Name -notmatch '\.example' -and
        $_.FullName -notmatch '\\node_modules\\' -and
        $_.FullName -notmatch '\\.next\\'
    }

$envDir = "$tempDir\env-files"
New-Item $envDir -ItemType Directory | Out-Null

foreach ($f in $envFiles) {
    # Preserve relative path as flattened name: use __ as separator
    $rel = $f.FullName.Replace($root, '').TrimStart('\')
    $flatName = $rel.Replace('\', '__')
    Copy-Item $f.FullName "$envDir\$flatName" -Force
    Write-Host "  [+] $rel" -ForegroundColor Green
}

# ── 3. Write a manifest so ImportCredentials knows what goes where
$manifest = @{
    exportedAt = (Get-Date -Format 'o')
    sourceMachine = $env:COMPUTERNAME
    envFiles = $envFiles | ForEach-Object {
        @{ flatName = $_.FullName.Replace($root,'').TrimStart('\').Replace('\','__')
           relativePath = $_.FullName.Replace($root,'').TrimStart('\') }
    }
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content "$tempDir\manifest.json" -Encoding UTF8

# ── 4. Zip it ─────────────────────────────────────────────────
Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath -Force
Remove-Item $tempDir -Recurse -Force

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "  Zip saved to: $zipPath" -ForegroundColor Yellow
Write-Host "  Transfer this file to the target machine and run ImportCredentials.ps1`n"
