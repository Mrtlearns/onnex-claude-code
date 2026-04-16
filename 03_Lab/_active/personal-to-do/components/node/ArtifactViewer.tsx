'use client'

import { useEffect } from 'react'
import type { Artifact } from '@/store/universe'

interface ArtifactViewerProps {
  artifact: Artifact
  onClose: () => void
}

function getIcon(artifact: Artifact): string {
  if (artifact.artifact_type === 'text') return '📝'
  if (artifact.artifact_type === 'image') return '🖼️'
  if (artifact.artifact_type === 'url') return '🔗'
  if (artifact.artifact_type === 'voice') return '🎙️'
  const ext = (artifact.filename ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  if (['xls', 'xlsx'].includes(ext)) return '📊'
  if (['zip', 'gz', 'tar'].includes(ext)) return '📦'
  return '📎'
}

function getLabel(artifact: Artifact): string {
  if (artifact.artifact_type === 'text') return (artifact.content ?? '').substring(0, 60) || 'Note'
  if (artifact.artifact_type === 'url') {
    if (artifact.filename) return artifact.filename
    try { return new URL(artifact.content ?? '').hostname } catch { return artifact.content ?? 'URL' }
  }
  return artifact.filename ?? 'File'
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isPdf(artifact: Artifact): boolean {
  return (
    artifact.mime_type === 'application/pdf' ||
    (artifact.filename ?? '').toLowerCase().endsWith('.pdf')
  )
}

export default function ArtifactViewer({ artifact, onClose }: ArtifactViewerProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const isText = artifact.artifact_type === 'text'
  const isImage = artifact.artifact_type === 'image'
  const isVoice = artifact.artifact_type === 'voice'
  const isUrlType = artifact.artifact_type === 'url'
  const isPdfFile = !isText && !isImage && !isVoice && !isUrlType && isPdf(artifact)

  const maxW = isImage ? 'max-w-4xl' : isPdfFile ? 'max-w-5xl' : isText ? 'max-w-2xl' : 'max-w-md'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className={`relative w-full ${maxW} flex flex-col rounded-xl overflow-hidden`}
        style={{
          background: 'rgba(8,10,16,0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span className="text-lg">{getIcon(artifact)}</span>
          <span className="flex-1 text-sm font-medium text-white/80 truncate">
            {getLabel(artifact)}
          </span>
          {artifact.size_bytes && (
            <span className="text-xs text-white/30 flex-shrink-0">
              {formatBytes(artifact.size_bytes)}
            </span>
          )}
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors text-xl leading-none flex-shrink-0 ml-1"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {isText && (
            <pre
              className="p-5 text-sm text-white/80 whitespace-pre-wrap font-sans leading-relaxed"
              style={{ minHeight: 120 }}
            >
              {artifact.content ?? ''}
            </pre>
          )}

          {isImage && artifact.public_url && (
            <div
              className="flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.4)', minHeight: 200 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={artifact.public_url}
                alt={artifact.filename ?? 'Image'}
                className="object-contain rounded"
                style={{ maxHeight: '80vh', maxWidth: '100%' }}
              />
            </div>
          )}

          {isImage && !artifact.public_url && (
            <div className="flex items-center justify-center p-8 text-white/30 text-sm">
              Image unavailable
            </div>
          )}

          {isPdfFile && artifact.public_url && (
            <iframe
              src={artifact.public_url}
              title={artifact.filename ?? 'PDF'}
              className="w-full"
              style={{ height: '80vh', border: 'none' }}
            />
          )}

          {isPdfFile && !artifact.public_url && (
            <div className="flex items-center justify-center p-8 text-white/30 text-sm">
              File unavailable
            </div>
          )}

          {/* URL */}
          {isUrlType && (
            <div className="flex flex-col items-center justify-center gap-5 p-10">
              <span className="text-5xl">🔗</span>
              <div className="text-center max-w-sm">
                {artifact.filename && (
                  <p className="text-sm font-medium text-white/80 mb-1">{artifact.filename}</p>
                )}
                <p className="text-xs text-white/40 break-all">{artifact.content}</p>
              </div>
              <button
                onClick={() => window.open(artifact.content!, '_blank', 'noopener,noreferrer')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93c5fd' }}
              >
                Open in new tab →
              </button>
            </div>
          )}

          {/* Voice */}
          {isVoice && artifact.public_url && (
            <div className="flex flex-col items-center justify-center gap-5 p-10">
              <span className="text-5xl">🎙️</span>
              <audio controls src={artifact.public_url} className="w-full max-w-sm" />
              {artifact.size_bytes && (
                <p className="text-xs text-white/30">{formatBytes(artifact.size_bytes)}</p>
              )}
            </div>
          )}

          {isVoice && !artifact.public_url && (
            <div className="flex items-center justify-center p-8 text-white/30 text-sm">
              Recording unavailable
            </div>
          )}

          {/* Generic file — not text, not image, not PDF, not url, not voice */}
          {!isText && !isImage && !isPdfFile && !isUrlType && !isVoice && (
            <div className="flex flex-col items-center justify-center gap-5 p-10">
              <span className="text-5xl">{getIcon(artifact)}</span>
              <div className="text-center">
                <p className="text-sm font-medium text-white/80">{artifact.filename ?? 'File'}</p>
                {artifact.size_bytes && (
                  <p className="text-xs text-white/35 mt-1">{formatBytes(artifact.size_bytes)}</p>
                )}
              </div>
              {artifact.public_url && (
                <div className="flex gap-3">
                  <button
                    onClick={() => window.open(artifact.public_url!, '_blank')}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: 'rgba(59,130,246,0.15)',
                      border: '1px solid rgba(59,130,246,0.3)',
                      color: '#93c5fd',
                    }}
                  >
                    Open in new tab
                  </button>
                  <a
                    href={artifact.public_url}
                    download={artifact.filename ?? true}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      color: 'rgba(255,255,255,0.6)',
                    }}
                  >
                    Download
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
