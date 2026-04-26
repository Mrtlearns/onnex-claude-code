# Spec: Nextcloud Document Browser — Full Feature Upgrade

> Ported from: `ndt-portal-v1`
> Target: `AI-OS-POC` (Next.js App Router, Fastify BFF, TanStack Query, shadcn/ui)
> Status: Ready to implement

---

## What AI-OS-POC Already Has vs What Needs Adding

### Already implemented in `nextcloud-browser.tsx`
- WebDAV PROPFIND XML parsing with `DOMParser`
- Breadcrumb navigation
- Folder navigation (`currentPath` state)
- TanStack Query integration (`useQuery`)
- `onSelectFile` / `onSelectFolder` callbacks
- Skeleton loaders and error state

### What needs to be added (this spec)
| Feature | Priority |
|---------|----------|
| Multi-select mode with checkboxes | High |
| Soft delete (move to `_deleted/`) + hard delete | High |
| Permanent delete confirmation dialog | High |
| Drag-and-drop file upload | High |
| File picker + folder upload | High |
| Upload progress tracking per file | High |
| Folder creation | Medium |
| In-place document viewer (PDF, image, text, Office via Collabora) | High |
| Auth-aware blob URL hook (for JWT-protected downloads) | High |
| Share link generation | Medium |
| Audit log (delete actions → DB) | Medium |
| Maintenance endpoint (purge `_deleted/` items > 30 days) | Low |

---

## Architecture Overview

```
DocumentsClient (documents-client.tsx)         ← existing orchestrator
  ├── Left panel
  │     ├── Toolbar: Upload button, New Folder button, Select Mode toggle
  │     ├── Drag-and-drop overlay (wraps entire left panel)
  │     ├── UploadProgressList                 ← new component
  │     └── NextcloudBrowser (enhanced)        ← modify existing
  │           ├── Breadcrumb (existing)
  │           ├── Multi-select toolbar          ← add
  │           └── File list with checkboxes    ← add
  └── Right panel
        └── DocumentViewer (enhanced)          ← modify existing
              ├── useAuthenticatedBlobUrl hook  ← new hook
              ├── PDF → iframe with blob URL
              ├── Image → <img> with blob URL
              ├── Text → TextPreview
              └── Office → convert-to-pdf endpoint → iframe
```

---

## Part 1 — Enhanced NextcloudBrowser

### New props interface

```typescript
// apps/web/src/app/(protected)/documents/components/nextcloud-browser.tsx

interface NextcloudBrowserProps {
  onSelectFile?: (file: NextcloudFile) => void
  onSelectFolder?: (path: string, name: string) => void
  refreshKey?: number          // increment to trigger refetch
  onPathChange?: (path: string) => void  // expose current path to parent for upload targeting
}
```

### New state to add

```typescript
const [selectMode, setSelectMode] = useState(false)
const [selected, setSelected] = useState<Set<string>>(new Set())  // paths
const [confirmHardDelete, setConfirmHardDelete] = useState(false)
```

### Multi-select logic

```typescript
function toggleSelect(path: string) {
  setSelected(prev => {
    const next = new Set(prev)
    next.has(path) ? next.delete(path) : next.add(path)
    return next
  })
}

function exitSelectMode() {
  setSelectMode(false)
  setSelected(new Set())
}

// When select mode is toggled off, clear selection
function handleToggleSelectMode() {
  if (selectMode) exitSelectMode()
  else setSelectMode(true)
}
```

### Delete flow

```typescript
async function handleDelete() {
  // Determine if ALL selected items are already in _deleted/
  const allInTrash = [...selected].every(p => p.startsWith('_deleted/'))
  if (allInTrash) {
    setConfirmHardDelete(true)  // show confirmation dialog
  } else {
    await executeDelete('soft')
  }
}

async function executeDelete(mode: 'soft' | 'hard') {
  for (const path of selected) {
    await fetch(`/api/bff/nextcloud/${encodePath(path)}`, { method: 'DELETE' })
  }
  exitSelectMode()
  queryClient.invalidateQueries({ queryKey: ['nextcloud-files', currentPath] })
  setConfirmHardDelete(false)
}
```

### File list row with checkbox

