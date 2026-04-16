/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import { Save, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface TypeFormState { code: string; label: string; description: string }
export const TYPE_BLANK: TypeFormState = { code: '', label: '', description: '' }

interface TypeFormProps {
  initial?: TypeFormState
  saving: boolean
  onSave: (v: TypeFormState) => void
  onCancel: () => void
}

export default function TypeForm({ initial, saving, onSave, onCancel }: TypeFormProps) {
  const [form, setForm] = useState<TypeFormState>(initial ?? TYPE_BLANK)

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Code</Label>
          <Input
            value={form.code}
            onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
            placeholder="RT"
            maxLength={20}
            className="h-8 text-sm font-mono uppercase"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input
            value={form.label}
            onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            placeholder="Radiographic Testing"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Description</Label>
        <Textarea
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="Brief description of this inspection method…"
          rows={2}
          className="text-sm resize-none"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave(form)}
          disabled={saving || !form.code.trim() || !form.label.trim()}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Save
        </Button>
      </div>
    </div>
  )
}
