"use client"
// apps/web/src/app/(protected)/reports/components/reports-client.tsx
// Tab orchestrator + period state + role-based default tab + CSV download

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Session } from "next-auth"
import type { ReportPeriod } from "@/types/api"
import { buildCsvDownloadUrl } from "@/lib/report-utils"
import { ReportToolbar } from "./report-toolbar"
import { UtilizationReport } from "./utilization-report"
import { RevenueReport } from "./revenue-report"
import { ProfitabilityReport } from "./profitability-report"
import { ClientActivityReport } from "./client-activity-report"

interface ReportsClientProps {
  session: Session | null
}

type ReportTab = "utilization" | "revenue" | "profitability" | "client-activity"

export function ReportsClient({ session }: ReportsClientProps) {
  const role = (session?.user?.role as string) ?? ""
  const isFinanceOrAdmin = ["finance", "admin", "super_admin"].includes(role)

  // Default tab: Finance → revenue, everyone else → utilization
  const defaultTab: ReportTab = isFinanceOrAdmin && role === "finance" ? "revenue" : "utilization"

  const [activeTab, setActiveTab] = useState<ReportTab>(defaultTab)
  const [period, setPeriod] = useState<ReportPeriod>("this_month")
  const [customStart, setCustomStart] = useState<string>("")
  const [customEnd, setCustomEnd] = useState<string>("")

  function handlePeriodChange(p: ReportPeriod) {
    setPeriod(p)
    if (p !== "custom") {
      setCustomStart("")
      setCustomEnd("")
    }
  }

  function handleCustomRangeChange(start: string, end: string) {
    setCustomStart(start)
    setCustomEnd(end)
  }

  const csvHref = buildCsvDownloadUrl(activeTab, {
    period,
    start: customStart || undefined,
    end: customEnd || undefined,
  })

  const reportProps = {
    period,
    customStart: customStart || undefined,
    customEnd: customEnd || undefined,
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <ReportToolbar
          period={period}
          onPeriodChange={handlePeriodChange}
          customStart={customStart}
          customEnd={customEnd}
          onCustomRangeChange={handleCustomRangeChange}
          csvHref={csvHref}
        />
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportTab)}
      >
        <TabsList>
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
          {isFinanceOrAdmin && (
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
          )}
          <TabsTrigger value="profitability">Project Profitability</TabsTrigger>
          <TabsTrigger value="client-activity">Client Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="utilization">
          <UtilizationReport {...reportProps} />
        </TabsContent>

        {isFinanceOrAdmin && (
          <TabsContent value="revenue">
            <RevenueReport {...reportProps} />
          </TabsContent>
        )}

        <TabsContent value="profitability">
          <ProfitabilityReport {...reportProps} />
        </TabsContent>

        <TabsContent value="client-activity">
          <ClientActivityReport {...reportProps} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
