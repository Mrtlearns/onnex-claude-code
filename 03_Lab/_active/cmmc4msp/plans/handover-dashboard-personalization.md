# Handover: Personalized Dashboard + Team Progress View
**Project:** cmmc4msp — `D:\Code\Claude\03_Lab\_active\cmmc4msp`
**VM:** 10.10.110.41 | Docker Compose | All 8 services live
**Date:** 2026-04-19

---

## What Mr. T Wants Built

Three features, in priority order:

### 1. Personal "Where Am I" Panel (all roles)
When any team member opens a project dashboard they should see:
- A personal greeting with their name and role
- A plain-English explanation of the **current phase** — what it covers, why it matters, what completing it unlocks
- Their **top priority tasks** — the controls assigned to them in the current phase, sorted by SPRS point value (5pt first = biggest win), with a point badge so they understand impact
- A summary: "X open tasks · completing these adds +Y SPRS pts"

### 2. Owner Team Progress Panel (client_admin and above only)
When the engagement owner (client_admin, msp_admin, super_admin) opens the dashboard they should ALSO see:
- A grid of all team members and their task progress **within the current phase**
- Per-member card: name, role, current-phase tasks (X/Y complete), overall task completion bar
- This is ONLY shown to client_admin, msp_admin, super_admin — NOT client_user

### 3. Demo Data Already Exists
`scripts/seed_demo_client.py` already creates **Meridian Defense Systems LLC** (`slug: meridian-defense`, MSP: AirGap Cyber) with:
- 3 Authentik demo users: `admin@meridian-defense.demo` (client_admin), `engineer@meridian-defense.demo` (client_user), `auditor@meridian-defense.demo` (client_user)
- 407 controls with realistic status distribution (95 fully_implemented, 55 in_progress, 70 planned, 142 not addressed, 45 N/A)
- Artifacts, assessments, milestones, activity_log
- Passwords: DemoAdmin2026! / DemoUser2026!

No new demo data script is needed — use Meridian Defense for all testing.

---

## Current State — What's Already Built

### Dashboard (`nextjs/src/app/[orgSlug]/dashboard/page.tsx`)
The file is **already role-aware** with this structure:

```
if (role === 'client_user') → ClientUserView (simplified)
else → Full MSP/admin dashboard
```

**`ClientUserView`** (lines ~99–138) shows:
- "My Dashboard" heading
- `MyTasksWidget` (basic task list, no sorting by impact)
- "Submit Evidence" CTA
- "My Controls" link

**`MyTasksWidget`** (lines ~48–97) already:
- Calls `GET_MY_ASSIGNMENTS` with userId
- Shows up to 5 tasks, links to `/tasks`
- Shows due_date
- **Does NOT sort by dod_score_value, does NOT show SPRS impact, does NOT show phase context**

**Full admin view** (lines ~204–288) shows:
- `MspActionsPanel` (quick-nav buttons for msp_admin/super_admin)
- Summary cards row (Controls Complete, SPRS Score, Open Assignments, Program Status)
- 3-col grid: SPRS Gauge | Phase Progress | Activity Feed
- `AlsoSatisfiedPanel`
- Domain Heatmap

**No TeamProgressPanel exists anywhere.**

### Queries (`nextjs/src/graphql/queries.ts`)
Existing relevant queries:
- `GET_MY_ASSIGNMENTS($userId)` — gets assignments with `far_above_phase` but **NO `dod_score_value`**
- `GET_ORG_USERS($orgId)` — gets all users with `assignments_aggregate` count of open tasks
- `GET_PROGRAM_DASHBOARD($programId)` — full program data

`GET_ORG_USERS` is already there and useful for team progress — it returns `assignments_aggregate` counts.

### Constants (`nextjs/src/lib/constants.ts`)
`PHASE_CONFIG` exists but has NO descriptions:
```ts
export const PHASE_CONFIG = [
  { phase: '1', label: 'Boundary & Physical', controls: 17, points: 37 },
  { phase: '2', label: 'SSP & Identity', controls: 23, points: 32 },
  { phase: '3', label: 'Remote Access & IR', controls: 22, points: 34 },
  { phase: '4', label: 'Audit & Config', controls: 23, points: 37 },
  { phase: '5', label: 'Advanced & Personnel', controls: 25, points: 47 },
]
```

### Types (`nextjs/src/lib/types.ts`)
`Assignment` type exists. `ControlDefinition` has `dod_score_value?: number` but it's not fetched in `GET_MY_ASSIGNMENTS`.

