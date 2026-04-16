/* eslint-disable react-refresh/only-export-components */
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ComposedChart, Line, ResponsiveContainer,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from 'recharts'
import { Download } from 'lucide-react'
import type { AnalyticsResponse } from './AnalyticsDashboard'

// ── Constants ──────────────────────────────────────────────────────────────────
const CHART_COLORS = {
  indigo: '#6366f1', emerald: '#10b981', amber: '#f59e0b',
  rose: '#f43f5e', blue: '#3b82f6', slate: '#94a3b8',
  violet: '#8b5cf6', orange: '#f97316',
}
const STATUS_COLORS: Record<string, string> = {
  accepted: '#10b981', rejected: '#f43f5e', pending: '#f59e0b',
  sent: '#6366f1', calculated: '#94a3b8',
}
const DARK = {
  grid:    '#ffffff14',
  axis:    '#94a3b8',
  tooltip: { bg: '#1e293b', border: '#334155', text: '#f1f5f9' },
}
const TOOLTIP_STYLE = {
  backgroundColor: DARK.tooltip.bg,
  border: `1px solid ${DARK.tooltip.border}`,
  borderRadius: 8, fontSize: 12, color: DARK.tooltip.text,
}
const SERIES_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#f97316', '#06b6d4']

// ── Data transforms (exported so orchestrator can use them) ────────────────────
export function buildYoyData(rows: AnalyticsResponse['yoyRevenue']): {
  data: Array<Record<string, string | number>>; years: number[]
} {
  const LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const years  = [...new Set(rows.map(r => r.year))].sort()
  const map    = new Map<string, Record<string, string | number>>()
  for (const r of rows) {
    const label = LABELS[r.month - 1]
    if (!map.has(label)) map.set(label, { month: label })
    map.get(label)![String(r.year)] = r.revenue
  }
  return { data: LABELS.map(m => map.get(m) ?? { month: m }), years }
}

export function pivotToWide<T extends { month: string; revenue: number }>(
  rows: T[], dimKey: keyof T,
): { data: Array<Record<string, string | number>>; keys: string[] } {
  const keys   = [...new Set(rows.map(r => String(r[dimKey])))].sort()
  const months = [...new Set(rows.map(r => r.month))].sort()
  const map    = new Map(months.map(m => [m, { month: m } as Record<string, string | number>]))
  for (const r of rows) map.get(r.month)![String(r[dimKey])] = r.revenue
  return { data: [...map.values()], keys }
}

export function computeProjection(trend: AnalyticsResponse['quoteTrend']): Array<{ month: string; projected?: number; actual?: number }> {
  const last3 = trend.slice(-3)
  if (last3.length < 2) return []
  const ys = last3.map(m => m.utRevenue + m.rtRevenue)
  const n  = last3.length
  const xs = last3.map((_, i) => i)
  const sumX  = xs.reduce((a, b) => a + b, 0)
  const sumY  = ys.reduce((a, b) => a + b, 0)
  const sumXY = xs.reduce((a, i) => a + i * ys[i], 0)
  const sumX2 = xs.reduce((a, b) => a + b * b, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n
  const lastMonth = last3[last3.length - 1].month
  const [lastY, lastM] = lastMonth.split('-').map(Number)
  const result: Array<{ month: string; projected?: number; actual?: number }> = last3.map((m, i) => ({ month: m.month, actual: ys[i] }))
  for (let delta = 1; delta <= 3; delta++) {
    const totalM = lastM + delta - 1
    const y  = lastY + Math.floor(totalM / 12)
    const mo = ((totalM % 12) + 1).toString().padStart(2, '0')
    result.push({ month: `${y}-${mo}`, projected: Math.max(0, Math.round(intercept + slope * (n - 1 + delta))) })
  }
  return result
}

// ── Helpers ────────────────────────────────────────────────────────────────────
export function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function fmtPct(n: number) { return `${n.toFixed(1)}%` }

// ── CSV export ─────────────────────────────────────────────────────────────────
export function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return
  const headers = Object.keys(rows[0]).join(',')
  const body = rows.map(r =>
    Object.values(r).map(v => (typeof v === 'string' && v.includes(',') ? `"${v}"` : v)).join(',')
  ).join('\n')
  const blob = new Blob([headers + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Shared UI helpers ──────────────────────────────────────────────────────────
export function GlassCard({ children, className = '', accent, glow = '' }: {
  children: React.ReactNode; className?: string; accent?: string; glow?: string
}) {
  return (
    <div className={`rounded-2xl border overflow-hidden bg-white/[0.03] backdrop-blur-xl border-white/[0.08] shadow-xl shadow-black/30 ${glow} ${className}`}>
      {accent && <div className={`h-px bg-gradient-to-r opacity-60 ${accent}`} />}
      {children}
    </div>
  )
}

export function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-white/[0.06]" />
      <span className="text-xs font-semibold tracking-widest uppercase text-white/25">{label}</span>
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  )
}

function EmptyChart({ height = 240 }: { height?: number }) {
  return <div className="flex items-center justify-center text-white/30 text-sm" style={{ height }}>No data for selected period</div>
}

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return <div className="rounded-lg bg-white/5 animate-pulse" style={{ height }} />
}

