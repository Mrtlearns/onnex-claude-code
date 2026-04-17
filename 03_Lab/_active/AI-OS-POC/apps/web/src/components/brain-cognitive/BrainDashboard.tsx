"use client"

// ─────────────────────────────────────────────────────────────────────────────
// BrainDashboard — root component for the BRAIN Cognitive Architecture view
// DEV NOTE: Part of the brain-cognitive feature module. Safe to remove.
//
// Data flow:
//   BFF /api/bff/brain-cognitive/graph        → entities + links (KG)
//   BFF /api/bff/brain-cognitive/jobs         → recent brain job runs
//   BFF /api/bff/brain-cognitive/embed-status → embedding model status
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react"
import { NeuralPathwaysGraph }  from "./NeuralPathwaysGraph"
import { EntityInspector }      from "./EntityInspector"
import { SynapticStream }       from "./SynapticStream"
import { MetricsPanel }         from "./MetricsPanel"
import { MemorySectors }        from "./MemorySectors"
import type { BrainEntity, BrainGraphData, BrainJobRun, BrainMetrics, EmbedStatus } from "./types"

const POLL_INTERVAL_MS = 30_000

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json() as Promise<T>
}

export function BrainDashboard() {
  const [graphData,    setGraphData]    = useState<BrainGraphData | null>(null)
  const [jobs,         setJobs]         = useState<BrainJobRun[]>([])
  const [embedStatus,  setEmbedStatus]  = useState<EmbedStatus | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<BrainEntity | null>(null)

  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const loadData = useCallback(async () => {
    try {
      const [graph, jobList, embed] = await Promise.allSettled([
        fetchJson<BrainGraphData>("/api/bff/brain-cognitive/graph"),
        fetchJson<BrainJobRun[]>("/api/bff/brain-cognitive/jobs"),
        fetchJson<EmbedStatus>("/api/bff/brain-cognitive/embed-status"),
      ])

      if (!mounted.current) return

      if (graph.status       === "fulfilled") setGraphData(graph.value)
      if (jobList.status     === "fulfilled") setJobs(jobList.value)
      if (embed.status       === "fulfilled") setEmbedStatus(embed.value)
      if (graph.status       === "rejected")  setError("Graph unavailable")

    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Load failed")
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  // Initial load + polling
  useEffect(() => {
    loadData()
    const id = setInterval(loadData, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [loadData])

  // Compute metrics from loaded data
  const entityTypes = (graphData?.entities ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.entity_type] = (acc[e.entity_type] ?? 0) + 1
    return acc
  }, {})

  const metrics: BrainMetrics | null = graphData
    ? {
        totalEntities: graphData.entities.length,
        totalLinks:    graphData.links.length,
        entityTypes,
        recentJobs:    jobs,
        embedStatus,
      }
    : null

  if (error && !graphData) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <p>{error} — check API connectivity.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">

      {/* Row 1: Metrics */}
      <MetricsPanel metrics={metrics} loading={loading} />

      {/* Row 2: Main canvas + Inspector + Stream */}
      <div className="flex flex-1 min-h-0 gap-4">

        {/* Neural Pathways Graph */}
        <div className="flex-1 min-w-0 rounded-lg border bg-card relative overflow-hidden">
          <div className="absolute top-2 left-3 text-[10px] uppercase tracking-wider text-muted-foreground z-10">
            Neural Pathways
          </div>
          <NeuralPathwaysGraph
            data={graphData}
            selectedEntityId={selectedEntity?.id ?? null}
            onSelectEntity={setSelectedEntity}
          />
        </div>

        {/* Right column: Inspector + Stream */}
        <div className="flex flex-col gap-4 w-64 shrink-0">

          {/* Entity Inspector */}
          <div className="flex-1 min-h-0 rounded-lg border bg-card p-3 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Entity Inspector
            </p>
            <EntityInspector
              entity={selectedEntity}
              links={graphData?.links ?? []}
              entities={graphData?.entities ?? []}
            />
          </div>

          {/* Synaptic Stream */}
          <div className="h-48 shrink-0 rounded-lg border bg-card p-3 overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Synaptic Stream
            </p>
            <SynapticStream jobs={jobs} loading={loading && !jobs.length} />
          </div>
        </div>
      </div>

      {/* Row 3: Memory Sectors */}
      <div className="rounded-lg border bg-card p-3 shrink-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Memory Sectors
        </p>
        <MemorySectors
          entityTypes={entityTypes}
          total={graphData?.entities.length ?? 0}
        />
      </div>
    </div>
  )
}