```tsx
{files.map((item) => {
  const isSelected = selected.has(item.path)
  return (
    <div
      key={item.path}
      className={cn(
        "flex items-center gap-1 group rounded",
        isSelected && "bg-muted/70"
      )}
    >
      {/* Checkbox — only in select mode */}
      {selectMode && (
        <input
          type="checkbox"
          readOnly
          checked={isSelected}
          onClick={() => toggleSelect(item.path)}
          className="ml-2 shrink-0 cursor-pointer"
        />
      )}

      {/* File/folder button */}
      <button
        className="flex items-center gap-2 flex-1 px-2 py-1.5 rounded text-sm hover:bg-muted/50 transition-colors text-left"
        onClick={() => selectMode ? toggleSelect(item.path) : handleFileClick(item)}
      >
        {item.type === 'directory'
          ? <FolderIcon className="h-4 w-4 text-yellow-500 shrink-0" />
          : <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
        }
        <span className="truncate">{item.name}</span>
        {!selectMode && (
          <span className="ml-auto text-xs text-muted-foreground shrink-0">
            {item.type === 'file' ? formatBytes(item.size) : ''}
          </span>
        )}
      </button>
    </div>
  )
})}
```

### Multi-select toolbar (above file list)

```tsx
<div className="flex items-center gap-2 px-2 py-1.5 border-b">
  {/* Breadcrumbs — existing code */}
  <div className="flex-1">{/* ... breadcrumbs ... */}</div>

  {/* Select mode toggle */}
  <Button
    variant={selectMode ? "secondary" : "ghost"}
    size="sm"
    onClick={handleToggleSelectMode}
    className="h-7 px-2 text-xs gap-1"
  >
    <CheckSquare className="h-3.5 w-3.5" />
    {selectMode ? "Cancel" : "Select"}
  </Button>

  {/* Delete button — only when items selected */}
  {selectMode && selected.size > 0 && (
    <Button
      variant="destructive"
      size="sm"
      className="h-7 px-2 text-xs gap-1"
      onClick={handleDelete}
    >
      <Trash2 className="h-3.5 w-3.5" />
      Delete ({selected.size})
    </Button>
  )}
</div>
```

### Hard delete confirmation dialog

```tsx
<AlertDialog open={confirmHardDelete} onOpenChange={setConfirmHardDelete}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
      <AlertDialogDescription>
        {selected.size} item(s) will be permanently deleted from Nextcloud.
        This cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => setConfirmHardDelete(false)}>
        Cancel
      </AlertDialogCancel>
      <AlertDialogAction
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        onClick={() => executeDelete('hard')}
      >
        Delete permanently
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Invalidation on refreshKey change

```typescript
// In the component, respond to external refreshKey changes
const prevRefreshKey = useRef(refreshKey)
useEffect(() => {
  if (refreshKey !== prevRefreshKey.current) {
    prevRefreshKey.current = refreshKey
    queryClient.invalidateQueries({ queryKey: ['nextcloud-files', currentPath] })
  }
}, [refreshKey, currentPath, queryClient])
```

---

## Part 2 — Upload (Drag-Drop + File Picker)

### Location: `DocumentsClient` wraps the left panel

```typescript
// State in documents-client.tsx
const [currentNcPath, setCurrentNcPath] = useState('')
const [refreshKey, setRefreshKey] = useState(0)
const [uploads, setUploads] = useState<UploadItem[]>([])
const [dragOver, setDragOver] = useState(false)

interface UploadItem {
  name: string
  status: 'uploading' | 'done' | 'error'
}
```

### Drag-and-drop wrapper

```tsx
<div
  className={cn(
    "flex flex-col h-full border rounded-lg overflow-hidden transition-colors",
    dragOver && "border-primary bg-primary/5"
  )}
  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
  onDragLeave={() => setDragOver(false)}
  onDrop={handleDrop}
