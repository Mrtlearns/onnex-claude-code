-- Migration 036: make auth.users.email nullable
-- Access tokens from Authentik don't always carry email/name claims.
-- The /rbac/me upsert uses COALESCE to preserve existing values, but the
-- column must allow NULL for first-time inserts without email.

ALTER TABLE auth.users ALTER COLUMN email DROP NOT NULL;
