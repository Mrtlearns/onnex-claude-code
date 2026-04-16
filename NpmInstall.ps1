# NpmInstall.ps1
# Run this once after cloning D:\code\claude on the target machine.
# Finds all package.json files in active/business projects and runs npm install.

$root = "D:\code\claude"

# Dirs to skip entirely
$skipPatterns = @(
    '\\node_modules\\',
    '\\.next\\',
    '\\_archive\\',
    '\\standalone\\',
    '\\dist\\',
    '\\build\\'
)

Write-Host "`n=== Claude Workspace npm install ===" -ForegroundColor Cyan
Write-Host "Root: $root`n"

$packageFiles = Get-ChildItem $root -Recurse -Filter "package.json" -File -ErrorAction SilentlyContinue |
    Where-Object {
        $path = $_.FullName
        $skip = $false
        foreach ($p in $skipPatterns) { if ($path -match [regex]::Escape($p)) { $skip = $true; break } }
        -not $skip
    }

Write-Host "Found $($packageFiles.Count) package.json files to process`n"

$success = 0
$skipped = 0
$failed  = 0

foreach ($pkg in $packageFiles) {
    $dir = $pkg.DirectoryName
    $rel = $dir.Replace($root, '').TrimStart('\')

    # Skip if node_modules already present (already installed)
    if (Test-Path "$dir\node_modules") {
        Write-Host "  [SKIP]  $rel  (node_modules exists)" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    Write-Host "  [INSTALL] $rel ..." -ForegroundColor Yellow
    Push-Location $dir
    try {
        $out = & npm install 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK]    $rel" -ForegroundColor Green
            $success++
        } else {
            Write-Host "  [FAIL]  $rel" -ForegroundColor Red
            Write-Host ($out | Select-Object -Last 5 | Out-String) -ForegroundColor DarkRed
            $failed++
        }
    } catch {
        Write-Host "  [ERR]   $rel - $_" -ForegroundColor Red
        $failed++
    } finally {
        Pop-Location
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "  Installed : $success" -ForegroundColor Green
Write-Host "  Skipped   : $skipped" -ForegroundColor DarkGray
Write-Host "  Failed    : $failed" -ForegroundColor $(if ($failed -gt 0) { 'Red' } else { 'Green' })
