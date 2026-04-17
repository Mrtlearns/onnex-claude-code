"use client"
// apps/web/src/app/(protected)/reports/components/client-activity-report.tsx
// Client Activity report tab: Recharts BarChart (event count) + data table

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
import type { ReportPeriod, ClientActivityRow } from "@/types/api"

interface Props {
  period: ReportPeriod
  customStart?: string
  customEnd?: string
}

async function fetchClientActivity(
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
): Promise<ClientActivityRow[]> {
  const qs = new URLSearchParams({ period })
  if (customStart) qs.set("start", customStart)
  if (customEnd) qs.set("end", customEnd)
  const res = await fetch(`/api/bff/reports/client-activity?${qs.toString()}`)
  if (!res.ok) throw new Error(`Failed to load client activity report: ${res.status}`)
  return res.json()
}

function formatLastActive(lastActiveAt: string | null): string {
  if (!lastActiveAt) return "Never"
  try {
    return new Date(lastActiveAt).toLocaleDateString()
  } catch {
    return "Never"
  }
}

export function ClientActivityReport({ period, customStart, customEnd }: Props) {
  const { data, isLoading, isError } = useQuery<ClientActivityRow[]>({
    queryKey: ["report", "client-activity", period, customStart, customEnd],
    queryFn: () => fetchClientActivity(period, customStart, customEnd),
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
        Failed to load client activity report. Please try again.
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
      {/* Chart — event count per client */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="client_name" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip formatter={(value: number) => [value, "Events"]} />
          <Bar dataKey="event_count" fill="#6366f1" name="Events" />
        </BarChart>
      </ResponsiveContainer>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead className="text-right">Events</TableHead>
            <TableHead className="text-right">Last Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.client_id}>
              <TableCell>{row.client_name}</TableCell>
              <TableCell className="text-right">{row.event_count}</TableCell>
              <TableCell className="text-right">
                {formatLastActive(row.last_active_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
