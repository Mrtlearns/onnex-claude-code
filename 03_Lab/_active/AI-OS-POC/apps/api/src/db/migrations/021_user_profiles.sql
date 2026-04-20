CREATE TABLE IF NOT EXISTS user_profiles (
  user_id      TEXT        PRIMARY KEY,
  tenant_id    TEXT        NOT NULL DEFAULT 'default',
  display_name TEXT        NOT NULL,
  avatar_url   TEXT,
  timezone     TEXT,
  job_title    TEXT,
  phone        TEXT,
  status       TEXT        NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_tenant_idx ON user_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS user_profiles_status_idx ON user_profiles (status);
