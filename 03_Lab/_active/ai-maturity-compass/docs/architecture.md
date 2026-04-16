# Architecture

## System Overview

The AI Maturity Assessment Platform is a single-page React application built with Vite. All business logic runs client-side with no backend dependencies.

## Data Flow

```
Login → Admin Dashboard → Org Detail → Evaluate Now → Report
                                          ↓
                               scoring-service.ts
                               (computes scores from
                                mock employee answers)
                                          ↓
                               sessionStorage (report data)
                                          ↓
                               Report Page (reads from
                               sessionStorage or mock-data)
```

### Employee Flow

```
Login (employee*) → Register (profile + role) → Questionnaire → Submission
                         ↓                           ↓
                   sessionStorage              localStorage
                   (role, email)               (answer progress)
```

## Routing

All routes are defined in `src/App.tsx` using React Router v6:

| Route | Component | Auth Level |
|-------|-----------|-----------|
| `/`, `/login` | `Login` | Public |
| `/admin/dashboard` | `Dashboard` | Admin |
| `/admin/org/:id` | `OrgDetail` | Admin |
| `/admin/report/:cycleId` | `Report` | Admin |
| `/admin/questions` | `Questions` | Admin |
| `/employee/register` | `Register` | Employee |
| `/employee/questionnaire` | `Questionnaire` | Employee |
| `/employee/waiting` | `Waiting` | Employee |
| `/report/share/:token` | `SharedReport` | Public |

> **Note:** There is no route guard or auth middleware. Authentication is mocked in `Login.tsx`.

## State Management

| Data | Storage | Scope |
|------|---------|-------|
| Current user role | Mock auth in `Login.tsx` | Navigation-based |
| Employee role/email | `sessionStorage` | Registration → Questionnaire |
| Questionnaire answers | `localStorage` | Persists across refreshes |
| Generated reports | `sessionStorage` | Admin session only |
| Organization data | In-memory (imported from `mock-data.ts`) | Static |

## Component Hierarchy

```
App
├── Login
├── AdminLayout (shared shell)
│   ├── Dashboard
│   │   └── AIInsightsBar
│   ├── OrgDetail
│   │   └── TrendChart
│   ├── Report
│   │   ├── AIExecutiveSummary
│   │   ├── ClientReport
│   │   │   ├── HeroHeader
│   │   │   ├── RadarCharts (Current + Comparison)
│   │   │   ├── DimensionScoreCards
│   │   │   ├── GapAnalysisTable
│   │   │   ├── IndustryBenchmark
│   │   │   ├── NarrativeAndSteps
│   │   │   └── ReportFooter
│   │   ├── InternalSections
│   │   │   ├── RespondentBreakdownTable
│   │   │   ├── EngagementCostingCard
│   │   │   ├── ProfitabilityCard
│   │   │   └── ProposedSyllabusAccordion
│   │   └── AIReportChat
│   └── Questions (CRUD + AI generate/improve)
├── Employee Flow
│   ├── Register
│   ├── Questionnaire
│   │   ├── QuestionCard
│   │   └── QuestionnaireReview
│   └── Waiting
└── SharedReport
    └── ClientReport (white-label)
```

## Key Libraries

| Library | Purpose |
|---------|---------|
| `react-router-dom` | Client-side routing |
| `@tanstack/react-query` | Data fetching (prepared for future API use) |
| `recharts` | Radar charts, line charts, bar charts |
| `html2canvas` + `jspdf` | Client-side PDF generation |
| `sonner` + `@radix-ui/react-toast` | Toast notifications |
| `shadcn/ui` | Pre-built accessible UI components |
