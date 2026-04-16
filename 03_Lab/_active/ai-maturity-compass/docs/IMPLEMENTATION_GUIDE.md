# AI Maturity Platform — Full Implementation Guide

> **Purpose**: This document provides everything needed to convert this frontend-only prototype into a fully functional production application with a PostgreSQL database, real AI/LLM integration, and proper authentication. It is written for an AI coding agent (Claude Code) or developer to execute.

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [PostgreSQL Database Schema](#2-postgresql-database-schema)
3. [Authentication Implementation](#3-authentication-implementation)
4. [Database Integration — Replace Mock Data](#4-database-integration--replace-mock-data)
5. [AI/LLM Integration — Replace Mock AI](#5-aillm-integration--replace-mock-ai)
6. [API Layer / Edge Functions](#6-api-layer--edge-functions)
7. [File-by-File Migration Checklist](#7-file-by-file-migration-checklist)
8. [Environment Variables & Secrets](#8-environment-variables--secrets)
9. [Deployment & Infrastructure](#9-deployment--infrastructure)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Current State Summary

### What exists
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Routing**: React Router v6 with admin, employee, and shared report routes
- **State**: All data is mock — hardcoded arrays in `src/lib/mock-data.ts`
- **Auth**: Fake login (`admin/admin` or any username containing "employee")
- **AI Features**: Template-based string generators in `src/lib/ai-mock.ts` (no LLM calls)
- **Persistence**: `sessionStorage` for generated reports, `localStorage` for questionnaire progress
- **Scoring**: Real scoring engine in `src/lib/scoring-service.ts` (this is production-ready, keep it)

### What needs to change
| Layer | Current | Target |
|-------|---------|--------|
| Auth | Hardcoded `admin/admin` check | Supabase Auth (email/password + roles) |
| Data | `mock-data.ts` arrays | PostgreSQL via Supabase client |
| AI Chat | Pattern-matching `getAIChatResponse()` | LLM API (streaming) via edge function |
| AI Summary | Template `generateExecutiveSummary()` | LLM API via edge function |
| AI Questions | Hardcoded templates `generateAIQuestion()` | LLM API via edge function |
| AI Improve | String manipulation `improveQuestion()` | LLM API via edge function |
| AI Insights | Random pick `generateDashboardInsights()` | LLM API via edge function |
| AI Narratives | Hardcoded paragraphs `generateEnhancedNarrative()` | LLM API via edge function |
| Persistence | sessionStorage / localStorage | PostgreSQL |
| PDF Export | html2canvas + jspdf (keep as-is) | No change needed |

---

## 2. PostgreSQL Database Schema

### Complete SQL Migration

```sql
-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE org_status AS ENUM ('active', 'archived');
CREATE TYPE employee_status AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE role_level AS ENUM ('cxo', 'director', 'manager', 'individual');
CREATE TYPE cycle_status AS ENUM ('draft', 'evaluated');
CREATE TYPE gap_priority AS ENUM ('High', 'Medium', 'Low');
CREATE TYPE app_role AS ENUM ('admin', 'employee');

-- ============================================
-- ORGANIZATIONS
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT NOT NULL,
  status org_status NOT NULL DEFAULT 'active',
  employee_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- EMPLOYEES (linked to auth.users)
-- ============================================
CREATE TABLE employees (
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

-- ============================================
-- QUESTIONS (admin-managed question bank)
-- ============================================
CREATE TABLE questions (
  id SERIAL PRIMARY KEY,
  dimension TEXT NOT NULL,
  question_text TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all',  -- 'all' | 'cxo' | 'manager' | 'individual'
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- QUESTION OPTIONS (5 options per question)
-- ============================================
CREATE TABLE question_options (
  id SERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  label TEXT NOT NULL,  -- 'A', 'B', 'C', 'D', 'E'
  option_text TEXT NOT NULL,
  UNIQUE(question_id, score)
);

-- ============================================
-- EMPLOYEE ANSWERS
-- ============================================
CREATE TABLE employee_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, question_id)
);

-- ============================================
-- EVALUATION CYCLES
-- ============================================
CREATE TABLE evaluation_cycles (
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

-- ============================================
-- REPORTS (generated evaluation results)
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES evaluation_cycles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Client-facing data
  overall_score NUMERIC(3,1) NOT NULL,
  overall_weighted NUMERIC(3,1) NOT NULL,
  maturity_stage TEXT NOT NULL,
  shareable_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  
  -- AI-generated content (cached)
  executive_summary TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- DIMENSION SCORES (per report)
-- ============================================
CREATE TABLE dimension_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  avg_score NUMERIC(3,1) NOT NULL,
  weighted_score NUMERIC(3,1) NOT NULL,
  narrative TEXT,  -- AI-generated narrative cached here
  UNIQUE(report_id, dimension)
);

-- ============================================
-- GAP ANALYSIS (per report)
-- ============================================
CREATE TABLE gap_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,
  current_score NUMERIC(3,1) NOT NULL,
  target_score NUMERIC(3,1) NOT NULL,
  gap NUMERIC(3,1) NOT NULL,
  priority gap_priority NOT NULL,
  UNIQUE(report_id, dimension)
);

-- ============================================
-- RESPONDENT RESULTS (internal report data)
-- ============================================
CREATE TABLE respondent_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  scores JSONB NOT NULL,  -- { "Strategy & Vision": 3.5, ... }
  avg_score NUMERIC(3,1) NOT NULL,
  archetype TEXT,
  archetype_rationale TEXT,
  UNIQUE(report_id, employee_id)
);

-- ============================================
-- COSTING (internal report data, per report)
-- ============================================
CREATE TABLE report_costing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  phases JSONB NOT NULL,  -- Array of { phase, description, duration, fee }
  scale_multiplier NUMERIC(3,1) NOT NULL,
  total_fee INTEGER NOT NULL,
  delivery_cost INTEGER NOT NULL,
  net_profit INTEGER NOT NULL,
  gross_margin NUMERIC(4,1) NOT NULL,
  UNIQUE(report_id)
);

-- ============================================
-- SYLLABUS MODULES (internal report data)
-- ============================================
CREATE TABLE syllabus_modules (
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

-- ============================================
-- HISTORICAL SCORES (for trend charts)
-- ============================================
-- This is derived from dimension_scores + evaluation_cycles.
-- No separate table needed — query via JOIN.

-- ============================================
-- USER ROLES (security-critical — separate table)
-- ============================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  -- organization_id is NULL for global admins, set for org-scoped employees
  UNIQUE(user_id, role, organization_id)
);

-- ============================================
-- SECURITY DEFINER FUNCTION FOR ROLE CHECKS
-- ============================================
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

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_employees_org ON employees(organization_id);
CREATE INDEX idx_employees_user ON employees(user_id);
CREATE INDEX idx_employee_answers_employee ON employee_answers(employee_id);
CREATE INDEX idx_evaluation_cycles_org ON evaluation_cycles(organization_id);
CREATE INDEX idx_reports_cycle ON reports(cycle_id);
CREATE INDEX idx_reports_org ON reports(organization_id);
CREATE INDEX idx_reports_token ON reports(shareable_token);
CREATE INDEX idx_dimension_scores_report ON dimension_scores(report_id);
CREATE INDEX idx_gap_analysis_report ON gap_analysis(report_id);
CREATE INDEX idx_respondent_results_report ON respondent_results(report_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);

-- ============================================
-- RLS POLICIES
-- ============================================
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

-- Admins can do everything
CREATE POLICY "Admins full access on organizations"
  ON organizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on employees"
  ON employees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on questions"
  ON questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on question_options"
  ON question_options FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on evaluation_cycles"
  ON evaluation_cycles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on reports"
  ON reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on dimension_scores"
  ON dimension_scores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on gap_analysis"
  ON gap_analysis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on respondent_results"
  ON respondent_results FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on report_costing"
  ON report_costing FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access on syllabus_modules"
  ON syllabus_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Employees can read questions
CREATE POLICY "Employees can read active questions"
  ON questions FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Employees can read question options"
  ON question_options FOR SELECT TO authenticated
  USING (true);

-- Employees can read/write their own answers
CREATE POLICY "Employees can manage own answers"
  ON employee_answers FOR ALL TO authenticated
  USING (
    employee_id IN (
      SELECT id FROM employees WHERE user_id = auth.uid()
    )
  );

-- Employees can read their own employee record
CREATE POLICY "Employees can read own record"
  ON employees FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Employees can update their own profile fields
CREATE POLICY "Employees can update own record"
  ON employees FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Public access to shared reports (via token)
CREATE POLICY "Public shared report access"
  ON reports FOR SELECT TO anon
  USING (shareable_token IS NOT NULL);

CREATE POLICY "Public shared dimension scores"
  ON dimension_scores FOR SELECT TO anon
  USING (
    report_id IN (SELECT id FROM reports WHERE shareable_token IS NOT NULL)
  );

CREATE POLICY "Public shared gap analysis"
  ON gap_analysis FOR SELECT TO anon
  USING (
    report_id IN (SELECT id FROM reports WHERE shareable_token IS NOT NULL)
  );

-- ============================================
-- SEED: Default questions from config/questions.ts
-- ============================================
-- Run the seed script separately (see Section 4).

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Seed Data Script

Generate from `src/config/questions.ts`. Create an edge function or SQL script:

```sql
-- Example for first question (repeat for all 24):
INSERT INTO questions (id, dimension, question_text, audience, sort_order)
VALUES (1, 'Strategy & Vision', 'Does your organization have a clearly defined AI strategy or vision?', 'all', 1);

INSERT INTO question_options (question_id, score, label, option_text) VALUES
(1, 1, 'A', 'No AI vision or strategy exists'),
(1, 2, 'B', 'There is minimal awareness of AI, but no formal strategy'),
(1, 3, 'C', 'An AI strategy is emerging but loosely tied to business goals'),
(1, 4, 'D', 'AI strategy is clearly aligned with departmental goals'),
(1, 5, 'E', 'AI vision is fully embedded in long-term strategic planning and KPIs');
-- ... repeat for all questions in src/config/questions.ts
```

---

## 3. Authentication Implementation

### Current State
- `src/pages/Login.tsx`: Hardcoded `admin/admin` check, routes based on username string match
- `src/pages/employee/Register.tsx`: Stores role in `sessionStorage`, no real user creation
- No route protection — all routes are public

### Target State
- Supabase Auth with email/password
- Role-based access via `user_roles` table
- Protected routes with auth context

### Implementation Steps

#### 3a. Create Auth Context

Create `src/contexts/AuthContext.tsx`:

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: "admin" | "employee" | null;
  organizationId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<"admin" | "employee" | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role, organization_id")
      .eq("user_id", userId)
      .single();
    if (data) {
      setRole(data.role);
      setOrganizationId(data.organization_id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) fetchRole(session.user.id);
        else { setRole(null); setOrganizationId(null); }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, organizationId, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
```

#### 3b. Create Protected Route Component

Create `src/components/ProtectedRoute.tsx`:

```typescript
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  children: React.ReactNode;
  requiredRole?: "admin" | "employee";
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, role, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
```

#### 3c. Update Login.tsx

Replace the mock auth with:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError("");
  try {
    await signIn(email, password);
    // AuthContext will update, ProtectedRoute will redirect
  } catch (err: any) {
    setError(err.message || "Invalid credentials");
  }
  setLoading(false);
};
```

#### 3d. Update App.tsx Routes

Wrap admin routes with `<ProtectedRoute requiredRole="admin">` and employee routes with `<ProtectedRoute requiredRole="employee">`.

#### 3e. Employee Onboarding Flow

When an admin generates login credentials for an employee:
1. Call `supabase.auth.admin.createUser()` via an edge function (not from client)
2. Insert into `employees` table with the new `user_id`
3. Insert into `user_roles` with `role = 'employee'` and `organization_id`

Create edge function `supabase/functions/create-employee/index.ts`:

```typescript
// Accepts: { email, password, fullName, jobTitle, phone, employeesAffected, roleLevel, organizationId }
// 1. supabase.auth.admin.createUser({ email, password })
// 2. INSERT INTO employees (user_id, organization_id, full_name, ...)
// 3. INSERT INTO user_roles (user_id, role, organization_id)
// Returns: { employee, credentials }
```

---

## 4. Database Integration — Replace Mock Data

### Files to Modify

#### `src/pages/admin/Dashboard.tsx`
**Current**: `const [orgs] = useState(mockOrganizations);`
**Replace with**:

```typescript
const { data: orgs, isLoading } = useQuery({
  queryKey: ["organizations"],
  queryFn: async () => {
    // Fetch organizations with computed counts
    const { data, error } = await supabase
      .from("organizations")
      .select(`
        *,
        employees:employees(count),
        registered:employees!inner(count),
        completed:employees!inner(count)
      `)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});
```

Also implement the "Create Organization" form to actually INSERT:

```typescript
const createOrg = useMutation({
  mutationFn: async ({ name, industry }: { name: string; industry: string }) => {
    const { error } = await supabase.from("organizations").insert({ name, industry });
    if (error) throw error;
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["organizations"] }),
});
```

#### `src/pages/admin/OrgDetail.tsx`
**Current**: Reads from `mockOrganizations`, `mockEmployees`, `mockCycles`
**Replace**: Three separate queries:

```typescript
// Organization
const { data: org } = useQuery({
  queryKey: ["organization", id],
  queryFn: () => supabase.from("organizations").select("*").eq("id", id).single(),
});

// Employees
const { data: employees } = useQuery({
  queryKey: ["employees", id],
  queryFn: () => supabase.from("employees").select("*").eq("organization_id", id).order("created_at"),
});

// Evaluation cycles
const { data: cycles } = useQuery({
  queryKey: ["cycles", id],
  queryFn: () => supabase.from("evaluation_cycles").select("*").eq("organization_id", id).order("version_number"),
});
```

**Evaluate Now**: Instead of `generateMockEmployeeAnswers()`, read real answers:

```typescript
const { data: answers } = await supabase
  .from("employee_answers")
  .select("employee_id, question_id, score")
  .in("employee_id", completedEmployeeIds);

// Transform into EmployeeAnswers[] format for scoring-service.ts
const employeeAnswers = completedEmployees.map(emp => ({
  name: emp.full_name,
  title: emp.job_title,
  employeesAffected: emp.employees_affected,
  answers: Object.fromEntries(
    answers.filter(a => a.employee_id === emp.id).map(a => [a.question_id, a.score])
  ),
}));

// Use existing scoring service (keep as-is — it's pure computation)
const { report, internal } = generateReport(org.name, org.industry, employeeAnswers, versionNumber);

// Persist report to database instead of sessionStorage
await supabase.from("reports").insert({ ... });
await supabase.from("dimension_scores").insert(report.dimensionScores.map(...));
await supabase.from("gap_analysis").insert(report.gapAnalysis.map(...));
// etc.
```

#### `src/pages/admin/Report.tsx`
**Current**: Loads from `sessionStorage` or falls back to `mockReport`
**Replace**: Load from database by report ID:

```typescript
const { data } = useQuery({
  queryKey: ["report", cycleId],
  queryFn: async () => {
    const { data: report } = await supabase
      .from("reports")
      .select(`
        *,
        dimension_scores(*),
        gap_analysis(*),
        report_costing(*),
        respondent_results(*),
        syllabus_modules(*)
      `)
      .eq("cycle_id", cycleId)
      .single();
    return report;
  },
});
```

#### `src/pages/employee/Questionnaire.tsx`
**Current**: Saves answers to `localStorage`
**Replace**: Upsert answers to `employee_answers` table:

```typescript
const saveAnswer = async (questionId: number, score: number) => {
  await supabase.from("employee_answers").upsert({
    employee_id: currentEmployee.id,
    question_id: questionId,
    score,
  }, { onConflict: "employee_id,question_id" });
};

// On submit: update employee status
await supabase
  .from("employees")
  .update({ status: "completed", questions_completed: totalQuestions })
  .eq("id", currentEmployee.id);
```

#### `src/pages/employee/Register.tsx`
**Current**: Stores role in `sessionStorage`
**Replace**: The employee record already exists (created by admin). This page becomes a profile completion step:

```typescript
// Fetch the employee record linked to the logged-in user
const { data: employee } = useQuery({
  queryKey: ["my-employee"],
  queryFn: () => supabase.from("employees").select("*").eq("user_id", user.id).single(),
});

// On submit: update the employee's profile
await supabase.from("employees").update({
  full_name: formData.fullName,
  job_title: formData.jobTitle,
  phone: formData.phone,
  employees_affected: formData.employeesAffected,
  role_level: formData.roleLevel,
}).eq("id", employee.id);
```

#### `src/pages/SharedReport.tsx`
**Current**: Uses `mockReport`
**Replace**: Load by shareable token from URL params:

```typescript
const { token } = useParams();
const { data: report } = useQuery({
  queryKey: ["shared-report", token],
  queryFn: async () => {
    const { data } = await supabase
      .from("reports")
      .select("*, dimension_scores(*), gap_analysis(*)")
      .eq("shareable_token", token)
      .single();
    return data;
  },
});
```

#### `src/pages/admin/Questions.tsx`
**Current**: Uses `QUESTIONS` from `config/questions.ts` in local state
**Replace**: CRUD operations on `questions` + `question_options` tables:

```typescript
const { data: questions } = useQuery({
  queryKey: ["questions"],
  queryFn: () => supabase
    .from("questions")
    .select("*, question_options(*)")
    .order("sort_order"),
});

// Add question
const addQuestion = useMutation({
  mutationFn: async (q: NewQuestion) => {
    const { data } = await supabase.from("questions").insert({...}).select().single();
    await supabase.from("question_options").insert(q.options.map(o => ({ question_id: data.id, ...o })));
  },
});

// Update, delete, reorder similarly
```

#### `src/config/questions.ts`
**Current**: Hardcoded `QUESTIONS` and `DIMENSIONS` arrays
**After migration**: Keep `DIMENSIONS` as a constant (it's used for scoring). Remove `QUESTIONS` — they come from the database. Or keep as a fallback/seed reference.

```typescript
// Keep this — it's used by scoring-service.ts and benchmarks.ts
export const DIMENSIONS = [
  "Strategy & Vision",
  "Leadership & Culture",
  "Current AI Usage",
  "Skills & Talent",
  "Data & Infrastructure",
  "Governance & Ethics",
  "Process & Integration",
  "Innovation & Scaling",
];

// QUESTIONS array becomes the seed data source only
// Runtime questions come from the database
```

#### `src/lib/scoring-service.ts`
**Keep as-is**. This file contains pure computation logic with no mock data dependencies. It accepts `EmployeeAnswers[]` and returns `ReportData` + `InternalReportData`. The only change: the caller passes real answers from the database instead of `generateMockEmployeeAnswers()`.

**Delete `generateMockEmployeeAnswers()`** — it's only used for demo purposes.

#### `src/lib/mock-data.ts`
**Delete entirely** after migration. Everything it exports will come from the database.

#### `src/lib/benchmarks.ts`
**Keep as-is** or migrate to a `benchmarks` table if benchmarks need to be admin-editable. Currently static data is fine.

---

## 5. AI/LLM Integration — Replace Mock AI

### Architecture

All AI calls go through Supabase Edge Functions that call the Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`). The `LOVABLE_API_KEY` is auto-provisioned.

### Edge Functions to Create

#### 5a. `supabase/functions/ai-executive-summary/index.ts`

**Replaces**: `generateExecutiveSummary()` in `ai-mock.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { report } = await req.json();
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You are an AI maturity assessment expert. Generate a professional executive summary for an organization's AI readiness report. Include:
1. Organization context (name, industry, respondent count)
2. Overall maturity score and stage classification
3. Strongest and weakest dimensions with specific commentary
4. Top gap from gap analysis with recommended action
5. Industry-contextual strategic observation
6. Three specific recommended immediate actions

Write in a professional consulting tone. Use specific numbers from the data. Format as flowing paragraphs, not bullet points.`,
        },
        {
          role: "user",
          content: `Generate an executive summary for this AI maturity assessment:
Organization: ${report.orgName}
Industry: ${report.industry}
Version: ${report.versionLabel}
Respondents: ${report.respondentCount}
Overall Score: ${report.overallScore}/5.0
Weighted Score: ${report.overallWeighted}/5.0
Maturity Stage: ${report.maturityStage}

Dimension Scores:
${report.dimensionScores.map((d: any) => `- ${d.dimension}: avg=${d.avg}, weighted=${d.weighted}`).join("\n")}

Gap Analysis:
${report.gapAnalysis.map((g: any) => `- ${g.dimension}: current=${g.current}, target=${g.target}, gap=${g.gap}, priority=${g.priority}`).join("\n")}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: corsHeaders });
    if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: corsHeaders });
    return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: corsHeaders });
  }

  const data = await response.json();
  const summary = data.choices[0].message.content;

  return new Response(JSON.stringify({ summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

#### 5b. `supabase/functions/ai-chat/index.ts`

**Replaces**: `getAIChatResponse()` in `ai-mock.ts`
**Streaming implementation** — use the SSE pattern from the AI gateway docs:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { messages, report } = await req.json();
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  const systemPrompt = `You are an AI maturity assessment assistant for ${report.orgName} (${report.industry} sector).

Assessment Data:
- Overall Score: ${report.overallScore}/5.0 (${report.maturityStage} stage)
- ${report.respondentCount} respondents
- Dimension Scores: ${report.dimensionScores.map((d: any) => `${d.dimension}: ${d.weighted}`).join(", ")}
- Top Gaps: ${report.gapAnalysis.filter((g: any) => g.priority === "High").map((g: any) => `${g.dimension} (gap: ${g.gap})`).join(", ")}

Answer questions about this assessment concisely and actionably. Use **bold** for emphasis. Reference specific scores and dimensions.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    return new Response(JSON.stringify({ error: status === 429 ? "Rate limited" : status === 402 ? "Credits exhausted" : "AI error" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(response.body, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
});
```

#### 5c. `supabase/functions/ai-generate-question/index.ts`

**Replaces**: `generateAIQuestion()` in `ai-mock.ts`

Use tool calling / structured output:

```typescript
// System prompt: "Generate an AI maturity assessment question for the {dimension} dimension.
// Return exactly 5 answer options scored 1-5 from least mature to most mature."
// Use tool_choice to enforce structured JSON output matching the Question type.

const tools = [{
  type: "function",
  function: {
    name: "create_question",
    description: "Create an assessment question with 5 scored options",
    parameters: {
      type: "object",
      properties: {
        questionText: { type: "string" },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              score: { type: "integer", minimum: 1, maximum: 5 },
              label: { type: "string", enum: ["A", "B", "C", "D", "E"] },
              text: { type: "string" },
            },
            required: ["score", "label", "text"],
          },
          minItems: 5, maxItems: 5,
        },
      },
      required: ["questionText", "options"],
    },
  },
}];
```

#### 5d. `supabase/functions/ai-improve-question/index.ts`

**Replaces**: `improveQuestion()` in `ai-mock.ts`

```typescript
// System prompt: "Improve this AI maturity assessment question. Make it more specific,
// professionally worded, and ensure answer options form a clear progression from
// nascent (score 1) to transformative (score 5). Keep the same dimension and scoring structure."
// Input: existing question JSON
// Output: improved question JSON (same tool calling pattern as generate)
```

#### 5e. `supabase/functions/ai-dashboard-insights/index.ts`

**Replaces**: `generateDashboardInsights()` in `ai-mock.ts`

```typescript
// System prompt: "Generate 3 brief dashboard insights for an AI maturity platform admin.
// Base insights on the provided organization data. Be specific and actionable."
// Use tool calling to return { insights: string[] }
```

#### 5f. `supabase/functions/ai-narrative/index.ts`

**Replaces**: `generateEnhancedNarrative()` in `ai-mock.ts`

```typescript
// System prompt: "Generate a detailed narrative paragraph about an organization's
// performance in the {dimension} dimension of AI maturity. Score: {score}/5.0.
// Include industry context for {industry} and specific recommendations."
// Non-streaming, returns plain text.
```

### Frontend Changes for AI

#### `src/components/report/AIReportChat.tsx`

Replace the mock `send()` function with streaming:

```typescript
const send = async (text: string) => {
  if (!text.trim() || typing) return;
  const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
  setMessages(prev => [...prev, userMsg]);
  setInput("");
  setTyping(true);

  let assistantContent = "";
  const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

  try {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, report }),
      }
    );

    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Add assistant message placeholder
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantContent += content;
            setMessages(prev =>
              prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
            );
          }
        } catch { /* partial JSON, wait */ }
      }
    }
  } catch (err) {
    console.error(err);
    setMessages(prev => [...prev, {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "Sorry, I encountered an error. Please try again.",
    }]);
  }
  setTyping(false);
};
```

**Note**: Remove the `TypingMessage` component and `useTypewriter` hook usage — streaming replaces the typewriter simulation.

#### `src/components/report/AIExecutiveSummary.tsx`

Replace mock `generateExecutiveSummary()` with:

```typescript
const { data: summary, isLoading } = useQuery({
  queryKey: ["executive-summary", report.shareableToken],
  queryFn: async () => {
    // Check cache first (stored in reports.executive_summary)
    if (report.executiveSummary) return report.executiveSummary;

    const { data } = await supabase.functions.invoke("ai-executive-summary", {
      body: { report },
    });
    return data.summary;
  },
  staleTime: Infinity, // Cache permanently per report
});
```

#### `src/pages/admin/Questions.tsx`

Replace AI handlers:

```typescript
const handleAIGenerate = async () => {
  setAiGenerating(true);
  try {
    const { data } = await supabase.functions.invoke("ai-generate-question", {
      body: { dimension: aiGenDimension },
    });
    setAiPreview({ ...data.question, id: questions.length + 1 });
  } catch (err) {
    toast({ title: "AI generation failed", variant: "destructive" });
  }
  setAiGenerating(false);
};

