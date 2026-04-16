-- PI Lawyer OS — Database Schema
-- Source: ChatGPT blueprint + Onnex decisions. Locked 2026-03-16.
-- Phase 1 tables only. Phase 2+ tables added in their respective phases.

-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PHASE 1: Revenue Protection
-- ============================================================

-- Root tenant entity
CREATE TABLE firms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,      -- used for routing, e.g. "smith-injury-law"
  phone       TEXT,                      -- firm's main intake number (Twilio)
  timezone    TEXT DEFAULT 'America/Los_Angeles',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Prospective clients / leads
CREATE TABLE leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  first_name    TEXT,
  last_name     TEXT,
  phone         TEXT,
  email         TEXT,
  injury_type   TEXT,                    -- auto, slip-fall, dog-bite, other
  source        TEXT,                    -- web-form, phone, sms, referral, google
  status        TEXT DEFAULT 'new',      -- new, contacted, intake-in-progress, signed, lost
  notes         TEXT,
  embedding     vector(1536),            -- pgvector: for similarity search / dedup
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT leads_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES firms(id)
);

CREATE INDEX leads_firm_id_idx ON leads(firm_id);
CREATE INDEX leads_status_idx ON leads(status);
CREATE INDEX leads_phone_idx ON leads(phone);
CREATE INDEX leads_embedding_idx ON leads USING ivfflat (embedding vector_cosine_ops);

-- All communications with a lead (SMS, calls, notes)
CREATE TABLE communications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL,             -- sms, call, email, note
  direction   TEXT,                      -- inbound, outbound
  message     TEXT,
  status      TEXT,                      -- sent, delivered, failed, received
  metadata    JSONB,                     -- Twilio SID, error codes, etc.
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX communications_lead_id_idx ON communications(lead_id);
CREATE INDEX communications_firm_id_idx ON communications(firm_id);
CREATE INDEX communications_created_at_idx ON communications(created_at DESC);

-- Firm staff users
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  name        TEXT,
  role        TEXT DEFAULT 'paralegal',  -- admin, attorney, paralegal
  password_hash TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),

  UNIQUE (firm_id, email)
);

CREATE INDEX users_firm_id_idx ON users(firm_id);

-- ============================================================
-- PHASE 2: Case Management (added in Phase 2 build)
-- ============================================================

-- Signed clients (created from leads when retainer is signed)
-- CREATE TABLE clients ( ... );

-- Active cases
-- CREATE TABLE cases ( ... );

-- Attorneys (subset of users with attorney role)
-- Handled via users table + role = 'attorney'

-- Medical providers and records tracking
-- CREATE TABLE medical_providers ( ... );
-- CREATE TABLE medical_records ( ... );

-- Documents
-- CREATE TABLE documents ( ... );

-- Tasks and deadlines
-- CREATE TABLE tasks ( ... );

-- ============================================================
-- UTILITY: updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER firms_updated_at
  BEFORE UPDATE ON firms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
