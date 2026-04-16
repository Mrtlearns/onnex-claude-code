import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkshopOrder, WorkshopJob, Role } from '@/lib/workshop/types'
import { PRIORITY_COLORS } from '@/lib/workshop/constants'
import { formatRelativeDue } from '@/lib/workshop/schedulingUtils'
import type { Priority } from '@/lib/workshop/types'
import { isFloorManager } from './RoleSwitcher'

interface UnscheduledPanelProps {
  orders: WorkshopOrder[]
  role: Role
  onJobClick: (order: WorkshopOrder, job: WorkshopJob) => void
}

export function UnscheduledPanel({ orders, role, onJobClick }: UnscheduledPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const canSchedule = isFloorManager(role)

  const unscheduled: Array<{ order: WorkshopOrder; job: WorkshopJob }> = []
  for (const order of orders) {
    for (const job of order.workshopJobs) {
      if (job.status === 'unscheduled') {
        unscheduled.push({ order, job })
      }
    }
  }

  if (unscheduled.length === 0) return null

  return (
    <div className="ws-unscheduled-panel border-b border-[var(--ws-lane-border)] bg-[var(--ws-bg-secondary)] shrink-0">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2',
          'text-xs font-semibold text-[var(--ws-text-secondary)]',
          'hover:bg-[var(--ws-glass-bg)] transition-colors'
        )}
      >
        <span>
          UNSCHEDULED
          <span className="ml-2 text-[var(--ws-text-muted)] font-normal">
            {unscheduled.length} job{unscheduled.length !== 1 ? 's' : ''} pending
          </span>
        </span>
        {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>

      {!collapsed && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {unscheduled.map(({ order, job }) => (
            <UnscheduledJobChip
              key={job.id}
              order={order}
              job={job}
              canSchedule={canSchedule}
              onClick={() => onJobClick(order, job)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Chip ──────────────────────────────────────────────────────────────────────

interface ChipProps {
  order: WorkshopOrder
  job: WorkshopJob
  canSchedule: boolean
  onClick: () => void
}

function UnscheduledJobChip({ order, job, canSchedule, onClick }: ChipProps) {
  const priorityColor = PRIORITY_COLORS[order.priority as Priority]
  const due = formatRelativeDue(order.dueDate)

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-left',
        'bg-[var(--ws-card-bg)] border border-[var(--ws-lane-border)]',
        'hover:border-[var(--ws-accent)]/40 hover:shadow-md transition-all',
        'ws-card-enter'
      )}
      style={{ borderLeftColor: priorityColor, borderLeftWidth: '3px' }}
    >
      {/* Inspection type badge */}
      <span className={`inspection-icon inspection-icon--unscheduled shrink-0`}>
        {job.inspectionType}
      </span>

      {/* Info */}
      <div className="min-w-0">
        <div className="font-mono font-bold text-[11px] text-[var(--ws-text-primary)]">
          {order.orderNumber}
        </div>
        <div className="text-[10px] text-[var(--ws-text-muted)] truncate max-w-[120px]">
          {order.customer?.name ?? order.partNumber}
        </div>
      </div>

      {/* Due */}
      {due.overdue && (
        <span className="text-[9px] text-[#ef4444] shrink-0 font-semibold">
          {due.text}
        </span>
      )}

      {/* Schedule hint */}
      {canSchedule && (
        <span className="text-[9px] text-[var(--ws-accent)] shrink-0 ml-1">
          Schedule →
        </span>
      )}
    </button>
  )
}
