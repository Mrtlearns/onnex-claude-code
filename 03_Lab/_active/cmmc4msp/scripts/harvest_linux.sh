#!/usr/bin/env bash
# =============================================================================
# CMMC Level 2 Evidence Harvester — Linux / Unix
# Onnex AI Agency | cmmc4msp platform
#
# USAGE:
#   chmod +x harvest_linux.sh
#   sudo ./harvest_linux.sh \
#       --api-url https://cmmc.example.com \
#       --token   eyJhbGci... \
#       --program-id 00000000-0000-0000-0000-000000000001
#
# DESCRIPTION:
#   Collects 11 evidence artifacts mapped to NIST SP 800-171 Rev 2 control IDs,
#   builds a manifest.json, zips the bundle, and POSTs it to the CMMC platform
#   bulk-upload endpoint. No passwords, private keys, user home directories, or
#   PII beyond system usernames are collected.
#
# PREREQUISITES:
#   - sudo / root access
#   - curl, zip (installed on most distros)
#   - auditd (for audit_rules.txt); openssl (for tls_versions.txt)
#   - Debian/Ubuntu: apt | RHEL/CentOS: yum/dnf (auto-detected)
#
# ESTIMATED RUNTIME: 2–5 minutes
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
API_URL=""
TOKEN=""
PROGRAM_ID=""

usage() {
    echo "Usage: sudo $0 --api-url <URL> --token <BEARER_TOKEN> --program-id <UUID>"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --api-url)     API_URL="$2";     shift 2 ;;
        --token)       TOKEN="$2";       shift 2 ;;
        --program-id)  PROGRAM_ID="$2";  shift 2 ;;
        -h|--help)     usage ;;
        *)             echo "Unknown argument: $1"; usage ;;
    esac
done

[[ -z "$API_URL"     ]] && { echo "ERROR: --api-url is required";    usage; }
[[ -z "$TOKEN"       ]] && { echo "ERROR: --token is required";      usage; }
[[ -z "$PROGRAM_ID"  ]] && { echo "ERROR: --program-id is required"; usage; }

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step()  { echo -e "${CYAN}[CMMC] $1${NC}"; }
ok()    { echo -e "  ${GREEN}[OK]   $1${NC}"; }
warn()  { echo -e "  ${YELLOW}[WARN] $1${NC}"; }
fail()  { echo -e "  ${RED}[FAIL] $1${NC}"; }

# Detect package manager
detect_pkg_manager() {
    if command -v apt &>/dev/null; then  echo "apt";
    elif command -v dnf &>/dev/null; then echo "dnf";
    elif command -v yum &>/dev/null; then echo "yum";
    else echo "unknown"; fi
}

PKG_MANAGER=$(detect_pkg_manager)

# ---------------------------------------------------------------------------
# Setup — temp working directory
# ---------------------------------------------------------------------------
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
FOLDER_NAME="cmmc-harvest-${TIMESTAMP}"
TEMP_DIR="/tmp/${FOLDER_NAME}"
ZIP_PATH="/tmp/${FOLDER_NAME}.zip"

mkdir -p "$TEMP_DIR"
step "Working folder: $TEMP_DIR"

# Manifest state (built up as JSON strings, assembled at end)
HOSTNAME_VAL=$(hostname -f 2>/dev/null || hostname)
OS_VAL=$(uname -s -r 2>/dev/null || echo "unknown")
GENERATED_AT=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
FILES_JSON="[]"
ERRORS_JSON="[]"

# Counters
COLLECTED=0
FAILED=0

# ---------------------------------------------------------------------------
# json_escape — minimal JSON string escaping for bash
# ---------------------------------------------------------------------------
json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

