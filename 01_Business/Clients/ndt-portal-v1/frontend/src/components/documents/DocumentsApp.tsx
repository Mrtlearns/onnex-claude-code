// Two-panel document browser: left = Nextcloud file tree, right = type-aware viewer

import { useState, useRef } from 'react'
import { documentsApi } from '@/lib/documentsApi'
import { Upload, FolderUp, FolderPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import NextcloudBrowser, { type NextcloudFile } from './NextcloudBrowser'
import DocumentViewer from './DocumentViewer'

interface UploadItem {
  name: string
  status: 'uploading' | 'done' | 'error'
}

async function collectEntries(
  entry: FileSystemEntry,
  prefix: string,
  results: Array<{ file: File; relativePath: string }>
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>(resolve =>
      (entry as FileSystemFileEntry).file(resolve)
    )
    results.push({ file, relativePath: prefix + entry.name })
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    let batch: FileSystemEntry[]
    do {
      batch = await new Promise<FileSystemEntry[]>(resolve => reader.readEntries(resolve))
      for (const child of batch) {
        await collectEntries(child, prefix + entry.name + '/', results)
      }
    } while (batch.length > 0)
  }
}

export default function DocumentsApp() {
  const [selectedFile, setSelectedFile] = useState<NextcloudFile | null>(null)
  const [currentPath, setCurrentPath] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(fileList: FileList) {
    const files = Array.from(fileList)
    const items: UploadItem[] = files.map(f => ({ name: f.name, status: 'uploading' }))
    setUploads(items)

    await Promise.all(files.map(async (file, i) => {
      const destPath = currentPath ? `${currentPath}/${file.name}` : file.name
      try {
        const res = await documentsApi.upload(destPath, file, file.type || 'application/octet-stream')
        setUploads(prev => prev.map((u, j) => j === i ? { ...u, status: res.ok ? 'done' : 'error' } : u))
      } catch {
        setUploads(prev => prev.map((u, j) => j === i ? { ...u, status: 'error' } : u))
      }
    }))

    setRefreshKey(k => k + 1)
    setTimeout(() => setUploads([]), 3000)
  }

  async function uploadFolder(fileList: FileList) {
    const files = Array.from(fileList)

    const dirs = [...new Set(
      files.flatMap(f => {
        const parts = f.webkitRelativePath.split('/').slice(0, -1)
        return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
      }).filter(Boolean)
    )].sort((a, b) => a.split('/').length - b.split('/').length)

    const base = currentPath ? currentPath + '/' : ''
    for (const dir of dirs) {
      await documentsApi.mkdir(base + dir)
    }

    const items: UploadItem[] = files.map(f => ({ name: f.webkitRelativePath, status: 'uploading' }))
    setUploads(items)

    await Promise.all(files.map(async (file, i) => {
      try {
        const res = await documentsApi.upload(base + file.webkitRelativePath, file, file.type || 'application/octet-stream')
        setUploads(prev => prev.map((u, j) => j === i ? { ...u, status: res.ok ? 'done' : 'error' } : u))
      } catch {
        setUploads(prev => prev.map((u, j) => j === i ? { ...u, status: 'error' } : u))
      }
    }))

    setRefreshKey(k => k + 1)
    setTimeout(() => setUploads([]), 3000)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const items = Array.from(e.dataTransfer.items)
    const collected: Array<{ file: File; relativePath: string }> = []
    for (const item of items) {
      const entry = item.webkitGetAsEntry()
      if (entry) await collectEntries(entry, '', collected)
    }
    if (!collected.length) return

    const base = currentPath ? currentPath + '/' : ''
    const dirs = [...new Set(
      collected.flatMap(c => {
        const parts = c.relativePath.split('/').slice(0, -1)
        return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
      }).filter(Boolean)
    )].sort((a, b) => a.split('/').length - b.split('/').length)
    for (const dir of dirs) {
      await documentsApi.mkdir(base + dir)
    }

    const uploadItems: UploadItem[] = collected.map(c => ({ name: c.relativePath, status: 'uploading' }))
    setUploads(uploadItems)
    await Promise.all(collected.map(async ({ file, relativePath }, i) => {
      try {
        const res = await documentsApi.upload(base + relativePath, file, file.type || 'application/octet-stream')
        setUploads(prev => prev.map((u, j) => j === i ? { ...u, status: res.ok ? 'done' : 'error' } : u))
      } catch {
        setUploads(prev => prev.map((u, j) => j === i ? { ...u, status: 'error' } : u))
      }
    }))
    setRefreshKey(k => k + 1)
    setTimeout(() => setUploads([]), 3000)
  }

  async function createFolder(name: string) {
    const path = currentPath ? `${currentPath}/${name}` : name
    await documentsApi.mkdir(path)
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="flex h-full">
      {/* Left panel — file tree + drag-and-drop zone */}
      <div
        data-testid="documents-left-panel"
        className={cn(
          "w-[280px] shrink-0 border-r overflow-y-auto flex flex-col transition-colors",
          dragOver && "bg-primary/5 ring-2 ring-primary/30 ring-inset"
        )}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Header with upload actions */}
        <div className="px-3 py-2 border-b flex items-center gap-1.5">
          <h2 className="text-sm font-semibold flex-1">Documents</h2>
          <button
            title="Upload files"
            className="p-1 rounded hover:bg-muted/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            title="Upload folder (or drag & drop multiple)"
            className="p-1 rounded hover:bg-muted/50 transition-colors"
            onClick={() => folderInputRef.current?.click()}
          >
            <FolderUp className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            title="New folder"
            className="p-1 rounded hover:bg-muted/50 transition-colors"
            onClick={() => {
              const name = window.prompt('Folder name:')
              if (name?.trim()) createFolder(name.trim())
            }}
          >
            <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Upload progress */}
        {uploads.length > 0 && (
          <div className="px-2 py-1 space-y-0.5 border-b">
            {uploads.map((u, i) => (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                {u.status === 'uploading' && <span className="animate-pulse text-muted-foreground">⟳</span>}
                {u.status === 'done'      && <span className="text-green-500">✓</span>}
                {u.status === 'error'     && <span className="text-red-500">✗</span>}
                <span className="truncate text-muted-foreground">{u.name.split('/').pop()}</span>
              </div>
            ))}
          </div>
        )}

        <NextcloudBrowser
          onSelectFile={setSelectedFile}
          onPathChange={setCurrentPath}
          refreshKey={refreshKey}
          onRefresh={() => setRefreshKey(k => k + 1)}
        />

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = '' }}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error non-standard attribute
          webkitdirectory=""
          multiple
          className="hidden"
          onChange={e => { if (e.target.files?.length) uploadFolder(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* Right panel — preview */}
      <div className="flex-1 p-4 overflow-hidden">
        <DocumentViewer file={selectedFile} />
      </div>
    </div>
  )
}