const handleAIImprove = async (q: Question) => {
  setAiImproving(q.id);
  try {
    const { data } = await supabase.functions.invoke("ai-improve-question", {
      body: { question: q },
    });
    setEditDraft(data.question);
    setEditingId(q.id);
  } catch (err) {
    toast({ title: "AI improvement failed", variant: "destructive" });
  }
  setAiImproving(null);
};
```

#### `src/components/dashboard/AIInsightsBar.tsx`

Replace `generateDashboardInsights()` with:

```typescript
const { data: insights } = useQuery({
  queryKey: ["dashboard-insights", orgs.map(o => o.id).join(",")],
  queryFn: async () => {
    const { data } = await supabase.functions.invoke("ai-dashboard-insights", {
      body: { organizations: orgs },
    });
    return data.insights;
  },
  staleTime: 5 * 60 * 1000, // Cache for 5 minutes
});
```

### Files to Delete After Migration

- `src/lib/ai-mock.ts` — All functions replaced by edge functions
- `src/lib/mock-data.ts` — All data comes from database

### Files to Keep

- `src/lib/scoring-service.ts` — Pure computation, no changes needed (delete `generateMockEmployeeAnswers` only)
- `src/lib/benchmarks.ts` — Static benchmark data, keep as-is
- `src/lib/pdf-export.ts` — PDF generation, no changes needed
- `src/lib/utils.ts` — Utility functions, no changes needed

---

## 6. API Layer / Edge Functions

### Complete Edge Function List

| Function | Method | Purpose | Auth Required |
|----------|--------|---------|---------------|
| `ai-executive-summary` | POST | Generate executive summary | Yes (admin) |
| `ai-chat` | POST | Streaming chat about report | Yes (admin) |
| `ai-generate-question` | POST | Generate new question | Yes (admin) |
| `ai-improve-question` | POST | Improve existing question | Yes (admin) |
| `ai-dashboard-insights` | POST | Dashboard AI insights | Yes (admin) |
| `ai-narrative` | POST | Dimension narrative | Yes (admin) |
| `create-employee` | POST | Create employee + auth user | Yes (admin) |
| `evaluate` | POST | Run evaluation (compute scores, persist report) | Yes (admin) |

### `supabase/config.toml` additions

```toml
[functions.ai-executive-summary]
verify_jwt = false

