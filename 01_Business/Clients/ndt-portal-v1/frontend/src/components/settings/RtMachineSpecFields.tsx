import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'

// ── Types ──────────────────────────────────────────────────────────────────────
export interface SpecFields {
  xray_source: {
    type: string
    max_voltage_kv: number | ''
    op_range_min: number | ''
    op_range_max: number | ''
    focal_spot_class: string
    modality: string
    notes: string
    focal_spot_small_mm: number | ''
    focal_spot_large_mm: number | ''
    beam_cone_angle_deg: number | ''
    target_angle_deg: number | ''
    inherent_filtration_be_mm: number | ''
    max_continuous_power_small_w: number | ''
    max_continuous_power_large_w: number | ''
    cooling_type: string
    target_material: string
  }
  inspection_envelope: {
    shape: string
    max_part_diameter_mm: number | ''
    max_part_height_mm: number | ''
    max_part_weight_kg: number | ''
    usable_clearance_note: string
  }
  manipulation: {
    axes: string
    tilt_available: boolean
    min_rotation_step_deg: number | ''
    notes: string
  }
  detector_support: {
    film_supported: boolean
    digital_detector_supported: boolean
    typical_film_classes: string
    image_quality_support: string
  }
  planning_rules: {
    best_for: string
    not_ideal_for: string
  }
}

// ── Local helper components ────────────────────────────────────────────────────
function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground border-b border-border pb-1">{title}</p>
      {children}
    </div>
  )
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-3 gap-y-2">{children}</div>
}

function FieldItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function SupplementedFieldItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <Label className="text-xs text-muted-foreground">
        {label}<sup className="text-amber-500 dark:text-amber-400 font-bold ml-0.5">*</sup>
      </Label>
      {children}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface RtMachineSpecFieldsProps {
  spec: SpecFields
  onChange: (section: keyof SpecFields, key: string, value: unknown) => void
}

