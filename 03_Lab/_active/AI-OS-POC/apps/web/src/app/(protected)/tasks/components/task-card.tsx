"use client"

import { useState, useRef, useEffect, memo } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Calendar, ChevronDown, ChevronUp, AlignLeft } from "lucide-react"
import type { Task, TaskStatus } from "@/types/api"
import { cn } from "@/lib/utils"

// ─── Per-status visual identity ───────────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, {
  accentBar: string     // left 3px bar
  accentGlow: string    // hover shadow
  cardBg: string        // card gradient
  cardBorder: string    // resting border
  cardHoverBorder: string
  pill: string          // status pill bg + text
  pillDot: string       // dot inside pill
  avatarRing: string    // avatar ring color
}> = {
  Backlog: {
    accentBar:        "bg-slate-400",
    accentGlow:       "hover:shadow-[0_2px_16px_rgba(148,163,184,0.12)]",
    cardBg:           "bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80",
    cardBorder:       "border-slate-700/50",
    cardHoverBorder:  "hover:border-slate-500/70",
    pill:             "bg-slate-700/70 text-slate-200 ring-1 ring-slate-600/50",
    pillDot:          "bg-slate-400",
    avatarRing:       "ring-slate-500/60",
  },
  "In Progress": {
    accentBar:        "bg-blue-400",
    accentGlow:       "hover:shadow-[0_2px_16px_rgba(96,165,250,0.18)]",
    cardBg:           "bg-gradient-to-br from-blue-900/60 via-blue-950/50 to-slate-900/80",
    cardBorder:       "border-blue-800/50",
    cardHoverBorder:  "hover:border-blue-500/60",
    pill:             "bg-blue-800/70 text-blue-100 ring-1 ring-blue-600/50",
    pillDot:          "bg-blue-400",
    avatarRing:       "ring-blue-500/60",
  },
  Review: {
    accentBar:        "bg-violet-400",
    accentGlow:       "hover:shadow-[0_2px_16px_rgba(167,139,250,0.18)]",
    cardBg:           "bg-gradient-to-br from-violet-900/60 via-violet-950/50 to-slate-900/80",
    cardBorder:       "border-violet-800/50",
    cardHoverBorder:  "hover:border-violet-500/60",
    pill:             "bg-violet-800/70 text-violet-100 ring-1 ring-violet-600/50",
    pillDot:          "bg-violet-400",
    avatarRing:       "ring-violet-500/60",
  },
  Done: {
    accentBar:        "bg-emerald-400",
    accentGlow:       "hover:shadow-[0_2px_16px_rgba(52,211,153,0.14)]",
    cardBg:           "bg-gradient-to-br from-emerald-900/50 via-emerald-950/40 to-slate-900/80",
    cardBorder:       "border-emerald-800/50",
    cardHoverBorder:  "hover:border-emerald-500/60",
    pill:             "bg-emerald-800/70 text-emerald-100 ring-1 ring-emerald-600/50",
    pillDot:          "bg-emerald-400",
    avatarRing:       "ring-emerald-500/60",
  },
}

// ─── Due-date urgency ─────────────────────────────────────────────────────────

