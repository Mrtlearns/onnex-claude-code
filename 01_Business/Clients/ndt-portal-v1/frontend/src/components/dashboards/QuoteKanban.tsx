import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { quotesApi } from '@/lib/quotesApi'
import { getAuthHeaders } from '@/lib/api'
import { UtQuoteDetailDialog, RtQuoteDetailDialog, EmailQuoteDetailDialog } from '@/components/quotes/QuoteDetailPanel'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  LayoutDashboard,
  List,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  RefreshCw,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// ── Types ──────────────────────────────────────────────────────────────────────

type Source = 'api' | 'salesforce' | 'email' | 'portal'
type Status = 'calculated' | 'pending' | 'sent' | 'accepted' | 'rejected'
type EmailStatus = 'received' | 'checking' | 'needs_info' | 'processing' | 'quoted' | 'failed'
type AnyStatus = Status | EmailStatus
type QuoteType = 'ut' | 'rt' | 'email'
type SortKey = 'date-desc' | 'date-asc' | 'total-desc' | 'total-asc' | 'customer-asc'
type ViewMode = 'board' | 'list'
type SortField = 'quote_number' | 'customer_name' | 'quote_type' | 'grand_total' | 'source' | 'status' | 'created_at'

interface QuoteRow {
  id: string
  quote_number: string
  customer_name: string
  source: Source
  grand_total: number | string
  status: AnyStatus
  created_at: string
  intake_id?: string | null
  quote_type: QuoteType
  part_number?: string | null
  inspection_types?: string[] | null
  is_new_prospect?: boolean | null
}

// Maps email-specific statuses to the nearest Kanban column for board display
function emailStatusToColumn(s: AnyStatus): Status {
  const map: Record<EmailStatus, Status> = {
    received:   'calculated',
    checking:   'pending',
    needs_info: 'pending',
    processing: 'pending',
    quoted:     'sent',
    failed:     'rejected',
  }
  return (map as Record<string, Status>)[s] ?? (s as Status)
}

// ── Constants ──────────────────────────────────────────────────────────────────

const COLUMNS: { status: Status; label: string; color: string }[] = [
  { status: 'calculated', label: 'Received',   color: '#64748b' },
  { status: 'pending',    label: 'Quoting',    color: '#f59e0b' },
  { status: 'sent',       label: 'Sent',       color: '#3b82f6' },
  { status: 'accepted',   label: 'Accepted',   color: '#22c55e' },
  { status: 'rejected',   label: 'Rejected',   color: '#ef4444' },
]

const COLUMN_MAP = Object.fromEntries(COLUMNS.map(c => [c.status, c])) as Record<string, typeof COLUMNS[0]>

