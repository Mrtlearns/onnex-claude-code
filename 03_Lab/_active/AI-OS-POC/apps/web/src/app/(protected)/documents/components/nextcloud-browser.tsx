"use client"
// apps/web/src/app/(protected)/documents/components/nextcloud-browser.tsx
// Calls /api/bff/nextcloud (BFF PROPFIND proxy) — parses WebDAV XML client-side

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { FolderIcon, FileIcon, ChevronRightIcon, FolderInput } from "lucide-react"
import type { NextcloudFile } from "@/types/api"

// Parse WebDAV PROPFIND XML response into NextcloudFile list
function parseWebDavXml(xml: string, currentPath: string): NextcloudFile[] {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, "application/xml")
    const responses = Array.from(doc.querySelectorAll("response"))
    const results: NextcloudFile[] = []

    for (const response of responses) {
      const href = response.querySelector("href")?.textContent ?? ""
      // Extract path after /remote.php/dav/files/{user}/
      // Works with both /remote.php/... and /nextcloud/remote.php/... hrefs (no ^ anchor)
      const match = href.match(/\/remote\.php\/dav\/files\/[^/]+\/(.*)/)
      if (!match) continue
      const filePath = decodeURIComponent(match[1]).replace(/\/$/, "")

      // Skip the current directory entry itself
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

interface NextcloudBrowserProps {
  onSelectFile?: (file: NextcloudFile) => void
  onSelectFolder?: (path: string, name: string) => void
}

export function NextcloudBrowser({ onSelectFile, onSelectFolder }: NextcloudBrowserProps) {
  const [currentPath, setCurrentPath] = useState("")

  const bffUrl = currentPath
    ? `/api/bff/nextcloud/${currentPath}`
    : "/api/bff/nextcloud"

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

  // Build breadcrumb segments from currentPath
  const breadcrumbs = currentPath ? currentPath.split("/").filter(Boolean) : []

  const navigateTo = (path: string) => setCurrentPath(path)

  const handleFileClick = (item: NextcloudFile) => {
    if (item.type === "directory") {
      navigateTo(item.path)
    } else {
      if (onSelectFile) {
        onSelectFile(item)
      } else {
        window.open(`/api/bff/nextcloud/${item.path}?download=1`, "_blank")
      }
    }
  }

  return (
    <div className="flex flex-col h-full p-2 space-y-2">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
        <button
          className="hover:text-foreground transition-colors"
          onClick={() => navigateTo("")}
        >
          Root
        </button>
        {breadcrumbs.map((segment, idx) => {
          const path = breadcrumbs.slice(0, idx + 1).join("/")
          return (
            <span key={path} className="flex items-center gap-1">
              <ChevronRightIcon className="h-3 w-3" />
              <button
                className="hover:text-foreground transition-colors"
                onClick={() => navigateTo(path)}
              >
                {segment}
              </button>
            </span>
          )
        })}
      </div>

      {/* File/folder list */}
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
        <div className="text-sm text-muted-foreground text-center py-4">
          Empty folder
        </div>
      )}

      {!isLoading && !isError && files.length > 0 && (
        <div className="space-y-1 overflow-auto">
          {files.map((item) => (
            <div key={item.path} className="flex items-center gap-1 group">
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
              </button>
              {item.type === "directory" && onSelectFolder && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={(e) => { e.stopPropagation(); onSelectFolder(item.path, item.name) }}
                  title="Link this folder"
                >
                  <FolderInput className="h-3.5 w-3.5 mr-1" />
                  Link
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
