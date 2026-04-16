import { User, Wrench, AlertTriangle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ItemContext } from 'react-calendar-timeline'
import type { WorkshopItem } from '@/lib/workshop/timelineUtils'
import { INSPECTION_COLORS } from '@/lib/workshop/constants'
import { formatRelativeDue } from '@/lib/workshop/schedulingUtils'

export interface TimelineItemRendererProps {
  item: WorkshopItem
  itemContext: ItemContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getItemProps: (params?: Record<string, any>) => React.HTMLAttributes<HTMLDivElement>
  onJobClick: (item: WorkshopItem) => void
}

export function TimelineItemRenderer({
  item,
  itemContext,
  getItemProps,
  onJobClick,
}: TimelineItemRendererProps) {
  const { job, order } = item
  const due = formatRelativeDue(order.dueDate)
  const isDragging = itemContext.dragging
  const isNarrow = itemContext.dimensions.width < 130
  const isLocked = job.status === 'in_progress'

  // Progress bar: elapsed % for in_progress, 0 for scheduled
  let progressPct = 0
  if (job.status === 'in_progress' && job.actualStart) {
    const elapsed = Date.now() - new Date(job.actualStart).getTime()
    const total = job.durationMinutes * 60_000
    progressPct = Math.min(100, Math.round((elapsed / total) * 100))
  }

  const inspColor = INSPECTION_COLORS[job.inspectionType]

  const itemProps = getItemProps({
    style: {
      background: 'transparent',
      border: 'none',
      borderRadius: '8px',
      boxShadow: isDragging ? '0 12px 40px rgba(0,0,0,0.6)' : 'none',
      overflow: 'hidden',
      cursor: isLocked ? 'not-allowed' : itemContext.canMove ? 'grab' : 'pointer',
      opacity: isDragging ? 0.88 : 1,
    },
    title: isLocked ? 'Job in progress — cannot reschedule' : undefined,
  })

  return (
    <div
      {...itemProps}
      onClick={(e) => {
        (itemProps as React.HTMLAttributes<HTMLDivElement>).onClick?.(e)
        onJobClick(item)
      }}
      className={cn(
        'timeline-card-dark h-full flex flex-col',
        (itemProps as React.HTMLAttributes<HTMLDivElement>).className
      )}
    >
      {/* Order-color left stripe */}
      <div
        className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-[8px]"
        style={{ background: item.isConflict ? '#ef4444' : item.orderColor }}
      />

      {isNarrow ? (
        /* ── Narrow card ── */
        <div className="flex flex-col h-full pl-2.5 pr-1.5 pt-1.5 pb-1 gap-0.5">
          <span className="timeline-card-order-num truncate">{order.orderNumber}</span>
          <span
            className="timeline-card-type-badge self-start"
            style={{ background: inspColor.bg, color: inspColor.text }}
          >
            {job.inspectionType}
          </span>
        </div>
      ) : (
        /* ── Full card ── */
        <div className="flex flex-col h-full pl-3 pr-2 pt-1.5 pb-0 gap-[1px]">
          {/* Row 1: order number + type badge + SIM + conflict */}
          <div className="flex items-center gap-1 min-w-0">
            <span className="timeline-card-order-num truncate flex-1 min-w-0">
              {order.orderNumber}
            </span>
            <span
              className="timeline-card-type-badge shrink-0"
              style={{ background: inspColor.bg, color: inspColor.text }}
            >
              {job.inspectionType}
            </span>
            {order.isSimulated && (
              <span className="sim-badge shrink-0 text-[7px] py-0 px-1">SIM</span>
            )}
            {item.isConflict && (
              <AlertTriangle className="h-2.5 w-2.5 text-red-400 shrink-0" />
            )}
          </div>

          {/* Row 2: customer + part */}
          <div className="flex items-center gap-1 min-w-0">
            <span className="timeline-card-customer truncate flex-1 min-w-0">
              {order.customer?.name ?? '—'}
            </span>
            <span className="timeline-card-part shrink-0">{order.partNumber}</span>
          </div>

          {/* Row 3: inspector + machine */}
          <div className="flex items-center gap-2 min-w-0 timeline-card-meta">
            {job.inspectorName ? (
              <span className="flex items-center gap-0.5 truncate">
                <User className="h-2 w-2 shrink-0 opacity-60" />
                <span className="truncate">{job.inspectorName}</span>
              </span>
            ) : (
              <span className="flex items-center gap-0.5 opacity-40">
                <User className="h-2 w-2 shrink-0" />
                <span>Unassigned</span>
              </span>
            )}
            {job.assignedMachineName && (
              <span className="flex items-center gap-0.5 truncate opacity-70">
                <Wrench className="h-2 w-2 shrink-0 opacity-60" />
                <span className="truncate">{job.assignedMachineName}</span>
              </span>
            )}
          </div>

          {/* Row 4 (bottom): due-date pill + duration + sequence badge */}
          <div className="flex items-center gap-1 mt-auto pb-1 min-w-0">
            <span className="flex items-center gap-0.5 timeline-card-meta opacity-60 shrink-0">
              <Clock className="h-2 w-2" />
              {job.durationMinutes}m
            </span>
            {order.dueDate && (
              <span
                className="timeline-card-due-pill shrink-0"
                style={{
                  background: due.overdue ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.18)',
                  color: due.overdue ? '#f87171' : '#fbbf24',
                }}
              >
                {due.text}
              </span>
            )}
            {item.orderSeq && (
              <span
                className="timeline-card-seq-badge shrink-0 ml-auto"
                style={{ borderColor: item.orderColor, color: item.orderColor }}
              >
                {item.orderSeq}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress bar (bottom of card) */}
      <div className="timeline-card-progress-track shrink-0">
        <div
          className="timeline-card-progress-fill"
          style={{
            width: `${progressPct}%`,
            background: job.status === 'in_progress' ? '#f97316' : item.orderColor,
          }}
        />
      </div>
    </div>
  )
}
