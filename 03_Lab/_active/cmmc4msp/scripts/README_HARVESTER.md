# CMMC Evidence Harvester — Usage Guide

**Platform:** CMMC Compliance OS (cmmc4msp)
**Audience:** IT Administrators running evidence collection at client sites
**Scripts:** `harvest_windows.ps1` (Windows DC / endpoint) | `harvest_linux.sh` (Linux server)

---

## What These Scripts Do

The harvesters collect system configuration snapshots — evidence artifacts — that map directly to NIST SP 800-171 Rev 2 controls required for CMMC Level 2 certification. Each run produces a timestamped ZIP file containing the artifacts and a `manifest.json` that maps every file to its relevant control IDs. The ZIP is uploaded automatically to the CMMC platform for AI-assisted assessment.

**Nothing is installed. Nothing is changed on the target system.** The scripts are read-only with two exceptions: writing the temporary output folder and uploading the ZIP.

---

## Prerequisites

### Windows (`harvest_windows.ps1`)

| Requirement | Notes |
|---|---|
| PowerShell 5.1+ | Pre-installed on Windows Server 2016+ / Windows 10+ |
| Domain Admin or Local Admin | Required for GPO report, firewall rules, BitLocker status |
| RSAT — Group Policy Management | Required for `Get-GPOReport`. Install: `Add-WindowsFeature GPMC` on Server, or Settings > Optional Features > RSAT on Win 10/11 |
| Windows Defender (built-in) | Required for `Get-MpComputerStatus` |
| Internet access to platform | For upload via `Invoke-RestMethod` |

### Linux (`harvest_linux.sh`)

| Requirement | Notes |
|---|---|
| Bash 4+ | Standard on all modern Linux distros |
| `sudo` / root access | Required for iptables, auditctl, sshd_config, sudoers |
| `curl` | Usually pre-installed; `apt install curl` if missing |
| `zip` or `python3` | For archive creation; `apt install zip` if missing |
| `auditd` | For audit rules collection; `apt install auditd` if not present |
| `openssl` | For TLS cipher enumeration; usually pre-installed |
| Debian/Ubuntu or RHEL/CentOS/Fedora | Package manager auto-detected |

---

## Getting Your Credentials from the Platform

You need three values before running either script:

1. **ApiUrl** — The base URL of your CMMC platform instance.
   Example: `https://cmmc.yourcompany.com`

2. **Token** — A bearer token issued to you by the platform.
   - Log in to the platform as `client_admin`
   - Navigate to **Settings > API Tokens > Generate New Token**
   - Copy the token (it is shown only once)
   - Tokens expire after 90 days by default

3. **ProgramId** — The UUID of the compliance program this evidence belongs to.
   - In the platform, open the relevant program
   - The UUID appears in the browser URL: `/programs/<UUID>/dashboard`
   - Example: `3f1a2b4c-0000-0000-0000-000000000042`

---

## Running on Windows

Open an **elevated PowerShell prompt** (Run as Administrator):

```powershell
powershell -ExecutionPolicy Bypass -File .\harvest_windows.ps1 `
    -ApiUrl     "https://cmmc.yourcompany.com" `
    -Token      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." `
    -ProgramId  "3f1a2b4c-0000-0000-0000-000000000042"
```

If the script is in a different directory:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Scripts\harvest_windows.ps1" `
    -ApiUrl "https://cmmc.yourcompany.com" `
    -Token  "eyJ..." `
    -ProgramId "3f1a2b4c-0000-0000-0000-000000000042"
```

**Tip:** Run on a domain controller for the most complete GPO coverage. Running on a member server or endpoint still collects all non-GPO artifacts.

---

## Running on Linux

```bash
# Make executable (first run only)
chmod +x harvest_linux.sh

# Run with sudo
sudo ./harvest_linux.sh \
    --api-url    "https://cmmc.yourcompany.com" \
    --token      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
    --program-id "3f1a2b4c-0000-0000-0000-000000000042"
