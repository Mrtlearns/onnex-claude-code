# Email Testing — Manual Steps for MrT

**Status:** Configuration committed and pushed. SSH/SMTP testing from Claude Code Windows machine failed (Tailscale/network routing). Performing manual verification steps.

**Test Subject Line:** `EMAIL TESTING (MrT): Ignore`

---

## Step 1: Verify API Container is Running

```bash
# SSH to server
ssh mrt@100.111.233.126
ssh root@10.10.110.32
cd /opt/ndt-portal

# Check API container
docker compose ps api
# Should show: ndt-api:latest, "Up" status

# Verify env vars loaded
docker compose config | grep -A 20 "api:"
# Should show: EMAIL_FROM: auto-quotes@ndtesting.com, IMAP_HOST: outlook.office365.com, etc.

# Check logs for any startup errors
docker logs ndt-api | tail -20
```

---

## Step 2: Create n8n Credentials (UI Required)

1. **Open n8n UI** → http://10.10.110.32:5678 (or public URL if configured)

2. **Settings → Credentials → New → IMAP**
   ```
   Name: NDT Portal IMAP
   Host: outlook.office365.com
   Port: 993
   SSL/TLS: ✅ enabled
   Email: auto-quotes@ndtesting.com
   Password: V#073144840199ab
   ```
   Click **Save**

3. **Settings → Credentials → New → SMTP**
   ```
   Name: NDT Portal SMTP
   Host: smtp.office365.com
   Port: 587
   SSL/TLS: ❌ OFF (use STARTTLS)
   Email: auto-quotes@ndtesting.com
   Password: V#073144840199ab
   ```
   Click **Save**

---

## Step 3: Activate WF-1 and WF-2

1. **Open WF-1 (Email → UT Quote)**
   - Top-right toggle → Active ✅
   - Save
   - Status should show "active"

2. **Open WF-2 (Email → RT Quote)**
   - Top-right toggle → Active ✅
   - Save
   - Status should show "active"

---

## Step 4: Send Test Email

Send an email from any account to: **`auto-quotes@ndtesting.com`**

**Example 1: RT Quote Request**
```
To: auto-quotes@ndtesting.com
Subject: EMAIL TESTING (MrT): Ignore - RT Quote Request
Body:

Customer Name: Test Customer
Part Description: Aluminum plate, 6" x 4" x 0.5"
Test Type: Radiography (RT)
Quantity: 1
Turnaround: ASAP
```

**Example 2: UT Quote Request**
```
To: auto-quotes@ndtesting.com
Subject: EMAIL TESTING (MrT): Ignore - UT Quote Request
Body:

Customer Name: Test Customer
Part Description: Steel weld joint, 12" x 8"
Test Type: Ultrasonic (UT)
Quantity: 3
Turnaround: Next week
```

---

## Step 5: Monitor n8n Execution

1. **Open n8n UI → Executions**

2. **Watch for triggers within ~60 seconds** (IMAP polling interval)
   - **Expected flow for RT email:**
     - WF-2 triggers (Email → RT Quote)
     - Extracts email fields via Claude LLM (Stage 1 classifier)
     - Routes to Stage 2 RT analysis
     - Generates quote PDF
     - Sends reply via SMTP

3. **Click execution to see full trace:**
   - IMAP read node: Should show email received ✅
   - Claude extraction node: Should extract RT fields ✅
   - WF-4 classifier or WF-5 orchestrator: Should route correctly ✅
   - SMTP send node: Should complete ✅

---

## Step 6: Verify Email Reply

1. **Check inbox** of sender (or auto-quotes inbox)
   - Look for reply from `auto-quotes@ndtesting.com`
   - Subject: `Re: EMAIL TESTING (MrT): Ignore - RT Quote Request`
   - Body: Generated PDF quote attached

2. **Check n8n logs** for any failures:
   ```bash
   docker logs n8n | tail -50 | grep -i "error\|fail\|smtp"
   ```

3. **Check API logs** for webhook calls:
   ```bash
   docker logs ndt-api | tail -50 | grep -i "n8n\|quote\|email"
   ```

---

## Expected Success Indicators

| Check | Expected Result |
|-------|-----------------|
| WF-2 execution triggered | ✅ Within ~60 sec of email arrival |
| Claude LLM extraction | ✅ Correctly identified "RT" test type |
| Pipeline orchestration | ✅ WF-5 called via webhook |
| SMTP reply sent | ✅ Email in sent items or logs |
| No errors in logs | ✅ No "authentication failed" or STARTTLS errors |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| **WF-2 never triggers** | IMAP creds invalid or WF-2 not active | Check n8n Settings → Credentials; toggle WF-2 active again |
| **"SMTP authentication failed"** | Password wrong or STARTTLS config wrong | Verify password is `V#073144840199ab`; ensure `SMTP_SECURE: false` (STARTTLS) |
| **"Invalid domain name" error** | MS365 rejecting EHLO | Use MS365 app password instead of account password (if MFA is enabled) |
| **Email received but no reply** | SMTP creds bad or from-address invalid | Check `EMAIL_FROM: auto-quotes@ndtesting.com` in docker-compose |
| **Execution succeeds but no email** | Firewall/egress rule blocking SMTP:587 | Check server firewall rules; try `nc -zv smtp.office365.com 587` |

---

## Logs to Check

```bash
# n8n workflow execution logs (UI: Executions tab)
# API logs
docker logs ndt-api | grep -i "n8n\|quote\|email"

# n8n container logs
docker logs n8n | grep -i "imap\|smtp\|error"

# Docker compose state
docker compose logs -f api
```

---

## Configuration Summary

**What was configured:**
- ✅ `docker-compose.yml` env vars filled (IMAP, SMTP, email from/reply-to)
- ✅ Pushed to GitLab (CI/CD will deploy)
- ⚪ n8n credentials (manual UI step — required before testing)
- ⚪ WF-1 & WF-2 activation (manual UI step — required before testing)

**What needs manual completion:**
1. Restart API container (after git pull on server)
2. Create n8n credentials in Settings UI
3. Activate WF-1 and WF-2
4. Send test emails and monitor execution
