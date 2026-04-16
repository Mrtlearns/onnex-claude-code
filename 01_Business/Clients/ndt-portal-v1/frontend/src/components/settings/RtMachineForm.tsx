/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useEffect } from 'react'
import { Save, X, Loader2, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import RtMachineSpecFields, { type SpecFields } from './RtMachineSpecFields'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface MachineFormData {
  machine_id: string
  nickname: string
  make_model: string
  spec: Record<string, unknown>
}

// ── Default spec template ─────────────────────────────────────────────────────
const DEFAULT_SPEC_TEMPLATE: Record<string, unknown> = {
  xray_source: {
    type: 'Industrial X-ray',
    max_voltage_kv: 320,
    recommended_operating_range_kv: [100, 320],
    focal_spot_class: 'standard_industrial',
    modality: ['film_rt', 'digital_rt'],
    notes: '',
  },
  inspection_envelope: {
    shape: 'cylindrical',
    max_part_diameter_mm: 650,
    max_part_height_mm: 900,
    max_part_weight_kg: 120,
    usable_clearance_note: '',
  },
  manipulation: {
    axes: ['rotate', 'vertical', 'horizontal'],
    tilt_available: true,
    min_rotation_step_deg: 0.5,
    notes: '',
  },
  detector_support: {
    film_supported: true,
    digital_detector_supported: true,
    typical_film_classes: ['D4', 'D5', 'C4'],
    image_quality_support: ['IQI_wire', 'IQI_hole'],
  },
  planning_rules: {
    best_for: [],
    not_ideal_for: [],
  },
}

// ── Spec conversion helpers ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function specToFields(spec: Record<string, any>): SpecFields {
  const xs = spec?.xray_source ?? {}
  const ie = spec?.inspection_envelope ?? {}
  const m  = spec?.manipulation ?? {}
  const ds = spec?.detector_support ?? {}
  const pr = spec?.planning_rules ?? {}
  return {
    xray_source: {
      type:             xs.type ?? '',
      max_voltage_kv:   xs.max_voltage_kv ?? '',
      op_range_min:     xs.recommended_operating_range_kv?.[0] ?? '',
      op_range_max:     xs.recommended_operating_range_kv?.[1] ?? '',
      focal_spot_class: xs.focal_spot_class ?? '',
      modality:         Array.isArray(xs.modality) ? xs.modality.join(', ') : (xs.modality ?? ''),
      notes:            xs.notes ?? '',
      focal_spot_small_mm:          xs.focal_spot_small_mm ?? '',
      focal_spot_large_mm:          xs.focal_spot_large_mm ?? '',
      beam_cone_angle_deg:          xs.beam_cone_angle_deg ?? '',
      target_angle_deg:             xs.target_angle_deg ?? '',
      inherent_filtration_be_mm:    xs.inherent_filtration_be_mm ?? '',
      max_continuous_power_small_w: xs.max_continuous_power_small_w ?? '',
      max_continuous_power_large_w: xs.max_continuous_power_large_w ?? '',
      cooling_type:                 xs.cooling_type ?? '',
      target_material:              xs.target_material ?? '',
    },
    inspection_envelope: {
      shape:                  ie.shape ?? '',
      max_part_diameter_mm:   ie.max_part_diameter_mm ?? '',
      max_part_height_mm:     ie.max_part_height_mm ?? '',
      max_part_weight_kg:     ie.max_part_weight_kg ?? '',
      usable_clearance_note:  ie.usable_clearance_note ?? '',
    },
    manipulation: {
      axes:                  Array.isArray(m.axes) ? m.axes.join(', ') : (m.axes ?? ''),
      tilt_available:        m.tilt_available ?? false,
      min_rotation_step_deg: m.min_rotation_step_deg ?? '',
      notes:                 m.notes ?? '',
    },
    detector_support: {
      film_supported:              ds.film_supported ?? false,
      digital_detector_supported:  ds.digital_detector_supported ?? false,
      typical_film_classes:        Array.isArray(ds.typical_film_classes) ? ds.typical_film_classes.join(', ') : (ds.typical_film_classes ?? ''),
      image_quality_support:       Array.isArray(ds.image_quality_support) ? ds.image_quality_support.join(', ') : (ds.image_quality_support ?? ''),
    },
    planning_rules: {
      best_for:     Array.isArray(pr.best_for) ? pr.best_for.join(', ') : (pr.best_for ?? ''),
      not_ideal_for: Array.isArray(pr.not_ideal_for) ? pr.not_ideal_for.join(', ') : (pr.not_ideal_for ?? ''),
    },
  }
}