---

## What Needs to Be Built

### Change 1 — `nextjs/src/lib/constants.ts`
Extend `PHASE_CONFIG` with `description` and `unlocks` fields:

```ts
export const PHASE_CONFIG = [
  {
    phase: '1', label: 'Boundary & Physical', controls: 17, points: 37,
    description: 'Establish your CUI boundary: physical access controls, network segmentation, and media protection. These 17 controls define who and what can reach your controlled environment.',
    unlocks: 'Phase 2 — SSP documentation and identity hardening',
  },
  {
    phase: '2', label: 'SSP & Identity', controls: 23, points: 32,
    description: 'Document your System Security Plan and lock down authentication. Control 3.12.4 (SSP) is the gate — SPRS is capped at -203 until it is marked complete.',
    unlocks: 'Phase 3 — Remote access and incident response',
  },
  {
    phase: '3', label: 'Remote Access & IR', controls: 22, points: 34,
    description: 'Secure all remote connections and establish incident response capability. Covers VPN/Zero Trust configurations, IR planning, and maintenance controls.',
    unlocks: 'Phase 4 — Audit trails and configuration management',
  },
  {
    phase: '4', label: 'Audit & Config', controls: 23, points: 37,
    description: 'Implement audit logging across all systems and lock down configurations. Every change must be tracked, every baseline enforced.',
    unlocks: 'Phase 5 — Risk management, personnel, and advanced security',
  },
  {
    phase: '5', label: 'Advanced & Personnel', controls: 25, points: 47,
    description: 'Complete risk assessments, supply chain controls, and personnel security. These 25 controls finalize your path to a 110 SPRS score and CMMC Level 2 readiness.',
    unlocks: 'CMMC Level 2 certification readiness',
  },
]
```

Update the TypeScript type implicitly — TypeScript will infer the new fields. No separate type file change needed.

---

### Change 2 — `nextjs/src/graphql/queries.ts`
Add `dod_score_value` to `GET_MY_ASSIGNMENTS` (line ~247) so priority sorting works. Replace the existing `GET_MY_ASSIGNMENTS`:

```ts
export const GET_MY_ASSIGNMENTS = gql`
  query GetMyAssignments($userId: uuid!) {
    assignments(
      where: { assigned_to: { _eq: $userId } }
      order_by: [
        { program_control: { control_definition: { dod_score_value: desc_nulls_last } } }
        { due_date: asc_nulls_last }
      ]
    ) {
      id
      status
      due_date
      instructions
      program_id
      program_control {
        id
        status
        control_definition {
          id
          nist_id
          cmmc_id
          family
          family_abbrev
          requirement_text
          far_above_phase
          dod_score_value
        }
      }
    }
  }
`
```

Note: This is a drop-in replacement — `tasks/page.tsx` already uses `GET_MY_ASSIGNMENTS` and the extra field won't break it.

---

### Change 3 — CREATE `nextjs/src/components/PersonalWelcomePanel.tsx`

New component. Uses `useSession()`, accepts `programId` and `currentPhase` as props.