# ---------------------------------------------------------------------------
# collect_artifact <filename> <nist_ids_json_array> <command_string>
#   Runs the command, writes output to TEMP_DIR/filename.
#   On success: appends to FILES_JSON.
#   On failure: appends to ERRORS_JSON. Never exits the script.
# ---------------------------------------------------------------------------
collect_artifact() {
    local filename="$1"
    local nist_ids="$2"    # pre-formed JSON array string, e.g. '["3.13.1","3.13.5"]'
    local cmd="$3"

    local outpath="${TEMP_DIR}/${filename}"
    printf "  Collecting %-35s " "$filename ..."

    local err_msg=""
    if eval "$cmd" > "$outpath" 2>&1; then
        local size
        size=$(wc -c < "$outpath")
        echo -e "${GREEN}OK (${size} bytes)${NC}"

        # Append to files array
        local entry
        entry="{\"filename\":\"${filename}\",\"nist_ids\":${nist_ids},\"size_bytes\":${size},\"status\":\"collected\"}"
        if [[ "$FILES_JSON" == "[]" ]]; then
            FILES_JSON="[${entry}]"
        else
            FILES_JSON="${FILES_JSON%]},${entry}]"
        fi
        COLLECTED=$((COLLECTED + 1))
    else
        err_msg=$(cat "$outpath" 2>/dev/null | head -5 | tr '\n' ' ')
        err_msg=$(json_escape "$err_msg")
        echo -e "${RED}FAILED${NC}"
        warn "$filename: $err_msg"

        local err_entry
        err_entry="{\"filename\":\"${filename}\",\"nist_ids\":${nist_ids},\"error\":\"${err_msg}\"}"
        if [[ "$ERRORS_JSON" == "[]" ]]; then
            ERRORS_JSON="[${err_entry}]"
        else
            ERRORS_JSON="${ERRORS_JSON%]},${err_entry}]"
        fi
        FAILED=$((FAILED + 1))
        rm -f "$outpath"
    fi
}

# ---------------------------------------------------------------------------
# Artifact collection
# ---------------------------------------------------------------------------
step "Collecting evidence artifacts..."

# 1. Firewall rules
collect_artifact \
    "iptables_rules.txt" \
    '["3.13.1","3.13.5","3.13.6"]' \
    "sudo iptables -L -v -n --line-numbers 2>&1; echo ''; echo '=== ip6tables ==='; sudo ip6tables -L -v -n --line-numbers 2>&1 || true"

# 2. User accounts (no passwords — only usernames + account status)
collect_artifact \
    "users_shadow.txt" \
    '["3.1.1","3.5.1"]' \
    "echo '=== /etc/passwd usernames ==='; getent passwd | awk -F: '{print \$1,\$3,\$4,\$7}' OFS='\\t'; echo ''; echo '=== Password status (passwd -S -a) ==='; passwd -S -a 2>/dev/null || sudo passwd -S -a 2>/dev/null || echo 'passwd -S -a not supported on this distro'"

# 3. Sudoers configuration
collect_artifact \
    "sudoers.txt" \
    '["3.1.5"]' \
    "echo '=== /etc/sudoers ==='; sudo cat /etc/sudoers 2>/dev/null; echo ''; echo '=== /etc/sudoers.d/* ==='; sudo cat /etc/sudoers.d/* 2>/dev/null || echo '(no sudoers.d files or permission denied)'"

# 4. SSH daemon configuration
collect_artifact \
    "ssh_config.txt" \
    '["3.13.8","3.13.11","3.5.3"]' \
    "sudo cat /etc/ssh/sshd_config 2>/dev/null; echo ''; echo '=== Effective config (sshd -T) ==='; sudo sshd -T 2>/dev/null || echo '(sshd -T not available)'"

# 5. Installed packages
collect_artifact \
    "installed_packages.txt" \
    '["3.4.1"]' \
    "if [[ '$PKG_MANAGER' == 'apt' ]]; then dpkg -l 2>/dev/null; elif [[ '$PKG_MANAGER' =~ ^(dnf|yum)$ ]]; then rpm -qa --queryformat '%{NAME} %{VERSION}-%{RELEASE} %{ARCH}\n' | sort 2>/dev/null; else echo 'Unknown package manager: $PKG_MANAGER'; fi"

