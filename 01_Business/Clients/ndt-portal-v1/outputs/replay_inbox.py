#!/usr/bin/env python3
"""Replay Tilesh forwarded email to /inbox/process with a unique ID."""
import json
import os
import time
import urllib.request
import urllib.error

body = """
________________________________
From: Amanda Strand <amandas@tcprecision.com>
Sent: Thursday, April 16, 2026 1:32 PM
To: Daniel Lopez <DanielL@NDTesting.com>; UT TEAM <UTTEAM@NDTesting.com>; UT-Quotes <utquotes@NDTesting.com>; Jonathan Ortiz <JonathanO@NDTesting.com>
Cc: Charles Karvonen <charles@tcprecision.com>
Subject: RFQ - 001-135-1982-001


Hello,

May I get a quote for the following.

Part Number: 001-135-1982-001

Material: 1.0 inch diameter A286 STEEL PER AMS 5737

Process: ULTRASONIC INSPECTION OF RAW STOCK PER ASTM E2375, IMMERSION METHOD 100% COVERAGE REQUIRED. ACCEPTANCE CRITERIA PER ASTM E2375, CLASS A.

Certs/Registrations: ITAR & NADCAP

QTY: 7 BARS @ 12 feet

Thank you,

Amanda Strand| purchasing agent
Toolcraft, Inc
AS9100D & ISO 9001:2015 CERTIFIED
17700 147th Street S.E. Suite E | Monroe, WA 98272
Phone: 360.794.5512 EXT. 213
www.tcprecision.com
"""

ts = int(time.time())
payload = {
    "gmailMessageId": f"api-replay-{ts}",
    "gmailThreadId": f"api-replay-thread-{ts}",
    "labelIds": ["INBOX", "Label_NDT_received"],
    "subject": "Fw: RFQ - 001-135-1982-001 (API REPLAY)",
    "from": "Tilesh Maharaj <tilesh@ndtesting.com>",
    "to": "auto-quotes@ndtesting.com",
    "date": "2026-04-20T12:00:00Z",
    "snippet": "Forwarded RFQ from Amanda Strand at TC Precision",
    "body": body,
    "hasAttachments": False,
    "attachmentFilenames": [],
    "msgAttachmentData": None,
}

secret = os.environ.get("N8N_INTERNAL_SECRET", "")
req = urllib.request.Request(
    "http://api:3100/inbox/process",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "x-n8n-secret": secret,
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req, timeout=60) as resp:
        print("STATUS:", resp.status)
        print("BODY:", resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print("BODY:", e.read().decode("utf-8"))
