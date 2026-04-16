-- Migration 015: Expanded audit triggers for TTG-written tables
-- Adds SECURITY DEFINER to fn_audit_log, triggers on 6 new tables, RLS on audit_log

-- ── Recreate fn_audit_log as SECURITY DEFINER ─────────────────────────────
-- Required so the trigger runs with postgres privileges when web_user
-- performs writes (web_user doesn't have INSERT on audit_log).
CREATE OR REPLACE FUNCTION fn_audit_log() RETURNS trigger
  SECURITY DEFINER
  SET search_path = public
AS $$
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

-- ── communications ─────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_communications ON communications;
CREATE TRIGGER audit_communications
  AFTER INSERT OR UPDATE OR DELETE ON communications
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ── tasks ──────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_tasks ON tasks;
CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ── settlement_offers ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_settlement_offers ON settlement_offers;
CREATE TRIGGER audit_settlement_offers
  AFTER INSERT OR UPDATE OR DELETE ON settlement_offers
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ── medical_providers ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_medical_providers ON medical_providers;
CREATE TRIGGER audit_medical_providers
  AFTER INSERT OR UPDATE OR DELETE ON medical_providers
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ── case_costs ─────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_case_costs ON case_costs;
CREATE TRIGGER audit_case_costs
  AFTER INSERT OR UPDATE OR DELETE ON case_costs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ── partner_referrals ──────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS audit_partner_referrals ON partner_referrals;
CREATE TRIGGER audit_partner_referrals
  AFTER INSERT OR UPDATE OR DELETE ON partner_referrals
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ── RLS on audit_log ───────────────────────────────────────────────────────
-- Ensures PostgREST only returns rows for the authenticated user's firm.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_firm_policy ON audit_log;
CREATE POLICY audit_log_firm_policy ON audit_log
  FOR SELECT TO web_user
  USING (firm_id = (
    SELECT firm_id FROM users
    WHERE id = (current_setting('request.jwt.claims', true)::json->>'sub')::uuid
  ));
