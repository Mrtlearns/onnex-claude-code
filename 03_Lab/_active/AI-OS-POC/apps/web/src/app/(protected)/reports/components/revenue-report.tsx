"use client"
// apps/web/src/app/(protected)/reports/components/revenue-report.tsx
// Revenue report tab: Recharts BarChart (invoiced + received) + data table

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
import type { ReportPeriod, RevenueRow } from "@/types/api"

interface Props {
  period: ReportPeriod
  customStart?: string
  customEnd?: string
}

async function fetchRevenue(
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
): Promise<RevenueRow[]> {
  const qs = new URLSearchParams({ period })
  if (customStart) qs.set("start", customStart)
  if (customEnd) qs.set("end", customEnd)
  const res = await fetch(`/api/bff/reports/revenue?${qs.toString()}`)
  if (!res.ok) throw new Error(`Failed to load revenue report: ${res.status}`)
  return res.json()
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`
}

export function RevenueReport({ period, customStart, customEnd }: Props) {
  const { data, isLoading, isError } = useQuery<RevenueRow[]>({
    queryKey: ["report", "revenue", period, customStart, customEnd],
    queryFn: () => fetchRevenue(period, customStart, customEnd),
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
        Failed to load revenue report. Please try again.
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
      {/* Chart — two bars: Invoiced (indigo) + Received (green) */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="client_name" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v) => `$${v.toFixed(0)}`} />
          <Tooltip formatter={(value: number) => [formatMoney(value)]} />
          <Bar dataKey="invoiced_total" fill="#6366f1" name="Invoiced" />
          <Bar dataKey="received_total" fill="#22c55e" name="Received" />
        </BarChart>
      </ResponsiveContainer>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Invoiced</TableHead>
            <TableHead className="text-right">Received</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.client_id}>
              <TableCell>{row.client_name}</TableCell>
              <TableCell className="text-right">{formatMoney(row.invoiced_total)}</TableCell>
              <TableCell className="text-right">{formatMoney(row.received_total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