[functions.ai-chat]
verify_jwt = false

[functions.ai-generate-question]
verify_jwt = false

[functions.ai-improve-question]
verify_jwt = false

[functions.ai-dashboard-insights]
verify_jwt = false

[functions.ai-narrative]
verify_jwt = false

[functions.create-employee]
verify_jwt = false

[functions.evaluate]
verify_jwt = false
```

**Note**: Set `verify_jwt = false` and validate auth in code using `getClaims()` as per Supabase best practices.

---

## 7. File-by-File Migration Checklist

### Delete
- [ ] `src/lib/mock-data.ts`
- [ ] `src/lib/ai-mock.ts` (after all edge functions are working)

### Modify Significantly
- [ ] `src/App.tsx` — Add AuthProvider, ProtectedRoute wrappers
- [ ] `src/pages/Login.tsx` — Real Supabase Auth
- [ ] `src/pages/admin/Dashboard.tsx` — Database queries for orgs
- [ ] `src/pages/admin/OrgDetail.tsx` — Database queries, real evaluation flow
- [ ] `src/pages/admin/Report.tsx` — Load report from database
- [ ] `src/pages/admin/Questions.tsx` — CRUD on questions table, real AI calls
- [ ] `src/pages/employee/Register.tsx` — Profile completion, not registration
- [ ] `src/pages/employee/Questionnaire.tsx` — Save answers to DB
- [ ] `src/pages/SharedReport.tsx` — Load by shareable token from DB
- [ ] `src/components/report/AIReportChat.tsx` — Streaming AI chat
- [ ] `src/components/report/AIExecutiveSummary.tsx` — Real AI summary
- [ ] `src/components/dashboard/AIInsightsBar.tsx` — Real AI insights
- [ ] `src/components/report/NarrativeAndSteps.tsx` — Real AI narratives

### Create
- [ ] `src/contexts/AuthContext.tsx`
- [ ] `src/components/ProtectedRoute.tsx`
- [ ] `src/integrations/supabase/client.ts` (auto-generated by Supabase)
- [ ] `supabase/functions/ai-executive-summary/index.ts`
- [ ] `supabase/functions/ai-chat/index.ts`
- [ ] `supabase/functions/ai-generate-question/index.ts`
- [ ] `supabase/functions/ai-improve-question/index.ts`
- [ ] `supabase/functions/ai-dashboard-insights/index.ts`
- [ ] `supabase/functions/ai-narrative/index.ts`
- [ ] `supabase/functions/create-employee/index.ts`
- [ ] `supabase/functions/evaluate/index.ts`
- [ ] `supabase/migrations/001_initial_schema.sql`
- [ ] `supabase/migrations/002_seed_questions.sql`

### Keep Unchanged
- [ ] `src/lib/scoring-service.ts` (remove `generateMockEmployeeAnswers` only)
- [ ] `src/lib/benchmarks.ts`
- [ ] `src/lib/pdf-export.ts`
- [ ] `src/lib/utils.ts`
- [ ] `src/config/questions.ts` (keep `DIMENSIONS`, optionally keep `QUESTIONS` as seed reference)
- [ ] All `src/components/ui/*` — shadcn components
- [ ] All `src/components/report/*` — except AI-related ones noted above
- [ ] `src/components/AdminLayout.tsx`
- [ ] `src/components/NavLink.tsx`
- [ ] `src/components/questionnaire/*`

---

## 8. Environment Variables & Secrets

### Auto-provisioned (by Supabase/Lovable Cloud)
| Variable | Where | Purpose |
|----------|-------|---------|
| `SUPABASE_URL` | Edge functions | Supabase project URL |
| `SUPABASE_ANON_KEY` | Edge functions | Anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge functions | Admin operations (create users) |
| `LOVABLE_API_KEY` | Edge functions | AI Gateway authentication |

### Frontend (in `.env` / Vite)
| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (for client) |

### No Manual Secrets Needed
The Lovable AI Gateway uses `LOVABLE_API_KEY` which is auto-provisioned. No OpenAI/Anthropic keys required.

---

## 9. Deployment & Infrastructure

### Supabase Setup
1. Enable Lovable Cloud (provisions Supabase automatically)
2. Run migrations to create schema
3. Seed questions from `src/config/questions.ts`
4. Deploy edge functions
5. Create initial admin user via Supabase dashboard or SQL:

```sql
-- After creating an admin user via Supabase Auth:
INSERT INTO user_roles (user_id, role)
VALUES ('<admin-user-uuid>', 'admin');
```

### Frontend Deployment
- Lovable handles this automatically via the Publish button
- Frontend changes require clicking "Update" in publish dialog
- Backend changes (edge functions, migrations) deploy immediately

---

## 10. Testing Strategy

### Unit Tests (keep existing vitest setup)
- `src/lib/scoring-service.ts` — Test scoring calculations with various inputs
- `src/lib/benchmarks.ts` — Test industry matching and percentile calculation

### Integration Tests
- Edge function tests using Deno test runner
- Test each AI function returns valid structured output
- Test auth flows (admin vs employee access)

### E2E Manual Testing Checklist
1. Admin login → dashboard shows real orgs from DB
2. Create organization → appears in dashboard
3. Generate employee credentials → employee can log in
4. Employee completes questionnaire → answers persist
5. Admin triggers evaluation → report generates with real scores
6. AI chat responds contextually about the report
7. Shared report link works for unauthenticated users
8. PDF export works with real data
9. Question editor CRUD persists changes
10. AI question generation returns valid questions

---

## Appendix: Type Mapping (TypeScript ↔ Database)

| TypeScript Type | Database Table | Notes |
|----------------|---------------|-------|
| `Organization` | `organizations` | Add computed `registeredCount`, `completedCount` via JOINs |
| `Employee` | `employees` | `roleLevel` → `role_level` (snake_case) |
| `EvaluationCycle` | `evaluation_cycles` | |
| `ReportData` | `reports` + `dimension_scores` + `gap_analysis` | Composite |
| `InternalReportData` | `respondent_results` + `report_costing` + `syllabus_modules` | Composite |
| `Respondent` | `respondent_results` | |
| `Question` | `questions` + `question_options` | |
| `DimensionScore` | `dimension_scores` | |
| `GapAnalysisItem` | `gap_analysis` | |
| `PhaseCosting` | `report_costing.phases` (JSONB) | |
| `SyllabusModule` | `syllabus_modules` | |

### Column Name Convention
TypeScript uses `camelCase`, database uses `snake_case`. Use Supabase client's automatic mapping or transform in queries.
