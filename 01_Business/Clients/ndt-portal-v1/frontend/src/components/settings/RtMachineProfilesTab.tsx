import { useState, useEffect, useCallback } from 'react'
import { getAuthHeaders } from '@/lib/api'
import { Loader2, Cpu, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import RtMachineList, { type RtMachineProfile } from './RtMachineList'
import RtMachineForm, { type MachineFormData } from './RtMachineForm'

const API_BASE = '/api/ut/rt/machines'

// ── Default seed data ─────────────────────────────────────────────────────────
const DEFAULT_MACHINES_SEED: MachineFormData[] = [
  {
    machine_id: 'RT_01',
    nickname: 'Cabinet_300KV_Compact',
    make_model: 'Representative 300 kV compact industrial RT cabinet',
    spec: {
      xray_source: { type: 'Industrial X-ray', max_voltage_kv: 300, recommended_operating_range_kv: [80, 300], focal_spot_class: 'standard_microfocus_hybrid', modality: ['film_rt', 'digital_rt'], notes: 'Best for smaller or less dense aerospace parts where finer detail or lower geometric unsharpness is desirable.' },
      inspection_envelope: { shape: 'cylindrical', max_part_diameter_mm: 500, max_part_height_mm: 700, max_part_weight_kg: 75, usable_clearance_note: 'Part plus fixturing must fit fully within envelope with safety clearance.' },
      manipulation: { axes: ['rotate', 'vertical', 'horizontal'], tilt_available: true, min_rotation_step_deg: 1.0, notes: 'Suitable for standard multi-view RT and limited sectional planning.' },
      detector_support: { film_supported: true, digital_detector_supported: true, typical_film_classes: ['D4', 'D5', 'C4'], image_quality_support: ['IQI_wire', 'IQI_hole'] },
      planning_rules: { best_for: ['small_to_medium_parts', 'tight_detail_requirements', 'lower_to_medium_wall_thickness', 'jobs_where_lower_energy_reduces_scatter'], not_ideal_for: ['large_dense_castings', 'very_thick_superalloy_sections', 'parts_near_or_above_envelope_limits'] },
    },
  },
  {
    machine_id: 'RT_02',
    nickname: 'Cabinet_320KV_Mid',
    make_model: 'Representative 320 kV universal industrial RT cabinet',
    spec: {
      xray_source: { type: 'Industrial X-ray', max_voltage_kv: 320, recommended_operating_range_kv: [100, 320], focal_spot_class: 'standard_industrial', modality: ['film_rt', 'digital_rt'], notes: 'General-purpose aerospace NDT cabinet and the default choice unless geometry or spec indicates otherwise.' },
      inspection_envelope: { shape: 'cylindrical', max_part_diameter_mm: 650, max_part_height_mm: 900, max_part_weight_kg: 120, usable_clearance_note: 'Keep at least 25 mm planning clearance on all sides unless actual fixture data says otherwise.' },
      manipulation: { axes: ['rotate', 'vertical', 'horizontal'], tilt_available: true, min_rotation_step_deg: 0.5, notes: 'Good for multi-view setups, welds, castings, forgings, and most medium-size aerospace assemblies.' },
      detector_support: { film_supported: true, digital_detector_supported: true, typical_film_classes: ['D4', 'D5', 'D7', 'C4'], image_quality_support: ['IQI_wire', 'IQI_hole', 'duplex_wire_if_required'] },
      planning_rules: { best_for: ['medium_parts', 'mixed_geometry', 'general_aerospace_rt', 'default_machine_when_no_strong_constraints_exist'], not_ideal_for: ['very_large_long_parts', 'extreme_density_or_thickness_cases_if_350kv_machine_available'] },
    },
  },
  {
    machine_id: 'RT_03',
    nickname: 'Cabinet_350KV_Large',
    make_model: 'Representative 350 kV large-capacity industrial RT cabinet',
    spec: {
      xray_source: { type: 'Industrial X-ray', max_voltage_kv: 350, recommended_operating_range_kv: [120, 350], focal_spot_class: 'standard_high_energy', modality: ['film_rt', 'digital_rt'], notes: 'Preferred for larger, denser, or thicker aerospace components when penetration is the limiting factor.' },
      inspection_envelope: { shape: 'cylindrical', max_part_diameter_mm: 800, max_part_height_mm: 1500, max_part_weight_kg: 250, usable_clearance_note: 'Use this machine when size, density, or required source-to-film geometry exceeds smaller cabinets.' },
      manipulation: { axes: ['rotate', 'vertical', 'horizontal'], tilt_available: true, min_rotation_step_deg: 0.5, notes: 'Suitable for long parts, heavier fixtures, and higher-penetration jobs.' },
      detector_support: { film_supported: true, digital_detector_supported: true, typical_film_classes: ['D5', 'D7', 'C5'], image_quality_support: ['IQI_wire', 'IQI_hole'] },
      planning_rules: { best_for: ['large_parts', 'high_density_materials', 'thick_sections', 'longer_source_to_object_or_source_to_film_geometry_demands'], not_ideal_for: ['very_small_high_detail_parts_if_lower_energy_machine_can_meet_spec_more_cleanly'] },
    },
  },
]

// ── Detail panel helpers ──────────────────────────────────────────────────────
function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2.5 space-y-1.5">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, wide }: { label: string; value?: string | number | boolean | null; wide?: boolean }) {
  if (value === undefined || value === null) return null
  return (
    <span className={wide ? 'col-span-2' : ''}>
      {label}: <span className="text-foreground font-mono">{String(value)}</span>
    </span>
  )
}

