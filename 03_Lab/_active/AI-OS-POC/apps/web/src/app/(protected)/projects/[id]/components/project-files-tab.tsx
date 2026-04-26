"use client"
// apps/web/src/app/(protected)/projects/[id]/components/project-files-tab.tsx
// Inline Nextcloud browser scoped to the project's linked folder.
// Same toolbar/drag-drop/delete behavior as the Documents page.

import { useState, useRef, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { NextcloudBrowser } from "../../../documents/components/nextcloud-browser"
import { LinkDocumentDialog } from "../../../documents/components/link-document-dialog"
import { useLinkDocument } from "@/hooks/use-link-document"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Upload, FolderUp, FolderPlus, Link2, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { DocumentLink } from "@/types/api"

interface UploadItem {
  name: string
  status: "uploading" | "done" | "error"
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/")
}

interface ProjectFilesTabProps {
  projectId: string
}

export function ProjectFilesTab({ projectId }: ProjectFilesTabProps) {
  const queryClient = useQueryClient()
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const { linkDocument } = useLinkDocument({ entityType: "project", entityId: projectId })

  const { data: links = [], isLoading } = useQuery<DocumentLink[]>({
    queryKey: ["document-links", "project", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/bff/documents/links?entity_type=project&entity_id=${projectId}`)
      const json = await res.json()
      return (json.documentLinks ?? []) as DocumentLink[]
    },
    staleTime: 30_000,
  })

  const folderLink = links.find(l => l.link_type === "folder" && l.document_source === "nextcloud")

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />
  }

  if (!folderLink) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center border rounded-lg">
          <p className="text-sm text-muted-foreground">No folder linked to this project.</p>
          <Button size="sm" variant="outline" onClick={() => setLinkDialogOpen(true)}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Link Folder
          </Button>
        </div>
        <LinkDocumentDialog
          entityType="project"
          entityId={projectId}
          open={linkDialogOpen}
          onClose={() => setLinkDialogOpen(false)}
          onLink={async (source, docId, linkType, displayName) => {
            const ok = await linkDocument(source, docId, linkType, displayName)
            if (ok) {
              toast.success("Folder linked")
              queryClient.invalidateQueries({ queryKey: ["document-links", "project", projectId] })
            }
            return ok
          }}
        />
      </>
    )
  }

  const folderName = folderLink.display_name ?? folderLink.document_id.split("/").pop() ?? folderLink.document_id

  return (
    <InlineFolderBrowser
      key={folderLink.document_id}
      folderPath={folderLink.document_id}
      folderName={folderName}
    />
  )
}

interface InlineFolderBrowserProps {
  folderPath: string
  folderName: string
}

function InlineFolderBrowser({ folderPath, folderName }: InlineFolderBrowserProps) {
  const [currentNcPath, setCurrentNcPath] = useState(folderPath)
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "")
    }
  }, [])

  async function uploadFiles(files: Array<{ file: File; relativePath: string }>) {
    setUploads(files.map(f => ({ name: f.relativePath, status: "uploading" })))
    const base = currentNcPath ? currentNcPath + "/" : ""
    await Promise.all(
      files.map(async ({ file, relativePath }, i) => {
        try {
          const res = await fetch(`/api/bff/nextcloud/${encodePath(base + relativePath)}`, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
              "x-file-last-modified": String(file.lastModified),
            },
            body: file,
          })
          setUploads(prev => prev.map((u, j) => j === i ? { ...u, status: res.ok ? "done" : "error" } : u))
        } catch {
          setUploads(prev => prev.map((u, j) => j === i ? { ...u, status: "error" } : u))
        }
      })
    )
    setRefreshKey(k => k + 1)
    setTimeout(() => setUploads([]), 3000)
  }

  function handleFileInput(fileList: FileList) {
    uploadFiles(Array.from(fileList).map(f => ({ file: f, relativePath: f.name })))
  }

  function handleFolderInput(fileList: FileList) {
    uploadFiles(Array.from(fileList).map(f => ({
      file: f,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      relativePath: (f as any).webkitRelativePath || f.name,
    })))
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const collected: Array<{ file: File; relativePath: string }> = []
    for (const item of Array.from(e.dataTransfer.items)) {
      const entry = item.webkitGetAsEntry()
      if (entry?.isFile) {
        const file = await new Promise<File>(r => (entry as FileSystemFileEntry).file(r))
        collected.push({ file, relativePath: file.name })
      }
    }
    if (collected.length) await uploadFiles(collected)
  }

  async function handleNewFolder() {
    const name = window.prompt("Folder name:")
    if (!name?.trim()) return
    const path = [currentNcPath, name.trim()].filter(Boolean).join("/")
    await fetch(`/api/bff/nextcloud/mkdir/${encodePath(path)}`, { method: "POST" })
    setRefreshKey(k => k + 1)
  }

  return (
    <div
      className={cn(
        "border rounded-lg flex flex-col min-h-96 transition-colors",
        dragOver && "border-primary bg-primary/5 ring-2 ring-primary/20 ring-inset"
      )}
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Toolbar */}
      <div className="px-3 py-2 border-b flex items-center gap-1.5 shrink-0">
        <span className="text-sm font-semibold flex-1 text-foreground/80">{folderName}</span>
        <button
          title="Upload files"
          className="p-1 rounded hover:bg-muted/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          title="Upload folder"
          className="p-1 rounded hover:bg-muted/50 transition-colors"
          onClick={() => folderInputRef.current?.click()}
        >
          <FolderUp className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          title="New folder"
          className="p-1 rounded hover:bg-muted/50 transition-colors"
          onClick={handleNewFolder}
        >
          <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="px-2 py-1 border-b space-y-0.5 shrink-0">
          {uploads.map((u, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              {u.status === "uploading" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />}
              {u.status === "done" && <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />}
              {u.status === "error" && <XCircle className="h-3 w-3 text-destructive shrink-0" />}
              <span className="truncate text-muted-foreground">{u.name.split("/").pop()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Browser */}
      <div className="flex-1 overflow-auto">
        <NextcloudBrowser
          initialPath={folderPath}
          refreshKey={refreshKey}
          onPathChange={setCurrentNcPath}
        />
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) handleFileInput(e.target.files)
          e.target.value = ""
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) handleFolderInput(e.target.files)
          e.target.value = ""
        }}
      />
    </div>
  )
}
