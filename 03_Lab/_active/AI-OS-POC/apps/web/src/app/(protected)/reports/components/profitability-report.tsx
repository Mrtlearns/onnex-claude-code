"use client"
// apps/web/src/app/(protected)/reports/components/profitability-report.tsx
// Project Profitability report tab: Recharts BarChart (margin) + data table

import { useQuery } from "@tanstack/react-query"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReportPeriod, ProfitabilityRow } from "@/types/api"

interface Props {
  period: ReportPeriod
  customStart?: string
  customEnd?: string
}

async function fetchProfitability(
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
): Promise<ProfitabilityRow[]> {
  const qs = new URLSearchParams({ period })
  if (customStart) qs.set("start", customStart)
  if (customEnd) qs.set("end", customEnd)
  const res = await fetch(`/api/bff/reports/profitability?${qs.toString()}`)
  if (!res.ok) throw new Error(`Failed to load profitability report: ${res.status}`)
  return res.json()
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function ProfitabilityReport({ period, customStart, customEnd }: Props) {
  const { data, isLoading, isError } = useQuery<ProfitabilityRow[]>({
    queryKey: ["report", "profitability", period, customStart, customEnd],
    queryFn: () => fetchProfitability(period, customStart, customEnd),
  })

  if (isLoading) {
    return (
      <div className="space-y-4 mt-4">
        <Skeleton className="h-72 w-full" />
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mt-4 text-center text-sm text-destructive">
        Failed to load profitability report. Please try again.
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-4 text-center text-sm text-muted-foreground">
        No data for selected period.
      </div>
    )
  }

  return (
    <div className="space-y-6 mt-4">
      {/* Chart — margin per project */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="project_name" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `$${v.toFixed(0)}`} />
          <Tooltip formatter={(value: number) => [formatMoney(value), "Margin"]} />
          <Bar dataKey="margin" fill="#6366f1" name="Margin" />
        </BarChart>
      </ResponsiveContainer>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">Margin</TableHead>
            <TableHead className="text-right">Margin %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.project_id}>
              <TableCell>{row.project_name}</TableCell>
              <TableCell className="text-right">{formatMoney(row.revenue)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.cost)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.margin)}</TableCell>
              <TableCell className="text-right">{row.margin_pct.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
