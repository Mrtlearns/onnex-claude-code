"use client"

import { useState } from "react"
import { Play, Loader2, Calendar, Pencil, Trash2 } from "lucide-react"
import type { Sop } from "@/types/api"

const CATEGORY_COLORS: Record<string, string> = {
  sales: "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30",
  operations: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30",
  maintenance: "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30",
  hr: "bg-green-500/15 text-green-400 ring-1 ring-green-500/30",
}

interface SopCardProps {
  sop: Sop
  onRun: (slug: string, inputContext?: string) => Promise<void>
  isRunning: boolean
  onEdit?: (sop: Sop) => void
  onDelete?: (sop: Sop) => void
}

export function SopCard({ sop, onRun, isRunning, onEdit, onDelete }: SopCardProps) {
  const [inputContext, setInputContext] = useState("")

  const handleRun = async () => {
    await onRun(sop.slug, sop.input_label ? inputContext : undefined)
    setInputContext("")
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{sop.title}</h3>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[sop.category] ?? "bg-muted text-muted-foreground"}`}>
              {sop.category}
            </span>
            {sop.auto && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/30">
                <Calendar className="h-3 w-3" />
                scheduled
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{sop.description}</p>
        </div>

        {/* Edit / Delete icon buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {onEdit && (
            <button
              onClick={() => onEdit(sop)}
              className="p-1 rounded text-muted-foreground/50 hover:text-foreground/80 hover:bg-white/5 transition-colors"
              title="Edit SOP"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(sop)}
              className="p-1 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete SOP"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {sop.input_label && (
        <textarea
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          rows={2}
          placeholder={sop.input_label}
          value={inputContext}
          onChange={(e) => setInputContext(e.target.value)}
          disabled={isRunning}
        />
      )}

      <button
        onClick={handleRun}
        disabled={isRunning}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Running…
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" />
            Run
          </>
        )}
      </button>
    </div>
  )
}
