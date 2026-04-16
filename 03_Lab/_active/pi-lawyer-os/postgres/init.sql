-- PI Lawyer OS — PostgreSQL Init Script
-- Phase 1: Revenue Protection schema
-- Runs automatically on first container start

-- ============================================================
-- Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- PostgREST Roles
-- ============================================================

-- Unauthenticated role (PostgREST anon)
CREATE ROLE web_anon NOLOGIN;

-- Authenticated role (PostgREST switches to this after JWT validation)
CREATE ROLE web_user NOLOGIN;

-- Auth service role (used by auth microservice to read/write users)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'authenticator_pwd_change_me';
  END IF;
END$$;

GRANT web_anon TO authenticator;
GRANT web_user TO authenticator;

-- ============================================================
-- Tables
-- ============================================================

-- Root tenant entity
CREATE TABLE IF NOT EXISTS firms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  phone       TEXT,
  timezone    TEXT DEFAULT 'America/Los_Angeles',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Staff users (per firm)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  name          TEXT,
  role          TEXT DEFAULT 'paralegal',  -- admin, attorney, paralegal
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (firm_id, email)
);

CREATE INDEX IF NOT EXISTS users_firm_id_idx ON users(firm_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- Leads (prospective clients)
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  first_name      TEXT,
  last_name       TEXT,
  phone           TEXT,
  email           TEXT,
  injury_type     TEXT,                     -- auto, slip-fall, dog-bite, premises-liability, other
  source          TEXT DEFAULT 'web-form',  -- web-form, phone, sms, referral, google
  status          TEXT DEFAULT 'new',       -- new, contacted, intake-in-progress, signed, lost
  notes           TEXT,
  reminder_count  INT DEFAULT 0,            -- intake completion reminders sent
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,
  embedding       vector(1536),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_firm_id_idx ON leads(firm_id);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
CREATE INDEX IF NOT EXISTS leads_phone_idx ON leads(phone);
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS leads_embedding_idx ON leads USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Communications (all interactions with a lead)
CREATE TABLE IF NOT EXISTS communications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,    -- sms, call, email, note
  direction   TEXT,             -- inbound, outbound
  message     TEXT,
  status      TEXT,             -- sent, delivered, failed, received
  metadata    JSONB,            -- twilio_sid, error codes, etc.
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS communications_lead_id_idx ON communications(lead_id);
CREATE INDEX IF NOT EXISTS communications_firm_id_idx ON communications(firm_id);
CREATE INDEX IF NOT EXISTS communications_created_at_idx ON communications(created_at DESC);
CREATE INDEX IF NOT EXISTS communications_channel_idx ON communications(channel);

-- ============================================================
-- updated_at Trigger
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER firms_updated_at
  BEFORE UPDATE ON firms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Notification Trigger (fires n8n speed-to-lead webhook)
-- ============================================================

CREATE OR REPLACE FUNCTION notify_new_lead()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  payload = json_build_object(
    'id',           NEW.id,
    'firm_id',      NEW.firm_id,
    'first_name',   NEW.first_name,
    'last_name',    NEW.last_name,
    'phone',        NEW.phone,
    'email',        NEW.email,
    'injury_type',  NEW.injury_type,
    'source',       NEW.source,
    'status',       NEW.status,
    'created_at',   NEW.created_at
  );
  PERFORM pg_notify('new_lead', payload::TEXT);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_notify_insert
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION notify_new_lead();

-- ============================================================
-- KPI Views (PostgREST exposes these as GET /kpi_*)
-- ============================================================

-- Average speed-to-lead response time (minutes)
-- Time from lead creation to first outbound SMS
CREATE OR REPLACE VIEW kpi_response_time AS
SELECT
  l.firm_id,
  COUNT(l.id)                                                    AS total_leads,
  COUNT(c.created_at)                                            AS responded_leads,
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (c.created_at - l.created_at)) / 60.0
    )::NUMERIC, 1
  )                                                              AS avg_response_minutes,
  COUNT(CASE WHEN
    EXTRACT(EPOCH FROM (c.created_at - l.created_at)) / 60.0 <= 2
    THEN 1 END)                                                  AS within_2_min_count
