"""Run load test on VM with proper UTF-8 handling."""
import sys
import os
import time
import paramiko

# Force UTF-8 output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

HOST, USER, PASS = '10.10.110.36', 'root', 'Poll0000'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, username=USER, password=PASS, timeout=10)

chan = client.get_transport().open_session()
chan.set_combine_stderr(True)
chan.exec_command('cd /opt/ai-sentinel && python3 /tmp/loadtest.py')
chan.settimeout(600)

while not chan.exit_status_ready():
    if chan.recv_ready():
        chunk = chan.recv(8192)
        if chunk:
            text = chunk.decode('utf-8', errors='replace')
            sys.stdout.write(text)
            sys.stdout.flush()
    else:
        time.sleep(0.05)

# Drain remaining
while True:
    if chan.recv_ready():
        chunk = chan.recv(8192)
        if not chunk:
            break
        sys.stdout.write(chunk.decode('utf-8', errors='replace'))
        sys.stdout.flush()
    else:
        break

exit_status = chan.recv_exit_status()
sys.stdout.write(f'\n\nExit status: {exit_status}\n')
client.close()
