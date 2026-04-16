import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { isWorkingDay, businessHoursRange, buildGroups } from '../timelineUtils'
import type { WorkshopSettings, WorkshopMachine } from '../types'

// ── Fixtures ──────────────────────────────────────────────────

const settings: WorkshopSettings = {
  businessHours: { start: '08:00', end: '17:00', timezone: 'America/Chicago' },
  inspectionTypes: ['RT', 'UT'],
  inspectionDurationsDefault: { RT: 120, UT: 60, ET: 45, MT: 30, PT: 30, VT: 15 },
  machineCounts: { RT: 1, UT: 1, ET: 0, MT: 0, PT: 0, VT: 0 },
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  holidays: [],
  bufferMinutes: 0,
}

const makeMachine = (id: string, type: WorkshopMachine['type'], order = 1, active = true): WorkshopMachine => ({
  id,
  name: `${type} Machine ${id}`,
  type,
  isActive: active,
  displayOrder: order,
  inspectorName: null,
  offlineWindows: [],
})

// ── isWorkingDay ──────────────────────────────────────────────

describe('isWorkingDay', () => {
  const workingDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

  it('returns true for a weekday that is a working day', () => {
    const monday = dayjs('2026-04-06') // Monday
    expect(isWorkingDay(monday, [...workingDays], [])).toBe(true)
  })

  it('returns false for a weekend day not in workingDays', () => {
    const saturday = dayjs('2026-04-04') // Saturday
    expect(isWorkingDay(saturday, [...workingDays], [])).toBe(false)
  })

  it('returns false for a holiday even if it is a working day', () => {
    const monday = dayjs('2026-04-06')
    expect(isWorkingDay(monday, [...workingDays], ['2026-04-06'])).toBe(false)
  })

  it('returns false for a day not in workingDays list', () => {
    const sunday = dayjs('2026-04-05')
    expect(isWorkingDay(sunday, [...workingDays], [])).toBe(false)
  })

  it('returns true when workingDays includes Sunday and date is Sunday', () => {
    const sunday = dayjs('2026-04-05')
    expect(isWorkingDay(sunday, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], [])).toBe(true)
  })
})

// ── businessHoursRange ────────────────────────────────────────

describe('businessHoursRange', () => {
  it('returns correct start and end timestamps', () => {
    const date = dayjs('2026-04-06')
    const range = businessHoursRange(date, { start: '08:00', end: '17:00' })

    const expectedStart = date.hour(8).minute(0).second(0).millisecond(0).valueOf()
    const expectedEnd = date.hour(17).minute(0).second(0).millisecond(0).valueOf()

    expect(range.start).toBe(expectedStart)
    expect(range.end).toBe(expectedEnd)
  })

  it('end is greater than start', () => {
    const date = dayjs('2026-04-06')
    const range = businessHoursRange(date, { start: '08:30', end: '16:30' })
    expect(range.end).toBeGreaterThan(range.start)
  })

  it('handles non-standard hours (06:30 to 14:30)', () => {
    const date = dayjs('2026-04-06')
    const range = businessHoursRange(date, { start: '06:30', end: '14:30' })
    const expectedStart = date.hour(6).minute(30).second(0).millisecond(0).valueOf()
    expect(range.start).toBe(expectedStart)
  })
})

// ── buildGroups ───────────────────────────────────────────────

describe('buildGroups', () => {
  it('creates a placeholder group per type when no machines configured', () => {
    const groups = buildGroups(settings, [])
    expect(groups).toHaveLength(2)
    expect(groups[0].id).toBe('RT')
    expect(groups[1].id).toBe('UT')
  })

  it('creates one group per active machine', () => {
    const machines = [
      makeMachine('m1', 'RT', 1),
      makeMachine('m2', 'RT', 2),
      makeMachine('m3', 'UT', 1),
    ]
    const groups = buildGroups(settings, machines)
    expect(groups).toHaveLength(3)
    expect(groups.find(g => g.id === 'm1')?.title).toBe('RT Machine m1')
    expect(groups.find(g => g.id === 'm3')?.baseType).toBe('UT')
  })

  it('excludes inactive machines', () => {
    const machines = [
      makeMachine('m1', 'RT', 1, true),
      makeMachine('m2', 'RT', 2, false),
    ]
    const groups = buildGroups(settings, machines)
    const rtGroups = groups.filter(g => g.baseType === 'RT')
    expect(rtGroups).toHaveLength(1)
    expect(rtGroups[0].id).toBe('m1')
  })

  it('sorts machines by displayOrder within each type', () => {
    const machines = [
      makeMachine('m2', 'RT', 2),
      makeMachine('m1', 'RT', 1),
    ]
    const groups = buildGroups(settings, machines)
    const rtGroups = groups.filter(g => g.baseType === 'RT')
    expect(rtGroups[0].id).toBe('m1')
    expect(rtGroups[1].id).toBe('m2')
  })

  it('sets machineCount to the total active machines of that type', () => {
    const machines = [makeMachine('m1', 'RT', 1), makeMachine('m2', 'RT', 2)]
    const groups = buildGroups(settings, machines)
    expect(groups[0].machineCount).toBe(2)
    expect(groups[1].machineCount).toBe(2)
  })
})
