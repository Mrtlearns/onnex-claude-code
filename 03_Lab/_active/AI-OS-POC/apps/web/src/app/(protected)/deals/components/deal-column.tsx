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

interface DealColumnProps {
  status: DealStatus
  deals: Deal[]
  onDealClick: (deal: Deal) => void
}

export function DealColumn({ status, deals, onDealClick }: DealColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      data-testid={`column-${status}`}
      className={cn(
        "flex-shrink-0 w-72 rounded-lg bg-muted/50 p-3",
        isOver && "ring-2 ring-primary",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{STAGE_LABELS[status]}</h3>
        <Badge variant="secondary">{deals.length}</Badge>
      </div>
      <SortableContext items={deals.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[40px]">
          {deals.map(deal => (
            <DealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal)} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}
