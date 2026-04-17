/**
 * Unit tests for the Email Checks Engine pure functions.
 *
 * Imports the REAL functions from api/src/lib/ndt-classify.ts via the
 * @ndtv1/api path alias (vite.config.ts + tsconfig.app.json).
 * No more manual mirroring — if the API regex changes, these tests break here.
 *
 * LLM and DB calls are not tested here — those require integration tests.
 */

import { describe, it, expect } from 'vitest'
import { keywordDetectTypes, keywordDetectPartMaterial } from '@ndtv1/api/lib/ndt-classify'

// ── Tests: keywordDetectTypes ─────────────────────────────────────────────────

describe('keywordDetectTypes', () => {
  it('detects RT from word boundary \\brt\\b', () => {
    expect(keywordDetectTypes('We need RT inspection')).toContain('RT')
  })

  it('detects RT from radiograph keyword', () => {
    expect(keywordDetectTypes('Submit for radiographic testing')).toContain('RT')
  })

  it('detects RT from x-ray', () => {
    expect(keywordDetectTypes('x-ray of the weld')).toContain('RT')
  })

  it('detects UT from standalone "UT" keyword (\\but\\b)', () => {
    expect(keywordDetectTypes('We need UT inspection on this weld')).toContain('UT')
  })

  it('detects UT from standalone "UT" at end of sentence', () => {
    expect(keywordDetectTypes('Please quote for UT.')).toContain('UT')
  })

  it('detects UT from uppercase "UT" in subject line', () => {
    expect(keywordDetectTypes('Subject: UT Quote Request')).toContain('UT')
  })

  it('detects UT from ultrasonic', () => {
    expect(keywordDetectTypes('Ultrasonic testing required')).toContain('UT')
  })

  it('detects UT from ultrasonically (adverb form)', () => {
    expect(keywordDetectTypes('The welds were ultrasonically inspected')).toContain('UT')
  })

  it('detects UT from phased array', () => {
    expect(keywordDetectTypes('phased array scan')).toContain('UT')
  })

  it('does not match "UT" inside longer words (e.g. "output", "strut")', () => {
    expect(keywordDetectTypes('The strut output should be inspected visually')).not.toContain('UT')
  })

  it('detects ET from eddy current', () => {
    expect(keywordDetectTypes('eddy current inspection')).toContain('ET')
  })

  it('detects MT from magnetic particle', () => {
    expect(keywordDetectTypes('magnetic particle test')).toContain('MT')
  })

  it('detects PT from penetrant', () => {
    expect(keywordDetectTypes('dye penetrant test')).toContain('PT')
  })

  it('detects VT from visual test', () => {
    expect(keywordDetectTypes('visual test required')).toContain('VT')
  })

  it('detects multiple types in same email', () => {
    const result = keywordDetectTypes('We need RT and UT inspection on the pipe welds')
    expect(result).toContain('RT')
    expect(result).toContain('UT')
    expect(result).toHaveLength(2)
  })

  it('returns empty array for unrelated text', () => {
    expect(keywordDetectTypes('Please send me a quote for painting services')).toHaveLength(0)
  })

  it('does not match RT inside longer words (word boundary)', () => {
    // "part" contains "rt" but should not match \brt\b
    expect(keywordDetectTypes('I need to part this assembly')).not.toContain('RT')
  })

  it('is case-insensitive', () => {
    expect(keywordDetectTypes('RADIOGRAPHIC TESTING NEEDED')).toContain('RT')
    expect(keywordDetectTypes('Ultrasonic Testing')).toContain('UT')
  })
})

// ── Tests: keywordDetectPartMaterial ─────────────────────────────────────────

