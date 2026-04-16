# ============================================================
# Memory Directory Cleanup
# Removes stale one-off migration and node-fix artifacts from
# D:\Code\Claude\.claude-global\memory\
#
# KEEPS:
#   MEMORY.md, reference_*.md, scripts/, *.txt results files
# DELETES:
#   14x migration/node-fix scripts, PID, empty log, test .py files,
#   stale command note fragment
# ============================================================

$MEM = "D:\Code\Claude\.claude-global\memory"

$STALE = @(
    # Node.js path-fix one-offs (from GitNexus install battle)
    "fix_node_path.sh",
    "node_fix.sh",
    "node_fix2.sh",
    "node_fix3.sh",
    "node_path_final.sh",
    "node_wrappers.sh",
    "npm_wrapper.js",
    "npx_wrapper.js",
    # Migration scripts + artifacts (migration complete 2026-03-31)
    "launch_migration.sh",
    "migrate_batch.py",
    "migrate_global.py",
    "migrate_memories.py",
    "migration.log",
    "migration.pid",
    # One-off test/verify scripts (results kept in .txt files)
    "recall_test.py",
    "smoke_test.py",
    "test_stack.py",
    "verify_memory.py",
    # Stale fragment (commands table that belongs in CLAUDE.md)
    "cleanup-command-note.md"
)

Write-Host ""
Write-Host "=== Memory Cleanup ===" -ForegroundColor Cyan
Write-Host "Target: $MEM"
Write-Host ""

$deleted = 0
$skipped = 0
$missing = 0

foreach ($file in $STALE) {
    $path = Join-Path $MEM $file
    if (Test-Path $path) {
        $size = (Get-Item $path).Length
        Remove-Item $path -Force
        Write-Host "  🗑  Deleted  $file  ($size bytes)" -ForegroundColor Yellow
        $deleted++
    } else {
        Write-Host "  ✓  Already gone: $file" -ForegroundColor Gray
        $missing++
    }
}

Write-Host ""
Write-Host "--- Result ---"
Write-Host "  Deleted : $deleted files"
Write-Host "  Missing : $missing (already clean)"
Write-Host ""

# Show what remains
Write-Host "--- Remaining files in memory/ ---" -ForegroundColor Cyan
Get-ChildItem $MEM -File | Sort-Object Name | ForEach-Object {
    Write-Host ("  {0,-40} {1,8} bytes" -f $_.Name, $_.Length)
}
$subdirs = Get-ChildItem $MEM -Directory
foreach ($d in $subdirs) {
    $count = (Get-ChildItem $d.FullName -File).Count
    Write-Host ("  {0,-40} [{1} files]" -f "$($d.Name)/", $count) -ForegroundColor DarkCyan
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
