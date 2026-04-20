/**
 * evidence-automation.test.ts
 *
 * Static source-analysis tests for the evidence automation hub page
 * and related components added in this sprint.
 *
 * Tests validate:
 * - evidence-automation/page.tsx: card structure, API calls, download links
 * - AppSidebar.tsx: BoltIcon import + Quick Wins nav item
 * - controls/page.tsx: checkbox column + bulk-assign modal
 * - CopilotChat.tsx: Save as Evidence button + onArtifactCreated prop
 * - controls/[id]/page.tsx: onArtifactCreated refetch wired up
 */

import fs from 'fs'
import path from 'path'

// ─── File paths ──────────────────────────────────────────────────────────────

const BASE = path.join(__dirname, '../../src')

const EVIDENCE_AUTO_PAGE = path.join(
  BASE,
  'app/[orgSlug]/evidence-automation/page.tsx'
)
const SIDEBAR = path.join(BASE, 'components/AppSidebar.tsx')
const CONTROLS_PAGE = path.join(BASE, 'app/[orgSlug]/controls/page.tsx')
const COPILOT_CHAT = path.join(BASE, 'components/CopilotChat.tsx')
const CONTROL_DETAIL = path.join(BASE, 'app/[orgSlug]/controls/[id]/page.tsx')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// ─── TASK 1: evidence-automation page ────────────────────────────────────────

describe('evidence-automation/page.tsx', () => {
  let src: string
  beforeAll(() => { src = read(EVIDENCE_AUTO_PAGE) })

  it('exports a default React component', () => {
    expect(src).toMatch(/export default function/)
  })

  it('uses useSession for auth context', () => {
    expect(src).toContain('useSession')
  })

  it('queries Hasura for auto-satisfied artifact coverage', () => {
    // Must reference program_controls with source_type filter
    expect(src).toContain('source_type')
  })

  it('renders a heading "Evidence Automation"', () => {
    expect(src).toContain('Evidence Automation')
  })

  it('includes all four automation feature cards', () => {
    expect(src).toContain('Connect Integrations')
    expect(src).toContain('Request Evidence')
    expect(src).toContain('AI Interview')
    expect(src).toContain('Evidence Harvester')
  })

  it('includes LinkIcon for integrations card', () => {
    expect(src).toContain('LinkIcon')
  })

  it('includes SparklesIcon for interview card', () => {
    expect(src).toContain('SparklesIcon')
  })

  it('includes ArrowDownTrayIcon for harvester card', () => {
    expect(src).toContain('ArrowDownTrayIcon')
  })

  it('includes harvester Windows download link using NEXT_PUBLIC_API_URL', () => {
    expect(src).toContain('NEXT_PUBLIC_API_URL')
    expect(src).toContain('harvest_windows.ps1')
  })

  it('includes harvester Linux download link', () => {
    expect(src).toContain('harvest_linux.sh')
  })

  it('has ZIP upload input accepting .zip files', () => {
    expect(src).toContain('accept=".zip"')
  })

  it('calls bulk-upload-zip endpoint on file select', () => {
    expect(src).toContain('bulk-upload-zip')
  })

  it('shows artifacts_created count in success toast', () => {
    expect(src).toContain('artifacts_created')
  })

  it('queries control_chat_messages for interview card', () => {
    expect(src).toContain('control_chat_messages')
  })

  it('links to integrations page for first card CTA', () => {
    expect(src).toContain('integrations')
  })

  it('links to controls page for evidence request CTA', () => {
    expect(src).toContain('/controls')
  })
})

// ─── TASK 2: AppSidebar ───────────────────────────────────────────────────────

