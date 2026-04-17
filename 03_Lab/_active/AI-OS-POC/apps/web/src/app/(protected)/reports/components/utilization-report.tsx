"use client"
// apps/web/src/app/(protected)/reports/components/utilization-report.tsx
// Utilization report tab: Recharts BarChart + data table

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
import type { ReportPeriod, UtilizationRow } from "@/types/api"

interface Props {
  period: ReportPeriod
  customStart?: string
  customEnd?: string
}

async function fetchUtilization(
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
): Promise<UtilizationRow[]> {
  const qs = new URLSearchParams({ period })
  if (customStart) qs.set("start", customStart)
  if (customEnd) qs.set("end", customEnd)
  const res = await fetch(`/api/bff/reports/utilization?${qs.toString()}`)
  if (!res.ok) throw new Error(`Failed to load utilization report: ${res.status}`)
  return res.json()
}

export function UtilizationReport({ period, customStart, customEnd }: Props) {
  const { data, isLoading, isError } = useQuery<UtilizationRow[]>({
    queryKey: ["report", "utilization", period, customStart, customEnd],
    queryFn: () => fetchUtilization(period, customStart, customEnd),
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
        Failed to load utilization report. Please try again.
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
      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="user_name" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `${(v / 60).toFixed(0)}h`} />
          <Tooltip
            formatter={(value: number) => [`${(value / 60).toFixed(1)}h`, "Hours"]}
          />
          <Bar dataKey="total_minutes" fill="#6366f1" name="Hours Logged" />
        </BarChart>
      </ResponsiveContainer>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Hours Logged</TableHead>
            <TableHead className="text-right">Capacity</TableHead>
            <TableHead className="text-right">Utilization %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.user_id}>
              <TableCell>{row.user_name}</TableCell>
              <TableCell className="text-right">
                {(row.total_minutes / 60).toFixed(1)}h
              </TableCell>
              <TableCell className="text-right">
                {(row.capacity_minutes / 60).toFixed(1)}h
              </TableCell>
              <TableCell className="text-right">
                {row.utilization_pct.toFixed(1)}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
