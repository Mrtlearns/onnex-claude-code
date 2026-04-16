import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthHeaders } from '@/lib/api'
import { settingsApi } from '@/lib/settingsApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type TypeFormState, TYPE_BLANK } from './InspectionTypeForm'
import InspectionTypeList, { type InspectionType } from './InspectionTypeList'
import InspectionStepList, {
  type InspectionStep,
  type StepFormState,
  STEP_BLANK,
} from './InspectionStepEditor'

const API = '/api/ut/inspection-types'

export default function InspectionTypesTab() {
  const [types, setTypes]           = useState<InspectionType[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [steps, setSteps]           = useState<InspectionStep[]>([])

  const [loadingTypes, setLoadingTypes] = useState(true)
  const [loadingSteps, setLoadingSteps] = useState(false)
  const [editing, setEditing]           = useState<string | null>(null)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [availableProviders, setAvailableProviders] = useState<Array<{ name: string; label: string }>>([])

  useEffect(() => {
    settingsApi.getProviders()
      .then(data => {
        if (data?.providers) setAvailableProviders(data.providers.map((p: { name: string; label: string }) => ({ name: p.name, label: p.label })))
      })
      .catch(() => {})
  }, [])

  const dragId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const loadTypes = useCallback(async () => {
    setLoadingTypes(true)
    try {
      const r = await fetch(API, { headers: getAuthHeaders() })
      setTypes(r.ok ? await r.json() : [])
    } finally { setLoadingTypes(false) }
  }, [])

  useEffect(() => { loadTypes() }, [loadTypes])

  const loadSteps = useCallback(async (typeId: string) => {
    setLoadingSteps(true)
    setSteps([])
    try {
      const r = await fetch(`${API}/${typeId}/steps`, { headers: getAuthHeaders() })
      setSteps(r.ok ? await r.json() : [])
    } finally { setLoadingSteps(false) }
  }, [])

  useEffect(() => {
    if (selectedId) loadSteps(selectedId)
    else setSteps([])
  }, [selectedId, loadSteps])

  const selectedType = types.find(t => t.id === selectedId)

  async function saveType(form: TypeFormState) {
    setSaving(true); setError(null)
    try {
      const isEdit = editing?.startsWith('edit-type:')
      const id     = isEdit ? editing!.split(':')[1] : null
      const r = await fetch(isEdit ? `${API}/${id}` : API, {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify(form),
      })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? 'Save failed') }
      const saved: InspectionType = await r.json()
      if (isEdit) setTypes(ts => ts.map(t => t.id === saved.id ? saved : t))
      else { setTypes(ts => [...ts, saved]); setSelectedId(saved.id) }
      setEditing(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  async function deleteType(id: string) {
    if (!confirm('Delete this inspection type and all its steps?')) return
    await fetch(`${API}/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
    setTypes(ts => ts.filter(t => t.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  async function saveStep(form: StepFormState) {
    if (!selectedId) return
    setSaving(true); setError(null)
    try {
      const isEdit = editing?.startsWith('edit-step:')
      const stepId = isEdit ? editing!.split(':')[1] : null
      const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.sort_order)) : -1
      const payload = {
        ...form,
        instruction:  form.action_type === 'llm'     ? form.instruction  || null : null,
        python_code:  form.action_type === 'python'  ? form.python_code  || null : null,
        n8n_workflow: form.action_type === 'n8n'     ? form.n8n_workflow || null : null,
        webhook_url:  form.action_type === 'webhook' ? form.webhook_url  || null : null,
        provider:     form.action_type === 'llm' ? (form.provider || null) : null,
        model:        form.action_type === 'llm' ? (form.model    || null) : null,
        config: (() => {
          if (!form.config?.trim()) return null;
          try { return JSON.parse(form.config) } catch { return null }
        })(),
        sort_order: isEdit
          ? steps.find(s => s.id === stepId)?.sort_order ?? maxOrder + 1
          : maxOrder + 1,
      }
      const url = isEdit
        ? `${API}/${selectedId}/steps/${stepId}`
        : `${API}/${selectedId}/steps`
      const r = await fetch(url, {
        method:  isEdit ? 'PATCH' : 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body:    JSON.stringify(payload),
      })
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? 'Save failed') }
      const saved: InspectionStep = await r.json()
      setSteps(ss => isEdit ? ss.map(s => s.id === saved.id ? saved : s) : [...ss, saved])
      setEditing(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  async function deleteStep(stepId: string) {
    if (!selectedId) return
    await fetch(`${API}/${selectedId}/steps/${stepId}`, { method: 'DELETE', headers: getAuthHeaders() })
    setSteps(ss => ss.filter(s => s.id !== stepId))
  }

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
    const from = steps.findIndex(s => s.id === sourceId)
    const to   = steps.findIndex(s => s.id === targetId)
    if (from === -1 || to === -1) return
    const next = [...steps]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    const reordered = next.map((s, i) => ({ ...s, sort_order: i }))
    setSteps(reordered)
    fetch(`${API}/${selectedId}/steps/reorder`, {
      method:  'PATCH',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body:    JSON.stringify(reordered.map(({ id, sort_order }) => ({ id, sort_order }))),
    })
  }

  function onDragEnd() {
    dragId.current = null
    setDragOverId(null)
  }

  function typeFormInitial(id: string): TypeFormState {
    const t = types.find(x => x.id === id)
    return t ? { code: t.code, label: t.label, description: t.description } : TYPE_BLANK
  }

  function stepFormInitial(id: string): StepFormState {
    const s = steps.find(x => x.id === id)
    return s ? {
      name:         s.name,
      action_type:  s.action_type,
      instruction:  s.instruction  ?? '',
      python_code:  s.python_code  ?? '',
      n8n_workflow: s.n8n_workflow ?? '',
      webhook_url:  s.webhook_url  ?? '',
      config:       s.config ? JSON.stringify(s.config, null, 2) : '',
      provider:     s.provider     ?? '',
      model:        s.model        ?? '',
    } : STEP_BLANK
  }

  function stepPreview(s: InspectionStep): string | null {
    if (s.action_type === 'llm'     && s.instruction)  return s.instruction.slice(0, 80)
    if (s.action_type === 'python'  && s.python_code)  return s.python_code.split('\n')[0]
    if (s.action_type === 'n8n'     && s.n8n_workflow) return `Workflow: ${s.n8n_workflow}`
    if (s.action_type === 'webhook' && s.webhook_url)  return s.webhook_url
    if (s.action_type === 'system'  && s.config)       return (s.config.description as string | undefined) ?? `key: ${s.config.pipeline_key}`
    if (s.config) return `config: ${Object.keys(s.config).join(', ')}`
    return null
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <InspectionTypeList
        types={types}
        selectedId={selectedId}
        editing={editing}
        saving={saving}
        loadingTypes={loadingTypes}
        error={error}
        onSelect={id => { setSelectedId(id); setEditing(null) }}
        onAddToggle={() => setEditing(editing === 'add-type' ? null : 'add-type')}
        onEditToggle={id => setEditing(editing === `edit-type:${id}` ? null : `edit-type:${id}`)}
        onDelete={deleteType}
        onSaveType={saveType}
        onCancelEdit={() => setEditing(null)}
        typeFormInitial={typeFormInitial}
      />

      <Card className="lg:col-span-3">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedType
              ? <>Steps — <span className="font-mono">{selectedType.code}</span></>
              : 'Steps'
            }
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <InspectionStepList
            steps={steps}
            editing={editing}
            saving={saving}
            loadingSteps={loadingSteps}
            availableProviders={availableProviders}
            dragOverId={dragOverId}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onEdit={stepId => setEditing(editing === `edit-step:${stepId}` ? null : `edit-step:${stepId}`)}
            onDelete={deleteStep}
            onSaveStep={saveStep}
            onCancelEdit={() => setEditing(null)}
            stepFormInitial={stepFormInitial}
            stepPreview={stepPreview}
            selectedType={selectedType}
            onAddStep={() => setEditing(editing === 'add-step' ? null : 'add-step')}
            showAddStep={editing === 'add-step'}
          />
        </CardContent>
      </Card>
    </div>
  )
}
