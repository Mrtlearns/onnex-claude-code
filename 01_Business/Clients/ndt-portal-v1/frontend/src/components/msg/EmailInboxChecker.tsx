import { useState } from 'react'
import { Mail, RefreshCw, FlaskConical, ChevronDown, ChevronUp, Loader2, Building2, Hash } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAuthHeaders } from '@/lib/api'

interface EmailSummary {
  id: string
  threadId: string
  subject: string
  from: string
  date: string
  snippet: string
  body: string
}

interface CustomerResult {
  found: boolean
  name?: string
  matchMethod?: 'email' | 'domain'
}

interface PartResult {
  found: boolean
  partNumber?: string | null
  lastQuote?: { quoteNumber: string; date: string; grandTotal: number; accountName: string }
}

interface ClassifyResult {
  inspectionTypes: string[]
  confidence: 'high' | 'medium' | 'low'
  notes: string
  source: 'llm' | 'keyword'
  customer?: CustomerResult
  partDetection?: PartResult
}

const INSPECTION_COLORS: Record<string, string> = {
  RT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  UT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  ET: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  MT: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  PT: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  VT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
}

const CONFIDENCE_COLORS = {
  high:   'text-green-600 dark:text-green-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  low:    'text-red-500 dark:text-red-400',
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function EmailInboxChecker() {
  const [loading, setLoading] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [emails, setEmails] = useState<EmailSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [result, setResult] = useState<ClassifyResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function checkInbox() {
    setLoading(true)
    setError(null)
    setSelected(null)
    setResult(null)
    try {
      const res = await fetch('/api/ut/integrations/email/inbox', {
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { emails: EmailSummary[]; count: number }
      setEmails(data.emails)
      if (data.emails.length === 0) setError('No unread emails found.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function classifyEmail() {
    const email = emails.find(e => e.id === selected)
    if (!email) return
    setClassifying(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/ut/integrations/email/classify', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          subject: email.subject,
          from: email.from,
          body: email.body || email.snippet,
          snippet: email.snippet,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as ClassifyResult
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setClassifying(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-muted-foreground" />
            Email Inbox
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={checkInbox}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />
            }
            Check Inbox
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {error && (
          <p className="text-xs text-muted-foreground italic">{error}</p>
        )}

        {emails.length === 0 && !error && !loading && (
          <p className="text-xs text-muted-foreground italic">
            Click "Check Inbox" to fetch unread emails from ndtautoquotes@gmail.com
          </p>
        )}

        {/* Email list */}
        {emails.length > 0 && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {emails.map(email => (
              <div
                key={email.id}
                className={`rounded-md border p-2.5 cursor-pointer transition-colors ${
                  selected === email.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40 hover:bg-muted/30'
                }`}
                onClick={() => {
                  setSelected(email.id === selected ? null : email.id)
                  setResult(null)
                  setError(null)
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">
                      {email.subject || '(no subject)'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{email.from}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(email.date)}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setExpanded(expanded === email.id ? null : email.id)
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {expanded === email.id
                        ? <ChevronUp className="h-3 w-3" />
                        : <ChevronDown className="h-3 w-3" />
                      }
                    </button>
                  </div>
                </div>

                {expanded === email.id && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
                      {email.body || email.snippet || '(empty body)'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Process button */}
        {selected && (
          <Button
            size="sm"
            onClick={classifyEmail}
            disabled={classifying}
            className="w-full gap-1.5 h-8 text-xs"
          >
            {classifying
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <FlaskConical className="h-3.5 w-3.5" />
            }
            {classifying ? 'Classifying…' : 'Process — Classify Inspection Type'}
          </Button>
        )}

        {/* Classification result */}
        {result && (
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">Classification Result</p>

            {result.inspectionTypes.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {result.inspectionTypes.map(t => (
                  <span
                    key={t}
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${INSPECTION_COLORS[t] ?? 'bg-muted text-foreground'}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No inspection type identified</p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Confidence:{' '}
                <span className={`font-medium ${CONFIDENCE_COLORS[result.confidence]}`}>
                  {result.confidence}
                </span>
              </span>
              <span>·</span>
              <Badge variant="outline" className="text-xs h-4 px-1 py-0">
                {result.source === 'llm' ? 'AI' : 'keyword'}
              </Badge>
            </div>

            {result.notes && (
              <p className="text-xs text-muted-foreground italic">{result.notes}</p>
            )}

            {/* Customer identification */}
            {result.customer && (
              <div className="flex items-center gap-1.5 text-xs pt-1.5 border-t border-border/50">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {result.customer.found
                  ? <span className="font-medium">{result.customer.name}</span>
                  : <span className="text-amber-500 font-medium">Possible new customer</span>
                }
              </div>
            )}

            {/* Part number detection */}
            {result.partDetection && (
              <div className="flex items-start gap-1.5 text-xs pt-1.5 border-t border-border/50">
                <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                {result.partDetection.found && result.partDetection.lastQuote ? (
                  <span>
                    Part{' '}
                    <span className="font-mono font-medium">{result.partDetection.partNumber}</span>
                    {' '}detected. Last quote{' '}
                    <span className="font-mono font-medium">{result.partDetection.lastQuote.quoteNumber}</span>
                    {' '}found on{' '}
                    {new Date(result.partDetection.lastQuote.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}
                    {' — '}
                    <span className="font-medium">${result.partDetection.lastQuote.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </span>
                ) : result.partDetection.partNumber ? (
                  <span>
                    Part{' '}
                    <span className="font-mono font-medium">{result.partDetection.partNumber}</span>
                    {' '}detected — no prior quote found
                  </span>
                ) : (
                  <span className="text-muted-foreground">No part number found</span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
