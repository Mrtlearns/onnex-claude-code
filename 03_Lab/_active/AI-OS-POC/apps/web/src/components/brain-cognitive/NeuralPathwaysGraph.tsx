"use client"

// ─────────────────────────────────────────────────────────────────────────────
// NeuralPathwaysGraph — SVG force-directed graph (no external deps)
// DEV NOTE: Part of the brain-cognitive feature module. Safe to remove.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from "react"
import type { BrainEntity, BrainGraphData } from "./types"

const ENTITY_COLORS: Record<string, string> = {
  Person:       "#60a5fa",
  Organization: "#34d399",
  Location:     "#f97316",
  Concept:      "#a78bfa",
  Technology:   "#fb7185",
  Document:     "#fbbf24",
  Tool:         "#38bdf8",
  Event:        "#e879f9",
  default:      "#94a3b8",
}

interface NodePos {
  id: string
  x: number
  y: number
  vx: number
  vy: number
}

function runForceLayout(
  entities: BrainEntity[],
  links: { source: string; target: string }[],
  width: number,
  height: number,
  iterations = 200,
): Map<string, { x: number; y: number }> {
  if (!entities.length) return new Map()

  const cx = width / 2
  const cy = height / 2
  const REPULSION  = 5000
  const SPRING     = 0.05
  const LINK_DIST  = Math.max(80, Math.min(160, 600 / Math.sqrt(entities.length)))
  const DAMPING    = 0.78

  const pos: NodePos[] = entities.map((e, i) => {
    const angle = (i / entities.length) * Math.PI * 2
    const r = Math.min(width, height) * 0.28
    return { id: e.id, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, vx: 0, vy: 0 }
  })

  for (let iter = 0; iter < iterations; iter++) {
    // Coulomb repulsion
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].x - pos[i].x
        const dy = pos[j].y - pos[i].y
        const d2 = dx * dx + dy * dy + 1
        const d  = Math.sqrt(d2)
        const f  = REPULSION / d2
        pos[i].vx -= (dx / d) * f
        pos[i].vy -= (dy / d) * f
        pos[j].vx += (dx / d) * f
        pos[j].vy += (dy / d) * f
      }
    }

    // Hooke attraction along edges
    const idxMap = new Map(pos.map((p, i) => [p.id, i]))
    for (const link of links) {
      const si = idxMap.get(link.source)
      const ti = idxMap.get(link.target)
      if (si == null || ti == null) continue
      const dx   = pos[ti].x - pos[si].x
      const dy   = pos[ti].y - pos[si].y
      const d    = Math.sqrt(dx * dx + dy * dy) || 1
      const disp = (d - LINK_DIST) * SPRING
      const fx   = (dx / d) * disp
      const fy   = (dy / d) * disp
      pos[si].vx += fx; pos[si].vy += fy
      pos[ti].vx -= fx; pos[ti].vy -= fy
    }

    // Center gravity + integrate
    for (const p of pos) {
      p.vx += (cx - p.x) * 0.004
      p.vy += (cy - p.y) * 0.004
      p.vx *= DAMPING; p.vy *= DAMPING
      p.x += p.vx; p.y += p.vy
      p.x = Math.max(28, Math.min(width  - 28, p.x))
      p.y = Math.max(28, Math.min(height - 28, p.y))
    }
  }

  return new Map(pos.map((p) => [p.id, { x: p.x, y: p.y }]))
}

interface NeuralPathwaysGraphProps {
  data: BrainGraphData | null
  selectedEntityId: string | null
  onSelectEntity: (entity: BrainEntity | null) => void
  className?: string
}

export function NeuralPathwaysGraph({
  data,
  selectedEntityId,
  onSelectEntity,
  className,
}: NeuralPathwaysGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 760, h: 440 })
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map())

  // Resize observer
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 10 && height > 10) setDims({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Re-compute layout when data or dims change
  useEffect(() => {
    if (!data?.entities.length) { setPositions(new Map()); return }
    const pos = runForceLayout(data.entities, data.links, dims.w, dims.h)
    setPositions(pos)
  }, [data, dims])

  const entities    = data?.entities ?? []
  const links       = data?.links    ?? []
  const entityMap   = new Map(entities.map((e) => [e.id, e]))

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGGElement>, entity: BrainEntity) => {
      e.stopPropagation()
      onSelectEntity(entity.id === selectedEntityId ? null : entity)
    },
    [selectedEntityId, onSelectEntity],
  )

  const isEmpty = !entities.length

  return (
    <div ref={containerRef} className={`relative w-full h-full ${className ?? ""}`}>
      {isEmpty && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
          No entity graph data — run a RAG ingest to populate.
        </div>
      )}
      <svg
        width="100%"
        height="100%"
        onClick={() => onSelectEntity(null)}
        aria-label="Neural pathways knowledge graph"
      >
        {/* Edge layer */}
        <g>
          {links.map((link, i) => {
            const s = positions.get(link.source)
            const t = positions.get(link.target)
            if (!s || !t) return null
            return (
              <line
                key={i}
                x1={s.x} y1={s.y}
                x2={t.x} y2={t.y}
                stroke="hsl(var(--muted-foreground))"
                strokeOpacity={0.25}
                strokeWidth={1}
              />
            )
          })}
        </g>

        {/* Edge label layer (rel_type on hover — kept simple with title) */}
        <g>
          {links.map((link, i) => {
            const s = positions.get(link.source)
            const t = positions.get(link.target)
            if (!s || !t) return null
            const mx = (s.x + t.x) / 2
            const my = (s.y + t.y) / 2
            return (
              <text
                key={i}
                x={mx} y={my}
                textAnchor="middle"
                fontSize={8}
                fill="hsl(var(--muted-foreground))"
                opacity={0.45}
                className="select-none pointer-events-none"
              >
                {link.rel_type}
              </text>
            )
          })}
        </g>

        {/* Node layer */}
        <g>
          {entities.map((entity) => {
            const pos = positions.get(entity.id)
            if (!pos) return null
            const color      = ENTITY_COLORS[entity.entity_type] ?? ENTITY_COLORS.default
            const isSelected = entity.id === selectedEntityId
            const r          = isSelected ? 12 : 8

            return (
              <g
                key={entity.id}
                transform={`translate(${pos.x},${pos.y})`}
                onClick={(e) => handleClick(e, entity)}
                style={{ cursor: "pointer" }}
                role="button"
                aria-label={entity.name}
              >
                {isSelected && (
                  <circle r={20} fill={color} opacity={0.15} />
                )}
                <circle
                  r={r}
                  fill={color}
                  opacity={0.88}
                  stroke={isSelected ? "white" : "transparent"}
                  strokeWidth={2}
                />
                <text
                  dy={r + 13}
                  textAnchor="middle"
                  fontSize={9}
                  fill="hsl(var(--foreground))"
                  opacity={0.7}
                  className="select-none pointer-events-none"
                >
                  {entity.name.length > 14 ? entity.name.slice(0, 13) + "…" : entity.name}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {Object.entries(ENTITY_COLORS)
          .filter(([k]) => k !== "default")
          .map(([type, color]) => (
            <span key={type} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {type}
            </span>
          ))}
      </div>
    </div>
  )
}
