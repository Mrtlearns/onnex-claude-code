#!/usr/bin/env python3
"""Send a test email via SMTP to auto-quotes@ndtesting.com to trigger WF-6."""
import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
import time

ts = int(time.time())
body = f"""Hi team,

Please see the forwarded RFQ below — need UT quote.

Test run at ts={ts}.

---------- Forwarded message ----------
From: Amanda Strand <amandas@tcprecision.com>
Sent: Thursday, April 16, 2026 1:32 PM
Subject: RFQ - 001-135-1982-001 (LABEL TEST {ts})

Hello,

May I get a quote for the following.

Part Number: 001-135-1982-001
Material: 1.0 inch diameter A286 STEEL PER AMS 5737
Process: ULTRASONIC INSPECTION OF RAW STOCK PER ASTM E2375, IMMERSION METHOD 100% COVERAGE REQUIRED. ACCEPTANCE CRITERIA PER ASTM E2375, CLASS A.
Certs: ITAR & NADCAP
QTY: 7 BARS @ 12 feet

Thank you,
Amanda Strand
Toolcraft, Inc
"""

msg = MIMEText(body, "plain", "utf-8")
msg["Subject"] = f"Fw: RFQ LABEL TEST {ts}"
msg["From"] = "Tilesh Maharaj <tilesh@ndtesting.com>"
msg["To"] = "auto-quotes@ndtesting.com"
msg["Date"] = formatdate(localtime=True)
msg["Message-ID"] = make_msgid(domain="ndtesting.com")

host = "smtp.office365.com"
port = 587
user = "auto-quotes@ndtesting.com"
password = "V#073144840199ab"

print(f"Sending via {host}:{port} as {user}")
print(f"Subject: {msg['Subject']}")
context = ssl.create_default_context()
with smtplib.SMTP(host, port, timeout=30) as s:
    s.ehlo()
    s.starttls(context=context)
    s.ehlo()
    s.login(user, password)
    s.sendmail(user, ["auto-quotes@ndtesting.com"], msg.as_string())
print("SENT OK")
