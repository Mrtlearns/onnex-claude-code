import { useRef, useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, FileText, ScanLine } from 'lucide-react'
import RtSettingsTab from './RtSettingsTab'
import RtQuoteTab from './RtQuoteTab'
import { useRtSettings } from '@/lib/rt/hooks/useRtSettings'
import { useRtOperators } from '@/lib/rt/hooks/useRtOperators'
import { useRtFilmSizes } from '@/lib/rt/hooks/useRtFilmSizes'
import { useRtPricingTiers } from '@/lib/rt/hooks/useRtPricingTiers'
import { computeRates, buildFilmSizeMap } from '@/lib/rt/calculations'
import { useInspectorStore } from '@/stores/inspector-store'
import { getAuthHeaders } from '@/lib/api'

// ── Part type labels ──────────────────────────────────────────────────────────

const PART_TYPES = [
  { value: 'pressure_vessel',    label: 'Pressure Vessel' },
  { value: 'pipe_spool',         label: 'Pipe Spool' },
  { value: 'casting',            label: 'Casting' },
  { value: 'forging',            label: 'Forging' },
  { value: 'aerospace_component',label: 'Aerospace Component' },
  { value: 'structural_weldment',label: 'Structural Weldment' },
  { value: 'heat_exchanger',     label: 'Heat Exchanger' },
  { value: 'storage_tank',       label: 'Storage Tank' },
  { value: 'other',              label: 'Other' },
] as const

const STAGE_LABELS: Record<string, string> = {
  pending:     'Queued…',
  classifying: 'Classifying part geometry…',
  assembling:  'Assembling analysis prompt…',
  analyzing:   'Running RT analysis…',
  validating:  'Validating results…',
}

const STAGE_ORDER = ['pending', 'classifying', 'assembling', 'analyzing', 'validating']

// ── Analysis History (fetched from backend) ──────────────────────────────────

interface AnalysisJobRow {
  id:             string
  status:         string
  stage:          string | null
  file_name:      string | null
  low_confidence: boolean
  error:          string | null
  created_at:     string
  updated_at:     string
}

