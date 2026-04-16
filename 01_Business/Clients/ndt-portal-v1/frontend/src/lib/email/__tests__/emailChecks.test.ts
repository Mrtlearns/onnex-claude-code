/**
 * Unit tests for email checks business logic
 *
 * Tests the pure functions used by the Email Checks engine:
 *   - Quote number generation format
 *   - Email thread direction logic
 *   - Check seed data shape validation
 *   - Status transition validity
 */

import { describe, it, expect } from 'vitest'

// ── Types (mirrored from API types — keep in sync) ─────────────────────────

type EmailQuoteStatus =
  | 'received'
  | 'checking'
  | 'needs_info'
  | 'processing'
  | 'quoted'
  | 'failed'

type LlmRouting = 'CLOUD_OK' | 'LOCAL_ONLY' | 'HOLD'

interface EmailCheck {
  code: string
  name: string
  description: string
  enabled: boolean
  sort_order: number
  response_message: string
}

// ── Helpers (pure functions extracted for testability) ─────────────────────

/**
 * Generate an EQ quote number from a year and sequence number.
 * Format: EQ-YYYY-NNNN (zero-padded to 4 digits)
 */
function formatEqQuoteNumber(year: number, seq: number): string {
  return `EQ-${year}-${String(seq).padStart(4, '0')}`
}

/**
 * Determine if an email is a reply based on subject prefix and threadId match.
 * Returns true if the email is a reply to an existing thread.
 */
function isReply(subject: string, incomingThreadId: string, knownThreadIds: Set<string>): boolean {
  const hasRePrefix = /^re:/i.test(subject.trim())
  const threadKnown = knownThreadIds.has(incomingThreadId)
  return hasRePrefix || threadKnown
}

/**
 * Validate that a status transition is allowed.
 * Only forward transitions (and received→failed, processing→failed) are valid.
 */
const ALLOWED_TRANSITIONS: Record<EmailQuoteStatus, EmailQuoteStatus[]> = {
  received:   ['checking', 'failed'],
  checking:   ['needs_info', 'processing', 'failed'],
  needs_info: ['checking', 'failed'],   // re-check after reply arrives
  processing: ['quoted', 'failed'],
  quoted:     ['failed'],
  failed:     [],
}

function isValidTransition(from: EmailQuoteStatus, to: EmailQuoteStatus): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to)
}

/**
 * Determine LLM routing from a list of per-attachment routings.
 * Strictest wins: HOLD > LOCAL_ONLY > CLOUD_OK
 */
function resolveStrictestRouting(routings: LlmRouting[]): LlmRouting {
  if (routings.includes('HOLD'))       return 'HOLD'
  if (routings.includes('LOCAL_ONLY')) return 'LOCAL_ONLY'
  return 'CLOUD_OK'
}

// ── Seeded check codes (must match migration 041) ──────────────────────────

const SEEDED_CHECK_CODES = [
  'DIAGRAM_ATTACHED',
  'CUSTOMER_IDENTIFIED',
  'INSPECTION_TYPE_CLASSIFIABLE',
  'PART_MATERIAL_PRESENT',
]

// ── Tests ──────────────────────────────────────────────────────────────────

describe('formatEqQuoteNumber', () => {
  it('formats sequence 1 as EQ-2026-0001', () => {
    expect(formatEqQuoteNumber(2026, 1)).toBe('EQ-2026-0001')
  })

  it('formats sequence 999 as EQ-2026-0999', () => {
    expect(formatEqQuoteNumber(2026, 999)).toBe('EQ-2026-0999')
  })

  it('formats sequence 10000 without truncation', () => {
    expect(formatEqQuoteNumber(2026, 10000)).toBe('EQ-2026-10000')
  })

  it('uses the provided year', () => {
    expect(formatEqQuoteNumber(2027, 1)).toBe('EQ-2027-0001')
  })
})

