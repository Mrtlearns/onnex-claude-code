import { useState, useEffect, useCallback } from 'react'
import { sfAnalysisApi } from '@/lib/sfAnalysisApi'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { cn } from '@/lib/utils'

interface BomPart {
  account_sf_id: string
  account_name: string
  part_number: string
  revisions: string[] | null
  services: string[] | null
  specifications: string[] | null
  procedures: string[] | null
  acceptance_criteria: string[] | null
  job_count: number
  last_processed: string | null
  avg_invoice: number | null
  max_invoice: number | null
  last_specification: string | null
  last_technique: string | null
  last_acceptance_criteria: string | null
  last_services: string[] | null
}

interface Account {
  sf_id: string
  name: string
}

const SERVICES = ['All', 'RT', 'UT', 'MT', 'PT', 'ET', 'VT']

function fmt(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ArrayPill({ items }: { items: string[] | null }) {
  if (!items?.length) return <span className="text-muted-foreground">—</span>
  return (
    <span className="text-xs">
      <span>{items[0]}</span>
      {items.length > 1 && (
        <span className="ml-1 text-muted-foreground">+{items.length - 1}</span>
      )}
    </span>
  )
}

export default function PartsCatalogTab() {
  const [service, setService]         = useState('All')
  const [accountId, setAccountId]     = useState('all')
  const [query, setQuery]             = useState('')
  const [debouncedQ, setDebouncedQ]   = useState('')
  const [accounts, setAccounts]       = useState<Account[]>([])
  const [parts, setParts]             = useState<BomPart[]>([])
  const [total, setTotal]             = useState(0)
  const [offset, setOffset]           = useState(0)
  const [loading, setLoading]         = useState(false)
  const [expanded, setExpanded]       = useState<Set<string>>(new Set())

  const LIMIT = 50

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(query); setOffset(0) }, 300)
    return () => clearTimeout(t)
  }, [query])

  // Reset offset when filters change
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard
  useEffect(() => { setOffset(0) }, [service, accountId])

  // Fetch accounts for dropdown
  useEffect(() => {
    sfAnalysisApi.getAccounts(200)
      .then(data => setAccounts((data.accounts ?? []).map((a: Account) => ({ sf_id: a.sf_id, name: a.name }))))
      .catch(() => setAccounts([]))
  }, [])

  // Fetch parts
  const fetchParts = useCallback(() => {
    setLoading(true)
    sfAnalysisApi.getParts({
      limit: LIMIT,
      offset,
      ...(debouncedQ ? { q: debouncedQ } : {}),
      ...(service !== 'All' ? { service } : {}),
      ...(accountId !== 'all' ? { account: accountId } : {}),
    })
      .then(data => {
        setParts(data.items ?? [])
        setTotal(data.total ?? 0)
      })
      .catch(() => setParts([]))
      .finally(() => setLoading(false))
  }, [debouncedQ, service, accountId, offset])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard
  useEffect(() => { fetchParts() }, [fetchParts])

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) } else { next.add(key) }
      return next
    })
  }

  const start = total === 0 ? 0 : offset + 1
  const end   = Math.min(offset + LIMIT, total)

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={service} onValueChange={v => setService(v)}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue placeholder="Service" />
          </SelectTrigger>
          <SelectContent>
            {SERVICES.map(s => (
              <SelectItem key={s} value={s}>{s === 'All' ? 'All Services' : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={accountId} onValueChange={v => setAccountId(v)}>
          <SelectTrigger className="w-52 h-8 text-sm">
            <SelectValue placeholder="All Customers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Customers</SelectItem>
            {accounts.map(a => (
              <SelectItem key={a.sf_id} value={a.sf_id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search part number…"
          className="w-48 h-8 text-sm"
        />

        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? 'Loading…' : `Showing ${start}–${end} of ${total}`}
        </span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="w-6 px-2 py-2" />
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Part #</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Customer</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Services</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Specifications</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Procedures</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Jobs</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Avg Invoice</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Last Processed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : parts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No parts found
                  </td>
                </tr>
              ) : (
                parts.map(p => {
                  const key = `${p.account_sf_id}:${p.part_number}`
                  const isOpen = expanded.has(key)
                  return (
                    <>
                      <tr
                        key={key}
                        onClick={() => toggleExpand(key)}
                        className="cursor-pointer hover:bg-muted/30"
                      >
                        <td className="px-2 py-2 text-center text-muted-foreground">
                          {isOpen
                            ? <ChevronDown className="h-3 w-3 inline" />
                            : <ChevronRight className="h-3 w-3 inline" />}
                        </td>
                        <td className="px-3 py-2 font-mono font-medium">{p.part_number}</td>
                        <td className="px-3 py-2">{p.account_name}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-0.5">
                            {(p.services ?? []).map(s => (
                              <span key={s} className="px-1 py-0.5 bg-muted rounded text-[10px] font-medium">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2"><ArrayPill items={p.specifications} /></td>
                        <td className="px-3 py-2"><ArrayPill items={p.procedures} /></td>
                        <td className="px-3 py-2 text-right">{p.job_count}</td>
                        <td className="px-3 py-2 text-right">{fmt(p.avg_invoice)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.last_processed)}</td>
                      </tr>

                      {isOpen && (
                        <tr key={`${key}-detail`} className="bg-muted/20">
                          <td />
                          <td colSpan={8} className="px-3 py-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">Revisions</p>
                                <p>{p.revisions?.join(', ') || '—'}</p>
                              </div>
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">All Specifications</p>
                                <ul className="space-y-0.5">
                                  {p.specifications?.map((s, i) => <li key={i}>{s}</li>) ?? <li>—</li>}
                                </ul>
                              </div>
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">All Procedures</p>
                                <ul className="space-y-0.5">
                                  {p.procedures?.map((s, i) => <li key={i}>{s}</li>) ?? <li>—</li>}
                                </ul>
                              </div>
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">Acceptance Criteria</p>
                                <ul className="space-y-0.5">
                                  {p.acceptance_criteria?.map((s, i) => <li key={i}>{s}</li>) ?? <li>—</li>}
                                </ul>
                              </div>
                              <div className="md:col-span-4 pt-2 border-t">
                                <p className="font-medium text-muted-foreground mb-1">Last Used</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  <div>
                                    <p className="text-muted-foreground text-[10px] mb-0.5">Services</p>
                                    <p>{p.last_services?.join(', ') || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-[10px] mb-0.5">Specification</p>
                                    <p className="break-words">{p.last_specification || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-[10px] mb-0.5">Technique / Procedure</p>
                                    <p className="break-words">{p.last_technique || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-[10px] mb-0.5">Acceptance Criteria</p>
                                    <p className="break-words">{p.last_acceptance_criteria || '—'}</p>
                                  </div>
                                </div>
                              </div>
                              <div className={cn("md:col-span-4 flex gap-4 pt-2 border-t")}>
                                <span><span className="text-muted-foreground">Max Invoice: </span>{fmt(p.max_invoice)}</span>
                                <span><span className="text-muted-foreground">Avg Invoice: </span>{fmt(p.avg_invoice)}</span>
                                <span><span className="text-muted-foreground">Jobs: </span>{p.job_count}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button
            onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
            disabled={offset === 0}
            className="px-3 py-1 rounded border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span>Page {Math.floor(offset / LIMIT) + 1} of {Math.ceil(total / LIMIT)}</span>
          <button
            onClick={() => setOffset(o => o + LIMIT)}
            disabled={offset + LIMIT >= total}
            className="px-3 py-1 rounded border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