# 6. Patch / update status (pending updates)
collect_artifact \
    "patch_status.txt" \
    '["3.11.2","3.14.1"]' \
    "echo '=== Pending Updates ==='; if [[ '$PKG_MANAGER' == 'apt' ]]; then apt list --upgradable 2>/dev/null; elif [[ '$PKG_MANAGER' == 'dnf' ]]; then dnf check-update 2>/dev/null || true; elif [[ '$PKG_MANAGER' == 'yum' ]]; then yum check-update 2>/dev/null || true; else echo 'Unknown package manager'; fi; echo ''; echo '=== Last update timestamp ==='; if [[ -f /var/log/dpkg.log ]]; then tail -20 /var/log/dpkg.log; elif [[ -f /var/log/yum.log ]]; then tail -20 /var/log/yum.log; fi"

# 7. Disk encryption status
collect_artifact \
    "disk_encryption.txt" \
    '["3.8.9","3.13.16"]' \
    "echo '=== Block Device Layout ==='; lsblk -o NAME,TYPE,SIZE,MOUNTPOINT,FSTYPE,UUID 2>/dev/null; echo ''; echo '=== LUKS/cryptsetup status ==='; for dev in \$(lsblk -lno NAME,TYPE | awk '\$2==\"crypt\"{print \$1}'); do echo \"--- \$dev ---\"; sudo cryptsetup status \"\$dev\" 2>/dev/null || true; done; echo ''; echo '=== dm-crypt mappings ==='; ls /dev/mapper/ 2>/dev/null || echo 'No /dev/mapper entries'; echo ''; echo '=== fstab (encryption hints) ==='; cat /etc/fstab 2>/dev/null"

# 8. Audit rules
collect_artifact \
    "audit_rules.txt" \
    '["3.3.1"]' \
    "echo '=== Active audit rules (auditctl -l) ==='; sudo auditctl -l 2>/dev/null || echo 'auditd not running or auditctl not installed'; echo ''; echo '=== /etc/audit/audit.rules ==='; sudo cat /etc/audit/audit.rules 2>/dev/null || true; echo ''; echo '=== /etc/audit/rules.d/*.rules ==='; sudo cat /etc/audit/rules.d/*.rules 2>/dev/null || echo '(no rules.d files found)'"

# 9. Running services
collect_artifact \
    "services_list.txt" \
    '["3.4.7"]' \
    "echo '=== Running services (systemctl) ==='; systemctl list-units --type=service --state=running --no-pager 2>/dev/null; echo ''; echo '=== Enabled services ==='; systemctl list-unit-files --type=service --state=enabled --no-pager 2>/dev/null || true"

# 10. TLS / cipher suite configuration
collect_artifact \
    "tls_versions.txt" \
    '["3.13.8"]' \
    "echo '=== OpenSSL version ==='; openssl version 2>/dev/null; echo ''; echo '=== All cipher suites (openssl ciphers -v) ==='; openssl ciphers -v 2>/dev/null; echo ''; echo '=== HIGH strength ciphers ==='; openssl ciphers -v HIGH 2>/dev/null | head -40; echo ''; echo '=== SSLv2/SSLv3 (should be empty/disabled) ==='; openssl ciphers -v SSLv2 2>/dev/null || echo 'SSLv2: not compiled in (good)'; openssl ciphers -v SSLv3 2>/dev/null || echo 'SSLv3: not compiled in (good)'"

# 11. System information
collect_artifact \
    "system_info.txt" \
    '["3.4.1","3.11.3"]' \
    "echo '=== uname ==='; uname -a; echo ''; echo '=== OS Release ==='; cat /etc/os-release 2>/dev/null || lsb_release -a 2>/dev/null; echo ''; echo '=== CPU / Memory ==='; lscpu 2>/dev/null | head -20; echo ''; free -h 2>/dev/null; echo ''; echo '=== Disk ==='; df -h 2>/dev/null; echo ''; echo '=== Uptime ==='; uptime 2>/dev/null; echo ''; echo '=== Kernel modules ==='; lsmod 2>/dev/null | head -40"

