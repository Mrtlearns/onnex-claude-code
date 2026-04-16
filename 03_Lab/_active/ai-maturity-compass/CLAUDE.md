# Claude Workspace — Pro

> **Template:** claude-workspace-pro | Full framework: TELOS + Agents + Hooks + GSD
> **Owner:** Mr. T — Onnex AI Agency
> **Project:** ai-maturity-compass
> **Vertical:** Lab / experiment
> **Started:** 2026-04-09

---

## Who You Are Working With

Mr. T is an AI Development Engineer, Software Architect, SAP Expert (18 modules), Cybersecurity Expert, and Business Process Optimization Expert. He owns **Onnex**, an AI Agency that delivers AI-assisted Operating Systems to SME businesses across multiple verticals: NDT/aerospace, medical, MSPs, and PI law firms.

**Read `context/` for full details.**

---

## What This Project Is

AI maturity assessment tool — Help SMEs measure and improve their AI maturity across 8 dimensions. Drives client acquisition funnel and paid assessment product revenue for Onnex. Target: 7-day MVP.

---

## Your Role

You are a senior technical collaborator. You help plan, build, debug, and improve work in this workspace. You operate at an expert level — no hand-holding, no excessive explanation unless asked.

When given complex or multi-step tasks, default to using `/supervise` to orchestrate agents rather than doing everything yourself. Use agents for parallelizable work.

---

## Task Completion Format (MANDATORY)

After completing ANY task — always close with this exact format:

```
Done with task: <task name>

You asked for: <one-line restatement of the request>

| Step | Description | Tested | Status |
|------|-------------|--------|--------|
| 1    | ...         | 🟢/🟡/🔴 | 🟢/🟡/🔴 |

Legend: 🟢 Pass / Done  🟡 Partial / Warning  🔴 Fail / Blocked

Remaining To-Do or Human actions:
- ...
```

Tested = smoke test ran for this step. Status = step fully succeeded.
Issues → 🟡 or 🔴 with explanation in Remaining To-Do.
No human action needed → "None — fully automated."

---

## File Placement Rules

**Always put new files in the correct subfolder — never at the project root.**

| File type | Destination |
|-----------|-------------|
| Scripts, utilities, one-off tools (.py, .sh, .js) | `scripts/` |
| Deliverables, reports, exports (.pdf, .docx, .xlsx, .csv, .html) | `outputs/` |
| Planning docs, specs, PRDs, design notes (.md, .txt) | `plans/` |
| Architecture diagrams, API specs, domain models | `context/` |
| Session state, cost logs | `.claude/state/` |
| Test files | `tests/` |
| Application source code | `src/`, `api/`, `frontend/`, `app/` (project-specific) |

**Legitimate root-only files:** CLAUDE.md, README.md, LICENSE, docker-compose.yml, Dockerfile, .gitignore, .env, .env.example, package.json, Cargo.toml, pyproject.toml, tsconfig.json, Makefile, and other framework config files.

**Run `/cleanup` after any heavy session** to audit and move stray files.

---

## Adaptive Depth

Read `core/adaptive-depth.md` to select methodology based on task complexity:
- **DIRECT** — Single file, config change, quick fix — execute immediately
- **WORKFLOW** — Feature work — plan + TDD + review + verify
- **ALGORITHM** — Architecture / design — ISC + full methodology

---

## Key Constraints & Preferences

- Direct, no fluff. Expert-level communication.
- Code: Python preferred unless context demands otherwise
- n8n: use `.claude/skills/n8n/SKILL.md` before building any workflow
- Commits: descriptive, conventional commit format
- Never hardcode secrets — use env vars or credential stores

---

## Post-Build / Post-Fix Verification Protocol

After any build, fix, or deployment:

1. **File placement** — Confirm files exist at correct paths (not at project root)
2. **Build success** — Confirm no errors (tsc, vite, docker build, etc.)
3. **Deployment live** — Confirm running process is serving new code
4. **Live smoke test** — Hit affected endpoints directly (curl, browser)
5. **Playwright E2E** — Run/write tests covering changed behavior
6. **Fix all errors** — Do not hand off with known broken states

---

## Project-Specific Notes

