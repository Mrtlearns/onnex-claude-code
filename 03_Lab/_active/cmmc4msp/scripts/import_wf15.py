"""Import n8n workflow 15 (Error Triage Nightly) to the VM via SSH/SFTP.

Usage:
    python scripts/import_wf15.py

Requires: paramiko  (pip install paramiko)
VM + credentials are resolved from the environment via _secrets.vm_ssh().
"""
from __future__ import annotations

import os
import sys

from _secrets import vm_ssh

WORKFLOW_LOCAL = os.path.join(
    os.path.dirname(__file__),
    "..", "n8n", "workflows", "15_error_triage_nightly.json"
)
WORKFLOW_REMOTE_TMP = "/tmp/15_error_triage_nightly.json"
STACK_PATH = "/opt/stacks/cmmc4msp/n8n/workflows/15_error_triage_nightly.json"

VM_HOST, VM_USER, VM_PASS = vm_ssh()

N8N_CONTAINER = "cmmc-n8n"


def main() -> None:
    try:
        import paramiko
    except ImportError:
        print("ERROR: paramiko not installed. Run: pip install paramiko")
        sys.exit(1)

    workflow_path = os.path.abspath(WORKFLOW_LOCAL)
    if not os.path.exists(workflow_path):
        print(f"ERROR: Workflow file not found: {workflow_path}")
        sys.exit(1)

    print(f"Connecting to {VM_HOST} as {VM_USER}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VM_HOST, username=VM_USER, password=VM_PASS, timeout=15)

    # 1. SFTP: copy workflow to /tmp on VM
    print(f"Uploading {workflow_path} -> {VM_HOST}:{WORKFLOW_REMOTE_TMP}")
    sftp = client.open_sftp()
    sftp.put(workflow_path, WORKFLOW_REMOTE_TMP)
    sftp.close()
    print("Upload complete.")

    # 2. Copy to stack volume path (for persistence across container recreates)
    stack_dir = os.path.dirname(STACK_PATH)
    _run(client, f"mkdir -p {stack_dir}")
    _run(client, f"cp {WORKFLOW_REMOTE_TMP} {STACK_PATH}")
    print(f"Copied to stack path: {STACK_PATH}")

    # 3. docker cp into n8n container
    cmd_cp = f"docker cp {WORKFLOW_REMOTE_TMP} {N8N_CONTAINER}:/tmp/"
    print(f"Running: {cmd_cp}")
    _run(client, cmd_cp)

    # 4. Import via n8n CLI
    cmd_import = (
        f"docker exec {N8N_CONTAINER} "
        f"n8n import:workflow --input=/tmp/15_error_triage_nightly.json"
    )
    print(f"Running: {cmd_import}")
    stdout, stderr = _run(client, cmd_import)

    if stdout:
        print("STDOUT:", stdout)
    if stderr:
        print("STDERR:", stderr)

    if "Successfully imported" in stdout or "imported" in stdout.lower():
        print("\nWorkflow 15 imported successfully.")
        print("Activate it in the n8n UI before the first nightly run (03:00 UTC).")
    else:
        print("\nWARNING: import output did not confirm success — check above output.")

    client.close()


def _run(client: "paramiko.SSHClient", cmd: str) -> tuple[str, str]:
    """Run a shell command on the remote host; print and return (stdout, stderr)."""
    _, stdout_obj, stderr_obj = client.exec_command(cmd)
    out = stdout_obj.read().decode("ascii", errors="replace").strip()
    err = stderr_obj.read().decode("ascii", errors="replace").strip()
    if err:
        # n8n CLI writes progress to stderr — not always an error
        print(f"  [stderr] {err}")
    return out, err


if __name__ == "__main__":
    main()
