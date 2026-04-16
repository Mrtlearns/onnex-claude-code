import { useState, useEffect, useRef } from 'react'
import { Play, Square, Trash2, FlaskConical, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InspectionType } from '@/lib/workshop/types'
import { INSPECTION_TYPES } from '@/lib/workshop/constants'
import { useSimulation } from '@/contexts/SimulationContext'

const LOG_COLORS = {
  info:    'text-blue-400',
  success: 'text-green-400',
  error:   'text-red-400',
  scan:    'text-amber-400',
} as const

export function SimulationPanel() {
  const {
    running, stats, logs, customers,
    durationMin, arrivalRateSec, multiInspectPct, activeInspTypes,
    start, stop, clearSimData, clearLogs,
    setDurationMin, setArrivalRateSec, setMultiInspectPct, toggleInspType,
  } = useSimulation()

  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const logBoxRef = useRef<HTMLDivElement>(null)

  // Auto-scroll event log to bottom on new entries
  useEffect(() => {
    const el = logBoxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs.length])

  async function handleClear() {
    setClearing(true)
    try {
      await clearSimData()
      setShowClearConfirm(false)
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <FlaskConical className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--ws-text-primary)]">Simulation Control Panel</h2>
            <p className="text-xs text-[var(--ws-text-muted)]">
              Generates synthetic orders and fires QR scan events for testing the dashboard.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!running ? (
            <button
              onClick={start}
              disabled={activeInspTypes.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Start
            </button>
          ) : (
            <button
              onClick={stop}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <Square className="h-4 w-4" /> Stop
            </button>
          )}
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--ws-lane-border)] text-sm text-[var(--ws-text-secondary)] hover:bg-[var(--ws-glass-bg-hover)] transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>

      {/* Status banner */}
      <div className={cn(
        'rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
        running
          ? 'ws-sim-banner'
          : 'bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)] text-[var(--ws-text-muted)]'
      )}>
        {running
          ? `● Running — ${stats.ordersGenerated} orders · ${stats.jobsQueued} jobs queued · ${stats.jobsCompleted} completed`
          : `Stopped — ${stats.ordersGenerated} orders generated · ${stats.jobsCompleted} completed`
        }
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 gap-5 p-4 rounded-lg bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)]">
        <SliderField
          label="Simulation Duration"
          value={durationMin}
          min={5} max={180} step={5}
          format={(v) => `${v} min`}
          onChange={setDurationMin}
          disabled={running}
        />
        <SliderField
          label="Order Arrival Rate"
          value={arrivalRateSec}
          min={5} max={120} step={5}
          format={(v) => `every ${v}s`}
          onChange={setArrivalRateSec}
          disabled={running}
        />
        <SliderField
          label="Multi-Inspection %"
          value={multiInspectPct}
          min={0} max={100} step={10}
          format={(v) => `${v}%`}
          onChange={setMultiInspectPct}
          disabled={running}
        />
      </div>

      {/* Inspection type mix */}
      <div className="p-4 rounded-lg bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)]">
        <h3 className="text-xs font-semibold text-[var(--ws-text-secondary)] uppercase tracking-wider mb-3">
          Inspection Mix
        </h3>
        <div className="flex flex-wrap gap-2">
          {INSPECTION_TYPES.map((type: InspectionType) => {
            const active = activeInspTypes.includes(type)
            return (
              <button
                key={type}
                onClick={() => toggleInspType(type)}
                disabled={running}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-mono font-bold transition-colors',
                  active
                    ? 'bg-[var(--ws-accent)] text-white'
                    : 'bg-[var(--ws-bg-tertiary)] text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]',
                  running && 'opacity-50 cursor-not-allowed'
                )}
              >
                {type}
              </button>
            )
          })}
        </div>
      </div>

      {/* Customers preview */}
      <div className="p-4 rounded-lg bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)]">
        <h3 className="text-xs font-semibold text-[var(--ws-text-secondary)] uppercase tracking-wider mb-3">
          Customers ({customers.length} loaded from DB)
        </h3>
        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
          {customers.slice(0, 12).map((c) => (
            <div key={c.id} className="text-xs text-[var(--ws-text-secondary)] truncate py-0.5">
              {c.name}
            </div>
          ))}
          {customers.length > 12 && (
            <div className="text-xs text-[var(--ws-text-muted)] italic col-span-2">
              +{customers.length - 12} more…
            </div>
          )}
        </div>
      </div>

      {/* Event log */}
      <div className="p-4 rounded-lg bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-[var(--ws-text-secondary)] uppercase tracking-wider">
            Event Log
          </h3>
          <button
            onClick={clearLogs}
            className="text-[10px] text-[var(--ws-text-muted)] hover:text-[var(--ws-text-secondary)] transition-colors"
          >
            Clear log
          </button>
        </div>
        <div
          ref={logBoxRef}
          className="h-52 overflow-y-auto font-mono text-[11px] bg-black/80 rounded-md p-3 space-y-px"
        >
          {logs.length === 0 ? (
            <span className="text-gray-600 italic">Waiting for simulation events…</span>
          ) : (
            logs.map((entry, i) => (
              <div key={i} className={cn('leading-relaxed whitespace-pre-wrap break-all', LOG_COLORS[entry.type])}>
                <span className="text-gray-600 mr-2 select-none">{entry.ts}</span>
                {entry.msg}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Clear confirm dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--ws-bg-secondary)] border border-[var(--ws-lane-border)] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <h3 className="font-semibold text-[var(--ws-text-primary)]">Clear Simulation Data?</h3>
            </div>
            <p className="text-sm text-[var(--ws-text-secondary)] mb-6">
              This will permanently delete all orders and jobs marked as simulated. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-md text-sm text-[var(--ws-text-secondary)] border border-[var(--ws-lane-border)] hover:bg-[var(--ws-glass-bg-hover)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                disabled={clearing}
                className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {clearing ? 'Clearing…' : 'Yes, Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}

function SliderField({ label, value, min, max, step, format, onChange, disabled }: SliderFieldProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-[var(--ws-text-secondary)] w-44 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        disabled={disabled}
        className="flex-1 accent-[var(--ws-accent)]"
      />
      <span className="text-sm font-mono text-[var(--ws-text-primary)] w-20 text-right">
        {format(value)}
      </span>
    </div>
  )
}
