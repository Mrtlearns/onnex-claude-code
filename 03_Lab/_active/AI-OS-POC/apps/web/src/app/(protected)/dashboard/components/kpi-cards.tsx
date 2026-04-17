"use client"
// apps/web/src/app/(protected)/dashboard/components/kpi-cards.tsx
// Role-aware KPI card grid — conditionally renders based on DashboardKpis field presence
// Field present = API sent it = user has that role (API enforces real access control)

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { FolderOpen, AlertCircle, Clock, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DashboardKpis } from "@/types/api"

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function KpiSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

export function KpiCards() {
  const { data, isLoading, isError } = useQuery<DashboardKpis>({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => {
      const res = await fetch("/api/bff/dashboard/kpis")
      if (!res.ok) throw new Error(`KPI fetch failed: ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      return json
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load KPIs — check API connectivity
      </div>
    )
  }

  const overdueCount = data.overdue_invoices_count ?? 0
  const utilizationPct = data.utilization_pct ?? 0

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* ALWAYS: Active Projects */}
      <Card className="animate-fade-in">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Active Projects
          </CardTitle>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <FolderOpen className="h-4 w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.active_projects_count ?? 0}</div>
          <p className="text-xs text-muted-foreground mt-1">across all clients</p>
        </CardContent>
      </Card>

      {/* CONDITIONAL: Overdue Invoices (finance/admin only) */}
      {data.overdue_invoices_count !== undefined && (
        <Card className={cn("animate-fade-in", overdueCount > 0 && "border-destructive/50")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue Invoices
            </CardTitle>
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              overdueCount > 0 ? "bg-destructive/10" : "bg-emerald-500/10"
            )}>
              <AlertCircle className={cn(
                "h-4 w-4",
                overdueCount > 0 ? "text-destructive" : "text-emerald-500"
              )} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              overdueCount > 0 && "text-destructive"
            )}>
              {overdueCount}
            </div>
            {data.overdue_invoices_total !== undefined && overdueCount > 0 && (
              <p className="text-xs text-destructive/70 mt-1">
                {formatCurrency(data.overdue_invoices_total)} outstanding
              </p>
            )}
            {overdueCount === 0 && (
              <p className="text-xs text-muted-foreground mt-1">all current</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* CONDITIONAL: Utilization (team_member/manager) */}
      {data.utilization_pct !== undefined && (
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Utilization
            </CardTitle>
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              utilizationPct >= 90 ? "bg-destructive/10" :
              utilizationPct >= 70 ? "bg-primary/10" :
              "bg-amber-500/10"
            )}>
              <Clock className={cn(
                "h-4 w-4",
                utilizationPct >= 90 ? "text-destructive" :
                utilizationPct >= 70 ? "text-primary" :
                "text-amber-500"
              )} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{utilizationPct}%</div>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  utilizationPct >= 90 ? "bg-destructive" :
                  utilizationPct >= 70 ? "bg-primary" :
                  "bg-amber-500"
                )}
                style={{ width: `${Math.min(100, utilizationPct)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* CONDITIONAL: Open Pipeline (manager/admin) */}
      {data.open_deals_value !== undefined && (
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open Pipeline
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.open_deals_value)}</div>
            <p className="text-xs text-muted-foreground mt-1">active deals</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