```

If `sudo` is not configured, run as root:

```bash
su -
bash /path/to/harvest_linux.sh --api-url ... --token ... --program-id ...
```

---

## Expected Runtime

| Phase | Typical Duration |
|---|---|
| Artifact collection | 1–4 minutes |
| ZIP creation | < 10 seconds |
| Upload (depends on connection) | 10–60 seconds |
| **Total** | **2–5 minutes** |

GPO reports on large domains may take longer (up to 10 minutes). All other collectors run in seconds.

---

## What Is Collected

### Windows Artifacts (12 files)

| File | NIST Controls | Source |
|---|---|---|
| `firewall_rules.txt` | 3.13.1, 3.13.5, 3.13.6 | Windows Firewall active ruleset |
| `gpo_report.html` | 3.1.1, 3.1.5, 3.4.1, 3.4.2 | All GPOs in HTML format |
| `local_admins.txt` | 3.1.5, 3.5.1 | Local Administrators group members |
| `mfa_registry.txt` | 3.5.3 | WDigest, LSA, DeviceGuard, SmartCard policy keys |
| `patch_status.csv` | 3.11.2, 3.14.1 | Installed hotfixes with dates |
| `av_status.txt` | 3.14.2, 3.14.4, 3.14.5 | Windows Defender status |
| `bitlocker_status.txt` | 3.8.9, 3.13.11, 3.13.16 | BitLocker volume protection status |
| `tls_cipher_suites.txt` | 3.13.8, 3.13.11 | Enabled TLS cipher suites |
| `audit_policy.txt` | 3.3.1, 3.3.2 | Windows audit policy (all categories) |
| `services_list.txt` | 3.4.7 | All services with name/status/start type |
| `scheduled_tasks.txt` | 3.4.7, 3.6.3 | All scheduled tasks with state |
| `computer_info.txt` | 3.4.1, 3.11.3 | System hardware and OS summary |

### Linux Artifacts (11 files)

| File | NIST Controls | Source |
|---|---|---|
| `iptables_rules.txt` | 3.13.1, 3.13.5, 3.13.6 | iptables + ip6tables ruleset |
| `users_shadow.txt` | 3.1.1, 3.5.1 | /etc/passwd usernames + account status |
| `sudoers.txt` | 3.1.5 | /etc/sudoers + /etc/sudoers.d/* |
| `ssh_config.txt` | 3.13.8, 3.13.11, 3.5.3 | sshd_config + effective runtime config |
| `installed_packages.txt` | 3.4.1 | Full installed package list |
| `patch_status.txt` | 3.11.2, 3.14.1 | Pending updates + recent update log |
| `disk_encryption.txt` | 3.8.9, 3.13.16 | lsblk + LUKS/cryptsetup status |
| `audit_rules.txt` | 3.3.1 | auditd rules (active + config files) |
| `services_list.txt` | 3.4.7 | Running + enabled systemd services |
| `tls_versions.txt` | 3.13.8 | OpenSSL version + cipher suites |
| `system_info.txt` | 3.4.1, 3.11.3 | uname, OS release, CPU, memory, disk |

---

## What Is NOT Collected

The scripts explicitly avoid collecting:

- Passwords, password hashes, or private keys of any kind
- User home directory contents
- Email, documents, or any user-created files
- Database contents or application data
- Network packet captures
- Browser history or cookies
- Application logs containing user activity
- Any file outside the specific system configuration paths listed above

The only AD/user data collected is a list of usernames in the local Administrators group (Windows) or /etc/passwd usernames (Linux). No password hashes are touched.

---

## Privacy Note

This script collects system configuration state only. The output is sent directly to your organization's CMMC platform instance — it is not sent to any third party. All data is encrypted in transit (HTTPS/TLS). The platform stores artifacts in MinIO object storage under your program's namespace and access controls.

If your organization has a data handling policy that restricts tools like this, obtain appropriate approval before running. The `manifest.json` included in every upload provides a complete inventory of exactly what was collected.

---

## Troubleshooting

### Windows: "Get-GPOReport is not recognized"

Install RSAT Group Policy Management:

```powershell
# Windows Server
Install-WindowsFeature -Name GPMC

# Windows 10/11
Add-WindowsCapability -Online -Name Rsat.GroupPolicy.Management.Tools~~~~0.0.1.0
```

### Windows: Script blocked by execution policy

Run with `-ExecutionPolicy Bypass` as shown in the usage example, or set policy for the session:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Linux: "zip: command not found"

```bash
# Debian/Ubuntu
sudo apt install zip

# RHEL/CentOS
sudo yum install zip
```

### Linux: "auditctl: command not found"

```bash
# Debian/Ubuntu
sudo apt install auditd

# RHEL/CentOS
sudo yum install audit
```

### Upload fails (network error)

The ZIP is preserved at the temp path printed in the script output (`/tmp/cmmc-harvest-*.zip` on Linux, `%TEMP%\cmmc-harvest-*.zip` on Windows). You can upload it manually:

```bash
# Linux manual upload
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/tmp/cmmc-harvest-TIMESTAMP.zip" \
  "https://cmmc.yourcompany.com/api/artifacts/bulk-upload-zip?program_id=YOUR_PROGRAM_ID"
```

```powershell
# Windows manual upload
$headers = @{ Authorization = "Bearer YOUR_TOKEN" }
Invoke-RestMethod -Uri "https://cmmc.yourcompany.com/api/artifacts/bulk-upload-zip?program_id=YOUR_PROGRAM_ID" `
    -Method Post -Headers $headers -Form @{ file = Get-Item "C:\Users\...\cmmc-harvest-TIMESTAMP.zip" }
```

### Partial collection (some files failed)

Failed artifacts are recorded in `manifest.json` under the `errors` array and printed in the summary. The upload proceeds with whatever was successfully collected. Review the error messages and re-run after fixing the underlying issue (missing RSAT module, auditd not running, etc.).

---

## Re-running

Each run creates a new timestamped folder and ZIP. Re-running is safe and idempotent — it does not modify or delete previous uploads on the platform. If you re-run after fixing a missing tool (e.g., installing GPMC), the new upload will include the previously missing artifacts.

---

*Onnex AI Agency — CMMC Compliance OS*
