"""Test n8n webhook URLs and check FastAPI logs around artifact upload."""
import paramiko, json

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('10.10.110.41', username='mrt', password='Poll0000', timeout=20)

WF_ART = 'ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe'
ART_ID = '92659f76-6ade-4527-a151-64f9d174d448'
WBHOOK_SECRET = '87108b32f2db65523ed58d3c429a27e3a7ed8f038f923f090348802036e0c77b'

payload = json.dumps({
    'artifact_id': ART_ID,
    'program_control_id': '83b0e00e-4445-5ea7-a8c6-d39eb704e3ad',
    'presigned_url': 'http://test'
})

print("=== Testing webhook URLs ===")
urls = [
    f'http://localhost:5678/webhook/{WF_ART}/webhook/artifact-submitted',
    'http://localhost:5678/webhook/artifact-submitted',
]
for url in urls:
    cmd = (
        f'curl -sf -X POST "{url}"'
        f' -H "Content-Type: application/json"'
        f' -H "X-Webhook-Secret: {WBHOOK_SECRET}"'
        f" -d '{payload}'"
        f' -o /dev/null -w "%{{http_code}}" 2>/dev/null'
    )
    _, o, _ = c.exec_command(cmd, timeout=10)
    code = o.read().decode().strip()
    print(f"  {code} -- {url}")

print()
print("=== FastAPI logs around upload (02:14-02:16) ===")
_, o2, _ = c.exec_command(
    'docker logs cmmc-fastapi --since 2026-04-19T02:13:00 --until 2026-04-19T02:17:00 2>&1 | tail -30',
    timeout=15
)
print(o2.read().decode().strip()[:800])

print()
print("=== n8n container logs last 20 lines ===")
_, o3, _ = c.exec_command(
    'docker logs cmmc-n8n --tail 20 2>&1',
    timeout=10
)
print(o3.read().decode().strip()[:600])

c.close()
