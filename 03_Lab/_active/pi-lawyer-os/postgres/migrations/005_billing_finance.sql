-- Migration 005: Billing + Finance
-- Phase 5: settlement_offers, case_costs, case_settlements tables
-- attorney_fee_pct added to cases

-- ============================================================
-- SETTLEMENT OFFERS — negotiation history (offer/counter log)
-- ============================================================
CREATE TABLE settlement_offers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id    UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id    UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  offer_by   TEXT NOT NULL DEFAULT 'defense', -- 'defense' | 'plaintiff'
  amount     NUMERIC(12,2) NOT NULL,
  offered_at DATE NOT NULL DEFAULT CURRENT_DATE,
  notes      TEXT,
  accepted   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_settlement_offers_case_id ON settlement_offers(case_id);
CREATE INDEX idx_settlement_offers_firm_id ON settlement_offers(firm_id);

-- ============================================================
-- CASE COSTS — fee ledger (medical liens, filing fees, expert fees)
-- ============================================================
CREATE TABLE case_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  cost_type   TEXT NOT NULL DEFAULT 'other',
  -- 'medical_lien' | 'filing_fee' | 'expert_fee' | 'investigation' | 'other'
  description TEXT NOT NULL,
  amount      NUMERIC(12,2) NOT NULL,
  paid        BOOLEAN NOT NULL DEFAULT false,
  paid_at     DATE,
  provider_id UUID REFERENCES medical_providers(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_case_costs_case_id ON case_costs(case_id);
CREATE INDEX idx_case_costs_firm_id ON case_costs(firm_id);

-- ============================================================
-- CASE SETTLEMENTS — disbursement calculator (one per case)
-- ============================================================
CREATE TABLE case_settlements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id             UUID UNIQUE NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  gross_settlement    NUMERIC(12,2) NOT NULL,
  attorney_fee_pct    NUMERIC(5,2) NOT NULL DEFAULT 33.33,
  attorney_fee_amount NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(gross_settlement * attorney_fee_pct / 100.0, 2)
  ) STORED,
  costs_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_to_client       NUMERIC(12,2) GENERATED ALWAYS AS (
    ROUND(gross_settlement - (gross_settlement * attorney_fee_pct / 100.0) - costs_total, 2)
  ) STORED,
  settled_at          DATE NOT NULL DEFAULT CURRENT_DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_case_settlements_firm_id ON case_settlements(firm_id);

-- ============================================================
-- ALTER cases — add default attorney fee percentage
-- ============================================================
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS attorney_fee_pct NUMERIC(5,2) DEFAULT 33.33;

-- ============================================================
-- updated_at trigger function (create if not exists)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER settlement_offers_updated_at
  BEFORE UPDATE ON settlement_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER case_costs_updated_at
  BEFORE UPDATE ON case_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER case_settlements_updated_at
  BEFORE UPDATE ON case_settlements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- firm_id JWT DEFAULT (prevents RLS INSERT failures via PostgREST)
-- ============================================================
ALTER TABLE settlement_offers
  ALTER COLUMN firm_id SET DEFAULT
    (current_setting('request.jwt.claims', true)::json->>'firm_id')::UUID;

ALTER TABLE case_costs
  ALTER COLUMN firm_id SET DEFAULT
    (current_setting('request.jwt.claims', true)::json->>'firm_id')::UUID;

ALTER TABLE case_settlements
  ALTER COLUMN firm_id SET DEFAULT
    (current_setting('request.jwt.claims', true)::json->>'firm_id')::UUID;

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE settlement_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_settlements ENABLE ROW LEVEL SECURITY;

-- settlement_offers
CREATE POLICY "settlement_offers_firm_select" ON settlement_offers
  FOR SELECT USING (firm_id = current_firm_id());
CREATE POLICY "settlement_offers_firm_insert" ON settlement_offers
  FOR INSERT WITH CHECK (firm_id = current_firm_id());
CREATE POLICY "settlement_offers_firm_update" ON settlement_offers
  FOR UPDATE USING (firm_id = current_firm_id());
CREATE POLICY "settlement_offers_firm_delete" ON settlement_offers
  FOR DELETE USING (firm_id = current_firm_id());

-- case_costs
CREATE POLICY "case_costs_firm_select" ON case_costs
  FOR SELECT USING (firm_id = current_firm_id());
CREATE POLICY "case_costs_firm_insert" ON case_costs
  FOR INSERT WITH CHECK (firm_id = current_firm_id());
CREATE POLICY "case_costs_firm_update" ON case_costs
  FOR UPDATE USING (firm_id = current_firm_id());
CREATE POLICY "case_costs_firm_delete" ON case_costs
  FOR DELETE USING (firm_id = current_firm_id());

-- case_settlements
CREATE POLICY "case_settlements_firm_select" ON case_settlements
  FOR SELECT USING (firm_id = current_firm_id());
CREATE POLICY "case_settlements_firm_insert" ON case_settlements
  FOR INSERT WITH CHECK (firm_id = current_firm_id());
CREATE POLICY "case_settlements_firm_update" ON case_settlements
  FOR UPDATE USING (firm_id = current_firm_id());
CREATE POLICY "case_settlements_firm_delete" ON case_settlements
  FOR DELETE USING (firm_id = current_firm_id());

-- ============================================================
-- GRANT to web_user
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON settlement_offers TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON case_costs TO web_user;
GRANT SELECT, INSERT, UPDATE ON case_settlements TO web_user;