> ⚠️ Backend target is **poc-backend** (Supabase at `poc-nursery.poc.playsap.us`), NOT Lovable Cloud.
> The original `claude.md` referenced Lovable-hosted Supabase and AI gateway — those are replaced by homelab infra.
> Use the `.env` in this project root for all connection strings.
> AI features: use Claude API (claude-sonnet-4-6 or claude-haiku-4-5) via Anthropic SDK, NOT the Lovable AI Gateway.

---

## Original Technical Reference (Imported from Lovable)

---

# CLAUDE.md — AI Maturity Assessment Platform

> **For Claude Code**: This file contains everything you need to understand, build, and deploy this project as a fully functional production application.

---

## 1. Project Overview

### What This Is
An **AI Maturity Assessment Platform** that helps consulting firms evaluate organizations' AI readiness across 8 dimensions. Employees complete questionnaires, scores are computed with weighted averages, and rich reports are generated with gap analysis, training syllabi, and engagement costing.

### Who Uses It
- **Admin (consultant)**: Creates organizations, manages employees, triggers evaluations, views reports with internal costing data, manages the question bank
- **Employee (client staff)**: Registers, completes a role-filtered questionnaire (24 questions, 5 options each scored 1-5)
- **Public**: Views shared reports via unique shareable tokens

### Current State: Frontend-Only Prototype
All data is mocked. Auth is fake. AI features use template-based string generators. **Nothing persists to a database.** The scoring engine (`src/lib/scoring-service.ts`) is production-ready and should be kept as-is.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Routing | React Router v6 |
| State/Data | TanStack React Query (installed but underused) |
| Charts | Recharts |
| PDF Export | html2canvas + jspdf |
| Testing | Vitest + Testing Library |
| Target Backend | Supabase on poc-backend (`poc-nursery.poc.playsap.us`) |
| AI | Claude API via Anthropic SDK (claude-sonnet-4-6) |

### Key NPM Packages Already Installed
```
react-router-dom, @tanstack/react-query, recharts, html2canvas, jspdf, 
lucide-react, sonner, date-fns, zod, react-hook-form, @hookform/resolvers
```

---

## 3. Project Structure

```
src/
├── App.tsx                          # Routes (no auth protection yet)
├── main.tsx                         # Entry point
├── index.css                        # Tailwind + design tokens (HSL)
├── types/index.ts                   # All TypeScript interfaces
├── config/questions.ts              # 24 hardcoded questions + DIMENSIONS array
├── lib/
│   ├── mock-data.ts                 # ❌ DELETE — Mock orgs, employees, reports
│   ├── ai-mock.ts                   # ❌ DELETE — Template-based AI fakes
│   ├── scoring-service.ts           # ✅ KEEP — Real scoring engine (pure computation)
│   ├── benchmarks.ts                # ✅ KEEP — Industry benchmark data
│   ├── pdf-export.ts                # ✅ KEEP — PDF generation
│   └── utils.ts                     # ✅ KEEP — cn() utility
├── pages/
│   ├── Login.tsx                    # Fake auth (admin/admin)
│   ├── SharedReport.tsx             # Public report view
│   ├── admin/
│   │   ├── Dashboard.tsx            # Org list + AI insights bar
│   │   ├── OrgDetail.tsx            # Employees + evaluation cycles
│   │   ├── Report.tsx               # Full report with client/internal tabs
│   │   └── Questions.tsx            # Question bank CRUD + AI generate/improve
│   └── employee/
│       ├── Register.tsx             # Role selection (sessionStorage)
│       ├── Questionnaire.tsx        # 24-question assessment (localStorage)
│       └── Waiting.tsx              # Post-submission holding page
├── components/
│   ├── AdminLayout.tsx
│   ├── NavLink.tsx
│   ├── dashboard/AIInsightsBar.tsx
│   ├── questionnaire/QuestionCard.tsx
│   ├── questionnaire/QuestionnaireReview.tsx
│   └── report/ (HeroHeader, AIExecutiveSummary, AIReportChat, DimensionScoreCards,
│               RadarCharts, GapAnalysisTable, IndustryBenchmark, TrendChart,
│               NarrativeAndSteps, InternalSections, ClientReport, ReportFooter)
└── docs/
    ├── IMPLEMENTATION_GUIDE.md      # ⭐ Full SQL + edge functions + frontend code
    ├── architecture.md
    ├── assessment-framework.md
    ├── scoring-analytics.md
    ├── ai-features.md
    ├── report-system.md
    └── design-system.md
```

---

## 4. Routes