FROM leads l
LEFT JOIN LATERAL (
  SELECT created_at FROM communications
  WHERE lead_id = l.id
    AND channel = 'sms'
    AND direction = 'outbound'
  ORDER BY created_at ASC
  LIMIT 1
) c ON true
WHERE l.created_at > now() - INTERVAL '30 days'
GROUP BY l.firm_id;

-- Missed call recovery rate
CREATE OR REPLACE VIEW kpi_recovery_rate AS
SELECT
  firm_id,
  COUNT(*) FILTER (WHERE source = 'phone' AND status = 'new')        AS missed_unrecovered,
  COUNT(*) FILTER (WHERE source = 'phone' AND status != 'new')       AS missed_recovered,
  COUNT(*) FILTER (WHERE source = 'phone')                           AS total_missed_calls,
  CASE
    WHEN COUNT(*) FILTER (WHERE source = 'phone') = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(*) FILTER (WHERE source = 'phone' AND status != 'new')
      / COUNT(*) FILTER (WHERE source = 'phone'), 1
    )
  END AS recovery_rate_pct
FROM leads
WHERE created_at > now() - INTERVAL '30 days'
GROUP BY firm_id;

-- Leads by status
CREATE OR REPLACE VIEW kpi_leads_by_status AS
SELECT
  firm_id,
  status,
  COUNT(*) AS count
FROM leads
WHERE created_at > now() - INTERVAL '30 days'
GROUP BY firm_id, status;

-- Intake completion rate
CREATE OR REPLACE VIEW kpi_intake_completion AS
SELECT
  firm_id,
  COUNT(*) FILTER (WHERE status IN ('signed'))                          AS signed,
  COUNT(*) FILTER (WHERE status IN ('intake-in-progress', 'signed'))   AS started_intake,
  COUNT(*)                                                              AS total_leads,
  CASE
    WHEN COUNT(*) FILTER (WHERE status IN ('intake-in-progress', 'signed')) = 0 THEN 0
    ELSE ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'signed')
      / COUNT(*) FILTER (WHERE status IN ('intake-in-progress', 'signed')), 1
    )
  END AS completion_rate_pct
FROM leads
WHERE created_at > now() - INTERVAL '30 days'
GROUP BY firm_id;

-- ============================================================
-- Row-Level Security (PostgREST JWT enforcement)
-- ============================================================

ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Helper: extract firm_id from PostgREST JWT claims
CREATE OR REPLACE FUNCTION current_firm_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'firm_id', '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Firms: users see only their own firm
CREATE POLICY firms_isolation ON firms
  FOR ALL TO web_user
  USING (id = current_firm_id());

-- Leads: scoped to firm
CREATE POLICY leads_isolation ON leads
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

-- Communications: scoped to firm
CREATE POLICY comms_isolation ON communications
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

-- Users: scoped to firm
CREATE POLICY users_isolation ON users
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

-- Grant table access to web_user
GRANT SELECT, INSERT, UPDATE, DELETE ON firms TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON leads TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON communications TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO web_user;

-- Grant view access
GRANT SELECT ON kpi_response_time TO web_user;
GRANT SELECT ON kpi_recovery_rate TO web_user;
GRANT SELECT ON kpi_leads_by_status TO web_user;
GRANT SELECT ON kpi_intake_completion TO web_user;

-- web_anon gets nothing (must authenticate first)
GRANT USAGE ON SCHEMA public TO web_anon;
GRANT USAGE ON SCHEMA public TO web_user;

-- ============================================================
-- Demo seed data (remove before client production deploy)
-- ============================================================

INSERT INTO firms (id, name, slug, phone, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Law Firm',
  'demo',
  '+17025550000',
  'America/Los_Angeles'
) ON CONFLICT DO NOTHING;

-- Demo admin user (password: Admin1234!)
INSERT INTO users (firm_id, email, name, role, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@demo.pilaweros.local',
  'Demo Admin',
  'admin',
  crypt('Admin1234!', gen_salt('bf'))
) ON CONFLICT DO NOTHING;
