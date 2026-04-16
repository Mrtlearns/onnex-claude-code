import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import Dashboard from '../dashboard/Dashboard'
import AnalyticsDashboard, { type AnalyticsResponse } from './AnalyticsDashboard'
import AiAssistant from './AiAssistant'
import QuoteKanban from './QuoteKanban'

const LS_KEY = 'ndt_integration_settings'

function isAnalysisEnabled(): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return true
    const parsed = JSON.parse(raw)
    return parsed?.dashboards?.analysis?.enabled !== false
  } catch {
    return true
  }
}

export default function DashboardsApp() {
  const analysisEnabled = isAnalysisEnabled()
  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(null)

  return (
    <>
      <Tabs defaultValue="quotes" className="h-full">
        <div className="px-4 pt-4 border-b border-border">
          <TabsList>
            <TabsTrigger value="quotes">Quotes</TabsTrigger>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {analysisEnabled && <TabsTrigger value="analysis">Analysis</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="quotes" className="m-0 h-full overflow-y-auto">
          <QuoteKanban />
        </TabsContent>

        <TabsContent value="overview" className="m-0 h-full overflow-y-auto">
          <Dashboard />
        </TabsContent>

        {analysisEnabled && (
          <TabsContent value="analysis" className="m-0 h-full overflow-y-auto">
            <AnalyticsDashboard onDataLoaded={setAnalyticsData} />
          </TabsContent>
        )}
      </Tabs>

      <AiAssistant analyticsData={analyticsData} />
    </>
  )
}