interface SupplementedRef { source: string; url: string; fields: string[] }

function SupplementedRefsBlock({ refs }: { refs: SupplementedRef[] }) {
  if (!refs || refs.length === 0) return null
  return (
    <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2.5 space-y-1.5">
      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Supplemented Data Sources</p>
      <div className="space-y-1">
        {refs.map((ref, i) => (
          <div key={i} className="flex items-start gap-1.5 text-xs text-blue-700 dark:text-blue-300">
            <svg className="h-3.5 w-3.5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <span>
              {ref.url
                ? <a href={ref.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{ref.source}</a>
                : <span className="italic text-blue-600 dark:text-blue-400">{ref.source}</span>
              }
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function generateSpecRequestMessage(): string {
  return `Subject: RT Machine Specification Request

Hi,

Could you please provide the following specifications for your RT machine?
We use these to configure our inspection planning system correctly.

────────────────────────────────────────
1. X-RAY SOURCE
────────────────────────────────────────
Type (e.g. Industrial X-ray):
Maximum voltage (kV):
Recommended operating range — Min (kV):
Recommended operating range — Max (kV):
Focal spot class (e.g. standard_industrial, standard_microfocus_hybrid):
Modality — list all that apply, comma-separated
  (e.g. film_rt, digital_rt, cr_rt):
Notes / additional source details:

────────────────────────────────────────
2. INSPECTION ENVELOPE
────────────────────────────────────────
Chamber shape (e.g. cylindrical, rectangular):
Maximum part diameter (mm):
Maximum part height (mm):
Maximum part weight (kg):
Usable clearance note (part + fixturing fit, safety margins, etc.):

────────────────────────────────────────
3. MANIPULATION
────────────────────────────────────────
Available axes — comma-separated (e.g. rotate, vertical, horizontal, tilt):
Tilt available? (Yes / No):
Minimum rotation step (degrees):
Notes / additional manipulation details:

────────────────────────────────────────
4. DETECTOR SUPPORT
────────────────────────────────────────
Film supported? (Yes / No):
Digital detector supported? (Yes / No):
Typical film classes — comma-separated (e.g. D4, D5, D7, C4, C5):
Image quality indicator (IQI) support — comma-separated
  (e.g. IQI_wire, IQI_hole, duplex_wire_if_required):

────────────────────────────────────────
5. PLANNING RULES / MACHINE SUITABILITY
────────────────────────────────────────
Best suited for — comma-separated use cases or part types
  (e.g. small_to_medium_parts, tight_detail_requirements):
Not ideal for — comma-separated use cases or part types
  (e.g. large_dense_castings, very_thick_superalloy_sections):

────────────────────────────────────────

Please fill in the blanks above and return at your convenience.
If any field does not apply to your machine, just write "N/A".

Thank you!`
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RtMachineProfilesTab() {
  const [profiles, setProfiles] = useState<RtMachineProfile[]>([])
  const [loading, setLoading]   = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing]       = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestCopied, setRequestCopied] = useState(false)
  const [renamingId, setRenamingId]   = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  const loadFromApi = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(API_BASE, { cache: 'no-cache', headers: getAuthHeaders() })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data: RtMachineProfile[] = await r.json()
      if (data.length === 0) {
        for (const m of DEFAULT_MACHINES_SEED) {
          await fetch(API_BASE, { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(m) }).catch(() => {})
        }
        const r2 = await fetch(API_BASE, { headers: getAuthHeaders() })
        if (r2.ok) setProfiles(await r2.json())
      } else {
        setProfiles(data)
      }
    } catch (err) {
      console.error('[RtMachineProfiles] load failed', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadFromApi() }, [loadFromApi])

  function startRename(profile: RtMachineProfile) {
    setRenamingId(profile.id)
    setRenameValue(profile.nickname)
    setEditing(null)
  }

  async function commitRename() {
    if (!renamingId || !renameValue.trim()) { setRenamingId(null); return }
    const profile = profiles.find(p => p.id === renamingId)
    if (!profile) { setRenamingId(null); return }
    setRenameSaving(true)
    try {
      const r = await fetch(`${API_BASE}/${profile.machine_id}`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ nickname: renameValue.trim() }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      await loadFromApi()
    } catch (err) {
      console.error('[RtMachineProfiles] rename failed', err)
    } finally {
      setRenameSaving(false)
      setRenamingId(null)
    }
  }

  function handleCopyRequest() {
    navigator.clipboard.writeText(generateSpecRequestMessage())
    setRequestCopied(true)
    setTimeout(() => setRequestCopied(false), 2000)
  }

  async function handleSave(data: MachineFormData) {
    setSaving(true)
    try {
      const isEdit = editing?.startsWith('edit:')
      const editMachineId = isEdit ? profiles.find(p => p.id === editing!.split(':')[1])?.machine_id : null
      if (isEdit && editMachineId) {
        const newMachineId = data.machine_id.trim().toUpperCase()
        const body: Record<string, unknown> = { nickname: data.nickname, make_model: data.make_model, spec: data.spec }
        if (newMachineId && newMachineId !== editMachineId) body.new_machine_id = newMachineId
        const r = await fetch(`${API_BASE}/${editMachineId}`, { method: 'PUT', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) })
        if (!r.ok) {
          const errData = await r.json().catch(() => ({})) as { error?: string }
          throw new Error(errData.error ?? `HTTP ${r.status}`)
        }
      } else {
        const r = await fetch(API_BASE, { method: 'POST', headers: getAuthHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(data) })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const created: RtMachineProfile = await r.json()
        setSelectedId(created.id)
      }
      await loadFromApi()
      setEditing(null)
    } catch (err) {
      console.error('[RtMachineProfiles] save failed', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this machine profile?')) return
    const machineId = profiles.find(p => p.id === id)?.machine_id
    if (!machineId) return
    try {
      const r = await fetch(`${API_BASE}/${machineId}`, { method: 'DELETE', headers: getAuthHeaders() })
      if (!r.ok && r.status !== 404) throw new Error(`HTTP ${r.status}`)
      if (selectedId === id) setSelectedId(null)
      if (editing === `edit:${id}`) setEditing(null)
      await loadFromApi()
    } catch (err) {
      console.error('[RtMachineProfiles] delete failed', err)
    }
  }

  function getFormInitial(id: string): MachineFormData | undefined {
    const p = profiles.find(x => x.id === id)
    if (!p) return undefined
    return { machine_id: p.machine_id, nickname: p.nickname, make_model: p.make_model ?? '', spec: p.spec }
  }

  const selected = profiles.find(p => p.id === selectedId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading machine profiles…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Spec request message modal ── */}
      <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Machine Spec Request — Email Template</DialogTitle>
            <DialogDescription>
              Copy and paste this into an email to your technician. All schema fields are included.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={generateSpecRequestMessage()} readOnly rows={22} className="font-mono text-xs resize-none" />
          <div className="flex justify-end gap-2 mt-1">
            <Button variant="outline" size="sm" onClick={handleCopyRequest}>
              {requestCopied
                ? <><Check className="h-3.5 w-3.5 mr-1" /> Copied</>
                : <><Copy className="h-3.5 w-3.5 mr-1" /> Copy</>
              }
            </Button>
            <Button size="sm" onClick={() => setShowRequestModal(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        <RtMachineList
          machines={profiles}
          editMachineId={editing}
          selectedId={selectedId}
          onSelect={id => { setSelectedId(id); setEditing(null) }}
          onAdd={() => { setSelectedId(null); setEditing(editing === 'add' ? null : 'add') }}
          onDelete={handleDelete}
          onEdit={id => setEditing(editing === `edit:${id}` ? null : `edit:${id}`)}
          onRequestSpec={() => setShowRequestModal(true)}
          onInlineRename={startRename}
          renamingId={renamingId}
          renameValue={renameValue}
          onRenameChange={setRenameValue}
          onRenameCommit={commitRename}
          onRenameCancel={() => setRenamingId(null)}
          renameSaving={renameSaving}
        />

        {/* ── Right: form (when editing) or detail view ── */}
        <Card className="lg:col-span-3">
          {editing ? (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {editing === 'add' ? 'Add Machine Profile' : `Edit — ${profiles.find(p => p.id === editing.split(':')[1])?.machine_id ?? ''}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-hidden">
                <RtMachineForm
                  key={editing}
                  initial={editing === 'add' ? undefined : getFormInitial(editing.split(':')[1])}
                  saving={saving}
                  onSave={handleSave}
                  onCancel={() => setEditing(null)}
                />
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {selected ? <>{selected.machine_id} — {selected.nickname}</> : 'Machine Profile'}
                </CardTitle>
                {selected && <CardDescription>{selected.make_model}</CardDescription>}
              </CardHeader>
              <CardContent>
                {!selected ? (
                  <div className="flex flex-col items-center justify-center py-14 text-muted-foreground gap-2">
                    <Cpu className="h-8 w-8 opacity-25" />
                    <p className="text-sm">Select a machine to view its profile</p>
                  </div>
                ) : (() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const s = selected.spec as any
                  return (
                    <div className="space-y-3">
                      {s?.xray_source && (
                        <InfoBlock title="X-Ray Source">
                          <Row label="Type"           value={s.xray_source.type} />
                          <Row label="Max voltage"    value={`${s.xray_source.max_voltage_kv} kV`} />
                          <Row label="Operating range" value={`${s.xray_source.recommended_operating_range_kv?.join('–')} kV`} />
                          <Row label="Focal spot"     value={s.xray_source.focal_spot_class} />
                          <Row label="Modality"       value={s.xray_source.modality?.join(', ')} wide />
                          {s.xray_source.notes && <span className="col-span-2 italic text-muted-foreground">{s.xray_source.notes}</span>}
                          {s.xray_source.focal_spot_small_mm != null && <Row label="Focal spot small *" value={`${s.xray_source.focal_spot_small_mm} mm`} />}
                          {s.xray_source.focal_spot_large_mm != null && <Row label="Focal spot large *" value={`${s.xray_source.focal_spot_large_mm} mm`} />}
                          {s.xray_source.beam_cone_angle_deg != null && <Row label="Beam cone angle *" value={`${s.xray_source.beam_cone_angle_deg}°`} />}
                          {s.xray_source.target_angle_deg != null && <Row label="Target angle *" value={`${s.xray_source.target_angle_deg}°`} />}
                          {s.xray_source.inherent_filtration_be_mm != null && <Row label="Be filtration *" value={`${s.xray_source.inherent_filtration_be_mm} mm`} />}
                          {s.xray_source.max_continuous_power_small_w != null && <Row label="Max power (small) *" value={`${s.xray_source.max_continuous_power_small_w} W`} />}
                          {s.xray_source.max_continuous_power_large_w != null && <Row label="Max power (large) *" value={`${s.xray_source.max_continuous_power_large_w} W`} />}
                          {s.xray_source.cooling_type && <Row label="Cooling *" value={s.xray_source.cooling_type} />}
                          {s.xray_source.target_material && <Row label="Target material *" value={s.xray_source.target_material} />}
                        </InfoBlock>
                      )}
                      {s?.inspection_envelope && (
                        <InfoBlock title="Inspection Envelope">
                          <Row label="Max diameter" value={`${s.inspection_envelope.max_part_diameter_mm} mm`} />
                          <Row label="Max height"   value={`${s.inspection_envelope.max_part_height_mm} mm`} />
                          <Row label="Max weight"   value={`${s.inspection_envelope.max_part_weight_kg} kg`} />
                          <Row label="Shape"        value={s.inspection_envelope.shape} />
                          {s.inspection_envelope.usable_clearance_note && <span className="col-span-2 italic text-muted-foreground">{s.inspection_envelope.usable_clearance_note}</span>}
                        </InfoBlock>
                      )}
                      {s?.manipulation && (
                        <InfoBlock title="Manipulation">
                          <Row label="Axes"     value={s.manipulation.axes?.join(', ')} wide />
                          <Row label="Tilt"     value={s.manipulation.tilt_available ? 'Yes' : 'No'} />
                          <Row label="Min step" value={`${s.manipulation.min_rotation_step_deg}°`} />
                          {s.manipulation.notes && <span className="col-span-2 italic text-muted-foreground">{s.manipulation.notes}</span>}
                        </InfoBlock>
                      )}
                      {s?.detector_support && (
                        <InfoBlock title="Detector Support">
                          <Row label="Film"         value={s.detector_support.film_supported ? 'Yes' : 'No'} />
                          <Row label="Digital"      value={s.detector_support.digital_detector_supported ? 'Yes' : 'No'} />
                          <Row label="Film classes" value={s.detector_support.typical_film_classes?.join(', ')} wide />
                          <Row label="IQI support"  value={s.detector_support.image_quality_support?.join(', ')} wide />
                        </InfoBlock>
                      )}
                      {s?.planning_rules && (
                        <div className="rounded-md bg-muted/40 px-3 py-2.5 space-y-1.5">
                          <p className="text-xs font-semibold text-foreground">Planning Rules</p>
                          <div className="space-y-1 text-xs">
                            {s.planning_rules.best_for?.length > 0 && (
                              <p><span className="text-muted-foreground">Best for: </span><span className="text-green-600 dark:text-green-400">{s.planning_rules.best_for.join(', ')}</span></p>
                            )}
                            {s.planning_rules.not_ideal_for?.length > 0 && (
                              <p><span className="text-muted-foreground">Not ideal for: </span><span className="text-amber-600 dark:text-amber-400">{s.planning_rules.not_ideal_for.join(', ')}</span></p>
                            )}
                          </div>
                        </div>
                      )}
                      {Array.isArray(s?._supplemented_refs) && s._supplemented_refs.length > 0 && (
                        <SupplementedRefsBlock refs={s._supplemented_refs as SupplementedRef[]} />
                      )}
                    </div>
                  )
                })()}
              </CardContent>
            </>
          )}
        </Card>

      </div>
    </div>
  )
}
