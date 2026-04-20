"use client"

import { memo } from "react"
import { useDroppable } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { cn } from "@/lib/utils"
import type { Project } from "@/types/api"
import { ProjectKanbanCard } from "./project-kanban-card"
import { Badge } from "@/components/ui/badge"

type ProjectStatus = "Active" | "On Hold" | "Completed"

interface ProjectKanbanColumnProps {
  status: ProjectStatus
  projects: Project[]
  onProjectClick: (p: Project) => void
}

const COLUMN_CONFIG: Record<ProjectStatus, {
  bg: string
  headerColor: string
  ring: string
  dot: string
}> = {
  Active: {
    bg:          "bg-blue-950/60",
    headerColor: "text-blue-300",
    ring:        "ring-blue-500",
    dot:         "bg-blue-500",
  },
  "On Hold": {
    bg:          "bg-amber-950/60",
    headerColor: "text-amber-300",
    ring:        "ring-amber-500",
    dot:         "bg-amber-500",
  },
  Completed: {
    bg:          "bg-emerald-950/60",
    headerColor: "text-emerald-300",
    ring:        "ring-emerald-500",
    dot:         "bg-emerald-500",
  },
}

export const ProjectKanbanColumn = memo(function ProjectKanbanColumn({
  status,
  projects,
  onProjectClick,
}: ProjectKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const cfg = COLUMN_CONFIG[status] ?? COLUMN_CONFIG.Active

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-80 rounded-xl p-3 border border-white/5",
        cfg.bg,
        isOver && `ring-2 ${cfg.ring}`,
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", cfg.dot)} />
          <h3 className={cn("font-semibold text-sm", cfg.headerColor)}>{status}</h3>
        </div>
        <Badge variant="secondary" className="text-xs h-5 px-1.5">
          {projects.length}
        </Badge>
      </div>

      {/* Cards */}
      <SortableContext items={projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[2rem]">
          {projects.map(project => (
            <ProjectKanbanCard
              key={project.id}
              project={project}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  )
})
