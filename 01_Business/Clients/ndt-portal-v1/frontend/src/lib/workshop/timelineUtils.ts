import dayjs from 'dayjs'
import type { TimelineGroupBase, TimelineItemBase } from 'react-calendar-timeline'
import type { WorkshopOrder, WorkshopJob, InspectionType, WorkshopSettings, WorkshopMachine, WorkDay } from './types'
import { ORDER_PALETTE } from './constants'

// ── Working day helper ────────────────────────────────────────

const DAY_NAMES: WorkDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function isWorkingDay(
  date: dayjs.Dayjs,
  workingDays: WorkDay[],
  holidays: string[]
): boolean {
  const dateStr = date.format('YYYY-MM-DD')
  if (holidays.includes(dateStr)) return false
  const dayName = DAY_NAMES[date.day()]
  return workingDays.includes(dayName)
}

// ── Group ─────────────────────────────────────────────────────

export interface WorkshopGroup extends TimelineGroupBase {
  id: string                // machine UUID or fallback type ID
  baseType: InspectionType  // always the inspection type — for icon lookup and drag validation
  title: string             // machine name (e.g. 'RT Machine 1' or 'Gamma Room A')
  inspectorName: string | null
  machineCount: number      // total active machines of this type (for display)
}

export function buildGroups(
  settings: WorkshopSettings,
  machines: WorkshopMachine[]
): WorkshopGroup[] {
  const groups: WorkshopGroup[] = []

  for (const type of settings.inspectionTypes as InspectionType[]) {
    const activeForType = machines
      .filter((m) => m.type === type && m.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)

    if (activeForType.length === 0) {
      // No machines configured yet — create a placeholder lane using the type as ID
      groups.push({
        id: type,
        baseType: type,
        title: type,
        inspectorName: null,
        machineCount: 0,
        stackItems: true,
      })
    } else {
      for (const machine of activeForType) {
        groups.push({
          id: machine.id,
          baseType: type,
          title: machine.name,
          inspectorName: machine.inspectorName,
          machineCount: activeForType.length,
          stackItems: true,
        })
      }
    }
  }

  return groups
}

// ── Item ──────────────────────────────────────────────────────

export interface WorkshopItem extends TimelineItemBase<number> {
  id: string
  group: string         // machine UUID (or fallback type ID)
  title: string
  start_time: number
  end_time: number
  canMove: boolean
  canResize: false
  canChangeGroup: boolean
  isConflict: boolean   // true when scheduled on a non-working day or holiday
  orderColor: string    // deterministic color from ORDER_PALETTE keyed by orderId
  orderSeq: string      // e.g. "2/3" — this job's sequence position within the order
  job: WorkshopJob
  order: WorkshopOrder
}

export function buildItems(
  orders: WorkshopOrder[],
  canMove: boolean,
  groups: WorkshopGroup[],
  workingDays: WorkDay[],
  holidays: string[]
): WorkshopItem[] {
  const items: WorkshopItem[] = []

  // Build a set of group IDs for quick lookup
  const groupIds = new Set(groups.map((g) => g.id))

  // Build a fallback: type → first group of that type (for jobs with no assignedMachine)
  const typeToFallbackGroup = new Map<string, string>()
  for (const g of groups) {
    if (!typeToFallbackGroup.has(g.baseType)) {
      typeToFallbackGroup.set(g.baseType, g.id)
    }
  }

  // Assign each unique orderId a deterministic color from ORDER_PALETTE
  const orderColorMap = new Map<string, string>()
  let colorIdx = 0
  for (const order of orders) {
    if (!orderColorMap.has(order.id)) {
      orderColorMap.set(order.id, ORDER_PALETTE[colorIdx % ORDER_PALETTE.length])
      colorIdx++
    }
  }

  for (const order of orders) {
    // Count non-completed jobs to compute sequence totals
    const activeJobs = order.workshopJobs
      .filter((j) => j.scheduledStart && j.status !== 'completed')
      .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
    const totalJobs = activeJobs.length

    for (const job of order.workshopJobs) {
      if (!job.scheduledStart || job.status === 'completed') continue

      const startMs = dayjs(job.scheduledStart).valueOf()
      const endMs = job.scheduledEnd
        ? dayjs(job.scheduledEnd).valueOf()
        : dayjs(job.scheduledStart).add(job.durationMinutes, 'minute').valueOf()

      // Determine which group (lane) this job belongs to
      let groupId: string
      if (job.assignedMachine && groupIds.has(job.assignedMachine)) {
        groupId = job.assignedMachine
      } else {
        // Fall back to first lane of the inspection type
        groupId = typeToFallbackGroup.get(job.inspectionType) ?? job.inspectionType
      }

      // Conflict detection: scheduled on non-working day or holiday
      const scheduledDay = dayjs(job.scheduledStart)
      const conflict = !isWorkingDay(scheduledDay, workingDays, holidays)

      // Order color + sequence badge
      const orderColor = orderColorMap.get(order.id) ?? ORDER_PALETTE[0]
      const seqPos = activeJobs.findIndex((j) => j.id === job.id) + 1
      const orderSeq = totalJobs > 1 ? `${seqPos}/${totalJobs}` : ''

      // Only 'scheduled' jobs can be moved/reassigned; in_progress jobs are locked
      const movable = canMove && job.status === 'scheduled'
      items.push({
        id: job.id,
        group: groupId,
        title: order.orderNumber,
        start_time: startMs,
        end_time: endMs,
        canMove: movable,
        canResize: false,
        canChangeGroup: movable,  // allow same-type cross-machine drag for scheduled jobs
        isConflict: conflict,
        orderColor,
        orderSeq,
        job,
        order,
      })
    }
  }

  return items
}

// ── Time range ────────────────────────────────────────────────

export function businessHoursRange(
  date: dayjs.Dayjs,
  bh: { start: string; end: string }
): { start: number; end: number } {
  const [sh, sm] = bh.start.split(':').map(Number)
  const [eh, em] = bh.end.split(':').map(Number)
  return {
    start: date.hour(sh).minute(sm).second(0).millisecond(0).valueOf(),
    end:   date.hour(eh).minute(em).second(0).millisecond(0).valueOf(),
  }
}
