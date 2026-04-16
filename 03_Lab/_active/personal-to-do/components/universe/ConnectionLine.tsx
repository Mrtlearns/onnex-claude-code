'use client'

import { Edge } from '@/db/schema'

interface ConnectionLineProps {
  edge: Edge
  x1: number
  y1: number
  x2: number
  y2: number
}

const EDGE_COLORS: Record<string, string> = {
  relates_to: 'rgba(148, 163, 184, 0.4)',
  depends_on: 'rgba(59, 130, 246, 0.5)',
  blocks: 'rgba(239, 68, 68, 0.5)',
  part_of: 'rgba(34, 197, 94, 0.4)',
  caused_by: 'rgba(249, 115, 22, 0.5)',
}

export default function ConnectionLine({ edge, x1, y1, x2, y2 }: ConnectionLineProps) {
  const color = EDGE_COLORS[edge.type] ?? EDGE_COLORS.relates_to
  const strokeWidth = Math.max(1, edge.strength * 3)

  // Mid-point for label
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  return (
    <>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        style={{ transition: 'stroke 0.3s' }}
      />
      {edge.label && (
        <text
          x={midX}
          y={midY - 4}
          textAnchor="middle"
          fill="rgba(255,255,255,0.4)"
          fontSize={10}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {edge.label}
        </text>
      )}
    </>
  )
}
