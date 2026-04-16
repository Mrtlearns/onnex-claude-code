-- =============================================================================
-- 004_msp_hierarchy.sql
-- CMMC Compliance OS — MSP Hierarchy
-- Adds: msps table, msp_id FK on orgs + users, new role values
-- Safe to run against a live DB — all ALTERs are additive only.
--
-- NOTE: ADD VALUE for ENUM types cannot be inside a transaction in PG < 16.
-- The ENUM additions run outside BEGIN/COMMIT so they auto-commit, then the
-- rest runs in a normal transaction.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. New ENUM values (must auto-commit — cannot be inside BEGIN/COMMIT)
-- ---------------------------------------------------------------------------

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'client_user';

-- ---------------------------------------------------------------------------
-- 2. Everything else in a single transaction
-- ---------------------------------------------------------------------------

BEGIN;

-- msps table
CREATE TABLE IF NOT EXISTS msps (
    id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(200) NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    status      TEXT         NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at  TIMESTAMPTZ  DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

COMMENT ON TABLE msps IS 'MSP entities — Onnex direct clients who resell the platform to defense contractors.';

CREATE TRIGGER trg_msps_updated_at
    BEFORE UPDATE ON msps
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add msp_id FK to orgs (nullable — existing orgs survive untouched)
ALTER TABLE orgs
    ADD COLUMN IF NOT EXISTS msp_id UUID REFERENCES msps(id) ON DELETE SET NULL;

COMMENT ON COLUMN orgs.msp_id IS 'Which MSP manages this client org. NULL for orgs created before MSP hierarchy.';

-- Add msp_id FK to users (for msp_admin users)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS msp_id UUID REFERENCES msps(id) ON DELETE SET NULL;

COMMENT ON COLUMN users.msp_id IS 'MSP this user belongs to. Set for msp_admin users. NULL for client-side users.';

-- Migrate contributor/viewer → client_user (ENUM values now committed above)
UPDATE users
SET role = 'client_user'
WHERE role IN ('contributor', 'viewer');

UPDATE program_members
SET role = 'client_user'
WHERE role IN ('contributor', 'viewer');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orgs_msp_id  ON orgs(msp_id);
CREATE INDEX IF NOT EXISTS idx_users_msp_id ON users(msp_id);

-- Seed Onnex MSP record
INSERT INTO msps (id, name, slug, status)
VALUES (uuid_generate_v4(), 'Onnex', 'onnex', 'active')
ON CONFLICT (slug) DO NOTHING;

COMMIT;
