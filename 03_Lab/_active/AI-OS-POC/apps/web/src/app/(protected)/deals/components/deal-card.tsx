"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { TrendingUp, DollarSign } from "lucide-react"
import type { Deal } from "@/types/api"
import { cn } from "@/lib/utils"

interface DealCardProps {
  deal: Deal
  onClick: () => void
  overlay?: boolean
}

// ─── Per-stage visual identity ────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, {
  accentBar: string
  cardBg: string
  cardBorder: string
  cardHoverBorder: string
  accentGlow: string
  stagePill: string
  stageDot: string
  probColor: string   // probability bar fill
}> = {
  lead: {
    accentBar:        "bg-blue-400",
    cardBg:           "bg-gradient-to-br from-blue-900/55 via-blue-950/45 to-slate-900/80",
    cardBorder:       "border-blue-800/50",
    cardHoverBorder:  "hover:border-blue-500/60",
    accentGlow:       "hover:shadow-[0_2px_16px_rgba(96,165,250,0.15)]",
    stagePill:        "bg-blue-800/70 text-blue-100 ring-1 ring-blue-600/50",
    stageDot:         "bg-blue-400",
    probColor:        "bg-blue-500",
  },
  qualified: {
    accentBar:        "bg-violet-400",
    cardBg:           "bg-gradient-to-br from-violet-900/55 via-violet-950/45 to-slate-900/80",
    cardBorder:       "border-violet-800/50",
    cardHoverBorder:  "hover:border-violet-500/60",
    accentGlow:       "hover:shadow-[0_2px_16px_rgba(167,139,250,0.15)]",
    stagePill:        "bg-violet-800/70 text-violet-100 ring-1 ring-violet-600/50",
    stageDot:         "bg-violet-400",
    probColor:        "bg-violet-500",
  },
  proposal: {
    accentBar:        "bg-amber-400",
    cardBg:           "bg-gradient-to-br from-amber-900/50 via-amber-950/40 to-slate-900/80",
    cardBorder:       "border-amber-800/50",
    cardHoverBorder:  "hover:border-amber-500/60",
    accentGlow:       "hover:shadow-[0_2px_16px_rgba(251,191,36,0.15)]",
    stagePill:        "bg-amber-800/70 text-amber-100 ring-1 ring-amber-600/50",
    stageDot:         "bg-amber-400",
    probColor:        "bg-amber-500",
  },
  negotiation: {
    accentBar:        "bg-orange-400",
    cardBg:           "bg-gradient-to-br from-orange-900/50 via-orange-950/40 to-slate-900/80",
    cardBorder:       "border-orange-800/50",
    cardHoverBorder:  "hover:border-orange-500/60",
    accentGlow:       "hover:shadow-[0_2px_16px_rgba(251,146,60,0.15)]",
    stagePill:        "bg-orange-800/70 text-orange-100 ring-1 ring-orange-600/50",
    stageDot:         "bg-orange-400",
    probColor:        "bg-orange-500",
  },
  won: {
    accentBar:        "bg-emerald-400",
    cardBg:           "bg-gradient-to-br from-emerald-900/50 via-emerald-950/40 to-slate-900/80",
    cardBorder:       "border-emerald-800/50",
    cardHoverBorder:  "hover:border-emerald-500/60",
    accentGlow:       "hover:shadow-[0_2px_16px_rgba(52,211,153,0.15)]",
    stagePill:        "bg-emerald-800/70 text-emerald-100 ring-1 ring-emerald-600/50",
    stageDot:         "bg-emerald-400",
    probColor:        "bg-emerald-500",
  },
  lost: {
    accentBar:        "bg-slate-500",
    cardBg:           "bg-gradient-to-br from-slate-800/60 to-slate-900/80",
    cardBorder:       "border-slate-700/40",
    cardHoverBorder:  "hover:border-slate-600/50",
    accentGlow:       "",
    stagePill:        "bg-slate-700/70 text-slate-400 ring-1 ring-slate-600/40",
    stageDot:         "bg-slate-500",
    probColor:        "bg-slate-500",
  },
}

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", qualified: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", won: "Won", lost: "Lost",
}

function formatValue(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toLocaleString()}`
}

// ─── Pure card content ────────────────────────────────────────────────────────

export function DealCardContent({ deal }: { deal: Deal }) {
  const cfg = STAGE_CONFIG[deal.status] ?? STAGE_CONFIG.lead

  return (
    <div className="flex min-w-0">
      {/* Left accent bar */}
      <div className={cn("w-[3px] rounded-l-md shrink-0 self-stretch", cfg.accentBar)} />

      {/* Body */}
      <div className="flex-1 px-3 py-2.5 min-w-0">

        {/* Title */}
        <p className="text-sm font-semibold leading-snug text-foreground/90 line-clamp-2">
          {deal.title}
        </p>

        {/* Value + Stage row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">

          {/* Value chip */}
          <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-[3px] text-[10px] font-bold leading-none bg-white/8 text-foreground/80 ring-1 ring-white/10">
            <DollarSign className="h-2.5 w-2.5 shrink-0 opacity-60" />
            {formatValue(deal.value)}
          </span>

          {/* Stage pill */}
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-[3px] text-[10px] font-medium leading-none",
            cfg.stagePill,
          )}>
            <span className={cn("h-[5px] w-[5px] rounded-full shrink-0", cfg.stageDot)} />
            {STAGE_LABELS[deal.status]}
          </span>
        </div>

        {/* Probability meter */}
        <div className="mt-2.5 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-none", cfg.probColor)}
              style={{ width: `${deal.probability}%` }}
            />
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground shrink-0 tabular-nums">
            {deal.probability}%
          </span>
          <TrendingUp className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
        </div>

      </div>
    </div>
  )
}

// ─── Sortable DealCard ────────────────────────────────────────────────────────

export function DealCard({ deal, onClick, overlay = false }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id })

  const style = { transform: CSS.Transform.toString(transform), transition }
  const cfg = STAGE_CONFIG[deal.status] ?? STAGE_CONFIG.lead

  if (overlay) {
    return (
      <div className={cn(
        "rounded-md border overflow-hidden shadow-2xl rotate-1 scale-105 ring-2 ring-primary/40",
        cfg.cardBg, cfg.cardBorder,
      )}>
        <DealCardContent deal={deal} />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "rounded-md border overflow-hidden cursor-grab active:cursor-grabbing select-none transition-colors",
        cfg.cardBg,
        cfg.cardBorder,
        cfg.cardHoverBorder,
        cfg.accentGlow,
        isDragging && "opacity-20 scale-95",
      )}
    >
      <DealCardContent deal={deal} />
    </div>
  )
}
