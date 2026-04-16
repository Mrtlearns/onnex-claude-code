/**
 * EmailChecksTab — Settings tab for configuring email completeness checks
 *
 * Checks are seeded by migration 041 and cannot be created/deleted via UI.
 * Admins can: enable/disable, edit response_message, drag-to-reorder.
 *
 * API: GET/PATCH /email-checks, PATCH /email-checks/reorder
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthHeaders } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { GripVertical, Info } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailCheck {
  id:               string
  code:             string
  name:             string
  description:      string
  enabled:          boolean
  sort_order:       number
  response_message: string
  updated_at:       string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FLAG_ONLY_CODES = new Set(['CUSTOMER_IDENTIFIED'])

function codeColor(code: string): string {
  switch (code) {
    case 'DIAGRAM_ATTACHED':            return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    case 'CUSTOMER_IDENTIFIED':         return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    case 'INSPECTION_TYPE_CLASSIFIABLE':return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
    case 'PART_MATERIAL_PRESENT':       return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    default:                            return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmailChecksTab() {
  const [checks, setChecks]     = useState<EmailCheck[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)   // check id being saved
  const [editing, setEditing]   = useState<string | null>(null)   // check id open for message edit
  const [draftMsg, setDraftMsg] = useState('')
  const [error, setError]       = useState<string | null>(null)

  // drag state
  const dragId    = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // ── Load ──────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/email-checks', { headers: getAuthHeaders() })
      setChecks(r.ok ? await r.json() : [])
    } catch {
      setChecks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Toggle enabled ────────────────────────────────────────────────────

  async function toggleEnabled(check: EmailCheck) {
    setSaving(check.id)
    setError(null)
    try {
      const r = await fetch(`/api/email-checks/${check.id}`, {
        method:  'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify({ enabled: !check.enabled }),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Save failed')
      const updated: EmailCheck = await r.json()
      setChecks(cs => cs.map(c => c.id === updated.id ? updated : c))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(null)
    }
  }

  // ── Save response_message ─────────────────────────────────────────────

  async function saveMessage(check: EmailCheck) {
    setSaving(check.id)
    setError(null)
    try {
      const r = await fetch(`/api/email-checks/${check.id}`, {
        method:  'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify({ response_message: draftMsg }),
      })
      if (!r.ok) throw new Error((await r.json()).error ?? 'Save failed')
      const updated: EmailCheck = await r.json()
      setChecks(cs => cs.map(c => c.id === updated.id ? updated : c))
      setEditing(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(null)
    }
  }

  // ── Drag-to-reorder ───────────────────────────────────────────────────

  function onDragStart(e: React.DragEvent, id: string) {
    dragId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }

  function onDragLeave() { setDragOverId(null) }

  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    setDragOverId(null)
    const sourceId = dragId.current
    dragId.current = null
    if (!sourceId || sourceId === targetId) return
    const from = checks.findIndex(c => c.id === sourceId)
    const to   = checks.findIndex(c => c.id === targetId)
    if (from === -1 || to === -1) return
    const next = [...checks]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const reordered = next.map((c, i) => ({ ...c, sort_order: i }))
    setChecks(reordered)
    fetch('/api/email-checks/reorder', {
      method:  'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body:    JSON.stringify(reordered.map(({ id, sort_order }) => ({ id, sort_order }))),
    }).catch(() => {})
  }

  function onDragEnd() {
    dragId.current = null
    setDragOverId(null)
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
        Loading email checks…
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-3 text-sm text-blue-800 dark:text-blue-300">
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          Checks run against every inbound email quote in order. The first <strong>blocking</strong> failure
          triggers an auto-reply and holds the quote at <code>needs_info</code>.
          Flag-only checks (e.g. <code>CUSTOMER_IDENTIFIED</code>) never block processing.
          Drag to reorder. Checks cannot be created or deleted here — they are seeded by the system.
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {checks.map(check => {
          const isFlagOnly = FLAG_ONLY_CODES.has(check.code)
          const isEditing  = editing === check.id
          const isDragOver = dragOverId === check.id
          const isSaving   = saving === check.id

          return (
            <Card
              key={check.id}
              draggable
              onDragStart={e => onDragStart(e, check.id)}
              onDragOver={e => onDragOver(e, check.id)}
              onDragLeave={onDragLeave}
              onDrop={e => onDrop(e, check.id)}
              onDragEnd={onDragEnd}
              className={[
                'transition-all cursor-default',
                isDragOver ? 'ring-2 ring-primary ring-offset-1 opacity-75' : '',
                !check.enabled ? 'opacity-60' : '',
              ].join(' ')}
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center gap-3">
                  {/* drag handle */}
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab flex-shrink-0" />

                  {/* sort order badge */}
                  <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">
                    {check.sort_order + 1}.
                  </span>

                  {/* code badge */}
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium flex-shrink-0 ${codeColor(check.code)}`}>
                    {check.code}
                  </span>

                  {/* name */}
                  <CardTitle className="text-sm font-medium flex-1">{check.name}</CardTitle>

                  {/* flag-only badge */}
                  {isFlagOnly && (
                    <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">
                      flag only
                    </Badge>
                  )}

                  {/* enabled toggle */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {check.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={check.enabled}
                      disabled={isSaving}
                      onCheckedChange={() => toggleEnabled(check)}
                    />
                  </div>
                </div>

                {check.description && (
                  <p className="text-xs text-muted-foreground mt-1 ml-10">{check.description}</p>
                )}
              </CardHeader>

              {/* Response message section — only for blocking checks */}
              {!isFlagOnly && (
                <CardContent className="px-4 pb-3 pt-0 ml-10">
                  {isEditing ? (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Auto-reply message</label>
                      <textarea
                        value={draftMsg}
                        onChange={e => setDraftMsg(e.target.value)}
                        rows={4}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                        placeholder="Enter the auto-reply message sent when this check fails…"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={isSaving}
                          onClick={() => saveMessage(check)}
                          className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                        >
                          {isSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="px-3 py-1 rounded-md border text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 group">
                      <p className="text-xs text-muted-foreground flex-1 whitespace-pre-wrap line-clamp-3">
                        {check.response_message || <em>No auto-reply message configured</em>}
                      </p>
                      <button
                        onClick={() => { setEditing(check.id); setDraftMsg(check.response_message) }}
                        className="text-xs text-primary underline opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {checks.length === 0 && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          No email checks found. Run migration 041 to seed the default checks.
        </div>
      )}
    </div>
  )
}
