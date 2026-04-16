#!/usr/bin/env python3
"""Deploy API + frontend builds to ndtv1 and set up cron for manual sync trigger."""
import paramiko
import os

HOST = '10.10.110.32'
USER = 'root'
PW   = 'Poll0000'

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

API_LOCAL  = os.path.join(PROJECT_DIR, 'api', 'dist')
API_REMOTE = '/opt/ndt-portal/api/dist'
FE_LOCAL   = os.path.join(PROJECT_DIR, 'dist')
FE_REMOTE  = '/opt/ndt-portal/dist'


def upload_tree(sftp, local_root, remote_root):
    for dirpath, dirnames, filenames in os.walk(local_root):
        rel = os.path.relpath(dirpath, local_root)
        rel = rel.replace('\\', '/')
        if rel == '.':
            remote_dir = remote_root
        else:
            remote_dir = remote_root + '/' + rel
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            sftp.mkdir(remote_dir)
        for fname in filenames:
            local_f  = os.path.join(dirpath, fname)
            remote_f = remote_dir + '/' + fname
            sftp.put(local_f, remote_f)
    print(f'  Uploaded {local_root} -> {remote_root}')


def run(client, cmd):
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if out:
        print(out)
    if err:
        print('STDERR:', err)
    return out


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PW, timeout=10,
                   look_for_keys=False, allow_agent=False)
    client.get_transport().set_keepalive(30)

    sftp = client.open_sftp()

    print('Uploading API dist...')
    upload_tree(sftp, API_LOCAL, API_REMOTE)

    print('Uploading frontend dist...')
    upload_tree(sftp, FE_LOCAL, FE_REMOTE)

    sftp.close()
    print('Files uploaded.')

    # Write sf_sync_cron.sh on server
    cron_sh = r"""#!/bin/bash
# Triggered by host cron when sf_sync_manual queued row detected.
# Runs incremental sf_sync inside the api container's postgres environment.
cd /opt/ndt-portal
PGPASSWORD='Ndt@P0rtal2026!' psql -U ndtapp -d ndtportal -t -c \
  "UPDATE app.job_runs SET status='running', started_at=now() WHERE id=(SELECT id FROM app.job_runs WHERE job_name='sf_sync_manual' AND status='queued' ORDER BY started_at DESC LIMIT 1) RETURNING id" \
  | grep -q '[0-9]' || exit 0
python3 /opt/ndt-portal/scripts/sf_sync.py --mode incremental >> /var/log/sf_sync_manual.log 2>&1
"""
    with sftp_write(client, '/opt/ndt-portal/sf_sync_cron.sh', cron_sh):
        pass

    run(client, 'chmod +x /opt/ndt-portal/sf_sync_cron.sh')
    print('sf_sync_cron.sh written.')

    # Append cron entry (check first to avoid duplicates)
    cron_line = "* * * * * PGPASSWORD='Ndt@P0rtal2026!' psql -U ndtapp -d ndtportal -t -c \"SELECT id FROM app.job_runs WHERE job_name='sf_sync_manual' AND status='queued' ORDER BY started_at DESC LIMIT 1\" | grep -q '[0-9]' && /opt/ndt-portal/sf_sync_cron.sh >> /var/log/sf_sync_cron.log 2>&1"

    # Check if entry already exists
    existing = run(client, "crontab -l 2>/dev/null | grep -c 'sf_sync_cron.sh' || true")
    if existing.strip() == '0' or existing.strip() == '':
        run(client, f'(crontab -l 2>/dev/null; echo "{cron_line}") | crontab -')
        print('Cron entry added.')
    else:
        print('Cron entry already exists, skipping.')

    # Restart API
    print('Restarting API container...')
    run(client, 'cd /opt/ndt-portal && docker compose restart api')
    print('API restarted.')

    # Wait for it to come up
    import time
    time.sleep(4)
    result = run(client, "docker inspect --format='{{.State.Status}}' ndt-portal-api-1")
    print(f'API container status: {result}')

    client.close()
    print('Deploy complete.')


def sftp_write(client, remote_path, content):
    import io

    class _ctx:
        def __enter__(self_):
            sftp = client.open_sftp()
            with sftp.open(remote_path, 'w') as f:
                f.write(content)
            sftp.close()
        def __exit__(self_, *a):
            pass

    return _ctx()


if __name__ == '__main__':
    main()