>
  {/* Upload toolbar */}
  <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
    <label className="cursor-pointer">
      <input
        type="file"
        multiple
        className="sr-only"
        onChange={e => handleFiles(Array.from(e.target.files ?? []))}
      />
      <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" asChild>
        <span><Upload className="h-3.5 w-3.5" /> Upload</span>
      </Button>
    </label>

    <label className="cursor-pointer">
      <input
        type="file"
        // @ts-expect-error - webkitdirectory is non-standard
        webkitdirectory=""
        className="sr-only"
        onChange={e => handleFiles(Array.from(e.target.files ?? []))}
      />
      <Button variant="outline" size="sm" className="gap-1.5 pointer-events-none" asChild>
        <span><FolderUp className="h-3.5 w-3.5" /> Folder</span>
      </Button>
    </label>

    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleNewFolder}
    >
      <FolderPlus className="h-3.5 w-3.5" /> New Folder
    </Button>
  </div>

  {/* Upload progress list */}
  {uploads.length > 0 && (
    <div className="px-3 py-2 border-b space-y-1">
      {uploads.map((u, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          {u.status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          {u.status === 'done'      && <CheckCircle2 className="h-3 w-3 text-green-500" />}
          {u.status === 'error'     && <XCircle className="h-3 w-3 text-destructive" />}
          <span className="truncate text-muted-foreground">{u.name}</span>
        </div>
      ))}
    </div>
  )}

  {/* Browser component */}
  <div className="flex-1 overflow-hidden">
    <NextcloudBrowser
      onSelectFile={handleSelectNextcloud}
      onSelectFolder={onSelectFolder}
      refreshKey={refreshKey}
      onPathChange={setCurrentNcPath}
    />
  </div>
</div>
```

### Upload handlers

```typescript
async function handleDrop(e: React.DragEvent) {
  e.preventDefault()
  setDragOver(false)
  const entries = Array.from(e.dataTransfer.items)
    .map(item => item.webkitGetAsEntry())
    .filter(Boolean) as FileSystemEntry[]
  const files = await collectFilesFromEntries(entries)
  await uploadFiles(files)
}

async function handleFiles(fileList: File[]) {
  // For folder upload via input, files already have webkitRelativePath
  const files = fileList.map(f => ({
    file: f,
    relativePath: (f as any).webkitRelativePath || f.name,
  }))
  await uploadFiles(files)
}

// Recursively collect files from drag-and-drop FileSystemEntry tree
async function collectFilesFromEntries(
  entries: FileSystemEntry[],
  basePath = ''
): Promise<Array<{ file: File; relativePath: string }>> {
  const results: Array<{ file: File; relativePath: string }> = []
  for (const entry of entries) {
    if (entry.isFile) {
      const file = await new Promise<File>(resolve =>
        (entry as FileSystemFileEntry).file(resolve)
      )
      results.push({ file, relativePath: basePath ? `${basePath}/${entry.name}` : entry.name })
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const children = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject)
      )
      const nested = await collectFilesFromEntries(
        children,
        basePath ? `${basePath}/${entry.name}` : entry.name
      )
      results.push(...nested)
    }
  }
  return results
}

