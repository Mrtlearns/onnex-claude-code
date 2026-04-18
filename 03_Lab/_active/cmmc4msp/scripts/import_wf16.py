"""
Import WF16 (error handler) and re-import all patched workflows (01-15) into n8n on the VM.
Steps:
1. SFTP 16_error_handler.json to VM /tmp/
2. Import WF16 via docker exec n8n import:workflow
3. Activate WF16
4. SFTP workflows 01-15 to VM /tmp/ and re-import each
"""
import io
import os
import sys
import time
import paramiko

from _secrets import vm_ssh

# Force stdout to utf-8 on Windows to handle n8n CLI unicode output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HOST, USER, PASSWORD = vm_ssh()
N8N_CONTAINER = "cmmc-n8n"

LOCAL_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKFLOWS_DIR = os.path.join(LOCAL_BASE, "n8n", "workflows")

WF16_ID = "a1b2c3d4-0016-0016-0016-000000000000"
WF16_FILE = "16_error_handler.json"

# Workflows to re-import (01-15, skip 02 which is truncated on disk)
WORKFLOWS_TO_IMPORT = [
    "01_onboard_client.json",
    "03_sprs_recalculate.json",
    "04_phase_unlock_check.json",
    "05_poam_reminders.json",
    "06_weekly_digest.json",
    "07_hung_assessment_guard.json",
    "08_report_generator.json",
    "09_assignment_notifications.json",
    "10_user_invite.json",
    "11_assessment_notify.json",
    "12_integration_sync.json",
    "13_evidence_freshness_monitor.json",
    "14_evidence_drift_monitor.json",
    "15_error_triage_nightly.json",
]


def run_ssh(ssh: paramiko.SSHClient, cmd: str, timeout: int = 60) -> tuple[int, str, str]:
    """Run command via SSH, return (exit_code, stdout, stderr)."""
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    stdin.close()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    return exit_code, out, err


def sftp_upload(sftp: paramiko.SFTPClient, local_path: str, remote_path: str) -> bool:
    """Upload a file via SFTP. Returns True on success."""
    try:
        sftp.put(local_path, remote_path)
        return True
    except Exception as exc:
        print(f"    SFTP ERROR: {exc}")
        return False


def import_workflow(ssh: paramiko.SSHClient, vm_tmp_path: str, fname: str) -> bool:
    """Copy file into container then import via n8n CLI. Returns True on success."""
    container_path = f"/tmp/{fname}"
    # docker cp from VM /tmp into the container
    cp_cmd = f"docker cp {vm_tmp_path} {N8N_CONTAINER}:{container_path}"
    rc_cp, out_cp, err_cp = run_ssh(ssh, cp_cmd, timeout=30)
    if rc_cp != 0:
        print(f"    FAIL docker cp (exit {rc_cp}): {(out_cp + err_cp).strip()}")
        return False

    # Import inside the container
    import_cmd = f"docker exec {N8N_CONTAINER} n8n import:workflow --input={container_path}"
    rc, out, err = run_ssh(ssh, import_cmd, timeout=60)
    combined = (out + err).strip()
    if combined:
        for line in combined.splitlines():
            print(f"    {line}")
    if rc == 0:
        print(f"    OK: imported {fname}")
        return True
    else:
        print(f"    FAIL (exit {rc}): {fname}")
        return False


def main() -> int:
    print("=== Import WF16 + Re-import patched workflows ===\n")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST} ...")
    ssh.connect(HOST, username=USER, password=PASSWORD)
    sftp = ssh.open_sftp()
    print("Connected.\n")

    errors = 0

    # --- Step 1: Upload + import WF16 ---
    print("[1/3] Uploading and importing WF16 (error handler) ...")
    wf16_local = os.path.join(WORKFLOWS_DIR, WF16_FILE)
    wf16_remote = f"/tmp/{WF16_FILE}"

    if not os.path.exists(wf16_local):
        print(f"  ERROR: {wf16_local} not found")
        sftp.close()
        ssh.close()
        return 1

    if sftp_upload(sftp, wf16_local, wf16_remote):
        print(f"  Uploaded: {WF16_FILE}")
        if not import_workflow(ssh, wf16_remote, WF16_FILE):
            errors += 1
    else:
        errors += 1

    # --- Step 2: Activate WF16 ---
    print("\n[2/3] Activating WF16 ...")
    activate_cmd = (
        f"docker exec {N8N_CONTAINER} "
        f"n8n update:workflow --active=true --id={WF16_ID}"
    )
    rc, out, err = run_ssh(ssh, activate_cmd, timeout=30)
    combined = (out + err).strip()
    if combined:
        for line in combined.splitlines():
            print(f"  {line}")
    if rc == 0:
        print("  OK: WF16 activated.")
    else:
        print(f"  WARNING: Activation returned exit code {rc} (may need manual activation)")

    # --- Step 3: Re-import patched workflows ---
    print(f"\n[3/3] Re-importing {len(WORKFLOWS_TO_IMPORT)} patched workflows ...")
    imported = 0
    failed = []

    for fname in WORKFLOWS_TO_IMPORT:
        local_path = os.path.join(WORKFLOWS_DIR, fname)
        remote_path = f"/tmp/{fname}"

        if not os.path.exists(local_path):
            print(f"  SKIP (missing local): {fname}")
            continue

        print(f"  Importing: {fname}")
        if sftp_upload(sftp, local_path, remote_path):
            if import_workflow(ssh, remote_path, fname):
                imported += 1
            else:
                failed.append(fname)
                errors += 1
        else:
            failed.append(fname)
            errors += 1

        # Brief pause to avoid overwhelming n8n
        time.sleep(0.5)

    sftp.close()
    ssh.close()

    print(f"\n=== Summary ===")
    print(f"  WF16: imported and activation attempted")
    print(f"  Other workflows: {imported}/{len(WORKFLOWS_TO_IMPORT)} imported successfully")
    if failed:
        print(f"  Failed: {', '.join(failed)}")
    print(f"  Total errors: {errors}")
    return 0 if errors == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
