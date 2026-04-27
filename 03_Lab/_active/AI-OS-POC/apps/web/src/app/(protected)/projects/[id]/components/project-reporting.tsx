"use client"
// apps/web/src/app/(protected)/projects/[id]/components/project-reporting.tsx
// Reporting tab — KPI tiles, P&L timeline chart, expense breakdown, budget summary

import { useQuery } from "@tanstack/react-query"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
} from "lucide-react"
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/api"

// ─── Local types for BFF responses (may carry extra fields) ──────────────────

interface BffInvoice {
  id: string
  status: "draft" | "sent" | "paid" | "partial" | "void"
  amount: number
  issued_at: string | null
  created_at: string
  line_items?: Array<{ qty: number; rate: number }>
}

interface BffTimeEntry {
  id: string
  duration_minutes: number
  hourly_rate?: number | null
  started_at?: string | null
  created_at: string
  task_type?: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toMonthKey(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function shortMonth(key: string): string {
  if (!key) return ""
  const [year, month] = key.split("-")
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  })
}

function last6MonthKeys(): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return keys
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string
  value: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  trend?: "up" | "down" | "neutral"
}

function KpiTile({ label, value, icon: Icon, iconBg, iconColor }: KpiTileProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-6 pb-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
        <p className="text-3xl font-bold truncate">{value}</p>
        <div
          className={cn(
            "absolute right-4 top-4 h-8 w-8 rounded-full flex items-center justify-center",
            iconBg,
          )}
        >
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Budget summary metric ────────────────────────────────────────────────────

interface BudgetMetricProps {
  label: string
  value: string
  sub?: string
}

function BudgetMetric({ label, value, sub }: BudgetMetricProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProjectReportingProps {
  projectId: string
  project: Project
}

export function ProjectReporting({ projectId, project }: ProjectReportingProps) {
  const { data: invoices = [] } = useQuery<BffInvoice[]>({
    queryKey: ["invoices", { project_id: projectId }],
    queryFn: () =>
      fetch(`/api/bff/invoices?project_id=${projectId}`).then((r) => r.json()),
    staleTime: 60_000,
  })

  const { data: timeEntries = [] } = useQuery<BffTimeEntry[]>({
    queryKey: ["time-entries", { project_id: projectId }],
    queryFn: () =>
      fetch(`/api/bff/time-entries?project_id=${projectId}`).then((r) => r.json()),
    staleTime: 60_000,
  })

  // ── Computed metrics ──────────────────────────────────────────────────────
  const totalRevenue = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + (i.amount ?? 0), 0)

  const totalInvoiced = invoices.reduce((s, i) => s + (i.amount ?? 0), 0)

  const totalCosts = timeEntries.reduce(
    (s, e) => s + (e.duration_minutes / 60) * (e.hourly_rate ?? 0),
    0,
  )

  const budget = project.budget ?? 0
  const profit = totalRevenue - totalCosts
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
  const utilization = budget > 0 ? (totalInvoiced / budget) * 100 : 0
  const remaining = budget - totalInvoiced

  // ── Monthly P&L data (last 6 months) ────────────────────────────────────
  const monthKeys = last6MonthKeys()

  const revenueByMonth: Record<string, number> = {}
  const costsByMonth: Record<string, number> = {}

  for (const inv of invoices) {
    if (inv.status !== "paid") continue
    const key = toMonthKey(inv.issued_at ?? inv.created_at)
    if (monthKeys.includes(key)) {
      revenueByMonth[key] = (revenueByMonth[key] ?? 0) + (inv.amount ?? 0)
    }
  }

  for (const entry of timeEntries) {
    const key = toMonthKey(entry.started_at ?? entry.created_at)
    if (monthKeys.includes(key)) {
      costsByMonth[key] =
        (costsByMonth[key] ?? 0) + (entry.duration_minutes / 60) * (entry.hourly_rate ?? 0)
    }
  }

  let cumulative = 0
  const monthlyData = monthKeys.map((key) => {
    const rev = revenueByMonth[key] ?? 0
    const cost = costsByMonth[key] ?? 0
    cumulative += rev - cost
    return {
      month: shortMonth(key),
      revenue: Math.round(rev),
      costs: Math.round(cost),
      cumulativeProfit: Math.round(cumulative),
    }
  })

  // ── Expense breakdown by task_type ────────────────────────────────────────
  const expenseMap: Record<string, number> = {}
  for (const entry of timeEntries) {
    const cat = entry.task_type ?? "Labor"
    expenseMap[cat] = (expenseMap[cat] ?? 0) + (entry.duration_minutes / 60) * (entry.hourly_rate ?? 0)
  }

  const expenseData = Object.entries(expenseMap)
    .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)

  const hasExpenses = expenseData.length > 0

  // ── Tooltip formatters ────────────────────────────────────────────────────
  const currencyFormatter = (v: number) => `$${v.toLocaleString()}`

  return (
    <div className="space-y-6">
      {/* ── 4 KPI tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Project Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          icon={TrendingUp}
          iconBg="bg-green-500/15"
          iconColor="text-green-500"
        />
        <KpiTile
          label="Project Costs"
          value={`$${totalCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={TrendingDown}
          iconBg="bg-red-500/15"
          iconColor="text-red-500"
        />
        <KpiTile
          label="Profit Margin"
          value={`${profitMargin.toFixed(1)}%`}
          icon={DollarSign}
          iconBg="bg-blue-500/15"
          iconColor="text-blue-500"
        />
        <KpiTile
          label="Budget Utilization"
          value={`${utilization.toFixed(1)}%`}
          icon={BarChart3}
          iconBg="bg-purple-500/15"
          iconColor="text-purple-500"
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* P&L Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">P&amp;L Timeline</CardTitle>
            <p className="text-xs text-muted-foreground">Last 6 months — revenue vs costs vs cumulative profit</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: 12,
                  }}
                  formatter={currencyFormatter}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="costs"
                  name="Costs"
                  fill="#ef4444"
                  opacity={0.8}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="revenue"
                  name="Revenue"
                  fill="#22c55e"
                  opacity={0.8}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeProfit"
                  name="Cumulative Profit"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
            <p className="text-xs text-muted-foreground">Labor costs by category</p>
          </CardHeader>
          <CardContent>
            {hasExpenses ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  layout="vertical"
                  data={expenseData}
                  margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                      fontSize: 12,
                    }}
                    formatter={currencyFormatter}
                  />
                  <Bar
                    dataKey="amount"
                    name="Amount"
                    fill="#6366f1"
                    opacity={0.8}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">
                No expense data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Budget Summary Details ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Budget Summary Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <BudgetMetric
              label="Total Budget"
              value={budget > 0 ? `$${budget.toLocaleString()}` : "—"}
              sub="Project budget"
            />
            <BudgetMetric
              label="Total Invoiced"
              value={`$${totalInvoiced.toLocaleString()}`}
              sub={`${invoices.length} invoice${invoices.length !== 1 ? "s" : ""}`}
            />
            <BudgetMetric
              label="Total Expenses"
              value={`$${totalCosts.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              sub="Time-based labor costs"
            />
            <BudgetMetric
              label="Profit"
              value={`$${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              sub={`${profitMargin.toFixed(1)}% margin`}
            />
            <BudgetMetric
              label="Budget Remaining"
              value={budget > 0 ? `$${remaining.toLocaleString()}` : "—"}
              sub={budget > 0 ? `${(100 - utilization).toFixed(1)}% unused` : undefined}
            />
            <BudgetMetric
              label="Utilization %"
              value={`${utilization.toFixed(1)}%`}
              sub={`$${totalInvoiced.toLocaleString()} of $${budget.toLocaleString()}`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
