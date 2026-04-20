#!/usr/bin/env python3
"""Decode n8n's flatted execution data format and extract label info."""
import json
import urllib.request
import http.cookiejar


def unflatten(flat):
    """n8n uses flatted format where each object is a ref-by-index."""
    arr = json.loads(flat) if isinstance(flat, str) else flat

    def resolve(node, seen=None):
        if seen is None:
            seen = {}
        if isinstance(node, str):
            if node.isdigit():
                idx = int(node)
                if idx in seen:
                    return seen[idx]
                seen[idx] = None
                result = resolve(arr[idx], seen)
                seen[idx] = result
                return result
            return node
        if isinstance(node, list):
            return [resolve(x, seen) for x in node]
        if isinstance(node, dict):
            return {k: resolve(v, seen) for k, v in node.items()}
        return node

    return resolve(arr[0])


cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

login_payload = {"emailOrLdapLoginId": "mrt@on-nex.com", "password": "Poll0000"}
req = urllib.request.Request(
    "http://n8n:5678/rest/login",
    data=json.dumps(login_payload).encode("utf-8"),
    headers={"Content-Type": "application/json", "browser-id": "dec-1"},
    method="POST",
)
opener.open(req, timeout=20)

req2 = urllib.request.Request(
    "http://n8n:5678/rest/executions/9025?includeData=true",
    headers={"browser-id": "dec-1"},
)
resp = opener.open(req2, timeout=30)
outer = json.loads(resp.read().decode("utf-8"))
inner_str = outer["data"]["data"]
tree = unflatten(inner_str)
run_data = tree["resultData"]["runData"]
print("Nodes executed:", list(run_data.keys()))
print()
for node in ["Resolve Received Label", "Set Label ID", "Label Exists?", "Get Unread Inbox Emails", "Has Emails?"]:
    if node in run_data:
        out_data = run_data[node][0].get("data", {}).get("main", [])
        print(f"=== {node} ===")
        print(json.dumps(out_data, indent=2)[:800])
        print()
