-- Migration 014: Email infrastructure — user email column, notification preferences, email audit log

ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex');

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category        TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, category)
);

CREATE TABLE IF NOT EXISTS email_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    category        TEXT NOT NULL,
    subject         TEXT,
    reference_id    UUID,
    provider_id     TEXT,
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    status          TEXT DEFAULT 'sent'
);
