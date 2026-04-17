"use client"

import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import type { Deal, DealStatus } from "@/types/api"
import { DealColumn } from "./deal-column"
import { DealDetailSheet } from "./deal-detail-sheet"
import { DealForm } from "./deal-form"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Plus } from "lucide-react"

const PIPELINE_STAGES: DealStatus[] = ["lead", "qualified", "proposal", "negotiation"]

export function DealsPipeline() {
  const qc = useQueryClient()
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [showNewDealSheet, setShowNewDealSheet] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const { data: allDeals = [] } = useQuery<Deal[]>({
    queryKey: ["deals"],
    queryFn: () => fetch("/api/bff/deals").then(r => r.json()),
    staleTime: 60_000,
  })

  const pipelineDeals = useMemo(
    () => allDeals.filter(d => PIPELINE_STAGES.includes(d.status)),
    [allDeals],
  )

  const weightedTotal = useMemo(
    () =>
      pipelineDeals.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0),
    [pipelineDeals],
  )

  const { mutate: updateStage } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DealStatus }) =>
      fetch(`/api/bff/deals/${id}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, stage: status }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const newStatus = over.id as DealStatus
    if (!PIPELINE_STAGES.includes(newStatus)) return
    updateStage({ id: active.id as string, status: newStatus })
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold">Deals Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              ${weightedTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>{" "}
            weighted
          </p>
        </div>
        <Button size="sm" onClick={() => setShowNewDealSheet(true)}>
          <Plus className="h-4 w-4 mr-1" />
          New Deal
        </Button>
      </div>

      {/* Kanban board */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map(status => (
            <DealColumn
              key={status}
              status={status}
              deals={pipelineDeals.filter(d => d.status === status)}
              onDealClick={setSelectedDeal}
            />
          ))}
        </div>
      </DndContext>

      {/* Deal detail sheet */}
      {selectedDeal && (
        <DealDetailSheet
          deal={selectedDeal}
          open={!!selectedDeal}
          onOpenChange={(open) => { if (!open) setSelectedDeal(null) }}
        />
      )}

      {/* New deal sheet */}
      <Sheet open={showNewDealSheet} onOpenChange={setShowNewDealSheet}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Deal</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            <DealForm
              onSuccess={() => setShowNewDealSheet(false)}
              onCancel={() => setShowNewDealSheet(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
