import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { cn } from '@/lib/utils'

interface Account {
  sf_id: string
  name: string
  market: string | null
  status: string | null
  type: string | null
  ytd_total: number | null
  payment_terms: string | null
  job_count: number
  region: string | null
  credit_hold: boolean | null
  faa_account: boolean | null
  top_10_account: boolean | null
}

interface JobActivity {
  sf_id: string
  row_type: 'job'
  work_order_number: string | null
  part_number: string | null
  services: string[] | null
  specification: string | null
  ndt_procedure: string | null
  acceptance_criteria: string | null
  invoice_amount: number | null
  date_received: string | null
  date_completed: string | null
  lab_status: string | null
  billing_status: string | null
  faa_job: boolean | null
  expedite: boolean | null
  date_due: string | null
  lab_notes: string | null
}

interface QuoteActivity {
  sf_id: string
  row_type: 'quote'
  quote_number: string | null
  part_numbers: string | null
  services_included: string[] | null
  grand_total: number | null
  status: string | null
  created_date: string | null
  expiration_date: string | null
}

type Activity = JobActivity | QuoteActivity

interface AccountDetail {
  account: Account
  activity: Activity[]
  jobCount: number
  quoteCount: number
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CustomerOrdersTab() {
  const [query, setQuery]           = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [accounts, setAccounts]     = useState<Account[]>([])
  const [loading, setLoading]       = useState(false)
  const [noSyncYet, setNoSyncYet]   = useState(false)
  const [selected, setSelected]     = useState<string | null>(null)
  const [detail, setDetail]         = useState<AccountDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 300)
    return () => clearTimeout(t)
  }, [query])

  // Fetch customer list
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard
    setLoading(true)
    const params = new URLSearchParams({ limit: '30' })
    if (debouncedQ) params.set('q', debouncedQ)
    fetch(`/api/ut/sf-analysis/customers?${params}`)
      .then(r => r.json())
      .then(data => {
        setAccounts(data.accounts ?? [])
        setNoSyncYet(data.noSyncYet === true)
      })
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false))
  }, [debouncedQ])

  // Fetch account activity when selection changes
  const loadDetail = useCallback((sfId: string) => {
    setDetailLoading(true)
    setDetail(null)
    fetch(`/api/ut/sf-analysis/customers/${sfId}/activity`)
      .then(r => r.json())
      .then(data => setDetail(data))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [])

  function selectAccount(sfId: string) {
    setSelected(sfId)
    loadDetail(sfId)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-280px)]">
      {/* Left — customer list */}
      <div className="lg:col-span-1 flex flex-col border rounded-lg overflow-hidden">
        <div className="p-3 border-b">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search customers…"
            className="h-8 text-sm"
          />
        </div>

        {noSyncYet && (
          <div className="flex items-center gap-2 mx-3 my-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            No Salesforce data synced yet
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No customers found</p>
          ) : (
            <ul className="divide-y">
              {accounts.map(a => (
                <li
                  key={a.sf_id}
                  onClick={() => selectAccount(a.sf_id)}
                  className={cn(
                    'px-3 py-2.5 cursor-pointer transition-colors',
                    selected === a.sf_id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted',
                  )}
                >
                  <div className="font-medium text-sm leading-tight">{a.name}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {a.market && (
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full font-medium',
                        selected === a.sf_id
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}>
                        {a.market}
                      </span>
                    )}
                    {a.status === 'Active' && (
                      <span className={cn(
                        'text-xs px-1.5 py-0.5 rounded-full font-medium',
                        selected === a.sf_id
                          ? 'bg-green-400/30 text-primary-foreground'
                          : 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400',
                      )}>
                        Active
                      </span>
                    )}
                    {a.credit_hold && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400">
                        Credit Hold
                      </span>
                    )}
                    {a.faa_account && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                        FAA
                      </span>
                    )}
                    <span className={cn(
                      'text-xs ml-auto',
                      selected === a.sf_id ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}>
                      {a.job_count} jobs
                    </span>
                  </div>
                  {a.region && (
                    <div className={cn(
                      'text-xs mt-0.5',
                      selected === a.sf_id ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}>
                      {a.region}
                    </div>
                  )}
                  {a.ytd_total != null && (
                    <div className={cn(
                      'text-xs mt-0.5',
                      selected === a.sf_id ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}>
                      YTD {fmt(a.ytd_total)}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Right — activity */}
      <div className="lg:col-span-2 border rounded-lg overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Select a customer to view activity</p>
          </div>
        ) : detailLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <>
            <div className="px-4 py-3 border-b shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{detail.account.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {detail.jobCount} jobs · {detail.quoteCount} quotes
                    {detail.account.ytd_total != null && ` · YTD ${fmt(detail.account.ytd_total)}`}
                  </p>
                </div>
                {detail.account.status === 'Active' && (
                  <Badge variant="outline" className="text-green-600 border-green-400 text-xs">Active</Badge>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {detail.activity.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No jobs or quotes found</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Identifier</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Part #</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Services</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Spec / Basis</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date In/Created</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date Out/Exp</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detail.activity.map(row => {
                      const isJob = row.row_type === 'job'
                      const job   = isJob ? (row as JobActivity) : null
                      const quote = !isJob ? (row as QuoteActivity) : null
                      const services = isJob
                        ? job!.services
                        : quote!.services_included

                      return (
                        <tr key={row.sf_id} className="hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] font-semibold',
                              isJob
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
                            )}>
                              {isJob ? 'Job' : 'Quote'}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {isJob ? job!.work_order_number : quote!.quote_number}
                          </td>
                          <td className="px-3 py-2">
                            {isJob ? job!.part_number : quote!.part_numbers}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-0.5">
                              {(services ?? []).map(s => (
                                <span key={s} className="px-1 py-0.5 bg-muted rounded text-[10px] font-medium">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-2 max-w-[120px] truncate" title={isJob ? (job!.specification ?? undefined) : undefined}>
                            {isJob ? job!.specification : null}
                          </td>
                          <td className="px-3 py-2">
                            {isJob ? (
                              <div className="flex flex-wrap gap-0.5">
                                {job!.lab_status && (
                                  <span className="px-1 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded text-[10px]">
                                    {job!.lab_status}
                                  </span>
                                )}
                                {job!.billing_status && (
                                  <span className="px-1 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded text-[10px]">
                                    {job!.billing_status}
                                  </span>
                                )}
                                {job!.faa_job && (
                                  <span className="px-1 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded text-[10px] font-semibold">
                                    FAA
                                  </span>
                                )}
                                {job!.expedite && (
                                  <span className="px-1 py-0.5 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 rounded text-[10px] font-semibold">
                                    Rush
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">{quote!.status}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {isJob ? fmtDate(job!.date_received) : fmtDate(quote!.created_date)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {isJob ? fmtDate(job!.date_completed) : fmtDate(quote!.expiration_date)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {isJob ? fmt(job!.invoice_amount) : fmt(quote!.grand_total)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">Failed to load activity</p>
          </div>
        )}
      </div>
    </div>
  )
}
