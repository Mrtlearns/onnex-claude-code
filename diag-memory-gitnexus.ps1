# ============================================================
# Diagnostic: Memory + GitNexus
# ============================================================

$SEP  = "=" * 60
$SEP2 = "-" * 60
$NOW  = Get-Date

$GLOBAL   = "D:\Code\Claude\.claude-global"
$PROJECTS = @(
    "D:\Code\Claude\01_Business\Clients\ndt-portal-v1",
    "D:\Code\Claude\01_Business\Onnex\agency-os",
    "D:\Code\Claude\01_Business\Onnex\atomic-ai-bp",
    "D:\Code\Claude\01_Business\Onnex\email-triage",
    "D:\Code\Claude\03_Lab\_active\AI-OS-POC",
    "D:\Code\Claude\03_Lab\_active\ai-sentinel",
    "D:\Code\Claude\03_Lab\_active\personal-to-do"
)

# ── helpers ──────────────────────────────────────────────────
function Age($path) {
    if (-not (Test-Path $path)) { return "N/A" }
    $d = (Get-Item $path).LastWriteTime
    $age = $NOW - $d
    if ($age.TotalDays -ge 1) { return "$([int]$age.TotalDays)d ago ($($d.ToString('yyyy-MM-dd')))" }
    return "$([int]$age.TotalHours)h ago"
}

function FileSize($path) {
    if (-not (Test-Path $path)) { return "MISSING" }
    $b = (Get-Item $path).Length
    if ($b -ge 1KB) { return "$([math]::Round($b/1KB,1)) KB" }
    return "$b B"
}

function Lines($path) {
    if (-not (Test-Path $path)) { return 0 }
    return (Get-Content $path).Count
}

function OK($v)   { if ($v) { "✅" } else { "❌" } }
function WARN($v) { if ($v) { "🟡" } else { "🔴" } }

# ════════════════════════════════════════════════════════════
Write-Host ""
Write-Host $SEP
Write-Host "  MEMORY DIAGNOSTIC"
Write-Host "  Run: $($NOW.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host $SEP

# ── Global memory files ──────────────────────────────────────
$memDir = "$GLOBAL\memory"
Write-Host ""
Write-Host "[ Memory Directory: $memDir ]"
if (Test-Path $memDir) {
    $files = Get-ChildItem $memDir -File | Sort-Object Name
    if ($files.Count -eq 0) {
        Write-Host "  ⚠️  Directory exists but is EMPTY"
    } else {
        foreach ($f in $files) {
            $lines = (Get-Content $f.FullName).Count
            $age   = Age $f.FullName
            $size  = FileSize $f.FullName
            Write-Host ("  {0,-35} {1,8}  {2,6} lines  modified {3}" -f $f.Name, $size, $lines, $age)
        }
    }
} else {
    Write-Host "  ❌ memory/ directory NOT FOUND"
}

