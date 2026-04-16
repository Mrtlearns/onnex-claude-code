-- Migration 006: Client Portal + Analytics
-- Phase 6: client_users table, shared_with_client on documents,
--           client_user Postgres role, 4 analytics views

-- ============================================================
-- CLIENT_USERS — portal login accounts (one per client per firm)
-- ============================================================
CREATE TABLE client_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT client_users_firm_email_unique UNIQUE (firm_id, email)
);

CREATE INDEX idx_client_users_firm_id ON client_users(firm_id);
CREATE INDEX idx_client_users_client_id ON client_users(client_id);

-- firm_id JWT DEFAULT (consistent with all other tables)
ALTER TABLE client_users
  ALTER COLUMN firm_id SET DEFAULT
    (current_setting('request.jwt.claims', true)::json->>'firm_id')::UUID;

CREATE TRIGGER client_users_updated_at
  BEFORE UPDATE ON client_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- shared_with_client on documents
-- ============================================================
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS shared_with_client BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- client_user Postgres role
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'client_user') THEN
    CREATE ROLE client_user NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO client_user;
GRANT SELECT ON cases TO client_user;
GRANT SELECT ON clients TO client_user;
GRANT SELECT ON documents TO client_user;
GRANT SELECT ON communications TO client_user;
GRANT SELECT ON case_settlements TO client_user;
GRANT SELECT ON case_costs TO client_user;
GRANT SELECT ON settlement_offers TO client_user;

-- Helper: extract client_id from JWT
CREATE OR REPLACE FUNCTION current_client_id() RETURNS UUID AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->>'client_id')::UUID;
$$ LANGUAGE sql STABLE;

-- ============================================================
-- RLS for client_user role
-- ============================================================
-- cases: client sees only their own case
CREATE POLICY "cases_client_user_select" ON cases
  FOR SELECT TO client_user
  USING (client_id = current_client_id() AND firm_id = current_firm_id());

-- clients: client sees only their own record
CREATE POLICY "clients_client_user_select" ON clients
  FOR SELECT TO client_user
  USING (id = current_client_id() AND firm_id = current_firm_id());

-- documents: client sees only shared docs on their case
CREATE POLICY "documents_client_user_select" ON documents
  FOR SELECT TO client_user
  USING (
    shared_with_client = true
    AND firm_id = current_firm_id()
    AND case_id IN (
      SELECT id FROM cases WHERE client_id = current_client_id()
    )
  );

-- communications: client sees only staff notes (channel='note') on their lead
CREATE POLICY "communications_client_user_select" ON communications
  FOR SELECT TO client_user
  USING (
    channel = 'note'
    AND firm_id = current_firm_id()
    AND lead_id IN (
      SELECT lead_id FROM cases
      WHERE client_id = current_client_id() AND lead_id IS NOT NULL
    )
  );

-- case_settlements: client sees their settlement
CREATE POLICY "case_settlements_client_user_select" ON case_settlements
  FOR SELECT TO client_user
  USING (
    firm_id = current_firm_id()
    AND case_id IN (
      SELECT id FROM cases WHERE client_id = current_client_id()
    )
  );

-- case_costs: client sees their costs
CREATE POLICY "case_costs_client_user_select" ON case_costs
  FOR SELECT TO client_user
  USING (
    firm_id = current_firm_id()
    AND case_id IN (
      SELECT id FROM cases WHERE client_id = current_client_id()
    )
  );

-- settlement_offers: client sees their offers
CREATE POLICY "settlement_offers_client_user_select" ON settlement_offers
  FOR SELECT TO client_user
  USING (
    firm_id = current_firm_id()
    AND case_id IN (
      SELECT id FROM cases WHERE client_id = current_client_id()
    )
  );

-- ============================================================
-- RLS on client_users for web_user (staff manages portal accounts)
-- ============================================================
ALTER TABLE client_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_users_firm_select" ON client_users
  FOR SELECT USING (firm_id = current_firm_id());
CREATE POLICY "client_users_firm_insert" ON client_users
  FOR INSERT WITH CHECK (firm_id = current_firm_id());