# ---------------------------------------------------------------------------
# Build manifest.json
# ---------------------------------------------------------------------------
step "Writing manifest.json..."

OS_ESCAPED=$(json_escape "$OS_VAL")
HOSTNAME_ESCAPED=$(json_escape "$HOSTNAME_VAL")

cat > "${TEMP_DIR}/manifest.json" <<EOF
{
  "generated_at": "${GENERATED_AT}",
  "hostname": "${HOSTNAME_ESCAPED}",
  "os": "${OS_ESCAPED}",
  "program_id": "${PROGRAM_ID}",
  "files": ${FILES_JSON},
  "errors": ${ERRORS_JSON}
}
EOF
ok "manifest.json written"

# ---------------------------------------------------------------------------
# Create ZIP archive
# ---------------------------------------------------------------------------
step "Creating ZIP archive: $ZIP_PATH"

# Use zip if available; fall back to python3
if command -v zip &>/dev/null; then
    (cd /tmp && zip -r "$ZIP_PATH" "$FOLDER_NAME" -x "*.DS_Store") >/dev/null
elif command -v python3 &>/dev/null; then
    python3 -c "import shutil; shutil.make_archive('/tmp/${FOLDER_NAME}', 'zip', '/tmp', '${FOLDER_NAME}')"
else
    echo "ERROR: neither 'zip' nor 'python3' found. Install zip: apt install zip"
    exit 1
fi

ZIP_SIZE=$(du -sh "$ZIP_PATH" | cut -f1)
ok "ZIP created ($ZIP_SIZE)"

# ---------------------------------------------------------------------------
# POST to platform
# ---------------------------------------------------------------------------
step "Uploading to ${API_URL} ..."
UPLOAD_URL="${API_URL%/}/api/artifacts/bulk-upload-zip?program_id=${PROGRAM_ID}"

HTTP_STATUS=$(curl \
    --silent \
    --show-error \
    --write-out "%{http_code}" \
    --output /tmp/cmmc_upload_response.json \
    --max-time 300 \
    --header "Authorization: Bearer ${TOKEN}" \
    --form "file=@${ZIP_PATH}" \
    "$UPLOAD_URL" 2>&1) || HTTP_STATUS="000"

if [[ "$HTTP_STATUS" =~ ^2 ]]; then
    ok "Upload successful (HTTP $HTTP_STATUS)"
    echo ""
    echo "Platform response:"
    cat /tmp/cmmc_upload_response.json 2>/dev/null && echo ""
    UPLOAD_OK=true
else
    warn "Upload failed (HTTP $HTTP_STATUS)"
    warn "Response: $(cat /tmp/cmmc_upload_response.json 2>/dev/null | head -5)"
    warn "ZIP remains at: $ZIP_PATH — upload manually or re-run."
    UPLOAD_OK=false
fi

rm -f /tmp/cmmc_upload_response.json

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
step "Cleaning up temp folder..."
rm -rf "$TEMP_DIR"
ok "Temp folder removed"

if [[ "$UPLOAD_OK" == "true" ]]; then
    rm -f "$ZIP_PATH"
    ok "ZIP removed after successful upload"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
# Count unique NIST control IDs across collected files
COVERED_CONTROLS=$(echo "$FILES_JSON" | \
    grep -oP '"[0-9]+\.[0-9]+\.[0-9]+"' | \
    sort -u | wc -l)

TOTAL_ARTIFACTS=11

echo ""
echo -e "${CYAN}========================================"
echo -e "  CMMC Evidence Harvest — Summary"
echo -e "========================================${NC}"
echo "  Host             : ${HOSTNAME_VAL}"
echo "  OS               : ${OS_VAL}"
echo "  Generated at     : ${GENERATED_AT}"
echo "  Files OK         : ${COLLECTED} / ${TOTAL_ARTIFACTS}"
echo "  Files failed     : ${FAILED}"
echo "  NIST controls    : ${COVERED_CONTROLS} unique IDs covered"
echo -e "${CYAN}========================================${NC}"
echo ""
