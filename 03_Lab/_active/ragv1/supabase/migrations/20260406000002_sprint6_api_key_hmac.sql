-- Sprint 6 Bug 1 fix: add key_name column (was SELECT'd but missing) and
-- unique constraint to support deterministic HMAC-SHA256 lookup.
-- Previous AES-GCM used random IV on each call → lookups always failed.
ALTER TABLE poc_ragv1.project_api_keys
  ADD COLUMN IF NOT EXISTS key_name text NOT NULL DEFAULT 'default';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_project_api_key'
  ) THEN
    ALTER TABLE poc_ragv1.project_api_keys
      ADD CONSTRAINT uq_project_api_key UNIQUE (project_id, api_key);
  END IF;
END;
$$;

COMMENT ON COLUMN poc_ragv1.project_api_keys.api_key IS
  'HMAC-SHA256 hex digest of the raw bearer token. Deterministic — used for lookup.';
