// apps/api/src/routes/demo.ts
// Demo seed / clear routes — inserts realistic agency demo data
// POST /api/v1/demo/seed   — requires super_admin or admin
// DELETE /api/v1/demo/clear — requires super_admin or admin
import type { FastifyInstance } from 'fastify'
import { requireRole } from '../plugins/require-role.js'

const NC_BASE = 'http://nextcloud-app:80'
const NC_AUTH = 'Basic ' + Buffer.from('ncadmin:ncadmin_dev_2024').toString('base64')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function weeksFromNow(weeks: number): string {
  return new Date(Date.now() + weeks * 7 * 24 * 60 * 60 * 1000).toISOString()
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

function dateOnly(isoString: string): string {
  return isoString.slice(0, 10)
}

/** Insert a row into demo_seed_log tracking table */
async function logDemo(db: any, tableName: string, rowId: string): Promise<void> {
  await db.query(
    `INSERT INTO demo_seed_log (table_name, row_id) VALUES ($1, $2)`,
    [tableName, rowId],
  )
}

// ---------------------------------------------------------------------------
// Nextcloud WebDAV helpers
// ---------------------------------------------------------------------------

async function ncMkcol(path: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(`${NC_BASE}${path}`, {
      method: 'MKCOL',
      headers: { Authorization: NC_AUTH },
    })
    return { ok: res.ok || res.status === 405, status: res.status } // 405 = already exists
  } catch (err: any) {
    return { ok: false, status: 0 }
  }
}

async function ncPut(path: string, content: string): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const res = await fetch(`${NC_BASE}${path}`, {
      method: 'PUT',
      headers: {
        Authorization: NC_AUTH,
        'Content-Type': 'text/markdown; charset=utf-8',
      },
      body: content,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: body.slice(0, 200) }
    }
    return { ok: true, status: res.status }
  } catch (err: any) {
    return { ok: false, status: 0, error: String(err?.message ?? err) }
  }
}

// ---------------------------------------------------------------------------
// Document content
// ---------------------------------------------------------------------------

