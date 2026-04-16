/**
 * PipelineHistory — list of all pipeline runs with links to audit log and analysis
 * Route: /audit  (no intakeId)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { integrationsApi } from '@/lib/integrationsApi'
import { ScrollText, BarChart3, RefreshCw, History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Session {
  intakeId: string
  status: string
  msgFilename: string
  createdAt: string
  updatedAt: string
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  stalled:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  failed:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export default function PipelineHistory() {
  const { accessToken } = useAuth()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const navigate = useNavigate()

  const load = async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      setSessions(await integrationsApi.getSessions())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [accessToken])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <History className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Pipeline History</h1>
          {sessions.length > 0 && (
            <Badge className="bg-muted text-muted-foreground">{sessions.length} runs</Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={load} className="gap-1.5 text-xs h-7">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {loading && (
        <p className="text-muted-foreground text-sm">Loading…</p>
      )}

      {error && !loading && (
        <p className="text-destructive text-sm">Failed to load: {error}</p>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <ScrollText className="h-10 w-10 opacity-20" />
          <p className="text-sm">No pipeline runs yet.</p>
          <p className="text-xs">Upload a .msg file and trigger the pipeline to get started.</p>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">File</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Started</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map(s => {
                const duration = Math.round(
                  (new Date(s.updatedAt).getTime() - new Date(s.createdAt).getTime()) / 1000,
                )
                return (
                  <tr key={s.intakeId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs truncate max-w-xs" title={s.msgFilename}>
                      {s.msgFilename}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STATUS_COLORS[s.status] ?? STATUS_COLORS.processing}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {duration > 0 ? `${duration}s` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => navigate(`/audit/${s.intakeId}`)}
                        >
                          <ScrollText className="h-3 w-3" />
                          Audit
                        </Button>
                        <Button
                          size="sm" variant="outline" className="h-7 text-xs gap-1"
                          onClick={() => navigate(`/analysis/${s.intakeId}`)}
                        >
                          <BarChart3 className="h-3 w-3" />
                          Analysis
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
