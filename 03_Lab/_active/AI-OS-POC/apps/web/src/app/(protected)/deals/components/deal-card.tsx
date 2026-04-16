"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Deal } from "@/types/api"
import { Badge } from "@/components/ui/badge"

interface DealCardProps {
  deal: Deal
  onClick: () => void
}

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-blue-50 border-blue-200",
  qualified: "bg-purple-50 border-purple-200",
  proposal: "bg-amber-50 border-amber-200",
  negotiation: "bg-orange-50 border-orange-200",
}

export function DealCard({ deal, onClick }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-card p-3 rounded-md shadow-sm cursor-grab active:cursor-grabbing border hover:border-border transition-colors ${STAGE_COLORS[deal.status] ?? ""}`}
    >
      <p className="text-sm font-medium line-clamp-2">{deal.title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        ${deal.value.toLocaleString()}
      </p>
      <div className="flex items-center gap-1 mt-2">
        <Badge variant="secondary" className="text-xs px-1.5 py-0">
          {deal.probability}%
        </Badge>
      </div>
    </div>
  )
}
