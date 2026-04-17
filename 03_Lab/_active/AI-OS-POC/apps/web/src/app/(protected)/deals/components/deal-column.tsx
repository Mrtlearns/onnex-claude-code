"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import type { Deal, DealStatus } from "@/types/api"
import { DealCard } from "./deal-card"
import { Badge } from "@/components/ui/badge"

const STAGE_LABELS: Record<DealStatus, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
}

// Per-stage column colors matching task kanban aesthetic
const STAGE_CONFIG: Record<DealStatus, { bg: string; headerColor: string; ring: string; dot: string }> = {
  lead:        { bg: "bg-blue-950/90",    headerColor: "text-blue-300",    ring: "ring-blue-500",    dot: "bg-blue-500" },
  qualified:   { bg: "bg-violet-950/90",  headerColor: "text-violet-300",  ring: "ring-violet-500",  dot: "bg-violet-500" },
  proposal:    { bg: "bg-amber-950/90",   headerColor: "text-amber-300",   ring: "ring-amber-500",   dot: "bg-amber-500" },
  negotiation: { bg: "bg-orange-950/90",  headerColor: "text-orange-300",  ring: "ring-orange-500",  dot: "bg-orange-500" },
  won:         { bg: "bg-emerald-950/90", headerColor: "text-emerald-300", ring: "ring-emerald-500", dot: "bg-emerald-500" },
  lost:        { bg: "bg-slate-900/90",   headerColor: "text-slate-400",   ring: "ring-slate-500",   dot: "bg-slate-600" },
}

interface DealColumnProps {
  status: DealStatus
  deals: Deal[]
  onDealClick: (deal: Deal) => void
}

export function DealColumn({ status, deals, onDealClick }: DealColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const cfg = STAGE_CONFIG[status] ?? STAGE_CONFIG.lead

  return (
    <div
      ref={setNodeRef}
      data-testid={`column-${status}`}
      className={cn(
        "flex-shrink-0 w-72 rounded-xl p-3 border border-white/5",
        cfg.bg,
        isOver && `ring-2 ${cfg.ring}`,
      )}
    >
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />
          <h3 className={cn("font-semibold text-sm", cfg.headerColor)}>{STAGE_LABELS[status]}</h3>
        </div>
        <Badge variant="secondary" className="text-xs h-5 px-1.5">{deals.length}</Badge>
      </div>
      <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[2rem]">
          {deals.map(deal => (
            <DealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal)} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
