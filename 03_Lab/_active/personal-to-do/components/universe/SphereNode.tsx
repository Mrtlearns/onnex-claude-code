'use client'

import { Node } from '@/db/schema'
import { computeStatus, getStatusGlow, getStatusColor } from '@/lib/aging'

const NODE_SIZES: Record<string, number> = {
  note: 60,
  task: 65,
  idea: 70,
  reference: 60,
  person: 75,
  project: 90,
}

const NODE_GRADIENT_COLORS: Record<string, string[]> = {
  note: ['#93c5fd', '#3b82f6'],
  task: ['#86efac', '#22c55e'],
  idea: ['#fde68a', '#f59e0b'],
  reference: ['#c4b5fd', '#8b5cf6'],
  person: ['#fdba74', '#f97316'],
  project: ['#f9a8d4', '#ec4899'],
}

interface SphereNodeProps {
  node: Node
  screenX: number
  screenY: number
  isSelected: boolean
  artifactCount?: number
  dueGlow?: string | null
  onClick: () => void
  onDragStart: (e: React.MouseEvent) => void
  onDoubleClick: () => void
}

export default function SphereNode({
  node, screenX, screenY, isSelected,
  artifactCount = 0, dueGlow,
  onClick, onDragStart, onDoubleClick,
}: SphereNodeProps) {
  const baseSize = NODE_SIZES[node.type] ?? 60
  const size = baseSize + Math.min(artifactCount * 5, 40)

  const status = computeStatus(node.last_accessed_at)

  // Due-date urgency overrides status glow
  const glowColor = dueGlow ?? getStatusColor(status)
  const isOverdue = dueGlow === '#ef4444'

  const glow = isSelected
    ? `0 0 30px 10px ${glowColor}, 0 0 60px 20px ${glowColor}40`
    : dueGlow
      ? `0 0 18px 6px ${dueGlow}cc, 0 0 36px 12px ${dueGlow}55`
      : getStatusGlow(status)

  const colors = dueGlow
    ? [lighten(dueGlow), dueGlow]
    : (NODE_GRADIENT_COLORS[node.type] ?? ['#93c5fd', '#3b82f6'])

  return (
    <div
      style={{
        position: 'absolute',
        left: screenX - size / 2,
        top: screenY - size / 2,
        width: size,
        height: size,
        zIndex: isSelected ? 10 : 1,
        cursor: 'pointer',
      }}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e) }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
    >
      {/* Sphere */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${colors[0]}, ${colors[1]})`,
          boxShadow: glow,
          transition: isOverdue ? 'none' : 'box-shadow 0.3s ease, transform 0.2s ease',
          transform: isSelected ? 'scale(1.2)' : 'scale(1)',
          position: 'relative',
          animation: isOverdue ? 'sphere-pulse 1.5s ease-in-out infinite' : undefined,
        }}
      >
        {/* Inner highlight */}
        <div style={{
          position: 'absolute',
          top: '15%',
          left: '20%',
          width: '35%',
          height: '25%',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.35)',
          filter: 'blur(3px)',
          pointerEvents: 'none',
        }} />

        {/* Type icon */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.3,
          userSelect: 'none',
        }}>
          {getTypeEmoji(node.type)}
        </div>
      </div>

      {/* Label */}
      <div
        style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: 6,
          whiteSpace: 'nowrap',
          maxWidth: 120,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 6,
          padding: '2px 8px',
          fontSize: 11,
          color: 'rgba(255,255,255,0.9)',
          fontWeight: 500,
          userSelect: 'none',
          textAlign: 'center',
        }}
      >
        {node.title}
      </div>

      <style>{`
        @keyframes sphere-pulse {
          0%, 100% { box-shadow: 0 0 18px 6px #ef4444cc, 0 0 36px 12px #ef444455; }
          50% { box-shadow: 0 0 30px 12px #ef4444ff, 0 0 60px 24px #ef444488; }
        }
      `}</style>
    </div>
  )
}

/** Lighten a hex color by mixing with white ~30% */
function lighten(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lr = Math.round(r + (255 - r) * 0.45)
  const lg = Math.round(g + (255 - g) * 0.45)
  const lb = Math.round(b + (255 - b) * 0.45)
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`
}

function getTypeEmoji(type: string): string {
  const map: Record<string, string> = {
    note: '📝',
    task: '✅',
    idea: '💡',
    reference: '🔗',
    person: '👤',
    project: '📁',
  }
  return map[type] ?? '⚪'
}