export default function RtMachineSpecFields({ spec, onChange }: RtMachineSpecFieldsProps) {
  const xs = spec.xray_source
  const ie = spec.inspection_envelope
  const m  = spec.manipulation
  const ds = spec.detector_support
  const pr = spec.planning_rules

  return (
    <div className="overflow-y-auto space-y-4 pr-2">

      <FieldSection title="X-Ray Source">
        <FieldGrid>
          <FieldItem label="Type">
            <Input value={xs.type} onChange={e => onChange('xray_source', 'type', e.target.value)} className="h-7 text-xs" />
          </FieldItem>
          <FieldItem label="Max Voltage (kV)">
            <Input type="number" value={xs.max_voltage_kv}
              onChange={e => onChange('xray_source', 'max_voltage_kv', e.target.value === '' ? '' : Number(e.target.value))}
              className="h-7 text-xs" />
          </FieldItem>
          <FieldItem label="Op Range Min (kV)">
            <Input type="number" value={xs.op_range_min}
              onChange={e => onChange('xray_source', 'op_range_min', e.target.value === '' ? '' : Number(e.target.value))}
              className="h-7 text-xs" />
          </FieldItem>
          <FieldItem label="Op Range Max (kV)">
            <Input type="number" value={xs.op_range_max}
              onChange={e => onChange('xray_source', 'op_range_max', e.target.value === '' ? '' : Number(e.target.value))}
              className="h-7 text-xs" />
          </FieldItem>
          <FieldItem label="Focal Spot Class">
            <Input value={xs.focal_spot_class} onChange={e => onChange('xray_source', 'focal_spot_class', e.target.value)} className="h-7 text-xs" />
          </FieldItem>
          <FieldItem label="Modality (comma-separated)">
            <Input value={xs.modality} onChange={e => onChange('xray_source', 'modality', e.target.value)} className="h-7 text-xs" placeholder="film_rt, digital_rt" />
          </FieldItem>
        </FieldGrid>
        <FieldItem label="Notes">
          <Textarea value={xs.notes} onChange={e => onChange('xray_source', 'notes', e.target.value)} rows={2} className="text-xs resize-none" />
        </FieldItem>

        <div className="mt-2 pt-2 border-t border-dashed border-amber-200 dark:border-amber-800/50">
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
            <sup className="font-bold mr-0.5">*</sup>Supplemented from manufacturer datasheet
          </p>
          <FieldGrid>
            <SupplementedFieldItem label="Focal spot small (mm)">
              <Input type="number" step="0.1" value={xs.focal_spot_small_mm}
                onChange={e => onChange('xray_source', 'focal_spot_small_mm', e.target.value === '' ? '' : Number(e.target.value))}
                className="h-7 text-xs" />
            </SupplementedFieldItem>
            <SupplementedFieldItem label="Focal spot large (mm)">
              <Input type="number" step="0.1" value={xs.focal_spot_large_mm}
                onChange={e => onChange('xray_source', 'focal_spot_large_mm', e.target.value === '' ? '' : Number(e.target.value))}
                className="h-7 text-xs" />
            </SupplementedFieldItem>
            <SupplementedFieldItem label="Beam cone angle (°)">
              <Input type="number" step="1" value={xs.beam_cone_angle_deg}
                onChange={e => onChange('xray_source', 'beam_cone_angle_deg', e.target.value === '' ? '' : Number(e.target.value))}
                className="h-7 text-xs" />
            </SupplementedFieldItem>
            <SupplementedFieldItem label="Target angle (°)">
              <Input type="number" step="1" value={xs.target_angle_deg}
                onChange={e => onChange('xray_source', 'target_angle_deg', e.target.value === '' ? '' : Number(e.target.value))}
                className="h-7 text-xs" />
            </SupplementedFieldItem>
            <SupplementedFieldItem label="Inherent filtration Be (mm)">
              <Input type="number" step="0.1" value={xs.inherent_filtration_be_mm}
                onChange={e => onChange('xray_source', 'inherent_filtration_be_mm', e.target.value === '' ? '' : Number(e.target.value))}
                className="h-7 text-xs" />
            </SupplementedFieldItem>
            <SupplementedFieldItem label="Max power small spot (W)">
              <Input type="number" step="1" value={xs.max_continuous_power_small_w}
                onChange={e => onChange('xray_source', 'max_continuous_power_small_w', e.target.value === '' ? '' : Number(e.target.value))}
                className="h-7 text-xs" />
            </SupplementedFieldItem>
            <SupplementedFieldItem label="Max power large spot (W)">
              <Input type="number" step="1" value={xs.max_continuous_power_large_w}
                onChange={e => onChange('xray_source', 'max_continuous_power_large_w', e.target.value === '' ? '' : Number(e.target.value))}
                className="h-7 text-xs" />
            </SupplementedFieldItem>
            <SupplementedFieldItem label="Cooling type">
              <Input value={xs.cooling_type}
                onChange={e => onChange('xray_source', 'cooling_type', e.target.value)}
                className="h-7 text-xs" placeholder="oil / water" />
            </SupplementedFieldItem>
            <SupplementedFieldItem label="Target material">
              <Input value={xs.target_material}
                onChange={e => onChange('xray_source', 'target_material', e.target.value)}
                className="h-7 text-xs" placeholder="tungsten" />
            </SupplementedFieldItem>
          </FieldGrid>
        </div>
      </FieldSection>

      <FieldSection title="Inspection Envelope">
        <FieldGrid>
          <FieldItem label="Shape">
            <Input value={ie.shape} onChange={e => onChange('inspection_envelope', 'shape', e.target.value)} className="h-7 text-xs" />
          </FieldItem>
          <FieldItem label="Max Diameter (mm)">
            <Input type="number" value={ie.max_part_diameter_mm}
              onChange={e => onChange('inspection_envelope', 'max_part_diameter_mm', e.target.value === '' ? '' : Number(e.target.value))}
              className="h-7 text-xs" />
          </FieldItem>
          <FieldItem label="Max Height (mm)">
            <Input type="number" value={ie.max_part_height_mm}
              onChange={e => onChange('inspection_envelope', 'max_part_height_mm', e.target.value === '' ? '' : Number(e.target.value))}
              className="h-7 text-xs" />
          </FieldItem>
          <FieldItem label="Max Weight (kg)">
            <Input type="number" value={ie.max_part_weight_kg}
              onChange={e => onChange('inspection_envelope', 'max_part_weight_kg', e.target.value === '' ? '' : Number(e.target.value))}
              className="h-7 text-xs" />
          </FieldItem>
        </FieldGrid>
        <FieldItem label="Clearance Note">
          <Textarea value={ie.usable_clearance_note} onChange={e => onChange('inspection_envelope', 'usable_clearance_note', e.target.value)} rows={2} className="text-xs resize-none" />
        </FieldItem>
      </FieldSection>

      <FieldSection title="Manipulation">
        <FieldGrid>
          <FieldItem label="Axes (comma-separated)">
            <Input value={m.axes} onChange={e => onChange('manipulation', 'axes', e.target.value)} className="h-7 text-xs" placeholder="rotate, vertical, horizontal" />
          </FieldItem>
          <FieldItem label="Min Rotation Step (°)">
            <Input type="number" step="0.1" value={m.min_rotation_step_deg}
              onChange={e => onChange('manipulation', 'min_rotation_step_deg', e.target.value === '' ? '' : Number(e.target.value))}
              className="h-7 text-xs" />
          </FieldItem>
          <FieldItem label="Tilt Available">
            <div className="flex items-center gap-2 h-7">
              <Switch checked={m.tilt_available} onCheckedChange={v => onChange('manipulation', 'tilt_available', v)} />
              <span className="text-xs text-muted-foreground">{m.tilt_available ? 'Yes' : 'No'}</span>
            </div>
          </FieldItem>
        </FieldGrid>
        <FieldItem label="Notes">
          <Textarea value={m.notes} onChange={e => onChange('manipulation', 'notes', e.target.value)} rows={2} className="text-xs resize-none" />
        </FieldItem>
      </FieldSection>

      <FieldSection title="Detector Support">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={ds.film_supported}
              onCheckedChange={v => onChange('detector_support', 'film_supported', v === true)}
              id="film_supported"
            />
            <label htmlFor="film_supported" className="cursor-pointer">Film supported</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={ds.digital_detector_supported}
              onCheckedChange={v => onChange('detector_support', 'digital_detector_supported', v === true)}
              id="digital_detector_supported"
            />
            <label htmlFor="digital_detector_supported" className="cursor-pointer">Digital detector supported</label>
          </div>
        </div>
        <FieldGrid>
          <FieldItem label="Film Classes (comma-separated)">
            <Input value={ds.typical_film_classes} onChange={e => onChange('detector_support', 'typical_film_classes', e.target.value)} className="h-7 text-xs" placeholder="D4, D5, C4" />
          </FieldItem>
          <FieldItem label="IQI Support (comma-separated)">
            <Input value={ds.image_quality_support} onChange={e => onChange('detector_support', 'image_quality_support', e.target.value)} className="h-7 text-xs" placeholder="IQI_wire, IQI_hole" />
          </FieldItem>
        </FieldGrid>
      </FieldSection>

      <FieldSection title="Planning Rules">
        <FieldItem label="Best For (comma-separated)">
          <Textarea value={pr.best_for} onChange={e => onChange('planning_rules', 'best_for', e.target.value)} rows={2} className="text-xs resize-none" placeholder="small_to_medium_parts, tight_detail_requirements" />
        </FieldItem>
        <FieldItem label="Not Ideal For (comma-separated)">
          <Textarea value={pr.not_ideal_for} onChange={e => onChange('planning_rules', 'not_ideal_for', e.target.value)} rows={2} className="text-xs resize-none" placeholder="large_dense_castings, very_thick_superalloy_sections" />
        </FieldItem>
      </FieldSection>

    </div>
  )
}