| Path | Component | Auth | Role |
|------|-----------|------|------|
| `/` | Login | Public | — |
| `/admin/dashboard` | AdminDashboard | Admin | admin |
| `/admin/org/:id` | AdminOrgDetail | Admin | admin |
| `/admin/report/:cycleId` | AdminReport | Admin | admin |
| `/admin/questions` | AdminQuestions | Admin | admin |
| `/employee/register` | EmployeeRegister | Employee | employee |
| `/employee/questionnaire` | EmployeeQuestionnaire | Employee | employee |
| `/employee/waiting` | EmployeeWaiting | Employee | employee |
| `/report/share/:token` | SharedReport | Public | — |

---

## 5. Assessment Framework

8 Dimensions: Strategy & Vision, Leadership & Culture, Current AI Usage, Skills & Talent, Data & Infrastructure, Governance & Ethics, Process & Integration, Innovation & Scaling.

- 24 questions (3/dimension), 5 options scored 1-5, audience-filtered (cxo/manager/all)
- Weighted by `employeesAffected` per respondent
- Maturity stages: Nascent ≤1.8, Developing ≤2.8, Scaling ≤3.8, Optimized ≤4.5, Transforming >4.5

**Scoring engine (`src/lib/scoring-service.ts`) is production-ready — do not rewrite.**

---

## 6. Migration Checklist

### Phase 1: Database & Auth
- [ ] Run SQL schema migration against `poc_ai_maturity_compass` (see `docs/IMPLEMENTATION_GUIDE.md`)
- [ ] Seed 24 questions from `src/config/questions.ts`
- [ ] `AuthContext.tsx` + `ProtectedRoute.tsx` using Supabase Auth (poc-backend)
- [ ] Replace mock login with `supabase.auth.signInWithPassword()`
- [ ] Create admin user + `user_roles` entry

### Phase 2: Replace Mocks with DB
- [ ] Dashboard, OrgDetail, Report, Questionnaire, Register, SharedReport, Questions

### Phase 3: AI Edge Functions (Claude API)
- [ ] ai-executive-summary, ai-chat (SSE), ai-generate-question, ai-improve-question
- [ ] ai-dashboard-insights, ai-narrative, create-employee, evaluate

### Phase 4: Cleanup
- [ ] Delete mock-data.ts, ai-mock.ts; remove generateMockEmployeeAnswers(); remove localStorage/sessionStorage

---

## 7. Database Schema

Schema: `poc_ai_maturity_compass` on poc-backend.

Tables: organizations, employees, questions, question_options, employee_answers, evaluation_cycles, reports, dimension_scores, gap_analysis, respondent_results, report_costing, syllabus_modules, user_roles

**Critical:** Use `has_role(auth.uid(), 'admin')` security definer for all RLS. Never store roles on user table.

---

## 8. AI Edge Function Template (Claude API)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const { /* params */ } = await req.json();
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: "..." }],
  });
  return new Response(JSON.stringify({ result: message.content[0].text }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

---

## 9. Environment Variables

```env
DATABASE_URL=postgresql://supabase_admin:<PASSWORD>@supabase-db:5432/postgres
DB_SCHEMA=poc_ai_maturity_compass
SUPABASE_URL=https://poc-nursery.poc.playsap.us
SUPABASE_ANON_KEY=<from .env>
SUPABASE_SERVICE_ROLE_KEY=<from .env>
STORAGE_BUCKET=poc-ai-maturity-compass-docs
REDIS_URL=redis://10.10.110.34:6379
NEXT_PUBLIC_APP_URL=https://ai-maturity-compass.poc.playsap.us
PORT=3100
VITE_SUPABASE_URL=https://poc-nursery.poc.playsap.us
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
ANTHROPIC_API_KEY=<from credential store — never hardcode>
```

---

## 10. Key Implementation Notes

- **Scoring service is sacred** — `src/lib/scoring-service.ts` is production-ready. Feed it real DB answers.
- **Design system** — HSL tokens in `src/index.css`. Use semantic classes, never hardcoded colors.
- **PDF export** — `src/lib/pdf-export.ts` uses html2canvas + jspdf. No changes needed.
- **Benchmarks** — `src/lib/benchmarks.ts` static data, fuzzy industry matching. Keep as-is.
- **Full implementation details** — `docs/IMPLEMENTATION_GUIDE.md` has copy-paste SQL + edge functions + frontend code.