```tsx
'use client'
import { useSession } from 'next-auth/react'
import { useQuery } from '@apollo/client'
import Link from 'next/link'
import { GET_MY_ASSIGNMENTS } from '@/graphql/queries'
import { PHASE_CONFIG } from '@/lib/constants'

interface PersonalWelcomePanelProps {
  programId: string
  currentPhase: string
  orgSlug: string
}

function pointBadge(val: number | undefined | null) {
  if (!val) return null
  if (val >= 5) return <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">HIGH 5pts</span>
  if (val >= 3) return <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">MED 3pts</span>
  return <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">LOW 1pt</span>
}

export function PersonalWelcomePanel({ programId, currentPhase, orgSlug }: PersonalWelcomePanelProps) {
  const { data: session } = useSession()
  const user = session?.user as any
  const userId = user?.id
  const role: string = user?.role ?? 'client_user'

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const validUserId = UUID_RE.test(userId ?? '') ? userId : null

  const { data, loading } = useQuery(GET_MY_ASSIGNMENTS, {
    variables: { userId: validUserId },
    skip: !validUserId,
  })

  const phaseInfo = PHASE_CONFIG.find((p) => p.phase === currentPhase) ?? PHASE_CONFIG[0]

  const allAssignments = data?.assignments ?? []
  // Open tasks in current phase only
  const phaseAssignments = allAssignments.filter(
    (a: any) =>
      a.status !== 'accepted' &&
      a.program_control?.control_definition?.far_above_phase === currentPhase
  )
  const openCount = phaseAssignments.length
  const potentialPts = phaseAssignments.reduce(
    (sum: number, a: any) => sum + (a.program_control?.control_definition?.dod_score_value ?? 0),
    0
  )
  const dueThisWeek = phaseAssignments.filter((a: any) => {
    if (!a.due_date) return false
    const diff = (new Date(a.due_date).getTime() - Date.now()) / 86400000
    return diff >= 0 && diff <= 7
  }).length

  const displayName =
    (user?.name as string | undefined) ??
    (user?.email as string | undefined)?.split('@')[0] ??
    'there'

  const roleLabel: Record<string, string> = {
    super_admin: 'Super Admin',
    msp_admin: 'MSP Admin',
    client_admin: 'Engagement Owner',
    client_user: 'Team Member',
  }

  if (loading) return <div className="h-28 bg-gray-100 rounded-xl animate-pulse" />

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold text-gray-900">Welcome back, {displayName}</p>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            {roleLabel[role] ?? role}
          </span>
        </div>
        {openCount > 0 && (
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-800">
              {openCount} open {openCount === 1 ? 'task' : 'tasks'} in Phase {currentPhase}
            </p>
            <p className="text-xs text-gray-500">
              {dueThisWeek > 0 ? `${dueThisWeek} due this week · ` : ''}
              completing these adds <span className="font-semibold text-green-700">+{potentialPts} SPRS pts</span>
            </p>
          </div>
        )}
      </div>

      {/* Phase context */}
      <div className="bg-white bg-opacity-70 rounded-lg p-3">
        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">
          Phase {currentPhase} of 5 — {phaseInfo.label}
        </p>
        <p className="text-sm text-gray-700">{phaseInfo.description}</p>
        <p className="text-xs text-gray-500 mt-1">
          Completing this phase unlocks: <span className="font-medium">{phaseInfo.unlocks}</span>
        </p>
      </div>

      {/* Priority tasks */}
      {phaseAssignments.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Your biggest wins this phase:</p>
          <div className="space-y-1.5">
            {phaseAssignments.slice(0, 3).map((a: any) => {
              const cd = a.program_control?.control_definition
              const isOverdue = a.due_date && new Date(a.due_date) < new Date()
              return (
                <Link
                  key={a.id}
                  href={`/${orgSlug}/controls/${a.program_control?.id}`}
                  className="flex items-center gap-3 p-2 bg-white bg-opacity-80 rounded-lg hover:bg-opacity-100 transition"
                >
                  {pointBadge(cd?.dod_score_value)}
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-gray-800">{cd?.nist_id ?? '—'}</span>
                    <span className="text-xs text-gray-500 ml-2 truncate">{cd?.requirement_text?.slice(0, 60)}…</span>
                  </div>
                  {a.due_date && (
                    <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                      {isOverdue ? 'Overdue' : new Date(a.due_date).toLocaleDateString()}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
          {phaseAssignments.length > 3 && (
            <Link href={`/${orgSlug}/tasks`} className="text-xs text-blue-600 hover:underline mt-2 block text-right">
              +{phaseAssignments.length - 3} more tasks →
            </Link>
          )}
        </div>
      )}

      {openCount === 0 && (
        <p className="text-sm text-green-700 font-medium">
          No open tasks in Phase {currentPhase} — all caught up! Check the Controls page for anything not yet assigned.
        </p>
      )}
    </div>
  )
}
```

---

### Change 4 — CREATE `nextjs/src/components/TeamProgressPanel.tsx`

New component for owners. Uses `GET_ORG_USERS` (already in queries.ts) plus a local assignment breakdown.

