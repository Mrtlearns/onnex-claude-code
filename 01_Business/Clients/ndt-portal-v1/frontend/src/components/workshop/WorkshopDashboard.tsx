import { useState, useCallback, useMemo } from 'react'
import dayjs from 'dayjs'
import { Settings, FlaskConical, AlertTriangle, ScrollText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Timeline, {
  TimelineMarkers,
  TodayMarker,
  TimelineHeaders,
  SidebarHeader,
  DateHeader,
  type OnTimeChange,
} from 'react-calendar-timeline'
import 'react-calendar-timeline/dist/style.css'

import type { WorkshopOrder, WorkshopJob, Role } from '@/lib/workshop/types'
import { useWorkshopOrders } from '@/hooks/useWorkshopOrders'
import { useWorkshopSettings } from '@/hooks/useWorkshopSettings'
import { useWorkshopMachines } from '@/hooks/useWorkshopMachines'
import { useScheduleJob } from '@/hooks/useScheduleJob'
import { buildGroups, buildItems, businessHoursRange, type WorkshopItem } from '@/lib/workshop/timelineUtils'
import { workshopApi } from '@/lib/workshop/workshopApi'
import { DayNavigator } from './DayNavigator'
import { UnscheduledPanel } from './UnscheduledPanel'
import { TimelineItemRenderer } from './TimelineItemRenderer'
import { TimelineGroupRenderer } from './TimelineGroupRenderer'
import { CompletedTray } from './CompletedTray'
import { JobDetailModal } from './JobDetailModal'
import { RoleSwitcher, roleToInspectionType, isFloorManager, loadRole } from './RoleSwitcher'
import { LiveLogPanel } from './LiveLogPanel'
import './workshop-theme.css'

// Required by react-calendar-timeline to map item/group fields
const TIMELINE_KEYS = {
  groupIdKey: 'id',
  groupTitleKey: 'title',
  groupLabelKey: 'title',
  groupRightTitleKey: 'rightTitle',
  itemIdKey: 'id',
  itemTitleKey: 'title',
  itemDivTitleKey: 'title',
  itemGroupKey: 'group',
  itemTimeStartKey: 'start_time',
  itemTimeEndKey: 'end_time',
}

export function WorkshopDashboard() {
  const { orders, connected } = useWorkshopOrders()
  const { settings } = useWorkshopSettings()
  const { machines } = useWorkshopMachines()
  const { scheduleJob } = useScheduleJob()

  const [role, setRole] = useState<Role>(loadRole)
  const [selectedDate, setSelectedDate] = useState(() => dayjs())
  const [selectedItem, setSelectedItem] = useState<{ order: WorkshopOrder; job: WorkshopJob } | null>(null)
  const [selectedConflicts, setSelectedConflicts] = useState<Set<string>>(new Set())
  const [replanning, setReplanning] = useState(false)
  const [showLogPanel, setShowLogPanel] = useState(false)

  const floorManager = isFloorManager(role)
  const roleType = roleToInspectionType(role)

  // Filter groups by role
  const allGroups = useMemo(() => buildGroups(settings, machines), [settings, machines])
  const groups = useMemo(
    () => roleType ? allGroups.filter((g) => g.baseType === roleType) : allGroups,
    [allGroups, roleType]
  )

  // Build timeline items (only scheduled, non-completed) with conflict detection
  const items = useMemo(
    () => buildItems(orders, floorManager, allGroups, settings.workingDays, settings.holidays),
    [orders, floorManager, allGroups, settings.workingDays, settings.holidays]
  )

  // Conflict items — jobs scheduled on non-working days
  const conflictItems = useMemo(() => items.filter((i) => i.isConflict), [items])

  // Visible time window = business hours for selected day
  const { start: visibleStart, end: visibleEnd } = useMemo(
    () => businessHoursRange(selectedDate, settings.businessHours),
    [selectedDate, settings.businessHours]
  )

  // Completed jobs for tray
  const completedJobs = useMemo(() => {
    const result: Array<{ order: WorkshopOrder; job: WorkshopJob }> = []
    for (const order of orders) {
      for (const job of order.workshopJobs) {
        if (job.status === 'completed') result.push({ order, job })
      }
    }
    return result
  }, [orders])

  // Per-group job counts for the group renderer
  const jobCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const item of items) {
      counts[item.group] = (counts[item.group] ?? 0) + 1
    }
    return counts
  }, [items])

  const hasSimOrders = orders.some((o) => o.isSimulated)

  // Clamp scroll to business hours
  const handleTimeChange = useCallback<OnTimeChange<WorkshopItem, ReturnType<typeof buildGroups>[number]>>(
    (newStart, newEnd, updateScrollCanvas) => {
      const duration = newEnd - newStart
      const bhDuration = visibleEnd - visibleStart
      if (duration > bhDuration) {
        updateScrollCanvas(visibleStart, visibleEnd)
        return
      }
      const clampedStart = Math.max(visibleStart, Math.min(newStart, visibleEnd - duration))
      const clampedEnd = clampedStart + duration
      updateScrollCanvas(clampedStart, clampedEnd)
    },
    [visibleStart, visibleEnd]
  )

  // Handle scheduled job drag → reschedule API call
  const handleItemMove = useCallback(
    (itemId: string, dragTime: number, newGroupOrder: number) => {
      const item = items.find((i) => i.id === itemId)
      if (!item) return
      // Prevent cross-inspection-type moves
      if (groups[newGroupOrder]?.baseType !== item.job.inspectionType) return
      const newStart = dayjs(dragTime)
      const newEnd = newStart.add(item.job.durationMinutes, 'minute')
      const targetGroup = groups[newGroupOrder]
      scheduleJob(itemId, {
        scheduledStart: newStart.toISOString(),
        scheduledEnd: newEnd.toISOString(),
        inspectorName: item.job.inspectorName,
        // Pass the machine UUID if the target group is a real machine (not fallback type ID)
        assignedMachineId: targetGroup?.id !== targetGroup?.baseType ? targetGroup?.id : undefined,
      }).catch((e) => {
        console.error('[workshop drag] schedule failed', e)
        // SSE will revert visual state on failure
      })
    },
    [items, groups, scheduleJob]
  )

  // Item click → open detail modal
  const handleItemClick = useCallback(
    (item: WorkshopItem) => {
      setSelectedItem({ order: item.order, job: item.job })
    },
    []
  )

  // Unscheduled job click → open detail modal (floor manager can assign time there)
  const handleUnscheduledClick = useCallback(
    (order: WorkshopOrder, job: WorkshopJob) => {
      setSelectedItem({ order, job })
    },
    []
  )

  // Bulk replan — reschedule all selected conflict jobs
  const handleReplan = useCallback(async (jobIds: string[]) => {
    if (!jobIds.length) return
    setReplanning(true)
    try {
      await workshopApi.replanJobs(jobIds)
      setSelectedConflicts(new Set())
    } catch (e) {
      console.error('[replan] failed', e)
    } finally {
      setReplanning(false)
    }
  }, [])

  // Toggle conflict selection
  const toggleConflictSelection = useCallback((jobId: string) => {
    setSelectedConflicts((prev) => {
      const next = new Set(prev)
      if (next.has(jobId)) next.delete(jobId)
      else next.add(jobId)
      return next
    })
  }, [])

  // Item renderer — closure binds onJobClick
  const itemRenderer = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => <TimelineItemRenderer {...props} onJobClick={handleItemClick} />,
    [handleItemClick]
  )

  // Group renderer — closure binds jobCounts
  const groupRenderer = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (props: any) => <TimelineGroupRenderer {...props} jobCounts={jobCounts} />,
    [jobCounts]
  )

  return (
    <div className="flex flex-col h-full bg-[var(--ws-bg-primary)]">
      {/* SIM banner */}
      {hasSimOrders && (
        <div className="ws-sim-banner">
          🧪 SIMULATION ACTIVE — showing simulated data
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ws-lane-border)] bg-[var(--ws-bg-secondary)] shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-[var(--ws-text-primary)]">Workshop Dashboard</h1>
          <DayNavigator selectedDate={selectedDate} onChange={setSelectedDate} />
          <span className={cn(
            'text-[10px] font-mono px-1.5 py-0.5 rounded-full',
            connected ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'
          )}>
            {connected ? '● LIVE' : '○ Connecting…'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <RoleSwitcher onRoleChange={setRole} />
          <button
            onClick={() => setShowLogPanel((v) => !v)}
            className={cn(
              'p-2 rounded-md transition-colors',
              showLogPanel
                ? 'text-blue-400 bg-blue-500/10'
                : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)] hover:bg-[var(--ws-glass-bg-hover)]'
            )}
            title="Live Log"
          >
            <ScrollText className="h-4 w-4" />
          </button>
          <Link
            to="/workshop/simulation"
            className="p-2 rounded-md text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)] hover:bg-[var(--ws-glass-bg-hover)] transition-colors"
            title="Simulation"
          >
            <FlaskConical className="h-4 w-4" />
          </Link>
          <Link
            to="/workshop/settings"
            className="p-2 rounded-md text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)] hover:bg-[var(--ws-glass-bg-hover)] transition-colors"
            title="Workshop Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Unscheduled jobs */}
      <UnscheduledPanel
        orders={orders}
        role={role}
        onJobClick={handleUnscheduledClick}
      />

      {/* Conflict banner — only for floor managers when conflicts exist */}
      {floorManager && conflictItems.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border-b border-red-500/30 shrink-0">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-400 font-medium">
            {conflictItems.length} job{conflictItems.length !== 1 ? 's' : ''} scheduled on non-working day
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setSelectedConflicts(new Set(conflictItems.map((i) => i.id)))}
              className="text-xs text-red-400 hover:text-red-300 underline"
            >
              Select all
            </button>
            {selectedConflicts.size > 0 && (
              <button
                onClick={() => handleReplan([...selectedConflicts])}
                disabled={replanning}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  'bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed'
                )}
              >
                {replanning ? 'Replanning…' : `Replan selected (${selectedConflicts.size})`}
              </button>
            )}
          </div>
          {/* Conflict job checkboxes — shown when there are few conflicts */}
          {conflictItems.length <= 8 && (
            <div className="flex flex-wrap gap-1 border-l border-red-500/30 pl-3">
              {conflictItems.map((ci) => (
                <label key={ci.id} className="flex items-center gap-1 text-[10px] text-red-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedConflicts.has(ci.id)}
                    onChange={() => toggleConflictSelection(ci.id)}
                    className="accent-red-500"
                  />
                  {ci.order.orderNumber}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline — vertically scrollable when many lanes */}
      <div className="flex-1 min-h-0 overflow-y-auto ws-timeline-wrapper">
        <Timeline
          groups={groups}
          items={items}
          keys={TIMELINE_KEYS}
          defaultTimeStart={visibleStart}
          defaultTimeEnd={visibleEnd}
          visibleTimeStart={visibleStart}
          visibleTimeEnd={visibleEnd}
          onTimeChange={handleTimeChange}
          onItemMove={handleItemMove}
          canMove={floorManager}
          selected={floorManager ? items.map((i) => i.id) : []}
          canChangeGroup={floorManager}
          canResize={false}
          stackItems
          dragSnap={15 * 60 * 1000}
          lineHeight={60}
          itemHeightRatio={0.85}
          sidebarWidth={120}
          rightSidebarWidth={0}
          minZoom={60 * 60 * 1000}
          maxZoom={12 * 60 * 60 * 1000}
          itemRenderer={itemRenderer}
          groupRenderer={groupRenderer}
          timeSteps={{
            second: 0,
            minute: 15,
            hour: 1,
            day: 1,
            month: 1,
            year: 1,
          }}
        >
          <TimelineHeaders className="ws-timeline-headers">
            <SidebarHeader>
              {({ getRootProps }) => (
                <div
                  {...getRootProps()}
                  className="flex items-center justify-center text-[10px] font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider"
                >
                  Machine
                </div>
              )}
            </SidebarHeader>
            <DateHeader unit="primaryHeader" />
            <DateHeader />
          </TimelineHeaders>

          <TimelineMarkers>
            <TodayMarker>
              {({ styles }) => (
                <div
                  style={{
                    ...styles,
                    backgroundColor: 'var(--ws-time-indicator)',
                    width: '2px',
                    zIndex: 85,
                  }}
                />
              )}
            </TodayMarker>
          </TimelineMarkers>
        </Timeline>
      </div>

      {/* Completed tray */}
      <CompletedTray
        completedJobs={completedJobs}
        onJobClick={(order, job) => setSelectedItem({ order, job })}
      />

      {/* Live log panel (slide-in from right) */}
      {showLogPanel && (
        <LiveLogPanel onClose={() => setShowLogPanel(false)} />
      )}

      {/* Job detail modal */}
      {selectedItem && (
        <JobDetailModal
          order={selectedItem.order}
          job={selectedItem.job}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
