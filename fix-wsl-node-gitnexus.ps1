# ============================================================
# fix-wsl-node-gitnexus.ps1
# 1. Diagnose + fix Node.js availability in WSL
# 2. Run gitnexus analyze --embeddings on ndt-portal-v1 (background)
# 3. Initialize gitnexus on remaining 6 projects (background)
# All long-running jobs run via nohup so this script returns fast
# Logs written to /tmp/gitnexus-*.log
# ============================================================

$SEP = "=" * 60

# ── Step 1: Diagnose WSL node ─────────────────────────────────
Write-Host ""
Write-Host $SEP
Write-Host "  STEP 1: WSL Node.js Diagnosis"
Write-Host $SEP

$nodeCheck = wsl bash -ic "node --version 2>&1; echo NODE_PATH=`$(which node 2>/dev/null); echo NPX_PATH=`$(which npx 2>/dev/null)" 2>&1
Write-Host $nodeCheck

# ── Step 2: Ensure nvm loads in non-interactive shells ────────
Write-Host ""
Write-Host $SEP
Write-Host "  STEP 2: Fix .bashrc nvm block (idempotent)"
Write-Host $SEP

# Write nvm stanza to .bashrc only if not already present
$nvmFix = @'
# nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
'@

$fixCmd = @"
grep -q 'NVM_DIR' ~/.bashrc || printf '%s\n' '$nvmFix' >> ~/.bashrc && echo 'nvm block already present or just added'
"@
$r = wsl bash -ic $fixCmd 2>&1
Write-Host $r

# ── Step 3: Verify after fix ─────────────────────────────────
Write-Host ""
Write-Host $SEP
Write-Host "  STEP 3: Verify node + npx post-fix"
Write-Host $SEP

$verify = wsl bash -ic "node --version; npx --version; which npx" 2>&1
Write-Host $verify

# ── Step 4: Launch gitnexus jobs (background, nohup) ─────────
Write-Host ""
Write-Host $SEP
Write-Host "  STEP 4: Launch GitNexus jobs (background)"
Write-Host $SEP

$PROJECTS = @(
    @{ slug="ndt-portal-v1";   path="/mnt/d/Code/Claude/01_Business/Clients/ndt-portal-v1";  flags="--embeddings" },
    @{ slug="agency-os";        path="/mnt/d/Code/Claude/01_Business/Onnex/agency-os";         flags="" },
    @{ slug="atomic-ai-bp";     path="/mnt/d/Code/Claude/01_Business/Onnex/atomic-ai-bp";      flags="" },
    @{ slug="email-triage";     path="/mnt/d/Code/Claude/01_Business/Onnex/email-triage";      flags="" },
    @{ slug="AI-OS-POC";        path="/mnt/d/Code/Claude/03_Lab/_active/AI-OS-POC";            flags="" },
    @{ slug="ai-sentinel";      path="/mnt/d/Code/Claude/03_Lab/_active/ai-sentinel";          flags="" },
    @{ slug="personal-to-do";   path="/mnt/d/Code/Claude/03_Lab/_active/personal-to-do";       flags="" }
)

foreach ($p in $PROJECTS) {
    $slug   = $p.slug
    $path   = $p.path
    $flags  = $p.flags
    $log    = "/tmp/gitnexus-$slug.log"

    # Check the project exists in WSL
    $exists = wsl bash -ic "test -d '$path' && echo YES || echo NO" 2>&1
    if ($exists.Trim() -ne "YES") {
        Write-Host "  ⚠️  $slug — directory not found at $path, skipping" -ForegroundColor Yellow
        continue
    }

    $cmd = "cd '$path' && nohup npx gitnexus analyze $flags > $log 2>&1 &"
    wsl bash -ic $cmd 2>&1 | Out-Null
    Write-Host "  🚀 Launched: $slug $flags  →  log: $log" -ForegroundColor Green
}

# ── Step 5: Confirm processes started ────────────────────────
Write-Host ""
Write-Host $SEP
Write-Host "  STEP 5: Confirm gitnexus processes running"
Write-Host $SEP

Start-Sleep -Seconds 3
$procs = wsl bash -ic "pgrep -af 'gitnexus' 2>/dev/null || echo 'none found'" 2>&1
Write-Host $procs

# ── Step 6: Tail first few lines of each log ─────────────────
Write-Host ""
Write-Host $SEP
Write-Host "  STEP 6: Early log output (first 5 lines each)"
Write-Host $SEP

foreach ($p in $PROJECTS) {
    $slug = $p.slug
    $log  = "/tmp/gitnexus-$slug.log"
    Write-Host ""
    Write-Host "  [ $slug ]" -ForegroundColor Cyan
    $head = wsl bash -ic "test -f $log && head -5 $log || echo '(log not yet created)'" 2>&1
    Write-Host $head
}

Write-Host ""
Write-Host $SEP
Write-Host "  Jobs launched. Poll logs with:"
Write-Host "    wsl bash -ic 'tail -f /tmp/gitnexus-ndt-portal-v1.log'"
Write-Host "  Or check all at once:"
Write-Host "    wsl bash -ic 'for f in /tmp/gitnexus-*.log; do echo === `$f ===; tail -3 `$f; done'"
Write-Host $SEP