async function uploadFiles(files: Array<{ file: File; relativePath: string }>) {
  // Create parent directories first
  const dirSet = new Set<string>()
  for (const { relativePath } of files) {
    const segments = relativePath.split('/')
    for (let i = 1; i < segments.length; i++) {
      dirSet.add([currentNcPath, ...segments.slice(0, i)].filter(Boolean).join('/'))
    }
  }
  for (const dir of dirSet) {
    await fetch(`/api/bff/nextcloud/mkdir/${encodePath(dir)}`, { method: 'POST' })
  }

  // Upload files
  setUploads(files.map(f => ({ name: f.relativePath, status: 'uploading' })))
  for (let i = 0; i < files.length; i++) {
    const { file, relativePath } = files[i]
    const uploadPath = [currentNcPath, relativePath].filter(Boolean).join('/')
    try {
      const res = await fetch(`/api/bff/nextcloud/${encodePath(uploadPath)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'x-file-last-modified': String(file.lastModified),
        },
        body: file,
      })
      setUploads(prev => prev.map((u, j) =>
        j === i ? { ...u, status: res.ok ? 'done' : 'error' } : u
      ))
    } catch {
      setUploads(prev => prev.map((u, j) =>
        j === i ? { ...u, status: 'error' } : u
      ))
    }
  }

  // Refresh tree, clear upload list after 3s
  setRefreshKey(k => k + 1)
  setTimeout(() => setUploads([]), 3000)
}

async function handleNewFolder() {
  const name = window.prompt('Folder name:')
  if (!name?.trim()) return
  const path = [currentNcPath, name.trim()].filter(Boolean).join('/')
  await fetch(`/api/bff/nextcloud/mkdir/${encodePath(path)}`, { method: 'POST' })
  setRefreshKey(k => k + 1)
}

function encodePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/')
}
```

---

## Part 3 — Document Viewer (Auth-Aware)

The current `document-viewer.tsx` in AI-OS-POC already supports Paperless. Add Nextcloud support with blob URL loading.

### `useAuthenticatedBlobUrl` hook

```typescript
// apps/web/src/hooks/use-authenticated-blob-url.ts
"use client"
import { useEffect, useRef, useState } from "react"

export function useAuthenticatedBlobUrl(url: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prevUrl = useRef<string | null>(null)
  const prevBlob = useRef<string | null>(null)

  useEffect(() => {
    if (!url) { setBlobUrl(null); return }
    if (url === prevUrl.current) return

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.blob()
      })
      .then(blob => {
        if (cancelled) return
        // Revoke previous blob URL to avoid memory leaks
        if (prevBlob.current) URL.revokeObjectURL(prevBlob.current)
        const objectUrl = URL.createObjectURL(blob)
        prevBlob.current = objectUrl
        prevUrl.current = url
        setBlobUrl(objectUrl)
        setLoading(false)
      })
      .catch(err => {
        if (!cancelled) { setError(err.message); setLoading(false) }
      })

    return () => { cancelled = true }
  }, [url])

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (prevBlob.current) URL.revokeObjectURL(prevBlob.current) }
  }, [])

  return { blobUrl, loading, error }
}
```

### File type detection

```typescript
// In document-viewer.tsx

const OFFICE_EXTENSIONS = ['doc','docx','xls','xlsx','ppt','pptx','odt','ods','odp']
const IMAGE_EXTENSIONS  = ['jpg','jpeg','png','gif','webp','svg','bmp']
const TEXT_EXTENSIONS   = ['txt','md','csv','json','xml','log']

function getFileType(name: string): 'pdf' | 'office' | 'image' | 'text' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf')                    return 'pdf'
  if (OFFICE_EXTENSIONS.includes(ext))  return 'office'
  if (IMAGE_EXTENSIONS.includes(ext))   return 'image'
  if (TEXT_EXTENSIONS.includes(ext))    return 'text'
  return 'other'
}
```

### DocumentViewer additions for Nextcloud files

```tsx
// In DocumentViewer component, add a branch for nextcloudPath:

interface DocumentViewerProps {
  documentId: number | null          // Paperless
  nextcloudPath: string | null       // Nextcloud
  title: string
}

export function DocumentViewer({ documentId, nextcloudPath, title }: DocumentViewerProps) {
  const fileType = nextcloudPath ? getFileType(title) : null

  // Determine which URL to fetch
  const fetchUrl = nextcloudPath
    ? fileType === 'office'
      ? `/api/bff/nextcloud/${encodePath(nextcloudPath)}?convert=pdf`
      : `/api/bff/nextcloud/${encodePath(nextcloudPath)}?download=1`
    : null

  const { blobUrl, loading, error } = useAuthenticatedBlobUrl(fetchUrl)

  // Text files — load as text
  const [textContent, setTextContent] = useState<string | null>(null)
  useEffect(() => {
    if (fileType !== 'text' || !nextcloudPath) return
    fetch(`/api/bff/nextcloud/${encodePath(nextcloudPath)}?download=1`)
      .then(r => r.text())
      .then(setTextContent)
      .catch(() => setTextContent('Failed to load file.'))
  }, [nextcloudPath, fileType])

  if (!nextcloudPath && !documentId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a file to preview
      </div>
    )
  }

  // Nextcloud viewer
  if (nextcloudPath) {
    return (
      <div className="flex flex-col h-full border rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <span className="text-sm font-medium truncate flex-1">{title}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
            <a href={`/api/bff/nextcloud/${encodePath(nextcloudPath)}?download=1`} download={title}>
              <Download className="h-3.5 w-3.5" />
            </a>
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2"
            onClick={() => window.open(`/api/bff/nextcloud/${encodePath(nextcloudPath)}?download=1`)}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full text-sm text-destructive">
              Failed to load: {error}
            </div>
          )}
          {!loading && !error && fileType === 'text' && textContent && (
            <pre className="p-4 text-xs font-mono overflow-auto h-full whitespace-pre-wrap break-words">
              {textContent}
            </pre>
          )}
          {!loading && !error && (fileType === 'pdf' || fileType === 'office') && blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={title}
            />
          )}
          {!loading && !error && fileType === 'image' && blobUrl && (
            <div className="flex items-center justify-center h-full p-4 bg-muted/20">
              <img
                src={blobUrl}
                alt={title}
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          )}
          {!loading && !error && fileType === 'other' && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <FileIcon className="h-12 w-12" />
              <p className="text-sm">{title}</p>
              <Button variant="outline" size="sm" asChild>
                <a href={`/api/bff/nextcloud/${encodePath(nextcloudPath)}?download=1`} download={title}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Existing Paperless viewer continues below...
}
```

---

## Part 4 — BFF API Route Additions

The existing `/api/bff/nextcloud` route in AI-OS-POC needs these new endpoints. Add to `apps/api/src/routes/` (or `apps/web/src/app/api/bff/nextcloud/` if using Next.js API routes).

### Current BFF assumption
Check which pattern AI-OS-POC uses for `bff/nextcloud`. If it's a Next.js API route at `apps/web/src/app/api/bff/`, extend it there. If it's Fastify, extend the Fastify routes.

### Endpoints to add

**PUT `/api/bff/nextcloud/[...path]`** — Upload file

```typescript
// Environment config (add to .env)
NC_URL  = 'http://nextcloud-app:80'    // or your Nextcloud container hostname
NC_USER = 'ncadmin'
NC_PASS = 'ncadmin_password'
NC_BASE = `${NC_URL}/remote.php/dav/files/${NC_USER}`
BASIC_AUTH = Buffer.from(`${NC_USER}:${NC_PASS}`).toString('base64')

// Server-side upload dedup cache (module-level)
const uploadedFiles = new Map<string, number>()  // path → lastModified timestamp

// PUT handler
async function handleUpload(path: string, req: Request) {
  const lastModifiedHeader = req.headers.get('x-file-last-modified')
  const lastModified = lastModifiedHeader ? parseInt(lastModifiedHeader) : null

  // Skip re-uploading identical files
  if (lastModified && uploadedFiles.get(path) === lastModified) {
    return Response.json({ ok: true, skipped: true })
  }

  // Ensure parent directories exist first
  await ensureParentDirs(path)

  const ncRes = await fetch(`${NC_BASE}/${encodePath(path)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Basic ${BASIC_AUTH}`,
      'Content-Type': req.headers.get('Content-Type') ?? 'application/octet-stream',
    },
    body: req.body,
    // @ts-expect-error duplex required for streaming
    duplex: 'half',
  })

  if (ncRes.ok && lastModified) uploadedFiles.set(path, lastModified)
  return Response.json({ ok: ncRes.ok })
}
```

**POST `/api/bff/nextcloud/mkdir/[...path]`** — Create folder

```typescript
const confirmedDirs = new Set<string>()

async function handleMkdir(path: string) {
  if (confirmedDirs.has(path)) return Response.json({ ok: true })
  const res = await fetch(`${NC_BASE}/${encodePath(path)}`, {
    method: 'MKCOL',
    headers: { Authorization: `Basic ${BASIC_AUTH}` },
  })
  // 405 = already exists — treat as success
  if (res.ok || res.status === 405) {
    confirmedDirs.add(path)
    return Response.json({ ok: true })
  }
  return Response.json({ ok: false }, { status: res.status })
}

async function ensureParentDirs(filePath: string) {
  const segments = filePath.split('/')
  for (let i = 1; i < segments.length; i++) {
    const dir = segments.slice(0, i).join('/')
    if (!confirmedDirs.has(dir)) {
      await fetch(`${NC_BASE}/${encodePath(dir)}`, {
        method: 'MKCOL',
        headers: { Authorization: `Basic ${BASIC_AUTH}` },
      })
      confirmedDirs.add(dir)
    }
  }
}
```

**DELETE `/api/bff/nextcloud/[...path]`** — Soft or hard delete

```typescript
async function handleDelete(path: string) {
  const isInTrash = path.startsWith('_deleted/')

  if (isInTrash) {
    // Hard delete
    const res = await fetch(`${NC_BASE}/${encodePath(path)}`, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${BASIC_AUTH}` },
    })
    await logAudit('hard_delete', path)
    return Response.json({ ok: res.ok })
  } else {
    // Soft delete — MOVE to _deleted/
    const filename = path.split('/').pop()!
    const dest = `${NC_BASE}/_deleted/${encodeURIComponent(filename)}`
    const res = await fetch(`${NC_BASE}/${encodePath(path)}`, {
      method: 'MOVE',
      headers: {
        Authorization: `Basic ${BASIC_AUTH}`,
        Destination: dest,
        Overwrite: 'T',
      },
    })
    await logAudit('soft_delete', path)
    return Response.json({ ok: res.ok })
  }
}

