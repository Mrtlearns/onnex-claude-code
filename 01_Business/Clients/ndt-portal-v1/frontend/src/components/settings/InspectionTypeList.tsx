import { Plus, Pencil, Trash2, FlaskConical, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import TypeForm, { type TypeFormState } from './InspectionTypeForm'

export interface InspectionType {
  id: string
  code: string
  label: string
  description: string
  is_active: boolean
  sort_order: number
}

interface InspectionTypeListProps {
  types: InspectionType[]
  selectedId: string | null
  editing: string | null
  saving: boolean
  loadingTypes: boolean
  error: string | null
  onSelect: (id: string) => void
  onAddToggle: () => void
  onEditToggle: (id: string) => void
  onDelete: (id: string) => void
  onSaveType: (form: TypeFormState) => void
  onCancelEdit: () => void
  typeFormInitial: (id: string) => TypeFormState
}

export default function InspectionTypeList({
  types, selectedId, editing, saving, loadingTypes, error,
  onSelect, onAddToggle, onEditToggle, onDelete,
  onSaveType, onCancelEdit, typeFormInitial,
}: InspectionTypeListProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-indigo-500" /> Inspection Types
        </CardTitle>
        <Button
          variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
          onClick={onAddToggle}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">

        {editing === 'add-type' && (
          <TypeForm saving={saving} onSave={onSaveType} onCancel={onCancelEdit} />
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {loadingTypes ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : types.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No inspection types yet.</p>
        ) : (
          types.map(t => {
            const isSelected = t.id === selectedId
            const isEditing  = editing === `edit-type:${t.id}`
            return (
              <div key={t.id} className="space-y-2">
                <div
                  className={[
                    'flex items-start gap-2 rounded-md px-3 py-2.5 cursor-pointer transition-colors',
                    isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  ].join(' ')}
                  onClick={() => onSelect(t.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-sm">{t.code}</span>
                      <span className={`text-xs truncate ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {t.label}
                      </span>
                    </div>
                    {t.description && (
                      <p className={`text-xs mt-0.5 line-clamp-2 ${isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {t.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost" size="sm"
                      className={`h-6 w-6 p-0 ${isSelected ? 'hover:bg-primary-foreground/20 text-primary-foreground' : ''}`}
                      onClick={() => onEditToggle(t.id)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className={`h-6 w-6 p-0 ${isSelected ? 'hover:bg-primary-foreground/20 text-primary-foreground' : 'hover:text-destructive'}`}
                      onClick={() => onDelete(t.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {isEditing && (
                  <TypeForm
                    initial={typeFormInitial(t.id)}
                    saving={saving}
                    onSave={onSaveType}
                    onCancel={onCancelEdit}
                  />
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
