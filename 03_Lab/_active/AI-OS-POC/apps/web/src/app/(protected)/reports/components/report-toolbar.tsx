"use client"
// apps/web/src/app/(protected)/reports/components/report-toolbar.tsx
// Period selector dropdown + Custom range date picker + CSV download button

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { ReportPeriod } from "@/types/api"

const PERIOD_OPTIONS = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
] as const

interface ReportToolbarProps {
  period: ReportPeriod
  onPeriodChange: (p: ReportPeriod) => void
  customStart?: string
  customEnd?: string
  onCustomRangeChange?: (start: string, end: string) => void
  csvHref: string
}

export function ReportToolbar({
  period,
  onPeriodChange,
  customStart,
  customEnd,
  onCustomRangeChange,
  csvHref,
}: ReportToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Period selector */}
      <Select value={period} onValueChange={(v) => onPeriodChange(v as ReportPeriod)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom range date pickers */}
      {period === "custom" && (
        <>
          <Input
            type="date"
            value={customStart ?? ""}
            onChange={(e) => onCustomRangeChange?.(e.target.value, customEnd ?? "")}
            className="w-40"
            aria-label="Start date"
          />
          <Input
            type="date"
            value={customEnd ?? ""}
            onChange={(e) => onCustomRangeChange?.(customStart ?? "", e.target.value)}
            className="w-40"
            aria-label="End date"
          />
        </>
      )}

      {/* CSV export — direct browser download via anchor tag */}
      <Button variant="outline" size="sm" asChild>
        <a href={csvHref} download>
          Export CSV
        </a>
      </Button>
    </div>
  )
}
