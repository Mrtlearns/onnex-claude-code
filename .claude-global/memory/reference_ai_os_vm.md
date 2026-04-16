---
name: AI-OS VM SSH Access
description: SSH credentials and connection method for the AI-OS POC VM at 10.10.110.31
type: reference
---

## AI-OS POC VM

- **IP**: 10.10.110.31
- **User**: mrt
- **Password**: Poll0000
- **Root access**: `sudo -i` or `sudo <cmd>` after login

## Connection Method

No key-based auth available from this workstation. Use paramiko (Python) for SSH:

```python
import paramiko
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.10.110.31', username='mrt', password='Poll0000')
stdin, stdout, stderr = ssh.exec_command('sudo <cmd>')
```

Or use a helper script at `tmp/vm_ssh.py`.

## Notes

- Must use `sudo` or `sudo -i` for root-level Docker/compose commands
- Makefile at `/opt/agency-ai-os/infra/Makefile` wraps docker compose with `--env-file env/.env`
- Always use `make up SERVICE=<svc>` or `docker compose -f docker-compose.yml --env-file env/.env`
