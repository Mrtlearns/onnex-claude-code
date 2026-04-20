"""Run postgres/migrations/026_triage_tenant_scope.sql on the CMMC VM."""
import sys
import io
import os
import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from _secrets import vm_ssh

HOST, USER, PASS = vm_ssh()

MIGRATION_LOCAL = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'postgres', 'migrations', '026_triage_tenant_scope.sql'
)
MIGRATION_REMOTE = '/tmp/026_triage_tenant_scope.sql'
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

    sftp = client.open_sftp()
    sftp.put(MIGRATION_LOCAL, MIGRATION_REMOTE)
    sftp.close()
    print(f"[OK] Uploaded {MIGRATION_LOCAL}")

    out, err = run(client, f'docker cp {MIGRATION_REMOTE} cmmc-postgres:{MIGRATION_REMOTE}')
    if err: print("[cp stderr]", err)

    out, err = run(client, f'{PSQL} -f {MIGRATION_REMOTE}')
    print("[MIGRATION OUTPUT]\n" + out)
    if err: print("[MIGRATION STDERR]\n" + err)

    out, err = run(client, f'{PSQL} -c "SELECT schemaname, indexname FROM pg_indexes WHERE indexname=\'idx_error_events_msp_untriaged\'"')
    print("\n[Verify index]\n" + out)

    client.close()
    print("\n[DONE] Migration 026 complete.")


if __name__ == '__main__':
    main()
