\set ON_ERROR_STOP on

BEGIN;

-- =============================================================================
-- 011_team_invites.sql
-- Invitation system for onboarding new users without requiring manual
-- Authentik admin access. Tokens are one-time, 72-hour TTL.
-- =============================================================================

CREATE TABLE IF NOT EXISTS invites (
    id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    email          VARCHAR(200) NOT NULL,
    role           user_role    NOT NULL DEFAULT 'contributor',
    org_id         UUID         NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    invited_by     UUID         REFERENCES users(id) ON DELETE SET NULL,
    token_hash     VARCHAR(64)  UNIQUE NOT NULL,
    expires_at     TIMESTAMPTZ  NOT NULL,
    accepted_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invites_email ON invites (email);
CREATE INDEX IF NOT EXISTS invites_expires_at ON invites (expires_at) WHERE accepted_at IS NULL;

COMMENT ON TABLE invites IS 'One-time invite tokens. Raw token is emailed; only sha256 hash stored. Expires 72h after creation.';
COMMENT ON COLUMN invites.token_hash IS 'SHA-256 hex of the raw invite token. 64 chars.';

COMMIT;
