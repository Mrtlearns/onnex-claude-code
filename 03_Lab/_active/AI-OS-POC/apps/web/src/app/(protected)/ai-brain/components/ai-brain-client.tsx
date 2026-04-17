"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Session } from "next-auth"
import { Brain, Cpu, Plus } from "lucide-react"
import type { Sop } from "@/types/api"
import { SopCard } from "./sop-card"
import { SopForm } from "./sop-form"
import { JobRunsPanel, type BrainJobRun } from "./job-runs-panel"

interface AiBrainClientProps {
  session: Session | null
}

export function AiBrainClient({ session: _session }: AiBrainClientProps) {
  const qc = useQueryClient()
  const [runningSops, setRunningSops] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editingSop, setEditingSop] = useState<Sop | undefined>(undefined)

  const { data: sops = [] } = useQuery<Sop[]>({
    queryKey: ["brain-sops"],
    queryFn: () => fetch("/api/bff/brain/sops").then((r) => r.json()),
  })

  const { data: jobs = [], isFetching, refetch } = useQuery<BrainJobRun[]>({
    queryKey: ["brain-jobs"],
    queryFn: () => fetch("/api/bff/brain/jobs").then((r) => r.json()),
    refetchInterval: 5000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bff/brain/sops/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brain-sops"] })
      toast.success("SOP deleted")
    },
    onError: () => toast.error("Failed to delete SOP"),
  })

  const runSop = async (slug: string, inputContext?: string) => {
    setRunningSops((prev) => new Set(prev).add(slug))
    try {
      const res = await fetch("/api/bff/brain/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sop_slug: slug, input_context: inputContext }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Request failed (${res.status})`)
      }

      await qc.invalidateQueries({ queryKey: ["brain-jobs"] })
      toast.success("SOP completed successfully")
    } catch (err) {
      const message = err instanceof Error ? err.message : "SOP run failed"
      toast.error(message)
      await qc.invalidateQueries({ queryKey: ["brain-jobs"] })
    } finally {
      setRunningSops((prev) => {
        const next = new Set(prev)
        next.delete(slug)
        return next
      })
    }
  }

  const handleEdit = (sop: Sop) => {
    setEditingSop(sop)
    setFormOpen(true)
  }

  const handleDelete = (sop: Sop) => {
    if (confirm(`Delete "${sop.title}"? This cannot be undone.`)) {
      deleteMutation.mutate(sop.id)
    }
  }

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) setEditingSop(undefined)
  }

  const manualSops = sops.filter((s) => !s.auto)
  const autoSops = sops.filter((s) => s.auto)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15 ring-1 ring-purple-500/30">
          <Brain className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">AI Brain</h1>
          <p className="text-sm text-muted-foreground">Run SOPs and automate agency operations</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* Left: SOP Library */}
        <div className="flex flex-col gap-5">
          {/* Manual SOPs */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Manual SOPs</h2>
              <span className="ml-auto text-xs text-muted-foreground">{manualSops.length} sop{manualSops.length !== 1 ? "s" : ""}</span>
              <button
                onClick={() => { setEditingSop(undefined); setFormOpen(true) }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-purple-400 hover:bg-purple-500/10 transition-colors"
                title="New SOP"
              >
                <Plus className="h-3.5 w-3.5" />
                New SOP
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {manualSops.map((sop) => (
                <SopCard
                  key={sop.id}
                  sop={sop}
                  onRun={runSop}
                  isRunning={runningSops.has(sop.slug)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
              {manualSops.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No manual SOPs yet. Create one above.</p>
              )}
            </div>
          </section>

          {/* Scheduled / Auto SOPs */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-foreground">Scheduled SOPs</h2>
              <span className="ml-auto text-xs text-muted-foreground">{autoSops.length} sop{autoSops.length !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">These run on a schedule (cron in Phase 2). Trigger manually below.</p>
            <div className="flex flex-col gap-3">
              {autoSops.map((sop) => (
                <SopCard
                  key={sop.id}
                  sop={sop}
                  onRun={runSop}
                  isRunning={runningSops.has(sop.slug)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Right: Job Runs */}
        <div>
          <JobRunsPanel
            jobs={jobs}
            isLoading={isFetching}
            onRefresh={() => refetch()}
          />
        </div>
      </div>

      <SopForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        sop={editingSop}
      />
    </div>
  )
}
