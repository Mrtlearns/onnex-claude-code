# VerifySetup.ps1 - Run on target machine to confirm everything is in order

$ok   = 0
$warn = 0
$fail = 0

function Pass($msg) { Write-Host "  [OK]   $msg" -ForegroundColor Green;  $script:ok++   }
function Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow; $script:warn++ }
function Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red;    $script:fail++ }

$claudeHome = "C:\Users\$env:USERNAME\.claude"
$codeRoot   = "D:\code\claude"

Write-Host ""
Write-Host "=== Claude Workspace Verification ===" -ForegroundColor Cyan
Write-Host "  User      : $env:USERNAME"
Write-Host "  ClaudeHome: $claudeHome"
Write-Host "  CodeRoot  : $codeRoot"
Write-Host ""

Write-Host "-- Repo" -ForegroundColor Cyan
if (Test-Path "$codeRoot\.git")           { Pass "Git repo present"            } else { Fail "No .git at $codeRoot" }
if (Test-Path "$codeRoot\.gitignore")     { Pass ".gitignore present"          } else { Warn ".gitignore missing" }
if (Test-Path "$codeRoot\.claude-global") { Pass ".claude-global present"      } else { Fail ".claude-global missing" }
if (Test-Path "$codeRoot\.claude")        { Pass ".claude project config present" } else { Warn ".claude project config missing" }

Write-Host ""
Write-Host "-- Claude Global Config" -ForegroundColor Cyan
if (Test-Path $claudeHome)                             { Pass "Dir exists"                } else { Fail "Dir missing - run ImportCredentials.ps1" }
if (Test-Path "$claudeHome\.credentials.json")         { Pass ".credentials.json present" } else { Fail ".credentials.json MISSING - Claude will not auth" }
if (Test-Path "$claudeHome\.claude.json")              { Pass ".claude.json present"      } else { Warn ".claude.json missing" }
if (Test-Path "$claudeHome\settings.json")             { Pass "settings.json present"     } else { Warn "settings.json missing" }
if (Test-Path "$claudeHome\plugins")                   { Pass "plugins dir present"       } else { Warn "plugins dir missing" }
if (Test-Path "$claudeHome\skills")                    { Pass "skills dir present"        } else { Warn "skills dir missing" }
if (Test-Path "$claudeHome\.claude")                   { Warn ".claude subdir exists inside claudeHome - possible nesting issue" } else { Pass "No nested .claude subdir (clean)" }

Write-Host ""
Write-Host "-- Secrets / .env files" -ForegroundColor Cyan
$envPaths = @(
    "01_Business\Clients\ndt-portal-v1\.env",
    "01_Business\Clients\ndt-portal-v1\frontend\.env.local",
    "01_Business\Clients\ndt-portal-v1\frontend\.env.production",
    "03_Lab\_active\ai-maturity-compass\.env",
    "03_Lab\_active\personal-to-do\.env",
    "03_Lab\_active\ragv1\.env",
    "03_Lab\_active\ragv1\supabase\functions\.env"
)
foreach ($rel in $envPaths) {
    if (Test-Path (Join-Path $codeRoot $rel)) { Pass $rel } else { Warn "Missing: $rel" }
}

Write-Host ""
Write-Host "-- Active Projects (node_modules)" -ForegroundColor Cyan
$projects = @(
    "01_Business\Clients\ndt-portal-v1\api",
    "01_Business\Clients\ndt-portal-v1\frontend",
    "03_Lab\_active\pi-lawyer-os\frontend",
    "03_Lab\_active\ragv1",
    "03_Lab\_active\personal-to-do",
    "03_Lab\_active\ai-maturity-compass",
    "03_Lab\_active\cmmc4msp\nextjs"
)
foreach ($rel in $projects) {
    if (Test-Path (Join-Path $codeRoot "$rel\node_modules")) { Pass $rel } else { Warn "npm install needed: $rel" }
}

Write-Host ""
Write-Host "-- Git Remote" -ForegroundColor Cyan
$remote = & git -C $codeRoot remote get-url origin 2>$null
if ($remote -match "gitlab") { Pass "Remote: $remote" } else { Warn "Git remote not set or unexpected: $remote" }

Write-Host ""
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  PASS : $ok"   -ForegroundColor Green
Write-Host "  WARN : $warn" -ForegroundColor Yellow
Write-Host "  FAIL : $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
Write-Host ""
if     ($fail -gt 0)  { Write-Host "  Fix FAIL items before using Claude on this machine." -ForegroundColor Red }
elseif ($warn -gt 0)  { Write-Host "  No hard failures. Review warnings above." -ForegroundColor Yellow }
else                  { Write-Host "  All good - ready to use." -ForegroundColor Green }
Write-Host ""