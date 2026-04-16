-- Migration 011: Multilingual + Firm Ops (Phase 10)
-- preferred_language on leads/clients, active on users, audit_log, attorney_performance view

-- ── Leads: language preference ─────────────────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- ── Clients: language preference ───────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en';

-- ── Users: soft-delete via active flag ─────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- ── Audit log table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,        -- 'INSERT' | 'UPDATE' | 'DELETE'
  entity_type TEXT NOT NULL,        -- 'lead' | 'case' | 'document' | ...
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_firm_idx     ON audit_log(firm_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx   ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx  ON audit_log(created_at DESC);

GRANT SELECT ON audit_log TO web_user;

-- ── Audit trigger function ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_log() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(firm_id, action, entity_type, entity_id, old_data)
    VALUES (OLD.firm_id, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(firm_id, action, entity_type, entity_id, old_data, new_data)
    VALUES (NEW.firm_id, 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSE
    INSERT INTO audit_log(firm_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.firm_id, 'INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── Audit triggers on leads ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_leads ON leads;
CREATE TRIGGER audit_leads
  AFTER INSERT OR UPDATE OR DELETE ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ── Audit triggers on cases ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_cases ON cases;
CREATE TRIGGER audit_cases
  AFTER INSERT OR UPDATE OR DELETE ON cases
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ── Attorney performance view ──────────────────────────────────────────────
CREATE OR REPLACE VIEW attorney_performance AS
SELECT
  u.id                                                          AS attorney_id,
  u.name                                                        AS attorney_name,
  u.email                                                       AS attorney_email,
  COUNT(c.id)                                                   AS total_cases,
  COUNT(c.id) FILTER (WHERE c.status NOT IN ('closed', 'settlement'))
                                                                AS open_cases,
  COUNT(cs.id) FILTER (
    WHERE EXTRACT(YEAR FROM cs.created_at) = EXTRACT(YEAR FROM NOW())
  )                                                             AS settled_this_year,
  ROUND(AVG(cs.gross_settlement)::numeric, 2)                   AS avg_gross_settlement,
  ROUND(AVG(
    EXTRACT(EPOCH FROM (cs.created_at - c.created_at)) / 86400.0
  )::numeric, 1)                                                AS avg_days_to_settle,
  COALESCE(SUM(cs.attorney_fee_amount), 0)                      AS total_fees_earned,
  c.firm_id
FROM users u
JOIN cases c ON c.assigned_attorney = u.id
LEFT JOIN case_settlements cs ON cs.case_id = c.id
WHERE u.role = 'attorney'
GROUP BY u.id, u.name, u.email, c.firm_id;

GRANT SELECT ON attorney_performance TO web_user;
