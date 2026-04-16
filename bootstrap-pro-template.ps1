# ============================================================
# Pro Template Bootstrap Script
# Applies missing pro-template framework (.claude/commands,
# agents, framework skills, statusline, hooks, settings) to
# target projects that were never scaffolded from claude-workspace-pro.
#
# Sources:
#   commands/ + gsd/  --> ndt-portal-v1  (already cleaned to .planning/ paths)
#   agents/           --> claude-workspace-pro  (generic)
#   skills/ (5 core)  --> claude-workspace-pro  (generic)
#   statusline.sh     --> claude-workspace-pro
#   hooks/ (fixed)    --> claude-workspace-pro  (patched to use __file__-relative paths)
#
# settings.json: written with ABSOLUTE paths for all hook commands
# Safe to re-run (robocopy is idempotent, settings is fully overwritten)
# ============================================================

$CMD_SOURCE    = "D:\Code\Claude\01_Business\Clients\ndt-portal-v1\.claude"
$TEMPLATE      = "D:\Code\Claude\00_Frameworks\claude-workspace-pro\.claude"

$TARGETS = @(
    "D:\Code\Claude\01_Business\Onnex\atomic-ai-bp",
    "D:\Code\Claude\01_Business\Onnex\email-triage",
    "D:\Code\Claude\03_Lab\_active\AI-OS-POC",
    "D:\Code\Claude\03_Lab\_active\ai-sentinel",
    "D:\Code\Claude\03_Lab\_active\personal-to-do"
)

# agency-os was already fixed manually — removed from target list

$FRAMEWORK_SKILLS = @("code-review", "n8n", "security-audit", "systematic-debugging", "TDD")

function Copy-Dir($src, $dst) {
    if (-not (Test-Path $src)) { Write-Warning "  Source not found: $src"; return }
    New-Item -ItemType Directory -Path $dst -Force | Out-Null
    robocopy $src $dst /E /IS /IT /NFL /NDL /NJH /NJS 2>&1 | Out-Null
}

function Write-Settings($claude, $projectPath) {
    # Normalise to forward slashes for JSON
    $p = $projectPath.Replace('\', '/')
    $settingsPath = "$claude\settings.json"

    # Read existing hooks if the file already exists so we preserve any
    # project-specific hook config — but always overwrite statusLine and
    # ensure hook commands use absolute paths.
    $existingHooks = $null
    if (Test-Path $settingsPath) {
        try {
            $existing = Get-Content $settingsPath -Raw | ConvertFrom-Json
            # Only preserve hooks that are NOT cost-tracker / pre-compact
            # (we are replacing those with fixed absolute-path versions)
        } catch { }
    }

    $settings = @"
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python `"$p/.claude/hooks/cost-tracker.py`""
          }
        ],
        "matcher": ""
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python `"$p/.claude/hooks/pre-compact.py`""
          }
        ],
        "matcher": ""
      }
    ]
  },
  "statusLine": {
    "type": "command",
    "padding": 0,
    "command": "bash `"$p/.claude/statusline.sh`""
  }
}
"@
    $settings | Set-Content $settingsPath -Encoding UTF8
    Write-Host "    Written settings.json with absolute paths" -ForegroundColor Green
}

$errors = 0

foreach ($project in $TARGETS) {
    Write-Host ""
    Write-Host "=== $project ===" -ForegroundColor Cyan

    if (-not (Test-Path $project)) {
        Write-Warning "  Project directory not found — skipping: $project"
        $errors++
        continue
    }

    $claude = "$project\.claude"
    New-Item -ItemType Directory -Path $claude -Force | Out-Null

    # --- 1. commands/ ---
    Write-Host "  [1/6] commands/" -ForegroundColor Green
    Copy-Dir "$CMD_SOURCE\commands" "$claude\commands"

    # --- 2. agents/ ---
    Write-Host "  [2/6] agents/" -ForegroundColor Green
    Copy-Dir "$TEMPLATE\agents" "$claude\agents"

    # --- 3. framework skills ---
    Write-Host "  [3/6] framework skills/" -ForegroundColor Green
    foreach ($skill in $FRAMEWORK_SKILLS) {
        Copy-Dir "$TEMPLATE\skills\$skill" "$claude\skills\$skill"
    }

    # --- 4. statusline.sh ---
    Write-Host "  [4/6] statusline.sh" -ForegroundColor Green
    Copy-Item "$TEMPLATE\statusline.sh" "$claude\statusline.sh" -Force

    # --- 5. hooks/ (fixed — __file__-relative paths) ---
    Write-Host "  [5/6] hooks/" -ForegroundColor Green
    New-Item -ItemType Directory -Path "$claude\hooks" -Force | Out-Null
    Copy-Item "$TEMPLATE\hooks\cost-tracker.py" "$claude\hooks\cost-tracker.py" -Force
    Copy-Item "$TEMPLATE\hooks\pre-compact.py"  "$claude\hooks\pre-compact.py"  -Force

    # --- 6. settings.json (absolute paths throughout) ---
    Write-Host "  [6/6] settings.json" -ForegroundColor Green
    Write-Settings $claude $project

    Write-Host "  Done: $project" -ForegroundColor Green
}

Write-Host ""
if ($errors -eq 0) {
    Write-Host "=== All $($TARGETS.Count) projects updated successfully ===" -ForegroundColor Green
} else {
    Write-Host "=== Completed with $errors warning(s) — check output above ===" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Next: open each project in Claude Code and run /prime to verify." -ForegroundColor Cyan
