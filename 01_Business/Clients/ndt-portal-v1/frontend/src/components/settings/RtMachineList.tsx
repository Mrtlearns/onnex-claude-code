import { Plus, Pencil, Trash2, Loader2, Cpu, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface RtMachineProfile {
  id: string
  machine_id: string
  nickname: string
  make_model: string | null
  spec: Record<string, unknown>
}

interface RtMachineListProps {
  machines: RtMachineProfile[]
  editMachineId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
  onRequestSpec: () => void
  onInlineRename: (profile: RtMachineProfile) => void
  renamingId: string | null
  renameValue: string
  onRenameChange: (value: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  renameSaving: boolean
  selectedId: string | null
}

export default function RtMachineList({
  machines,
  editMachineId,
  onSelect,
  onAdd,
  onDelete,
  onEdit,
  onRequestSpec,
  onInlineRename,
  renamingId,
  renameValue,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  renameSaving,
  selectedId,
}: RtMachineListProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Cpu className="h-4 w-4 text-sky-500" /> RT Machines
        </CardTitle>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
            onClick={onRequestSpec}
            title="Generate spec request email template"
          >
            <Mail className="h-3.5 w-3.5" /> Request Spec
          </Button>
          <Button
            variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
            onClick={onAdd}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">

        {machines.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">No machine profiles yet.</p>
        )}

        {machines.map(p => {
          const isSelected = p.id === selectedId
          const isEditing  = editMachineId === `edit:${p.id}`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const kv = (p.spec as any)?.xray_source?.max_voltage_kv as number | undefined

          return (
            <div
              key={p.id}
              className={[
                'flex items-start gap-2 rounded-md px-3 py-2.5 cursor-pointer transition-colors',
                isSelected || isEditing ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              ].join(' ')}
              onClick={() => onSelect(p.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-sm">{p.machine_id}</span>
                  {kv != null && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                      isSelected || isEditing
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                    }`}>
                      {kv} kV
                    </span>
                  )}
                </div>
                {/* Inline nickname edit */}
                {renamingId === p.id ? (
                  <div className="flex items-center gap-1 mt-0.5" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => onRenameChange(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onRenameCancel() }}
                      onBlur={onRenameCommit}
                      className="text-xs px-1 py-0.5 rounded border border-primary bg-background text-foreground flex-1 min-w-0 outline-none"
                      disabled={renameSaving}
                    />
                    {renameSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
                  </div>
                ) : (
                  <p
                    className={`text-xs mt-0.5 truncate cursor-text ${isSelected || isEditing ? 'text-primary-foreground/70' : 'text-muted-foreground hover:text-foreground'}`}
                    title="Click to rename"
                    onClick={e => { e.stopPropagation(); onInlineRename(p) }}
                  >
                    {p.nickname}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                <Button
                  variant="ghost" size="sm"
                  className={`h-6 w-6 p-0 ${isSelected || isEditing ? 'hover:bg-primary-foreground/20 text-primary-foreground' : ''}`}
                  onClick={() => onEdit(p.id)}
                  title="Edit full spec"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className={`h-6 w-6 p-0 ${isSelected || isEditing ? 'hover:bg-primary-foreground/20 text-primary-foreground' : 'hover:text-destructive'}`}
                  onClick={() => onDelete(p.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
