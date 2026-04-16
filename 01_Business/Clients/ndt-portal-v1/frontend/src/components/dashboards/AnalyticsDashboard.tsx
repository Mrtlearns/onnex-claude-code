import { useEffect, useState, useCallback, useRef } from 'react'
import { adminApi } from '@/lib/adminApi'
import {
  DollarSign, Users, Briefcase, TrendingUp,
  BarChart2, Layers, RefreshCw, Activity,
  Clock, AlertTriangle, X,
} from 'lucide-react'
import AnalyticsCharts, {
  buildYoyData, pivotToWide, computeProjection,
  fmt, fmtPct, GlassCard,
} from './AnalyticsCharts'
import AiAssistant from './AiAssistant'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface AnalyticsResponse {
  period: { start: string; end: string }
  kpis: {
    sfTotalRevenue: number
    activeAccounts: number
    totalSfJobs: number
    quoteWinRate: number
    avgAcceptedQuote: number
    pipelineValue: number
    lastSync: { at: string; status: string; summary: string } | null
    momGrowth: number | null
    wipJobCount: number
    wipBacklogValue: number
    quotesExpiring30d: number
    quotesStale: number
  }
  quoteTrend:          Array<{ month: string; utCount: number; rtCount: number; utRevenue: number; rtRevenue: number }>
  statusDist:          Array<{ status: string; count: number; value: number }>
  sourceDist:          Array<{ source: string; count: number }>
  topCustomers:        Array<{ name: string; quoteCount: number; totalValue: number }>
  sfRevenueTrend:      Array<{ month: string; revenue: number; jobCount: number }>
  sfServiceMix:        Array<{ service: string; count: number; revenue: number }>
  sfMarkets:           Array<{ market: string; count: number; ytd: number }>
  winRateTrend:        Array<{ month: string; accepted: number; total: number; winRate: number }>
  yoyRevenue:          Array<{ year: number; month: number; revenue: number; jobCount: number }>
  topAccounts:         Array<{ name: string; jobCount: number; lifetimeRevenue: number; avgInvoice: number }>
  turnaroundTrend:     Array<{ month: string; avgDays: number; jobCount: number }>
  serviceRevenueTrend: Array<{ month: string; service: string; revenue: number }>
  avgInvoiceByService: Array<{ service: string; jobCount: number; avgInvoice: number; totalRevenue: number }>
  marketRevenueTrend:  Array<{ month: string; market: string; revenue: number; jobCount: number }>
  quoteVariance:       Array<{ account: string; avgQuoted: number; avgInvoiced: number; avgVariance: number; sampleCount: number }>
  procedureBreakdown:  Array<{ procedure: string; jobCount: number; revenue: number }>
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'area'
  title: string
  data: Array<Record<string, string | number>>
  xKey: string
  yKeys: Array<{ key: string; label: string; color?: string }>
}

type SyncStatus = 'idle' | 'queued' | 'syncing'

interface SelectedDimension {
  type: 'service' | 'market' | 'account' | null
  value: string | null
}

type DatePreset = '7d' | '30d' | '90d' | 'ytd' | 'lastyear' | 'all' | 'custom'

interface DateRange {
  preset: DatePreset
  start: string
  end: string
}

function toISO(d: Date) { return d.toISOString().slice(0, 10) }

function presetRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date()
  const end = toISO(now)
  if (preset === '7d')       return { start: toISO(new Date(now.getTime() - 7  * 86400000)), end }
  if (preset === '30d')      return { start: toISO(new Date(now.getTime() - 30 * 86400000)), end }
  if (preset === '90d')      return { start: toISO(new Date(now.getTime() - 90 * 86400000)), end }
  if (preset === 'ytd')      return { start: `${now.getFullYear()}-01-01`, end }
  if (preset === 'lastyear') return { start: `${now.getFullYear() - 1}-01-01`, end: `${now.getFullYear() - 1}-12-31` }
  if (preset === 'all')      return { start: '2000-01-01', end }
  return { start: toISO(new Date(now.getTime() - 30 * 86400000)), end }
}

