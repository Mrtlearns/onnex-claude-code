'use client'

import { useEffect, useCallback, useState } from 'react'
import ReactFlow, {
  Node as RFNode,
  Edge as RFEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useUniverseStore, Artifact } from '@/store/universe'
import { computeStatus, getStatusColor, getStatusGlow } from '@/lib/aging'
import NodePanel from '@/components/node/NodePanel'
import NodeForm from '@/components/node/NodeForm'
import GlassButton from '@/components/ui/GlassButton'
import type { Node } from '@/db/schema'

const NODE_GRADIENT_COLORS: Record<string, string[]> = {
  note: ['#93c5fd', '#3b82f6'],
  task: ['#86efac', '#22c55e'],
  idea: ['#fde68a', '#f59e0b'],
  reference: ['#c4b5fd', '#8b5cf6'],
  person: ['#fdba74', '#f97316'],
  project: ['#f9a8d4', '#ec4899'],
}

const TYPE_ICONS: Record<string, string> = {
  note: '📝', task: '✅', idea: '💡', reference: '🔗', person: '👤', project: '📁',
}

// Topic node (sphere-style card)
function TopicNode({ data, selected }: NodeProps) {
  const { node } = data as { node: Node }
  const status = computeStatus(node.last_accessed_at)
  const color = getStatusColor(status)
  const glow = selected
    ? `0 0 20px 6px ${color}, 0 0 40px 12px ${color}40`
    : getStatusGlow(status)
  const colors = NODE_GRADIENT_COLORS[node.type] ?? ['#93c5fd', '#3b82f6']

  return (
    <div style={{
      width: 160,
      minHeight: 65,
      borderRadius: 14,
      backdropFilter: 'blur(16px)',
      background: `linear-gradient(135deg, ${colors[0]}22, ${colors[1]}44)`,
      border: `1px solid ${colors[0]}60`,
      boxShadow: glow,
      padding: '10px 14px',
      cursor: 'pointer',
      transition: 'box-shadow 0.2s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
    }}>
      <Handle type="source" position={Position.Bottom} style={{ background: colors[1], border: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>{TYPE_ICONS[node.type] ?? '⚪'}</span>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.95)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 110,
        }}>
          {node.title}
        </span>
      </div>
      {node.content && (
        <span style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.5)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {node.content.substring(0, 60)}
        </span>
      )}
    </div>
  )
}

// Artifact leaf node
function ArtifactNode({ data }: NodeProps) {
  const { artifact } = data as { artifact: Artifact }

  const icon =
    artifact.artifact_type === 'text' ? '💬' :
    artifact.artifact_type === 'image' ? '🖼️' : '📎'

  const preview =
    artifact.artifact_type === 'text'
      ? (artifact.content ?? '').substring(0, 50)
      : (artifact.filename ?? 'File')

  return (
    <div style={{
      width: 140,
      minHeight: 50,
      borderRadius: 10,
      backdropFilter: 'blur(12px)',
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.15)',
      padding: '8px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: 'rgba(255,255,255,0.3)', border: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.8)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 100,
          textTransform: 'capitalize',
        }}>
          {artifact.artifact_type}
        </span>
      </div>
      {preview && (
        <span style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.4)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {preview}
        </span>
      )}
    </div>
  )
}

const nodeTypes: NodeTypes = { topic: TopicNode, artifact: ArtifactNode }

export default function MindmapView() {
  const { nodes: kuNodes, selectedNodeId, selectNode, fetchAll, artifacts, fetchArtifacts } = useUniverseStore()
  const [rfNodes, setRFNodes, onNodesChange] = useNodesState([])
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState([])
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { fetchAll() }, [fetchAll])

  // Fetch artifacts when a topic is selected
  useEffect(() => {
    if (selectedNodeId) fetchArtifacts(selectedNodeId)
  }, [selectedNodeId, fetchArtifacts])

  // Build RF graph: either artifact tree (topic selected) or flat topic grid
  useEffect(() => {
    if (selectedNodeId) {
      // Artifact tree view
      const topic = kuNodes.find((n) => n.id === selectedNodeId)
      if (!topic) return

      const topicArtifacts = artifacts[selectedNodeId] ?? []
      const count = topicArtifacts.length
      const spacing = 180
      const offsetX = -(count - 1) * spacing / 2

      const newNodes: RFNode[] = [
        {
          id: topic.id,
          type: 'topic',
          position: { x: 0, y: 0 },
          data: { node: topic },
          selected: true,
        },
        ...topicArtifacts.map((artifact, idx) => ({
          id: `artifact-${artifact.id}`,
          type: 'artifact',
          position: { x: offsetX + idx * spacing, y: 200 },
          data: { artifact },
          selectable: false,
        })),
      ]

      const newEdges: RFEdge[] = topicArtifacts.map((artifact) => ({
        id: `edge-${artifact.id}`,
        source: topic.id,
        target: `artifact-${artifact.id}`,
        type: 'smoothstep',
        style: { stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 },
      }))

      setRFNodes(newNodes)
      setRFEdges(newEdges)
    } else {
      // Flat topic grid — no edges between topics
      const cols = Math.max(1, Math.ceil(Math.sqrt(kuNodes.length)))
      const newNodes: RFNode[] = kuNodes.map((node, idx) => ({
        id: node.id,
        type: 'topic',
        position: { x: (idx % cols) * 220 + 60, y: Math.floor(idx / cols) * 160 + 60 },
        data: { node },
        selected: node.id === selectedNodeId,
      }))
      setRFNodes(newNodes)
      setRFEdges([])
    }
  }, [kuNodes, selectedNodeId, artifacts, setRFNodes, setRFEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: RFNode) => {
    // Only topic nodes are clickable
    if (!node.id.startsWith('artifact-')) {
      selectNode(node.id)
    }
  }, [selectNode])

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  const selectedNode = kuNodes.find((n) => n.id === selectedNodeId) ?? null

  return (
    <div className="relative w-full h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        style={{ background: 'transparent' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={30}
          size={1}
          color="rgba(255,255,255,0.08)"
        />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const kuNode = kuNodes.find((k) => k.id === n.id)
            if (!kuNode) return 'rgba(255,255,255,0.2)'
            return getStatusColor(computeStatus(kuNode.last_accessed_at))
          }}
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>

      {/* Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
        {selectedNodeId && (
          <GlassButton size="sm" onClick={() => selectNode(null)}>
            ← All Topics
          </GlassButton>
        )}
        <GlassButton variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          + Topic
        </GlassButton>
      </div>

      {/* Status */}
      <div className="absolute bottom-4 left-16 text-xs text-white/30 z-20">
        {selectedNodeId
          ? `${(artifacts[selectedNodeId] ?? []).length} artifacts`
          : `${kuNodes.length} ${kuNodes.length === 1 ? 'topic' : 'topics'}`}
      </div>

      {selectedNode && (
        <NodePanel node={selectedNode} onClose={() => selectNode(null)} />
      )}

      {showCreate && (
        <NodeForm onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