async function logAudit(action: string, path: string) {
  // Insert into app.document_audit_log — adjust to your DB client
  await db.query(
    'INSERT INTO document_audit_log (action, path) VALUES ($1, $2)',
    [action, path]
  )
}
```

**GET `/api/bff/nextcloud/[...path]?convert=pdf`** — Office → PDF via Collabora

```typescript
const COLLAB_URL = process.env.COLLABORA_URL ?? 'http://collabora:9980'

async function handleConvert(path: string) {
  // Fetch original file from Nextcloud
  const fileRes = await fetch(`${NC_BASE}/${encodePath(path)}`, {
    headers: { Authorization: `Basic ${BASIC_AUTH}` },
  })
  if (!fileRes.ok) return new Response('Not found', { status: 404 })

  const fileBlob = await fileRes.blob()
  const filename = path.split('/').pop()!

  // POST to Collabora for conversion
  const formData = new FormData()
  formData.append('data', fileBlob, filename)

  try {
    const pdfRes = await fetch(`${COLLAB_URL}/cool/convert-to/pdf`, {
      method: 'POST',
      body: formData,
    })
    if (pdfRes.ok) {
      return new Response(pdfRes.body, {
        headers: { 'Content-Type': 'application/pdf' },
      })
    }
  } catch { /* fall through to raw */ }

  // Fallback: return raw file
  return new Response(fileBlob, {
    headers: { 'Content-Type': fileRes.headers.get('Content-Type') ?? 'application/octet-stream' },
  })
}
```

**POST `/api/bff/nextcloud/share/[...path]`** — Create public share link

```typescript
const NC_PUB_URL = process.env.NC_PUBLIC_URL ?? 'http://localhost:8090'

