"use client"
// apps/web/src/app/(protected)/documents/components/documents-client.tsx
// Two-panel layout with drag-drop upload, upload progress, toolbar, and document viewer

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
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
  entries: FileSystemEntry[],
  basePath = "",
): Promise<Array<{ file: File; relativePath: string }>> {
  const results: Array<{ file: File; relativePath: string }> = []
  for (const entry of entries) {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve) => (entry as FileSystemFileEntry).file(resolve))
      results.push({ file, relativePath: basePath ? `${basePath}/${entry.name}` : entry.name })
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const children = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject),
      )
      const nested = await collectFilesFromEntries(
        children,
        basePath ? `${basePath}/${entry.name}` : entry.name,
      )
      results.push(...nested)
    }
  }
  return results
}

export function DocumentsClient({ session: _session }: DocumentsClientProps) {
  const [selectedDoc, setSelectedDoc] = useState<PaperlessDocument | null>(null)
  const [selectedNcFile, setSelectedNcFile] = useState<NextcloudFile | null>(null)
  const [currentNcPath, setCurrentNcPath] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)

  const handleSelectPaperless = (doc: PaperlessDocument) => {
    setSelectedDoc(doc)
    setSelectedNcFile(null)
  }

  const handleSelectNextcloud = (file: NextcloudFile) => {
    setSelectedNcFile(file)
    setSelectedDoc(null)
  }

  async function uploadFiles(files: Array<{ file: File; relativePath: string }>) {
    // Create parent directories first
    const dirSet = new Set<string>()
    for (const { relativePath } of files) {
      const segments = relativePath.split("/")
      for (let i = 1; i < segments.length; i++) {
        dirSet.add([currentNcPath, ...segments.slice(0, i)].filter(Boolean).join("/"))
      }
    }
    for (const dir of dirSet) {
      await fetch(`/api/bff/nextcloud/mkdir/${encodePath(dir)}`, { method: "POST" })
    }

    setUploads(files.map((f) => ({ name: f.relativePath, status: "uploading" })))

    for (let i = 0; i < files.length; i++) {
      const { file, relativePath } = files[i]
      const uploadPath = [currentNcPath, relativePath].filter(Boolean).join("/")
      try {
        const res = await fetch(`/api/bff/nextcloud/${encodePath(uploadPath)}`, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "x-file-last-modified": String(file.lastModified),
          },
          body: file,
        })
        setUploads((prev) =>
          prev.map((u, j) => (j === i ? { ...u, status: res.ok ? "done" : "error" } : u)),
        )
      } catch {
        setUploads((prev) => prev.map((u, j) => (j === i ? { ...u, status: "error" } : u)))
      }
    }

    setRefreshKey((k) => k + 1)
    setTimeout(() => setUploads([]), 3000)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const entries = Array.from(e.dataTransfer.items)
      .map((item) => item.webkitGetAsEntry())
      .filter(Boolean) as FileSystemEntry[]
    const files = await collectFilesFromEntries(entries)
    await uploadFiles(files)
  }

  async function handleFiles(fileList: File[]) {
    const files = fileList.map((f) => ({
      file: f,
      relativePath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
    }))
    await uploadFiles(files)
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
            {/* Drag-drop wrapper */}
            <div
              className={cn(
                "flex flex-col h-full border rounded-lg overflow-hidden transition-colors",
                dragOver && "border-primary bg-primary/5",
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {/* Upload toolbar */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b bg-muted/30 shrink-0 flex-wrap">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
                  />
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs pointer-events-none" asChild>
                    <span><Upload className="h-3 w-3" /> Upload</span>
                  </Button>
                </label>

                <label className="cursor-pointer">
                  <input
                    type="file"
                    // @ts-expect-error webkitdirectory is non-standard
                    webkitdirectory=""
                    className="sr-only"
                    onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
                  />
                  <Button variant="outline" size="sm" className="gap-1 h-7 text-xs pointer-events-none" asChild>
                    <span><FolderUp className="h-3 w-3" /> Folder</span>
                  </Button>
                </label>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 h-7 text-xs"
                  onClick={handleNewFolder}
                >
                  <FolderPlus className="h-3 w-3" /> New Folder
                </Button>
              </div>

              {/* Upload progress */}
              {uploads.length > 0 && (
                <div className="px-3 py-1.5 border-b space-y-0.5 shrink-0 max-h-24 overflow-auto">
                  {uploads.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {u.status === "uploading" && (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground shrink-0" />
                      )}
                      {u.status === "done" && (
                        <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                      )}
                      {u.status === "error" && (
                        <XCircle className="h-3 w-3 text-destructive shrink-0" />
                      )}
                      <span className="truncate text-muted-foreground">{u.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Browser */}
              <div className="flex-1 overflow-hidden min-h-0">
                <NextcloudBrowser
                  onSelectFile={handleSelectNextcloud}
                  onSelectFolder={undefined}
                  refreshKey={refreshKey}
                  onPathChange={setCurrentNcPath}
                />
              </div>
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
