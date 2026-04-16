'use client'

import { useEffect, useState } from 'react'
import { useUniverseStore, Artifact } from '@/store/universe'
import ArtifactViewer from './ArtifactViewer'

interface ArtifactTreeProps {
  nodeId: string
}

function getLabel(artifact: Artifact): string {
  if (artifact.artifact_type === 'text') return (artifact.content ?? '').substring(0, 40) || 'Note'
  if (artifact.artifact_type === 'url') {
    if (artifact.filename) return artifact.filename
    try { return new URL(artifact.content ?? '').hostname } catch { return artifact.content ?? 'URL' }
  }
  return artifact.filename ?? 'File'
}

function getFileIcon(artifact: Artifact): string {
  if (artifact.artifact_type === 'image') return '🖼️'
  if (artifact.artifact_type === 'text') return '📝'
  if (artifact.artifact_type === 'url') return '🔗'
  if (artifact.artifact_type === 'voice') return '🎙️'
  const ext = artifact.filename?.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📄'
  if (['doc', 'docx'].includes(ext ?? '')) return '📝'
  if (['xls', 'xlsx'].includes(ext ?? '')) return '📊'
  if (['zip', 'tar', 'gz'].includes(ext ?? '')) return '📦'
  return '📎'
}

export default function ArtifactTree({ nodeId }: ArtifactTreeProps) {
  const { artifacts, artifactsLoading, fetchArtifacts, removeArtifact } = useUniverseStore()
  const list = artifacts[nodeId] ?? []
  const [viewing, setViewing] = useState<Artifact | null>(null)

  useEffect(() => {
    fetchArtifacts(nodeId)
  }, [nodeId, fetchArtifacts])

  async function handleDelete(artifact: Artifact) {
    try {
      const res = await fetch(`/api/attachments/${artifact.id}`, { method: 'DELETE' })
      if (res.ok) removeArtifact(nodeId, artifact.id)
    } catch (err) {
      console.error('Delete artifact error:', err)
    }
  }

  if (artifactsLoading && list.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-white/30 text-sm">Loading...</span>
      </div>
    )
  }

  if (list.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 p-6">
        <span className="text-3xl">💭</span>
        <p className="text-white/30 text-sm text-center">
          Nothing captured yet.<br />Paste text, images, or attach files below.
        </p>
      </div>
    )
  }

  return (
    <>
    <div className="flex-1 overflow-y-auto p-4">
      <div
        className="rounded-xl p-4"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {list.map((artifact, i) => {
          const isLast = i === list.length - 1
          const label = getLabel(artifact)
          const icon = getFileIcon(artifact)

          return (
            <div
              key={artifact.id}
              className="flex group cursor-pointer rounded-md hover:bg-white/5 transition-colors"
              onClick={() => {
                if (artifact.artifact_type === 'url' && artifact.content) {
                  window.open(artifact.content, '_blank', 'noopener,noreferrer')
                } else {
                  setViewing(artifact)
                }
              }}
            >
              {/* Tree connector column */}
              <div className="relative flex-shrink-0" style={{ width: 28 }}>
                {i === 0 && (
                  /* Root dot */
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 10,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.5)',
                    }}
                  />
                )}
                {i > 0 && (
                  /* Vertical line from top */
                  <div
                    style={{
                      position: 'absolute',
                      left: 3,
                      top: 0,
                      width: 1,
                      height: isLast ? 14 : '100%',
                      background: 'rgba(255,255,255,0.2)',
                    }}
                  />
                )}
                {/* Horizontal branch */}
                <div
                  style={{
                    position: 'absolute',
                    left: i === 0 ? 8 : 3,
                    top: 13,
                    width: i === 0 ? 16 : 20,
                    height: 1,
                    background: 'rgba(255,255,255,0.2)',
                  }}
                />
                {/* Continue vertical line below (if not first and not last) */}
                {i > 0 && !isLast && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 3,
                      top: 14,
                      width: 1,
                      bottom: 0,
                      background: 'rgba(255,255,255,0.2)',
                    }}
                  />
                )}
              </div>

              {/* Artifact row */}
              <div
                className="flex items-center gap-2 flex-1 min-w-0 py-2"
                style={{ marginBottom: i < list.length - 1 ? 4 : 0 }}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{icon}</span>
                <span
                  className="text-sm text-white/80 truncate flex-1"
                  title={label}
                >
                  {label}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(artifact) }}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400
                             transition-all text-xs flex-shrink-0 ml-1"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>

    {viewing && (
      <ArtifactViewer artifact={viewing} onClose={() => setViewing(null)} />
    )}
  </>
  )
}