async function handleShare(path: string) {
  const res = await fetch(`${process.env.NC_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${BASIC_AUTH}`,
      'OCS-APIRequest': 'true',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      path: `/${path}`,
      shareType: '3',    // 3 = public link
      permissions: '1',  // 1 = read only
    }),
  })
  const xml = await res.text()
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const token = doc.querySelector('token')?.textContent
  if (!token) return Response.json({ error: 'Share failed' }, { status: 500 })
  return Response.json({ url: `${NC_PUB_URL}/s/${token}` })
}
```

**POST `/api/bff/nextcloud/maintenance`** — Purge old trash items

```typescript
async function handleMaintenance() {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const propfindRes = await fetch(`${NC_BASE}/_deleted/`, {
    method: 'PROPFIND',
    headers: {
      Authorization: `Basic ${BASIC_AUTH}`,
      Depth: '1',
      'Content-Type': 'application/xml',
    },
  })
  if (!propfindRes.ok) return Response.json({ purged: 0 })

  const xml = await propfindRes.text()
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const responses = Array.from(doc.querySelectorAll('response'))

  let purged = 0
  const errors: string[] = []

  for (const response of responses) {
    const href = response.querySelector('href')?.textContent ?? ''
    const match = href.match(/\/remote\.php\/dav\/files\/[^/]+\/(.*)/)
    if (!match || !match[1].startsWith('_deleted/')) continue
    const lastModified = response.querySelector('getlastmodified')?.textContent
    if (!lastModified) continue
    const mtime = new Date(lastModified).getTime()
    if (mtime > thirtyDaysAgo) continue

    const path = decodeURIComponent(match[1]).replace(/\/$/, '')
    const delRes = await fetch(`${NC_BASE}/${encodePath(path)}`, {
      method: 'DELETE',
      headers: { Authorization: `Basic ${BASIC_AUTH}` },
    })
    if (delRes.ok) {
      purged++
      await logAudit('purge', path)
    } else {
      errors.push(path)
    }
  }

  return Response.json({ purged, errors })
}
```

---

## Part 5 — Database

```sql
-- Audit log for document operations
CREATE TABLE IF NOT EXISTS document_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT        NOT NULL,   -- 'soft_delete' | 'hard_delete' | 'purge'
  path        TEXT        NOT NULL,
  actor       TEXT        DEFAULT 'system',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_audit_created ON document_audit_log(created_at);

