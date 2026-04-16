'use client'

import { useEffect, useRef } from 'react'
import { useUniverseStore, Artifact } from '@/store/universe'

interface ArtifactFeedProps {
  nodeId: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function getFileIcon(filename: string | null, mimeType: string | null): string {
  const ext = filename?.split('.').pop()?.toLowerCase()
  const mime = mimeType ?? ''
  if (mime.startsWith('image/')) return '🖼️'
  if (mime === 'application/pdf' || ext === 'pdf') return '📄'
  if (['doc', 'docx'].includes(ext ?? '')) return '📝'
  if (['xls', 'xlsx'].includes(ext ?? '')) return '📊'
  if (['zip', 'tar', 'gz'].includes(ext ?? '')) return '📦'
  return '📎'
}

function TextArtifact({ artifact, onDelete }: { artifact: Artifact; onDelete: () => void }) {
  return (
    <div className="group relative rounded-xl p-3" style={{
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <p className="text-sm text-white/85 whitespace-pre-wrap leading-relaxed break-words">
        {artifact.content}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-white/25">{formatTime(artifact.created_at)}</span>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all text-xs"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function ImageArtifact({ artifact, onDelete }: { artifact: Artifact; onDelete: () => void }) {
  return (
    <div className="group relative rounded-xl overflow-hidden" style={{
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      {artifact.public_url ? (
        <img
          src={artifact.public_url}
          alt={artifact.filename ?? 'Pasted image'}
          className="w-full max-h-64 object-contain"
          style={{ background: 'rgba(0,0,0,0.3)' }}
        />
      ) : (
        <div className="p-4 text-white/40 text-sm">Image unavailable</div>
      )}
      <div className="flex items-center justify-between px-3 py-2" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <span className="text-xs text-white/30">{formatTime(artifact.created_at)}</span>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all text-xs"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

function FileArtifact({ artifact, onDelete }: { artifact: Artifact; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-3 rounded-xl p-3" style={{
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <span className="text-2xl flex-shrink-0">{getFileIcon(artifact.filename, artifact.mime_type)}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white/85 truncate">{artifact.filename ?? 'File'}</p>
        <p className="text-xs text-white/30">
          {artifact.size_bytes ? formatSize(artifact.size_bytes) : ''}{' '}
          · {formatTime(artifact.created_at)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {artifact.public_url && (
          <a
            href={artifact.public_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400/70 hover:text-blue-300 transition-colors"
            title="Download"
          >
            ↓
          </a>
        )}
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all text-xs"
          title="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default function ArtifactFeed({ nodeId }: ArtifactFeedProps) {
  const { artifacts, artifactsLoading, fetchArtifacts, removeArtifact } = useUniverseStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const list = artifacts[nodeId] ?? []

  useEffect(() => {
    fetchArtifacts(nodeId)
  }, [nodeId, fetchArtifacts])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [list.length])

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
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {list.map((artifact) => {
        const props = { artifact, onDelete: () => handleDelete(artifact) }
        if (artifact.artifact_type === 'text') return <TextArtifact key={artifact.id} {...props} />
        if (artifact.artifact_type === 'image') return <ImageArtifact key={artifact.id} {...props} />
        return <FileArtifact key={artifact.id} {...props} />
      })}
      <div ref={bottomRef} />
    </div>
  )
}