# ── Context files ────────────────────────────────────────────
$ctxDir = "$GLOBAL\context"
Write-Host ""
Write-Host "[ Context Directory: $ctxDir ]"
if (Test-Path $ctxDir) {
    $files = Get-ChildItem $ctxDir -File -Recurse | Sort-Object FullName
    foreach ($f in $files) {
        $rel  = $f.FullName.Replace($ctxDir + "\", "")
        $age  = Age $f.FullName
        $size = FileSize $f.FullName
        $lines = (Get-Content $f.FullName).Count
        Write-Host ("  {0,-40} {1,8}  {2,5} lines  {3}" -f $rel, $size, $lines, $age)
    }
} else {
    Write-Host "  ❌ context/ directory NOT FOUND"
}

# ── BACKLOG ──────────────────────────────────────────────────
$backlog = "$GLOBAL\BACKLOG.md"
Write-Host ""
Write-Host "[ BACKLOG.md ]"
if (Test-Path $backlog) {
    $lines = Lines $backlog
    $age   = Age $backlog
    $open  = (Select-String -Path $backlog -Pattern "^\s*-\s*\[ \]" -ErrorAction SilentlyContinue).Count
    $done  = (Select-String -Path $backlog -Pattern "^\s*-\s*\[x\]" -ErrorAction SilentlyContinue -CaseSensitive:$false).Count
    Write-Host "  Size   : $(FileSize $backlog)  ($lines lines)"
    Write-Host "  Open   : $open items"
    Write-Host "  Done   : $done items"
    Write-Host "  Modified: $age"
} else {
    Write-Host "  ⚠️  BACKLOG.md not found at expected path"
}

# ── Global CLAUDE.md ─────────────────────────────────────────
$globalClaude = "$GLOBAL\CLAUDE.md"
Write-Host ""
Write-Host "[ Global CLAUDE.md ]"
Write-Host ("  $(OK (Test-Path $globalClaude)) {0,-20} {1}  {2}" -f "CLAUDE.md", (FileSize $globalClaude), (Age $globalClaude))

# ════════════════════════════════════════════════════════════
Write-Host ""
Write-Host $SEP
Write-Host "  GITNEXUS DIAGNOSTIC"
Write-Host $SEP

$gnSummary = @()

foreach ($proj in $PROJECTS) {
    $name    = Split-Path $proj -Leaf
    $gnDir   = "$proj\.gitnexus"
    $metaF   = "$gnDir\meta.json"
    $claudeF = "$proj\CLAUDE.md"

    Write-Host ""
    Write-Host "[ $name ]"
    Write-Host "  Path: $proj"

    # Project exists?
    if (-not (Test-Path $proj)) {
        Write-Host "  ❌ Project directory NOT FOUND — skipping"
        $gnSummary += [PSCustomObject]@{ Project=$name; GitNexus="❌ NOT FOUND"; Symbols="-"; Embeddings="-"; IndexAge="-"; Stale="-" }
        continue
    }

    # .gitnexus dir
    $hasGN = Test-Path $gnDir
    Write-Host "  $(OK $hasGN) .gitnexus/ directory"

    if (-not $hasGN) {
        Write-Host "  ⚠️  GitNexus not initialized on this project"
        $gnSummary += [PSCustomObject]@{ Project=$name; GitNexus="Not init"; Symbols="-"; Embeddings="-"; IndexAge="-"; Stale="-" }
        continue
    }

    # meta.json
    $hasMeta = Test-Path $metaF
    Write-Host "  $(OK $hasMeta) meta.json"

    $symbols    = "-"
    $relations  = "-"
    $embeddings = "-"
    $lastAnal   = "-"
    $stale      = "?"

    if ($hasMeta) {
        try {
            $meta = Get-Content $metaF -Raw | ConvertFrom-Json
            $symbols    = $meta.stats.symbols     ?? $meta.totalSymbols     ?? "-"
            $relations  = $meta.stats.relationships ?? $meta.totalRelationships ?? "-"
            $embeddings = $meta.stats.embeddings  ?? "0"
            $lastAnal   = $meta.lastAnalyzed      ?? $meta.analyzedAt       ?? "unknown"

            Write-Host "  📊 Symbols      : $symbols"
            Write-Host "  📊 Relationships: $relations"
            Write-Host "  📊 Embeddings   : $embeddings"
            Write-Host "  🕐 Last analyzed: $lastAnal"

            # Staleness: compare to last git commit
            if ($lastAnal -ne "unknown") {
                try {
                    $analDate = [datetime]::Parse($lastAnal)
                    $ageHours = ($NOW - $analDate).TotalHours
                    if ($ageHours -gt 168) {
                        $stale = "🔴 STALE ($([int]($ageHours/24))d)"
                    } elseif ($ageHours -gt 24) {
                        $stale = "🟡 $([int]($ageHours/24))d old"
                    } else {
                        $stale = "🟢 Fresh ($([int]$ageHours)h)"
                    }
                    Write-Host "  🔄 Index status : $stale"
                } catch {
                    Write-Host "  🔄 Index status : could not parse date"
                }
            }

            # Embeddings warning
            if ($embeddings -eq "0" -or $embeddings -eq 0) {
                Write-Host "  ⚠️  No embeddings — semantic search disabled (run: npx gitnexus analyze --embeddings)"
            }
        } catch {
            Write-Host "  ❌ Failed to parse meta.json: $_"
        }
    }

    # CLAUDE.md GitNexus section
    $hasClaudeMd = Test-Path $claudeF
    if ($hasClaudeMd) {
        $gnSection = (Select-String -Path $claudeF -Pattern "gitnexus" -CaseSensitive:$false).Count
        $hasGnBlock = $gnSection -gt 0
        Write-Host "  $(OK $hasGnBlock) CLAUDE.md has GitNexus section ($gnSection references)"
    } else {
        Write-Host "  ⚠️  CLAUDE.md not found"
    }

    # List .gitnexus contents
    $gnFiles = Get-ChildItem $gnDir -File | Sort-Object Length -Descending | Select-Object -First 8
    Write-Host "  📁 .gitnexus/ contents (top 8 by size):"
    foreach ($f in $gnFiles) {
        Write-Host ("     {0,-30} {1}" -f $f.Name, (FileSize $f.FullName))
    }

    $gnSummary += [PSCustomObject]@{
        Project     = $name
        GitNexus    = "✅ Init"
        Symbols     = $symbols
        Embeddings  = $embeddings
        IndexAge    = $stale
        CLAUDE_MD   = $(OK $hasGnBlock)
    }
}

# ── Summary table ─────────────────────────────────────────────
Write-Host ""
Write-Host $SEP
Write-Host "  GITNEXUS SUMMARY"
Write-Host $SEP
$gnSummary | Format-Table -AutoSize

Write-Host ""
Write-Host "Diagnostic complete — $($NOW.ToString('HH:mm:ss'))"
Write-Host $SEP
