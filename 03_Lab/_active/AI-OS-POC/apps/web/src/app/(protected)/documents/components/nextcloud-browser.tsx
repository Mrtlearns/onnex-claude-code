"use client"
// apps/web/src/app/(protected)/documents/components/nextcloud-browser.tsx
// WebDAV browser with multi-select, soft/hard delete, refreshKey, onPathChange

import { useState, useRef, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FolderIcon, FileIcon, ChevronRightIcon, FolderInput, CheckSquare, Square, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NextcloudFile } from "@/types/api"

function parseWebDavXml(xml: string, currentPath: string): NextcloudFile[] {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "application/xml")
    const responses = Array.from(doc.querySelectorAll("response"))
    const results: NextcloudFile[] = []

    for (const response of responses) {
      const href = response.querySelector("href")?.textContent ?? ""
      const match = href.match(/\/remote\.php\/dav\/files\/[^/]+\/(.*)/)
      if (!match) continue
      const filePath = decodeURIComponent(match[1]).replace(/\/$/, "")
      if (filePath === currentPath || filePath === "") continue

      const displayName = response.querySelector("displayname")?.textContent ?? filePath.split("/").pop() ?? ""
      const isCollection = response.querySelector("collection") !== null
      const sizeText = response.querySelector("getcontentlength")?.textContent ?? "0"
      const lastModifiedText = response.querySelector("getlastmodified")?.textContent ?? ""

      results.push({
        name: displayName,
        path: filePath,
        type: isCollection ? "directory" : "file",
        size: parseInt(sizeText, 10) || 0,
        lastModified: lastModifiedText,
      })
    }
    return results
  } catch {
    return []
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface NextcloudBrowserProps {
  onSelectFile?: (file: NextcloudFile) => void
  onSelectFolder?: (path: string, name: string) => void
  refreshKey?: number
  onPathChange?: (path: string) => void
  initialPath?: string
}

export function NextcloudBrowser({
  onSelectFile,
  onSelectFolder,
  refreshKey,
  onPathChange,
  initialPath = "",
}: NextcloudBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmHardDelete, setConfirmHardDelete] = useState(false)
  const queryClient = useQueryClient()
  const prevRefreshKey = useRef(refreshKey)

  // Respond to external refreshKey changes
  useEffect(() => {
    if (refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey
      queryClient.invalidateQueries({ queryKey: ["nextcloud-files", currentPath] })
    }
  }, [refreshKey, currentPath, queryClient])

  const bffUrl = currentPath ? `/api/bff/nextcloud/${currentPath}` : "/api/bff/nextcloud"

  const { data: files = [], isLoading, isError } = useQuery<NextcloudFile[]>({
    queryKey: ["nextcloud-files", currentPath],
    queryFn: async () => {
      const r = await fetch(bffUrl)
      if (!r.ok) throw new Error(`Nextcloud error: ${r.status}`)
      const xml = await r.text()
      return parseWebDavXml(xml, currentPath)
    },
    staleTime: 30_000,
    retry: false,
  })

  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : []

  function navigateTo(path: string) {
    setCurrentPath(path)
    exitSelectMode()
    onPathChange?.(path)
  }

  function toggleSelect(path: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
  }

  function handleToggleSelectMode() {
    if (selectMode) exitSelectMode()
    else setSelectMode(true)
  }

  async function executeDelete() {
    const failures: string[] = []
    for (const path of selected) {
      const encoded = path.split("/").map(encodeURIComponent).join("/")
      const res = await fetch(`/api/bff/nextcloud/${encoded}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!data.ok) failures.push(path.split("/").pop() ?? path)
    }
    exitSelectMode()
    queryClient.invalidateQueries({ queryKey: ["nextcloud-files", currentPath] })
    setConfirmHardDelete(false)
    if (failures.length > 0) toast.error(`Failed to delete: ${failures.join(", ")}`)
  }

  function handleDelete() {
    const allInTrash = [...selected].every((p) => p.startsWith("_deleted/"))
    if (allInTrash) {
      setConfirmHardDelete(true)
    } else {
      executeDelete()
    }
  }

  const handleFileClick = (item: NextcloudFile) => {
    if (selectMode) {
      toggleSelect(item.path)
      return
    }
    if (item.type === "directory") {
      navigateTo(item.path)
    } else {
      if (onSelectFile) {
        onSelectFile(item)
      } else {
        const encoded = item.path.split("/").map(encodeURIComponent).join("/")
        window.open(`/api/bff/nextcloud/${encoded}?download=1`, "_blank")
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Selection toolbar */}
      <div className="flex items-center gap-1 px-2 pt-2 pb-1">
        <button
          title={selectMode ? "Exit selection mode" : "Select files"}
          className={cn(
            "p-1 rounded transition-colors",
            selectMode ? "bg-muted text-foreground" : "hover:bg-muted/50 text-muted-foreground",
          )}
          onClick={handleToggleSelectMode}
        >
          {selectMode ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        {selectMode && selected.size > 0 && (
          <button
            title={`Delete ${selected.size} item(s)`}
            className="flex items-center gap-1 px-1.5 py-1 rounded text-xs text-red-500 hover:bg-red-500/10 transition-colors"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{selected.size}</span>
          </button>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 px-2 pb-1.5 text-xs text-muted-foreground flex-wrap">
        <button className="hover:text-foreground transition-colors shrink-0" onClick={() => navigateTo("")}>
          Root
        </button>
        {breadcrumbs.map((segment, idx) => {
          const path = breadcrumbs.slice(0, idx + 1).join("/")
          return (
            <span key={path} className="flex items-center gap-1">
              <ChevronRightIcon className="h-3 w-3" />
              <button className="hover:text-foreground transition-colors" onClick={() => navigateTo(path)}>
                {segment}
              </button>
            </span>
          )
        })}
      </div>

      {/* File/folder list */}
      <div className="flex-1 overflow-auto p-2 space-y-0.5">
        {isLoading && (
          <div className="space-y-1">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Could not connect to Nextcloud
          </div>
        )}

        {!isLoading && !isError && files.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">Empty folder</div>
        )}

        {!isLoading &&
          !isError &&
          files.map((item) => {
            const isSelected = selected.has(item.path)
            return (
              <div
                key={item.path}
                className={cn("flex items-center gap-1 group rounded", isSelected && "bg-muted/70")}
              >
                {selectMode && (
                  <input
                    type="checkbox"
                    readOnly
                    checked={isSelected}
                    onClick={() => toggleSelect(item.path)}
                    className="ml-2 shrink-0 cursor-pointer"
                  />
                )}

                <button
                  className="flex items-center gap-2 flex-1 px-2 py-1.5 rounded text-sm hover:bg-muted/50 transition-colors text-left"
                  onClick={() => handleFileClick(item)}
                >
                  {item.type === "directory" ? (
                    <FolderIcon className="h-4 w-4 text-yellow-500 shrink-0" />
                  ) : (
                    <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="truncate">{item.name}</span>
                  {!selectMode && item.type === "file" && (
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {formatBytes(item.size)}
                    </span>
                  )}
                </button>

                {item.type === "directory" && onSelectFolder && !selectMode && (
                  <button
                    className="flex items-center gap-1 h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded hover:bg-muted/50"
                    onClick={(e) => { e.stopPropagation(); onSelectFolder(item.path, item.name) }}
                    title="Link this folder"
                  >
                    <FolderInput className="h-3.5 w-3.5" />
                    Link
                  </button>
                )}
              </div>
            )
          })}
      </div>

      {/* Hard delete confirmation */}
      <AlertDialog open={confirmHardDelete} onOpenChange={setConfirmHardDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size} item(s) will be permanently deleted from Nextcloud. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmHardDelete(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executeDelete}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
