import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeDue } from '../schedulingUtils'

afterEach(() => {
  vi.useRealTimers()
})

const NOW = new Date('2026-04-05T12:00:00.000Z')

function setup() {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
}

describe('formatRelativeDue', () => {
  it('returns "No due date" for null', () => {
    const result = formatRelativeDue(null)
    expect(result.text).toBe('No due date')
    expect(result.overdue).toBe(false)
  })

  it('marks overdue hours correctly (<24h past)', () => {
    setup()
    const due = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString() // 3h ago
    const result = formatRelativeDue(due)
    expect(result.overdue).toBe(true)
    expect(result.text).toMatch(/Overdue 3h/)
  })

  it('marks overdue days correctly (>24h past)', () => {
    setup()
    const due = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
    const result = formatRelativeDue(due)
    expect(result.overdue).toBe(true)
    expect(result.text).toMatch(/Overdue 2d/)
  })

  it('returns "Due in Xm" when due in <1h', () => {
    setup()
    const due = new Date(NOW.getTime() + 30 * 60 * 1000).toISOString() // 30m from now
    const result = formatRelativeDue(due)
    expect(result.overdue).toBe(false)
    expect(result.text).toMatch(/Due in 30m/)
  })

  it('returns "Due in Xh" when due in 1–24h', () => {
    setup()
    const due = new Date(NOW.getTime() + 6 * 60 * 60 * 1000).toISOString() // 6h from now
    const result = formatRelativeDue(due)
    expect(result.overdue).toBe(false)
    expect(result.text).toMatch(/Due in 6h/)
  })

  it('returns "Due tomorrow" when due in 24–48h', () => {
    setup()
    const due = new Date(NOW.getTime() + 30 * 60 * 60 * 1000).toISOString() // 30h from now
    const result = formatRelativeDue(due)
    expect(result.overdue).toBe(false)
    expect(result.text).toBe('Due tomorrow')
  })

  it('returns "Due in Xd" when due in >48h', () => {
    setup()
    const due = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString() // 5d from now
    const result = formatRelativeDue(due)
    expect(result.overdue).toBe(false)
    expect(result.text).toMatch(/Due in 5d/)
  })
})
