'use client'

import { useState } from 'react'
import { Node } from '@/db/schema'
import { computeStatus } from '@/lib/aging'
import { useUniverseStore } from '@/store/universe'
import StatusBadge from '@/components/ui/StatusBadge'
import ArtifactTree from './ArtifactTree'
import ArtifactInput from './ArtifactInput'
import NodeForm from './NodeForm'

interface NodePanelProps {
  node: Node
  onClose: () => void
}

const TYPE_ICONS: Record<string, string> = {
  note: '📝', task: '✅', idea: '💡', reference: '🔗', person: '👤', project: '📁',
}

export default function NodePanel({ node, onClose }: NodePanelProps) {
  const { updateNode, deleteNode, edges, nodes, selectNode } = useUniverseStore()
  const [editing, setEditing] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingSubtopic, setAddingSubtopic] = useState(false)

  const status = computeStatus(node.last_accessed_at)

  // Find parent topic (edge where source_id === node.id, type === 'part_of')
  const parentEdge = edges.find((e) => e.source_id === node.id && e.type === 'part_of')
  const parentNode = parentEdge ? nodes.find((n) => n.id === parentEdge.target_id) : null

  async function handleArchive() {
    await updateNode(node.id, { archived: !node.archived })
    setShowMenu(false)
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await deleteNode(node.id)
    onClose()
  }

  return (
    <>
      <div
        className="absolute right-0 top-0 h-full w-96 z-30 flex flex-col"
        style={{
          backdropFilter: 'blur(20px)',
          background: 'rgba(0,0,0,0.75)',
          borderLeft: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* Parent breadcrumb */}
        {parentNode && (
          <button
            onClick={() => selectNode(parentNode.id)}
            className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs text-white/40 hover:text-white/70 transition-colors text-left"
          >
            <span>←</span>
            <span className="truncate">{parentNode.title}</span>
          </button>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl flex-shrink-0">{TYPE_ICONS[node.type] ?? '⚪'}</span>
            <h2 className="font-semibold text-white truncate text-sm">{node.title}</h2>
            <StatusBadge status={status} />
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {/* Subtopic */}
            <button
              onClick={() => setAddingSubtopic(true)}
              title="Add subtopic"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs
                         text-white/40 hover:text-white/90 hover:bg-white/10 transition-all"
            >
              ⊕
            </button>

            {/* Edit */}
            <button
              onClick={() => setEditing(true)}
              title="Edit topic"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs
                         text-white/40 hover:text-white/90 hover:bg-white/10 transition-all"
            >
              ✏️
            </button>

            {/* More menu */}
            <div className="relative">
              <button
                onClick={() => { setShowMenu((v) => !v); setConfirmDelete(false) }}
                title="More options"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-xs
                           text-white/40 hover:text-white/90 hover:bg-white/10 transition-all"
              >
                ···
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-9 w-36 rounded-xl overflow-hidden z-50"
                  style={{
                    background: 'rgba(20,20,30,0.95)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <button
                    onClick={handleArchive}
                    className="w-full px-3 py-2 text-left text-xs text-white/70 hover:bg-white/10 transition-colors"
                  >
                    {node.archived ? '📤 Unarchive' : '📥 Archive'}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full px-3 py-2 text-left text-xs transition-colors
                               text-red-400 hover:bg-red-500/20"
                  >
                    {confirmDelete ? '⚠️ Confirm delete?' : '🗑️ Delete topic'}
                  </button>
                </div>
              )}
            </div>

            {/* Close */}
            <button
              onClick={onClose}
              title="Close"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs
                         text-white/40 hover:text-white/90 hover:bg-white/10 transition-all"
            >
              ✕
            </button>
          </div>
        </div>

        <ArtifactTree nodeId={node.id} />
        <ArtifactInput nodeId={node.id} />
      </div>

      {editing && <NodeForm node={node} onClose={() => setEditing(false)} />}
      {addingSubtopic && <NodeForm parentId={node.id} onClose={() => setAddingSubtopic(false)} />}
    </>
  )
}