function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-1 rounded hover:bg-white/10 text-white/25 hover:text-white/60 transition-colors" title="Export CSV">
      <Download className="h-3.5 w-3.5" />
    </button>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface AnalyticsChartsProps {
  data: AnalyticsResponse | null
  loading: boolean
  selectedDim: { type: 'service' | 'market' | 'account' | null; value: string | null }
  onSelectDim: (dim: { type: 'service' | 'market' | 'account' | null; value: string | null }) => void
  yoyData: Array<Record<string, string | number>>
  yoyYears: number[]
  svcTrendData: Array<Record<string, string | number>>
  svcKeys: string[]
  filteredAvgInvoice: AnalyticsResponse['avgInvoiceByService']
  filteredMktWide: Array<Record<string, string | number>>
  filteredMktKeys: string[]
  topAccountsDisplay: Array<{ name: string; jobCount: number; lifetimeRevenue: number; avgInvoice: number; shortName: string }>
  projection: Array<{ month: string; projected?: number; actual?: number }>
}

export default function AnalyticsCharts({
  data, loading, selectedDim, onSelectDim,
  yoyData, yoyYears, svcTrendData, svcKeys,
  filteredAvgInvoice, filteredMktWide, filteredMktKeys,
  topAccountsDisplay, projection,
}: AnalyticsChartsProps) {
  return (
    <>
      {/* ── SALESFORCE PERFORMANCE ── */}
      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '240ms' }}>
        <SectionLabel label="Salesforce Performance" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard accent="from-indigo-500 to-violet-500" glow="shadow-indigo-500/10">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">YoY Revenue Comparison</p>
                <ExportBtn onClick={() => downloadCSV(yoyData as Record<string, unknown>[], 'yoy-revenue.csv')} />
              </div>
              {loading ? <ChartSkeleton /> : !yoyData.some(r => yoyYears.some(y => r[String(y)])) ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={yoyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                    <YAxis tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [fmt(v as number)]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: DARK.axis }} />
                    {yoyYears.map((y, i) => (
                      <Bar key={y} dataKey={String(y)} name={String(y)} fill={SERIES_COLORS[i % SERIES_COLORS.length]} radius={[3, 3, 0, 0]} />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>

          <GlassCard accent="from-indigo-500 to-violet-500" glow="shadow-indigo-500/10">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">Service Revenue Trend (Top 5)</p>
                <div className="flex items-center gap-2">
                  {selectedDim.type === 'service' && <span className="text-xs text-indigo-400">• filtered</span>}
                  <ExportBtn onClick={() => downloadCSV(data?.serviceRevenueTrend as Record<string, unknown>[] ?? [], 'service-revenue-trend.csv')} />
                </div>
              </div>
              {loading ? <ChartSkeleton /> : !svcTrendData.length ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={svcTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                    <YAxis tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [fmt(v as number)]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: DARK.axis }} />
                    {svcKeys.map((k, i) => (
                      <Area key={k} type="monotone" dataKey={k} stackId="s"
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                        fillOpacity={0.55} strokeWidth={1.5}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSelectDim(selectedDim.value === k ? { type: null, value: null } : { type: 'service', value: k })}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ── OPERATIONAL BREAKDOWN ── */}
      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '290ms' }}>
        <SectionLabel label="Operational Breakdown" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard accent="from-violet-500 to-purple-500" glow="shadow-violet-500/10">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">NDT Procedure Breakdown</p>
                <ExportBtn onClick={() => downloadCSV(data?.procedureBreakdown as Record<string, unknown>[] ?? [], 'procedure-breakdown.csv')} />
              </div>
              {loading ? <ChartSkeleton height={280} /> : !(data?.procedureBreakdown ?? []).length ? <EmptyChart height={280} /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart data={data!.procedureBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                    <XAxis type="number" tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                    <YAxis dataKey="procedure" type="category" tick={{ fontSize: 10, fill: DARK.axis }} axisLine={false} tickLine={false} width={140} />
                    <YAxis yAxisId="right" orientation="right" type="number" tick={{ fontSize: 10, fill: DARK.axis }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v, n) => [n === 'Revenue' ? fmt(v as number) : v, n]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: DARK.axis }} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.violet} radius={[0, 3, 3, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="jobCount" name="Job Count" stroke={CHART_COLORS.amber} strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>

          <GlassCard accent="from-amber-500 to-orange-500" glow="shadow-amber-500/10">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">Avg Invoice by Service Type</p>
                <div className="flex items-center gap-2">
                  {selectedDim.type === 'service' && <span className="text-xs text-indigo-400">• filtered</span>}
                  <ExportBtn onClick={() => downloadCSV(filteredAvgInvoice as Record<string, unknown>[], 'avg-invoice-by-service.csv')} />
                </div>
              </div>
              {loading ? <ChartSkeleton height={280} /> : !filteredAvgInvoice.length ? <EmptyChart height={280} /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={filteredAvgInvoice} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                    <XAxis type="number" tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                    <YAxis dataKey="service" type="category" tick={{ fontSize: 10, fill: DARK.axis }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [fmt(v as number), 'Avg Invoice']} />
                    <Bar dataKey="avgInvoice" fill={CHART_COLORS.orange} radius={[0, 3, 3, 0]}
                         style={{ cursor: 'pointer' }}
                         onClick={(d: { service: string }) => onSelectDim(selectedDim.value === d.service ? { type: null, value: null } : { type: 'service', value: d.service })} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ── ACCOUNT INTELLIGENCE ── */}
      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '320ms' }}>
        <SectionLabel label="Account Intelligence" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard accent="from-blue-500 to-cyan-500" glow="shadow-blue-500/10">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">Top 15 Accounts by Lifetime Revenue</p>
                <ExportBtn onClick={() => downloadCSV(topAccountsDisplay as Record<string, unknown>[], 'top-accounts.csv')} />
              </div>
              {loading ? <ChartSkeleton height={320} /> : !topAccountsDisplay.length ? <EmptyChart height={320} /> : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={topAccountsDisplay} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                    <XAxis type="number" tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                    <YAxis dataKey="shortName" type="category" tick={{ fontSize: 10, fill: DARK.axis }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [fmt(v as number), 'Lifetime Revenue']} />
                    <Bar dataKey="lifetimeRevenue" fill={CHART_COLORS.blue} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>

          <GlassCard accent="from-blue-500 to-cyan-500" glow="shadow-blue-500/10">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">Market Revenue Trend (Top 5)</p>
                <div className="flex items-center gap-2">
                  {selectedDim.type === 'market' && <span className="text-xs text-indigo-400">• filtered</span>}
                  <ExportBtn onClick={() => downloadCSV(filteredMktWide as Record<string, unknown>[], 'market-revenue-trend.csv')} />
                </div>
              </div>
              {loading ? <ChartSkeleton height={320} /> : !filteredMktWide.length ? <EmptyChart height={320} /> : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={filteredMktWide}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                    <YAxis tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v) => [fmt(v as number)]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: DARK.axis }} />
                    {filteredMktKeys.map((k, i) => (
                      <Area key={k} type="monotone" dataKey={k} stackId="s"
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                        fillOpacity={0.55} strokeWidth={1.5}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onSelectDim(selectedDim.value === k ? { type: null, value: null } : { type: 'market', value: k })}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ── OPERATIONAL METRICS ── */}
      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '400ms' }}>
        <SectionLabel label="Operational Metrics" />
        <div className="grid grid-cols-1 gap-4">
          <GlassCard accent="from-amber-500 to-orange-500" glow="shadow-amber-500/10">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">Job Turnaround Time Trend</p>
                <ExportBtn onClick={() => downloadCSV(data?.turnaroundTrend as Record<string, unknown>[] ?? [], 'turnaround-trend.csv')} />
              </div>
              {loading ? <ChartSkeleton /> : !(data?.turnaroundTrend ?? []).length ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={data!.turnaroundTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: DARK.axis }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}d`} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: DARK.axis }} />
                    <Bar yAxisId="left" dataKey="jobCount" name="Job Count" fill={CHART_COLORS.amber} radius={[3, 3, 0, 0]} fillOpacity={0.7} />
                    <Line yAxisId="right" type="monotone" dataKey="avgDays" name="Avg Days" stroke={CHART_COLORS.orange} strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ── QUOTE ANALYTICS ── */}
      <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '480ms' }}>
        <SectionLabel label="Quote Analytics" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlassCard accent="from-emerald-500 to-teal-500" glow="shadow-emerald-500/10">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">Quote Revenue Trend</p>
                <ExportBtn onClick={() => downloadCSV(data?.quoteTrend as Record<string, unknown>[] ?? [], 'quote-trend.csv')} />
              </div>
              {loading ? <ChartSkeleton /> : !data?.quoteTrend.length ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data.quoteTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                    <YAxis tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v, n) => [fmt(v as number), n]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: DARK.axis }} />
                    <Area type="monotone" dataKey="utRevenue" name="UT" stroke={CHART_COLORS.indigo} fill={CHART_COLORS.indigo} fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="rtRevenue" name="RT" stroke={CHART_COLORS.emerald} fill={CHART_COLORS.emerald} fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>

          <GlassCard accent="from-emerald-500 to-teal-500" glow="shadow-emerald-500/10">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">Quote Status Distribution</p>
                <ExportBtn onClick={() => downloadCSV(data?.statusDist as Record<string, unknown>[] ?? [], 'quote-status.csv')} />
              </div>
              {loading ? <ChartSkeleton /> : !data?.statusDist.length ? <EmptyChart /> : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={data.statusDist} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                      {data.statusDist.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? CHART_COLORS.slate} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v, n]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: DARK.axis }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>
        </div>

        {((data?.quoteVariance ?? []).length > 0 || loading) && (
          <GlassCard accent="from-emerald-500 to-teal-500" glow="shadow-emerald-500/10">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-white/70">Quote vs. Actual Variance (Approved Quotes)</p>
                <ExportBtn onClick={() => downloadCSV(data?.quoteVariance as Record<string, unknown>[] ?? [], 'quote-variance.csv')} />
              </div>
              {loading ? <ChartSkeleton height={280} /> : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data!.quoteVariance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                    <XAxis type="number" tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                    <YAxis dataKey="account" type="category" tick={{ fontSize: 9, fill: DARK.axis }} axisLine={false} tickLine={false} width={120}
                           tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 16) + '…' : v} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v, n) => [fmt(v as number), n]} />
                    <Legend wrapperStyle={{ fontSize: 11, color: DARK.axis }} />
                    <Bar dataKey="avgQuoted"   name="Avg Quoted"   fill={CHART_COLORS.indigo}  radius={[0, 3, 3, 0]} />
                    <Bar dataKey="avgInvoiced" name="Avg Invoiced" fill={CHART_COLORS.emerald} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </GlassCard>
        )}
      </div>

      {/* Win Rate Trend */}
      <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '560ms' }}>
        <GlassCard accent="from-emerald-500 to-teal-500" glow="shadow-emerald-500/10">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-white/70">Win Rate Trend</p>
              <ExportBtn onClick={() => downloadCSV(data?.winRateTrend as Record<string, unknown>[] ?? [], 'win-rate-trend.csv')} />
            </div>
            {loading ? <ChartSkeleton height={200} /> : !data?.winRateTrend.length ? <EmptyChart height={200} /> : (
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={data.winRateTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: DARK.axis }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: DARK.axis }} />
                  <Bar yAxisId="left" dataKey="total"    name="Total Quotes" fill={CHART_COLORS.slate}   radius={[3, 3, 0, 0]} fillOpacity={0.7} />
                  <Bar yAxisId="left" dataKey="accepted" name="Accepted"     fill={CHART_COLORS.emerald} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="winRate" name="Win Rate %" stroke={CHART_COLORS.amber} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Projection */}
      {projection.length > 0 && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-4 duration-500" style={{ animationDelay: '640ms' }}>
          <SectionLabel label="Projection" />
          <GlassCard accent="from-rose-500 to-pink-500" glow="shadow-rose-500/10">
            <div className="p-5">
              <p className="text-sm font-medium text-white/70 mb-4">Revenue Projection (next 3 months)</p>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={projection}>
                  <CartesianGrid strokeDasharray="3 3" stroke={DARK.grid} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: DARK.axis }} axisLine={{ stroke: DARK.grid }} tickLine={false} />
                  <YAxis tickFormatter={v => fmt(v as number)} tick={{ fontSize: 11, fill: DARK.axis }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={v => [fmt(v as number)]} />
                  <Legend wrapperStyle={{ fontSize: 11, color: DARK.axis }} />
                  <Line type="monotone" dataKey="actual"    name="Actual"    stroke={CHART_COLORS.indigo} strokeWidth={2} dot />
                  <Line type="monotone" dataKey="projected" name="Projected" stroke={CHART_COLORS.amber}  strokeWidth={2} strokeDasharray="5 5" dot />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      )}
    </>
  )
}
