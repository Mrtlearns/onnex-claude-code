"use client"
// apps/web/src/app/(protected)/ai/knowledge-graph/components/kg-graph.tsx
// Force-directed graph visualization using react-force-graph (ForceGraph2D).
// next/dynamic with ssr:false prevents hydration mismatch and A-Frame VR module crash.

import dynamic from "next/dynamic"
import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import type { KgEntity, KgLink } from "@/types/api"

interface Props {
  entities: KgEntity[]
  links: KgLink[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const TYPE_COLOR: Record<string, string> = {
  person:   "#60a5fa",
  company:  "#fb923c",
  project:  "#a78bfa",
  concept:  "#fbbf24",
  location: "#34d399",
  date:     "#f87171",
}
const DEFAULT_COLOR = "#94a3b8"

const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0d1117]">
        <p className="text-sm text-slate-400">Loading graph...</p>
      </div>
    ),
  }
)

export function KgGraph({ entities, links, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setDimensions({ width: el.offsetWidth, height: el.offsetHeight })
    })
    ro.observe(el)
    setDimensions({ width: el.offsetWidth, height: el.offsetHeight })
    return () => ro.disconnect()
  }, [])

  const graphData = useMemo(() => ({
    nodes: entities.map((e) => ({
      id: e.id,
      name: e.name,
      entityType: e.entity_type,
      source_count: e.source_count ?? 1,
      color: TYPE_COLOR[e.entity_type?.toLowerCase()] ?? DEFAULT_COLOR,
    })),
    links: links.map((l) => ({
      source: l.source,
      target: l.target,
      label: l.rel_type,
    })),
  }), [entities, links])

  // "after" mode: library draws the default node circle first, we add label + selection ring on top
  const drawNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const r = Math.min(5 + Math.sqrt(node.source_count ?? 1) * 1.5, 15)

    // Selection ring
    if (node.id === selectedId) {
      ctx.beginPath()
      ctx.arc(node.x, node.y, r + 3, 0, 2 * Math.PI)
      ctx.strokeStyle = "#f59e0b"
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Label — visible above zoom 0.4
    if (globalScale < 0.4) return
    const label = (node.name as string).slice(0, 22)
    const fontSize = Math.max(10, 12 / globalScale)
    ctx.font = `${fontSize}px Inter, sans-serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#ffffff"
    ctx.fillText(label, node.x, node.y + r + fontSize * 0.8)
  }, [selectedId])

  const drawEdgeLabel = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (globalScale < 0.8 || !link.label) return
    const start = link.source
    const end = link.target
    if (!start?.x || !end?.x) return
    const mx = (start.x + end.x) / 2
    const my = (start.y + end.y) / 2
    const fontSize = Math.max(7, 9 / globalScale)
    ctx.font = `${fontSize}px Inter, sans-serif`
    ctx.fillStyle = "rgba(200,210,220,0.9)"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(link.label, mx, my)
  }, [])

  const handleNodeClick = useCallback((node: any) => {
    onSelect(node.id)
  }, [onSelect])

  if (entities.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex items-center justify-center bg-[#0d1117]">
        <p className="text-sm text-slate-400">
          No entities to display. Ingest Nextcloud documents to populate the graph.
        </p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0d1117]">
      <ForceGraph2D
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0d1117"
        nodeRelSize={6}
        nodeVal={(n: any) => 5 + Math.sqrt(n.source_count ?? 1) * 1.5}
        nodeColor={(n: any) => n.id === selectedId ? "#f59e0b" : n.color}
        nodeCanvasObjectMode={() => "after"}
        nodeCanvasObject={drawNode}
        linkColor={() => "rgba(255,255,255,0.5)"}
        linkWidth={1.5}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.003}
        linkDirectionalParticleWidth={1.5}
        linkCanvasObjectMode={() => "after"}
        linkCanvasObject={drawEdgeLabel}
        onNodeClick={handleNodeClick}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        cooldownTicks={200}
      />
    </div>
  )
}
