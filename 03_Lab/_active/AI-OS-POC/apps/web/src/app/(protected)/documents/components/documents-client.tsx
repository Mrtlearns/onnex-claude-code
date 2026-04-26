"use client"
// apps/web/src/app/(protected)/documents/components/documents-client.tsx
// Two-panel layout matching NDT portal pattern — useRef uploads, icon-only toolbar, concurrent uploads

import { useState, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, FolderUp, FolderPlus, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Session } from "next-auth"
import type { PaperlessDocument, NextcloudFile } from "@/types/api"
import { PaperlessBrowser } from "./paperless-browser"
import { NextcloudBrowser } from "./nextcloud-browser"
import { DocumentViewer } from "./document-viewer"

interface UploadItem {
  name: string
  status: "uploading" | "done" | "error"
}

interface DocumentsClientProps {
  session: Session | null
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/")
}

async function collectFilesFromEntries(
  entry: FileSystemEntry,
  prefix: string,
  results: Array<{ file: File; relativePath: string }>,
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve) => (entry as FileSystemFileEntry).file(resolve))
    results.push({ file, relativePath: prefix + entry.name })
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    let batch: FileSystemEntry[]
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve) => reader.readEntries(resolve))
      for (const child of batch) {
        await collectFilesFromEntries(child, prefix + entry.name + "/", results)
      }
    } while (batch.length > 0)
  }
}

export function DocumentsClient({ session: _session }: DocumentsClientProps) {
  const [selectedDoc, setSelectedDoc] = useState<PaperlessDocument | null>(null)
  const [selectedNcFile, setSelectedNcFile] = useState<NextcloudFile | null>(null)
  const [currentNcPath, setCurrentNcPath] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleSelectPaperless = (doc: PaperlessDocument) => {
    setSelectedDoc(doc)
    setSelectedNcFile(null)
  }

  const handleSelectNextcloud = (file: NextcloudFile) => {
    setSelectedNcFile(file)
    setSelectedDoc(null)
  }

  async function uploadFiles(files: Array<{ file: File; relativePath: string }>) {
    // Create parent directories first (sequential — ordering matters for nested dirs)
    const dirs = [
      ...new Set(
        files.flatMap(({ relativePath }) => {
          const parts = relativePath.split("/").slice(0, -1)
          return parts.map((_, i) => parts.slice(0, i + 1).join("/"))
        }).filter(Boolean),
      ),
    ].sort((a, b) => a.split("/").length - b.split("/").length)

    const base = currentNcPath ? currentNcPath + "/" : ""
    for (const dir of dirs) {
      await fetch(`/api/bff/nextcloud/mkdir/${encodePath(base + dir)}`, { method: "POST" })
    }

    const items: UploadItem[] = files.map((f) => ({ name: f.relativePath, status: "uploading" }))
    setUploads(items)

    // Concurrent uploads
    await Promise.all(
      files.map(async ({ file, relativePath }, i) => {
        const uploadPath = base + relativePath
        try {
          const res = await fetch(`/api/bff/nextcloud/${encodePath(uploadPath)}`, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
              "x-file-last-modified": String(file.lastModified),
            },
            body: file,
          })
          setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: res.ok ? "done" : "error" } : u)))
        } catch {
          setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: "error" } : u)))
        }
      }),
    )

    setRefreshKey((k) => k + 1)
    setTimeout(() => setUploads([]), 3000)
  }

  async function handleFileInput(fileList: FileList) {
    const files = Array.from(fileList).map((f) => ({ file: f, relativePath: f.name }))
    await uploadFiles(files)
  }

  async function handleFolderInput(fileList: FileList) {
    const files = Array.from(fileList).map((f) => ({
      file: f,
      relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
    }))
    await uploadFiles(files)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const collected: Array<{ file: File; relativePath: string }> = []
    for (const item of Array.from(e.dataTransfer.items)) {
      const entry = item.webkitGetAsEntry()
      if (entry) await collectFilesFromEntries(entry, "", collected)
    }
    if (collected.length) await uploadFiles(collected)
  }

  async function handleNewFolder() {
    const name = window.prompt("Folder name:")
    if (!name?.trim()) return
    const path = [currentNcPath, name.trim()].filter(Boolean).join("/")
    await fetch(`/api/bff/nextcloud/mkdir/${encodePath(path)}`, { method: "POST" })
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4 flex-1 min-h-0">
        {/* Left panel */}
        <Tabs defaultValue="nextcloud" className="flex flex-col min-h-0">
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="nextcloud" className="flex-1">Nextcloud</TabsTrigger>
            <TabsTrigger value="paperless" className="flex-1">Paperless</TabsTrigger>
          </TabsList>

          <TabsContent value="nextcloud" className="flex-1 overflow-hidden mt-0 min-h-0">
            <div
              className={cn(
                "flex flex-col h-full border rounded-lg overflow-hidden transition-colors",
                dragOver && "bg-primary/5 ring-2 ring-primary/30 ring-inset",
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {/* Header with icon-only upload toolbar */}
              <div className="px-3 py-2 border-b flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-semibold flex-1 text-foreground/80">Files</span>
                <button
                  title="Upload files"
                  className="p-1 rounded hover:bg-muted/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  title="Upload folder (or drag & drop)"
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
                <div className="px-2 py-1 space-y-0.5 border-b shrink-0 max-h-20 overflow-auto">
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
              <div className="flex-1 overflow-hidden min-h-0">
                <NextcloudBrowser
                  onSelectFile={handleSelectNextcloud}
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
                onChange={(e) => { if (e.target.files?.length) handleFileInput(e.target.files); e.target.value = "" }}
              />
              <input
                ref={folderInputRef}
                type="file"
                // @ts-expect-error webkitdirectory is non-standard
                webkitdirectory=""
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files?.length) handleFolderInput(e.target.files); e.target.value = "" }}
              />
            </div>
          </TabsContent>

          <TabsContent value="paperless" className="flex-1 overflow-auto mt-0">
            <PaperlessBrowser onSelect={handleSelectPaperless} />
          </TabsContent>
        </Tabs>

        {/* Right panel: viewer */}
        <DocumentViewer
          documentId={selectedDoc?.id ?? null}
          title={selectedDoc?.title ?? selectedNcFile?.name ?? ""}
          nextcloudPath={selectedNcFile?.path ?? null}
        />
      </div>
    </div>
  )
}
