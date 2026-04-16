import { cn } from '@/lib/utils'
import type { WorkshopOrder, WorkshopJob, Priority } from '@/lib/workshop/types'
import { PRIORITY_COLORS } from '@/lib/workshop/constants'

interface JobCardCollapsedProps {
  order: WorkshopOrder
  job: WorkshopJob
  onClick?: () => void
  /** chip variant = simpler display used in CompletedTray */
  variant?: 'card' | 'chip'
  className?: string
  style?: React.CSSProperties
}

export function JobCardCollapsed({ order, job, onClick, variant = 'card', className, style }: JobCardCollapsedProps) {
  const priorityColor = PRIORITY_COLORS[order.priority as Priority]

  if (variant === 'chip') {
    return (
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold',
          'bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)]',
          'hover:border-[var(--ws-accent)] transition-colors',
          className
        )}
        title={`${order.orderNumber} — ${job.inspectionType}`}
      >
        <span className="text-[var(--ws-text-primary)]">{order.orderNumber}</span>
        <span
          className="inspection-icon inspection-icon--completed"
          style={{ width: 'auto', padding: '0 6px' }}
        >
          {job.inspectionType}
        </span>
        <span className="text-[#22c55e]">✓</span>
      </button>
    )
  }

  return (
    <div
      className={cn('job-card-collapsed', className)}
      style={style}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <span className="ws-order-number text-xs">{order.orderNumber}</span>
      <div className="flex items-center gap-1">
        <span className={`inspection-icon inspection-icon--${job.status.replace('_', '-')}`}>
          {job.inspectionType}
        </span>
        {order.isSimulated && <span className="sim-badge">SIM</span>}
      </div>
      {/* Bottom accent bar */}
      <div
        className="job-card-accent"
        style={{ background: priorityColor }}
      />
    </div>
  )
}
