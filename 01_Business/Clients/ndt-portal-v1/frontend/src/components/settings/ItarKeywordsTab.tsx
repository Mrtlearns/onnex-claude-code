import { useState, useEffect } from 'react'
import { settingsApi } from '@/lib/settingsApi'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

interface ItarKeyword {
  id: number
  keyword: string
  category: string
  weight: number
  description: string | null
}

interface AuditEntry {
  id: number
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  keyword_id: number
  keyword: string
  category: string
  weight: number
  description: string | null
  changed_by: string
  changed_by_email: string
  changed_at: string
  prev_category: string | null
  prev_weight: number | null
  prev_description: string | null
}

const CATEGORIES = ['ITAR', 'EAR', 'MIL_SPEC', 'USML', 'CAGE'] as const

const BLANK_DRAFT = { keyword: '', category: '', weight: 10, description: '' }

// ── Action badge ──────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const variant =
    action === 'CREATE' ? 'default' :
    action === 'DELETE' ? 'destructive' : 'secondary'
  return <Badge variant={variant} className="text-[10px] uppercase">{action}</Badge>
}

// ── ItarKeywordsTab ───────────────────────────────────────────────

export default function ItarKeywordsTab() {
  const [keywords, setKeywords]     = useState<ItarKeyword[]>([])
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [editDraft, setEditDraft]   = useState<{ category: string; weight: number; description: string }>({ category: '', weight: 1, description: '' })
  const [addMode, setAddMode]       = useState(false)
  const [addDraft, setAddDraft]     = useState({ ...BLANK_DRAFT })
  const [auditLog, setAuditLog]     = useState<AuditEntry[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  async function fetchKeywords() {
    setLoading(true)
    setError(null)
    try {
      const data = await settingsApi.getItarKeywords() as { keywords?: ItarKeyword[]; error?: string }
      if (data.error) { setError(data.error); return }
      setKeywords(data.keywords ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load keywords')
    } finally {
      setLoading(false)
    }
  }

  async function fetchAuditLog(offset = 0) {
    try {
      const data = await settingsApi.getItarAuditLog(50, offset) as { log?: AuditEntry[]; total?: number; error?: string }
      if (data.error) return
      if (offset === 0) {
        setAuditLog(data.log ?? [])
      } else {
        setAuditLog(prev => [...prev, ...(data.log ?? [])])
      }
      setAuditTotal(data.total ?? 0)
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    void fetchKeywords()
    void fetchAuditLog(0)
  }, [])

  // ── Add ──────────────────────────────────────────────────────────

  async function handleAdd() {
    const kw = addDraft.keyword.trim()
    if (!kw) { setError('Keyword is required'); return }
    if (!addDraft.category) { setError('Category is required'); return }
    const weight = Number(addDraft.weight)
    if (!Number.isInteger(weight) || weight < 1 || weight > 50) { setError('Weight must be 1–50'); return }

    setSaving(true)
    setError(null)
    try {
      const res = await settingsApi.addItarKeyword({
        keyword: kw,
        category: addDraft.category,
        weight,
        description: addDraft.description.trim() || undefined,
      }) as { error?: string }
      if (res.error) { setError(res.error); return }
      setAddMode(false)
      setAddDraft({ ...BLANK_DRAFT })
      await fetchKeywords()
      await fetchAuditLog(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────

  function startEdit(kw: ItarKeyword) {
    setEditingId(kw.id)
    setEditDraft({ category: kw.category, weight: kw.weight, description: kw.description ?? '' })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  async function handleSaveEdit(id: number) {
    const weight = Number(editDraft.weight)
    if (!Number.isInteger(weight) || weight < 1 || weight > 50) { setError('Weight must be 1–50'); return }

    setSaving(true)
    setError(null)
    try {
      const res = await settingsApi.updateItarKeyword(id, {
        category: editDraft.category,
        weight,
        description: editDraft.description.trim() || undefined,
      }) as { error?: string }
      if (res.error) { setError(res.error); return }
      setEditingId(null)
      await fetchKeywords()
      await fetchAuditLog(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────

  async function handleDelete(kw: ItarKeyword) {
    if (!window.confirm(`Delete keyword "${kw.keyword}"? This action is permanently logged and cannot be undone.`)) return
    setError(null)
    try {
      const res = await settingsApi.deleteItarKeyword(kw.id) as { error?: string }
      if (res.error) { setError(res.error); return }
      await fetchKeywords()
      await fetchAuditLog(0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Keyword library card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ITAR Keyword Library</CardTitle>
          <CardDescription>
            Keywords matched against document text to detect export-controlled content.
            Changes are permanently audited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-xs text-red-500 mb-3">{error}</p>
          )}

          {loading ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wide">Keyword</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Category</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide w-20">Weight</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Description</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map(kw => (
                  <TableRow key={kw.id}>
                    {editingId === kw.id ? (
                      <>
                        <TableCell className="font-mono text-xs">{kw.keyword}</TableCell>
                        <TableCell>
                          <Select value={editDraft.category} onValueChange={v => setEditDraft(d => ({ ...d, category: v }))}>
                            <SelectTrigger className="h-7 text-xs w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={editDraft.weight}
                            onChange={e => setEditDraft(d => ({ ...d, weight: Number(e.target.value) }))}
                            className="h-7 text-xs w-16"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={editDraft.description}
                            onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))}
                            className="h-7 text-xs"
                            placeholder="Optional description"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              disabled={saving}
                              onClick={() => void handleSaveEdit(kw.id)}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={cancelEdit}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-mono text-xs font-medium">{kw.keyword}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{kw.category}</Badge>
                        </TableCell>
                        <TableCell className="text-sm tabular-nums">{kw.weight}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{kw.description ?? '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(kw)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => void handleDelete(kw)}
                              className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}

                {/* Add row */}
                {addMode && (
                  <TableRow>
                    <TableCell>
                      <Input
                        value={addDraft.keyword}
                        onChange={e => setAddDraft(d => ({ ...d, keyword: e.target.value }))}
                        className="h-7 text-xs font-mono"
                        placeholder="MARAGING STEEL"
                        autoFocus
                      />
                    </TableCell>
                    <TableCell>
                      <Select value={addDraft.category} onValueChange={v => setAddDraft(d => ({ ...d, category: v }))}>
                        <SelectTrigger className="h-7 text-xs w-28">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={addDraft.weight}
                        onChange={e => setAddDraft(d => ({ ...d, weight: Number(e.target.value) }))}
                        className="h-7 text-xs w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={addDraft.description}
                        onChange={e => setAddDraft(d => ({ ...d, description: e.target.value }))}
                        className="h-7 text-xs"
                        placeholder="Optional description"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          disabled={saving}
                          onClick={() => void handleAdd()}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2"
                          onClick={() => { setAddMode(false); setError(null) }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}

          {!addMode && (
            <Button
              size="sm"
              variant="outline"
              className="mt-4 gap-1.5"
              onClick={() => { setAddMode(true); setAddDraft({ ...BLANK_DRAFT }); setError(null) }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Keyword
            </Button>
          )}

          <p className="mt-4 text-[11px] text-muted-foreground">
            Scores: &lt; 5 = CLEAN · 5–9 = EAR_LOW · 10–14 = EAR_HIGH → blocks cloud LLM · 15–24 = NEEDS_REVIEW → held for human review · ≥ 25 = ITAR → blocked
          </p>
        </CardContent>
      </Card>

      {/* Audit log card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Audit Log</CardTitle>
          <CardDescription>
            All keyword additions, edits, and deletions are permanently logged here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wide">Date / Time</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Action</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Keyword</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Category</TableHead>
                <TableHead className="text-xs uppercase tracking-wide w-16">Weight</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Changed By</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Previous Values</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLog.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">
                    No audit entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                auditLog.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.changed_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <ActionBadge action={entry.action} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.keyword}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{entry.category}</Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{entry.weight}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{entry.changed_by_email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {entry.action === 'UPDATE' && (entry.prev_category || entry.prev_weight)
                        ? `${entry.prev_category ?? '—'} / ${entry.prev_weight ?? '—'}`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {auditLog.length < auditTotal && (
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => void fetchAuditLog(auditLog.length)}
            >
              Show more ({auditTotal - auditLog.length} remaining)
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