describe('keywordDetectPartMaterial', () => {
  it('detects P/N: format', () => {
    expect(keywordDetectPartMaterial('P/N: AB-12345')).toBe(true)
  })

  it('detects PN: format', () => {
    expect(keywordDetectPartMaterial('PN: XYZ-001')).toBe(true)
  })

  it('detects Part No: format', () => {
    expect(keywordDetectPartMaterial('Part No: 99-ABC')).toBe(true)
  })

  it('detects Part Number:', () => {
    expect(keywordDetectPartMaterial('Part Number: WING-2024-A')).toBe(true)
  })

  it('detects carbon steel', () => {
    expect(keywordDetectPartMaterial('Material: carbon steel, 1 inch thick')).toBe(true)
  })

  it('detects stainless', () => {
    expect(keywordDetectPartMaterial('304 stainless plate')).toBe(true)
  })

  it('detects aluminium (British spelling)', () => {
    expect(keywordDetectPartMaterial('7075 aluminium billet')).toBe(true)
  })

  it('detects aluminum (American spelling)', () => {
    expect(keywordDetectPartMaterial('6061-T6 aluminum')).toBe(true)
  })

  it('detects inconel', () => {
    expect(keywordDetectPartMaterial('Inconel 625 fitting')).toBe(true)
  })

  it('returns false for email with no part or material', () => {
    expect(keywordDetectPartMaterial('Please quote for inspection of our parts')).toBe(false)
  })

  it('is case-insensitive for material keywords', () => {
    expect(keywordDetectPartMaterial('CARBON STEEL PLATE')).toBe(true)
  })
})

// ── Tests: check blocking logic ───────────────────────────────────────────────

describe('check blocking logic', () => {
  // Simulate the blocking check behaviour without DB/n8n
  const BLOCKING_CODES = ['DIAGRAM_ATTACHED', 'INSPECTION_TYPE_CLASSIFIABLE', 'PART_MATERIAL_PRESENT']
  const FLAG_ONLY_CODES = ['CUSTOMER_IDENTIFIED']

  function isBlockingCheck(code: string): boolean {
    return BLOCKING_CODES.includes(code)
  }

  function shouldSendReply(results: Array<{ code: string; passed: boolean }>): string | null {
    const firstFail = results.find(r => !r.passed && isBlockingCheck(r.code))
    return firstFail?.code ?? null
  }

  it('CUSTOMER_IDENTIFIED is flag-only — never blocking', () => {
    expect(isBlockingCheck('CUSTOMER_IDENTIFIED')).toBe(false)
    expect(FLAG_ONLY_CODES).toContain('CUSTOMER_IDENTIFIED')
  })

  it('DIAGRAM_ATTACHED is blocking', () => {
    expect(isBlockingCheck('DIAGRAM_ATTACHED')).toBe(true)
  })

  it('sends reply for first blocking failure only', () => {
    const results = [
      { code: 'DIAGRAM_ATTACHED',          passed: false },
      { code: 'CUSTOMER_IDENTIFIED',        passed: false },
      { code: 'INSPECTION_TYPE_CLASSIFIABLE', passed: false },
    ]
    // Should only trigger reply for DIAGRAM_ATTACHED (first blocking failure)
    expect(shouldSendReply(results)).toBe('DIAGRAM_ATTACHED')
  })

  it('returns null when all blocking checks pass', () => {
    const results = [
      { code: 'DIAGRAM_ATTACHED',             passed: true },
      { code: 'CUSTOMER_IDENTIFIED',           passed: false },  // flag-only, ignored
      { code: 'INSPECTION_TYPE_CLASSIFIABLE',  passed: true },
      { code: 'PART_MATERIAL_PRESENT',         passed: true },
    ]
    expect(shouldSendReply(results)).toBeNull()
  })

  it('skips CUSTOMER_IDENTIFIED failure when picking first blocking fail', () => {
    const results = [
      { code: 'CUSTOMER_IDENTIFIED',           passed: false },
      { code: 'DIAGRAM_ATTACHED',              passed: false },
    ]
    // CUSTOMER_IDENTIFIED is not blocking — DIAGRAM_ATTACHED should be the first blocker
    expect(shouldSendReply(results)).toBe('DIAGRAM_ATTACHED')
  })
})
