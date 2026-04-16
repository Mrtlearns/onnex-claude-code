-- ============================================================
-- AI Maturity Compass — Database Schema
-- Target: poc-backend (poc-nursery.poc.playsap.us)
-- Schema: public (Supabase default — PostgREST auto-exposed)
-- Run via: Supabase Studio SQL Editor at poc-nursery.poc.playsap.us
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE org_status AS ENUM ('active', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE employee_status AS ENUM ('not_started', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE role_level AS ENUM ('cxo', 'director', 'manager', 'individual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE cycle_status AS ENUM ('draft', 'evaluated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE gap_priority AS ENUM ('High', 'Medium', 'Low');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'employee');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- USER ROLES (security-critical — separate table, no RLS loop)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  organization_id UUID,  -- NULL = global admin; set for org-scoped employees
  UNIQUE(user_id, role, organization_id)
);

-- ============================================================
-- SECURITY DEFINER FUNCTION FOR ROLE CHECKS
-- Must be created before RLS policies reference it.
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  status org_status NOT NULL DEFAULT 'active',
  employee_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- EMPLOYEES (linked to auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  job_title TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  employees_affected INTEGER NOT NULL DEFAULT 1,
  role_level role_level NOT NULL DEFAULT 'individual',
  status employee_status NOT NULL DEFAULT 'not_started',
  questions_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email)
);

-- ============================================================
-- QUESTIONS (admin-managed question bank)
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  dimension TEXT NOT NULL,
  question_text TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- QUESTION OPTIONS (5 options per question)
-- ============================================================
CREATE TABLE IF NOT EXISTS question_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  label TEXT NOT NULL,
  option_text TEXT NOT NULL,
  UNIQUE(question_id, score)
);

-- ============================================================
-- EMPLOYEE ANSWERS
-- ============================================================
CREATE TABLE IF NOT EXISTS employee_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, question_id)
);

-- ============================================================
-- EVALUATION CYCLES
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluation_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_label TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondent_count INTEGER NOT NULL DEFAULT 0,
  status cycle_status NOT NULL DEFAULT 'draft',
  triggered_by UUID REFERENCES auth.users(id),
  UNIQUE(organization_id, version_number)
);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES evaluation_cycles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  overall_score NUMERIC(3,1) NOT NULL,
  overall_weighted NUMERIC(3,1) NOT NULL,
  maturity_stage TEXT NOT NULL,
  shareable_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  executive_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DIMENSION SCORES (per report)
-- ============================================================
CREATE TABLE IF NOT EXISTS dimension_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  avg_score NUMERIC(3,1) NOT NULL,
  weighted_score NUMERIC(3,1) NOT NULL,
  narrative TEXT,
  UNIQUE(report_id, dimension)
);

-- ============================================================
-- GAP ANALYSIS (per report)
-- ============================================================
CREATE TABLE IF NOT EXISTS gap_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  current_score NUMERIC(3,1) NOT NULL,
  target_score NUMERIC(3,1) NOT NULL,
  gap NUMERIC(3,1) NOT NULL,
  priority gap_priority NOT NULL,
  UNIQUE(report_id, dimension)
);

-- ============================================================
-- RESPONDENT RESULTS (internal report)
-- ============================================================
CREATE TABLE IF NOT EXISTS respondent_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  scores JSONB NOT NULL,
  avg_score NUMERIC(3,1) NOT NULL,
  archetype TEXT,
  archetype_rationale TEXT,
  UNIQUE(report_id, employee_id)
);

-- ============================================================
-- ENGAGEMENT COSTING (internal report)
-- ============================================================
CREATE TABLE IF NOT EXISTS report_costing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  phases JSONB NOT NULL,
  scale_multiplier NUMERIC(3,1) NOT NULL,
  total_fee INTEGER NOT NULL,
  delivery_cost INTEGER NOT NULL,
  net_profit INTEGER NOT NULL,
  gross_margin NUMERIC(4,1) NOT NULL,
  UNIQUE(report_id)
);

-- ============================================================
-- SYLLABUS MODULES (internal report)
-- ============================================================
CREATE TABLE IF NOT EXISTS syllabus_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  title TEXT NOT NULL,
  target_audience TEXT[] NOT NULL,
  objectives TEXT[] NOT NULL,
  format TEXT NOT NULL,
  duration TEXT NOT NULL,
  score NUMERIC(3,1) NOT NULL
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_answers_employee ON employee_answers(employee_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_cycles_org ON evaluation_cycles(organization_id);
CREATE INDEX IF NOT EXISTS idx_reports_cycle ON reports(cycle_id);
CREATE INDEX IF NOT EXISTS idx_reports_org ON reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_reports_token ON reports(shareable_token);
CREATE INDEX IF NOT EXISTS idx_dimension_scores_report ON dimension_scores(report_id);
CREATE INDEX IF NOT EXISTS idx_gap_analysis_report ON gap_analysis(report_id);
CREATE INDEX IF NOT EXISTS idx_respondent_results_report ON respondent_results(report_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_employees_updated_at ON employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_questions_updated_at ON questions;
CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE dimension_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE gap_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE respondent_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_costing ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins full access on organizations" ON organizations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access on employees" ON employees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access on questions" ON questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access on question_options" ON question_options FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access on evaluation_cycles" ON evaluation_cycles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access on reports" ON reports FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access on dimension_scores" ON dimension_scores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access on gap_analysis" ON gap_analysis FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access on respondent_results" ON respondent_results FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access on report_costing" ON report_costing FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access on syllabus_modules" ON syllabus_modules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read user_roles" ON user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Employee access
CREATE POLICY "Employees can read active questions" ON questions FOR SELECT TO authenticated USING (is_active = true);
CREATE POLICY "Employees can read question options" ON question_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can manage own answers" ON employee_answers FOR ALL TO authenticated
  USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));
CREATE POLICY "Employees can read own record" ON employees FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Employees can update own record" ON employees FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Employees read own role" ON user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Public shared report access (anon)
CREATE POLICY "Public shared report access" ON reports FOR SELECT TO anon USING (shareable_token IS NOT NULL);
CREATE POLICY "Public shared dimension scores" ON dimension_scores FOR SELECT TO anon
  USING (report_id IN (SELECT id FROM reports WHERE shareable_token IS NOT NULL));
CREATE POLICY "Public shared gap analysis" ON gap_analysis FOR SELECT TO anon
  USING (report_id IN (SELECT id FROM reports WHERE shareable_token IS NOT NULL));