CREATE POLICY "client_users_firm_update" ON client_users
  FOR UPDATE USING (firm_id = current_firm_id());
CREATE POLICY "client_users_firm_delete" ON client_users
  FOR DELETE USING (firm_id = current_firm_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON client_users TO web_user;

-- ============================================================
-- ANALYTICS VIEWS (firm-scoped — web_user only)
-- ============================================================

-- Case summary KPIs
CREATE OR REPLACE VIEW v_analytics_case_summary AS
SELECT
  c.firm_id,
  COUNT(c.id)                                                AS total_cases,
  COUNT(c.id) FILTER (WHERE c.status = 'closed')            AS closed_cases,
  COUNT(c.id) FILTER (WHERE c.status = 'settlement')        AS settled_cases,
  COUNT(c.id) FILTER (WHERE c.status = 'litigation')        AS litigation_cases,
  COALESCE(ROUND(AVG(cs.gross_settlement)::NUMERIC, 2), 0)  AS avg_settlement,
  COALESCE(SUM(cs.gross_settlement), 0)                     AS total_settlement_value,
  COALESCE(SUM(cs.net_to_client), 0)                        AS total_net_to_client,
  COALESCE(SUM(cs.attorney_fee_amount), 0)                  AS total_attorney_fees,
  CASE WHEN COUNT(c.id) > 0
    THEN ROUND(COUNT(cs.id)::NUMERIC / COUNT(c.id) * 100, 1)
    ELSE 0
  END                                                        AS settlement_rate_pct
FROM cases c
LEFT JOIN case_settlements cs ON cs.case_id = c.id
GROUP BY c.firm_id;

-- Lead funnel by status
CREATE OR REPLACE VIEW v_analytics_lead_funnel AS
SELECT
  firm_id,
  status,
  COUNT(*) AS count
FROM leads
GROUP BY firm_id, status;

-- Referral attribution (source → leads, signed, conversion rate)
CREATE OR REPLACE VIEW v_analytics_referral_attribution AS
SELECT
  firm_id,
  source,
  COUNT(*)                                              AS total_leads,
  COUNT(*) FILTER (WHERE status = 'signed')             AS signed_leads,
  COUNT(*) FILTER (WHERE status = 'lost')               AS lost_leads,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(COUNT(*) FILTER (WHERE status = 'signed')::NUMERIC / COUNT(*) * 100, 1)
    ELSE 0
  END                                                   AS conversion_pct
FROM leads
GROUP BY firm_id, source;

-- Partner performance (referrals, signed, commissions)
CREATE OR REPLACE VIEW v_analytics_partner_performance AS
SELECT
  p.firm_id,
  p.id                                                                     AS partner_id,
  p.name,
  p.partner_type,
  COUNT(pr.id)                                                             AS total_referrals,
  COUNT(l.id) FILTER (WHERE l.status = 'signed')                          AS signed_referrals,
  CASE WHEN COUNT(pr.id) > 0
    THEN ROUND(COUNT(l.id) FILTER (WHERE l.status = 'signed')::NUMERIC / COUNT(pr.id) * 100, 1)
    ELSE 0
  END                                                                      AS conversion_pct,
  COALESCE(SUM(pr.commission_amount) FILTER (WHERE NOT pr.commission_paid), 0) AS commissions_owed,
  COALESCE(SUM(pr.commission_amount) FILTER (WHERE pr.commission_paid), 0)     AS commissions_paid
FROM partners p
LEFT JOIN partner_referrals pr ON pr.partner_id = p.id
LEFT JOIN leads l ON l.id = pr.lead_id
GROUP BY p.firm_id, p.id, p.name, p.partner_type;

-- GRANT views to web_user
GRANT SELECT ON v_analytics_case_summary      TO web_user;
GRANT SELECT ON v_analytics_lead_funnel       TO web_user;
GRANT SELECT ON v_analytics_referral_attribution TO web_user;
GRANT SELECT ON v_analytics_partner_performance  TO web_user;
