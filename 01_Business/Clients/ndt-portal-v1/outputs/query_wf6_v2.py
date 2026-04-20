#!/usr/bin/env python3
"""Login then fetch execution 9025 in one session."""
import json
import urllib.request
import http.cookiejar


cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# Login
login_payload = {"emailOrLdapLoginId": "mrt@on-nex.com", "password": "Poll0000"}
req = urllib.request.Request(
    "http://n8n:5678/rest/login",
    data=json.dumps(login_payload).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "browser-id": "test-browser-id-wf6",
    },
    method="POST",
)
opener.open(req, timeout=20)
print("LOGIN: OK")
print("COOKIES:", [c.name for c in cj])

# Fetch execution
req2 = urllib.request.Request(
    "http://n8n:5678/rest/executions/9025?includeData=true",
    headers={"browser-id": "test-browser-id-wf6"},
)
try:
    resp = opener.open(req2, timeout=30)
    data = json.loads(resp.read().decode("utf-8"))
    print("EXEC STATUS:", resp.status)
    print("TOP KEYS:", list(data.keys()))
    print("DATA KEYS:", list(data.get("data", {}).keys()) if isinstance(data.get("data"), dict) else type(data.get("data")))
    print("FULL:", json.dumps(data, indent=2)[:2000])
    rd = data.get("data", {}).get("resultData", {}).get("runData", {}) if isinstance(data.get("data"), dict) else {}
    print("Nodes executed:", list(rd.keys()))
    print()
    for node in ["Resolve Received Label", "Set Label ID", "Label Exists?", "Has Emails?"]:
        if node in rd:
            out = rd[node][0].get("data", {}).get("main", [[{}]])
            print(f"=== {node} ===")
            print(json.dumps(out, indent=2)[:500])
            print()
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print("BODY:", e.read().decode("utf-8")[:400])
