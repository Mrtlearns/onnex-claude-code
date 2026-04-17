'use client'
import { useCallback, useState } from 'react'
import { uploadArtifact } from '@/lib/api'
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

type UploadState = 'idle' | 'uploading' | 'processing' | 'assessed' | 'failed'

interface ArtifactUploaderProps {
  programControlId: string
  onUploadComplete: (artifactId: string) => void
}

const ACCEPT_TYPES = '.pdf,.docx,.xlsx,.png,.jpg,.jpeg'

export function ArtifactUploader({ programControlId, onUploadComplete }: ArtifactUploaderProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (!file) return

      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png',
        'image/jpeg',
      ]
      if (!allowedTypes.includes(file.type)) {
        setError('Unsupported file type. Please upload PDF, DOCX, XLSX, PNG, or JPG.')
        return
      }

      setFileName(file.name)
      setError(null)
      setState('uploading')
      setProgress(10)

      try {
        const { artifact_id } = await uploadArtifact(programControlId, file)
        setProgress(80)
        setState('processing')
        setProgress(100)
        onUploadComplete(artifact_id)
        // Transition to assessed state after a delay (real state comes from subscription/polling)
        setTimeout(() => setState('assessed'), 3000)
      } catch (err: any) {
        setState('failed')
        setError(err.message || 'Upload failed')
      }
    },
    [programControlId, onUploadComplete]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const reset = () => {
    setState('idle')
    setProgress(0)
    setError(null)
    setFileName(null)
  }

  if (state === 'assessed') {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-700">Upload complete</p>
          <p className="text-xs text-green-600">{fileName} — AI assessment in progress</p>
        </div>
        <button onClick={reset} className="text-xs text-green-600 underline">
          Upload another
        </button>
      </div>
    )
  }

  if (state === 'failed') {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
        <XCircleIcon className="w-6 h-6 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-700">Upload failed</p>
          <p className="text-xs text-red-600">{error}</p>
        </div>
        <button onClick={reset} className="text-xs text-red-600 underline">
          Try again
        </button>
      </div>
    )
  }

  if (state === 'uploading' || state === 'processing') {
    return (
      <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-3 mb-2">
          <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />
          <span className="text-sm font-medium text-blue-700">
            {state === 'uploading' ? 'Uploading...' : 'Processing — AI assessment queued'}
          </span>
        </div>
        <div className="w-full bg-blue-100 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {fileName && <p className="text-xs text-blue-500 mt-1">{fileName}</p>}
      </div>
    )
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
        isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      }`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onClick={() => document.getElementById(`uploader-${programControlId}`)?.click()}
    >
      <input
        id={`uploader-${programControlId}`}
        type="file"
        accept={ACCEPT_TYPES}
        className="hidden"
        onChange={handleChange}
      />
      <CloudArrowUpIcon className="w-10 h-10 text-gray-400 mx-auto mb-2" />
      <p className="text-sm font-medium text-gray-600">
        Drop evidence here or <span className="text-blue-600 underline">browse</span>
      </p>
      <p className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX, PNG, JPG</p>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  )
}
