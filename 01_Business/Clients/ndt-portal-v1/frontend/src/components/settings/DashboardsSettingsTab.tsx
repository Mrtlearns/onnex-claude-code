import { useState } from 'react'
import { Save, CheckCircle2, LayoutDashboard } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { Label } from '../ui/label'

const LS_KEY = 'ndt_integration_settings'

function loadDashboardSettings(): { analysis: { enabled: boolean } } {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return { analysis: { enabled: true } }
    const parsed = JSON.parse(raw)
    return parsed.dashboards ?? { analysis: { enabled: true } }
  } catch {
    return { analysis: { enabled: true } }
  }
}

function saveDashboardSettings(dashboards: { analysis: { enabled: boolean } }) {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const current = raw ? JSON.parse(raw) : {}
    localStorage.setItem(LS_KEY, JSON.stringify({ ...current, dashboards }))
  } catch {
    // ignore
  }
}

export default function DashboardsSettingsTab() {
  const [analysisEnabled, setAnalysisEnabled] = useState<boolean>(
    () => loadDashboardSettings().analysis.enabled,
  )
  const [saved, setSaved] = useState(false)

  function handleSave() {
    saveDashboardSettings({ analysis: { enabled: analysisEnabled } })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4 text-indigo-500" /> Dashboards
        </CardTitle>
        <CardDescription className="mt-1">
          Manage which dashboard tabs are visible.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overview — always on */}
        <div className="flex items-start gap-3 py-3 border-b">
          <Checkbox id="db-overview" checked disabled />
          <div>
            <Label htmlFor="db-overview" className="font-medium cursor-default">Overview</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Main KPI cards, recent quotes, and email intake. Always visible.
            </p>
          </div>
        </div>

        {/* Analysis — toggleable */}
        <div className="flex items-start gap-3 py-3">
          <Checkbox
            id="db-analysis"
            checked={analysisEnabled}
            onCheckedChange={v => setAnalysisEnabled(Boolean(v))}
          />
          <div>
            <Label htmlFor="db-analysis" className="font-medium cursor-pointer">Analysis</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rich analytics with revenue trends, customer insights,
              SF job history, and AI-powered data assistant.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t">
          <Button onClick={handleSave} className="flex items-center gap-2">
            <Save className="h-4 w-4" /> Save
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