```tsx
'use client'
import { useQuery } from '@apollo/client'
import { GET_ORG_USERS, GET_MY_ASSIGNMENTS } from '@/graphql/queries'

interface TeamProgressPanelProps {
  orgId: string
  programId: string
  currentPhase: string
  userRole: string
}

const OWNER_ROLES = ['client_admin', 'msp_admin', 'super_admin']

// Single user row — fetches their assignments
function MemberCard({ userId, email, fullName, role, programId, currentPhase }: {
  userId: string
  email: string
  fullName?: string
  role: string
  programId: string
  currentPhase: string
}) {
  const { data } = useQuery(GET_MY_ASSIGNMENTS, {
    variables: { userId },
  })

  const all = data?.assignments ?? []
  const phaseAll = all.filter(
    (a: any) => a.program_control?.control_definition?.far_above_phase === currentPhase
  )
  const phaseComplete = phaseAll.filter((a: any) => a.status === 'accepted').length
  const phaseTotal = phaseAll.length
  const pct = phaseTotal > 0 ? Math.round((phaseComplete / phaseTotal) * 100) : 0

  const overallComplete = all.filter((a: any) => a.status === 'accepted').length
  const overallTotal = all.length

  const roleColors: Record<string, string> = {
    client_admin: 'bg-purple-100 text-purple-700',
    client_user: 'bg-gray-100 text-gray-600',
    msp_admin: 'bg-blue-100 text-blue-700',
  }

  const displayName = fullName ?? email.split('@')[0]

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-800">{displayName}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${roleColors[role] ?? 'bg-gray-100 text-gray-600'}`}>
            {role.replace('_', ' ')}
          </span>
        </div>
        <p className="text-xs text-gray-500 text-right">
          {overallComplete}/{overallTotal} total
        </p>
      </div>
      <p className="text-xs text-gray-500 mb-1.5">
        Phase {currentPhase}: {phaseComplete}/{phaseTotal} complete
      </p>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{pct}%</p>
    </div>
  )
}

