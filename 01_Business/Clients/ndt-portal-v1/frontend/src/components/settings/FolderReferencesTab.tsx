/**
 * FolderReferencesTab — manage named Nextcloud folder aliases.
 *
 * Users register an alias (e.g. 'tech_spec') mapped to a Nextcloud folder path
 * (e.g. /NDT/TechSpecs/). Inspection steps can later resolve the alias to its
 * actual path and read documents from it.
 */

import { useState } from 'react'
import { Plus, Pencil, Trash2, FolderOpen, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import NextcloudBrowser from '@/components/documents/NextcloudBrowser'
import { useFolderReferences } from '@/hooks/useFolderReferences'
import type { FolderReference } from '@/lib/settingsApi'

// ── Types ─────────────────────────────────────────────────────

interface FormState {
  alias: string
  displayName: string
  nextcloudPath: string
  description: string
}

const BLANK_FORM: FormState = { alias: '', displayName: '', nextcloudPath: '', description: '' }

// ── FolderReferencesTab ───────────────────────────────────────

export function FolderReferencesTab() {
  const { refs, loading, error, createRef, updateRef, deleteRef } = useFolderReferences()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [browserOpen, setBrowserOpen] = useState(false)
  const [browsedPath, setBrowsedPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  function openAdd() {
    setEditingId(null)
    setForm(BLANK_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(ref: FolderReference) {
    setEditingId(ref.id)
    setForm({
      alias:        ref.alias,
      displayName:  ref.displayName,
      nextcloudPath: ref.nextcloudPath,
      description:  ref.description ?? '',
    })
    setFormError(null)
    setFormOpen(true)
  }

  function handleBrowseSelect() {
    setBrowsedPath('')
    setBrowserOpen(true)
  }

  function handleSelectFolder() {
    if (browsedPath) {
      setForm(f => ({ ...f, nextcloudPath: browsedPath }))
    }
    setBrowserOpen(false)
  }

  async function handleSave() {
    setFormError(null)
    const alias = form.alias.trim()
    const displayName = form.displayName.trim()
    const nextcloudPath = form.nextcloudPath.trim()

    if (!alias || !displayName || !nextcloudPath) {
      setFormError('Alias, display name, and folder path are required.')
      return
    }
    if (!/^[a-z0-9_]+$/.test(alias)) {
      setFormError('Alias may only contain lowercase letters, numbers, and underscores.')
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await updateRef(editingId, { alias, displayName, nextcloudPath, description: form.description || undefined })
      } else {
        await createRef({ alias, displayName, nextcloudPath, description: form.description || undefined })
      }
      setFormOpen(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      setFormError(msg.includes('409') || msg.includes('already') ? `Alias '${alias}' is already in use.` : msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ref: FolderReference) {
    if (!confirm(`Remove folder reference '${ref.alias}'?`)) return
    await deleteRef(ref.id)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Folder References</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Named aliases for Nextcloud folders. Inspection steps resolve these at runtime.
          </p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Reference
        </Button>
      </div>

      {/* Reference table */}
      {loading ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>
      ) : error ? (
        <p className="text-xs text-red-500 py-4 text-center">{error}</p>
      ) : refs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-8 text-center">
          <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No folder references configured.</p>
          <p className="text-xs text-muted-foreground mt-1">Add one to let inspection steps resolve folder paths.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Alias</th>
              <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Display Name</th>
              <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">Nextcloud Path</th>
              <th className="py-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {refs.map((ref) => (
              <tr key={ref.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                <td className="py-2 pr-4 font-mono text-xs text-primary">{ref.alias}</td>
                <td className="py-2 pr-4 text-sm">{ref.displayName}</td>
                <td className="py-2 pr-4 font-mono text-xs text-muted-foreground truncate max-w-[260px]">{ref.nextcloudPath}</td>
                <td className="py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={() => openEdit(ref)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => void handleDelete(ref)}
                      className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Folder Reference' : 'Add Folder Reference'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Alias</label>
              <Input
                placeholder="tech_spec"
                value={form.alias}
                onChange={e => setForm(f => ({ ...f, alias: e.target.value.toLowerCase() }))}
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Lowercase letters, numbers, underscores only.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Display Name</label>
              <Input
                placeholder="Technical Specifications"
                value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nextcloud Folder</label>
              <div className="flex gap-2">
                <Input
                  placeholder="/NDT/TechSpecs/"
                  value={form.nextcloudPath}
                  onChange={e => setForm(f => ({ ...f, nextcloudPath: e.target.value }))}
                  className="font-mono text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleBrowseSelect} className="shrink-0 gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Browse
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description (optional)</label>
              <Input
                placeholder="Folder containing customer technical specs"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            {formError && (
              <p className="text-xs text-red-500">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setFormOpen(false)}>
              <X className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nextcloud folder browser dialog */}
      <Dialog open={browserOpen} onOpenChange={setBrowserOpen}>
        <DialogContent className="max-w-2xl h-[520px] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b border-border/50 shrink-0">
            <DialogTitle className="text-sm">Browse Nextcloud — Select a Folder</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <NextcloudBrowser onPathChange={path => setBrowsedPath(path)} />
          </div>
          <div className="px-4 py-3 border-t border-border/50 shrink-0 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground font-mono truncate">
              {browsedPath || 'Navigate to a folder above'}
            </p>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setBrowserOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSelectFolder} disabled={!browsedPath}>
                <Check className="h-3.5 w-3.5 mr-1" /> Select This Folder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
