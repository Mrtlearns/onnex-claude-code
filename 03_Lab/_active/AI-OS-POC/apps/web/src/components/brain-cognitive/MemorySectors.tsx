"use client"

// ─────────────────────────────────────────────────────────────────────────────
// MemorySectors — entity-type distribution heatmap
// DEV NOTE: Part of the brain-cognitive feature module. Safe to remove.
// ─────────────────────────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
  Person:       "bg-blue-400",
  Organization: "bg-emerald-400",
  Location:     "bg-orange-400",
  Concept:      "bg-violet-400",
  Technology:   "bg-rose-400",
  Document:     "bg-amber-400",
  Tool:         "bg-sky-400",
  Event:        "bg-fuchsia-400",
}

const DEFAULT_COLOR = "bg-slate-400"

interface MemorySectorsProps {
  entityTypes: Record<string, number>
  total: number
  className?: string
}

export function MemorySectors({ entityTypes, total, className }: MemorySectorsProps) {
  const sorted = Object.entries(entityTypes).sort(([, a], [, b]) => b - a)

  if (!sorted.length) {
    return (
      <div className={`flex items-center justify-center text-muted-foreground text-sm ${className ?? ""}`}>
        No data
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {/* Stacked bar */}
      <div className="flex h-3 rounded overflow-hidden gap-px">
        {sorted.map(([type, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0
          return (
            <div
              key={type}
              className={`${SECTOR_COLORS[type] ?? DEFAULT_COLOR} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${type}: ${count}`}
            />
          )
        })}
      </div>

      {/* Legend rows */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {sorted.map(([type, count]) => {
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0"
          return (
            <div key={type} className="flex items-center gap-1.5 text-xs">
              <span
                className={`shrink-0 w-2 h-2 rounded-sm ${SECTOR_COLORS[type] ?? DEFAULT_COLOR}`}
              />
              <span className="text-muted-foreground truncate">{type}</span>
              <span className="ml-auto tabular-nums font-medium">{count}</span>
              <span className="text-muted-foreground">({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