-- Named folder references (optional — for AI-OS tools that need named Nextcloud paths)
CREATE TABLE IF NOT EXISTS folder_references (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alias           TEXT        NOT NULL,
  display_name    TEXT        NOT NULL,
  nextcloud_path  TEXT        NOT NULL,
  description     TEXT,
  is_active       BOOLEAN     DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_folder_refs_alias_active
  ON folder_references(alias) WHERE is_active = TRUE;
```

---

## Part 6 — Environment Variables

Add to `.env`:

```env
# Nextcloud (internal container URL)
NC_URL=http://nextcloud-app:80
NC_USER=ncadmin
NC_PASS=your_nextcloud_password

# Nextcloud public URL (for share links — must be browser-accessible)
NC_PUBLIC_URL=http://your-host:8090

# Collabora (office document conversion)
COLLABORA_URL=http://collabora:9980
```

---

## Part 7 — New Dependencies

```bash
# No new npm packages required
# html2canvas is NOT needed here (that's for feedback screenshots)
# All WebDAV parsing uses native browser DOMParser
# All HTTP uses native fetch
```

The only new Radix component needed is `AlertDialog` (for hard-delete confirmation):

```bash
npx shadcn@latest add alert-dialog
```

---

## Part 8 — Permissions

Add to your RBAC system:

```typescript
// Permission codes to register
{ code: 'DOCUMENT_VIEW',   label: 'View Documents',   category: 'view'  }
{ code: 'DOCUMENT_UPLOAD', label: 'Upload Documents', category: 'edit'  }
{ code: 'DOCUMENT_DELETE', label: 'Delete Documents', category: 'admin' }
```

Gate routes:
- `GET /api/bff/nextcloud/**` → `DOCUMENT_VIEW`
- `PUT /api/bff/nextcloud/**` → `DOCUMENT_UPLOAD`
- `POST /api/bff/nextcloud/mkdir/**` → `DOCUMENT_UPLOAD`
- `DELETE /api/bff/nextcloud/**` → `DOCUMENT_DELETE`
- `POST /api/bff/nextcloud/maintenance` → `DOCUMENT_DELETE`

---

## Implementation Order

1. `npx shadcn@latest add alert-dialog` (for hard delete confirm)
2. Add `.env` variables (`NC_URL`, `NC_USER`, `NC_PASS`, `NC_PUBLIC_URL`, `COLLABORA_URL`)
3. Extend BFF route: add `PUT`, `DELETE`, `POST mkdir`, `POST share`, `GET ?convert=pdf`, `POST maintenance`
4. Add `useAuthenticatedBlobUrl` hook
5. Enhance `nextcloud-browser.tsx`: multi-select state, checkbox row, delete toolbar, confirmation dialog, `refreshKey` prop, `onPathChange` callback
6. Enhance `document-viewer.tsx`: file type detection, Nextcloud blob URL viewer branch
7. Wrap left panel in `documents-client.tsx` with drag-drop handler, upload state, toolbar
8. Run DB migration for `document_audit_log` and `folder_references`
9. Wire permissions

---

## Key Differences from ndt-portal-v1

| Concern | ndt-portal-v1 | AI-OS-POC |
|---------|---------------|-----------|
| Frontend framework | Vite + React Router | Next.js App Router |
| API layer | Express.js `api/src/routes/documents.ts` | Fastify or Next.js API routes in `apps/api/` or `apps/web/src/app/api/bff/` |
| Auth in API routes | `Authorization: Bearer JWT` middleware | `next-auth` session via `getServerSession()` or Fastify `authenticate` preHandler |
| Data fetching | Custom fetch + `getAuthHeaders()` | TanStack Query `useQuery` (already in place) |
| UI components | Custom Tailwind components | shadcn/ui + Radix (already in place) |
| Blob URL fetch | Passes Bearer token explicitly | Cookies handled automatically by `fetch()` in Next.js — session cookie included |
| Collabora | `http://collabora:9980` container | Same — add to docker-compose if not present |
| Existing NextcloudBrowser | Built from scratch | Already exists — extend, don't replace |
