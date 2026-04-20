#!/usr/bin/env python3
"""Login to n8n and print Cookie header."""
import json
import urllib.request

payload = {"emailOrLdapLoginId": "mrt@on-nex.com", "password": "Poll0000"}
req = urllib.request.Request(
    "http://n8n:5678/rest/login",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "browser-id": "gateway-test-browser-id",
    },
    method="POST",
)

with urllib.request.urlopen(req, timeout=20) as r:
    print("STATUS:", r.status)
    for h, v in r.getheaders():
        if h.lower() == "set-cookie":
            print("COOKIE:", v)
