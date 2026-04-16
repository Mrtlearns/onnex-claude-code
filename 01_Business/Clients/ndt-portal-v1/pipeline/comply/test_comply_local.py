import base64, json, urllib.request, sys

pdf_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/RT-TEST-CLEAN-T-JOINT-WELD.pdf"

with open(pdf_path, "rb") as f:
    b64 = base64.b64encode(f.read()).decode()

payload = json.dumps({
    "content_b64": b64,
    "filename": pdf_path.split("/")[-1],
    "intake_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
}).encode()

req = urllib.request.Request(
    "http://localhost:8010/classify",
    data=payload,
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req, timeout=30) as r:
    d = json.loads(r.read())

print(json.dumps({k: d.get(k) for k in ["classification","llm_routing","risk_score","usml_hits"]}, indent=2))
