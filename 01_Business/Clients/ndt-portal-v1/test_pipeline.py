#!/usr/bin/env python3
"""Quick end-to-end pipeline test."""
import base64, json, time, sys
import urllib.request, urllib.error

API = "http://localhost:3100"
PDF = "files/extracted/250706-004-1.pdf"

with open(PDF, "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

body = json.dumps({"file": b64, "fileName": "250706-004-1.pdf"}).encode()
req  = urllib.request.Request(f"{API}/rt/analyze", data=body, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
job_id = data["jobId"]
print(f"Created job: {job_id}")

for i in range(60):
    time.sleep(5)
    resp   = urllib.request.urlopen(f"{API}/rt/analyze/{job_id}")
    status = json.loads(resp.read())
    s, stage = status["status"], status.get("stage", "")
    print(f"  [{i+1:02d}] {s} | {stage}")
    if s in ("complete", "failed"):
        print("\n=== FINAL ===")
        print(json.dumps(status, indent=2)[:4000])
        sys.exit(0 if s == "complete" else 1)

print("Timed out")
sys.exit(2)
