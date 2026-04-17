"use client"
// apps/web/src/app/(protected)/ai/knowledge-graph/components/kg-page-client.tsx
// KG Explorer — entity list + force-graph visualization + detail panel

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { Session } from "next-auth"
import type { KgEntity, KgEntityDetail, KgLink } from "@/types/api"
import { KgEntityList } from "./kg-entity-list"
import { KgEntityPanel } from "./kg-entity-panel"
import { KgGraph } from "./kg-graph"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Network, List } from "lucide-react"

interface Props { session: Session | null }

const SCOPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "GDrive-Sync/04 Clients", label: "04 Clients" },
  { value: "GDrive-Sync/04 Clients/NDT Non Destructive Testing", label: "NDT" },
  { value: "GDrive-Sync/04 Clients/THIMS", label: "THIMS" },
  { value: "GDrive-Sync/04 Clients/Total Foot Care", label: "TFCWC" },
  { value: "GDrive-Sync/04 Clients/Airgap Labs", label: "Airgap Labs" },
  { value: "GDrive-Sync/02 Agents", label: "02 Agents" },
  { value: "GDrive-Sync/03 Articles", label: "03 Articles" },
]

export function KgPageClient({ session: _session }: Props) {
  const [scope, setScope] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [q, setQ] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const qs = new URLSearchParams()
  if (scope) qs.set("scope", scope)
  if (typeFilter) qs.set("type", typeFilter)
  if (q) qs.set("q", q)
  qs.set("limit", "300")

  const { data: graphData, isLoading, isError, error } = useQuery<{ entities: KgEntity[]; links: KgLink[] }>({
    queryKey: ["kg-entities", scope, typeFilter, q],
    queryFn: async () => {
      const r = await fetch(`/api/bff/rag/graph?${qs}`)
      if (!r.ok) throw new Error(`KG API ${r.status}`)
      return r.json()
    },
    staleTime: 60_000,
  })

  const { data: detailData } = useQuery<KgEntityDetail>({
    queryKey: ["kg-entity", selectedId],
    queryFn: () => fetch(`/api/bff/rag/graph/entity/${selectedId}`).then((r) => r.json()),
    enabled: !!selectedId,
    staleTime: 60_000,
  })

  const entities = graphData?.entities ?? []
  const links = graphData?.links ?? []

  return (
    <div className="flex h-full flex-col gap-0">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Knowledge Graph</h1>
          <p className="text-sm text-muted-foreground mt-0.5" suppressHydrationWarning>
            {entities.length} entities extracted from Nextcloud documents
          </p>
        </div>
        {/* Scope filter */}
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="text-sm border rounded-md px-2 py-1.5 bg-background"
        >
          {SCOPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {isError && (
        <div className="px-6 py-2 text-sm text-destructive bg-destructive/10 border-b">
          KG unavailable: {(error as Error)?.message}
        </div>
      )}

      {/* Body: two-panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: list */}
        <div className="w-72 border-r flex flex-col shrink-0">
          <KgEntityList
            entities={entities}
            isLoading={isLoading}
            selectedId={selectedId}
            typeFilter={typeFilter}
            q={q}
            onSelectType={setTypeFilter}
            onQueryChange={setQ}
            onSelect={setSelectedId}
          />
        </div>

        {/* Center: graph or detail */}
        <div className="flex flex-1 overflow-hidden">
          <Tabs defaultValue="graph" className="flex flex-1 flex-col">
            <div className="border-b px-4 py-2">
              <TabsList className="h-8">
                <TabsTrigger value="graph" className="gap-1.5 text-xs">
                  <Network className="h-3.5 w-3.5" />
                  Graph
                </TabsTrigger>
                <TabsTrigger value="detail" className="gap-1.5 text-xs" disabled={!selectedId}>
                  <List className="h-3.5 w-3.5" />
                  Detail
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="graph" className="flex-1 m-0">
              <KgGraph entities={entities} links={links} selectedId={selectedId} onSelect={setSelectedId} />
            </TabsContent>
            <TabsContent value="detail" className="flex-1 m-0 overflow-y-auto p-4">
              {detailData ? (
                <KgEntityPanel detail={detailData} onSelectEntity={setSelectedId} />
              ) : (
                <p className="text-sm text-muted-foreground">Select an entity to see details.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
