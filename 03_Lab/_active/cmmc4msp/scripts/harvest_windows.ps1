<#
.SYNOPSIS
    CMMC Level 2 Evidence Harvester — Windows / Active Directory
    Onnex AI Agency | cmmc4msp platform

.DESCRIPTION
    Collects 12 evidence artifacts mapped to NIST SP 800-171 Rev 2 control IDs,
    builds a manifest.json, zips the bundle, and POSTs it to the CMMC platform
    bulk-upload endpoint. No credentials, user files, or PII beyond AD usernames
    are collected. Must be run with domain admin / local admin privileges on a
    domain controller or representative endpoint.

.PARAMETER ApiUrl
    Base URL of the CMMC platform, e.g. https://cmmc.example.com

.PARAMETER Token
    Bearer token issued by the platform (Settings > API Tokens).

.PARAMETER ProgramId
    UUID of the compliance program this evidence belongs to.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\harvest_windows.ps1 `
        -ApiUrl https://cmmc.example.com `
        -Token eyJhbGci... `
        -ProgramId 00000000-0000-0000-0000-000000000001

.NOTES
    Compatible with: PowerShell 5.1+
    Requires elevation: Yes (domain admin or local admin)
    Estimated runtime: 2–5 minutes depending on GPO size and hotfix count.
    Safe to re-run — each run creates a fresh timestamped folder.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$Token,

    [Parameter(Mandatory = $true)]
    [string]$ProgramId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Write-Step {
    param([string]$Message)
    Write-Host "[CMMC] $Message" -ForegroundColor Cyan
}

function Write-OK {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [WARN] $Message" -ForegroundColor Yellow
}

# ---------------------------------------------------------------------------
# Setup — temp working directory
# ---------------------------------------------------------------------------
$timestamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$folderName = "cmmc-harvest-$timestamp"
$tempDir    = Join-Path $env:TEMP $folderName
$zipPath    = Join-Path $env:TEMP "$folderName.zip"

New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Write-Step "Working folder: $tempDir"

# ---------------------------------------------------------------------------
# Manifest skeleton
# ---------------------------------------------------------------------------
$manifest = [ordered]@{
    generated_at = (Get-Date -Format 'o')
    hostname     = $env:COMPUTERNAME
    os           = ''
    program_id   = $ProgramId
    files        = [System.Collections.Generic.List[object]]::new()
    errors       = [System.Collections.Generic.List[object]]::new()
}

# Capture OS string early (best effort)
try {
    $osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop
    $manifest['os'] = "$($osInfo.Caption) Build $($osInfo.BuildNumber)"
} catch {
    $manifest['os'] = [System.Environment]::OSVersion.VersionString
}

# ---------------------------------------------------------------------------
# Artifact collection table
# Each entry: filename, scriptblock, nist_ids
# ---------------------------------------------------------------------------
$artifacts = @(
    @{
        filename = 'firewall_rules.txt'
        nist_ids = @('3.13.1', '3.13.5', '3.13.6')
        collect  = {
            Get-NetFirewallRule -PolicyStore ActiveStore |
                Select-Object Name, DisplayName, Enabled, Direction, Action, Profile |
                Format-Table -AutoSize |
                Out-String -Width 300
        }
    },
    @{
        filename = 'gpo_report.html'
        nist_ids = @('3.1.1', '3.1.5', '3.4.1', '3.4.2')
        collect  = {
            # Requires RSAT Group Policy Management Tools
            $outPath = Join-Path $tempDir 'gpo_report.html'
            Get-GPOReport -All -ReportType HTML -Path $outPath
            # Return null so the caller skips the Out-File write
            $null
        }
    },
    @{
        filename = 'local_admins.txt'
        nist_ids = @('3.1.5', '3.5.1')
        collect  = {
            Get-LocalGroupMember -Group 'Administrators' |
                Select-Object Name, ObjectClass, PrincipalSource |
                Format-Table -AutoSize |
                Out-String -Width 200
        }
    },
    @{
        filename = 'mfa_registry.txt'
        nist_ids = @('3.5.3')
        collect  = {
            $sb = [System.Text.StringBuilder]::new()

            # WDigest — UseLogonCredential = 0 means credentials NOT stored in cleartext
            $wdigestPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest'
            [void]$sb.AppendLine('=== WDigest (UseLogonCredential) ===')
            try {
                $val = (Get-ItemProperty -Path $wdigestPath -Name UseLogonCredential -ErrorAction Stop).UseLogonCredential
                [void]$sb.AppendLine("UseLogonCredential : $val  (0 = secure, 1 = cleartext)")
            } catch {
                [void]$sb.AppendLine("Key not found — default secure (UseLogonCredential absent = 0)")
            }

            # Credential Guard / LSA Protection
            $lsaPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa'
            [void]$sb.AppendLine('')
            [void]$sb.AppendLine('=== LSA Protection ===')
            try {
                $lsa = Get-ItemProperty -Path $lsaPath -ErrorAction Stop
                [void]$sb.AppendLine("RunAsPPL          : $($lsa.RunAsPPL)")
                [void]$sb.AppendLine("LmCompatibilityLevel : $($lsa.LmCompatibilityLevel)")
                [void]$sb.AppendLine("NoLMHash          : $($lsa.NoLMHash)")
            } catch {
                [void]$sb.AppendLine("Could not read LSA keys: $_")
            }

            # Credential Guard (DeviceGuard)
            $dgPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard'
            [void]$sb.AppendLine('')
            [void]$sb.AppendLine('=== Device Guard / Credential Guard ===')
            try {
                $dg = Get-ItemProperty -Path $dgPath -ErrorAction Stop
                [void]$sb.AppendLine("EnableVirtualizationBasedSecurity : $($dg.EnableVirtualizationBasedSecurity)")
                [void]$sb.AppendLine("RequirePlatformSecurityFeatures   : $($dg.RequirePlatformSecurityFeatures)")
            } catch {
                [void]$sb.AppendLine("DeviceGuard key not found (may not be configured)")
            }

            # SmartCard enforcement
            $scPath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
            [void]$sb.AppendLine('')
            [void]$sb.AppendLine('=== SmartCard / MFA Policy ===')
            try {
                $sc = Get-ItemProperty -Path $scPath -ErrorAction Stop
                [void]$sb.AppendLine("scforceoption  : $($sc.scforceoption)")
                [void]$sb.AppendLine("scremoveoption : $($sc.scremoveoption)")
            } catch {
                [void]$sb.AppendLine("SmartCard policy keys not found")
            }

            $sb.ToString()
        }
    },
    @{
        filename = 'patch_status.csv'
        nist_ids = @('3.11.2', '3.14.1')
        collect  = {
            $csvPath = Join-Path $tempDir 'patch_status.csv'
            Get-HotFix |
                Select-Object HotFixID, Description, InstalledOn, InstalledBy |
                Sort-Object InstalledOn -Descending |
                Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
            $null
        }
    },
    @{
        filename = 'av_status.txt'
        nist_ids = @('3.14.2', '3.14.4', '3.14.5')
        collect  = {
            Get-MpComputerStatus | Format-List | Out-String -Width 200
        }
    },
    @{
        filename = 'bitlocker_status.txt'
        nist_ids = @('3.8.9', '3.13.11', '3.13.16')
        collect  = {
            Get-BitLockerVolume |
                Select-Object MountPoint, VolumeStatus, EncryptionMethod,
                              EncryptionPercentage, KeyProtector, ProtectionStatus |
                Format-List |
                Out-String -Width 200
        }
    },
    @{
        filename = 'tls_cipher_suites.txt'
        nist_ids = @('3.13.8', '3.13.11')
        collect  = {
            Get-TlsCipherSuite |
                Select-Object Name, Exchange, Hash, Cipher, CipherBlockLength, CipherSuiteId |
                Format-Table -AutoSize |
                Out-String -Width 300
        }
    },
    @{
        filename = 'audit_policy.txt'
        nist_ids = @('3.3.1', '3.3.2')
        collect  = {
            & auditpol /get /category:* 2>&1
        }
    },
    @{
        filename = 'services_list.txt'
        nist_ids = @('3.4.7')
        collect  = {
            Get-Service |
                Select-Object Name, DisplayName, Status, StartType |
                Sort-Object Status, Name |
                Format-Table -AutoSize |
                Out-String -Width 300
        }
    },
    @{
        filename = 'scheduled_tasks.txt'
        nist_ids = @('3.4.7', '3.6.3')
        collect  = {
            Get-ScheduledTask |
                Select-Object TaskName, TaskPath, State, Description |
                Sort-Object State, TaskPath |
                Format-Table -AutoSize |
                Out-String -Width 300
        }
    },
    @{
        filename = 'computer_info.txt'
        nist_ids = @('3.4.1', '3.11.3')
        collect  = {
            Get-ComputerInfo | Format-List | Out-String -Width 300
        }
    }
)

# ---------------------------------------------------------------------------
# Collect each artifact
# ---------------------------------------------------------------------------
Write-Step "Collecting $($artifacts.Count) evidence artifacts..."

foreach ($artifact in $artifacts) {
    $filename = $artifact['filename']
    $nistIds  = $artifact['nist_ids']
    $collect  = $artifact['collect']

    Write-Host "  Collecting $filename ..." -NoNewline

    try {
        $result = & $collect

        # Some collectors write the file themselves and return $null
        if ($null -ne $result) {
            $outPath = Join-Path $tempDir $filename
            $result | Out-File -FilePath $outPath -Encoding UTF8 -Force
        }

        # Verify the file was actually created
        $outPath = Join-Path $tempDir $filename
        if (Test-Path $outPath) {
            $size = (Get-Item $outPath).Length
            Write-Host " OK ($size bytes)" -ForegroundColor Green
            $manifest['files'].Add([ordered]@{
                filename  = $filename
                nist_ids  = $nistIds
                size_bytes = $size
                status    = 'collected'
            })
        } else {
            throw "File was not created after collection"
        }
    } catch {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Warn "$filename : $_"
        $manifest['errors'].Add([ordered]@{
            filename = $filename
            nist_ids = $nistIds
            error    = $_.ToString()
        })
    }
}

# ---------------------------------------------------------------------------
# Write manifest.json
# ---------------------------------------------------------------------------
Write-Step "Writing manifest.json..."
$manifestPath = Join-Path $tempDir 'manifest.json'
$manifest | ConvertTo-Json -Depth 5 | Out-File -FilePath $manifestPath -Encoding UTF8
Write-OK "manifest.json written"

# ---------------------------------------------------------------------------
# Create ZIP archive
# ---------------------------------------------------------------------------
Write-Step "Creating ZIP archive: $zipPath"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $zipPath)

$zipSizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-OK "ZIP created ($zipSizeMB MB)"

# ---------------------------------------------------------------------------
# POST to platform
# ---------------------------------------------------------------------------
Write-Step "Uploading to $ApiUrl ..."
$uploadUrl = "$($ApiUrl.TrimEnd('/'))/api/artifacts/bulk-upload-zip?program_id=$ProgramId"

try {
    $headers  = @{ Authorization = "Bearer $Token" }
    $formData = @{ file = Get-Item $zipPath }

    $response = Invoke-RestMethod `
        -Uri         $uploadUrl `
        -Method      Post `
        -Headers     $headers `
        -Form        $formData `
        -ContentType 'multipart/form-data' `
        -TimeoutSec  120

    Write-OK "Upload successful"
    Write-Host ""
    Write-Host "Platform response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5 | Write-Host
} catch {
    Write-Host ""
    Write-Warn "Upload failed: $_"
    Write-Warn "ZIP remains at: $zipPath — upload manually or re-run."
    # Don't exit — still print summary
}

# ---------------------------------------------------------------------------
# Cleanup temp folder (keep zip until confirmed uploaded)
# ---------------------------------------------------------------------------
Write-Step "Cleaning up temp folder..."
Remove-Item -Recurse -Force $tempDir
Write-OK "Temp folder removed"

# Remove zip only if upload succeeded
if ($response) {
    Remove-Item -Force $zipPath -ErrorAction SilentlyContinue
    Write-OK "ZIP removed after successful upload"
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
$collectedFiles  = $manifest['files'].Count
$failedFiles     = $manifest['errors'].Count
$coveredControls = ($manifest['files'] | ForEach-Object { $_['nist_ids'] } |
                    Select-Object -Unique | Measure-Object).Count

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CMMC Evidence Harvest — Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Host          : $($manifest['hostname'])"
Write-Host "  OS            : $($manifest['os'])"
Write-Host "  Generated at  : $($manifest['generated_at'])"
Write-Host "  Files OK      : $collectedFiles / $($artifacts.Count)"
Write-Host "  Files failed  : $failedFiles"
Write-Host "  NIST controls covered : $coveredControls"
if ($failedFiles -gt 0) {
    Write-Host ""
    Write-Host "  Failed artifacts:" -ForegroundColor Yellow
    foreach ($err in $manifest['errors']) {
        Write-Host "    - $($err['filename']): $($err['error'])" -ForegroundColor Yellow
    }
}
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
