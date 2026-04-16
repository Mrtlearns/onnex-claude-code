-- Migration 007: Add email_from to intake_sessions for history lookup

ALTER TABLE pipeline.intake_sessions
  ADD COLUMN IF NOT EXISTS email_from TEXT;

-- Fast exact-email lookup for returning senders
CREATE INDEX IF NOT EXISTS idx_intake_sessions_email_from
  ON pipeline.intake_sessions (email_from)
  WHERE email_from IS NOT NULL;

-- Fast domain-based lookup (e.g. all @premco.com)
CREATE INDEX IF NOT EXISTS idx_intake_sessions_email_domain
  ON pipeline.intake_sessions (lower(split_part(email_from, '@', 2)))
  WHERE email_from IS NOT NULL;

GRANT ALL PRIVILEGES ON TABLE pipeline.intake_sessions TO ndtapp;
