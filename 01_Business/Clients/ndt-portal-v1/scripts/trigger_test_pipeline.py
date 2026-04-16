"""
Server-side script: parse 250706 RT.msg via msg-api, then trigger the NDT pipeline.
Upload to /tmp/ and run via paramiko.
"""
import json, uuid, http.client

# ── 1. Parse the .msg file ────────────────────────────────────────────────────
with open('/tmp/test_rt.msg', 'rb') as f:
    msg_data = f.read()

boundary = 'boundary12345abc'
body = (
    b'--' + boundary.encode() + b'\r\n'
    + b'Content-Disposition: form-data; name="file"; filename="250706 RT.msg"\r\n'
    + b'Content-Type: application/octet-stream\r\n\r\n'
    + msg_data
    + b'\r\n--' + boundary.encode() + b'--\r\n'
)

conn = http.client.HTTPConnection('msg-api', 8000)
conn.request('POST', '/api/upload',
    body=body,
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
resp = conn.getresponse()
parsed = json.loads(resp.read())
print(f"MSG parse status: {resp.status}")
print(f"Subject: {parsed.get('subject', '?')}")
print(f"Attachments: {len(parsed.get('attachments', []))}")
conn.close()

# ── 2. Trigger the pipeline ───────────────────────────────────────────────────
intake_id = str(uuid.uuid4())

pipeline_payload = {
    'intakeId': intake_id,
    'filename': '250706 RT.msg',
    'email': {
        'from': parsed.get('sender', 'test@example.com'),
        'subject': parsed.get('subject', 'RT Test'),
        'date': parsed.get('date', ''),
        'body': parsed.get('body', ''),
    },
    'attachments': parsed.get('attachments', []),
    'attachmentCount': len(parsed.get('attachments', [])),
}

payload_bytes = json.dumps(pipeline_payload).encode('utf-8')
conn2 = http.client.HTTPConnection('api', 3100)
conn2.request('POST', '/integrations/pipeline/analyze',
    body=payload_bytes,
    headers={'Content-Type': 'application/json'})
resp2 = conn2.getresponse()
result = resp2.read().decode('utf-8', errors='replace')
print(f"Pipeline trigger status: {resp2.status}")
print(f"Result: {result[:400]}")
print(f"intakeId: {intake_id}")
conn2.close()
