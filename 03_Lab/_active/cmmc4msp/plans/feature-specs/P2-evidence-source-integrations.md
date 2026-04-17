# P2 — Evidence-Source Integrations (Entra ID, Okta, Defender, CrowdStrike, O365, Splunk)

## Status: Planned | Priority: L per connector | Sprint: Q2 (Entra ID first)

---

## Problem Statement

CMMC evidence lives in the client's existing tooling, not in PDFs. When a client needs to demonstrate that they satisfy AC.L2-3.1.1 (limit system access to authorized users), the evidence is already in Azure Active Directory — conditional access policies, user rosters, privileged role assignments. But today the workflow is: export a screenshot → save as PDF → upload it manually → wait for Claude to assess it.

This creates two failure modes:

1. **Friction:** Most clients never complete the upload cycle. Projects stall at Phase 1 not because the controls aren't implemented, but because gathering evidence is too painful.
2. **Staleness:** Even when evidence is uploaded, it's a static snapshot. The actual control may drift (a conditional access policy gets disabled, a user gets added without MFA) while the artifact shows "met."

Automated integrations eliminate both problems: pull evidence on demand, keep it current, and auto-assess on change.

---

## User Stories

| ID | As a… | I want… | So that… |
|----|--------|---------|---------|
| US-01 | Client admin | To connect my Azure/Entra ID tenant with one OAuth click | My user roster, conditional access policies, and MFA status are auto-imported as evidence |
| US-02 | Client admin | To connect Microsoft Defender for Endpoint | Endpoint hardening reports automatically satisfy SI.L2 and CM.L2 controls |
| US-03 | Client admin | To connect O365 Secure Score | Cloud service configuration evidence is pulled daily |
| US-04 | Client admin | To see which controls were satisfied by an integration vs a manual upload | I understand my coverage posture at a glance |
| US-05 | MSP admin | To trigger a full re-sync on demand for a client | I can refresh evidence before a review without asking the client to re-upload |
| US-06 | MSP admin | To see the last-synced timestamp and sync status per connector | I know if a connector has gone stale or errored |
| US-07 | Any | To have the integration produce real artifacts (not just flags) | The evidence is assessable, auditable, and exportable in the audit package |

---

## Integration Matrix

| Connector | Evidence Type | Controls Satisfied (primary) | Auth Method |
|-----------|--------------|------------------------------|------------|
| **Entra ID / Azure AD** | User roster, CA policies, MFA status, privileged role assignments, sign-in logs | AC.L2-3.1.1/2/5/6, IA.L2-3.5.3/4/5, AU.L2-3.3.2 | OAuth 2.0 PKCE → Microsoft Graph API |
| **Okta** | Users, groups, MFA enrollment, app assignments | AC.L2-3.1.1/2, IA.L2-3.5.3 | OAuth 2.0 → Okta Management API |
| **Microsoft Defender for Endpoint** | Device compliance, vulnerability scan, antimalware status | SI.L2-3.14.1/2/6, CM.L2-3.4.1/2 | Microsoft Graph Security API (same OAuth as Entra) |
| **O365 Secure Score** | Configuration scores, improvement actions | CM.L2-3.4.1/2, SC.L2-3.13.1/2 | Microsoft Graph (same OAuth) |
| **CrowdStrike Falcon** | Endpoint health, prevention policy, detection events | SI.L2-3.14.1/2/6 | OAuth2 client credentials |
| **Splunk / Sentinel** | Audit log samples (syslog, user activity) | AU.L2-3.3.1/2/5/6 | REST API + service account |

**Build order:** Entra ID → Defender (same OAuth, easy add-on) → O365 Secure Score (same OAuth, easy add-on) → Okta → CrowdStrike → Splunk.

---

## Technical Design

### Data Model Changes

**New table: `integrations`**

```sql
CREATE TABLE integrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,   -- 'entra_id' | 'okta' | 'defender' | 'crowdstrike' | 'splunk'
    display_name    TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending | active | error | paused
    config          JSONB,           -- tenant_id, client_id, domain, etc. (no secrets)
    last_synced_at  TIMESTAMPTZ,
    last_error      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, provider)
);
```

**New table: `integration_credentials`** (secrets in Postgres, encrypted at rest)

```sql
CREATE TABLE integration_credentials (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    secret_type     TEXT NOT NULL,   -- 'access_token' | 'refresh_token' | 'client_secret'
    secret_value    TEXT NOT NULL,   -- pgcrypto encrypted: pgp_sym_encrypt(value, $ENCRYPTION_KEY)
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**New column on `artifacts`:**
```sql
ALTER TABLE artifacts ADD COLUMN source_type TEXT DEFAULT 'upload';  -- 'upload' | 'entra_id' | 'defender' | etc.
ALTER TABLE artifacts ADD COLUMN source_integration_id UUID REFERENCES integrations(id);
ALTER TABLE artifacts ADD COLUMN source_metadata JSONB;  -- raw API response snapshot
```

**New table: `integration_sync_log`**

```sql
CREATE TABLE integration_sync_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    triggered_by    TEXT,            -- 'cron' | 'manual' | 'webhook'
    status          TEXT,            -- 'success' | 'partial' | 'error'
    artifacts_created INT DEFAULT 0,
    artifacts_updated INT DEFAULT 0,
    controls_updated  INT DEFAULT 0,
    error_detail    TEXT,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
