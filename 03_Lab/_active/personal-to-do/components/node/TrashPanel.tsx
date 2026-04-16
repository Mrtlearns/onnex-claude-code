'use client'

import { useEffect } from 'react'
import { useUniverseStore } from '@/store/universe'
import type { Artifact } from '@/store/universe'

interface TrashPanelProps {
  onClose: () => void
}

function getFileIcon(artifact: Artifact): string {
  if (artifact.artifact_type === 'text') return '📝'
  if (artifact.artifact_type === 'image') return '🖼️'
  const ext = (artifact.filename ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx'].includes(ext)) return '📊'
  if (['zip', 'gz', 'tar'].includes(ext)) return '📦'
  return '📎'
}

function daysLeft(deletedAt: string): number {
  const elapsed = Date.now() - new Date(deletedAt).getTime()
  const elapsedDays = elapsed / (1000 * 60 * 60 * 24)
  return Math.max(0, Math.ceil(7 - elapsedDays))
}

export default function TrashPanel({ onClose }: TrashPanelProps) {
  const { trashedArtifacts, fetchTrash, restoreArtifact, nodes } = useUniverseStore()

  useEffect(() => {
    fetchTrash()
  }, [fetchTrash])

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n.title]))

  return (
    <div
      className="absolute right-0 top-0 h-full z-30 flex flex-col"
      style={{
        width: 384,
        background: 'rgba(8,10,16,0.92)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🗑️</span>
          <span className="font-semibold text-white text-sm">Trash</span>
          {trashedArtifacts.length > 0 && (
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.25)', color: '#fca5a5' }}
            >
              {trashedArtifacts.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {trashedArtifacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <span className="text-3xl mb-3">🗑️</span>
            <p className="text-sm text-white/40">Trash is empty</p>
            <p className="text-xs text-white/25 mt-1">Deleted items appear here for 7 days</p>
          </div>
        ) : (
          trashedArtifacts.map((artifact) => {
            const days = artifact.deleted_at ? daysLeft(artifact.deleted_at) : 0
            const urgent = days <= 2
            const topicLabel = nodeMap[artifact.node_id] ?? artifact.node_id

            return (
              <div
                key={artifact.id}
                className="flex items-start gap-3 px-3 py-3 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <span className="text-base mt-0.5 flex-shrink-0">{getFileIcon(artifact)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">
                    {artifact.artifact_type === 'text'
                      ? (artifact.content ?? '').substring(0, 40) || 'Note'
                      : (artifact.filename ?? 'File')}
                  </p>
                  <p className="text-xs text-white/35 mt-0.5 truncate">📍 {topicLabel}</p>
                  <p
                    className="text-xs mt-1 font-medium"
                    style={{ color: urgent ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}
                  >
                    {days === 0 ? 'Expires today' : `${days}d left`}
                  </p>
                </div>
                <button
                  onClick={() => restoreArtifact(artifact)}
                  className="flex-shrink-0 text-xs px-2.5 py-1.5 rounded-md font-medium transition-all"
                  style={{
                    background: 'rgba(59,130,246,0.15)',
                    border: '1px solid rgba(59,130,246,0.3)',
                    color: '#93c5fd',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.28)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.15)'
                  }}
                >
                  Restore
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Footer hint */}
      {trashedArtifacts.length > 0 && (
        <div
          className="px-5 py-3 text-xs text-white/25"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          Items are permanently deleted after 7 days
        </div>
      )}
    </div>
  )
}
