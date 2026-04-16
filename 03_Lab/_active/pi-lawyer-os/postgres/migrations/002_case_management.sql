-- PI Lawyer OS — Migration 002: Case Management Core
-- Phase 2: clients, cases, medical_providers, tasks, documents
-- Idempotent (uses IF NOT EXISTS / CREATE OR REPLACE throughout)

-- ============================================================
-- Clients
-- ============================================================

CREATE TABLE IF NOT EXISTS clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  dob                 DATE,
  phone               TEXT,
  email               TEXT,
  address             TEXT,
  injury_description  TEXT,
  -- Insurance
  insurance_carrier   TEXT,
  insurance_policy    TEXT,
  insurance_adjuster  TEXT,
  adjuster_phone      TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_firm_id_idx ON clients(firm_id);
CREATE INDEX IF NOT EXISTS clients_last_name_idx ON clients(last_name);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Cases
-- ============================================================

CREATE TABLE IF NOT EXISTS cases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  lead_id             UUID REFERENCES leads(id) ON DELETE SET NULL,
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  case_number         TEXT,                         -- manually assigned for Phase 2
  case_type           TEXT DEFAULT 'auto',          -- auto, slip-fall, dog-bite, premises-liability, other
  date_of_loss        DATE,
  sol_date            DATE,                         -- statute of limitations deadline
  status              TEXT DEFAULT 'intake',        -- intake, investigation, demand, negotiation, settlement, litigation, closed
  description         TEXT,
  assigned_attorney   UUID REFERENCES users(id) ON DELETE SET NULL,
  opened_at           TIMESTAMPTZ DEFAULT now(),
  closed_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cases_firm_id_idx ON cases(firm_id);
CREATE INDEX IF NOT EXISTS cases_status_idx ON cases(status);
CREATE INDEX IF NOT EXISTS cases_sol_date_idx ON cases(sol_date);
CREATE INDEX IF NOT EXISTS cases_assigned_attorney_idx ON cases(assigned_attorney);
CREATE INDEX IF NOT EXISTS cases_lead_id_idx ON cases(lead_id);
CREATE INDEX IF NOT EXISTS cases_client_id_idx ON cases(client_id);

CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Medical Providers (per case)
-- ============================================================

CREATE TABLE IF NOT EXISTS medical_providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  provider_type   TEXT DEFAULT 'other',   -- hospital, chiropractor, specialist, er, other
  request_status  TEXT DEFAULT 'not-requested',  -- not-requested, requested, received, reviewed
  requested_at    TIMESTAMPTZ,
  received_at     TIMESTAMPTZ,
  lien_amount     NUMERIC(12,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medical_providers_case_id_idx ON medical_providers(case_id);
CREATE INDEX IF NOT EXISTS medical_providers_firm_id_idx ON medical_providers(firm_id);

CREATE TRIGGER medical_providers_updated_at
  BEFORE UPDATE ON medical_providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id     UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id     UUID REFERENCES cases(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    TIMESTAMPTZ,
  task_type   TEXT DEFAULT 'general',  -- sol, hearing, deposition, demand, response, general
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  status      TEXT DEFAULT 'open',     -- open, in-progress, completed, cancelled
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_firm_id_idx ON tasks(firm_id);
CREATE INDEX IF NOT EXISTS tasks_case_id_idx ON tasks(case_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Documents
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id       UUID REFERENCES cases(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  file_path     TEXT NOT NULL,     -- path within uploads volume: /{firm_id}/{case_id}/{uuid}.{ext}
  file_size     INT,               -- bytes
  mime_type     TEXT,
  doc_type      TEXT DEFAULT 'other',  -- retainer, medical, pleading, correspondence, settlement, other
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_case_id_idx ON documents(case_id);
CREATE INDEX IF NOT EXISTS documents_firm_id_idx ON documents(firm_id);

-- ============================================================
-- KPI View: SOL Alerts (cases with SOL within 90 days)
-- ============================================================

CREATE OR REPLACE VIEW kpi_sol_alerts AS
SELECT
  c.id,
  c.firm_id,
  c.case_number,
  c.case_type,
  c.sol_date,
  c.status,
  c.assigned_attorney,
  cl.first_name || ' ' || cl.last_name AS client_name,
  (c.sol_date - CURRENT_DATE)::INT AS days_until_sol,
  CASE
    WHEN c.sol_date - CURRENT_DATE <= 30 THEN 'critical'
    WHEN c.sol_date - CURRENT_DATE <= 60 THEN 'urgent'
    ELSE 'warning'
  END AS urgency
FROM cases c
LEFT JOIN clients cl ON cl.id = c.client_id
WHERE c.status NOT IN ('closed', 'settlement')
  AND c.sol_date IS NOT NULL
  AND c.sol_date - CURRENT_DATE <= 90
  AND c.sol_date >= CURRENT_DATE
ORDER BY c.sol_date ASC;

-- ============================================================
-- KPI View: Tasks Due Today + Overdue
-- ============================================================

CREATE OR REPLACE VIEW kpi_tasks_due AS
SELECT
  t.id,
  t.firm_id,
  t.case_id,
  t.title,
  t.due_date,
  t.task_type,
  t.status,
  t.assigned_to,
  c.case_number,
  cl.first_name || ' ' || cl.last_name AS client_name,
  CASE
    WHEN t.due_date < now() THEN 'overdue'
    WHEN t.due_date <= now() + INTERVAL '1 day' THEN 'due-today'
    ELSE 'upcoming'
  END AS urgency
FROM tasks t
LEFT JOIN cases c ON c.id = t.case_id
LEFT JOIN clients cl ON cl.id = c.client_id
WHERE t.status IN ('open', 'in-progress')
  AND t.due_date <= now() + INTERVAL '7 days'
ORDER BY t.due_date ASC;

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_isolation ON clients
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

CREATE POLICY cases_isolation ON cases
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

CREATE POLICY medical_providers_isolation ON medical_providers
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

CREATE POLICY tasks_isolation ON tasks
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

CREATE POLICY documents_isolation ON documents
  FOR ALL TO web_user
  USING (firm_id = current_firm_id())
  WITH CHECK (firm_id = current_firm_id());

-- ============================================================
-- Grants
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON clients TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON cases TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON medical_providers TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO web_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO web_user;

GRANT SELECT ON kpi_sol_alerts TO web_user;
GRANT SELECT ON kpi_tasks_due TO web_user;