```

### FastAPI Changes

**New router: `app/routers/integrations.py`**

```
GET    /api/integrations/                          # list integrations for current org
POST   /api/integrations/                          # create/connect a new integration
GET    /api/integrations/{id}                      # get status + last sync info
DELETE /api/integrations/{id}                      # disconnect (delete credentials + integration)
POST   /api/integrations/{id}/sync                 # trigger manual sync
GET    /api/integrations/{id}/sync-log             # pagination sync history
GET    /api/integrations/oauth/entra/callback      # OAuth redirect handler (Entra ID / Defender / O365)
GET    /api/integrations/oauth/okta/callback       # OAuth redirect handler (Okta)
```

**New service: `app/services/integration_service.py`**

Core interface:
```python
class IntegrationProvider(Protocol):
    async def sync(self, integration_id: UUID, conn: asyncpg.Connection, minio: Minio) -> SyncResult: ...
    async def refresh_token(self, integration_id: UUID, conn: asyncpg.Connection) -> None: ...

class EntraIDProvider(IntegrationProvider): ...
class DefenderProvider(IntegrationProvider): ...
class OktaProvider(IntegrationProvider): ...
```

`sync()` for Entra ID:
1. Fetch `GET /users` from Microsoft Graph → user roster
2. Fetch `GET /identity/conditionalAccess/policies` → CA policies
3. Fetch `GET /reports/authenticationMethods/userRegistrationDetails` → MFA enrollment
4. Serialize each data type as a structured JSON artifact (not a PDF — a rich JSON document)
5. Run extraction on the JSON artifact → store in `artifact_chunks` → embed → auto-trigger assessment
6. Update `artifacts.source_type = 'entra_id'`, `source_integration_id`, `source_metadata`
7. Map to controls: user roster → AC.L2-3.1.1/2; CA policies → AC.L2-3.1.5/6, IA.L2-3.5.3

**New service: `app/services/artifact_auto_assess.py`**
- Called after integration sync creates an artifact
- Triggers n8n workflow 02 (assessment) via existing `n8n_service.trigger_assessment()`
- No new workflow needed — the assessment pipeline is already source-agnostic

### n8n Changes

**New Workflow 12 — Integration Sync Scheduler:**
- Cron: daily 02:00 UTC (off-peak)
- Query all `integrations WHERE status = 'active'`
- For each: `POST /api/integrations/{id}/sync`
- Collects results, logs to `integration_sync_log`
- Alerts on errors via email (from P1)

### Frontend Changes

**New page: `/[orgSlug]/settings/integrations`**
- Integration card grid: provider logo, status badge, last-synced timestamp, "Connect" or "Sync Now" / "Disconnect" buttons
- OAuth flow: clicking "Connect Entra ID" redirects to Microsoft login → callback → stored credentials → redirect back to integrations page with success toast
- Sync history modal per integration

**Controls list (`/[orgSlug]/controls/page.tsx`):**
- Filter tag: "Evidence source: Entra ID" / "Manual upload"
- Source badge on artifact cards

**Control detail (`/[orgSlug]/controls/[id]/page.tsx`):**
- Artifact list shows source icon (Azure logo for Entra ID, etc.)
- "Last auto-synced: 2 hours ago" tag

### Evidence Artifact Format

Integration artifacts are stored as **structured JSON documents** in MinIO, not PDFs. The extraction service (`app/services/extraction_service.py`) gains a new code path for `mime_type = 'application/json'` that formats the JSON into human-readable text for Claude assessment.

Example Entra ID artifact (stored as JSON, assessed like any other artifact):
```json
{
  "source": "entra_id",
  "tenant_id": "...",
  "snapshot_at": "2026-04-17T02:00:00Z",
  "users": { "total": 47, "mfa_registered": 44, "mfa_enforcement_rate": 0.94 },
  "conditional_access_policies": [
    { "displayName": "Require MFA for all users", "state": "enabled", "conditions": {...} }
  ],
  "privileged_roles": [
    { "displayName": "Global Administrator", "members": ["admin@acme.com"] }
  ]
}
```

Claude assessment prompt gets additional context: "This artifact was automatically generated from Entra ID on [date]. Evaluate against [control requirement]."

---

## Security Considerations

- OAuth tokens stored encrypted via `pgcrypto.pgp_sym_encrypt` with `INTEGRATION_ENCRYPTION_KEY` env var
- Tokens never returned in API responses — only status and expiry
- Refresh token rotation on every use
- Integration disconnect wipes all credentials immediately
- Minimum Graph API permissions: `User.Read.All`, `Policy.Read.All`, `Reports.Read.All` (read-only scopes)
- Audit: all syncs written to `integration_sync_log` and `activity_log`

---

## Implementation Phases

**Phase 1 (Week 1) — Entra ID:**
DB migration. FastAPI integrations router. OAuth flow (Entra). Graph API user/CA/MFA sync. JSON artifact creation + auto-assessment trigger. Frontend integrations page (basic).

**Phase 2 (Week 2) — Defender + O365 Secure Score:**
Same OAuth token, new Graph endpoints. Map to SI/CM controls. Artifact format for endpoint compliance reports.

**Phase 3 (Week 3+) — Okta, CrowdStrike, Splunk:**
New OAuth flows. Provider implementations. Sync scheduler workflow 12.

---

## Acceptance Criteria

- [ ] Entra ID OAuth flow completes and stores encrypted tokens
- [ ] Sync pulls users, CA policies, MFA enrollment from real Graph API (test tenant)
- [ ] Sync creates artifacts in MinIO and triggers auto-assessment
- [ ] Assessed controls update status from auto-assessment result
- [ ] Manual "Sync Now" button triggers immediate sync and shows progress
- [ ] Disconnect removes all credentials and marks integration as disconnected
- [ ] Artifacts from integration show source badge in UI
- [ ] Nightly cron syncs all active integrations
- [ ] `integration_sync_log` records all attempts with artifact counts
- [ ] Token refresh works without user re-auth within token lifetime
- [ ] Minimum-privilege OAuth scopes — no write permissions to client tenant
