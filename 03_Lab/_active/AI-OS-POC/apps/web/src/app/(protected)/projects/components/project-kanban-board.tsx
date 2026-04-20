"use client"

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from "@dnd-kit/core"
import { useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useMemo } from "react"
import type { Project } from "@/types/api"
import { ProjectKanbanColumn } from "./project-kanban-column"
import { ProjectCardContent } from "./project-kanban-card"
import { cn } from "@/lib/utils"

type ProjectStatus = "Onboarding" | "On Hold" | "Active" | "Completed"

const COLUMNS: ProjectStatus[] = ["Onboarding", "On Hold", "Active", "Completed"]
const VALID_STATUSES = new Set<string>(COLUMNS)

// Prefer pointer-within for column targets, fall back to rect-intersection
const collisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return pointerCollisions
  return rectIntersection(args)
}

function OverlayCard({ project }: { project: Project }) {
  return (
    <div
      className={cn(
        "rounded-md border shadow-2xl rotate-1 scale-105",
        "bg-slate-800 border-slate-600",
        "ring-2 ring-primary/40",
        "w-80 overflow-hidden",
      )}
    >
      <ProjectCardContent project={project} overlay />
    </div>
  )
}

export function ProjectKanbanBoard({ projects }: { projects: Project[] }) {
  const qc = useQueryClient()
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [optimisticStatus, setOptimisticStatus] = useState<Record<string, ProjectStatus>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Merge optimistic overrides for immediate visual feedback
  const displayProjects = useMemo(
    () => projects.map(p =>
      optimisticStatus[p.id] ? { ...p, status: optimisticStatus[p.id] } : p
    ),
    [projects, optimisticStatus],
  )

  const columnProjects = useMemo(() => {
    const map: Record<ProjectStatus, Project[]> = { Onboarding: [], "On Hold": [], Active: [], Completed: [] }
    for (const p of displayProjects) {
      const s = p.status as ProjectStatus
      if (map[s]) map[s].push(p)
    }
    return map
  }, [displayProjects])

  const updateStatus = useCallback(async (id: string, status: ProjectStatus) => {
    setOptimisticStatus(prev => ({ ...prev, [id]: status }))
    try {
      await fetch(`/api/bff/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      qc.setQueriesData<Project[]>({ queryKey: ["projects"] }, (old) =>
        old ? old.map(p => p.id === id ? { ...p, status } : p) : old
      )
    } catch {
      setOptimisticStatus(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    setOptimisticStatus(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [qc])

  function handleDragStart(event: DragStartEvent) {
    const project = projects.find(p => p.id === event.active.id)
    if (project) setActiveProject(project)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveProject(null)
    const { active, over } = event
    if (!over) return

    let newStatus: ProjectStatus
    if (VALID_STATUSES.has(over.id as string)) {
      newStatus = over.id as ProjectStatus
    } else {
      const targetProject = displayProjects.find(p => p.id === over.id)
      if (!targetProject) return
      newStatus = targetProject.status as ProjectStatus
    }

    const currentProject = displayProjects.find(p => p.id === active.id)
    if (!currentProject || currentProject.status === newStatus) return

    updateStatus(active.id as string, newStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(status => (
          <ProjectKanbanColumn
            key={status}
            status={status}
            projects={columnProjects[status]}
            onProjectClick={() => {
              // click handled inside ProjectKanbanCard via modal
            }}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeProject ? <OverlayCard project={activeProject} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