function getDueDateChip(dateStr: string): { cls: string; label: string; icon: string } {
  const diff = (new Date(dateStr).getTime() - Date.now()) / 86_400_000
  if (diff < 0)  return { cls: "bg-red-900/70 text-red-300 ring-1 ring-red-700/50",   label: "Overdue",              icon: "🔴" }
  if (diff <= 1) return { cls: "bg-red-900/50 text-red-300 ring-1 ring-red-800/40",   label: "Due today",            icon: "⚠️" }
  if (diff <= 3) return { cls: "bg-amber-900/60 text-amber-300 ring-1 ring-amber-700/40", label: formatDate(dateStr), icon: "🟡" }
  return             { cls: "bg-slate-800/60 text-slate-400 ring-1 ring-slate-700/40",   label: formatDate(dateStr), icon: "" }
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ─── Assignee avatar — deterministic vivid color from UUID ───────────────────

const AVATAR_PALETTE = [
  "bg-rose-600 text-rose-50",
  "bg-orange-600 text-orange-50",
  "bg-amber-600 text-amber-50",
  "bg-lime-700 text-lime-50",
  "bg-teal-700 text-teal-50",
  "bg-cyan-700 text-cyan-50",
  "bg-sky-700 text-sky-50",
  "bg-indigo-700 text-indigo-50",
  "bg-violet-700 text-violet-50",
  "bg-fuchsia-700 text-fuchsia-50",
  "bg-pink-700 text-pink-50",
]

function avatarColor(id: string) {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

function avatarInitials(id: string) {
  // Use first 2 meaningful chars of UUID
  const clean = id.replace(/-/g, "")
  return clean.slice(0, 2).toUpperCase()
}

// ─── Pure card content (shared with DragOverlay) ──────────────────────────────

interface TaskCardContentProps {
  task: Task
  isExpanded: boolean
  onToggleExpand: (e: React.MouseEvent) => void
  overlay?: boolean
}

export function TaskCardContent({ task, isExpanded, onToggleExpand, overlay }: TaskCardContentProps) {
  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.Backlog
  const dateChip = task.due_date ? getDueDateChip(task.due_date) : null

  return (
    <div className="flex min-w-0">
      {/* ── Left accent bar ── */}
      <div className={cn("w-[3px] rounded-l-md shrink-0 self-stretch", cfg.accentBar)} />

      {/* ── Card body ── */}
      <div className="flex-1 px-3 py-2.5 min-w-0">

        {/* Title + chevron */}
        <div className="flex items-start gap-1.5">
          <p className="flex-1 text-sm font-semibold leading-snug text-foreground/90 line-clamp-2">
            {task.title}
          </p>
          {!overlay && (
            <button
              onClick={onToggleExpand}
              className={cn(
                "shrink-0 mt-0.5 p-0.5 rounded text-muted-foreground/40 hover:text-foreground/60",
                "hover:bg-white/5 transition-colors",
              )}
            >
              {isExpanded
                ? <ChevronUp className="h-3 w-3" />
                : <ChevronDown className="h-3 w-3" />
              }
            </button>
          )}
        </div>

        {/* ── Chips row — always visible ── */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">

          {/* Status pill */}
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-[3px] text-[10px] font-medium leading-none",
            cfg.pill,
          )}>
            <span className={cn("h-[5px] w-[5px] rounded-full shrink-0", cfg.pillDot)} />
            {task.status}
          </span>

          {/* Due date chip */}
          {dateChip && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-[3px] text-[10px] font-medium leading-none",
              dateChip.cls,
            )}>
              <Calendar className="h-2.5 w-2.5 shrink-0" />
              {dateChip.label}
            </span>
          )}

          {/* Assignee avatar — right-aligned */}
          {task.assignee_id && (
            <div className="ml-auto shrink-0">
              <div className={cn(
                "h-[22px] w-[22px] rounded-full text-[9px] font-bold",
                "flex items-center justify-center ring-1 shrink-0",
                avatarColor(task.assignee_id),
                cfg.avatarRing,
              )}>
                {avatarInitials(task.assignee_id)}
              </div>
            </div>
          )}
        </div>

        {/* ── Expanded details ── */}
        {isExpanded && (
          <div className="mt-2.5 pt-2 border-t border-white/[0.06] space-y-1.5">
            {task.due_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Due {formatDate(task.due_date)}
                </span>
              </div>
            )}
            {task.assignee_id && (
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "h-4 w-4 rounded-full text-[8px] font-bold flex items-center justify-center shrink-0",
                  avatarColor(task.assignee_id),
                )}>
                  {avatarInitials(task.assignee_id)}
                </div>
                <span className="text-xs text-muted-foreground truncate">
                  {task.assignee_id.slice(0, 20)}
                </span>
              </div>
            )}
            {task.description && (
              <div className="flex items-start gap-1.5 mt-1">
                <AlignLeft className="h-3 w-3 text-muted-foreground/40 shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground/60 line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sortable TaskCard ────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task
  onClick: (task: Task) => void
}

export const TaskCard = memo(function TaskCard({ task, onClick }: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.Backlog
  const dragHappened = useRef(false)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  useEffect(() => {
    if (isDragging) dragHappened.current = true
  }, [isDragging])

  const style = { transform: CSS.Transform.toString(transform), transition }

  function handleToggle(e: React.MouseEvent) {
    e.stopPropagation()
    setIsExpanded(v => !v)
  }

  function handleClick() {
    if (dragHappened.current) { dragHappened.current = false; return }
    onClick(task)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "rounded-md border overflow-hidden cursor-grab active:cursor-grabbing select-none transition-colors",
        cfg.cardBg,
        cfg.cardBorder,
        cfg.cardHoverBorder,
        cfg.accentGlow,
        isDragging && "opacity-20 scale-95",
      )}
    >
      <TaskCardContent task={task} isExpanded={isExpanded} onToggleExpand={handleToggle} />
    </div>
  )
})