export function fieldsToSpec(fields: SpecFields, rawSpec?: Record<string, unknown>): Record<string, unknown> {
  const split = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)
  const num   = (v: number | '') => v === '' ? undefined : Number(v)

  const knownSections = new Set(['xray_source', 'inspection_envelope', 'manipulation', 'detector_support', 'planning_rules'])
  const extraKeys: Record<string, unknown> = {}
  if (rawSpec) {
    for (const key of Object.keys(rawSpec)) {
      if (!knownSections.has(key)) extraKeys[key] = rawSpec[key]
    }
  }

  const xs = fields.xray_source
  return {
    ...extraKeys,
    xray_source: {
      type:                           xs.type,
      max_voltage_kv:                 num(xs.max_voltage_kv),
      recommended_operating_range_kv: [num(xs.op_range_min), num(xs.op_range_max)],
      focal_spot_class:               xs.focal_spot_class,
      modality:                       split(xs.modality),
      notes:                          xs.notes,
      ...(xs.focal_spot_small_mm          !== '' && { focal_spot_small_mm:          num(xs.focal_spot_small_mm) }),
      ...(xs.focal_spot_large_mm          !== '' && { focal_spot_large_mm:          num(xs.focal_spot_large_mm) }),
      ...(xs.beam_cone_angle_deg          !== '' && { beam_cone_angle_deg:          num(xs.beam_cone_angle_deg) }),
      ...(xs.target_angle_deg             !== '' && { target_angle_deg:             num(xs.target_angle_deg) }),
      ...(xs.inherent_filtration_be_mm    !== '' && { inherent_filtration_be_mm:    num(xs.inherent_filtration_be_mm) }),
      ...(xs.max_continuous_power_small_w !== '' && { max_continuous_power_small_w: num(xs.max_continuous_power_small_w) }),
      ...(xs.max_continuous_power_large_w !== '' && { max_continuous_power_large_w: num(xs.max_continuous_power_large_w) }),
      ...(xs.cooling_type     && { cooling_type:     xs.cooling_type }),
      ...(xs.target_material  && { target_material:  xs.target_material }),
    },
    inspection_envelope: {
      shape:                  fields.inspection_envelope.shape,
      max_part_diameter_mm:   num(fields.inspection_envelope.max_part_diameter_mm),
      max_part_height_mm:     num(fields.inspection_envelope.max_part_height_mm),
      max_part_weight_kg:     num(fields.inspection_envelope.max_part_weight_kg),
      usable_clearance_note:  fields.inspection_envelope.usable_clearance_note,
    },
    manipulation: {
      axes:                  split(fields.manipulation.axes),
      tilt_available:        fields.manipulation.tilt_available,
      min_rotation_step_deg: num(fields.manipulation.min_rotation_step_deg),
      notes:                 fields.manipulation.notes,
    },
    detector_support: {
      film_supported:             fields.detector_support.film_supported,
      digital_detector_supported: fields.detector_support.digital_detector_supported,
      typical_film_classes:       split(fields.detector_support.typical_film_classes),
      image_quality_support:      split(fields.detector_support.image_quality_support),
    },
    planning_rules: {
      best_for:     split(fields.planning_rules.best_for),
      not_ideal_for: split(fields.planning_rules.not_ideal_for),
    },
  }
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface RtMachineFormProps {
  initial?: MachineFormData
  saving: boolean
  onSave: (data: MachineFormData) => void
  onCancel: () => void
}

