import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Outlet } from 'react-router-dom'
import { SimulationProvider } from './contexts/SimulationContext'
import { RequireAuth, RequirePermission } from './components/auth/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { LoginCallback } from './components/auth/LoginCallback'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import { DEFAULT_THEME } from './lib/themes'
import DashboardsApp from './components/dashboards/DashboardsApp'
import RtApp from './components/rt/RtApp'
import UtApp from './components/ut/UtApp'
import QuotesApp from './components/quotes/QuotesApp'
import SettingsApp from './components/settings/SettingsApp'
import ToolsApp from './components/tools/ToolsApp'
import AnalysisPage from './components/analysis/AnalysisPage'
import ExecutionLogViewer from './components/analysis/ExecutionLogViewer'
import PipelineHistory from './components/analysis/PipelineHistory'
import AdminApp from './components/admin/AdminApp'
import DocumentsApp from './components/documents/DocumentsApp'
import SfAnalysisApp from './components/sfanalysis/SfAnalysisApp'
import InboxApp from './components/inbox/InboxApp'
import QuoteAnalysesApp from './components/quote-analyses/QuoteAnalysesApp'

// Lazy-loaded — Three.js must not bloat the initial bundle
const PartInspector = lazy(() =>
  import('./components/rt/inspector/PartInspector').then((m) => ({ default: m.PartInspector }))
)

// Workshop pages — lazy to keep initial bundle lean
const WorkshopPage = lazy(() => import('./pages/WorkshopPage'))
const WorkshopSettingsPage = lazy(() => import('./pages/WorkshopSettingsPage'))
const WorkshopSimulationPage = lazy(() => import('./pages/WorkshopSimulationPage'))

// ── Sidebar + topbar layout wrapper ──────────────────────────────────────────

interface AppLayoutProps {
  dark: boolean
  onToggleDark: () => void
  theme: string
  onSetTheme: (id: string) => void
}

function AppLayout({ dark, onToggleDark, theme, onSetTheme }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar dark={dark} onToggleDark={onToggleDark} theme={theme} onSetTheme={onSetTheme} />
      <main className="flex-1 overflow-y-auto flex flex-col">
        <Topbar />
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark]   = useState<boolean>(() => localStorage.getItem('ndt-dark') === 'true')
  const [theme, setThemeState] = useState<string>(() => localStorage.getItem('ndt-theme') || DEFAULT_THEME)

  // Apply on mount
  useEffect(() => {
    const html = document.documentElement
    html.dataset.theme = theme
    if (dark) html.classList.add('dark')
    else html.classList.remove('dark')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDark() {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('ndt-dark', String(next))
  }

  function setTheme(id: string) {
    setThemeState(id)
    document.documentElement.dataset.theme = id
    localStorage.setItem('ndt-theme', id)
  }

  return (
    <SimulationProvider>
      <Routes>
        {/* Public routes — no auth required */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/callback" element={<LoginCallback />} />

        {/* Protected routes — require authentication */}
        {/* Full-screen 3D inspector — no sidebar/topbar, lazy-loaded */}
        <Route
          path="/rt/inspector/:jobId"
          element={
            <RequireAuth>
              <Suspense fallback={null}>
                <PartInspector />
              </Suspense>
            </RequireAuth>
          }
        />

        {/* Standard layout — all other routes */}
        <Route element={<RequireAuth><AppLayout dark={dark} onToggleDark={toggleDark} theme={theme} onSetTheme={setTheme} /></RequireAuth>}>
          <Route path="/"                   element={<RequirePermission permission="DASHBOARD_VIEW"><DashboardsApp /></RequirePermission>} />
          <Route path="/rt/*"               element={<RequirePermission permission="RT_VIEW"><RtApp /></RequirePermission>} />
          <Route path="/ut/*"               element={<RequirePermission permission="UT_VIEW"><UtApp /></RequirePermission>} />
          <Route path="/quotes"             element={<RequirePermission permission="QUOTE_VIEW"><QuotesApp /></RequirePermission>} />
          <Route path="/settings"           element={<RequirePermission permission="SETTINGS_VIEW"><SettingsApp /></RequirePermission>} />
          <Route path="/tools/*"            element={<RequirePermission permission="TOOLS_VIEW"><ToolsApp /></RequirePermission>} />
          <Route path="/analysis/:intakeId" element={<RequirePermission permission="PIPELINE_VIEW"><AnalysisPage /></RequirePermission>} />
          <Route path="/audit"              element={<RequirePermission permission="PIPELINE_VIEW"><PipelineHistory /></RequirePermission>} />
          <Route path="/audit/:intakeId"    element={<RequirePermission permission="PIPELINE_VIEW"><ExecutionLogViewer /></RequirePermission>} />
          <Route path="/admin/*"            element={<RequirePermission permission="ADMIN_VIEW"><AdminApp /></RequirePermission>} />
          <Route path="/documents"          element={<RequirePermission permission="DOCUMENT_VIEW"><DocumentsApp /></RequirePermission>} />
          <Route path="/sf-analysis"        element={<RequirePermission permission="SF_ANALYSIS_VIEW"><SfAnalysisApp /></RequirePermission>} />
          <Route path="/inbox"              element={<RequirePermission permission="INBOX_VIEW"><InboxApp /></RequirePermission>} />
          <Route path="/quote-analyses"     element={<RequirePermission permission="QUOTE_ANALYSIS_VIEW"><QuoteAnalysesApp /></RequirePermission>} />
          <Route path="/workshop"           element={<RequirePermission permission="WORKSHOP_VIEW"><Suspense fallback={null}><WorkshopPage /></Suspense></RequirePermission>} />
          <Route path="/workshop/settings"  element={<RequirePermission permission="WORKSHOP_SETTINGS"><Suspense fallback={null}><WorkshopSettingsPage /></Suspense></RequirePermission>} />
          <Route path="/workshop/simulation" element={<RequirePermission permission="WORKSHOP_SIMULATION"><Suspense fallback={null}><WorkshopSimulationPage /></Suspense></RequirePermission>} />
        </Route>
      </Routes>
    </SimulationProvider>
  )
}
