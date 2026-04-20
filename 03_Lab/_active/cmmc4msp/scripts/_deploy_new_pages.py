"""One-shot deploy for artifacts + integrations pages + updated queries.ts"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

import paramiko
from _secrets import vm_ssh

HOST, USER, PASSWORD = vm_ssh()
REMOTE_BASE = '/opt/stacks/cmmc4msp'
LOCAL_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FILES = [
    'nextjs/src/app/[orgSlug]/artifacts/page.tsx',
    'nextjs/src/app/[orgSlug]/integrations/page.tsx',
    'nextjs/src/graphql/queries.ts',
]

def ensure_dir(sftp, remote_dir):
    parts = remote_dir.split('/')
    path = ''
    for part in parts:
        if not part:
            path = '/'
            continue
        path = path.rstrip('/') + '/' + part
        try:
            sftp.stat(path)
        except FileNotFoundError:
            try:
                sftp.mkdir(path)
            except Exception:
                pass

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASSWORD)
sftp = ssh.open_sftp()

for rel in FILES:
    local = os.path.join(LOCAL_BASE, rel.replace('/', os.sep))
    remote = f'{REMOTE_BASE}/{rel}'
    ensure_dir(sftp, remote.rsplit('/', 1)[0])
    sftp.put(local, remote)
    print(f'OK: {rel}')

sftp.close()

# Trigger rebuild
print('Rebuilding nextjs container...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/stacks/cmmc4msp && docker compose build nextjs 2>&1 | tail -5'
)
print(stdout.read().decode())

print('Restarting nextjs container...')
stdin, stdout, stderr = ssh.exec_command(
    'cd /opt/stacks/cmmc4msp && docker compose up -d nextjs 2>&1 | tail -5'
)
print(stdout.read().decode())

ssh.close()
print('Done.')
