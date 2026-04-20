#!/usr/bin/env python3
"""Query latest WF-6 execution data to inspect label resolution."""
import json
import urllib.request
import urllib.error

COOKIE = "n8n-auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImViZmZmODViLTFjYmItNDgxNS1hZDA1LTZlYjNmODdhNzU4OCIsImhhc2giOiJtc3BZZ0hNNXBrIiwiYnJvd3NlcklkIjoiTzJKZzB0UWhtRUJFRnhFR2owVUFHdGRsT0MzSmp2V1F3MG9DY3k0ZGhmdz0iLCJ1c2VkTWZhIjpmYWxzZSwiaWF0IjoxNzc2NjkxOTI2LCJleHAiOjE3NzcyOTY3MjZ9.L7UPPlC7K8CXvQpoR5TPoROY_dI3p2DsYDgUwZ38Yao"
BROWSER = "O2Jg0tQhmEBEFxEGj0UAGtdlOC3JjvWQw0oCcy4dhfw="


def fetch(url):
    req = urllib.request.Request(
        url,
        headers={
            "Cookie": COOKIE,
            "browser-id": BROWSER,
        },
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode("utf-8"))


try:
    data = fetch("http://n8n:5678/rest/executions/9025?includeData=true")
    rd = data.get("data", {}).get("resultData", {}).get("runData", {})
    print("=== Nodes executed ===")
    for k in rd.keys():
        print("  -", k)
    print()

    for node in ["Resolve Received Label", "Set Label ID", "Label Exists?", "Has Emails?"]:
        if node in rd:
            out = rd[node][0].get("data", {}).get("main", [[{}]])
            print(f"=== {node} output ===")
            print(json.dumps(out, indent=2)[:1000])
            print()
except Exception as e:
    print("ERROR:", type(e).__name__, e)
