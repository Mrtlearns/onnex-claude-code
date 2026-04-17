"""Deploy new/modified files to VM via SFTP."""
import os
import sys
import paramiko

HOST = '10.10.110.41'
USER = 'mrt'
PASSWORD = 'Poll0000'
REMOTE_BASE = '/opt/stacks/cmmc4msp'
LOCAL_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FILES = [
    'fastapi/main.py',
    'fastapi/app/config.py',
    'fastapi/app/services/n8n_service.py',
    'fastapi/app/services/email_service.py',
    'fastapi/app/services/copilot_service.py',
    'fastapi/app/services/policy_draft_service.py',
    'fastapi/app/services/docx_service.py',
    'fastapi/app/services/drift_service.py',
    'fastapi/app/services/gap_analysis_service.py',
    'fastapi/app/services/ssp_interview_service.py',
    'fastapi/app/services/integration_service.py',
    'fastapi/app/routers/notifications.py',
    'fastapi/app/routers/audit.py',
    'fastapi/app/routers/analytics.py',
    'fastapi/app/routers/ssp_interview.py',
    'fastapi/app/routers/integrations.py',
    'fastapi/app/routers/controls.py',
    'fastapi/app/routers/programs.py',
    'fastapi/app/routers/webhooks.py',
    'fastapi/app/routers/artifacts.py',
    'postgres/migrations/014_email_infrastructure.sql',
    'postgres/migrations/016_audit_package.sql',
    'postgres/migrations/017_evidence_freshness.sql',
    'postgres/migrations/018_copilot.sql',
    'postgres/migrations/019_policy_drafts.sql',
    'postgres/migrations/020_drift_detection.sql',
    'postgres/migrations/021_gap_analysis.sql',
    'postgres/migrations/022_ssp_interviews.sql',
    'postgres/migrations/023_integrations.sql',
    'n8n/workflows/10_user_invite.json',
    'n8n/workflows/11_assessment_notify.json',
    'n8n/workflows/12_integration_sync.json',
    'n8n/workflows/13_evidence_freshness_monitor.json',
    'n8n/workflows/14_evidence_drift_monitor.json',
    'nextjs/src/components/CopilotChat.tsx',
    'nextjs/src/app/[orgSlug]/settings/notifications/page.tsx',
    'nextjs/src/app/admin/analytics/page.tsx',
    'nextjs/src/app/[orgSlug]/controls/[id]/page.tsx',
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


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD)
    sftp = ssh.open_sftp()

    uploaded = 0
    skipped = []
    failed = []

    for rel in FILES:
        local = os.path.join(LOCAL_BASE, rel.replace('/', os.sep))
        remote = f'{REMOTE_BASE}/{rel}'
        if not os.path.exists(local):
            print(f'SKIP (missing local): {rel}')
            skipped.append(rel)
            continue
        try:
            ensure_dir(sftp, remote.rsplit('/', 1)[0])
            sftp.put(local, remote)
            print(f'OK: {rel}')
            uploaded += 1
        except Exception as e:
            print(f'FAIL: {rel} -> {e}')
            failed.append(rel)

    sftp.close()
    ssh.close()

    print(f'\nUpload complete: {uploaded} OK, {len(skipped)} skipped, {len(failed)} failed')
    if failed:
        print('Failed files:')
        for f in failed:
            print(f'  {f}')
    return len(failed)


if __name__ == '__main__':
    sys.exit(main())