export function TeamProgressPanel({ orgId, programId, currentPhase, userRole }: TeamProgressPanelProps) {
  if (!OWNER_ROLES.includes(userRole)) return null

  const { data, loading } = useQuery(GET_ORG_USERS, {
    variables: { orgId },
  })

  const users = data?.users ?? []

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Team Progress — Phase {currentPhase}</h2>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Team Progress</h2>
        <p className="text-sm text-gray-400">No team members assigned yet. Use the Team page to invite members.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">
        Team Progress — Phase {currentPhase}
        <span className="ml-2 text-xs text-gray-400 font-normal">{users.length} members</span>
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {users.map((u: any) => (
          <MemberCard
            key={u.id}
            userId={u.id}
            email={u.email}
            fullName={u.full_name}
            role={u.role}
            programId={programId}
            currentPhase={currentPhase}
          />
        ))}
      </div>
    </div>
  )
}
```

---

### Change 5 — UPDATE `nextjs/src/app/[orgSlug]/dashboard/page.tsx`

**Three surgical changes only — do not rewrite the file:**

**A) Add imports at the top** (after existing imports):
```tsx
import { PersonalWelcomePanel } from '@/components/PersonalWelcomePanel'
import { TeamProgressPanel } from '@/components/TeamProgressPanel'
```

**B) In `ClientUserView`** — replace the entire return JSX with a version that includes `PersonalWelcomePanel`:

The current `ClientUserView` signature is:
```tsx
function ClientUserView({ userId, orgSlug, program }: { userId: string; orgSlug: string; program: any })
```

Add `programId` to props so it can pass it to `PersonalWelcomePanel`:
```tsx
function ClientUserView({ userId, orgSlug, program, programId }: {
  userId: string
  orgSlug: string
  program: any
  programId: string
}) {
  const currentPhase = program?.current_phase ?? '1'
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-sm text-gray-500">
          {program?.name ?? 'CMMC Level 2'} — Phase {currentPhase} of 5
        </p>
      </div>

      {/* Personal context panel — NEW */}
      <PersonalWelcomePanel programId={programId} currentPhase={currentPhase} orgSlug={orgSlug} />

      <div className="grid grid-cols-2 gap-4">
        <MyTasksWidget userId={userId} orgSlug={orgSlug} />
        {/* Quick upload CTA (keep existing) */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          {/* ... keep existing upload CTA markup unchanged ... */}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">My Controls</h2>
        <Link href={`/${orgSlug}/controls`} className="text-sm text-blue-600 hover:underline">
          View controls assigned to me →
        </Link>
      </div>
    </div>
  )
}
```

Update the call site (line ~198) from:
```tsx
return <ClientUserView userId={user?.id} orgSlug={orgSlug} program={liveProgram} />
```
to:
```tsx
return <ClientUserView userId={user?.id} orgSlug={orgSlug} program={liveProgram} programId={programId ?? ''} />
```

**C) In the main admin/owner dashboard return**, add `PersonalWelcomePanel` at the top and `TeamProgressPanel` at the bottom:

After the `<div className="space-y-6">` opening tag, insert as the FIRST child (before the `<div className="flex items-start...">` heading div):
```tsx
{/* Personal welcome — shown to all roles on this view */}
{programId && (
  <PersonalWelcomePanel programId={programId} currentPhase={currentPhase} orgSlug={orgSlug} />
)}
```

After the `DomainHeatmap` block (end of current JSX), add:
```tsx
{/* Team progress — owners only */}
{programId && org?.id && (
  <TeamProgressPanel
    orgId={org.id}
    programId={programId}
    currentPhase={currentPhase}
    userRole={role}
  />
)}
```

---

## Files to Touch — Summary

| File | Action | Key Change |
|------|--------|-----------|
| `nextjs/src/lib/constants.ts` | MODIFY | Add `description` + `unlocks` to each PHASE_CONFIG entry |
| `nextjs/src/graphql/queries.ts` | MODIFY | Add `dod_score_value` + reorder `GET_MY_ASSIGNMENTS` |
| `nextjs/src/components/PersonalWelcomePanel.tsx` | CREATE | New component (full code above) |
| `nextjs/src/components/TeamProgressPanel.tsx` | CREATE | New component (full code above) |
| `nextjs/src/app/[orgSlug]/dashboard/page.tsx` | MODIFY | 3 surgical changes — add imports, update ClientUserView, wire panels |

**Do NOT touch:** `tasks/page.tsx`, `queries.ts` beyond `GET_MY_ASSIGNMENTS`, any backend files, any n8n workflows, any migration files.

---

## Demo / Test Data

### Meridian Defense (full demo org — already seeded)
- **Script:** `scripts/seed_demo_client.py` — run once on the VM if not already done
- **Slug:** `meridian-defense`
- **Users:**
  - `admin@meridian-defense.demo` / `DemoAdmin2026!` → client_admin
  - `engineer@meridian-defense.demo` / `DemoUser2026!` → client_user
  - `auditor@meridian-defense.demo` / `DemoUser2026!` → client_user
- **Data:** 407 controls seeded, 95 fully_implemented, artifacts with pass/partial/fail assessments, milestones, activity log

### Canopy Aerospace (existing test org)
- **Script:** `scripts/seed_canopy_controls.sql` (control statuses only — no users or assignments)
- **Org ID prefix:** `a602b4a5`
- **Program ID:** `ba8d74d0-cff7-46ea-a24b-68355cf2e991`
- **No users assigned** — TeamProgressPanel will show "no team members" for this org

**To run Meridian seed if not done:**
```bash
# SSH to VM or run via deploy script
python scripts/seed_demo_client.py
python scripts/fix_authentik_demo_users.py
```

---

## Verification Steps

After building, verify in this order:

1. **Build check:** `cd nextjs && npm run build` — must pass with 0 TypeScript errors
2. **Login as `engineer@meridian-defense.demo`** (client_user):
   - Dashboard shows `PersonalWelcomePanel` with phase context and priority tasks
   - Tasks are sorted: 5pt controls first, then 3pt, then 1pt
   - Phase description shown correctly for current phase
   - `TeamProgressPanel` is NOT visible
3. **Login as `admin@meridian-defense.demo`** (client_admin):
   - Dashboard shows `PersonalWelcomePanel` at top
   - Dashboard shows `TeamProgressPanel` at bottom with 3 member cards (Admin, Engineer, Auditor)
   - Each card shows phase progress bar
4. **Login as MSP/super_admin user:**
   - Dashboard shows both panels
5. **Check tasks page still works** — `GET_MY_ASSIGNMENTS` change must not break `tasks/page.tsx`

---

## Key Architectural Notes

- **`useSession()`** is available in any `'use client'` component — gives `session.user.id`, `session.user.role`, `session.user.email`
- **Hasura permissions** for `assignments` allow `client_user` to query their own assignments via `assigned_to` filter. The `GET_MY_ASSIGNMENTS` query filters by `$userId` which maps to the JWT sub claim.
- **`GET_ORG_USERS`** requires at least `client_admin` role (Hasura row-level permission filters by `org_id` from JWT). `TeamProgressPanel` is only rendered for those roles so this is safe.
- **`MemberCard`** calls `GET_MY_ASSIGNMENTS` per user. For orgs with many users (10+) consider lazy-loading, but for demo purposes (3 users) this is fine.
- The `PHASE_CONFIG` TypeScript type is inferred — adding `description`/`unlocks` fields doesn't require any type file changes.
- Do NOT add `required` validation to new props — use defaults (`?? ''`, `?? '1'`) to stay resilient against missing data.
