import { useState } from 'react'
import { User, Calendar, Clock, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkshopOrder, WorkshopJob, Priority } from '@/lib/workshop/types'
import { PRIORITY_COLORS, STATUS_LABELS } from '@/lib/workshop/constants'
import { formatRelativeDue } from '@/lib/workshop/schedulingUtils'

interface JobCardProps {
  order: WorkshopOrder
  job: WorkshopJob
  onClick?: () => void
  className?: string
  style?: React.CSSProperties
}

export function JobCard({
  order,
  job,
  onClick,
  className,
  style,
}: JobCardProps) {
  const [expanded, setExpanded] = useState(false)
  const priorityColor = PRIORITY_COLORS[order.priority as Priority]
  const statusClass = job.status.replace('_', '-')
  const due = formatRelativeDue(order.dueDate)

  const cardClass = cn(
    'job-card ws-card-enter',
    job.status === 'scheduled'   && 'job-card--scheduled',
    job.status === 'in_progress' && 'job-card--in-progress',
    className
  )

  return (
    <div
      className={cardClass}
      style={style}
      onClick={onClick ?? (() => setExpanded((v) => !v))}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && (onClick ? onClick() : setExpanded((v) => !v))}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <span className="ws-order-number">{order.orderNumber}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {order.isSimulated && <span className="sim-badge">SIM</span>}
          <span className={`status-pill status-pill--${statusClass}`}>
            {STATUS_LABELS[job.status]}
          </span>
        </div>
      </div>

      {/* Inner panel: customer + part */}
      <div className="job-card-inner-panel">
        <div className="font-semibold text-sm text-[var(--ws-text-primary)] truncate">
          {order.customer?.name ?? '—'}
        </div>
        <div className="text-xs text-[var(--ws-text-secondary)] mt-0.5 font-mono">
          {order.partNumber}
          <span className="ml-2 text-[var(--ws-text-muted)]">× {order.quantity}</span>
        </div>
      </div>

      {/* Metadata rows */}
      <div className="flex items-center justify-between text-xs text-[var(--ws-text-secondary)] mb-1">
        <span className="flex items-center gap-1">
          <User className="h-3 w-3" />
          {job.inspectorName ?? 'Unassigned'}
        </span>
        <span className={cn('flex items-center gap-1', due.overdue && 'text-[#ef4444]')}>
          <Calendar className="h-3 w-3" />
          {due.text}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-[var(--ws-text-secondary)] mb-2">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {job.durationMinutes} min est.
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: priorityColor }}
        >
          ● {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)}
        </span>
      </div>

      {/* Inspection icon strip */}
      <div className="flex items-center gap-1 mb-2">
        {order.workshopJobs.map((j) => (
          <span
            key={j.id}
            className={`inspection-icon inspection-icon--${j.status.replace('_', '-')}`}
            title={j.inspectionType}
          >
            {j.inspectionType}
          </span>
        ))}
      </div>

      {/* Scheduling mode */}
      <div className="flex items-center gap-1 text-[11px] text-[var(--ws-text-muted)]">
        {job.schedulingMode === 'manual' ? (
          <>
            <User className="h-3 w-3 text-yellow-500" />
            <span className="text-yellow-600 dark:text-yellow-400">Manually placed</span>
          </>
        ) : (
          <>
            <Settings className="h-3 w-3" />
            <span>Auto-scheduled</span>
          </>
        )}
      </div>

      {/* Notes (shown on expand) */}
      {job.notes && (
        <div
          className={cn(
            'mt-2 text-[11px] italic text-[var(--ws-text-muted)] border-t border-[var(--ws-lane-border)] pt-2',
            !expanded && 'line-clamp-1'
          )}
        >
          {job.notes}
        </div>
      )}

      {/* Bottom accent bar */}
      <div className="job-card-accent" style={{ background: priorityColor }} />
    </div>
  )
}