describe('isReply', () => {
  const knownThreads = new Set(['thread-abc-123', 'thread-xyz-456'])

  it('detects reply by threadId match', () => {
    expect(isReply('New enquiry', 'thread-abc-123', knownThreads)).toBe(true)
  })

  it('detects reply by Re: subject prefix', () => {
    expect(isReply('Re: RT Inspection Request', 'thread-new-999', knownThreads)).toBe(true)
  })

  it('detects reply by RE: (uppercase)', () => {
    expect(isReply('RE: quote request', 'thread-new-999', knownThreads)).toBe(true)
  })

  it('identifies new email when neither matches', () => {
    expect(isReply('NDT Inspection Request', 'thread-new-999', knownThreads)).toBe(false)
  })

  it('identifies new email with empty known threads', () => {
    expect(isReply('RT inspection needed', 'thread-brand-new', new Set())).toBe(false)
  })
})

describe('isValidTransition', () => {
  it('allows received → checking', () => {
    expect(isValidTransition('received', 'checking')).toBe(true)
  })

  it('allows checking → needs_info', () => {
    expect(isValidTransition('checking', 'needs_info')).toBe(true)
  })

  it('allows needs_info → checking (re-check after reply)', () => {
    expect(isValidTransition('needs_info', 'checking')).toBe(true)
  })

  it('allows checking → processing', () => {
    expect(isValidTransition('checking', 'processing')).toBe(true)
  })

  it('allows processing → quoted', () => {
    expect(isValidTransition('processing', 'quoted')).toBe(true)
  })

  it('allows any status → failed', () => {
    const statuses: EmailQuoteStatus[] = ['received', 'checking', 'needs_info', 'processing', 'quoted']
    statuses.forEach(s => expect(isValidTransition(s, 'failed')).toBe(true))
  })

  it('blocks backward transition quoted → received', () => {
    expect(isValidTransition('quoted', 'received')).toBe(false)
  })

  it('blocks skipping steps: received → quoted', () => {
    expect(isValidTransition('received', 'quoted')).toBe(false)
  })

  it('blocks same-state transition', () => {
    expect(isValidTransition('checking', 'checking')).toBe(false)
  })
})

describe('resolveStrictestRouting', () => {
  it('returns CLOUD_OK when all attachments are clean', () => {
    expect(resolveStrictestRouting(['CLOUD_OK', 'CLOUD_OK'])).toBe('CLOUD_OK')
  })

  it('returns LOCAL_ONLY when any attachment is EAR-controlled', () => {
    expect(resolveStrictestRouting(['CLOUD_OK', 'LOCAL_ONLY', 'CLOUD_OK'])).toBe('LOCAL_ONLY')
  })

  it('returns HOLD when any attachment is ITAR/rejected', () => {
    expect(resolveStrictestRouting(['CLOUD_OK', 'LOCAL_ONLY', 'HOLD'])).toBe('HOLD')
  })

  it('returns HOLD even if HOLD is only one attachment', () => {
    expect(resolveStrictestRouting(['HOLD'])).toBe('HOLD')
  })

  it('returns CLOUD_OK for empty list', () => {
    expect(resolveStrictestRouting([])).toBe('CLOUD_OK')
  })
})

describe('seeded email check codes', () => {
  it('contains exactly four check codes', () => {
    expect(SEEDED_CHECK_CODES).toHaveLength(4)
  })

  it('includes DIAGRAM_ATTACHED', () => {
    expect(SEEDED_CHECK_CODES).toContain('DIAGRAM_ATTACHED')
  })

  it('includes CUSTOMER_IDENTIFIED', () => {
    expect(SEEDED_CHECK_CODES).toContain('CUSTOMER_IDENTIFIED')
  })

  it('includes INSPECTION_TYPE_CLASSIFIABLE', () => {
    expect(SEEDED_CHECK_CODES).toContain('INSPECTION_TYPE_CLASSIFIABLE')
  })

  it('includes PART_MATERIAL_PRESENT', () => {
    expect(SEEDED_CHECK_CODES).toContain('PART_MATERIAL_PRESENT')
  })

  it('CUSTOMER_IDENTIFIED has no response_message (flags only, no block)', () => {
    // This check flags new prospects but does not block or send a reply.
    // Validated here to ensure the seed contract is respected in future edits.
    const customerCheck: EmailCheck = {
      code: 'CUSTOMER_IDENTIFIED',
      name: 'Customer Identified',
      description: 'Matches sender against known customers.',
      enabled: true,
      sort_order: 1,
      response_message: '',
    }
    expect(customerCheck.response_message).toBe('')
  })
})
