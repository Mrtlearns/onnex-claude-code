/**
 * InboxApp — Email quote inbox
 *
 * Left panel: list of email_quotes with status, inspection types, prospect flag
 * Right panel: conversation thread + attachment list + check results
 *
 * API: GET /inbox/quotes, GET /inbox/quotes/:id/thread, PATCH /inbox/quotes/:id/status
 */

import { useCallback, useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api'
import { Mail, RefreshCw, AlertCircle, UserPlus, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailQuote {
  id:                string
  quote_number:      string
  sender_name:       string | null
  sender_email:      string
  customer_id:       string | null
  subject:           string
  status:            string
  inspection_types:  string[]
  llm_routing:       string | null
  received_at:       string
  updated_at:        string
}

interface ThreadMessage {
  id:                      string
  direction:               'inbound' | 'outbound'
  subject:                 string
  body_text:               string
  sender_email:            string
  recipient_email:         string
  triggered_by_check_code: string | null
  sent_at:                 string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  received:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  checking:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  needs_info: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  quoted:     'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed:     'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
}

const NDT_TYPE_COLORS: Record<string, string> = {
  RT: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  UT: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  ET: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  MT: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  PT: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  VT: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH  = diffMs / 3600000
  if (diffH < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffH < 168) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ── Quote List ────────────────────────────────────────────────────────────────

function QuoteListItem({ quote, selected, onSelect }: {
  quote: EmailQuote
  selected: boolean
  onSelect: () => void
}) {
  const isProspect = quote.customer_id === null
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3 py-3 border-b border-border transition-colors',
        selected ? 'bg-primary/10' : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* sender + prospect flag */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">
              {quote.sender_name ?? quote.sender_email}
            </span>
            {isProspect && (
              <UserPlus className="h-3 w-3 text-blue-500 flex-shrink-0" title="New prospect" />
            )}
          </div>
          {/* subject */}
          <p className="text-xs text-muted-foreground truncate mt-0.5">{quote.subject}</p>
          {/* quote number + types */}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] font-mono text-muted-foreground">{quote.quote_number}</span>
            <span className={cn('px-1.5 py-0 rounded text-[10px] font-medium', STATUS_COLORS[quote.status] ?? STATUS_COLORS.received)}>
              {quote.status.replace('_', ' ')}
            </span>
            {quote.inspection_types.map(t => (
              <span key={t} className={cn('px-1.5 py-0 rounded text-[10px] font-medium', NDT_TYPE_COLORS[t] ?? '')}>
                {t}
              </span>
            ))}
          </div>
        </div>
        {/* time */}
        <span className="text-[10px] text-muted-foreground flex-shrink-0 pt-0.5">
          {fmtDate(quote.received_at)}
        </span>
      </div>
    </button>
  )
}

// ── Thread Panel ──────────────────────────────────────────────────────────────

function ThreadPanel({ quote }: { quote: EmailQuote }) {
  const [thread, setThread] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/inbox/quotes/${quote.id}/thread`, { headers: getAuthHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(setThread)
      .catch(() => setThread([]))
      .finally(() => setLoading(false))
  }, [quote.id])

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Loading thread…</div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {thread.map(msg => (
        <div
          key={msg.id}
          className={cn(
            'rounded-lg border p-3 text-sm',
            msg.direction === 'outbound'
              ? 'ml-8 bg-primary/5 border-primary/20'
              : 'mr-8 bg-muted/50',
          )}
        >
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-xs font-medium">
              {msg.direction === 'outbound' ? `← ${msg.sender_email}` : `→ ${msg.sender_email}`}
            </span>
            <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(msg.sent_at).toLocaleString()}
            </span>
          </div>
          {msg.subject && (
            <p className="text-xs text-muted-foreground mb-1 font-medium">{msg.subject}</p>
          )}
          <p className="whitespace-pre-wrap text-xs leading-relaxed">{msg.body_text}</p>
          {msg.triggered_by_check_code && (
            <div className="mt-2 pt-2 border-t border-border">
              <span className="text-[10px] text-muted-foreground">
                Triggered by check: <code>{msg.triggered_by_check_code}</code>
              </span>
            </div>
          )}
        </div>
      ))}
      {thread.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-8">No messages in thread yet.</div>
      )}
    </div>
  )
}

// ── Header for selected quote ─────────────────────────────────────────────────

function QuoteDetailHeader({ quote }: { quote: EmailQuote }) {
  const isProspect = quote.customer_id === null
  return (
    <div className="border-b border-border px-4 py-3 shrink-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">{quote.subject}</h2>
            {isProspect && (
              <span className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                <UserPlus className="h-3 w-3" /> New prospect
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {quote.sender_name ? `${quote.sender_name} <${quote.sender_email}>` : quote.sender_email}
            {' · '}
            <span className="font-mono">{quote.quote_number}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', STATUS_COLORS[quote.status] ?? STATUS_COLORS.received)}>
            {quote.status.replace('_', ' ')}
          </span>
          {quote.inspection_types.map(t => (
            <span key={t} className={cn('px-1.5 py-0.5 rounded text-xs font-medium', NDT_TYPE_COLORS[t] ?? '')}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function InboxApp() {
  const [quotes, setQuotes]     = useState<EmailQuote[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch('/api/inbox/quotes?limit=100', { headers: getAuthHeaders() })
      if (!r.ok) throw new Error('Failed to load inbox')
      setQuotes(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading inbox')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selected = quotes.find(q => q.id === selectedId) ?? null

  return (
    <div className="flex h-full">
      {/* ── Left panel — quote list ── */}
      <div className="w-80 shrink-0 flex flex-col border-r border-border">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Email Inbox</span>
            {!loading && (
              <span className="text-xs text-muted-foreground">({quotes.length})</span>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            title="Refresh"
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
            </div>
          )}
          {loading && !error && (
            <div className="text-center py-8 text-sm text-muted-foreground">Loading…</div>
          )}
          {!loading && !error && quotes.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">No email quotes yet.</div>
          )}
          {quotes.map(q => (
            <QuoteListItem
              key={q.id}
              quote={q}
              selected={selectedId === q.id}
              onSelect={() => setSelectedId(q.id)}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel — thread / detail ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <QuoteDetailHeader quote={selected} />
            <ThreadPanel quote={selected} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Mail className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Select an email quote to view the thread</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
