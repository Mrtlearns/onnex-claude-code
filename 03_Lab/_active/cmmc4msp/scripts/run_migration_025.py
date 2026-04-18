"""
run_migration_025.py
Uploads and runs postgres/migrations/025_error_trail.sql on the CMMC VM,
then verifies the resulting schema.
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import os
import paramiko

from _secrets import vm_ssh

HOST, USER, PASS = vm_ssh()

MIGRATION_LOCAL = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'postgres', 'migrations', '025_error_trail.sql'
)
MIGRATION_REMOTE = '/tmp/025_error_trail.sql'

PSQL = 'docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main'


def run(client, cmd):
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out, err


def main():
    print(f"[INFO] Connecting to {HOST} ...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=15)
    print("[OK] Connected.")

    # --- SFTP upload to host /tmp ---
    print(f"[INFO] Uploading {MIGRATION_LOCAL} -> {MIGRATION_REMOTE} (host) ...")
    sftp = client.open_sftp()
    sftp.put(MIGRATION_LOCAL, MIGRATION_REMOTE)
    sftp.close()
    print("[OK] Upload complete.")

    # --- Copy file into the postgres container ---
    print("[INFO] Copying migration file into cmmc-postgres container ...")
    out, err = run(client, f'docker cp {MIGRATION_REMOTE} cmmc-postgres:{MIGRATION_REMOTE}')
    if out:
        print("[cp stdout]", out)
    if err:
        print("[cp stderr]", err)

    # --- Run migration ---
    print("[INFO] Running migration ...")
    out, err = run(client, f'{PSQL} -f {MIGRATION_REMOTE}')
    if out:
        print("[MIGRATION OUTPUT]\n" + out)
    if err:
        print("[MIGRATION STDERR]\n" + err)

    # --- Verify: error_events columns ---
    print("\n[INFO] Verifying error_events columns ...")
    out, err = run(
        client,
        f"{PSQL} -c \"SELECT column_name FROM information_schema.columns "
        f"WHERE table_name='error_events' ORDER BY ordinal_position LIMIT 20\""
    )
    print(out)
    if err:
        print("[STDERR]", err)

    # --- Verify: triage_reports columns ---
    print("\n[INFO] Verifying triage_reports columns ...")
    out, err = run(
        client,
        f"{PSQL} -c \"SELECT column_name FROM information_schema.columns "
        f"WHERE table_name='triage_reports' ORDER BY ordinal_position\""
    )
    print(out)
    if err:
        print("[STDERR]", err)

    # --- Verify: policy_drafts.error_message ---
    print("\n[INFO] Verifying policy_drafts.error_message column ...")
    out, err = run(
        client,
        f"{PSQL} -c \"SELECT column_name FROM information_schema.columns "
        f"WHERE table_name='policy_drafts' AND column_name='error_message'\""
    )
    print(out)
    if err:
        print("[STDERR]", err)

    # --- Verify: both tables exist ---
    print("\n[INFO] Verifying both tables exist ...")
    out, err = run(
        client,
        f"{PSQL} -c \"SELECT table_name FROM information_schema.tables "
        f"WHERE table_name IN ('error_events','triage_reports') ORDER BY 1\""
    )
    print(out)
    if err:
        print("[STDERR]", err)

    client.close()
    print("\n[DONE] Migration 025 complete.")


if __name__ == '__main__':
    main()
