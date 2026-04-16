# Email Configuration Testing Results

**Date:** 2026-04-06 23:57 UTC  
**Status:** ⚠️ PARTIAL — Credentials Created, Authentication Issue Found

---

## Summary

Successfully completed all technical setup steps:
✅ API container restarted  
✅ n8n credentials created (2 credentials imported)  
✅ WF-1 and WF-2 activated  
✅ n8n restarted  

**Issue Found:** MS365 tenant configuration prevents authentication.

---

## Test Results

### 1. ✅ API Container Restart
```bash
docker compose up -d api
# Result: Healthy
```

### 2. ✅ n8n Credentials Import
```bash
n8n import:credentials -i /home/node/.n8n/ndt-credentials.json
# Result: Successfully imported 2 credentials
#   - NDT Portal IMAP (id: 1)
#   - NDT Portal SMTP (id: 2)
```

### 3. ✅ Workflow Activation
```bash
WF-1 (Email → UT Quote): active = False → True ✓
WF-2 (Email → RT Quote): active = False → True ✓
n8n container restarted ✓
```

### 4. ❌ SMTP Authentication Test
```
Connection: ✓ smtp.office365.com:587 reachable
Login: ✗ FAILED
Error: 5.7.139 SmtpClientAuthentication is disabled for the Tenant

Details:
- Basic SMTP auth (username/password) is DISABLED at M365 tenant level
- Microsoft reference: https://aka.ms/smtp_auth_disabled
- Reply emails cannot be sent until this is enabled
```

### 5. ❌ IMAP Authentication Test
```
Connection: ✓ outlook.office365.com:993 reachable
Login: ✗ FAILED (error: LOGIN failed)

Likely causes:
- Account password may not work with IMAP (common with MFA)
- App password required instead of account password
- IMAP might be disabled on the account
```

---

## What's Working ✅

| Component | Status | Notes |
|-----------|--------|-------|
| Network connectivity | ✓ | Both SMTP and IMAP servers are reachable |
| docker-compose.yml env vars | ✓ | All filled in correctly |
| n8n credentials storage | ✓ | 2 credentials successfully imported |
| WF-1, WF-2 activation | ✓ | Both workflows set to active=true |
| n8n workflow engine | ✓ | Restarted and ready |

---

## What Needs Fixing ❌

### Issue #1: M365 SMTP Authentication Disabled
**Impact:** WF-1 and WF-2 cannot send reply emails  
**Severity:** HIGH

**Solution:** Enable SMTP authentication at M365 tenant level (MrT action required)
1. Go to Microsoft 365 admin center
2. Settings → Mail → SMTP
3. Enable "SMTP AUTH client submission"
4. Wait 10-15 minutes for propagation

**Reference:** https://aka.ms/smtp_auth_disabled

### Issue #2: IMAP Authentication Failing
**Impact:** n8n cannot poll mailbox for incoming emails  
**Severity:** CRITICAL

**Likely cause:** App password required (if MFA enabled)

**Solution (if MFA is enabled):**
1. Go to https://myaccount.microsoft.com → Security
2. Create new "App password"
3. Copy the generated password
4. Update docker-compose.yml:
   ```yaml
   IMAP_PASS: "<app-password-here>"
   SMTP_PASS: "<app-password-here>"
   ```
5. Restart API and recreate n8n credentials
6. Test again

**Solution (if MFA is NOT enabled):**
1. Verify password is correct
2. Check M365 security settings for additional restrictions
3. Try accessing O365 webmail directly to confirm account is active

---

## Configuration Status

| Item | Value | Status |
|------|-------|--------|
| IMAP Host | outlook.office365.com | ✓ Configured |
| IMAP Port | 993 | ✓ Configured |
| IMAP User | auto-quotes@ndtesting.com | ✓ Configured |
| IMAP Pass | `V#073144840199ab` | ⚠️ Auth fails — likely needs app password |
| SMTP Host | smtp.office365.com | ✓ Configured |
| SMTP Port | 587 | ✓ Configured |
| SMTP User | auto-quotes@ndtesting.com | ✓ Configured |
| SMTP Pass | `V#073144840199ab` | ❌ Tenant has SMTP disabled |
| Email From | auto-quotes@ndtesting.com | ✓ Configured |
| n8n Webhook Secret | ndt-n8n-secret-2026 | ✓ Configured |
| WF-1 Status | Active | ✓ Ready (once IMAP works) |
| WF-2 Status | Active | ✓ Ready (once IMAP works) |

