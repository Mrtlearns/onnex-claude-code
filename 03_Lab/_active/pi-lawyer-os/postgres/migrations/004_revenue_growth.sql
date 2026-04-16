-- PI Lawyer OS — Migration 004: Revenue Growth
-- Phase 4: partners, partner_referrals tables + leads column additions
-- Idempotent (uses IF NOT EXISTS / CREATE OR REPLACE / DO blocks throughout)

-- ============================================================
-- Partners — referral source contacts (attorneys, medicals, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS partners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  partner_type TEXT NOT NULL DEFAULT 'other',  -- attorney, medical, chiropractor, other
  phone        TEXT,
  email        TEXT,
  address      TEXT,
  notes        TEXT,
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partners_firm_id_idx   ON partners(firm_id);
CREATE INDEX IF NOT EXISTS partners_type_idx       ON partners(partner_type);
CREATE INDEX IF NOT EXISTS partners_active_idx     ON partners(active);

CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Partner Referrals — tracks each referral from a partner
-- ============================================================

CREATE TABLE IF NOT EXISTS partner_referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  partner_id        UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  lead_id           UUID REFERENCES leads(id) ON DELETE SET NULL,
  case_id           UUID REFERENCES cases(id) ON DELETE SET NULL,
  commission_pct    NUMERIC(5,2)  DEFAULT 0,   -- percentage of fee, e.g. 33.33
  commission_amount NUMERIC(10,2) DEFAULT 0,   -- dollar amount owed
  commission_paid   BOOLEAN DEFAULT false,
  referred_at       TIMESTAMPTZ DEFAULT now(),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_referrals_firm_id_idx    ON partner_referrals(firm_id);
CREATE INDEX IF NOT EXISTS partner_referrals_partner_id_idx ON partner_referrals(partner_id);
CREATE INDEX IF NOT EXISTS partner_referrals_lead_id_idx    ON partner_referrals(lead_id);
CREATE INDEX IF NOT EXISTS partner_referrals_case_id_idx    ON partner_referrals(case_id);
CREATE INDEX IF NOT EXISTS partner_referrals_paid_idx       ON partner_referrals(commission_paid);

CREATE TRIGGER partner_referrals_updated_at
  BEFORE UPDATE ON partner_referrals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Leads — add resurrection + referral columns
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'referred_by_partner_id'
  ) THEN
    ALTER TABLE leads ADD COLUMN referred_by_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'last_contact_at'
  ) THEN
    ALTER TABLE leads ADD COLUMN last_contact_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'resurrection_sent_at'
  ) THEN
    ALTER TABLE leads ADD COLUMN resurrection_sent_at TIMESTAMPTZ;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leads_referred_by_partner_idx   ON leads(referred_by_partner_id);
CREATE INDEX IF NOT EXISTS leads_last_contact_at_idx       ON leads(last_contact_at);
CREATE INDEX IF NOT EXISTS leads_resurrection_sent_at_idx  ON leads(resurrection_sent_at);

-- ============================================================
-- Trigger: update leads.last_contact_at on communication insert
-- ============================================================

CREATE OR REPLACE FUNCTION update_lead_last_contact() RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads
  SET last_contact_at = NEW.created_at
  WHERE id = NEW.lead_id
    AND (last_contact_at IS NULL OR NEW.created_at > last_contact_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comm_updates_lead_last_contact ON communications;
CREATE TRIGGER comm_updates_lead_last_contact
  AFTER INSERT ON communications
  FOR EACH ROW EXECUTE FUNCTION update_lead_last_contact();

-- Backfill last_contact_at for existing leads from their most recent communication
UPDATE leads l
SET last_contact_at = (
  SELECT MAX(c.created_at)
  FROM communications c
  WHERE c.lead_id = l.id
)
WHERE l.last_contact_at IS NULL;

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE partners          ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY partners_isolation ON partners
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

CREATE POLICY partner_referrals_isolation ON partner_referrals
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

-- ============================================================
-- Grants
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON partners          TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON partner_referrals TO web_user;