function AnalysisHistory() {
  const navigate = useNavigate()
  const [jobs, setJobs]       = useState<AnalysisJobRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const resp = await fetch('/api/rt/analyze', { headers: getAuthHeaders() })
        if (!resp.ok) throw new Error(`${resp.status}`)
        const rows = (await resp.json()) as AnalysisJobRow[]
        if (!cancelled) setJobs(rows)
      } catch {
        // non-fatal — history just won't show
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="text-xs text-muted-foreground mt-6">Loading history…</div>
  if (jobs.length === 0) return null

  const STATUS_DOT: Record<string, string> = {
    complete: '#00E676',
    failed:   '#FF1744',
  }

  return (
    <div className="mt-8">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Analysis History
      </h4>
      <div className="flex flex-col gap-1.5">
        {jobs.map((job) => {
          const isComplete = job.status === 'complete'
          const isFailed   = job.status === 'failed'
          const date = new Date(job.created_at)

          return (
            <div
              key={job.id}
              onClick={isComplete ? () => navigate(`/rt/inspector/${job.id}`) : undefined}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ${
                isComplete
                  ? 'cursor-pointer hover:bg-accent/10 border-border'
                  : 'opacity-60 border-border/50'
              }`}
            >
              {/* Status dot */}
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: STATUS_DOT[job.status] ?? '#FFD600',
                }}
              />

              {/* File name */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {job.file_name ?? 'Untitled'}
                </div>
                {isFailed && job.error && (
                  <div className="text-xs text-destructive truncate mt-0.5">{job.error}</div>
                )}
                {!isComplete && !isFailed && (
                  <div className="text-xs text-muted-foreground mt-0.5">{job.stage ?? job.status}</div>
                )}
              </div>

              {/* Low confidence badge */}
              {job.low_confidence && isComplete && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-yellow-400/15 text-yellow-500 border border-yellow-400/30">
                  Low conf
                </span>
              )}

              {/* Date */}
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Analyze tab ───────────────────────────────────────────────────────────────

function AnalyzeTab() {
  const navigate      = useNavigate()
  const store         = useInspectorStore()
  const fileRef       = useRef<HTMLInputElement>(null)
  const [showLowConf, setShowLowConf] = useState(false)

  const progressPct = store.stage
    ? Math.round(((STAGE_ORDER.indexOf(store.stage) + 1) / STAGE_ORDER.length) * 100)
    : 0

  // React to analysis completing — runs after every store update
  useEffect(() => {
    if (!store.analysis || store.loading || !store.jobId) return

    const lowConf = store.classification && store.classification.confidence < 0.6
    if (lowConf) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loading guard
      setShowLowConf(true)
    } else {
      navigate(`/rt/inspector/${store.jobId}`)
    }
  }, [store.analysis, store.loading, store.jobId, store.classification, navigate])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setShowLowConf(false)
    store.loadAnalysis(file)
    // reset input so the same file can be re-selected
    e.target.value = ''
  }

  function handleProceed() {
    if (store.jobId) {
      navigate(`/rt/inspector/${store.jobId}`)
    }
  }

  return (
    <div className="max-w-lg mx-auto py-12 flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Analyze Drawing</h3>
        <p className="text-sm text-muted-foreground">
          Upload a PDF or image of an engineering drawing. The two-stage AI pipeline will classify
          the part and generate RT inspection zones.
        </p>
      </div>

      {/* Drop zone */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={store.loading}
        className="border-2 border-dashed rounded-lg p-10 text-center hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ScanLine className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">Click to select drawing</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG — max 20 MB</p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFile}
        />
      </button>

      {/* Progress bar */}
      {store.loading && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{store.stage ? (STAGE_LABELS[store.stage] ?? store.stage) : 'Initializing…'}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {store.error && (
        <div className="text-sm text-destructive border border-destructive/30 rounded p-3">
          {store.error}
        </div>
      )}

      <AnalysisHistory />

      {/* Low-confidence warning banner */}
      {showLowConf && store.classification && (
        <div className="border border-yellow-400/40 bg-yellow-400/10 rounded-lg p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-yellow-400">
            Low confidence ({Math.round(store.classification.confidence * 100)}%) — verify part type before inspecting
          </p>
          <p className="text-xs text-muted-foreground">
            The classifier identified this as a{' '}
            <strong>{store.classification.part_type.replace(/_/g, ' ')}</strong>.
            Confirm the type or select a correction below — this is noted for review but does not re-run the analysis.
          </p>
          <div className="flex gap-2 items-center">
            <select
              className="text-sm border rounded px-2 py-1 bg-background flex-1"
              defaultValue={store.classification.part_type}
            >
              {PART_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleProceed}
              className="px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Proceed
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main RtApp ────────────────────────────────────────────────────────────────

export default function RtApp() {
  const { settings, loading: sLoading, update: updateSettings } = useRtSettings()
  const { operators, loading: oLoading, update: updateOperator } = useRtOperators()
  const { filmSizes, loading: fLoading } = useRtFilmSizes()
  const { tiers, loading: tLoading } = useRtPricingTiers()

  const rates = useMemo(() => {
    if (!settings || operators.length === 0) return null
    return computeRates(settings, operators)
  }, [settings, operators])

  const filmSizeMap = useMemo(() => {
    if (!settings || filmSizes.length === 0) return new Map()
    return buildFilmSizeMap(filmSizes, settings.filmMarkupPct)
  }, [filmSizes, settings])

  const loading = sLoading || oLoading || fLoading || tLoading

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading RT data…</div>
  if (!settings) return <div className="p-8 text-destructive">Failed to load settings</div>

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">RT Costing Calculator</h2>
          {rates && (
            <p className="text-sm text-muted-foreground mt-1">
              Rates — Shooter: ${rates.shooterCostPerMin.toFixed(3)}/min · DR: ${rates.darkroomCostPerMin.toFixed(3)}/min · Reader: ${rates.readerCostPerMin.toFixed(3)}/min
            </p>
          )}
        </div>
      </div>
      <Tabs defaultValue="quote">
        <TabsList>
          <TabsTrigger value="quote"><FileText className="h-3.5 w-3.5 mr-1.5" />Quote Entry</TabsTrigger>
          <TabsTrigger value="analyze"><ScanLine className="h-3.5 w-3.5 mr-1.5" />Analyze Drawing</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-3.5 w-3.5 mr-1.5" />Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="quote" className="mt-4">
          {rates && settings && (
            <RtQuoteTab
              rates={rates}
              filmSizes={filmSizes}
              filmSizeMap={filmSizeMap}
              tiers={tiers}
              settings={settings}
            />
          )}
        </TabsContent>
        <TabsContent value="analyze" className="mt-4">
          <AnalyzeTab />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <RtSettingsTab settings={settings} operators={operators} onUpdateSettings={updateSettings} onUpdateOperator={updateOperator} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
