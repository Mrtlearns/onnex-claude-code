/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'
import {
  Plus, Pencil, Trash2, Brain, Code2, Zap, Webhook,
  FlaskConical, Save, X, Loader2, Cpu, GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// ── Types ─────────────────────────────────────────────────────────────────────
export type ActionType = 'llm' | 'python' | 'n8n' | 'webhook' | 'system'

export interface InspectionStep {
  id: string
  inspection_type_id: string
  name: string
  action_type: ActionType
  instruction: string | null
  python_code: string | null
  n8n_workflow: string | null
  webhook_url: string | null
  provider: string | null
  model: string | null
  config: Record<string, unknown> | null
  sort_order: number
  is_active: boolean
}

export interface StepFormState {
  name: string
  action_type: ActionType
  instruction: string
  python_code: string
  n8n_workflow: string
  webhook_url: string
  config: string
  provider: string
  model: string
}

export const STEP_BLANK: StepFormState = {
  name: '', action_type: 'llm', instruction: '', python_code: '', n8n_workflow: '', webhook_url: '', config: '', provider: '', model: '',
}

// ── Action type display meta ───────────────────────────────────────────────────
export const ACTION_META: Record<ActionType, { label: string; icon: React.ComponentType<{ className?: string }>; className: string }> = {
  llm:     { label: 'LLM',     icon: Brain,   className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  python:  { label: 'Python',  icon: Code2,   className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  n8n:     { label: 'n8n',     icon: Zap,     className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  webhook: { label: 'Webhook', icon: Webhook, className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  system:  { label: 'System',  icon: Cpu,     className: 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400' },
}

export function ActionBadge({ type }: { type: ActionType }) {
  const { label, icon: Icon, className } = ACTION_META[type]
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${className}`}>
      <Icon className="h-3 w-3" />{label}
    </span>
  )
}

// ── StepForm ──────────────────────────────────────────────────────────────────
interface StepFormProps {
  initial?: StepFormState
  saving: boolean
  onSave: (v: StepFormState) => void
  onCancel: () => void
  providers?: Array<{ name: string; label: string }>
}

export function StepForm({ initial, saving, onSave, onCancel, providers }: StepFormProps) {
  const [form, setForm] = useState<StepFormState>(initial ?? STEP_BLANK)

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1">
          <Label className="text-xs">Step name</Label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Extract quote data" className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Action type</Label>
          <Select value={form.action_type} onValueChange={v => setForm(p => ({ ...p, action_type: v as ActionType }))}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(ACTION_META) as [ActionType, typeof ACTION_META[ActionType]][]).map(([val, meta]) => (
                <SelectItem key={val} value={val}>
                  <span className="flex items-center gap-1.5"><meta.icon className="h-3.5 w-3.5" /> {meta.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {form.action_type === 'llm' && (
        <div className="space-y-1">
          <Label className="text-xs">Instruction <span className="text-muted-foreground">(sent to the LLM)</span></Label>
          <Textarea value={form.instruction} onChange={e => setForm(p => ({ ...p, instruction: e.target.value }))}
            placeholder="Extract the customer name, part number, quantity, and material from this email. Return JSON with keys: customer, part_number, quantity, material."
            rows={5} className="text-sm resize-y" />
        </div>
      )}

      {form.action_type === 'llm' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Provider <span className="text-muted-foreground">(optional override)</span></Label>
            <Select value={form.provider || '__default__'} onValueChange={v => setForm(p => ({ ...p, provider: v === '__default__' ? '' : v, model: '' }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">Use default</SelectItem>
                {(providers ?? []).map(p => <SelectItem key={p.name} value={p.name}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Model <span className="text-muted-foreground">(optional override)</span></Label>
            <Input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
              placeholder={form.provider ? 'e.g. gpt-4o, claude-opus-4-6' : '—'}
              disabled={!form.provider} className="h-8 text-sm font-mono" />
          </div>
        </div>
      )}

      {form.action_type === 'python' && (
        <div className="space-y-1">
          <Label className="text-xs">Python code</Label>
          <Textarea value={form.python_code} onChange={e => setForm(p => ({ ...p, python_code: e.target.value }))}
            placeholder={'# Input: ctx dict injected from previous step\n# Output: return a dict\n\nresult = {}\nreturn result'}
            rows={10} className="text-xs font-mono resize-y" />
        </div>
      )}

      {form.action_type === 'n8n' && (
        <div className="space-y-1">
          <Label className="text-xs">n8n workflow name</Label>
          <Input value={form.n8n_workflow} onChange={e => setForm(p => ({ ...p, n8n_workflow: e.target.value }))} placeholder="NDT Quote Parser" className="h-8 text-sm" />
          <p className="text-xs text-muted-foreground">Exact name of the workflow in the embedded n8n instance.</p>
        </div>
      )}

      {form.action_type === 'webhook' && (
        <div className="space-y-1">
          <Label className="text-xs">Webhook URL</Label>
          <Input value={form.webhook_url} onChange={e => setForm(p => ({ ...p, webhook_url: e.target.value }))} placeholder="https://erp.example.com/api/ndt-jobs/inbound" className="h-8 text-sm font-mono" />
          <p className="text-xs text-muted-foreground">Target URL — receives a POST with the step context as JSON.</p>
        </div>
      )}

      {form.action_type === 'system' && (
        <p className="text-xs text-muted-foreground rounded-md bg-muted/50 px-3 py-2">
          Internal pipeline step — no external service URL. Visible here for observability and toggling.
        </p>
      )}

      <div className="space-y-1">
        <Label className="text-xs">Config <span className="text-muted-foreground">(optional JSON — extra parameters for this step)</span></Label>
        <Textarea value={form.config} onChange={e => setForm(p => ({ ...p, config: e.target.value }))}
          placeholder={'{\n  "key": "value"\n}'} rows={3}
          className={`text-xs font-mono resize-y ${
            form.config && (() => { try { JSON.parse(form.config); return false } catch { return true } })() ? 'border-destructive' : ''
          }`}
        />
        {form.config && (() => { try { JSON.parse(form.config); return null } catch (e) { return (
          <p className="text-xs text-destructive">Invalid JSON: {e instanceof Error ? e.message : String(e)}</p>
        )}})()}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={saving || !form.name.trim()}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}Save
        </Button>
      </div>
    </div>
  )
}

// ── InspectionStepList ─────────────────────────────────────────────────────────
interface InspectionStepListProps {
  steps: InspectionStep[]
  editing: string | null
  saving: boolean
  loadingSteps: boolean
  availableProviders: Array<{ name: string; label: string }>
  dragOverId: string | null
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragOver: (e: React.DragEvent, id: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, targetId: string) => void
  onDragEnd: () => void
  onEdit: (stepId: string) => void
  onDelete: (stepId: string) => void
  onSaveStep: (form: StepFormState) => void
  onCancelEdit: () => void
  stepFormInitial: (id: string) => StepFormState
  stepPreview: (s: InspectionStep) => string | null
  selectedType: { code: string } | undefined
  onAddStep: () => void
  showAddStep: boolean
}

export default function InspectionStepList({
  steps, editing, saving, loadingSteps, availableProviders, dragOverId,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  onEdit, onDelete, onSaveStep, onCancelEdit, stepFormInitial, stepPreview,
  selectedType, onAddStep, showAddStep,
}: InspectionStepListProps) {
  return (
    <>
      {/* Add step button + form header */}
      <div className="flex items-center justify-between pb-2">
        {selectedType && (
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={onAddStep}>
            <Plus className="h-3.5 w-3.5" /> Add Step
          </Button>
        )}
      </div>

      {!selectedType && (
        <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-2">
          <FlaskConical className="h-8 w-8 opacity-25" />
          <p className="text-sm">Select an inspection type to manage its steps</p>
        </div>
      )}

      {selectedType && (
        <>
          {showAddStep && (
            <StepForm saving={saving} onSave={onSaveStep} onCancel={onCancelEdit} providers={availableProviders} />
          )}

          {loadingSteps ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : steps.length === 0 && !showAddStep ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No steps yet — click Add Step to define the pipeline.</p>
          ) : (
            steps.map((step, idx) => {
              const isEditing  = editing === `edit-step:${step.id}`
              const isDragOver = dragOverId === step.id
              const preview    = stepPreview(step)

              return (
                <div key={step.id} draggable onDragStart={e => onDragStart(e, step.id)} onDragOver={e => onDragOver(e, step.id)} onDragLeave={onDragLeave} onDrop={e => onDrop(e, step.id)} onDragEnd={onDragEnd} className="space-y-2">
                  <div className={['flex items-center gap-2 rounded-md border bg-card px-2 py-2.5 transition-colors', isDragOver ? 'border-primary bg-primary/5' : ''].join(' ')}>
                    <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab active:cursor-grabbing" />
                    <span className="text-xs font-mono text-muted-foreground w-4 shrink-0 text-center">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{step.name}</span>
                        <ActionBadge type={step.action_type} />
                        {step.provider && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                            {step.provider}{step.model ? `/${step.model.split('/').pop()}` : ''}
                          </span>
                        )}
                      </div>
                      {preview && <p className="text-xs text-muted-foreground truncate mt-0.5">{preview}</p>}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEdit(step.id)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-destructive" onClick={() => onDelete(step.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  {isEditing && (
                    <StepForm initial={stepFormInitial(step.id)} saving={saving} onSave={onSaveStep} onCancel={onCancelEdit} providers={availableProviders} />
                  )}
                </div>
              )
            })
          )}
        </>
      )}
    </>
  )
}
