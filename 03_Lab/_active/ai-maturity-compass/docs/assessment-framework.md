# Assessment Framework

## 8 Dimensions of AI Maturity

The assessment evaluates organizations across 8 research-based dimensions:

| # | Dimension | Focus Area |
|---|-----------|-----------|
| 1 | **Strategy & Vision** | AI strategy alignment with business goals |
| 2 | **Leadership & Culture** | Executive engagement and cultural attitude toward AI |
| 3 | **Current AI Usage** | Actual AI tool adoption and usage frequency |
| 4 | **Skills & Talent** | AI literacy, training programs, talent acquisition |
| 5 | **Data & Infrastructure** | Data accessibility, tech infrastructure, governance |
| 6 | **Governance & Ethics** | AI policies, ethical risk management, bias mitigation |
| 7 | **Process & Integration** | AI integration into workflows, project prioritization |
| 8 | **Innovation & Scaling** | Experimentation culture, knowledge sharing, scaling pilots |

## Question Structure

Each dimension has **3 questions** (24 total), defined in `src/config/questions.ts`.

### Question Format

Every question has exactly **5 answer options** (A–E) mapped to scores 1–5:

| Score | Maturity Level | Description |
|-------|---------------|-------------|
| 1 | None/Absent | No capability exists |
| 2 | Aware/Ad-hoc | Basic awareness, informal efforts |
| 3 | Emerging/Structured | Formal processes beginning |
| 4 | Established/Optimized | Systematic implementation |
| 5 | Transformative/Leading | Industry-leading capability |

### Audience Targeting

Some questions are restricted by role level:

| Audience | Shown To |
|----------|----------|
| `all` (default) | Everyone |
| `cxo` | C-Suite, Directors |
| `manager` | C-Suite, Directors, Managers |
| `individual` | Everyone |

Role-specific questions (marked `cxo`) appear in dimensions 1, 2, and are filtered in `Questionnaire.tsx` via `getFilteredQuestions()`.

## 5 Maturity Stages

Overall scores map to maturity stages (defined in `mock-data.ts`):

| Score Range | Stage | Description |
|-------------|-------|-------------|
| ≤ 1.8 | **Nascent** | No AI awareness or capability |
| 1.9 – 2.8 | **Developing** | Early awareness, no structured implementation |
| 2.9 – 3.8 | **Scaling** | Active development with growing consistency |
| 3.9 – 4.5 | **Optimized** | Well-established with systematic practices |
| 4.6 – 5.0 | **Transforming** | Industry-leading, fully embedded AI culture |

## Questionnaire UX

### Employee Flow
1. **Register** — Name, email, job title, phone, role level, employees affected
2. **Questionnaire** — One question at a time, auto-save to `localStorage`
3. **Review** — Summary of all answers with ability to edit
4. **Submit** — Clears local storage, shows confirmation

### Admin Preview
The Questions page (`/admin/questions`) includes an employee preview dialog that simulates the questionnaire experience.

### Progress Persistence
- Answers saved to `localStorage` keyed by employee email
- Current question index preserved across refreshes
- Auto-save indicator shown in the UI
