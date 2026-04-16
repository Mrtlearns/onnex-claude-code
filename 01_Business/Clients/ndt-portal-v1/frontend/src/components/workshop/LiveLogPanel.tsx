import { useEffect, useRef } from 'react'
import { X, Trash2, Info, CheckCircle2, AlertCircle, QrCode, Truck } from 'lucide-react'
import { useSimulation, type SimLogEntry } from '@/contexts/SimulationContext'

interface LiveLogPanelProps {
  onClose: () => void
}

// Icon + color per log entry type
function entryIcon(entry: SimLogEntry) {
  const msgLower = entry.msg.toLowerCase()

  // Truck: order creation / arrival events
  if (entry.type === 'success' && (msgLower.includes('sim-') || msgLower.includes('order'))) {
    return <Truck className="h-3 w-3 shrink-0 text-slate-400" />
  }

  switch (entry.type) {
    case 'scan':    return <QrCode       className="h-3 w-3 shrink-0 text-amber-400" />
    case 'success': return <CheckCircle2 className="h-3 w-3 shrink-0 text-green-400" />
    case 'error':   return <AlertCircle  className="h-3 w-3 shrink-0 text-red-400" />
    default:        return <Info         className="h-3 w-3 shrink-0 text-blue-400" />
  }
}

function entryColor(entry: SimLogEntry): string {
  const msgLower = entry.msg.toLowerCase()
  if (entry.type === 'success' && (msgLower.includes('sim-') || msgLower.includes('order'))) {
    return '#94a3b8' // slate-400 for truck/order lines
  }
  switch (entry.type) {
    case 'scan':    return '#fbbf24' // amber-400
    case 'success': return '#4ade80' // green-400
    case 'error':   return '#f87171' // red-400
    default:        return '#60a5fa' // blue-400
  }
}

export function LiveLogPanel({ onClose }: LiveLogPanelProps) {
  const { logs, clearLogs, running } = useSimulation()
  const bodyRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logs])

  return (
    <div className="ws-log-panel">
      {/* Header */}
      <div className="ws-log-panel-header">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#e0e4ff]">Live Log</span>
          {running && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400">
              ● SIM ACTIVE
            </span>
          )}
          <span className="text-[10px] text-[#3f4560] font-mono">{logs.length} entries</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearLogs}
            title="Clear log"
            className="p-1.5 rounded-md text-[#3f4560] hover:text-[#7080a8] hover:bg-white/5 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded-md text-[#3f4560] hover:text-[#e0e4ff] hover:bg-white/5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="ws-log-panel-body" ref={bodyRef}>
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-12 text-[#3f4560]">
            <QrCode className="h-6 w-6 opacity-40" />
            <span className="text-[10px]">No log entries yet</span>
            <span className="text-[9px] opacity-60">Start the simulation to see activity</span>
          </div>
        ) : (
          logs.map((entry, idx) => (
            <div key={idx} className="ws-log-entry">
              <span className="ws-log-ts">{entry.ts}</span>
              <span className="mt-[1px] shrink-0">{entryIcon(entry)}</span>
              <span className="ws-log-msg" style={{ color: entryColor(entry) }}>
                {entry.msg}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
