-- Migration 023: Evidence Source Integrations
-- Adds integration tables for 6 OAuth/API connectors + extends artifacts

CREATE TABLE IF NOT EXISTS integrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,  -- 'entra_id' | 'okta' | 'defender' | 'crowdstrike' | 'o365' | 'splunk'
    display_name    TEXT,
    status          TEXT DEFAULT 'active',  -- active | paused | error | revoked
    last_sync_at    TIMESTAMPTZ,
    last_error      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (org_id, provider)
);

CREATE TABLE IF NOT EXISTS integration_credentials (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL,  -- 'oauth_token' | 'api_key' | 'client_credentials'
    encrypted_value TEXT NOT NULL,  -- base64-encoded; in production use Vault/KMS
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_sync_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    synced_at       TIMESTAMPTZ DEFAULT NOW(),
    artifacts_created INT DEFAULT 0,
    artifacts_updated INT DEFAULT 0,
    status          TEXT DEFAULT 'success',  -- success | partial | error
    error_detail    TEXT
);

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';  -- 'manual' | 'entra_id' | 'okta' | 'defender' | 'crowdstrike' | 'o365' | 'splunk'
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS source_integration_id UUID REFERENCES integrations(id);
