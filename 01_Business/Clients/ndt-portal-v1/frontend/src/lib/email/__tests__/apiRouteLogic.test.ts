/**
 * Unit tests for API route pure-function logic (inbox + diagram-analyses)
 *
 * These functions are extracted from the route handlers and tested here.
 * No DB connection needed.
 */

import { describe, it, expect } from 'vitest'

// ── parseSenderEmail (from inbox.ts) ─────────────────────────────────────

function parseSenderEmail(from: string): { name: string | null; email: string } {
  const match = from.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) {
    return { name: match[1].trim() || null, email: match[2].trim().toLowerCase() }
  }
  return { name: null, email: from.trim().toLowerCase() }
}

// ── isNewProspect helper ──────────────────────────────────────────────────

function isNewProspect(customerId: string | null): boolean {
  return customerId === null
}

// ── diagram-analyses: buildWhereClause ───────────────────────────────────

interface AnalysisFilter {
  inspectionType?: string
  quoteNumber?: string
  quoteType?: 'email' | 'ut' | 'rt'
}

function buildAnalysisWhereClause(filter: AnalysisFilter): { clause: string; vals: unknown[] } {
  const conditions: string[] = []
  const vals: unknown[] = []
  let i = 1

  if (filter.inspectionType) {
    conditions.push(`inspection_type = $${i++}`)
    vals.push(filter.inspectionType.toUpperCase())
  }
  if (filter.quoteNumber) {
    conditions.push(`quote_number ILIKE $${i++}`)
    vals.push(`%${filter.quoteNumber}%`)
  }
  if (filter.quoteType) {
    conditions.push(`quote_type = $${i++}`)
    vals.push(filter.quoteType)
  }

  const clause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  return { clause, vals }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('parseSenderEmail', () => {
  it('parses "Name <email>" format', () => {
    const result = parseSenderEmail('John Smith <john@premco.com>')
    expect(result).toEqual({ name: 'John Smith', email: 'john@premco.com' })
  })

  it('lowercases the email address', () => {
    const result = parseSenderEmail('JOHN@PREMCO.COM')
    expect(result.email).toBe('john@premco.com')
  })

  it('returns null name for plain email', () => {
    const result = parseSenderEmail('john@premco.com')
    expect(result).toEqual({ name: null, email: 'john@premco.com' })
  })

  it('handles name with special chars', () => {
    const result = parseSenderEmail('J. Smith Jr. <j.smith@co.com>')
    expect(result.name).toBe('J. Smith Jr.')
    expect(result.email).toBe('j.smith@co.com')
  })

  it('returns null name when angle-bracket format has empty name', () => {
    const result = parseSenderEmail('<john@premco.com>')
    expect(result.name).toBeNull()
    expect(result.email).toBe('john@premco.com')
  })

  it('trims whitespace from email', () => {
    const result = parseSenderEmail('  john@premco.com  ')
    expect(result.email).toBe('john@premco.com')
  })
})

describe('isNewProspect', () => {
  it('returns true when customerId is null', () => {
    expect(isNewProspect(null)).toBe(true)
  })

  it('returns false when customerId is set', () => {
    expect(isNewProspect('some-uuid')).toBe(false)
  })
})

describe('buildAnalysisWhereClause', () => {
  it('returns empty clause for no filters', () => {
    const { clause, vals } = buildAnalysisWhereClause({})
    expect(clause).toBe('')
    expect(vals).toHaveLength(0)
  })

  it('filters by inspectionType (uppercased)', () => {
    const { clause, vals } = buildAnalysisWhereClause({ inspectionType: 'rt' })
    expect(clause).toContain('inspection_type = $1')
    expect(vals).toContain('RT')
  })

  it('filters by quoteNumber with ILIKE', () => {
    const { clause, vals } = buildAnalysisWhereClause({ quoteNumber: 'EQ-2026' })
    expect(clause).toContain('quote_number ILIKE $1')
    expect(vals).toContain('%EQ-2026%')
  })

  it('filters by quoteType', () => {
    const { clause, vals } = buildAnalysisWhereClause({ quoteType: 'email' })
    expect(clause).toContain('quote_type = $1')
    expect(vals).toContain('email')
  })

  it('combines multiple filters with AND', () => {
    const { clause, vals } = buildAnalysisWhereClause({
      inspectionType: 'UT',
      quoteType: 'email',
    })
    expect(clause).toContain('AND')
    expect(vals).toHaveLength(2)
    expect(vals).toContain('UT')
    expect(vals).toContain('email')
  })

  it('assigns incrementing parameter numbers', () => {
    const { clause } = buildAnalysisWhereClause({
      inspectionType: 'RT',
      quoteNumber:    'EQ-2026',
      quoteType:      'email',
    })
    expect(clause).toContain('$1')
    expect(clause).toContain('$2')
    expect(clause).toContain('$3')
  })
})
