import json, urllib.request, uuid

payload = json.dumps({
    "intake_id": str(uuid.uuid4()),
    "text": "Test pipe weld inspection ASTM A106 carbon steel",
    "routing": "CLOUD_OK",
}).encode()

req = urllib.request.Request(
    "http://localhost:8011/sanitize",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    r = json.loads(urllib.request.urlopen(req, timeout=10).read())
    print("SANITIZE OK")
    print("  job_id:      ", r.get("job_id"))
    print("  entity_count:", r.get("entity_count"))
    print("  sanitized:   ", r.get("sanitized_text", "")[:80])
except Exception as e:
    print("SANITIZE FAIL:", e)
