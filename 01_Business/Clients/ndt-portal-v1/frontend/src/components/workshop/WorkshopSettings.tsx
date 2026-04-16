import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, ChevronDown, ChevronUp, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InspectionType, WorkDay, WorkshopMachine } from '@/lib/workshop/types'
import { INSPECTION_TYPES } from '@/lib/workshop/constants'
import { useWorkshopSettings } from '@/hooks/useWorkshopSettings'
import { useWorkshopMachines } from '@/hooks/useWorkshopMachines'

const ALL_DAYS: WorkDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const BUFFER_OPTIONS = [0, 15, 30, 45, 60]
const TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'UTC',
]

// ── Machine row editor ─────────────────────────────────────────

interface MachineRowProps {
  machine: WorkshopMachine
  onUpdate: (id: string, data: { name?: string; inspectorName?: string | null; isActive?: boolean }) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onAddOffline: (machineId: string, data: { startAt: string; endAt: string; reason?: string | null }) => Promise<void>
  onRemoveOffline: (machineId: string, windowId: string) => Promise<void>
}

function MachineRow({ machine, onUpdate, onDelete, onAddOffline, onRemoveOffline }: MachineRowProps) {
  const isRt = machine.type === 'RT'
  const [name, setName] = useState(machine.name)
  const [inspector, setInspector] = useState(machine.inspectorName ?? '')
  const [showOffline, setShowOffline] = useState(false)
  const [offlineStart, setOfflineStart] = useState('')
  const [offlineEnd, setOfflineEnd] = useState('')
  const [offlineReason, setOfflineReason] = useState('')
  const [saving, setSaving] = useState(false)

  // Re-sync when parent updates (e.g. after catalog sync reverts name for RT machines)
  useEffect(() => { setName(machine.name) }, [machine.name])
  useEffect(() => { setInspector(machine.inspectorName ?? '') }, [machine.inspectorName])

  async function save() {
    setSaving(true)
    try {
      // RT machine names are managed in Integration Settings → RT tab (source of truth).
      // Only persist the inspector name here; name comes from rt.machine_catalog via sync.
      const update = isRt
        ? { inspectorName: inspector || null }
        : { name, inspectorName: inspector || null }
      await onUpdate(machine.id, update)
    } finally {
      setSaving(false)
    }
  }

  async function addOffline() {
    if (!offlineStart || !offlineEnd) return
    await onAddOffline(machine.id, {
      startAt: new Date(offlineStart).toISOString(),
      endAt: new Date(offlineEnd).toISOString(),
      reason: offlineReason || null,
    })
    setOfflineStart(''); setOfflineEnd(''); setOfflineReason('')
  }

  return (
    <div className={cn(
      'rounded-lg border p-3 space-y-2 transition-opacity',
      machine.isActive
        ? 'bg-[var(--ws-bg-secondary)] border-[var(--ws-lane-border)]'
        : 'bg-[var(--ws-bg-tertiary)] border-[var(--ws-lane-border)] opacity-60'
    )}>
      <div className="flex items-center gap-2">
        {isRt ? (
          <span
            className="flex-1 px-2 py-1 rounded text-sm bg-[var(--ws-bg-tertiary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-muted)] truncate"
            title="RT machine names are managed in Integration Settings → RT tab"
          >
            {machine.name}
          </span>
        ) : (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            placeholder="Machine name"
            className="flex-1 px-2 py-1 rounded text-sm bg-[var(--ws-bg-tertiary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
          />
        )}
        <input
          value={inspector}
          onChange={(e) => setInspector(e.target.value)}
          onBlur={save}
          placeholder="Default inspector"
          className="flex-1 px-2 py-1 rounded text-sm bg-[var(--ws-bg-tertiary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
        />
        <button
          onClick={() => onUpdate(machine.id, { isActive: !machine.isActive })}
          className={cn(
            'px-2 py-1 rounded text-xs font-medium transition-colors',
            machine.isActive
              ? 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]'
              : 'text-amber-500 hover:text-amber-400'
          )}
          title={machine.isActive ? 'Deactivate machine' : 'Activate machine'}
        >
          {machine.isActive ? 'Active' : 'Inactive'}
        </button>
        <button
          onClick={() => setShowOffline((v) => !v)}
          className="p-1 rounded text-[var(--ws-text-muted)] hover:text-amber-400 transition-colors"
          title="Offline windows"
        >
          <WifiOff className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => { if (confirm(`Remove machine "${machine.name}"?`)) onDelete(machine.id) }}
          className="p-1 rounded text-[var(--ws-text-muted)] hover:text-red-400 transition-colors"
          title="Remove machine"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        {saving && <span className="text-[10px] text-[var(--ws-text-muted)]">Saving…</span>}
      </div>

      {/* Offline windows */}
      {showOffline && (
        <div className="pl-2 border-l-2 border-amber-500/30 space-y-2">
          {machine.offlineWindows.length > 0 && (
            <div className="space-y-1">
              {machine.offlineWindows.map((w) => (
                <div key={w.id} className="flex items-center justify-between text-xs text-[var(--ws-text-muted)]">
                  <span>
                    {new Date(w.startAt).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' })}
                    {' → '}
                    {new Date(w.endAt).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' })}
                    {w.reason && ` — ${w.reason}`}
                  </span>
                  <button
                    onClick={() => onRemoveOffline(machine.id, w.id)}
                    className="text-red-400 hover:text-red-300 ml-2"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 flex-wrap">
            <label className="block">
              <span className="text-[10px] text-[var(--ws-text-muted)]">From</span>
              <input
                type="datetime-local"
                value={offlineStart}
                onChange={(e) => setOfflineStart(e.target.value)}
                className="block px-2 py-1 rounded text-xs bg-[var(--ws-bg-tertiary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-[var(--ws-text-muted)]">To</span>
              <input
                type="datetime-local"
                value={offlineEnd}
                onChange={(e) => setOfflineEnd(e.target.value)}
                className="block px-2 py-1 rounded text-xs bg-[var(--ws-bg-tertiary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
              />
            </label>
            <input
              value={offlineReason}
              onChange={(e) => setOfflineReason(e.target.value)}
              placeholder="Reason (optional)"
              className="flex-1 min-w-[120px] px-2 py-1 rounded text-xs bg-[var(--ws-bg-tertiary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
            />
            <button
              onClick={addOffline}
              disabled={!offlineStart || !offlineEnd}
              className="px-3 py-1.5 rounded text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main settings panel ───────────────────────────────────────

export function WorkshopSettingsPanel() {
  const { settings, loading, updateSetting } = useWorkshopSettings()
  const { machines, createMachine, updateMachine, deleteMachine, addOfflineWindow, removeOfflineWindow } = useWorkshopMachines()

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Local editable state — synced from settings on load
  const [hours, setHours] = useState({ start: '08:00', end: '17:00', timezone: 'America/Los_Angeles' })
  const [durations, setDurations] = useState<Record<string, number>>({})
  const [activeTypes, setActiveTypes] = useState<InspectionType[]>([])
  const [workingDays, setWorkingDays] = useState<WorkDay[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
  const [bufferMinutes, setBufferMinutes] = useState(0)
  const [holidays, setHolidays] = useState<string[]>([])
  const [newHoliday, setNewHoliday] = useState('')
  const [expandedType, setExpandedType] = useState<InspectionType | null>(null)

  // Sync from loaded settings (run once when loading flips false)
  useEffect(() => {
    if (!loading) {
      setHours(settings.businessHours)
      setDurations(settings.inspectionDurationsDefault)
      setActiveTypes(settings.inspectionTypes)
      setWorkingDays(settings.workingDays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
      setBufferMinutes(settings.bufferMinutes ?? 0)
      setHolidays(settings.holidays ?? [])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  async function save() {
    setSaving(true)
    try {
      await Promise.all([
        updateSetting('business_hours', hours),
        updateSetting('inspection_types', activeTypes),
        updateSetting('inspection_durations_default', durations),
        updateSetting('working_days', workingDays),
        updateSetting('buffer_minutes', bufferMinutes),
        updateSetting('holidays', holidays),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function toggleType(type: InspectionType) {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  function toggleDay(day: WorkDay) {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function addHoliday() {
    if (!newHoliday || holidays.includes(newHoliday)) return
    setHolidays((prev) => [...prev, newHoliday].sort())
    setNewHoliday('')
  }

  async function handleAddMachine(type: InspectionType) {
    const existingCount = machines.filter((m) => m.type === type).length
    await createMachine({ name: `${type} Machine ${existingCount + 1}`, type, displayOrder: existingCount })
  }

  if (loading) {
    return <div className="p-6 text-[var(--ws-text-muted)] text-sm">Loading settings…</div>
  }

  // Group machines by inspection type
  const machinesByType = (type: InspectionType) => machines.filter((m) => m.type === type)

  return (
    <div className="p-6 max-w-2xl space-y-8 overflow-y-auto">
      {/* Save button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--ws-text-primary)]">Workshop Settings</h2>
        <button
          onClick={save}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            saved
              ? 'bg-green-600 text-white'
              : 'bg-[var(--ws-accent)] text-white hover:opacity-90',
            saving && 'opacity-60 cursor-not-allowed'
          )}
        >
          <Save className="h-4 w-4" />
          {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Business Hours */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--ws-text-secondary)] uppercase tracking-wider mb-3">
          Business Hours
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs text-[var(--ws-text-muted)] mb-1 block">Start Time</span>
            <input
              type="time"
              value={hours.start}
              onChange={(e) => setHours((h) => ({ ...h, start: e.target.value }))}
              className="w-full px-3 py-2 rounded-md text-sm bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--ws-text-muted)] mb-1 block">End Time</span>
            <input
              type="time"
              value={hours.end}
              onChange={(e) => setHours((h) => ({ ...h, end: e.target.value }))}
              className="w-full px-3 py-2 rounded-md text-sm bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--ws-text-muted)] mb-1 block">Timezone</span>
            <select
              value={hours.timezone}
              onChange={(e) => setHours((h) => ({ ...h, timezone: e.target.value }))}
              className="w-full px-3 py-2 rounded-md text-sm bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </label>
        </div>
      </section>

      {/* Working Days */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--ws-text-secondary)] uppercase tracking-wider mb-3">
          Working Days
        </h3>
        <div className="flex gap-2 flex-wrap">
          {ALL_DAYS.map((day) => {
            const active = workingDays.includes(day)
            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  active
                    ? 'bg-[var(--ws-accent)] text-white'
                    : 'bg-[var(--ws-bg-secondary)] text-[var(--ws-text-muted)] border border-[var(--ws-lane-border)] hover:border-[var(--ws-accent)]'
                )}
              >
                {day}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-[var(--ws-text-muted)] mt-2">
          Auto-scheduler skips non-working days. Jobs scheduled on those days are flagged as conflicts.
        </p>
      </section>

      {/* Holidays */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--ws-text-secondary)] uppercase tracking-wider mb-3">
          Holidays & Closures
        </h3>
        <div className="flex gap-2 mb-3">
          <input
            type="date"
            value={newHoliday}
            onChange={(e) => setNewHoliday(e.target.value)}
            className="px-3 py-2 rounded-md text-sm bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
          />
          <button
            onClick={addHoliday}
            disabled={!newHoliday}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)] hover:border-[var(--ws-accent)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        {holidays.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {holidays.map((d) => (
              <div key={d} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)] text-xs text-[var(--ws-text-secondary)]">
                {d}
                <button
                  onClick={() => setHolidays((prev) => prev.filter((h) => h !== d))}
                  className="text-[var(--ws-text-muted)] hover:text-red-400"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--ws-text-muted)]">No holidays configured.</p>
        )}
      </section>

      {/* Buffer Time */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--ws-text-secondary)] uppercase tracking-wider mb-3">
          Job Buffer Time
        </h3>
        <div className="flex items-center gap-3">
          <select
            value={bufferMinutes}
            onChange={(e) => setBufferMinutes(Number(e.target.value))}
            className="px-3 py-2 rounded-md text-sm bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
          >
            {BUFFER_OPTIONS.map((m) => (
              <option key={m} value={m}>{m === 0 ? 'No buffer' : `${m} min`}</option>
            ))}
          </select>
          <p className="text-xs text-[var(--ws-text-muted)]">
            Minimum gap between consecutive jobs on the same machine.
          </p>
        </div>
      </section>

      {/* Inspection Types + Machines */}
      <section>
        <h3 className="text-sm font-semibold text-[var(--ws-text-secondary)] uppercase tracking-wider mb-3">
          Inspection Types & Machines
        </h3>
        <div className="space-y-3">
          {INSPECTION_TYPES.map((type) => {
            const active = activeTypes.includes(type)
            const typeMachines = machinesByType(type)
            const expanded = expandedType === type

            return (
              <div key={type} className="rounded-lg border border-[var(--ws-lane-border)] bg-[var(--ws-bg-secondary)] overflow-hidden">
                {/* Type header */}
                <div className="flex items-center gap-3 p-3">
                  <button
                    onClick={() => toggleType(type)}
                    className={cn(
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                      active ? 'bg-[var(--ws-accent)] border-[var(--ws-accent)]' : 'border-[var(--ws-text-muted)]'
                    )}
                  >
                    {active && <span className="text-white text-xs font-bold">✓</span>}
                  </button>
                  <span className="font-mono font-bold text-sm text-[var(--ws-text-primary)]">{type}</span>
                  <span className="text-xs text-[var(--ws-text-muted)]">
                    {typeMachines.filter((m) => m.isActive).length} machine{typeMachines.filter((m) => m.isActive).length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <label className="flex items-center gap-1.5 text-xs text-[var(--ws-text-muted)]">
                      Default:
                      <input
                        type="number"
                        min={15}
                        max={480}
                        step={15}
                        value={durations[type] ?? 60}
                        onChange={(e) => setDurations((d) => ({ ...d, [type]: parseInt(e.target.value) || 60 }))}
                        className="w-14 px-2 py-1 rounded text-xs text-right bg-[var(--ws-bg-tertiary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-primary)]"
                      />
                      min
                    </label>
                    <button
                      onClick={() => setExpandedType(expanded ? null : type)}
                      className="p-1 rounded text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)]"
                    >
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Machines list */}
                {expanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-[var(--ws-lane-border)] pt-3">
                    {typeMachines.length === 0 ? (
                      <p className="text-xs text-[var(--ws-text-muted)]">No machines configured for {type}.</p>
                    ) : (
                      typeMachines.map((machine) => (
                        <MachineRow
                          key={machine.id}
                          machine={machine}
                          onUpdate={updateMachine}
                          onDelete={deleteMachine}
                          onAddOffline={addOfflineWindow}
                          onRemoveOffline={removeOfflineWindow}
                        />
                      ))
                    )}
                    <button
                      onClick={() => handleAddMachine(type)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-[var(--ws-text-muted)] border border-dashed border-[var(--ws-lane-border)] hover:border-[var(--ws-accent)] hover:text-[var(--ws-accent)] w-full justify-center transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add {type} machine
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
