import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, ArrowUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import dayjs from 'dayjs'
import type { WorkshopOrder, WorkshopJob, InspectionType } from '@/lib/workshop/types'
import { INSPECTION_TYPES, INSPECTION_COLORS } from '@/lib/workshop/constants'

interface CompletedTrayProps {
  completedJobs: Array<{ order: WorkshopOrder; job: WorkshopJob }>
  onJobClick?: (order: WorkshopOrder, job: WorkshopJob) => void
}

type SortKey = 'completedAt' | 'dueDate' | 'priority' | 'customer' | 'type'
type DateFilter = 'today' | 'week' | 'all'

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

export function CompletedTray({ completedJobs, onJobClick }: CompletedTrayProps) {
  const [expanded, setExpanded] = useState(true)
  const [typeFilter, setTypeFilter] = useState<Set<InspectionType>>(new Set())
  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('completedAt')
  const [sortAsc, setSortAsc] = useState(false)

  // Summary: count by inspection type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const { job } of completedJobs) {
      counts[job.inspectionType] = (counts[job.inspectionType] ?? 0) + 1
    }
    return counts
  }, [completedJobs])

  // Filter + sort
  const filtered = useMemo(() => {
    const now = dayjs()
    const todayStart = now.startOf('day')
    const weekStart = now.startOf('week')

    return completedJobs
      .filter(({ order, job }) => {
        // Type filter
        if (typeFilter.size > 0 && !typeFilter.has(job.inspectionType)) return false
        // Date filter
        const completedAt = job.actualEnd ? dayjs(job.actualEnd) : null
        if (dateFilter === 'today' && completedAt && completedAt.isBefore(todayStart)) return false
        if (dateFilter === 'week' && completedAt && completedAt.isBefore(weekStart)) return false
        // Search
        if (search) {
          const q = search.toLowerCase()
          const hit =
            order.orderNumber.toLowerCase().includes(q) ||
            (order.customer?.name ?? '').toLowerCase().includes(q) ||
            order.partNumber.toLowerCase().includes(q) ||
            (job.inspectorName ?? '').toLowerCase().includes(q)
          if (!hit) return false
        }
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        switch (sortKey) {
          case 'completedAt': {
            const ta = a.job.actualEnd ? dayjs(a.job.actualEnd).valueOf() : 0
            const tb = b.job.actualEnd ? dayjs(b.job.actualEnd).valueOf() : 0
            cmp = ta - tb
            break
          }
          case 'dueDate': {
            const ta = a.order.dueDate ? dayjs(a.order.dueDate).valueOf() : Infinity
            const tb = b.order.dueDate ? dayjs(b.order.dueDate).valueOf() : Infinity
            cmp = ta - tb
            break
          }
          case 'priority':
            cmp = (PRIORITY_RANK[a.order.priority] ?? 2) - (PRIORITY_RANK[b.order.priority] ?? 2)
            break
          case 'customer':
            cmp = (a.order.customer?.name ?? '').localeCompare(b.order.customer?.name ?? '')
            break
          case 'type':
            cmp = a.job.inspectionType.localeCompare(b.job.inspectionType)
            break
        }
        return sortAsc ? cmp : -cmp
      })
  }, [completedJobs, typeFilter, dateFilter, search, sortKey, sortAsc])

  function toggleType(t: InspectionType) {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(false) }
  }

  function SortTh({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col
    return (
      <th onClick={() => handleSort(col)}>
        <span className="flex items-center gap-1">
          {label}
          <ArrowUpDown className={cn('h-2.5 w-2.5', active ? 'opacity-100' : 'opacity-30')} />
        </span>
      </th>
    )
  }

  return (
    <div className="border-t border-[var(--ws-lane-border)] bg-[var(--ws-bg-secondary)] shrink-0">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2',
          'text-xs font-semibold text-[var(--ws-text-secondary)]',
          'hover:bg-[var(--ws-glass-bg)] transition-colors'
        )}
      >
        <div className="flex items-center gap-3">
          <span>COMPLETED</span>
          <span className="text-[var(--ws-text-muted)] font-normal">
            {filtered.length} of {completedJobs.length} job{completedJobs.length !== 1 ? 's' : ''}
          </span>
          {/* Type summary badges */}
          <div className="ws-completed-summary-strip">
            {INSPECTION_TYPES.filter((t) => typeCounts[t]).map((t) => (
              <span key={t} className="ws-completed-summary-badge">
                {t}: {typeCounts[t]}
              </span>
            ))}
          </div>
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>

      {expanded && (
        <>
          {/* Filter bar */}
          <div className="ws-completed-filter-bar">
            {/* Type toggles */}
            {INSPECTION_TYPES.map((t) => {
              const c = INSPECTION_COLORS[t]
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={cn('ws-completed-type-pill', typeFilter.has(t) || typeFilter.size === 0 ? 'active' : '')}
                  style={{ background: c.bg, color: c.text }}
                >
                  {t}
                </button>
              )
            })}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Date range */}
            <div className="flex items-center gap-0.5 bg-[var(--ws-glass-bg)] rounded-md border border-[var(--ws-lane-border)] overflow-hidden text-[10px]">
              {(['today', 'week', 'all'] as DateFilter[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className={cn(
                    'px-2.5 py-1 font-medium capitalize transition-colors',
                    dateFilter === d
                      ? 'bg-[var(--ws-accent)] text-white'
                      : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
                  )}
                >
                  {d === 'week' ? 'This Week' : d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-1.5 bg-[var(--ws-glass-bg)] border border-[var(--ws-lane-border)] rounded-md px-2 py-1">
              <Search className="h-3 w-3 text-[var(--ws-text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="bg-transparent text-[10px] text-[var(--ws-text-primary)] placeholder-[var(--ws-text-muted)] outline-none w-28"
              />
            </div>
          </div>

          {/* Table */}
          {completedJobs.length === 0 ? (
            <div className="px-4 py-4 text-xs text-[var(--ws-text-muted)] italic">
              No completed jobs yet today
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-4 text-xs text-[var(--ws-text-muted)] italic">
              No jobs match the current filters
            </div>
          ) : (
            <div className="overflow-x-auto max-h-52 overflow-y-auto">
              <table className="ws-completed-table">
                <thead>
                  <tr>
                    <SortTh label="Order" col="completedAt" />
                    <SortTh label="Customer" col="customer" />
                    <th>Part #</th>
                    <SortTh label="Type" col="type" />
                    <th>Inspector</th>
                    <th>Completed</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(({ order, job }) => {
                    const c = INSPECTION_COLORS[job.inspectionType]
                    const completedAt = job.actualEnd
                      ? dayjs(job.actualEnd).format('HH:mm')
                      : '—'
                    const actualDuration =
                      job.actualStart && job.actualEnd
                        ? Math.round(
                            (dayjs(job.actualEnd).valueOf() - dayjs(job.actualStart).valueOf()) / 60_000
                          )
                        : null

                    return (
                      <tr key={job.id} onClick={() => onJobClick?.(order, job)}>
                        <td>{order.orderNumber}</td>
                        <td className="text-[var(--ws-text-secondary)]">
                          {order.customer?.name ?? '—'}
                        </td>
                        <td className="font-mono text-[9px] text-[var(--ws-text-muted)]">
                          {order.partNumber}
                        </td>
                        <td>
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-mono"
                            style={{ background: c.bg, color: c.text }}
                          >
                            {job.inspectionType}
                          </span>
                        </td>
                        <td className="text-[var(--ws-text-muted)]">
                          {job.inspectorName ?? '—'}
                        </td>
                        <td className="font-mono text-[10px]">{completedAt}</td>
                        <td className="font-mono text-[10px] text-[var(--ws-text-muted)]">
                          {actualDuration != null ? `${actualDuration}m` : `${job.durationMinutes}m`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
