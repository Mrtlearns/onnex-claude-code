# ============================================================
# gitnexus-check.ps1
# Windows-native only — no WSL calls (WSL hangs MCP)
# Checks meta.json state for all projects
# Reports what's needed + prints ready-to-paste WSL block
# ============================================================

$PROJECTS = @(
    @{ slug="ndt-portal-v1";  path="D:\Code\Claude\01_Business\Clients\ndt-portal-v1";  flags="--embeddings" },
    @{ slug="agency-os";       path="D:\Code\Claude\01_Business\Onnex\agency-os";         flags="" },
    @{ slug="atomic-ai-bp";    path="D:\Code\Claude\01_Business\Onnex\atomic-ai-bp";      flags="" },
    @{ slug="email-triage";    path="D:\Code\Claude\01_Business\Onnex\email-triage";      flags="" },
    @{ slug="AI-OS-POC";       path="D:\Code\Claude\03_Lab\_active\AI-OS-POC";            flags="" },
    @{ slug="ai-sentinel";     path="D:\Code\Claude\03_Lab\_active\ai-sentinel";          flags="" },
    @{ slug="personal-to-do";  path="D:\Code\Claude\03_Lab\_active\personal-to-do";       flags="" }
)

$SEP = "=" * 60
$needsWork = @()

Write-Host ""
Write-Host $SEP
Write-Host "  GITNEXUS STATE CHECK"
Write-Host $SEP

foreach ($p in $PROJECTS) {
    $slug    = $p.slug
    $meta    = "$($p.path)\.gitnexus\meta.json"
    $flags   = $p.flags

    Write-Host ""
    Write-Host "  [ $slug ]" -ForegroundColor Cyan

    if (-not (Test-Path $p.path)) {
        Write-Host "    ❌ Project dir not found" -ForegroundColor Red
        continue
    }

    if (-not (Test-Path $meta)) {
        Write-Host "    ❌ Not indexed — needs: npx gitnexus analyze $flags" -ForegroundColor Red
        $needsWork += $p
        continue
    }

    try {
        $m          = Get-Content $meta -Raw | ConvertFrom-Json
        $indexedAt  = $m.indexedAt
        $symbols    = $m.stats.nodes
        $edges      = $m.stats.edges
        $embeddings = $m.stats.embeddings
        $files      = $m.stats.files

        $ageHours = [math]::Round(([datetime]::UtcNow - [datetime]::Parse($indexedAt)).TotalHours, 1)

        $embStatus = if ($embeddings -gt 0) { "✅ $embeddings" } else { "⚠️  0 — semantic search DISABLED" }

        Write-Host "    ✅ Indexed: $indexedAt  ($ageHours h ago)" -ForegroundColor Green
        Write-Host "    📊 Symbols=$symbols  Edges=$edges  Files=$files"
        Write-Host "    🔍 Embeddings: $embStatus"

        if ($embeddings -eq 0) {
            Write-Host "    ⚠️  Needs: npx gitnexus analyze --embeddings" -ForegroundColor Yellow
            $needsWork += $p | Select-Object slug, path, @{n='flags';e={'--embeddings'}}
        }
    } catch {
        Write-Host "    ⚠️  Could not parse meta.json: $_" -ForegroundColor Yellow
        $needsWork += $p
    }
}

# ── Print WSL block ───────────────────────────────────────────
Write-Host ""
Write-Host $SEP
Write-Host "  WSL COMMANDS TO RUN"
Write-Host "  (paste into WSL terminal — all jobs backgrounded)"
Write-Host $SEP
Write-Host ""
Write-Host 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'
Write-Host ""

foreach ($p in $needsWork) {
    $wslPath = $p.path.Replace("D:\", "/mnt/d/").Replace("\", "/")
    $flags   = $p.flags
    $log     = "/tmp/gitnexus-$($p.slug).log"
    Write-Host "cd '$wslPath' && nohup npx gitnexus analyze $flags > $log 2>&1 & echo started $($p.slug)"
}

Write-Host ""
Write-Host "# Monitor:"
Write-Host "for f in /tmp/gitnexus-*.log; do echo `"=== `$f ==`"; tail -3 `"`$f`"; done"
Write-Host ""
Write-Host $SEP

if ($needsWork.Count -eq 0) {
    Write-Host "  ✅ All projects indexed with embeddings — nothing to do!" -ForegroundColor Green
} else {
    Write-Host "  $($needsWork.Count) project(s) need indexing. Run the WSL block above." -ForegroundColor Yellow
}
Write-Host $SEP
