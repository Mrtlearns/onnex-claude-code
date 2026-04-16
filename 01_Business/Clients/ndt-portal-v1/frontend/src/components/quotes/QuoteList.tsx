import { Input } from '@/components/ui/input'
import { Search, ExternalLink, ScrollText } from 'lucide-react'
import { type QuoteRow, type Source, type Status, type QuoteType, SOURCE_STYLE, STATUS_STYLE, fmt, fmtDate } from './QuoteDetailPanel'

interface QuoteListProps {
  quotes: QuoteRow[]
  filtered: QuoteRow[]
  search: string
  filterSource: string
  filterStatus: string
  filterType: string
  onSearchChange: (v: string) => void
  onFilterSourceChange: (v: string) => void
  onFilterStatusChange: (v: string) => void
  onFilterTypeChange: (v: string) => void
  onSelectQuote: (id: string, type: QuoteType) => void
  onAuditClick: (intakeId: string) => void
}

export default function QuoteList({
  quotes, filtered,
  search, filterSource, filterStatus, filterType,
  onSearchChange, onFilterSourceChange, onFilterStatusChange, onFilterTypeChange,
  onSelectQuote, onAuditClick,
}: QuoteListProps) {
  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Customer, quote # or part…" className="pl-8" value={search} onChange={e => onSearchChange(e.target.value)} />
        </div>
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={filterType} onChange={e => onFilterTypeChange(e.target.value)}>
          <option value="all">All types</option>
          <option value="ut">UT</option>
          <option value="rt">RT</option>
        </select>
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={filterSource} onChange={e => onFilterSourceChange(e.target.value)}>
          <option value="all">All sources</option>
          <option value="portal">Portal</option>
          <option value="api">API</option>
          <option value="salesforce">Salesforce</option>
          <option value="email">Email</option>
        </select>
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={filterStatus} onChange={e => onFilterStatusChange(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="calculated">Calculated</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="border rounded-lg py-16 text-center text-muted-foreground">
          {quotes.length === 0 ? 'No quotes yet.' : 'No quotes match filters.'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Quote #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Pipeline</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map(q => (
                <tr key={`${q.quote_type}-${q.id}`}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => onSelectQuote(q.id, q.quote_type)}
                >
                  <td className="px-4 py-3 font-mono font-medium">{q.quote_number}</td>
                  <td className="px-4 py-3">
                    {q.customer_name}
                    {q.part_number && <span className="ml-1 text-xs text-muted-foreground">({q.part_number})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${q.quote_type === 'rt' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                      {q.quote_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SOURCE_STYLE[q.source as Source] ?? 'bg-slate-100 text-slate-700'}`}>{q.source}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[q.status as Status] ?? 'bg-slate-100 text-slate-700'}`}>{q.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(q.grand_total)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(q.created_at)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {q.intake_id && (
                      <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline" title="View pipeline audit log" onClick={() => onAuditClick(q.intake_id!)}>
                        <ScrollText className="h-3.5 w-3.5" />Audit
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground"><ExternalLink className="h-3.5 w-3.5" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
