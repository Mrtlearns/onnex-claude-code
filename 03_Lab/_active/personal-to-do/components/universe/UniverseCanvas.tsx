'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useUniverseStore } from '@/store/universe'
import type { Node } from '@/db/schema'
import SphereNode from './SphereNode'
import NodePanel from '@/components/node/NodePanel'
import NodeForm from '@/components/node/NodeForm'
import TrashPanel from '@/components/node/TrashPanel'
import GlassButton from '@/components/ui/GlassButton'
import { getDueDateGlow } from '@/lib/urgency'

interface UniverseCanvasProps {
  embedded?: boolean
}

export default function UniverseCanvas({ embedded = false }: UniverseCanvasProps) {
  const {
    nodes, edges, selectedNodeId, focusedNodeId,
    selectNode, setFocusedNode, fetchAll,
    rotation, setRotation,
    canvasScale, setCanvasScale,
    setNodePositionLocal, updateNode,
    artifacts, fetchArtifacts,
    showTrash, setShowTrash,
  } = useUniverseStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const draggingNode = useRef<{
    id: string
    startMouse: { x: number; y: number }
    startPos: { x: number; y: number; z: number }
    hasMoved: boolean
  } | null>(null)
  const suppressNextNodeClick = useRef(false)
  const lastClickRef = useRef<{ id: string; time: number } | null>(null)
  const [focusDragOffsets, setFocusDragOffsets] = useState<Record<string, { x: number; y: number }>>({})
  const focusDragOffsetsRef = useRef<Record<string, { x: number; y: number }>>({})
  const focusPositionsRef = useRef<{ focused: { sx: number; sy: number }; children: { sx: number; sy: number }[] } | null>(null)
  const childNodesRef = useRef<Node[]>([])

  const [showCreate, setShowCreate] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (selectedNodeId) fetchArtifacts(selectedNodeId)
  }, [selectedNodeId, fetchArtifacts])

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    focusDragOffsetsRef.current = {}
    setFocusDragOffsets({})
  }, [focusedNodeId])

  function project(x: number, y: number, z: number): { sx: number; sy: number; scale: number } {
    const cx = rotation.x * (Math.PI / 180)
    const cy = rotation.y * (Math.PI / 180)

    const x1 = x * Math.cos(cy) + z * Math.sin(cy)
    const z1 = -x * Math.sin(cy) + z * Math.cos(cy)

    const y2 = y * Math.cos(cx) - z1 * Math.sin(cx)
    const z2 = y * Math.sin(cx) + z1 * Math.cos(cx)

    const fov = 800
    const perspScale = fov / (fov + z2 + 500)

    const sx = dimensions.width / 2 + x1 * canvasScale * perspScale
    const sy = dimensions.height / 2 + y2 * canvasScale * perspScale

    return { sx, sy, scale: perspScale }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return
    if (focusedNodeId) return // disable canvas rotation in focus mode
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }, [focusedNodeId])

  const handleNodeDragStart = useCallback((e: React.MouseEvent, node: Node) => {
    draggingNode.current = {
      id: node.id,
      startMouse: { x: e.clientX, y: e.clientY },
      startPos: { x: node.x, y: node.y, z: node.z },
      hasMoved: false,
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingNode.current) {
      const dx = e.clientX - draggingNode.current.startMouse.x
      const dy = e.clientY - draggingNode.current.startMouse.y

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        draggingNode.current.hasMoved = true
      }

      if (draggingNode.current.hasMoved) {
        if (focusedNodeId) {
          // Focus mode: track 2D screen-space offset
          const id = draggingNode.current.id
          const updated = { ...focusDragOffsetsRef.current, [id]: { x: dx, y: dy } }
          focusDragOffsetsRef.current = updated
          setFocusDragOffsets(updated)
        } else {
          const { startPos } = draggingNode.current
          const cx = rotation.x * (Math.PI / 180)
          const cy = rotation.y * (Math.PI / 180)

          const z1 = -startPos.x * Math.sin(cy) + startPos.z * Math.cos(cy)
          const z2 = startPos.y * Math.sin(cx) + z1 * Math.cos(cx)
          const perspScale = 800 / (800 + z2 + 500)

          const cosCy = Math.cos(cy)
          const cosCx = Math.cos(cx)
          const dWorldX = dx / (canvasScale * Math.max(Math.abs(cosCy), 0.1) * Math.sign(cosCy || 1) * perspScale)
          const dWorldY = (dy / (canvasScale * perspScale) - dWorldX * Math.sin(cy) * Math.sin(cx)) / (Math.max(Math.abs(cosCx), 0.1) * Math.sign(cosCx || 1))

          setNodePositionLocal(
            draggingNode.current.id,
            startPos.x + dWorldX,
            startPos.y + dWorldY,
            startPos.z,
          )
        }
      }
      return
    }

    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setRotation(rotation.x + dy * 0.3, rotation.y + dx * 0.3)
  }, [rotation, setRotation, setNodePositionLocal, canvasScale, focusedNodeId])

  const handleMouseUp = useCallback(() => {
    if (draggingNode.current?.hasMoved) {
      suppressNextNodeClick.current = true
      const { id, startPos } = draggingNode.current

      if (focusedNodeId && focusPositionsRef.current) {
        const positions = focusPositionsRef.current
        const currentChildNodes = childNodesRef.current
        const isParent = id === focusedNodeId
        const defaultPos = isParent
          ? positions.focused
          : positions.children[currentChildNodes.findIndex((c) => c.id === id)]
        if (defaultPos) {
          const offset = focusDragOffsetsRef.current[id] || { x: 0, y: 0 }
          const newWorldX = (defaultPos.sx + offset.x - dimensions.width / 2) / canvasScale
          const newWorldY = (defaultPos.sy + offset.y - dimensions.height / 2) / canvasScale
          updateNode(id, { x: newWorldX, y: newWorldY })
        }
      } else {
        const currentNode = useUniverseStore.getState().nodes.find((n) => n.id === id)
        if (currentNode) {
          updateNode(id, { x: currentNode.x, y: currentNode.y, z: startPos.z })
        }
      }
    }
    draggingNode.current = null
    isDragging.current = false
  }, [updateNode, focusedNodeId, dimensions, canvasScale])

  const handleCanvasClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  // Single-click → select; double-click (same node within 350ms) → focus
  const handleSphereClick = useCallback((nodeId: string) => {
    if (suppressNextNodeClick.current) {
      suppressNextNodeClick.current = false
      return
    }
    const now = Date.now()
    const last = lastClickRef.current
    if (last && last.id === nodeId && now - last.time < 350) {
      lastClickRef.current = null
      setFocusedNode(nodeId)
      selectNode(nodeId)
    } else {
      lastClickRef.current = { id: nodeId, time: now }
      selectNode(nodeId)
    }
  }, [selectNode, setFocusedNode])

  const handleSphereDoubleClick = useCallback((nodeId: string) => {
    setFocusedNode(nodeId)
    selectNode(nodeId)
  }, [setFocusedNode, selectNode])

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null

  const sortedNodes = [...nodes].sort((a, b) => {
    const pA = project(a.x, a.y, a.z)
    const pB = project(b.x, b.y, b.z)
    return pA.scale - pB.scale
  })

  // ── Focus mode layout ──────────────────────────────────────────────────────
  const focusedNode = focusedNodeId ? nodes.find((n) => n.id === focusedNodeId) : null

  // children: edges where target_id === focusedNodeId and type === 'part_of'
  const childEdges = focusedNodeId
    ? edges.filter((e) => e.target_id === focusedNodeId && e.type === 'part_of')
    : []
  const childNodes = childEdges.map((e) => nodes.find((n) => n.id === e.source_id)).filter(Boolean) as Node[]

  // Fixed 2D positions in focus mode
  function getFocusPositions() {
    const fx = dimensions.width * 0.25
    const fy = dimensions.height / 2
    const cx = dimensions.width * 0.58
    const spacing = Math.min(120, Math.max(64, (dimensions.height - 120) / Math.max(childNodes.length, 1)))
    const midpoint = (childNodes.length - 1) / 2
    return {
      focused: { sx: fx, sy: fy },
      children: childNodes.map((_, i) => ({
        sx: cx,
        sy: fy + (i - midpoint) * spacing,
      })),
    }
  }

  const focusPositions = focusedNode ? getFocusPositions() : null
  focusPositionsRef.current = focusPositions
  childNodesRef.current = childNodes

  // ── Edge rendering (normal mode) ──────────────────────────────────────────
  function renderEdgePaths() {
    return edges.filter((e) => e.type === 'part_of').map((edge) => {
      const src = nodes.find((n) => n.id === edge.source_id)
      const tgt = nodes.find((n) => n.id === edge.target_id)
      if (!src || !tgt) return null

      const { sx, sy } = project(src.x, src.y, src.z)
      const { sx: tx, sy: ty } = project(tgt.x, tgt.y, tgt.z)

      const srcSize = (NODE_SIZES[src.type] ?? 60) + Math.min((artifacts[src.id]?.length ?? 0) * 5, 40)
      const tgtSize = (NODE_SIZES[tgt.type] ?? 60) + Math.min((artifacts[tgt.id]?.length ?? 0) * 5, 40)
      const sr = srcSize / 2
      const tr = tgtSize / 2

      const cpOffset = Math.abs(tx - sx) * 0.45 + 60

      const isPartOf = edge.type === 'part_of'
      const stroke = isPartOf ? 'rgba(99,179,237,0.6)' : 'rgba(148,163,184,0.4)'
      const strokeWidth = isPartOf ? 2.5 : 1.5

      const d = `M ${sx + sr} ${sy} C ${sx + sr + cpOffset} ${sy} ${tx - tr - cpOffset} ${ty} ${tx - tr} ${ty}`

      return (
        <path
          key={edge.id}
          d={d}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />
      )
    })
  }

  // ── Focus mode edge rendering ──────────────────────────────────────────────
  function renderFocusEdges() {
    if (!focusPositions || !focusedNode) return null
    const { focused, children } = focusPositions

    const focusOff = focusDragOffsets[focusedNode.id] || { x: 0, y: 0 }
    const fx = focused.sx + focusOff.x
    const fy = focused.sy + focusOff.y

    const fSize = (NODE_SIZES[focusedNode.type] ?? 60) + Math.min((artifacts[focusedNode.id]?.length ?? 0) * 5, 40)
    const fr = fSize / 2

    return children.map((cPos, i) => {
      const child = childNodes[i]
      const childOff = focusDragOffsets[child.id] || { x: 0, y: 0 }
      const cx = cPos.sx + childOff.x
      const cy = cPos.sy + childOff.y

      const cSize = (NODE_SIZES[child.type] ?? 60) + Math.min((artifacts[child.id]?.length ?? 0) * 5, 40)
      const cr = cSize / 2
      const cpOffset = Math.abs(cx - fx) * 0.45 + 60
      const d = `M ${fx + fr} ${fy} C ${fx + fr + cpOffset} ${fy} ${cx - cr - cpOffset} ${cy} ${cx - cr} ${cy}`
      return (
        <path
          key={i}
          d={d}
          stroke="rgba(99,179,237,0.7)"
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
        />
      )
    })
  }

  const NODE_SIZES: Record<string, number> = {
    note: 60, task: 65, idea: 70, reference: 60, person: 75, project: 90,
  }

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Space canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{
          background: 'radial-gradient(ellipse at center, #0d1117 0%, #020408 100%)',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
      >
        <Stars />

        {/* ── Normal mode ── */}
        {!focusedNode && (
          <>
            {/* Edge bezier lines */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 5 }}
              width={dimensions.width}
              height={dimensions.height}
            >
              {renderEdgePaths()}
            </svg>

            {/* Sphere nodes */}
            {sortedNodes.map((node) => {
              const { sx, sy } = project(node.x, node.y, node.z)
              const artifactCount = artifacts[node.id]?.length ?? 0
              const dueGlow = getDueDateGlow(node.due_date ?? null)
              return (
                <div key={node.id} data-node="true">
                  <SphereNode
                    node={node}
                    screenX={sx}
                    screenY={sy}
                    isSelected={selectedNodeId === node.id}
                    artifactCount={artifactCount}
                    dueGlow={dueGlow}
                    onClick={() => handleSphereClick(node.id)}
                    onDoubleClick={() => handleSphereDoubleClick(node.id)}
                    onDragStart={(e) => handleNodeDragStart(e, node)}
                  />
                </div>
              )
            })}

            {/* Artifact labels + lines for selected node */}
            {selectedNodeId && (() => {
              const selNode = nodes.find((n) => n.id === selectedNodeId)
              if (!selNode) return null
              const { sx, sy } = project(selNode.x, selNode.y, selNode.z)
              const baseSize = NODE_SIZES[selNode.type] ?? 60
              const sphereSize = baseSize + Math.min((artifacts[selectedNodeId]?.length ?? 0) * 5, 40)
              const artifactList = artifacts[selectedNodeId] ?? []
              if (artifactList.length === 0) return null

              const labels = artifactList.map((artifact, i) => {
                const angle = (5 + i * 28) * (Math.PI / 180)
                const dist = sphereSize / 2 + 85
                const lx = sx + Math.cos(angle) * dist
                const ly = sy + Math.sin(angle) * dist
                const label = artifact.artifact_type === 'text'
                  ? (artifact.content ?? '').substring(0, 20) || 'Note'
                  : artifact.artifact_type === 'url'
                    ? (() => { try { return new URL(artifact.content ?? '').hostname } catch { return 'URL' } })()
                    : (artifact.filename ?? 'File').substring(0, 20)
                const icon = artifact.artifact_type === 'image' ? '🖼️'
                  : artifact.artifact_type === 'text' ? '📝'
                  : artifact.artifact_type === 'url' ? '🔗'
                  : artifact.artifact_type === 'voice' ? '🎙️'
                  : '📎'
                return { lx, ly, label, icon }
              })

              return (
                <>
                  <svg
                    className="absolute inset-0 pointer-events-none"
                    style={{ zIndex: 15 }}
                    width={dimensions.width}
                    height={dimensions.height}
                  >
                    {labels.map((l, i) => {
                      const dx = l.lx - sx
                      const dy = l.ly - sy
                      const dist = Math.sqrt(dx * dx + dy * dy) || 1
                      const curve = Math.min(dist * 0.22, 35)
                      const nx = -dy / dist
                      const ny = dx / dist
                      const cp1x = sx + dx * 0.35 + nx * curve
                      const cp1y = sy + dy * 0.35 + ny * curve
                      const cp2x = l.lx - dx * 0.2 + nx * curve * 0.5
                      const cp2y = l.ly - dy * 0.2 + ny * curve * 0.5
                      return (
                        <path key={i}
                          d={`M ${sx} ${sy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${l.lx} ${l.ly}`}
                          stroke="rgba(255,255,255,0.22)" strokeWidth="1" fill="none" strokeLinecap="round" />
                      )
                    })}
                  </svg>
                  {labels.map((l, i) => (
                    <div key={i} className="pointer-events-none" style={{
                      position: 'absolute', left: l.lx, top: l.ly,
                      transform: 'translate(-50%, -50%)', zIndex: 16,
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 6,
                      background: 'rgba(0,0,0,0.65)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      fontSize: 11, color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap',
                    }}>
                      <span style={{ fontSize: 12 }}>{l.icon}</span>
                      <span>{l.label}</span>
                    </div>
                  ))}
                </>
              )
            })()}
          </>
        )}

        {/* ── Focus mode ── */}
        {focusedNode && focusPositions && (
          <>
            {/* Focus mode edge lines */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ zIndex: 5 }}
              width={dimensions.width}
              height={dimensions.height}
            >
              {renderFocusEdges()}
            </svg>

            {/* Focused node */}
            <div data-node="true">
              <SphereNode
                node={focusedNode}
                screenX={focusPositions.focused.sx + (focusDragOffsets[focusedNode.id]?.x ?? 0)}
                screenY={focusPositions.focused.sy + (focusDragOffsets[focusedNode.id]?.y ?? 0)}
                isSelected={selectedNodeId === focusedNode.id}
                artifactCount={artifacts[focusedNode.id]?.length ?? 0}
                dueGlow={getDueDateGlow(focusedNode.due_date ?? null)}
                onClick={() => selectNode(focusedNode.id)}
                onDoubleClick={() => {}}
                onDragStart={(e) => handleNodeDragStart(e, focusedNode)}
              />
            </div>

            {/* Artifact labels for selected node in focus mode */}
            {selectedNodeId && (() => {
              const selNode = nodes.find((n) => n.id === selectedNodeId)
              if (!selNode) return null
              const pos = selectedNodeId === focusedNode.id
                ? focusPositions.focused
                : (() => {
                    const ci = childNodes.findIndex((c) => c.id === selectedNodeId)
                    return ci >= 0 ? focusPositions.children[ci] : null
                  })()
              if (!pos) return null
              const { sx: rawSx, sy: rawSy } = pos
              const dragOff = focusDragOffsets[selectedNodeId] || { x: 0, y: 0 }
              const sx = rawSx + dragOff.x
              const sy = rawSy + dragOff.y
              const baseSize = NODE_SIZES[selNode.type] ?? 60
              const sphereSize = baseSize + Math.min((artifacts[selectedNodeId]?.length ?? 0) * 5, 40)
              const artifactList = artifacts[selectedNodeId] ?? []
              if (artifactList.length === 0) return null

              const labels = artifactList.map((artifact, i) => {
                const angle = (5 + i * 28) * (Math.PI / 180)
                const dist = sphereSize / 2 + 85
                const lx = sx + Math.cos(angle) * dist
                const ly = sy + Math.sin(angle) * dist
                const label = artifact.artifact_type === 'text'
                  ? (artifact.content ?? '').substring(0, 20) || 'Note'
                  : artifact.artifact_type === 'url'
                    ? (() => { try { return new URL(artifact.content ?? '').hostname } catch { return 'URL' } })()
                    : (artifact.filename ?? 'File').substring(0, 20)
                const icon = artifact.artifact_type === 'image' ? '🖼️'
                  : artifact.artifact_type === 'text' ? '📝'
                  : artifact.artifact_type === 'url' ? '🔗'
                  : artifact.artifact_type === 'voice' ? '🎙️'
                  : '📎'
                return { lx, ly, label, icon }
              })

              return (
                <>
                  <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 15 }}
                    width={dimensions.width} height={dimensions.height}>
                    {labels.map((l, i) => {
                      const dx = l.lx - sx
                      const dy = l.ly - sy
                      const dist = Math.sqrt(dx * dx + dy * dy) || 1
                      const curve = Math.min(dist * 0.22, 35)
                      const nx = -dy / dist
                      const ny = dx / dist
                      const cp1x = sx + dx * 0.35 + nx * curve
                      const cp1y = sy + dy * 0.35 + ny * curve
                      const cp2x = l.lx - dx * 0.2 + nx * curve * 0.5
                      const cp2y = l.ly - dy * 0.2 + ny * curve * 0.5
                      return (
                        <path key={i}
                          d={`M ${sx} ${sy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${l.lx} ${l.ly}`}
                          stroke="rgba(255,255,255,0.22)" strokeWidth="1" fill="none" strokeLinecap="round" />
                      )
                    })}
                  </svg>
                  {labels.map((l, i) => (
                    <div key={i} className="pointer-events-none" style={{
                      position: 'absolute', left: l.lx, top: l.ly,
                      transform: 'translate(-50%, -50%)', zIndex: 16,
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '2px 8px', borderRadius: 6,
                      background: 'rgba(0,0,0,0.65)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      fontSize: 11, color: 'rgba(255,255,255,0.82)', whiteSpace: 'nowrap',
                    }}>
                      <span style={{ fontSize: 12 }}>{l.icon}</span>
                      <span>{l.label}</span>
                    </div>
                  ))}
                </>
              )
            })()}

            {/* Child nodes */}
            {childNodes.map((child, i) => {
              const pos = focusPositions.children[i]
              return (
                <div key={child.id} data-node="true">
                  <SphereNode
                    node={child}
                    screenX={pos.sx + (focusDragOffsets[child.id]?.x ?? 0)}
                    screenY={pos.sy + (focusDragOffsets[child.id]?.y ?? 0)}
                    isSelected={selectedNodeId === child.id}
                    artifactCount={artifacts[child.id]?.length ?? 0}
                    dueGlow={getDueDateGlow(child.due_date ?? null)}
                    onClick={() => selectNode(child.id)}
                    onDoubleClick={() => { setFocusedNode(child.id); selectNode(child.id) }}
                    onDragStart={(e) => handleNodeDragStart(e, child)}
                  />
                </div>
              )
            })}
          </>
        )}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center glass p-8 pointer-events-auto">
              <div className="text-4xl mb-3">🌌</div>
              <h2 className="text-lg font-semibold text-white mb-1">Your idea space awaits</h2>
              <p className="text-sm text-white/50 mb-4">Create your first topic to start capturing ideas</p>
              <GlassButton variant="primary" onClick={() => setShowCreate(true)}>
                + Start your first topic
              </GlassButton>
            </div>
          </div>
        )}
      </div>

      {/* ── Toolbar ── */}
      {!embedded && (
        <>
          {/* Focus mode: back button */}
          {focusedNode && (
            <button
              onClick={() => setFocusedNode(null)}
              className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white transition-all"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              ← All Topics
            </button>
          )}

          {/* Right toolbar */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <button
                onClick={() => setCanvasScale(canvasScale - 0.15)}
                className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors text-base leading-none"
                title="Zoom out"
              >−</button>
              <span className="text-xs text-white/40 w-10 text-center">
                {Math.round(canvasScale * 100)}%
              </span>
              <button
                onClick={() => setCanvasScale(canvasScale + 0.15)}
                className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white transition-colors text-base leading-none"
                title="Zoom in"
              >+</button>
            </div>

            <GlassButton size="sm" onClick={() => { setRotation(0, 0); setCanvasScale(1.0) }}>
              Reset View
            </GlassButton>
            <GlassButton variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              + Topic
            </GlassButton>
          </div>
        </>
      )}

      {/* Rotation indicator */}
      {!focusedNode && (
        <div className="absolute bottom-4 left-4 text-xs text-white/20 z-20">
          X: {rotation.x.toFixed(0)}° Y: {rotation.y.toFixed(0)}°
        </div>
      )}

      {/* Topic count */}
      <div className="absolute bottom-4 right-4 text-xs text-white/30 z-20">
        {nodes.length} {nodes.length === 1 ? 'topic' : 'topics'}
      </div>

      {/* Topic detail panel */}
      {selectedNode && !showTrash && (
        <NodePanel
          node={selectedNode}
          onClose={() => selectNode(null)}
        />
      )}

      {/* Trash panel */}
      {showTrash && (
        <TrashPanel onClose={() => setShowTrash(false)} />
      )}

      {/* Create form */}
      {showCreate && (
        <NodeForm onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}

function Stars() {
  const stars = useRef(
    Array.from({ length: 150 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
    }))
  )

  return (
    <div className="absolute inset-0 pointer-events-none">
      {stars.current.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: star.x + '%',
            top: star.y + '%',
            width: star.size + 'px',
            height: star.size + 'px',
            opacity: star.opacity,
          }}
        />
      ))}
    </div>
  )
}