const DOCS = {
  brandSow: `# Statement of Work — Brand Identity Refresh
## TechNova Solutions × [Agency Name]

**Date:** ${dateOnly(new Date().toISOString())}
**Project Duration:** 10 weeks
**Project Lead:** Sarah Chen, CEO — TechNova Solutions

---

## 1. Project Overview
TechNova Solutions engages [Agency Name] to execute a comprehensive brand identity refresh. The current brand has evolved organically over five years and no longer reflects the company's market position as a leading SaaS infrastructure provider. This engagement will deliver a cohesive, modern visual identity system.

## 2. Scope of Work

### Phase 1 — Discovery & Strategy (Weeks 1–2)
- Brand audit of all existing assets
- Stakeholder interviews (CEO, Product, Sales)
- Competitive landscape analysis (5 direct competitors)
- Brand positioning workshop
- Deliverable: Brand Strategy Brief

### Phase 2 — Visual Identity Design (Weeks 3–6)
- Logo exploration: 3 distinct creative directions
- Presentation and feedback session
- Refinement of selected direction (2 revision rounds)
- Color palette, typography system, iconography style
- Deliverables: Logo suite (primary, secondary, favicon), brand colour & type guide

### Phase 3 — Brand Guidelines & Delivery (Weeks 7–10)
- Full brand guidelines document (PDF + Figma)
- Asset export package (SVG, PNG, various sizes)
- Usage examples: email signature, presentation template, letterhead
- Deliverable: Brand Guidelines v1.0

## 3. Investment
Total fixed fee: **$25,000 USD**
- Phase 1: $5,000 (due on kick-off)
- Phase 2: $12,000 (due on direction approval)
- Phase 3: $8,000 (due on final delivery)

## 4. Assumptions
- Client feedback provided within 5 business days of each deliverable
- Up to 2 rounds of revisions per phase included
- Additional revisions billed at $150/hour

## 5. Acceptance
By proceeding with the first payment, both parties agree to the terms of this Statement of Work.
`,

  saasBrief: `# Project Brief — SaaS Platform Redesign
## TechNova Solutions

**Date:** ${dateOnly(new Date().toISOString())}
**Budget:** $85,000
**Timeline:** 16 weeks

---

## Background
TechNova's web platform was built in 2020 and has accumulated significant UX debt. User activation rates have declined 18% YoY and support tickets relating to navigation confusion have increased. A full UX and visual redesign is required.

## Objectives
1. Reduce time-to-value for new users by 30% through improved onboarding
2. Redesign the core dashboard for clarity and actionability
3. Establish a scalable design system for the engineering team
4. Improve accessibility to WCAG 2.1 AA compliance

## Key Screens in Scope
- Marketing landing page (handed off separately)
- Onboarding flow (5 steps)
- Main dashboard
- Project management module
- Settings and billing pages
- Mobile-responsive breakpoints for all screens

## Deliverables
- UX audit report
- Revised information architecture
- Full Figma prototype (desktop + mobile)
- Design system component library (Figma + exported tokens)
- Developer handoff documentation

## Success Metrics
- System Usability Scale (SUS) score ≥ 80
- Task completion rate for core flows ≥ 90% in usability testing
`,

  patientPortalReqs: `# Requirements Document — Patient Portal UI Overhaul
## Meridian Health Systems

**Version:** 1.2
**Date:** ${dateOnly(new Date().toISOString())}
**Prepared by:** [Agency Name] in collaboration with Dr. Lisa Park, CTO

---

## 1. Purpose
This document captures the functional and non-functional requirements for the redesign of Meridian's patient-facing portal, serving approximately 85,000 active patients.

## 2. Stakeholders
| Role | Name | Responsibility |
|------|------|----------------|
| CTO | Dr. Lisa Park | Technical sign-off |
| CMO | Dr. Robert Walsh | Clinical workflow approval |
| Patient Advocate Lead | Maria Santos | Usability testing coordinator |

## 3. Functional Requirements

### 3.1 Patient Dashboard
- FR-01: Display upcoming appointments within 30-day window
- FR-02: Show active prescriptions with refill status
- FR-03: Provide access to recent lab results (last 12 months)
- FR-04: Display outstanding balance and payment history

### 3.2 Appointment Booking
- FR-05: Allow patients to book, reschedule, and cancel appointments
- FR-06: Support provider search by specialty, location, and availability
- FR-07: Send automated confirmation and reminder notifications
- FR-08: Integrate with Epic EHR scheduling API

### 3.3 Secure Messaging
- FR-09: HIPAA-compliant messaging between patients and care teams
- FR-10: Support file attachments up to 10MB

## 4. Non-Functional Requirements
- NFR-01: WCAG 2.1 AA accessibility compliance
- NFR-02: Page load time < 2 seconds on 4G mobile
- NFR-03: HIPAA compliant data handling throughout
- NFR-04: Support for English and Spanish (i18n framework)

## 5. Out of Scope
- Backend API development (owned by Meridian engineering)
- EHR system integration (Meridian IT responsibility)
`,

  proposalTemplate: `# Proposal Template — [Agency Name]

**Proposal Date:** [DATE]
**Prepared for:** [CLIENT NAME]
**Prepared by:** [ACCOUNT LEAD]
**Valid Until:** [DATE + 30 days]

---

## Executive Summary
[2–3 sentences summarising the client's challenge and your proposed solution. Be specific and outcome-focused.]

## Understanding the Challenge
[Demonstrate that you understand the client's business context, the problem they are trying to solve, and why it matters now.]

## Proposed Solution
### Approach
[Describe your methodology — discovery, design, delivery. Be concrete about what you will do and why.]

### Key Deliverables
- [ ] Deliverable 1 — description and format
- [ ] Deliverable 2 — description and format
- [ ] Deliverable 3 — description and format

### Timeline
| Phase | Duration | Key Milestone |
|-------|----------|---------------|
| Discovery | 2 weeks | Strategy brief sign-off |
| Design | 4 weeks | Design review |
| Delivery | 2 weeks | Final handoff |

## Investment
| Item | Fee |
|------|-----|
| [Service 1] | $[amount] |
| [Service 2] | $[amount] |
| **Total** | **$[total]** |

Payment terms: 50% on project kick-off, 50% on final delivery.

## Why [Agency Name]
[2–3 bullet points on your differentiators — relevant experience, team, approach.]

## Next Steps
To proceed, please sign and return this proposal or reply with any questions. We aim to kick off within 5 business days of approval.

---
*[Agency Name] | [email] | [phone]*
`,

  onboardingChecklist: `# Client Onboarding Checklist — [Agency Name]

**Client:** [CLIENT NAME]
**Account Lead:** [LEAD NAME]
**Kick-off Date:** [DATE]

---

## Pre Kick-off (Internal — complete before first client meeting)
- [ ] Project created in project management tool with correct billing code
- [ ] Client folder created in Nextcloud with correct permissions
- [ ] Signed contract and SOW filed in client folder
- [ ] Invoice schedule set up in billing system
- [ ] Account lead and project team assigned
- [ ] NDA executed if required

## Kick-off Meeting Agenda
- [ ] Introductions — client team and agency team
- [ ] Project goals and success criteria confirmed
- [ ] Timeline and milestone dates agreed
- [ ] Communication cadence agreed (weekly check-in day/time)
- [ ] Preferred communication channel confirmed (Slack, email, Teams)
- [ ] Decision-making process clarified (who has final approval?)

## Client Access & Tools
- [ ] Client invited to shared project folder (Nextcloud)
- [ ] Client portal access granted and tested
- [ ] Brand asset and reference material received from client
- [ ] Feedback and approval process explained to client

## First Week Deliverables
- [ ] Project brief document shared with client for sign-off
- [ ] Discovery questionnaire sent to client
- [ ] First milestone deadline confirmed in writing

## Ongoing
- [ ] Weekly status updates scheduled
- [ ] Monthly invoice dates confirmed with client finance contact
- [ ] Escalation path documented (client PM → Account Lead → Director)

---
*Complete all items before marking onboarding as done.*
`,
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function demoRoutes(fastify: FastifyInstance) {
  const pool = (fastify as any).pool

  // ------------------------------------------------------------------
  // POST /api/v1/demo/seed
  // ------------------------------------------------------------------
  fastify.post('/api/v1/demo/seed', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['super_admin', 'admin']),
    ],
    handler: async (request: any, reply: any) => {
      const userId: string = request.user?.sub ?? 'system'
      const tenantId: string = request.user?.tenantId ?? request.user?.tenant_id ?? ''

      // Use a dedicated client for the entire seed operation to prevent
      // "Connection terminated unexpectedly" on long-running sequential inserts
      const client = await pool.connect()
      try {

      // Ensure tracking table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS demo_seed_log (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          table_name TEXT NOT NULL,
          row_id     UUID NOT NULL,
          created_at TIMESTAMPTZ DEFAULT now()
        )
      `)

      const counts = {
        clients: 0,
        contacts: 0,
        projects: 0,
        tasks: 0,
        deals: 0,
        invoices: 0,
        time_entries: 0,
        notifications: 0,
      }

      // ----------------------------------------------------------------
      // CLIENTS
      // ----------------------------------------------------------------
      const clientDefs = [
        { name: 'TechNova Solutions',    type: 'Direct', status: 'Active',   billing_address: '350 5th Ave, New York, NY 10118' },
        { name: 'BlueWave Marketing',    type: 'Agency', status: 'Active',   billing_address: '100 Market St, San Francisco, CA 94105' },
        { name: 'Meridian Health Systems', type: 'Direct', status: 'Active', billing_address: '225 Michigan Ave, Chicago, IL 60601' },
        { name: 'Apex Financial Group',  type: 'Direct', status: 'Active',   billing_address: '1 Federal St, Boston, MA 02110' },
        { name: 'SkyLine Retail Co.',    type: 'Agency', status: 'Prospect', billing_address: '400 Broadway, Denver, CO 80203' },
      ]

      const clientIds: Record<string, string> = {}
      for (const c of clientDefs) {
        try {
          const r = await client.query(
            `INSERT INTO clients (tenant_id, name, type, status, billing_address)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [tenantId, c.name, c.type, c.status, c.billing_address],
          )
          const id: string = r.rows[0].id
          clientIds[c.name] = id
          await logDemo(client, 'clients', id)
          counts.clients++
        } catch (err: any) {
          return reply.code(500).send({ error: `Failed inserting client "${c.name}": ${err.message}`, completed: counts })
        }
      }

      // ----------------------------------------------------------------
      // CONTACTS
      // ----------------------------------------------------------------
      const contactDefs = [
        { client: 'TechNova Solutions',     name: 'Sarah Chen',      email: 'sarah.chen@technova.io',          phone: '+1 212-555-0101', role: 'CEO' },
        { client: 'BlueWave Marketing',     name: 'Marcus Rivera',   email: 'marcus@bluewave.agency',           phone: '+1 415-555-0202', role: 'Account Director' },
        { client: 'Meridian Health Systems', name: 'Dr. Lisa Park',  email: 'lpark@meridianhealth.org',         phone: '+1 312-555-0303', role: 'CTO' },
        { client: 'Apex Financial Group',   name: 'James Whitmore',  email: 'j.whitmore@apexfg.com',            phone: '+1 617-555-0404', role: 'VP Technology' },
        { client: 'SkyLine Retail Co.',     name: 'Priya Nair',      email: 'priya.nair@skylineretail.com',     phone: '+1 720-555-0505', role: 'Head of Digital' },
      ]

      for (const ct of contactDefs) {
        const clientId = clientIds[ct.client]
        if (!clientId) continue
        try {
          const r = await client.query(
            `INSERT INTO contacts (tenant_id, client_id, name, email, phone, role)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [tenantId, clientId, ct.name, ct.email, ct.phone, ct.role],
          )
          await logDemo(client, 'contacts', r.rows[0].id)
          counts.contacts++
        } catch (err: any) {
          return reply.code(500).send({ error: `Failed inserting contact "${ct.name}": ${err.message}`, completed: counts })
        }
      }

      // ----------------------------------------------------------------
      // PROJECTS
      // ----------------------------------------------------------------
      // weeksFromNow(-N) = N weeks ago; weeksFromNow(N) = N weeks from now
      const projectDefs = [
        { client: 'TechNova Solutions',     name: 'Brand Identity Refresh',       status: 'Active',    budget: 25000,  start: weeksFromNow(-6),  end: weeksFromNow(4)  },
        { client: 'TechNova Solutions',     name: 'SaaS Platform Redesign',        status: 'Active',    budget: 85000,  start: weeksFromNow(-8),  end: weeksFromNow(8)  },
        { client: 'BlueWave Marketing',     name: 'Q2 Social Media Campaign',      status: 'Active',    budget: 18000,  start: weeksFromNow(-2),  end: weeksFromNow(6)  },
        { client: 'Meridian Health Systems', name: 'Patient Portal UI Overhaul',   status: 'Active',    budget: 120000, start: weeksFromNow(-10), end: weeksFromNow(6)  },
        { client: 'Meridian Health Systems', name: '2025 Annual Report Design',    status: 'Completed', budget: 12000,  start: weeksFromNow(-12), end: weeksFromNow(-2) },
        { client: 'Apex Financial Group',   name: 'Mobile Banking App V2',         status: 'Active',    budget: 95000,  start: weeksFromNow(-4),  end: weeksFromNow(12) },
        { client: 'Apex Financial Group',   name: 'Compliance Dashboard',          status: 'On Hold',   budget: 42000,  start: weeksFromNow(-6),  end: weeksFromNow(8)  },
        { client: 'SkyLine Retail Co.',     name: 'Holiday 2025 Campaign',         status: 'Active',    budget: 22000,  start: weeksFromNow(-1),  end: weeksFromNow(10) },
        { client: 'SkyLine Retail Co.',     name: 'Product Catalog Refresh',       status: 'Active',    budget: 15000,  start: weeksFromNow(-3),  end: weeksFromNow(5)  },
      ]

      const projectIds: Record<string, string> = {}
      for (const p of projectDefs) {
        const clientId = clientIds[p.client]
        if (!clientId) continue
        try {
          const r = await client.query(
            `INSERT INTO projects (tenant_id, client_id, name, status, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [tenantId, clientId, p.name, p.status, dateOnly(p.start), dateOnly(p.end)],
          )
          const id: string = r.rows[0].id
          projectIds[p.name] = id
          await logDemo(client, 'projects', id)
          counts.projects++
        } catch (err: any) {
          return reply.code(500).send({ error: `Failed inserting project "${p.name}": ${err.message}`, completed: counts })
        }
      }

      // ----------------------------------------------------------------
      // TASKS
      // ----------------------------------------------------------------
      type TaskDef = {
        title: string
        status: 'Backlog' | 'In Progress' | 'Review' | 'Done'
        due: string        // ISO date
        start: string      // ISO date — for Gantt
        end: string        // ISO date — for Gantt
        estimatedHours: number
        actualHours?: number  // only for Done tasks
        taskType: 'manual' | 'code' | 'content' | 'research' | 'business'
        depIndexes?: number[] // indices into this project's task array (0-based)
      }
      const tasksByProject: Record<string, TaskDef[]> = {
        'Brand Identity Refresh': [
          // Project: T-42 start, T+28 end
          { title: 'Discovery & brand audit',                status: 'Done',        start: daysAgo(42), end: daysAgo(35), due: daysAgo(35), estimatedHours: 20, actualHours: 22,  taskType: 'research' },
          { title: 'Competitive landscape analysis',         status: 'Done',        start: daysAgo(42), end: daysAgo(35), due: daysAgo(35), estimatedHours: 16, actualHours: 15,  taskType: 'research' },
          { title: 'Brand strategy brief',                   status: 'Done',        start: daysAgo(35), end: daysAgo(28), due: daysAgo(28), estimatedHours: 12, actualHours: 10,  taskType: 'content',  depIndexes: [0, 1] },
          { title: 'Moodboard presentation',                 status: 'Done',        start: daysAgo(28), end: daysAgo(21), due: daysAgo(21), estimatedHours: 8,  actualHours: 9,   taskType: 'content',  depIndexes: [2] },
          { title: 'Logo concept exploration (3 directions)',status: 'Review',      start: daysAgo(21), end: daysAgo(7),  due: daysAgo(7),  estimatedHours: 40,                   taskType: 'content',  depIndexes: [3] },
          { title: 'Finalize primary logo',                  status: 'In Progress', start: daysAgo(7),  end: weeksFromNow(1), due: weeksFromNow(1), estimatedHours: 24, taskType: 'content', depIndexes: [4] },
          { title: 'Color palette & typography system',      status: 'In Progress', start: daysAgo(7),  end: weeksFromNow(1), due: weeksFromNow(1), estimatedHours: 16, taskType: 'content', depIndexes: [4] },
          { title: 'Brand guidelines document',              status: 'Backlog',     start: weeksFromNow(1), end: weeksFromNow(3), due: weeksFromNow(3), estimatedHours: 32, taskType: 'content', depIndexes: [5, 6] },
          { title: 'Asset export package',                   status: 'Backlog',     start: weeksFromNow(3), end: weeksFromNow(4), due: weeksFromNow(4), estimatedHours: 8,  taskType: 'manual',  depIndexes: [7] },
        ],
        'SaaS Platform Redesign': [
          // Project: T-56 start, T+56 end
          { title: 'UX audit of current platform',           status: 'Done',        start: daysAgo(56), end: daysAgo(49), due: daysAgo(49), estimatedHours: 24, actualHours: 26,  taskType: 'research' },
          { title: 'User interview synthesis (12 sessions)', status: 'Done',        start: daysAgo(49), end: daysAgo(42), due: daysAgo(42), estimatedHours: 20, actualHours: 18,  taskType: 'research', depIndexes: [0] },
          { title: 'Information architecture redesign',      status: 'Done',        start: daysAgo(42), end: daysAgo(28), due: daysAgo(28), estimatedHours: 32, actualHours: 35,  taskType: 'content',  depIndexes: [1] },
          { title: 'Design system foundations',              status: 'Done',        start: daysAgo(28), end: daysAgo(14), due: daysAgo(14), estimatedHours: 40, actualHours: 38,  taskType: 'code',     depIndexes: [2] },
          { title: 'High-fidelity wireframes — Dashboard',   status: 'In Progress', start: daysAgo(14), end: weeksFromNow(2), due: weeksFromNow(2), estimatedHours: 48, taskType: 'content', depIndexes: [2, 3] },
          { title: 'High-fidelity wireframes — Onboarding',  status: 'In Progress', start: daysAgo(7),  end: weeksFromNow(3), due: weeksFromNow(3), estimatedHours: 40, taskType: 'content', depIndexes: [2, 3] },
          { title: 'Prototype — interactive dashboard',      status: 'Backlog',     start: weeksFromNow(2), end: weeksFromNow(4), due: weeksFromNow(4), estimatedHours: 32, taskType: 'code', depIndexes: [4] },
          { title: 'Prototype — onboarding flow',            status: 'Backlog',     start: weeksFromNow(3), end: weeksFromNow(5), due: weeksFromNow(5), estimatedHours: 28, taskType: 'code', depIndexes: [5] },
          { title: 'Design system component library',        status: 'Backlog',     start: weeksFromNow(4), end: weeksFromNow(6), due: weeksFromNow(6), estimatedHours: 60, taskType: 'code', depIndexes: [6, 7] },
          { title: 'WCAG 2.1 AA accessibility audit',        status: 'Backlog',     start: weeksFromNow(6), end: weeksFromNow(7), due: weeksFromNow(7), estimatedHours: 16, taskType: 'research', depIndexes: [8] },
          { title: 'Developer handoff documentation',        status: 'Backlog',     start: weeksFromNow(7), end: weeksFromNow(8), due: weeksFromNow(8), estimatedHours: 20, taskType: 'content', depIndexes: [8, 9] },
        ],
        'Q2 Social Media Campaign': [
          { title: 'Strategy brief sign-off',                status: 'Done',        start: daysAgo(14), end: daysAgo(10), due: daysAgo(10), estimatedHours: 8,  actualHours: 8,   taskType: 'content' },
          { title: 'Content calendar Q2',                    status: 'Review',      start: daysAgo(10), end: daysAgo(3),  due: daysAgo(3),  estimatedHours: 12,                   taskType: 'content',  depIndexes: [0] },
          { title: 'Creative asset pack — Instagram',        status: 'In Progress', start: daysAgo(3),  end: weeksFromNow(2), due: weeksFromNow(2), estimatedHours: 32, taskType: 'content', depIndexes: [1] },
          { title: 'Creative asset pack — LinkedIn',         status: 'Backlog',     start: weeksFromNow(2), end: weeksFromNow(4), due: weeksFromNow(4), estimatedHours: 24, taskType: 'content', depIndexes: [1] },
          { title: 'Creative asset pack — TikTok',           status: 'Backlog',     start: weeksFromNow(3), end: weeksFromNow(5), due: weeksFromNow(5), estimatedHours: 20, taskType: 'content', depIndexes: [2] },
          { title: 'Performance report — Month 1',           status: 'Backlog',     start: weeksFromNow(5), end: weeksFromNow(6), due: weeksFromNow(6), estimatedHours: 8,  taskType: 'research', depIndexes: [2, 3] },
        ],
        'Patient Portal UI Overhaul': [
          // Project: T-70 start, T+42 end
          { title: 'Stakeholder requirements workshop',      status: 'Done',        start: daysAgo(70), end: daysAgo(63), due: daysAgo(63), estimatedHours: 16, actualHours: 18,  taskType: 'research' },
          { title: 'Competitive analysis report',            status: 'Done',        start: daysAgo(63), end: daysAgo(56), due: daysAgo(56), estimatedHours: 20, actualHours: 20,  taskType: 'research', depIndexes: [0] },
          { title: 'Information architecture',               status: 'Done',        start: daysAgo(56), end: daysAgo(42), due: daysAgo(42), estimatedHours: 28, actualHours: 30,  taskType: 'content',  depIndexes: [0, 1] },
          { title: 'HIPAA compliance review',                status: 'Done',        start: daysAgo(49), end: daysAgo(42), due: daysAgo(42), estimatedHours: 12, actualHours: 12,  taskType: 'research' },
          { title: 'Prototype — patient dashboard',          status: 'Review',      start: daysAgo(42), end: daysAgo(7),  due: daysAgo(7),  estimatedHours: 56,                   taskType: 'content',  depIndexes: [2, 3] },
          { title: 'Prototype — appointment booking',        status: 'In Progress', start: daysAgo(14), end: weeksFromNow(2), due: weeksFromNow(2), estimatedHours: 48, taskType: 'content', depIndexes: [2] },
          { title: 'Prototype — secure messaging',           status: 'Backlog',     start: weeksFromNow(2), end: weeksFromNow(4), due: weeksFromNow(4), estimatedHours: 32, taskType: 'content', depIndexes: [4, 5] },
          { title: 'Accessibility audit (WCAG 2.1 AA)',      status: 'Backlog',     start: weeksFromNow(4), end: weeksFromNow(5), due: weeksFromNow(5), estimatedHours: 20, taskType: 'research', depIndexes: [6] },
          { title: 'Epic EHR integration design',            status: 'Backlog',     start: weeksFromNow(3), end: weeksFromNow(5), due: weeksFromNow(5), estimatedHours: 24, taskType: 'business', depIndexes: [5] },
          { title: 'Usability testing (10 participants)',    status: 'Backlog',     start: weeksFromNow(5), end: weeksFromNow(6), due: weeksFromNow(6), estimatedHours: 32, taskType: 'research', depIndexes: [6, 7, 8] },
        ],
        '2025 Annual Report Design': [
          { title: 'Content collection from client',         status: 'Done',        start: daysAgo(84), end: daysAgo(77), due: daysAgo(77), estimatedHours: 8,  actualHours: 10, taskType: 'manual' },
          { title: 'Layout and design — v1',                 status: 'Done',        start: daysAgo(77), end: daysAgo(49), due: daysAgo(49), estimatedHours: 40, actualHours: 44, taskType: 'content', depIndexes: [0] },
          { title: 'Client review round 1',                  status: 'Done',        start: daysAgo(49), end: daysAgo(42), due: daysAgo(42), estimatedHours: 4,  actualHours: 4,  taskType: 'manual',  depIndexes: [1] },
          { title: 'Revisions — v2',                         status: 'Done',        start: daysAgo(42), end: daysAgo(28), due: daysAgo(28), estimatedHours: 16, actualHours: 14, taskType: 'content', depIndexes: [2] },
          { title: 'Print-ready PDF export',                 status: 'Done',        start: daysAgo(28), end: daysAgo(21), due: daysAgo(21), estimatedHours: 4,  actualHours: 4,  taskType: 'manual',  depIndexes: [3] },
          { title: 'Client final sign-off',                  status: 'Done',        start: daysAgo(21), end: daysAgo(14), due: daysAgo(14), estimatedHours: 2,  actualHours: 2,  taskType: 'manual',  depIndexes: [4] },
        ],
        'Mobile Banking App V2': [
          // Project: T-28 start, T+84 end
          { title: 'Product requirements review',            status: 'Done',        start: daysAgo(28), end: daysAgo(21), due: daysAgo(21), estimatedHours: 16, actualHours: 14, taskType: 'research' },
          { title: 'User journey mapping',                   status: 'Done',        start: daysAgo(21), end: daysAgo(14), due: daysAgo(14), estimatedHours: 20, actualHours: 22, taskType: 'research', depIndexes: [0] },
          { title: 'Wireframes — core flows',                status: 'In Progress', start: daysAgo(14), end: weeksFromNow(2), due: weeksFromNow(2), estimatedHours: 40, taskType: 'content', depIndexes: [1] },
          { title: 'Wireframes — edge cases & error states', status: 'Backlog',     start: weeksFromNow(1), end: weeksFromNow(3), due: weeksFromNow(3), estimatedHours: 24, taskType: 'content', depIndexes: [2] },
          { title: 'Visual design — home screen',            status: 'In Progress', start: daysAgo(7),  end: weeksFromNow(4), due: weeksFromNow(4), estimatedHours: 32, taskType: 'content', depIndexes: [2] },
          { title: 'Visual design — transactions',           status: 'Backlog',     start: weeksFromNow(3), end: weeksFromNow(6), due: weeksFromNow(6), estimatedHours: 28, taskType: 'content', depIndexes: [3, 4] },
          { title: 'Visual design — profile & settings',     status: 'Backlog',     start: weeksFromNow(5), end: weeksFromNow(7), due: weeksFromNow(7), estimatedHours: 24, taskType: 'content', depIndexes: [5] },
          { title: 'Biometrics & security UX',               status: 'Backlog',     start: weeksFromNow(4), end: weeksFromNow(6), due: weeksFromNow(6), estimatedHours: 16, taskType: 'business', depIndexes: [4] },
          { title: 'Prototype — full app walkthrough',       status: 'Backlog',     start: weeksFromNow(7), end: weeksFromNow(9), due: weeksFromNow(9), estimatedHours: 40, taskType: 'code', depIndexes: [5, 6, 7] },
          { title: 'Developer handoff package',              status: 'Backlog',     start: weeksFromNow(9), end: weeksFromNow(10), due: weeksFromNow(10), estimatedHours: 20, taskType: 'content', depIndexes: [8] },
        ],
        'Compliance Dashboard': [
          { title: 'Requirements gathering',                 status: 'Done',        start: daysAgo(42), end: daysAgo(35), due: daysAgo(35), estimatedHours: 16, actualHours: 16, taskType: 'research' },
          { title: 'Data visualization strategy',            status: 'In Progress', start: daysAgo(14), end: weeksFromNow(2), due: weeksFromNow(2), estimatedHours: 20, taskType: 'research', depIndexes: [0] },
          { title: 'Dashboard wireframes',                   status: 'Backlog',     start: weeksFromNow(2), end: weeksFromNow(5), due: weeksFromNow(5), estimatedHours: 32, taskType: 'content', depIndexes: [1] },
          { title: 'Regulatory data mapping',                status: 'Backlog',     start: weeksFromNow(2), end: weeksFromNow(4), due: weeksFromNow(4), estimatedHours: 24, taskType: 'business', depIndexes: [0] },
          { title: 'Interactive prototype',                  status: 'Backlog',     start: weeksFromNow(5), end: weeksFromNow(7), due: weeksFromNow(7), estimatedHours: 28, taskType: 'code', depIndexes: [2, 3] },
        ],
        'Holiday 2025 Campaign': [
          { title: 'Campaign brief alignment',               status: 'Done',        start: daysAgo(7),  end: daysAgo(3),  due: daysAgo(3),  estimatedHours: 4,  actualHours: 4,  taskType: 'manual' },
          { title: 'Concept development (3 creative routes)',status: 'In Progress', start: daysAgo(3),  end: weeksFromNow(3), due: weeksFromNow(3), estimatedHours: 40, taskType: 'content', depIndexes: [0] },
          { title: 'Client concept presentation',            status: 'Backlog',     start: weeksFromNow(3), end: weeksFromNow(4), due: weeksFromNow(4), estimatedHours: 8,  taskType: 'manual',  depIndexes: [1] },
          { title: 'Social content production — batch 1',    status: 'Backlog',     start: weeksFromNow(4), end: weeksFromNow(6), due: weeksFromNow(6), estimatedHours: 48, taskType: 'content', depIndexes: [2] },
          { title: 'Social content production — batch 2',    status: 'Backlog',     start: weeksFromNow(6), end: weeksFromNow(8), due: weeksFromNow(8), estimatedHours: 40, taskType: 'content', depIndexes: [3] },
          { title: 'Email campaign design (3 templates)',     status: 'Backlog',     start: weeksFromNow(5), end: weeksFromNow(7), due: weeksFromNow(7), estimatedHours: 24, taskType: 'content', depIndexes: [2] },
          { title: 'Campaign performance tracking setup',    status: 'Backlog',     start: weeksFromNow(7), end: weeksFromNow(8), due: weeksFromNow(8), estimatedHours: 8,  taskType: 'business', depIndexes: [3, 5] },
        ],
        'Product Catalog Refresh': [
          { title: 'Photography brief',                      status: 'Done',        start: daysAgo(21), end: daysAgo(18), due: daysAgo(18), estimatedHours: 8,  actualHours: 6,  taskType: 'content' },
          { title: 'Shot list finalization',                 status: 'Done',        start: daysAgo(18), end: daysAgo(12), due: daysAgo(12), estimatedHours: 4,  actualHours: 4,  taskType: 'manual',  depIndexes: [0] },
          { title: 'Photo shoot coordination',               status: 'Done',        start: daysAgo(12), end: daysAgo(7),  due: daysAgo(7),  estimatedHours: 8,  actualHours: 10, taskType: 'manual',  depIndexes: [1] },
          { title: 'Photo editing batch 1 (120 images)',     status: 'Review',      start: daysAgo(7),  end: daysAgo(1),  due: daysAgo(1),  estimatedHours: 20,                  taskType: 'manual',  depIndexes: [2] },
          { title: 'Photo editing batch 2 (80 images)',      status: 'In Progress', start: daysAgo(2),  end: weeksFromNow(2), due: weeksFromNow(2), estimatedHours: 14, taskType: 'manual', depIndexes: [2] },
          { title: 'Website upload & metadata tagging',      status: 'Backlog',     start: weeksFromNow(2), end: weeksFromNow(3), due: weeksFromNow(3), estimatedHours: 12, taskType: 'business', depIndexes: [3, 4] },
          { title: 'QA review — all catalog pages',          status: 'Backlog',     start: weeksFromNow(3), end: weeksFromNow(4), due: weeksFromNow(4), estimatedHours: 8,  taskType: 'research', depIndexes: [5] },
          { title: 'Client sign-off & go live',              status: 'Backlog',     start: weeksFromNow(4), end: weeksFromNow(5), due: weeksFromNow(5), estimatedHours: 4,  taskType: 'manual',  depIndexes: [6] },
        ],
      }

      // Store all inserted task IDs per project for dependency wiring
      const taskIdsByProject: Record<string, string[]> = {}

      for (const [projectName, tasks] of Object.entries(tasksByProject)) {
        const projectId = projectIds[projectName]
        if (!projectId) continue
        taskIdsByProject[projectName] = []
        for (const t of tasks) {
          try {
            const r = await client.query(
              `INSERT INTO tasks (tenant_id, project_id, assignee_id, title, status, due_date, start_date, end_date, estimated_hours, actual_hours, task_type)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
              [
                tenantId, projectId, userId, t.title, t.status,
                dateOnly(t.due), dateOnly(t.start), dateOnly(t.end),
                t.estimatedHours, t.actualHours ?? null, t.taskType,
              ],
            )
            const taskId: string = r.rows[0].id
            taskIdsByProject[projectName].push(taskId)
            await logDemo(client, 'tasks', taskId)
            counts.tasks++
          } catch (err: any) {
            return reply.code(500).send({ error: `Failed inserting task "${t.title}": ${err.message}`, completed: counts })
          }
        }
      }

      // ----------------------------------------------------------------
      // TASK DEPENDENCIES
      // ----------------------------------------------------------------
      let depsInserted = 0
      for (const [projectName, tasks] of Object.entries(tasksByProject)) {
        const taskIds = taskIdsByProject[projectName]
        if (!taskIds) continue
        for (let i = 0; i < tasks.length; i++) {
          const t = tasks[i]
          if (!t.depIndexes || t.depIndexes.length === 0) continue
          for (const depIdx of t.depIndexes) {
            const blockedTaskId = taskIds[i]
            const blockingTaskId = taskIds[depIdx]
            if (!blockedTaskId || !blockingTaskId) continue
            try {
              const r = await client.query(
                `INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type)
                 VALUES ($1, $2, 'blocks')
                 ON CONFLICT (task_id, depends_on_task_id) DO NOTHING
                 RETURNING id`,
                [blockedTaskId, blockingTaskId],
              )
              if (r.rows[0]) {
                await logDemo(client, 'task_dependencies', r.rows[0].id)
                depsInserted++
              }
            } catch {
              // Non-fatal
            }
          }
        }
      }

      // ----------------------------------------------------------------
      // DEALS
      // ----------------------------------------------------------------
      const dealDefs = [
        { title: 'TechNova — Website Performance Audit',       client: 'TechNova Solutions',     stage: 'lead',        value: 8500,  probability: 20,  close: weeksFromNow(6) },
        { title: 'Apex — AI Chatbot Integration',              client: 'Apex Financial Group',   stage: 'qualified',   value: 45000, probability: 40,  close: weeksFromNow(8) },
        { title: 'Meridian — Mobile Patient App',              client: 'Meridian Health Systems', stage: 'proposal',   value: 95000, probability: 60,  close: weeksFromNow(10) },
        { title: 'BlueWave — Annual Brand Refresh',            client: 'BlueWave Marketing',     stage: 'negotiation', value: 28000, probability: 75,  close: weeksFromNow(3) },
        { title: 'SkyLine — E-commerce Platform Redesign',     client: 'SkyLine Retail Co.',     stage: 'won',         value: 55000, probability: 100, close: weeksFromNow(-2) },
        { title: 'Generic Startup — Pitch Deck Design',        client: 'BlueWave Marketing',     stage: 'lost',        value: 4500,  probability: 0,   close: weeksFromNow(-4) },
      ]

      for (const d of dealDefs) {
        const clientId = d.client ? clientIds[d.client] : null
        if (d.client && !clientId) continue
        try {
          const r = await client.query(
            `INSERT INTO deals (tenant_id, client_id, title, value, probability, status, stage, expected_close, owner_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [tenantId, clientId ?? null, d.title, d.value, d.probability, d.stage, d.stage, dateOnly(d.close), userId],
          )
          await logDemo(client, 'deals', r.rows[0].id)
          counts.deals++
        } catch (err: any) {
          return reply.code(500).send({ error: `Failed inserting deal "${d.title}": ${err.message}`, completed: counts })
        }
      }

      // ----------------------------------------------------------------
      // INVOICES + LINE ITEMS
      // ----------------------------------------------------------------
      type LineItemDef = { desc: string; qty: number; rate: number }
      const invoiceDefs: Array<{
        client: string
        status: string
        due: string
        paid_at?: string
        lineItems: LineItemDef[]
      }> = [
        {
          client: 'TechNova Solutions',
          status: 'paid',
          due: weeksFromNow(-6),
          paid_at: weeksFromNow(-5),
          lineItems: [
            { desc: 'Brand Identity — Discovery & Strategy', qty: 1, rate: 5000 },
            { desc: 'Brand Identity — Design & Delivery',    qty: 1, rate: 8000 },
            { desc: 'Brand Guidelines Document',             qty: 1, rate: 2000 },
          ],
        },
        {
          client: 'Meridian Health Systems',
          status: 'sent',
          due: weeksFromNow(-2),
          lineItems: [
            { desc: 'Patient Portal UI — Phase 1 Milestone', qty: 1, rate: 35000 },
          ],
        },
        {
          client: 'Apex Financial Group',
          status: 'sent',
          due: weeksFromNow(2),
          lineItems: [
            { desc: 'Compliance Dashboard — Design Sprint', qty: 40, rate: 250 },
            { desc: 'Prototype & User Testing',             qty: 1,  rate: 3500 },
          ],
        },
        {
          client: 'SkyLine Retail Co.',
          status: 'draft',
          due: weeksFromNow(4),
          lineItems: [
            { desc: 'Holiday Campaign — Strategy & Creative Direction', qty: 1,  rate: 4500 },
            { desc: 'Social Media Asset Production',                    qty: 20, rate: 150  },
          ],
        },
        {
          client: 'BlueWave Marketing',
          status: 'partially_paid',
          due: weeksFromNow(-1),
          lineItems: [
            { desc: 'Q2 Social Campaign — Month 1 Retainer', qty: 1, rate: 6000 },
            { desc: 'Q2 Social Campaign — Month 2 Retainer', qty: 1, rate: 6000 },
          ],
        },
      ]

      for (const inv of invoiceDefs) {
        const clientId = clientIds[inv.client]
        if (!clientId) continue
        try {
          // Map 'partially_paid' to 'partial' for the DB CHECK constraint
          const dbStatus = inv.status === 'partially_paid' ? 'partial' : inv.status
          const r = await client.query(
            `INSERT INTO invoices (tenant_id, client_id, status, due_date, paid_at, tax_pct)
             VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
            [tenantId, clientId, dbStatus, dateOnly(inv.due), inv.paid_at ? dateOnly(inv.paid_at) : null],
          )
          const invoiceId: string = r.rows[0].id
          await logDemo(client, 'invoices', invoiceId)
          counts.invoices++

          for (const li of inv.lineItems) {
            const liR = await client.query(
              `INSERT INTO invoice_line_items (invoice_id, description, qty, rate)
               VALUES ($1, $2, $3, $4) RETURNING id`,
              [invoiceId, li.desc, li.qty, li.rate],
            )
            await logDemo(client, 'invoice_line_items', liR.rows[0].id)
          }
        } catch (err: any) {
          return reply.code(500).send({ error: `Failed inserting invoice for "${inv.client}": ${err.message}`, completed: counts })
        }
      }

      // ----------------------------------------------------------------
      // TIME ENTRIES (20 entries over last 14 working days)
      // ----------------------------------------------------------------
      // Spread across projects, skip weekends
      const timeEntryDefs: Array<{ project: string; desc: string; daysAgoVal: number; minutes: number }> = [
        { project: 'Brand Identity Refresh',     desc: 'Logo concept sketching session',            daysAgoVal: 1,  minutes: 240 },
        { project: 'SaaS Platform Redesign',     desc: 'Dashboard wireframe iteration',             daysAgoVal: 1,  minutes: 180 },
        { project: 'Patient Portal UI Overhaul', desc: 'Prototype review — patient dashboard',      daysAgoVal: 2,  minutes: 120 },
        { project: 'Mobile Banking App V2',      desc: 'User journey mapping workshop prep',        daysAgoVal: 2,  minutes: 300 },
        { project: 'Brand Identity Refresh',     desc: 'Client feedback review and revision notes', daysAgoVal: 3,  minutes: 90  },
        { project: 'Q2 Social Media Campaign',   desc: 'Content calendar draft',                    daysAgoVal: 3,  minutes: 150 },
        { project: 'SaaS Platform Redesign',     desc: 'Onboarding flow wireframes',                daysAgoVal: 4,  minutes: 480 },
        { project: 'Compliance Dashboard',       desc: 'Data visualization research',               daysAgoVal: 4,  minutes: 120 },
        { project: 'Product Catalog Refresh',    desc: 'Photo editing batch 1 — 40 images',        daysAgoVal: 5,  minutes: 360 },
        { project: 'Holiday 2025 Campaign',      desc: 'Campaign brief review meeting',             daysAgoVal: 5,  minutes: 60  },
        { project: 'Patient Portal UI Overhaul', desc: 'Accessibility audit preparation',           daysAgoVal: 7,  minutes: 180 },
        { project: 'Mobile Banking App V2',      desc: 'Core flows wireframe — transfer screen',    daysAgoVal: 7,  minutes: 240 },
        { project: 'SaaS Platform Redesign',     desc: 'Design system tokens setup',               daysAgoVal: 8,  minutes: 300 },
        { project: 'Brand Identity Refresh',     desc: 'Moodboard refinement',                      daysAgoVal: 8,  minutes: 150 },
        { project: 'Q2 Social Media Campaign',   desc: 'Instagram asset production',               daysAgoVal: 9,  minutes: 420 },
        { project: 'Compliance Dashboard',       desc: 'Dashboard wireframe sketches',              daysAgoVal: 9,  minutes: 180 },
        { project: 'Product Catalog Refresh',    desc: 'Shot list finalization call',               daysAgoVal: 10, minutes: 60  },
        { project: 'Patient Portal UI Overhaul', desc: 'Appointment booking prototype',             daysAgoVal: 11, minutes: 360 },
        { project: 'Mobile Banking App V2',      desc: 'Home screen visual design — v1',           daysAgoVal: 13, minutes: 480 },
        { project: 'SaaS Platform Redesign',     desc: 'Component library — navigation module',    daysAgoVal: 14, minutes: 240 },
      ]

      // Helper: skip back extra days to avoid weekend dates
      function workdayDate(baseDaysAgo: number): string {
        const d = new Date(Date.now() - baseDaysAgo * 24 * 60 * 60 * 1000)
        // If Saturday (6) step back 1, if Sunday (0) step back 2
        const dow = d.getDay()
        if (dow === 6) d.setDate(d.getDate() - 1)
        else if (dow === 0) d.setDate(d.getDate() - 2)
        return d.toISOString().slice(0, 10)
      }

      for (const te of timeEntryDefs) {
        const projectId = projectIds[te.project]
        if (!projectId) continue
        try {
          const r = await client.query(
            `INSERT INTO time_entries (tenant_id, project_id, user_id, description, duration_minutes, date, billable)
             VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
            [tenantId, projectId, userId, te.desc, te.minutes, workdayDate(te.daysAgoVal)],
          )
          await logDemo(client, 'time_entries', r.rows[0].id)
          counts.time_entries++
        } catch (err: any) {
          return reply.code(500).send({ error: `Failed inserting time entry "${te.desc}": ${err.message}`, completed: counts })
        }
      }

      // ----------------------------------------------------------------
      // NOTIFICATIONS
      // ----------------------------------------------------------------
      const notificationDefs = [
        { type: 'task_assigned',      title: 'New task assigned',       body: 'You have been assigned: Logo concept exploration' },
        { type: 'invoice_overdue',    title: 'Invoice overdue',         body: 'Meridian Health Systems invoice #MED-001 is 14 days overdue ($35,000)' },
        { type: 'deal_won',           title: 'Deal marked as won',      body: 'SkyLine E-commerce Platform Redesign — $55,000 deal won' },
        { type: 'task_review',        title: 'Task ready for review',   body: 'Photo editing batch 1 is ready for review' },
        { type: 'document_uploaded',  title: 'New document uploaded',   body: 'Brand Identity SOW uploaded to TechNova Solutions' },
      ]

      for (const n of notificationDefs) {
        try {
          // notifications.tenant_id is UUID type (unlike other tables that use TEXT)
          const r = await client.query(
            `INSERT INTO notifications (tenant_id, user_id, type, title, body)
             VALUES (gen_random_uuid(), gen_random_uuid(), $1, $2, $3) RETURNING id`,
            [n.type, n.title, n.body],
          )
          await logDemo(client, 'notifications', r.rows[0].id)
          counts.notifications++
        } catch (err: any) {
          return reply.code(500).send({ error: `Failed inserting notification "${n.title}": ${err.message}`, completed: counts })
        }
      }

      // ----------------------------------------------------------------
      // NEXTCLOUD DOCUMENTS (WebDAV)
      // ----------------------------------------------------------------
      let ncUploaded = 0
      const ncErrors: string[] = []

      // Create folders (failures are non-fatal — folder may already exist)
      const folders = [
        '/remote.php/dav/files/ncadmin/Agency',
        '/remote.php/dav/files/ncadmin/Agency/TechNova Solutions',
        '/remote.php/dav/files/ncadmin/Agency/Meridian Health Systems',
        '/remote.php/dav/files/ncadmin/Agency/Templates',
      ]
      for (const folder of folders) {
        await ncMkcol(folder) // non-fatal — ignore result
      }

      const uploads: Array<{ path: string; content: string }> = [
        { path: '/remote.php/dav/files/ncadmin/Agency/TechNova Solutions/Brand-Identity-SOW.md',              content: DOCS.brandSow },
        { path: '/remote.php/dav/files/ncadmin/Agency/TechNova Solutions/SaaS-Platform-Brief.md',             content: DOCS.saasBrief },
        { path: '/remote.php/dav/files/ncadmin/Agency/Meridian Health Systems/Patient-Portal-Requirements.md', content: DOCS.patientPortalReqs },
        { path: '/remote.php/dav/files/ncadmin/Agency/Templates/Proposal-Template.md',                        content: DOCS.proposalTemplate },
        { path: '/remote.php/dav/files/ncadmin/Agency/Templates/Client-Onboarding-Checklist.md',              content: DOCS.onboardingChecklist },
      ]

      for (const u of uploads) {
        const result = await ncPut(u.path, u.content)
        if (result.ok) {
          ncUploaded++
        } else {
          ncErrors.push(`PUT ${u.path} → HTTP ${result.status}${result.error ? ': ' + result.error : ''}`)
        }
      }

      return reply.code(200).send({
        seeded: { ...counts, task_dependencies: depsInserted },
        nextcloud: { uploaded: ncUploaded, errors: ncErrors },
      })
      } finally {
        client.release()
      }
    },
  })

  // ------------------------------------------------------------------
  // DELETE /api/v1/demo/clear
  // ------------------------------------------------------------------
  fastify.delete('/api/v1/demo/clear', {
    preHandler: [
      (fastify as any).authenticate,
      requireRole(['super_admin', 'admin']),
    ],
    handler: async (request: any, reply: any) => {
      // Check if tracking table exists — if not, nothing to clear
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'demo_seed_log'
        ) AS exists
      `)
      if (!tableCheck.rows[0]?.exists) {
        return reply.code(200).send({ cleared: { total_rows: 0 } })
      }

      // Read all logged rows, grouped by table
      const logRows = await pool.query(
        `SELECT table_name, row_id FROM demo_seed_log ORDER BY created_at DESC`,
      )

      if (logRows.rows.length === 0) {
        return reply.code(200).send({ cleared: { total_rows: 0 } })
      }

      // Group by table
      const byTable: Record<string, string[]> = {}
      for (const row of logRows.rows) {
        if (!byTable[row.table_name]) byTable[row.table_name] = []
        byTable[row.table_name].push(row.row_id)
      }

      // Delete in reverse-dependency order to avoid FK violations
      const deleteOrder = [
        'invoice_line_items',
        'invoices',
        'time_entries',
        'deals',
        'task_dependencies',
        'tasks',
        'notifications',
        'contacts',
        'projects',
        'clients',
      ]

      let totalRows = 0

      for (const tableName of deleteOrder) {
        const ids = byTable[tableName]
        if (!ids || ids.length === 0) continue
        try {
          const r = await pool.query(
            `DELETE FROM ${tableName} WHERE id = ANY($1::uuid[])`,
            [ids],
          )
          totalRows += r.rowCount ?? 0
        } catch {
          // Non-fatal — row may have been deleted already; continue clearing
        }
      }

      // Clear the log
      await pool.query(`DELETE FROM demo_seed_log`)

      return reply.code(200).send({ cleared: { total_rows: totalRows } })
    },
  })
}
