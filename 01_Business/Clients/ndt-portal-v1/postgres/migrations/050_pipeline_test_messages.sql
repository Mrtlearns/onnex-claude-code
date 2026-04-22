-- Pipeline Tester: saved test messages dataset
-- Stores email text + full attachment base64 for persistent cross-device test fixtures.

CREATE TABLE IF NOT EXISTS app.pipeline_test_messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT        NOT NULL,
  email_from        TEXT,
  email_subject     TEXT,
  email_text        TEXT,
  attachment_name   TEXT,
  attachment_mime   TEXT,
  attachment_base64 TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