describe('AppSidebar.tsx — Quick Wins nav item', () => {
  let src: string
  beforeAll(() => { src = read(SIDEBAR) })

  it('imports BoltIcon from heroicons', () => {
    expect(src).toContain('BoltIcon')
  })

  it('has evidence-automation route in nav', () => {
    expect(src).toContain('evidence-automation')
  })

  it('labels the nav item "Quick Wins"', () => {
    expect(src).toContain('Quick Wins')
  })

  it('Quick Wins appears before Artifacts in the extended array', () => {
    const qwIdx = src.indexOf('evidence-automation')
    const artIdx = src.indexOf("label: 'Artifacts'")
    expect(qwIdx).toBeGreaterThan(0)
    expect(artIdx).toBeGreaterThan(0)
    expect(qwIdx).toBeLessThan(artIdx)
  })

  it('is not visible to client_user role (extended array guard)', () => {
    // The extended array is only added when role !== 'client_user'
    // Verify the guard still exists
    expect(src).toContain("role === 'client_user'")
  })
})

// ─── TASK 3: controls/page.tsx bulk assign ────────────────────────────────────

describe('controls/page.tsx — bulk Request Evidence', () => {
  let src: string
  beforeAll(() => { src = read(CONTROLS_PAGE) })

  it('has checkbox inputs for row selection', () => {
    expect(src).toContain('type="checkbox"')
  })

  it('tracks selectedIds in state', () => {
    expect(src).toContain('selectedIds')
  })

  it('shows floating action bar when rows are selected', () => {
    expect(src).toContain('selectedIds')
    // Action bar rendered conditionally
    expect(src).toMatch(/selectedIds\S*\.size\s*>\s*0|selectedIds\S*\.length\s*>\s*0/)
  })

  it('has a "Request Evidence" button', () => {
    expect(src).toContain('Request Evidence')
  })

  it('opens a modal with assignee dropdown', () => {
    expect(src).toContain('Assign to')
  })

  it('uses GET_ORG_USERS query for the assignee dropdown', () => {
    expect(src).toContain('GET_ORG_USERS')
  })

  it('has due date input', () => {
    expect(src).toContain('Due date')
  })

  it('has instructions textarea', () => {
    expect(src).toContain('Instructions')
  })

  it('calls POST /api/assignments/bulk on submit', () => {
    expect(src).toContain('assignments/bulk')
  })

  it('Request Evidence button is gated to non-client_user roles', () => {
    expect(src).toMatch(/client_admin|msp_admin|super_admin/)
  })

  it('clears selections after successful submit', () => {
    // After send, selectedIds is cleared
    expect(src).toMatch(/setSelectedIds|selectedIds.*clear/)
  })
})

// ─── TASK 4: CopilotChat.tsx Save as Evidence ────────────────────────────────

describe('CopilotChat.tsx — Save as Evidence button', () => {
  let src: string
  beforeAll(() => { src = read(COPILOT_CHAT) })

  it('imports ArchiveBoxArrowDownIcon', () => {
    expect(src).toContain('ArchiveBoxArrowDownIcon')
  })

  it('accepts onArtifactCreated prop in the interface', () => {
    expect(src).toContain('onArtifactCreated')
  })

  it('Save as Evidence button is only visible when messages >= 2', () => {
    expect(src).toMatch(/messages\.length\s*>=\s*2/)
  })

  it('calls finalize-interview endpoint on button click', () => {
    expect(src).toContain('finalize-interview')
  })

  it('shows loading state while finalizing', () => {
    expect(src).toMatch(/finalizing|savingInterview|saving/)
  })

  it('fires onArtifactCreated callback after success', () => {
    expect(src).toContain('onArtifactCreated')
    // It should be called: onArtifactCreated?.()
    expect(src).toMatch(/onArtifactCreated\?\.\(\)/)
  })

  it('shows success toast message mentioning queued for assessment', () => {
    expect(src).toContain('queued for assessment')
  })
})

// ─── TASK 5: controls/[id]/page.tsx wires onArtifactCreated ─────────────────

describe('controls/[id]/page.tsx — onArtifactCreated wired', () => {
  let src: string
  beforeAll(() => { src = read(CONTROL_DETAIL) })

  it('passes onArtifactCreated prop to CopilotChat', () => {
    expect(src).toContain('onArtifactCreated')
  })

  it('passes refetch as the onArtifactCreated handler', () => {
    expect(src).toMatch(/onArtifactCreated=\{.*refetch.*\}/)
  })
})
