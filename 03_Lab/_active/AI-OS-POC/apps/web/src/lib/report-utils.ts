// Client-safe report utilities (no server-only guard)
// Separated from api-client.ts so "use client" components can import safely
import type { ReportQueryParams } from "@/types/api"

export function buildCsvDownloadUrl(
  type: 'utilization' | 'revenue' | 'profitability' | 'client-activity',
  params: ReportQueryParams,
): string {
  const qs = new URLSearchParams({ format: 'csv', period: params.period })
  if (params.start) qs.set('start', params.start)
  if (params.end) qs.set('end', params.end)
  return `/api/bff/reports/${type}?${qs.toString()}`
}