---

## Next Steps for MrT

1. **Check M365 MFA status:**
   - Go to https://myaccount.microsoft.com
   - Check if MFA is enabled on `auto-quotes@ndtesting.com`

2. **If MFA is enabled:**
   - Generate an app password: https://myaccount.microsoft.com → App passwords
   - Copy the 16-character password
   - Notify Claude with new password

3. **Enable SMTP Authentication (for reply emails):**
   - M365 Admin Center → Settings → Mail → SMTP
   - Enable "SMTP AUTH client submission"
   - Wait 10-15 minutes

4. **Once credentials are fixed:**
   ```bash
   # SSH to server
   ssh mrt@100.111.233.126
   ssh mrt@10.10.110.32
   
   # Update docker-compose.yml with new password (app password or corrected password)
   nano /opt/ndt-portal/docker-compose.yml
   # Edit IMAP_PASS and SMTP_PASS lines
   
   # Restart API
   cd /opt/ndt-portal && sudo docker compose up -d api
   
   # Recreate n8n credentials with corrected password
   cd /opt/ndt-portal && sudo docker compose exec -T n8n n8n export:credentials --all
   # Then reimport with new password
   ```

5. **Test end-to-end:**
   - Send test email to `auto-quotes@ndtesting.com` with subject: `EMAIL TESTING (MrT): Ignore - RT Quote Request`
   - Check n8n Executions tab within 60 seconds
   - Verify WF-2 triggers and reply is sent

---

## Workflow Status

### WF-1: Email → UT Quote
- **Status:** ✓ Active, ready to receive emails
- **Trigger:** IMAP (awaiting working credentials)
- **Action:** Classify email as UT, extract fields, send reply PDF

### WF-2: Email → RT Quote
- **Status:** ✓ Active, ready to receive emails
- **Trigger:** IMAP (awaiting working credentials)
- **Action:** Classify email as RT, extract fields, route to Stage 2 LLM, send reply PDF

### WF-3: Salesforce → UT Quote
- **Status:** Not tested (different integration path)

### WF-4: Unified Classifier
- **Status:** Ready (depends on WF-1/WF-2 email extraction)

### WF-5: Pipeline Orchestrator
- **Status:** Ready (webhook URL configured)

---

## Deployment Checklist

- [x] docker-compose.yml env vars filled
- [x] API container restarted
- [x] n8n credentials created and imported
- [x] WF-1 and WF-2 activated
- [ ] IMAP authentication working (BLOCKED — needs app password)
- [ ] SMTP authentication working (BLOCKED — tenant has SMTP disabled)
- [ ] End-to-end test email processed
- [ ] Reply email sent from auto-quotes

**Blockers:** 2 (IMAP auth, SMTP tenant setting)

---

## Technical Details

### Network Connectivity ✓
- SMTP (587): reachable, TLS negotiation works
- IMAP (993): reachable, TLS negotiation works
- Problem is authentication, not connectivity

### n8n Integration ✓
- Credentials import: Works correctly
- Workflow JSON parsing: Works correctly
- Workflow activation: Works correctly
- n8n restart: Works correctly

### Docker/API ✓
- API container: Running and healthy
- Environment variables: Loaded correctly
- n8n container: Running and healthy

---

## References

- SMTP Issue: https://aka.ms/smtp_auth_disabled
- Microsoft App Passwords: https://myaccount.microsoft.com/
- IMAP troubleshooting: https://support.microsoft.com/en-us/office/imap-settings-for-outlook-9519dd61-440b-44db-af7b-fc47c96f0ae3