function readUrlRange(): DateRange | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const preset = params.get('preset') as DatePreset | null
  const start  = params.get('start')
  const end    = params.get('end')
  if (preset && preset !== 'custom') return { preset, ...presetRange(preset) }
  if (start && end)                   return { preset: 'custom', start, end }
  return null
}

function pushUrlRange(range: DateRange) {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (range.preset !== 'custom') {
    params.set('preset', range.preset)
  } else {
    params.set('start', range.start)
    params.set('end', range.end)
  }
  window.history.replaceState(null, '', `?${params.toString()}`)
}

// ── KPI tile sub-components ────────────────────────────────────────────────────
function HeroKpiTile({ label, value, icon: Icon, gradient, shimmer, trend, loading }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>
  gradient: string; shimmer: string; trend?: number | null; loading?: boolean
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08]">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${shimmer} opacity-60`} />
      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs tracking-widest uppercase text-white/40 font-semibold">{label}</p>
            {loading
              ? <div className="h-9 mt-2 w-28 rounded bg-white/10 animate-pulse" />
              : <p className="text-4xl font-bold text-white mt-1">{value}</p>
            }
          </div>
          <div className="p-2.5 rounded-xl bg-white/10">
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        {trend !== undefined && trend !== null && (
          <p className={`text-xs mt-3 font-medium ${trend >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% MoM
          </p>
        )}
      </div>
    </div>
  )
}

function SecKpiTile({ label, value, sub, icon: Icon, color = 'text-indigo-400', loading, onAction, actionLabel, spinning }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<{ className?: string }>
  color?: string; loading?: boolean; onAction?: () => void; actionLabel?: string; spinning?: boolean
}) {
  return (
    <GlassCard>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/40 font-medium tracking-wide truncate">{label}</p>
            {loading
              ? <div className="h-7 mt-1.5 w-20 rounded bg-white/10 animate-pulse" />
              : <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
            }
            {sub && <p className="text-xs text-white/30 mt-0.5 truncate">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-white/5 shrink-0 ml-3 ${color} ${onAction ? 'cursor-pointer hover:bg-white/10 transition-colors' : ''}`}
               onClick={onAction}
               title={actionLabel}>
            <Icon className={`h-4 w-4 ${spinning ? 'animate-spin' : ''}`} />
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const presets: { label: string; value: DatePreset }[] = [
    { label: '7d', value: '7d' }, { label: '30d', value: '30d' }, { label: '90d', value: '90d' },
    { label: 'YTD', value: 'ytd' }, { label: 'Last Year', value: 'lastyear' },
    { label: 'All Time', value: 'all' }, { label: 'Custom', value: 'custom' },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map(p => (
        <button key={p.value}
          onClick={() => p.value === 'custom' ? onChange({ ...value, preset: 'custom' }) : onChange({ preset: p.value, ...presetRange(p.value) })}
          className={['px-2.5 py-1 text-xs rounded-md font-medium transition-colors',
            value.preset === p.value ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70',
          ].join(' ')}
        >{p.label}</button>
      ))}
      {value.preset === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <input type="date" value={value.start} onChange={e => onChange({ ...value, start: e.target.value })}
            className="text-xs border border-white/10 rounded-lg px-2 py-1 bg-white/5 text-white/70 h-7" />
          <span className="text-xs text-white/30">–</span>
          <input type="date" value={value.end} onChange={e => onChange({ ...value, end: e.target.value })}
            className="text-xs border border-white/10 rounded-lg px-2 py-1 bg-white/5 text-white/70 h-7" />
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props {
  onDataLoaded?: (data: AnalyticsResponse) => void
}

export default function AnalyticsDashboard({ onDataLoaded }: Props) {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const fromUrl = readUrlRange()
    return fromUrl ?? { preset: '30d', ...presetRange('30d') }
  })
  const [data, setData]         = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [selectedDim, setSelectedDim] = useState<SelectedDimension>({ type: null, value: null })
  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSyncAtRef = useRef<string | null>(null)

  const fetchData = useCallback(async (range: DateRange) => {
    setLoading(true)
    setError(null)
    try {
      const json: AnalyticsResponse = await adminApi.getAnalytics({ start: range.start, end: range.end })
      setData(json)
      onDataLoaded?.(json)
      if (syncPollRef.current && json.kpis.lastSync?.at && json.kpis.lastSync.at !== lastSyncAtRef.current) {
        clearInterval(syncPollRef.current)
        syncPollRef.current = null
        setSyncStatus('idle')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [onDataLoaded])

  useEffect(() => {
    fetchData(dateRange)
    return () => { if (syncPollRef.current) clearInterval(syncPollRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyRange(range: DateRange) {
    setDateRange(range)
    pushUrlRange(range)
    if (range.preset !== 'custom' || (range.start && range.end)) fetchData(range)
  }

  async function triggerSync() {
    if (syncStatus !== 'idle') return
    try {
      const json = await adminApi.triggerSync() as { status: string }
      setSyncStatus(json.status === 'already_running' ? 'syncing' : 'queued')
      lastSyncAtRef.current = data?.kpis.lastSync?.at ?? null
      syncPollRef.current = setInterval(() => fetchData(dateRange), 5000)
    } catch { /* ignore */ }
  }

  const kpis       = data?.kpis
  const projection = data ? computeProjection(data.quoteTrend) : []
  const { data: yoyData, years: yoyYears } = buildYoyData(data?.yoyRevenue ?? [])
  const { data: svcTrendData, keys: svcKeys } = pivotToWide(data?.serviceRevenueTrend ?? [], 'service')
  pivotToWide(data?.marketRevenueTrend ?? [], 'market')

  const topAccountsDisplay = (data?.topAccounts ?? []).map(r => ({
    ...r,
    shortName: r.name.length > 22 ? r.name.slice(0, 20) + '…' : r.name,
  }))

  function clearDim() { setSelectedDim({ type: null, value: null }) }

  function filterBySvc<T extends { service: string }>(rows: T[]): T[] {
    if (selectedDim.type !== 'service' || !selectedDim.value) return rows
    return rows.filter(r => r.service === selectedDim.value)
  }

  function filterByMkt<T extends { market: string }>(rows: T[]): T[] {
    if (selectedDim.type !== 'market' || !selectedDim.value) return rows
    return rows.filter(r => r.market === selectedDim.value)
  }

  const filteredAvgInvoice = filterBySvc(data?.avgInvoiceByService ?? [])
  const filteredMktTrend   = filterByMkt(data?.marketRevenueTrend ?? [])
  const { data: filteredMktWide, keys: filteredMktKeys } = pivotToWide(filteredMktTrend, 'market')

  const syncLabel = syncStatus === 'queued' ? 'Sync queued…' : syncStatus === 'syncing' ? 'Syncing…' : 'Trigger sync'

  return (
    <div className="min-h-full bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.07] via-transparent to-violet-500/[0.05] pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 px-5 py-6 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '0ms' }}>
          <div>
            <h2 className="text-xl font-semibold text-white">Analytics</h2>
            <p className="text-sm text-white/40">Revenue trends, customer insights, and SF job history.</p>
          </div>
          <div className="flex items-center gap-3">
            <DateRangeFilter value={dateRange} onChange={applyRange} />
            <button onClick={() => fetchData(dateRange)}
              className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Cross-filter badge */}
        {selectedDim.type && selectedDim.value && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">Filtered:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-medium">
              {selectedDim.type} = {selectedDim.value}
              <button onClick={clearDim} className="hover:text-white transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-500/10 text-red-400 px-4 py-3 text-sm border border-red-500/20">
            Failed to load analytics: {error}
          </div>
        )}

        {/* Hero KPI band */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '80ms' }}>
          <HeroKpiTile label="SF Total Revenue"    value={kpis ? fmt(kpis.sfTotalRevenue) : '—'}   icon={DollarSign}  gradient="from-emerald-600/50 to-emerald-900/30" shimmer="from-emerald-400 to-teal-400"   loading={loading} />
          <HeroKpiTile label="Active Accounts"     value={kpis ? String(kpis.activeAccounts) : '—'} icon={Users}       gradient="from-blue-600/50 to-blue-900/30"       shimmer="from-blue-400 to-cyan-400"     loading={loading} />
          <HeroKpiTile label="SF Jobs Completed"   value={kpis ? String(kpis.totalSfJobs) : '—'}   icon={Briefcase}   gradient="from-violet-600/50 to-violet-900/30"   shimmer="from-violet-400 to-purple-400" loading={loading} />
          <HeroKpiTile label="Quote Win Rate"      value={kpis ? fmtPct(kpis.quoteWinRate) : '—'}  icon={TrendingUp}  gradient="from-amber-600/50 to-amber-900/30"     shimmer="from-amber-400 to-orange-400"  loading={loading} />
        </div>

        {/* Secondary KPI band */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '160ms' }}>
          <SecKpiTile label="Avg Accepted Quote"    value={kpis ? fmt(kpis.avgAcceptedQuote) : '—'} icon={BarChart2}  color="text-indigo-400" loading={loading} />
          <SecKpiTile label="Pipeline Value"        value={kpis ? fmt(kpis.pipelineValue) : '—'}    icon={Layers}     color="text-orange-400" loading={loading} />
          <SecKpiTile
            label="Last Sync"
            value={kpis?.lastSync ? new Date(kpis.lastSync.at).toLocaleDateString() : '—'}
            sub={syncStatus !== 'idle' ? syncLabel : kpis?.lastSync?.status}
            icon={RefreshCw}
            color={syncStatus !== 'idle' ? 'text-amber-400' : 'text-slate-400'}
            loading={loading}
            onAction={syncStatus === 'idle' ? triggerSync : undefined}
            actionLabel={syncLabel}
            spinning={syncStatus !== 'idle'}
          />
          <SecKpiTile
            label="MoM Revenue Growth"
            value={kpis?.momGrowth != null ? `${kpis.momGrowth > 0 ? '+' : ''}${kpis.momGrowth}%` : '—'}
            icon={Activity}
            color={kpis?.momGrowth != null ? (kpis.momGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-slate-400'}
            loading={loading}
          />
          <SecKpiTile
            label="WIP / Active Backlog"
            value={kpis ? `${fmt(kpis.wipBacklogValue)}` : '—'}
            sub={kpis ? `${kpis.wipJobCount} jobs in-flight` : undefined}
            icon={Clock}
            color="text-violet-400"
            loading={loading}
          />
          <SecKpiTile
            label="Quotes Expiring Soon"
            value={kpis ? `${kpis.quotesExpiring30d} in 30d` : '—'}
            sub={kpis && kpis.quotesStale > 0 ? `${kpis.quotesStale} stale` : undefined}
            icon={AlertTriangle}
            color={kpis && kpis.quotesExpiring30d > 0 ? 'text-amber-400' : 'text-slate-400'}
            loading={loading}
          />
        </div>

        {/* Charts */}
        <AnalyticsCharts
          data={data}
          loading={loading}
          selectedDim={selectedDim}
          onSelectDim={setSelectedDim}
          yoyData={yoyData}
          yoyYears={yoyYears}
          svcTrendData={svcTrendData}
          svcKeys={svcKeys}
          filteredAvgInvoice={filteredAvgInvoice}
          filteredMktWide={filteredMktWide}
          filteredMktKeys={filteredMktKeys}
          topAccountsDisplay={topAccountsDisplay}
          projection={projection}
        />

        {/* AI Assistant */}
        {data && <AiAssistant analyticsData={data} />}

      </div>
    </div>
  )
}