export default function RtMachineForm({ initial, saving, onSave, onCancel }: RtMachineFormProps) {
  const defaultSpec = initial?.spec ?? DEFAULT_SPEC_TEMPLATE

  const [machineId, setMachineId] = useState(initial?.machine_id ?? '')
  const [nickname, setNickname]   = useState(initial?.nickname ?? '')
  const [makeModel, setMakeModel] = useState(initial?.make_model ?? '')

  const [specFields, setSpecFields]     = useState<SpecFields>(() => specToFields(defaultSpec))
  const [specJson, setSpecJson]         = useState<string>(() => JSON.stringify(defaultSpec, null, 2))
  const [jsonError, setJsonError]       = useState<string | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [lastValidJson, setLastValidJson]   = useState<string>(() => JSON.stringify(defaultSpec, null, 2))
  const [copied, setCopied] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  function setField(section: keyof SpecFields, key: string, value: unknown) {
    const newFields = {
      ...specFields,
      [section]: { ...(specFields[section] as Record<string, unknown>), [key]: value },
    } as SpecFields
    setSpecFields(newFields)
    let currentRawSpec: Record<string, unknown> | undefined
    try { currentRawSpec = JSON.parse(specJson) as Record<string, unknown> } catch { /* ignore */ }
    const newJson = JSON.stringify(fieldsToSpec(newFields, currentRawSpec), null, 2)
    setSpecJson(newJson)
    setLastValidJson(newJson)
    setJsonError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }

  function handleJsonChange(value: string) {
    setSpecJson(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    try {
      const parsed = JSON.parse(value)
      setSpecFields(specToFields(parsed))
      setLastValidJson(value)
      setJsonError(null)
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : String(e))
      debounceRef.current = setTimeout(() => setShowErrorModal(true), 800)
    }
  }

  function handleJsonBlur() {
    if (jsonError) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setShowErrorModal(true)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(lastValidJson)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleSave() {
    try {
      const spec = JSON.parse(specJson)
      onSave({ machine_id: machineId, nickname, make_model: makeModel, spec })
    } catch {
      // guarded by canSave
    }
  }

  const canSave = machineId.trim() !== '' && nickname.trim() !== '' && !jsonError

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* ── Error modal ── */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Invalid JSON</DialogTitle>
            <DialogDescription className="font-mono text-xs text-destructive break-all">{jsonError}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Last valid JSON — use as base:</p>
            <Textarea value={lastValidJson} readOnly rows={12} className="font-mono text-xs resize-none" />
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied
                ? <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
              }
            </Button>
            <Button size="sm" onClick={() => setShowErrorModal(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Top row ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Machine ID</Label>
          <Input
            value={machineId}
            onChange={e => setMachineId(e.target.value.toUpperCase())}
            placeholder="RT_01"
            className="h-8 text-sm font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Nickname</Label>
          <Input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder="Cabinet_300KV_Compact"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Make / Model (assumed)</Label>
          <Input
            value={makeModel}
            onChange={e => setMakeModel(e.target.value)}
            placeholder="Representative 300 kV compact cabinet"
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* ── Main body: structured fields + raw JSON ── */}
      <div className="flex-1 grid grid-cols-[55%_45%] gap-4 min-h-0">

        <RtMachineSpecFields spec={specFields} onChange={setField} />

        {/* Raw JSON */}
        <div className="flex flex-col gap-1 min-h-0">
          <Label className="text-xs">
            Raw JSON{' '}
            <span className="text-muted-foreground">(passed to LLM for scan advice)</span>
          </Label>
          <Textarea
            value={specJson}
            onChange={e => handleJsonChange(e.target.value)}
            onBlur={handleJsonBlur}
            className={`flex-1 font-mono text-xs resize-none min-h-[420px] ${jsonError ? 'border-destructive' : ''}`}
          />
          {jsonError && (
            <p className="text-xs text-destructive">Invalid JSON — paste/type or dismiss the error modal</p>
          )}
        </div>

      </div>

      {/* ── Footer ── */}
      <div className="flex justify-end gap-2 pt-3 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave || saving}>
          {saving
            ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            : <Save className="h-3.5 w-3.5 mr-1" />}
          Save
        </Button>
      </div>

    </div>
  )
}
