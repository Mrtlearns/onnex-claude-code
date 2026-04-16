import { useEffect } from 'react'
import { X, User, Calendar, Clock, Package, Hash, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkshopOrder, WorkshopJob, Priority } from '@/lib/workshop/types'
import { PRIORITY_COLORS, STATUS_COLORS, STATUS_LABELS } from '@/lib/workshop/constants'
import { formatRelativeDue } from '@/lib/workshop/schedulingUtils'

interface JobDetailModalProps {
  order: WorkshopOrder
  job: WorkshopJob
  onClose: () => void
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function duration(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return '—'
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  const mins = Math.round(ms / 60000)
  return `${mins} min`
}

export function JobDetailModal({ order, job, onClose }: JobDetailModalProps) {
  const priorityColor = PRIORITY_COLORS[order.priority as Priority]
  const statusColor = STATUS_COLORS[job.status]
  const due = formatRelativeDue(order.dueDate)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)]',
          'rounded-xl max-w-lg w-full shadow-2xl max-h-[85vh] overflow-y-auto',
          'ws-card-enter'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-[var(--ws-lane-border)]">
          <div className="flex items-center gap-3">
            <span
              className={`inspection-icon inspection-icon--${job.status.replace('_', '-')} text-base px-3 py-1`}
            >
              {job.inspectionType}
            </span>
            <div>
              <div className="font-mono font-bold text-base text-[var(--ws-text-primary)]">
                {order.orderNumber}
              </div>
              <div className="text-xs text-[var(--ws-text-muted)] mt-0.5">
                {order.customer?.name ?? 'No customer'} — {order.partNumber}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)] hover:bg-[var(--ws-glass-bg-hover)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status + priority row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`status-pill status-pill--${job.status.replace('_', '-')}`}
              style={{ background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}40` }}
            >
              {STATUS_LABELS[job.status]}
            </span>
            <span
              className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{ background: `${priorityColor}20`, color: priorityColor }}
            >
              ● {order.priority.charAt(0).toUpperCase() + order.priority.slice(1)} priority
            </span>
            {order.isSimulated && (
              <span className="sim-badge">SIM</span>
            )}
            {job.schedulingMode === 'manual' && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30">
                Manually placed
              </span>
            )}
          </div>

          {/* Inspection sequence */}
          <div>
            <div className="text-[10px] font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider mb-2">
              Inspection Sequence
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {order.workshopJobs.map((j) => (
                <span
                  key={j.id}
                  className={cn(
                    `inspection-icon inspection-icon--${j.status.replace('_', '-')}`,
                    j.id === job.id && 'ring-2 ring-[var(--ws-accent)] ring-offset-1 ring-offset-[var(--ws-bg-secondary)]'
                  )}
                  title={j.inspectionType}
                >
                  {j.inspectionType}
                </span>
              ))}
            </div>
          </div>

          {/* Two-column detail grid */}
          <div className="grid grid-cols-2 gap-4">
            <DetailItem icon={User} label="Inspector">
              {job.inspectorName ?? 'Unassigned'}
            </DetailItem>
            <DetailItem icon={Calendar} label="Due date">
              <span className={due.overdue ? 'text-[#ef4444]' : undefined}>
                {due.text}
              </span>
            </DetailItem>
            <DetailItem icon={Clock} label="Est. duration">
              {job.durationMinutes} min
            </DetailItem>
            <DetailItem icon={Package} label="Qty">
              {order.quantity} {order.quantity === 1 ? 'piece' : 'pieces'}
            </DetailItem>
          </div>

          {/* Scheduling block */}
          <div className="rounded-lg bg-[var(--ws-bg-primary)] border border-[var(--ws-lane-border)] p-4 space-y-2">
            <div className="text-[10px] font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider mb-3">
              Schedule
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-[var(--ws-text-muted)]">Scheduled start</span>
                <div className="text-[var(--ws-text-primary)] font-mono mt-0.5">{fmt(job.scheduledStart)}</div>
              </div>
              <div>
                <span className="text-[var(--ws-text-muted)]">Scheduled end</span>
                <div className="text-[var(--ws-text-primary)] font-mono mt-0.5">{fmt(job.scheduledEnd)}</div>
              </div>
              {job.actualStart && (
                <>
                  <div>
                    <span className="text-[var(--ws-text-muted)]">Actual start</span>
                    <div className="text-[var(--ws-text-primary)] font-mono mt-0.5">{fmt(job.actualStart)}</div>
                  </div>
                  <div>
                    <span className="text-[var(--ws-text-muted)]">Actual end</span>
                    <div className="text-[var(--ws-text-primary)] font-mono mt-0.5">{fmt(job.actualEnd)}</div>
                  </div>
                  <div>
                    <span className="text-[var(--ws-text-muted)]">Actual duration</span>
                    <div className="text-[var(--ws-text-primary)] font-mono mt-0.5">{duration(job.actualStart, job.actualEnd)}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {(job.notes || order.notes) && (
            <div className="rounded-lg bg-[var(--ws-bg-primary)] border border-[var(--ws-lane-border)] p-4">
              <div className="text-[10px] font-semibold text-[var(--ws-text-muted)] uppercase tracking-wider mb-2">Notes</div>
              {order.notes && (
                <p className="text-xs text-[var(--ws-text-secondary)] mb-1">
                  <span className="text-[var(--ws-text-muted)]">Order: </span>{order.notes}
                </p>
              )}
              {job.notes && (
                <p className="text-xs text-[var(--ws-text-secondary)]">
                  <span className="text-[var(--ws-text-muted)]">Job: </span>{job.notes}
                </p>
              )}
            </div>
          )}

          {/* Overdue warning */}
          {due.overdue && (
            <div className="flex items-center gap-2 text-xs text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Order is past due — {due.text}
            </div>
          )}

          {/* IDs (footer) */}
          <div className="text-[10px] font-mono text-[var(--ws-text-muted)] flex items-center gap-2 pt-1 border-t border-[var(--ws-lane-border)]">
            <Hash className="h-3 w-3" />
            <span>Job {job.id.slice(0, 8)}…</span>
            <span className="opacity-40">|</span>
            <span>Order {order.id.slice(0, 8)}…</span>
          </div>
        </div>
      </div>
    </div>
  )
}

interface DetailItemProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}

function DetailItem({ icon: Icon, label, children }: DetailItemProps) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-[var(--ws-text-muted)] mt-0.5 shrink-0" />
      <div>
        <div className="text-[10px] text-[var(--ws-text-muted)] uppercase tracking-wider">{label}</div>
        <div className="text-sm text-[var(--ws-text-primary)] mt-0.5">{children}</div>
      </div>
    </div>
  )
}
