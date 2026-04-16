'use client'

import { useState, useEffect } from 'react'
interface Attachment {
  id: string
  filename: string
  storage_path: string
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

interface AttachmentListProps {
  nodeId: string
}

export default function AttachmentList({ nodeId }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    // Attachments would be fetched from node metadata
    // For now show upload UI
  }, [nodeId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('node_id', nodeId)
      formData.append('file', file)

      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const attachment = await res.json()
        setAttachments((prev) => [...prev, attachment])
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function formatSize(bytes: number | null): string {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-white/40 uppercase tracking-wider">
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </p>
        <label className="cursor-pointer">
          <span className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
            {uploading ? 'Uploading...' : '+ Upload'}
          </span>
          <input
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div key={att.id} className="flex items-center gap-2 glass-sm p-2 text-xs">
              <span>📎</span>
              <span className="text-white/70 truncate flex-1">{att.filename}</span>
              {att.size_bytes && (
                <span className="text-white/30">{formatSize(att.size_bytes)}</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-white/20">No attachments</p>
      )}
    </div>
  )
}
