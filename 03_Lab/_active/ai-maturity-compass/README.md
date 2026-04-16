# AI Maturity Assessment Platform

A comprehensive enterprise AI readiness evaluation platform that measures organizational AI maturity across 8 strategic dimensions, generates detailed reports with gap analysis, industry benchmarking, and actionable transformation roadmaps.

## 🎯 Overview

The AI Maturity Assessment Platform enables consulting firms and enterprise organizations to:

- **Assess** organizational AI readiness through a structured 24-question framework
- **Score** responses across 8 dimensions with weighted averages based on employee influence scope
- **Benchmark** against curated industry averages (Financial Services, Healthcare, Technology, Retail, Energy)
- **Generate** client-facing and internal confidential reports with gap analysis
- **Track** longitudinal progress across multiple evaluation cycles
- **Export** professional PDF reports for stakeholder distribution

## 📸 Key Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/` or `/login` | Admin/employee authentication |
| Admin Dashboard | `/admin/dashboard` | Organization management overview |
| Org Detail | `/admin/org/:id` | Employee directory, evaluations, trends |
| Report | `/admin/report/:cycleId` | Full report with AI summary and chat |
| Question Editor | `/admin/questions` | CRUD + AI-powered question management |
| Employee Register | `/employee/register` | Profile + role selection |
| Questionnaire | `/employee/questionnaire` | Step-by-step assessment |
| Shared Report | `/report/share/:token` | White-label client-facing report |

## 🏗️ Architecture

```
src/
├── App.tsx                    # Root router
├── pages/
│   ├── Login.tsx              # Mock auth (admin/admin or *employee*)
│   ├── admin/
│   │   ├── Dashboard.tsx      # Organization cards grid
│   │   ├── OrgDetail.tsx      # Employee mgmt + evaluation trigger
│   │   ├── Report.tsx         # Tabbed report viewer (client/internal)
│   │   └── Questions.tsx      # Question CRUD with AI generate/improve
│   ├── employee/
│   │   ├── Register.tsx       # Profile form with role selection
│   │   ├── Questionnaire.tsx  # Step-by-step question flow
│   │   └── Waiting.tsx        # Post-submission holding page
│   └── SharedReport.tsx       # Public white-label report
├── components/
│   ├── AdminLayout.tsx        # Admin shell with nav
│   ├── report/                # Report visualization components
│   │   ├── ClientReport.tsx   # Composite client report
│   │   ├── HeroHeader.tsx     # Score + maturity stage hero
│   │   ├── RadarCharts.tsx    # Radar with industry overlay
│   │   ├── DimensionScoreCards.tsx
│   │   ├── GapAnalysisTable.tsx
│   │   ├── IndustryBenchmark.tsx  # Org vs industry comparison
│   │   ├── NarrativeAndSteps.tsx  # Per-dimension AI narratives
│   │   ├── TrendChart.tsx     # Longitudinal score tracking
│   │   ├── InternalSections.tsx   # Respondent breakdown, costing, syllabus
│   │   ├── AIExecutiveSummary.tsx  # Typewriter AI summary
│   │   ├── AIReportChat.tsx   # Interactive AI chat assistant
│   │   └── ReportFooter.tsx
│   ├── questionnaire/         # Question display components
│   └── ui/                    # shadcn/ui component library
├── lib/
│   ├── scoring-service.ts     # Score computation + archetype assignment
│   ├── ai-mock.ts             # AI response engine (summaries, chat, questions)
│   ├── benchmarks.ts          # Industry benchmark data + matching
│   ├── mock-data.ts           # Demo organizations, employees, reports
│   ├── pdf-export.ts          # HTML-to-PDF via html2canvas + jsPDF
│   └── utils.ts               # Tailwind merge utility
├── config/
│   └── questions.ts           # 24 assessment questions across 8 dimensions
└── types/
    └── index.ts               # TypeScript interfaces
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
npm run dev
```

### Demo Credentials

| Username | Password | Access |
|----------|----------|--------|
| `admin` | `admin` | Admin dashboard |
| `employee*` | any | Employee questionnaire |

## 📖 Documentation

Detailed documentation is available in the [`docs/`](./docs/) folder:

- [**Architecture**](./docs/architecture.md) — System design, data flow, and component relationships
- [**Assessment Framework**](./docs/assessment-framework.md) — 8 dimensions, 24 questions, scoring methodology
- [**Scoring & Analytics**](./docs/scoring-analytics.md) — Weighted scoring, archetypes, benchmarks, gap analysis
- [**AI Features**](./docs/ai-features.md) — Mock AI engine: summaries, chat, question generation
- [**Report System**](./docs/report-system.md) — Client/internal reports, PDF export, shared reports
- [**Design System**](./docs/design-system.md) — Theme tokens, typography, color palette

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 + shadcn/ui |
| Charts | Recharts |
| Routing | React Router v6 |
| State | React Query + sessionStorage |
| PDF | html2canvas + jsPDF |
| Fonts | Space Grotesk (display) + DM Sans (body) |

## 📝 Current State

This is a **standalone frontend application** with all data mocked client-side. There is no backend, database, or authentication system — all persistence uses `sessionStorage` and `localStorage`.

### What's Mocked

- Authentication (hardcoded credentials)
- Organization/employee data (`mock-data.ts`)
- AI responses (template-based engine in `ai-mock.ts`)
- Industry benchmarks (curated static data in `benchmarks.ts`)
- Report generation (computed from mock employee answers)

### Future Backend Integration Points

When a backend is added, these areas will need real implementations:

1. **Auth** — Replace mock login with JWT/session-based auth
2. **Database** — Organizations, employees, answers, evaluation cycles
3. **AI** — Replace `ai-mock.ts` with LLM API calls via edge functions
4. **File Storage** — Employee uploads, generated PDFs
5. **Real-time** — Live questionnaire progress tracking

## 📄 License

Private — All rights reserved.