const POLL_INTERVAL = 10_000

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return `${Math.floor(diff)}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function srcBadgeClass(s: Source) {
  const map: Record<Source, string> = {
    api:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    salesforce: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    email:      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    portal:     'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  }
  return map[s]
}

function statusBadgeClass(s: AnyStatus) {
  const map: Record<string, string> = {
    calculated: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    pending:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    sent:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    accepted:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    rejected:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    // Email statuses
    received:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    checking:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    needs_info: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    processing: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    quoted:     'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    failed:     'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return map[s] ?? 'bg-slate-100 text-slate-600'
}

function sortQuotes(quotes: QuoteRow[], key: SortKey): QuoteRow[] {
  return [...quotes].sort((a, b) => {
    switch (key) {
      case 'date-desc':     return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'date-asc':      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'total-desc':    return Number(b.grand_total) - Number(a.grand_total)
      case 'total-asc':     return Number(a.grand_total) - Number(b.grand_total)
      case 'customer-asc':  return a.customer_name.localeCompare(b.customer_name)
    }
  })
}

async function patchQuoteStatus(quote: QuoteRow, newStatus: Status): Promise<void> {
  // Email quotes cannot be moved to UT/RT columns via Kanban
  if (quote.quote_type === 'email') return
  const url = quote.quote_type === 'ut'
    ? `/api/ut/quote/${quote.id}`
    : `/api/rt/quote/${quote.id}`
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ status: newStatus }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

// ── Toast ──────────────────────────────────────────────────────────────────────

interface ToastMsg { id: number; text: string; type: 'error' | 'info' }

function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const counter = useRef(0)

  const show = useCallback((text: string, type: ToastMsg['type'] = 'error') => {
    const id = ++counter.current
    setToasts(prev => [...prev, { id, text, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  return { toasts, show }
}

function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium pointer-events-auto',
            t.type === 'error'
              ? 'bg-red-600 text-white'
              : 'bg-slate-800 text-white dark:bg-slate-700',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────────

interface QuoteCardProps {
  quote: QuoteRow
  flashing: boolean
  isDragging?: boolean
  overlay?: boolean
}

const NDT_TYPE_PILL: Record<string, string> = {
  RT: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  UT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  ET: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  MT: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  PT: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  VT: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
}

function QuoteCard({ quote, flashing, isDragging, overlay }: QuoteCardProps) {
  const colStatus: Status = emailStatusToColumn(quote.status)
  const col = COLUMN_MAP[colStatus] ?? COLUMN_MAP.calculated
  const isEmail = quote.quote_type === 'email'
  const types = quote.inspection_types?.filter(Boolean) ?? []

  return (
    <div
      className={cn(
        'relative rounded-lg px-3 py-2.5 select-none transition-shadow',
        // Glassmorphism — dark
        'dark:border dark:bg-white/5 dark:border-white/10 dark:[backdrop-filter:blur(12px)]',
        // Glassmorphism — light
        'bg-white/75 border border-black/[0.08] [backdrop-filter:blur(12px)] shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
        // Hover elevation
        !isDragging && !overlay && 'hover:shadow-md dark:hover:shadow-white/5',
        // Dragging opacity
        isDragging && 'opacity-40',
        // Overlay (drag ghost) — stronger shadow
        overlay && 'shadow-xl rotate-2',
        // Flash ring
        flashing && 'animate-ring-flash',
      )}
      style={{ borderLeft: `4px solid ${col.color}` }}
    >
      {/* Row 1: quote number + source badge */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono font-bold text-xs tracking-tight truncate">{quote.quote_number}</span>
          {/* New prospect indicator */}
          {quote.is_new_prospect && (
            <UserPlus
              className="h-3 w-3 text-blue-500 shrink-0"
              title="New prospect — not in customer directory"
            />
          )}
        </div>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', srcBadgeClass(quote.source))}>
          {quote.source}
        </span>
      </div>

      {/* Row 2: customer */}
      <p className="text-xs text-muted-foreground truncate mb-1.5">{quote.customer_name}</p>

      {/* Row 3: total (hide for email — not priced yet) */}
      {!isEmail && (
        <p className="text-base font-bold tabular-nums leading-none mb-2">
          {fmt$(Number(quote.grand_total))}
        </p>
      )}

      {/* Row 3 (email): email status badge */}
      {isEmail && (
        <p className={cn(
          'text-[10px] px-1.5 py-0.5 rounded inline-block font-medium mb-2',
          statusBadgeClass(quote.status),
        )}>
          {String(quote.status).replace('_', ' ')}
        </p>
      )}

      {/* Row 4: type + inspection type pills + time + part */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide',
          quote.quote_type === 'ut'
            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
            : quote.quote_type === 'email'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
        )}>
          {quote.quote_type}
        </span>

        {/* NDT inspection type pills (email quotes) */}
        {types.map(t => (
          <span key={t} className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', NDT_TYPE_PILL[t] ?? '')}>
            {t}
          </span>
        ))}

        <span className="text-[10px] text-muted-foreground">{timeAgo(quote.created_at)}</span>
        {quote.part_number && (
          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[80px]">{quote.part_number}</span>
        )}
      </div>
    </div>
  )
}

// ── Draggable card wrapper ─────────────────────────────────────────────────────

function DraggableCard({ quote, flashing, onOpen }: { quote: QuoteRow; flashing: boolean; onOpen: (q: QuoteRow) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: quote.id })
  // Email quotes are view-only in the Kanban — no drag
  if (quote.quote_type === 'email') {
    return (
      <div className="cursor-pointer" onClick={() => onOpen(quote)}>
        <QuoteCard quote={quote} flashing={flashing} />
      </div>
    )
  }
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing"
      onClick={() => onOpen(quote)}
    >
      <QuoteCard quote={quote} flashing={flashing} isDragging={isDragging} />
    </div>
  )
}

// ── Droppable column ───────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  color,
  quotes,
  flashingIds,
  onOpen,
}: {
  status: Status
  label: string
  color: string
  quotes: QuoteRow[]
  flashingIds: Set<string>
  onOpen: (q: QuoteRow) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const colTotal = quotes.reduce((s, q) => s + Number(q.grand_total), 0)

  return (
    <div className="flex flex-col min-w-[220px] w-full max-w-[280px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-semibold">{label}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
            {quotes.length}
          </span>
          {quotes.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">{fmt$(colTotal)}</span>
          )}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-lg p-2 space-y-2 min-h-[120px] transition-colors',
          'bg-muted/30 border border-border/50',
          isOver && 'bg-primary/5 border-primary/30',
        )}
      >
        {quotes.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50 border border-dashed border-border/40 rounded-md">
            Drop here
          </div>
        ) : (
          quotes.map(q => (
            <DraggableCard key={q.id} quote={q} flashing={flashingIds.has(q.id)} onOpen={onOpen} />
          ))
        )}
      </div>
    </div>
  )
}

// ── List view ──────────────────────────────────────────────────────────────────

type ListSortDir = 'asc' | 'desc'

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: ListSortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
  return sortDir === 'asc'
    ? <ChevronUp className="h-3 w-3 text-primary" />
    : <ChevronDown className="h-3 w-3 text-primary" />
}

function Th({ field, label, right, sortField, sortDir, toggleSort }: {
  field: SortField
  label: string
  right?: boolean
  sortField: SortField
  sortDir: ListSortDir
  toggleSort: (f: SortField) => void
}) {
  return (
    <th
      className={cn(
        'px-3 py-2.5 text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer select-none whitespace-nowrap',
        right && 'text-right',
      )}
      onClick={() => toggleSort(field)}
    >
      <span className="flex items-center gap-1 group">
        {label}
        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
      </span>
    </th>
  )
}

function ListTable({
  quotes,
  flashingIds,
  onStatusChange,
}: {
  quotes: QuoteRow[]
  flashingIds: Set<string>
  onStatusChange: (quote: QuoteRow, newStatus: Status) => void
}) {
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir]     = useState<ListSortDir>('desc')
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const sorted = useMemo(() => {
    return [...quotes].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'quote_number':   cmp = a.quote_number.localeCompare(b.quote_number); break
        case 'customer_name':  cmp = a.customer_name.localeCompare(b.customer_name); break
        case 'quote_type':     cmp = a.quote_type.localeCompare(b.quote_type); break
        case 'grand_total':    cmp = Number(a.grand_total) - Number(b.grand_total); break
        case 'source':         cmp = a.source.localeCompare(b.source); break
        case 'status':         cmp = a.status.localeCompare(b.status); break
        case 'created_at':     cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [quotes, sortField, sortDir])

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden [backdrop-filter:blur(12px)] bg-white/75 dark:bg-white/5 dark:border-white/10">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border/50 bg-muted/30">
            <tr>
              <Th field="quote_number"  label="Quote #"  sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} />
              <Th field="customer_name" label="Customer" sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} />
              <Th field="quote_type"    label="Type"     sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} />
              <Th field="grand_total"   label="Total"    sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} right />
              <Th field="source"        label="Source"   sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} />
              <Th field="status"        label="Status"   sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} />
              <Th field="created_at"    label="Created"  sortField={sortField} sortDir={sortDir} toggleSort={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {sorted.map((q, idx) => (
              <tr
                key={q.id}
                className={cn(
                  'transition-colors hover:bg-muted/40',
                  idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/10',
                  flashingIds.has(q.id) && 'animate-ring-flash',
                )}
              >
                <td className="px-3 py-2.5 font-mono font-medium text-xs">{q.quote_number}</td>
                <td className="px-3 py-2.5 max-w-[160px] truncate text-xs">{q.customer_name}</td>
                <td className="px-3 py-2.5">
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wide',
                    q.quote_type === 'ut'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
                  )}>
                    {q.quote_type}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums text-xs">{fmt$(Number(q.grand_total))}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', srcBadgeClass(q.source))}>
                    {q.source}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="relative">
                    <button
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity',
                        statusBadgeClass(q.status),
                      )}
                      onClick={() => setOpenDropdown(openDropdown === q.id ? null : q.id)}
                    >
                      {q.status}
                    </button>
                    {openDropdown === q.id && (
                      <div className="absolute z-30 top-6 left-0 bg-popover border border-border rounded-md shadow-lg py-1 min-w-[130px]">
                        {COLUMNS.map(col => (
                          <button
                            key={col.status}
                            className={cn(
                              'w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2',
                              col.status === q.status && 'bg-muted/50',
                            )}
                            onClick={() => {
                              setOpenDropdown(null)
                              if (col.status !== q.status) onStatusChange(q, col.status)
                            }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.color }} />
                            {col.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(q.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No quotes match your filters.</div>
        )}
      </div>
    </div>
  )
}

// ── Filter bar ─────────────────────────────────────────────────────────────────

interface FilterState {
  search: string
  source: Source | 'all'
  type: QuoteType | 'all'
  status: Status | 'all'
}

function FilterBar({
  filters,
  onChange,
  showStatus,
}: {
  filters: FilterState
  onChange: (f: FilterState) => void
  showStatus: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="pl-8 h-8 text-xs"
          placeholder="Search quote # or customer…"
          value={filters.search}
          onChange={e => onChange({ ...filters, search: e.target.value })}
        />
      </div>

      <Select
        value={filters.source}
        onValueChange={v => onChange({ ...filters, source: v as Source | 'all' })}
      >
        <SelectTrigger className="h-8 w-[130px] text-xs">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="api">API</SelectItem>
          <SelectItem value="salesforce">Salesforce</SelectItem>
          <SelectItem value="email">Email</SelectItem>
          <SelectItem value="portal">Portal</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.type}
        onValueChange={v => onChange({ ...filters, type: v as QuoteType | 'all' })}
      >
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="ut">UT</SelectItem>
          <SelectItem value="rt">RT</SelectItem>
        </SelectContent>
      </Select>

      {showStatus && (
        <Select
          value={filters.status}
          onValueChange={v => onChange({ ...filters, status: v as Status | 'all' })}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {COLUMNS.map(c => (
              <SelectItem key={c.status} value={c.status}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

// ── QuoteKanban ────────────────────────────────────────────────────────────────

export default function QuoteKanban() {
  const [quotes, setQuotes]           = useState<QuoteRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [view, setView]               = useState<ViewMode>('board')
  const [sort, setSort]               = useState<SortKey>('date-desc')
  const [filters, setFilters]         = useState<FilterState>({ search: '', source: 'all', type: 'all', status: 'all' })
  const [flashingIds, setFlashingIds]   = useState<Set<string>>(new Set())
  const [activeDrag, setActiveDrag]     = useState<QuoteRow | null>(null)
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null)
  const [selectedQuote, setSelectedQuote] = useState<QuoteRow | null>(null)

  const prevQuotesRef = useRef<Map<string, Status>>(new Map())
  const { toasts, show: showToast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  // ── Fetch ──────────────────────────────────────────────────────

  const fetchQuotes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data: QuoteRow[] = await quotesApi.list()

      // Detect external status changes
      if (prevQuotesRef.current.size > 0) {
        const changed = new Set<string>()
        for (const q of data) {
          const prev = prevQuotesRef.current.get(q.id)
          if (prev !== undefined && prev !== q.status) {
            changed.add(q.id)
          }
        }
        if (changed.size > 0) {
          setFlashingIds(prev => new Set([...prev, ...changed]))
          setTimeout(() => {
            setFlashingIds(prev => {
              const next = new Set(prev)
              changed.forEach(id => next.delete(id))
              return next
            })
          }, 2200)
        }
      }

      prevQuotesRef.current = new Map(data.map(q => [q.id, q.status]))
      setQuotes(data)
      setLastRefresh(new Date())
    } catch {
      if (!silent) showToast('Failed to load quotes', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    fetchQuotes()
    const id = setInterval(() => fetchQuotes(true), POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchQuotes])

  // ── Status update ──────────────────────────────────────────────

  const updateStatus = useCallback(async (quote: QuoteRow, newStatus: Status) => {
    // Optimistic update
    setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: newStatus } : q))
    try {
      await patchQuoteStatus(quote, newStatus)
    } catch {
      // Revert
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: quote.status } : q))
      showToast(`Failed to update ${quote.quote_number} — reverted`, 'error')
    }
  }, [showToast])

  // ── DnD handlers ───────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const found = quotes.find(q => q.id === event.active.id)
    setActiveDrag(found ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDrag(null)
    const { active, over } = event
    if (!over) return
    const quote = quotes.find(q => q.id === active.id)
    if (!quote) return
    const newStatus = over.id as Status
    if (newStatus === quote.status) return
    updateStatus(quote, newStatus)
  }

  // ── Filter + sort ──────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = filters.search.toLowerCase()
    return quotes.filter(r => {
      if (q && !r.quote_number.toLowerCase().includes(q) && !r.customer_name.toLowerCase().includes(q)) return false
      if (filters.source !== 'all' && r.source !== filters.source) return false
      if (filters.type !== 'all' && r.quote_type !== filters.type) return false
      if (view === 'list' && filters.status !== 'all' && r.status !== filters.status) return false
      return true
    })
  }, [quotes, filters, view])

  const sorted = useMemo(() => sortQuotes(filtered, sort), [filtered, sort])

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="px-4 py-4 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Quotes</h2>
          {lastRefresh && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Refreshed {timeAgo(lastRefresh.toISOString())}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Sort */}
          <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Date (Newest first)</SelectItem>
              <SelectItem value="date-asc">Date (Oldest first)</SelectItem>
              <SelectItem value="total-desc">Total (High → Low)</SelectItem>
              <SelectItem value="total-asc">Total (Low → High)</SelectItem>
              <SelectItem value="customer-asc">Customer (A → Z)</SelectItem>
            </SelectContent>
          </Select>

          {/* Manual refresh */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => fetchQuotes()}
            title="Refresh now"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          {/* View toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              className={cn(
                'px-2.5 py-1.5 flex items-center gap-1.5 text-xs transition-colors',
                view === 'board'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground',
              )}
              onClick={() => setView('board')}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              className={cn(
                'px-2.5 py-1.5 flex items-center gap-1.5 text-xs transition-colors border-l border-border',
                view === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground',
              )}
              onClick={() => setView('list')}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} showStatus={view === 'list'} />

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="text-sm">Loading quotes…</span>
          </div>
        </div>
      ) : view === 'board' ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 pb-4 min-w-max">
              {COLUMNS.map(col => {
                const colQuotes = sorted.filter(q => emailStatusToColumn(q.status) === col.status)
                return (
                  <KanbanColumn
                    key={col.status}
                    status={col.status}
                    label={col.label}
                    color={col.color}
                    quotes={colQuotes}
                    flashingIds={flashingIds}
                    onOpen={setSelectedQuote}
                  />
                )
              })}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDrag && (
              <QuoteCard quote={activeDrag} flashing={false} overlay />
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <ListTable
            quotes={sorted}
            flashingIds={flashingIds}
            onStatusChange={updateStatus}
          />
        </div>
      )}

      <ToastContainer toasts={toasts} />

      {/* Quote detail modal */}
      {selectedQuote && selectedQuote.quote_type === 'ut' && (
        <UtQuoteDetailDialog
          id={selectedQuote.id}
          onClose={() => { setSelectedQuote(null); fetchQuotes(true) }}
        />
      )}
      {selectedQuote && selectedQuote.quote_type === 'rt' && (
        <RtQuoteDetailDialog
          id={selectedQuote.id}
          onClose={() => { setSelectedQuote(null); fetchQuotes(true) }}
        />
      )}
      {selectedQuote && selectedQuote.quote_type === 'email' && (
        <EmailQuoteDetailDialog
          id={selectedQuote.id}
          onClose={() => { setSelectedQuote(null); fetchQuotes(true) }}
        />
      )}
    </div>
  )
}
