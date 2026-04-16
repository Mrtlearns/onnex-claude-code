import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { quotesApi } from '@/lib/quotesApi'
import { integrationsApi } from '@/lib/integrationsApi'
import {
  Radio, Activity, ClipboardList, Settings,
  TrendingUp, Clock, CheckCircle2,
  ArrowRight, FlaskConical,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import MsgUploader, { type MsgExtractResult } from '@/components/msg/MsgUploader'
import AttachmentPreview from '@/components/msg/AttachmentPreview'
import CompliancePanel from '@/components/msg/CompliancePanel'
import { EmailInboxChecker } from '@/components/msg/EmailInboxChecker'

// ── Types ──────────────────────────────────────────────────────
interface QuoteRow {
  id: string
  quote_number: string
  customer_name: string
  source: 'api' | 'salesforce' | 'email' | 'portal'
  grand_total: number
  status: 'calculated' | 'pending' | 'sent' | 'accepted' | 'rejected'
  created_at: string
}

// ── KPI helpers ────────────────────────────────────────────────
function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function srcBadge(s: QuoteRow['source']) {
  const map: Record<QuoteRow['source'], string> = {
    api:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    portal:     'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    salesforce: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    email:      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  }
  return map[s]
}

function statusBadge(s: QuoteRow['status']) {
  const map: Record<QuoteRow['status'], string> = {
    calculated: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    pending:    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    sent:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    accepted:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    rejected:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  return map[s]
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)  return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── KPI Card ───────────────────────────────────────────────────
function KpiCard({
  icon: Icon, iconClass, label, value, sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`rounded-lg p-2 ${iconClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Quick-action card ──────────────────────────────────────────
function ActionCard({
  icon: Icon, iconClass, title, description, to, label,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  title: string
  description: string
  to: string
  label: string
}) {
  const nav = useNavigate()
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow group"
      onClick={() => nav(to)}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className={`rounded-md p-1.5 ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Button
          variant="outline"
          size="sm"
          className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
          onClick={e => { e.stopPropagation(); nav(to) }}
        >
          {label} <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Dashboard ──────────────────────────────────────────────────
export default function Dashboard() {
  const nav = useNavigate()
  const { accessToken } = useAuth()
  const [quotes, setQuotes]       = useState<QuoteRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [msgResult, setMsgResult] = useState<MsgExtractResult | null>(null)
  const [intakeId, setIntakeId]   = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    quotesApi.listUt()
      .then((data: QuoteRow[]) => { setQuotes(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [accessToken])

  // KPI calculations
  const total        = quotes.length
  const accepted     = quotes.filter(q => q.status === 'accepted').length
  const pending      = quotes.filter(q => q.status === 'pending' || q.status === 'sent').length
  const pipeline     = quotes.filter(q => ['pending','sent','calculated'].includes(q.status))
                             .reduce((s, q) => s + Number(q.grand_total), 0)
  const recent5      = quotes.slice(0, 5)

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">NDT Costing Portal — overview</p>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={ClipboardList}
          iconClass="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
          label="Total Quotes"
          value={loading ? '—' : total}
          sub="all time"
        />
        <KpiCard
          icon={TrendingUp}
          iconClass="bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400"
          label="Pipeline Value"
          value={loading ? '—' : fmt$(pipeline)}
          sub="pending + sent + calculated"
        />
        <KpiCard
          icon={CheckCircle2}
          iconClass="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
          label="Accepted"
          value={loading ? '—' : accepted}
          sub={total > 0 ? `${Math.round(accepted / total * 100)}% win rate` : 'no data'}
        />
        <KpiCard
          icon={Clock}
          iconClass="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
          label="Awaiting Response"
          value={loading ? '—' : pending}
          sub="pending + sent"
        />
      </div>

      {/* ── Recent Quotes ── */}
      <div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Quotes</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => nav('/quotes')} className="text-xs gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ) : recent5.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No quotes yet — generate one via the UT Calculator
              </div>
            ) : (
              <div className="divide-y">
                {recent5.map(q => (
                  <div
                    key={q.id}
                    className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded-md transition-colors"
                    onClick={() => nav('/quotes')}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-mono font-medium">{q.quote_number}</span>
                      <span className="text-xs text-muted-foreground ml-2 truncate">{q.customer_name}</span>
                    </div>
                    <span className="text-sm font-medium tabular-nums">{fmt$(Number(q.grand_total))}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${srcBadge(q.source)}`}>
                      {q.source}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusBadge(q.status)}`}>
                      {q.status}
                    </span>
                    <span className="text-xs text-muted-foreground w-16 text-right shrink-0">
                      {timeAgo(q.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Email Intake ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MsgUploader
          onExtract={async (result) => {
            setMsgResult(result)
            setIntakeId(null)
            // Fire pipeline/analyze — non-blocking, sets intakeId for CompliancePanel
            try {
              const activeAttachments = (result.attachments ?? []).filter(a => !a.filtered)
              const body = JSON.stringify({
                filename:        result.email?.subject ?? 'upload.msg',
                email:           result.email,
                attachments:     activeAttachments,
                attachmentCount: activeAttachments.length,
              })
              const data = await integrationsApi.analyze(body)
              setIntakeId(data.intakeId ?? null)
            } catch {
              // Non-fatal — CompliancePanel will show empty state
            }
          }}
        />
        <AttachmentPreview attachments={msgResult?.attachments ?? []} />
        <EmailInboxChecker />
      </div>

      {/* ── Pipeline Analysis Launch ── */}
      {(intakeId || msgResult) && (
        <div className="space-y-4">
          {intakeId ? (
            <Card className="border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-900/10">
              <CardContent className="pt-4 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/40 p-2 shrink-0">
                    <Activity className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">Pipeline ready to analyze</p>
                    <p className="text-xs text-green-600 dark:text-green-400 font-mono">intakeId: {intakeId.slice(0, 8)}…</p>
                  </div>
                </div>
                <Button
                  onClick={() => nav(`/analysis/${intakeId}`)}
                  className="bg-green-600 hover:bg-green-700 text-white shrink-0"
                  size="sm"
                >
                  Start Analysis <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Upload a .msg file above to start the pipeline</p>
              </CardContent>
            </Card>
          )}
          <CompliancePanel intakeId={intakeId} />
        </div>
      )}

      {/* ── Demo Analysis shortcut ── */}
      {!intakeId && !msgResult && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FlaskConical className="h-3.5 w-3.5" />
          <span>Want to preview the analysis UI?</span>
          <button
            onClick={() => nav('/analysis/demo')}
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            Open demo run
          </button>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionCard
            icon={Radio}
            iconClass="bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400"
            title="RT Costing"
            description="Radiographic Testing — X-ray job quotes across multiple profit scenarios."
            to="/rt"
            label="Open RT"
          />
          <ActionCard
            icon={Activity}
            iconClass="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
            title="UT Calculator"
            description="Ultrasonic Testing — 7 geometry types, scan time, lot pricing, weight-based pricing."
            to="/ut"
            label="Open UT"
          />
          <ActionCard
            icon={ClipboardList}
            iconClass="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            title="Quote History"
            description="All submitted UT quotes. Filter, search, and drill into full line-item breakdowns."
            to="/quotes"
            label="View Quotes"
          />
          <ActionCard
            icon={Settings}
            iconClass="bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400"
            title="Settings"
            description="Configure Salesforce, email, and n8n integration credentials."
            to="/settings"
            label="Open Settings"
          />
        </div>
      </div>
    </div>
  )
}
